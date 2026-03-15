// ============================================================
// Home Page
// ============================================================

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Globe, Shield, Zap, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { useCartStore } from '../stores/cart.store';
import { formatCurrency } from '../../shared/utils';
import type { ApiResponse, PaginatedResponse, Product } from '../../shared/types';

export function HomePage() {
  const { data } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Product>>>('/products?limit=8&status=ACTIVE'),
  });

  const products = data?.data?.items ?? [];
  const addItem = useCartStore(s => s.addItem);
  const setSellerInfo = useCartStore(s => s.setSellerInfo);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Globe className="w-8 h-8" />
            <span className="text-blue-200 text-sm font-medium">Global Marketplace</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            다양한 셀러, 하나의 쇼핑
          </h1>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            여러 판매자의 상품을 한 번에 담고, Toss Payments로 안전하게 결제하세요.
            글로벌 확장을 위한 마켓플레이스.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/products" className="bg-white text-blue-600 font-bold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              쇼핑 시작하기
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: 'Toss 안전 결제', desc: 'HMAC 서명 검증 + 서버 Webhook으로 이중 보안' },
              { icon: Globe, title: '멀티셀러 지원', desc: '여러 판매자 상품을 하나의 결제로 처리' },
              { icon: Zap, title: 'Cloudflare 엣지', desc: '전 세계 어디서나 빠른 응답 속도' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      {products.length > 0 && (
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">추천 상품</h2>
              <Link to="/products" className="text-blue-600 text-sm flex items-center gap-1 hover:underline">
                전체보기 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.slice(0, 8).map(product => (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="card overflow-hidden group hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{product.seller_name}</p>
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</p>
                    <p className="text-blue-600 font-bold mt-1">{formatCurrency(product.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
