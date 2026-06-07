import { useState, useEffect } from 'react';

// Module-level flag — persists for the lifetime of the JS bundle (one browser session).
// Must NOT be set inside useState initializer: React.StrictMode calls lazy initializers
// twice, so the flag would be true on the second call and the modal would never open.
// useEffect fires once after commit and its state update survives the Strict Mode
// simulated remount, making it the correct place to trigger the one-time show.
let welcomeShown = false;

export default function BetaWelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!welcomeShown) {
      welcomeShown = true;
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
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
            onClick={() => setIsOpen(false)}
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
