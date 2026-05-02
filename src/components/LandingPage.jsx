import { useState } from 'react';
import { FileText, CircleCheck as CheckCircle, ArrowRight, Star, Zap, Shield, ChartBar as BarChart3, RefreshCw, Package, Users, Wallet, Receipt, BookOpen, Globe, Download, ChevronDown, X, Menu } from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    title: 'All Invoice Types',
    desc: 'Tax Invoice, Proforma/Estimate, Bill of Supply, Credit Note, Delivery Challan — all in one place with auto GST calculation.',
    color: '#2563eb',
  },
  {
    icon: BarChart3,
    title: 'GST Returns & Reports',
    desc: 'GSTR-1 & GSTR-3B JSON exports ready to upload on gst.gov.in. GSTR-2B reconciliation, P&L, aging reports.',
    color: '#059669',
  },
  {
    icon: Shield,
    title: 'TDS / TCS Compliance',
    desc: 'Section 194Q, 206C and more. Form 26Q & 27EQ reports. e-Way Bill JSON generation for goods transport.',
    color: '#d97706',
  },
  {
    icon: Globe,
    title: 'Multi-Currency (22 Countries)',
    desc: 'Invoice international clients in USD, EUR, GBP, AED, AUD, SGD and 16 more. Country-aware tax labels auto-switch.',
    color: '#7c3aed',
  },
  {
    icon: Users,
    title: 'Client & Inventory Management',
    desc: 'Save clients with GSTIN tracking, manage product catalog with HSN/SAC codes, track stock levels.',
    color: '#0891b2',
  },
  {
    icon: Wallet,
    title: 'Expense Tracker',
    desc: 'Log business expenses with vendor GSTIN for ITC tracking. Purchase bills for complete input tax credit.',
    color: '#dc2626',
  },
  {
    icon: RefreshCw,
    title: 'Recurring Invoices',
    desc: 'Set up recurring billing templates — weekly, monthly, quarterly, yearly. Never miss a repeat invoice.',
    color: '#16a34a',
  },
  {
    icon: Receipt,
    title: 'Payment Receipts',
    desc: 'Generate professional payment receipt vouchers linked to invoices. Track outstanding amounts per client.',
    color: '#ca8a04',
  },
  {
    icon: Package,
    title: 'Multi-Business Profiles',
    desc: 'Manage multiple GSTINs under one account. Switch between businesses instantly from the sidebar.',
    color: '#7c3aed',
  },
  {
    icon: BookOpen,
    title: 'PDF & WhatsApp Sharing',
    desc: '3 PDF styles (Classic, Modern, Minimal). Share invoices via WhatsApp, email, or Google Drive backup.',
    color: '#2563eb',
  },
  {
    icon: Zap,
    title: 'UPI QR on Invoices',
    desc: 'Auto-generate UPI payment QR codes on every invoice. Clients scan and pay instantly.',
    color: '#059669',
  },
  {
    icon: Download,
    title: 'Backup & Restore',
    desc: 'Granular export/import — choose exactly what to backup. Optional Google Drive sync for cloud backup.',
    color: '#0891b2',
  },
];

const SCREENSHOTS = [
  {
    title: 'Dashboard Overview',
    desc: 'See your monthly revenue, outstanding invoices, and recent transactions at a glance.',
    bg: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    icon: BarChart3,
  },
  {
    title: 'Invoice Generator',
    desc: 'Create professional GST invoices in seconds with auto tax calculation and PDF generation.',
    bg: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
    icon: FileText,
  },
  {
    title: 'GST Returns',
    desc: 'GSTR-1, GSTR-3B computation and JSON export ready to file on the government portal.',
    bg: 'linear-gradient(135deg, #7c2d12 0%, #d97706 100%)',
    icon: BookOpen,
  },
];

const PLAN_FREE = [
  '10 invoices per month',
  'All invoice types (Tax, Proforma, Credit Note, etc.)',
  'GSTR-1 & GSTR-3B exports',
  'Client & product management',
  'Expense tracker & purchase bills',
  'Recurring invoices',
  'Multi-business profiles',
  'PDF generation & sharing',
  'Backup & restore',
  'Multi-currency (22 countries)',
];

const PLAN_PRO = [
  'Everything in Free',
  'Unlimited invoices per month',
  'Official GST Portal API integration',
  'Direct return filing from the app',
  'Priority support',
];

export default function LandingPage({ onGetStarted }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(null);

  const faqs = [
    {
      q: 'Is my data safe?',
      a: 'Yes. Your data is stored securely in our cloud database with row-level security. Each user account is fully isolated — no other user can ever access your invoices or business data.',
    },
    {
      q: 'Does the Free plan really include all features?',
      a: 'Yes! The Free plan includes every feature except GST Portal API integration and has a 10 invoice/month limit. There are no hidden feature gates — you get the full product.',
    },
    {
      q: 'What is GST Portal API integration?',
      a: 'The Pro plan lets you store your official government GST portal credentials (GSTIN, username, password, app key) so you can file returns directly from the app without visiting gst.gov.in separately.',
    },
    {
      q: 'Can I use this for multiple businesses?',
      a: 'Yes. You can create unlimited business profiles (GSTINs) under one account and switch between them instantly.',
    },
    {
      q: 'How do I upgrade to Pro?',
      a: 'Contact us at contact@technocratiq.com to upgrade. Razorpay payment integration is coming soon for self-serve upgrades.',
    },
    {
      q: 'Can I import my existing data?',
      a: 'Yes. The app supports importing backup JSON files from the previous desktop version, so migrating your existing invoices, clients, and products is straightforward.',
    },
  ];

  return (
    <div className="landing">
      {/* NAV */}
      <header className="landing-nav">
        <div className="landing-container landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-brand-icon"><FileText size={20} /></div>
            <span className="landing-brand-name">GST Billing</span>
            <span className="landing-brand-by">by Technocratiq</span>
          </div>
          <nav className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#pricing" className="landing-nav-link">Pricing</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </nav>
          <div className="landing-nav-actions">
            <button className="btn btn-secondary landing-signin-btn" onClick={onGetStarted}>Sign In</button>
            <button className="btn btn-primary" onClick={onGetStarted}>Get Started Free</button>
          </div>
          <button className="landing-menu-toggle" onClick={() => setMobileMenuOpen(v => !v)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="landing-mobile-menu">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <button className="btn btn-primary" onClick={onGetStarted} style={{ width: '100%' }}>Get Started Free</button>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-container landing-hero-inner">
          <div className="landing-hero-badge">
            <Zap size={13} /> India's complete GST billing platform
          </div>
          <h1 className="landing-hero-title">
            Professional GST Billing<br />
            <span className="landing-hero-accent">for Indian Businesses</span>
          </h1>
          <p className="landing-hero-sub">
            Create tax invoices, file GST returns, track expenses, manage inventory and clients —
            all in one secure cloud app. Free plan includes every feature.
          </p>
          <div className="landing-hero-actions">
            <button className="btn btn-primary landing-cta-btn" onClick={onGetStarted}>
              Start for Free <ArrowRight size={16} />
            </button>
            <a href="#features" className="btn btn-secondary landing-cta-secondary">
              See all features
            </a>
          </div>
          <div className="landing-hero-trust">
            {['No credit card required', 'Free plan forever', '10 invoice types', 'GSTR-1 & GSTR-3B exports'].map(t => (
              <span key={t} className="landing-trust-item">
                <CheckCircle size={13} /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SCREENSHOT MOCKUPS */}
      <section className="landing-screenshots">
        <div className="landing-container">
          <div className="landing-screens-grid">
            {SCREENSHOTS.map((s, i) => (
              <div key={i} className="landing-screen-card" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="landing-screen-mockup" style={{ background: s.bg }}>
                  <div className="landing-screen-chrome">
                    <span /><span /><span />
                  </div>
                  <div className="landing-screen-content">
                    <s.icon size={36} color="rgba(255,255,255,0.7)" />
                    <p>{s.title}</p>
                  </div>
                </div>
                <div className="landing-screen-info">
                  <strong>{s.title}</strong>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="landing-features" id="features">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Everything your business needs</h2>
            <p className="landing-section-sub">
              Built specifically for Indian GST compliance — from day-to-day invoicing to quarterly return filing.
            </p>
          </div>
          <div className="landing-features-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="landing-feature-card">
                <div className="landing-feature-icon" style={{ background: f.color + '15', color: f.color }}>
                  <f.icon size={20} />
                </div>
                <div>
                  <h3 className="landing-feature-title">{f.title}</h3>
                  <p className="landing-feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="landing-pricing" id="pricing">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Simple, transparent pricing</h2>
            <p className="landing-section-sub">All features included in the Free plan. Upgrade only when you need more invoices.</p>
          </div>
          <div className="landing-pricing-grid">
            {/* Free */}
            <div className="landing-plan-card">
              <div className="landing-plan-header">
                <h3 className="landing-plan-name">Free</h3>
                <div className="landing-plan-price">
                  <span className="landing-plan-amount">₹0</span>
                  <span className="landing-plan-period">/ month</span>
                </div>
                <p className="landing-plan-tagline">Perfect for freelancers & small businesses</p>
              </div>
              <ul className="landing-plan-features">
                {PLAN_FREE.map((f, i) => (
                  <li key={i}><CheckCircle size={14} /> {f}</li>
                ))}
              </ul>
              <button className="btn btn-secondary landing-plan-btn" onClick={onGetStarted}>
                Get started free
              </button>
            </div>

            {/* Pro */}
            <div className="landing-plan-card landing-plan-pro">
              <div className="landing-plan-badge-wrap">
                <span className="landing-plan-popular-badge"><Star size={11} /> Most Popular</span>
              </div>
              <div className="landing-plan-header">
                <h3 className="landing-plan-name">Pro</h3>
                <div className="landing-plan-price">
                  <span className="landing-plan-amount">Contact Us</span>
                </div>
                <p className="landing-plan-tagline">For growing businesses that file returns regularly</p>
              </div>
              <ul className="landing-plan-features">
                {PLAN_PRO.map((f, i) => (
                  <li key={i}><CheckCircle size={14} /> {f}</li>
                ))}
              </ul>
              <a
                href="mailto:contact@technocratiq.com?subject=GST Billing Pro Plan Enquiry"
                className="btn btn-primary landing-plan-btn"
                style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}
              >
                Contact for Pro <ArrowRight size={14} />
              </a>
            </div>
          </div>
          <p className="landing-pricing-note">
            Razorpay self-serve payment coming soon. Until then, email us to upgrade.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-faq" id="faq">
        <div className="landing-container landing-faq-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Frequently asked questions</h2>
          </div>
          <div className="landing-faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className={`landing-faq-item ${faqOpen === i ? 'open' : ''}`}>
                <button className="landing-faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <span>{faq.q}</span>
                  <ChevronDown size={16} className={`landing-faq-chevron ${faqOpen === i ? 'rotated' : ''}`} />
                </button>
                {faqOpen === i && (
                  <div className="landing-faq-a">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BOTTOM */}
      <section className="landing-cta-section">
        <div className="landing-container landing-cta-inner">
          <h2 className="landing-cta-title">Ready to simplify your GST billing?</h2>
          <p className="landing-cta-sub">Join thousands of Indian businesses. Free plan, no credit card required.</p>
          <button className="btn btn-primary landing-cta-btn" onClick={onGetStarted}>
            Create free account <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-brand">
              <div className="landing-brand-icon"><FileText size={16} /></div>
              <span className="landing-brand-name">GST Billing</span>
            </div>
            <p className="landing-footer-copy">
              &copy; {new Date().getFullYear()} Technocratiq. All rights reserved.
            </p>
          </div>
          <div className="landing-footer-links">
            <a href="mailto:contact@technocratiq.com">contact@technocratiq.com</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
