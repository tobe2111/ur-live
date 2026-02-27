// Firebase Admin SDK 초기화 및 유틸리티
// src/lib/firebase-admin.ts

import type { Env } from '../types/env'

// Firebase Admin SDK 타입 정의 (Cloudflare Workers 환경용)
interface FirebaseApp {
  database(): FirebaseDatabase
}

interface FirebaseDatabase {
  ref(path: string): FirebaseReference
}

interface FirebaseReference {
  set(value: any): Promise<void>
  update(value: any): Promise<void>
  push(value: any): Promise<{ key: string | null }>
  once(eventType: string): Promise<{ val(): any }>
  remove(): Promise<void>
}

// Firebase REST API를 사용한 Admin SDK 대체 (Cloudflare Workers 호환)
export class FirebaseAdmin {
  private databaseURL: string
  private apiKey: string

  constructor(env: Env) {
    this.databaseURL = env.FIREBASE_DATABASE_URL || 'https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app'
    this.apiKey = env.FIREBASE_API_KEY || 'AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s'
  }

  /**
   * Firebase Realtime DB에 데이터 쓰기
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
      throw new Error(`Firebase set failed: ${response.statusText}`)
    }
  }

  /**
   * Firebase Realtime DB 데이터 업데이트
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
      throw new Error(`Firebase update failed: ${response.statusText}`)
    }
  }

  /**
   * Firebase Realtime DB에서 데이터 읽기
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
   * Firebase Realtime DB 데이터 삭제
   */
  async delete(path: string): Promise<void> {
    const url = `${this.databaseURL}/${path}.json`
    
    const response = await fetch(url, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Firebase delete failed: ${response.statusText}`)
    }
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
    await this.update(`streams/stream${streamId}`, {
      ...data,
      updated_at: Date.now(),
    })
    console.log(`✅ Firebase: Stream ${streamId} updated`, data)
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
    await this.update(`products/product${productId}`, {
      id: productId,
      stock,
      ...additionalData,
      updated_at: Date.now(),
    })
    console.log(`✅ Firebase: Product ${productId} stock updated to ${stock}`)
  }

  /**
   * 방송별 상품 재고 업데이트
   */
  async updateStreamProduct(streamId: number, productId: number, stock: number, isCurrent: boolean = false): Promise<void> {
    await this.update(`stream_products/stream${streamId}/products/product${productId}`, {
      id: productId,
      stock,
      is_current: isCurrent,
      updated_at: Date.now(),
    })
    console.log(`✅ Firebase: Stream ${streamId} product ${productId} updated`)
  }

  /**
   * 셀러가 현재 상품 변경
   */
  async changeCurrentProduct(streamId: number, newProductId: number): Promise<void> {
    // 1. 스트림의 current_product_id 업데이트
    await this.updateStreamStatus(streamId, {
      current_product_id: newProductId,
    })

    // 2. 모든 상품의 is_current를 false로 설정
    const streamProducts = await this.get(`stream_products/stream${streamId}/products`)
    if (streamProducts) {
      const updates: Record<string, any> = {}
      for (const key in streamProducts) {
        updates[`stream_products/stream${streamId}/products/${key}/is_current`] = false
      }
      
      // 3. 새 상품을 is_current = true로 설정
      updates[`stream_products/stream${streamId}/products/product${newProductId}/is_current`] = true
      
      // 병렬 업데이트
      await Promise.all(
        Object.entries(updates).map(([path, value]) => 
          this.update(path, value)
        )
      )
    }

    console.log(`✅ Firebase: Stream ${streamId} current product changed to ${newProductId}`)
  }

  /**
   * 재고 부족 알림 전송 (채팅에 시스템 메시지)
   */
  async sendLowStockAlert(streamId: number, productName: string, currentStock: number): Promise<void> {
    const chatRef = `chats/stream${streamId}`
    const timestamp = Date.now()
    
    await this.set(`${chatRef}/alert_${timestamp}`, {
      username: '시스템',
      text: `⚠️ ${productName}의 재고가 ${currentStock}개 남았습니다!`,
      timestamp,
      isSystem: true,
    })
    
    console.log(`✅ Firebase: Low stock alert sent for stream ${streamId}`)
  }

  /**
   * 품절 알림 전송
   */
  async sendSoldOutAlert(streamId: number, productName: string): Promise<void> {
    const chatRef = `chats/stream${streamId}`
    const timestamp = Date.now()
    
    await this.set(`${chatRef}/soldout_${timestamp}`, {
      username: '시스템',
      text: `🔴 ${productName}이(가) 품절되었습니다!`,
      timestamp,
      isSystem: true,
    })
    
    console.log(`✅ Firebase: Sold out alert sent for stream ${streamId}`)
  }
}

/**
 * Firebase Admin 인스턴스 생성 헬퍼
 */
export function initFirebaseAdmin(env: Env): FirebaseAdmin {
  return new FirebaseAdmin(env)
}

/**
 * 데이터 동기화: D1 → Firebase
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
    // Firebase 실패해도 D1은 정상 처리되므로 에러 던지지 않음
  }
}
