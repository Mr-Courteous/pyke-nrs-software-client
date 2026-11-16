import { useState } from 'react';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useConnections } from '../hooks/useConnections';
import { useBusinesses } from '../hooks/useBusinesses';
import { connections as connectionsApi } from '../api/client';

const TYPES = [
  { value: 'quickbooks-desktop', label: 'QuickBooks Desktop' },
  { value: 'sage300', label: 'Sage 300' },
  { value: 'sage200', label: 'Sage 200 (Evolution)' },
  { value: 'canonical', label: 'Standard format (any other system)' },
];
const typeLabel = (v) => TYPES.find((t) => t.value === v)?.label || v;
const when = (iso) => (iso ? new Date(iso).toLocaleString() : 'never');

const FIELD_MAP_EXAMPLE = `{
  "sourceRef": "InvoiceUniquifier",
  "invoiceNumber": "DocumentNumber",
  "issueDate": "InvoiceDate",
  "buyer": { "ref": "CustomerNumber", "name": "CustomerName", "tin": "CustomerTin" },
  "itemsPath": "Details",
  "item": { "description": "ItemDescription", "productRef": "ItemNumber", "quantity": "Qty", "unitPrice": "Price" },
  "tax": { "ratePath": "TaxRate", "totalPath": "TaxTotal" }
}`;

/**
 * One connection per accounting-software installation. Its key is shown once, when it is made, and goes into
 * the connector that runs next to the accounting software.
 */
export default function Connections() {
  const { data: rows, loading, error, refetch } = useConnections();
  const { data: companies } = useBusinesses();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null); // the new connection, with its one-time key
  const [problem, setProblem] = useState('');

  async function downloadQwc(c) {
    setProblem('');
    try { await connectionsApi.downloadQwc(c.id); } catch (err) { setProblem(err.message); }
  }

  async function toggle(c) {
    setProblem('');
    try { await connectionsApi.update(c.id, { active: !c.active }); refetch(); } catch (err) { setProblem(err.message); }
  }

  return (
    <Layout title="Connections">
      <div className="page-section">
        <div className="page-section-header">
          <h2>Accounting software connections</h2>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>+ New connection</button>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', marginTop: 0 }}>
          Each accounting-software installation sends its invoices here with its own key. If a connection is tied to a company, every invoice
          it sends gets that company’s IRN and QR automatically.
        </p>
        {error && <div className="error-banner">{error}</div>}
        {problem && <div className="error-banner">{problem}</div>}
        {loading && !rows ? <div className="page-loading">Loading…</div> : (
          <DataTable
            rows={rows || []}
            emptyMessage="No connections yet. Make one for each accounting-software installation."
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'sourceType', label: 'Software', render: (c) => typeLabel(c.sourceType) },
              { key: 'company', label: 'Company', render: (c) => c.business?.name || 'chosen on each invoice' },
              { key: 'keyPrefix', label: 'Key', render: (c) => <span className="mono">{c.keyPrefix}…</span> },
              { key: 'lastInvoiceAt', label: 'Last invoice', render: (c) => when(c.lastInvoiceAt) },
              { key: 'lastSeenAt', label: 'Last contact', render: (c) => when(c.lastSeenAt) },
              {
                key: 'setup', label: 'Setup',
                render: (c) => c.sourceType === 'quickbooks-desktop' ? (
                  <button type="button" className="btn btn-secondary" onClick={() => downloadQwc(c)}>Setup file (.qwc)</button>
                ) : '—',
              },
              {
                key: 'active', label: 'Status',
                render: (c) => (
                  <button type="button" className={`chip ${c.active ? 'chip-positive' : 'chip-negative'}`} onClick={() => toggle(c)} title="Click to switch on or off">
                    {c.active ? 'ON' : 'OFF'}
                  </button>
                ),
              },
            ]}
          />
        )}
      </div>

      {creating && (
        <Modal title="New connection" onClose={() => setCreating(false)}>
          <NewConnection companies={(companies || []).filter((c) => c.active !== false)} onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); setCreated(c); refetch(); }} />
        </Modal>
      )}
      {created && (
        <Modal title="Copy the key now" onClose={() => setCreated(null)}>
          <KeyShown connection={created} />
        </Modal>
      )}
    </Layout>
  );
}

function NewConnection({ companies, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', sourceType: 'quickbooks-desktop', businessId: '', fieldMap: '', syncFrom: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const needsMap = form.sourceType === 'sage300' || form.sourceType === 'sage200';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    let fieldMap;
    if (needsMap && form.fieldMap.trim()) {
      try { fieldMap = JSON.parse(form.fieldMap); } catch { setErr('The field map is not valid JSON.'); return; }
    }
    setBusy(true);
    try {
      onCreated(await connectionsApi.create({ name: form.name, sourceType: form.sourceType, businessId: form.businessId || null, fieldMap, syncFrom: form.sourceType === 'quickbooks-desktop' && form.syncFrom ? form.syncFrom : undefined }));
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <form className="modal-form" onSubmit={submit}>
      {err && <div className="error-banner">{err}</div>}
      <label className="field-label" htmlFor="cn-name">Name</label>
      <input id="cn-name" className="field-input" value={form.name} onChange={set('name')} placeholder="Sage 300, head office" required />
      <label className="field-label" htmlFor="cn-type">Accounting software</label>
      <select id="cn-type" className="field-input" value={form.sourceType} onChange={set('sourceType')}>
        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <label className="field-label" htmlFor="cn-co">Company its invoices are issued for (optional)</label>
      <select id="cn-co" className="field-input" value={form.businessId} onChange={set('businessId')}>
        <option value="">Choose on each invoice</option>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {form.sourceType === 'quickbooks-desktop' && (
        <>
          <label className="field-label" htmlFor="cn-from">Collect invoices changed from (optional)</label>
          <input id="cn-from" type="date" className="field-input" value={form.syncFrom} onChange={set('syncFrom')} />
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', margin: 0 }}>
            Leave empty to collect only from now on, so old history is not swept in.
          </p>
        </>
      )}
      {needsMap && (
        <>
          <label className="field-label" htmlFor="cn-map">Field map (optional for now)</label>
          <textarea id="cn-map" className="field-input mono" rows={9} value={form.fieldMap} onChange={set('fieldMap')} placeholder={FIELD_MAP_EXAMPLE} spellCheck={false} />
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', margin: 0 }}>
            Says where each standard field sits in this system’s own invoice JSON. Leave it empty until you have a real sample; it can be added later.
          </p>
        </>
      )}
      <div className="modal-form-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Working…' : 'Create connection'}</button>
      </div>
    </form>
  );
}

function KeyShown({ connection }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(connection.key); setCopied(true); } catch { /* the key is also shown below */ } };
  return (
    <div>
      <p style={{ marginTop: 0 }}>
        This is the key for <strong>{connection.name}</strong>. It is shown <strong>only now</strong> and cannot be read again. If it is lost, make a new connection.
      </p>
      <pre className="mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{connection.key}</pre>
      <button type="button" className="btn btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy key'}</button>
      {connection.sourceType === 'quickbooks-desktop' ? (
        <ol style={{ fontSize: 'var(--text-sm)' }}>
          <li>Press <strong>Setup file (.qwc)</strong> on this connection and take the file to the office PC.</li>
          <li>On that PC, open <strong>QuickBooks Web Connector</strong>, choose <strong>Add an application</strong> and pick the file.</li>
          <li>QuickBooks asks you to allow it: choose <strong>Yes, always</strong> so it can run without anyone present.</li>
          <li>Type the key above as the password, tick the application and press <strong>Update Selected</strong>.</li>
        </ol>
      ) : (
        <p style={{ fontSize: 'var(--text-sm)' }}>The connector sends each invoice to <span className="mono">POST &lt;this app’s address&gt;/api/ingest</span> with the header <span className="mono">X-Connector-Key: &lt;the key&gt;</span>.</p>
      )}
    </div>
  );
}
