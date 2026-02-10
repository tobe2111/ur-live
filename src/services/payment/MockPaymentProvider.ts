import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  CancelRequest,
  CancelResponse,
} from '../../types/payment';

/**
 * Mock Payment Provider
 * 
 * This is a dummy payment provider for testing purposes.
 * It simulates payment flow without actual payment gateway integration.
 * 
 * Usage:
 * - Development: Test order flow without real payment
 * - Testing: Verify payment logic without external dependencies
 * - Demo: Show payment flow to stakeholders
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;

  /**
   * Initialize mock payment
   * Returns a mock widget URL that can be used for testing
   */
  async initialize(request: PaymentRequest): Promise<{ widgetUrl?: string; data?: any }> {
    console.log('[MockPayment] Initializing payment:', request);

    // Simulate API delay
    await this.delay(500);

    // Return mock widget URL with query parameters
    const widgetUrl = `/mock-payment?orderId=${request.orderId}&amount=${request.amount}&orderName=${encodeURIComponent(request.orderName)}`;

    return {
      widgetUrl,
      data: {
        mockPaymentKey: `MOCK_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        orderId: request.orderId,
        amount: request.amount,
      },
    };
  }

  /**
   * Approve mock payment
   * Always succeeds for testing purposes
   */
  async approve(paymentKey: string, orderId: string, amount: number): Promise<PaymentResponse> {
    console.log('[MockPayment] Approving payment:', { paymentKey, orderId, amount });

    // Simulate API delay
    await this.delay(1000);

    // Mock approval always succeeds
    return {
      success: true,
      paymentKey,
      transactionId: `MOCK_TXN_${Date.now()}`,
      orderId,
      amount,
      status: 'approved',
      message: 'Mock payment approved successfully',
    };
  }

  /**
   * Cancel mock payment
   * Always succeeds for testing purposes
   */
  async cancel(request: CancelRequest): Promise<CancelResponse> {
    console.log('[MockPayment] Canceling payment:', request);

    // Simulate API delay
    await this.delay(800);

    // Mock cancellation always succeeds
    return {
      success: true,
      orderId: request.orderId,
      cancelAmount: request.amount,
      cancelDate: new Date().toISOString(),
    };
  }

  /**
   * Verify mock payment (always returns true)
   */
  async verify(data: any): Promise<boolean> {
    console.log('[MockPayment] Verifying payment:', data);
    return true;
  }

  /**
   * Simulate API delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
