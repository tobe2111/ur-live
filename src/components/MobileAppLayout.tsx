import { ReactNode, useEffect } from 'react'

interface MobileAppLayoutProps {
  children: ReactNode
}

/**
 * MobileAppLayout
 * PC에서 모바일 앱처럼 430px 프레임 안에 표시
 * fixed 요소들의 left/right/width를 프레임에 맞게 조정
 */
export default function MobileAppLayout({ children }: MobileAppLayoutProps) {
  useEffect(() => {
    // 430px 이하면 아무것도 안 함
    if (window.innerWidth <= 430) return

    const container = document.querySelector('.mobile-app-container') as HTMLElement
    if (!container) return

    const adjustFixed = () => {
      const rect = container.getBoundingClientRect()
      const fixedEls = container.querySelectorAll('[class*="fixed"]')
      fixedEls.forEach(el => {
        const htmlEl = el as HTMLElement
        const style = window.getComputedStyle(htmlEl)
        if (style.position !== 'fixed') return
        // 모달 오버레이(inset-0)는 건드리지 않음
        if (htmlEl.classList.contains('inset-0') || style.inset === '0px') return
        // 작은 요소(버튼 등)는 건드리지 않음 — 전체 너비 요소만 조정
        const hasFullWidth = style.left === '0px' || style.right === '0px' ||
          htmlEl.classList.contains('inset-x-0') ||
          (htmlEl.offsetWidth > rect.width * 0.5)
        if (!hasFullWidth) return

        htmlEl.style.left = `${rect.left}px`
        htmlEl.style.right = 'auto'
        htmlEl.style.width = `${rect.width}px`
      })
    }

    // 초기 + DOM 변경 시 조정
    adjustFixed()
    const observer = new MutationObserver(adjustFixed)
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    window.addEventListener('resize', adjustFixed)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', adjustFixed)
    }
  }, [])

  return (
    <div className="mobile-app-container">
      {children}
    </div>
  )
}
