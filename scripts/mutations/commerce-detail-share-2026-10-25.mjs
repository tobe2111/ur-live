/**
 * 🍽️ 통신판매 수집 — 서비스별 레코드 몫 (2026-10-25) · 주입 매니페스트.
 *
 * 이 조가 막는 것은 **뒤에 도는 서비스가 전역 상한에 굶는 것**이다(라이브: `detail` 이 한 페이지도
 * 못 받아 취급품목을 여태 한 번도 못 봤고, 그래서 업종이 발송 가능 리드의 92%에서 `통신판매` 였다).
 * 그리고 반대 방향 — 몫을 늘리려다 **CPU 천장을 깨는 것** — 도 함께 막는다.
 *
 * 가드: src/tests/unit/commerce-detail-share-2026-10-25.test.ts
 */
const TEST = 'src/tests/unit/commerce-detail-share-2026-10-25.test.ts'
const SRC = 'src/features/marketing/api/commerce-notify-collect.ts'

export default [
  {
    name: '통신판매몫 🍽️ 몫 검사가 사라진다(status 가 상한을 다 먹고 detail 이 또 굶는다)',
    file: SRC,
    find: '      if (foundThisService >= recordsPerService) break',
    replace: '',
    test: TEST,
    why: '수리 전 라이브 그대로다 — `by_service` 에 `status` 만 · `ads_commerce_cursor_detail` 이 47 에서 멈춘 채. 취급품목은 `detail` 에만 오므로 그 값을 영영 못 보고, 업종 **93.0%(58,389/62,757 — 2026-10-25 재측정)** 가 `통신판매` 로 남는다. 에러는 0건이고 수집량도 그대로라 **아무 신호가 없다**.',
  },
  {
    name: '통신판매몫 🔥 전역 상한 검사가 사라진다(몫만 남아 N×(몫+페이지) 로 CPU 사망)',
    file: SRC,
    find: "      if (found >= MAX_RECORDS_PER_RUN) { stoppedBy = 'records'; break }",
    replace: '',
    test: TEST,
    why: '전역 상한이 CPU 천장이다(2026-08 실측: 1,499행 파싱에서 레인이 CPU 한도로 죽었다). 몫만 두면 서비스 수만큼 곱해져 그 천장을 넘는다 — 반대 방향의 회귀이고, 이쪽은 레인이 **통째로 죽는다**.',
  },
  {
    name: '통신판매몫 🧮 몫이 전역 상한에서 파생되지 않는다(상한을 내려도 몫이 안 따라온다)',
    file: SRC,
    find: '  const recordsPerService = Math.max(1, Math.floor(MAX_RECORDS_PER_RUN / services.length))',
    replace: '  const recordsPerService = 350',
    test: TEST,
    why: '상수를 손으로 베끼면 두 벌이 갈린다 — `MAX_RECORDS_PER_RUN` 을 CPU 때문에 내리는 날 몫은 그대로라 총 파싱량이 상한을 넘는다(그리고 그게 바로 상한을 내린 이유다).',
  },
  {
    name: '통신판매몫 🏷️ 몫 소진이 stopped_by 를 세운다(멈춘 적 없는 회차를 멈췄다고 기록)',
    file: SRC,
    find: '      if (foundThisService >= recordsPerService) break',
    replace: "      if (foundThisService >= recordsPerService) { stoppedBy = 'records'; break }",
    test: TEST,
    why: '몫 소진은 **정상 종료**다(회차가 멈춘 게 아니라 다음 서비스에 넘긴 것). 여기서 `stoppedBy` 를 세우면 멈춘 적 없는 회차가 멈췄다고 기록되고, 특히 `\'deadline\'` 을 세우면 바깥 루프의 `if (stoppedBy === \'deadline\') break` 가 끊겨 **다음 서비스가 다시 굶는다** — 이 수리가 없앤 그 결함이다. ⚠️ `stopped_by` 자체는 E4 신호가 **아니다**(2026-10-25 트레이스 정정): `detail` 이 페이지를 받으면 `found` 가 1,000 이 되고 `perService ≥ 2` 라 다음 반복의 전역 상한 판정이 반드시 돌아 `records` 로 남는다 — 그게 옳다(설계된 CPU 천장). E4 는 `by_service` 의 `detail` 키와 커서 전진 둘뿐이다.',
  },
  {
    name: '통신판매몫 🔢 서비스별 누적이 안 늘어난다(몫 검사가 영원히 거짓)',
    file: SRC,
    find: '      found += leads.length\n      foundThisService += leads.length',
    replace: '      found += leads.length',
    test: TEST,
    why: '변수는 있는데 안 늘면 `foundThisService` 는 늘 0 이라 몫 검사가 통과만 한다 — 수리가 **배선만 남고 행동은 수리 전 그대로**다. 2026-10-25 조사에서 "소스에 있다 ≠ 동작한다" 를 다시 확인한 클래스다.',
  },
  {
    // ⚠️ 한 번의 치환으로 **컴파일되는** 회귀를 만든다 — 선언을 지우는 주입은 타입 에러로 빨간불이
    //   되어 *가드가 잡았는지*를 말해 주지 않는다(러너는 `find`/`replace` 한 쌍만 적용한다).
    name: '통신판매몫 🧺 서비스별 누적이 전역 누적을 물려받는다(= 수리 전과 같은 결과)',
    file: SRC,
    find: '    let foundThisService = 0',
    replace: '    let foundThisService = found',
    test: TEST,
    why: '서비스 루프 **밖**에서 한 번만 초기화하면 전역 `found` 와 똑같아진다 — 앞 서비스가 몫을 다 쓰면 뒤 서비스는 자기 차례에 이미 초과 상태다. 즉 변수를 늘려 놓고 **수리 전과 같은 결과**가 된다.',
  },
  {
    name: '통신판매몫 🔭 서비스 목록에서 detail 이 빠진다(취급품목 출처가 사라진다)',
    file: SRC,
    find: "  { name: 'detail', label: '등록상세', base: 'https://apis.data.go.kr/1130000/MllBsDtl_3Service', op: 'getMllBsInfoDetail_3' },",
    replace: '',
    test: TEST,
    why: '취급품목(`trtmntPrdlstNm`)은 등록상세에만 온다 — 목록에서 빠지면 탐침도 업종 분류도 근거를 잃는다. "굶는 것"을 고치는 PR 에서 **굶던 서비스 자체를 지우는** 방향을 막는다.',
  },
]
