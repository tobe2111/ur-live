/**
 * 🧬 주입 — CLS 원인 표본(2026-10-20 · 실사용 홈 CLS 0.20 이 실험실에서 재현 안 됨)
 *    가드: src/tests/unit/cls-source-2026-10-20.test.ts
 */
const T = 'src/tests/unit/cls-source-2026-10-20.test.ts'
const M = 'src/shared/cls-source.ts'
export default [
  {
    name: 'CLS원인 — 요소 폭 전후를 안 싣는다',
    file: M,
    find: "`|W${r(s.previousRect.width)}→${r(s.currentRect.width)}`",
    replace: "''",
    test: T,
    why: '폭이 줄어 높이가 바뀐 밀림(스크롤바 등장)과 위가 접혀 올라간 밀림을 가를 수 없다(2026-10-24 — 유일한 실사용 표본이 그 경우).',
  },
  {
    name: 'CLS원인 — 수집기가 스크롤 위치를 안 넘긴다',
    file: 'src/lib/web-vitals-report.ts',
    find: 'clsSourceString(e.sources, e.startTime, window.innerWidth, window.scrollY)',
    replace: 'clsSourceString(e.sources, e.startTime, window.innerWidth)',
    test: T,
    why: '그 밀림이 첫 화면에서 났는지 스크롤 중에 났는지 모른다.',
  },
  {
    name: 'CLS원인 — 화면 글자를 원인에 싣는다',
    file: M,
    find: "  return `${tag}${id}${cls.length ? '.' + cls.join('.') : ''}`",
    replace: "  return `${tag}${id}${cls.length ? '.' + cls.join('.') : ''}${(el.textContent || '').slice(0, 10)}`",
    test: T,
    why: '원인 문자열이 화면 글자(이름·주소)를 담으면 개인정보가 분석 저장소로 샌다.',
  },
  {
    name: 'CLS원인 — 서버 검증이 아무 글자나 받는다',
    file: M,
    find: '  return s && SAFE.test(s) ? s : \'\'',
    replace: '  return s',
    test: T,
    why: '검증 없이 저장하면 아무 문자열(스크립트 포함)이 어드민 요약에 그대로 뜬다.',
  },
  {
    name: 'CLS원인 — 요소별로 안 묶는다',
    file: M,
    find: "    const el = row.split('|')[0]",
    replace: '    const el = row',
    test: T,
    why: '위치·시각까지 키로 쓰면 같은 요소가 표본마다 따로 세어져 "가장 많이 밀린 것" 이 안 보인다.',
  },
  {
    name: 'CLS원인 — 서버가 SLO 판정 키에 섞어 쓴다',
    file: 'src/worker/routes/analytics.routes.ts',
    find: 'vitals:${day}:CLSS:${page}`, src)',
    replace: 'vitals:${day}:CLS:${page}`, src)',
    test: T,
    why: '문자열 표본이 CLS 숫자 표본에 섞이면 매일 판정의 p75 가 망가진다.',
  },
  {
    name: 'LCP사진 — 홈 배너를 다시 3배 폭으로',
    file: 'src/shared/constants/home-showcase.ts',
    find: '    requestWidth: 760,',
    replace: '    requestWidth: 1100,',
    test: 'src/tests/unit/strip-banner-2x-2026-10-20.test.ts',
    why: '폰 홈의 LCP 사진이 362px 칸에 1,100px(27KB)를 받는다 — 2배면 16KB.',
  },
  {
    name: 'LCP사진 — 첫 화면 아래 유달이 로더가 보통 우선순위',
    file: 'src/worker/utils/css-first-boot.ts',
    find: "return cssFirst ? ' fetchpriority=\"low\"' : ''",
    replace: "return ''",
    test: 'src/tests/unit/mascot-preload-first-screen-2026-10-15.test.ts',
    why: '로더 그림이 첫 이미지 요청이 되어 LCP 사진과 회선을 나눠 쓴다.',
  },
  {
    name: 'LCP사진 — 워커 로더 마크업이 우선순위 속성을 안 붙인다',
    file: 'src/worker/index.ts',
    find: '${UDAL_LOADER_SRC}"${loaderImgPriorityAttr(cssFirst)}',
    replace: '${UDAL_LOADER_SRC}"',
    test: 'src/tests/unit/mascot-preload-first-screen-2026-10-15.test.ts',
    why: '함수는 맞는데 배선이 빠지면 라이브에서 아무 일도 안 한다(2026-10-20 실제로 그랬다).',
  },
]
