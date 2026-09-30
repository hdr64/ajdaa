import { io, type Socket } from 'socket.io-client';
import { getAuthToken } from './api';

/**
 * Socket.io stays on the same origin: the Vite dev server proxies it in
 * development and Caddy does the same in production.
 */
function createSocket(): Socket {
  return io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    // If a proxy or browser blocks the WebSocket upgrade, fall back to HTTP
    // long-polling instead of giving up, so live updates keep working.
    tryAllTransports: true,
    autoConnect: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    // Evaluated on every (re)connect so a fresh login is picked up. The server
    // only delivers admin events to sockets whose token grants the permission.
    auth: (cb) => {
      const token = getAuthToken();
      cb(token ? { token } : {});
    },
  });
}

let sharedSocket: Socket | null = null;
let consumerCount = 0;
let pendingDisconnect: ReturnType<typeof setTimeout> | null = null;

/** Grace period before the last consumer's release actually closes the socket. */
const DISCONNECT_GRACE_MS = 1500;

/** One connection is shared by every realtime consumer on the page. */
export function acquireSocket(): Socket {
  consumerCount += 1;
  // A consumer re-mounting right after the previous one left keeps the live socket.
  if (pendingDisconnect) {
    clearTimeout(pendingDisconnect);
    pendingDisconnect = null;
  }
  if (!sharedSocket) {
    sharedSocket = createSocket();
  }
  return sharedSocket;
}

export function releaseSocket(): void {
  consumerCount = Math.max(0, consumerCount - 1);
  if (consumerCount > 0 || !sharedSocket || pendingDisconnect) return;
  // Deferred: page transitions and StrictMode unmount/remount would otherwise
  // close the socket mid-handshake and immediately open a new one.
  pendingDisconnect = setTimeout(() => {
    pendingDisconnect = null;
    if (consumerCount === 0 && sharedSocket) {
      sharedSocket.disconnect();
      sharedSocket = null;
    }
  }, DISCONNECT_GRACE_MS);
}
