import { useState, useEffect } from 'react';
import { User, Lock, Key, Zap, LogOut, Loader as Loader2, Check, X, Eye, EyeOff, Shield, TrendingUp, CircleAlert as AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getGstCredentials, saveGstCredentials, deleteGstCredentials, getUsage } from '../store';

export default function AccountSettings({ onClose }) {
  const { user, userProfile, signOut, updatePassword, updateDisplayName, isPro, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    getUsage().then(setUsage).catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content account-modal" onClick={e => e.stopPropagation()}>
        <div className="account-modal-header">
          <div>
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.2rem' }}>Account Settings</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{user?.email}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Plan badge + usage */}
        {usage && (
          <div className={`plan-badge-row ${isPro ? 'plan-pro' : 'plan-free'}`}>
            <div className="plan-badge-info">
              <Zap size={15} />
              <span><strong>{isPro ? 'Pro Plan' : 'Free Plan'}</strong></span>
            </div>
            {!isPro && (
              <div className="plan-usage-bar-wrap">
                <div className="plan-usage-text">
                  {usage.invoicesThisMonth} / {usage.limit} invoices this month
                </div>
                <div className="plan-usage-bar">
                  <div
                    className="plan-usage-fill"
                    style={{ width: `${Math.min(100, (usage.invoicesThisMonth / usage.limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {isPro && (
              <div className="plan-usage-text">Unlimited invoices</div>
            )}
          </div>
        )}

        <div className="account-tabs">
          {[
            { id: 'account', label: 'Account', icon: User },
            { id: 'security', label: 'Security', icon: Lock },
            ...(isPro ? [{ id: 'gst', label: 'GST API', icon: Key }] : []),
            { id: 'plan', label: 'Plan', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              className={`account-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="account-tab-content">
          {activeTab === 'account' && (
            <AccountTab
              user={user}
              userProfile={userProfile}
              updateDisplayName={updateDisplayName}
            />
          )}
          {activeTab === 'security' && (
            <SecurityTab updatePassword={updatePassword} />
          )}
          {activeTab === 'gst' && isPro && (
            <GstCredentialsTab />
          )}
          {activeTab === 'plan' && (
            <PlanTab
              isPro={isPro}
              usage={usage}
              refreshProfile={refreshProfile}
            />
          )}
        </div>

        <div className="account-modal-footer">
          <button className="btn btn-secondary" onClick={handleSignOut} style={{ color: 'var(--danger)' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountTab({ user, userProfile, updateDisplayName }) {
  const [name, setName] = useState(userProfile?.display_name || '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await updateDisplayName(name.trim());
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSave} className="account-form">
      {error && <div className="auth-error">{error}</div>}
      <div className="form-group">
        <label className="form-label">Display Name</label>
        <input
          type="text"
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Email</label>
        <input type="email" className="form-input" value={user?.email || ''} disabled />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
          Email changes are not supported. Contact support if needed.
        </p>
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
        {loading ? <Loader2 size={14} className="spin" /> : saved ? <><Check size={14} /> Saved!</> : 'Save Changes'}
      </button>
    </form>
  );
}

function SecurityTab({ updatePassword }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) { setError(error.message); return; }
    setPassword('');
    setConfirm('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form onSubmit={handleSave} className="account-form">
      {error && <div className="auth-error">{error}</div>}
      {saved && <div className="auth-success">Password updated successfully.</div>}
      <div className="form-group">
        <label className="form-label">New Password</label>
        <div className="auth-input-wrap" style={{ marginTop: 0 }}>
          <input
            type={showPw ? 'text' : 'password'}
            className="form-input auth-input-pw"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            minLength={8}
          />
          <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Confirm New Password</label>
        <input
          type={showPw ? 'text' : 'password'}
          className="form-input"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat new password"
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
        {loading ? <Loader2 size={14} className="spin" /> : saved ? <><Check size={14} /> Updated!</> : 'Update Password'}
      </button>
    </form>
  );
}

function GstCredentialsTab() {
  const [creds, setCreds] = useState(null);
  const [form, setForm] = useState({ gstin: '', username: '', password: '', appKey: '', notes: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getGstCredentials()
      .then(data => {
        setCreds(data);
        if (data) setForm(f => ({ ...f, gstin: data.gstin, username: data.username, appKey: data.app_key || '', notes: data.notes || '' }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.gstin || !form.username) { setError('GSTIN and Username are required.'); return; }
    setSaving(true);
    try {
      await saveGstCredentials(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setCreds({ gstin: form.gstin, username: form.username, app_key: form.appKey, notes: form.notes });
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Remove GST API credentials?')) return;
    await deleteGstCredentials();
    setCreds(null);
    setForm({ gstin: '', username: '', password: '', appKey: '', notes: '' });
  };

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <form onSubmit={handleSave} className="account-form">
      <div className="notice notice-info" style={{ marginBottom: '1rem' }}>
        <Shield size={15} />
        <div>
          <strong>Official GST Portal API credentials.</strong> These are used to file returns directly from the app.
          Your password is stored encrypted in the database and never exposed in the UI.
        </div>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {saved && <div className="auth-success">Credentials saved.</div>}
      <div className="form-group">
        <label className="form-label">GSTIN</label>
        <input className="form-input" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} placeholder="22AAAAA0000A1Z5" required />
      </div>
      <div className="form-group">
        <label className="form-label">GST Portal Username</label>
        <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="your_gst_username" required />
      </div>
      <div className="form-group">
        <label className="form-label">GST Portal Password {creds && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(leave blank to keep current)</span>}</label>
        <div className="auth-input-wrap" style={{ marginTop: 0 }}>
          <input
            type={showPw ? 'text' : 'password'}
            className="form-input auth-input-pw"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder={creds ? '••••••••' : 'Your GST portal password'}
            {...(!creds ? { required: true } : {})}
          />
          <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">App Key (API Key)</label>
        <input className="form-input" value={form.appKey} onChange={e => setForm(f => ({ ...f, appKey: e.target.value }))} placeholder="Optional app key from GST portal" />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. GSTIN registered address" />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
          {saving ? <Loader2 size={14} className="spin" /> : saved ? <><Check size={14} /> Saved!</> : 'Save Credentials'}
        </button>
        {creds && (
          <button type="button" className="btn btn-secondary" onClick={handleDelete} style={{ color: 'var(--danger)' }}>
            Remove
          </button>
        )}
      </div>
    </form>
  );
}

function PlanTab({ isPro, usage, refreshProfile }) {
  const FREE_LIMIT = 10;
  const usedPct = usage ? Math.min(100, (usage.invoicesThisMonth / FREE_LIMIT) * 100) : 0;

  return (
    <div className="account-form">
      <div className={`plan-card ${isPro ? 'plan-card-pro' : 'plan-card-free'}`}>
        <div className="plan-card-header">
          <Zap size={18} />
          <span>{isPro ? 'Pro Plan' : 'Free Plan'}</span>
          <span className={`plan-tag ${isPro ? 'plan-tag-pro' : 'plan-tag-free'}`}>{isPro ? 'Active' : 'Current'}</span>
        </div>
        <ul className="plan-features">
          <li><Check size={13} /> All features: GST invoices, reports, exports</li>
          <li><Check size={13} /> GSTR-1, GSTR-3B, e-Way Bill exports</li>
          <li><Check size={13} /> Multi-business profiles</li>
          <li><Check size={13} /> Backup & restore</li>
          {isPro ? (
            <>
              <li><Check size={13} /> <strong>Unlimited invoices per month</strong></li>
              <li><Check size={13} /> <strong>Official GST Portal API integration</strong></li>
            </>
          ) : (
            <>
              <li><AlertCircle size={13} style={{ color: 'var(--warn-text)' }} /> 10 invoices per month</li>
              <li><AlertCircle size={13} style={{ color: 'var(--warn-text)' }} /> GST Portal API integration (Pro only)</li>
            </>
          )}
        </ul>
        {!isPro && usage && (
          <div style={{ marginTop: '0.75rem' }}>
            <div className="plan-usage-text" style={{ marginBottom: '0.35rem' }}>
              {usage.invoicesThisMonth} / {FREE_LIMIT} invoices used this month
            </div>
            <div className="plan-usage-bar">
              <div className="plan-usage-fill" style={{ width: `${usedPct}%`, background: usedPct >= 90 ? 'var(--danger)' : undefined }} />
            </div>
          </div>
        )}
      </div>

      {!isPro && (
        <div className="plan-upgrade-box">
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Upgrade to Pro</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
            Unlimited invoices every month, plus direct GST Portal API filing integration.
          </p>
          <a
            href="mailto:Contact@dicecodes.com?subject=GST Billing Pro Upgrade"
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', justifyContent: 'center', textDecoration: 'none' }}
          >
            <Zap size={14} /> Contact Us to Upgrade
          </a>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
            Razorpay payment integration coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
