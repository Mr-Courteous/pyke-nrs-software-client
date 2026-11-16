import { useState } from 'react';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useProductCodes } from '../hooks/useProductCodes';
import { useAuth } from '../contexts/AuthContext';
import { productCodes as productCodesApi } from '../api/client';

/**
 * NRS needs an HSN code and a product category on every invoice line, and
 * your accounting software has no field for them. Items appear here automatically the first
 * time an invoice containing them arrives. Fill each one in once; every later
 * invoice for that item picks it up. Invoices that were stopped for a missing
 * code can then be retried from the Invoices page.
 */
export default function ProductCodes() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const [onlyBlank, setOnlyBlank] = useState(true);
  const { data: rows, loading, error, refetch } = useProductCodes(onlyBlank);
  const [drafts, setDrafts] = useState({}); // id -> { hsnCode, productCategory }
  const [rowError, setRowError] = useState({});
  const [saving, setSaving] = useState(null);

  const value = (row, field) => drafts[row.id]?.[field] ?? row[field] ?? '';
  const changed = (row) => {
    const d = drafts[row.id];
    return !!d && ((d.hsnCode ?? row.hsnCode ?? '') !== (row.hsnCode ?? '') || (d.productCategory ?? row.productCategory ?? '') !== (row.productCategory ?? ''));
  };
  const edit = (row, field) => (e) => setDrafts((d) => ({ ...d, [row.id]: { ...d[row.id], [field]: e.target.value } }));

  async function save(row) {
    setSaving(row.id);
    setRowError((r) => ({ ...r, [row.id]: '' }));
    try {
      await productCodesApi.update(row.id, { hsnCode: value(row, 'hsnCode'), productCategory: value(row, 'productCategory') });
      setDrafts((d) => { const n = { ...d }; delete n[row.id]; return n; });
      refetch();
    } catch (err) {
      setRowError((r) => ({ ...r, [row.id]: err.message }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Layout title="Product codes">
      <div className="page-section">
        <div className="page-section-header">
          <h2>HSN codes for the items you sell</h2>
          <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={onlyBlank} onChange={(e) => setOnlyBlank(e.target.checked)} />
            Only items that still need a code
          </label>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', marginTop: 0 }}>
          NRS requires an HSN code and a product category on every invoice line. New items appear here when an invoice
          containing them arrives. Fill each one in once, then retry the invoices that were stopped.
        </p>

        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="page-loading">Loading items…</div>
        ) : (
          <DataTable
            rows={rows}
            emptyMessage={onlyBlank ? 'Every item seen so far has a code.' : 'No items yet. They appear once invoices arrive.'}
            columns={[
              { key: 'name', label: 'Item' },
              {
                key: 'hsnCode',
                label: 'HSN code',
                render: (r) => (
                  <input className="field-input mono" style={{ width: 130 }} disabled={!canManage} value={value(r, 'hsnCode')} placeholder="2523.29" onChange={edit(r, 'hsnCode')} />
                ),
              },
              {
                key: 'productCategory',
                label: 'Product category',
                render: (r) => (
                  <input className="field-input" style={{ width: 260 }} disabled={!canManage} value={value(r, 'productCategory')} placeholder="e.g. Cements" onChange={edit(r, 'productCategory')} />
                ),
              },
              {
                key: 'save',
                label: '',
                render: (r) => canManage && (
                  <>
                    <button type="button" className="btn btn-primary" disabled={!changed(r) || saving === r.id} onClick={() => save(r)}>
                      {saving === r.id ? 'Saving…' : 'Save'}
                    </button>
                    {rowError[r.id] && <div className="error-banner" style={{ marginTop: 'var(--space-2)' }}>{rowError[r.id]}</div>}
                  </>
                ),
              },
            ]}
          />
        )}
      </div>
    </Layout>
  );
}
