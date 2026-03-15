// Order Detail Page
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Package, Loader2, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../../shared/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../shared/constants';
import type { ApiResponse, Order } from '../../shared/types';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<ApiResponse<Order>>(`/orders/${id}`),
    enabled: !!id,
  });

  const order = data?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">주문을 찾을 수 없습니다</p>
        <Link to="/orders" className="btn-secondary mt-4 inline-block">주문 목록</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="order-detail">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/orders" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">주문 상세</h1>
          <p className="text-sm text-gray-500 font-mono">{order.order_number}</p>
        </div>
        <span className={`badge ml-auto ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="space-y-4">
        {/* Items */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            주문 상품
          </h2>
          {order.items?.map(item => (
            <div key={item.id} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
              {item.product_thumbnail && (
                <img src={item.product_thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">{item.product_name}</p>
                <p className="text-gray-500 text-sm">
                  {formatCurrency(item.unit_price)} × {item.quantity}
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(item.subtotal)}</p>
            </div>
          ))}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>상품 금액</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>배송비</span>
              <span>{order.shipping_fee === 0 ? '무료' : formatCurrency(order.shipping_fee)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t">
              <span>총 결제금액</span>
              <span className="text-blue-600">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Shipping */}
        {order.shipping_address && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              배송 정보
            </h2>
            <div className="text-sm space-y-1 text-gray-600">
              <p><span className="font-medium text-gray-900">{order.shipping_name}</span> · {order.shipping_phone}</p>
              <p>[{order.shipping_address.postal_code}] {order.shipping_address.address1} {order.shipping_address.address2}</p>
              {order.shipping_memo && <p className="text-gray-400">메모: {order.shipping_memo}</p>}
            </div>
            {order.tracking_number && (
              <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm">
                <p className="flex items-center gap-1 text-blue-700">
                  <Truck className="w-3 h-3" />
                  운송장: {order.tracking_company} {order.tracking_number}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="card p-5 text-sm text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>주문 일시</span>
            <span>{formatDate(order.created_at, 'ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {order.paid_at && (
            <div className="flex justify-between">
              <span>결제 완료</span>
              <span>{formatDate(order.paid_at, 'ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
