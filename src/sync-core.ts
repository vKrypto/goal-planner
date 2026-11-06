import { emptyData, validateData, type Data } from './model';
export type Provider = 'firebase' | 'supabase';
export type Connection = { provider: Provider; endpoint: string; dataId: string; apiKey: string; token: string; email: string; refreshToken?: string; expiresAt?: number };
export type CloudSnapshot = { hash: string; payload: string; updatedAt: string };
export type SyncMeta = { connectionId: string; lastHash: string | null; syncedAt?: string };
export const CONNECTION_KEY = 'target-planner.connection.v1';
export const META_KEY = 'target-planner.sync.v1';
export function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => `${JSON.stringify(k)}:${stableJSON(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function canonical(data: Data) { const clean = validateData(data); return stableJSON({ ...clean, items: [...clean.items].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) }); }
export async function hashData(data: Data) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(data))); return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join(''); }
export async function snapshot(data: Data): Promise<CloudSnapshot> { return { hash: await hashData(data), payload: canonical(data), updatedAt: new Date().toISOString() }; }
export async function readSnapshot(value: unknown): Promise<{ snapshot: CloudSnapshot; data: Data }> {
  if (!value || typeof value !== 'object') throw new Error('The cloud returned an invalid snapshot.');
  const doc = value as CloudSnapshot;
  if (!/^[a-f0-9]{64}$/.test(doc.hash) || typeof doc.payload !== 'string' || doc.payload.length > 3_500_000 || typeof doc.updatedAt !== 'string') throw new Error('The cloud returned an invalid snapshot.');
  const data = validateData(JSON.parse(doc.payload));
  if (await hashData(data) !== doc.hash) throw new Error('The cloud data does not match its hash. No local plans were changed.');
  return { snapshot: doc, data };
}
export type Decision = 'equal' | 'push' | 'pull' | 'conflict';
export function decideSync(local: string, remote: string | null, baseline: string | null, localEmpty: boolean): Decision {
  if (local === remote) return 'equal';
  if (remote === null) return baseline === null ? 'push' : 'conflict';
  if (baseline === null) return localEmpty ? 'pull' : 'conflict';
  if (local === baseline) return 'pull';
  if (remote === baseline) return 'push';
  return 'conflict';
}
export const defaultEmptyHash = () => hashData(emptyData());
export const connectionId = (c: Connection) => `${c.provider}|${c.endpoint.replace(/\/$/,'')}|${c.dataId}|${c.email.toLowerCase()}`;
export function validateConnection(c: Connection): Connection {
  if (!['firebase','supabase'].includes(c.provider)) throw new Error('Choose a supported provider.');
  let url: URL; try { url = new URL(c.endpoint); } catch { throw new Error('Enter a complete HTTPS endpoint URL.'); }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Cloud connections require HTTPS. Localhost HTTP is allowed for development.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Use an endpoint without credentials, a query string, or a fragment.');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(c.dataId)) throw new Error('Data ID must be 8–100 letters, numbers, hyphens, or underscores. Use the same ID on every device.');
  if (!c.apiKey.trim() || !c.email.trim()) throw new Error('Enter your project key and account email.');
  if (c.provider === 'supabase') {
    if (c.apiKey.startsWith('sb_secret_')) throw new Error('Use a publishable/anon key, never a service-role or secret key.');
    try { const claims = JSON.parse(atob(c.apiKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); if (claims.role === 'service_role') throw new Error('service_role'); } catch (e) { if ((e as Error).message === 'service_role') throw new Error('Use a publishable/anon key, never a service-role key.'); }
  }
  return { ...c, endpoint: c.endpoint.replace(/\/+$/,'') };
}
export function loadConnection(): Connection | null { const raw = localStorage.getItem(CONNECTION_KEY); return raw ? validateConnection(JSON.parse(raw)) : null; }
export class SyncConflict extends Error { constructor() { super('The cloud changed during sync. Check again before choosing a version.'); } }
