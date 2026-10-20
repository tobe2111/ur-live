// ============================================================
// i18n Store - Zustand (Global Locale State)
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type SupportedLocale,
  LOCALES,
  t,
  formatPrice,
  createI18nContext,
} from '../../shared/utils/i18n';

interface I18nState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string) => string;
  formatPrice: (amount: number, currency: string) => string;
  dir: 'ltr' | 'rtl';
  locales: typeof LOCALES;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'ko' as SupportedLocale,
      locales: LOCALES,
      dir: 'ltr',

      setLocale: (locale: SupportedLocale) => {
        const ctx = createI18nContext(locale);
        // Update html lang and dir
        if (typeof document !== 'undefined') {
          document.documentElement.lang = locale;
          document.documentElement.dir = ctx.dir;
        }
        set({
          locale,
          dir: ctx.dir as 'ltr' | 'rtl',
        });
      },

      t: (key: string) => t(key, get().locale),
      formatPrice: (amount: number, currency: string) =>
        formatPrice(amount, currency, get().locale),
    }),
    {
      name: 'i18n-storage',
      partialize: (state) => ({ locale: state.locale }),
    }
  )
);

// Convenience hook
export function useTranslation() {
  return useI18nStore(state => ({
    t: state.t,
    locale: state.locale,
    setLocale: state.setLocale,
    formatPrice: state.formatPrice,
    dir: state.dir,
    locales: state.locales,
  }));
}
