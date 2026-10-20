import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { Button } from '../ui/primitives';
import { Field, FormError, Input, SearchSelect, Segmented, Select } from '../ui/Form';
import Icon from '../ui/Icon';
import { useLedger, OpDraft } from '../../context/LedgerContext';
import { useAccountOptions } from './LedgerForms';
import { CURRENCIES, localIso } from '../../lib/ledger';
import { CHEQUE_STATUS, Cheque, ChequeDirection, ChequeStatus } from '../../lib/erp';
import { formatNumber } from '../../lib/format';

/** حسابا الشيكات الوسيطان (أوراق قبض / أوراق دفع) — يُنشآن تلقائياً أول مرة */
const useChequeAccounts = () => {
  const { settings, accountsById, ensureAccount, saveSettings } = useLedger();
  return async (direction: ChequeDirection) => {
    if (direction === 'in') {
      if (settings.chequesInAccountId && accountsById[settings.chequesInAccountId]) return settings.chequesInAccountId;
      const id = await ensureAccount('شيكات واردة (أوراق قبض)', 'asset', 'bank', 'general');
      await saveSettings({ chequesInAccountId: id });
      return id;
    }
    if (settings.chequesOutAccountId && accountsById[settings.chequesOutAccountId]) return settings.chequesOutAccountId;
    const id = await ensureAccount('شيكات صادرة (أوراق دفع)', 'liability', 'bank', 'general');
    await saveSettings({ chequesOutAccountId: id });
    return id;
  };
};

export const ChequeFormModal: React.FC<{ open: boolean; onClose: () => void; direction: ChequeDirection }> = ({
  open,
  onClose,
  direction: initial,
}) => {
  const { createCheque, mainCurrency } = useLedger();
  const options = useAccountOptions();
  const holding = useChequeAccounts();
  const [direction, setDirection] = useState<ChequeDirection>(initial);
  const [f, setF] = useState({ number: '', bank: '', dueDate: '', amount: '', currency: mainCurrency, rate: '1', statement: '' });
  const [party, setParty] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setDirection(initial);
    setParty('');
    setF({ number: '', bank: '', dueDate: localIso().slice(0, 10), amount: '', currency: mainCurrency, rate: '1', statement: '' });
  }, [open, initial, mainCurrency]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(f.amount);
    const rate = Number(f.rate);
    if (!f.number.trim()) return setErr('رقم الشيك مطلوب');
    if (!party) return setErr(direction === 'in' ? 'اختر الساحب (من استلمنا منه الشيك)' : 'اختر المستفيد');
    if (!(amount > 0)) return setErr('أدخل مبلغاً صحيحاً');
    if (!(rate > 0)) return setErr('سعر الصرف غير صالح');
    setBusy(true);
    try {
      const holdId = await holding(direction);
      const base = { currency: f.currency, exchangeRate: rate, date: localIso() };
      const tag = `شيك ${direction === 'in' ? 'وارد' : 'صادر'} رقم ${f.number} ${f.bank ? `(${f.bank})` : ''} استحقاق ${f.dueDate}`;
      const drafts: OpDraft[] =
        direction === 'in'
          ? [
              { ...base, accountId: party, amount: -amount, statement: `${tag} — سُلّم لنا` },
              { ...base, accountId: holdId, amount, statement: `${tag} — في الحافظة` },
            ]
          : [
              { ...base, accountId: party, amount, statement: `${tag} — سُلّم للمستفيد` },
              { ...base, accountId: holdId, amount: -amount, statement: `${tag} — بانتظار السحب` },
            ];
      await createCheque(
        {
          direction,
          number: f.number.trim(),
          bank: f.bank.trim(),
          dueDate: f.dueDate,
          amount,
          currency: f.currency,
          exchangeRate: rate,
          partyId: party,
          status: direction === 'in' ? 'portfolio' : 'issued',
          bankAccountId: null,
          endorsedToId: null,
          statement: f.statement,
        },
        drafts,
      );
      onClose();
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
      title={direction === 'in' ? 'شيك وارد' : 'شيك صادر'}
      subtitle={
        direction === 'in'
          ? 'يُخفَّض رصيد الساحب ويُضاف الشيك إلى حساب الشيكات الواردة (الحافظة)'
          : 'يُخفَّض ما للمستفيد ويُسجَّل الشيك على حساب الشيكات الصادرة حتى يُسحب'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="cheque-form" disabled={busy}>
            حفظ الشيك
          </Button>
        </>
      }
    >
      <form id="cheque-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Segmented
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'in', label: 'شيك وارد', tone: 'success' },
              { value: 'out', label: 'شيك صادر', tone: 'danger' },
            ]}
          />
        </div>
        <Field label="رقم الشيك">
          <Input autoFocus value={f.number} onChange={set('number')} className="num" />
        </Field>
        <Field label="البنك">
          <Input value={f.bank} onChange={set('bank')} />
        </Field>
        <Field label={direction === 'in' ? 'الساحب (من سلّمنا الشيك)' : 'المستفيد'} className="sm:col-span-2">
          <SearchSelect value={party} onChange={setParty} options={options} placeholder="اختر الحساب" />
        </Field>
        <Field label="المبلغ">
          <Input inputMode="decimal" value={f.amount} onChange={set('amount')} className="num text-lg font-semibold" />
        </Field>
        <Field label="تاريخ الاستحقاق">
          <Input type="date" value={f.dueDate} onChange={set('dueDate')} className="num" />
        </Field>
        <Field label="العملة">
          <Select value={f.currency} onChange={set('currency')}>
            {Array.from(new Set([mainCurrency, ...CURRENCIES])).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`سعر الصرف مقابل 1 ${mainCurrency}`}>
          <Input inputMode="decimal" value={f.rate} onChange={set('rate')} disabled={f.currency === mainCurrency} className="num" />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <Input value={f.statement} onChange={set('statement')} />
        </Field>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

const ACTION_LABELS: Record<ChequeStatus, string> = {
  portfolio: 'إعادة إلى الحافظة',
  collecting: 'إيداع في البنك (تحت التحصيل)',
  cleared: 'صرف الشيك',
  returned: 'إرجاع الشيك',
  endorsed: 'تجيير لطرف آخر',
  issued: 'إعادة إصدار',
};

/** تغيير حالة الشيك مع قيوده المحاسبية */
export const ChequeActionModal: React.FC<{ cheque: Cheque | null; status: ChequeStatus | null; onClose: () => void }> = ({
  cheque,
  status,
  onClose,
}) => {
  const { changeChequeStatus, accountsById, accounts, roleOf } = useLedger();
  const options = useAccountOptions();
  const holding = useChequeAccounts();
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = !!cheque && !!status;

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setNote('');
    const firstBank = accounts.find((a) => roleOf(a.id) === 'bank' || a.type === 'bank');
    setAccount(cheque!.bankAccountId || (status === 'endorsed' ? '' : firstBank?.id || ''));
  }, [open, cheque, status, accounts, roleOf]);

  if (!open) return null;
  const c = cheque!;
  const s = status!;
  const needsBank = s === 'collecting' || s === 'cleared';
  const needsParty = s === 'endorsed';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((needsBank || needsParty) && !account) return setErr(needsParty ? 'اختر الطرف المجيَّر له' : 'اختر حساب البنك');
    setBusy(true);
    try {
      const hold = await holding(c.direction);
      const base = { currency: c.currency, exchangeRate: c.exchangeRate, date: localIso() };
      const tag = `شيك رقم ${c.number}`;
      const party = c.partyId;
      let drafts: OpDraft[] = [];
      if (c.direction === 'in') {
        if (s === 'cleared')
          drafts = [
            { ...base, accountId: account, amount: c.amount, statement: `${tag} — صُرف وأودع` },
            { ...base, accountId: hold, amount: -c.amount, statement: `${tag} — صُرف` },
          ];
        if (s === 'endorsed')
          drafts = [
            { ...base, accountId: hold, amount: -c.amount, statement: `${tag} — جُيّر إلى ${accountsById[account]?.name}` },
            { ...base, accountId: account, amount: c.amount, statement: `${tag} — مجيّر لكم من ${accountsById[party]?.name}` },
          ];
        if (s === 'returned') {
          // الشيك المجيّر يُرجع على من جُيّر إليه أولاً (يعود الشيك إلينا ودَين الساحب يعود)
          drafts = [
            { ...base, accountId: hold, amount: -c.amount, statement: `${tag} — مرتجع` },
            { ...base, accountId: party, amount: c.amount, statement: `${tag} — مرتجع، أُعيد الدين` },
          ];
        }
        if (s === 'portfolio')
          drafts = [
            { ...base, accountId: party, amount: -c.amount, statement: `${tag} — أُعيد استلامه` },
            { ...base, accountId: hold, amount: c.amount, statement: `${tag} — عاد إلى الحافظة` },
          ];
      } else {
        if (s === 'cleared')
          drafts = [
            { ...base, accountId: hold, amount: c.amount, statement: `${tag} — سُحب من البنك` },
            { ...base, accountId: account, amount: -c.amount, statement: `${tag} — سُحب` },
          ];
        if (s === 'returned')
          drafts = [
            { ...base, accountId: hold, amount: c.amount, statement: `${tag} — مرتجع` },
            { ...base, accountId: party, amount: -c.amount, statement: `${tag} — مرتجع، عاد المستحق` },
          ];
        if (s === 'issued')
          drafts = [
            { ...base, accountId: party, amount: c.amount, statement: `${tag} — أُعيد إصداره` },
            { ...base, accountId: hold, amount: -c.amount, statement: `${tag} — بانتظار السحب` },
          ];
      }
      await changeChequeStatus(c, s, drafts, {
        bankAccountId: needsBank ? account : undefined,
        endorsedToId: needsParty ? account : undefined,
        note,
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر التنفيذ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={ACTION_LABELS[s]}
      subtitle={`شيك رقم ${c.number} · ${formatNumber(c.amount)} ${c.currency} · الحالة الحالية: ${CHEQUE_STATUS[c.status].label}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="cheque-action" disabled={busy}>
            تأكيد
          </Button>
        </>
      }
    >
      <form id="cheque-action" onSubmit={submit} className="space-y-4">
        {(needsBank || needsParty) && (
          <Field label={needsParty ? 'المجيَّر له' : 'حساب البنك'}>
            <SearchSelect value={account} onChange={setAccount} options={options} placeholder="اختر الحساب" />
          </Field>
        )}
        <Field label="ملاحظة">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle">
          <Icon name="link" size={14} className="mt-0.5 shrink-0" />
          {s === 'collecting'
            ? 'تغيير حالة فقط، بلا قيد — القيد يُسجَّل عند الصرف.'
            : 'يُنشئ قيدين متقابلين على الحسابات ويظهران على الهاتف.'}
        </p>
      </form>
      <FormError message={err} />
    </Modal>
  );
};
