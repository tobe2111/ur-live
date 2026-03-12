import { getCategoryLabel } from '@/constants/categories'

interface CategoryHeaderProps {
  category: string
  productCount: number
}

export default function CategoryHeader({ category, productCount }: CategoryHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">
        {getCategoryLabel(category)} 상품
      </h1>
      <p className="text-sm text-muted-foreground">
        {productCount}개의 상품
      </p>
    </div>
  )
}
