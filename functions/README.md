# بوت واتساب لتسجيل العمليات في منصتي

المستخدم يرسل العملية نصاً أو صورة الإيصال على واتساب، والبوت (Claude) يفهمها ويقترح قيداً من حسابات المستخدم،
ويسأله إن لم يفهم، ثم يعرض عليه **كيف سيسجّلها** بأزرار: ✅ اعتماد / ✏️ تعديل / ❌ رفض.
لا يُكتب أي شيء في دفتر المستخدم قبل الضغط على "اعتماد".

## كيف يعمل

```
واتساب ──► Meta Cloud API ──► whatsappWebhook (Cloud Function)
                                  │ يتحقق من التوقيع ويحفظ الرسالة في whatsappBot/inbox ثم يرد 200 فوراً
                                  ▼
                            whatsappProcess (RTDB trigger)
                                  │ يقرأ حسابات المستخدم ← Claude (نص/صورة) ← مسودة أو سؤال
                                  ▼
                       رد على واتساب بالمعاينة والأزرار
                                  │ "اعتماد"
                                  ▼
                 users/{uid}/operations/{id}  (قيود جديدة بنفس شكل التطبيق والويب)
```

| العقدة | من يكتبها | الغرض |
|---|---|---|
| `whatsappBot/inbox/{msgId}` | الـ webhook | الرسائل الواردة (معرّف رسالة واتساب يمنع المعالجة المزدوجة) |
| `whatsappBot/links/{waId}` | البوت | ربط رقم واتساب بمستخدم منصتي |
| `whatsappBot/linkCodes/{code}` | سكربت `link-phone` (ولاحقاً الويب) | رمز ربط من 6 أرقام صالح 30 دقيقة |
| `whatsappBot/sessions/{waId}` | البوت | المحادثة الجارية (سؤال/معاينة/تعديل) |
| `whatsappBot/drafts/{uid}/{id}` | البوت | كل مسودة وحالتها: pending / approved / rejected ومعرّفات القيود |
| `users/{uid}/operations/{id}` و `clientOps/...` | البوت **بعد الاعتماد فقط** | قيود جديدة، لا يعدّل ولا يحذف قيداً موجوداً |

البوت يحترم تجميد الحسابات (`erp/accountMeta`) وإقفال الفترة (`erp/settings/closedUntil`) والعملة الرئيسية في إعدادات الويب.
عقد `whatsappBot` غير مذكورة في قواعد قاعدة البيانات، فلا يستطيع أي عميل قراءتها؛ الدوال تصل إليها بصلاحيات الخادم.

## ما يلزم قبل النشر

1. **خطة Blaze** لمشروع Firebase `alaraby-4ccdd` (الدوال لا تعمل على الخطة المجانية).
2. **مفتاح Anthropic API** من console.anthropic.com.
3. **إعداد Meta** (انظر الدليل المرفق في المحادثة): رقم الهاتف (Phone number ID)، توكن دائم من System User، App Secret، ورمز تحقق تختاره.

## النشر

```bash
cd functions
npm install

# الأسرار (يُطلب منك لصق كل قيمة)
firebase functions:secrets:set WHATSAPP_TOKEN        # توكن System User الدائم
firebase functions:secrets:set WHATSAPP_APP_SECRET   # App settings ← Basic ← App secret
firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN # أي نص تختاره، ونفسه يُكتب في Meta
firebase functions:secrets:set ANTHROPIC_API_KEY

# القيم غير السرية
cat > .env <<'EOF'
WHATSAPP_PHONE_NUMBER_ID=123456789012345
BOT_TIMEZONE=Asia/Riyadh
EOF

cd ..
firebase deploy --only functions:whatsapp-bot
```

> استخدم `--only functions:whatsapp-bot` دائماً، حتى لا يُعاد نشر قواعد قاعدة البيانات من هذا المستودع.

بعد النشر يظهر رابط `whatsappWebhook`، مثل:
`https://us-central1-alaraby-4ccdd.cloudfunctions.net/whatsappWebhook` — هذا هو **Callback URL** في Meta.

## ربط رقم المستخدم

إلى أن تُضاف شاشة "واتساب" في إعدادات الويب:

```bash
cd functions && npm run build
gcloud auth application-default login   # مرة واحدة
npm run link-phone -- <uid المستخدم>
```

يطبع رمزاً من 6 أرقام؛ يرسله المستخدم إلى رقم البوت على واتساب فيُربط رقمه بحسابه.

## الاختبارات

```bash
cd functions && npm test
```
