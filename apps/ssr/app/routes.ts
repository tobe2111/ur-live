import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('group-buy', 'routes/group-buy.tsx'),
  route('group-buy/:id', 'routes/group-buy-detail.tsx'),
  route('products/:id', 'routes/product-detail.tsx'),
  route('search', 'routes/search.tsx'),
  route('u/:handle', 'routes/linkshop.tsx'),
  route('wholesale', 'routes/wholesale.tsx'),
  route('wholesale/product/:id', 'routes/wholesale-product.tsx'),
] satisfies RouteConfig
