/** 🧬 주입 — 처음 오는 PC 는 Pretendard 를 켜지 않는다. 가드: src/tests/unit/self-hosted-fonts-2026-10-12.test.ts */
export default [
  { name: '글꼴첫방문 — 다시 처음 방문에 켠다(읽는 도중 줄이 다시 감긴다)', file: 'index.html', find: "function flip(ok){if(done>1)return;done=2;if(ok){", replace: "function flip(ok){if(done>1)return;done=2;l.media='all';if(ok){", test: 'src/tests/unit/self-hosted-fonts-2026-10-12.test.ts', why: '2026-11-12 PC 블로그 글 실측 CLS 0.15(글꼴을 막으면 0).' },
]
