import { customerDetails } from '../api/client';
import { useApiRequest } from './useApiRequest';

/** Buyer details per customer. `needsDetails` limits the list to customers still missing something. */
export function useCustomerDetails(needsDetails) {
  return useApiRequest(() => customerDetails.list({ needsDetails }), [needsDetails]);
}
