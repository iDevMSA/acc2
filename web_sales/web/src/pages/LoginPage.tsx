import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/Sidebar';
import { Button } from '../components/ui/primitives';
import Icon, { IconName } from '../components/ui/Icon';

const features: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'receipt', title: 'مبيعات متزامنة', text: 'فواتير نقاط البيع تصل لحظياً من التطبيق.' },
  { icon: 'ledger', title: 'محاسبة متكاملة', text: 'دليل حسابات وسجل عام وقيود منظمة.' },
  { icon: 'chart', title: 'تقارير مالية', text: 'ميزان مراجعة وقائمة دخل وميزانية عمومية.' },
];

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      setError('خطأ في البريد أو كلمة المرور');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* النموذج */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-base font-bold text-ink">المنصة المحاسبية</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-bold tracking-tight text-ink">مرحباً بعودتك</h1>
          <p className="mt-2 text-sm text-ink-subtle">سجّل الدخول لإدارة مبيعاتك وحساباتك.</p>

          {error && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-danger-100 bg-danger-50 px-3.5 py-3 text-sm text-danger-700">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="field-label">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Icon name="mail" size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input ps-10"
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                كلمة المرور
              </label>
              <div className="relative">
                <Icon name="lock" size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input ps-10"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            </div>

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
            </Button>
          </form>
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
