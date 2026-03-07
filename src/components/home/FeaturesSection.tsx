import { Play } from 'lucide-react'

interface Feature {
  icon: React.ElementType
  title: string
  description: string
  gradient: string
  iconGradient: string
}

const features: Feature[] = [
  {
    icon: Play,
    title: '멀티 플랫폼 지원',
    description: 'YouTube, TikTok 등 익숙한 플랫폼에서 실시간 쇼핑을 즐기세요',
    gradient: 'from-purple-50 to-white',
    iconGradient: 'from-[#6A5ACD] to-[#9370DB]',
  },
  {
    icon: ({ className }: { className?: string }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: '간편한 구매',
    description: '클릭 한 번으로 마음에 드는 상품을 바로 구매하세요',
    gradient: 'from-yellow-50 to-white',
    iconGradient: 'from-[#FFD700] to-[#FFA500]',
  },
  {
    icon: ({ className }: { className?: string }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    title: '특별한 혜택',
    description: '라이브 전용 할인과 깜짝 이벤트를 만나보세요',
    gradient: 'from-pink-50 to-white',
    iconGradient: 'from-pink-500 to-red-500',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            유어 쇼핑을 선택하는 이유
          </h2>
          <p className="text-xl text-gray-600">
            플랫폼의 모든 것이 당신을 위해 준비되어 있습니다
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`group relative bg-gradient-to-br ${feature.gradient} rounded-3xl p-8 border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2`}
            >
              <div className={`flex items-center justify-center h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${feature.iconGradient} shadow-xl`}>
                <feature.icon className="h-10 w-10 text-white fill-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-center leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
