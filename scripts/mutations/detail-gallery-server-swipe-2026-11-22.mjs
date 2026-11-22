/** 되돌려-검증 주입 — 서버 첫 화면에서 넘긴 사진 이어받기 (2026-11-22). 가드: detail-gallery-server-swipe-2026-11-22.test.tsx */
const T = 'src/tests/unit/detail-gallery-server-swipe-2026-11-22.test.tsx'
const F = 'src/pages/group-buy/DetailGallery.tsx'
export default [
  { name: 'srvswipe: 늘 첫 장에서 시작', file: F,
    find: 'useState(() => Math.min(serverSwipedIndex(), Math.max(0, rawImages.length - 1)))', replace: 'useState(0)', test: T,
    why: '처음 2초 안에 넘긴 사진이 앱이 뜰 때 1번으로 되돌아간다(대표 신고).' },
  // ⚠️ useLayoutEffect(그리기 전에 옮기기)를 지우는 주입은 넣지 않는다 — 아래 useEffect 가 한 프레임 늦게 같은 자리로 옮겨서
  //   끝 상태가 같다(jsdom 은 한 프레임 깜빡임을 못 본다). 그 깜빡임은 라이브 측정(probe)로만 보인다.
  { name: 'srvswipe: 마지막 장 상한 없음', file: F,
    find: 'Math.min(serverSwipedIndex(), Math.max(0, rawImages.length - 1))', replace: 'serverSwipedIndex()', test: T,
    why: '없는 장으로 밀려 빈 칸이 보인다.' },
  { name: 'srvswipe: 미끄러지는 중이면 반올림(첫 장으로 떨어짐)', file: F,
    find: '    return ssrSwipeDir < 0 ? Math.floor(pos) : Math.ceil(pos)', replace: '    return Math.round(pos)', test: T,
    why: '교체 순간 반쯤 넘어가 있던 사진이 첫 장으로 돌아간다(라이브 1.5초 넘김).' },
]
