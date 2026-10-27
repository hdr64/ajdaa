import { useEffect, useRef } from 'react';
import type { Property } from '../types/property';
import type { UnitRemovedEvent, UnitStatusEvent } from '../services/propertyService';
import { acquireSocket, releaseSocket } from '../services/realtimeSocket';
import { detectProjectStatus } from '../data/properties';

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
 * and automatically recalculates the project's booking status from its units.
 */
export function applyUnitStatus(projects: Property[], event: UnitStatusEvent): Property[] {
  return projects.map((project) => {
    if (!project.floors?.some((floor) => floor.id === event.floorId)) return project;

    const nextFloors = project.floors.map((floor) =>
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
    );
    const autoStatus = detectProjectStatus({ floors: nextFloors, priceType: project.priceType });
    return {
      ...project,
      status: autoStatus.statusAr,
      statusEn: autoStatus.statusEn,
      floors: nextFloors,
    };
  });
}

export function removeUnit(projects: Property[], event: UnitRemovedEvent): Property[] {
  return projects.map((project) => {
    if (!project.floors?.some((floor) => floor.id === event.floorId)) return project;

    const nextFloors = project.floors.map((floor) =>
      floor.id !== event.floorId
        ? floor
        : { ...floor, units: floor.units.filter((unit) => unit.id !== event.unitId) }
    );
    const autoStatus = detectProjectStatus({ floors: nextFloors, priceType: project.priceType });
    return {
      ...project,
      status: autoStatus.statusAr,
      statusEn: autoStatus.statusEn,
      floors: nextFloors,
    };
  });
}
