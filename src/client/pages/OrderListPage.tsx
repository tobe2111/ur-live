// Order List Page
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../../shared/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../shared/constants';
import type { ApiResponse, PaginatedResponse, Order } from '../../shared/types';

export function OrderListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Order>>>('/orders'),
  });

  const orders = data?.data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-red-500">
        주문 내역을 불러오지 못했습니다
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">주문 내역이 없습니다</h2>
        <Link to="/products" className="btn-primary mt-4 inline-block">쇼핑 시작하기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="order-list">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">주문 내역</h1>

      <div className="space-y-3">
        {orders.map(order => (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
            data-testid="order-item"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-500">{order.order_number}</span>
                <span className={`badge ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
              <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
              {order.items && order.items.length > 0 && (
                <p className="text-sm text-gray-700 mt-1 truncate">
                  {order.items[0]?.product_name}
                  {order.items.length > 1 && ` 외 ${order.items.length - 1}건`}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-gray-900">{formatCurrency(order.total_amount)}</p>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
