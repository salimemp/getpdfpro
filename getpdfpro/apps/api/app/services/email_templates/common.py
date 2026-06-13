"""
Common email template infrastructure — shared HTML wrapper, brand
colors, i18n helper, plain-text fallback generator.

All GetPDFPro transactional emails flow through `wrap_html()` so the
look-and-feel is consistent (header, footer, brand colors, logo).

i18n: every template pulls strings via `_t(locale, key, **vars)`.
Supported locales: en (default), es, ar, hi. Unknown locales fall
back to English rather than raising.
"""

from __future__ import annotations

import html
import re
from typing import Any

# ─── Brand ────────────────────────────────────────────────────
BRAND_NAME = "GetPDFPro"
BRAND_TAGLINE = "PDF tools that respect your privacy"
BRAND_PRIMARY = "#0ea5e9"      # sky-500 — CTAs, header accent
BRAND_PRIMARY_DARK = "#0284c7"  # sky-600 — hover, emphasis
BRAND_TEXT = "#0f172a"          # slate-900 — body text
BRAND_MUTED = "#475569"         # slate-600 — secondary text
BRAND_BG = "#f8fafc"            # slate-50 — page background
BRAND_CARD = "#ffffff"          # card / panel
BRAND_BORDER = "#e2e8f0"        # slate-200 — dividers
BRAND_DANGER = "#dc2626"        # red-600 — destructive CTAs

# Public CDN-served logo (square PNG). Kept as a single source of
# truth so brand team can swap it without touching templates.
LOGO_URL = "https://cdn.getpdfpro.com/email/logo.png"
LOGO_ALT = "GetPDFPro logo"

SUPPORT_URL = "https://getpdfpro.com/support"
PRIVACY_URL = "https://getpdfpro.com/privacy"
TERMS_URL = "https://getpdfpro.com/terms"

SUPPORTED_LOCALES = ("en", "es", "ar", "hi")
DEFAULT_LOCALE = "en"


# ─── i18n ─────────────────────────────────────────────────────
# Flat dictionary keyed by (locale, key). Keep keys short and
# snake_case. Variables in values are referenced as `{name}` and
# substituted by `_t`.

_STRINGS: dict[str, dict[str, str]] = {
    "en": {
        # common
        "common.hello": "Hi {name},",
        "common.hello_generic": "Hello,",
        "common.signature": "— The {brand} team",
        "common.cta_fallback": "If the button above doesn't work, copy and paste this link into your browser:",
        "common.receipt_id": "Receipt",
        "common.questions": "Questions? Reply to this email or visit {support_url}.",
        "common.footer_rights": "© {year} {brand}. All rights reserved.",
        "common.footer_address": "{brand}, Inc. · Made for people who work with PDFs every day.",

        # welcome
        "welcome.subject": "Welcome to {brand}!",
        "welcome.preheader": "Your account is ready. Here's how to get started.",
        "welcome.heading": "Welcome to {brand} 🎉",
        "welcome.body": "Thanks for signing up, {name}. Your account is ready — no credit card needed, no data sold, no ads inside the app.",
        "welcome.body_short": "You can convert, merge, split, compress, sign, and protect PDFs from any device.",
        "welcome.cta": "Open your dashboard",
        "welcome.tip_title": "Quick tip",
        "welcome.tip_body": "Type '/' inside the editor to summon the AI assistant. It can summarize, translate, or rewrite any section of your PDF.",

        # verification
        "verify.subject": "Verify your {brand} email",
        "verify.preheader": "One click and you're in.",
        "verify.heading": "Verify your email",
        "verify.body": "Thanks for signing up for {brand}. Click the button below to confirm your email address and finish setting up your account.",
        "verify.cta": "Verify email",
        "verify.expiry": "This link expires in 1 hour.",
        "verify.ignore": "If you didn't create a {brand} account, you can safely ignore this email.",

        # password reset
        "reset.subject": "Reset your {brand} password",
        "reset.preheader": "We received a request to reset your password.",
        "reset.heading": "Reset your password",
        "reset.body": "We received a request to reset the password for your {brand} account ({email}). Click the button below to choose a new one.",
        "reset.cta": "Set a new password",
        "reset.expiry": "This link expires in 30 minutes. If you didn't request a reset, you can safely ignore this email — your password will stay the same.",
        "reset.ignore": "Didn't request this? Your account is still safe.",

        # magic link
        "magic.subject": "Your {brand} sign-in link",
        "magic.preheader": "One-tap sign in, no password needed.",
        "magic.heading": "Sign in to {brand}",
        "magic.body": "Click the button below to sign in to your {brand} account. No password required — your email is the key.",
        "magic.cta": "Sign in to {brand}",
        "magic.expiry": "This link expires in 15 minutes and can only be used once.",
        "magic.ignore": "If you didn't request this link, you can safely ignore this email.",

        # payment receipt
        "receipt.subject": "Receipt from {brand} — {plan}",
        "receipt.preheader": "Thanks for upgrading. Here's your receipt.",
        "receipt.heading": "Payment received — thanks!",
        "receipt.thanks": "We received your {plan} payment of {amount} {currency}. A copy of your invoice is available below.",
        "receipt.cta": "View invoice",
        "receipt.details_title": "Payment details",
        "receipt.plan_label": "Plan",
        "receipt.amount_label": "Amount",
        "receipt.date_label": "Date",
        "receipt.receipt_id_label": "Receipt ID",

        # payment failed
        "failed.subject": "Your {brand} payment didn't go through",
        "failed.preheader": "Action needed: update your payment method.",
        "failed.heading": "Payment failed",
        "failed.body": "We tried to charge {amount} {currency} for your {plan} plan, but the payment didn't go through. Your access may be interrupted if this isn't resolved within 7 days.",
        "failed.cta": "Update payment method",
        "failed.reason_title": "Common reasons",
        "failed.reason_1": "Your card has expired or was replaced.",
        "failed.reason_2": "Your bank flagged the charge as suspicious.",
        "failed.reason_3": "Insufficient funds at the time of the charge.",

        # plan upgraded
        "upgraded.subject": "You're now on {plan} 🎉",
        "upgraded.preheader": "Welcome to {plan}. Here's what just unlocked.",
        "upgraded.heading": "You're on {plan}",
        "upgraded.body": "Your upgrade to {plan} is live. New tools, higher limits, and priority support are all unlocked.",
        "upgraded.next_billing": "Next billing date: {date}",
        "upgraded.cta": "Explore your new tools",

        # plan cancelled
        "cancelled.subject": "Your {brand} subscription is cancelled",
        "cancelled.preheader": "You'll keep access until {date}.",
        "cancelled.heading": "Your subscription has been cancelled",
        "cancelled.body": "Your {plan} subscription is now cancelled. You'll keep access to paid features until {date}, after which your account reverts to the Free plan.",
        "cancelled.resume": "Changed your mind? You can reactivate from your account settings at any time.",
        "cancelled.cta": "Reactivate subscription",
    },
    "es": {
        "common.hello": "Hola {name},",
        "common.hello_generic": "Hola,",
        "common.signature": "— El equipo de {brand}",
        "common.cta_fallback": "Si el botón de arriba no funciona, copia y pega este enlace en tu navegador:",
        "common.receipt_id": "Recibo",
        "common.questions": "¿Preguntas? Responde a este correo o visita {support_url}.",
        "common.footer_rights": "© {year} {brand}. Todos los derechos reservados.",
        "common.footer_address": "{brand}, Inc. · Hecho para personas que trabajan con PDF todos los días.",

        "welcome.subject": "¡Bienvenido a {brand}!",
        "welcome.preheader": "Tu cuenta está lista. Aquí tienes cómo empezar.",
        "welcome.heading": "¡Bienvenido a {brand} 🎉",
        "welcome.body": "Gracias por registrarte, {name}. Tu cuenta está lista — sin tarjeta de crédito, sin venta de datos, sin anuncios dentro de la app.",
        "welcome.body_short": "Puedes convertir, fusionar, dividir, comprimir, firmar y proteger PDFs desde cualquier dispositivo.",
        "welcome.cta": "Abrir mi panel",
        "welcome.tip_title": "Consejo rápido",
        "welcome.tip_body": "Escribe '/' dentro del editor para invocar al asistente de IA. Puede resumir, traducir o reescribir cualquier sección de tu PDF.",

        "verify.subject": "Verifica tu correo de {brand}",
        "verify.preheader": "Un clic y listo.",
        "verify.heading": "Verifica tu correo",
        "verify.body": "Gracias por registrarte en {brand}. Haz clic en el botón de abajo para confirmar tu dirección de correo y terminar de configurar tu cuenta.",
        "verify.cta": "Verificar correo",
        "verify.expiry": "Este enlace caduca en 1 hora.",
        "verify.ignore": "Si no creaste una cuenta en {brand}, puedes ignorar este correo sin problemas.",

        "reset.subject": "Restablece tu contraseña de {brand}",
        "reset.preheader": "Recibimos una solicitud para restablecer tu contraseña.",
        "reset.heading": "Restablecer tu contraseña",
        "reset.body": "Recibimos una solicitud para restablecer la contraseña de tu cuenta de {brand} ({email}). Haz clic en el botón de abajo para elegir una nueva.",
        "reset.cta": "Elegir una nueva contraseña",
        "reset.expiry": "Este enlace caduca en 30 minutos. Si no solicitaste un restablecimiento, ignora este correo — tu contraseña seguirá igual.",
        "reset.ignore": "¿No solicitaste esto? Tu cuenta sigue estando segura.",

        "magic.subject": "Tu enlace de inicio de sesión de {brand}",
        "magic.preheader": "Inicio de sesión con un toque, sin contraseña.",
        "magic.heading": "Inicia sesión en {brand}",
        "magic.body": "Haz clic en el botón de abajo para iniciar sesión en tu cuenta de {brand}. No necesitas contraseña — tu correo es la llave.",
        "magic.cta": "Iniciar sesión en {brand}",
        "magic.expiry": "Este enlace caduca en 15 minutos y solo puede usarse una vez.",
        "magic.ignore": "Si no solicitaste este enlace, puedes ignorar este correo sin problemas.",

        "receipt.subject": "Recibo de {brand} — {plan}",
        "receipt.preheader": "Gracias por actualizar. Aquí tienes tu recibo.",
        "receipt.heading": "Pago recibido — ¡gracias!",
        "receipt.thanks": "Recibimos tu pago de {plan} por {amount} {currency}. Hay una copia de tu factura disponible abajo.",
        "receipt.cta": "Ver factura",
        "receipt.details_title": "Detalles del pago",
        "receipt.plan_label": "Plan",
        "receipt.amount_label": "Importe",
        "receipt.date_label": "Fecha",
        "receipt.receipt_id_label": "ID de recibo",

        "failed.subject": "Tu pago de {brand} no se procesó",
        "failed.preheader": "Acción necesaria: actualiza tu método de pago.",
        "failed.heading": "Pago fallido",
        "failed.body": "Intentamos cobrar {amount} {currency} por tu plan {plan}, pero el pago no se procesó. Tu acceso puede interrumpirse si esto no se resuelve en 7 días.",
        "failed.cta": "Actualizar método de pago",
        "failed.reason_title": "Razones habituales",
        "failed.reason_1": "Tu tarjeta ha caducado o fue reemplazada.",
        "failed.reason_2": "Tu banco marcó el cargo como sospechoso.",
        "failed.reason_3": "Fondos insuficientes al momento del cargo.",

        "upgraded.subject": "Ahora estás en {plan} 🎉",
        "upgraded.preheader": "Bienvenido a {plan}. Esto es lo que se desbloqueó.",
        "upgraded.heading": "Estás en {plan}",
        "upgraded.body": "Tu actualización a {plan} está activa. Nuevas herramientas, límites más altos y soporte prioritario están desbloqueados.",
        "upgraded.next_billing": "Próxima fecha de cobro: {date}",
        "upgraded.cta": "Explorar tus nuevas herramientas",

        "cancelled.subject": "Tu suscripción de {brand} se canceló",
        "cancelled.preheader": "Mantendrás el acceso hasta el {date}.",
        "cancelled.heading": "Tu suscripción ha sido cancelada",
        "cancelled.body": "Tu suscripción {plan} ha sido cancelada. Mantendrás el acceso a las funciones de pago hasta el {date}, después de lo cual tu cuenta volverá al plan Free.",
        "cancelled.resume": "¿Cambiaste de opinión? Puedes reactivar desde la configuración de tu cuenta en cualquier momento.",
        "cancelled.cta": "Reactivar suscripción",
    },
    "ar": {
        "common.hello": "مرحبا {name}،",
        "common.hello_generic": "مرحبا،",
        "common.signature": "— فريق {brand}",
        "common.cta_fallback": "إذا لم يعمل الزر أعلاه، انسخ والصق هذا الرابط في متصفحك:",
        "common.receipt_id": "إيصال",
        "common.questions": "أسئلة؟ رد على هذا البريد أو زر {support_url}.",
        "common.footer_rights": "© {year} {brand}. جميع الحقوق محفوظة.",
        "common.footer_address": "{brand}، Inc. · مصمم لمن يعملون مع ملفات PDF كل يوم.",

        "welcome.subject": "مرحبا بك في {brand}!",
        "welcome.preheader": "حسابك جاهز. إليك كيفية البدء.",
        "welcome.heading": "مرحبا بك في {brand} 🎉",
        "welcome.body": "شكرا لتسجيلك، {name}. حسابك جاهز — لا حاجة لبطاقة ائتمان، ولا بيع للبيانات، ولا إعلانات داخل التطبيق.",
        "welcome.body_short": "يمكنك تحويل ودمج وتقسيم وضغط وتوقيع وحماية ملفات PDF من أي جهاز.",
        "welcome.cta": "افتح لوحة التحكم",
        "welcome.tip_title": "نصيحة سريعة",
        "welcome.tip_body": "اكتب '/' داخل المحرر لاستدعاء مساعد الذكاء الاصطناعي. يمكنه تلخيص أو ترجمة أو إعادة كتابة أي قسم من ملف PDF.",

        "verify.subject": "تحقق من بريدك في {brand}",
        "verify.preheader": "نقرة واحدة وستدخل.",
        "verify.heading": "تحقق من بريدك",
        "verify.body": "شكرا لتسجيلك في {brand}. انقر على الزر أدناه لتأكيد عنوان بريدك الإلكتروني وإنهاء إعداد حسابك.",
        "verify.cta": "تحقق من البريد",
        "verify.expiry": "تنتهي صلاحية هذا الرابط خلال ساعة واحدة.",
        "verify.ignore": "إذا لم تنشئ حسابا في {brand}، يمكنك تجاهل هذا البريد بأمان.",

        "reset.subject": "أعد تعيين كلمة مرور {brand}",
        "reset.preheader": "تلقينا طلبا لإعادة تعيين كلمة مرورك.",
        "reset.heading": "إعادة تعيين كلمة المرور",
        "reset.body": "تلقينا طلبا لإعادة تعيين كلمة مرور حسابك في {brand} ({email}). انقر على الزر أدناه لاختيار كلمة مرور جديدة.",
        "reset.cta": "تعيين كلمة مرور جديدة",
        "reset.expiry": "تنتهي صلاحية هذا الرابط خلال 30 دقيقة. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذا البريد — ستبقى كلمة مرورك كما هي.",
        "reset.ignore": "لم تطلب ذلك؟ حسابك لا يزال آمنا.",

        "magic.subject": "رابط تسجيل الدخول إلى {brand}",
        "magic.preheader": "تسجيل دخول بنقرة واحدة، بدون كلمة مرور.",
        "magic.heading": "تسجيل الدخول إلى {brand}",
        "magic.body": "انقر على الزر أدناه لتسجيل الدخول إلى حسابك في {brand}. لا حاجة لكلمة مرور — بريدك الإلكتروني هو المفتاح.",
        "magic.cta": "تسجيل الدخول إلى {brand}",
        "magic.expiry": "تنتهي صلاحية هذا الرابط خلال 15 دقيقة ولا يمكن استخدامه إلا مرة واحدة.",
        "magic.ignore": "إذا لم تطلب هذا الرابط، يمكنك تجاهل هذا البريد بأمان.",

        "receipt.subject": "إيصال من {brand} — {plan}",
        "receipt.preheader": "شكرا لترقيتك. إليك الإيصال.",
        "receipt.heading": "تم استلام الدفع — شكرا!",
        "receipt.thanks": "تلقينا دفعتك لخطة {plan} بقيمة {amount} {currency}. تتوفر نسخة من فاتورتك أدناه.",
        "receipt.cta": "عرض الفاتورة",
        "receipt.details_title": "تفاصيل الدفع",
        "receipt.plan_label": "الخطة",
        "receipt.amount_label": "المبلغ",
        "receipt.date_label": "التاريخ",
        "receipt.receipt_id_label": "معرّف الإيصال",

        "failed.subject": "لم تتم معالجة دفعتك لـ {brand}",
        "failed.preheader": "إجراء مطلوب: حدّث وسيلة الدفع.",
        "failed.heading": "فشل الدفع",
        "failed.body": "حاولنا خصم {amount} {currency} لخطة {plan}، لكن الدفع لم يتم. قد يتوقف وصولك إذا لم يتم حل هذا خلال 7 أيام.",
        "failed.cta": "تحديث وسيلة الدفع",
        "failed.reason_title": "أسباب شائعة",
        "failed.reason_1": "بطاقتك انتهت صلاحيتها أو تم استبدالها.",
        "failed.reason_2": "بنكك أوقف العملية كإجراء احترازي.",
        "failed.reason_3": "رصيد غير كاف وقت الخصم.",

        "upgraded.subject": "أنت الآن على خطة {plan} 🎉",
        "upgraded.preheader": "مرحبا بك في {plan}. إليك ما تم فتحه.",
        "upgraded.heading": "أنت على خطة {plan}",
        "upgraded.body": "ترقيتك إلى {plan} نشطة. أدوات جديدة، حدود أعلى، ودعم ذو أولوية — كلها متاحة الآن.",
        "upgraded.next_billing": "تاريخ الفوترة التالي: {date}",
        "upgraded.cta": "استكشف أدواتك الجديدة",

        "cancelled.subject": "تم إلغاء اشتراكك في {brand}",
        "cancelled.preheader": "ستحتفظ بالوصول حتى {date}.",
        "cancelled.heading": "تم إلغاء اشتراكك",
        "cancelled.body": "تم إلغاء اشتراكك في خطة {plan}. ستحتفظ بالوصول إلى الميزات المدفوعة حتى {date}، بعدها سيعود حسابك إلى الخطة المجانية.",
        "cancelled.resume": "غيّرت رأيك؟ يمكنك إعادة التفعيل من إعدادات حسابك في أي وقت.",
        "cancelled.cta": "إعادة تفعيل الاشتراك",
    },
    "hi": {
        "common.hello": "नमस्ते {name},",
        "common.hello_generic": "नमस्ते,",
        "common.signature": "— {brand} टीम",
        "common.cta_fallback": "यदि ऊपर का बटन काम नहीं करता, तो इस लिंक को कॉपी करके अपने ब्राउज़र में पेस्ट करें:",
        "common.receipt_id": "रसीद",
        "common.questions": "कोई सवाल? इस ईमेल का जवाब दें या {support_url} पर जाएँ।",
        "common.footer_rights": "© {year} {brand}. सर्वाधिकार सुरक्षित।",
        "common.footer_address": "{brand}, Inc. · उन लोगों के लिए बनाया गया जो रोज़ PDF के साथ काम करते हैं।",

        "welcome.subject": "{brand} में आपका स्वागत है!",
        "welcome.preheader": "आपका खाता तैयार है। शुरू करने का तरीका यहाँ है।",
        "welcome.heading": "{brand} में आपका स्वागत है 🎉",
        "welcome.body": "साइन अप करने के लिए धन्यवाद, {name}। आपका खाता तैयार है — कोई क्रेडिट कार्ड नहीं, कोई डेटा बिक्री नहीं, ऐप के अंदर कोई विज्ञापन नहीं।",
        "welcome.body_short": "आप किसी भी डिवाइस से PDF को बदल सकते हैं, मर्ज कर सकते हैं, विभाजित कर सकते हैं, कंप्रेस कर सकते हैं, साइन कर सकते हैं और सुरक्षित कर सकते हैं।",
        "welcome.cta": "डैशबोर्ड खोलें",
        "welcome.tip_title": "त्वरित सुझाव",
        "welcome.tip_body": "AI असिस्टेंट को बुलाने के लिए एडिटर के अंदर '/' टाइप करें। यह आपके PDF के किसी भी हिस्से को सारांशित, अनुवाद या फिर से लिख सकता है।",

        "verify.subject": "अपना {brand} ईमेल सत्यापित करें",
        "verify.preheader": "एक क्लिक और आप अंदर हैं।",
        "verify.heading": "अपना ईमेल सत्यापित करें",
        "verify.body": "{brand} के लिए साइन अप करने के लिए धन्यवाद। अपना ईमेल पता पुष्टि करने और अपना खाता सेटअप पूरा करने के लिए नीचे दिए गए बटन पर क्लिक करें।",
        "verify.cta": "ईमेल सत्यापित करें",
        "verify.expiry": "यह लिंक 1 घंटे में समाप्त हो जाएगा।",
        "verify.ignore": "यदि आपने {brand} खाता नहीं बनाया है, तो आप इस ईमेल को सुरक्षित रूप से अनदेखा कर सकते हैं।",

        "reset.subject": "अपना {brand} पासवर्ड रीसेट करें",
        "reset.preheader": "हमें आपके पासवर्ड रीसेट करने का अनुरोध मिला है।",
        "reset.heading": "अपना पासवर्ड रीसेट करें",
        "reset.body": "हमें आपके {brand} खाते ({email}) के पासवर्ड को रीसेट करने का अनुरोध मिला है। नया पासवर्ड चुनने के लिए नीचे दिए गए बटन पर क्लिक करें।",
        "reset.cta": "नया पासवर्ड सेट करें",
        "reset.expiry": "यह लिंक 30 मिनट में समाप्त हो जाएगा। यदि आपने रीसेट का अनुरोध नहीं किया है, तो आप इस ईमेल को अनदेखा कर सकते हैं — आपका पासवर्ड वही रहेगा।",
        "reset.ignore": "इसका अनुरोध नहीं किया? आपका खाता फिर भी सुरक्षित है।",

        "magic.subject": "आपका {brand} साइन-इन लिंक",
        "magic.preheader": "एक-टैप साइन इन, पासवर्ड की आवश्यकता नहीं।",
        "magic.heading": "{brand} में साइन इन करें",
        "magic.body": "अपने {brand} खाते में साइन इन करने के लिए नीचे दिए गए बटन पर क्लिक करें। पासवर्ड की आवश्यकता नहीं — आपका ईमेल ही कुंजी है।",
        "magic.cta": "{brand} में साइन इन करें",
        "magic.expiry": "यह लिंक 15 मिनट में समाप्त हो जाएगा और केवल एक बार उपयोग किया जा सकता है।",
        "magic.ignore": "यदि आपने यह लिंक नहीं माँगा, तो आप इस ईमेल को सुरक्षित रूप से अनदेखा कर सकते हैं।",

        "receipt.subject": "{brand} से रसीद — {plan}",
        "receipt.preheader": "अपग्रेड करने के लिए धन्यवाद। यहाँ आपकी रसीद है।",
        "receipt.heading": "भुगतान प्राप्त — धन्यवाद!",
        "receipt.thanks": "हमें आपका {plan} भुगतान {amount} {currency} प्राप्त हुआ। आपके चालान की एक प्रति नीचे उपलब्ध है।",
        "receipt.cta": "चालान देखें",
        "receipt.details_title": "भुगतान विवरण",
        "receipt.plan_label": "प्लान",
        "receipt.amount_label": "राशि",
        "receipt.date_label": "तारीख",
        "receipt.receipt_id_label": "रसीद आईडी",

        "failed.subject": "आपका {brand} भुगतान नहीं हो पाया",
        "failed.preheader": "कार्रवाई आवश्यक: अपनी भुगतान विधि अपडेट करें।",
        "failed.heading": "भुगतान विफल",
        "failed.body": "हमने आपके {plan} प्लान के लिए {amount} {currency} चार्ज करने का प्रयास किया, लेकिन भुगतान नहीं हो पाया। यदि 7 दिनों में इसे हल नहीं किया गया तो आपकी पहुँच बाधित हो सकती है।",
        "failed.cta": "भुगतान विधि अपडेट करें",
        "failed.reason_title": "सामान्य कारण",
        "failed.reason_1": "आपका कार्ड समाप्त हो गया है या बदल दिया गया है।",
        "failed.reason_2": "आपके बैंक ने चार्ज को संदिग्ध के रूप में फ़्लैग किया।",
        "failed.reason_3": "चार्ज के समय पर्याप्त फंड नहीं था।",

        "upgraded.subject": "अब आप {plan} पर हैं 🎉",
        "upgraded.preheader": "{plan} में आपका स्वागत है। यहाँ वह है जो अभी अनलॉक हुआ।",
        "upgraded.heading": "आप {plan} पर हैं",
        "upgraded.body": "आपका {plan} पर अपग्रेड लाइव है। नए टूल, उच्च सीमा, और प्राथमिकता सहायता — सब कुछ अनलॉक है।",
        "upgraded.next_billing": "अगली बिलिंग तिथि: {date}",
        "upgraded.cta": "अपने नए टूल देखें",

        "cancelled.subject": "आपका {brand} सब्सक्रिप्शन रद्द कर दिया गया है",
        "cancelled.preheader": "आप {date} तक पहुँच बनाए रखेंगे।",
        "cancelled.heading": "आपका सब्सक्रिप्शन रद्द कर दिया गया है",
        "cancelled.body": "आपका {plan} सब्सक्रिप्शन अब रद्द कर दिया गया है। आप {date} तक सशुल्क सुविधाओं तक पहुँच बनाए रखेंगे, जिसके बाद आपका खाता फ्री प्लान पर वापस आ जाएगा।",
        "cancelled.resume": "मन बदल गया? आप कभी भी अपनी खाता सेटिंग्स से फिर से सक्रिय कर सकते हैं।",
        "cancelled.cta": "सब्सक्रिप्शन फिर से सक्रिय करें",
    },
}


def _normalize_locale(locale: str | None) -> str:
    """Return a supported locale, falling back to DEFAULT_LOCALE."""
    if not locale:
        return DEFAULT_LOCALE
    candidate = locale.lower().split("-")[0].split("_")[0]
    return candidate if candidate in SUPPORTED_LOCALES else DEFAULT_LOCALE


def _t(locale: str, key: str, **vars: Any) -> str:
    """
    Localize a string key for the given locale.

    Falls back to English, then to the key itself if the key is
    unknown. Variables in the value are interpolated as `{name}`.
    """
    locale = _normalize_locale(locale)
    value = _STRINGS.get(locale, {}).get(key)
    if value is None:
        value = _STRINGS[DEFAULT_LOCALE].get(key, key)
    try:
        return value.format(brand=BRAND_NAME, **vars)
    except (KeyError, IndexError):
        # If a variable is missing, return the raw value rather than
        # raising — broken copy is better than a 500.
        return value


# ─── HTML wrapper ─────────────────────────────────────────────
def wrap_html(
    *,
    preheader: str,
    body_html: str,
    locale: str = DEFAULT_LOCALE,
) -> str:
    """
    Wrap inner body content in the GetPDFPro brand shell.

    Layout is table-based for maximum email-client compatibility
    (Outlook desktop, Gmail, Apple Mail, Yahoo — all of them).
    """
    locale = _normalize_locale(locale)
    year = "2026"
    is_rtl = locale == "ar"
    dir_attr = ' dir="rtl"' if is_rtl else ""

    preheader_block = (
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;'
        f'font-size:1px;color:{BRAND_BG};line-height:1px;">'
        f'{html.escape(preheader)}</div>'
    )

    return f"""<!DOCTYPE html>
<html lang="{locale}"{dir_attr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>{html.escape(BRAND_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:{BRAND_BG};color:{BRAND_TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
{preheader_block}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{BRAND_BG};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:{BRAND_CARD};border:1px solid {BRAND_BORDER};border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px;background:{BRAND_CARD};border-bottom:1px solid {BRAND_BORDER};">
            <img src="{LOGO_URL}" alt="{html.escape(LOGO_ALT)}" width="32" height="32" style="display:block;border:0;outline:none;text-decoration:none;vertical-align:middle;">
            <span style="display:inline-block;margin-{ 'right' if is_rtl else 'left' }:10px;font-weight:600;font-size:18px;color:{BRAND_TEXT};vertical-align:middle;">{BRAND_NAME}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
{body_html}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:{BRAND_BG};border-top:1px solid {BRAND_BORDER};color:{BRAND_MUTED};font-size:12px;line-height:1.5;">
            <p style="margin:0 0 8px 0;">{_t(locale, 'common.questions', support_url=SUPPORT_URL)}</p>
            <p style="margin:0 0 4px 0;">{_t(locale, 'common.footer_address')}</p>
            <p style="margin:0;">{_t(locale, 'common.footer_rights', year=year)}</p>
            <p style="margin:8px 0 0 0;">
              <a href="{PRIVACY_URL}" style="color:{BRAND_MUTED};text-decoration:underline;">Privacy</a>
              &nbsp;·&nbsp;
              <a href="{TERMS_URL}" style="color:{BRAND_MUTED};text-decoration:underline;">Terms</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


# ─── Reusable building blocks ─────────────────────────────────
def heading(text: str, *, color: str = BRAND_TEXT, size: int = 24) -> str:
    return f'<h1 style="margin:0 0 16px 0;font-size:{size}px;font-weight:700;color:{color};line-height:1.25;">{html.escape(text)}</h1>'


def paragraph(text: str, *, color: str = BRAND_TEXT, size: int = 16) -> str:
    return f'<p style="margin:0 0 16px 0;font-size:{size}px;color:{color};line-height:1.55;">{text}</p>'


def cta_button(
    url: str,
    label: str,
    *,
    color: str = BRAND_PRIMARY,
    text_color: str = "#ffffff",
) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">'
        f'<tr><td bgcolor="{color}" style="border-radius:8px;">'
        f'<a href="{html.escape(url, quote=True)}" target="_blank" '
        f'style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;'
        f'color:{text_color};text-decoration:none;border-radius:8px;background:{color};">'
        f'{html.escape(label)}</a>'
        f'</td></tr></table>'
    )


def info_panel(content_html: str, *, border_color: str = BRAND_BORDER) -> str:
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="margin:16px 0;border:1px solid {border_color};border-radius:8px;background:{BRAND_BG};">'
        f'<tr><td style="padding:16px 20px;">{content_html}</td></tr></table>'
    )


def label_value_row(label: str, value: str) -> str:
    """A simple 2-column key/value row, used in receipts."""
    return (
        f'<tr>'
        f'<td style="padding:6px 0;color:{BRAND_MUTED};font-size:14px;width:40%;">{html.escape(label)}</td>'
        f'<td style="padding:6px 0;color:{BRAND_TEXT};font-size:14px;font-weight:500;">{html.escape(str(value))}</td>'
        f'</tr>'
    )


def fallback_text_block(text: str) -> str:
    """Helper for the `If the button doesn't work…` block."""
    return (
        f'<p style="margin:16px 0 0 0;font-size:12px;color:{BRAND_MUTED};word-break:break-all;">'
        f'{text}</p>'
    )


# ─── Plain-text builder ───────────────────────────────────────
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_BR_RE = re.compile(r"<\s*br\s*/?\s*>", re.IGNORECASE)
_HTML_P_CLOSE_RE = re.compile(r"</\s*p\s*>", re.IGNORECASE)
_HTML_BLOCK_END_RE = re.compile(r"</\s*(?:tr|table|h[1-6]|li)\s*>", re.IGNORECASE)


def html_to_text(html_str: str) -> str:
    """
    Best-effort HTML → plain-text converter for email clients that
    prefer text/plain. Not a full sanitizer — just strips tags and
    inserts newlines at block boundaries.
    """
    # Normalise block boundaries to newlines
    text = _HTML_BR_RE.sub("\n", html_str)
    text = _HTML_P_CLOSE_RE.sub("\n\n", text)
    text = _HTML_BLOCK_END_RE.sub("\n", text)
    # Strip remaining tags
    text = _HTML_TAG_RE.sub("", text)
    # Decode common HTML entities
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&mdash;", "—")
        .replace("&ndash;", "–")
    )
    # Collapse 3+ blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def plain_footer(locale: str = DEFAULT_LOCALE) -> str:
    """Plain-text footer that mirrors the HTML footer block."""
    locale = _normalize_locale(locale)
    year = "2026"
    return (
        f"{_t(locale, 'common.questions', support_url=SUPPORT_URL)}\n"
        f"{_t(locale, 'common.footer_address')}\n"
        f"{_t(locale, 'common.footer_rights', year=year)}\n"
        f"Privacy: {PRIVACY_URL}\n"
        f"Terms: {TERMS_URL}\n"
    )


def build_text(
    *,
    preheader: str,
    body_text: str,
    locale: str = DEFAULT_LOCALE,
) -> str:
    """Assemble a complete plain-text email body."""
    locale = _normalize_locale(locale)
    return (
        f"{preheader}\n\n"
        f"{body_text.strip()}\n\n"
        f"{plain_footer(locale)}"
    )


def currency_format(amount: float, currency: str) -> str:
    """
    Minimal currency formatter — Resend / email clients don't need
    locale-aware grouping, just a clean display. Uses the currency
    symbol when recognised, falls back to the ISO code.
    """
    symbols = {
        "USD": "$",
        "EUR": "€",
        "GBP": "£",
        "INR": "₹",
        "JPY": "¥",
    }
    symbol = symbols.get(currency.upper(), currency.upper() + " ")
    # Two decimals for most currencies, zero for JPY
    if currency.upper() == "JPY":
        return f"{symbol}{amount:,.0f}"
    return f"{symbol}{amount:,.2f}"
