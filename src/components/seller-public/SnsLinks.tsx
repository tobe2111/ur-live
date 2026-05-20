import { Instagram, Youtube, Facebook, Twitter, Globe, MessageCircle } from 'lucide-react'

interface SnsLinksProps {
  seller: {
    sns_instagram?: string
    sns_youtube?: string
    sns_facebook?: string
    sns_twitter?: string
    website_url?: string
    kakao_chat_link?: string
  }
  compact?: boolean
}

const LINK_CONFIG = [
  { key: 'sns_instagram' as const, icon: Instagram, name: 'Instagram', color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400', textColor: 'text-white' },
  { key: 'sns_youtube' as const, icon: Youtube, name: 'YouTube', color: 'bg-red-600', textColor: 'text-white' },
  { key: 'sns_facebook' as const, icon: Facebook, name: 'Facebook', color: 'bg-blue-600', textColor: 'text-white' },
  { key: 'sns_twitter' as const, icon: Twitter, name: 'Twitter', color: 'bg-sky-500', textColor: 'text-white' },
  { key: 'website_url' as const, icon: Globe, name: 'Website', color: 'bg-gray-700', textColor: 'text-white' },
  { key: 'kakao_chat_link' as const, icon: MessageCircle, name: 'KakaoTalk', color: 'bg-[#FEE500]', textColor: 'text-[#3C1E1E]', fill: true },
]

export function SnsLinks({ seller, compact }: SnsLinksProps) {
  const activeLinks = LINK_CONFIG.filter(l => seller[l.key])

  if (activeLinks.length === 0) return null

  // Compact: horizontal row of small icons (for profile header)
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3 mt-4">
        {activeLinks.map(link => {
          const Icon = link.icon
          return (
            <a
              key={link.key}
              href={seller[link.key]}
              target="_blank" rel="noopener noreferrer"
              className={`w-9 h-9 rounded-full ${link.color} flex items-center justify-center hover:opacity-80 transition-opacity`}
            >
              <Icon className={`w-4 h-4 ${link.textColor}`} fill={link.fill ? 'currentColor' : 'none'} />
            </a>
          )
        })}
      </div>
    )
  }

  // Full: grid with labels
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-700">
        연락하기
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {activeLinks.map(link => {
          const Icon = link.icon
          return (
            <a
              key={link.key}
              href={seller[link.key]}
              target="_blank" rel="noopener noreferrer"
              className="group block"
            >
              <div className="flex flex-col items-center gap-2 p-4 border border-gray-200 dark:border-[#2A2A2A] rounded-lg transition-all hover:border-gray-900 hover:bg-gray-50">
                <div className={`w-12 h-12 rounded-full ${link.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${link.textColor}`} fill={link.fill ? 'currentColor' : 'none'} />
                </div>
                <p className="text-xs font-semibold text-gray-900 tracking-wide text-center">
                  {link.name}
                </p>
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
