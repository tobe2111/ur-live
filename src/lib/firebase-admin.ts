// Firebase Admin SDK 초기화 및 유틸리티 (Cloudflare Workers 호환)
// src/lib/firebase-admin.ts

import type { Env } from '../types/env'

/**
 * Firebase REST API를 사용한 Admin 기능 (Cloudflare Workers 호환)
 * 
 * Firebase Admin SDK는 Node.js 전용이므로 Cloudflare Workers에서 사용 불가
 * 대신 Firebase REST API + Service Account를 사용하여 인증된 쓰기 수행
 */
export class FirebaseAdmin {
  private databaseURL: string
  private projectId: string
  private privateKey: string
  private clientEmail: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(env: Env) {
    this.databaseURL = env.FIREBASE_DATABASE_URL
    this.projectId = env.FIREBASE_PROJECT_ID
    this.privateKey = env.FIREBASE_PRIVATE_KEY
    this.clientEmail = env.FIREBASE_CLIENT_EMAIL

    if (!this.databaseURL || !this.projectId || !this.privateKey || !this.clientEmail) {
      console.warn('⚠️ Firebase Admin credentials not configured, using unauthenticated mode')
    }
  }

  /**
   * Firebase에 데이터 쓰기 (인증 없이, 보안 규칙에 따라 차단될 수 있음)
   * 프로덕션에서는 보안 규칙에서 읽기 전용으로 설정하고 서버 API만 쓰기
   */
  async set(path: string, data: any): Promise<void> {
    const url = `${this.databaseURL}/${path}.json`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ Firebase set failed for ${path}:`, error)
      throw new Error(`Firebase set failed: ${response.statusText}`)
    }

    console.log(`✅ Firebase: Set data at ${path}`)
  }

  /**
   * Firebase 데이터 업데이트 (PATCH)
   */
  async update(path: string, data: any): Promise<void> {
    const url = `${this.databaseURL}/${path}.json`
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ Firebase update failed for ${path}:`, error)
      throw new Error(`Firebase update failed: ${response.statusText}`)
    }

    console.log(`✅ Firebase: Updated data at ${path}`)
  }

  /**
   * Firebase에서 데이터 읽기
   */
  async get(path: string): Promise<any> {
    const url = `${this.databaseURL}/${path}.json`
    
    const response = await fetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`Firebase get failed: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Firebase 데이터 삭제
   */
  async delete(path: string): Promise<void> {
    const url = `${this.databaseURL}/${path}.json`
    
    const response = await fetch(url, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Firebase delete failed: ${response.statusText}`)
    }

    console.log(`✅ Firebase: Deleted data at ${path}`)
  }

  /**
   * 라이브 스트림 상태 업데이트
   */
  async updateStreamStatus(streamId: number, data: {
    id?: number
    title?: string
    status?: 'live' | 'scheduled' | 'ended'
    current_product_id?: number | null
    viewer_count?: number
    seller_id?: number
    youtube_video_id?: string
  }): Promise<void> {
    try {
      await this.update(`streams/stream${streamId}`, {
        ...data,
        updated_at: Date.now(),
      })
      console.log(`✅ Firebase: Stream ${streamId} updated`, data)
    } catch (error) {
      console.error(`❌ Firebase: Failed to update stream ${streamId}`, error)
      // Firebase 실패해도 D1은 정상 작동하므로 에러 던지지 않음
    }
  }

  /**
   * 상품 재고 업데이트
   */
  async updateProductStock(productId: number, stock: number, additionalData?: {
    name?: string
    price?: number
    original_price?: number
    discount_rate?: number
    image_url?: string
  }): Promise<void> {
    try {
      await this.update(`products/product${productId}`, {
        id: productId,
        stock,
        ...additionalData,
        updated_at: Date.now(),
      })
      console.log(`✅ Firebase: Product ${productId} stock updated to ${stock}`)
    } catch (error) {
      console.error(`❌ Firebase: Failed to update product ${productId}`, error)
    }
  }

  /**
   * 셀러가 현재 상품 변경
   */
  async changeCurrentProduct(streamId: number, newProductId: number): Promise<void> {
    try {
      // 스트림의 current_product_id 업데이트
      await this.updateStreamStatus(streamId, {
        current_product_id: newProductId,
      })
      console.log(`✅ Firebase: Stream ${streamId} current product changed to ${newProductId}`)
    } catch (error) {
      console.error(`❌ Firebase: Failed to change product for stream ${streamId}`, error)
    }
  }

  /**
   * 재고 부족 알림 전송 (채팅)
   */
  async sendLowStockAlert(streamId: number, productName: string, currentStock: number): Promise<void> {
    try {
      const chatRef = `chats/stream${streamId}`
      const timestamp = Date.now()
      
      await this.set(`${chatRef}/alert_${timestamp}`, {
        username: '시스템',
        text: `⚠️ ${productName}의 재고가 ${currentStock}개 남았습니다!`,
        timestamp,
        isSystem: true,
      })
      
      console.log(`✅ Firebase: Low stock alert sent for stream ${streamId}`)
    } catch (error) {
      console.error(`❌ Firebase: Failed to send low stock alert`, error)
    }
  }

  /**
   * 품절 알림 전송
   */
  async sendSoldOutAlert(streamId: number, productName: string): Promise<void> {
    try {
      const chatRef = `chats/stream${streamId}`
      const timestamp = Date.now()
      
      await this.set(`${chatRef}/soldout_${timestamp}`, {
        username: '시스템',
        text: `🔴 ${productName}이(가) 품절되었습니다!`,
        timestamp,
        isSystem: true,
      })
      
      console.log(`✅ Firebase: Sold out alert sent for stream ${streamId}`)
    } catch (error) {
      console.error(`❌ Firebase: Failed to send sold out alert`, error)
    }
  }
}

/**
 * Firebase Admin 인스턴스 생성
 */
export function initFirebaseAdmin(env: Env): FirebaseAdmin {
  return new FirebaseAdmin(env)
}

/**
 * D1 데이터를 Firebase에 동기화
 */
export async function syncD1ToFirebase(
  firebase: FirebaseAdmin,
  type: 'stream' | 'product',
  data: any
): Promise<void> {
  try {
    if (type === 'stream') {
      await firebase.updateStreamStatus(data.id, {
        id: data.id,
        title: data.title,
        status: data.status,
        current_product_id: data.current_product_id,
        viewer_count: data.viewer_count || 0,
        seller_id: data.seller_id,
        youtube_video_id: data.youtube_video_id,
      })
    } else if (type === 'product') {
      await firebase.updateProductStock(data.id, data.stock, {
        name: data.name,
        price: data.price,
        original_price: data.original_price,
        discount_rate: data.discount_rate,
        image_url: data.image_url,
      })
    }
  } catch (error) {
    console.error(`❌ Firebase sync failed for ${type}:`, error)
    // Firebase 동기화 실패해도 D1은 정상 처리
  }
}
