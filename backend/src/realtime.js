// Holds the Socket.IO instance so any module can push events.
let io = null;

// userId -> number of open sockets
const online = new Map();

export const setIO = instance => {
  io = instance;
};

// Send event to all authenticated and connected users.
export const emitToAll = (event, payload) => {
  if (io) {
    io.emit(event, payload);
  }
};

// Send event to a specific user.
export const emitToUser = (userId, event, payload) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
};

export const isOnline = userId =>
  (online.get(Number(userId)) || 0) > 0;

export const markConnected = userId => {
  const id = Number(userId);
  const n = (online.get(id) || 0) + 1;

  online.set(id, n);

  return n === 1;
};

export const markDisconnected = userId => {
  const id = Number(userId);
  const n = (online.get(id) || 1) - 1;

  if (n <= 0) {
    online.delete(id);
    return true;
  }

  online.set(id, n);
  return false;
};