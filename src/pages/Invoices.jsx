import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import StatusChip from '../components/StatusChip';
import Modal from '../components/Modal';
import { useInvoices } from '../hooks/useInvoices';
import { useBusinesses } from '../hooks/useBusinesses';
import { useAuth } from '../contexts/AuthContext';
import { invoices as invoicesApi } from '../api/client';
import { formatMoney } from '../utils/format';

const RETRYABLE = ['REJECTED', 'ERROR'];
const NO_COMPANY = '__none__';

const invoiceNumberOf = (inv) => inv.mapped?.invoiceMeta?.invoiceNumber || inv.raw?.invoiceNumber || inv.id.slice(0, 8);
const problemOf = (inv) => (Array.isArray(inv.errors) && inv.errors.join(' · ')) || inv.errorMessage || '';

const SOURCE_LABEL = { 'quickbooks-desktop': 'QuickBooks Desktop', sage300: 'Sage 300', sage200: 'Sage 200 (Evolution)', 'manual-upload': 'Typed in', canonical: 'Standard' };

/** Says what an invoice that is not READY is waiting for. */
function InvoiceStatus({ inv }) {
  if (inv.status === 'VALIDATED' && !inv.business) return <span className="chip chip-pending">AWAITING COMPANY</span>;
  return <StatusChip status={inv.status} />;
}

const EXAMPLE = `{
  "invoiceNumber": "INV0001",
  "issueDate": "2026-11-09",
  "currency": "NGN",
  "vatRate": 7.5,
  "buyer": {
    "name": "Sample Buyer Ltd",
    "tin": "98765432-0001",
    "email": "accounts@samplebuyer.example",
    "street": "12 Sample Avenue",
    "city": "Ikeja",
    "state": "NG-LA",
    "lga": "NG-LA-IKJ",
    "postalZone": "100271"
  },
  "items": [
    { "description": "Cement, 50kg bag", "quantity": 10, "unitPrice": 5500 }
  ]
}`;

export default function Invoices() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const { data: invoices, loading, error, refetch } = useInvoices();
  const { data: companies } = useBusinesses();
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [companyFilter, setCompanyFilter] = useState('ALL'); // ALL | UNASSIGNED | <company id>
  const [checked, setChecked] = useState(() => new Set());
  const [assignTo, setAssignTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { ok, text }

  const selected = invoices?.find((i) => i.id === selectedId);
  const activeCompanies = (companies || []).filter((c) => c.active !== false);

  const visible = useMemo(
    () =>
      (invoices || []).filter((inv) => {
        if (companyFilter === 'ALL') return true;
        if (companyFilter === 'UNASSIGNED') return !inv.businessId;
        return inv.businessId === companyFilter;
      }),
    [invoices, companyFilter]
  );
  // Only invoices that are ticked AND visible are acted on, so nothing hidden by a filter is touched by accident.
  const checkedVisible = visible.filter((inv) => checked.has(inv.id));
  const allChecked = visible.length > 0 && checkedVisible.length === visible.length;

  const toggleOne = (id) => setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setChecked((prev) => { const n = new Set(prev); visible.forEach((i) => (allChecked ? n.delete(i.id) : n.add(i.id))); return n; });

  async function handleAssign() {
    if (!assignTo || checkedVisible.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const { results } = await invoicesApi.assignBusiness(checkedVisible.map((i) => i.id), assignTo === NO_COMPANY ? null : assignTo);
      const ok = results.filter((r) => r.ok && r.status === 'READY').length;
      const problems = results.filter((r) => !r.ok || r.status !== 'READY');
      setNotice({
        ok: problems.length === 0,
        text: `${ok} invoice${ok === 1 ? '' : 's'} now have an IRN and QR.` + (problems.length ? ` ${problems.length} did not: open them to see why.` : ''),
      });
      setChecked(new Set());
      refetch();
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: 'pick',
      label: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all shown" />,
      render: (inv) => <input type="checkbox" checked={checked.has(inv.id)} onChange={() => toggleOne(inv.id)} onClick={(e) => e.stopPropagation()} aria-label="Select invoice" />,
    },
    { key: 'num', label: 'Invoice', render: (inv) => invoiceNumberOf(inv) },
    { key: 'src', label: 'From', render: (inv) => SOURCE_LABEL[inv.sourceSystem] || inv.sourceSystem },
    { key: 'buyer', label: 'Buyer', render: (inv) => inv.mapped?.buyer?.name || inv.raw?.buyer?.name || inv.raw?.buyerName || '—' },
    { key: 'total', label: 'Total', align: 'right', render: (inv) => (inv.mapped?.totals ? formatMoney(inv.mapped.totals.grandTotal, inv.mapped.invoiceMeta?.currency) : '—') },
    { key: 'co', label: 'Company', render: (inv) => inv.business?.name || '—' },
    { key: 'irn', label: 'IRN', render: (inv) => <span className="mono" style={{ fontSize: 'var(--text-sm)' }}>{inv.irn || '—'}</span> },
    { key: 'status', label: 'Status', render: (inv) => <InvoiceStatus inv={inv} /> },
  ];

  return (
    <Layout title="Invoices">
      <div className="page-section">
        <div className="page-section-header">
          <h2>Invoices from your accounting software</h2>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>+ Type in an invoice</button>
          )}
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', marginTop: 0 }}>
          Invoices arrive from your connections, get their buyer details and product codes, and stop here with an IRN and a QR code once a company is
          assigned. Nothing is sent to NRS from this app.
        </p>

        {error && <div className="error-banner">{error}</div>}
        {notice && (
          <div className={notice.ok ? undefined : 'error-banner'} style={notice.ok ? { background: 'var(--ledger-green-tint)', color: 'var(--ledger-green)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' } : undefined}>
            {notice.text}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <label style={{ fontSize: 'var(--text-sm)' }}>
            Show{' '}
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="ALL">All invoices</option>
              <option value="UNASSIGNED">Waiting for a company</option>
              {activeCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {canManage && checkedVisible.length > 0 && (
            <>
              <span style={{ fontSize: 'var(--text-sm)' }}>{checkedVisible.length} selected:</span>
              <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">Choose a company…</option>
                {activeCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value={NO_COMPANY}>— none (clear IRN and QR) —</option>
              </select>
              <button type="button" className="btn btn-secondary" disabled={!assignTo || busy} onClick={handleAssign}>
                {busy ? 'Working…' : 'Assign company'}
              </button>
            </>
          )}
        </div>

        {loading && !invoices ? <div className="page-loading">Loading…</div> : (
          <DataTable columns={columns} rows={visible} onRowClick={(inv) => setSelectedId(inv.id)} emptyMessage="No invoices yet. They appear here when a connection sends one." />
        )}
      </div>

      {selected && (
        <Modal title={`Invoice ${invoiceNumberOf(selected)}`} onClose={() => setSelectedId(null)}>
          <InvoiceDetail invoice={selected} companies={activeCompanies} canManage={canManage} onChanged={refetch} />
        </Modal>
      )}
      {showNew && (
        <Modal title="Type in an invoice" onClose={() => setShowNew(false)}>
          <NewInvoice companies={activeCompanies} onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); refetch(); setSelectedId(id); }} />
        </Modal>
      )}
    </Layout>
  );
}

function InvoiceDetail({ invoice, companies, canManage, onChanged }) {
  const [companyId, setCompanyId] = useState(invoice.businessId || NO_COMPANY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const m = invoice.mapped;
  const problem = problemOf(invoice);
  const warnings = Array.isArray(m?.warnings) ? m.warnings : [];

  async function run(fn) {
    setBusy(true);
    setMessage('');
    try { await fn(); onChanged(); } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  }

  const saveCompany = () => run(async () => {
    const { results } = await invoicesApi.assignBusiness([invoice.id], companyId === NO_COMPANY ? null : companyId);
    if (!results[0].ok) throw new Error(results[0].error);
  });

  const copyQr = async () => {
    try { await navigator.clipboard.writeText(invoice.qr.payload); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setMessage('Could not copy. Open "Show the QR text" and copy it by hand.'); }
  };

  return (
    <div>
      <p><InvoiceStatus inv={invoice} /> <span style={{ fontSize: 'var(--text-sm)' }}>from {SOURCE_LABEL[invoice.sourceSystem] || invoice.sourceSystem}</span></p>

      {problem && <div className="error-banner">{problem}</div>}
      {message && <div className="error-banner">{message}</div>}
      {warnings.length > 0 && (
        <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          <strong>Worth a look:</strong>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {m && (
        <table className="data-table" style={{ marginBottom: 'var(--space-4)' }}>
          <tbody>
            <tr><td>Buyer</td><td>{m.buyer?.name}{m.buyer?.tin ? ` (TIN ${m.buyer.tin})` : ''}</td></tr>
            <tr><td>Issued</td><td>{m.invoiceMeta?.issueDate}</td></tr>
            <tr><td>Before tax</td><td>{formatMoney(m.totals?.subtotal, m.invoiceMeta?.currency)}</td></tr>
            <tr><td>Tax</td><td>{formatMoney(m.totals?.taxTotal, m.invoiceMeta?.currency)}</td></tr>
            <tr><td>Total</td><td><strong>{formatMoney(m.totals?.grandTotal, m.invoiceMeta?.currency)}</strong></td></tr>
            <tr><td>Items</td><td>{(m.lineItems?.items || []).map((i) => `${i.quantity} × ${i.description}`).join('; ')}</td></tr>
          </tbody>
        </table>
      )}

      {canManage && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <label style={{ fontSize: 'var(--text-sm)' }}>
            Company{' '}
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value={NO_COMPANY}>— none —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={saveCompany} title="Builds the IRN, signs it and makes the QR from the company's and buyer's current details">
            Save company
          </button>
          {RETRYABLE.includes(invoice.status) && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(() => invoicesApi.retry(invoice.id))}>
              Retry
            </button>
          )}
        </div>
      )}

      {invoice.irn && (
        <p className="mono" style={{ fontSize: 'var(--text-sm)' }}>IRN: {invoice.irn}</p>
      )}

      {invoice.qr?.dataUrl && (
        <div>
          {/* The QR holds the encrypted IRN (about 344 characters), so it is shown large enough to scan. */}
          <img src={invoice.qr.dataUrl} width={220} height={220} alt="Invoice QR code" />
          <div style={{ fontSize: 'var(--text-sm)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <a href={invoice.qr.dataUrl} download={`${invoice.irn || 'invoice'}.png`}>Download QR</a>
            {invoice.qr.payload && (
              <>
                <button type="button" className="btn btn-secondary" onClick={copyQr}>{copied ? 'Copied' : 'Copy QR text'}</button>
                <span>{invoice.qr.payload.length} characters</span>
              </>
            )}
          </div>
          {invoice.qr.payload && (
            <details style={{ marginTop: 'var(--space-2)' }}>
              <summary>Show the QR text</summary>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 'var(--text-sm)' }}>{invoice.qr.payload}</pre>
            </details>
          )}
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
            The QR is rebuilt (new timestamp, same IRN) each time the company is saved or the invoice is retried, so print the latest one.
          </p>
        </div>
      )}
    </div>
  );
}

function NewInvoice({ companies, onClose, onCreated }) {
  const [text, setText] = useState(EXAMPLE);
  const [companyId, setCompanyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    let body;
    try { body = JSON.parse(text); } catch { setErr('That is not valid JSON. Check the commas and quotes.'); return; }
    setBusy(true);
    try {
      const inv = await invoicesApi.createManual({ ...body, ...(companyId ? { businessId: companyId } : {}) });
      onCreated(inv.id);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <form className="modal-form" onSubmit={submit}>
      <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
        Paste an invoice in the standard shape (an example is filled in). Its supplier comes from the company you choose, and its HSN codes
        from the Product codes page.
      </p>
      {err && <div className="error-banner">{err}</div>}
      <textarea className="mono" rows={18} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} style={{ width: '100%', fontSize: 'var(--text-sm)' }} />
      <div className="modal-form-row">
        <label>
          Company (optional){' '}
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Choose later</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <div className="modal-form-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Working…' : 'Add invoice'}</button>
      </div>
    </form>
  );
}
