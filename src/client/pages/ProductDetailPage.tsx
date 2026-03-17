// Fix ProductDetailPage - remove duplicate import
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Store, Truck, Minus, Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useCartStore } from '../stores/cart.store';
import { formatCurrency } from '../../shared/utils';
import type { ApiResponse, Product } from '../../shared/types';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore(s => s.addItem);
  const setSellerInfo = useCartStore(s => s.setSellerInfo);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<ApiResponse<Product>>(`/products/${id}`),
    enabled: !!id,
  });

  const product = data?.success ? data.data : null;

  const handleAddToCart = () => {
    if (!product) return;
    
    setSellerInfo(product.seller_id, {
      seller_id: product.seller_id,
      seller_name: product.seller_name ?? '',
      seller_slug: product.seller_slug ?? '',
      base_shipping_fee: 3000,
      free_shipping_threshold: 50000,
    });

    addItem(
      {
        product_id: product.id,
        seller_id: product.seller_id,
        seller_name: product.seller_name ?? '',
        product_name: product.name,
        product_thumbnail: product.thumbnail_url,
        price: product.price,
        quantity,
        stock_quantity: product.stock_quantity,
      },
      {
        seller_id: product.seller_id,
        seller_name: product.seller_name ?? '',
        seller_slug: product.seller_slug ?? '',
        base_shipping_fee: 3000,
        free_shipping_threshold: 50000,
      }
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    console.error('[ProductDetailPage] Error:', error);
    console.error('[ProductDetailPage] Data:', data);
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-red-600 font-semibold mb-2">상품을 찾을 수 없습니다</p>
        {data && !data.success && (
          <p className="text-sm text-gray-500 mb-4">오류: {data.error || '알 수 없는 오류'}</p>
        )}
        <button onClick={() => navigate('/')} className="btn-primary">홈으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        뒤로
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
          {product.thumbnail_url ? (
            <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ShoppingCart className="w-20 h-20" />
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.seller_name && (
            <Link
              to={`/products?seller_id=${product.seller_id}`}
              className="text-sm text-blue-600 flex items-center gap-1 mb-2 hover:underline"
            >
              <Store className="w-3 h-3" />
              {product.seller_name}
            </Link>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
          {product.compare_at_price && (
            <p className="text-gray-400 line-through text-sm">{formatCurrency(product.compare_at_price)}</p>
          )}
          <p className="text-3xl font-bold text-blue-600 mb-4">{formatCurrency(product.price)}</p>

          {product.description && (
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">{product.description}</p>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-700">수량</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-8 text-center font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity(q => Math.min(q + 1, product.stock_quantity))}
                disabled={quantity >= product.stock_quantity}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <span className="text-xs text-gray-400">재고 {product.stock_quantity}개</span>
          </div>

          {/* Shipping */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Truck className="w-4 h-4" />
            <span>배송비 3,000원 (5만원 이상 무료)</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={product.stock_quantity === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
              data-testid="add-to-cart-detail"
            >
              <ShoppingCart className="w-4 h-4" />
              {added ? '✓ 장바구니에 담김' : product.stock_quantity === 0 ? '품절' : '장바구니 담기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
