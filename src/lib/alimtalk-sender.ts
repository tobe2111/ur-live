/**
 * 알림톡 수동 발송 라이브러리
 * 
 * 셀러가 대시보드에서 직접 알림톡을 발송하는 기능
 * - 템플릿 변수 치환
 * - 선불제 포인트 정산
 * - 대량 발송 비동기 처리
 * - Failover 처리 (실패 시 포인트 환불)
 */

import { sendAlimtalk } from './aligo'

interface Env {
  DB: D1Database
  ALIGO_API_KEY: string
  ALIGO_USER_ID: string
}

interface SendAlimtalkRequest {
  accountId: number
  templateId: number
  recipients: AlimtalkRecipient[]
  variables: Record<string, string>
}

interface AlimtalkRecipient {
  phone: string
  name?: string
  variables?: Record<string, string> // 수신자별 개별 변수
}

interface SendAlimtalkResult {
  success: boolean
  totalRecipients: number
  successCount: number
  failedCount: number
  refundedAmount: number
  messages: AlimtalkMessageResult[]
  error?: string
}

interface AlimtalkMessageResult {
  phone: string
  status: 'sent' | 'failed'
  messageId?: string
  error?: string
  cost: number
}

/**
 * 템플릿 변수 치환
 */
function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template

  // #{변수명} 형식의 변수를 치환
  Object.entries(variables).forEach(([key, value]) => {
    const pattern = new RegExp(`#{${key}}`, 'g')
    result = result.replace(pattern, value)
  })

  return result
}

/**
 * 템플릿 변수 검증
 */
function validateTemplateVariables(
  template: string,
  variables: Record<string, string>
): { valid: boolean; missingVars: string[] } {
  // 템플릿에서 필요한 변수 추출
  const requiredVars = Array.from(
    template.matchAll(/#{(\w+)}/g),
    match => match[1]
  )

  // 누락된 변수 확인
  const missingVars = requiredVars.filter(varName => !variables[varName])

  return {
    valid: missingVars.length === 0,
    missingVars
  }
}

/**
 * 발송 전 잔액 확인
 */
async function checkBalance(
  DB: D1Database,
  accountId: number,
  requiredAmount: number
): Promise<{ sufficient: boolean; currentBalance: number }> {
  const account = await DB.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(accountId).first<{ balance: number }>()

  if (!account) {
    throw new Error(`Account not found: ${accountId}`)
  }

  return {
    sufficient: account.balance >= requiredAmount,
    currentBalance: account.balance
  }
}

/**
 * 포인트 차감 (트랜잭션)
 */
async function deductBalance(
  DB: D1Database,
  accountId: number,
  amount: number
): Promise<void> {
  // D1은 트랜잭션을 지원하지 않으므로 batch로 처리
  const result = await DB.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(amount, accountId, amount).run()

  if (!result.success || result.meta.changes === 0) {
    throw new Error('Insufficient balance or account not found')
  }
}

/**
 * 포인트 환불
 */
async function refundBalance(
  DB: D1Database,
  accountId: number,
  amount: number
): Promise<void> {
  await DB.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(amount, accountId).run()
}

/**
 * 발송 내역 기록
 */
async function saveMessageRecord(
  DB: D1Database,
  data: {
    accountId: number
    templateId: number
    orderId?: number
    recipientPhone: string
    messageContent: string
    status: 'sent' | 'failed'
    cost: number
    aligoMessageId?: string
    failedReason?: string
  }
): Promise<void> {
  await DB.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    data.accountId,
    data.templateId,
    data.orderId || null,
    data.recipientPhone,
    data.messageContent,
    data.status,
    data.cost,
    data.aligoMessageId || null,
    data.failedReason || null
  ).run()
}

/**
 * 통계 업데이트
 */
async function updateAccountStats(
  DB: D1Database,
  accountId: number,
  sentCount: number,
  failedCount: number
): Promise<void> {
  await DB.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(sentCount, failedCount, accountId).run()
}

/**
 * 단일 알림톡 발송
 */
async function sendSingleAlimtalk(
  env: Env,
  accountId: number,
  templateId: number,
  template: string,
  senderKey: string,
  templateCode: string,
  recipient: AlimtalkRecipient,
  globalVariables: Record<string, string>,
  unitCost: number
): Promise<AlimtalkMessageResult> {
  try {
    // 변수 병합 (개별 변수가 전역 변수보다 우선)
    const variables = { ...globalVariables, ...recipient.variables }

    // 템플릿 변수 치환
    const message = replaceTemplateVariables(template, variables)

    // 알리고 API 호출
    const result = await sendAlimtalk(env, {
      senderKey,
      templateCode,
      to: recipient.phone,
      message
    })

    if (result.success) {
      // 성공 기록
      await saveMessageRecord(env.DB, {
        accountId,
        templateId,
        recipientPhone: recipient.phone,
        messageContent: message,
        status: 'sent',
        cost: unitCost,
        aligoMessageId: result.messageId
      })

      return {
        phone: recipient.phone,
        status: 'sent',
        messageId: result.messageId,
        cost: unitCost
      }
    } else {
      // 실패 기록
      await saveMessageRecord(env.DB, {
        accountId,
        templateId,
        recipientPhone: recipient.phone,
        messageContent: message,
        status: 'failed',
        cost: 0,
        failedReason: result.error
      })

      // 포인트 환불
      await refundBalance(env.DB, accountId, unitCost)

      return {
        phone: recipient.phone,
        status: 'failed',
        error: result.error,
        cost: 0
      }
    }
  } catch (error) {
    console.error(`Failed to send alimtalk to ${recipient.phone}:`, error)

    // 오류 기록
    await saveMessageRecord(env.DB, {
      accountId,
      templateId,
      recipientPhone: recipient.phone,
      messageContent: '',
      status: 'failed',
      cost: 0,
      failedReason: (error as Error).message
    })

    // 포인트 환불
    await refundBalance(env.DB, accountId, unitCost)

    return {
      phone: recipient.phone,
      status: 'failed',
      error: (error as Error).message,
      cost: 0
    }
  }
}

/**
 * 알림톡 발송 (메인 함수)
 */
export async function sendBulkAlimtalk(
  env: Env,
  request: SendAlimtalkRequest
): Promise<SendAlimtalkResult> {
  const { accountId, templateId, recipients, variables } = request

  // Starting bulk send

  try {
    // 1. 계정 정보 조회
    const account = await env.DB.prepare(`
      SELECT 
        id,
        sender_key,
        balance,
        status
      FROM alimtalk_accounts
      WHERE id = ?
    `).bind(accountId).first<{
      id: number
      sender_key: string
      balance: number
      status: string
    }>()

    if (!account) {
      throw new Error('Account not found')
    }

    if (account.status !== 'active') {
      throw new Error('Account is not active')
    }

    // 2. 템플릿 정보 조회
    const template = await env.DB.prepare(`
      SELECT 
        id,
        template_code,
        template_content,
        status
      FROM alimtalk_templates
      WHERE id = ? AND account_id = ?
    `).bind(templateId, accountId).first<{
      id: number
      template_code: string
      template_content: string
      status: string
    }>()

    if (!template) {
      throw new Error('Template not found')
    }

    if (template.status !== 'approved') {
      throw new Error('Template is not approved')
    }

    // 3. 템플릿 변수 검증
    const validation = validateTemplateVariables(template.template_content, variables)
    if (!validation.valid) {
      throw new Error(`Missing variables: ${validation.missingVars.join(', ')}`)
    }

    // 4. 발송 비용 계산 (건당 15원 가정)
    const unitCost = 15
    const totalCost = recipients.length * unitCost

    // 5. 잔액 확인
    const balanceCheck = await checkBalance(env.DB, accountId, totalCost)
    if (!balanceCheck.sufficient) {
      throw new Error(
        `Insufficient balance. Required: ${totalCost}, Current: ${balanceCheck.currentBalance}`
      )
    }

    // 6. 포인트 선차감 (전체 금액)
    await deductBalance(env.DB, accountId, totalCost)
    // Points deducted

    // 7. 개별 발송 (순차 처리)
    const results: AlimtalkMessageResult[] = []
    let successCount = 0
    let failedCount = 0
    let refundedAmount = 0

    for (const recipient of recipients) {
      const result = await sendSingleAlimtalk(
        env,
        accountId,
        templateId,
        template.template_content,
        account.sender_key,
        template.template_code,
        recipient,
        variables,
        unitCost
      )

      results.push(result)

      if (result.status === 'sent') {
        successCount++
      } else {
        failedCount++
        refundedAmount += unitCost
      }

      // Rate limiting: 초당 10건 제한
      if (results.length % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // 8. 통계 업데이트
    await updateAccountStats(env.DB, accountId, successCount, failedCount)

    // Bulk send completed

    return {
      success: true,
      totalRecipients: recipients.length,
      successCount,
      failedCount,
      refundedAmount,
      messages: results
    }
  } catch (error) {
    console.error('[Alimtalk] Bulk send failed:', error)
    return {
      success: false,
      totalRecipients: recipients.length,
      successCount: 0,
      failedCount: recipients.length,
      refundedAmount: 0,
      messages: [],
      error: (error as Error).message
    }
  }
}

/**
 * 주문 연동 알림톡 발송
 */
export async function sendOrderAlimtalk(
  env: Env,
  accountId: number,
  templateId: number,
  orderId: number,
  customMessage?: string
): Promise<SendAlimtalkResult> {
  // 주문 정보 조회
  const order = await env.DB.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(orderId).first<any>()

  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  // 주문 상품 조회
  const items = await env.DB.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(orderId).all()

  const productList = items.results.map((item: any) => 
    `${item.name} ${item.quantity}개 (${item.price.toLocaleString()}원)`
  ).join('\n')

  // 템플릿 변수 설정
  const variables = {
    orderNumber: order.order_number,
    orderDate: new Date(order.created_at).toLocaleString('ko-KR'),
    productList,
    totalAmount: order.total_amount.toLocaleString(),
    shippingAddress: order.shipping_address,
    shippingName: order.shipping_name,
    shippingPhone: order.shipping_phone,
    buyerName: order.buyer_name,
    customMessage: customMessage || '감사합니다!'
  }

  // 수신자 설정
  const recipients: AlimtalkRecipient[] = [{
    phone: order.buyer_phone,
    name: order.buyer_name
  }]

  return sendBulkAlimtalk(env, {
    accountId,
    templateId,
    recipients,
    variables
  })
}

/**
 * CSV/Excel 대량 발송
 */
export interface BulkRecipientRow {
  phone: string
  name?: string
  [key: string]: string | undefined // 추가 변수
}

export async function sendBulkFromFile(
  env: Env,
  accountId: number,
  templateId: number,
  rows: BulkRecipientRow[],
  globalVariables: Record<string, string> = {}
): Promise<SendAlimtalkResult> {
  // CSV 데이터를 수신자 목록으로 변환
  const recipients: AlimtalkRecipient[] = rows.map(row => ({
    phone: row.phone,
    name: row.name,
    variables: Object.entries(row)
      .filter(([key]) => key !== 'phone' && key !== 'name')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
  }))

  return sendBulkAlimtalk(env, {
    accountId,
    templateId,
    recipients,
    variables: globalVariables
  })
}
