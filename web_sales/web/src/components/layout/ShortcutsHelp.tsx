import React from 'react';
import { Link } from 'react-router-dom';
import Modal from '../ui/Modal';
import Kbd from '../ui/Kbd';
import { useShortcuts } from '../../context/ShortcutsContext';
import { SHORTCUT_ACTIONS, SHORTCUT_GROUPS } from '../../lib/shortcuts';

// قائمة سريعة بالاختصارات المفعّلة (Ctrl+/) مع رابط لنافذة تعديلها في الإعدادات
const ShortcutsHelp: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { bindings } = useShortcuts();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="اختصارات لوحة المفاتيح"
      subtitle="الاختصارات المفعّلة حالياً لحسابك"
      size="lg"
      footer={
        <Link
          to="/settings/shortcuts"
          onClick={onClose}
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          تخصيص الاختصارات
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {SHORTCUT_GROUPS.map((g) => {
          const rows = SHORTCUT_ACTIONS.filter((a) => a.group === g && bindings[a.id]);
          if (!rows.length) return null;
          return (
            <section key={g}>
              <h3 className="mb-2 text-xs font-semibold text-ink-subtle">{g}</h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {rows.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="truncate text-ink">{a.label}</span>
                    <Kbd combo={bindings[a.id]} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <section>
          <h3 className="mb-2 text-xs font-semibold text-ink-subtle">ثابتة</h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-ink">إغلاق النافذة المفتوحة</span>
              <Kbd combo="Esc" />
            </li>
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-ink">التنقل في نتائج البحث</span>
              <Kbd combo="↑+↓" />
            </li>
          </ul>
        </section>
      </div>
    </Modal>
  );
};

export default ShortcutsHelp;
