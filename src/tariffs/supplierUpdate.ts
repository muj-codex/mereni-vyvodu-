import type { SupplierUpdate, PriceList } from './model';

// Individual-card transitions for future source adapters. No I/O, timers or fabricated dates.
export type SupplierUpdateAction =
  | { type: 'placeholder' }
  | { type: 'start' }
  | { type: 'success'; validFrom: string | null; lastChecked: string; priceList?: PriceList }
  | { type: 'error'; message: string };
export function supplierUpdateReducer(
  state: SupplierUpdate,
  action: SupplierUpdateAction,
): SupplierUpdate {
  switch (action.type) {
    case 'placeholder':
      return { ...state, message: 'Aktualizace ceníku bude doplněna v další etapě.' };
    case 'start':
      return { ...state, status: 'updating', error: null, message: '' };
    case 'success':
      return {
        status: 'success',
        validFrom: action.validFrom,
        lastChecked: action.lastChecked,
        sourceStatus: 'verified',
        error: null,
        message: '',
        lastValidPriceList: action.priceList ?? state.lastValidPriceList,
      };
    case 'error':
      return {
        ...state,
        status: 'error',
        sourceStatus: 'unavailable',
        error: action.message,
        message: '',
      };
  }
}
