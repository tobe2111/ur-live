interface ProductInfoItem {
  label: string
  value: string | number
}

interface ProductInfoGridProps {
  items: ProductInfoItem[]
}

export function ProductInfoGrid({ items }: ProductInfoGridProps) {
  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className="text-xs font-medium text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
