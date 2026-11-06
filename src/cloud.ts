import { SyncConflict, authMode, validateConnection, type Connection, type CloudSnapshot } from './sync-core';
const TIMEOUT = 15000;
export class SchemaMissingError extends Error { constructor() { super('Cloud database setup was not found. Run the setup SQL once, then connect again.'); this.name='SchemaMissingError'; } }
async function request(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT), referrerPolicy: 'no-referrer' });
  if ([409,412].includes(response.status)) throw new SyncConflict();
  if (response.status===404) throw new SchemaMissingError();
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Cloud access denied. Check your credentials and database permissions.' : `Cloud request failed (${response.status}). Check the endpoint and provider setup.`);
  return response;
}
export async function authenticate(input: Connection, password?: string): Promise<Connection> {
  const c = validateConnection(input);
  if (authMode(c)==='sync-key') {
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.syncKey!));
    return {...c,token:'',email:'',refreshToken:undefined,expiresAt:undefined,keyId:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')};
  }
  if (!password && c.token && (c.expiresAt ?? 0) > Date.now() + 60000) return c;
  if (authMode(c)==='account' && !password && !c.refreshToken) throw new Error('Sign in with your cloud account password to connect.');
  if (c.provider === 'firebase') {
    const anonymous = authMode(c)==='anonymous';
    const refresh = !password && Boolean(c.refreshToken);
    const url = refresh ? `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(c.apiKey)}` : `https://identitytoolkit.googleapis.com/v1/accounts:${anonymous ? 'signUp' : 'signInWithPassword'}?key=${encodeURIComponent(c.apiKey)}`;
    const body = refresh ? { grant_type:'refresh_token', refresh_token:c.refreshToken } : anonymous ? {returnSecureToken:true} : { email:c.email, password, returnSecureToken:true };
    const json = await (await request(url,{method:'POST',headers:{'Content-Type':refresh ? 'application/x-www-form-urlencoded' : 'application/json'},body:refresh ? new URLSearchParams({grant_type:'refresh_token',refresh_token:c.refreshToken!}).toString() : JSON.stringify(body)})).json();
    return { ...c, token:json.idToken ?? json.id_token, refreshToken:json.refreshToken ?? json.refresh_token, expiresAt:Date.now() + Number(json.expiresIn ?? json.expires_in) * 1000 };
  }
  const json = await (await request(`${c.endpoint}/auth/v1/token?grant_type=${password ? 'password' : 'refresh_token'}`, {method:'POST',headers:{'Content-Type':'application/json',apikey:c.apiKey},body:JSON.stringify(password ? {email:c.email,password} : {refresh_token:c.refreshToken})})).json();
  return { ...c,token:json.access_token,refreshToken:json.refresh_token,expiresAt:Date.now()+Number(json.expires_in)*1000 };
}
export interface CloudAdapter { head(): Promise<string | null>; read(): Promise<unknown | null>; write(value: CloudSnapshot, expectedHash: string | null): Promise<void> }
export function createAdapter(c: Connection): CloudAdapter {
  if (c.provider === 'supabase') {
    const keyMode=authMode(c)==='sync-key';
    const headers:Record<string,string> = {apikey:c.apiKey,'Content-Type':'application/json'};
    if (!keyMode) headers.Authorization=`Bearer ${c.token}`;
    async function rpc(name: string, body: unknown) { return (await request(`${c.endpoint}/rest/v1/rpc/${name}`, {method:'POST',headers,body:JSON.stringify(body)})).json(); }
    const params=keyMode ? {p_data_id:c.dataId,p_sync_key:c.syncKey} : {p_data_id:c.dataId};
    const prefix=keyMode ? 'planner_key_' : 'planner_';
    return { async head() { return rpc(prefix+'head',params); }, async read() { return rpc(prefix+'read',params); }, async write(value,expectedHash) { if (!await rpc(prefix+'write',{...params,p_snapshot:value,p_expected_hash:expectedHash})) throw new SyncConflict(); } };
  }
  let uid: string;
  try { uid = JSON.parse(atob(c.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub; if (!uid) throw new Error(); } catch { throw new Error('Firebase session is invalid. Reconnect to sign in again.'); }
  const base = `${c.endpoint}/target_planner/${encodeURIComponent(uid)}/${encodeURIComponent(c.dataId)}`;
  // Firebase ID tokens are scoped by database rules; never accept a database admin secret.
  const url = (suffix = '') => `${base}${suffix}.json?auth=${encodeURIComponent(c.token)}`;
  return {
    async head() { return (await request(url('/hash'))).json(); },
    async read() { return (await request(url())).json(); },
    async write(value,expectedHash) {
      const read = await request(url(),{headers:{'X-Firebase-ETag':'true'}}); const existing = await read.json();
      if ((existing?.hash ?? null) !== expectedHash) throw new SyncConflict();
      const etag = read.headers.get('ETag'); if (!etag) throw new Error('Firebase did not return an ETag. Conditional sync is unavailable.');
      await request(url(),{method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(value)});
    }
  };
}
