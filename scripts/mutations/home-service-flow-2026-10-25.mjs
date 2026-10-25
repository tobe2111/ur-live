/**
 * 🧬 주입 — 생활 견적 오늘의집 흐름 + 사장님 항목 (2026-10-25 대표 "모두 진행해줘")
 */
const T = 'src/tests/unit/home-service-flow-2026-10-25.test.ts'
export default [
  {
    name: '생활흐름 — 사장님 상세 조회가 고르기 전에도 상세 주소를 읽는다',
    file: 'src/features/home-service/api/home-service-pro.routes.ts',
    find: "CASE WHEN q.status = 'chosen' THEN r.private_details END AS private_details",
    replace: 'r.private_details AS private_details',
    test: T,
    why: '견적만 보낸 업체가 손님 집 동·호수까지 본다 — 손님이 고르기 전엔 동까지만이라는 약속이 깨진다.',
  },
  {
    name: '생활흐름 — 상세 주소가 요청서(사장님 공개분)에 섞인다',
    file: 'src/shared/home-service.ts',
    find: '        privateDetails[f.key] = full\n',
    replace: '        privateDetails[f.key] = full\n        details[f.key] = full\n',
    test: T,
    why: '알림톡·요청함에 손님 호수까지 실린다.',
  },
  {
    name: '생활흐름 — 덮어쓰기가 요청서에 없는 키도 받아들인다',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: "if (typeof v === 'string' && v && k in base) out[k] = v",
    replace: "if (typeof v === 'string' && v) out[k] = v",
    test: T,
    why: '저장된 JSON 의 엉뚱한 키가 화면에 그대로 나온다.',
  },
  {
    name: '생활흐름 — 여러 개 고르기가 없는 선택지를 받는다',
    file: 'src/shared/home-service.ts',
    find: '      if (f.options && picked.some((x) => !f.options!.includes(x))) return',
    replace: '      if (false) return',
    test: T,
    why: '업체에게 아무 글이나 실려 간다.',
  },
  {
    name: '생활흐름 — 임시 저장이 하루가 지나도 남는다',
    file: 'src/pages/life/request/draft.ts',
    find: '    if (!d?.at || Date.now() - d.at > TTL_MS || !d.values',
    replace: '    if (!d?.at || !d.values',
    test: T,
    why: '공용 기기에 남의 상세 주소가 계속 남는다.',
  },
  {
    name: '생활흐름 — 비로그인이 로그인 없이 그냥 접수를 시도한다',
    file: 'src/pages/life/LifeRequestFormPage.tsx',
    find: '    if (!loggedIn) { saveDraft(def!.key, values); navigate(loginPathFromHere()); return }\n',
    replace: '',
    test: T,
    why: '401 만 나고 답이 저장되지 않아 처음부터 다시 적게 된다.',
  },
  {
    name: '생활흐름 — 생활 견적 규칙이 홈 첫 화면 묶음에 다시 섞인다',
    file: 'vite.config.ts',
    find: "(id.includes('/src/shared/home-') && !id.includes('/src/shared/home-service'))",
    replace: "id.includes('/src/shared/home-')",
    test: T,
    why: '홈·FAQ 등 app-home 을 받는 모든 화면이 생활 견적 칸 정의를 첫 로딩에 받는다(+2KB).',
  },
]
