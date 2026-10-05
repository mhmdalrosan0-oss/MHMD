/* Translations. Keys are used by t('key'). */
const I18N = {
  ar: {
    login: 'تسجيل الدخول', logout: 'خروج', back: 'رجوع', save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', add: 'إضافة', close: 'إغلاق', search: 'بحث', confirm: 'تأكيد',
    role_captain: 'كابتن', role_staff: 'موظف', role_admin: 'الإدارة',
    phone: 'رقم الهاتف', phone_hint: 'رقم الهاتف المرتبط بخدمة كليك / المحفظة', name: 'الاسم', password: 'كلمة المرور', code6: 'الرمز السري (6 أرقام)',
    enter: 'دخول', wrong_pass: 'كلمة المرور غير صحيحة', wrong_code: 'الرمز غير صحيح أو غير مفعّل', phone_not_found: 'هذا الرقم غير مسجل في أي مجموعة',
    choose_group: 'اختر المجموعة',
    // staff
    scan_title: 'فحص رمز المجموعة', scan_hint: 'وجّه الكاميرا نحو رمز QR الخاص بالكابتن', start_camera: 'تشغيل الكاميرا', stop_camera: 'إيقاف الكاميرا',
    scan_or_pick: 'أو اختر المجموعة يدويًا', camera_fail: 'تعذر تشغيل الكاميرا. يمكنك فحص الرمز بكاميرا الهاتف العادية أو اختيار المجموعة من القائمة.',
    group_not_found: 'المجموعة غير موجودة', login_staff_first: 'سجّل دخولك كموظف لإضافة شحنة لهذه المجموعة',
    new_captain: 'كابتن جديد', pick_captain: 'اختيار كابتن من القائمة', captains: 'الكباتن',
    captain_exists: 'تنبيه: هذا الرقم مسجل مسبقًا في المجموعة باسم', use_existing: 'استخدام الكابتن الموجود',
    charge_kwh: 'الكيلوواط المشحون (kWh)', add_charge: 'تسجيل الشحنة', charge_saved: 'تم تسجيل الشحنة', captain_added: 'تمت إضافة الكابتن',
    price_now: 'السعر الحالي', est_amount: 'القيمة التقريبية', per_kwh: 'للكيلوواط', invalid_number: 'أدخل قيمة صحيحة أكبر من صفر', invalid_phone: 'أدخل رقم هاتف صحيح', name_required: 'الاسم مطلوب',
    recent_charges: 'آخر الشحنات', no_data: 'لا توجد بيانات', no_captains: 'لا يوجد كباتن بعد',
    // stats
    month: 'الشهر', total_kwh: 'إجمالي الكيلوواط', kwh: 'ك.و', cashback_pct: 'نسبة الاسترداد', cashback: 'الاسترداد النقدي', sales: 'قيمة المشتريات',
    next_tier: 'الشريحة التالية', need_more: 'يلزم المزيد', reached_top: 'وصلتم لأعلى شريحة 🎉', current_tier: 'الشريحة الحالية',
    my_kwh: 'شحني هذا الشهر', group_kwh: 'شحن المجموعة هذا الشهر', my_share: 'حصتي التقديرية من الاسترداد', history: 'سجل الشحن', date: 'التاريخ', amount: 'القيمة', staff: 'الموظف',
    welcome: 'أهلاً', tiers_title: 'شرائح الاسترداد النقدي', tier_row: 'شحن {k} ك.و شهريًا أو أكثر', tier_base: 'حتى {k} ك.و شهريًا',
    // admin
    nav_dash: 'لوحة التحكم', nav_groups: 'المجموعات', nav_staff: 'الموظفون', nav_settings: 'الإعدادات',
    groups_count: 'المجموعات', captains_count: 'الكباتن', charges_count: 'عدد الشحنات', top_groups: 'ترتيب المجموعات هذا الشهر', daily_chart: 'الشحن اليومي (ك.و)',
    add_group: 'إضافة مجموعة', group_name: 'اسم المجموعة', manager_name: 'اسم مدير المجموعة (كابتن)', manager_phone: 'هاتف مدير المجموعة', logo: 'شعار المجموعة',
    group_saved: 'تم حفظ المجموعة', qr_code: 'رمز QR للمجموعة', download_qr: 'تنزيل الرمز كصورة', print: 'طباعة', qr_hint: 'سلّم هذا الرمز لمدير المجموعة ليوزّعه على الكباتن',
    group_tiers: 'شرائح خاصة بهذه المجموعة', use_default_tiers: 'استخدام الشرائح الافتراضية', custom_tiers: 'شرائح مخصصة',
    delete_group_q: 'حذف المجموعة وجميع كباتنها وشحناتها؟ لا يمكن التراجع.', delete_charge_q: 'حذف هذه الشحنة؟', delete_captain_q: 'حذف الكابتن وجميع شحناته؟',
    manager: 'المدير', export_csv: 'تصدير CSV', no_groups: 'لا توجد مجموعات. أضف أول مجموعة.',
    staff_add: 'إضافة موظف', staff_name: 'اسم الموظف', gen_code: 'توليد رمز جديد', active: 'مفعّل', disabled: 'معطّل', code: 'الرمز', toggle: 'تفعيل/تعطيل', new_code_for: 'الرمز السري الجديد للموظف',
    tiers_settings: 'شرائح الاسترداد النقدي الافتراضية', tier_kwh: 'كيلوواط شهريًا', tier_pct: 'نسبة الاسترداد %', add_tier: 'إضافة شريحة',
    tiers_note: 'تُحتسب النسبة حسب أعلى شريحة وصلت لها المجموعة. الشريحة الأولى هي الحد الأدنى (تُطبق حتى لو لم يصل الشحن إليها).',
    prices_settings: 'سعر الكيلوواط حسب الوقت', from: 'من', to: 'إلى', price: 'السعر', add_price: 'إضافة فترة', currency: 'العملة',
    admin_password: 'كلمة مرور الإدارة', new_password: 'كلمة مرور جديدة', change_password: 'تغيير كلمة المرور', password_changed: 'تم تغيير كلمة المرور', default_pass_warn: 'ما زالت كلمة المرور الافتراضية مفعّلة (admin123). غيّرها فورًا.',
    settings_saved: 'تم حفظ الإعدادات', data_tools: 'البيانات', export_backup: 'نسخة احتياطية (JSON)', import_backup: 'استيراد نسخة', load_demo: 'تحميل بيانات تجريبية', reset_all: 'مسح كل البيانات', reset_q: 'مسح كل البيانات نهائيًا؟', demo_loaded: 'تم تحميل البيانات التجريبية',
    storage_warn: 'تنبيه: البيانات حاليًا تُحفظ داخل هذا المتصفح فقط (نسخة تجريبية). للتشغيل الفعلي بين عدة أجهزة يلزم ربط الموقع بقاعدة بيانات سحابية.',
    overlap_warn: 'تنبيه: الفترات الزمنية متداخلة أو لا تغطي اليوم كاملًا',
    // misc
    lang: 'English', all_groups: 'كل المجموعات', copy_link: 'نسخ الرابط', copied: 'تم النسخ', details: 'التفاصيل', members: 'الأعضاء', share: 'حصة', pending_payout: 'مستحق الدفع',
  },
  en: {
    login: 'Sign in', logout: 'Logout', back: 'Back', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add', close: 'Close', search: 'Search', confirm: 'Confirm',
    role_captain: 'Captain', role_staff: 'Staff', role_admin: 'Admin',
    phone: 'Phone number', phone_hint: 'Number linked to Click / e-wallet', name: 'Name', password: 'Password', code6: 'Secret code (6 digits)',
    enter: 'Enter', wrong_pass: 'Wrong password', wrong_code: 'Invalid or disabled code', phone_not_found: 'This number is not registered in any group',
    choose_group: 'Choose group',
    scan_title: 'Scan group code', scan_hint: "Point the camera at the captain's QR code", start_camera: 'Start camera', stop_camera: 'Stop camera',
    scan_or_pick: 'Or pick the group manually', camera_fail: "Couldn't start the camera. Scan with your phone's normal camera or pick the group from the list.",
    group_not_found: 'Group not found', login_staff_first: 'Sign in as staff to add a charge for this group',
    new_captain: 'New captain', pick_captain: 'Pick captain from list', captains: 'Captains',
    captain_exists: 'Notice: this number is already registered in the group as', use_existing: 'Use existing captain',
    charge_kwh: 'Charged energy (kWh)', add_charge: 'Record charge', charge_saved: 'Charge recorded', captain_added: 'Captain added',
    price_now: 'Current price', est_amount: 'Approx. amount', per_kwh: 'per kWh', invalid_number: 'Enter a valid value above zero', invalid_phone: 'Enter a valid phone number', name_required: 'Name is required',
    recent_charges: 'Recent charges', no_data: 'No data', no_captains: 'No captains yet',
    month: 'Month', total_kwh: 'Total kWh', kwh: 'kWh', cashback_pct: 'Cashback rate', cashback: 'Cashback', sales: 'Purchases',
    next_tier: 'Next tier', need_more: 'Need', reached_top: 'Top tier reached 🎉', current_tier: 'Current tier',
    my_kwh: 'My charging this month', group_kwh: 'Group charging this month', my_share: 'My estimated cashback share', history: 'Charging history', date: 'Date', amount: 'Amount', staff: 'Staff',
    welcome: 'Welcome', tiers_title: 'Cashback tiers', tier_row: '{k} kWh/month or more', tier_base: 'Up to {k} kWh/month',
    nav_dash: 'Dashboard', nav_groups: 'Groups', nav_staff: 'Staff', nav_settings: 'Settings',
    groups_count: 'Groups', captains_count: 'Captains', charges_count: 'Charges', top_groups: 'Group ranking this month', daily_chart: 'Daily charging (kWh)',
    add_group: 'Add group', group_name: 'Group name', manager_name: 'Group manager (captain) name', manager_phone: 'Manager phone', logo: 'Group logo',
    group_saved: 'Group saved', qr_code: 'Group QR code', download_qr: 'Download as image', print: 'Print', qr_hint: 'Give this code to the group manager to share with captains',
    group_tiers: 'Tiers for this group', use_default_tiers: 'Use default tiers', custom_tiers: 'Custom tiers',
    delete_group_q: 'Delete the group with all its captains and charges? This cannot be undone.', delete_charge_q: 'Delete this charge?', delete_captain_q: 'Delete the captain and all their charges?',
    manager: 'Manager', export_csv: 'Export CSV', no_groups: 'No groups yet. Add the first one.',
    staff_add: 'Add staff', staff_name: 'Staff name', gen_code: 'Generate new code', active: 'Active', disabled: 'Disabled', code: 'Code', toggle: 'Enable/disable', new_code_for: 'New secret code for staff',
    tiers_settings: 'Default cashback tiers', tier_kwh: 'kWh per month', tier_pct: 'Cashback %', add_tier: 'Add tier',
    tiers_note: 'The rate follows the highest tier the group has reached. The first tier is the minimum rate (applies even below it).',
    prices_settings: 'Price per kWh by time of day', from: 'From', to: 'To', price: 'Price', add_price: 'Add period', currency: 'Currency',
    admin_password: 'Admin password', new_password: 'New password', change_password: 'Change password', password_changed: 'Password changed', default_pass_warn: 'The default password (admin123) is still active. Change it now.',
    settings_saved: 'Settings saved', data_tools: 'Data', export_backup: 'Backup (JSON)', import_backup: 'Import backup', load_demo: 'Load demo data', reset_all: 'Erase all data', reset_q: 'Erase all data permanently?', demo_loaded: 'Demo data loaded',
    storage_warn: 'Note: data is currently stored in this browser only (demo version). For real multi-device use, connect the site to a cloud database.',
    overlap_warn: 'Warning: time periods overlap or do not cover the full day',
    lang: 'العربية', all_groups: 'All groups', copy_link: 'Copy link', copied: 'Copied', details: 'Details', members: 'Members', share: 'Share', pending_payout: 'Payout due',
  }
};

/* ---- v2 additions (Firebase, Authenticator, payouts, audit, notifications) ---- */
Object.assign(I18N.ar, {
  loading: 'جارٍ التحميل…', email: 'البريد الإلكتروني', auth_code: 'رمز Google Authenticator (6 أرقام)', install_app: 'تثبيت التطبيق',
  activate_first: 'أول مرة؟ فعّل حسابك', activation_title: 'تفعيل حساب الكابتن', activation_code: 'رمز التفعيل (8 أرقام) من موظف الشحن', next: 'التالي',
  activate_scan: 'افتح تطبيق Google Authenticator واختر «+» ثم «مسح رمز QR»، ووجّه الكاميرا لهذا الرمز.', activate_secret: 'أو أدخل المفتاح يدويًا',
  activate_confirm: 'أدخل الرمز الظاهر الآن في التطبيق لتأكيد الربط', activated: 'تم تفعيل حسابك، ولن تحتاج رمز التفعيل مرة أخرى',
  login_hint_captain: 'أدخل رقم هاتفك والرمز الحالي من تطبيق Google Authenticator',
  setup_title: 'الموقع غير مربوط بـ Firebase بعد', setup_body: 'ضع إعدادات مشروعك في الملف public/js/firebase-config.js ثم أعد تحميل الصفحة.',
  // activation shown to staff/admin
  act_title: 'رمز تفعيل الكابتن', act_hint: 'سلّم هذا الرمز للكابتن شخصيًا. يستخدمه مرة واحدة لربط حسابه بـ Google Authenticator (صالح 7 أيام). لن يظهر مرة أخرى.', act_for: 'الكابتن',
  captain_other_group: 'هذا الرقم مسجل في مجموعة أخرى ({g}). لا يمكن للكابتن أن يكون في أكثر من مجموعة.',
  enrolled: 'مفعّل', not_enrolled: 'بانتظار التفعيل', reset_captain: 'إعادة تفعيل (رمز جديد)', reset_q: 'سيتم إلغاء ربط Google Authenticator الحالي وإنشاء رمز تفعيل جديد. متابعة؟',
  delete_captain_q: 'حذف الكابتن؟ تبقى شحناته السابقة محسوبة في إحصاءات المجموعة.',
  // nav
  nav_audit: 'السجل', nav_notifications: 'التنبيهات', notifications: 'التنبيهات', no_notifications: 'لا توجد تنبيهات',
  // notifications
  n_near: 'باقي {remaining} ك.و للوصول إلى {pct}%', n_near_t: 'اقتراب من الشريحة التالية',
  n_reached: 'وصلت مجموعتكم إلى شريحة استرداد {pct}% 🎉', n_reached_t: 'شريحة جديدة',
  n_payout: 'تم إيداع الاسترداد النقدي لشهر {month} بقيمة {amount} {currency} لمدير المجموعة', n_payout_t: 'تم إيداع الاسترداد النقدي',
  n_payout_undo: 'تم إلغاء تأكيد إيداع الاسترداد لشهر {month}', n_payout_undo_t: 'تحديث على الاسترداد', note: 'ملاحظة',
  // payout
  payout_title: 'الاسترداد النقدي الشهري', payout_paid: 'تم الإيداع', payout_pending: 'غير مودع', mark_paid: 'تم إيداع الاسترداد النقدي',
  payout_note: 'ملاحظات (اختياري)', payout_note_hint: 'تظهر لمدير المجموعة والكباتن في التنبيه', payout_to_manager: 'يُودع الاسترداد في حساب مدير المجموعة',
  undo_payout: 'إلغاء تأكيد الإيداع', undo_q: 'إلغاء تأكيد الإيداع؟ سيصل تنبيه للمجموعة.', paid_by: 'بواسطة', deposited_amount: 'المبلغ المودع',
  month_not_ended_hint: 'يمكن تأكيد الإيداع بعد انتهاء الشهر', manager_cashback: 'استرداد مجموعتك المتوقع (يُودع لك كمدير المجموعة)', payout_status: 'حالة الإيداع',
  // audit
  audit_title: 'سجل العمليات', actor: 'المنفذ', action: 'العملية', target: 'الهدف', details: 'التفاصيل', f_all: 'الكل', f_admin: 'الإدارة', f_staff: 'الموظفون', f_captain: 'الكباتن',
  a_createGroup: 'إضافة مجموعة', a_updateGroup: 'تعديل مجموعة', a_deleteGroup: 'حذف مجموعة', a_addCaptain: 'إضافة كابتن', a_resetCaptain: 'إعادة تفعيل كابتن', a_deleteCaptain: 'حذف كابتن',
  a_addCharge: 'تسجيل شحنة', a_deleteCharge: 'حذف شحنة', a_createStaff: 'إضافة موظف', a_regenStaff: 'توليد رمز موظف', a_toggleStaff: 'تفعيل/تعطيل موظف', a_deleteStaff: 'حذف موظف',
  a_saveSettings: 'تعديل الإعدادات', a_markPayout: 'تأكيد إيداع الاسترداد', a_unmarkPayout: 'إلغاء تأكيد الإيداع', a_captainEnrolled: 'تفعيل حساب كابتن',
  // settings
  timezone: 'المنطقة الزمنية', near_tier: 'تنبيه مدير المجموعة عندما يتبقى (ك.و) للشريحة التالية',
  // errors
  err_bad_credentials: 'بيانات الدخول غير صحيحة', err_bad_activation: 'رمز التفعيل غير صحيح أو منتهٍ', err_bad_code: 'الرمز غير صحيح، حاول مجددًا', err_locked: 'محاولات كثيرة، حاول بعد 15 دقيقة',
  err_bad_input: 'بيانات غير صالحة', err_bad_kwh: 'قيمة الكيلوواط غير صالحة (الحد الأقصى 300 للشحنة)', err_dup_captain: 'الرقم مسجل مسبقًا', err_month_not_ended: 'لا يمكن تأكيد الإيداع قبل انتهاء الشهر',
  err_already_paid: 'تم تأكيد الإيداع مسبقًا', err_is_manager: 'لا يمكن حذف مدير المجموعة. عدّل المجموعة أو احذفها.', err_prices_overlap: 'الفترات الزمنية يجب أن تغطي اليوم كاملًا بدون تداخل',
  err_bad_tiers: 'الشرائح غير صالحة', err_bad_prices: 'الأسعار غير صالحة', err_forbidden: 'غير مسموح', err_staff_disabled: 'حساب الموظف معطّل', err_login_required: 'سجّل الدخول أولًا',
  err_not_admin: 'هذا البريد غير مصرّح له كإدارة', err_generic: 'حدث خطأ، حاول مرة أخرى', err_network: 'تعذر الاتصال بالخادم',
});
Object.assign(I18N.en, {
  loading: 'Loading…', email: 'Email', auth_code: 'Google Authenticator code (6 digits)', install_app: 'Install app',
  activate_first: 'First time? Activate your account', activation_title: 'Activate captain account', activation_code: 'Activation code (8 digits) from the charging staff', next: 'Next',
  activate_scan: 'Open Google Authenticator, tap “+” then “Scan a QR code”, and point the camera at this code.', activate_secret: 'Or enter the key manually',
  activate_confirm: 'Enter the code currently shown in the app to confirm', activated: 'Your account is active. You will not need the activation code again',
  login_hint_captain: 'Enter your phone number and the current Google Authenticator code',
  setup_title: 'Firebase is not connected yet', setup_body: 'Put your project settings in public/js/firebase-config.js and reload.',
  act_title: 'Captain activation code', act_hint: 'Give this code to the captain in person. It is single-use, links the account to Google Authenticator (valid 7 days) and will not be shown again.', act_for: 'Captain',
  captain_other_group: 'This number is registered in another group ({g}). A captain cannot be in more than one group.',
  enrolled: 'Active', not_enrolled: 'Awaiting activation', reset_captain: 'Re-activate (new code)', reset_q: 'The current Google Authenticator link will be removed and a new activation code created. Continue?',
  delete_captain_q: 'Delete the captain? Their past charges stay counted in the group statistics.',
  nav_audit: 'Audit log', nav_notifications: 'Notifications', notifications: 'Notifications', no_notifications: 'No notifications',
  n_near: '{remaining} kWh left to reach {pct}%', n_near_t: 'Close to the next tier',
  n_reached: 'Your group reached the {pct}% cashback tier 🎉', n_reached_t: 'New tier',
  n_payout: 'Cashback for {month} ({amount} {currency}) has been deposited to the group manager', n_payout_t: 'Cashback deposited',
  n_payout_undo: 'Deposit confirmation for {month} was cancelled', n_payout_undo_t: 'Cashback update', note: 'Note',
  payout_title: 'Monthly cashback', payout_paid: 'Deposited', payout_pending: 'Not deposited', mark_paid: 'Cashback deposited',
  payout_note: 'Notes (optional)', payout_note_hint: 'Shown to the group manager and captains in the notification', payout_to_manager: "Cashback is deposited to the group manager's account",
  undo_payout: 'Cancel deposit confirmation', undo_q: 'Cancel the deposit confirmation? The group will be notified.', paid_by: 'By', deposited_amount: 'Deposited amount',
  month_not_ended_hint: 'Deposit can be confirmed after the month ends', manager_cashback: "Your group's expected cashback (deposited to you as manager)", payout_status: 'Deposit status',
  audit_title: 'Audit log', actor: 'By', action: 'Action', target: 'Target', details: 'Details', f_all: 'All', f_admin: 'Admin', f_staff: 'Staff', f_captain: 'Captains',
  a_createGroup: 'Group created', a_updateGroup: 'Group edited', a_deleteGroup: 'Group deleted', a_addCaptain: 'Captain added', a_resetCaptain: 'Captain re-activated', a_deleteCaptain: 'Captain deleted',
  a_addCharge: 'Charge recorded', a_deleteCharge: 'Charge deleted', a_createStaff: 'Staff added', a_regenStaff: 'Staff code regenerated', a_toggleStaff: 'Staff enabled/disabled', a_deleteStaff: 'Staff deleted',
  a_saveSettings: 'Settings changed', a_markPayout: 'Cashback deposit confirmed', a_unmarkPayout: 'Deposit confirmation cancelled', a_captainEnrolled: 'Captain account activated',
  timezone: 'Time zone', near_tier: 'Alert the group manager when this many kWh remain to the next tier',
  err_bad_credentials: 'Invalid credentials', err_bad_activation: 'Activation code is wrong or expired', err_bad_code: 'Wrong code, try again', err_locked: 'Too many attempts, try again in 15 minutes',
  err_bad_input: 'Invalid input', err_bad_kwh: 'Invalid kWh value (max 300 per charge)', err_dup_captain: 'Number already registered', err_month_not_ended: 'Cannot confirm a deposit before the month ends',
  err_already_paid: 'Deposit already confirmed', err_is_manager: 'Cannot delete the group manager. Edit or delete the group.', err_prices_overlap: 'Time periods must cover the full day without overlap',
  err_bad_tiers: 'Invalid tiers', err_bad_prices: 'Invalid prices', err_forbidden: 'Not allowed', err_staff_disabled: 'Staff account is disabled', err_login_required: 'Please sign in',
  err_not_admin: 'This email is not authorised as admin', err_generic: 'Something went wrong, try again', err_network: 'Cannot reach the server',
});

Object.assign(I18N.ar, { push_enable: 'تفعيل الإشعارات', push_hint: 'فعّل الإشعارات لتصلك التنبيهات (الاسترداد، اقتراب الشريحة) حتى لو كان التطبيق مغلقًا.', push_on: 'تم تفعيل الإشعارات على هذا الجهاز', push_denied: 'الإشعارات محظورة من إعدادات المتصفح' });
Object.assign(I18N.en, { push_enable: 'Enable notifications', push_hint: 'Enable notifications to get alerts (cashback, nearing a tier) even when the app is closed.', push_on: 'Notifications enabled on this device', push_denied: 'Notifications are blocked in the browser settings' });

/* ---- v3: captain login by SMS code ---- */
Object.assign(I18N.ar, {
  login_hint_captain: 'أدخل رقم هاتفك المسجّل وسنرسل لك كود دخول برسالة SMS',
  send_code: 'إرسال الكود', resend_code: 'إعادة إرسال الكود', change_number: 'تغيير الرقم', code_sent: 'تم إرسال الكود برسالة SMS',
  code_sent_to: 'أرسلنا كودًا إلى', sms_code: 'كود الرسالة (6 أرقام)',
  enrolled: 'دخل مسبقًا', not_enrolled: 'لم يدخل بعد', a_captainFirstLogin: 'أول دخول لكابتن',
  err_phone_not_registered: 'هذا الرقم غير مسجل لدى أي مجموعة. اطلب من موظف الشحن تسجيله.', err_too_many_sms: 'تم إرسال رسائل كثيرة لهذا الرقم، حاول بعد ساعة',
  'err_auth/invalid-phone-number': 'رقم الهاتف غير صحيح', 'err_auth/invalid-verification-code': 'الكود غير صحيح', 'err_auth/code-expired': 'انتهت صلاحية الكود، أعد إرسال كود جديد',
  'err_auth/too-many-requests': 'محاولات كثيرة، حاول لاحقًا', 'err_auth/captcha-check-failed': 'فشل التحقق الأمني، أعد المحاولة', 'err_auth/quota-exceeded': 'تجاوز حد الرسائل اليومي',
  'err_auth/operation-not-allowed': 'تسجيل الدخول بالهاتف غير مفعّل في Firebase أو الدولة غير مسموحة', 'err_auth/billing-not-enabled': 'خطة Blaze غير مفعّلة',
  'err_auth/unauthorized-domain': 'هذا الدومين غير مضاف في Authorized domains', 'err_auth/internal-error': 'الخدمة غير متاحة حاليًا، حاول لاحقًا', 'err_auth/network-request-failed': 'تعذر الاتصال بالإنترنت',
});
Object.assign(I18N.en, {
  login_hint_captain: 'Enter your registered phone number and we will text you a login code',
  send_code: 'Send code', resend_code: 'Resend code', change_number: 'Change number', code_sent: 'Code sent by SMS',
  code_sent_to: 'We sent a code to', sms_code: 'SMS code (6 digits)',
  enrolled: 'Has logged in', not_enrolled: 'Not logged in yet', a_captainFirstLogin: 'Captain first login',
  err_phone_not_registered: 'This number is not registered in any group. Ask the charging staff to register it.', err_too_many_sms: 'Too many messages sent to this number, try again in an hour',
  'err_auth/invalid-phone-number': 'Invalid phone number', 'err_auth/invalid-verification-code': 'Wrong code', 'err_auth/code-expired': 'Code expired, request a new one',
  'err_auth/too-many-requests': 'Too many attempts, try later', 'err_auth/captcha-check-failed': 'Security check failed, try again', 'err_auth/quota-exceeded': 'Daily SMS quota exceeded',
  'err_auth/operation-not-allowed': 'Phone sign-in is not enabled in Firebase or the country is not allowed', 'err_auth/billing-not-enabled': 'Blaze plan is not enabled',
  'err_auth/unauthorized-domain': 'This domain is not in Authorized domains', 'err_auth/internal-error': 'Service unavailable, try later', 'err_auth/network-request-failed': 'No internet connection',
});

Object.assign(I18N.ar, { session_expired: 'انتهت جلستك، سجّل الدخول مرة أخرى', err_session_expired: 'انتهت جلستك، سجّل الدخول مرة أخرى' });
Object.assign(I18N.en, { session_expired: 'Your session expired, please sign in again', err_session_expired: 'Your session expired, please sign in again' });
