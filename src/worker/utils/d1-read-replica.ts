/**
 * 🌏 D1 읽기 복제본 — 손님 공개 읽기 전용 (2026-10-15 대표 결재 *"응 켜고 코드 작업 진행해줘"*,
 *   결재 파일 `docs/decisions/2026-10-15-d1-read-replication.md`).
 *
 * 왜: 유어딜 DB 는 미국 동부(ENAM) 한 곳이다. 한국 콜로에서 캐시가 빈 요청은 질의마다 태평양을 왕복한다.
 *   읽기 복제를 켜면 Cloudflare 가 가까운 지역에 읽기 전용 사본을 두는데, **세션 API 로 물어야만** 사본으로 간다
 *   (`env.DB` 를 그대로 쓰면 켜도 원본으로 간다). 이 파일이 그 세션을 여는 단 한 곳이다.
 *
 * 🔒 쓰는 곳은 **로그인 없이 보는 목록·편성 읽기**뿐이다. 결제·정산·환불·재고·딜·주문·어드민·셀러는
 *   절대 이 함수를 쓰지 않는다 — 사본은 원본보다 잠깐 늦을 수 있어서, 방금 쓴 값을 바로 읽어야 하는
 *   경로에서 옛 값을 보게 된다. 가드 `d1-read-replica-2026-10-15.test.ts` 가 허용 파일 목록을 고정한다.
 *
 * 세션 안의 쓰기(DDL·시드)는 Cloudflare 가 알아서 원본으로 보낸다 — 같은 세션 안에서는 방금 쓴 값을 읽는다
 *   (순차 일관성). 복제가 **꺼져 있으면** 세션도 원본으로 간다 = 지금과 같다(코드를 먼저 배포해도 무해).
 */

/** 세션이 원본을 기억하게 붙이는 표식 — isolate 메모(WeakSet)가 요청마다 새 세션을 "처음 보는 DB" 로 오해하지 않게. */
const PRIMARY = Symbol.for('ur.d1.primary')

type WithSession = D1Database & { withSession?: (constraint?: string) => unknown }

/**
 * 공개 읽기용 DB. 세션 API 가 없으면(로컬·시험·옛 런타임) 원본을 그대로 돌려준다.
 * 'first-unconstrained' — 첫 질의를 가장 가까운 사본이 받는다(원본을 거치지 않는다).
 */
export function publicReadDb(db: D1Database): D1Database {
  const fn = (db as WithSession).withSession
  if (typeof fn !== 'function') return db
  try {
    const s = fn.call(db, 'first-unconstrained') as D1Database & { [PRIMARY]?: D1Database }
    if (!s || typeof (s as { prepare?: unknown }).prepare !== 'function') return db
    s[PRIMARY] = (db as D1Database & { [PRIMARY]?: D1Database })[PRIMARY] ?? db
    return s
  } catch {
    return db
  }
}

/**
 * isolate 메모의 키 — 세션이면 그 원본, 아니면 자기 자신.
 * 🩸 이걸 안 쓰면 요청마다 새 세션이 생겨 "테이블 확인 완료" 같은 메모가 매번 빗나가고, 아끼려던 왕복을
 *   DDL 로 다시 낸다(이 레포의 2% 프로파일러 래퍼가 같은 모양이다).
 */
export function dbKey(db: D1Database): D1Database {
  return (db as D1Database & { [PRIMARY]?: D1Database })[PRIMARY] ?? db
}
