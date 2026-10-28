import { NAV_GROUPS } from '../components/layout/navigation';

// اختصارات لوحة المفاتيح: قائمة الأوامر واختصاراتها الافتراضية، وقراءة ضغطة المفاتيح وكتابتها والتحقق منها.
// الاختصار يُخزَّن نصاً موحّداً مثل "Ctrl+Shift+K"، ويُقرأ من الموقع الفعلي للمفتاح (e.code) لا من الحرف،
// حتى يعمل نفس الاختصار والكيبورد على العربية أو الإنجليزية.

export type ShortcutGroup = 'عام' | 'إنشاء' | 'التنقل';

export interface ShortcutAction {
  /** معرّف ثابت يُحفظ في السحابة (بلا "/" أو "." لأنها ممنوعة في مفاتيح Firebase) */
  id: string;
  label: string;
  group: ShortcutGroup;
  defaultCombo: string;
}

const NAV_DEFAULTS: Record<string, string> = {
  '/': 'Alt+1',
  '/accounts': 'Alt+2',
  '/accounting': 'Alt+3',
  '/reports': 'Alt+4',
  '/cashboxes': 'Alt+5',
  '/vouchers': 'Alt+6',
  '/warehouses': 'Alt+7',
  '/trade': 'Alt+8',
  '/pos': 'Alt+9',
  '/settings': 'Alt+0',
};

export const navActionId = (path: string) => `nav_${path.slice(1).replace(/[^a-z0-9]/gi, '_') || 'home'}`;

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: 'palette', label: 'البحث الشامل', group: 'عام', defaultCombo: 'Ctrl+K' },
  { id: 'save', label: 'حفظ النموذج المفتوح', group: 'عام', defaultCombo: 'Ctrl+S' },
  { id: 'help', label: 'عرض قائمة الاختصارات', group: 'عام', defaultCombo: 'Ctrl+/' },
  { id: 'toggleSidebar', label: 'طي/إظهار القائمة الجانبية', group: 'عام', defaultCombo: 'Ctrl+B' },
  { id: 'shortcutsSettings', label: 'فتح نافذة إعداد الاختصارات', group: 'عام', defaultCombo: '' },
  { id: 'newSale', label: 'فاتورة بيع جديدة', group: 'إنشاء', defaultCombo: 'F2' },
  { id: 'newPurchase', label: 'فاتورة شراء جديدة', group: 'إنشاء', defaultCombo: 'Shift+F2' },
  { id: 'newReceipt', label: 'سند قبض جديد', group: 'إنشاء', defaultCombo: 'F4' },
  { id: 'newPayment', label: 'سند صرف جديد', group: 'إنشاء', defaultCombo: 'Shift+F4' },
  { id: 'newTransfer', label: 'تحويل بين الصناديق', group: 'إنشاء', defaultCombo: '' },
  { id: 'newAccount', label: 'حساب جديد', group: 'إنشاء', defaultCombo: 'F8' },
  { id: 'newEntry', label: 'قيد جديد', group: 'إنشاء', defaultCombo: 'F9' },
  ...NAV_GROUPS.flatMap((g) =>
    g.items.map<ShortcutAction>((i) => ({
      id: navActionId(i.path),
      label: `الانتقال إلى ${i.label}`,
      group: 'التنقل',
      defaultCombo: NAV_DEFAULTS[i.path] || '',
    })),
  ),
];

export const SHORTCUT_GROUPS: ShortcutGroup[] = ['عام', 'إنشاء', 'التنقل'];

/** الأوامر التي تفتح نموذجاً جديداً: إلى أين ننتقل */
export const NEW_TARGETS: Record<string, string> = {
  newSale: '/trade?new=sale',
  newPurchase: '/trade?new=purchase',
  newReceipt: '/vouchers?new=receipt',
  newPayment: '/vouchers?new=payment',
  newTransfer: '/vouchers?new=transfer',
  newAccount: '/accounts?new=account',
  newEntry: '/accounting?new=entry',
};

export const NAV_TARGETS: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [navActionId(i.path), i.path])),
);

/** المستخدم يحفظ ما غيّره فقط: id → اختصار ("" = بلا اختصار) */
export type ShortcutOverrides = Record<string, string>;

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
  'Fn',
]);

const CODE_NAMES: Record<string, string> = {
  Slash: '/',
  Backslash: '\\',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  NumpadAdd: '+',
  NumpadSubtract: '-',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadDecimal: '.',
};

const keyName = (code: string): string | null => {
  if (MODIFIER_CODES.has(code)) return null;
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (m) return m[1];
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return CODE_NAMES[code] || null;
};

/** نص الاختصار من ضغطة مفاتيح، أو null إن كانت مفتاح تعديل وحده (Ctrl، Shift...) */
export const comboFromEvent = (e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string | null => {
  const key = keyName(e.code);
  if (!key) return null;
  const parts: string[] = [];
  // ⌘ على ماك يقوم مقام Ctrl، فيبقى الاختصار المحفوظ واحداً على كل الأجهزة
  if (e.ctrlKey || (isMac && e.metaKey)) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey && !isMac) parts.push('Meta');
  parts.push(key);
  return parts.join('+');
};

/** أجزاء الاختصار للعرض: "Ctrl+Shift+K" → ["Ctrl","Shift","K"] (و"Ctrl++" → ["Ctrl","+"]) */
export const comboParts = (combo: string): string[] => {
  if (!combo) return [];
  const parts = combo.split('+');
  if (combo.endsWith('++')) return [...parts.slice(0, -2), '+'];
  return parts.map((p) => (isMac && p === 'Ctrl' ? '⌘' : isMac && p === 'Alt' ? '⌥' : p));
};

const hasCommand = (combo: string) => /(^|\+)(Ctrl|Alt|Meta)\+/.test(combo);
const lastKey = (combo: string) => (combo.endsWith('++') ? '+' : combo.split('+').pop() || '');
export const isFunctionKey = (combo: string) => /^F([1-9]|1[0-2])$/.test(lastKey(combo));

// اختصارات يحجزها المتصفح أو النظام ولا يمكن للصفحة منعها، أو يحتاجها المستخدم للكتابة
const RESERVED: Record<string, string> = {
  'Ctrl+W': 'يغلق تبويب المتصفح',
  'Ctrl+Shift+W': 'يغلق نافذة المتصفح',
  'Ctrl+T': 'يفتح تبويباً جديداً',
  'Ctrl+Shift+T': 'يعيد فتح آخر تبويب',
  'Ctrl+N': 'يفتح نافذة متصفح جديدة',
  'Ctrl+Shift+N': 'يفتح نافذة خاصة',
  'Ctrl+Tab': 'ينتقل بين التبويبات',
  'Ctrl+Shift+Tab': 'ينتقل بين التبويبات',
  'Ctrl+Q': 'يغلق المتصفح',
  'Ctrl+L': 'ينتقل لشريط العنوان',
  'Ctrl+R': 'يعيد تحميل الصفحة',
  'Ctrl+Shift+R': 'يعيد تحميل الصفحة',
  F5: 'يعيد تحميل الصفحة',
  F11: 'ملء الشاشة',
  F12: 'أدوات المطوّر',
  'Ctrl+Shift+I': 'أدوات المطوّر',
  'Ctrl+Shift+J': 'أدوات المطوّر',
  'Alt+F4': 'يغلق النافذة',
  'Ctrl+C': 'النسخ',
  'Ctrl+V': 'اللصق',
  'Ctrl+X': 'القص',
  'Ctrl+A': 'تحديد الكل',
  'Ctrl+Z': 'التراجع',
  'Ctrl+Y': 'الإعادة',
  'Ctrl+Shift+Z': 'الإعادة',
  'Ctrl+P': 'الطباعة',
  'Ctrl+F': 'البحث في الصفحة',
  'Ctrl+Shift+Delete': 'مسح بيانات التصفح',
};

/** سبب رفض الاختصار، أو null إن كان صالحاً */
export const validateCombo = (combo: string): string | null => {
  if (/^Ctrl\+[1-9]$/.test(combo)) return 'يستخدمه المتصفح للتنقل بين التبويبات';
  if (RESERVED[combo]) return `محجوز: ${RESERVED[combo]}`;
  if (combo === 'Esc') return 'مفتاح Esc مخصص لإغلاق النوافذ';
  if (['Tab', 'Shift+Tab', 'Enter', 'Shift+Enter', 'Backspace'].includes(combo))
    return 'هذا المفتاح يُستخدم في التنقل والكتابة داخل النماذج';
  if (!hasCommand(combo) && !isFunctionKey(combo))
    return 'أضف Ctrl أو Alt مع هذا المفتاح حتى لا يتعارض مع الكتابة (المفاتيح F1–F12 تعمل وحدها)';
  return null;
};

/** الاختصار الفعلي لكل أمر بعد تطبيق تعديلات المستخدم */
export const resolveBindings = (overrides: ShortcutOverrides | undefined): Record<string, string> =>
  Object.fromEntries(SHORTCUT_ACTIONS.map((a) => [a.id, overrides && a.id in overrides ? overrides[a.id] : a.defaultCombo]));

/** الاختصارات المكررة: اختصار → الأوامر التي تستخدمه (أكثر من أمر) */
export const findConflicts = (bindings: Record<string, string>): Record<string, string[]> => {
  const byCombo: Record<string, string[]> = {};
  Object.entries(bindings).forEach(([id, c]) => c && (byCombo[c] ??= []).push(id));
  return Object.fromEntries(Object.entries(byCombo).filter(([, ids]) => ids.length > 1));
};

/** نحفظ فقط ما يختلف عن الافتراضي */
export const toOverrides = (bindings: Record<string, string>): ShortcutOverrides =>
  Object.fromEntries(SHORTCUT_ACTIONS.filter((a) => (bindings[a.id] ?? '') !== a.defaultCombo).map((a) => [a.id, bindings[a.id] ?? '']));

export const actionById = (id: string) => SHORTCUT_ACTIONS.find((a) => a.id === id);

/** هل المؤشر داخل حقل كتابة؟ عندها لا نعترض إلا الاختصارات التي فيها Ctrl/Alt أو مفاتيح F */
export const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

export const shouldHandleWhileTyping = (combo: string) => hasCommand(combo) || isFunctionKey(combo);
