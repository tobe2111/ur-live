/**
 * 🧬 주입 — **교환권 상세의 서버 첫 화면** (2026-10-08 대표 "모두 다 하자")
 *
 * 이 수리가 되돌아가는 길은 둘 다 **조용하다**: 배선이 끊기면 그냥 로더가 다시 보일 뿐이고,
 * 값이 갈리면 사진을 한 번 더 받거나 마운트 때 한 줄이 튈 뿐이다. 에러도 빌드 실패도 없다.
 */
const BODY = 'src/worker/utils/voucher-detail-ssr-body.ts'
const WORKER = 'src/worker/index.ts'
const T = 'src/tests/unit/voucher-detail-ssr-first-screen-2026-10-08.test.ts'

export default [
  {
    name: '🎁 교환권 상세 서버 첫 화면 — 워커 분기가 안 탄다',
    file: WORKER,
    find: "ssrSlot === 'DETAIL' && ssrPayload && url.pathname.startsWith('/vouchers/')",
    replace: "ssrSlot === 'DETAIL' && ssrPayload && url.pathname.startsWith('/__never__/')",
    test: T,
    why:
      '분기가 안 타면 catch-all 로더로 떨어진다 = 2026-10-08 이전 상태. 화면은 멀쩡하고 ' +
      '로딩 장면만 돌아오므로 **아무도 신고하지 않는다** — 그래서 기계가 지켜야 한다.',
  },
  {
    name: '🎁 교환권 상세 서버 첫 화면 — 폴백이 사라져 빈 화면이 될 수 있다',
    file: WORKER,
    find: 'voucherFirst || urdealLoaderHtml',
    replace: 'voucherFirst',
    test: T,
    why:
      '시드 파싱 실패·사진 없음이면 빌더가 `\'\'` 를 돌려준다. 그때 `||` 가 없으면 `#root` 가 ' +
      '**통째로 비어** 흰 화면이 된다(로더조차 없다). 폴백은 이 설계의 전제다.',
  },
  {
    name: '🎁 교환권 상세 사진 폭이 preload 와 갈린다 (같은 사진을 두 번 받는다)',
    file: BODY,
    find: 'export const VOUCHER_PHOTO_WIDTH = 800',
    replace: 'export const VOUCHER_PHOTO_WIDTH = 640',
    test: T,
    why:
      '워커는 이미 `width: 800` 으로 사진을 preload 한다. 첫 화면이 다른 폭을 그리면 그 preload 가 ' +
      '**통째로 버려지고** 같은 사진을 다시 받는다 — 2026-09-02 에 이용권 상세에서 111KB 를 그렇게 버렸다.',
  },
  {
    name: '🎁 교환권 상세 제목 클래스가 페이지와 갈린다 (마운트 때 제목이 튄다)',
    file: BODY,
    find: "h1: 'mt-[7px] text-[24px]",
    replace: "h1: 'mt-2 text-[24px]",
    test: T,
    why:
      'React 는 `createRoot`(비-hydrate)라 마운트 때 `#root` 를 갈아엎는다. 서버가 그린 제목의 ' +
      '위 여백이 1px 라도 다르면 그 자리가 튄다 — 대표가 금지한 "로딩 화면 2~3개" 로 되돌아가는 길.',
  },
  {
    name: '🎁 교환권 상세 — 경계를 넘어 가격까지 그린다',
    file: BODY,
    find: '`<h1 class="${VOUCHER_FS_CLASS.h1}">${escText(d.name)}</h1>` +',
    replace:
      '`<h1 class="${VOUCHER_FS_CLASS.h1}">${escText(d.name)}</h1>` +\n' +
      '        `<div>${Number((d as { price?: number }).price || 0).toLocaleString()}</div>` +',
    test: T,
    why:
      '가격 아래는 로그인 상태(잔액·교환 후 잔액)에 따라 달라진다. 서버가 그 위를 그리면 ' +
      '마운트 때 **값이 바뀌는** 자리가 생긴다. 경계는 "서버가 확실히 아는 마지막 것" = h1 이다.',
  },
  {
    name: '🎁 교환권 상세 분류 칩 라벨이 페이지 규칙과 갈린다',
    file: BODY,
    find: "const label = d.deal_only === 1 ? '교환권' : getVoucherShortLabel(d.category)",
    replace: 'const label = getVoucherShortLabel(d.category)',
    test: T,
    why:
      '페이지는 `deal_only === 1` 이면 "교환권" 이라고 적는다. 서버가 "피자" 라고 적으면 ' +
      '마운트 때 칩 글자가 바뀌고, 글자 수가 달라지면 그 줄이 움직인다.',
  },
]
