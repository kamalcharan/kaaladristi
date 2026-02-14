import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getRiskHex } from '@/lib/utils';
import { signIn, signUp } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

// ── Star Field ──
function StarField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (let i = 0; i < 200; i++) {
      const star = document.createElement('div');
      star.className = 'absolute w-[2px] h-[2px] bg-white rounded-full opacity-0';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      const dur = 2 + Math.random() * 4;
      const delay = Math.random() * 5;
      const opacity = 0.2 + Math.random() * 0.6;
      star.style.animation = `twinkle ${dur}s ${delay}s ease-in-out infinite`;
      star.style.setProperty('--tw-opacity', String(opacity));
      el.appendChild(star);
    }
    return () => { el.innerHTML = ''; };
  }, []);

  return <div ref={ref} className="fixed inset-0 pointer-events-none z-0" />;
}

// ── Animated Logo ──
function AnimatedLogo() {
  return (
    <div className="w-12 h-12 relative">
      <div className="absolute inset-0 border-2 border-indigo-500/60 rounded-full animate-[orbit_15s_linear_infinite]" />
      <div className="absolute inset-[15%] border-2 border-violet-500/50 rounded-full animate-[orbit_10s_linear_infinite_reverse]" />
      <div className="absolute inset-[30%] border-2 border-cyan-500/60 rounded-full animate-[orbit_8s_linear_infinite]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-gradient-to-br from-accent-indigo to-accent-violet rounded-full shadow-[0_0_20px_var(--accent-indigo)]" />
    </div>
  );
}

// ── Mini Risk Gauge ──
function MiniGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 22;
  const offset = circumference - (score / 100) * circumference;
  const color = getRiskHex(score);

  return (
    <div className="w-14 h-14 relative">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle
          cx="28" cy="28" r="22" fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-base font-semibold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// ── Auth form input style ──
const inputClass = 'px-4 py-3.5 bg-kd-elevated border border-kd-border rounded-xl text-[15px] text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all w-full';

type AuthMode = 'login' | 'register';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        if (!fullName.trim()) {
          setError('Please enter your full name');
          setIsSubmitting(false);
          return;
        }
        const { user: newUser } = await signUp(email, password, fullName.trim());
        if (newUser?.identities?.length === 0) {
          setError('An account with this email already exists');
        } else {
          setSuccess('Account created! Check your email to confirm, then sign in.');
          setAuthMode('login');
        }
      } else {
        await signIn(email, password);
        // Auth state listener in authStore will handle the rest
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-kd-bg text-[var(--text-primary)] overflow-hidden">
      {/* Backgrounds */}
      <StarField />
      <div className="fixed w-[800px] h-[800px] rounded-full top-[-300px] left-1/2 -translate-x-1/2 blur-[100px] pointer-events-none z-0 animate-[orbit1_30s_linear_infinite]"
           style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)' }} />
      <div className="fixed w-[600px] h-[600px] rounded-full bottom-[-200px] right-[-200px] blur-[100px] pointer-events-none z-0 animate-[orbit2_25s_linear_infinite]"
           style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)' }} />
      <div className="fixed w-[400px] h-[400px] rounded-full top-[40%] left-[-100px] blur-[100px] pointer-events-none z-0 animate-[orbit3_20s_linear_infinite]"
           style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)' }} />
      <div className="fixed inset-0 pointer-events-none z-0"
           style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Main Layout */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

        {/* ── Left: Brand Panel ── */}
        <div className="flex-1 flex flex-col justify-center px-10 lg:px-20 py-16 relative">
          <nav className="absolute top-10 left-10 lg:left-20 right-10 lg:right-20 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <AnimatedLogo />
              <span className="font-display text-2xl font-medium tracking-wide">Kala-Drishti</span>
            </div>
            <div className="hidden md:flex gap-8">
              <a href="#" className="text-sm text-secondary hover:text-[var(--text-primary)] transition-colors">How it Works</a>
              <a href="#" className="text-sm text-secondary hover:text-[var(--text-primary)] transition-colors">Methodology</a>
              <a href="#" className="text-sm text-secondary hover:text-[var(--text-primary)] transition-colors">Pricing</a>
            </div>
          </nav>

          <div className="max-w-[600px]">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[13px] text-accent-indigo mb-8">
              <div className="w-2 h-2 bg-accent-indigo rounded-full animate-pulse" />
              Pre-Market Intelligence for Indian Indices
            </div>

            <h1 className="font-display text-[44px] lg:text-[56px] font-semibold leading-[1.15] mb-6 tracking-tight">
              Know Market Risk<br />
              <span className="bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan bg-clip-text text-transparent">
                Before It Happens
              </span>
            </h1>

            <p className="text-lg text-secondary leading-relaxed mb-10">
              Kala-Drishti uses time-cycle analysis to reveal hidden market stress points.
              Get pre-computed risk intelligence for NIFTY and BANKNIFTY — every morning
              before market opens.
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              {[
                { icon: '📊', label: 'Daily Risk Score' },
                { icon: '📅', label: '7-Day Outlook' },
                { icon: '🔔', label: 'WhatsApp Alerts' },
                { icon: '⚡', label: 'Pre-Market Delivery' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 px-4 py-2.5 glass-card rounded-full text-[13px] text-secondary">
                  <span className="text-sm">{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 pt-8 border-t border-kd-border">
              {['SEBI Compliant', 'No Buy/Sell Tips', 'Educational Only'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-[13px] text-muted">
                  <svg className="text-risk-green" width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Auth Panel ── */}
        <div className="w-full lg:w-[480px] bg-kd-card backdrop-blur-xl lg:border-l border-t lg:border-t-0 border-kd-border flex flex-col justify-center px-10 lg:px-[60px] py-16">
          <div className="max-w-[360px] mx-auto w-full">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">
                {authMode === 'login' ? 'Welcome Back' : 'Get Started'}
              </h2>
              <p className="text-sm text-muted">
                {authMode === 'login' ? 'Sign in to access your risk dashboard' : 'Create your account to begin'}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-kd-elevated rounded-xl p-1 mb-7">
              <button
                onClick={() => { setAuthMode('login'); setError(''); setSuccess(''); }}
                className={`flex-1 py-3 rounded-[10px] text-sm font-medium transition-all ${
                  authMode === 'login'
                    ? 'bg-kd-card text-[var(--text-primary)] shadow-lg'
                    : 'text-secondary hover:text-[var(--text-primary)]'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthMode('register'); setError(''); setSuccess(''); }}
                className={`flex-1 py-3 rounded-[10px] text-sm font-medium transition-all ${
                  authMode === 'register'
                    ? 'bg-kd-card text-[var(--text-primary)] shadow-lg'
                    : 'text-secondary hover:text-[var(--text-primary)]'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error / Success messages */}
            {error && (
              <div className="mb-4 px-4 py-3 bg-risk-red/10 border border-risk-red/30 rounded-xl text-sm text-risk-red">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 px-4 py-3 bg-risk-green/10 border border-risk-green/30 rounded-xl text-sm text-risk-green">
                {success}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {authMode === 'register' && (
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-secondary">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Rajesh Kumar"
                    required
                    className={inputClass}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-secondary">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-secondary">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={inputClass}
                />
                {authMode === 'register' && (
                  <p className="text-[11px] text-muted">Minimum 6 characters</p>
                )}
              </div>

              {authMode === 'login' && (
                <div className="flex justify-end">
                  <a href="#" className="text-[13px] text-accent-indigo hover:opacity-80 transition-opacity">Forgot password?</a>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="py-4 bg-gradient-to-r from-accent-indigo to-accent-violet rounded-xl text-[15px] font-semibold text-white shadow-[0_4px_20px_rgba(99,102,241,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {/* Live Preview */}
            <div className="mt-8 p-5 bg-kd-elevated border border-kd-border rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-muted uppercase tracking-wider">Today's Risk Preview</span>
                <span className="flex items-center gap-1.5 text-[11px] text-risk-green">
                  <span className="w-1.5 h-1.5 bg-risk-green rounded-full animate-pulse" />
                  LIVE
                </span>
              </div>
              <div className="flex items-center gap-4">
                <MiniGauge score={68} />
                <div>
                  <div className="text-xs text-muted mb-0.5">NIFTY Risk Score</div>
                  <div className="text-sm font-medium text-risk-amber">Distribution Regime</div>
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-muted">
              By continuing, you agree to our <a href="#" className="text-accent-indigo">Terms</a> and <a href="#" className="text-accent-indigo">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
