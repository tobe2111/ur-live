// ============================================================
// Product List Page
// ============================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingCart, Search, Store, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useCartStore } from '../stores/cart.store';
import { formatCurrency } from '../../shared/utils';
import type { ApiResponse, PaginatedResponse, Product } from '../../shared/types';

function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore(s => s.addItem);
  const setSellerInfo = useCartStore(s => s.setSellerInfo);
  const [added, setAdded] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (product.stock_quantity === 0) return;

    // Cache seller info for shipping calculation
    setSellerInfo(product.seller_id, {
      seller_id: product.seller_id,
      seller_name: product.seller_name ?? product.seller_id,
      seller_slug: product.seller_slug ?? '',
      base_shipping_fee: 3000, // default, overridden by seller data
      free_shipping_threshold: 50000,
    });

    addItem(
      {
        product_id: product.id,
        seller_id: product.seller_id,
        seller_name: product.seller_name ?? product.seller_id,
        product_name: product.name,
        product_thumbnail: product.thumbnail_url,
        price: product.price,
        quantity: 1,
        stock_quantity: product.stock_quantity,
      },
      {
        seller_id: product.seller_id,
        seller_name: product.seller_name ?? product.seller_id,
        seller_slug: product.seller_slug ?? '',
        base_shipping_fee: 3000,
        free_shipping_threshold: 50000,
      }
    );

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <Link
      to={`/products/${product.id}`}
      className="card group hover:shadow-md transition-shadow overflow-hidden"
      data-testid="product-card"
    >
      <div className="aspect-square overflow-hidden bg-gray-100">
        {product.thumbnail_url ? (
          <img
            src={product.thumbnail_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ShoppingCart className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="p-3">
        {product.seller_name && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
            <Store className="w-3 h-3" />
            {product.seller_name}
          </p>
        )}
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">{product.name}</h3>
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-900">{formatCurrency(product.price)}</span>
          <button
            onClick={handleAddToCart}
            disabled={product.stock_quantity === 0}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              added
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            } disabled:bg-gray-100 disabled:text-gray-400`}
            data-testid="add-to-cart-btn"
          >
            {product.stock_quantity === 0 ? '품절' : added ? '✓ 추가됨' : '담기'}
          </button>
        </div>
        {product.stock_quantity > 0 && product.stock_quantity <= 10 && (
          <p className="text-xs text-orange-500 mt-1">남은 수량: {product.stock_quantity}</p>
        )}
      </div>
    </Link>
  );
}

export function ProductListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      return api.get<ApiResponse<PaginatedResponse<Product>>>(`/products?${params}`);
    },
  });

  const products = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Search */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="상품 검색..."
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-500">상품을 불러오지 못했습니다</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>검색 결과가 없습니다</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">총 {total}개 상품</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {data?.data?.has_next && (
            <div className="text-center mt-8">
              <button
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary"
              >
                더 보기
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
