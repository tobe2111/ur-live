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
}

export function SnsLinks({ seller }: SnsLinksProps) {
  const hasLinks = seller.sns_instagram || seller.sns_youtube || seller.sns_facebook || 
                   seller.sns_twitter || seller.website_url || seller.kakao_chat_link

  if (!hasLinks) {
    return null
  }

  const links = [
    {
      url: seller.sns_instagram,
      icon: Instagram,
      name: 'Instagram',
      color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
      textColor: 'text-white'
    },
    {
      url: seller.sns_youtube,
      icon: Youtube,
      name: 'YouTube',
      color: 'bg-red-600',
      textColor: 'text-white'
    },
    {
      url: seller.sns_facebook,
      icon: Facebook,
      name: 'Facebook',
      color: 'bg-blue-600',
      textColor: 'text-white'
    },
    {
      url: seller.sns_twitter,
      icon: Twitter,
      name: 'Twitter',
      color: 'bg-sky-500',
      textColor: 'text-white'
    },
    {
      url: seller.website_url,
      icon: Globe,
      name: 'Website',
      color: 'bg-gray-700',
      textColor: 'text-white'
    },
    {
      url: seller.kakao_chat_link,
      icon: MessageCircle,
      name: 'KakaoTalk',
      color: 'bg-[#FEE500]',
      textColor: 'text-[#3C1E1E]',
      fill: true
    }
  ]

  const activeLinks = links.filter(link => link.url)

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-700">
        연락하기
      </h2>
      
      <div className="grid grid-cols-2 gap-2">
        {activeLinks.map((link) => {
          const Icon = link.icon
          return (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg transition-all hover:border-gray-900 hover:bg-gray-50">
                <div className={`w-12 h-12 rounded-full ${link.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon 
                    className={`w-6 h-6 ${link.textColor}`} 
                    fill={link.fill ? 'currentColor' : 'none'}
                  />
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
