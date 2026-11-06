import { useCallback, useEffect, useRef, useState } from 'react';
import { saveData, type Data } from './model';
import { authenticate, createAdapter } from './cloud';
import { CONNECTION_KEY, META_KEY, SyncConflict, connectionId, decideSync, defaultEmptyHash, hashData, loadConnection, readSnapshot, snapshot, type Connection, type SyncMeta } from './sync-core';
export function useCloudSync(data: Data, blocked: boolean, apply: (data: Data) => void, deferPull: boolean) {
  const [initial] = useState(() => { try { return { connection:loadConnection(), error:'' }; } catch { return { connection:null,error:'Saved cloud configuration could not be read. Reconnect in settings.' }; } });
  const [connection,setConnection] = useState<Connection | null>(initial.connection);
  const [status,setStatus] = useState(''); const [error,setError] = useState(initial.error); const [conflict,setConflict] = useState(false); const [busy,setBusy] = useState(false);
  const dataRef = useRef(data); dataRef.current = data;
  const blockedRef = useRef(blocked); blockedRef.current = blocked;
  const deferredRef = useRef(deferPull); deferredRef.current = deferPull;
  const applyRef = useRef(apply); applyRef.current = apply;
  const connectionRef = useRef(connection); connectionRef.current = connection;
  const running = useRef(false); const epoch = useRef(0);
  const sync = useCallback(async (choice?: 'local' | 'cloud') => {
    if (running.current || !connectionRef.current || blockedRef.current) return;
    if (!navigator.onLine) { setStatus('Offline · changes waiting to sync'); return; }
    running.current = true; setBusy(true); setError(''); setStatus('Checking cloud version…');
    const generation = epoch.current;
    try {
      const original = connectionRef.current;
      const c = await authenticate(original); if (generation !== epoch.current) return;
      if (c.token !== original.token) { localStorage.setItem(CONNECTION_KEY,JSON.stringify(c)); connectionRef.current=c; setConnection(c); }
      const id=connectionId(c); let meta: SyncMeta | null=null;
      const raw=localStorage.getItem(META_KEY); if (raw) { const parsed=JSON.parse(raw); if (parsed.connectionId===id && (parsed.lastHash===null || /^[a-f0-9]{64}$/.test(parsed.lastHash))) meta=parsed; }
      const local=dataRef.current; const localHash=await hashData(local); const adapter=createAdapter(c); const remoteHash=await adapter.head();
      if (generation!==epoch.current) return;
      if (remoteHash!==null && !/^[a-f0-9]{64}$/.test(remoteHash)) throw new Error('The cloud returned an invalid version hash.');
      let decision=decideSync(localHash,remoteHash,meta?.lastHash ?? null,localHash===await defaultEmptyHash());
      if (choice==='local') decision='push'; if (choice==='cloud') decision='pull';
      let syncedHash=localHash;
      if (decision==='conflict') { setConflict(true); setStatus('Two versions need your attention'); return; }
      if (decision==='push') {
        if (await hashData(dataRef.current)!==localHash || blockedRef.current) { setStatus('New changes waiting to sync'); return; }
        await adapter.write(await snapshot(local),remoteHash);
      } else if (decision==='pull') {
        if (deferredRef.current) { setStatus('Cloud update waiting · finish editing first'); return; }
        const remote=await adapter.read(); if (!remote) throw new SyncConflict();
        const checked=await readSnapshot(remote); if (checked.snapshot.hash!==remoteHash) throw new SyncConflict();
        if (generation!==epoch.current || blockedRef.current || deferredRef.current || await hashData(dataRef.current)!==localHash) { setStatus('Local changes made during sync · check again'); return; }
        // Persist before updating React; storage failure leaves both local and cloud data untouched.
        saveData(checked.data,localStorage); dataRef.current=checked.data; applyRef.current(checked.data); syncedHash=checked.snapshot.hash;
      }
      if (generation!==epoch.current) return;
      const nextMeta: SyncMeta={connectionId:id,lastHash:syncedHash,syncedAt:new Date().toISOString()};
      localStorage.setItem(META_KEY,JSON.stringify(nextMeta)); setConflict(false);
      setStatus(await hashData(dataRef.current)===syncedHash ? `Synced · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'New changes waiting to sync');
    } catch(e) { if (generation===epoch.current) { if (e instanceof SyncConflict) { setConflict(true); setStatus('Cloud changed · check versions again'); } else { setError((e as Error).message || 'Sync failed. Local plans are safe.'); setStatus('Not synced · local plans are safe'); } } }
    finally { running.current=false; setBusy(false); }
  },[]);
  const connect = async (input: Connection,password: string) => {
    if (running.current) throw new Error('Wait for the current sync to finish before changing connections.');
    const authenticated=await authenticate(input,password || undefined);
    // Verify connectivity and permissions before retaining credentials.
    await createAdapter(authenticated).head();
    epoch.current++; localStorage.setItem(CONNECTION_KEY,JSON.stringify(authenticated)); if (!connectionRef.current || connectionId(connectionRef.current)!==connectionId(authenticated)) localStorage.removeItem(META_KEY);
    connectionRef.current=authenticated; setConnection(authenticated); setConflict(false); setError(''); setStatus('Connected · checking versions');
    void sync();
  };
  const disconnect = () => {
    if (running.current) return;
    localStorage.removeItem(CONNECTION_KEY); localStorage.removeItem(META_KEY); epoch.current++; connectionRef.current=null; setConnection(null); setStatus(''); setConflict(false); setError('');
  };
  useEffect(() => {
    if (!connection || blocked) return;
    const timer=setTimeout(()=>{ void sync(); },1000);
    return ()=>clearTimeout(timer);
  },[data,connection,blocked,deferPull,sync]);
  useEffect(() => {
    const wake=()=>{ if (document.visibilityState==='visible') void sync(); };
    const changed=(e: StorageEvent)=>{ if (e.key===CONNECTION_KEY || e.key===null) { epoch.current++; try { const next=loadConnection(); connectionRef.current=next; setConnection(next); setConflict(false); } catch { connectionRef.current=null; setConnection(null); setError('Cloud connection changed in another tab. Reconnect in settings.'); } } };
    const timer=setInterval(wake,60000); window.addEventListener('online',wake); window.addEventListener('focus',wake); document.addEventListener('visibilitychange',wake); window.addEventListener('storage',changed);
    return ()=>{ clearInterval(timer); window.removeEventListener('online',wake); window.removeEventListener('focus',wake); document.removeEventListener('visibilitychange',wake); window.removeEventListener('storage',changed); };
  },[sync]);
  return {connection,status,error,conflict,busy,sync,connect,disconnect};
}
export type CloudSync = ReturnType<typeof useCloudSync>;
