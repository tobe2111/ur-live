import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Star, ChevronRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-gradient-to-r from-[#6A5ACD] to-[#9370DB]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center h-20 w-20 mb-8 rounded-3xl bg-white/20 backdrop-blur-sm">
          <Star className="h-10 w-10 text-white" />
        </div>
        
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
          지금 바로 시작하세요
        </h2>
        <p className="text-xl sm:text-2xl text-purple-100 mb-10 leading-relaxed">
          무료로 시작하고, 성공적인 판매를 경험하세요
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button className="w-full sm:w-auto px-10 py-6 bg-white hover:bg-gray-100 text-[#6A5ACD] font-bold text-lg rounded-2xl shadow-2xl hover:shadow-[0_20px_50px_rgba(255,255,255,0.3)] transition-all" asChild>
            <Link to="/seller/login">무료로 시작하기</Link>
          </Button>
          <Link 
            to="/seller/login"
            className="group w-full sm:w-auto px-10 py-6 bg-transparent border-2 border-white hover:bg-white/10 text-white font-bold text-lg rounded-2xl transition-all flex items-center justify-center space-x-2"
          >
            <span>자세히 알아보기</span>
            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  )
}
