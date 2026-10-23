import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import { auth, db } from '../config/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/Sidebar';
import { Button } from '../components/ui/primitives';
import Icon, { IconName } from '../components/ui/Icon';
import InstallButton from '../components/pwa/InstallButton';
import { FREE_MAX_ACCOUNTS, FREE_MAX_OPERATIONS, authErrorText, newUserRecord } from '../lib/subscription';

const features: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'receipt', title: 'مبيعات متزامنة', text: 'فواتير نقاط البيع تصل لحظياً من التطبيق.' },
  { icon: 'ledger', title: 'محاسبة متكاملة', text: 'دليل حسابات وسجل عام وقيود منظمة.' },
  { icon: 'chart', title: 'تقارير مالية', text: 'ميزان مراجعة وقائمة دخل وميزانية عمومية.' },
];

const IconInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { icon?: IconName; label: string; hint?: string }> = ({
  icon,
  label,
  hint,
  id,
  ...rest
}) => (
  <div>
    <label htmlFor={id} className="field-label">
      {label}
    </label>
    <div className="relative">
      {icon && (
        <Icon
          name={icon}
          size={16}
          className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
        />
      )}
      <input id={id} className={icon ? 'field-input ps-10' : 'field-input'} {...rest} />
    </div>
    {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
  </div>
);

// نفس خطوات إنشاء الحساب في التطبيق (welcome.dart → _register):
// إنشاء المستخدم ← الاسم الظاهر ← users/{uid} بمعلومات الشركة والخطة المجانية إن لم يكن موجوداً.
const SignupForm: React.FC<{ onError: (m: string) => void }> = ({ onError }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    companyPhone: '',
    companyEmail: '',
    companyAddress: '',
  });
  const [showCompany, setShowCompany] = useState(false);
  const [loading, setLoading] = useState(false);
  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError('');
    if (!form.name.trim()) return onError('الاسم مطلوب');
    if (!form.email.includes('@')) return onError('بريد غير صالح');
    if (form.password.trim().length < 6) return onError('كلمة المرور 6 أحرف على الأقل');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password.trim());
      const user = cred.user;
      await updateProfile(user, { displayName: form.name.trim() });
      const userRef = ref(db, `users/${user.uid}`);
      const snap = await get(userRef);
      if (!snap.exists()) {
        await set(
          userRef,
          newUserRecord(user.uid, user.email || '', {
            name: form.companyName.trim() || form.name.trim(),
            phone: form.companyPhone.trim(),
            email: form.companyEmail.trim(),
            address: form.companyAddress.trim(),
          }),
        );
      }
      navigate('/');
    } catch (err: any) {
      onError(authErrorText(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <IconInput id="name" label="الاسم الكامل *" autoComplete="name" value={form.name} onChange={setField('name')} />
      <IconInput
        id="email"
        label="البريد الإلكتروني *"
        icon="mail"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={setField('email')}
        placeholder="example@email.com"
        dir="ltr"
      />
      <IconInput
        id="password"
        label="كلمة المرور *"
        icon="lock"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={setField('password')}
        placeholder="••••••••"
        hint="6 أحرف على الأقل"
        dir="ltr"
      />

      <div className="rounded-lg border border-line">
        <button
          type="button"
          onClick={() => setShowCompany((v) => !v)}
          className="flex w-full items-center justify-between px-3.5 py-3 text-sm font-medium text-ink"
        >
          <span className="flex items-center gap-2">
            <Icon name="building" size={16} />
            معلومات الشركة <span className="text-xs font-normal text-ink-faint">(اختياري)</span>
          </span>
          <Icon name="chevronDown" size={16} className={showCompany ? 'rotate-180 transition' : 'transition'} />
        </button>
        {showCompany && (
          <div className="space-y-4 border-t border-line px-3.5 py-4">
            <IconInput
              id="companyName"
              label="اسم الشركة"
              value={form.companyName}
              onChange={setField('companyName')}
              hint="سيستخدم اسمك إذا تركته فارغاً"
            />
            <IconInput
              id="companyPhone"
              label="هاتف الشركة"
              icon="phone"
              type="tel"
              value={form.companyPhone}
              onChange={setField('companyPhone')}
              dir="ltr"
            />
            <IconInput
              id="companyEmail"
              label="بريد الشركة"
              icon="mail"
              type="email"
              value={form.companyEmail}
              onChange={setField('companyEmail')}
              dir="ltr"
            />
            <IconInput id="companyAddress" label="عنوان الشركة" value={form.companyAddress} onChange={setField('companyAddress')} />
          </div>
        )}
      </div>

      <p className="text-xs text-ink-subtle">
        تبدأ بالحساب المجاني ({FREE_MAX_ACCOUNTS} حساباً و{FREE_MAX_OPERATIONS} قيد)، ويعمل نفس الحساب في تطبيق الهاتف.
      </p>

      <Button type="submit" size="lg" disabled={loading} className="w-full">
        {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
      </Button>
    </form>
  );
};

const LoginForm: React.FC<{ onError: (m: string) => void; onInfo: (m: string) => void }> = ({ onError, onInfo }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onError('');
    onInfo('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/');
    } catch (err: any) {
      onError(authErrorText(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // نفس _resetPassword في التطبيق
  const resetPassword = async () => {
    onError('');
    onInfo('');
    if (!email.trim()) return onError('أدخل بريدك الإلكتروني أولاً');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      onInfo('تم إرسال رابط إعادة التعيين إلى بريدك');
    } catch (err: any) {
      onError(authErrorText(err));
    }
  };

  return (
    <form onSubmit={handleLogin} className="mt-8 space-y-5">
      <IconInput
        id="email"
        label="البريد الإلكتروني"
        icon="mail"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="example@email.com"
        dir="ltr"
      />
      <div>
        <IconInput
          id="password"
          label="كلمة المرور"
          icon="lock"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          dir="ltr"
        />
        <button type="button" onClick={resetPassword} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
          نسيت كلمة المرور؟
        </button>
      </div>

      <Button type="submit" size="lg" disabled={loading} className="w-full">
        {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
      </Button>
    </form>
  );
};

const LoginPage: React.FC<{ mode?: 'login' | 'signup' }> = ({ mode = 'login' }) => {
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const signup = mode === 'signup';

  return (
    <div className="grid min-h-[100dvh] bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* النموذج */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-base font-bold text-ink">المنصة المحاسبية</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{signup ? 'إنشاء حساب جديد' : 'مرحباً بعودتك'}</h1>
          <p className="mt-2 text-sm text-ink-subtle">
            {signup ? 'حساب واحد للمتصفح وتطبيق الهاتف.' : 'سجّل الدخول لإدارة مبيعاتك وحساباتك.'}
          </p>

          {error && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-danger-100 bg-danger-50 px-3.5 py-3 text-sm text-danger-700">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}
          {info && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-success-100 bg-success-50 px-3.5 py-3 text-sm text-success-700">
              <Icon name="check" size={16} />
              {info}
            </div>
          )}

          {signup ? <SignupForm key="signup" onError={setError} /> : <LoginForm key="login" onError={setError} onInfo={setInfo} />}

          <p className="mt-5 text-center text-sm text-ink-subtle">
            {signup ? 'لديك حساب بالفعل؟ ' : 'ليس لديك حساب؟ '}
            <Link
              to={signup ? '/login' : '/signup'}
              onClick={() => {
                setError('');
                setInfo('');
              }}
              className="font-semibold text-brand-600 hover:underline"
            >
              {signup ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </Link>
          </p>

          <InstallButton className="mt-4 justify-center" />
        </div>

        <p className="flex items-center gap-2 text-xs text-ink-faint">
          <Icon name="shield" size={14} />
          اتصال مشفّر — بياناتك محفوظة على Firebase
        </p>
      </div>

      {/* اللوحة التعريفية */}
      <div className="relative hidden overflow-hidden bg-nav lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="pointer-events-none absolute -end-32 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -start-20 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative max-w-lg">
          <h2 className="text-3xl font-bold leading-snug text-white">
            كل حساباتك في مكان واحد،
            <br />
            <span className="text-brand-300">من نقطة البيع إلى القوائم المالية.</span>
          </h2>
          <ul className="mt-10 space-y-5">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-200 ring-1 ring-white/10">
                  <Icon name={f.icon} size={19} />
                </span>
                <div>
                  <p className="font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-sm text-nav-text">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
