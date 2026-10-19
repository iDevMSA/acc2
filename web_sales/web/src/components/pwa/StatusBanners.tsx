import React, { useEffect, useState } from 'react';
import Icon from '../ui/Icon';
import { applyUpdate, useOnline, useUpdateAvailable } from '../../lib/pwa';
import { onLastSync } from '../../lib/offlineStore';
import { formatDate } from '../../lib/format';

/** شريط يظهر عند انقطاع الاتصال ويوضح عمر البيانات المعروضة */
export const OfflineBanner: React.FC = () => {
  const online = useOnline();
  const [lastSync, setLastSync] = useState<number | null>(null);
  useEffect(() => onLastSync(setLastSync), []);

  if (online) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning-100 bg-warning-50 px-4 py-2 text-center text-xs font-medium text-warning-700">
      <Icon name="wifiOff" size={15} className="shrink-0" />
      <span>
        أنت تعمل بدون اتصال
        {lastSync && <> — آخر مزامنة {formatDate(lastSync, { dateStyle: 'medium', timeStyle: 'short' })}</>}. ستتحدّث
        البيانات تلقائياً عند عودة الاتصال.
      </span>
    </div>
  );
};

/** تنبيه بوجود نسخة أحدث من التطبيق */
export const UpdateToast: React.FC = () => {
  const ready = useUpdateAvailable();
  if (!ready) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-nav p-3 ps-4 text-sm text-white shadow-pop md:bottom-6">
      <Icon name="refresh" size={18} className="shrink-0 text-brand-300" />
      <span className="flex-1">يتوفر إصدار أحدث من المنصة</span>
      <button
        onClick={applyUpdate}
        className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-500"
      >
        تحديث
      </button>
    </div>
  );
};
