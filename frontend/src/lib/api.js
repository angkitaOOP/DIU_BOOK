// Copy this file to your frontend as  src/lib/api.js  and run:  npm i socket.io-client
// Add to the frontend .env:  VITE_API_URL=http://localhost:5000
import { io } from 'socket.io-client';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'diulink_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = t => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(status, body) { super(body?.error?.message || 'Request failed'); this.status = status; this.code = body?.error?.code; this.fields = body?.error?.details; }
}

async function request(method, path, { body, form } = {}) {
  const headers = {}; const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && ['INVALID_TOKEN', 'ACCOUNT_INACTIVE'].includes(data?.error?.code)) { setToken(null); window.dispatchEvent(new Event('diulink:logout')); }
    throw new ApiError(res.status, data);
  }
  return data;
}
const get = (p) => request('GET', p), post = (p, body) => request('POST', p, { body }),
  put = (p, body) => request('PUT', p, { body }), patch = (p, body) => request('PATCH', p, { body }), del = p => request('DELETE', p);
const qs = o => { const s = new URLSearchParams(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString(); return s ? `?${s}` : ''; };

export const api = {
  auth: {
    register: (data, proofFile) => { // proofFile only for alumni using a personal email
      if (!proofFile) return post('/auth/register', data);
      const f = new FormData(); Object.entries(data).forEach(([k, v]) => v != null && f.append(k, v)); f.append('proof', proofFile);
      return request('POST', '/auth/register', { form: f });
    },
    verifyEmail: (email, code) => post('/auth/verify-email', { email, code }).then(r => (setToken(r.token), r)),
    resendCode: email => post('/auth/resend-code', { email }),
    login: (email, password) => post('/auth/login', { email, password }).then(r => (setToken(r.token), r)),
    me: () => get('/auth/me'),
    forgotPassword: email => post('/auth/forgot-password', { email }),
    resetPassword: (email, code, newPassword) => post('/auth/reset-password', { email, code, newPassword }),
    changePassword: (currentPassword, newPassword) => post('/auth/change-password', { currentPassword, newPassword }),
    logout: () => setToken(null),
  },
  users: {
    get: id => get(`/users/${id}`), list: params => get(`/users${qs(params)}`), suggestions: () => get('/users/suggestions'),
    updateMe: data => patch('/users/me', data), updateSettings: s => patch('/users/me/settings', s), setSkills: skills => put('/users/me/skills', { skills }),
    add: (section, data) => post(`/users/me/${section}`, data),            // section: education | experience | projects
    edit: (section, id, data) => patch(`/users/me/${section}/${id}`, data),
    remove: (section, id) => del(`/users/me/${section}/${id}`),
  },
  upload: (file, folder = 'posts') => { const f = new FormData(); f.append('file', file); return request('POST', `/upload${qs({ folder })}`, { form: f }); },
  connections: {
    list: () => get('/connections'), requests: () => get('/connections/requests'), sent: () => get('/connections/sent'),
    request: userId => post('/connections/request', { userId }), accept: id => post(`/connections/${id}/accept`),
    ignore: id => del(`/connections/${id}`), remove: userId => del(`/connections/user/${userId}`),
  },
  posts: {
    feed: params => get(`/posts/feed${qs(params)}`),            // { tab: 'forYou'|'following'|'latest', cursor }
    saved: params => get(`/posts/saved${qs(params)}`), byUser: (id, p) => get(`/posts/user/${id}${qs(p)}`), byClub: (id, p) => get(`/posts/club/${id}${qs(p)}`),
    byTag: (tag, p) => get(`/posts/tag/${encodeURIComponent(tag)}${qs(p)}`), trendingTags: () => get('/posts/trending/tags'),
    create: data => post('/posts', data), edit: (id, content) => patch(`/posts/${id}`, { content }), remove: id => del(`/posts/${id}`),
    react: (id, type = 'like') => put(`/posts/${id}/reaction`, { type }), unreact: id => del(`/posts/${id}/reaction`),
    save: id => put(`/posts/${id}/save`), unsave: id => del(`/posts/${id}/save`),
    share: (id, comment) => post(`/posts/${id}/share`, { comment }), view: id => post(`/posts/${id}/view`),
    comments: (id, p) => get(`/posts/${id}/comments${qs(p)}`), comment: (id, content, parentId) => post(`/posts/${id}/comments`, { content, parentId }),
    removeComment: (id, cid) => del(`/posts/${id}/comments/${cid}`),
  },
  explore: params => get(`/explore${qs(params)}`), search: q => get(`/search${qs({ q })}`),
  clubs: { list: p => get(`/clubs${qs(p)}`), get: id => get(`/clubs/${id}`), join: id => post(`/clubs/${id}/join`), leave: id => del(`/clubs/${id}/leave`), members: id => get(`/clubs/${id}/members`) },
  events: { list: p => get(`/events${qs(p)}`), get: id => get(`/events/${id}`), going: id => put(`/events/${id}/going`), notGoing: id => del(`/events/${id}/going`), create: d => post('/events', d) },
  jobs: {
    list: p => get(`/jobs${qs(p)}`),                          // { kind: 'job'|'internship'|'alumni_referral'|'on_campus', q, saved: 1 }
    create: d => post('/jobs', d), save: id => put(`/jobs/${id}/save`), unsave: id => del(`/jobs/${id}/save`),
    apply: (id, d) => post(`/jobs/${id}/apply`, d || {}), withdraw: id => del(`/jobs/${id}/apply`), mine: () => get('/jobs/applications/mine'),
  },
  messages: {
    conversations: () => get('/messages/conversations'), unreadCount: () => get('/messages/unread-count'),
    open: userId => post('/messages/conversations', { userId }),   // -> { conversationId }
    history: (id, p) => get(`/messages/conversations/${id}/messages${qs(p)}`), read: id => post(`/messages/conversations/${id}/read`),
  },
  notifications: { list: p => get(`/notifications${qs(p)}`), unreadCount: () => get('/notifications/unread-count'), read: id => post(`/notifications/${id}/read`), readAll: () => post('/notifications/read-all') },
};

/* ---------------- Real-time (messages, notifications, typing, presence) ---------------- */
let socket = null;
export function connectSocket() {
  if (socket?.connected || !getToken()) return socket;
  socket = io(BASE, { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
  return socket;
}
export const disconnectSocket = () => { socket?.disconnect(); socket = null; };
export const sendMessage = (conversationId, content) =>
  new Promise((resolve, reject) => socket.emit('message:send', { conversationId, content }, r => (r?.ok ? resolve(r.message) : reject(new Error(r?.error || 'Could not send')))));
export const setTyping = (conversationId, isTyping) => socket?.emit('typing', { conversationId, isTyping });
export const markConversationRead = (conversationId, upTo) => socket?.emit('message:read', { conversationId, upTo });
// Events you can listen to with socket.on(...):
//   'message:new' {id, conversationId, senderId, content, createdAt}   'message:read' {conversationId, userId, lastReadMessageId}
//   'typing' {conversationId, userId, isTyping}   'presence:update' {userId, online}   'notification:new' {id, type, message, actor, ...}
export const getSocket = () => socket;
