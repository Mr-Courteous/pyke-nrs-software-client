import { useState } from 'react';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useBusinesses } from '../hooks/useBusinesses';
import { useAuth } from '../contexts/AuthContext';
import { businesses as businessesApi } from '../api/client';


/**
 * The companies invoices are issued for. Each is entered here with what NRS issued it: its TIN, its
 * Service ID (the fixed middle part of its IRNs) and its cryptographic keys from the NRS portal.
 */
export default function Companies() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const { data: companies, loading, error, refetch } = useBusinesses();
  const [editing, setEditing] = useState(null); // null | 'new' | company
  return (
    <Layout title="Companies">
      <div className="page-section">
        <div className="page-section-header">
          <h2>Companies invoices are issued for</h2>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              + Add company
            </button>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div className="page-loading">Loading companies…</div>
        ) : (
          <DataTable
            rows={companies}
            emptyMessage="No companies yet. Add the first one, with the Service ID and keys NRS gave it."
            onRowClick={canManage ? (c) => setEditing(c) : undefined}
            columns={[
              { key: 'name', label: 'Company' },
              { key: 'tin', label: 'TIN', render: (c) => c.tin || '—' },
              {
                key: 'serviceId',
                label: 'Service ID',
                render: (c) =>
                  c.hasServiceId ? (
                    <span className="chip chip-positive mono">{c.irnSuffix}</span>
                  ) : (
                    <span className="chip chip-pending">MISSING</span>
                  ),
              },
              {
                key: 'hasKeys',
                label: 'NRS keys',
                render: (c) =>
                  c.hasKeys ? (
                    <span className="chip chip-positive" title={`Fingerprint ${c.keyFingerprint}`}>ON FILE</span>
                  ) : (
                    <span className="chip chip-pending">MISSING</span>
                  ),
              },
              { key: 'invoiceCount', label: 'Invoices', align: 'right', render: (c) => c.invoiceCount ?? 0 },
              { key: 'readyCount', label: 'With IRN and QR', align: 'right', render: (c) => c.readyCount ?? 0 },
            ]}
          />
        )}
      </div>

      {editing && (
        <CompanyModal
          company={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}
    </Layout>
  );
}

function CompanyModal({ company, onClose, onSaved }) {
  const isNrs = false; // every company is entered by hand here
  const [form, setForm] = useState({
    name: company?.name || '',
    tin: company?.tin || '',
    nrsBusinessId: company?.nrsBusinessId || '',
    irnSuffix: company?.irnSuffix || '',
    address: company?.address || '',
    email: company?.email || '',
    phone: company?.phone || '',
    city: company?.city || '',
    postalZone: company?.postalZone || '',
    state: company?.state || '',
    lga: company?.lga || '',
    cryptoKeys: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.cryptoKeys.trim()) delete payload.cryptoKeys; // blank = keep the keys already on file
            if (company) await businessesApi.update(company.id, payload);
      else await businessesApi.create(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={company ? 'Edit company' : 'Add company'} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      {!company && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', marginTop: 0 }}>
          Enter what NRS issued this business. The Service ID goes into every IRN, and the keys sign them.
        </p>
      )}
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-form-row">
          <div>
            <label className="field-label" htmlFor="co-name">Company name</label>
            <input id="co-name" required className="field-input" value={form.name} onChange={update('name')} disabled={isNrs} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-tin">TIN</label>
            <input id="co-tin" className="field-input" value={form.tin} onChange={update('tin')} disabled={isNrs} />
          </div>
        </div>
        <div className="modal-form-row">
          <div>
            <label className="field-label" htmlFor="co-nrsid">NRS Business ID</label>
            <input id="co-nrsid" className="field-input mono" value={form.nrsBusinessId} onChange={update('nrsBusinessId')} disabled={isNrs} placeholder="The ID NRS issued for this business" />
          </div>
          <div>
            <label className="field-label" htmlFor="co-sid">Service ID (up to 8 characters)</label>
            <input id="co-sid" className="field-input mono" maxLength={8} value={form.irnSuffix} onChange={update('irnSuffix')} disabled={isNrs} placeholder="e.g. 94ND90NR" />
          </div>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', margin: '0 0 var(--space-3)' }}>
          The Service ID (8 characters, for example 94ND90NR) is needed to make IRNs. The Business ID is only needed later, for sending.
        </p>
        <div className="modal-form-row">
          <div>
            <label className="field-label" htmlFor="co-address">Address (printed on its invoices)</label>
            <input id="co-address" className="field-input" value={form.address} onChange={update('address')} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-email">Email (printed on its invoices)</label>
            <input id="co-email" type="email" className="field-input" value={form.email} onChange={update('email')} />
          </div>
        </div>
        <div className="modal-form-row">
          <div>
            <label className="field-label" htmlFor="co-city">City</label>
            <input id="co-city" className="field-input" value={form.city} onChange={update('city')} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-postal">Postal zone</label>
            <input id="co-postal" className="field-input" value={form.postalZone} onChange={update('postalZone')} />
          </div>
        </div>
        <div className="modal-form-row">
          <div>
            <label className="field-label" htmlFor="co-state">State</label>
            <input id="co-state" className="field-input" placeholder="Lagos or NG-LA" value={form.state} onChange={update('state')} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-lga">LGA code</label>
            <input id="co-lga" className="field-input" placeholder="NG-LA-IKJ" value={form.lga} onChange={update('lga')} />
          </div>
        </div>
        <div className="modal-form-row">
          <div>
            <label className="field-label" htmlFor="co-phone">Phone</label>
            <input id="co-phone" className="field-input" value={form.phone} onChange={update('phone')} />
          </div>
          <div />
        </div>
        <div>
          <label className="field-label" htmlFor="co-keys">NRS crypto_keys.txt</label>
          <textarea
            id="co-keys"
            className="field-input mono"
            rows={5}
            value={form.cryptoKeys}
            onChange={update('cryptoKeys')}
            placeholder={'Paste the whole file from the NRS portal (My Account, Manage Cryptographic Keys). It starts with {"public_key": …'}
          />
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', margin: 'var(--space-1) 0 0' }}>
            {company?.hasKeys
              ? `Keys are on file (fingerprint ${company.keyFingerprint}). Paste a new file only to replace them.`
              : 'Needed to sign this company’s invoices. Only the public key and certificate are stored; the private key stays with NRS.'}
          </p>
        </div>
        <div className="modal-form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
