// ============================================================
// i18n Utility - Global Expansion Support
// Supports: ko, en, ja, zh, es, fr, de, ar (RTL)
// ============================================================

export const LOCALES = {
  ko: { label: '한국어', flag: '🇰🇷', currency: 'KRW', dir: 'ltr' },
  en: { label: 'English', flag: '🇺🇸', currency: 'USD', dir: 'ltr' },
  ja: { label: '日本語', flag: '🇯🇵', currency: 'JPY', dir: 'ltr' },
  zh: { label: '中文', flag: '🇨🇳', currency: 'CNY', dir: 'ltr' },
  es: { label: 'Español', flag: '🇪🇸', currency: 'EUR', dir: 'ltr' },
  fr: { label: 'Français', flag: '🇫🇷', currency: 'EUR', dir: 'ltr' },
  ar: { label: 'العربية', flag: '🇸🇦', currency: 'SAR', dir: 'rtl' },
} as const;

export type SupportedLocale = keyof typeof LOCALES;

// Translation strings
const translations: Record<SupportedLocale, Record<string, string>> = {
  ko: {
    'cart.empty': '장바구니가 비어있습니다',
    'cart.title': '장바구니',
    'cart.checkout': '결제하기',
    'cart.shipping': '배송비',
    'cart.free_shipping': '무료',
    'cart.total': '총 결제 금액',
    'cart.seller_section': '판매자별 상품',
    'checkout.shipping_info': '배송 정보',
    'checkout.order_items': '주문 상품',
    'checkout.payment_info': '결제 정보',
    'checkout.recipient': '수령인',
    'checkout.phone': '연락처',
    'checkout.address': '주소',
    'checkout.memo': '배송 메모',
    'order.status.PENDING': '결제 대기',
    'order.status.AWAITING_PAYMENT': '결제 진행중',
    'order.status.PAID': '결제 완료',
    'order.status.DONE': '결제 완료',
    'order.status.PREPARING': '상품 준비중',
    'order.status.SHIPPING': '배송중',
    'order.status.DELIVERED': '배송 완료',
    'order.status.CANCELLED': '취소됨',
    'order.status.FAILED': '결제 실패',
    'order.status.REFUNDED': '환불 완료',
    'payment.success': '결제 완료!',
    'payment.fail': '결제 실패',
    'auth.login': '로그인',
    'auth.register': '회원가입',
    'auth.logout': '로그아웃',
    'common.loading': '로딩 중...',
    'common.error': '오류가 발생했습니다',
    'common.back': '뒤로',
    'common.save': '저장',
    'common.cancel': '취소',
  },
  en: {
    'cart.empty': 'Your cart is empty',
    'cart.title': 'Shopping Cart',
    'cart.checkout': 'Checkout',
    'cart.shipping': 'Shipping',
    'cart.free_shipping': 'Free',
    'cart.total': 'Total',
    'cart.seller_section': 'Items by Seller',
    'checkout.shipping_info': 'Shipping Information',
    'checkout.order_items': 'Order Items',
    'checkout.payment_info': 'Payment',
    'checkout.recipient': 'Recipient',
    'checkout.phone': 'Phone',
    'checkout.address': 'Address',
    'checkout.memo': 'Delivery Note',
    'order.status.PENDING': 'Pending',
    'order.status.AWAITING_PAYMENT': 'Awaiting Payment',
    'order.status.PAID': 'Paid',
    'order.status.DONE': 'Confirmed',
    'order.status.PREPARING': 'Preparing',
    'order.status.SHIPPING': 'Shipped',
    'order.status.DELIVERED': 'Delivered',
    'order.status.CANCELLED': 'Cancelled',
    'order.status.FAILED': 'Failed',
    'order.status.REFUNDED': 'Refunded',
    'payment.success': 'Payment Successful!',
    'payment.fail': 'Payment Failed',
    'auth.login': 'Sign In',
    'auth.register': 'Sign Up',
    'auth.logout': 'Sign Out',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.back': 'Back',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
  },
  ja: {
    'cart.empty': 'カートは空です',
    'cart.title': 'ショッピングカート',
    'cart.checkout': '購入手続き',
    'cart.shipping': '送料',
    'cart.free_shipping': '無料',
    'cart.total': '合計',
    'cart.seller_section': 'セラー別商品',
    'checkout.shipping_info': '配送情報',
    'checkout.order_items': '注文商品',
    'checkout.payment_info': 'お支払い',
    'checkout.recipient': '受取人',
    'checkout.phone': '電話番号',
    'checkout.address': '住所',
    'checkout.memo': '配送メモ',
    'order.status.PENDING': '支払い待ち',
    'order.status.AWAITING_PAYMENT': '支払い処理中',
    'order.status.PAID': '支払い完了',
    'order.status.DONE': '確認済み',
    'order.status.PREPARING': '準備中',
    'order.status.SHIPPING': '配送中',
    'order.status.DELIVERED': '配達完了',
    'order.status.CANCELLED': 'キャンセル',
    'order.status.FAILED': '失敗',
    'order.status.REFUNDED': '返金済み',
    'payment.success': '支払い完了！',
    'payment.fail': '支払い失敗',
    'auth.login': 'ログイン',
    'auth.register': '新規登録',
    'auth.logout': 'ログアウト',
    'common.loading': '読み込み中...',
    'common.error': 'エラーが発生しました',
    'common.back': '戻る',
    'common.save': '保存',
    'common.cancel': 'キャンセル',
  },
  zh: {
    'cart.empty': '购物车是空的',
    'cart.title': '购物车',
    'cart.checkout': '去结算',
    'cart.shipping': '运费',
    'cart.free_shipping': '免费',
    'cart.total': '总计',
    'cart.seller_section': '按卖家分类',
    'checkout.shipping_info': '配送信息',
    'checkout.order_items': '订单商品',
    'checkout.payment_info': '支付信息',
    'checkout.recipient': '收件人',
    'checkout.phone': '电话',
    'checkout.address': '地址',
    'checkout.memo': '送货备注',
    'order.status.PENDING': '待付款',
    'order.status.AWAITING_PAYMENT': '付款中',
    'order.status.PAID': '已付款',
    'order.status.DONE': '已确认',
    'order.status.PREPARING': '备货中',
    'order.status.SHIPPING': '配送中',
    'order.status.DELIVERED': '已送达',
    'order.status.CANCELLED': '已取消',
    'order.status.FAILED': '失败',
    'order.status.REFUNDED': '已退款',
    'payment.success': '支付成功！',
    'payment.fail': '支付失败',
    'auth.login': '登录',
    'auth.register': '注册',
    'auth.logout': '退出',
    'common.loading': '加载中...',
    'common.error': '发生错误',
    'common.back': '返回',
    'common.save': '保存',
    'common.cancel': '取消',
  },
  es: {
    'cart.empty': 'Tu carrito está vacío',
    'cart.title': 'Carrito de compras',
    'cart.checkout': 'Pagar',
    'cart.shipping': 'Envío',
    'cart.free_shipping': 'Gratis',
    'cart.total': 'Total',
    'cart.seller_section': 'Artículos por vendedor',
    'checkout.shipping_info': 'Información de envío',
    'checkout.order_items': 'Artículos del pedido',
    'checkout.payment_info': 'Pago',
    'checkout.recipient': 'Destinatario',
    'checkout.phone': 'Teléfono',
    'checkout.address': 'Dirección',
    'checkout.memo': 'Nota de entrega',
    'order.status.PENDING': 'Pendiente',
    'order.status.AWAITING_PAYMENT': 'Esperando pago',
    'order.status.PAID': 'Pagado',
    'order.status.DONE': 'Confirmado',
    'order.status.PREPARING': 'Preparando',
    'order.status.SHIPPING': 'En camino',
    'order.status.DELIVERED': 'Entregado',
    'order.status.CANCELLED': 'Cancelado',
    'order.status.FAILED': 'Fallido',
    'order.status.REFUNDED': 'Reembolsado',
    'payment.success': '¡Pago exitoso!',
    'payment.fail': 'Pago fallido',
    'auth.login': 'Iniciar sesión',
    'auth.register': 'Registrarse',
    'auth.logout': 'Cerrar sesión',
    'common.loading': 'Cargando...',
    'common.error': 'Se produjo un error',
    'common.back': 'Volver',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
  },
  fr: {
    'cart.empty': 'Votre panier est vide',
    'cart.title': 'Panier',
    'cart.checkout': 'Commander',
    'cart.shipping': 'Livraison',
    'cart.free_shipping': 'Gratuit',
    'cart.total': 'Total',
    'cart.seller_section': 'Articles par vendeur',
    'checkout.shipping_info': 'Informations de livraison',
    'checkout.order_items': 'Articles commandés',
    'checkout.payment_info': 'Paiement',
    'checkout.recipient': 'Destinataire',
    'checkout.phone': 'Téléphone',
    'checkout.address': 'Adresse',
    'checkout.memo': 'Note de livraison',
    'order.status.PENDING': 'En attente',
    'order.status.AWAITING_PAYMENT': 'Paiement en cours',
    'order.status.PAID': 'Payé',
    'order.status.DONE': 'Confirmé',
    'order.status.PREPARING': 'En préparation',
    'order.status.SHIPPING': 'Expédié',
    'order.status.DELIVERED': 'Livré',
    'order.status.CANCELLED': 'Annulé',
    'order.status.FAILED': 'Échoué',
    'order.status.REFUNDED': 'Remboursé',
    'payment.success': 'Paiement réussi !',
    'payment.fail': 'Échec du paiement',
    'auth.login': 'Connexion',
    'auth.register': "S'inscrire",
    'auth.logout': 'Déconnexion',
    'common.loading': 'Chargement...',
    'common.error': 'Une erreur est survenue',
    'common.back': 'Retour',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
  },
  ar: {
    'cart.empty': 'سلة التسوق فارغة',
    'cart.title': 'سلة التسوق',
    'cart.checkout': 'إتمام الشراء',
    'cart.shipping': 'الشحن',
    'cart.free_shipping': 'مجاني',
    'cart.total': 'المجموع',
    'cart.seller_section': 'المنتجات حسب البائع',
    'checkout.shipping_info': 'معلومات الشحن',
    'checkout.order_items': 'عناصر الطلب',
    'checkout.payment_info': 'الدفع',
    'checkout.recipient': 'المستلم',
    'checkout.phone': 'الهاتف',
    'checkout.address': 'العنوان',
    'checkout.memo': 'ملاحظة التوصيل',
    'order.status.PENDING': 'في الانتظار',
    'order.status.AWAITING_PAYMENT': 'في انتظار الدفع',
    'order.status.PAID': 'مدفوع',
    'order.status.DONE': 'مؤكد',
    'order.status.PREPARING': 'قيد الإعداد',
    'order.status.SHIPPING': 'قيد الشحن',
    'order.status.DELIVERED': 'تم التوصيل',
    'order.status.CANCELLED': 'ملغى',
    'order.status.FAILED': 'فشل',
    'order.status.REFUNDED': 'تم الاسترداد',
    'payment.success': 'تم الدفع بنجاح!',
    'payment.fail': 'فشل الدفع',
    'auth.login': 'تسجيل الدخول',
    'auth.register': 'إنشاء حساب',
    'auth.logout': 'تسجيل الخروج',
    'common.loading': 'جار التحميل...',
    'common.error': 'حدث خطأ',
    'common.back': 'رجوع',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
  },
};

/**
 * Get translation for a key in a given locale
 * Falls back to 'en' if key not found, then returns the key itself
 */
export function t(key: string, locale: SupportedLocale = 'ko'): string {
  return (
    translations[locale]?.[key] ??
    translations['en']?.[key] ??
    key
  );
}

/**
 * Get locale from Accept-Language header (for Worker)
 */
export function getLocaleFromHeader(acceptLanguage: string | null | undefined): SupportedLocale {
  if (!acceptLanguage) return 'ko';

  const supported = Object.keys(LOCALES) as SupportedLocale[];
  const parts = acceptLanguage.split(',');

  for (const part of parts) {
    const lang = part.split(';')[0]?.trim().toLowerCase().slice(0, 2) as SupportedLocale;
    if (supported.includes(lang)) return lang;
  }

  return 'ko';
}

/**
 * Get currency for locale/country
 */
export function getCurrencyForCountry(country: string): string {
  const currencyMap: Record<string, string> = {
    KR: 'KRW',
    US: 'USD',
    JP: 'JPY',
    CN: 'CNY',
    GB: 'GBP',
    DE: 'EUR',
    FR: 'EUR',
    AU: 'AUD',
    CA: 'CAD',
    SG: 'SGD',
    SA: 'SAR',
    AE: 'AED',
  };
  return currencyMap[country.toUpperCase()] ?? 'USD';
}

/**
 * Format price for a specific locale and currency
 */
export function formatPrice(
  amount: number,
  currency: string,
  locale: SupportedLocale = 'ko'
): string {
  const localeMap: Record<SupportedLocale, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    ja: 'ja-JP',
    zh: 'zh-CN',
    es: 'es-ES',
    fr: 'fr-FR',
    ar: 'ar-SA',
  };

  return new Intl.NumberFormat(localeMap[locale] ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'KRW' || currency === 'JPY' ? 0 : 2,
  }).format(amount);
}

/**
 * Create i18n context object (for React context)
 */
export function createI18nContext(locale: SupportedLocale) {
  return {
    locale,
    dir: LOCALES[locale]?.dir ?? 'ltr',
    t: (key: string) => t(key, locale),
    formatPrice: (amount: number, currency: string) => formatPrice(amount, currency, locale),
  };
}
