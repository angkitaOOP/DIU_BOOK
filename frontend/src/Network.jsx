import React, { useEffect, useState } from 'react';
import { UserRound, Users, X, Search } from 'lucide-react';
import { api } from './lib/api.js';

const Av = ({ src }) => <span className="avatar avatar-lg">{src ? <img src={src} alt="" /> : <UserRound size={20} />}</span>;
const sub = u => u.headline || (u.role === 'alumni' ? 'Alumni' : u.department || 'Student') + ' · DIU';

export default function Network({ openProfile }) {
  const [tab, setTab] = useState('Everyone'), [items, setItems] = useState(null), [q, setQ] = useState(''), [err, setErr] = useState('');
  const [reqCount, setReqCount] = useState(0);

  const load = async () => {
    setErr('');
    try {
      if (tab === 'Everyone') setItems((await api.users.list(q ? { q } : {})).items);
      else if (tab === 'Connections') setItems((await api.connections.list()).items);
      else setItems((await api.connections.requests()).items);
      setReqCount((await api.connections.requests()).items.length);
    } catch (e) { setErr(e.message); setItems([]); }
  };
  useEffect(() => { setItems(null); const t = setTimeout(load, tab === 'Everyone' && q ? 300 : 0); return () => clearTimeout(t); }, [tab, q]);

  const act = async fn => { try { await fn(); load(); } catch (e) { setErr(e.message); } };
  const status = { none: ['Connect', 'btn-primary'], pending_sent: ['Request sent', 'btn-outline'], pending_received: ['Accept', 'btn-primary'], connected: ['Connected', 'btn-outline'] };

  return <>
    <div className="welcome-row"><div><h1>My network</h1><p>Find and connect with everyone on DIULink.</p></div></div>
    <div className="feed-tabs" role="tablist">{['Everyone', 'Connections', 'Requests'].map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t}{t === 'Requests' && reqCount > 0 ? ` (${reqCount})` : ''}</button>)}</div>
    {tab === 'Everyone' && <label className="searchbox page-search"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, headline, company…" /></label>}
    {err && <p className="auth-err" role="alert">{err}</p>}
    {items === null ? <div className="empty-search card"><b>Loading…</b></div>
      : items.length ? <div className="card list">{items.map(it => {
        const u = tab === 'Requests' ? it.user : it;
        return <div className="row" key={tab === 'Requests' ? it.requestId : u.id}>
          <button className="row-avatar-btn" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }} onClick={() => openProfile(u.id)}><Av src={u.avatarUrl} /></button>
          <span className="row-main" style={{ cursor: 'pointer' }} onClick={() => openProfile(u.id)}><b>{u.name}</b><span className="sub">{sub(u)}{it.mutualConnections ? ` · ${it.mutualConnections} mutual` : ''}</span></span>
          <span className="row-actions">
            {tab === 'Requests' ? <><button className="icon-button" aria-label={`Ignore ${u.name}`} onClick={() => act(() => api.connections.ignore(it.requestId))}><X size={18} /></button><button className="btn-primary btn-sm" onClick={() => act(() => api.connections.accept(it.requestId))}>Accept</button></>
              : tab === 'Everyone' ? <button className={`${status[it.connectionStatus]?.[1] || 'btn-primary'} btn-sm`} disabled={['pending_sent', 'connected'].includes(it.connectionStatus)} onClick={() => act(() => api.connections.request(u.id))}>{status[it.connectionStatus]?.[0] || 'Connect'}</button>
                : <button className="btn-outline btn-sm" onClick={() => openProfile(u.id)}>View</button>}
          </span></div>;
      })}</div>
        : <div className="empty-search card"><Users size={23} /><b>{tab === 'Requests' ? 'No pending requests' : tab === 'Connections' ? 'No connections yet' : 'No members found'}</b><span>{tab === 'Everyone' ? 'Invite your classmates to register — they will appear here.' : 'Go to Everyone to send your first request.'}</span></div>}
  </>;
}
