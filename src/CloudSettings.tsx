import { useState } from 'react';
import { Cloud, RefreshCw, Unplug } from 'lucide-react';
import { type CloudSync } from './useCloudSync';
import accountSQL from '../deploy/supabase.sql?raw';
import keySQL from '../deploy/supabase-sync-key.sql?raw';
import firebaseRules from '../deploy/firebase.rules.json?raw';
import { SchemaMissingError } from './cloud';
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
  const [schemaMissing,setSchemaMissing]=useState(false);
  const [choice,setChoice]=useState<'local'|'cloud'>();
  async function connect() {
    setBusy(true); setError(''); setSchemaMissing(false);
    try {
      const saved=cloud.connection;
      const sameAccount=saved && saved.provider===provider && saved.endpoint===endpoint.trim() && saved.apiKey===apiKey.trim() && authMode(saved)===method && (method!=='account' || saved.email===email.trim());
      const input:Connection={...(sameAccount?saved:{}),provider,authMode:method,syncKey:method==='sync-key'?syncKey.trim():undefined,endpoint:endpoint.trim(),dataId:dataId.trim(),apiKey:apiKey.trim(),token:sameAccount?saved.token:'',email:method==='account'?email.trim():''};
      await cloud.connect(input,method==='account'?password:''); setPassword(''); setEditing(false);
    } catch(e) {if (e instanceof SchemaMissingError) setSchemaMissing(true); else setError((e as Error).message);} finally {setBusy(false);}
  }
  const projectRef=/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(endpoint.trim())?.[1];
  const sqlEditor=projectRef?`https://supabase.com/dashboard/project/${projectRef}/sql/new`:'https://supabase.com/dashboard/projects';
  const setup=provider==='firebase'?firebaseRules:method==='sync-key'?keySQL:accountSQL;
  const setupFile=provider==='firebase'?'firebase.rules.json':method==='sync-key'?'supabase-sync-key.sql':'supabase.sql';
  const githubLink=`https://github.com/vKrypto/goal-planner/blob/main/deploy/${setupFile}`;
  const copySetup=()=>{navigator.clipboard.writeText(setup).then(()=>setSetupMessage('Setup copied. Paste it into your provider dashboard.')).catch(()=>setSetupMessage('Clipboard unavailable. Use the GitHub link.'));};
  return <section className="cloud-settings"><details className="cloud-panel"><summary><Cloud size={16}/>Cloud sync <span className="optional">connection options</span></summary><p>Keep your plans on multiple devices. Use the same provider, access method, and Data ID on each device. Connection credentials stay in this browser and are excluded from plan backups.</p>
    {cloud.connection && <div className="cloud-status"><strong>{examples[cloud.connection.provider].label} · {cloud.connection.dataId}</strong><span role="status">{cloud.status || 'Connected'}</span>{cloud.error && <p className="error" role="alert">{cloud.error}</p>}<div className="backup-buttons"><button className="secondary" disabled={cloud.busy} onClick={()=>{void cloud.sync();}}><RefreshCw size={14}/>{cloud.busy ? 'Syncing…':'Sync now'}</button><button className="secondary" disabled={cloud.busy} onClick={()=>setEditing(!editing)}>Edit connection</button><button className="text-button" disabled={cloud.busy} onClick={()=>{try{cloud.disconnect();setEditing(true);setPassword('');setError('');}catch(e){setError((e as Error).message);}}}><Unplug size={14}/>Disconnect</button></div></div>}
    {cloud.conflict && <div className="sync-conflict"><strong>Both versions have changed</strong><p>Automatic sync is paused. Download a backup before replacing either version. Your choice applies to the entire dataset, including deleted plans, notes, and photos.</p>{choice ? <><p>{choice==='local'?'Replace cloud plans with all plans on this device? Other devices will receive this version.':'Replace all plans on this device with the cloud version?'}</p><div className="backup-buttons"><button className="secondary" disabled={cloud.busy} onClick={()=>setChoice(undefined)}>Cancel</button><button className="primary" disabled={cloud.busy} onClick={()=>{void cloud.sync(choice);setChoice(undefined);}}>Confirm replacement</button></div></> : <div className="backup-buttons"><button className="secondary" onClick={()=>setChoice('local')}>Use this device’s version</button><button className="secondary" onClick={()=>setChoice('cloud')}>Use cloud version</button></div>}</div>}
    {(editing || !cloud.connection) && <div className="cloud-form">
      <label>Storage provider<select aria-label="Storage provider" value={provider} onChange={e=>{const next=e.target.value as Provider;setProvider(next);setMethod(next==='supabase'?'sync-key':'anonymous');setEndpoint('');setApiKey('');setPassword('');setSetupMessage('');}}><option value="firebase">Firebase Realtime Database</option><option value="supabase">Supabase</option></select></label>
      <p>{examples[provider].detail}</p>
      <label>{provider==='firebase'?'Database URL':'Project URL'}<input type="url" autoComplete="off" placeholder={examples[provider].endpoint} value={endpoint} onChange={e=>setEndpoint(e.target.value)}/></label>
      <label>{provider==='firebase'?'Firebase Web API key':'Publishable / anon key'}<input autoComplete="off" placeholder={examples[provider].key} value={apiKey} onChange={e=>setApiKey(e.target.value)}/></label>
      <label>Data ID<div className="data-id-input"><input aria-label="Data ID" autoComplete="off" placeholder="e.g. my-personal-targets" value={dataId} onChange={e=>setDataId(e.target.value)}/><button className="secondary" onClick={()=>setDataId(crypto.randomUUID())}>Generate</button></div></label>
      {method==='sync-key' && <><label>Private sync key<div className="data-id-input"><input aria-label="Private sync key" type="password" autoComplete="new-password" placeholder="Generate or paste your other device’s key" value={syncKey} onChange={e=>setSyncKey(e.target.value)}/><button className="secondary" onClick={()=>setSyncKey(generateSyncKey())}>Generate key</button></div></label><div className="backup-buttons"><button className="text-button" disabled={!syncKey} onClick={()=>{navigator.clipboard.writeText(syncKey).then(()=>setError('')).catch(()=>setError('Clipboard unavailable. Select and copy the key manually.'));}}>Copy private key</button></div><p>No login needed. Use this same key and Data ID on your other devices; keep a private copy (it is not in plan backups).</p></>}
      {method==='anonymous' && <p>No login needed. Firebase creates an anonymous identity for this browser.</p>}
      {schemaMissing && <div className="sync-conflict" role="alert"><strong>First-time setup needed</strong><p>Connected, but the database schema isn’t there yet. This is a one-time step:</p><ol><li>Sign in to your {examples[provider].label} dashboard with your email/password.</li><li>{provider==='supabase'?<>Open the <a href={sqlEditor} target="_blank" rel="noopener noreferrer">SQL editor</a>, paste the setup SQL and click Run.</>:<>Open Realtime Database → Rules and paste the rules.</>}</li><li>Come back and connect again.</li></ol><div className="backup-buttons"><button className="secondary" onClick={copySetup}>Copy {provider==='firebase'?'rules':'setup SQL'}</button><a className="secondary" href={githubLink} target="_blank" rel="noopener noreferrer">View on GitHub</a><button className="primary" disabled={busy} onClick={()=>{void connect();}}>I’ve run it · retry</button></div>{setupMessage && <p role="status">{setupMessage}</p>}<p className="inline-note">Your dashboard password is only used on the provider’s site; it is never entered here.</p></div>}
      <details className="connection-details"><summary>Other ways to connect · optional</summary><div>
        <label>Connection method<select aria-label="Connection method" value={method} onChange={e=>{setMethod(e.target.value as AuthMode);setPassword('');setSetupMessage('');setSchemaMissing(false);}}>{provider==='supabase'?<option value="sync-key">Private sync key · no login (default)</option>:<option value="anonymous">Anonymous · no login (default)</option>}<option value="account">Account sign-in</option></select></label>
        {method==='account' && <><label>Account email<input type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Account password<input type="password" autoComplete="current-password" placeholder={cloud.connection?'Leave blank to reuse this session':'Needed for the first sign-in'} value={password} onChange={e=>setPassword(e.target.value)}/></label><p>Use a provider Auth user (not your dashboard login). {provider==='supabase'?'Create one under Authentication → Users and run the account SQL.':'Enable Email/Password sign-in and create a user.'} The password is discarded after sign-in.</p></>}
        <p><strong>First time?</strong> The setup {provider==='firebase'?'rules':'SQL'} must be run once per project. Connect will check for it and guide you if it’s missing.</p>
        <div className="backup-buttons"><a className="text-button" href={githubLink} target="_blank" rel="noopener noreferrer">Open setup on GitHub</a><button className="text-button" onClick={copySetup}>Copy setup</button></div>
        {setupMessage && !schemaMissing && <p role="status">{setupMessage}</p>}
      </div></details>
      <button className="primary full" disabled={busy||cloud.busy} onClick={()=>{void connect();}}><Cloud size={15}/>{busy?'Checking connection…':'Connect & check versions'}</button>
    </div>}
    {!cloud.connection && cloud.error && <p className="error" role="alert">{cloud.error}</p>}{error && <p className="error" role="alert">{error}</p>}<p className="inline-note">Sync runs on opening, returning to the app, reconnecting, and after edits. Offline edits stay here until the next successful sync. Anyone with access to this browser profile can access saved connection credentials.</p>
  </details></section>;
}
