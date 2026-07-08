export type KickerTier = 'opportunity' | 'heads-up' | 'caution' | 'info';

interface KickerProps {
  label: string;
  tag?: string;
  tier?: KickerTier;
  className?: string;
}

const tierColor: Record<KickerTier, string> = {
  'opportunity': 'var(--gold)',
  'heads-up':    'var(--indigo)',
  'caution':     'var(--caution)',
  'info':        'var(--text-faint)',
};

const tierTagBg: Record<KickerTier, string> = {
  'opportunity': 'var(--gold-bg)',
  'heads-up':    'var(--indigo-bg)',
  'caution':     'var(--caution-bg)',
  'info':        'color-mix(in srgb, var(--text-primary) 5%, transparent)',
};

export default function Kicker({ label, tag, tier = 'info', className = '' }: KickerProps) {
  const color = tierColor[tier];
  const tagBg = tierTagBg[tier];

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}
    >
      <span>{label}</span>
      {tag && (
        <span style={{ padding: '1px 7px', background: tagBg, borderRadius: 3 }}>
          {tag}
        </span>
      )}
    </div>
  );
}
