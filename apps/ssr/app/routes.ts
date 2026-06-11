import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('group-buy', 'routes/group-buy.tsx'),
  route('u/:handle', 'routes/linkshop.tsx'),
  route('wholesale', 'routes/wholesale.tsx'),
] satisfies RouteConfig
