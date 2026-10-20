// ============================================================
// Language Selector Component
// ============================================================

import { Globe } from 'lucide-react';
import { useState } from 'react';
import { useI18nStore } from '../../stores/i18n.store';
import type { SupportedLocale } from '../../../shared/utils/i18n';

export function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const { locale, setLocale, locales } = useI18nStore();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Change language"
        data-testid="language-selector"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{locales[locale]?.flag} {locale.toUpperCase()}</span>
        <span className="sm:hidden">{locales[locale]?.flag}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
            {(Object.entries(locales) as [SupportedLocale, typeof locales[SupportedLocale]][]).map(([code, info]) => (
              <button
                key={code}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors
                  ${locale === code ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                data-testid={`lang-option-${code}`}
              >
                <span className="text-base">{info.flag}</span>
                <span>{info.label}</span>
                {locale === code && <span className="ml-auto text-blue-500">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
