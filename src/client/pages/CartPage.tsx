// ============================================================
// Cart Page - Multi-Seller Cart with Seller Grouping
// ============================================================

import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, Store, Truck, ChevronRight } from 'lucide-react';
import { useCart } from '../stores/cart.store';
import { formatCurrency } from '../../shared/utils';
import type { SellerCartGroup, CartItem } from '../../shared/types';

// Cart Item Component
function CartItemRow({
  item,
  onRemove,
  onUpdateQty,
}: {
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
}) {
  return (
    <div className="flex gap-4 py-4 border-b border-gray-100 last:border-0" data-testid="cart-item">
      {/* Thumbnail */}
      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        {item.product_thumbnail ? (
          <img
            src={item.product_thumbnail}
            alt={item.product_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ShoppingBag className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
        {item.options && Object.keys(item.options).length > 0 && (
          <p className="text-sm text-gray-500 mt-0.5">
            {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(', ')}
          </p>
        )}
        <p className="text-blue-600 font-semibold mt-1">
          {formatCurrency(item.price)}
        </p>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => onUpdateQty(item.product_id, item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-40 hover:bg-gray-100"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-8 text-center font-medium">{item.quantity}</span>
          <button
            onClick={() => onUpdateQty(item.product_id, item.quantity + 1)}
            disabled={item.quantity >= item.stock_quantity}
            className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-40 hover:bg-gray-100"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Subtotal & Remove */}
      <div className="flex flex-col items-end gap-2">
        <span className="font-bold text-gray-900">{formatCurrency(item.subtotal)}</span>
        <button
          onClick={() => onRemove(item.product_id)}
          className="text-gray-400 hover:text-red-500 transition-colors"
          data-testid="remove-item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Seller Group Component
function SellerGroup({
  group,
  onRemove,
  onUpdateQty,
}: {
  group: SellerCartGroup;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
}) {
  return (
    <div className="card mb-4 overflow-hidden" data-testid={`seller-group-${group.seller_id}`}>
      {/* Seller Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Store className="w-4 h-4 text-gray-500" />
        <span className="font-semibold text-gray-800">{group.seller_name}</span>
        <span className="text-sm text-gray-500 ml-auto">
          {group.items.length}개 상품
        </span>
      </div>

      {/* Items */}
      <div className="px-4">
        {group.items.map(item => (
          <CartItemRow
            key={item.product_id}
            item={item}
            onRemove={onRemove}
            onUpdateQty={onUpdateQty}
          />
        ))}
      </div>

      {/* Seller Summary */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
        <div className="flex justify-between text-sm text-gray-600">
          <span>상품 금액</span>
          <span>{formatCurrency(group.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-1 text-gray-600">
            <Truck className="w-3 h-3" />
            배송비
          </span>
          <span className={group.shipping_fee === 0 ? 'text-green-600 font-medium' : 'text-gray-900'}>
            {group.shipping_fee === 0 ? '무료' : formatCurrency(group.shipping_fee)}
          </span>
        </div>
        {group.free_shipping_threshold && group.shipping_fee > 0 && (
          <p className="text-xs text-blue-600">
            {formatCurrency(group.free_shipping_threshold - group.subtotal)} 더 구매하면 배송비 무료!
          </p>
        )}
        <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
          <span>판매자 소계</span>
          <span>{formatCurrency(group.total)}</span>
        </div>
      </div>
    </div>
  );
}

// Main Cart Page
export function CartPage() {
  const { items, removeItem, updateQuantity, getSellerGroups, sellerInfoCache } = useCart();

  const sellerGroups = getSellerGroups(sellerInfoCache);
  const grandTotal = sellerGroups.reduce((sum, g) => sum + g.total, 0);
  const totalShipping = sellerGroups.reduce((sum, g) => sum + g.shipping_fee, 0);
  const totalSubtotal = sellerGroups.reduce((sum, g) => sum + g.subtotal, 0);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">장바구니가 비어있습니다</h2>
        <p className="text-gray-500 mb-6">다양한 판매자의 상품을 담아보세요</p>
        <Link to="/products" className="btn-primary inline-flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          쇼핑하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" data-testid="cart-page">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">장바구니</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Seller Groups */}
        <div className="lg:col-span-2">
          {sellerGroups.length > 0 ? (
            sellerGroups.map(group => (
              <SellerGroup
                key={group.seller_id}
                group={group}
                onRemove={removeItem}
                onUpdateQty={updateQuantity}
              />
            ))
          ) : (
            // Fallback: items without seller info
            <div className="card p-4">
              {items.map(item => (
                <CartItemRow
                  key={item.product_id}
                  item={item}
                  onRemove={removeItem}
                  onUpdateQty={updateQuantity}
                />
              ))}
            </div>
          )}
          
          {sellerGroups.length > 1 && (
            <p className="text-sm text-gray-500 text-center mt-2">
              {sellerGroups.length}개 판매자 · Toss Payments로 한 번에 결제
            </p>
          )}
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-4">주문 요약</h3>

            {sellerGroups.length > 1 && (
              <div className="mb-3 space-y-1">
                {sellerGroups.map(g => (
                  <div key={g.seller_id} className="flex justify-between text-xs text-gray-500">
                    <span>{g.seller_name}</span>
                    <span>{formatCurrency(g.total)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 pb-3 border-b border-gray-200">
              <div className="flex justify-between text-sm text-gray-600">
                <span>상품 금액</span>
                <span>{formatCurrency(totalSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>배송비</span>
                <span>{totalShipping === 0 ? '무료' : formatCurrency(totalShipping)}</span>
              </div>
            </div>

            <div className="flex justify-between font-bold text-lg text-gray-900 mt-3 mb-5">
              <span>총 결제 금액</span>
              <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
            </div>

            <Link
              to="/checkout"
              className="btn-primary w-full text-center flex items-center justify-center gap-2"
              data-testid="checkout-button"
            >
              결제하기
              <ChevronRight className="w-4 h-4" />
            </Link>

            <p className="text-xs text-gray-400 text-center mt-3">
              Toss Payments 안전 결제
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
