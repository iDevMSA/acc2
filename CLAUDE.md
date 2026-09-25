# منصتي المحاسبية — وثيقة المشروع

> تطوير ERP عربي متكامل ينافس Odoo و Daftar

**آخر تحديث:** 25 سبتمبر 2026  
**الحالة:** وثيقة معمارية مكتملة + إطلاق Phase 1  
**الفريق:** @MousaMM

---

## 1. حالة المشروع الحالية

### ✅ ما تم إكماله (مرحلة ما قبل ERP)
- تطبيق Flutter متكامل (41,885 سطر)
  - نموذج محاسبي قديم (Account/Operation)
  - نظام مبيعات/POS (sales_sys)
  - محرك قيد مزدوج منفصل (acc_sys) — موجود لكن في الموبايل فقط
  - 64 عملة + صلاحيات موظفين + مزامنة Drift↔RTDB

- واجهات ويب (بدائية):
  - web_sales/ (2,783 سطر JS، متجاوب جزئياً)
  - web/admin.html (إدارة مركزية)
  - web_admin_ai/ (محادثة مطورين)

- طبقة ذكاء اصطناعي متقدمة (قراءة فقط، مقيّد بمالك)

- **ملاحظة:** لا توجد API حقيقية — جميع العملاء يكتبون مباشرة لـ Firebase RTDB

### ❌ الفجوات الحرجة (لماذا ليس ERP اليوم)

| المشكلة | التأثير |
|--------|--------|
| **نظام محاسبي مزدوج منفصل** | قيود البيع لا تُنشأ تلقائياً من أي مكان |
| **بلا محرك API** | كل عميل يكتب مباشرة لـRTDB (خطر أمني، صعوبة صيانة) |
| **uid = الشركة** | لا يوجد كيان Company حقيقي، لا تعدد شركات |
| **ويب بدائي** | متجاوب جزئي، لا نموذج بيانات موحد |
| **بلا مشتريات** | لا موردون، لا أوامر شراء، لا فواتير مورد |
| **بلا COGS** | حقل costPrice موجود لكن غير مستخدم — الربح غير صحيح |

---

## 2. الحالة المستهدفة (ERP كامل)

**المبدأ الحاكم:**  
محرك محاسبي واحد موثوق = مصدر الحقيقة المالية، تستهلكه كل الوحدات الأخرى عبر API موحّدة.

```
تطبيق Flutter + ويب + POS
          ↓
      طبقة API
          ↓
   محرك محاسبي موحّد
          ↓
   Firebase RTDB (محرّك تخزين)
```

**المبادئ المعمارية:**
1. Backend-first: كل عملية تمر عبر API، لا كتابة مباشرة لـRTDB من الواجهات
2. محرك محاسبي موحّد: توسيع acc_sys ليصبح الحقيقة الوحيدة
3. كيان Company حقيقي: استبدال uid بـcompanyId
4. API + Webhooks: تكامل خارجي حقيقي
5. Event Bus: أحداث تجارية موحّدة (invoice.created، payment.received)

---

## 3. قائمة الوحدات المخطط لها

### النواة (محاسبية أساسية)
Dashboard · General Ledger · Chart of Accounts · Journal Entries · Trial Balance · Financial Statements (دخل/ميزانية/تدفق) · Banking · Budgeting · Cost Centers · Taxes

### المبيعات
CRM (Leads/Opportunities) · Customers · Quotations · Sales Orders · Invoicing · Payments · POS · Notes

### المشتريات
Suppliers · Purchase Orders · Goods Receipt · Vendor Bills

### المخزون
Products · Warehouses · Stock Operations · Inventory Valuation (FIFO/Average)

### العمليات
Expenses · Fixed Assets + Depreciation · Projects · Timesheets

### الموارد البشرية
Employees · Attendance · Payroll

### المستقبل (متأخر)
Manufacturing · Subscriptions · Documents (DMS)

---

## 4. خطة التنفيذ (6 مراحل)

### Phase 0 — وثيقة معمارية ✅ مكتملة
- [x] تدقيق معماري شامل
- [x] مصفوفة الفجوات
- [x] مخطط API الأولي
- [ ] **قرار معماري مطلوب:** Firebase RTDB خلف API أم Postgres من الصفر؟

### Phase 1 — نواة ERP 🚀 تبدأ الآن
**الهدف:** فاتورة بيع تُنشئ قيداً محاسبياً صحيحاً تلقائياً

#### المحتوى:
1. **طبقة API** (Cloud Functions موسّعة أو Node/NestJS)
   - POST /api/v1/companies/{id}/invoices
   - POST /api/v1/companies/{id}/invoices/{id}/confirm ← ينشئ القيد
   - GET /api/v1/companies/{id}/reports/trial-balance

2. **كيان Company** جديد
   - companies/{companyId} في RTDB
   - memberships/{uid}/{companyId} → {role, permissions}

3. **ربط Sales ↔ Accounting**
   - عند تأكيد فاتورة: قيد إيراد تلقائي (Debit AR / Credit Revenue)
   - حركة مخزون (Stock Movement)
   - قيد COGS تلقائي (Debit COGS / Credit Inventory)

4. **وحدة Suppliers**
   - كيان Supplier جديد منفصل عن Customers
   - Purchase Orders → Goods Receipt → Vendor Bills

5. **واجهة ويب جديدة**
   - استهلاك API فقط (لا RTDB مباشرة)
   - متجاوبة كاملة (موبايل/تابلت/ديسكتوب)
   - من الصفر في React/Vue (اختيار مطلوب)

#### معيار الإنجاز (DoD):
- [ ] فاتورة بيع تولّد قيداً محاسبياً صحيحاً
- [ ] نفس النتيجة من موبايل + ويب
- [ ] trial balance يعكس الواقع
- [ ] اختبارات فورية للعمليات المالية

### Phase 2 — CRM والتوسع المالي
Lead → Opportunity → Quote → Order pipeline + مصروفات + أصول ثابتة + بنوك

### Phase 3 — POS و HR
ربط POS الحالي بالمحرك الموحّد + رواتب محاسبية

### Phase 4 — متقدم
مشاريع + Timesheets + تصنيع + اشتراكات

### Phase 5 — BI والذكاء
محرك تقارير + AI موسّع

### Phase 6 — قوالب القطاعات
تجزئة/مطاعم/عيادات/وكالات جاهزة

---

## 5. القرارات المعمارية المطلوبة الآن

### ❓ قرار 1: Firebase RTDB أم Postgres؟

| الخيار | الإيجابيات | السلبيات |
|--------|-----------|---------|
| **Firebase RTDB خلف API** | أسرع، أقل مخاطرة، معرفة موجودة بالفعل | أضعف للاستعلامات المركبة |
| **Postgres من الصفر** | أقوى للتقارير، معايير صناعية | هجرة كاملة = خطر كبير، أبطأ |

**التوصية:** Firebase RTDB خلف API في Phase 1، بإمكانية الهجرة لاحقاً إذا لزم الأمر.

### ❓ قرار 2: تقنية طبقة API؟

| الخيار | الوصف |
|--------|-------|
| **Cloud Functions (موسّعة)** | موجودة بالفعل، أقل إدارة، دفع حسب الاستخدام |
| **Node/NestJS منفصل** | تحكم أكبر، سهل الهجرة لاحقاً |

**التوصية:** Cloud Functions في البداية (أسرع إطلاق)، ثم هجرة لـNestJS إذا لزم.

### ❓ قرار 3: إطار الويب الجديد؟

| الخيار | الوصف |
|--------|-------|
| **React** | شعبية، مكتبات وفيرة |
| **Vue** | أسهل تعلم |
| **SvelteKit** | حديث، أداء عالية |

**التوصية:** React (أكثر توظيفاً + مكتبات Admin Panel جاهزة).

---

## 6. معايير نجاح Phase 1

```
✅ في نهاية Phase 1 يجب:

1. فاتورة من Flutter توجد قيداً محاسبياً من الخادم (لا العميل)
2. نفس الفاتورة من ويب React توجد نفس القيد
3. Trial Balance يُحسب من journal_entries، لا من account.balance
4. Supplier جديد يمكن ربطه بـPO تلقائي
5. كل عملية مالية لها قيد متوازن (Debit = Credit)
6. API موثقة بـOpenAPI/Swagger
7. اختبارات فورية على 5 سيناريوهات مالية
```

---

## 7. الملفات الرئيسية والأدوار

### lib/ (Flutter)
```
main.dart (11K) ← سيُقسّم إلى ملفات بعد Phase 1
sales_sys/smain.dart (3.4K) ← سيُقسّم لوحدات
acc_sys/ ← سيُوسّع ليصبح محرك مركزي
services/ ← طبقة خدمات جديدة
  ├── api_service.dart (جديد) ← استدعاء الـAPI الموحّدة
  ├── accounting_engine.dart (جديد) ← محرك محاسبي موحّد
  └── ...
```

### functions/ (Cloud Functions)
```
src/
  ├── api/
  │   ├── invoices.ts (جديد)
  │   ├── suppliers.ts (جديد)
  │   └── journal-entries.ts (جديد)
  ├── engine/
  │   └── accounting-engine.ts (موسّع)
  └── webhooks/ (جديد)
```

### web/ (React جديد)
```
src/
  ├── pages/
  │   ├── Dashboard
  │   ├── Invoices
  │   ├── Suppliers (جديد)
  │   └── Accounting (جديد)
  ├── api/
  │   └── client.ts ← استهلاك API فقط
  └── types/
      └── index.ts ← تعريفات TypeScript من API
```

---

## 8. التبعيات والمتطلبات

### متطلبات بدء Phase 1:
- [ ] قرار نهائي: Firebase أم Postgres؟
- [ ] قرار نهائي: Cloud Functions أم NestJS؟
- [ ] قرار نهائي: React أم Vue أم SvelteKit؟
- [ ] موافقة على مصفوفة الفجوات والأولويات
- [ ] تخصيص وقت تطوير (بدون مقاطعات)

### الموارد الموجودة بالفعل:
- ✅ محرك قيد مزدوج في acc_sys (يُوسّع)
- ✅ طبقة ذكاء اصطناعي متقدمة (تُوسّع)
- ✅ مزامنة Drift↔RTDB (تُحافظ)
- ✅ نظام RTL والعربية الكامل (يُوسّع)
- ✅ Cloud Functions الأساسية (تُوسّع)

---

## 9. النقاط الحرجة والمخاطر

### المخاطر العالية:
1. **كسر التوافق:** أي تغيير لـuid=company قد يكسر البيانات الموجودة
   - **التخفيف:** هجرة تدريجية (companies/{uid} = ownerUid للموجودين)

2. **فقدان البيانات التاريخية:** إذا غيّرنا RTDB structure
   - **التخفيف:** كل تغيير إضافي (لا تعديل)

3. **تعقيد الترحيل:** Account/Operation → Journal Entry
   - **التخفيف:** قراءة فقط للقديم، كتابة للجديد

### الخطوات الوقائية:
- [ ] Backup كامل RTDB قبل أي تغيير
- [ ] مرحلة testing في _beta أولاً
- [ ] Rollback plan واضح لكل phase

---

## 10. الخطوات الفورية (اليوم)

### الآن:
1. [ ] موافقة على هذه الوثيقة
2. [ ] اختيار قرارات الفقرة 5
3. [ ] إنشاء branch Phase 1: `feature/phase-1-accounting-engine`

### غداً:
4. [ ] تصميم كيان Company (قاعدة بيانات)
5. [ ] بناء API الأساسية (Cloud Functions)
6. [ ] اختبار يدوي لقيد بسيط

### الأسبوع القادم:
7. [ ] ربط Flutter بـAPI
8. [ ] ربط ويب React جديدة بـAPI
9. [ ] اختبار الدورة كاملة

---

## 11. القرارات الموثقة

**قرار 1 — اختيار قاعدة البيانات:**
- [ ] Firebase RTDB خلف API (التوصية)
- [ ] Postgres من الصفر

**قرار 2 — طبقة API:**
- [ ] Cloud Functions (التوصية)
- [ ] NestJS مستقل

**قرار 3 — إطار الويب:**
- [ ] React (التوصية)
- [ ] Vue
- [ ] SvelteKit

**وافق عليها:** _________________  
**التاريخ:** _________________

---

## 12. المراجع والملحقات

- تدقيق معماري كامل: `ARCHITECTURAL_AUDIT.md` (إن أُنشئت)
- مخطط API: `/docs/api-schema.yaml` (Phase 1)
- مخطط قاعدة البيانات: `/docs/db-schema.md` (Phase 1)
- قائمة المهام: `/TASKS.md` (Phase 1)
