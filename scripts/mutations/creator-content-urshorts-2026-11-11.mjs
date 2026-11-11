/**
 * 🧬 주입 — '다녀온 사람들' 유튜브 → 유어쇼츠 옮겨 싣기 (2026-11-11)
 *    가드: src/tests/unit/creator-content-urshorts-2026-11-11.test.ts
 */
const T = 'src/tests/unit/creator-content-urshorts-2026-11-11.test.ts'
const F = 'src/features/creator-content/api/content-urshorts.ts'
export default [
  { name: 'urshorts-sync: 길이를 안 보고 싣는다', file: F,
    find: 'const shorts = rows.filter((v) => isShortLength(sec.get(v.ext_id) ?? -1))', replace: 'const shorts = rows',
    test: T, why: '4분·10분 영상이 세로 카드에 들어가 위아래 검은 띠 + 구매 바가 붙은 그냥 유튜브가 된다.' },
  { name: 'urshorts-sync: 직접 넣은 영상 앞에 선다', file: F,
    find: 'export const CREATOR_SHORTS_SORT = 100', replace: 'export const CREATOR_SHORTS_SORT = 0',
    test: T, why: '자동 영상 수십 편이 대표가 고른 영상을 홈 레일 12칸 밖으로 밀어낸다.' },
  { name: 'urshorts-sync: 숨긴 영상이 유어쇼츠에 남는다', file: F,
    find: "c.ext_id = home_shorts.video_id AND c.status = 'visible')", replace: "c.ext_id = home_shorts.video_id)",
    test: T, why: '사장님이 상세에서 숨긴 영상이 홈에는 계속 뜬다.' },
  { name: 'urshorts-sync: 상세 칸에 같은 영상이 두 번', file: 'src/features/creator-content/api/content.routes.ts',
    find: " AND COALESCE(source, 'manual') != 'creator'", replace: '',
    test: T, why: '같은 영상이 블로그·영상 줄과 유어쇼츠 배지 줄에 두 번 뜬다.' },
]
