const TOKEN_KEY = 'mbsbridge_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Thin fetch wrapper: attaches the bearer token, parses JSON, and
 * throws with the backend's own error message on a non-2xx response
 * (every route in this API replies with { error: '...' } on failure —
 * see authMiddleware.js / the *Routes.js files) so callers can just
 * catch and show err.message.
 */
async function request(path, { method = 'GET', body, params } = {}) {
  const token = getToken();
  const baseUrl = import.meta.env.VITE_API_PROXY_TARGET || window.location.origin;
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

// ── Auth ────────────────────────────────────────────────────────────
export const auth = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  bootstrapAdmin: (email, password, name) =>
    request('/api/auth/bootstrap-admin', { method: 'POST', body: { email, password, name } }),
  me: () => request('/api/auth/me'),
  listUsers: () => request('/api/auth/users'),
  createUser: (payload) => request('/api/auth/users', { method: 'POST', body: payload }),
  setRole: (id, role) => request(`/api/auth/users/${id}/role`, { method: 'PATCH', body: { role } }),
  setActive: (id, active) => request(`/api/auth/users/${id}/active`, { method: 'PATCH', body: { active } }),
};

/** Invoices: collected from the accounting software; the app stops at the IRN and QR. */
export const invoices = {
  list: () => request('/api/invoices'),
  // Hand-entered invoice (for testing). With a companyId it also makes the IRN and QR.
  createManual: (payload) => request('/api/upload/manual', { method: 'POST', body: payload }),
  // Re-runs map, validate and (with a company) IRN, signing and QR for a REJECTED or ERROR invoice.
  retry: (id) => request(`/api/invoices/${id}/retry`, { method: 'POST' }),
  // Gives the invoices a company (or clears it with null) and makes their IRN and QR.
  assignBusiness: (invoiceIds, businessId) =>
    request('/api/invoices/assign-business', { method: 'POST', body: { invoiceIds, businessId } }),
};

export const businesses = {
  list: () => request('/api/businesses'),
  create: (payload) => request('/api/businesses', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/api/businesses/${id}`, { method: 'PATCH', body: payload }),
};

/** HSN code and category per item: what the accounting software does not hold. */
export const productCodes = {
  list: ({ needsCode } = {}) => request('/api/product-codes', { params: needsCode ? { needsCode: '1' } : undefined }),
  update: (id, payload) => request(`/api/product-codes/${id}`, { method: 'PATCH', body: payload }),
};

/** Buyer details (TIN, state, LGA ...) the accounting software does not hold. */
export const customerDetails = {
  list: ({ needsDetails } = {}) => request('/api/customer-details', { params: needsDetails ? { needsDetails: '1' } : undefined }),
  update: (id, payload) => request(`/api/customer-details/${id}`, { method: 'PATCH', body: payload }),
};

/** Connections: the keys that accounting-software connectors use to send invoices (ADMIN). */
/** Downloads the QuickBooks Web Connector setup file for a connection (the key is not in it). */
async function downloadQwc(id) {
  const token = getToken();
  const baseUrl = import.meta.env.VITE_API_PROXY_TARGET || window.location.origin;
  const res = await fetch(new URL(`/api/connections/${id}/qwc`, baseUrl).toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not download the setup file.');
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'nrs-si-collector.qwc';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export const connections = {
  downloadQwc,
  list: () => request('/api/connections'),
  // The response includes the key. It is shown once and cannot be read again.
  create: (payload) => request('/api/connections', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/api/connections/${id}`, { method: 'PATCH', body: payload }),
};
