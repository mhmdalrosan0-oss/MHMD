# Smart Energy – نظام النقاط والاسترداد النقدي

موقع PWA (HTML/CSS/JS) + Firebase (Auth, Firestore, Cloud Functions, Hosting).

| الدور | الدخول | الصلاحيات |
|---|---|---|
| **الإدارة** | بريد + كلمة مرور (Firebase Auth) | كل شيء، تأكيد الإيداع، السجل |
| **الموظف** | رمز سري من 6 أرقام تولّده الإدارة | فحص QR، إضافة كابتن، تسجيل شحنة |
| **الكابتن** | رقم الهاتف + رمز Google Authenticator | ملفه، إحصاءات مجموعته، التنبيهات |

## الأمان
- كل الكتابة تمر عبر Cloud Functions؛ قواعد Firestore تمنع أي كتابة من المتصفح وتحصر القراءة حسب الدور.
- أسرار TOTP ورموز الموظفين (مجزّأة) في مجموعة `secrets` بلا أي وصول من العميل.
- الكابتن يفعّل حسابه أول مرة برمز تفعيل (8 أرقام، مرة واحدة، 7 أيام) يسلّمه له الموظف/الإدارة — حتى لا يستطيع أحد يعرف رقمه ربط حسابه قبله.
- قفل 15 دقيقة بعد محاولات فاشلة، ومنع إعادة استخدام نفس رمز TOTP.
- كل عملية للإدارة والموظفين تُسجَّل في `audit` (تظهر للإدارة فقط).

## التشغيل على حسابك (مرة واحدة)
1. أنشئ مشروعًا في [Firebase console](https://console.firebase.google.com). فعّل **Authentication → Email/Password** و**Firestore** (اختر موقعًا قريبًا). Cloud Functions تتطلب خطة **Blaze** (الدفع حسب الاستهلاك، ولها حصة مجانية كبيرة).
2. أضف تطبيق ويب للمشروع وانسخ الإعدادات إلى `public/js/firebase-config.js`.
3. من **Authentication → Users** أضف مستخدم الإدارة (بريد + كلمة مرور).
4. `cp functions/.env.example functions/.env` وضع بريد الإدارة في `ADMIN_EMAILS`. (المنطقة الافتراضية `europe-west1`؛ إن غيّرتها غيّر `FUNCTIONS_REGION` في الملفين.)
5. ضع معرّف المشروع في `.firebaserc`، ثم:

       npm i -g firebase-tools && firebase login
       (cd functions && npm install)
       firebase deploy

6. افتح رابط Hosting وسجّل دخول الإدارة. من الجوال: «إضافة إلى الشاشة الرئيسية» (أو زر «تثبيت التطبيق») لاستخدامه كتطبيق.

## تطوير واختبار محلي
    firebase emulators:start --only auth,functions,firestore,hosting --project demo-smart-energy
    cd functions && node test/totp.test.js && node test/e2e.js   # e2e يحتاج playwright

## إعادة بناء حزمة Firebase للواجهة
    cd tools && npm install && npm run build
