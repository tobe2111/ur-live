/**
 * 🫥 "글자가 읽히는 바닥이 있는가" (2026-09-16 대표 *"유어쇼츠 왜이래?"*).
 *
 * 스케일 밖 불투명도(`bg-white/97`)는 **클래스가 생성되지 않는다.** 빌드도 타입도 초록이고
 * 화면에서만 배경이 사라진다 — 이 레포가 반복해 당한 "실패가 아니라 조용한 부재".
 * 유어쇼츠 구매 바는 **첫 판부터** 그 상태였고 기존 테스트 15개가 전부 통과했다(다 글자와
 * 배치만 봤다). 아래 주입들이 그 조용한 고장을 다시 만들어 본다.
 *
 * 가드: scripts/check-tailwind-opacity-scale.mjs · src/tests/unit/videos-buy-bar.test.ts
 */
const GUARD = 'scripts/check-tailwind-opacity-scale.mjs'
const BAR_TEST = 'src/tests/unit/videos-buy-bar.test.ts'
const VIDEOS = 'src/pages/VideosPage.tsx'
const BANNER = 'src/components/home/HomeBannerStrip.tsx'

export default [
  {
    name: '🫥 유어쇼츠 구매 바가 다시 투명해진다 (실사고 원본 — bg-white/97)',
    file: VIDEOS,
    find: 'rounded-2xl bg-white/95 p-2.5 shadow-2xl',
    replace: 'rounded-2xl bg-white/97 p-2.5 shadow-2xl',
    test: GUARD,
    why:
      '대표가 신고한 그 화면이다. 97 은 스케일에 없어 클래스가 안 만들어지고, 상품명·가격이 ' +
      '영상 위에 맨살로 뜬다. 에러도 빨간불도 없어서 첫 배포부터 아무도 몰랐다.',
  },
  {
    name: '🫥 구매 바 배경 클래스를 통째로 뗀다 (테스트가 바닥을 보는지)',
    file: VIDEOS,
    find: 'rounded-2xl bg-white/95 p-2.5 shadow-2xl',
    replace: 'rounded-2xl p-2.5 shadow-2xl',
    test: BAR_TEST,
    why:
      '기존 검사 15개는 글자·배치만 봐서 배경이 없어도 전부 통과했다. 이 주입이 통과하면 ' +
      '새로 넣은 "배경이 있는 카드다" 검사도 같은 눈먼 자리에 있다는 뜻이다.',
  },
  {
    name: '🫥 홈 배너 스크림이 사라진다 (사진 위 흰 글자를 받치는 층)',
    file: BANNER,
    find: 'bg-gradient-to-br from-black/60 to-black/40',
    replace: 'bg-gradient-to-br from-black/62 to-black/38',
    test: GUARD,
    why:
      '스크림은 사진이 밝을 때만 필요해서, 없어도 어두운 사진에서는 멀쩡해 보인다 — ' +
      '밝은 배너가 올라오는 날에야 글자가 사라진다. #1339 부터 실제로 이 상태였다.',
  },
  {
    name: '🫥 가드의 색 매칭을 좁혀 임의 hex 를 놓치게 한다',
    file: GUARD,
    find: 'white|black|current|transparent|inherit|[a-z]+-\\d{2,3}|\\[[^\\]\\s]+\\]',
    replace: 'white|black',
    test: GUARD,
    why:
      '`border-[#16181C]/8` · `bg-violet-500/12` 같은 실제 히트가 전부 이 가지에서 나왔다. ' +
      '좁히면 검사는 초록인데 구멍이 다시 열린다 — 합성 대조가 그걸 잡아야 한다.',
  },
  {
    name: '🫥 가드가 스케일을 "다 맞다" 고 믿는다 (판정 무력화)',
    file: GUARD,
    find: '    if (scale.has(m[1])) continue',
    replace: '    continue',
    test: GUARD,
    why:
      '가드가 세기는 하는데 아무것도 못 잡는 상태. 출력이 "0건"이라 **통과처럼 보이는 것**이 ' +
      '이 클래스의 본질이고, 합성 대조가 없으면 여기서 영원히 초록이 뜬다.',
  },
]
