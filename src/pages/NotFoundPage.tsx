import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Error Icon */}
        <div className="mb-8 smooth-appear">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#ff3b30]/10 to-[#ff9500]/10">
            <svg className="h-12 w-12 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Error Code */}
        <div className="mb-4 smooth-appear" style={{ animationDelay: '0.1s' }}>
          <span className="inline-block px-4 py-2 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] text-sm font-semibold tracking-tight">
            404 ERROR
          </span>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-[32px] sm:text-[40px] md:text-[48px] font-semibold leading-[1.0625] tracking-tight text-[#1d1d1f] smooth-appear" style={{ animationDelay: '0.2s' }}>
          페이지를 찾을 수 없어요
        </h1>

        {/* Description */}
        <p className="mb-8 text-[17px] sm:text-[19px] leading-[1.47059] font-normal text-[#6e6e73] smooth-appear" style={{ animationDelay: '0.3s' }}>
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          <br />
          URL을 확인하시거나 홈으로 돌아가주세요.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center smooth-appear" style={{ animationDelay: '0.4s' }}>
          <Button className="apple-button" asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>
          
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center px-6 py-3 text-[17px] font-normal text-[#007aff] hover:text-[#0051d5] transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            이전 페이지로
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-black/5 smooth-appear" style={{ animationDelay: '0.5s' }}>
          <p className="mb-4 text-[14px] font-normal text-[#6e6e73]">
            찾으시는 내용이 있나요?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/" className="text-[14px] font-normal text-[#007aff] hover:text-[#0051d5] transition-colors">
              라이브 방송
            </Link>
            <Link to="/my-orders" className="text-[14px] font-normal text-[#007aff] hover:text-[#0051d5] transition-colors">
              주문 내역
            </Link>
            <a href="http://pf.kakao.com/_AITdn/chat" target="_blank" rel="noopener noreferrer" className="text-[14px] font-normal text-[#007aff] hover:text-[#0051d5] transition-colors">
              고객센터
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
