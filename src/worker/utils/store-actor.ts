/**
 * 🏪 매장 대시보드의 **행위자 판별** — 주인(owner)인가, 위임받은 운영자(operator)인가.
 *
 * ## 왜 필요한가 (2026-09-04 대표 확정)
 * 셀러 토큰은 `seller_id` 하나로 그 매장의 **전부**를 연다. 그래서 남의 매장을 대신 운영하는
 * 중개사가 사장님의 **정산계좌·사업자정보까지** 보고 고칠 수 있었다. 대표 확정:
 * *"주인만, 단 마스킹해서 보여줌"* — 운영자는 **읽기도 가려서**, **수정은 금지**.
 *
 * ## 판별 근거 = 토큰의 `store_role` (2026-09-09 수리)
 * `POST /api/seller/stores/:sellerId/token` 이 `canOperateStore` 의 **역할을 그대로 실어 준다**
 * (`'owner'` | `'operator'`). 소유자면 `store_role === 'owner'`.
 *
 * 🩸 **종전엔 `operator_user_id` 유무로 판정했고 그게 틀렸다.** `/store/new` 는 설계상
 *   `sellers.linked_user_id` 를 비워 두므로(UNIQUE 1인1행) **직접 등록한 진짜 사장님도
 *   `source:'grant'`** 로 들어와 그 claim 이 붙는다 ⇒ `role:'owner'` 인데 운영자로 오판.
 *   그러면 정산 계좌 변경이 403 이라 **그 매장은 돈을 받을 방법이 없다.**
 *
 * ⚠️ `operator_user_id` 는 소유 판정이 아니라 **시트 분리**용이다(운영자가 들어와도 사장님이
 *   안 튕기게). 그래서 지금도 그대로 싣고, 여기서는 *역할*로만 소유를 가른다.
 *
 * 🔁 **하위호환**: 이미 발급된 토큰(30일)엔 `store_role` 이 없다 → 그때는 종전 규칙
 *   (`operator_user_id === null`)으로 판정한다. 새 claim 이 없다고 권한이 갑자기 바뀌면 안 된다.
 *
 * ⚠️ **`resolveActorUserId` + `isStoreOwner` 로 판정하지 말 것.** 그 헬퍼는 소비자 세션이 없으면
 * `sellers.linked_user_id` 로 폴백하는데, 그 값은 *호출자*가 아니라 **매장 주인**의 id 다.
 * 세션 쿠키가 없는 요청(앱 내 XHR·다른 브라우저 컨텍스트)에서 운영자가 **주인으로 오판**된다.
 * 여기서는 토큰 자신이 들고 있는 사실만 본다 — 폴백도, 추가 DB 조회도 없다.
 *
 * ## 이 모듈이 못 막는 것
 * - 소유자가 자기 계정을 남에게 빌려주는 것(계정 공유). 그건 권한 모델 밖이다.
 * - 이미 발급된 운영자 토큰의 즉시 무효화(회수는 다음 토큰 발급부터 적용).
 */
import { verify } from 'hono/jwt'

export interface StoreActor {
  /** 토큰이 가리키는 매장. 없으면 셀러 인증 실패. */
  sellerId: number | null
  /** 위임으로 들어온 경우 그 사람의 user id. 소유자면 null. */
  operatorUserId: number | null
  /** 소유자(또는 매장 자기 계정)인가 — 민감 정보 게이트의 기준. */
  isOwner: boolean
}

export async function resolveStoreActor(
  authorization: string | undefined,
  jwtSecret: string,
): Promise<StoreActor> {
  const none: StoreActor = { sellerId: null, operatorUserId: null, isOwner: false }
  if (!authorization || !authorization.startsWith('Bearer ')) return none
  try {
    const p = await verify(authorization.substring(7), jwtSecret, 'HS256') as {
      type?: string; seller_id?: number; operator_user_id?: unknown; store_role?: unknown
    }
    if (p.type !== 'seller') return none
    const sellerId = Number(p.seller_id) || null
    if (!sellerId) return none
    const opRaw = Number(p.operator_user_id)
    const operatorUserId = Number.isFinite(opRaw) && opRaw > 0 ? opRaw : null
    // 역할이 실려 있으면 그것이 정답. 없으면(옛 토큰) 종전 규칙으로 판정한다.
    const role = typeof p.store_role === 'string' ? p.store_role : null
    const isOwner = role ? role === 'owner' : operatorUserId === null
    return { sellerId, operatorUserId, isOwner }
  } catch {
    return none
  }
}

/** 운영자에게 보여줄 사업자등록번호 — 끝 4자리만(`***-**-*1234`). */
export function maskBusinessNumber(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null
  const tail = s.replace(/\D/g, '').slice(-4)
  if (!tail) return '***-**-*****'
  return `***-**-*${tail}`
}

/** 운영자에게 보여줄 이름/상호 — 첫 글자만(`정**`). 없으면 null. */
export function maskName(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null
  if (s.length <= 1) return s
  return s[0] + '*'.repeat(Math.min(s.length - 1, 4))
}

/** 운영자가 수정하려 할 때 돌려줄 표준 사유. */
export const OWNER_ONLY_MESSAGE =
  '매장 소유자만 변경할 수 있습니다. 사장님께 요청해 주세요.'
