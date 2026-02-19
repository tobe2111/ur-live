interface ProductHeaderProps {
  name: string;
  price: number;
}

export function ProductHeader({ name, price }: ProductHeaderProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원'
  }

  return (
    <div className="px-5 py-5">
      {/* Product Name */}
      <h1 className="text-lg font-bold leading-tight text-foreground text-pretty">
        {name}
      </h1>
      <p className="mt-2 text-base font-bold text-foreground">
        {formatPrice(price)}
      </p>
    </div>
  )
}
