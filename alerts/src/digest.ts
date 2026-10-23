// الملخص اليومي لحساب واحد: يحسب التنبيهات بنفس محرك الويب، ويرسل الجديد منها بالبريد وإشعارات الهاتف.
import { Alert, AlertSettings, buildAlerts, inputFromRaw, KIND_LABELS, todayIn, withDefaults } from './shared/alerts';

export interface Db {
  get<T = any>(path: string): Promise<T | null>;
  update(updates: Record<string, unknown>): Promise<void>;
}

export interface PushSub {
  endpoint: string;
  keys?: { p256dh: string; auth: string };
}

export interface Senders {
  /** null = البريد غير مهيأ على الخادم */
  email: ((to: string[], subject: string, html: string, text: string) => Promise<void>) | null;
  /** يرجع 'gone' إذا ألغى المتصفح الاشتراك (يُحذف) */
  push: (sub: PushSub, payload: { title: string; body: string; link: string; tag: string }) => Promise<'ok' | 'gone'>;
}

export interface DigestResult {
  alerts: number;
  fresh: number;
  email: number;
  push: number;
  skipped?: string;
  error?: string | null;
}

/** مفاتيح RTDB لا تقبل . # $ / [ ] (نفس dkey في الويب) */
export const dkey = (id: string) => id.replace(/[.#$/[\]]/g, '_');

export const localHour = (timeZone: string, now: Date) => {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  } catch {
    return now.getUTCHours();
  }
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const COLORS = { danger: '#d92d20', warning: '#dc6803', info: '#0284c7' };

export const emailBody = (company: string, alerts: Alert[], fresh: Set<string>, appUrl: string) => {
  const rows = alerts
    .map(
      (a) => `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid #eaecf0;vertical-align:top">
    <span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${COLORS[a.severity]};margin-left:8px"></span>
    <a href="${esc(appUrl + a.link)}" style="color:#101828;font-weight:600;text-decoration:none">${esc(a.title)}</a>
    ${fresh.has(a.id) ? '<span style="font-size:11px;color:#2349ea;margin-right:6px">جديد</span>' : ''}
    <div style="color:#667085;font-size:13px;margin-top:2px">${esc(KIND_LABELS[a.kind])} · ${esc(a.detail)}</div>
  </td>
</tr>`,
    )
    .join('');
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f9fafb;font-family:Tahoma,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <h2 style="margin:0 0 4px;color:#101828">التنبيهات اليومية${company ? ` — ${esc(company)}` : ''}</h2>
  <p style="margin:0 0 16px;color:#667085">${alerts.length} تنبيه، منها ${fresh.size} جديد</p>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eaecf0;border-radius:12px">${rows}</table>
  <p style="margin:16px 0 0"><a href="${esc(appUrl)}/alerts" style="color:#2349ea">فتح التنبيهات وإعداداتها</a></p>
</div></body></html>`;
  const text = alerts.map((a) => `${fresh.has(a.id) ? '[جديد] ' : ''}${a.title} — ${a.detail}`).join('\n');
  return { html, text };
};

/** يقرأ نفس العقد التي يقرأها الويب ويحسب التنبيهات النشطة (بلا المخفية) */
export const loadAlerts = async (db: Db, uid: string, settings: AlertSettings, now: Date) => {
  const [accounts, operations, erp, products, salesCurrency, dismissed] = await Promise.all([
    db.get(`users/${uid}/accounts`),
    db.get(`users/${uid}/operations`),
    db.get(`users/${uid}/erp`),
    db.get(`sales/${uid}/products`),
    db.get<string>(`sales/${uid}/settings/currency`),
    db.get<Record<string, boolean>>(`users/${uid}/alerts/dismissed`),
  ]);
  const mainCurrency = erp?.settings?.mainCurrency || salesCurrency || 'USD';
  const today = todayIn(withDefaults(settings).timeZone, now);
  const all = buildAlerts(inputFromRaw({ accounts, operations, erp, products, mainCurrency }), settings, today);
  return { today, alerts: all.filter((a) => !dismissed?.[dkey(a.id)]) };
};

/**
 * test = إرسال فوري بكل التنبيهات الحالية (زر "إرسال تجربة")،
 * وإلا فالإرسال اليومي: مرة في اليوم عند الساعة المختارة، وفقط إن ظهر تنبيه جديد منذ آخر ملخص.
 */
export const runDigest = async (db: Db, senders: Senders, uid: string, now: Date, opts: { test?: boolean; appUrl: string }): Promise<DigestResult> => {
  const settings = (await db.get<AlertSettings>(`users/${uid}/alerts/settings`)) || {};
  const s = withDefaults(settings);
  const emailTo = settings.email?.enabled ? (settings.email.to || []).filter(Boolean) : [];
  const subs = settings.push?.enabled ? (await db.get<Record<string, { subscription?: PushSub }>>(`users/${uid}/alerts/push`)) || {} : {};
  const base: DigestResult = { alerts: 0, fresh: 0, email: 0, push: 0 };
  if (!emailTo.length && !Object.keys(subs).length) return { ...base, skipped: 'no-channels' };

  const status = (await db.get<{ lastDigestDate?: string }>(`users/${uid}/alerts/status`)) || {};
  const today = todayIn(s.timeZone, now);
  if (!opts.test && (localHour(s.timeZone, now) !== s.hour || status.lastDigestDate === today)) return { ...base, skipped: 'not-now' };

  const { alerts } = await loadAlerts(db, uid, settings, now);
  const sent = (await db.get<Record<string, string>>(`users/${uid}/alerts/sent`)) || {};
  const fresh = new Set(alerts.filter((a) => !sent[dkey(a.id)]).map((a) => a.id));
  const result: DigestResult = { ...base, alerts: alerts.length, fresh: fresh.size, error: null };
  const updates: Record<string, unknown> = {
    [`users/${uid}/alerts/status/lastRunAt`]: now.toISOString(),
  };
  if (!opts.test) updates[`users/${uid}/alerts/status/lastDigestDate`] = today;

  if (opts.test || fresh.size) {
    const company = (await db.get<{ name?: string }>(`users/${uid}/companyInfo`))?.name || '';
    const errors: string[] = [];
    const list = alerts;
    const freshList = alerts.filter((a) => fresh.has(a.id));

    if (emailTo.length) {
      if (!senders.email) errors.push('البريد غير مهيأ على الخادم (SMTP_URL)');
      else {
        const { html, text } = emailBody(company, list, fresh, opts.appUrl);
        const subject = opts.test
          ? `تجربة التنبيهات — ${list.length} تنبيه`
          : `${fresh.size} تنبيه جديد${company ? ` — ${company}` : ''}`;
        try {
          await senders.email(emailTo, subject, list.length ? html : '<p dir="rtl">لا توجد تنبيهات الآن. وصلتك هذه الرسالة لأن الإرسال يعمل.</p>', text || 'لا توجد تنبيهات الآن');
          result.email = emailTo.length;
        } catch (e: any) {
          errors.push(`تعذّر إرسال البريد: ${e?.message || e}`);
        }
      }
    }

    const top = (opts.test ? list : freshList).slice(0, 3);
    const payload = {
      title: opts.test ? 'تجربة التنبيهات' : `${fresh.size} تنبيه جديد`,
      body: top.length ? top.map((a) => a.title).join('\n') + (alerts.length > top.length ? `\n…و${alerts.length - top.length} أخرى` : '') : 'لا توجد تنبيهات الآن — الإشعارات تعمل',
      link: '/alerts',
      tag: opts.test ? 'alerts-test' : `alerts-${today}`,
    };
    for (const [key, v] of Object.entries(subs)) {
      if (!v?.subscription?.endpoint) continue;
      try {
        if ((await senders.push(v.subscription, payload)) === 'gone') updates[`users/${uid}/alerts/push/${key}`] = null;
        else result.push++;
      } catch (e: any) {
        errors.push(`تعذّر إرسال إشعار: ${e?.message || e}`);
      }
    }

    if (result.email || result.push) {
      updates[`users/${uid}/alerts/status/lastSentAt`] = now.toISOString();
      updates[`users/${uid}/alerts/status/sent`] = { email: result.email, push: result.push };
    }
    result.error = errors.length ? errors.join(' · ') : null;
  }
  updates[`users/${uid}/alerts/status/error`] = result.error ?? null;
  // ما أُرسل: التنبيهات الحالية فقط، فإذا زال تنبيه ثم عاد يُرسل من جديد. التجربة لا تغيّر شيئاً منها
  // وإن فشل الإرسال كله تبقى جديدة لملخص الغد
  if (!opts.test && (result.email || result.push || !fresh.size))
    updates[`users/${uid}/alerts/sent`] = Object.fromEntries(alerts.map((a) => [dkey(a.id), sent[dkey(a.id)] || today]));
  await db.update(updates);
  return result;
};
