import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * يفتح نموذجاً جديداً عند الوصول بـ ?new=... (من اختصارات لوحة المفاتيح أو البحث الشامل)
 * ثم يحذف المعامل حتى لا يُفتح النموذج مرة أخرى عند التحديث أو الرجوع.
 */
export const useNewParam = (open: (kind: string) => void) => {
  const [params, setParams] = useSearchParams();
  const kind = params.get('new');
  useEffect(() => {
    if (!kind) return;
    open(kind);
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
};
