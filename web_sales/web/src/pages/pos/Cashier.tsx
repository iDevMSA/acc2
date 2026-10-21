import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePos, useScanRelay } from '../../context/PosContext';
import { useApp } from '../../context/AppContext';
import { Badge, Button, EmptyState, Spinner, cx } from '../../components/ui/primitives';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { Field, FormError, Input, Segmented } from '../../components/ui/Form';
import BarcodeScanner from '../../components/pos/BarcodeScanner';
import { ProductQuickAdd } from '../../components/pos/PosForms';
import { CatalogEntry, PAY_LABELS, PayMethod, PosInvoiceItem, PosProduct, PosSession, cartTotals, priceForBranch } from '../../lib/pos';
import { formatNumber, formatTime } from '../../lib/format';

// واجهة الكاشير (تعمل على الهاتف أولاً): جلسة الصندوق، مسح الباركود بالكاميرا أو بماسح USB/بلوتوث،
// سلة البيع والدفع. ووضع "ماسح فقط" يحوّل الهاتف إلى ماسح لاسلكي لشاشة الكاشير على الكمبيوتر.

type Mode = 'sell' | 'scanner';

const num = (v: string) => v.replace(/[^0-9.]/g, '');

const Cashier: React.FC = () => {
  const pos = usePos();
  const { user, logout } = useApp();
  const { ready, isCashier, me, registers, branches, warehouses, products, sessions, productMeta, catalog, currency } = pos;

  const [pickedRegister, setPickedRegister] = useState<string>(() => {
    try {
      return localStorage.getItem('pos.register') || '';
    } catch {
      return '';
    }
  });
  const registerId = isCashier ? me?.cashRegisterId || '' : pickedRegister || registers[0]?.id || '';
  const register = registers.find((r) => r.id === registerId);
  const branch = branches.find((b) => b.id === register?.branchId);
  const session = sessions.find((s) => s.registerId === registerId && !s.closedAt) || null;
  const sessionOpen = !!(session && register?.sessionOpen);
  const canManage = !isCashier || me?.role === 'manager';

  const branchWh = useMemo(() => new Set(warehouses.filter((w) => w.branchId === register?.branchId).map((w) => w.id)), [warehouses, register]);
  const sellable = useMemo(() => products.filter((p) => !branchWh.size || branchWh.has(p.warehouseId)), [products, branchWh]);

  const [mode, setMode] = useState<Mode>('sell');
  const [cart, setCart] = useState<PosInvoiceItem[]>([]);
  const [q, setQ] = useState('');
  const [scan, setScan] = useState(false);
  const [unknown, setUnknown] = useState<{ code: string; entry: CatalogEntry | null; loading: boolean } | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ code: string; entry: CatalogEntry | null } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sessionModal, setSessionModal] = useState<'open' | 'close' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [relayed, setRelayed] = useState<string[]>([]);
  const wedge = useRef<HTMLInputElement>(null);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast((x) => (x === t ? null : x)), 1800);
  };

  const addProduct = useCallback(
    (p: PosProduct, qty = 1) => {
      setCart((c) => {
        const i = c.findIndex((x) => x.productId === p.id);
        if (i >= 0) return c.map((x, j) => (j === i ? { ...x, quantity: x.quantity + qty } : x));
        return [
          ...c,
          { productId: p.id, productName: p.name, quantity: qty, unitPrice: priceForBranch(p, register?.branchId), vatRate: p.vatRate, barcode: p.barcode || null },
        ];
      });
      flash(`أُضيف: ${p.name}`);
    },
    [register],
  );

  const onCode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      if (mode === 'scanner') {
        if (!registerId) return flash('لا يوجد صندوق مرتبط');
        await pos.relayScan(registerId, code).catch(() => undefined);
        setRelayed((r) => [code, ...r].slice(0, 8));
        return;
      }
      const p = sellable.find((x) => x.barcode === code) || products.find((x) => x.barcode === code);
      if (p) {
        if (!sellable.includes(p)) flash('تنبيه: المنتج من مخزن فرع آخر');
        return addProduct(p);
      }
      setUnknown({ code, entry: catalog[code] || null, loading: !catalog[code] });
      if (!catalog[code]) {
        const entry = await pos.resolveBarcode(code).catch(() => null);
        setUnknown((u) => (u && u.code === code ? { ...u, entry, loading: false } : u));
      }
    },
    [mode, registerId, sellable, products, catalog, pos, addProduct],
  );

  // الأكواد القادمة من هاتف الكاشير (وضع الماسح) على شاشة الكمبيوتر
  useScanRelay(mode === 'sell' ? registerId : null, (code) => onCode(code));

  // ماسح USB/بلوتوث يكتب الكود ثم Enter: نبقي حقل الإدخال جاهزاً على الكمبيوتر
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) wedge.current?.focus();
  }, [mode, sessionOpen]);

  const results = useMemo(() => {
    const s = q.trim();
    const base = s ? sellable.filter((p) => p.name.includes(s) || (p.barcode || '').includes(s) || (p.category || '').includes(s)) : sellable;
    return base.slice(0, 60);
  }, [q, sellable]);

  const totals = cartTotals(cart);

  if (!ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  if (isCashier && !me) {
    return (
      <CenterCard icon="lock" title="حسابك غير مفعّل" text="لم يعد حسابك مرتبطاً بنقطة بيع. تواصل مع صاحب الشركة." action={<Button variant="secondary" onClick={logout}>تسجيل الخروج</Button>} />
    );
  }
  if (!register) {
    return (
      <CenterCard
        icon="wallet"
        title="لا يوجد صندوق مرتبط"
        text={isCashier ? 'اطلب من صاحب الشركة ربط حسابك بصندوق كاشير.' : 'أنشئ فرعاً وصندوقاً من لوحة تحكم نقطة البيع أولاً.'}
        action={isCashier ? <Button variant="secondary" onClick={logout}>تسجيل الخروج</Button> : <Link className="text-sm font-medium text-brand-600" to="/pos-admin">لوحة تحكم نقطة البيع</Link>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* الترويسة */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 px-4 py-3 text-white shadow-card">
        <div className="min-w-0">
          <p className="text-xs text-white/60">{branch?.name || 'فرع'} · {me?.name || user?.displayName || user?.email}</p>
          <div className="flex items-center gap-2">
            {isCashier ? (
              <h1 className="truncate text-lg font-bold">{register.name}</h1>
            ) : (
              <select
                value={registerId}
                onChange={(e) => {
                  setPickedRegister(e.target.value);
                  try {
                    localStorage.setItem('pos.register', e.target.value);
                  } catch {
                    // لا شيء
                  }
                }}
                className="h-9 rounded-lg bg-white/15 px-2 text-sm font-bold text-white"
              >
                {registers.map((r) => (
                  <option key={r.id} value={r.id} className="text-ink">
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold', sessionOpen ? 'bg-emerald-400/25 text-emerald-100' : 'bg-rose-400/25 text-rose-100')}>
              {sessionOpen ? `جلسة مفتوحة منذ ${formatTime(session!.openedAt)}` : 'الجلسة مغلقة'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-white/10 p-1">
            <div className="grid grid-cols-2 gap-1">
              {(['sell', 'scanner'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cx('h-8 rounded-md px-3 text-xs font-semibold', mode === m ? 'bg-white text-brand-800' : 'text-white/80')}
                >
                  {m === 'sell' ? 'بيع' : 'ماسح للكمبيوتر'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setSessionModal(sessionOpen ? 'close' : 'open')}
            className={cx('h-9 rounded-lg px-3 text-sm font-semibold', sessionOpen ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white')}
          >
            {sessionOpen ? 'إغلاق الجلسة' : 'فتح الجلسة'}
          </button>
          {isCashier && (
            <button onClick={logout} title="تسجيل الخروج" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
              <Icon name="logout" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* المسح */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setScan(true)}
          disabled={mode === 'sell' && !sessionOpen}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-bold text-white shadow-card disabled:opacity-50 sm:flex-none sm:px-8"
        >
          <Icon name="barcode" size={20} /> {mode === 'scanner' ? 'تشغيل الماسح' : 'مسح بالكاميرا'}
        </button>
        <form
          className="hidden flex-1 sm:block"
          onSubmit={(e) => {
            e.preventDefault();
            const v = wedge.current?.value || '';
            if (wedge.current) wedge.current.value = '';
            onCode(v);
          }}
        >
          <input
            ref={wedge}
            disabled={mode === 'sell' && !sessionOpen}
            placeholder="باركود (ماسح USB / بلوتوث أو كتابة يدوية) ثم Enter"
            className="num h-14 w-full rounded-xl border border-line-strong bg-surface px-4 text-base shadow-card outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </form>
      </div>

      {mode === 'scanner' ? (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm text-ink-muted">
            الهاتف الآن ماسح لاسلكي: كل باركود تمسحه يظهر فوراً في سلة <b>{register.name}</b> على شاشة الكمبيوتر (افتح نفس الحساب على الكمبيوتر على صفحة الكاشير).
          </p>
          <ul className="mt-4 space-y-2">
            {relayed.map((c, i) => (
              <li key={`${c}${i}`} className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
                <Icon name="check" size={16} /> <span className="num">{c}</span> أُرسل للكمبيوتر
              </li>
            ))}
          </ul>
        </div>
      ) : !sessionOpen ? (
        <EmptyState icon="lock" title="الجلسة مغلقة" description="افتح الجلسة بنقدية الصندوق الافتتاحية لبدء البيع." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* المنتجات */}
          <div className="min-w-0">
            <div className="relative mb-3">
              <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث باسم المنتج أو الباركود..."
                className="h-11 w-full rounded-xl border border-line bg-surface pe-3 ps-9 text-sm shadow-card outline-none"
              />
            </div>
            {results.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {results.map((p) => {
                  const img = productMeta[p.id]?.imageUrl || (p.barcode ? catalog[p.barcode]?.imageUrl : undefined);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-start shadow-card transition active:scale-[0.98]"
                    >
                      <div className="grid h-24 place-items-center bg-slate-50">
                        {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-contain p-1" /> : <Icon name="box" size={28} className="text-ink-faint" />}
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-2 text-xs font-medium leading-5">{p.name}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="num text-sm font-bold text-brand-700">{formatNumber(priceForBranch(p, register.branchId))}</span>
                          <span className={cx('num text-[10px]', p.quantity <= 0 ? 'text-danger-600' : 'text-ink-subtle')}>{formatNumber(p.quantity, 0)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="box" title="لا توجد منتجات" description="امسح باركود لإضافة منتج جديد من قاعدة المنتجات العالمية." />
            )}
          </div>

          {/* السلة */}
          <div className="h-fit rounded-2xl border border-line bg-surface shadow-card lg:sticky lg:top-0">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-semibold">السلة ({cart.length})</p>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-danger-600">
                  تفريغ
                </button>
              )}
            </div>
            <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto">
              {cart.map((i, idx) => (
                <li key={i.productId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.productName}</p>
                    <p className="num text-xs text-ink-subtle">
                      {formatNumber(i.unitPrice)} × {i.quantity}
                      {i.vatRate ? ` + ${i.vatRate}%` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <QtyBtn onClick={() => setCart((c) => c.map((x, j) => (j === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}>−</QtyBtn>
                    <span className="num w-7 text-center text-sm font-semibold">{i.quantity}</span>
                    <QtyBtn onClick={() => setCart((c) => c.map((x, j) => (j === idx ? { ...x, quantity: x.quantity + 1 } : x)))}>+</QtyBtn>
                    <button onClick={() => setCart((c) => c.filter((_, j) => j !== idx))} className="grid h-8 w-8 place-items-center text-ink-subtle hover:text-danger-600">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </li>
              ))}
              {!cart.length && <li className="px-4 py-8 text-center text-sm text-ink-subtle">امسح منتجاً أو اضغط عليه لإضافته</li>}
            </ul>
            <div className="space-y-1 border-t border-line px-4 py-3 text-sm">
              <Row label="المجموع" value={totals.subtotal} />
              {totals.vat > 0 && <Row label="الضريبة" value={totals.vat} />}
              <Row label="الإجمالي" value={totals.rounded} strong currency={currency} />
            </div>
            <div className="p-3 pt-0">
              <Button className="h-12 w-full text-base" disabled={!cart.length} onClick={() => setCheckoutOpen(true)}>
                الدفع
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center md:bottom-8">
          <span className="rounded-full bg-ink px-4 py-2 text-sm text-white shadow-pop">{toast}</span>
        </div>
      )}

      <BarcodeScanner open={scan} continuous onClose={() => setScan(false)} onDetected={onCode} title={mode === 'scanner' ? 'ماسح للكمبيوتر' : 'امسح المنتجات'} />

      {/* منتج غير مسجّل */}
      <Modal open={!!unknown} onClose={() => setUnknown(null)} size="sm" title="منتج غير مسجّل في مخازنك" subtitle={<span className="num">{unknown?.code}</span>}>
        {unknown?.loading ? (
          <div className="flex items-center gap-3 py-6 text-sm text-ink-subtle">
            <Spinner /> نبحث في قاعدة المنتجات العالمية...
          </div>
        ) : unknown?.entry ? (
          <div className="flex gap-4">
            {unknown.entry.imageUrl && <img src={unknown.entry.imageUrl} alt="" className="h-28 w-28 shrink-0 rounded-lg bg-slate-50 object-contain" />}
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{unknown.entry.name}</p>
              {unknown.entry.quantity && <p className="text-ink-subtle">{unknown.entry.quantity}</p>}
              <p className="mt-1 text-xs text-ink-faint">المصدر: {unknown.entry.source}</p>
            </div>
          </div>
        ) : (
          <p className="py-2 text-sm text-ink-muted">لم نجد هذا الباركود في قواعد المنتجات العالمية. يمكن إضافته يدوياً.</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setUnknown(null)}>
            إغلاق
          </Button>
          {canManage ? (
            <Button
              icon="plus"
              disabled={unknown?.loading}
              onClick={() => {
                setQuickAdd({ code: unknown!.code, entry: unknown!.entry });
                setUnknown(null);
              }}
            >
              إضافة للمخزن
            </Button>
          ) : (
            <Badge tone="warning">اطلب من المدير إضافته</Badge>
          )}
        </div>
      </Modal>

      {quickAdd && (
        <ProductQuickAdd
          open
          barcode={quickAdd.code}
          entry={quickAdd.entry}
          defaultWarehouseId={Array.from(branchWh)[0] || warehouses[0]?.id || ''}
          onClose={() => setQuickAdd(null)}
          onSaved={(p) => {
            setQuickAdd(null);
            addProduct(p);
          }}
        />
      )}

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cart}
        currency={currency}
        onConfirm={async (input) => {
          const r = await pos.checkout(registerId, { ...input, items: cart });
          setCart([]);
          return r;
        }}
      />
      <SessionModal mode={sessionModal} onClose={() => setSessionModal(null)} registerId={registerId} session={session} currency={currency} />
    </div>
  );
};

const QtyBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-base font-bold">
    {children}
  </button>
);

const Row: React.FC<{ label: string; value: number; strong?: boolean; currency?: string }> = ({ label, value, strong, currency }) => (
  <div className={cx('flex items-center justify-between', strong && 'pt-1 text-lg font-bold')}>
    <span className={strong ? 'text-ink' : 'text-ink-muted'}>{label}</span>
    <span className="num">
      {formatNumber(value)} {currency && <span className="text-xs font-normal text-ink-subtle">{currency}</span>}
    </span>
  </div>
);

const CenterCard: React.FC<{ icon: 'lock' | 'wallet'; title: string; text: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <div className="mx-auto mt-10 max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-ink-faint">
      <Icon name={icon} size={22} />
    </span>
    <p className="mt-3 font-semibold">{title}</p>
    <p className="mt-1 text-sm text-ink-subtle">{text}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ───────── الدفع ───────── */

const CheckoutModal: React.FC<{
  open: boolean;
  onClose: () => void;
  items: PosInvoiceItem[];
  currency: string;
  onConfirm: (i: { method: PayMethod; paid: number; discount: number; customerName?: string; customerPhone?: string; bankName?: string }) => Promise<{ number: string; change: number }>;
}> = ({ open, onClose, items, currency, onConfirm }) => {
  const [method, setMethod] = useState<PayMethod>('cash');
  const [paid, setPaid] = useState('');
  const [discount, setDiscount] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ number: string; change: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMethod('cash');
    setPaid('');
    setDiscount('');
    setName('');
    setPhone('');
    setBank('');
    setErr(null);
    setDone(null);
  }, [open]);

  const t = cartTotals(items, Number(discount) || 0);
  const change = (Number(paid) || 0) - t.rounded;

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      setDone(
        await onConfirm({
          method,
          paid: method === 'cash' ? Number(paid) || t.rounded : t.rounded,
          discount: Number(discount) || 0,
          customerName: name,
          customerPhone: phone,
          bankName: bank,
        }),
      );
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={done ? 'تمت العملية' : 'الدفع'}
      footer={
        done ? (
          <Button className="w-full" onClick={onClose}>
            فاتورة جديدة
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              رجوع
            </Button>
            <Button onClick={confirm} disabled={busy}>
              تأكيد الدفع
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-50 text-success-600">
            <Icon name="check" size={28} />
          </span>
          <p className="mt-3 text-sm text-ink-subtle">رقم الفاتورة</p>
          <p className="num text-lg font-bold">{done.number}</p>
          {done.change > 0 && (
            <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 font-semibold text-warning-700">
              الباقي للزبون: <span className="num">{formatNumber(done.change)}</span> {currency}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <p className="text-xs text-ink-subtle">المطلوب</p>
            <p className="num text-3xl font-bold">
              {formatNumber(t.rounded)} <span className="text-sm font-normal text-ink-subtle">{currency}</span>
            </p>
          </div>
          <Segmented
            value={method}
            onChange={setMethod}
            options={(['cash', 'card', 'transfer'] as PayMethod[]).map((m) => ({ value: m, label: PAY_LABELS[m] }))}
          />
          {method === 'cash' && (
            <Field label="المبلغ المستلم" hint={change >= 0 && paid ? `الباقي: ${formatNumber(change)}` : undefined}>
              <Input autoFocus inputMode="decimal" value={paid} onChange={(e) => setPaid(num(e.target.value))} className="num h-12 text-lg" placeholder={formatNumber(t.rounded)} />
            </Field>
          )}
          {method === 'transfer' && (
            <Field label="البنك / المحفظة">
              <Input value={bank} onChange={(e) => setBank(e.target.value)} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="خصم">
              <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(num(e.target.value))} className="num" />
            </Field>
            <Field label="جوال الزبون">
              <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="num" />
            </Field>
          </div>
          <Field label="اسم الزبون (اختياري)">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
      )}
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── فتح / إغلاق الجلسة ───────── */

const SessionModal: React.FC<{ mode: 'open' | 'close' | null; onClose: () => void; registerId: string; session: PosSession | null; currency: string }> = ({
  mode,
  onClose,
  registerId,
  session,
  currency,
}) => {
  const { openSession, closeSession } = usePos();
  const [cash, setCash] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCash('');
    setNote('');
    setErr(null);
  }, [mode]);

  const r = ((session as any)?.running || {}) as Record<string, number>;
  const expected = (session?.openingCash || 0) + (r.cash || 0);
  const diff = (Number(cash) || 0) - expected;

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'open') await openSession(registerId, Number(cash) || 0);
      else if (session) await closeSession(session, Number(cash) || 0, note);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر التنفيذ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!mode}
      onClose={onClose}
      size="sm"
      title={mode === 'open' ? 'فتح جلسة الصندوق' : 'إغلاق الجلسة وجرد الصندوق'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant={mode === 'close' ? 'danger' : 'primary'} onClick={submit} disabled={busy}>
            {mode === 'open' ? 'فتح الجلسة' : 'إغلاق الجلسة'}
          </Button>
        </>
      }
    >
      {mode === 'close' && session && (
        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          {[
            ['عدد الفواتير', r.count || 0, 0],
            ['المبيعات', r.total || 0, 2],
            ['نقدي', r.cash || 0, 2],
            ['بطاقة + تحويل', (r.card || 0) + (r.transfer || 0), 2],
            ['نقدية افتتاحية', session.openingCash || 0, 2],
            ['النقدية المتوقعة', expected, 2],
          ].map(([l, v, d]) => (
            <div key={l as string} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-ink-subtle">{l}</p>
              <p className="num font-semibold">{formatNumber(v as number, d as number)}</p>
            </div>
          ))}
        </div>
      )}
      <Field label={mode === 'open' ? `النقدية الافتتاحية في الصندوق (${currency})` : `النقدية المعدودة فعلياً (${currency})`}>
        <Input autoFocus inputMode="decimal" value={cash} onChange={(e) => setCash(num(e.target.value))} className="num h-12 text-lg" />
      </Field>
      {mode === 'close' && cash !== '' && (
        <p className={cx('mt-2 rounded-lg px-3 py-2 text-sm font-semibold', Math.abs(diff) < 0.005 ? 'bg-success-50 text-success-700' : diff > 0 ? 'bg-info-50 text-info-700' : 'bg-danger-50 text-danger-700')}>
          {Math.abs(diff) < 0.005 ? 'الصندوق مطابق' : diff > 0 ? `زيادة ${formatNumber(diff)}` : `عجز ${formatNumber(-diff)}`}
        </p>
      )}
      {mode === 'close' && (
        <Field label="ملاحظة" className="mt-3">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      )}
      <FormError message={err} />
    </Modal>
  );
};

export default Cashier;
