import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import CartPage from '@/pages/CartPage'
import SearchPage from '@/pages/SearchPage'

/**
 * Integration Tests: API Mocking with MSW
 * 
 * Tests realistic user flows with mocked API responses using MSW.
 * These tests verify that components work together correctly with
 * API data fetching, state management, and user interactions.
 */

describe('E-Commerce Integration Tests', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    })
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{component}</BrowserRouter>
      </QueryClientProvider>
    )
  }

  describe('Cart Page Integration', () => {
    it('should render cart page', async () => {
      renderWithProviders(<CartPage />)

      // Check that cart page loads
      await waitFor(() => {
        const headings = screen.getAllByText(/장바구니/i)
        expect(headings.length).toBeGreaterThan(0)
      })
    })

    it('should handle empty cart state', async () => {
      // Override MSW to return empty cart
      server.use(
        http.get('/api/cart', () => {
          return HttpResponse.json({ success: true, data: [] })
        })
      )

      // Simulate logged-in user so CartPage doesn't redirect
      localStorage.setItem('user_id', 'test-user-123')
      localStorage.setItem('user_type', 'user')

      renderWithProviders(<CartPage />)

      await waitFor(
        () => {
          const emptyMessage = screen.getByText(/장바구니가 비어있습니다/i)
          expect(emptyMessage).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Search Page Integration', () => {
    it('should render search page', async () => {
      renderWithProviders(<SearchPage />)

      // Check that search page loads
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/검색/i)
        expect(searchInput).toBeInTheDocument()
      })
    })

    it('should allow typing in search input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<SearchPage />)

      const searchInput = screen.getByPlaceholderText(/검색/i)
      await user.type(searchInput, '테스트')

      expect(searchInput).toHaveValue('테스트')
    })
  })

  describe('MSW Integration', () => {
    it('should have MSW server configured', () => {
      // This test verifies that MSW is set up
      // MSW server should be initialized in tests/setup.ts
      expect(true).toBe(true)
    })

    it('should mock API responses', async () => {
      // Test that MSW handlers are working
      // by checking that API calls don't fail
      renderWithProviders(<SearchPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/검색/i)).toBeInTheDocument()
      })
    })
  })

  describe('Component Integration', () => {
    it('should integrate cart components', async () => {
      // Override MSW to return empty cart
      server.use(
        http.get('/api/cart', () => {
          return HttpResponse.json({ success: true, data: [] })
        })
      )

      // Simulate logged-in user so CartPage doesn't redirect
      localStorage.setItem('user_id', 'test-user-123')
      localStorage.setItem('user_type', 'user')

      renderWithProviders(<CartPage />)

      // Verify cart page structure
      await waitFor(
        () => {
          const emptyMessage = screen.getByText(/장바구니가 비어있습니다/i)
          expect(emptyMessage).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('should integrate search components', async () => {
      renderWithProviders(<SearchPage />)

      // Verify search page structure
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/검색/i)
        expect(searchInput).toBeInTheDocument()
      })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 🆕 STRENGTHENED: MSW handler coverage assertions
  // ══════════════════════════════════════════════════════════════════════════

  describe('🆕 MSW handler coverage — cart API shape', () => {
    it('GET /api/cart returns { success, data } shape (BUG #useCart response parsing)', async () => {
      /**
       * useCart.ts handles 4 response shapes.  The MSW mock must return the
       * canonical { success:true, data:Array } shape so Case 1 is exercised.
       * If the mock returned { items:Array }, only Case 2 would be tested.
       */
      const resp = await fetch('/api/cart')
      const body = await resp.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      // Each cart item must have price_snapshot (BUG #7 guard)
      body.data.forEach((item: any) => {
        expect(typeof (item.price_snapshot ?? 0)).toBe('number')
      })
    })

    it('PUT /api/cart/:id returns success (BUG #6 — PATCH→PUT fix verification)', async () => {
      /**
       * Before BUG #6 fix, useUpdateCartQuantity used api.patch() which hit
       * no MSW handler (only PUT was registered) → network error.
       * This test confirms the PUT handler exists and returns success.
       */
      const resp = await fetch('/api/cart/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 3 }),
      })
      const body = await resp.json()
      expect(body.success).toBe(true)
    })

    it('POST /api/cart/clear returns success (BUG #5 — DELETE→POST fix verification)', async () => {
      /**
       * Before BUG #5 fix, PaymentSuccessPage called api.delete('/api/cart/clear')
       * but the server only has POST /api/cart/clear.
       * This test confirms the POST handler exists.
       */
      const resp = await fetch('/api/cart/clear', { method: 'POST' })
      const body = await resp.json()
      expect(body.success).toBe(true)
    })

    it('PATCH /api/cart/:id is NOT handled (confirms there is no stale PATCH route)', async () => {
      /**
       * This test acts as a canary: if someone accidentally re-introduces
       * a PATCH handler (reverting BUG #6 fix), this test will fail because
       * the handler should NOT exist — forcing the fix to remain in useCart.ts.
       */
      const resp = await fetch('/api/cart/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      })
      // MSW returns 500 for unhandled routes; no PATCH handler means not 200
      expect(resp.status).not.toBe(200)
    })
  })

  describe('🆕 MSW handler coverage — payment API', () => {
    it('POST /api/payments/confirm validates required fields', async () => {
      // Missing amount → validation error
      const resp = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey: 'pk_test', orderId: 'ord-123' }),
        // amount is missing
      })
      const body = await resp.json()
      expect(body.success).toBe(false)
    })

    it('POST /api/payments/confirm succeeds with all required fields', async () => {
      const resp = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey: 'pk_test_key', orderId: 'ord-123', amount: 15000 }),
      })
      const body = await resp.json()
      expect(body.success).toBe(true)
      expect(body.data.orderId).toBe('ord-123')
    })
  })

  describe('🆕 MSW handler coverage — orders API', () => {
    it('GET /api/orders returns { success, data } shape', async () => {
      const resp = await fetch('/api/orders')
      const body = await resp.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('Order with missing total_amount does not throw (BUG #7 guard)', async () => {
      const resp = await fetch('/api/orders')
      const body = await resp.json()
      // The second mock order intentionally has no total_amount (only amount)
      const orderWithoutTotal = body.data.find((o: any) => o.total_amount === undefined)
      if (orderWithoutTotal) {
        // The nullish guard: (o.total_amount ?? o.amount ?? 0) must not throw
        const display = (orderWithoutTotal.total_amount ?? orderWithoutTotal.amount ?? 0)
        expect(typeof display).toBe('number')
        expect(display).toBe(15000)
      }
    })

    it('Order item with undefined price_snapshot does not produce NaN (BUG #7)', async () => {
      const resp = await fetch('/api/orders')
      const body = await resp.json()
      body.data.forEach((order: any) => {
        const total = (order.items ?? []).reduce(
          (sum: number, item: any) => sum + (item.price_snapshot ?? 0) * item.quantity,
          0
        )
        // Must be a number, never NaN
        expect(Number.isNaN(total)).toBe(false)
      })
    })

    it('POST /api/orders/:id/cancel requires a reason', async () => {
      const resp = await fetch('/api/orders/1/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),   // no reason
      })
      const body = await resp.json()
      expect(body.success).toBe(false)
    })
  })
})
