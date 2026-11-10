/** 🧬 주입 — 안내 랜딩 셋 서버 첫 화면 (2026-11-10) */
const T = 'src/tests/unit/landing-first-screen-2026-11-10.test.tsx'
const B = 'src/worker/utils/landing-first-screen.ts'
export default [
  { name: '랜딩첫화면 — 사진 칸 CSS 를 안 넣는다', file: B, find: 'const hero = `<style>${LANDING_HERO_CSS}</style>', replace: 'const hero = `', test: T, why: '사진이 absolute 가 아니게 되어 첫 화면이 사진 높이(1080)만큼 밀렸다가 마운트 때 접힌다.' },
  { name: '랜딩첫화면 — 사진을 lazy 로', file: B, find: 'decoding="async" fetchpriority="high" class="${LANDING_FS.heroImg}"', replace: 'decoding="async" loading="lazy" fetchpriority="low" class="${LANDING_FS.heroImg}"', test: T, why: '첫 화면 사진이 preload 와 우선순위가 갈려 늦게 온다.' },
  { name: '랜딩첫화면 — 제목을 서버가 그린다', file: B, find: '<div class="${LANDING_FS.heroInner}"></div>', replace: '<div class="${LANDING_FS.heroInner}"><h1>동네 가게 할인 이용권을</h1></div>', test: T, why: '마운트 때 마스크 모션이 글자를 숨겼다 올려 깜빡인다(premium.css 규칙).' },
  { name: '랜딩첫화면 — 로고를 밝은 바탕 색으로', file: B, find: "logoHtml(LANDING_LOGO_SIZE, 'dark')", replace: 'logoHtml(LANDING_LOGO_SIZE)', test: T, why: '잉크 바 위에 잉크색 로고 — 안 보인다.' },
  { name: '랜딩첫화면 — 머리줄 클래스를 손으로 바꾼다', file: 'src/shared/landing-photo.ts', find: "headerRow: 'ur-content-wide mx-auto px-5 lg:px-10 h-14 lg:h-16 flex items-center justify-between',", replace: "headerRow: 'ur-content-wide mx-auto px-5 lg:px-10 h-12 flex items-center justify-between',", test: T, why: '서버 머리줄 높이가 페이지와 갈려 마운트 때 사진 칸이 밀린다.' },
  { name: '랜딩첫화면 — 워커 분기에서 noscript 를 뺀다', file: 'src/worker/index.ts', find: 'el.setInnerContent(landingFirst + landingNs, { html: true })', replace: 'el.setInnerContent(landingFirst, { html: true })', test: T, why: '크롤러 본문(/about 30자 사고)이 다시 빈다.' },
  { name: '랜딩첫화면 — 첫 화면 CSS 자격에서 빠진다', file: 'src/worker/utils/css-first-boot.ts', find: "    || landingPhotoKeyOf(pathname) !== null // 🧭", replace: "    || false // 🧭", test: T, why: '서버가 그린 머리줄이 앱 CSS 를 기다려 안 보인다.' },
]
