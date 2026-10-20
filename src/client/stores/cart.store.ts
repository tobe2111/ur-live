// ============================================================
// Cart Store - Zustand with Multi-Seller Support
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, SellerCartGroup } from '../../shared/types';
import { calculateShippingFee } from '../../shared/utils';

interface SellerInfo {
  seller_id: string;
  seller_name: string;
  seller_slug: string;
  base_shipping_fee: number;
  free_shipping_threshold?: number;
}

interface CartState {
  items: CartItem[];
  
  // Actions
  addItem: (item: Omit<CartItem, 'subtotal'>, sellerInfo: SellerInfo) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clearSellerItems: (sellerId: string) => void;
  
  // Computed getters
  getSellerGroups: (sellerInfoMap: Map<string, SellerInfo>) => SellerCartGroup[];
  getTotalItems: () => number;
  getTotalAmount: (sellerInfoMap: Map<string, SellerInfo>) => number;
  
  // Seller info cache (for shipping calculation)
  sellerInfoCache: Map<string, SellerInfo>;
  setSellerInfo: (sellerId: string, info: SellerInfo) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      sellerInfoCache: new Map(),

      addItem: (itemData, sellerInfo) => {
        set(state => {
          const existing = state.items.find(i => i.product_id === itemData.product_id);
          const newCache = new Map(state.sellerInfoCache);
          newCache.set(sellerInfo.seller_id, sellerInfo);

          if (existing) {
            const newQty = Math.min(existing.quantity + itemData.quantity, itemData.stock_quantity);
            return {
              items: state.items.map(i =>
                i.product_id === itemData.product_id
                  ? { ...i, quantity: newQty, subtotal: i.price * newQty }
                  : i
              ),
              sellerInfoCache: newCache,
            };
          }

          const newItem: CartItem = {
            ...itemData,
            subtotal: itemData.price * itemData.quantity,
          };
          return {
            items: [...state.items, newItem],
            sellerInfoCache: newCache,
          };
        });
      },

      removeItem: (productId) => {
        set(state => ({
          items: state.items.filter(i => i.product_id !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        set(state => ({
          items: state.items.map(i =>
            i.product_id === productId
              ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock_quantity)), subtotal: i.price * Math.max(1, Math.min(quantity, i.stock_quantity)) }
              : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      clearSellerItems: (sellerId) => {
        set(state => ({
          items: state.items.filter(i => i.seller_id !== sellerId),
        }));
      },

      getSellerGroups: (sellerInfoMap) => {
        const { items } = get();
        
        // Group items by seller
        const grouped = new Map<string, CartItem[]>();
        for (const item of items) {
          const group = grouped.get(item.seller_id) ?? [];
          group.push(item);
          grouped.set(item.seller_id, group);
        }

        const groups: SellerCartGroup[] = [];
        for (const [sellerId, sellerItems] of grouped) {
          const info = sellerInfoMap.get(sellerId) ?? get().sellerInfoCache.get(sellerId);
          if (!info) continue;

          const subtotal = sellerItems.reduce((sum, i) => sum + i.subtotal, 0);
          const shippingFee = calculateShippingFee(
            subtotal,
            info.base_shipping_fee,
            info.free_shipping_threshold
          );

          groups.push({
            seller_id: sellerId,
            seller_name: info.seller_name,
            seller_slug: info.seller_slug,
            base_shipping_fee: info.base_shipping_fee,
            free_shipping_threshold: info.free_shipping_threshold,
            items: sellerItems,
            subtotal,
            shipping_fee: shippingFee,
            total: subtotal + shippingFee,
          });
        }

        return groups;
      },

      getTotalItems: () => {
        return get().items.reduce((sum, i) => sum + i.quantity, 0);
      },

      getTotalAmount: (sellerInfoMap) => {
        const groups = get().getSellerGroups(sellerInfoMap);
        return groups.reduce((sum, g) => sum + g.total, 0);
      },

      setSellerInfo: (sellerId, info) => {
        set(state => {
          const newCache = new Map(state.sellerInfoCache);
          newCache.set(sellerId, info);
          return { sellerInfoCache: newCache };
        });
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        items: state.items,
        // Serialize Map for storage
        sellerInfoCache: Array.from(state.sellerInfoCache?.entries() ?? []),
      }),
      // Deserialize Map from storage
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.sellerInfoCache)) {
          state.sellerInfoCache = new Map(
            state.sellerInfoCache as unknown as [string, SellerInfo][]
          );
        }
      },
    }
  )
);

// Convenience hooks
export function useCart() {
  return useCartStore(state => ({
    items: state.items,
    addItem: state.addItem,
    removeItem: state.removeItem,
    updateQuantity: state.updateQuantity,
    clearCart: state.clearCart,
    clearSellerItems: state.clearSellerItems,
    getSellerGroups: state.getSellerGroups,
    getTotalItems: state.getTotalItems,
    getTotalAmount: state.getTotalAmount,
    setSellerInfo: state.setSellerInfo,
    sellerInfoCache: state.sellerInfoCache,
  }));
}
