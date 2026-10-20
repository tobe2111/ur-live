/**
 * Products Feature Public API
 */

// Routes
export { default as productsRoutes } from './api/products.routes';

// Services & Repositories
export { ProductService } from './services/ProductService';
export { ProductRepository } from './repositories/ProductRepository';

// Types
export type {
  Product,
  ProductFilter,
  ProductCreateInput,
  ProductUpdateInput,
  PaginationParams,
  PaginatedResponse
} from './types';
