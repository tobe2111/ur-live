import { LazyImage } from '@/components/LazyImage'

interface Banner {
  id: number
  title: string
  image_url: string
  link_url?: string
  description?: string
}

interface BannerSectionProps {
  banners: Banner[]
}

export function BannerSection({ banners }: BannerSectionProps) {
  if (banners.length === 0) return null

  const banner = banners[0]

  return (
    <section className="relative w-full bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
        <div className="relative overflow-hidden rounded-2xl shadow-2xl group cursor-pointer">
          <a
            href={banner.link_url || '#'}
            onClick={(e) => {
              if (banner.link_url?.startsWith('#')) {
                e.preventDefault()
                const element = document.querySelector(banner.link_url)
                element?.scrollIntoView({ behavior: 'smooth' })
              }
            }}
            className="block"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              <LazyImage
                src={banner.image_url}
                alt={banner.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            {banner.description && (
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <p className="text-lg sm:text-xl font-bold drop-shadow-lg">
                  {banner.description}
                </p>
              </div>
            )}
          </a>
        </div>
      </div>
    </section>
  )
}
