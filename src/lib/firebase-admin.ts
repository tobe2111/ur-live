// Firebase Admin SDK 초기화 및 유틸리티 (Cloudflare Workers 호환)
// src/lib/firebase-admin.ts

import type { CloudflareBindings as Env } from '../types/env'

interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
}

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
    this.databaseURL = env.FIREBASE_DATABASE_URL || ''
    this.projectId = env.FIREBASE_PROJECT_ID || ''
    this.privateKey = env.FIREBASE_PRIVATE_KEY || ''
    this.clientEmail = env.FIREBASE_CLIENT_EMAIL || ''

    if (!this.databaseURL || !this.projectId || !this.privateKey || !this.clientEmail) {
      console.warn('⚠️ Firebase Admin credentials not configured, using unauthenticated mode')
    }
  }

  /**
   * Firebase에 데이터 쓰기 (인증 없이, 보안 규칙에 따라 차단될 수 있음)
   * 프로덕션에서는 보안 규칙에서 읽기 전용으로 설정하고 서버 API만 쓰기
   */
  async set(path: string, data: unknown): Promise<void> {
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

  }

  /**
   * Firebase 데이터 업데이트 (PATCH)
   */
  async update(path: string, data: unknown): Promise<void> {
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

  }

  /**
   * Firebase에서 데이터 읽기
   */
  async get(path: string): Promise<unknown> {
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
      
    } catch (error) {
      console.error(`❌ Firebase: Failed to send sold out alert`, error)
    }
  }

  /**
   * Firebase Custom Token 생성
   * 
   * Cloudflare Workers 환경에서 firebase-admin 없이 Custom Token 생성
   * Web Crypto API 사용
   */
  async createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string> {
    try {
      // Enhanced credential checking
      if (!this.privateKey || !this.clientEmail || !this.projectId) {
        const missingCreds = []
        if (!this.privateKey) missingCreds.push('FIREBASE_PRIVATE_KEY')
        if (!this.clientEmail) missingCreds.push('FIREBASE_CLIENT_EMAIL')
        if (!this.projectId) missingCreds.push('FIREBASE_PROJECT_ID')
        throw new Error(`Firebase credentials not configured: missing ${missingCreds.join(', ')}`)
      }
      
      // JWT Header
      const header = {
        alg: 'RS256',
        typ: 'JWT'
      }

      // JWT Payload
      const now = Math.floor(Date.now() / 1000)
      const payload = {
        iss: this.clientEmail,
        sub: this.clientEmail,
        aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
        iat: now,
        exp: now + 3600, // 1 hour
        uid: uid,
        claims: claims || {}
      }

      // Base64url encode (UTF-8 safe for Cloudflare Workers)
      const base64url = (data: unknown) => {
        const json = JSON.stringify(data)
        // Convert string to UTF-8 bytes using TextEncoder
        const utf8Bytes = new TextEncoder().encode(json)
        
        // Convert byte array to binary string (each byte becomes one char)
        let binaryString = ''
        for (let i = 0; i < utf8Bytes.length; i++) {
          binaryString += String.fromCharCode(utf8Bytes[i])
        }
        
        // Encode to base64
        const base64 = btoa(binaryString)
        
        // Make it URL-safe (JWT base64url format)
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      }

      const headerEncoded = base64url(header)
      const payloadEncoded = base64url(payload)
      const signatureInput = `${headerEncoded}.${payloadEncoded}`

      // Sign with RS256
      const privateKeyPem = this.privateKey.replace(/\\n/g, '\n')
      
      // Validate PEM format
      if (!privateKeyPem.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Invalid private key format: missing PEM header')
      }
      if (!privateKeyPem.includes('-----END PRIVATE KEY-----')) {
        throw new Error('Invalid private key format: missing PEM footer')
      }
      
      const privateKeyDer = await this.pemToDer(privateKeyPem)
      
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyDer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        false,
        ['sign']
      )

      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(signatureInput)
      )

      // Base64url encode signature
      const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      const signatureEncoded = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

      const customToken = `${signatureInput}.${signatureEncoded}`
      
      return customToken

    } catch (error) {
      console.error('[Firebase Custom Token] ❌ Failed to create token:', error)
      // Re-throw with more context
      throw new Error(`Failed to create Firebase custom token: ${(error as Error).message}`)
    }
  }

  /**
   * Firebase Custom User Claims 영구 설정
   * 토큰 갱신 후에도 Claims가 유지되도록 Firebase REST API로 설정
   * - createCustomToken()만 호출하면 첫 번째 토큰에만 Claims 포함됨
   * - 이 메서드를 함께 호출하면 모든 갱신된 토큰에도 Claims 유지됨
   */
  async setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    try {
      // Firebase Identity Toolkit REST API로 custom attributes 설정
      const accessToken = await this.getAccessToken()
      const url = `https://identitytoolkit.googleapis.com/v1/projects/${this.projectId}/accounts:update`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localId: uid,
          customAttributes: JSON.stringify(claims),
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error(`[Firebase Claims] ❌ Failed to set custom claims:`, errorData)
        // 실패해도 로그인 흐름을 중단하지 않음 (비치명적)
        console.warn(`[Firebase Claims] ⚠️ Custom claims 설정 실패 (비치명적, 계속 진행)`)
        return
      }

    } catch (error) {
      console.error(`[Firebase Claims] ❌ Error setting custom claims:`, error)
      // 실패해도 로그인 흐름을 중단하지 않음
      console.warn(`[Firebase Claims] ⚠️ Custom claims 설정 중 오류 (비치명적, 계속 진행)`)
    }
  }

  /**
   * Google OAuth2 Access Token 획득 (Service Account)
   */
  private async getAccessToken(): Promise<string> {
    // 캐시된 토큰이 유효하면 재사용 (만료 1분 전까지)
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken
    }

    const now = Math.floor(Date.now() / 1000)
    const jwtPayload = {
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }

    const header = { alg: 'RS256', typ: 'JWT' }

    const base64url = (data: unknown) => {
      const json = JSON.stringify(data)
      const utf8Bytes = new TextEncoder().encode(json)
      let binaryString = ''
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryString += String.fromCharCode(utf8Bytes[i])
      }
      return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    }

    const headerEncoded = base64url(header)
    const payloadEncoded = base64url(jwtPayload)
    const signatureInput = `${headerEncoded}.${payloadEncoded}`

    const privateKeyPem = this.privateKey.replace(/\\n/g, '\n')
    const privateKeyDer = await this.pemToDer(privateKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signatureInput)
    )

    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    const signatureEncoded = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const jwt = `${signatureInput}.${signatureEncoded}`

    // Google OAuth2 토큰 교환
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      throw new Error(`Failed to get access token: ${err}`)
    }

    const tokenData = await tokenResponse.json() as OAuthTokenResponse
    this.accessToken = tokenData.access_token
    this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000)

    return this.accessToken!
  }

  /**
   * PEM to DER converter for Web Crypto API
   */
  private async pemToDer(pem: string): Promise<ArrayBuffer> {
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '')

    const binaryString = atob(pemContents)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
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
  data: Record<string, unknown>
): Promise<void> {
  try {
    if (type === 'stream') {
      await firebase.updateStreamStatus(data.id as number, {
        id: data.id as number,
        title: data.title as string,
        status: data.status as 'live' | 'scheduled' | 'ended',
        current_product_id: data.current_product_id as number | null,
        viewer_count: (data.viewer_count || 0) as number,
        seller_id: data.seller_id as number,
        youtube_video_id: data.youtube_video_id as string,
      })
    } else if (type === 'product') {
      await firebase.updateProductStock(data.id as number, data.stock as number, {
        name: data.name as string,
        price: data.price as number,
        original_price: data.original_price as number,
        discount_rate: data.discount_rate as number,
        image_url: data.image_url as string,
      })
    }
  } catch (error) {
    console.error(`❌ Firebase sync failed for ${type}:`, error)
    // Firebase 동기화 실패해도 D1은 정상 처리
  }
}
