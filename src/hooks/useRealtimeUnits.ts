import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Property } from '../types/property';
import type { UnitRemovedEvent, UnitStatusEvent } from '../services/propertyService';
import { getAuthToken } from '../services/api';

/**
 * Socket.io stays on the same origin: the Vite dev server proxies it in
 * development and Caddy does the same in production.
 */
function getSocket(): Socket {
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
    // only delivers inquiry events to sockets whose token grants viewInquiries.
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

/** One connection is shared by every consumer on the page. */
function acquireSocket(): Socket {
  consumerCount += 1;
  // A consumer re-mounting right after the previous one left keeps the live socket.
  if (pendingDisconnect) {
    clearTimeout(pendingDisconnect);
    pendingDisconnect = null;
  }
  if (!sharedSocket) {
    sharedSocket = getSocket();
  }
  return sharedSocket;
}

function releaseSocket(): void {
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

export interface RealtimeHandlers {
  onUnitStatus?: (event: UnitStatusEvent) => void;
  onUnitRemoved?: (event: UnitRemovedEvent) => void;
  onInquiryCreated?: (payload: unknown) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Subscribes to live server events for the lifetime of the component.
 * Handlers are kept in a ref so callers do not have to memoise their callbacks.
 */
export function useRealtimeUnits(handlers: RealtimeHandlers = {}): void {
  // Latest handlers live in a ref, so re-renders with new inline callbacks never
  // re-subscribe (which used to release and reopen the socket on every render).
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = acquireSocket();

    const handleStatus = (event: UnitStatusEvent) => handlersRef.current.onUnitStatus?.(event);
    const handleRemoved = (event: UnitRemovedEvent) => handlersRef.current.onUnitRemoved?.(event);
    const handleInquiry = (payload: unknown) => handlersRef.current.onInquiryCreated?.(payload);
    const handleConnect = () => handlersRef.current.onConnectionChange?.(true);
    const handleDisconnect = () => handlersRef.current.onConnectionChange?.(false);

    socket.on('unit_status_updated', handleStatus);
    socket.on('unit_removed', handleRemoved);
    socket.on('new_inquiry_received', handleInquiry);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) handlersRef.current.onConnectionChange?.(true);

    return () => {
      socket.off('unit_status_updated', handleStatus);
      socket.off('unit_removed', handleRemoved);
      socket.off('new_inquiry_received', handleInquiry);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      releaseSocket();
    };
  }, []);
}

/**
 * Applies a realtime status event to a project list held in React state,
 * without refetching the whole portfolio.
 */
export function applyUnitStatus(projects: Property[], event: UnitStatusEvent): Property[] {
  return projects.map((project) => {
    if (!project.floors?.some((floor) => floor.id === event.floorId)) return project;

    return {
      ...project,
      floors: project.floors.map((floor) =>
        floor.id !== event.floorId
          ? floor
          : {
              ...floor,
              units: floor.units.map((unit) =>
                unit.id === event.unitId
                  ? { ...unit, status: event.status, statusAr: event.statusAr, statusEn: event.statusEn ?? undefined }
                  : unit
              ),
            }
      ),
    };
  });
}

export function removeUnit(projects: Property[], event: UnitRemovedEvent): Property[] {
  return projects.map((project) => {
    if (!project.floors?.some((floor) => floor.id === event.floorId)) return project;

    return {
      ...project,
      floors: project.floors.map((floor) =>
        floor.id !== event.floorId
          ? floor
          : { ...floor, units: floor.units.filter((unit) => unit.id !== event.unitId) }
      ),
    };
  });
}
