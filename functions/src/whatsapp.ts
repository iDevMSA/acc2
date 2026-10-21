// WhatsApp Business Cloud API (Graph API): التحقق من التوقيع، قراءة الرسائل الواردة، الإرسال، وتنزيل الصور.
import { createHmac, timingSafeEqual } from 'crypto';

export const GRAPH = 'https://graph.facebook.com/v23.0';

/** Meta توقّع جسم الطلب الخام بـ App Secret في الترويسة X-Hub-Signature-256 */
export const verifySignature = (rawBody: Buffer, header: string | undefined, appSecret: string): boolean => {
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const got = Buffer.from(header.slice(7), 'hex');
  return got.length === expected.length && timingSafeEqual(got, expected);
};

export interface Incoming {
  id: string;
  from: string; // رقم المرسل بصيغة دولية بدون +
  name: string;
  kind: 'text' | 'image' | 'button' | 'document' | 'other';
  text?: string;
  mediaId?: string;
  mimeType?: string;
  buttonId?: string;
  timestamp: number;
}

/** يستخرج الرسائل من جسم webhook (قد يحمل الطلب الواحد عدة رسائل، أو حالات تسليم فقط) */
export const extractMessages = (body: any): Incoming[] => {
  const out: Incoming[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value;
      const names: Record<string, string> = {};
      for (const c of v?.contacts ?? []) names[c.wa_id] = c?.profile?.name ?? '';
      for (const m of v?.messages ?? []) {
        const base = { id: String(m.id), from: String(m.from), name: names[m.from] ?? '', timestamp: Number(m.timestamp) || 0 };
        if (m.type === 'text') out.push({ ...base, kind: 'text', text: m.text?.body ?? '' });
        else if (m.type === 'image')
          out.push({ ...base, kind: 'image', mediaId: m.image?.id, mimeType: m.image?.mime_type, text: m.image?.caption ?? '' });
        else if (m.type === 'document' && String(m.document?.mime_type || '').startsWith('image/'))
          out.push({ ...base, kind: 'image', mediaId: m.document?.id, mimeType: m.document?.mime_type, text: m.document?.caption ?? '' });
        else if (m.type === 'document')
          out.push({ ...base, kind: 'document', mediaId: m.document?.id, mimeType: m.document?.mime_type, text: m.document?.caption ?? '' });
        else if (m.type === 'interactive' && m.interactive?.type === 'button_reply')
          out.push({ ...base, kind: 'button', buttonId: m.interactive.button_reply.id, text: m.interactive.button_reply.title });
        else if (m.type === 'button') out.push({ ...base, kind: 'button', buttonId: m.button?.payload, text: m.button?.text });
        else out.push({ ...base, kind: 'other' });
      }
    }
  }
  return out;
};

export interface WaConfig {
  token: string;
  phoneNumberId: string;
}

export interface Button {
  id: string;
  title: string; // 20 حرفاً كحد أقصى
}

export class WhatsApp {
  constructor(private cfg: WaConfig) {}

  private async post(payload: object) {
    const res = await fetch(`${GRAPH}/${this.cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    if (!res.ok) throw new Error(`WhatsApp send failed ${res.status}: ${await res.text()}`);
  }

  sendText(to: string, body: string) {
    return this.post({ to, type: 'text', text: { body: body.slice(0, 4096), preview_url: false } });
  }

  /** رسالة بأزرار رد (3 أزرار كحد أقصى، والنص 1024 حرفاً) */
  sendButtons(to: string, body: string, buttons: Button[]) {
    return this.post({
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body.slice(0, 1024) },
        action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
      },
    });
  }

  markRead(messageId: string) {
    return this.post({ status: 'read', message_id: messageId }).catch(() => undefined);
  }

  /** الصورة تُنزّل على خطوتين: رابط مؤقت من معرّف الوسائط، ثم الملف نفسه بنفس التوكن */
  async downloadMedia(mediaId: string): Promise<{ data: Buffer; mimeType: string }> {
    const auth = { Authorization: `Bearer ${this.cfg.token}` };
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth });
    if (!meta.ok) throw new Error(`media lookup failed ${meta.status}`);
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    const file = await fetch(url, { headers: auth });
    if (!file.ok) throw new Error(`media download failed ${file.status}`);
    return { data: Buffer.from(await file.arrayBuffer()), mimeType: mime_type };
  }
}
