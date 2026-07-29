import { useEffect } from 'react'

/**
 * 🆕 2026-06-27 유어애즈 표면(/ads)에서만 파비콘을 UR Ads 스파크로 교체.
 *   언마운트 시 이전 파비콘 복원(소비자/도매 surface 영향 0). index.html 무수정(런타임 스왑).
 */
export function useUrAdsFavicon() {
  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
    const created = !link
    const prev = link?.getAttribute('href') || null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.setAttribute('type', 'image/svg+xml')
    link.setAttribute('href', '/urads-icon.svg')
    return () => {
      if (created) link?.remove()
      else if (link && prev) link.setAttribute('href', prev)
    }
  }, [])
}
