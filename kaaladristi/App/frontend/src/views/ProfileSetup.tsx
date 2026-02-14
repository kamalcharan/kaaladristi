import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { updateProfile } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuthStore();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
        onboarded: true,
      });
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      await updateProfile({ onboarded: true });
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'px-4 py-3.5 bg-kd-elevated border border-kd-border rounded-xl text-[15px] text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all w-full';

  return (
    <div className="min-h-screen bg-kd-bg text-[var(--text-primary)] flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-accent-indigo to-accent-violet rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
            &#x27E1;
          </div>
          <h1 className="text-2xl font-semibold mb-2">Complete Your Profile</h1>
          <p className="text-sm text-muted">
            Welcome, <span className="text-[var(--text-primary)]">{profile?.full_name || profile?.email}</span>. Set up your profile to get started.
          </p>
        </div>

        {/* Card */}
        <div className="bg-kd-card border border-kd-border rounded-2xl p-8">
          {error && (
            <div className="mb-6 px-4 py-3 bg-risk-red/10 border border-risk-red/30 rounded-xl text-sm text-risk-red">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Read-only fields */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-secondary">Full Name</label>
              <div className="px-4 py-3.5 bg-kd-elevated/50 border border-kd-border rounded-xl text-[15px] text-muted">
                {profile?.full_name || '—'}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-secondary">Email</label>
              <div className="px-4 py-3.5 bg-kd-elevated/50 border border-kd-border rounded-xl text-[15px] text-muted">
                {profile?.email || '—'}
              </div>
            </div>

            {/* Editable fields */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-secondary">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we address you?"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-secondary">Phone <span className="text-muted">(for WhatsApp alerts)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={inputClass}
              />
            </div>

            {/* Role badge */}
            {profile?.role === 'admin' && (
              <div className="flex items-center gap-2 px-4 py-3 bg-accent-violet/10 border border-accent-violet/30 rounded-xl">
                <div className="w-2 h-2 bg-accent-violet rounded-full" />
                <span className="text-sm text-accent-violet font-medium">Admin Account</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSubmitting}
                className="flex-1 py-3.5 border border-kd-border rounded-xl text-[15px] font-medium text-secondary hover:bg-kd-elevated transition-all disabled:opacity-50"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 bg-gradient-to-r from-accent-indigo to-accent-violet rounded-xl text-[15px] font-semibold text-white shadow-[0_4px_20px_rgba(99,102,241,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save & Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
