import { productCodes } from '../api/client';
import { useApiRequest } from './useApiRequest';

/** HSN code + product category per item sold. `needsCode` limits the list to items still blank. */
export function useProductCodes(needsCode) {
  return useApiRequest(() => productCodes.list({ needsCode }), [needsCode]);
}
