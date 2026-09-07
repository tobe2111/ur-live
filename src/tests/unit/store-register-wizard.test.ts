/**
 * 🏪 매장 등록 문 — 위저드 + 막다른 길 (2026-09-07)
 *
 * 이 파일이 지키는 것은 **사장님이 유어딜에 들어오는 유일한 문**이다. 여기서 막히면 매장이 안 늘고,
 * 더 나쁜 건 **아무 에러도 안 난다는 것** — 사장님은 조용히 포기하고 우리는 영영 모른다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 등록이 성공하는지(서버 계약) · 지도 SDK 동작 ·
 *   단계 전환이 눈에 어떻게 보이는지. 그건 staging 에서 한 번 등록해 봐야 안다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const MODAL = 'src/components/seller/StoreRegisterModal.tsx'
const CLAIM = 'src/pages/StoreClaimPage.tsx'
const modal = readFileSync(MODAL, 'utf8')
const claim = readFileSync(CLAIM, 'utf8')

/** 주석을 먼저 통째로 지운다 — 블록 주석을 줄 단위로 지우면 가운데 줄이 남아 헛도는 판정이 된다
 *  (이 레포가 세 번 밟은 함정). */
function strip(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}
const M = strip(modal)
const C = strip(claim)

describe('🕳️ 다크모드에서 입력 글자가 안 보이는 구멍', () => {
  it('/store/new 루트에 force-light-theme 이 있다', () => {
    // 없으면 전역 `.dark input`(특이도 0,5,1)이 모달의 text-gray-900(0,1,0)을 이겨
    // 흰 배경 위 흰 글자가 된다 — 브라우저 실측 1.00:1. 사장님이 자기가 친 사업자번호를 못 본다.
    expect(C, `${CLAIM}: 대시보드 밖 라이트 페이지는 force-light-theme 이 필요하다(index.css 가 명시한 규칙)`)
      .toMatch(/className="[^"]*\bforce-light-theme\b/)
  })

  it('그 자리에 dark: 배경을 도로 붙이지 않는다', () => {
    // `force-light-theme` 과 `dark:bg-…` 를 같이 두면 컨테이너만 어두워지고 안쪽 모달은 흰색이라
    // 경계가 어긋난다. 라이트 고정이면 끝까지 라이트다.
    const root = C.match(/<div className="[^"]*force-light-theme[^"]*"/)?.[0] ?? ''
    expect(root, `${CLAIM}: 라이트 고정 컨테이너에 dark: 배경이 섞였다`).not.toMatch(/dark:bg-/)
  })
})

describe('🪜 한 화면 한 질문 (당근 원칙 ①)', () => {
  it('질문이 단계 배열로 정의돼 있다', () => {
    expect(M, `${MODAL}: STEPS 가 사라지면 네 질문이 다시 한 화면에 쌓인다`).toMatch(/const STEPS\s*=/)
  })

  it('현재 단계를 state 로 들고 진행바 폭에 쓴다', () => {
    expect(M).toMatch(/useState\(initialPlace \? 1 : 0\)/)
    // 진행바가 step 에 안 묶여 있으면 "장식용 바"가 된다 — 몇 개 남았는지를 못 알려준다.
    expect(M, `${MODAL}: 진행바가 step 에서 계산되지 않는다`).toMatch(/width:\s*`\$\{\(\(step \+ 1\) \/ STEPS\.length\)/)
  })

  it('프리필로 열리면 이미 답한 질문을 다시 묻지 않는다', () => {
    // 이용권 위저드가 지도로 찾은 매장을 들고 오는 다리(StoreStep) — 여기서 1단계를 또 물으면 퇴보다.
    expect(M).toMatch(/initialPlace \? 1 : 0/)
  })
})

describe('🔓 버튼이 왜 안 눌리는지 말해 준다', () => {
  it('blockReason 이 단계별 이유를 돌려준다', () => {
    expect(M, `${MODAL}: 이유 없는 회색 버튼은 이 레포가 토스에서 한 번 고친 버그 클래스다`)
      .toMatch(/function blockReason\(/)
  })

  it('그 이유를 버튼 아래에 실제로 렌더한다', () => {
    // 계산만 하고 안 그리면 아무 의미가 없다 — 렌더 조건으로 앵커한다.
    expect(M, `${MODAL}: blockReason 을 계산만 하고 화면에 안 띄운다`)
      .toMatch(/\{blocked && <p/)
  })
})

describe('🕳️ 이미 등록된 매장 = 막다른 길', () => {
  it('409 STORE_EXISTS 를 잡는다', () => {
    expect(M, `${MODAL}: 중복이면 alert 하나 띄우고 끝나던 막다른 길로 돌아갔다`)
      .toMatch(/status === 409[\s\S]{0,80}STORE_EXISTS/)
  })

  it('그 분기가 안내 화면을 띄운다', () => {
    expect(M).toMatch(/setTaken\(\{\s*sellerId/)
    expect(M, `${MODAL}: taken 상태를 만들어 놓고 화면을 안 그리면 종전과 똑같다`).toMatch(/if \(taken\)/)
  })

  it('소유권을 자동으로 넘기지 않는다 — 좌석 토큰으로만 확인한다', () => {
    // 🔐 매장 귀속은 정산이 따라가는 머니 경로다. 여기서 권한을 새로 만들면 안 되고,
    //   이미 있는 `canOperateStore`(좌석 토큰의 유일한 방어선)를 시험지로 쓴다.
    expect(M).toMatch(/enterStoreSeat\(taken\.sellerId\)/)
    expect(M, `${MODAL}: 소유권 이전 API 를 새로 부르고 있다 — 머니 경로라 별도 판단이 필요하다`)
      .not.toMatch(/transfer-owner|claim-owner|owner_verified/)
  })

  it('누구 것인지 단정하지 않는다', () => {
    // 내 매장이어도 승인 대기(pending)면 좌석 토큰이 403 이라 이 화면으로 온다.
    // "다른 사람이 등록했습니다" 라고 말하면 그 사장님에게 거짓말이 된다.
    expect(M, `${MODAL}: 소유자를 단정하는 문구가 생겼다`).not.toMatch(/다른 (사람|분)이 등록(했|한)/)
  })
})

describe('🚧 막다른 길을 없애면서 새 막다른 길을 놓지 않는다', () => {
  it('셀러 좌석이 없으면 /seller/stores 를 권하지 않는다', () => {
    // `/seller/stores` 는 requireSeller 다(seller.routes.tsx:222). 푸터로 들어온 소비자에게
    // 이 버튼을 보여 주면 셀러 로그인 화면으로 튕긴다 — 막다른 길을 없애러 와서 하나 더 놓는 셈.
    expect(M, `${MODAL}: 좌석 없는 사람에게 requireSeller 경로를 권한다`)
      .toMatch(/\{hasSellerSeat && \([\s\S]{0,200}\/seller\/stores/)
  })

  it('원래 갖고 있던 매장이면 "등록됐어요" 라고 말하지 않는다', () => {
    // 아무것도 등록되지 않았는데 등록됐다고 하면 그 자체가 거짓말이고,
    // 좌석은 이미 tryEnterExisting 이 잡아 놨으므로 다시 잡을 필요도 없다.
    expect(M).toMatch(/onDone\(taken\.sellerId,\s*\{\s*existing:\s*true\s*\}\)/)
    expect(C, `${CLAIM}: existing 분기가 사라지면 "매장이 등록됐어요" 가 그대로 뜬다`)
      .toMatch(/if \(!opts\?\.existing\)/)
  })
})

describe('🧹 네이티브 alert 을 쓰지 않는다', () => {
  it('alert( 호출이 없다', () => {
    // alert 은 스레드를 막고, 이 레포의 나머지는 전부 toast 다.
    expect(M, `${MODAL}: alert 이 되살아났다`).not.toMatch(/(^|[^.\w])alert\s*\(/)
  })
})

describe('🏷️ 필수/선택을 제목에 적는다 (당근 원칙 ②)', () => {
  it('사업자번호가 선택이라고 화면에 쓰여 있다', () => {
    // 서버는 `business_number: … || undefined` 로 받는다(선택). 화면이 그걸 안 말하면
    // 사장님은 "안 적으면 못 넘어가나" 를 고민한다.
    expect(M).toMatch(/사업자번호[\s\S]{0,120}\(선택/)
  })

  it('제출 조건에 사업자번호가 들어가지 않는다', () => {
    // 화면은 선택이라 적어 놓고 실제로는 막으면 그게 더 나쁜 거짓말이다.
    const gate = M.match(/disabled=\{!!blocked[^}]*\}/)?.[0] ?? ''
    expect(gate, `${MODAL}: 제출 게이트가 bno 를 요구한다 — 화면 문구와 어긋난다`).not.toMatch(/bno/)
  })
})
