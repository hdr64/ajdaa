import { useContext } from 'react';
import { CmsContext } from '../context/cmsContextDef';
import type { CmsContextType } from '../context/cmsContextDef';

/** The database-backed copy for every public page, plus its fetch lifecycle. */
export const useCmsContent = (): CmsContextType => useContext(CmsContext);
