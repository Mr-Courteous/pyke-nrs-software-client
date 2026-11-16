import { businesses } from '../api/client';
import { useApiRequest } from './useApiRequest';

/** Companies (NRS businesses) invoices can be issued for. */
export function useBusinesses() {
  return useApiRequest(() => businesses.list(), []);
}
