import React, { useEffect, useRef, useState } from 'react';
import { Bell, Play, Eye, Heart, FileText, Search, Send, Check, X, MapPin, Clock3, Bookmark, Briefcase, CalendarDays, UserPlus, GraduationCap, Hash, LogOut, ChevronLeft, Users, Compass, MessageCircle } from 'lucide-react';

const img = id => `https://i.pravatar.cc/100?img=${id}`;
const Av = ({ id, size = '' }) => <span className={`avatar ${size}`}><img src={img(id)} alt="" /></span>;
const Head = ({ t, s, children }) => <div className="welcome-row"><div><h1>{t}</h1><p>{s}</p></div>{children}</div>;
const Tabs = ({ items, v, set }) => <div className="feed-tabs" role="tablist">{items.map(i => <button key={i} role="tab" aria-selected={v === i} className={v === i ? 'selected' : ''} onClick={() => set(i)}>{i}</button>)}</div>;
const Find = ({ q, set, ph }) => <label className="searchbox page-search"><Search size={18} /><input value={q} onChange={e => set(e.target.value)} placeholder={ph} /></label>;
const has = (o, q) => JSON.stringify(Object.values(o)).toLowerCase().includes(q.trim().toLowerCase());
const Nothing = ({ t }) => <div className="empty-search card"><Search size={23} /><b>{t}</b><span>Try a different search or filter.</span></div>;
const Toggle = ({ on, set, label }) => <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => set(!on)}><i /></button>;
function useSet(init = []) {
  const [s, setS] = useState(new Set(init));
  return [s, id => setS(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })];
}

/* ---------- Messages ---------- */
const chats0 = [
  { id: 1, name: 'Nusrat Jahan', img: 47, sub: 'CSE, 3rd year', on: true, m: [{ me: 0, t: 'Hey! Saw your UI work on SharePlate. Want to join our navigation app team?' }, { me: 1, t: 'Yes please! What stack are you using?' }, { me: 0, t: 'React + Firebase. Sprint starts Sunday.' }] },
  { id: 2, name: 'Tanvir Ahmed', img: 13, sub: 'Alumni, Brain Station 23', on: false, m: [{ me: 0, t: 'Send me your GitHub link and I’ll review it this weekend.' }] },
  { id: 3, name: 'DIU Robotics Club', img: 12, sub: 'Club', on: true, m: [{ me: 0, t: 'Your RoboSprint registration is confirmed. See you at the workshop!' }] },
  { id: 4, name: 'Nabila Islam', img: 44, sub: 'SWE, 2nd year', on: false, m: [{ me: 1, t: 'Can you share the Figma file?' }, { me: 0, t: 'Sending it tonight 😊' }] },
];
function Messages() {
  const [chats, setChats] = useState(chats0), [id, setId] = useState(1), [d, setD] = useState(''), [q, setQ] = useState(''), [show, setShow] = useState(false);
  const c = chats.find(x => x.id === id);
  const send = e => { e.preventDefault(); if (!d.trim()) return; setChats(chats.map(x => x.id === id ? { ...x, m: [...x.m, { me: 1, t: d.trim() }] } : x)); setD(''); };
  return <><Head t="Messages" s="Chat with batchmates, alumni and clubs." />
    <div className={`chat card ${show ? 'show-thread' : ''}`}>
      <div className="chat-list"><Find q={q} set={setQ} ph="Search chats" />
        {chats.filter(x => has(x, q)).map(x => <button key={x.id} className={`chat-row ${x.id === id ? 'active' : ''}`} onClick={() => { setId(x.id); setShow(true); }}>
          <Av id={x.img} size="avatar-lg" /><span><b>{x.name}</b><small>{x.m[x.m.length - 1].t}</small></span>{x.on && <i className="dot ok" />}</button>)}
      </div>
      <div className="thread">
        <div className="thread-head"><button className="icon-button thread-back" onClick={() => setShow(false)} aria-label="Back to chats"><ChevronLeft size={20} /></button><Av id={c.img} /><span><b>{c.name}</b><small>{c.on ? 'Active now' : c.sub}</small></span></div>
        <div className="bubbles">{c.m.map((m, i) => <p key={i} className={`bubble ${m.me ? 'me' : ''}`}>{m.t}</p>)}</div>
        <form className="chat-input" onSubmit={send}><input value={d} onChange={e => setD(e.target.value)} placeholder={`Message ${c.name.split(' ')[0]}`} aria-label="Write a message" /><button className="btn-primary btn-sm" disabled={!d.trim()}><Send size={15} /> Send</button></form>
      </div>
    </div></>;
}

/* ---------- Notifications ---------- */
export const notes0 = [
  { id: 1, img: 47, t: <><b>Nusrat Jahan</b> reacted to your post</>, time: '5 min ago', u: 1 },
  { id: 2, img: 12, t: <><b>DIU Robotics Club</b> opened registration for RoboSprint 2026</>, time: '1 hr ago', u: 1 },
  { id: 3, img: 13, t: <><b>Tanvir Ahmed</b> posted a referral: Junior Frontend Developer</>, time: '3 hrs ago', u: 1 },
  { id: 4, img: 44, t: <><b>Nabila Islam</b> sent you a connection request</>, time: 'Yesterday', u: 1 },
  { id: 5, img: 23, t: <><b>Sadia Islam</b> commented: “Love the colour palette!”</>, time: 'Yesterday', u: 1 },
  { id: 6, img: 68, t: <><b>Fahim Rahman</b> shared your project SharePlate</>, time: '2 days ago', u: 0 },
];
function Notifications({ n, setN }) {
  const [tab, setTab] = useState('All');
  const list = n.filter(x => tab === 'All' || x.u), unread = n.filter(x => x.u).length;
  return <><Head t="Notifications" s={unread ? `${unread} new since you last checked.` : 'You’re all caught up.'}><button className="btn-outline btn-sm" onClick={() => setN(n.map(x => ({ ...x, u: 0 })))} disabled={!unread}><Check size={15} /> Mark all as read</button></Head>
    <Tabs items={['All', 'Unread']} v={tab} set={setTab} />
    {list.length ? <div className="card list">{list.map(x => <button key={x.id} className={`row notif ${x.u ? 'unread' : ''}`} onClick={() => setN(n.map(y => y.id === x.id ? { ...y, u: 0 } : y))}><Av id={x.img} size="avatar-lg" /><span className="row-main"><span>{x.t}</span><small className="sub">{x.time}</small></span>{x.u ? <i className="dot" aria-label="Unread" /> : null}</button>)}</div> : <Nothing t="Nothing unread" />}</>;
}

/* ---------- Jobs ---------- */
const jobs = [
  { id: 1, title: 'Junior Frontend Developer', org: 'Brain Station 23', kind: 'Alumni referral', loc: 'Dhaka', posted: '2 days ago', by: 'Tanvir Ahmed', tags: ['React', 'TypeScript'] },
  { id: 2, title: 'UI/UX Design Intern', org: 'Pathao', kind: 'Internships', loc: 'Dhaka, hybrid', posted: '4 days ago', by: 'Sadia Islam', tags: ['Figma', 'Research'] },
  { id: 3, title: 'Campus Hiring Day', org: 'Samsung R&D Bangladesh', kind: 'On-campus', loc: 'DIU Main Campus', posted: 'Dec 2', by: 'DIU Career Office', tags: ['SWE', 'CSE'] },
  { id: 4, title: 'Backend Developer (Node.js)', org: 'Chaldal', kind: 'Jobs', loc: 'Dhaka', posted: '1 week ago', by: 'Mehedi Hasan', tags: ['Node.js', 'MySQL'] },
  { id: 5, title: 'QA Engineer Intern', org: 'Bkash', kind: 'Internships', loc: 'Dhaka', posted: '1 week ago', by: 'DIU Career Office', tags: ['Testing', 'Python'] },
  { id: 6, title: 'Mobile App Developer', org: 'Startup Bangladesh', kind: 'Alumni referral', loc: 'Remote', posted: '2 weeks ago', by: 'Rafi Chowdhury', tags: ['Flutter', 'Firebase'] },
];
function Jobs() {
  const [tab, setTab] = useState('All'), [q, setQ] = useState(''), [saved, tSave] = useSet(), [applied, tApply] = useSet();
  const list = jobs.filter(j => (tab === 'All' || j.kind === tab) && has(j, q));
  return <><Head t="Jobs & internships" s="Roles from alumni and companies hiring DIU students." />
    <div className="toolbar"><Tabs items={['All', 'Jobs', 'Internships', 'Alumni referral', 'On-campus']} v={tab} set={setTab} /><Find q={q} set={setQ} ph="Search roles or companies" /></div>
    {list.length ? <div className="card list">{list.map(j => <div className="row" key={j.id}><span className="logo-sq">{j.org[0]}</span>
      <span className="row-main"><b>{j.title}</b><span className="sub">{j.org}, {j.loc}</span><span className="chips">{j.tags.map(t => <span className="tag" key={t}>{t}</span>)}<span className="tag sun">{j.kind}</span></span><small className="sub">Posted by {j.by} · {j.posted}</small></span>
      <span className="row-actions"><button className={`icon-button ${saved.has(j.id) ? 'on' : ''}`} aria-pressed={saved.has(j.id)} aria-label="Save job" onClick={() => tSave(j.id)}><Bookmark size={18} fill={saved.has(j.id) ? 'currentColor' : 'none'} /></button>
        <button className={`btn-primary btn-sm ${applied.has(j.id) ? 'btn-on' : ''}`} onClick={() => tApply(j.id)}>{applied.has(j.id) ? <><Check size={14} /> Applied</> : j.kind === 'On-campus' ? 'Register' : 'Apply'}</button></span></div>)}</div> : <Nothing t="No roles found" />}</>;
}

/* ---------- Events ---------- */
const events = [
  { id: 1, d: '24', m: 'Nov', title: 'DIU Tech Carnival', place: 'Main Auditorium', time: '10:00 AM', cat: 'Tech', tone: 'blue', host: 'CSE Society', going: 312 },
  { id: 2, d: '27', m: 'Nov', title: 'Design Meetup Vol. 3', place: 'Innovation Lab', time: '2:30 PM', cat: 'Creative', tone: 'green', host: 'DIU Design Club', going: 94 },
  { id: 3, d: '02', m: 'Dec', title: 'Career Connect 2026', place: 'DSC Campus', time: '11:00 AM', cat: 'Career', tone: 'orange', host: 'DIU Career Office', going: 528 },
  { id: 4, d: '05', m: 'Dec', title: 'RoboSprint 2026', place: 'Robotics Lab', time: '9:00 AM', cat: 'Tech', tone: 'blue', host: 'DIU Robotics Club', going: 176 },
  { id: 5, d: '12', m: 'Dec', title: 'Photo Walk: Old Dhaka', place: 'Meets at Gate 2', time: '6:30 AM', cat: 'Creative', tone: 'green', host: 'DIU Photography Club', going: 61 },
  { id: 6, d: '18', m: 'Dec', title: 'Alumni Talk: Breaking into Product', place: 'Seminar Hall', time: '4:00 PM', cat: 'Career', tone: 'orange', host: 'Alumni Office', going: 140 },
];
function Events() {
  const [tab, setTab] = useState('All'), [going, tGo] = useSet(), [q, setQ] = useState('');
  const list = events.filter(e => (tab === 'All' || e.cat === tab) && has(e, q));
  return <><Head t="Campus events" s="Workshops, fests and meetups happening at DIU." />
    <div className="toolbar"><Tabs items={['All', 'Tech', 'Career', 'Creative']} v={tab} set={setTab} /><Find q={q} set={setQ} ph="Search events" /></div>
    {list.length ? <div className="grid-cards">{list.map(e => <article className="card tile" key={e.id}>
      <div className="tile-top"><div className={`event-date ${e.tone}`}><b>{e.d}</b><span>{e.m}</span></div><div><b>{e.title}</b><span className="sub">by {e.host}</span></div></div>
      <span className="sub meta"><Clock3 size={13} /> {e.time}</span><span className="sub meta"><MapPin size={13} /> {e.place}</span>
      <div className="tile-foot"><span className="sub">{e.going + (going.has(e.id) ? 1 : 0)} going</span><button className={`btn-primary btn-sm ${going.has(e.id) ? 'btn-on' : ''}`} aria-pressed={going.has(e.id)} onClick={() => tGo(e.id)}>{going.has(e.id) ? <><Check size={14} /> Going</> : 'I’m going'}</button></div></article>)}</div> : <Nothing t="No events found" />}</>;
}

/* ---------- Clubs ---------- */
const clubs = [
  { id: 1, name: 'DIU Robotics Club', img: 12, cat: 'Tech', members: 420, desc: 'Build robots, join workshops and compete in RoboSprint.' },
  { id: 2, name: 'CSE Society', img: 15, cat: 'Tech', members: 860, desc: 'Hackathons, tech talks and peer learning for CSE and SWE students.' },
  { id: 3, name: 'DIU Design Club', img: 44, cat: 'Creative', members: 310, desc: 'UI/UX critiques, Figma jams and portfolio nights.' },
  { id: 4, name: 'DIU Photography Club', img: 60, cat: 'Creative', members: 275, desc: 'Photo walks, exhibitions and editing workshops.' },
  { id: 5, name: 'Debating Society', img: 68, cat: 'Culture', members: 190, desc: 'Weekly practice rounds and inter-university tournaments.' },
  { id: 6, name: 'DIU Career Club', img: 11, cat: 'Career', members: 540, desc: 'CV clinics, mock interviews and alumni mentoring.' },
];
function Clubs() {
  const [tab, setTab] = useState('All'), [joined, tJoin] = useSet([2]), [q, setQ] = useState('');
  const list = clubs.filter(c => (tab === 'All' || c.cat === tab) && has(c, q));
  return <><Head t="Clubs & communities" s="Find your people and join the ones that fit." />
    <div className="toolbar"><Tabs items={['All', 'Tech', 'Creative', 'Career', 'Culture']} v={tab} set={setTab} /><Find q={q} set={setQ} ph="Search clubs" /></div>
    {list.length ? <div className="grid-cards">{list.map(c => <article className="card tile" key={c.id}>
      <div className="tile-top"><Av id={c.img} size="avatar-lg" /><div><b>{c.name}</b><span className="sub">{c.members + (joined.has(c.id) && c.id !== 2 ? 1 : 0)} members</span></div></div><p>{c.desc}</p>
      <div className="tile-foot"><span className="tag">{c.cat}</span><button className={`btn-primary btn-sm ${joined.has(c.id) ? 'btn-on' : ''}`} aria-pressed={joined.has(c.id)} onClick={() => tJoin(c.id)}>{joined.has(c.id) ? <><Check size={14} /> Joined</> : 'Join club'}</button></div></article>)}</div> : <Nothing t="No clubs found" />}</>;
}

/* ---------- Alumni ---------- */
const alumni = [
  { id: 1, name: 'Tanvir Ahmed', img: 13, role: 'Software Engineer', org: 'Brain Station 23', batch: 2019, field: 'Engineering' },
  { id: 2, name: 'Mehedi Hasan', img: 11, role: 'Product Engineer', org: 'Chaldal', batch: 2020, field: 'Product' },
  { id: 3, name: 'Rafi Chowdhury', img: 60, role: 'Mobile Developer', org: 'Startup Bangladesh', batch: 2021, field: 'Engineering' },
  { id: 4, name: 'Farzana Akter', img: 26, role: 'UX Designer', org: 'Pathao', batch: 2020, field: 'Design' },
  { id: 5, name: 'Imran Kabir', img: 33, role: 'Data Analyst', org: 'Grameenphone', batch: 2018, field: 'Data' },
  { id: 6, name: 'Samira Rahman', img: 45, role: 'Product Manager', org: 'Bkash', batch: 2019, field: 'Product' },
];
function Alumni({ go }) {
  const [tab, setTab] = useState('All'), [con, tCon] = useSet(), [q, setQ] = useState('');
  const list = alumni.filter(a => (tab === 'All' || a.field === tab) && has(a, q));
  return <><Head t="Alumni connect" s="Learn from people who studied where you study." />
    <div className="toolbar"><Tabs items={['All', 'Engineering', 'Design', 'Product', 'Data']} v={tab} set={setTab} /><Find q={q} set={setQ} ph="Search name or company" /></div>
    {list.length ? <div className="grid-cards">{list.map(a => <article className="card tile" key={a.id}>
      <div className="tile-top"><Av id={a.img} size="avatar-lg" /><div><b>{a.name}</b><span className="sub">{a.role} at {a.org}</span></div></div>
      <span className="sub meta"><GraduationCap size={14} /> DIU batch of {a.batch}</span>
      <div className="tile-foot"><button className="btn-outline btn-sm" onClick={() => go('Messages')}><MessageCircle size={14} /> Message</button><button className={`btn-primary btn-sm ${con.has(a.id) ? 'btn-on' : ''}`} aria-pressed={con.has(a.id)} onClick={() => tCon(a.id)}>{con.has(a.id) ? <><Check size={14} /> Requested</> : <><UserPlus size={14} /> Connect</>}</button></div></article>)}</div> : <Nothing t="No alumni found" />}</>;
}

/* ---------- My Network ---------- */
function Network({ go }) {
  const [tab, setTab] = useState('Connections');
  const [reqs, setReqs] = useState([{ id: 1, name: 'Nabila Islam', img: 44, sub: 'SWE, 2nd year · 6 mutual' }, { id: 2, name: 'Sadia Islam', img: 23, sub: 'UI/UX Designer · 9 mutual' }, { id: 3, name: 'Fahim Rahman', img: 68, sub: 'CSE, 4th year · 3 mutual' }]);
  const [conns, setConns] = useState([{ id: 11, name: 'Nusrat Jahan', img: 47, sub: 'CSE, 3rd year' }, { id: 12, name: 'Tanvir Ahmed', img: 13, sub: 'Alumni, Brain Station 23' }]);
  const accept = r => { setConns([r, ...conns]); setReqs(reqs.filter(x => x.id !== r.id)); };
  const list = tab === 'Connections' ? conns : reqs;
  return <><Head t="My network" s={`${conns.length + 246} connections across DIU.`} />
    <Tabs items={['Connections', 'Requests']} v={tab} set={setTab} />
    {list.length ? <div className="card list">{list.map(p => <div className="row" key={p.id}><Av id={p.img} size="avatar-lg" /><span className="row-main"><b>{p.name}</b><span className="sub">{p.sub}</span></span>
      <span className="row-actions">{tab === 'Requests' ? <><button className="icon-button" aria-label={`Ignore ${p.name}`} onClick={() => setReqs(reqs.filter(x => x.id !== p.id))}><X size={18} /></button><button className="btn-primary btn-sm" onClick={() => accept(p)}>Accept</button></> : <button className="btn-outline btn-sm" onClick={() => go('Messages')}>Message</button>}</span></div>)}</div>
      : <div className="empty-search card"><Users size={23} /><b>No pending requests</b><span>New connection requests will show up here.</span></div>}</>;
}

/* ---------- Explore ---------- */
const U = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
const VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const media = [
  { id: 1, type: 'video', cat: 'Promotional', title: 'Discover DIU: a day on campus', by: 'DIU Media Team', views: 48200, likes: 3100, dur: '2:14', days: 20, img: 'photo-1523240795612-9a054b0db644' },
  { id: 2, type: 'video', cat: 'Events', title: 'Tech Carnival 2025 highlights', by: 'CSE Society', views: 36900, likes: 2400, dur: '3:40', days: 90, img: 'photo-1540575467063-178a50c2df87' },
  { id: 3, type: 'video', cat: 'Promotional', title: 'Join the Robotics Club', by: 'DIU Robotics Club', views: 21400, likes: 1500, dur: '1:05', days: 12, img: 'photo-1485827404703-89b55fcc595e' },
  { id: 4, type: 'video', cat: 'Events', title: 'Career Connect: best moments', by: 'DIU Career Office', views: 17800, likes: 980, dur: '4:22', days: 45, img: 'photo-1511578314322-379afb476865' },
  { id: 5, type: 'video', cat: 'Creative', title: 'Behind the lens with the Photography Club', by: 'DIU Photography Club', views: 9300, likes: 720, dur: '2:48', days: 7, img: 'photo-1516321318423-f06f85e504b3' },
  { id: 6, type: 'photo', cat: 'Campus life', title: 'Golden hour at the main gate', by: 'Rafi Chowdhury', views: 6100, likes: 940, days: 3, img: 'photo-1522071820081-009f0129c71c' },
  { id: 7, type: 'photo', cat: 'Creative', title: 'Street portraits from the Old Dhaka walk', by: 'DIU Photography Club', views: 5200, likes: 810, days: 10, img: 'photo-1490645935967-10de6ba17061' },
  { id: 8, type: 'photo', cat: 'Events', title: 'Design Meetup Vol. 2', by: 'DIU Design Club', views: 3900, likes: 520, days: 25, img: 'photo-1540575467063-178a50c2df87' },
  { id: 9, type: 'post', cat: 'Tech', title: 'We shipped the first accessible campus navigation prototype. Looking for 2 more React folks for the next sprint.', by: 'Nusrat Jahan', views: 2800, likes: 84, days: 0 },
  { id: 10, type: 'post', cat: 'Campus life', title: 'Your GitHub is your living portfolio. Write useful READMEs and show what you learned, not just what you built.', by: 'Tanvir Ahmed', views: 4100, likes: 203, days: 1 },
  { id: 11, type: 'post', cat: 'Promotional', title: 'RoboSprint 2026 registrations are open to every DIU student. No robotics experience needed.', by: 'DIU Robotics Club', views: 5600, likes: 126, days: 2 },
];
const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k' : n;
const ago = d => d === 0 ? 'Today' : d < 30 ? `${d}d ago` : `${Math.round(d / 30)}mo ago`;
function Explore() {
  const [type, setType] = useState('All'), [cat, setCat] = useState('All topics'), [sort, setSort] = useState('Most viewed'), [q, setQ] = useState(''), [open, setOpen] = useState(null);
  useEffect(() => { if (!open) return; const k = e => e.key === 'Escape' && setOpen(null); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [open]);
  const kinds = { All: null, Videos: 'video', Posts: 'post', Photography: 'photo' };
  const list = media.filter(m => (!kinds[type] || m.type === kinds[type]) && (cat === 'All topics' || m.cat === cat) && has(m, q)).sort((a, b) => sort === 'Most viewed' ? b.views - a.views : a.days - b.days);
  const Stats = ({ m }) => <span className="sub meta"><Eye size={13} /> {fmt(m.views)} <Heart size={13} /> {fmt(m.likes)} · {ago(m.days)}</span>;
  return <><Head t="Explore" s="Videos, photos and posts from across DIU." />
    <div className="explore-bar"><Find q={q} set={setQ} ph="Search videos, photos, posts, clubs" /><select className="sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort by"><option>Most viewed</option><option>Latest</option></select></div>
    <Tabs items={['All', 'Videos', 'Posts', 'Photography']} v={type} set={setType} />
    <Tabs items={['All topics', 'Promotional', 'Events', 'Campus life', 'Tech', 'Creative']} v={cat} set={setCat} />
    {list.length ? <div className="media-grid">{list.map(m => m.type === 'post'
      ? <button className="card media-card post-media" key={m.id} onClick={() => setOpen(m)}><span className="tag sun"><FileText size={12} /> Post</span><p>{m.title}</p><span className="sub">{m.by}</span><Stats m={m} /></button>
      : <button className="card media-card" key={m.id} onClick={() => setOpen(m)}><span className="thumb"><img src={U(m.img)} alt="" loading="lazy" />{m.type === 'video' && <><span className="play"><Play size={22} fill="currentColor" /></span><span className="dur">{m.dur}</span></>}</span>
        <span className="media-body"><b>{m.title}</b><span className="sub">{m.by}</span><Stats m={m} /></span></button>)}</div> : <Nothing t="Nothing matches" />}
    {open && <div className="modal" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}><div className="modal-box" onClick={e => e.stopPropagation()}>
      {open.type === 'video' && <video src={VIDEO} poster={U(open.img)} controls autoPlay playsInline />}{open.type === 'photo' && <img src={U(open.img)} alt={open.title} />}
      <div className="modal-head"><div><b>{open.type === 'post' ? open.by : open.title}</b>{open.type === 'post' ? <p className="modal-text">{open.title}</p> : <span className="sub">{open.by}</span>}<Stats m={open} /></div><button className="icon-button" onClick={() => setOpen(null)} aria-label="Close"><X size={18} /></button></div></div></div>}</>;
}

/* ---------- Saved ---------- */
function Saved({ posts, renderPost, go }) {
  const list = posts.filter(p => p.saved);
  return <><Head t="Saved posts" s="Posts you bookmarked to come back to." />
    {list.length ? list.map(renderPost) : <div className="empty-search card"><Bookmark size={23} /><b>Nothing saved yet</b><span>Tap the bookmark on any post to keep it here.</span><button className="btn-primary btn-sm" onClick={() => go('Home')}>Browse the feed</button></div>}</>;
}

/* ---------- Settings ---------- */
function Settings({ onSignOut }) {
  const [s, setS] = useState({ reactions: true, messages: true, jobs: true, events: false, visible: true, alumni: true, online: true });
  const [dept, setDept] = useState('Software Engineering'), [saved, setSaved] = useState(false);
  const row = (k, t, d) => <div className="row"><span className="row-main"><b>{t}</b><span className="sub">{d}</span></span><Toggle on={s[k]} set={v => setS({ ...s, [k]: v })} label={t} /></div>;
  return <><Head t="Settings" s="Control what you see and who sees you." />
    <section className="card"><div className="row"><span className="row-main"><h3>Account</h3></span></div>
      <div className="row"><label className="field set-field"><span>DIU email</span><div className="field-box"><input value="urbi@diu.edu.bd" readOnly aria-readonly="true" /><Check size={16} /></div></label></div>
      <div className="row"><label className="field set-field"><span>Department</span><input value={dept} onChange={e => { setDept(e.target.value); setSaved(false); }} /></label></div>
      <div className="row"><button className="btn-primary btn-sm" onClick={() => setSaved(true)}>Save changes</button>{saved && <span className="sub" role="status">Changes saved</span>}</div></section>
    <section className="card"><div className="row"><span className="row-main"><h3>Notifications</h3></span></div>{row('reactions', 'Reactions and comments', 'When someone responds to your posts')}{row('messages', 'New messages', 'Chats from batchmates, alumni and clubs')}{row('jobs', 'Job alerts', 'Referrals and on-campus drives')}{row('events', 'Event reminders', 'The day before an event you joined')}</section>
    <section className="card"><div className="row"><span className="row-main"><h3>Privacy</h3></span></div>{row('visible', 'Profile visible to DIU members', 'Only people with a DIU email can see it')}{row('alumni', 'Let alumni message me', 'Alumni can send you requests and referrals')}{row('online', 'Show when I’m active', 'A green dot next to your name')}</section>
    <button className="btn-outline signout" onClick={onSignOut}><LogOut size={16} /> Sign out</button></>;
}

export default function Page({ name, posts, renderPost, go, onSignOut, notes, setNotes }) {
  const map = { Messages: <Messages />, Notifications: <Notifications n={notes} setN={setNotes} />, 'Jobs & Internships': <Jobs />, 'Campus Events': <Events />, 'Clubs & Communities': <Clubs />, 'Alumni Connect': <Alumni go={go} />, 'My Network': <Network go={go} />, Explore: <Explore go={go} />, 'Saved Posts': <Saved posts={posts} renderPost={renderPost} go={go} />, Settings: <Settings onSignOut={onSignOut} /> };
  return map[name] || <Explore go={go} />;
}

export function NotifBell({ notes, setNotes, go }) {
  const [open, setOpen] = useState(false), ref = useRef(null), unread = notes.filter(x => x.u).length;
  useEffect(() => {
    if (!open) return;
    const away = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return <div className="notif-wrap" ref={ref}>
    <button className="top-icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}><Bell size={19} />{unread > 0 && <b className="badge">{unread}</b>}</button>
    {open && <div className="notif-panel" role="dialog" aria-label="Notifications">
      <div className="np-head"><h3>Notifications</h3><button className="text-link" disabled={!unread} onClick={() => setNotes(notes.map(x => ({ ...x, u: 0 })))}>Mark all read</button></div>
      <div className="np-list">{notes.slice(0, 5).map(x => <button key={x.id} className={`np-item ${x.u ? 'unread' : ''}`} onClick={() => setNotes(notes.map(y => y.id === x.id ? { ...y, u: 0 } : y))}><Av id={x.img} /><span><span>{x.t}</span><small>{x.time}</small></span>{x.u ? <i className="dot" /> : null}</button>)}</div>
      <button className="np-foot" onClick={() => { setOpen(false); go('Notifications'); }}>See all notifications</button></div>}
  </div>;
}
