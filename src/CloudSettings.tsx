import { useState } from 'react';
import { Cloud, RefreshCw, Unplug } from 'lucide-react';
import { type CloudSync } from './useCloudSync';
import accountSQL from '../deploy/supabase.sql?raw';
import keySQL from '../deploy/supabase-sync-key.sql?raw';
import firebaseRules from '../deploy/firebase.rules.json?raw';
import { authMode, generateSyncKey, type AuthMode, type Provider, type Connection } from './sync-core';
const examples = {
  firebase: { label:'Firebase',endpoint:'https://your-project-default-rtdb.firebaseio.com',key:'AIza… (Firebase Web API key)',detail:'Use a Realtime Database URL and an Firebase Auth identity. Choose anonymous access or optional account sign-in.' },
  supabase: { label:'Supabase',endpoint:'https://your-project.supabase.co',key:'sb_publishable_… (or anon key)',detail:'Use a project URL, publishable/anon key. Choose a private sync key or optional account sign-in.' }
};
export function CloudSettings({cloud}:{cloud:CloudSync}) {
  const [editing,setEditing]=useState(!cloud.connection); const [provider,setProvider]=useState<Provider>(cloud.connection?.provider ?? 'supabase');
  const [endpoint,setEndpoint]=useState(cloud.connection?.endpoint ?? ''); const [dataId,setDataId]=useState(cloud.connection?.dataId ?? 'target-planner-personal');
  const [apiKey,setApiKey]=useState(cloud.connection?.apiKey ?? '');
  const [method,setMethod]=useState<AuthMode>(cloud.connection ? authMode(cloud.connection) : 'sync-key');
  const [syncKey,setSyncKey]=useState(cloud.connection?.syncKey ?? '');
  const [setupMessage,setSetupMessage]=useState('');
  const [email,setEmail]=useState(cloud.connection?.email ?? ''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const [choice,setChoice]=useState<'local'|'cloud'>();
  async function connect() {
    setBusy(true); setError('');
    try {
      const saved=cloud.connection;
      const sameAccount=saved && saved.provider===provider && saved.endpoint===endpoint.trim() && saved.apiKey===apiKey.trim() && authMode(saved)===method && (method!=='account' || saved.email===email.trim());
      const input:Connection={...(sameAccount?saved:{}),provider,authMode:method,syncKey:method==='sync-key'?syncKey.trim():undefined,endpoint:endpoint.trim(),dataId:dataId.trim(),apiKey:apiKey.trim(),token:sameAccount?saved.token:'',email:method==='account'?email.trim():''};
      await cloud.connect(input,method==='account'?password:''); setPassword(''); setEditing(false);
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  const setup=provider==='firebase'?firebaseRules:method==='sync-key'?keySQL:accountSQL;
  const setupFile=provider==='firebase'?'firebase.rules.json':method==='sync-key'?'supabase-sync-key.sql':'supabase.sql';
  return <section className="cloud-settings"><details className="cloud-panel"><summary><Cloud size={16}/>Cloud sync <span className="optional">connection options</span></summary><p>Keep your plans on multiple devices. Use the same provider, access method, and Data ID on each device. Connection credentials stay in this browser and are excluded from plan backups.</p>
    {cloud.connection && <div className="cloud-status"><strong>{examples[cloud.connection.provider].label} · {cloud.connection.dataId}</strong><span role="status">{cloud.status || 'Connected'}</span>{cloud.error && <p className="error" role="alert">{cloud.error}</p>}<div className="backup-buttons"><button className="secondary" disabled={cloud.busy} onClick={()=>{void cloud.sync();}}><RefreshCw size={14}/>{cloud.busy ? 'Syncing…':'Sync now'}</button><button className="secondary" disabled={cloud.busy} onClick={()=>setEditing(!editing)}>Edit connection</button><button className="text-button" disabled={cloud.busy} onClick={()=>{try{cloud.disconnect();setEditing(true);setPassword('');setError('');}catch(e){setError((e as Error).message);}}}><Unplug size={14}/>Disconnect</button></div></div>}
    {cloud.conflict && <div className="sync-conflict"><strong>Both versions have changed</strong><p>Automatic sync is paused. Download a backup before replacing either version. Your choice applies to the entire dataset, including deleted plans, notes, and photos.</p>{choice ? <><p>{choice==='local'?'Replace cloud plans with all plans on this device? Other devices will receive this version.':'Replace all plans on this device with the cloud version?'}</p><div className="backup-buttons"><button className="secondary" disabled={cloud.busy} onClick={()=>setChoice(undefined)}>Cancel</button><button className="primary" disabled={cloud.busy} onClick={()=>{void cloud.sync(choice);setChoice(undefined);}}>Confirm replacement</button></div></> : <div className="backup-buttons"><button className="secondary" onClick={()=>setChoice('local')}>Use this device’s version</button><button className="secondary" onClick={()=>setChoice('cloud')}>Use cloud version</button></div>}</div>}
    {(editing || !cloud.connection) && <div className="cloud-form">
      <label>Storage provider<select aria-label="Storage provider" value={provider} onChange={e=>{const next=e.target.value as Provider;setProvider(next);setMethod(next==='supabase'?'sync-key':'anonymous');setEndpoint('');setApiKey('');setPassword('');setSetupMessage('');}}><option value="firebase">Firebase Realtime Database</option><option value="supabase">Supabase</option></select></label>
      <label>Connection method<select aria-label="Connection method" value={method} onChange={e=>{setMethod(e.target.value as AuthMode);setPassword('');setSetupMessage('');}}>{provider==='supabase'?<option value="sync-key">Private sync key · no login</option>:<option value="anonymous">Anonymous · no login (this browser)</option>}<option value="account">Account sign-in · optional</option></select></label>
      <p>{examples[provider].detail}</p>
      <details className="connection-details"><summary>First-time setup & other ways to connect</summary><div>
        <p>Set up your provider once before connecting. Schema and access rules are created in the provider dashboard; entering account credentials here does not create them.</p>
        {provider==='supabase'?<><p><strong>Private sync key:</strong> run the additional sync-key SQL once. The account SQL you may have already run stays unchanged. Use the same generated key and Data ID on every device. Anyone holding that key can access its plans; keep a private copy because it is excluded from plan backups.</p><p><strong>Optional account sign-in:</strong> run the account SQL and create a user under Authentication → Users. Existing account-owned data remains separate from sync-key data. You only need the password for initial sign-in or an expired session.</p></>:<><p><strong>Anonymous access:</strong> enable Anonymous under Firebase Authentication → Sign-in method, then apply the rules. Each browser has its own identity. Clearing browser storage loses that identity.</p><p><strong>For multiple devices:</strong> choose optional account sign-in, enable Email/Password, create an Auth user, and use that account and Data ID on each device.</p></>}
        <p><a href={`https://github.com/vKrypto/goal-planner/blob/main/deploy/${setupFile}`} target="_blank" rel="noopener noreferrer">Open {provider==='firebase'?'database rules':method==='sync-key'?'additional sync-key SQL':'account SQL'}</a></p>
        <button className="secondary" onClick={()=>{navigator.clipboard.writeText(setup).then(()=>setSetupMessage('Setup copied. Paste it into your provider dashboard.')).catch(()=>setSetupMessage('Clipboard unavailable. Use the setup link above.'));}}>Copy {provider==='firebase'?'database rules':'setup SQL'}</button>
        {setupMessage && <p role="status">{setupMessage}</p>}
      </div></details>
      <label>{provider==='firebase'?'Database URL':'Project URL'}<input type="url" autoComplete="off" placeholder={examples[provider].endpoint} value={endpoint} onChange={e=>setEndpoint(e.target.value)}/></label>
      <label>Data ID<div className="data-id-input"><input aria-label="Data ID" autoComplete="off" placeholder="e.g. my-personal-targets" value={dataId} onChange={e=>setDataId(e.target.value)}/><button className="secondary" onClick={()=>setDataId(crypto.randomUUID())}>Generate</button></div></label>
      <label>{provider==='firebase'?'Firebase Web API key':'Publishable / anon key'}<input autoComplete="off" placeholder={examples[provider].key} value={apiKey} onChange={e=>setApiKey(e.target.value)}/></label>
      {method==='sync-key' && <><label>Private sync key<div className="data-id-input"><input aria-label="Private sync key" type="password" autoComplete="new-password" placeholder="Generate or paste your other device’s key" value={syncKey} onChange={e=>setSyncKey(e.target.value)}/><button className="secondary" onClick={()=>setSyncKey(generateSyncKey())}>Generate key</button></div></label><div className="backup-buttons"><button className="text-button" disabled={!syncKey} onClick={()=>{navigator.clipboard.writeText(syncKey).then(()=>setError('')).catch(()=>setError('Clipboard unavailable. Select and copy the key manually.'));}}>Copy private key</button></div><p>No email or password needed. Use this same private key and Data ID on your other devices.</p></>}
      {method==='anonymous' && <p>No email or password needed. Firebase creates an anonymous identity for this browser. Use account sign-in for cross-device access.</p>}
      {method==='account' && <details className="connection-details"><summary>Optional sign-in credentials</summary><div><label>Account email<input type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Account password<input type="password" autoComplete="current-password" placeholder={cloud.connection?'Leave blank to reuse this session':'Needed for the first account sign-in'} value={password} onChange={e=>setPassword(e.target.value)}/></label><p>Use a provider Auth user, not your dashboard password. The password is discarded after sign-in; session credentials remain local. New account connections need these fields. Other connection methods do not.</p></div></details>}
      <button className="primary full" disabled={busy||cloud.busy} onClick={()=>{void connect();}}><Cloud size={15}/>{busy?'Checking connection…':'Connect & check versions'}</button>
    </div>}
    {!cloud.connection && cloud.error && <p className="error" role="alert">{cloud.error}</p>}{error && <p className="error" role="alert">{error}</p>}<p className="inline-note">Sync runs on opening, returning to the app, reconnecting, and after edits. Offline edits stay here until the next successful sync. Anyone with access to this browser profile can access saved connection credentials.</p>
  </details></section>;
}
