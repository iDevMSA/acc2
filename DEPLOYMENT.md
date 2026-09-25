# دليل نشر المنصة المحاسبية - نسخة الويب

## نظرة عامة
هذا المستند يوضح كيفية نشر نسخة الويب من المنصة المحاسبية على Firebase Hosting أو أي خادم ويب آخر.

## المتطلبات

### للنشر على Firebase (الموصى به):
- Node.js و npm
- حساب Firebase (مشروع موجود)
- Firebase CLI

### للنشر على خوادم أخرى:
- أي خادم ويب (Apache, Nginx, Vercel, Netlify, إلخ)
- ملف إعادة توجيه (`rewrite`) لـ SPA

## خطوات النشر

### 1. النشر على Firebase Hosting

#### التحضير الأول:
```bash
# تثبيت Firebase CLI
npm install -g firebase-tools

# تسجيل الدخول
firebase login

# في مجلد المشروع الرئيسي (acc2):
firebase init hosting
# اختر: الخادم الموجود
# اختر مجلد الاستضافة: web_sales
# اختر SPA: نعم
```

#### النشر:
```bash
# نشر إلى Firebase Hosting
firebase deploy --only hosting

# أو نشر كامل المشروع:
firebase deploy
```

### 2. النشر على Netlify

```bash
# نسخ محتويات web_sales إلى فرع جديد أو مجلد منفصل
# إنشاء ملف netlify.toml في جذر المشروع:

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# ثم:
npm install -g netlify-cli
netlify deploy --dir=web_sales
```

### 3. النشر على Vercel

```bash
# إنشاء ملف vercel.json:

{
  "buildCommand": "echo 'SPA configured'",
  "outputDirectory": "web_sales",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}

# ثم:
npm install -g vercel
vercel
```

### 4. النشر على خادم تقليدي (Apache/Nginx)

#### لـ Apache (.htaccess):
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### لـ Nginx:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## التحقق من السلامة

### 1. Firebase Rules
تأكد من وجود rules آمنة في Firebase Realtime Database:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "sales": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### 2. CORS و Headers
تأكد من تعيين الـ Headers الصحيحة:

```json
{
  "hosting": {
    "headers": [{
      "source": "/**",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" }
      ]
    }]
  }
}
```

### 3. HTTPS
تأكد من أن جميع الاتصالات تستخدم HTTPS (Firebase يوفر هذا افتراضياً).

## قائمة الفحص قبل الإطلاق

- [ ] اختبار التسجيل والدخول
- [ ] اختبار إنشاء فاتورة جديدة
- [ ] اختبار التقارير والرسوم البيانية
- [ ] اختبار تصدير PDF
- [ ] اختبار البحث والتصفية
- [ ] اختبار على جهاز موبايل
- [ ] اختبار PWA (تثبيت على الشاشة الرئيسية)
- [ ] اختبار العمل بدون إنترنت
- [ ] تحقق من أداء التحميل
- [ ] تحقق من Firebase Rules
- [ ] اختبار المزامنة مع التطبيق

## مراقبة الأداء

### في Firebase Console:
1. ذهب إلى "Hosting" → "Analytics"
2. راقب:
   - أوقات التحميل
   - معدلات الزيارات
   - الأخطاء
   - الدول الجغرافية

### استخدام Google Lighthouse:
```bash
# تثبيت
npm install -g lighthouse

# اختبار الأداء
lighthouse https://your-app.web.app/
```

## استكشاف الأخطاء

### المشكلة: "Cannot find module"
- تأكد من أن جميع المكتبات تم تحميلها من CDN
- تحقق من console للأخطاء

### المشكلة: Firebase Auth لا يعمل
- تحقق من Firebase Config في app.js
- تأكد من تفعيل Authentication في Firebase Console
- تحقق من Firebase Rules

### المشكلة: الرسوم البيانية لا تظهر
- تأكد من تحميل Chart.js
- تحقق من وجود البيانات
- اطلع على console للأخطاء

### المشكلة: PWA لا تثبت
- تأكد من HTTPS
- تحقق من manifest.json
- تحقق من Service Worker في console

## تحديثات منتظمة

### مراقبة التحديثات:
1. تحقق من Firebase Console أسبوعياً
2. استعرض Google Lighthouse شهرياً
3. حدّث المكتبات المستخدمة

## الدعم والمساعدة

للمساعدة:
1. تحقق من console (F12) للأخطاء
2. راجع Firebase Documentation
3. اطلب المساعدة من فريق التطوير

---
آخر تحديث: 2026-09-25
إصدار: 2.0
