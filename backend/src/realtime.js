// Holds the Socket.IO instance so any module can push events without importing the socket server.
let io = null;
const online = new Map(); // userId -> number of open sockets

export const setIO = instance => { io = instance; };
export const emitToUser = (userId, event, payload) => { if (io) io.to(`user:${userId}`).emit(event, payload); };
export const isOnline = userId => (online.get(Number(userId)) || 0) > 0;
export const markConnected = userId => { const n = (online.get(userId) || 0) + 1; online.set(userId, n); return n === 1; };
export const markDisconnected = userId => {
  const n = (online.get(userId) || 1) - 1;
  if (n <= 0) { online.delete(userId); return true; }
  online.set(userId, n); return false;
};
