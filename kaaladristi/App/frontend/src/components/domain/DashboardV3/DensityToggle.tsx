export type Density = 'calm' | 'standard' | 'terminal';

interface DensityToggleProps {
  density: Density;
  onChange: (d: Density) => void;
}

const modes: { key: Density; label: string; tip: string }[] = [
  { key: 'calm',     label: 'CALM',     tip: "Today's read only" },
  { key: 'standard', label: 'STANDARD', tip: 'Read + context' },
  { key: 'terminal', label: 'TERMINAL', tip: 'Full cockpit' },
];

export default function DensityToggle({ density, onChange }: DensityToggleProps) {
  return (
    <div
      className="inline-flex"
      style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 2, gap: 2 }}
    >
      {modes.map(m => (
        <button
          key={m.key}
          title={m.tip}
          onClick={() => onChange(m.key)}
          style={{
            fontFamily: 'var(--font-mono)',
            padding: '5px 10px',
            fontSize: 9.5,
            letterSpacing: '0.18em',
            background: density === m.key ? 'rgba(212,168,75,0.12)' : 'transparent',
            color: density === m.key ? 'var(--gold)' : 'var(--text-faint)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
