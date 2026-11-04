/**
 * 🧬 주입 — 이용권 상세 '다녀온 사람들' (2026-11-04)
 *    가드: src/tests/unit/creator-content-2026-11-04.test.tsx
 *    대표: "손님 2 + 사장님 2 + 블로그 창" · "유튜브는 유어애즈랑 분담해서 자동으로"
 */
const T = 'src/tests/unit/creator-content-2026-11-04.test.tsx'
const R = 'src/features/creator-content/api/content.routes.ts'
const C = 'src/features/creator-content/api/content-collect.ts'
const S = 'src/shared/creator-content.ts'
export default [
  {
    name: '자동 수집이 바로 손님에게 보이게 저장한다',
    file: C,
    find: "VALUES (?, ?, 'naver_blog', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', 'auto')",
    replace: "VALUES (?, ?, 'naver_blog', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', 'auto')",
    test: T,
    why: '이름이 같은 다른 가게 글이 사장님 확인 없이 구매 버튼 옆에 선다.',
  },
  {
    name: '사장님 API 가 소유권을 안 본다',
    file: R,
    find: 'return Number.isFinite(me) && me === s.seller_id ? s : null',
    replace: 'return s',
    test: T,
    why: '아무 셀러나 남의 가게에 영상을 걸거나 지운다(IDOR).',
  },
  {
    name: '2자 이름도 매칭한다',
    file: S,
    find: '  if (core.length < 3) return false\n',
    replace: '',
    test: T,
    why: "'카페' 같은 이름이 아무 글에나 걸려 후보가 쓰레기로 찬다.",
  },
  {
    name: '태평양시 18시 뒤에도 몫을 붙잡는다',
    file: S,
    find: 'if (!Number.isFinite(ptHour) || ptHour >= 18) return 0',
    replace: 'if (!Number.isFinite(ptHour)) return 0',
    test: T,
    why: '못 쓴 유튜브 몫이 유어애즈로 안 돌아가 성과 측정이 하루 1,500점씩 손해 본다.',
  },
  {
    name: '유튜브를 부른 뒤에 센다',
    file: C,
    find: "  await writeSetting(DB, CONTENT_YT_USED_KEY, `${day}:${used + 1}`)\n  await DB.prepare(`UPDATE store_content_crawl SET yt_at",
    replace: "  await DB.prepare(`UPDATE store_content_crawl SET yt_at",
    test: T,
    why: '실패한 호출도 구글은 100점을 가져가는데 세지 않으면 몫을 넘긴다.',
  },
]
