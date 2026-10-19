import React, { useEffect } from 'react';
import Icon from './Icon';
import { cx } from './primitives';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// نافذة حوار وسط الشاشة لنماذج الإدخال (حساب، قيد، سند، حركة مخزن...)
const Modal: React.FC<ModalProps> = ({ open, onClose, title, subtitle, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-pop sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
          size === 'xl' && 'sm:max-w-5xl',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-ink-subtle">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-subtle hover:bg-slate-100 hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-slate-50 px-6 py-3.5 sm:rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

export default Modal;

/** تأكيد قبل الحذف */
export const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ open, title, message, confirmLabel = 'حذف', onConfirm, onClose }) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <button onClick={onClose} className="h-10 rounded-lg px-4 text-sm font-medium text-ink-muted hover:bg-slate-100">
          إلغاء
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="h-10 rounded-lg bg-danger-600 px-4 text-sm font-medium text-white hover:bg-danger-700"
        >
          {confirmLabel}
        </button>
      </>
    }
  >
    <div className="flex gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger-50 text-danger-600">
        <Icon name="alert" size={20} />
      </span>
      <div className="text-sm leading-6 text-ink-muted">{message}</div>
    </div>
  </Modal>
);
