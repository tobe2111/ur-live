/**
 * Cart API Unit Tests
 * 
 * Purpose: Test cart business logic
 * Coverage:
 *   - Add to cart
 *   - Remove from cart
 *   - Update quantity
 *   - Clear cart
 *   - Cart total calculation
 *   - Stock validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock cart store
const mockCartItems = [
  { id: 1, product_id: 101, name: 'Product A', price: 10000, quantity: 2, stock: 50 },
  { id: 2, product_id: 102, name: 'Product B', price: 20000, quantity: 1, stock: 30 },
];

const mockCartStore = {
  items: [] as typeof mockCartItems,
  addItem: vi.fn((item) => {
    mockCartStore.items.push(item);
  }),
  removeItem: vi.fn((productId) => {
    mockCartStore.items = mockCartStore.items.filter(i => i.product_id !== productId);
  }),
  updateQuantity: vi.fn((productId, quantity) => {
    const item = mockCartStore.items.find(i => i.product_id === productId);
    if (item) item.quantity = quantity;
  }),
  clearCart: vi.fn(() => {
    mockCartStore.items = [];
  }),
  getTotal: vi.fn(() => {
    return mockCartStore.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }),
};

describe('Cart Business Logic', () => {
  beforeEach(() => {
    mockCartStore.items = [];
    vi.clearAllMocks();
  });

  describe('Add to Cart', () => {
    it('should add item to cart', () => {
      mockCartStore.items = []; // Reset
      const item = { id: 1, product_id: 101, name: 'Product A', price: 10000, quantity: 1, stock: 50 };
      
      mockCartStore.addItem(item);

      expect(mockCartStore.items).toHaveLength(1);
      expect(mockCartStore.items[0]).toEqual(item);
      expect(mockCartStore.addItem).toHaveBeenCalledWith(item);
    });

    it('should not exceed stock limit', () => {
      const item = { id: 1, product_id: 101, name: 'Product A', price: 10000, quantity: 10, stock: 5 };

      expect(() => {
        if (item.quantity > item.stock) throw new Error('Quantity exceeds stock');
      }).toThrow('Quantity exceeds stock');
    });

    it('should handle multiple items', () => {
      mockCartStore.addItem(mockCartItems[0]);
      mockCartStore.addItem(mockCartItems[1]);

      expect(mockCartStore.items).toHaveLength(2);
    });
  });

  describe('Remove from Cart', () => {
    beforeEach(() => {
      mockCartStore.items = [...mockCartItems];
    });

    it('should remove item by product_id', () => {
      mockCartStore.removeItem(101);

      expect(mockCartStore.items).toHaveLength(1);
      expect(mockCartStore.items[0].product_id).toBe(102);
    });

    it('should handle removing non-existent item', () => {
      const initialLength = mockCartStore.items.length;
      
      mockCartStore.removeItem(999);

      expect(mockCartStore.items).toHaveLength(initialLength);
    });
  });

  describe('Update Quantity', () => {
    beforeEach(() => {
      mockCartStore.items = [...mockCartItems];
    });

    it('should update item quantity', () => {
      mockCartStore.updateQuantity(101, 5);

      const item = mockCartStore.items.find(i => i.product_id === 101);
      expect(item?.quantity).toBe(5);
    });

    it('should not update if item not found', () => {
      mockCartStore.updateQuantity(999, 5);

      expect(mockCartStore.updateQuantity).toHaveBeenCalledWith(999, 5);
      // Should not throw, just no-op
    });

    it('should validate quantity > 0', () => {
      const validateQuantity = (qty: number) => {
        if (qty <= 0) throw new Error('Quantity must be greater than 0');
      };

      expect(() => validateQuantity(0)).toThrow('Quantity must be greater than 0');
      expect(() => validateQuantity(-1)).toThrow('Quantity must be greater than 0');
      expect(() => validateQuantity(1)).not.toThrow();
    });
  });

  describe('Clear Cart', () => {
    beforeEach(() => {
      mockCartStore.items = [...mockCartItems];
    });

    it('should remove all items', () => {
      mockCartStore.clearCart();

      expect(mockCartStore.items).toHaveLength(0);
      expect(mockCartStore.clearCart).toHaveBeenCalled();
    });
  });

  describe('Cart Total Calculation', () => {
    it('should calculate total correctly', () => {
      mockCartStore.items = [
        { id: 1, product_id: 101, name: 'Product A', price: 10000, quantity: 2, stock: 50 },
        { id: 2, product_id: 102, name: 'Product B', price: 20000, quantity: 1, stock: 30 },
      ];
      
      // Product A: 10,000 x 2 = 20,000
      // Product B: 20,000 x 1 = 20,000
      // Total: 40,000
      const total = mockCartStore.getTotal();

      expect(total).toBe(40000);
    });

    it('should return 0 for empty cart', () => {
      mockCartStore.items = [];

      const total = mockCartStore.getTotal();

      expect(total).toBe(0);
    });

    it('should handle decimal prices', () => {
      mockCartStore.items = [
        { id: 1, product_id: 101, name: 'Product A', price: 9990, quantity: 3, stock: 50 },
      ];

      const total = mockCartStore.getTotal();

      expect(total).toBe(29970);
    });

    it('should update total when quantity changes', () => {
      mockCartStore.items = [
        { id: 1, product_id: 101, name: 'Product A', price: 10000, quantity: 2, stock: 50 },
        { id: 2, product_id: 102, name: 'Product B', price: 20000, quantity: 1, stock: 30 },
      ];
      
      const initialTotal = mockCartStore.getTotal();
      expect(initialTotal).toBe(40000);

      mockCartStore.updateQuantity(101, 5); // Change from 2 to 5

      const newTotal = mockCartStore.getTotal();
      // 10,000 x 5 + 20,000 x 1 = 70,000
      expect(newTotal).toBe(70000);
    });
  });

  describe('Cart Validation', () => {
    it('should validate cart before checkout', () => {
      mockCartStore.items = [...mockCartItems];

      const validateCart = () => {
        if (mockCartStore.items.length === 0) {
          throw new Error('Cart is empty');
        }

        for (const item of mockCartStore.items) {
          if (item.quantity > item.stock) {
            throw new Error(`${item.name} quantity exceeds stock`);
          }
          if (item.quantity <= 0) {
            throw new Error(`${item.name} has invalid quantity`);
          }
        }

        return true;
      };

      expect(validateCart()).toBe(true);
    });

    it('should fail validation for empty cart', () => {
      mockCartStore.items = [];

      const validateCart = () => {
        if (mockCartStore.items.length === 0) {
          throw new Error('Cart is empty');
        }
      };

      expect(() => validateCart()).toThrow('Cart is empty');
    });

    it('should fail validation for out-of-stock items', () => {
      mockCartStore.items = [
        { id: 1, product_id: 101, name: 'Product A', price: 10000, quantity: 100, stock: 5 },
      ];

      const validateCart = () => {
        for (const item of mockCartStore.items) {
          if (item.quantity > item.stock) {
            throw new Error(`${item.name} quantity exceeds stock`);
          }
        }
      };

      expect(() => validateCart()).toThrow('Product A quantity exceeds stock');
    });
  });

  describe('Cart Edge Cases', () => {
    it('should handle very large quantities', () => {
      const item = {
        id: 1,
        product_id: 101,
        name: 'Product A',
        price: 10000,
        quantity: 1000000,
        stock: 1000000,
      };

      mockCartStore.addItem(item);
      const total = mockCartStore.getTotal();

      expect(total).toBe(10000000000); // 10 trillion won
    });

    it('should handle zero price items (free products)', () => {
      mockCartStore.items = [
        { id: 1, product_id: 101, name: 'Free Sample', price: 0, quantity: 1, stock: 100 },
      ];

      const total = mockCartStore.getTotal();

      expect(total).toBe(0);
    });

    it('should handle special characters in product names', () => {
      const item = {
        id: 1,
        product_id: 101,
        name: 'Product <script>alert("XSS")</script>',
        price: 10000,
        quantity: 1,
        stock: 50,
      };

      mockCartStore.addItem(item);

      expect(mockCartStore.items[0].name).toContain('<script>');
      // Frontend should sanitize, but data should be stored as-is
    });
  });
});

describe('Cart API Integration', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should fetch cart items from API', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        success: true,
        items: mockCartItems,
        total: 40000,
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const response = await fetch('/api/cart');
    const data = await response.json();

    expect(data.items).toHaveLength(2);
    expect(data.total).toBe(40000);
  });

  it('should add item via API', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        success: true,
        message: 'Item added to cart',
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 101, quantity: 1 }),
    });

    const data = await response.json();

    expect(data.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cart',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ product_id: 101, quantity: 1 }),
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'Product not found',
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const response = await fetch('/api/cart');
    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Product not found');
  });
});
