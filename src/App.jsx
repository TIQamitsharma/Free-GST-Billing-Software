import { useState, useEffect, useRef } from 'react';
import { Hop as Home, FileText, Settings, Plus, Users, Package, ChartBar as BarChart3, Wallet, RefreshCw, Receipt, BookOpen, Moon, Sun, Download, X, ShoppingCart, ChevronDown, Building2, Pencil, Circle as HelpCircle, User, Zap, LogOut } from 'lucide-react';
import { getAllProfiles, saveProfile, getEnabledModules, getUsage, getProfile } from './store';
import { isModuleEnabled } from './utils';
import { useAuth } from './contexts/AuthContext';
import { AuthRouter } from './components/AuthPages';
import Dashboard from './components/Dashboard';
import InvoiceGenerator from './components/InvoiceGenerator';
import SettingsView from './components/SettingsView';
import ClientsView from './components/ClientsView';
import InventoryView from './components/InventoryView';
import ReportsView from './components/ReportsView';
import ExpenseTracker from './components/ExpenseTracker';
import RecurringInvoices from './components/RecurringInvoices';
import ReceiptVoucher from './components/ReceiptVoucher';
import GSTReturns from './components/GSTReturns';
import PurchaseBills from './components/PurchaseBills';
import UserGuideView from './components/UserGuideView';
import WelcomeGuide from './components/WelcomeGuide';
import AccountSettings from './components/AccountSettings';
import LandingPage from './components/LandingPage';
import ToastContainer from './components/Toast';

function AppShell() {
  const { user, userProfile, signOut, loading: authLoading, isPro } = useAuth();
  const [currentView, setCurrentView] = useState(() => sessionStorage.getItem('gst_currentView') || 'dashboard');
  const [profile, setProfile] = useState(null);
  const [editingBill, setEditingBill] = useState(() => {
    try {
      const saved = sessionStorage.getItem('gst_editingBill');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('freegstbill_theme') === 'dark');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [allProfiles, setAllProfiles] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [usage, setUsage] = useState(null);
  const deferredPrompt = useRef(null);
  const retryTimer = useRef(null);
  const profileLoaded = useRef(false);
  const profileMenuRef = useRef(null);
  const accountMenuRef = useRef(null);

  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const updateBannerVisible = updateInfo?.updateAvailable
    && localStorage.getItem('freegstbill_dismissedUpdate') !== updateInfo.latest;

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/check-update');
        const data = await res.json();
        if (!cancelled) setUpdateInfo(data);
      } catch { /* offline */ }
    };
    const initial = setTimeout(check, 5000);
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval); };
  }, []);

  // Load usage for plan indicator in sidebar
  useEffect(() => {
    if (serverStatus === 'online') {
      getUsage().then(setUsage).catch(() => {});
    }
  }, [serverStatus]);

  const dismissUpdate = () => {
    if (updateInfo?.latest) localStorage.setItem('freegstbill_dismissedUpdate', updateInfo.latest);
    setShowUpdateModal(false);
  };

  useEffect(() => {
    let cancelled = false;
    const checkServer = async () => {
      try {
        // Use /api/health which doesn't require auth
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          if (cancelled) return;
          setServerDown(false);
          setServerStatus('online');
          if (!profileLoaded.current) {
            profileLoaded.current = true;
            try {
              const p = await getProfile();
              setProfile(p);
              if (!p.businessName && !localStorage.getItem('freegstbill_onboarded')) {
                setShowWelcome(true);
              }
            } catch { /* auth not ready yet */ }
          }
          return;
        }
        throw new Error('not ok');
      } catch {
        if (!cancelled) {
          setServerDown(true);
          setServerStatus('offline');
        }
      }
    };
    checkServer();
    retryTimer.current = setInterval(checkServer, 5000);
    return () => { cancelled = true; if (retryTimer.current) clearInterval(retryTimer.current); };
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem('freegstbill_pwa_dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (dismissed || isStandalone) return;
    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => { sessionStorage.setItem('gst_currentView', currentView); }, [currentView]);

  useEffect(() => {
    if (editingBill) sessionStorage.setItem('gst_editingBill', JSON.stringify(editingBill));
    else sessionStorage.removeItem('gst_editingBill');
  }, [editingBill]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('freegstbill_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (serverStatus === 'online') {
      getAllProfiles().then(setAllProfiles).catch(() => {});
    }
  }, [serverStatus]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfileMenu]);

  useEffect(() => {
    if (!showAccountMenu) return;
    const handler = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) setShowAccountMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAccountMenu]);

  const handleSwitchProfile = async (bp) => {
    setShowProfileMenu(false);
    const loaded = { ...bp };
    delete loaded.id;
    await saveProfile(loaded);
    setProfile(loaded);
  };

  const handleNewInvoice = () => {
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(null);
    setCurrentView('new');
  };

  const handleEditInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(bill);
    setCurrentView('new');
  };

  const handleDuplicateInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    setEditingBill(clone);
    setCurrentView('new');
  };

  const handleConvertToInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    clone._convertToType = 'tax-invoice';
    setEditingBill(clone);
    setCurrentView('new');
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const result = await deferredPrompt.current.userChoice;
    if (result.outcome === 'accepted') setShowInstallBanner(false);
    deferredPrompt.current = null;
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('freegstbill_pwa_dismissed', '1');
  };

  const enabledModules = getEnabledModules();
  const showIfModule = (moduleId) => isModuleEnabled(moduleId, enabledModules);

  useEffect(() => {
    const map = { new: 'invoicing', clients: 'clients', inventory: 'inventory', expenses: 'expenses', purchases: 'purchases', recurring: 'recurring', receipts: 'receipts', reports: 'reports', filing: 'gstReturns' };
    const moduleForView = map[currentView];
    if (moduleForView && !isModuleEnabled(moduleForView, enabledModules)) setCurrentView('dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, JSON.stringify(enabledModules)]);

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard', module: 'dashboard' },
    { id: 'new', icon: Plus, label: 'New Invoice', onClick: handleNewInvoice, module: 'invoicing' },
    { id: 'clients', icon: Users, label: 'Clients', module: 'clients' },
    { id: 'inventory', icon: Package, label: 'Products', module: 'inventory' },
    { id: 'expenses', icon: Wallet, label: 'Expenses', module: 'expenses' },
    { id: 'purchases', icon: ShoppingCart, label: 'Purchases', module: 'purchases' },
    { id: 'recurring', icon: RefreshCw, label: 'Recurring', module: 'recurring' },
    { id: 'receipts', icon: Receipt, label: 'Receipts', module: 'receipts' },
    { id: 'reports', icon: BarChart3, label: 'Reports', module: 'reports' },
    { id: 'filing', icon: BookOpen, label: 'GST Returns', module: 'gstReturns' },
    { id: 'guide', icon: HelpCircle, label: 'User Guide', module: 'dashboard' },
  ].filter(item => showIfModule(item.module));

  if (serverDown) {
    return (
      <div className="server-down-overlay">
        <div className="server-down-modal">
          <FileText size={48} color="#3b82f6" />
          <h2>Connecting to server...</h2>
          <p>The billing server is starting up. Please wait a moment.</p>
          <div className="server-down-waiting">
            <div className="server-down-spinner" />
            <span>Connecting... this page will refresh automatically.</span>
          </div>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <>
        <WelcomeGuide onComplete={(p) => { if (p) setProfile(p); setShowWelcome(false); }} />
        <ToastContainer />
      </>
    );
  }

  const displayName = userProfile?.display_name || user?.email?.split('@')[0] || 'Account';
  const planLabel = isPro ? 'Pro' : 'Free';
  const freeTierNearLimit = !isPro && usage && usage.invoicesThisMonth >= 8;

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="sidebar-title">GST Billing</h2>
            <p className="sidebar-subtitle">by Technocratiq</p>
          </div>
        </div>

        {/* Business profile switcher */}
        <div className="profile-switcher" ref={profileMenuRef} style={{ position: 'relative' }}>
          <div className="profile-switcher-row">
            <button
              className="profile-switcher-btn"
              onClick={() => allProfiles.length > 1 && setShowProfileMenu(v => !v)}
              title={allProfiles.length > 1 ? 'Switch business profile' : profile?.businessName || 'My Business'}
              style={{ cursor: allProfiles.length > 1 ? 'pointer' : 'default' }}
            >
              <Building2 size={14} />
              <span className="profile-switcher-name">{profile?.businessName || 'My Business'}</span>
              {allProfiles.length > 1 && <ChevronDown size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </button>
            <button className="profile-switcher-edit" onClick={() => { setShowProfileMenu(false); setCurrentView('settings'); }} title="Edit business profile">
              <Pencil size={13} />
            </button>
          </div>
          {showProfileMenu && (
            <div className="profile-switcher-menu">
              {allProfiles.map(bp => (
                <button
                  key={bp.id || bp.businessName}
                  className={`profile-switcher-item${bp.businessName?.trim().toLowerCase() === profile?.businessName?.trim().toLowerCase() ? ' active' : ''}`}
                  onClick={() => handleSwitchProfile(bp)}
                >
                  {bp.businessName}
                </button>
              ))}
              <button className="profile-switcher-item profile-switcher-manage" onClick={() => { setShowProfileMenu(false); setCurrentView('settings'); }}>
                Manage profiles...
              </button>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-btn ${currentView === item.id ? 'nav-btn-active' : ''}`}
              onClick={item.onClick || (() => setCurrentView(item.id))}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {/* Free tier usage bar */}
            {!isPro && usage && (
              <div
                className={`sidebar-usage ${freeTierNearLimit ? 'sidebar-usage-warn' : ''}`}
                onClick={() => setShowAccountSettings(true)}
                title="Click to manage plan"
                style={{ cursor: 'pointer' }}
              >
                <div className="sidebar-usage-row">
                  <span className="sidebar-usage-label">
                    <Zap size={12} /> Free plan
                  </span>
                  <span className="sidebar-usage-count">{usage.invoicesThisMonth}/{usage.limit}</span>
                </div>
                <div className="plan-usage-bar" style={{ marginTop: '0.3rem' }}>
                  <div
                    className="plan-usage-fill"
                    style={{
                      width: `${Math.min(100, (usage.invoicesThisMonth / usage.limit) * 100)}%`,
                      background: freeTierNearLimit ? 'var(--danger)' : undefined,
                    }}
                  />
                </div>
              </div>
            )}

            {updateBannerVisible && (
              <button
                className="nav-btn"
                onClick={() => setShowUpdateModal(true)}
                style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)', color: 'var(--info-text)', fontWeight: 600, position: 'relative' }}
              >
                <Download size={18} />
                <span style={{ flex: 1, textAlign: 'left' }}>Update to v{updateInfo.latest}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.25)', flexShrink: 0 }} />
              </button>
            )}

            <button className="nav-btn" onClick={() => setDarkMode(!darkMode)} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>

            <button className={`nav-btn ${currentView === 'settings' ? 'nav-btn-active' : ''}`} onClick={() => setCurrentView('settings')}>
              <Settings size={18} /> Settings
            </button>

            {/* User account button */}
            <div style={{ position: 'relative' }} ref={accountMenuRef}>
              <button
                className="nav-btn user-account-btn"
                onClick={() => setShowAccountMenu(v => !v)}
                title={displayName}
              >
                <div className="user-avatar">{(displayName[0] || 'U').toUpperCase()}</div>
                <span className="user-name-label">{displayName}</span>
                <span className={`user-plan-tag ${isPro ? 'plan-pro-tag' : 'plan-free-tag'}`}>{planLabel}</span>
                <ChevronDown size={13} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </button>
              {showAccountMenu && (
                <div className="account-dropdown">
                  <div className="account-dropdown-email">{user?.email}</div>
                  <button className="account-dropdown-item" onClick={() => { setShowAccountMenu(false); setShowAccountSettings(true); }}>
                    <User size={13} /> Account Settings
                  </button>
                  <button className="account-dropdown-item danger" onClick={signOut}>
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              )}
            </div>

            <div className={`server-status server-status-${serverStatus}`}>
              <span className="server-status-dot" />
              {serverStatus === 'online' ? 'App Ready' : serverStatus === 'offline' ? 'Connecting...' : 'Connecting...'}
            </div>
          </div>
        </nav>
      </div>

      {showInstallBanner && (
        <div className="pwa-install-banner">
          <Download size={18} />
          <span><strong>Install as App</strong> — opens instantly, no browser needed!</span>
          <button className="pwa-install-btn" onClick={handleInstallPWA}>Install App</button>
          <button className="pwa-dismiss-btn" onClick={dismissInstallBanner} title="Dismiss"><X size={16} /></button>
        </div>
      )}

      <div className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard onNew={handleNewInvoice} onEdit={handleEditInvoice} onDuplicate={handleDuplicateInvoice} onConvert={handleConvertToInvoice} />
        )}
        {currentView === 'new' && (
          <InvoiceGenerator
            onBack={() => { setEditingBill(null); setCurrentView('dashboard'); }}
            profile={profile} editingBill={editingBill}
          />
        )}
        {currentView === 'clients' && (
          <ClientsView onNew={handleNewInvoice} onEdit={handleEditInvoice} onDuplicate={handleDuplicateInvoice} />
        )}
        {currentView === 'inventory' && <InventoryView />}
        {currentView === 'expenses' && <ExpenseTracker />}
        {currentView === 'purchases' && <PurchaseBills />}
        {currentView === 'recurring' && <RecurringInvoices onEdit={handleEditInvoice} />}
        {currentView === 'receipts' && <ReceiptVoucher />}
        {currentView === 'reports' && <ReportsView />}
        {currentView === 'filing' && <GSTReturns />}
        {currentView === 'guide' && <UserGuideView />}
        {currentView === 'settings' && <SettingsView onSaved={(p) => setProfile(p)} />}
      </div>

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <AccountSettings onClose={() => setShowAccountSettings(false)} />
      )}

      {/* Update modal */}
      {showUpdateModal && updateInfo && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>Update available — v{updateInfo.latest}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  You're on v{updateInfo.current}
                  {updateInfo.releasePublishedAt && ` · released ${new Date(updateInfo.releasePublishedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowUpdateModal(false)}><X size={18} /></button>
            </div>
            <div className="surface-card" style={{ maxHeight: '320px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: '0.85rem' }}>
              {updateInfo.releaseNotes || <span style={{ color: 'var(--text-muted)' }}>No release notes available.</span>}
            </div>
            <div className="flex gap-2 justify-end" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={dismissUpdate}>Skip this version</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowUpdateModal(false)}>Remind me later</button>
              {updateInfo.releaseUrl && (
                <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none' }}>View on GitHub</a>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <FileText size={40} color="var(--primary)" />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showAuth) return <AuthRouter />;
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  return <AppShell />;
}

export default App;
