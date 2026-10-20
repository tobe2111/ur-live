/**
 * 🧭 형식이 틀린 유어샵 핸들도 404 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/ushop-malformed-handle-404-2026-10-12.test.ts
 *
 * 세 응답이 **각자 다른 코드**를 지켜야 한다: 읽기 404 · 쓰기 400 · 가용성 조회 200.
 * 한쪽으로 몰면 각각 다른 사고가 난다(soft-404 / "저장 실패"를 "없음"이라 말함 / 입력 중 화면이 빨개짐).
 */
const TEST = 'src/tests/unit/ushop-malformed-handle-404-2026-10-12.test.ts'
const CURATOR = 'src/worker/routes/curator.routes.ts'
const META = 'src/worker/utils/surface-ssr-meta.ts'

export default [
  {
    name: '🧭 형식 위반 유어샵이 다시 400 을 줘 soft-404 가 된다',
    file: CURATOR,
    find: "      return c.json({ success: false, error: '큐레이터를 찾을 수 없습니다' }, 404)\n    }\n    const DB = getAuthUserId(c)",
    replace: "      return c.json({ success: false, error: '잘못된 핸들 형식입니다' }, 400)\n    }\n    const DB = getAuthUserId(c)",
    test: TEST,
    why: '워커 술어는 `self-fetch-404` 에만 걸린다 — 400 이면 `/u/my-shop` 이 색인 가능한 유어딜 홈 복제본이 된다.',
  },
  {
    name: '🧭 핸들 변경까지 404 로 몰아 "저장 실패" 를 "없음" 이라 말한다',
    file: CURATOR,
    find: "        code: 'INVALID_FORMAT',\n      }, 400)",
    replace: "        code: 'INVALID_FORMAT',\n      }, 404)",
    test: TEST,
    why: '쓰기 검증의 형식 위반은 진짜 클라이언트 오류다 — 일관성을 이유로 한쪽으로 몰면 안 된다.',
  },
  {
    name: '🧭 가용성 조회가 형식 위반에 오류 코드를 낸다',
    file: CURATOR,
    find: "        message: `${CURATOR_DEFAULTS.HANDLE_MIN_LEN}-${CURATOR_DEFAULTS.HANDLE_MAX_LEN}자, 소문자/숫자/_ 만 가능합니다`,\n      })",
    replace: "        message: `${CURATOR_DEFAULTS.HANDLE_MIN_LEN}-${CURATOR_DEFAULTS.HANDLE_MAX_LEN}자, 소문자/숫자/_ 만 가능합니다`,\n      }, 400)",
    test: TEST,
    why: '"이 핸들 쓸 수 있나" 에 형식 위반은 **정상 답변**이다 — 오류로 만들면 입력 중 화면이 빨개진다.',
  },
  {
    name: '🧭 noindex 술어에 400 을 넣어 살아 있는 엔티티를 색인에서 뺀다',
    file: META,
    find: "  return ENTITY_SLOTS.has(slot) && ssrStatus === 'self-fetch-404'",
    replace: "  return ENTITY_SLOTS.has(slot) && (ssrStatus === 'self-fetch-404' || ssrStatus === 'self-fetch-400')",
    test: TEST,
    why: 'API 를 고치는 대신 술어를 넓히는 것이 더 쉬워 보인다 — 그 길은 일시적 400 을 영구 noindex 로 바꾼다.',
  },
  {
    name: '🧭 noindex 술어에 timeout 을 넣어 콜드 콜로를 없는 것으로 본다',
    file: META,
    find: "  return ENTITY_SLOTS.has(slot) && ssrStatus === 'self-fetch-404'",
    replace: "  return ENTITY_SLOTS.has(slot) && ssrStatus.startsWith('self-fetch-')",
    test: TEST,
    why: '"느리다" 는 "없다" 가 아니다 — 멀쩡한 상품이 색인에서 빠지는 더 큰 사고다(2026-07-29 에 일부러 제외했다).',
  },
]
