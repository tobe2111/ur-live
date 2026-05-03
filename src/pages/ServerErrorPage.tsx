import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, RefreshCw, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SEO from '@/components/SEO'

export default function ServerErrorPage() {
  const { t } = useTranslation()
  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center px-4">
      <SEO title={t('serverError.title')} description={t('serverError.seoDescription')} url="/500" noindex />
      <div className="max-w-lg w-full text-center">
        {/* Error Icon */}
        <div className="mb-8 smooth-appear">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#ff3b30]/10 to-[#ff9500]/10">
            <svg className="h-12 w-12 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Error Code */}
        <div className="mb-4 smooth-appear" style={{ animationDelay: '0.1s' }}>
          <span className="inline-block px-4 py-2 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] text-sm font-semibold tracking-tight">
            500 ERROR
          </span>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-[32px] sm:text-[40px] md:text-[48px] font-semibold leading-[1.0625] tracking-tight text-[#1d1d1f] smooth-appear" style={{ animationDelay: '0.2s' }}>
          {t('serverError.heading')}
        </h1>

        {/* Description */}
        <p className="mb-8 text-[17px] sm:text-[19px] leading-[1.47059] font-normal text-[#6e6e73] smooth-appear whitespace-pre-line" style={{ animationDelay: '0.3s' }}>
          {t('serverError.description')}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center smooth-appear" style={{ animationDelay: '0.4s' }}>
          <Button 
            className="apple-button"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('serverError.refresh')}
          </Button>
          
          <Button className="apple-button border border-[#007aff] bg-white text-[#007aff] hover:bg-[#007aff] hover:text-white" asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              {t('serverError.goHome')}
            </Link>
          </Button>
        </div>

        {/* Customer Support */}
        <div className="mt-12 pt-8 border-t border-black/5 smooth-appear" style={{ animationDelay: '0.5s' }}>
          <p className="mb-4 text-[14px] font-normal text-[#6e6e73]">
            {t('serverError.stillIssue')}
          </p>
          <a
            href="http://pf.kakao.com/_AITdn/chat"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 text-[15px] font-normal text-[#007aff] hover:text-[#0051d5] transition-colors rounded-lg hover:bg-[#007aff]/5"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {t('serverError.contactSupport')}
          </a>
        </div>

        {/* Status Page Link */}
        <div className="mt-8 smooth-appear" style={{ animationDelay: '0.6s' }}>
          <p className="text-[12px] font-normal text-[#6e6e73]">
            {t('serverError.statusCheck')}{' '}
            <a 
              href="https://live.ur-team.com" 
              target="_blank" rel="noopener noreferrer" 
              className="text-[#007aff] hover:text-[#0051d5] transition-colors"
            >
              live.ur-team.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
