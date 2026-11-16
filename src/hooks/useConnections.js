import { connections } from '../api/client';
import { useApiRequest } from './useApiRequest';

/** The accounting-software connections that send invoices here (ADMIN only). */
export function useConnections() {
  return useApiRequest(() => connections.list(), []);
}
