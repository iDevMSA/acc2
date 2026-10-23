import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { IconName } from '../ui/Icon';
import { cx } from '../ui/primitives';
import { useLedger } from '../../context/LedgerContext';
import { NAV_GROUPS } from './navigation';
import { ALL_REPORTS } from '../../lib/reportsExtra';
import { formatNumber } from '../../lib/format';
import { NEW_TARGETS, navActionId } from '../../lib/shortcuts';
import { useShortcuts } from '../../context/ShortcutsContext';
import Kbd from '../ui/Kbd';

// بحث شامل بلوحة المفاتيح (Ctrl+K افتراضياً، قابل للتعديل من نافذة الاختصارات): الصفحات، التقارير، الحسابات، الأصناف — الانتقال من أي مكان لأي مكان
// كما يميّز الأصيل بسهولة التنقل وإمكانية العمل بلوحة المفاتيح دون الفأرة.

interface Hit {
  key: string;
  label: string;
  hint?: string;
  icon: IconName;
  to: string;
  /** أمر الاختصار المرتبط (لعرض اختصاره بجانب النتيجة) */
  action?: string;
}

const QUICK: Hit[] = [
  { key: 'q-sale', label: 'فاتورة بيع جديدة', icon: 'arrowOut', to: NEW_TARGETS.newSale, hint: 'الفواتير', action: 'newSale' },
  { key: 'q-purchase', label: 'فاتورة شراء جديدة', icon: 'arrowIn', to: NEW_TARGETS.newPurchase, hint: 'الفواتير', action: 'newPurchase' },
  { key: 'q-receipt', label: 'سند قبض', icon: 'arrowIn', to: NEW_TARGETS.newReceipt, hint: 'النقدية', action: 'newReceipt' },
  { key: 'q-payment', label: 'سند صرف', icon: 'arrowOut', to: NEW_TARGETS.newPayment, hint: 'النقدية', action: 'newPayment' },
  { key: 'q-shortcuts', label: 'اختصارات لوحة المفاتيح', icon: 'keyboard', to: '/settings/shortcuts', hint: 'الإعدادات', action: 'shortcutsSettings' },
];

const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { accounts, items, balances, mainCurrency } = useLedger();
  const { bindings } = useShortcuts();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim();
    const pages: Hit[] = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ key: `p${i.path}`, label: i.label, hint: g.label, icon: i.icon, to: i.path, action: navActionId(i.path) })));
    if (!s) return [...QUICK, ...pages];
    const m = (t?: string) => !!t && t.toLowerCase().includes(s.toLowerCase());
    const reports: Hit[] = ALL_REPORTS.filter((r) => m(r.title) || m(r.description)).map((r) => ({
      key: `r${r.id}`,
      label: r.title,
      hint: `تقرير · ${r.group}`,
      icon: 'chart',
      to: `/reports?r=${r.id}`,
    }));
    const accs: Hit[] = accounts
      .filter((a) => m(a.name) || m(a.code) || a.id === s || m(a.phone))
      .slice(0, 12)
      .map((a) => ({
        key: `a${a.id}`,
        label: a.name,
        hint: `حساب ${a.id} · ${formatNumber(Math.abs(balances[a.id]?.total || 0))} ${mainCurrency}`,
        icon: 'ledger',
        to: `/accounts/${a.id}`,
      }));
    const its: Hit[] = items
      .filter((i) => m(i.name) || m(i.code) || m(i.barcode))
      .slice(0, 8)
      .map((i) => ({ key: `i${i.id}`, label: i.name, hint: `صنف ${i.code || ''}`, icon: 'box', to: '/warehouses?tab=items' }));
    return [...QUICK.filter((h) => m(h.label)), ...pages.filter((p) => m(p.label) || m(p.hint)), ...accs, ...reports, ...its].slice(0, 40);
  }, [q, accounts, items, balances, mainCurrency]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (h?: Hit) => {
    if (!h) return;
    navigate(h.to);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={18} className="text-ink-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') go(hits[active]);
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="ابحث عن صفحة أو حساب أو تقرير أو صنف..."
            className="h-14 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-subtle">Esc</kbd>
        </div>
        <ul ref={list} className="max-h-[55vh] overflow-y-auto p-2">
          {hits.map((h, i) => (
            <li key={h.key}>
              <button
                data-i={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm', i === active ? 'bg-brand-50 text-brand-800' : 'text-ink')}
              >
                <Icon name={h.icon} size={16} className="shrink-0 text-ink-subtle" />
                <span className="flex-1 truncate">{h.label}</span>
                {h.hint && <span className="num shrink-0 text-xs text-ink-subtle">{h.hint}</span>}
                {h.action && bindings[h.action] && <Kbd combo={bindings[h.action]} size="sm" className="shrink-0" />}
              </button>
            </li>
          ))}
          {!hits.length && <li className="px-3 py-8 text-center text-sm text-ink-subtle">لا نتائج</li>}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;
