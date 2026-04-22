/**
 * Backend Input Validation Library
 * 
 * 프론트엔드 검증을 우회하는 악의적 요청을 차단하기 위한
 * 서버 사이드 입력 검증 라이브러리
 * 
 * 주요 기능:
 * - 타입 검증 (문자열, 숫자, 이메일, URL 등)
 * - 길이 제한
 * - 정규식 패턴 매칭
 * - SQL Injection 방어
 * - XSS 방어
 * - 비즈니스 로직 검증
 */

import { Context } from 'hono'

/** 검증 에러 */
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** 검증 규칙 */
export interface ValidationRule {
  /** 필드명 */
  field: string
  /** 필수 여부 */
  required?: boolean
  /** 타입 */
  type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'phone' | 'date' | 'array' | 'object'
  /** 최소 길이 (문자열) 또는 최소값 (숫자) */
  min?: number
  /** 최대 길이 (문자열) 또는 최대값 (숫자) */
  max?: number
  /** 정규식 패턴 */
  pattern?: RegExp
  /** 허용된 값 목록 (enum) */
  enum?: any[]
  /** 커스텀 검증 함수 */
  custom?: (value: any) => boolean | Promise<boolean>
  /** 에러 메시지 */
  message?: string
}

/**
 * 단일 값 검증
 */
export function validateValue(value: any, rule: ValidationRule): void {
  const { field, required, type, min, max, pattern, enum: enumValues, custom, message } = rule

  // 필수 값 체크
  if (required && (value === undefined || value === null || value === '')) {
    throw new ValidationError(field, message || `${field}은(는) 필수 항목입니다.`, 'REQUIRED')
  }

  // 값이 없으면 (optional field) 검증 건너뛰기
  if (value === undefined || value === null || value === '') {
    return
  }

  // 타입 검증
  if (type) {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new ValidationError(field, message || `${field}은(는) 문자열이어야 합니다.`, 'INVALID_TYPE')
        }
        break

      case 'number':
        const num = typeof value === 'string' ? Number(value) : value
        if (typeof num !== 'number' || isNaN(num)) {
          throw new ValidationError(field, message || `${field}은(는) 숫자여야 합니다.`, 'INVALID_TYPE')
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new ValidationError(field, message || `${field}은(는) true/false 값이어야 합니다.`, 'INVALID_TYPE')
        }
        break

      case 'email':
        if (typeof value !== 'string' || !isValidEmail(value)) {
          throw new ValidationError(field, message || `${field}은(는) 유효한 이메일 주소여야 합니다.`, 'INVALID_EMAIL')
        }
        break

      case 'url':
        if (typeof value !== 'string' || !isValidUrl(value)) {
          throw new ValidationError(field, message || `${field}은(는) 유효한 URL이어야 합니다.`, 'INVALID_URL')
        }
        break

      case 'phone':
        if (typeof value !== 'string' || !isValidPhone(value)) {
          throw new ValidationError(field, message || `${field}은(는) 유효한 전화번호여야 합니다.`, 'INVALID_PHONE')
        }
        break

      case 'date':
        if (!(value instanceof Date) && !isValidDateString(value)) {
          throw new ValidationError(field, message || `${field}은(는) 유효한 날짜여야 합니다.`, 'INVALID_DATE')
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          throw new ValidationError(field, message || `${field}은(는) 배열이어야 합니다.`, 'INVALID_TYPE')
        }
        break

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new ValidationError(field, message || `${field}은(는) 객체여야 합니다.`, 'INVALID_TYPE')
        }
        break
    }
  }

  // 길이/범위 검증
  if (typeof value === 'string') {
    if (min !== undefined && value.length < min) {
      throw new ValidationError(field, message || `${field}은(는) 최소 ${min}자 이상이어야 합니다.`, 'TOO_SHORT')
    }
    if (max !== undefined && value.length > max) {
      throw new ValidationError(field, message || `${field}은(는) 최대 ${max}자 이하여야 합니다.`, 'TOO_LONG')
    }
  }

  if (typeof value === 'number') {
    if (min !== undefined && value < min) {
      throw new ValidationError(field, message || `${field}은(는) 최소 ${min} 이상이어야 합니다.`, 'TOO_SMALL')
    }
    if (max !== undefined && value > max) {
      throw new ValidationError(field, message || `${field}은(는) 최대 ${max} 이하여야 합니다.`, 'TOO_LARGE')
    }
  }

  if (Array.isArray(value)) {
    if (min !== undefined && value.length < min) {
      throw new ValidationError(field, message || `${field}은(는) 최소 ${min}개 이상이어야 합니다.`, 'TOO_FEW')
    }
    if (max !== undefined && value.length > max) {
      throw new ValidationError(field, message || `${field}은(는) 최대 ${max}개 이하여야 합니다.`, 'TOO_MANY')
    }
  }

  // 패턴 검증
  if (pattern && typeof value === 'string') {
    if (!pattern.test(value)) {
      throw new ValidationError(field, message || `${field}의 형식이 올바르지 않습니다.`, 'INVALID_FORMAT')
    }
  }

  // Enum 검증
  if (enumValues && !enumValues.includes(value)) {
    throw new ValidationError(
      field,
      message || `${field}은(는) 다음 중 하나여야 합니다: ${enumValues.join(', ')}`,
      'INVALID_ENUM'
    )
  }

  // 커스텀 검증
  if (custom) {
    const result = custom(value)
    if (result === false) {
      throw new ValidationError(field, message || `${field}의 값이 유효하지 않습니다.`, 'CUSTOM_VALIDATION_FAILED')
    }
  }
}

/**
 * 객체 검증 (여러 필드 동시 검증)
 */
export function validateObject(data: Record<string, any>, rules: ValidationRule[]): void {
  for (const rule of rules) {
    const value = data[rule.field]
    validateValue(value, rule)
  }
}

/**
 * Hono 미들웨어로 변환
 */
export function validate(rules: ValidationRule[]) {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      // JSON body 파싱
      let data: Record<string, any> = {}
      
      const contentType = c.req.header('content-type') || ''
      
      if (contentType.includes('application/json')) {
        data = await c.req.json().catch(() => ({}))
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await c.req.parseBody().catch(() => ({}))
        data = formData as Record<string, any>
      }
      
      // Query params도 검증 대상에 포함
      const url = new URL(c.req.url)
      for (const [key, value] of url.searchParams.entries()) {
        if (!(key in data)) {
          data[key] = value
        }
      }

      // 검증 실행
      validateObject(data, rules)

      // 검증된 데이터를 context에 저장
      c.set('validatedData', data)

      await next()
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json(
          {
            success: false,
            error: error.message,
            field: error.field,
            code: error.code
          },
          400
        )
      }
      throw error
    }
  }
}

// =================================
// 유틸리티 함수들
// =================================

/** 이메일 검증 — 🛡️ 2026-04-22: RFC 5322 lite. 도메인에 최소 2글자, TLD 2~24글자 */
function isValidEmail(email: string): boolean {
  // 부분: 영문/숫자/.-_ + @ + 도메인(2글자+) + . + TLD(2~24)
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24}$/
  return emailRegex.test(email) && email.length <= 255
}

/** URL 검증 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** 한국 전화번호 검증 */
function isValidPhone(phone: string): boolean {
  // 01x-xxxx-xxxx 또는 01xxxxxxxxx 형식
  const phoneRegex = /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/
  return phoneRegex.test(phone)
}

/** 날짜 문자열 검증 */
function isValidDateString(date: any): boolean {
  if (typeof date !== 'string') return false
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

/** SQL Injection 패턴 검사 */
export function containsSqlInjection(value: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(UNION\s+ALL|UNION\s+SELECT)/i,
    /(-{2}|\/\*|\*\/)/,
    /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i
  ]
  
  return sqlPatterns.some(pattern => pattern.test(value))
}

/** XSS 패턴 검사 */
export function containsXss(value: string): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onerror, etc.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi
  ]
  
  return xssPatterns.some(pattern => pattern.test(value))
}

/** 입력 값 정제 (HTML 태그 제거) */
export function sanitizeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
}

// =================================
// 사전 정의된 검증 규칙들
// =================================

/** 사용자 등록 검증 */
export const UserRegistrationRules: ValidationRule[] = [
  {
    field: 'email',
    required: true,
    type: 'email',
    max: 255,
    message: '유효한 이메일 주소를 입력해주세요.'
  },
  {
    field: 'password',
    required: true,
    type: 'string',
    min: 8,
    max: 100,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    message: '비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다.'
  },
  {
    field: 'name',
    required: true,
    type: 'string',
    min: 2,
    max: 50,
    message: '이름은 2-50자 사이여야 합니다.'
  },
  {
    field: 'phone',
    required: false,
    type: 'phone',
    message: '유효한 전화번호를 입력해주세요. (예: 010-1234-5678)'
  }
]

/** 상품 생성 검증 */
export const ProductCreationRules: ValidationRule[] = [
  {
    field: 'name',
    required: true,
    type: 'string',
    min: 1,
    max: 200,
    message: '상품명은 1-200자 사이여야 합니다.'
  },
  {
    field: 'description',
    required: false,
    type: 'string',
    max: 5000,
    message: '상품 설명은 최대 5000자까지 입력 가능합니다.'
  },
  {
    field: 'price',
    required: true,
    type: 'number',
    min: 0,
    max: 100000000,
    message: '가격은 0원 이상 1억원 이하여야 합니다.'
  },
  {
    field: 'stock',
    required: true,
    type: 'number',
    min: 0,
    max: 999999,
    message: '재고는 0개 이상 999,999개 이하여야 합니다.'
  },
  {
    field: 'category',
    required: true,
    type: 'string',
    enum: ['패션', '뷰티', '식품', '전자제품', '생활용품', '기타'],
    message: '유효한 카테고리를 선택해주세요.'
  }
]

/** 주문 생성 검증 */
export const OrderCreationRules: ValidationRule[] = [
  {
    field: 'items',
    required: true,
    type: 'array',
    min: 1,
    max: 50,
    message: '주문 상품은 1-50개 사이여야 합니다.'
  },
  {
    field: 'shippingAddress',
    required: true,
    type: 'string',
    min: 5,
    max: 200,
    message: '배송 주소는 5-200자 사이여야 합니다.'
  },
  {
    field: 'recipientName',
    required: true,
    type: 'string',
    min: 2,
    max: 50,
    message: '수령인 이름은 2-50자 사이여야 합니다.'
  },
  {
    field: 'recipientPhone',
    required: true,
    type: 'phone',
    message: '유효한 전화번호를 입력해주세요.'
  }
]

/** 결제 검증 */
export const PaymentConfirmRules: ValidationRule[] = [
  {
    field: 'paymentKey',
    required: true,
    type: 'string',
    min: 1,
    max: 200,
    message: '결제 키가 유효하지 않습니다.'
  },
  {
    field: 'orderId',
    required: true,
    type: 'string',
    min: 1,
    max: 100,
    message: '주문 ID가 유효하지 않습니다.'
  },
  {
    field: 'amount',
    required: true,
    type: 'number',
    min: 100,
    max: 100000000,
    message: '결제 금액은 100원 이상 1억원 이하여야 합니다.'
  }
]

/** 알림톡 발송 검증 */
export const AlimtalkSendRules: ValidationRule[] = [
  {
    field: 'templateCode',
    required: true,
    type: 'string',
    min: 1,
    max: 50,
    message: '템플릿 코드가 유효하지 않습니다.'
  },
  {
    field: 'to',
    required: true,
    type: 'phone',
    message: '수신 전화번호가 유효하지 않습니다.'
  },
  {
    field: 'message',
    required: true,
    type: 'string',
    min: 1,
    max: 1000,
    message: '메시지는 1-1000자 사이여야 합니다.'
  }
]

/** 검색 쿼리 검증 */
export const SearchQueryRules: ValidationRule[] = [
  {
    field: 'q',
    required: true,
    type: 'string',
    min: 1,
    max: 100,
    message: '검색어는 1-100자 사이여야 합니다.',
    custom: (value) => {
      // SQL Injection 방지
      if (containsSqlInjection(value)) {
        throw new ValidationError('q', '검색어에 허용되지 않은 문자가 포함되어 있습니다.', 'INVALID_INPUT')
      }
      return true
    }
  },
  {
    field: 'page',
    required: false,
    type: 'number',
    min: 1,
    max: 1000,
    message: '페이지 번호는 1-1000 사이여야 합니다.'
  },
  {
    field: 'limit',
    required: false,
    type: 'number',
    min: 1,
    max: 100,
    message: '페이지당 항목 수는 1-100 사이여야 합니다.'
  }
]
