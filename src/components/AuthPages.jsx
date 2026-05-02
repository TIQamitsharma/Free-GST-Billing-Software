import { useState } from 'react';
import { FileText, Mail, Lock, User, Eye, EyeOff, ArrowLeft, Loader as Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <FileText size={28} />
          </div>
          <div>
            <h1 className="auth-brand-name">GST Billing</h1>
            <p className="auth-brand-sub">by Technocratiq</p>
          </div>
        </div>
        <h2 className="auth-title">{title}</h2>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function LoginPage({ onShowSignup, onShowForgot }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your GST Billing account">
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-field">
          <label className="auth-label">Email address</label>
          <div className="auth-input-wrap">
            <Mail size={16} className="auth-input-icon" />
            <input
              type="email"
              className="auth-input"
              placeholder="you@business.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>
        <div className="auth-field">
          <div className="auth-label-row">
            <label className="auth-label">Password</label>
            <button type="button" className="auth-link-btn" onClick={onShowForgot}>
              Forgot password?
            </button>
          </div>
          <div className="auth-input-wrap">
            <Lock size={16} className="auth-input-icon" />
            <input
              type={showPw ? 'text' : 'password'}
              className="auth-input auth-input-pw"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? <><Loader2 size={16} className="spin" /> Signing in...</> : 'Sign In'}
        </button>
      </form>
      <p className="auth-switch">
        Don't have an account?{' '}
        <button type="button" className="auth-link-btn" onClick={onShowSignup}>
          Create account
        </button>
      </p>
    </AuthLayout>
  );
}

export function SignupPage({ onShowLogin }) {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const { error, needsConfirmation } = await signUp(email.trim(), password, displayName.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
    } else if (needsConfirmation) {
      setSuccess(true);
    }
    // If no error and no confirmation needed, auth state change fires automatically
  };

  if (success) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent a confirmation link to your inbox.">
        <div className="auth-success-msg">
          <p>Click the link in the email to activate your account, then sign in.</p>
        </div>
        <button type="button" className="btn btn-primary auth-submit" onClick={onShowLogin}>
          <ArrowLeft size={16} /> Back to Sign In
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Free forever. No credit card required.">
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-field">
          <label className="auth-label">Your name</label>
          <div className="auth-input-wrap">
            <User size={16} className="auth-input-icon" />
            <input
              type="text"
              className="auth-input"
              placeholder="Rajesh Kumar"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label">Email address</label>
          <div className="auth-input-wrap">
            <Mail size={16} className="auth-input-icon" />
            <input
              type="email"
              className="auth-input"
              placeholder="you@business.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label">Password</label>
          <div className="auth-input-wrap">
            <Lock size={16} className="auth-input-icon" />
            <input
              type={showPw ? 'text' : 'password'}
              className="auth-input auth-input-pw"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? <><Loader2 size={16} className="spin" /> Creating account...</> : 'Create Account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account?{' '}
        <button type="button" className="auth-link-btn" onClick={onShowLogin}>
          Sign in
        </button>
      </p>
      <p className="auth-plan-note">
        Free plan: 10 invoices/month, all features included.
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage({ onShowLogin }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Reset link sent" subtitle="Check your email for a password reset link.">
        <button type="button" className="btn btn-primary auth-submit" onClick={onShowLogin}>
          <ArrowLeft size={16} /> Back to Sign In
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send a reset link to your email.">
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-field">
          <label className="auth-label">Email address</label>
          <div className="auth-input-wrap">
            <Mail size={16} className="auth-input-icon" />
            <input
              type="email"
              className="auth-input"
              placeholder="you@business.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? <><Loader2 size={16} className="spin" /> Sending...</> : 'Send Reset Link'}
        </button>
      </form>
      <p className="auth-switch">
        <button type="button" className="auth-link-btn" onClick={onShowLogin}>
          <ArrowLeft size={14} /> Back to Sign In
        </button>
      </p>
    </AuthLayout>
  );
}

export function AuthRouter() {
  const [page, setPage] = useState('login');

  if (page === 'signup') return <SignupPage onShowLogin={() => setPage('login')} />;
  if (page === 'forgot') return <ForgotPasswordPage onShowLogin={() => setPage('login')} />;
  return <LoginPage onShowSignup={() => setPage('signup')} onShowForgot={() => setPage('forgot')} />;
}
