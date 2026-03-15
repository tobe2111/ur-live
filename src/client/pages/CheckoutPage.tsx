// ============================================================
// Checkout Page - Multi-Seller Checkout with Toss Payments
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Store, CreditCard, Truck, AlertCircle } from 'lucide-react';
import { useCart } from '../stores/cart.store';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../lib/api';
import { formatCurrency, generateOrderNumber, generateId } from '../../shared/utils';
import type { ApiResponse, Order, SellerCartGroup } from '../../shared/types';

interface ShippingFormData {
  recipient_name: string;
  phone: string;
  postal_code: string;
  address1: string;
  address2: string;
  city: string;
  memo: string;
}

interface CheckoutSessionData {
  order_number: string;
  orders: Order[];
  total_amount: number;
  order_name: string;
  toss_client_key: string;
  customer_name: string;
  customer_phone: string;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, getSellerGroups, sellerInfoCache, clearCart } = useCart();
  const sellerGroups = getSellerGroups(sellerInfoCache);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrders, setCreatedOrders] = useState<Order[]>([]);
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSessionData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShippingFormData>({
    defaultValues: {
      recipient_name: user?.name ?? '',
      phone: user?.phone ?? '',
      postal_code: '',
      address1: '',
      address2: '',
      city: '',
      memo: '',
    },
  });

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items, navigate]);

  const grandTotal = sellerGroups.reduce((sum, g) => sum + g.total, 0);

  /**
   * Step 1: Create orders for each seller
   * Step 2: Initialize Toss Payments widget
   */
  const onSubmit = async (formData: ShippingFormData) => {
    if (sellerGroups.length === 0) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const orderNumber = generateOrderNumber();
      const shippingAddress = {
        postal_code: formData.postal_code,
        address1: formData.address1,
        address2: formData.address2,
        city: formData.city,
        country: 'KR',
        recipient_name: formData.recipient_name,
      };

      // Create one order per seller (multi-seller checkout)
      const orderPromises = sellerGroups.map(async (group: SellerCartGroup) => {
        const idempotencyKey = `${orderNumber}:${group.seller_id}`;
        
        const response = await api.post<ApiResponse<Order>>('/orders', {
          seller_id: group.seller_id,
          order_number: orderNumber,
          items: group.items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            options: item.options,
          })),
          shipping_address: shippingAddress,
          shipping_name: formData.recipient_name,
          shipping_phone: formData.phone,
          shipping_memo: formData.memo || undefined,
          idempotency_key: idempotencyKey,
        });

        if (!response.success || !response.data) {
          throw new Error(`${group.seller_name} 주문 생성 실패: ${response.error ?? 'Unknown error'}`);
        }
        return response.data;
      });

      const orders = await Promise.all(orderPromises);
      setCreatedOrders(orders);

      // Get checkout session (Toss client key, etc.)
      const sessionResponse = await api.post<ApiResponse<CheckoutSessionData>>(
        '/payments/checkout-session',
        { order_number: orderNumber }
      );

      if (!sessionResponse.success || !sessionResponse.data) {
        throw new Error('결제 세션 생성 실패');
      }

      setCheckoutSession(sessionResponse.data);

      // Initialize Toss Payments
      await initializeTossPayment(sessionResponse.data, orderNumber, grandTotal, formData);

    } catch (err) {
      const message = err instanceof Error ? err.message : '결제 준비 중 오류가 발생했습니다';
      setError(message);
      console.error('[CHECKOUT] Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initializeTossPayment = async (
    session: CheckoutSessionData,
    orderNumber: string,
    amount: number,
    formData: ShippingFormData
  ) => {
    // Load Toss Payments SDK
    await loadTossScript();
    
    // @ts-ignore - Toss SDK global
    const tossPayments = window.TossPayments?.(session.toss_client_key);
    
    if (!tossPayments) {
      throw new Error('Toss Payments SDK를 불러오지 못했습니다');
    }

    // Get order name from first item
    const firstOrder = session.orders[0];
    const firstItem = firstOrder?.items?.[0];
    const totalItems = session.orders.reduce((sum, o) => sum + (o.items?.length ?? 0), 0);
    const orderName = firstItem
      ? `${firstItem.product_name}${totalItems > 1 ? ` 외 ${totalItems - 1}건` : ''}`
      : '마켓플레이스 주문';

    await tossPayments.requestPayment('카드', {
      amount,
      orderId: orderNumber,
      orderName,
      customerName: formData.recipient_name,
      customerMobilePhone: formData.phone.replace(/-/g, ''),
      successUrl: `${window.location.origin}/payment/success`,
      failUrl: `${window.location.origin}/payment/fail`,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" data-testid="checkout-page">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">주문/결제</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Shipping + Order Summary */}
          <div className="lg:col-span-2 space-y-4">
            {/* Shipping Info */}
            <div className="card p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                배송 정보
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    수령인 <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('recipient_name', { required: '수령인을 입력해주세요' })}
                    className="input-field"
                    placeholder="홍길동"
                    data-testid="shipping-name"
                  />
                  {errors.recipient_name && (
                    <p className="text-red-500 text-xs mt-1">{errors.recipient_name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('phone', { required: '연락처를 입력해주세요' })}
                    className="input-field"
                    placeholder="010-1234-5678"
                    data-testid="shipping-phone"
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    우편번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('postal_code', { required: '우편번호를 입력해주세요' })}
                    className="input-field"
                    placeholder="12345"
                    data-testid="postal-code"
                  />
                  {errors.postal_code && (
                    <p className="text-red-500 text-xs mt-1">{errors.postal_code.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    도시
                  </label>
                  <input
                    {...register('city')}
                    className="input-field"
                    placeholder="서울"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    주소 <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('address1', { required: '주소를 입력해주세요' })}
                    className="input-field"
                    placeholder="도로명 주소"
                    data-testid="address1"
                  />
                  {errors.address1 && (
                    <p className="text-red-500 text-xs mt-1">{errors.address1.message}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <input
                    {...register('address2')}
                    className="input-field"
                    placeholder="상세 주소 (선택)"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    배송 메모
                  </label>
                  <input
                    {...register('memo')}
                    className="input-field"
                    placeholder="문 앞에 놔주세요"
                  />
                </div>
              </div>
            </div>

            {/* Order Items by Seller */}
            <div className="card p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                주문 상품
              </h2>
              <div className="space-y-4">
                {sellerGroups.map(group => (
                  <div key={group.seller_id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="w-3 h-3 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">{group.seller_name}</span>
                    </div>
                    {group.items.map(item => (
                      <div key={item.product_id} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          {item.product_thumbnail && (
                            <img src={item.product_thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <span className="text-gray-700">{item.product_name} x{item.quantity}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm mt-2 pt-1 border-t border-gray-100">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        배송비
                      </span>
                      <span className={group.shipping_fee === 0 ? 'text-green-600' : ''}>
                        {group.shipping_fee === 0 ? '무료' : formatCurrency(group.shipping_fee)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Payment Summary */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                결제 정보
              </h3>

              <div className="space-y-2 mb-4">
                {sellerGroups.map(group => (
                  <div key={group.seller_id} className="flex justify-between text-xs text-gray-500">
                    <span>{group.seller_name}</span>
                    <span>{formatCurrency(group.total)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pb-3 border-b border-gray-200 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>상품 금액</span>
                  <span>{formatCurrency(sellerGroups.reduce((sum, g) => sum + g.subtotal, 0))}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>배송비</span>
                  <span>{sellerGroups.reduce((sum, g) => sum + g.shipping_fee, 0) === 0 ? '무료' : formatCurrency(sellerGroups.reduce((sum, g) => sum + g.shipping_fee, 0))}</span>
                </div>
              </div>

              <div className="flex justify-between font-bold text-xl text-blue-600 mt-3 mb-6">
                <span className="text-gray-900 text-base">총 결제금액</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full text-center py-3 text-base"
                data-testid="pay-button"
              >
                {isSubmitting ? '처리 중...' : `${formatCurrency(grandTotal)} 결제하기`}
              </button>

              <p className="text-xs text-gray-400 text-center mt-2">
                Toss Payments 안전 결제 · SSL 암호화
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// Toss SDK loader
function loadTossScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('toss-sdk')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'toss-sdk';
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Toss SDK 로드 실패'));
    document.head.appendChild(script);
  });
}
