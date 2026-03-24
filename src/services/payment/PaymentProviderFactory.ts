import type { PaymentProvider, PaymentProviderType } from '../../types/payment';
import { MockPaymentProvider } from './MockPaymentProvider';

/**
 * Payment Provider Factory
 * 
 * This factory creates payment provider instances based on configuration.
 * 
 * Usage:
 * ```typescript
 * // Get payment provider from environment variable
 * const provider = PaymentProviderFactory.create(c.env.PAYMENT_PROVIDER || 'mock');
 * 
 * // Initialize payment
 * const { widgetUrl } = await provider.initialize(paymentRequest);
 * 
 * // Approve payment
 * const result = await provider.approve(paymentKey, orderId, amount);
 * ```
 * 
 * Adding new providers:
 * 1. Implement PaymentProvider interface
 * 2. Add provider to the factory's create method
 * 3. Update PAYMENT_PROVIDER environment variable
 */
export class PaymentProviderFactory {
  /**
   * Create payment provider instance
   * 
   * @param type - Payment provider type from environment variable
   * @param config - Optional provider-specific configuration
   * @returns PaymentProvider instance
   */
  static create(type: PaymentProviderType = 'mock', config?: any): PaymentProvider {
    switch (type) {
      case 'mock':
        return new MockPaymentProvider();

      case 'toss':
        // Toss Payments는 CheckoutPage/TossPaymentWidget에서 직접 SDK 사용
        // 이 팩토리 패턴은 미래 서버사이드 통합 시 활용
        throw new Error('Toss Payments는 TossPaymentWidget을 통해 직접 통합됩니다.');

      default:

      default:
        console.warn(`Unknown payment provider: ${type}, falling back to mock provider`);
        return new MockPaymentProvider();
    }
  }

  /**
   * Get available providers
   */
  static getAvailableProviders(): PaymentProviderType[] {
    return ['mock', 'toss'];
  }
}
