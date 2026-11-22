// Matches the toggles on the frontend Settings page.
export const defaultSettings = {
  notifications: { reactions: true, messages: true, jobs: true, events: false },
  privacy: { visible: true, alumniMessages: true, showActive: true },
};

export const parseJson = v => {
  if (v == null) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  return v;
};

export const mergeSettings = raw => {
  const s = parseJson(raw) || {};
  return {
    notifications: { ...defaultSettings.notifications, ...(s.notifications || {}) },
    privacy: { ...defaultSettings.privacy, ...(s.privacy || {}) },
  };
};
