// ============================================================
// Currency Selector Component
// ============================================================

import { DollarSign } from 'lucide-react';
import { useState } from 'react';

const CURRENCIES = [
  { code: 'KRW', symbol: '₩', label: '한국 원' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'JPY', symbol: '¥', label: '日本円' },
  { code: 'CNY', symbol: '¥', label: '人民币' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'Pound' },
  { code: 'SGD', symbol: '$', label: 'SGD' },
];

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
}

export function CurrencySelector({ value, onChange }: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);
  const current = CURRENCIES.find(c => c.code === value) ?? CURRENCIES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Change currency"
        data-testid="currency-selector"
      >
        <DollarSign className="w-4 h-4" />
        <span className="hidden sm:inline">{current?.code}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
            {CURRENCIES.map(currency => (
              <button
                key={currency.code}
                onClick={() => { onChange(currency.code); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors
                  ${value === currency.code ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
              >
                <span className="font-mono w-6 text-center">{currency.symbol}</span>
                <span>{currency.code}</span>
                <span className="text-xs text-gray-400 ml-auto">{currency.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
