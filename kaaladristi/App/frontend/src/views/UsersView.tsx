/**
 * UsersView — admin-only user management (/users, migration 140)
 * ================================================================
 * List all users with their current plan; suspend/unsuspend (blocks the
 * NEXT login), reassign plan, extend subscription end date, and physical
 * delete (type-the-email confirmation; audited server-side). The backend
 * re-checks the admin role on every call — this page's gate is cosmetic.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldOff, Shield, CalendarPlus, BadgeCheck, Trash2, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useToast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  fetchAdminUsers, suspendUser, reassignPlan, extendSubscription, deleteUser,
  ADMIN_TIERS, type AdminUser, type AdminTier,
} from '@/services/adminUsers';

const TIER_COLORS: Record<string, string> = {
  free: 'text-muted border-kd-border',
  trial: 'text-accent-cyan border-accent-cyan/40',
  quarterly: 'text-accent-indigo border-accent-indigo/40',
  annual: 'text-accent-gold border-accent-gold/40',
  beta: 'text-risk-amber border-risk-amber/40',
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

type Dialog =
  | { kind: 'plan'; user: AdminUser }
  | { kind: 'extend'; user: AdminUser }
  | { kind: 'delete'; user: AdminUser }
  | null;

export default function UsersView() {
  const { isAdmin, profile } = useAuthStore();
  const qc = useQueryClient();
  const { toasts, toast, dismiss } = useToast();

  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  // dialog form state
  const [planTier, setPlanTier] = useState<AdminTier>('quarterly');
  const [planExpiry, setPlanExpiry] = useState('');
  const [extendDate, setExtendDate] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
    enabled: isAdmin,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });

  const suspendMut = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) => suspendUser(id, suspended),
    onSuccess: (_d, v) => { refresh(); toast('success', v.suspended ? 'User suspended — next login blocked' : 'User unsuspended'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const planMut = useMutation({
    mutationFn: ({ id, tier, exp }: { id: string; tier: AdminTier; exp: string | null }) => reassignPlan(id, tier, exp),
    onSuccess: () => { refresh(); setDialog(null); toast('success', 'Plan reassigned'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const extendMut = useMutation({
    mutationFn: ({ id, exp }: { id: string; exp: string }) => extendSubscription(id, exp),
    onSuccess: () => { refresh(); setDialog(null); toast('success', 'Subscription end date updated'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const deleteMut = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => deleteUser(id, email),
    onSuccess: () => { refresh(); setDialog(null); toast('success', 'User permanently deleted'); },
    onError: (e: Error) => toast('error', e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q)
      || (u.display_name ?? '').toLowerCase().includes(q)
      || (u.full_name ?? '').toLowerCase().includes(q));
  }, [users, search]);

  if (!isAdmin) {
    return <p className="px-6 py-10 text-sm text-muted text-center">Admin access required.</p>;
  }

  const openPlan = (u: AdminUser) => {
    setPlanTier((u.tier ?? 'free') as AdminTier);
    setPlanExpiry('');
    setDialog({ kind: 'plan', user: u });
  };
  const openExtend = (u: AdminUser) => {
    setExtendDate(u.sub_expires_at ? u.sub_expires_at.slice(0, 10) : '');
    setDialog({ kind: 'extend', user: u });
  };
  const openDelete = (u: AdminUser) => {
    setConfirmEmail('');
    setDialog({ kind: 'delete', user: u });
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Users</h1>
        <span className="text-[11px] font-mono text-muted">
          {users.length} accounts · admin actions are audited
        </span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search email or name…"
          className="ml-auto w-64 px-3 py-1.5 bg-kd-elevated border border-kd-border rounded-lg text-xs text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo/60"
        />
      </div>

      {isLoading ? (
        <p className="py-10 text-sm text-muted text-center"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading users…</p>
      ) : error ? (
        <p className="py-10 text-sm text-risk-red/80 text-center font-mono">Failed to load users: {(error as Error).message}</p>
      ) : (
        <div className="rounded-xl border border-kd-border bg-kd-card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-kd-border bg-kd-elevated/60">
                {['User', 'Role', 'Plan', 'Subscription ends', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left text-[10px] font-mono text-muted px-3 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const self = u.id === profile?.id;
                return (
                  <tr key={u.id} className={cn('border-b border-kd-border/40', u.is_suspended && 'opacity-60')}>
                    <td className="px-3 py-2.5">
                      <div className="text-xs text-[var(--text-primary)]">{u.email}</div>
                      <div className="text-[10px] text-muted">{u.display_name ?? u.full_name ?? ''}{self ? ' · you' : ''}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] font-mono">
                      <span className={u.role === 'admin' ? 'text-accent-gold' : 'text-muted'}>{u.role ?? 'user'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono border', TIER_COLORS[u.tier ?? 'free'])}>
                        {u.tier ?? 'free'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-secondary">
                      {fmtDate(u.sub_expires_at)}
                      {u.sub_tier && u.sub_tier !== u.tier && (
                        <span className="text-muted"> ({u.sub_tier})</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] font-mono">
                      {u.is_suspended
                        ? <span className="text-risk-red">suspended</span>
                        : u.onboarded
                          ? <span className="text-risk-green">active</span>
                          : <span className="text-risk-amber">not onboarded</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-muted">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          title={u.is_suspended ? 'Unsuspend — allow login again' : 'Suspend — block next login'}
                          disabled={self || suspendMut.isPending}
                          onClick={() => suspendMut.mutate({ id: u.id, suspended: !u.is_suspended })}
                          className="p-1.5 rounded-lg text-muted hover:text-risk-amber hover:bg-kd-elevated disabled:opacity-30 transition-all"
                        >
                          {u.is_suspended ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          title="Reassign plan"
                          onClick={() => openPlan(u)}
                          className="p-1.5 rounded-lg text-muted hover:text-accent-indigo hover:bg-kd-elevated transition-all"
                        >
                          <BadgeCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Extend subscription end date"
                          onClick={() => openExtend(u)}
                          className="p-1.5 rounded-lg text-muted hover:text-accent-cyan hover:bg-kd-elevated transition-all"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Delete user permanently"
                          disabled={self}
                          onClick={() => openDelete(u)}
                          className="p-1.5 rounded-lg text-muted hover:text-risk-red hover:bg-kd-elevated disabled:opacity-30 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-xs text-muted">No users match "{search}"</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Action dialog ─────────────────────────────────────────────── */}
      {dialog && (
        <>
          <div onClick={() => setDialog(null)} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-kd-surface border border-kd-border rounded-2xl shadow-2xl shadow-black/60 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  {dialog.kind === 'plan' && 'Reassign plan'}
                  {dialog.kind === 'extend' && 'Extend subscription'}
                  {dialog.kind === 'delete' && 'Delete user permanently'}
                </h2>
                <p className="text-[11px] text-muted mt-0.5 font-mono">{dialog.user.email}</p>
              </div>
              <button onClick={() => setDialog(null)} className="text-muted hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {dialog.kind === 'plan' && (
              <>
                <div className="flex flex-wrap gap-2">
                  {ADMIN_TIERS.map(t => (
                    <button
                      key={t}
                      onClick={() => setPlanTier(t)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                        planTier === t
                          ? 'bg-accent-indigo/20 text-accent-indigo border-accent-indigo/50'
                          : 'bg-kd-elevated text-muted border-kd-border hover:border-kd-border-active',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-muted mb-1.5">
                    End date (optional — defaults: trial 14d · quarterly 90d · annual 365d)
                  </label>
                  <input
                    type="date"
                    value={planExpiry}
                    onChange={e => setPlanExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-primary)]"
                  />
                </div>
                <button
                  onClick={() => planMut.mutate({ id: dialog.user.id, tier: planTier, exp: planExpiry || null })}
                  disabled={planMut.isPending}
                  className="w-full py-2.5 rounded-xl bg-accent-indigo/20 border border-accent-indigo/40 text-sm font-semibold text-accent-indigo hover:bg-accent-indigo/30 disabled:opacity-50 transition-all"
                >
                  {planMut.isPending ? 'Saving…' : `Set plan to ${planTier}`}
                </button>
              </>
            )}

            {dialog.kind === 'extend' && (
              <>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-muted mb-1.5">
                    New end date (current: {fmtDate(dialog.user.sub_expires_at)})
                  </label>
                  <input
                    type="date"
                    value={extendDate}
                    onChange={e => setExtendDate(e.target.value)}
                    className="w-full px-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-primary)]"
                  />
                </div>
                <button
                  onClick={() => extendDate && extendMut.mutate({ id: dialog.user.id, exp: extendDate })}
                  disabled={!extendDate || extendMut.isPending}
                  className="w-full py-2.5 rounded-xl bg-accent-cyan/15 border border-accent-cyan/40 text-sm font-semibold text-accent-cyan hover:bg-accent-cyan/25 disabled:opacity-50 transition-all"
                >
                  {extendMut.isPending ? 'Saving…' : 'Update end date'}
                </button>
              </>
            )}

            {dialog.kind === 'delete' && (
              <>
                <p className="text-xs text-risk-red/90 leading-relaxed">
                  This permanently deletes the account, profile, subscriptions, workspace framework,
                  and VaNi history. It cannot be undone. Type the user's email to confirm.
                </p>
                <input
                  type="text"
                  value={confirmEmail}
                  onChange={e => setConfirmEmail(e.target.value)}
                  placeholder={dialog.user.email}
                  spellCheck={false}
                  className="w-full px-3 py-2 bg-kd-elevated border border-risk-red/40 rounded-xl text-xs font-mono text-[var(--text-primary)] placeholder:text-muted focus:outline-none"
                />
                <button
                  onClick={() => deleteMut.mutate({ id: dialog.user.id, email: confirmEmail })}
                  disabled={confirmEmail.trim().toLowerCase() !== dialog.user.email.toLowerCase() || deleteMut.isPending}
                  className="w-full py-2.5 rounded-xl bg-risk-red/15 border border-risk-red/40 text-sm font-semibold text-risk-red hover:bg-risk-red/25 disabled:opacity-40 transition-all"
                >
                  {deleteMut.isPending ? 'Deleting…' : 'Delete permanently'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
