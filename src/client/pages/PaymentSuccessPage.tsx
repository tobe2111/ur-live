// ============================================================
// Payment Success Page
// Called after Toss redirects back with paymentKey + orderId + amount
// ============================================================

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useCartStore } from '../stores/cart.store';
import { formatCurrency } from '../../shared/utils';
import type { ApiResponse, Order } from '../../shared/types';

interface ConfirmResponse {
  orders: Order[];
  payment: { method: string; approvedAt: string };
}

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const clearCart = useCartStore(s => s.clearCart);

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (!paymentKey || !orderId || !amount) {
      setError('잘못된 결제 정보입니다');
      setIsProcessing(false);
      return;
    }

    // Confirm payment with backend
    api.post<ApiResponse<ConfirmResponse>>('/payments/confirm', {
      paymentKey,
      orderId,
      amount: parseInt(amount, 10),
    })
      .then(response => {
        if (response.success && response.data) {
          setOrders(response.data.orders);
          clearCart();
        } else {
          setError(response.error ?? '결제 확인에 실패했습니다');
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다');
      })
      .finally(() => setIsProcessing(false));
  }, []);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">결제를 처리하고 있습니다...</p>
          <p className="text-gray-400 text-sm mt-1">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">결제 오류</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <Link to="/cart" className="btn-secondary">장바구니로</Link>
          <Link to="/orders" className="btn-primary">주문 내역 확인</Link>
        </div>
      </div>
    );
  }

  const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center" data-testid="payment-success">
      <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">결제 완료!</h1>
      <p className="text-gray-500 mb-2">
        주문번호: <span className="font-mono font-medium text-gray-700">{orders[0]?.order_number}</span>
      </p>
      <p className="text-blue-600 font-bold text-2xl mb-8">
        {formatCurrency(totalAmount)}
      </p>

      {orders.length > 1 && (
        <div className="card p-4 mb-6 text-left">
          <p className="text-sm font-semibold text-gray-700 mb-2">{orders.length}개 판매자 주문 완료</p>
          {orders.map(order => (
            <div key={order.id} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
              <span className="text-gray-600">{order.seller_id}</span>
              <span className="font-medium">{formatCurrency(order.total_amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <Link to="/orders" className="btn-primary flex items-center gap-2" data-testid="view-orders-btn">
          <Package className="w-4 h-4" />
          주문 내역 확인
        </Link>
        <Link to="/products" className="btn-secondary">
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}
