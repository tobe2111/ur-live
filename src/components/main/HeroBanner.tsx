import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function HeroBanner() {
  const navigate = useNavigate()

  return (
    <section className="relative w-full overflow-hidden">
      <div 
        className="relative w-full cursor-pointer hover:opacity-95 transition-opacity"
        style={{ aspectRatio: '16/9' }}
        onClick={() => navigate('/browse')}
      >
        {/* Hero Image - 실제 이미지로 교체 예정 (어드민 대시보드에서 관리) */}
        <img 
          src="/images/hero-banner.jpg" 
          alt="Hero Banner" 
          className="w-full h-full object-cover"
          onError={(e) => {
            // 이미지 로드 실패 시 그라데이션 배경으로 대체
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) {
              const fallback = document.createElement('div')
              fallback.className = 'absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-600 to-gray-900'
              parent.appendChild(fallback)
            }
          }}
        />
      </div>
    </section>
  )
}
