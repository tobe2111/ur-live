/**
 * Payment Gateway Abstraction Layer
 * 
 * This file defines the interface for payment providers.
 * Future PG integrations (Toss Payments, PortOne, etc.) should implement this interface.
 */

/**
 * Payment provider type
 */
export type PaymentProviderType = 'mock' | 'toss' | 'portone' | 'nicepay';

/**
 * Payment request parameters
 */
export interface PaymentRequest {
  orderId: string;
  amount: number;
  orderName: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  successUrl?: string;
  failUrl?: string;
}

/**
 * Payment response
 */
export interface PaymentResponse {
  success: boolean;
  paymentKey?: string;
  transactionId?: string;
  orderId: string;
  amount: number;
  status: 'pending' | 'approved' | 'failed' | 'cancelled';
  message?: string;
  error?: string;
}

/**
 * Payment cancellation request
 */
export interface CancelRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
  reason: string;
}

/**
 * Payment cancellation response
 */
export interface CancelResponse {
  success: boolean;
  orderId: string;
  cancelAmount: number;
  cancelDate: string;
  error?: string;
}

/**
 * Payment Provider Interface
 * 
 * All payment gateway integrations must implement this interface.
 */
export interface PaymentProvider {
  /**
   * Provider name
   */
  readonly name: PaymentProviderType;

  /**
   * Initialize payment and return payment widget URL or data
   */
  initialize(request: PaymentRequest): Promise<{ widgetUrl?: string; data?: any }>;

  /**
   * Approve/confirm payment after user completes payment in widget
   */
  approve(paymentKey: string, orderId: string, amount: number): Promise<PaymentResponse>;

  /**
   * Cancel/refund payment
   */
  cancel(request: CancelRequest): Promise<CancelResponse>;

  /**
   * Verify payment signature/webhook (optional)
   */
  verify?(data: any): Promise<boolean>;
}
