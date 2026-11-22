import React, { useState } from 'react';
import { CheckCircle2, Lock, AtSign, GraduationCap, Users, Upload, ArrowLeft } from 'lucide-react';
import { api } from './lib/api.js';

const DIU = /^[^\s@]+@diu\.edu\.bd$/i, MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, SID = /^\d{3}-\d{2}-\d{3,5}$/;
const ROLES = [['Student', GraduationCap], ['Alumni', Users]];
const NOTE = { Student: 'Use your @diu.edu.bd email and student ID.', Alumni: 'Graduates can join with a DIU email, or a personal email plus proof.' };
const blank = { name: '', email: '', pw: '', sid: '', year: '', proof: '' };
const Field = ({ label, err, icon: I, children }) => <label className={`field ${err ? 'bad' : ''}`}><span>{label}</span><div className="field-box">{I && <I size={16} />}{children}</div>{err && <em role="alert">{err}</em>}</label>;

export default function Auth({ onEnter }) {
  const [role, setRole] = useState('Student'), [mode, setMode] = useState('join'), [step, setStep] = useState('form'), [via, setVia] = useState('diu');
  const [f, setF] = useState(blank), [proofFile, setProofFile] = useState(null), [touched, setTouched] = useState(false), [code, setCode] = useState(''), [note, setNote] = useState('');
  const [busy, setBusy] = useState(false), [srvErr, setSrvErr] = useState({}), [formErr, setFormErr] = useState('');
  const set = k => e => { setF({ ...f, [k]: e.target.value }); setSrvErr({}); setFormErr(''); };
  const join = mode === 'join', personal = role === 'Alumni' && via === 'personal', needDiu = role !== 'Alumni' || (join && !personal);

  // client-side checks (the server checks everything again)
  const e = {};
  if (join && !f.name.trim()) e.name = 'Enter your full name.';
  if (!(needDiu ? DIU : MAIL).test(f.email.trim())) e.email = needDiu ? (f.email.includes('@') ? 'Only @diu.edu.bd emails work for this option.' : 'Use your DIU email, like name@diu.edu.bd') : 'Enter a valid email address.';
  if (f.pw.length < 8) e.pw = 'Password needs at least 8 characters.';
  if (join && !SID.test(f.sid.trim())) e.sid = 'Enter your student ID, like 231-35-1234.';
  if (join && role === 'Alumni' && !f.year) e.year = 'Choose your graduation year.';
  if (join && personal && !proofFile) e.proof = 'Upload your student ID card or certificate.';
  const show = k => (touched && e[k]) || srvErr[k];

  const submit = async ev => {
    ev.preventDefault(); setTouched(true); setFormErr('');
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const email = f.email.trim().toLowerCase();
      if (join) {
        const r = await api.auth.register({
          name: f.name.trim(), email, password: f.pw, studentId: f.sid.trim(),
          role: role.toLowerCase(), via: personal ? 'personal' : 'diu',
          ...(role === 'Alumni' ? { graduationYear: f.year } : {}),
        }, personal ? proofFile : null);
        setStep(r.status === 'pending_review' ? 'pending' : 'otp');
      } else {
        const r = await api.auth.login(email, f.pw);   // also saves the token
        onEnter(r.user);
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') { setStep('otp'); setNote('Your email is not verified yet. Enter the 6-digit code, or tap "Resend code".'); }
      else { setSrvErr(err.fields || {}); setFormErr(err.status ? err.message : 'Cannot reach the server. Is the backend running?'); }
    } finally { setBusy(false); }
  };

  const verify = async ev => {
    ev.preventDefault(); setBusy(true); setNote('');
    try { const r = await api.auth.verifyEmail(f.email.trim().toLowerCase(), code); onEnter(r.user); }
    catch (err) { setNote(err.status ? err.message : 'Cannot reach the server. Is the backend running?'); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    try { await api.auth.resendCode(f.email.trim().toLowerCase()); setNote('We sent a new code.'); }
    catch (err) { setNote(err.message); }
  };
  const pick = r => { setRole(r); setTouched(false); setVia('diu'); setF(blank); setProofFile(null); setSrvErr({}); setFormErr(''); };
  const back = () => { setStep('form'); setCode(''); setNote(''); };

  return <div className="auth">
    <section className="auth-hero">
      <div className="brand"><div className="brand-mark"><span>D</span></div><span className="brand-name">DIU<span>Link</span></span></div>
      <h1>Finally, a feed where everyone actually goes to DIU.</h1>
      <p>Your clubs, campus events, alumni referrals and batchmates in one place. Only verified DIU students and alumni get in.</p>
      <div className="stickers" aria-hidden="true"><span className="sticker s1">Robotics Club is recruiting</span><span className="sticker s2">Alumni referral at Brain Station 23</span><span className="sticker s3">Tech Carnival on Nov 24</span><span className="sticker s4">Looking for a UI/UX teammate</span></div>
    </section>
    <section className="auth-panel">
      {step === 'form' && <form onSubmit={submit} noValidate>
        <h2>{join ? 'Join your campus' : 'Welcome back'}</h2>
        <div className="role-tabs" role="tablist" aria-label="I am a">{ROLES.map(([r, I]) => <button type="button" role="tab" aria-selected={role === r} key={r} className={role === r ? 'selected' : ''} onClick={() => pick(r)}><I size={16} />{r}</button>)}</div>
        <p className="auth-sub">{NOTE[role]}</p>
        {join && role === 'Alumni' && <div className="via"><button type="button" className={via === 'diu' ? 'selected' : ''} onClick={() => setVia('diu')}>I still use my DIU email<small>Verified instantly with a code</small></button><button type="button" className={via === 'personal' ? 'selected' : ''} onClick={() => setVia('personal')}>I use a personal email<small>Upload proof, the DIU team reviews it</small></button></div>}
        {join && <Field label="Full name" err={show('name')}><input value={f.name} onChange={set('name')} placeholder="Your full name" autoComplete="name" /></Field>}
        <Field label={needDiu ? 'DIU email' : 'Email'} err={show('email')} icon={AtSign}><input type="email" value={f.email} onChange={set('email')} placeholder={needDiu ? 'name@diu.edu.bd' : 'you@example.com'} autoComplete="email" /></Field>
        {join && <Field label="Student ID" err={show('sid') || srvErr.studentId}><input value={f.sid} onChange={set('sid')} placeholder="231-35-1234" /></Field>}
        {join && role === 'Alumni' && <Field label="Graduation year" err={show('year') || srvErr.graduationYear}><select value={f.year} onChange={set('year')}><option value="">Select year</option>{Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y}>{y}</option>)}</select></Field>}
        {join && personal && <Field label="Proof of graduation" err={show('proof')} icon={Upload}><input type="file" accept="image/*,application/pdf" onChange={ev => setProofFile(ev.target.files[0] || null)} /></Field>}
        <Field label="Password" err={show('pw') || srvErr.password} icon={Lock}><input type="password" value={f.pw} onChange={set('pw')} placeholder="8 characters or more" autoComplete={join ? 'new-password' : 'current-password'} /></Field>
        {formErr && <p className="auth-err" role="alert">{formErr}</p>}
        <button className="btn-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : join ? 'Continue' : 'Sign in'}</button>
        <p className="auth-switch">{join ? 'Already have an account?' : 'New to DIULink?'} <button type="button" onClick={() => { setMode(join ? 'in' : 'join'); setTouched(false); setSrvErr({}); setFormErr(''); }}>{join ? 'Sign in' : 'Join now'}</button></p>
      </form>}
      {step === 'otp' && <form onSubmit={verify}>
        <button type="button" className="back-link" onClick={back}><ArrowLeft size={15} /> Back</button>
        <h2>Check your email</h2><p className="auth-sub">We sent a 6-digit code to {f.email}. It expires in 10 minutes.</p>
        <label className="field"><span>Verification code</span><input className="otp" inputMode="numeric" maxLength={6} value={code} onChange={ev => { setCode(ev.target.value.replace(/\D/g, '')); setNote(''); }} placeholder="000000" autoFocus /></label>
        {note && <p className="auth-err" role="alert">{note}</p>}
        <button className="btn-primary auth-submit" disabled={code.length < 6 || busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
        <p className="auth-switch">Didn’t get it? <button type="button" onClick={resend}>Resend code</button></p>
      </form>}
      {step === 'pending' && <div className="auth-pending">
        <span className="empty-icon"><CheckCircle2 size={26} /></span><h2>Request received</h2>
        <p className="auth-sub">The DIU team will check your proof within 2 working days. You can sign in once you are approved.</p>
        <button className="btn-primary auth-submit" onClick={() => { back(); setMode('in'); }}>Back to sign in</button>
      </div>}
    </section>
  </div>;
}
