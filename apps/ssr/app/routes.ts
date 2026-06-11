import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  // 베타 색인 금지 (sitemap.xml 은 의도적으로 미제공 — robots 가 전체 차단하므로 404 가 정답)
  route('robots.txt', 'routes/robots.ts'),
  route('group-buy', 'routes/group-buy.tsx'),
  route('group-buy/:id', 'routes/group-buy-detail.tsx'),
  route('products/:id', 'routes/product-detail.tsx'),
  route('search', 'routes/search.tsx'),
  route('u/:handle', 'routes/linkshop.tsx'),
  route('wholesale', 'routes/wholesale.tsx'),
  route('wholesale/product/:id', 'routes/wholesale-product.tsx'),
] satisfies RouteConfig
