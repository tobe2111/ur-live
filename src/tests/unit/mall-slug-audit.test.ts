/**
 * 🔴 양방향 가드의 **런타임 절반** 〔세션 ③-a, 대표 경계조건 ② 2026-07-29〕
 *
 * *"가드는 양방향이어야 합니다. **라우트 테이블 ∩ 몰 슬러그 = ∅** 을 검사하는 래칫으로 가면
 * 양방향이 한 번에 잡힙니다."*
 *
 * ## 왜 CI 만으로는 반쪽인가
 * CI 가 볼 수 있는 절반은 `라우트 ⊆ 예약어` 뿐이다(`mall-branding.test`). 반대 방향 —
 * **이미 존재하는 몰 슬러그가 라우트를 먹고 있는가** — 는 **라이브 DB** 에 있고 CI 는 그걸 못 읽는다.
 * 그 절반이 `auditMallSlugs` + 어드민 `GET /api/admin/wholesale-malls/slug-conflicts` 다.
 *
 * ## ⚠️ 쓰기 차단만으로 끝나지 않는 이유
 * `rejectReservedSlug`(생성/수정 차단)는 **오늘 이후** 행에만 걸린다. 가드 이전에 만들어진 행은
 * 그대로 남고, **조회하지 않으면 영영 모른다.** 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 클래스다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 라우트가 아닌 충돌(정적 파일 경로 · 워커가 가로채는 prefix) — 슬러그 발급 시 실요청 1회로 확인
 *   - 어드민이 진단을 **안 보는 것** — 가드는 값을 만들 뿐, 읽는 건 사람이다
 */
import { describe, it, expect } from 'vitest'
import { auditMallSlugs, validateMallSlug, RESERVED_SLUGS } from '@/shared/mall/slug'

describe('🔴 기존 슬러그 ∩ 예약어 = ∅ (런타임 절반)', () => {
  it('예약어를 먹고 있는 몰을 찾아낸다 — 그 라우트가 몰에 가려진다', () => {
    const a = auditMallSlugs([
      { id: 1, slug: 'default', name: '유통스타트' },
      { id: 7, slug: 'products', name: '나쁜몰' },   // ← /products 를 가린다
    ])
    expect(a.ok).toBe(false)
    expect(a.conflicts.map((c) => c.slug)).toEqual(['products'])
    expect(a.checked).toBe(2)
  })

  it('충돌이 없으면 ok — 현재 시드(default·medi)는 통과해야 한다', () => {
    // 이게 빨강이면 **라이브가 이미 깨져 있다**는 뜻이라 배포 전에 알아야 한다.
    const a = auditMallSlugs([
      { id: 1, slug: 'default', name: '유통스타트' },
      { id: 2, slug: 'medi', name: '메디스타트' },
    ])
    expect(a.ok).toBe(true)
    expect(a.conflicts).toEqual([])
  })

  it('대소문자·공백이 섞여도 잡는다 — DB 값이 정규화돼 있다고 믿지 않는다', () => {
    const a = auditMallSlugs([{ id: 9, slug: '  ADMIN  ', name: 'x' }])
    expect(a.ok).toBe(false)
    expect(a.conflicts[0].slug).toBe('admin')
  })

  it('비활성 몰도 보고한다 — 되살리는 순간 라우트가 죽는다', () => {
    const a = auditMallSlugs([{ id: 9, slug: 'seller', name: 'x', active: 0 }])
    expect(a.ok).toBe(false)
    expect(a.conflicts[0].active).toBe(false)
  })

  it('빈 슬러그는 건너뛴다 — 경로로 해석될 일이 없다', () => {
    const a = auditMallSlugs([{ id: 9, slug: '', name: 'x' }, { id: 10, slug: '   ', name: 'y' }])
    expect(a.ok).toBe(true)
    expect(a.conflicts).toEqual([])
  })

  it('행이 0개면 ok — 단 checked 로 "안 본 것"과 구별된다', () => {
    // 측정 대상 0건을 통과로 읽으면 가드가 헛도는 클래스(CLAUDE.md 가드 레지스트리 참조).
    // 여기선 호출부가 `checked` 를 보고 판단할 수 있게 값을 노출한다.
    const a = auditMallSlugs([])
    expect(a.ok).toBe(true)
    expect(a.checked).toBe(0)
  })
})

describe('🟡 도달 불가 슬러그 — 만들 수는 있는데 안 열리는 몰', () => {
  it('3자 미만은 리졸버가 후보로도 안 올린다', () => {
    // `firstPathSegment` 가 `/^[a-z0-9-]{3,30}$/` 로 거른다 ⇒ 경로로 영영 도달 못 한다.
    const a = auditMallSlugs([{ id: 5, slug: 'ab', name: '짧은몰' }])
    expect(a.unreachable.map((u) => u.slug)).toEqual(['ab'])
  })

  it('30자 초과도 도달 불가', () => {
    const a = auditMallSlugs([{ id: 5, slug: 'a'.repeat(31), name: '긴몰' }])
    expect(a.unreachable).toHaveLength(1)
  })

  it('🔴 도달 불가는 `ok` 를 깨지 않는다 — 경고이지 라우트를 죽이지 않는다', () => {
    // 둘을 한 신호로 합치면 "열리지 않는 몰" 때문에 **진짜 충돌 경보가 묻힌다.**
    const a = auditMallSlugs([{ id: 5, slug: 'ab', name: '짧은몰' }])
    expect(a.ok).toBe(true)
    expect(a.conflicts).toEqual([])
  })
})

describe('쓰기 차단(생성·수정)과 같은 규칙을 쓴다', () => {
  it('예약어는 `validateMallSlug` 가 거부한다 — 라우트가 부르는 그 함수', () => {
    for (const s of ['admin', 'products', 'group-buy', 'wholesale']) {
      expect(RESERVED_SLUGS).toContain(s)
      expect(validateMallSlug(s).ok).toBe(false)
    }
  })

  it('3~30자 하한/상한은 취향이 아니라 **리졸버와의 정합**이다', () => {
    // 이 범위 밖을 허용하면 "만들어졌는데 경로로 안 열리는 몰"이 생긴다 — 위 unreachable 과 같은 규칙.
    expect(validateMallSlug('ab').ok).toBe(false)
    expect(validateMallSlug('a'.repeat(31)).ok).toBe(false)
    expect(validateMallSlug('abc').ok).toBe(true)
  })

  it('정상 슬러그는 통과 — 가드가 장사를 막지 않는다', () => {
    for (const s of ['dongne-shop', 'mystore2', 'kim-farm']) {
      expect(validateMallSlug(s).ok).toBe(true)
      expect(auditMallSlugs([{ id: 1, slug: s }]).ok).toBe(true)
    }
  })
})
