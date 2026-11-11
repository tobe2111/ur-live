# 2026-11-11 — '다녀온 사람들' 유튜브를 유어쇼츠에도 싣기

대표: *"이용권 상세페이지에 지금 각 매장들의 유튜브 영상이 올라오잖아. 유어쇼츠 영역으로도 넣어주면 되지 않아?"*
서비스: 유어딜(소비자). 머니 경로 접촉 없음. 롤백 = `runCreatorContentCollect` 의 `syncCreatorShorts` 한 줄 제거 +
`UPDATE home_shorts SET is_active=0 WHERE source='creator'`(어드민 유어쇼츠 화면에서 끄기로도 된다).

## 한 것
- `content-urshorts.ts` `syncCreatorShorts` — 매시 수집 회차(ur-ads `/__ads/creator-content`)의 마지막 단계.
  공개 중인 유튜브 50개씩 `videos.list`(1 unit)로 길이를 재 `store_creator_content.duration_sec` 에 적고,
  **3분 이하**만 `home_shorts`(`source='creator'`, `sort_order=100`, 가게의 가장 많이 팔린 판매 중 이용권)에 넣는다.
- 가게 칸에서 공개가 아니게 된 영상 → 유어쇼츠에서 끈다. **끈 것을 자동으로 다시 켜지 않는다**(어드민 끄기 존중).
- 상세 칸이 `source='creator'` 행을 '유어쇼츠' 배지로 다시 읽지 않는다(같은 영상 두 번 방지).
- 가드 `creator-content-urshorts-2026-11-11.test.ts`(진짜 SQLite 6건) + 주입 4건(전부 빨간불 확인).

## 실측(배포 전)
- 라이브 가게 칸 공개 유튜브 **71편**. 전부 `watch?v=` 주소라 쇼츠인지 주소로는 모른다 → 길이를 재야 한다.
- 수집 검색이 `videoDuration=short`(유튜브 기준 **4분 미만**)라 3분 기준과 다르다 — 그래서 재는 단계를 넣었다.

## 틀린 판단
- 이 환경에서 `youtube.com/shorts/<id>` 로 쇼츠 여부를 찔러 "71편 중 0편" 이 나왔다 — **프록시가 youtube.com 을 막아**
  전부 실패한 것이었다(000). 측정기 오류를 결과로 읽을 뻔했다.

## 이어받는 세션의 첫 액션
- 배포 다음 회차(매시) 뒤 메인 D1: `SELECT COUNT(*), SUM(is_active) FROM home_shorts WHERE source='creator'` ·
  `SELECT duration_sec>0 AND duration_sec<=180 AS s, COUNT(*) FROM store_creator_content WHERE platform='youtube' AND status='visible' GROUP BY 1`.
  0 이면 ur-ads 회차 결과의 `shorts_measured`(유튜브 쿼터 403 이면 0 — 다음 날 재시도)를 본다.

## 남은 것
- 세로/가로는 길이로만 가른다(어드민 '주소로 추가' 와 같은 기준). 가로 2분 영상은 들어갈 수 있다.
