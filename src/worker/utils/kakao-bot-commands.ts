/**
 * 💬 카카오톡 채널 챗봇 — 매장 관리 명령 (2026-10-10). 연결·좌석 모델은 `kakao-bot-store.ts`.
 *
 * 명령은 전부 **연결 행이 가리키는 매장** 하나에만 작동한다 — 채팅 입력에서 매장 id 를 받지 않는다.
 * 쓰기(사용 처리·판매 중지/재개)는 반드시 `네` 확인을 거친다(확인 대기 3분, 원자적으로 꺼낸다).
 *
 * 💰 돈 계산은 하지 않는다: `정산` 은 원장 헬퍼(`getPayablePending`)를 **읽기만** 하고, 사용 처리는
 *   계산대 스캔과 **같은 함수**(`redeemVoucherForStore`)를 부른다(원장 기록도 그 안에서).
 * 📵 알림톡·문자를 보내지 않는다(이 기능의 안전 규칙).
 */
import {
  resolveLinkedSeat, consumeLinkCode, unlinkBot, saveLastList, setPending, takePending, clearPending,
  type LinkedSeat,
} from './kakao-bot-store'
import { checkVoucherForStore, redeemVoucherForStore, SELLER_REDEEM_CODE_RE } from './voucher-seller-redeem'
import { getPayablePending, sellerLedgerAccount } from './ledger'
import { VOUCHER_CATEGORIES } from '../../shared/constants/voucher-categories'
import { invalidateGroupBuyProductsCache } from '../../features/group-buy/api/cache-keys'
import { invalidateGroupBuyFeed } from './group-buy-feed-invalidate'

export interface BotReply { text: string; quick: string[] }

export interface BotCtx {
  DB: D1Database
  env: Record<string, unknown> & { DB: D1Database }
  origin: string
  /** 응답 뒤에도 끝나야 하는 일(원장 기록·캐시 퍼지)을 실행 컨텍스트에 붙인다. */
  defer: (p: Promise<unknown>) => void
}

export const STORE_QUICK = ['오늘', '사용 대기', '정산', '이용권', '도움말'] as const
const CONFIRM_QUICK = ['네', '아니요']

const won = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`
const reply = (text: string, quick: readonly string[] = STORE_QUICK): BotReply => ({ text: text.slice(0, 990), quick: [...quick] })

/** 발화 정규화 — 앞뒤 공백·연속 공백. */
export function normalizeUtterance(raw: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 200)
}

export type ParsedCommand =
  | { kind: 'link'; code: string }
  | { kind: 'unlink' }
  | { kind: 'today' }
  | { kind: 'waiting' }
  | { kind: 'payout' }
  | { kind: 'redeem'; code: string }
  | { kind: 'list' }
  | { kind: 'toggle'; index: number; active: boolean }
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'help' }

/** 명령 판정 — 매장 명령이 아니면 null(FAQ 로 넘어간다). */
export function parseStoreCommand(utterance: string): ParsedCommand | null {
  const u = normalizeUtterance(utterance)
  let m = /^연결\s*(\d{6})$/.exec(u)
  if (m) return { kind: 'link', code: m[1] }
  if (u === '해제' || u === '연결 해제') return { kind: 'unlink' }
  if (u === '오늘' || u === '판매' || u === '오늘 판매') return { kind: 'today' }
  if (u === '사용 대기' || u === '사용대기') return { kind: 'waiting' }
  if (u === '정산') return { kind: 'payout' }
  m = /^사용\s+([A-Za-z0-9-]{4,64})$/.exec(u)
  if (m) return { kind: 'redeem', code: m[1] }
  if (u === '이용권' || u === '이용권 목록') return { kind: 'list' }
  m = /^(중지|재개)\s*(\d{1,2})$/.exec(u)
  if (m) return { kind: 'toggle', index: Number(m[2]), active: m[1] === '재개' }
  if (u === '네' || u === '예' || u === '응') return { kind: 'yes' }
  if (u === '아니요' || u === '아니오' || u === '아니') return { kind: 'no' }
  if (u === '도움말' || u === '명령어') return { kind: 'help' }
  return null
}

export function helpText(storeName: string): string {
  return `[${storeName}] 카카오톡 매장 관리\n\n` +
    '· 오늘: 오늘 판매 건수와 금액\n' +
    '· 사용 대기: 아직 안 쓴 이용권 수\n' +
    '· 정산: 정산 예정 금액\n' +
    '· 사용 코드: 이용권 사용 처리 (예: 사용 UR-AB12-CD34)\n' +
    '· 이용권: 내 이용권 목록\n' +
    '· 중지 번호 / 재개 번호: 판매 중지·재개 (예: 중지 2)\n' +
    '· 해제: 이 채팅의 매장 연결 끊기'
}

const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** 오늘(KST) 판매 — 마이 판매 구역(`/my-stores/summary`)과 같은 규칙: PAID/DONE · DATE(created_at,'+9 hours'). */
export async function storeTodaySales(DB: D1Database, sellerId: number): Promise<{ n: number; rev: number }> {
  const r = await DB.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS rev
       FROM orders
      WHERE seller_id = ? AND status IN ('PAID','DONE') AND DATE(created_at, '+9 hours') = ?`
  ).bind(sellerId, todayKst()).first<{ n: number; rev: number }>()
  return { n: Number(r?.n) || 0, rev: Number(r?.rev) || 0 }
}

/** 사용 대기 — 이 매장 상품의 미사용·미만료 이용권 수. */
export async function storeWaitingVouchers(DB: D1Database, sellerId: number): Promise<number> {
  const r = await DB.prepare(
    `SELECT COUNT(*) AS n
       FROM vouchers v JOIN products p ON p.id = v.product_id
      WHERE p.seller_id = ? AND v.status = 'unused'
        AND (v.expires_at IS NULL OR v.expires_at > datetime('now'))`
  ).bind(sellerId).first<{ n: number }>()
  return Number(r?.n) || 0
}

interface ListedProduct { id: number; name: string; is_active: number; price: number | null }

/** 이 매장의 이용권 상품 — 판매 중 먼저, 삭제 제외, 최대 10개. */
export async function storeVoucherProducts(DB: D1Database, sellerId: number): Promise<ListedProduct[]> {
  const ph = VOUCHER_CATEGORIES.map(() => '?').join(',')
  const r = await DB.prepare(
    `SELECT id, name, COALESCE(is_active, 1) AS is_active, price
       FROM products
      WHERE seller_id = ? AND category IN (${ph}) AND COALESCE(status, '') != 'DELETED'
      ORDER BY COALESCE(is_active, 1) DESC, id DESC
      LIMIT 10`
  ).bind(sellerId, ...VOUCHER_CATEGORIES).all<ListedProduct>()
  return r.results || []
}

/**
 * 판매 중지/재개 — 셀러 대시보드 상품 수정과 **같은 규칙**: `WHERE id = ? AND seller_id = ?`(소유 매장만) +
 * 삭제된 상품은 되살리지 않는다 + 이용권 카테고리면 피드 캐시 무효화.
 */
export async function setStoreProductActive(
  ctx: BotCtx, sellerId: number, productId: number, active: boolean,
): Promise<{ ok: true; name: string } | { ok: false }> {
  const r = await ctx.DB.prepare(
    `UPDATE products SET is_active = ?, updated_at = datetime('now')
      WHERE id = ? AND seller_id = ? AND COALESCE(status, '') != 'DELETED'`
  ).bind(active ? 1 : 0, productId, sellerId).run()
  if (!r.meta?.changes) return { ok: false }
  const p = await ctx.DB.prepare('SELECT name FROM products WHERE id = ? AND seller_id = ? LIMIT 1')
    .bind(productId, sellerId).first<{ name: string }>().catch(() => null)
  // 목록에 실린 것은 이용권 카테고리뿐이라 피드 캐시를 늘 비운다(대시보드와 같은 두 겹).
  ctx.defer(invalidateGroupBuyProductsCache(ctx.env.SESSION_KV as never).catch(() => null))
  ctx.defer(invalidateGroupBuyFeed(ctx.env as never, ctx.origin, ctx.defer).catch(() => null))
  return { ok: true, name: p?.name || `상품 #${productId}` }
}

/** 연결 명령 — 좌석이 아직 없는 봇 키에서도 돈다. */
export async function runLinkCommand(DB: D1Database, botUserKey: string, code: string): Promise<BotReply> {
  const r = await consumeLinkCode(DB, botUserKey, code)
  if (r.ok) {
    return reply(`[${r.storeName}] 매장이 연결됐어요.\n이제 이 채팅에서 오늘 판매·사용 대기·정산을 보고, 이용권 사용 처리와 판매 중지를 할 수 있어요.\n\n${helpText(r.storeName)}`)
  }
  if (r.reason === 'rate_limited') return reply('연결 시도가 너무 많아요. 1시간 뒤에 다시 시도해 주세요.', ['도움말'])
  if (r.reason === 'no_seat') return reply('이 매장을 관리할 권한이 없어요. 셀러 대시보드에서 매장을 확인해 주세요.', ['도움말'])
  return reply('코드가 맞지 않거나 시간이 지났어요. 셀러 대시보드에서 새 코드를 받아 10분 안에 보내 주세요.', ['도움말'])
}

/**
 * 연결된 사람의 명령 처리. 반환 null = 매장 명령이 아님(호출부가 FAQ → 도움말 순으로 답한다).
 * 매 호출마다 좌석을 **다시** 확인한다 — 권한이 없어졌으면 연결을 끊고 그렇게 말한다.
 */
export async function runStoreCommand(
  ctx: BotCtx, botUserKey: string, cmd: ParsedCommand,
): Promise<BotReply | { revoked: true } | { none: true }> {
  const looked = await resolveLinkedSeat(ctx.DB, botUserKey)
  if (looked.kind === 'none') return { none: true }
  if (looked.kind === 'revoked') return { revoked: true }
  const seat: LinkedSeat = looked.seat

  switch (cmd.kind) {
    case 'link': return runLinkCommand(ctx.DB, botUserKey, cmd.code)
    case 'unlink': {
      await unlinkBot(ctx.DB, botUserKey)
      return reply(`[${seat.storeName}] 연결을 끊었어요. 다시 쓰려면 셀러 대시보드에서 새 코드를 받아 주세요.`, [])
    }
    case 'help': return reply(helpText(seat.storeName))
    case 'today': {
      const t = await storeTodaySales(ctx.DB, seat.sellerId)
      return reply(`[${seat.storeName}] 오늘 판매\n${t.n}건 · ${won(t.rev)}`)
    }
    case 'waiting': {
      const n = await storeWaitingVouchers(ctx.DB, seat.sellerId)
      return reply(`[${seat.storeName}] 사용 대기 이용권\n${n}장`)
    }
    case 'payout': {
      const amt = await getPayablePending(ctx.DB, sellerLedgerAccount(seat.sellerId))
      return reply(`[${seat.storeName}] 정산 예정 금액\n${won(Math.max(0, amt))}\n\n자세한 내역은 셀러 대시보드 [정산]에서 볼 수 있어요.`)
    }
    case 'list': {
      const items = await storeVoucherProducts(ctx.DB, seat.sellerId)
      await saveLastList(ctx.DB, botUserKey, items.map((p) => p.id))
      if (items.length === 0) return reply(`[${seat.storeName}] 등록된 이용권이 없어요.`)
      const lines = items.map((p, i) => `${i + 1}. ${p.name}${p.is_active ? '' : ' (판매 중지)'}`)
      return reply(`[${seat.storeName}] 이용권\n${lines.join('\n')}\n\n판매를 멈추려면 "중지 번호", 다시 열려면 "재개 번호"를 보내 주세요.`)
    }
    case 'toggle': {
      const productId = seat.lastList[cmd.index - 1]
      if (!productId) return reply('먼저 "이용권" 을 보내 목록 번호를 확인해 주세요.')
      const p = await ctx.DB.prepare(
        "SELECT id, name, COALESCE(is_active, 1) AS is_active FROM products WHERE id = ? AND seller_id = ? AND COALESCE(status, '') != 'DELETED' LIMIT 1"
      ).bind(productId, seat.sellerId).first<{ id: number; name: string; is_active: number }>()
      if (!p) return reply('그 이용권을 찾을 수 없어요. "이용권" 으로 목록을 다시 확인해 주세요.')
      if (!!p.is_active === cmd.active) {
        return reply(`${p.name} 은(는) 이미 ${cmd.active ? '판매 중' : '판매 중지'}이에요.`)
      }
      await setPending(ctx.DB, botUserKey, seat.sellerId, { action: 'toggle', productId: p.id, active: cmd.active })
      return reply(`${p.name}\n판매를 ${cmd.active ? '다시 열까요' : '멈출까요'}?`, CONFIRM_QUICK)
    }
    case 'redeem': {
      if (!SELLER_REDEEM_CODE_RE.test(cmd.code)) return reply('이용권 코드를 다시 확인해 주세요.')
      const chk = await checkVoucherForStore(ctx.DB, cmd.code, seat.sellerId)
      if (!chk.ok) {
        const msg = chk.status === 403 ? '우리 매장의 이용권이 아니에요.'
          : chk.status === 404 ? '이용권을 찾을 수 없어요. 코드를 다시 확인해 주세요.'
            : chk.error.includes('이미 사용') ? '이미 사용된 이용권이에요.'
              : chk.error.includes('만료') ? '기간이 지난 이용권이에요.'
                : chk.error.includes('환불') ? '환불된 이용권이에요.' : '이 이용권은 처리할 수 없어요.'
        return reply(msg)
      }
      await setPending(ctx.DB, botUserKey, seat.sellerId, { action: 'redeem', code: cmd.code })
      return reply(`${chk.voucher.product_name}\n코드 ${cmd.code}\n사용 처리할까요?`, CONFIRM_QUICK)
    }
    case 'no': {
      const had = await clearPending(ctx.DB, botUserKey)
      return reply(had ? '취소했어요.' : '확인할 작업이 없어요.')
    }
    case 'yes': {
      const p = await takePending(ctx.DB, botUserKey, seat.sellerId)
      if (!p) return reply('확인할 작업이 없거나 시간이 지났어요. 다시 요청해 주세요.')
      if (p.action === 'redeem') {
        const done = await redeemVoucherForStore(ctx.DB, {
          code: p.code, actorSellerId: seat.sellerId, path: 'kakao_bot', waitUntil: ctx.defer,
        })
        if (!done.ok) return reply(done.status === 409 ? '방금 다른 곳에서 처리됐어요. 다시 확인해 주세요.' : '사용 처리하지 못했어요. 코드를 다시 확인해 주세요.')
        return reply(`사용 처리했어요: ${done.voucher.product_name}`)
      }
      const t = await setStoreProductActive(ctx, seat.sellerId, p.productId, p.active)
      if (!t.ok) return reply('바꾸지 못했어요. "이용권" 으로 목록을 다시 확인해 주세요.')
      return reply(`${t.name}\n${p.active ? '판매를 다시 열었어요.' : '판매를 멈췄어요.'}`)
    }
  }
}
