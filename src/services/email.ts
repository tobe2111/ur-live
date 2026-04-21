/**
 * Email Service using Resend
 * 
 * Features:
 * - Seller approval/rejection emails
 * - Order confirmation emails
 * - Refund notification emails
 * 
 * Setup:
 * 1. Get API key from https://resend.com/api-keys
 * 2. Add RESEND_API_KEY to .env
 * 3. For production: Add domain in Resend dashboard (optional, but recommended)
 */

interface SendEmailParams {
  to: string
  subject: string
  html: string
  from?: string
}

/**
 * Send email using Resend API
 * 
 * @param params - Email parameters (to, subject, html, from)
 * @param apiKey - Resend API key
 * @param defaultFrom - Default FROM address (optional, falls back to onboarding@resend.dev)
 */
export async function sendEmail(
  params: SendEmailParams, 
  apiKey: string, 
  defaultFrom?: string
): Promise<{ success: boolean; error?: string }> {
  // Priority: 1) params.from, 2) defaultFrom (env var), 3) fallback
  const fromAddress = params.from || defaultFrom || '리스터코퍼레이션 <onboarding@resend.dev>'
  const { to, subject, html } = params
  
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured, skipping email')
    return { success: false, error: 'API key not configured' }
  }
  
  try {
    // ✅ FIX (H8): Retry up to 2 times with exponential backoff on transient failures.
    let response: Response | undefined;
    let lastError: unknown;
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromAddress,
            to,
            subject,
            html
          }),
          signal: AbortSignal.timeout(30000) // 30s timeout
        })
        if (response.ok) break;
        // Retry on 5xx; don't retry on 4xx
        if (response.status < 500 || attempt === maxRetries) break;
      } catch (e) {
        lastError = e;
        if (attempt === maxRetries) break;
      }
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }

    if (!response) {
      return { success: false, error: (lastError as Error)?.message || 'Network error' }
    }

    const data = await response.json() as any

    if (!response.ok) {
      console.error('[Email] Failed to send:', data)
      return { success: false, error: data.message || 'Failed to send email' }
    }

    return { success: true }

  } catch (error) {
    console.error('[Email] Error:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Seller Approval Email Template
 */
export function getSellerApprovalEmailHTML(sellerName: string, sellerUsername: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>셀러 승인 완료</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #1d1d1f; font-size: 28px; font-weight: 700;">🎉 축하합니다!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                안녕하세요, <strong>${sellerName}</strong>님!
              </p>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                <strong>리스터코퍼레이션</strong> 판매자로 승인되셨습니다! 🎊
              </p>
              
              <div style="background-color: #f9f9f9; border-left: 4px solid #FFD700; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #1d1d1f; font-size: 14px;">
                  <strong>판매자 정보</strong>
                </p>
                <p style="margin: 0 0 5px; color: #666; font-size: 14px;">
                  아이디: <strong>${sellerUsername}</strong>
                </p>
                <p style="margin: 0; color: #666; font-size: 14px;">
                  이름: <strong>${sellerName}</strong>
                </p>
              </div>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                이제 상품을 등록하고 라이브 방송을 시작하실 수 있습니다!
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="https://live.ur-team.com/seller" style="display: inline-block; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #1d1d1f; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);">
                  셀러 대시보드 바로가기 →
                </a>
              </div>
              
              <p style="margin: 30px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                질문이나 도움이 필요하시면 언제든지 연락주세요.<br>
                감사합니다!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                <strong>리스터코퍼레이션</strong> | 라이브 커머스 플랫폼
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                © 2026 리스터코퍼레이션. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

/**
 * Seller Rejection Email Template
 */
export function getSellerRejectionEmailHTML(sellerName: string, reason: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>셀러 승인 거부</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #1d1d1f; font-size: 24px; font-weight: 600;">판매자 승인 결과 안내</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                안녕하세요, <strong>${sellerName}</strong>님.
              </p>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                죄송하게도 현재 리스터코퍼레이션 판매자 승인이 보류되었습니다.
              </p>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #1d1d1f; font-size: 14px;">
                  <strong>거부 사유</strong>
                </p>
                <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
                  ${reason}
                </p>
              </div>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                위 사항을 보완하신 후 다시 신청해주시면 재검토하겠습니다.
              </p>
              
              <p style="margin: 30px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                추가 문의사항이 있으시면 언제든지 연락주세요.<br>
                감사합니다.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                <strong>리스터코퍼레이션</strong> | 라이브 커머스 플랫폼
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                © 2026 리스터코퍼레이션. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
