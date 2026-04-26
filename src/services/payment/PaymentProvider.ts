/**
 * Payment Gateway (PG) Provider Interface
 * 
 * This interface allows easy switching between different PG providers
 * without changing the core payment logic.
 * 
 * Supported PG Providers:
 * - TossPayments (current)
 * - PortOne (future)
 * - NicePay (future)
 * - Inicis (future)
 * - PayPle (future)
 */

import { TOSS_PAYMENT_URL } from '@/shared/constants';

export interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface PaymentConfirmResponse {
  success: boolean;
  orderId: string;
  paymentKey: string;
  method: string;           // card, virtual_account, transfer, mobile, etc.
  totalAmount: number;
  status: string;           // DONE, WAITING_FOR_DEPOSIT, etc.
  approvedAt: string;
  
  // Card info (if applicable)
  cardCompany?: string;
  cardNumber?: string;
  installmentMonths?: number;
  
  // Virtual account info (if applicable)
  virtualAccountBank?: string;
  virtualAccountNumber?: string;
  virtualAccountHolder?: string;
  virtualAccountDueDate?: string;
  
  // Transaction info
  transactionId?: string;
  
  // Raw response from PG
  rawData?: any;
  
  // Error info (if failed)
  error?: string;
}

export interface PaymentProvider {
  name: string;  // 'tosspayments', 'portone', 'nicepay', etc.
  
  /**
   * Confirm a payment
   */
  confirmPayment(request: PaymentConfirmRequest): Promise<PaymentConfirmResponse>;
  
  /**
   * Cancel/refund a payment
   */
  cancelPayment(paymentKey: string, reason: string): Promise<{ success: boolean; error?: string }>;
  
  /**
   * Get payment details
   */
  getPayment(paymentKey: string): Promise<PaymentConfirmResponse>;
}

/**
 * TossPayments Provider Implementation
 */
export class TossPaymentsProvider implements PaymentProvider {
  name = 'tosspayments';
  private secretKey: string;
  
  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }
  
  async confirmPayment(request: PaymentConfirmRequest): Promise<PaymentConfirmResponse> {
    try {
      const response = await fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(this.secretKey + ':')}`,
          'Content-Type': 'application/json',
          // Toss 권장: 동일 요청 재시도 시 중복 승인 방지
          'Idempotency-Key': `confirm-${request.orderId}-${request.paymentKey}`,
        },
        body: JSON.stringify({
          paymentKey: request.paymentKey,
          orderId: request.orderId,
          amount: request.amount
        })
      });
      
      const data = await response.json() as any;
      
      if (!response.ok) {
        return {
          success: false,
          orderId: request.orderId,
          paymentKey: request.paymentKey,
          method: '',
          totalAmount: request.amount,
          status: 'FAILED',
          approvedAt: '',
          error: data.message || '결제 승인 실패',
          rawData: data
        };
      }
      
      // Parse card info
      let cardInfo: any = {};
      if (data.card) {
        cardInfo = {
          cardCompany: data.card.company,
          cardNumber: data.card.number,  // Masked
          installmentMonths: data.card.installmentPlanMonths || 0
        };
      }
      
      // Parse virtual account info
      let virtualAccountInfo: any = {};
      if (data.virtualAccount) {
        virtualAccountInfo = {
          virtualAccountBank: data.virtualAccount.bankCode,
          virtualAccountNumber: data.virtualAccount.accountNumber,
          virtualAccountHolder: data.virtualAccount.customerName,
          virtualAccountDueDate: data.virtualAccount.dueDate
        };
      }
      
      return {
        success: true,
        orderId: data.orderId,
        paymentKey: data.paymentKey,
        method: data.method,
        totalAmount: data.totalAmount,
        status: data.status,
        approvedAt: data.approvedAt,
        transactionId: data.transactionKey,
        ...cardInfo,
        ...virtualAccountInfo,
        rawData: data
      };
    } catch (err) {
      return {
        success: false,
        orderId: request.orderId,
        paymentKey: request.paymentKey,
        method: '',
        totalAmount: request.amount,
        status: 'FAILED',
        approvedAt: '',
        error: (err as Error).message,
        rawData: null
      };
    }
  }
  
  async cancelPayment(paymentKey: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${TOSS_PAYMENT_URL}/payments/${paymentKey}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(this.secretKey + ':')}`,
          'Content-Type': 'application/json',
          // Toss 권장: 동일 환불 요청 재시도 시 중복 환불 방지
          'Idempotency-Key': `cancel-${paymentKey}-${Date.now()}`,
        },
        body: JSON.stringify({ cancelReason: reason })
      });
      
      if (!response.ok) {
        const data = await response.json() as any;
        return { success: false, error: data.message };
      }
      
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
  
  async getPayment(paymentKey: string): Promise<PaymentConfirmResponse> {
    try {
      const response = await fetch(`${TOSS_PAYMENT_URL}/payments/${paymentKey}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(this.secretKey + ':')}`,
        }
      });
      
      const data = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(data.message);
      }
      
      return {
        success: true,
        orderId: data.orderId,
        paymentKey: data.paymentKey,
        method: data.method,
        totalAmount: data.totalAmount,
        status: data.status,
        approvedAt: data.approvedAt,
        rawData: data
      };
    } catch (err) {
      throw err;
    }
  }
}

/**
 * Payment Provider Factory
 * Creates the appropriate PG provider based on configuration
 */
export class PaymentProviderFactory {
  static createProvider(provider: string, secretKey: string): PaymentProvider {
    switch (provider.toLowerCase()) {
      case 'tosspayments':
        return new TossPaymentsProvider(secretKey);

      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  }
}
