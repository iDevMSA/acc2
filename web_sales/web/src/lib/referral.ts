import type { User } from 'firebase/auth';

// كود المسوّق (البرومو كود): يُتحقق منه ويُحفظ على خادم موقع خوارزم
// (/api/monsati/referral) بتوكن المستخدم. حساب المسوّق نفسه منفصل تماماً عن منصتي.
const API =
  typeof window !== 'undefined' && /inexusdev\.com$/.test(window.location.hostname)
    ? '/api/monsati/referral'
    : 'https://inexusdev.com/api/monsati/referral';

export const REF_COOKIE = 'monsati_ref';

export const normalizeRefCode = (raw: string) => {
  const c = (raw || '').trim().toUpperCase();
  return /^[A-Z0-9_-]{3,24}$/.test(c) ? c : '';
};

/** الكود القادم من رابط المسوّق: ?ref=CODE أو كوكي monsati_ref (يضعه inexusdev.com/r/CODE). */
export function incomingRefCode(): string {
  if (typeof window === 'undefined') return '';
  const fromUrl = new URLSearchParams(window.location.search).get('ref');
  if (fromUrl) return normalizeRefCode(fromUrl);
  const m = document.cookie.match(/(?:^|;\s*)monsati_ref=([^;]+)/);
  return m ? normalizeRefCode(decodeURIComponent(m[1])) : '';
}

export async function checkRefCode(code: string): Promise<boolean> {
  const c = normalizeRefCode(code);
  if (!c) return false;
  try {
    const r = await fetch(`${API}?code=${encodeURIComponent(c)}`);
    const j = await r.json();
    return !!j.valid;
  } catch {
    return false;
  }
}

export type ClaimResult = { ok: boolean; error?: string; message?: string };

export async function claimRefCode(user: User, code: string, source: 'signup' | 'link' | 'later'): Promise<ClaimResult> {
  const c = normalizeRefCode(code);
  if (!c) return { ok: false, error: 'invalid_code', message: 'الكود غير صحيح' };
  try {
    const token = await user.getIdToken();
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: c, source }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok) {
      document.cookie = `${REF_COOKIE}=; path=/; max-age=0`;
    }
    return j.ok ? { ok: true } : { ok: false, error: j.error, message: j.message || 'تعذّر حفظ الكود' };
  } catch {
    return { ok: false, error: 'network', message: 'تعذّر الاتصال، حاول لاحقاً' };
  }
}
