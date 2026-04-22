import { useNavigate } from 'react-router-dom'
import { 
  QUICK_ACCESS_CATEGORIES, 
  getCategoryLabel, 
  getCategoryIcon 
} from '@/constants/categories'

export default function QuickAccess() {
  const navigate = useNavigate()

  const handleCategoryClick = (category: string) => {
    navigate(`/browse?category=${category}`)
  }

  return (
    <section className="bg-background px-4 py-6">
      <div className="grid grid-cols-5 gap-2">
        {QUICK_ACCESS_CATEGORIES.map((category) => {
          const Icon = getCategoryIcon(category);
          const label = getCategoryLabel(category);
          
          return (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors">
                <Icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </div>
              <span className="text-[11px] font-medium text-foreground">{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  )
}
