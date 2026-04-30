/**
 * Email Notification API
 * - 글로벌 사용자용 이메일 알림 (카카오 대안)
 * - Cloudflare Workers의 fetch로 외부 이메일 API 호출
 * - 지원: 주문 확인, 배송 알림, 방송 예고
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
export const emailRoutes = new Hono<{ Bindings: Env }>()

interface EmailParams {
  to: string
  subject: string
  html: string
}

async function sendEmail(env: Env, params: EmailParams): Promise<boolean> {
  // Mailgun, SendGrid, AWS SES 등 외부 이메일 서비스 연동
  // 현재는 로그만 남기고 나중에 실제 서비스 연결
  const apiKey = (env as any).EMAIL_API_KEY
  const domain = (env as any).EMAIL_DOMAIN

  if (!apiKey || !domain) {
    console.log('[Email] No API key configured, skipping:', params.subject, params.to)
    return false
  }

  try {
    // Mailgun 예시
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${btoa(`api:${apiKey}`)}` },
      body: new URLSearchParams({
        from: `YourDeal <noreply@${domain}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    })
    return res.ok
  } catch (err) {
    console.error('[Email] Send failed:', err)
    return false
  }
}

// 주문 확인 이메일
emailRoutes.post('/order-confirmation', async (c) => {
  const { email, order_number, total_amount, items } = await c.req.json<any>()
  if (!email) return c.json({ success: false, error: 'Email required' }, 400)

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1d1d1f">Order Confirmed! 🎉</h2>
      <p>Thank you for your order.</p>
      <p><strong>Order #:</strong> ${order_number}</p>
      <p><strong>Total:</strong> ${Number(total_amount ?? 0).toLocaleString('ko-KR')} KRW</p>
      <hr style="border:1px solid #eee;margin:20px 0">
      <a href="https://live.ur-team.com/my-orders" style="display:inline-block;padding:12px 24px;background:#007aff;color:white;text-decoration:none;border-radius:8px">View Order</a>
    </div>
  `
  const sent = await sendEmail(c.env, { to: email, subject: `Order Confirmed - #${order_number}`, html })
  return c.json({ success: sent })
})

// 배송 알림 이메일
emailRoutes.post('/shipping-notification', async (c) => {
  const { email, order_number, courier, tracking_number } = await c.req.json<any>()
  if (!email) return c.json({ success: false, error: 'Email required' }, 400)

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1d1d1f">Your Order Has Shipped! 📦</h2>
      <p><strong>Order #:</strong> ${order_number}</p>
      <p><strong>Carrier:</strong> ${courier || 'N/A'}</p>
      <p><strong>Tracking:</strong> ${tracking_number}</p>
      <hr style="border:1px solid #eee;margin:20px 0">
      <a href="https://live.ur-team.com/my-orders" style="display:inline-block;padding:12px 24px;background:#007aff;color:white;text-decoration:none;border-radius:8px">Track Order</a>
    </div>
  `
  const sent = await sendEmail(c.env, { to: email, subject: `Order Shipped - #${order_number}`, html })
  return c.json({ success: sent })
})

// 방송 예고 이메일
emailRoutes.post('/broadcast-reminder', async (c) => {
  const { email, stream_title, seller_name, stream_id, scheduled_at } = await c.req.json<any>()
  if (!email) return c.json({ success: false, error: 'Email required' }, 400)

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1d1d1f">Live Stream Starting Soon! 🔴</h2>
      <p><strong>${seller_name}</strong> is going live:</p>
      <p style="font-size:18px;font-weight:bold">${stream_title}</p>
      <p>Scheduled: ${new Date(scheduled_at).toLocaleString()}</p>
      <hr style="border:1px solid #eee;margin:20px 0">
      <a href="https://live.ur-team.com/live/${stream_id}" style="display:inline-block;padding:12px 24px;background:#ff3b30;color:white;text-decoration:none;border-radius:8px">Watch Live</a>
    </div>
  `
  const sent = await sendEmail(c.env, { to: email, subject: `🔴 ${seller_name} is going live: ${stream_title}`, html })
  return c.json({ success: sent })
})
