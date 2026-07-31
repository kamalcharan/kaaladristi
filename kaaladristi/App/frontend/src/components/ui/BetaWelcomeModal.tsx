import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { updateProfile } from '@/services/auth';

// Shown once per user, tracked SERVER-SIDE (km_profiles.welcome_acked_at,
// migration 167). Previously the ack lived only in localStorage keyed by user
// id, so the modal re-appeared on every new browser / device / incognito
// window — which is defensible for a legal disclaimer but not for a beta
// welcome speech. The legal disclaimer lives in Terms; this modal is a
// welcome and needs to appear once, ever.
//
// localStorage kept as an instant cache so the modal doesn't flash between
// component mount and the first profile hydrate. Mounted in ProtectedRoute so
// it fires on whichever protected page the user lands on first.
//
// The open trigger stays in useEffect (not a useState lazy initializer):
// React.StrictMode double-invokes initializers, while an effect's state
// update survives the simulated remount.
const ackKey = (userId: string) => `kd_welcome_ack_${userId}`;

export default function BetaWelcomeModal() {
  const user             = useAuthStore((s) => s.user);
  const welcomeAckedAt   = useAuthStore((s) => s.profile?.welcome_acked_at);
  const profileReady     = useAuthStore((s) => s.profile != null);
  const refreshProfile   = useAuthStore((s) => s.refreshProfile);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    // Wait for the profile — hasSeen on the DB is the source of truth, and
    // showing the modal before the profile lands would re-flash it on every
    // reload for someone who's already acked.
    if (!profileReady) return;
    if (welcomeAckedAt) return; // acked on any device — never show again
    // Instant-cache check (this device already acked; the DB write may not
    // have hydrated into `profile` yet on this reload).
    try {
      if (localStorage.getItem(ackKey(user.id))) return;
    } catch { /* storage unavailable — fall through and show */ }
    setIsOpen(true);
  }, [user?.id, profileReady, welcomeAckedAt]);

  function acknowledge() {
    const userId = user?.id;
    const now = new Date().toISOString();
    if (userId) {
      // 1. Instant-cache: survive a reload before the DB write completes.
      try { localStorage.setItem(ackKey(userId), now) } catch { /* ignore */ }
      // 2. Server truth: persist so the modal never returns on any device.
      updateProfile({ welcome_acked_at: now })
        .then(() => refreshProfile())
        .catch((err) => console.warn('[BetaWelcomeModal] ack persist failed:', err));
    }
    setIsOpen(false);
    // sequencing hook: lets the page explainer walk (useTour) start only
    // after this modal is out of the way on a user's very first visit
    window.dispatchEvent(new Event('kd:welcome-acked'));
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      style={{ background: 'var(--overlay)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border border-kd-border bg-kd-elevated shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(99,102,241,0.12)' }}
      >
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-5 px-8 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl"
            style={{
              background: 'linear-gradient(135deg, var(--accent-dim), var(--accent-dim))',
              border: '1px solid var(--accent-dim)',
              color: 'var(--accent-gold, #e2b96f)',
            }}
          >
            ✦
          </div>
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: "'Fraunces','Cormorant Garamond',serif" }}
          >
            Welcome to DristiQ Beta
          </h2>
        </div>

        {/* Body */}
        <div className="px-8 pb-6 space-y-4">
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Thank you for joining us on this journey.
          </p>
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            DristiQ is our effort to build something the Indian trading community has never
            had — a fusion of Vedic astronomical intelligence and modern market data, woven
            into a single platform.
          </p>
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            What you see today is the beginning. Panchang cycles, rule-based signals, breadth
            analytics, and VaNi's atmospheric readings are live. Much more is on its way —
            regime intelligence, visual pulse, real-time intraday signals, and deeper
            astronomical layers.
          </p>
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Every stock and index has two views: <strong style={{ color: 'var(--text-primary)' }}>Pulse</strong> gives
            you the 5-second verdict, <strong style={{ color: 'var(--text-primary)' }}>Study</strong> is
            where you verify it with your own overlays and timeframes.
          </p>
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            This is not investment advice. DristiQ is an atmospheric intelligence platform —
            it observes patterns, not predictions.
          </p>

          {/* Disclaimer */}
          <div
            className="pt-4 mt-2 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              All content on DristiQ is for educational and research purposes only.
              Nothing here constitutes investment advice or a recommendation to buy or sell
              any security. Past correlations do not guarantee future results. Trade at your
              own discretion.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="px-8 pb-8">
          <button
            onClick={acknowledge}
            className="w-full py-4 rounded-xl text-[15px] font-semibold transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, var(--accent-indigo, #6366f1), var(--accent-violet, #8b5cf6))',
              color: '#fff',
              boxShadow: '0 4px 20px var(--accent-dim)',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 30px rgba(99,102,241,0.45)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px var(--accent-dim)')}
          >
            I understand — Take me to DristiQ ✦
          </button>
        </div>
      </div>
    </div>
  );
}
