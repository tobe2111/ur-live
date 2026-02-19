import { Instagram, MessageCircle } from 'lucide-react'

interface SnsLinksProps {
  seller: {
    instagram_url?: string
    kakaotalk_url?: string
    instagram_handle?: string
    kakaotalk_name?: string
  }
}

export function SnsLinks({ seller }: SnsLinksProps) {
  const hasLinks = seller.instagram_url || seller.kakaotalk_url

  if (!hasLinks) {
    return null
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-700">
        SNS Links
      </h2>
      
      <div className="space-y-2">
        {/* Instagram */}
        {seller.instagram_url && (
          <a
            href={seller.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block w-full"
          >
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg transition-all hover:border-gray-900 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 tracking-wide">
                    Instagram
                  </p>
                  {seller.instagram_handle && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      @{seller.instagram_handle}
                    </p>
                  )}
                </div>
              </div>
              <svg 
                className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        )}

        {/* KakaoTalk */}
        {seller.kakaotalk_url && (
          <a
            href={seller.kakaotalk_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block w-full"
          >
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg transition-all hover:border-gray-900 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FEE500] flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-[#3C1E1E]" fill="#3C1E1E" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 tracking-wide">
                    KakaoTalk
                  </p>
                  {seller.kakaotalk_name && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {seller.kakaotalk_name}
                    </p>
                  )}
                </div>
              </div>
              <svg 
                className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        )}
      </div>
    </section>
  )
}
