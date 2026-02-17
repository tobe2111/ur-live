import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Utensils, Shirt, Sparkles, Baby, ShoppingBasket } from 'lucide-react'

const categories = [
  { icon: Utensils, label: '식품', value: 'food' },
  { icon: Shirt, label: '패션', value: 'fashion' },
  { icon: Sparkles, label: '뷰티', value: 'beauty' },
  { icon: Baby, label: '유아동', value: 'kids' },
  { icon: ShoppingBasket, label: '잡화', value: 'goods' },
]

export default function QuickAccess() {
  const navigate = useNavigate()

  const handleCategoryClick = (category: string) => {
    navigate(`/browse?category=${category}`)
  }

  return (
    <section className="bg-background px-4 py-6">
      <div className="grid grid-cols-5 gap-2">
        {categories.map(({ icon: Icon, label, value }) => (
          <button
            key={label}
            onClick={() => handleCategoryClick(value)}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors">
              <Icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
