import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isKorea } from '@/config/region'

interface Language {
  code: string
  label: string
  flag: string
}

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  
  const languages: Language[] = isKorea() 
    ? [
        { code: 'ko', label: '한국어', flag: '🇰🇷' },
        { code: 'en', label: 'English', flag: '🇺🇸' }
      ]
    : [
        { code: 'en', label: 'English', flag: '🇺🇸' },
        { code: 'ko', label: '한국어', flag: '🇰🇷' },
        { code: 'ja', label: '日本語', flag: '🇯🇵' },
        { code: 'zh', label: '中文', flag: '🇨🇳' }
      ]
  
  const currentLang = i18n.language || 'en'
  const currentLanguage = languages.find(l => l.code === currentLang) || languages[0]
  
  const changeLang = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem('i18nextLng', code)
  }
  
  return (
    <div className="relative group">
      <Button variant="ghost" size="sm" className="gap-2 h-10">
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLanguage.label}</span>
        <span className="inline sm:hidden">{currentLanguage.flag}</span>
      </Button>
      
      <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={() => changeLang(lang.code)}
            className={`
              block w-full text-left px-4 py-2 first:rounded-t-md last:rounded-b-md
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
              ${currentLang === lang.code ? 'bg-gray-50 dark:bg-gray-700 font-semibold' : ''}
            `}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  )
}
