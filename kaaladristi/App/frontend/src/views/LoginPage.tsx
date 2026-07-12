import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { signIn, signUp, forgotPassword } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { LogoMark, Starfield } from './landing/shared';

// Design tokens matching DristiQ landing page
const C = {
  bg:    '#07070c',
  card:  '#0d0d1a',
  ink1:  '#f4ecd6',
  ink2:  '#d9cfb6',
  ink3:  '#8a8372',
  ink4:  '#50493c',
  g1:    '#e2b96f',
  g2:    'var(--gold)',
  g3:    '#8a6f28',
  rule:  'rgba(226,185,111,.18)',
  rs:    'rgba(226,185,111,.08)',
  glow:  'rgba(226,185,111,.22)',
};
const SERIF = "'Cormorant Garamond','Playfair Display',serif";
const MONO  = "'JetBrains Mono','Geist Mono',ui-monospace,monospace";
const SANS  = "'DM Sans','Inter',system-ui,sans-serif";

const INVITE_CODE = 'bharathavarsha';

type AuthMode = 'login' | 'register' | 'forgot';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Invite-code gate
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (user) navigate('/workspace', { replace: true });
  }, [user, navigate]);

  const reset = (mode: AuthMode) => { setAuthMode(mode); setError(''); setSuccess(''); };

  const handleTabClick = (mode: AuthMode) => {
    if (mode === 'register') {
      setInviteInput(''); setInviteError('');
      setShowInviteModal(true);
    } else {
      reset(mode);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteInput.trim().toLowerCase() === INVITE_CODE) {
      setShowInviteModal(false);
      reset('register');
    } else {
      setInviteError('Invalid invite code. Please check and try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setIsSubmitting(true);
    try {
      if (authMode === 'forgot') {
        const msg = await forgotPassword(email);
        setSuccess(msg || 'If that email exists, a reset link has been sent.');
        reset('login');
      } else if (authMode === 'register') {
        if (!fullName.trim()) { setError('Please enter your full name'); setIsSubmitting(false); return; }
        await signUp(email, password, fullName.trim());
        // Load the profile BEFORE navigating — otherwise ProtectedRoute renders
        // while getProfile() is still in flight (profile === null) and the
        // onboarding redirect never fires. A fresh account is never onboarded,
        // so go straight to the wizard.
        await useAuthStore.getState().refreshProfile();
        navigate('/setup');
      } else {
        await signIn(email, password);
        await useAuthStore.getState().refreshProfile();
        const prof = useAuthStore.getState().profile;
        navigate(prof?.onboarded ? '/workspace' : '/setup');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px',
    background: 'var(--card)',
    border: `1px solid ${C.rule}`,
    outline: 'none', color: C.ink1,
    fontFamily: SANS, fontSize: 14,
    transition: 'border-color .2s ease',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: SANS, WebkitFontSmoothing: 'antialiased', overflowX: 'hidden' }}>

      {/* ── Invite-code modal ──────────────────────────────────────────────── */}
      {showInviteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(7,7,12,.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={() => setShowInviteModal(false)}>
          <div style={{
            background: C.card, border: `1px solid ${C.rule}`,
            padding: '40px 36px', width: '100%', maxWidth: 400,
          }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: C.g1, margin: '0 0 10px' }}>
                Beta Access
              </p>
              <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 28, color: C.ink1, margin: '0 0 8px', lineHeight: 1.2 }}>
                Enter Invite Code
              </h2>
              <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink3, margin: 0 }}>
                DristiQ is currently invite-only.<br/>Enter the code you received to register.
              </p>
            </div>

            <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: C.ink4, marginBottom: 8 }}>
                  Invite Code
                </label>
                <input
                  type="text" autoFocus
                  value={inviteInput} onChange={e => { setInviteInput(e.target.value); setInviteError(''); }}
                  placeholder="enter code"
                  style={{ ...inputStyle, letterSpacing: '.08em' }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.g2)}
                  onBlur={e => (e.currentTarget.style.borderColor = C.rule)}
                />
              </div>

              {inviteError && (
                <div style={{ padding: '10px 12px', background: 'var(--bear-bg)', border: '1px solid var(--bear-dim, color-mix(in srgb, var(--bear) 30%, transparent))', color: 'var(--bear)', fontFamily: SANS, fontSize: 12 }}>
                  {inviteError}
                </div>
              )}

              <button type="submit" style={{
                padding: '13px 0', marginTop: 4,
                background: `linear-gradient(180deg,rgba(226,185,111,.92),color-mix(in srgb, var(--gold) 92%, transparent))`,
                border: `1px solid ${C.g2}`,
                color: '#0a0a12', fontFamily: SANS, fontSize: 13, letterSpacing: '.1em',
                textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
              }}>
                Verify &amp; Continue
              </button>

              <button type="button" onClick={() => setShowInviteModal(false)} style={{
                padding: '10px 0', background: 'none', border: 'none',
                fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase',
                color: C.ink4, cursor: 'pointer',
              }}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Background layers */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(900px 600px at 50% 0%,rgba(45,27,105,.3),transparent 60%),radial-gradient(700px 500px at 80% 80%,rgba(226,185,111,.05),transparent 65%),${C.bg}`,
      }}/>
      <Starfield/>

      {/* Top nav */}
      <nav style={{ position: 'relative', zIndex: 10, padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoMark size={24}/>
          <span style={{ fontFamily: SERIF, fontSize: 20, color: C.ink1, letterSpacing: '-0.01em' }}>
            Dristi<span style={{ color: C.g1 }}>Q</span>
          </span>
        </Link>
        <Link to="/" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: C.ink3, textDecoration: 'none', transition: 'color .2s ease' }}
          onMouseEnter={e => (e.currentTarget.style.color = C.g1)}
          onMouseLeave={e => (e.currentTarget.style.color = C.ink3)}>
          ← Back to home
        </Link>
      </nav>

      {/* Centered auth card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'relative', zIndex: 10 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <LogoMark size={48}/>
            </div>
            <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 36, color: C.ink1, letterSpacing: '-0.02em', margin: '0 0 8px', lineHeight: 1.1 }}>
              {authMode === 'forgot' ? 'Reset Password' : authMode === 'login' ? 'Welcome back.' : 'Create account.'}
            </h1>
            <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: C.ink3, margin: 0 }}>
              {authMode === 'forgot' ? 'Enter your email for a reset link' : authMode === 'login' ? 'Sign in to your DristiQ dashboard' : 'Join the DristiQ beta cohort'}
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: C.card,
            border: `1px solid ${C.rule}`,
            padding: '36px 36px',
          }}>

            {/* Mode tabs */}
            {authMode !== 'forgot' && (
              <div style={{ display: 'flex', gap: 0, marginBottom: 28, border: `1px solid ${C.rule}` }}>
                {(['login', 'register'] as AuthMode[]).map((m, i) => (
                  <button key={m} onClick={() => handleTabClick(m)} style={{
                    flex: 1, padding: '11px 0',
                    background: authMode === m ? C.rs : 'transparent',
                    border: 'none', borderRight: i === 0 ? `1px solid ${C.rule}` : 'none',
                    color: authMode === m ? C.g1 : C.ink3,
                    fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
                    cursor: 'pointer', transition: 'all .2s ease',
                  }}>
                    {m === 'login' ? 'Sign In' : 'Register'}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            {error && (
              <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--bear-bg)', border: '1px solid var(--bear-dim, color-mix(in srgb, var(--bear) 30%, transparent))', color: 'var(--bear)', fontFamily: SANS, fontSize: 13 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--bull-bg)', border: '1px solid var(--bull-dim, color-mix(in srgb, var(--bull) 30%, transparent))', color: 'var(--bull)', fontFamily: SANS, fontSize: 13 }}>
                {success}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {authMode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: C.ink4, marginBottom: 8 }}>Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Rajesh Kumar" required style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = C.g2)}
                    onBlur={e => (e.currentTarget.style.borderColor = C.rule)}/>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: C.ink4, marginBottom: 8 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = C.g2)}
                  onBlur={e => (e.currentTarget.style.borderColor = C.rule)}/>
              </div>

              {authMode !== 'forgot' && (
                <div>
                  <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: C.ink4, marginBottom: 8 }}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6} style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = C.g2)}
                    onBlur={e => (e.currentTarget.style.borderColor = C.rule)}/>
                  {authMode === 'register' && (
                    <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.14em', color: C.ink4, margin: '6px 0 0' }}>Minimum 6 characters</p>
                  )}
                </div>
              )}

              {authMode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: -6 }}>
                  <button type="button" onClick={() => reset('forgot')} style={{ background: 'none', border: 'none', fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.ink3, cursor: 'pointer', transition: 'color .2s ease' }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.g1)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.ink3)}>
                    Forgot password?
                  </button>
                </div>
              )}
              {authMode === 'forgot' && (
                <div style={{ textAlign: 'right', marginTop: -6 }}>
                  <button type="button" onClick={() => reset('login')} style={{ background: 'none', border: 'none', fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.ink3, cursor: 'pointer', transition: 'color .2s ease' }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.g1)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.ink3)}>
                    ← Back to sign in
                  </button>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 0', marginTop: 4,
                background: isSubmitting ? 'rgba(226,185,111,.3)' : `linear-gradient(180deg,rgba(226,185,111,.92),color-mix(in srgb, var(--gold) 92%, transparent))`,
                border: `1px solid ${C.g2}`,
                color: '#0a0a12', fontFamily: SANS, fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'all .25s ease',
              }}
                onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.boxShadow = `0 0 32px ${C.glow}`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}>
                {isSubmitting && <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }}/>}
                {authMode === 'forgot' ? 'Send Reset Link' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>

          {/* Footer note */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.ink4, margin: 0, lineHeight: 1.8 }}>
              Data platform only · Not investment advice<br/>
              <span style={{ color: C.ink3 }}>
                By continuing you agree to our{' '}
                <a href="#" style={{ color: C.g3, textDecoration: 'none' }}>Terms</a>
                {' '}and{' '}
                <a href="#" style={{ color: C.g3, textDecoration: 'none' }}>Privacy Policy</a>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
