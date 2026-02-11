/**
 * Cloudflare MailChannels를 사용한 무료 이메일 전송
 * 
 * MailChannels는 Cloudflare Workers에서 무료로 사용 가능한 이메일 서비스입니다.
 * 별도 API 키나 인증 없이 사용할 수 있습니다.
 */

export interface EmailParams {
  to: string
  subject: string
  htmlContent: string
  textContent?: string
}

/**
 * MailChannels API를 통해 이메일 전송
 */
export async function sendEmail(params: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { to, subject, htmlContent, textContent } = params
    
    // MailChannels API 엔드포인트
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
          },
        ],
        from: {
          email: 'noreply@live.ur-team.com',
          name: '유어 라이브',
        },
        subject: subject,
        content: [
          {
            type: 'text/html',
            value: htmlContent,
          },
          ...(textContent ? [{
            type: 'text/plain',
            value: textContent,
          }] : []),
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Email] Failed to send:', response.status, errorText)
      return {
        success: false,
        error: `Email send failed: ${response.status}`,
      }
    }

    console.log('[Email] Successfully sent to:', to)
    return { success: true }
    
  } catch (error) {
    console.error('[Email] Exception:', error)
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

/**
 * 라이브 스트림 생성 알림 이메일 전송
 */
export async function sendLiveStreamCreatedEmail(params: {
  streamId: number
  title: string
  sellerName: string
  platform: string
  scheduledAt?: string
  status: string
}): Promise<{ success: boolean; error?: string }> {
  const { streamId, title, sellerName, platform, scheduledAt, status } = params
  
  const liveUrl = `https://live.ur-team.com/live/${streamId}`
  const statusText = status === 'live' ? '🔴 라이브 중' : 
                     status === 'scheduled' ? '📅 예약됨' : 
                     '⏸️ 대기 중'
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .content {
      background: #f9fafb;
      padding: 30px 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .info-box {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    .info-row {
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #6b7280;
      display: inline-block;
      width: 120px;
    }
    .value {
      color: #111827;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
    }
    .badge-live {
      background: #fee2e2;
      color: #dc2626;
    }
    .badge-scheduled {
      background: #dbeafe;
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">🎉 새 라이브 스트림 생성!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">셀러가 새로운 라이브 방송을 개설했습니다</p>
  </div>
  
  <div class="content">
    <div class="info-box">
      <h2 style="margin-top: 0; color: #111827;">라이브 스트림 정보</h2>
      
      <div class="info-row">
        <span class="label">상태</span>
        <span class="value">
          <span class="badge ${status === 'live' ? 'badge-live' : 'badge-scheduled'}">${statusText}</span>
        </span>
      </div>
      
      <div class="info-row">
        <span class="label">제목</span>
        <span class="value"><strong>${title}</strong></span>
      </div>
      
      <div class="info-row">
        <span class="label">판매자</span>
        <span class="value">${sellerName}</span>
      </div>
      
      <div class="info-row">
        <span class="label">플랫폼</span>
        <span class="value">${platform === 'youtube' ? '📺 YouTube' : '🎵 TikTok'}</span>
      </div>
      
      ${scheduledAt ? `
      <div class="info-row">
        <span class="label">예약 시간</span>
        <span class="value">${new Date(scheduledAt).toLocaleString('ko-KR')}</span>
      </div>
      ` : ''}
      
      <div class="info-row">
        <span class="label">라이브 ID</span>
        <span class="value">#${streamId}</span>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="${liveUrl}" class="button">
        🔗 라이브 페이지 바로가기
      </a>
    </div>
    
    <div style="background: #fffbeb; border: 1px solid #fde047; padding: 15px; border-radius: 8px; margin-top: 20px;">
      <p style="margin: 0; color: #92400e;">
        <strong>💡 참고:</strong> 이 이메일은 자동으로 전송되었습니다. 
        라이브 스트림을 확인하고 필요시 관리자 대시보드에서 관리하세요.
      </p>
    </div>
  </div>
  
  <div class="footer">
    <p style="margin: 5px 0;">
      <strong>리스터코퍼레이션</strong><br>
      부산광역시 금정구 놀이마당로26 1402<br>
      대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
    </p>
    <p style="margin: 15px 0 5px 0; font-size: 12px; color: #9ca3af;">
      © 2026 리스터코퍼레이션. All rights reserved.
    </p>
  </div>
</body>
</html>
  `
  
  const textContent = `
🎉 새 라이브 스트림 생성!

상태: ${statusText}
제목: ${title}
판매자: ${sellerName}
플랫폼: ${platform === 'youtube' ? 'YouTube' : 'TikTok'}
${scheduledAt ? `예약 시간: ${new Date(scheduledAt).toLocaleString('ko-KR')}` : ''}
라이브 ID: #${streamId}

🔗 라이브 페이지: ${liveUrl}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `
  
  return sendEmail({
    to: 'jiwon@ur-team.com',
    subject: `[유어 라이브] 🎉 새 라이브 스트림 생성: ${title}`,
    htmlContent,
    textContent,
  })
}
