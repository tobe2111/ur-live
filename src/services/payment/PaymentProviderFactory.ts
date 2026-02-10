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
        // TODO: Implement TossPaymentProvider
        // return new TossPaymentProvider(config);
        throw new Error('Toss Payments provider not implemented yet. See docs/PAYMENT_GATEWAY_GUIDE.md');

      case 'portone':
        // TODO: Implement PortOnePaymentProvider
        // return new PortOnePaymentProvider(config);
        throw new Error('PortOne provider not implemented yet. See docs/PAYMENT_GATEWAY_GUIDE.md');

      case 'nicepay':
        // NicePay removed - use Toss or PortOne instead
        throw new Error('NicePay has been removed. Please use Toss Payments or PortOne instead.');

      default:
        console.warn(`Unknown payment provider: ${type}, falling back to mock provider`);
        return new MockPaymentProvider();
    }
  }

  /**
   * Get available providers
   */
  static getAvailableProviders(): PaymentProviderType[] {
    return ['mock'];
    // When new providers are implemented, add them here:
    // return ['mock', 'toss', 'portone'];
  }
}
