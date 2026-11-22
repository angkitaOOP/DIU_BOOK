import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, MapPin, GraduationCap, Mail, Github, Linkedin, ExternalLink, Edit3, UserPlus, UserRound,
  PlusCircle, Plus, ChevronRight, Sparkles, Clock3, Briefcase
} from 'lucide-react';
import { api } from './lib/api.js';

const Avatar = ({ src, size = 'md' }) => <span className={`avatar avatar-${size}`}>{src ? <img src={src} alt="" /> : <UserRound size={22} />}</span>;
const ago = d => { const s = (Date.now() - new Date(d).getTime()) / 1000; return s < 60 ? 'Just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} hr ago` : `${Math.floor(s / 86400)} d ago`; };
const subtitle = p => p.role === 'alumni' ? `Alumni${p.jobTitle ? ` · ${p.jobTitle}` : ''}${p.company ? ` at ${p.company}` : ''}` : `${p.department || 'Student'} · Daffodil International University`;

export default function ProfilePage({ userId, me, onBack, onMeChange }) {
  const [p, setP] = useState(null), [err, setErr] = useState(''), [tab, setTab] = useState('Overview');
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState({}), [newSkill, setNewSkill] = useState('');
  const [posts, setPosts] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const [proj, setProj] = useState(null), [edu, setEdu] = useState(null);
  const isSelf = Number(userId) === me.id;

  const load = async () => {
    try { const r = await api.users.get(userId); setP(r.profile); setErr(''); }
    catch (e) { setErr(e.status === 404 ? 'This member was not found.' : e.message); }
  };
  useEffect(() => { setP(null); setPosts(null); setTab('Overview'); setEditing(false); load(); }, [userId]);
  useEffect(() => { if (tab === 'Posts' && posts === null) api.posts.byUser(userId).then(r => setPosts(r.items)).catch(() => setPosts([])); }, [tab, userId]);

  if (err) return <div className="profile-page"><div className="profile-page-top"><button className="back-link" onClick={onBack}><ChevronRight size={15} /> Back</button></div><div className="empty-search card"><b>{err}</b></div></div>;
  if (!p) return <div className="profile-page"><div className="empty-search card"><b>Loading profile…</b></div></div>;

  const startEdit = () => { setDraft({ name: p.name, headline: p.headline || '', bio: p.bio || '', location: p.location || '', githubUrl: p.githubUrl || '', linkedinUrl: p.linkedinUrl || '' }); setEditing(true); setMsg(''); };
  const save = async () => {
    setBusy(true); setMsg('');
    try { const r = await api.users.updateMe(draft); onMeChange?.(r.user); setEditing(false); await load(); }
    catch (e) { setMsg(e.fields ? Object.values(e.fields).join(' ') : e.message); }
    finally { setBusy(false); }
  };
  const addSkill = async () => {
    const s = newSkill.trim(); if (!s || p.skills.includes(s)) return setNewSkill('');
    try { await api.users.setSkills([...p.skills, s]); setNewSkill(''); load(); } catch (e) { setMsg(e.message); }
  };
  const removeSkill = async s => { try { await api.users.setSkills(p.skills.filter(x => x !== s)); load(); } catch (e) { setMsg(e.message); } };
  const connect = async () => { try { await api.connections.request(p.id); load(); } catch (e) { setMsg(e.message); } };
  const addProject = async ev => { ev.preventDefault(); try { await api.users.add('projects', { title: proj.title, type: proj.type || undefined, description: proj.description || undefined }); setProj(null); load(); } catch (e) { setMsg(e.fields ? Object.values(e.fields).join(' ') : e.message); } };
  const addEdu = async ev => { ev.preventDefault(); try { await api.users.add('education', { institution: edu.institution, degree: edu.degree || undefined, startYear: edu.startYear ? +edu.startYear : undefined, endYear: edu.endYear ? +edu.endYear : undefined }); setEdu(null); load(); } catch (e) { setMsg(e.fields ? Object.values(e.fields).join(' ') : e.message); } };
  const delItem = async (section, id) => { try { await api.users.remove(section, id); load(); } catch (e) { setMsg(e.message); } };

  if (p.restricted) return <div className="profile-page"><div className="profile-page-top"><button className="back-link" onClick={onBack}><ChevronRight size={15} /> Back</button></div>
    <section className="profile-hero card"><div className="profile-hero-body"><Avatar src={p.avatarUrl} size="profile-xl" /><div className="profile-hero-main"><h1>{p.name}</h1><p>{subtitle(p)}</p><p className="auth-sub">This member keeps their profile private. Connect to see more.</p>{p.connectionStatus === 'none' && <button className="btn-primary" onClick={connect}><UserPlus size={15} /> Connect</button>}</div></div></section></div>;

  const connLabel = { none: 'Connect', pending_sent: 'Request sent', pending_received: 'Accept request', connected: 'Connected' }[p.connectionStatus];
  const field = k => ({ value: draft[k] ?? '', onChange: e => setDraft({ ...draft, [k]: e.target.value }) });

  return <div className="profile-page">
    <div className="profile-page-top"><button className="back-link" onClick={onBack}><ChevronRight size={15} /> Back to Home</button></div>
    <section className="profile-hero card">
      <div className="profile-cover-large"><div className="cover-orbit orbit-one" /><div className="cover-orbit orbit-two" /><div className="cover-brand">DIU<span>Link</span></div></div>
      <div className="profile-hero-body">
        <div className="profile-avatar-wrap"><Avatar src={p.avatarUrl} size="profile-xl" /><span className="profile-verified"><CheckCircle2 size={16} /> DIU verified</span></div>
        <div className="profile-hero-main">
          <div className="profile-name-row"><div>
            {editing ? <input className="bio-editor" style={{ minHeight: 0, height: 40, fontSize: 20, fontWeight: 700 }} {...field('name')} /> : <h1>{p.name} <CheckCircle2 size={19} /></h1>}
            {editing ? <input className="bio-editor" style={{ minHeight: 0, height: 36, marginTop: 6 }} placeholder="Headline, e.g. SWE student · UI/UX" {...field('headline')} /> : <p>{p.headline || subtitle(p)}</p>}
          </div>
            <div className="profile-actions">
              {isSelf ? (editing
                ? <><button className="btn-outline" onClick={() => setEditing(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>
                : <button className="btn-outline" onClick={startEdit}><Edit3 size={15} /> Edit profile</button>)
                : <button className="btn-primary" disabled={p.connectionStatus === 'pending_sent' || p.connectionStatus === 'connected'} onClick={connect}>{p.connectionStatus === 'connected' ? <CheckCircle2 size={15} /> : <UserPlus size={15} />} {connLabel}</button>}
            </div></div>
          <div className="profile-meta">
            {editing ? <input className="bio-editor" style={{ minHeight: 0, height: 34 }} placeholder="Location" {...field('location')} /> : p.location && <span><MapPin size={14} /> {p.location}</span>}
            <span><GraduationCap size={14} /> Daffodil International University</span>
            {!editing && p.githubUrl && <a href={p.githubUrl} target="_blank" rel="noreferrer"><Github size={14} /> GitHub <ExternalLink size={11} /></a>}
          </div>
          <div className="profile-counts"><div><b>{p.counts.connections}</b><span>Connections</span></div><div><b>{p.counts.posts}</b><span>Posts</span></div><div><b>{p.counts.projects}</b><span>Projects</span></div><div><b>{p.counts.skills}</b><span>Skills</span></div></div>
        </div>
      </div>
    </section>
    {msg && <p className="auth-err" role="alert">{msg}</p>}
    <div className="profile-tabs card">{['Overview', 'Posts', 'Projects'].map(t => <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>

    {tab === 'Overview' && <div className="profile-layout">
      <div className="profile-left-column">
        <section className="profile-section card"><div className="profile-section-heading"><h3>About</h3>{editing && <span className="edit-chip">Editing</span>}</div>
          {editing ? <textarea className="bio-editor" placeholder="Write a short introduction…" {...field('bio')} /> : <p className="profile-bio">{p.bio || (isSelf ? 'Add a short introduction so classmates can get to know you.' : 'No introduction yet.')}</p>}
          <div className="profile-info-list">
            <div><span className="info-icon blue"><GraduationCap size={17} /></span><div><b>{p.role === 'alumni' ? 'Alumni' : 'Studying'}</b><span>{p.department || 'Daffodil International University'}{p.graduationYear ? ` · Class of ${p.graduationYear}` : ''}</span></div></div>
            {p.email && <div><span className="info-icon lilac"><Mail size={17} /></span><div><b>DIU email</b><span>{p.email}</span></div></div>}
            {p.studentId && <div><span className="info-icon green"><Briefcase size={17} /></span><div><b>Student ID</b><span>{p.studentId}</span></div></div>}
          </div>
          {editing && <><input className="bio-editor" style={{ minHeight: 0, height: 36, marginTop: 10 }} placeholder="GitHub URL (https://…)" {...field('githubUrl')} /><input className="bio-editor" style={{ minHeight: 0, height: 36, marginTop: 8 }} placeholder="LinkedIn URL (https://…)" {...field('linkedinUrl')} /></>}
        </section>
        <section className="profile-section card"><div className="profile-section-heading"><h3>Education</h3>{isSelf && <button className="small-text-action" onClick={() => setEdu({ institution: 'Daffodil International University', degree: '', startYear: '', endYear: '' })}><PlusCircle size={14} /> Add</button>}</div>
          {edu && <form onSubmit={addEdu} className="add-skill-row" style={{ flexWrap: 'wrap' }}><input required placeholder="Institution" value={edu.institution} onChange={e => setEdu({ ...edu, institution: e.target.value })} /><input placeholder="Degree" value={edu.degree} onChange={e => setEdu({ ...edu, degree: e.target.value })} /><input placeholder="From" value={edu.startYear} onChange={e => setEdu({ ...edu, startYear: e.target.value })} style={{ width: 70 }} /><input placeholder="To" value={edu.endYear} onChange={e => setEdu({ ...edu, endYear: e.target.value })} style={{ width: 70 }} /><button type="submit"><Plus size={14} /> Save</button></form>}
          {p.education.length ? p.education.map(e => <div className="timeline-item" key={e.id}><span className="timeline-logo">{e.institution.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}</span><div><b>{e.institution}</b>{e.degree && <span>{e.degree}</span>}{(e.startYear || e.endYear) && <small>{e.startYear || ''} – {e.endYear || 'Present'}</small>}</div>{isSelf && <button className="small-text-action" onClick={() => delItem('education', e.id)}>Remove</button>}</div>) : <p className="profile-bio">{isSelf ? 'Add your education.' : 'Nothing added yet.'}</p>}
        </section>
        <section className="profile-section card"><div className="profile-section-heading"><h3>Skills & interests</h3><span className="skill-count">{p.skills.length} skills</span></div>
          <div className="skill-list">{p.skills.map(s => <span className="skill-pill" key={s}>{s}{isSelf && <button aria-label={`Remove ${s}`} style={{ marginLeft: 6, border: 0, background: 'none', cursor: 'pointer' }} onClick={() => removeSkill(s)}>×</button>}</span>)}</div>
          {isSelf && <div className="add-skill-row"><input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()} placeholder="Add a skill..." /><button onClick={addSkill}><Plus size={14} /> Add</button></div>}
        </section>
      </div>
      <div className="profile-center-column">
        <section className="profile-section card"><div className="profile-section-heading"><div><h3>Projects</h3></div><button className="small-text-action" onClick={() => setTab('Projects')}>View all</button></div>
          {p.projects.length ? p.projects.slice(0, 2).map(x => <article className="featured-project" key={x.id}><div className="featured-project-copy"><span className="project-type">{x.type}</span><h4>{x.title}</h4><p>{x.description}</p></div></article>) : <p className="profile-bio">{isSelf ? 'Add your first project from the Projects tab.' : 'No projects yet.'}</p>}
        </section>
      </div>
      <aside className="profile-right-column">
        {isSelf && p.strength && <section className="profile-section card profile-strength"><div className="profile-section-heading"><h3>Profile strength</h3><Sparkles size={17} /></div>
          <div className="strength-number"><b>{p.strength.percent}%</b><span>{p.strength.percent >= 80 ? 'Looking good!' : 'Keep going!'}</span></div><div className="strength-track"><i style={{ width: `${p.strength.percent}%` }} /></div>
          {p.strength.checklist.map(c => <div key={c.label} className={`strength-check ${c.done ? '' : 'pending'}`}>{c.done ? <CheckCircle2 size={15} /> : <PlusCircle size={15} />} {c.label}</div>)}</section>}
        <section className="profile-section card"><div className="profile-section-heading"><h3>Find me online</h3></div>
          {p.githubUrl ? <a className="social-link" href={p.githubUrl} target="_blank" rel="noreferrer"><span className="social-icon"><Github size={17} /></span><div><b>GitHub</b></div><ExternalLink size={13} /></a> : null}
          {p.linkedinUrl ? <a className="social-link" href={p.linkedinUrl} target="_blank" rel="noreferrer"><span className="social-icon linkedin"><Linkedin size={17} /></span><div><b>LinkedIn</b></div><ExternalLink size={13} /></a> : null}
          {!p.githubUrl && !p.linkedinUrl && <p className="profile-bio">No links added.</p>}
        </section>
      </aside>
    </div>}

    {tab === 'Posts' && <section className="profile-section card profile-tab-panel"><div className="profile-section-heading"><h3>Posts by {p.name.split(' ')[0]}</h3><span className="skill-count">{p.counts.posts} posts</span></div>
      {posts === null ? <p className="profile-bio">Loading…</p> : posts.length ? posts.map(x => <div className="activity-item" key={x.id}><Avatar src={p.avatarUrl} /><div><b>{p.name}</b><p>{x.content}</p><small><Clock3 size={11} /> {ago(x.createdAt)} · {x.counts.reactions} reactions · {x.counts.comments} comments</small></div></div>) : <p className="profile-bio">No posts yet.</p>}
    </section>}

    {tab === 'Projects' && <section className="profile-section card profile-tab-panel"><div className="profile-section-heading"><h3>Projects & portfolio</h3>{isSelf && <button className="small-text-action" onClick={() => setProj({ title: '', type: '', description: '' })}><PlusCircle size={14} /> Add project</button>}</div>
      {proj && <form onSubmit={addProject} className="add-skill-row" style={{ flexWrap: 'wrap' }}><input required placeholder="Project title" value={proj.title} onChange={e => setProj({ ...proj, title: e.target.value })} /><input placeholder="Type (e.g. Web app)" value={proj.type} onChange={e => setProj({ ...proj, type: e.target.value })} /><input placeholder="Short description" value={proj.description} onChange={e => setProj({ ...proj, description: e.target.value })} style={{ flex: 2 }} /><button type="submit"><Plus size={14} /> Save</button></form>}
      <div className="all-projects-grid">{p.projects.map(x => <article className="all-project-card" key={x.id}><div className="featured-project-copy"><span className="project-type">{x.type}</span><h4>{x.title}</h4><p>{x.description}</p>{isSelf && <button className="small-text-action" onClick={() => delItem('projects', x.id)}>Remove</button>}</div></article>)}</div>
      {!p.projects.length && !proj && <p className="profile-bio">No projects yet.</p>}
    </section>}
  </div>;
}
