import { useState } from 'react';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useCustomerDetails } from '../hooks/useCustomerDetails';
import { useAuth } from '../contexts/AuthContext';
import { customerDetails as api } from '../api/client';

const LABELS = { tin: 'TIN', city: 'city', state: 'state', lga: 'LGA code' };

/**
 * Buyer details your accounting software does not hold. A customer appears here the first
 * time an invoice for them arrives. Grey hints show what the accounting software supplied;
 * anything you type replaces it for every invoice to that customer. Invoices
 * stopped for a missing detail can then be retried from the Invoices page.
 */
export default function CustomerDetails() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const [onlyMissing, setOnlyMissing] = useState(true);
  const { data: rows, loading, error, refetch } = useCustomerDetails(onlyMissing);
  const [drafts, setDrafts] = useState({});
  const [rowError, setRowError] = useState({});
  const [saving, setSaving] = useState(null);

  const value = (row, f) => drafts[row.id]?.[f] ?? row[f] ?? '';
  const changed = (row) => Object.entries(drafts[row.id] || {}).some(([f, v]) => (v ?? '') !== (row[f] ?? ''));
  const edit = (row, f) => (e) => setDrafts((d) => ({ ...d, [row.id]: { ...d[row.id], [f]: e.target.value } }));

  async function save(row) {
    setSaving(row.id);
    setRowError((r) => ({ ...r, [row.id]: '' }));
    try {
      await api.update(row.id, drafts[row.id]);
      setDrafts((d) => { const n = { ...d }; delete n[row.id]; return n; });
      refetch();
    } catch (err) {
      setRowError((r) => ({ ...r, [row.id]: err.message }));
    } finally {
      setSaving(null);
    }
  }

  const input = (f, width, placeholderFallback) => (r) => (
    <input
      className="field-input"
      style={{ width }}
      disabled={!canManage}
      value={value(r, f)}
      placeholder={r.observed?.[f] || placeholderFallback || ''}
      onChange={edit(r, f)}
      aria-label={f}
    />
  );

  return (
    <Layout title="Customer details">
      <div className="page-section">
        <div className="page-section-header">
          <h2>Buyer details for NRS</h2>
          <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            Only customers still missing something
          </label>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', marginTop: 0 }}>
          Customers appear here when their first invoice arrives. Grey text is what the accounting software supplied; what you type
          replaces it for every invoice to that customer. Then retry the invoices that were stopped.
        </p>

        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="page-loading">Loading customers…</div>
        ) : (
          <DataTable
            rows={rows}
            emptyMessage={onlyMissing ? 'No customer is missing a detail.' : 'No customers yet. They appear once invoices arrive.'}
            columns={[
              {
                key: 'name',
                label: 'Customer',
                render: (r) => (
                  <div>
                    <div>{r.name}</div>
                    {r.missing.length > 0 && (
                      <span className="chip chip-pending">needs {r.missing.map((f) => LABELS[f] || f).join(', ')}</span>
                    )}
                    {canManage && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <button type="button" className="btn btn-primary" disabled={!changed(r) || saving === r.id} onClick={() => save(r)}>
                          {saving === r.id ? 'Saving…' : 'Save'}
                        </button>
                        {rowError[r.id] && <div className="error-banner" style={{ marginTop: 'var(--space-2)' }}>{rowError[r.id]}</div>}
                      </div>
                    )}
                  </div>
                ),
              },
              { key: 'tin', label: 'TIN', render: input('tin', 115) },
              { key: 'email', label: 'Email', render: input('email', 170, 'name@company.com') },
              { key: 'phone', label: 'Phone', render: input('phone', 125, '+2348012345678') },
              { key: 'street', label: 'Street', render: input('street', 130) },
              { key: 'city', label: 'City', render: input('city', 90) },
              { key: 'state', label: 'State', render: input('state', 90, 'Lagos or NG-LA') },
              { key: 'lga', label: 'LGA code', render: input('lga', 100, 'NG-LA-IKJ') },
              { key: 'postalZone', label: 'Postal zone', render: input('postalZone', 80) },
            ]}
          />
        )}
      </div>
    </Layout>
  );
}
