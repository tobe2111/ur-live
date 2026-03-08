interface CategoryHeaderProps {
  category: string
  productCount: number
}

const categoryLabels: Record<string, string> = {
  all: '전체',
  fashion: '패션',
  beauty: '뷰티',
  food: '식품',
  electronics: '전자제품',
  lifestyle: '라이프스타일',
  home: '홈/리빙',
  sports: '스포츠'
}

export default function CategoryHeader({ category, productCount }: CategoryHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">
        {categoryLabels[category] || '전체'} 상품
      </h1>
      <p className="text-sm text-muted-foreground">
        {productCount}개의 상품
      </p>
    </div>
  )
}
