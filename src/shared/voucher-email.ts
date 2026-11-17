/**
 * ✉️ 이용권 발급 이메일 — 외국인(해외 간편결제) 손님에게 이용권 링크를 보낸다 (2026-11-17 대표 *"3번 이메일 부분 개발해두자"*).
 *
 * 왜: 외국인은 카카오 알림톡을 못 받는다. 결제 직후 메일 한 통에 **매장에서 내밀 화면 링크(`/v/:code`)와 코드**가
 * 있어야 한다. 순수 함수(워커·화면 미리보기 공용) — 보내는 일은 `worker/utils/voucher-email-send.ts` 가 한다.
 *
 * 언어: 손님이 결제한 화면의 언어(en·ja·zh·ko). 모르면 영어. **매장 이름·주소는 언제나 한국어 원문을 같이 적는다** —
 * 택시 기사·매장 직원에게 그대로 보여 줘야 하기 때문이다.
 * 메일 클라이언트 호환: 표(table) + 인라인 style 만 쓴다(클래스·SVG·외부 글꼴 없음 — Gmail·Outlook 이 지운다).
 * QR 그림은 넣지 않는다 — 외부 QR 서비스에 코드를 보내면 코드가 새고, 메일 속 SVG 는 대부분 막힌다. 대신 버튼이
 * 같은 화면(`/v/:code`, 로그인 불필요)을 연다.
 */
import { VOUCHER_VALIDITY_LABEL } from './voucher-validity'

export type VoucherEmailLang = 'en' | 'ja' | 'zh' | 'ko'

export interface VoucherEmailInput {
  lang?: string | null
  buyerName?: string | null
  productName: string
  storeName: string
  storeAddress?: string | null
  storePhone?: string | null
  codes: string[]
  /** D1 모양 'YYYY-MM-DD HH:MM:SS'(UTC) 또는 'YYYY-MM-DD' */
  expiresAt?: string | null
  /** 사이트 주소(끝 슬래시 없음) — 기본 https://urdeal.kr */
  origin?: string
}

const BRAND = '#1C69EF'
const INK = '#16181C'
const SUB = '#666C72'
const LINE = '#E2E5E9'
const BG = '#F8F7FC'

const COPY: Record<VoucherEmailLang, {
  subject: (p: string) => string; hello: (n: string) => string; lead: string; code: string; open: string
  store: string; address: string; phone: string; validUntil: string; how: string[]; refund: string; help: string
}> = {
  en: {
    subject: (p) => `Your UrDeal voucher is ready: ${p}`,
    hello: (n) => (n ? `Hi ${n},` : 'Hi,'),
    lead: 'Thank you for your purchase. Show the voucher screen below at the store to use it.',
    code: 'Voucher code', open: 'Open voucher', store: 'Store', address: 'Address', phone: 'Phone',
    validUntil: 'Valid until',
    how: ['Visit the store and tap "Open voucher".', 'Show the screen to the staff.', 'The staff confirms it and you are done.'],
    refund: `Valid for up to 12 months from purchase. If you do not use it before it expires, the full amount is refunded automatically.`,
    help: 'Questions? Reply to this email or write to jiwon@ur-team.com.',
  },
  ja: {
    subject: (p) => `UrDealの利用券が届きました：${p}`,
    hello: (n) => (n ? `${n}様` : 'お客様'),
    lead: 'ご購入ありがとうございます。店舗で下の利用券画面をご提示ください。',
    code: '利用券コード', open: '利用券を開く', store: '店舗', address: '住所', phone: '電話',
    validUntil: '有効期限',
    how: ['店舗で「利用券を開く」を押してください。', 'スタッフに画面を見せてください。', 'スタッフが確認すれば完了です。'],
    refund: '有効期限は購入日から最長12か月です。期限までに使わなかった場合は、全額が自動で返金されます。',
    help: 'ご不明な点はこのメールへの返信、または jiwon@ur-team.com までどうぞ。',
  },
  zh: {
    subject: (p) => `您的 UrDeal 使用券已发放：${p}`,
    hello: (n) => (n ? `${n}，您好：` : '您好：'),
    lead: '感谢您的购买。请在店内出示下方的使用券页面。',
    code: '使用券代码', open: '打开使用券', store: '店铺', address: '地址', phone: '电话',
    validUntil: '有效期至',
    how: ['到店后点击“打开使用券”。', '向店员出示页面。', '店员确认后即可使用。'],
    refund: '有效期为自购买日起最长12个月。到期前未使用的，将自动全额退款。',
    help: '如有疑问，请直接回复本邮件或发送至 jiwon@ur-team.com。',
  },
  ko: {
    subject: (p) => `유어딜 이용권이 발급됐어요: ${p}`,
    hello: (n) => (n ? `${n}님, 안녕하세요.` : '안녕하세요.'),
    lead: '구매해 주셔서 감사합니다. 매장에서 아래 이용권 화면을 보여 주세요.',
    code: '이용권 코드', open: '이용권 열기', store: '매장', address: '주소', phone: '전화',
    validUntil: '사용 기한',
    how: ['매장에서 "이용권 열기"를 누르세요.', '직원에게 화면을 보여 주세요.', '직원이 확인하면 사용 완료예요.'],
    refund: `유효기간은 ${VOUCHER_VALIDITY_LABEL} 이내예요. 기한 안에 쓰지 않으면 결제 금액 전액이 자동으로 환불돼요.`,
    help: '궁금한 점은 이 메일에 답장하시거나 jiwon@ur-team.com 으로 보내 주세요.',
  },
}

/** 손님 언어 → 메일 언어. ko·ja·zh 외(en·es·fr·모름)는 영어. */
export function voucherEmailLang(lang: string | null | undefined): VoucherEmailLang {
  const l = String(lang || '').toLowerCase().slice(0, 2)
  return l === 'ko' || l === 'ja' || l === 'zh' ? l : 'en'
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 'YYYY-MM-DD HH:MM:SS'(UTC) → 한국 날짜 'YYYY-MM-DD'. 날짜만이면 그대로. */
export function voucherEmailDate(expiresAt: string | null | undefined): string {
  const raw = String(expiresAt || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return ''
  if (raw.length <= 10) return raw.slice(0, 10)
  const t = Date.parse(raw.replace(' ', 'T') + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? '' : 'Z'))
  if (!Number.isFinite(t)) return raw.slice(0, 10)
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10)
}

export function buildVoucherIssuedEmail(input: VoucherEmailInput): { subject: string; html: string; lang: VoucherEmailLang } {
  const lang = voucherEmailLang(input.lang)
  const c = COPY[lang]
  const origin = (input.origin || 'https://urdeal.kr').replace(/\/+$/, '')
  const codes = input.codes.filter((x) => /^[A-Za-z0-9-]{4,40}$/.test(x))
  const until = voucherEmailDate(input.expiresAt)

  const row = (label: string, value: string) => value
    ? `<tr><td style="padding:6px 0;font-size:13px;color:${SUB};width:96px;vertical-align:top;">${esc(label)}</td><td style="padding:6px 0;font-size:15px;color:${INK};">${esc(value)}</td></tr>`
    : ''

  const tickets = codes.map((code) => {
    const url = `${origin}/v/${encodeURIComponent(code)}`
    return `
      <tr><td style="padding:0 0 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px;background:#FFFFFF;">
          <tr><td style="background:${BRAND};border-radius:12px 12px 0 0;padding:12px 20px;font-size:13px;color:#FFFFFF;">${esc(c.code)}</td></tr>
          <tr><td style="padding:16px 20px 4px;font-size:24px;font-weight:700;letter-spacing:2px;color:${INK};font-family:Menlo,Consolas,monospace;">${esc(code)}</td></tr>
          ${until ? `<tr><td style="padding:0 20px 12px;font-size:13px;color:${SUB};">${esc(c.validUntil)} ${esc(until)}</td></tr>` : ''}
          <tr><td style="padding:4px 20px 20px;">
            <a href="${esc(url)}" style="display:block;background:${BRAND};color:#FFFFFF;text-decoration:none;text-align:center;padding:14px 0;border-radius:10px;font-size:16px;font-weight:600;">${esc(c.open)}</a>
          </td></tr>
        </table>
      </td></tr>`
  }).join('')

  const steps = c.how.map((s, i) =>
    `<tr><td style="padding:4px 0;font-size:14px;color:${INK};"><span style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:10px;background:${BG};color:${BRAND};text-align:center;font-size:12px;font-weight:700;margin-right:8px;">${i + 1}</span>${esc(s)}</td></tr>`).join('')

  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject(input.productName))}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;">
    <tr><td style="padding:0 4px 16px;font-size:20px;font-weight:700;color:${BRAND};">urdeal</td></tr>
    <tr><td style="background:#FFFFFF;border-radius:16px;padding:24px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:15px;color:${INK};padding-bottom:4px;">${esc(c.hello(String(input.buyerName || '').trim()))}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:${SUB};padding-bottom:20px;">${esc(c.lead)}</td></tr>
        <tr><td style="font-size:20px;font-weight:600;color:${INK};padding-bottom:16px;">${esc(input.productName)}</td></tr>
        ${tickets}
        <tr><td style="padding:8px 0 4px;border-top:1px solid ${LINE};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row(c.store, input.storeName)}${row(c.address, String(input.storeAddress || ''))}${row(c.phone, String(input.storePhone || ''))}
          </table>
        </td></tr>
        <tr><td style="padding:16px 0 4px;border-top:1px solid ${LINE};"><table role="presentation" cellpadding="0" cellspacing="0">${steps}</table></td></tr>
        <tr><td style="padding:16px 0 0;font-size:13px;line-height:1.6;color:${SUB};">${esc(c.refund)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.6;color:${SUB};text-align:center;">
      ${esc(c.help)}<br>리스터코퍼레이션 (LISTER Corporation) · 사업자등록번호 479-09-02930<br>
      <a href="${esc(origin)}/refund" style="color:${SUB};">Refund policy</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
  return { subject: c.subject(input.productName), html, lang }
}
