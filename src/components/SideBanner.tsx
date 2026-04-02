import { useEffect, useState } from 'react'

interface SideBannerItem {
  id: number
  title: string
  image_url: string
  link_url: string | null
  sort_order: number
}

export default function SideBanner() {
  const [banners, setBanners] = useState<SideBannerItem[]>([])

  useEffect(() => {
    fetch('/api/side-banners')
      .then((res) => res.json())
      .then((data: { success: boolean; data: SideBannerItem[] }) => {
        if (data.success && Array.isArray(data.data)) {
          setBanners(data.data)
        }
      })
      .catch(() => {
        // silently ignore fetch errors
      })
  }, [])

  if (banners.length === 0) return null

  return (
    <div className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-50 flex-col gap-3">
      {banners.map((banner) => {
        const content = (
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-[120px] rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 object-cover"
            loading="lazy"
          />
        )
        return banner.link_url ? (
          <a
            key={banner.id}
            href={banner.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl overflow-hidden"
          >
            {content}
          </a>
        ) : (
          <div key={banner.id} className="rounded-xl overflow-hidden">
            {content}
          </div>
        )
      })}
    </div>
  )
}
