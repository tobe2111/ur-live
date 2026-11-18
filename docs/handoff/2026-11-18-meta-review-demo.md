# 2026-11-18 메타 앱 검수 시연 화면

**서비스**: 유어딜 마케팅(어드민 도구) · 머니 경로 없음.

## 한 것
- `/admin/meta-review` — 메타 검수 녹화용 화면. 스레드 로그인·페이스북 로그인(실제 OAuth) → 스레드 키워드 검색·답글·답글 숨기기 →
  인스타 해시태그 검색·business_discovery·받은 대화함 DM·댓글 답글.
- 백엔드 `src/features/meta-review/api/*` — 표 `meta_review_conn`(CREATE IF NOT EXISTS, 시크릿·토큰 암호화).
  공개 콜백 `/api/meta-review/oauth/{threads|facebook}/callback`(서명 state 10분).
- 바깥으로 나가는 행동은 `approved:true` 없으면 거절 · 화면은 체크박스를 눌러야 버튼이 켜짐. 가드 `meta-review-2026-11-18.test.ts`(주입 1건 확인).
- 녹화 대본: 프로젝트 파일 `marketing/meta-review-recording.md`.

## 이어받는 세션의 첫 액션(대표가 이어서 하라고 했을 때만)
- 대표가 녹화하다 막힌 에러 문장을 주면 `meta-review-graph.ts` 의 해당 호출을 메타 문서와 대조.

## 틀렸을 수 있는 것
- 페이지 DM 발송은 `/{page-id}/messages`(페이지 토큰) 경로로 짰다. 메타가 인스타 로그인 방식(`graph.instagram.com/me/messages`)만 받는다고 하면 그쪽으로 바꿀 것. 라이브 미검증(E2).
