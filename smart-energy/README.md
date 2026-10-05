# Smart Energy – نظام النقاط والاسترداد النقدي

موقع PWA (HTML/CSS/JS) + Firebase (Auth, Firestore, Cloud Functions, Hosting).

| الدور | الدخول | الصلاحيات |
|---|---|---|
| **الإدارة** | بريد + كلمة مرور (Firebase Auth) | كل شيء، تأكيد الإيداع، السجل |
| **الموظف** | رمز سري من 6 أرقام تولّده الإدارة | فحص QR، إضافة كابتن، تسجيل شحنة |
| **الكابتن** | رقم الهاتف + كود يصله برسالة SMS (Firebase Phone Auth) | ملفه، إحصاءات مجموعته، التنبيهات |

## الأمان
- كل الكتابة تمر عبر Cloud Functions؛ قواعد Firestore تمنع أي كتابة من المتصفح وتحصر القراءة حسب الدور.
- رموز الموظفين (مجزّأة) في مجموعة `secrets` بلا أي وصول من العميل.
- الكابتن يدخل برقمه وكود SMS؛ لا يدخل إلا رقم مسجّل لدى مجموعة، وأي رقم غير مسجل يُرفض بعد التحقق.
- قفل 15 دقيقة بعد محاولات فاشلة لرمز الموظف.
- كل عملية للإدارة والموظفين تُسجَّل في `audit` (تظهر للإدارة فقط).

## التشغيل على حسابك (مرة واحدة)
1. أنشئ مشروعًا في [Firebase console](https://console.firebase.google.com). فعّل **Authentication → Email/Password** و**Firestore** (اختر موقعًا قريبًا). Cloud Functions تتطلب خطة **Blaze** (الدفع حسب الاستهلاك، ولها حصة مجانية كبيرة).
2. أضف تطبيق ويب للمشروع وانسخ الإعدادات إلى `public/js/firebase-config.js`.
3. للإشعارات الفعلية: في **Project settings → Cloud Messaging → Web Push certificates** اضغط *Generate key pair* وضع المفتاح العام في `FCM_VAPID_KEY` داخل نفس الملف.
4. من **Authentication → Users** أضف مستخدم الإدارة (بريد + كلمة مرور).
5. `cp functions/.env.example functions/.env` وضع بريد الإدارة في `ADMIN_EMAILS`. (المنطقة الافتراضية `us-central1`؛ إن غيّرتها غيّر `FUNCTIONS_REGION` في الملفين.)
6. ضع معرّف المشروع في `.firebaserc`، ثم:

       npm i -g firebase-tools && firebase login
       (cd functions && npm install)
       firebase deploy

7. افتح رابط Hosting وسجّل دخول الإدارة. من الجوال: «إضافة إلى الشاشة الرئيسية» (أو زر «تثبيت التطبيق») لاستخدامه كتطبيق.

## تطوير واختبار محلي
    firebase emulators:start --only auth,functions,firestore,hosting --project demo-smart-energy
    cd functions && node test/totp.test.js && node test/e2e.js   # e2e يحتاج playwright

## إعادة بناء حزمة Firebase للواجهة
    cd tools && npm install && npm run build

## الإشعارات (FCM)
- الكابتن يضغط «تفعيل الإشعارات» مرة واحدة على جهازه فيصله التنبيه حتى لو كان التطبيق مغلقًا (اقتراب الشريحة، بلوغها، إيداع الاسترداد).
- التنبيه يُرسل من Cloud Functions بعد حفظ العملية، بلغة الجهاز (عربي/إنجليزي)، وتُحذف الأجهزة غير الصالحة تلقائيًا. الفشل في الإرسال لا يعطّل أي عملية.
- iPhone: الإشعارات تعمل فقط بعد «إضافة إلى الشاشة الرئيسية» (iOS 16.4+).

## النشر التلقائي (GitHub Actions)
كل دفع إلى `main` أو إلى فرع العمل ينشر الموقع والـ Functions والقواعد تلقائيًا (`.github/workflows/deploy-firebase.yml`).
1. Firebase console ← Project settings ← **Service accounts** ← *Generate new private key* (ملف JSON).
2. Google Cloud console ← IAM ← امنح حساب `firebase-adminsdk-...` الأدوار: **Editor** و**Service Account User** و**Firebase Admin**.
3. GitHub ← المستودع ← Settings ← Secrets and variables ← Actions ← *New repository secret* باسم `FIREBASE_SERVICE_ACCOUNT` ومحتواه الصق ملف JSON كاملًا.
4. Actions ← *Deploy to Firebase* ← *Run workflow*. الموقع بعدها على `https://smart-energy-41c4a.web.app`.

## دخول الكابتن برسالة SMS
1. Firebase ← Authentication ← Sign-in method ← فعّل **Phone**.
2. Authentication ← Settings ← **Authorized domains**: تأكد من وجود `smart-energy.web.app` (أضفه إن لم يكن).
3. Authentication ← Settings ← **SMS region policy**: اسمح بالأردن (`JO`) فقط لتقليل خطر الاستنزاف.
4. (موصى به) حماية الرصيد: Authentication ← Settings ← **Upgrade to Identity Platform** (مجاني ما دامت الفوترة مفعّلة)، ثم ضع `ENABLE_SMS_GATE=true` في `functions/.env.smart-energy-41c4a`. بهذا لا تُرسل رسالة إلا لأرقام الكباتن المسجّلين، وبحد 5 رسائل/ساعة للرقم. بدون هذه الخطوة يستطيع أي شخص يضغط «إرسال الكود» على أي رقم أن يستهلك رصيد الرسائل.
5. للتجربة المجانية: Sign-in method ← Phone ← **Phone numbers for testing** (رقم وكود ثابت بدون رسائل حقيقية).
