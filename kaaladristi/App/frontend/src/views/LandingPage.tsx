import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRiskHex } from '@/lib/utils';

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

// ── Auth Tabs ──
type AuthMode = 'login' | 'register';

export default function LandingPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
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
          {/* Nav */}
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

          {/* Hero */}
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

            {/* Feature Pills */}
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

            {/* Trust */}
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
            {/* Header */}
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
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-3 rounded-[10px] text-sm font-medium transition-all ${
                  authMode === 'login'
                    ? 'bg-kd-card text-[var(--text-primary)] shadow-lg'
                    : 'text-secondary hover:text-[var(--text-primary)]'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-3 rounded-[10px] text-sm font-medium transition-all ${
                  authMode === 'register'
                    ? 'bg-kd-card text-[var(--text-primary)] shadow-lg'
                    : 'text-secondary hover:text-[var(--text-primary)]'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {authMode === 'register' && (
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-secondary">Full Name</label>
                  <input
                    type="text"
                    placeholder="Rajesh Kumar"
                    className="px-4 py-3.5 bg-kd-elevated border border-kd-border rounded-xl text-[15px] text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-secondary">Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="px-4 py-3.5 bg-kd-elevated border border-kd-border rounded-xl text-[15px] text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-secondary">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="px-4 py-3.5 bg-kd-elevated border border-kd-border rounded-xl text-[15px] text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                />
              </div>

              {authMode === 'login' && (
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2 text-[13px] text-secondary cursor-pointer">
                    <input type="checkbox" className="w-[18px] h-[18px] rounded border border-kd-border bg-kd-elevated" />
                    Remember me
                  </label>
                  <a href="#" className="text-[13px] text-accent-indigo hover:opacity-80 transition-opacity">Forgot password?</a>
                </div>
              )}

              <button
                type="submit"
                className="py-4 bg-gradient-to-r from-accent-indigo to-accent-violet rounded-xl text-[15px] font-semibold text-white shadow-[0_4px_20px_rgba(99,102,241,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(99,102,241,0.4)] transition-all"
              >
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-kd-border" />
              <span className="text-xs text-muted">or continue with</span>
              <div className="flex-1 h-px bg-kd-border" />
            </div>

            {/* Social */}
            <div className="flex gap-3">
              <button className="flex-1 py-3.5 glass-elevated rounded-xl text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-kd-card hover:border-kd-border-active transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button className="flex-1 py-3.5 glass-elevated rounded-xl text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-kd-card hover:border-kd-border-active transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </button>
            </div>

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

            {/* Footer */}
            <p className="mt-8 text-center text-xs text-muted">
              By continuing, you agree to our <a href="#" className="text-accent-indigo">Terms</a> and <a href="#" className="text-accent-indigo">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
