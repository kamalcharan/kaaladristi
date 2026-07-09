import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

const WIDTHS: Record<NonNullable<ModalProps['width']>, string> = {
  sm: '420px',
  md: '560px',
  lg: '720px',
  xl: '900px',
};

/**
 * Modal primitive (Glass UX & Theme Standard §5.2). Rendered via
 * createPortal(document.body) so it escapes the sticky PageHeader's
 * backdrop-blur stacking context. Esc-close + body scroll-lock while open.
 * Visual language matches the existing ad hoc BetaWelcomeModal.tsx
 * (rounded-2xl border-kd-border bg-kd-elevated), which stays as-is —
 * this is the new reusable primitive, not a replacement for it.
 */
export function Modal({ isOpen, onClose, title, footer, width = 'md', children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      style={{ background: 'color-mix(in srgb, var(--bg) 70%, transparent)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className="w-full rounded-2xl border border-kd-border bg-kd-elevated shadow-2xl"
        style={{ maxWidth: WIDTHS[width], animation: 'kd-modal-in .3s var(--ease)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-kd-border px-6 py-4">
            <h3
              className="text-[15px] font-semibold text-kd-text-primary"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-kd-text-muted hover:text-kd-text-primary"
            >
              ✕
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="border-t border-kd-border px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
