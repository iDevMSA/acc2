// Claude يقرأ نص العملية أو صورة الإيصال ويقترح قيداً من حسابات المستخدم، أو يسأل إن لم يفهم.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import type { Draft } from './ledger';

export const MODEL = 'claude-opus-5-5';

export const ReplySchema = z.object({
  action: z.enum(['draft', 'ask', 'chat']),
  /** سؤال للمستخدم (ask) أو رد عام (chat) */
  message: z.string(),
  draft: z
    .object({
      summary: z.string(),
      date: z.string(),
      currency: z.string(),
      exchangeRate: z.number(),
      legs: z.array(
        z.object({
          accountId: z.string(),
          side: z.enum(['debit', 'credit']),
          amount: z.number(),
          statement: z.string(),
        }),
      ),
    })
    .nullable(),
});
export type Reply = z.infer<typeof ReplySchema>;

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ParseInput {
  chart: string; // describeChart(...)
  today: string;
  history: Turn[]; // آخر رسائل المحادثة حول هذه العملية
  text: string;
  image?: { data: Buffer; mimeType: string };
  currentDraft?: Draft | null; // عند التعديل
}

const SYSTEM = `أنت مساعد محاسبي داخل بوت واتساب لتطبيق "منصتي". يرسل لك صاحب الحساب عملية مالية نصاً أو صورة إيصال/فاتورة، ومهمتك أن تقترح قيداً يُسجَّل في دفتره.

القواعد:
- استخدم فقط الحسابات الموجودة في القائمة المعطاة، واكتب accountId كما هو في العمود الأول. لا تخترع حسابات.
- القيد المزدوج هو الأصل: طرف مدين وطرف دائن بنفس المجموع. مثال: قبض من زبون نقداً = مدين حساب نقدية الصندوق، دائن الزبون. دفع مصروف نقداً = مدين حساب المصروف، دائن نقدية الصندوق. شراء بالآجل من مورد = مدين المشتريات/المصروف، دائن المورد.
- المبالغ موجبة دائماً، والجهة تحددها side.
- إذا كانت العملية تخص طرفاً واحداً فقط ولم يذكر المستخدم صندوقاً أو مقابلاً (مثل "سجّل على أحمد 50")، اسأله عن المقابل مرة واحدة؛ وإن قال بلا مقابل فاكتب قيداً بطرف واحد.
- إذا لم تتأكد من الحساب (أكثر من حساب مشابه، أو لا يوجد حساب مطابق) أو المبلغ أو العملة، فاختر action="ask" واكتب سؤالاً واحداً قصيراً وواضحاً في message. إن لم يوجد الحساب فاقترح عليه أقرب الحسابات أو أن ينشئه من التطبيق أولاً.
- العملة: إن لم تُذكر فهي العملة الرئيسية. exchangeRate = كم وحدة من العملة تساوي 1 من العملة الرئيسية (1 إذا كانت هي الرئيسية). إن كانت عملة أخرى ولم يذكر السعر ولم يوجد سعر مسجّل فاسأل عنه.
- التاريخ بصيغة YYYY-MM-DD. إن لم يُذكر فهو تاريخ اليوم. في الإيصالات خذ تاريخ الإيصال.
- البيان (statement) قصير وبالعربية ويذكر الطرف وسبب العملية، ورقم الإيصال إن وجد.
- summary جملة واحدة تشرح العملية للمستخدم.
- إن كانت هناك مسودة حالية ورسالة المستخدم تعديل عليها، فأعد المسودة كاملة بعد التعديل.
- إن لم تكن الرسالة عملية مالية (تحية أو سؤال عام)، فاختر action="chat" ورد بلطف واشرح باختصار ما يمكنك فعله.
- عند action="draft" اكتب في message جملة قصيرة أو اتركها فارغة، وعند غيرها اجعل draft = null.
- اكتب دائماً بالعربية وبلهجة المستخدم إن أمكن.`;

export class ReceiptParser {
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async parse(input: ParseInput): Promise<Reply> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (input.image) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: normalizeMime(input.image.mimeType),
          data: input.image.data.toString('base64'),
        },
      });
    }
    const context = [
      `تاريخ اليوم: ${input.today}`,
      input.currentDraft ? `المسودة الحالية:\n${JSON.stringify(input.currentDraft)}` : '',
      input.history.length
        ? `المحادثة حول هذه العملية حتى الآن:\n${input.history.map((t) => `${t.role === 'user' ? 'المستخدم' : 'البوت'}: ${t.text}`).join('\n')}`
        : '',
      `رسالة المستخدم الآن: ${input.text || (input.image ? '(صورة إيصال بدون نص)' : '')}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    content.push({ type: 'text', text: context });

    const res = await this.client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(ReplySchema) },
      // دليل الحسابات ثابت لكل مستخدم فيُخزَّن مؤقتاً بين الرسائل
      system: [
        { type: 'text', text: SYSTEM },
        { type: 'text', text: input.chart, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) {
      return { action: 'ask', message: 'لم أستطع قراءة العملية. أرسلها نصاً من فضلك، مثل: "قبضت من أحمد 200 دولار نقداً".', draft: null };
    }
    return res.parsed_output;
  }
}

const normalizeMime = (m: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' => {
  const t = m.split(';')[0].trim().toLowerCase();
  return t === 'image/png' || t === 'image/gif' || t === 'image/webp' ? t : 'image/jpeg';
};
