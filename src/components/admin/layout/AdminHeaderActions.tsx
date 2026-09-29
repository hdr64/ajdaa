import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { HeaderActionsSlotContext } from '../../../pages/admin/adminContextDef';

/**
 * Renders its children into the page header's action area, so each section owns
 * its primary action ("new project", "new category"...) without the layout
 * having to know about it.
 */
export const AdminHeaderActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const slot = useContext(HeaderActionsSlotContext);
  if (!slot) return null;
  return createPortal(children, slot);
};
