import { createContext, useContext } from 'react';
import type { CatalogState } from './types';

export const CatalogContext = createContext<CatalogState | null>(null);

export function useCatalog(): CatalogState {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider');
  return value;
}
