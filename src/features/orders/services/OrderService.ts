/**
 * OrderService - 비즈니스 로직 레이어
 * 
 * OrderRepository를 사용하여 주문 관련 비즈니스 로직 처리
 * 단위 테스트 가능한 순수 함수 구조
 */

import { OrderRepository } from '../repositories/OrderRepository';
import type { 
  Order, 
  CreateOrderRequest, 
  UpdateOrderStatusRequest,
  OrderFilters 
} from '../types';

export class OrderService {
  private repository: OrderRepository;

  constructor(db: D1Database) {
    this.repository = new OrderRepository(db);
  }

  /**
   * 주문 목록 조회 (필터링 지원)
   */
  async getOrders(filters?: OrderFilters): Promise<Order[]> {
    try {
      return await this.repository.findAll(filters);
    } catch (error) {
      console.error('[OrderService] getOrders failed:', error);
      throw new Error('주문 목록 조회 실패');
    }
  }

  /**
   * 특정 주문 조회
   */
  async getOrderById(orderId: number): Promise<Order | null> {
    try {
      const order = await this.repository.findById(orderId);
      
      if (!order) {
        throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
      }
      
      return order;
    } catch (error) {
      console.error('[OrderService] getOrderById failed:', error);
      throw error;
    }
  }

  /**
   * 사용자의 주문 목록 조회
   */
  async getUserOrders(userId: number): Promise<Order[]> {
    try {
      return await this.repository.findByUserId(userId);
    } catch (error) {
      console.error('[OrderService] getUserOrders failed:', error);
      throw new Error('사용자 주문 목록 조회 실패');
    }
  }

  /**
   * 주문 생성
   */
  async createOrder(data: CreateOrderRequest): Promise<Order> {
    try {
      // 비즈니스 검증
      this.validateCreateOrderRequest(data);
      
      // 총액 계산 검증
      const calculatedTotal = this.calculateOrderTotal(data.items);
      if (Math.abs(calculatedTotal - data.total_amount) > 0.01) {
        throw new Error('주문 금액이 일치하지 않습니다');
      }
      
      // 주문 생성
      const orderId = await this.repository.create(data);
      
      // 생성된 주문 조회
      const order = await this.repository.findById(orderId);
      if (!order) {
        throw new Error('주문 생성 후 조회 실패');
      }
      
      console.log('[OrderService] Order created:', {
        orderId,
        userId: data.user_id,
        total: data.total_amount,
        itemCount: data.items.length
      });
      
      return order;
    } catch (error) {
      console.error('[OrderService] createOrder failed:', error);
      throw error;
    }
  }

  /**
   * 주문 상태 업데이트
   */
  async updateOrderStatus(
    orderId: number,
    data: UpdateOrderStatusRequest
  ): Promise<Order> {
    try {
      // 기존 주문 확인
      const existingOrder = await this.repository.findById(orderId);
      if (!existingOrder) {
        throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
      }
      
      // 상태 전환 검증
      this.validateStatusTransition(existingOrder.status, data.status);
      
      // 상태 업데이트
      await this.repository.updateStatus(orderId, data);
      
      // 업데이트된 주문 조회
      const updatedOrder = await this.repository.findById(orderId);
      if (!updatedOrder) {
        throw new Error('주문 업데이트 후 조회 실패');
      }
      
      console.log('[OrderService] Order status updated:', {
        orderId,
        oldStatus: existingOrder.status,
        newStatus: data.status
      });
      
      return updatedOrder;
    } catch (error) {
      console.error('[OrderService] updateOrderStatus failed:', error);
      throw error;
    }
  }

  /**
   * 주문 취소
   */
  async cancelOrder(orderId: number, reason?: string): Promise<Order> {
    try {
      const order = await this.repository.findById(orderId);
      if (!order) {
        throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
      }
      
      // 취소 가능 상태 확인
      const cancelableStatuses = ['pending', 'confirmed', 'processing'];
      if (!cancelableStatuses.includes(order.status)) {
        throw new Error(`주문 상태가 '${order.status}'이므로 취소할 수 없습니다`);
      }
      
      // 취소 처리
      return await this.updateOrderStatus(orderId, {
        status: 'cancelled',
        status_reason: reason || '사용자 요청'
      });
    } catch (error) {
      console.error('[OrderService] cancelOrder failed:', error);
      throw error;
    }
  }

  // =================================
  // Private Helper Methods
  // =================================

  /**
   * 주문 생성 요청 검증
   */
  private validateCreateOrderRequest(data: CreateOrderRequest): void {
    if (!data.user_id || data.user_id <= 0) {
      throw new Error('유효하지 않은 사용자 ID');
    }
    
    if (!data.items || data.items.length === 0) {
      throw new Error('주문 상품이 없습니다');
    }
    
    if (data.total_amount <= 0) {
      throw new Error('유효하지 않은 주문 금액');
    }
    
    // 각 상품 검증
    for (const item of data.items) {
      if (!item.product_id || item.product_id <= 0) {
        throw new Error('유효하지 않은 상품 ID');
      }
      if (item.quantity <= 0) {
        throw new Error('유효하지 않은 상품 수량');
      }
      if (item.price <= 0) {
        throw new Error('유효하지 않은 상품 가격');
      }
    }
  }

  /**
   * 주문 총액 계산
   */
  private calculateOrderTotal(
    items: CreateOrderRequest['items']
  ): number {
    return items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
  }

  /**
   * 주문 상태 전환 검증
   */
  private validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): void {
    // 허용되는 상태 전환 정의
    const allowedTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'returned'],
      'delivered': ['returned'],
      'cancelled': [], // 취소된 주문은 상태 변경 불가
      'returned': []   // 반품된 주문은 상태 변경 불가
    };
    
    const allowed = allowedTransitions[currentStatus] || [];
    
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `'${currentStatus}' 상태에서 '${newStatus}' 상태로 전환할 수 없습니다`
      );
    }
  }
}
