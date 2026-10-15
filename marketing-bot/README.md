# 유어딜 SNS 마케터 봇 (Threads + Instagram)

계정: `urdeal_official` (IG user id 28641841168830624, Threads user id 29196793233237833)

## 하는 일
| 워크플로 | 언제 (KST) | 내용 |
|---|---|---|
| `SNS daily post` | 매일 09:00 / 12:30 / 19:30 중 하루 1슬롯 | Threads 글 1개 + 인스타 캡션 1개 작성·게시 (유용/공감 70% : 딜 홍보 30%, UTM 링크). 첫 2주는 슬롯을 돌아가며 테스트. 상품 이미지가 없으면 인스타는 건너뛰고 기록 |
| `SNS comment replies` | 2시간마다 | 내 게시물 댓글에 운영자 톤으로 짧게 답글. 불만·환불·민감 댓글은 답글 없이 `needs-owner` 이슈 생성 |
| `SNS weekly review` | 월요일 09:30 | 인사이트 수집 → 플랫폼별 최적 시간대를 `data/schedule.json` 에 반영 → 리포트 이슈 |
| `SNS influencer drafts` | 월요일 10:00 | 인플루언서 후보 + DM 초안을 이슈로만 작성 (발송 안 함) |

절대 하지 않는 것: 가짜 후기, 고객인 척, 남의 게시물에 댓글, DM 발송, 광고비 집행.

기록: `data/posts.json`(게시물 id·플랫폼·시각), `data/comments.json`(답글/에스컬레이션한 댓글 id). 봇이 자동 커밋합니다.

## 1. 시크릿 3개 등록 (최초 1회)
1. GitHub 에서 `tobe2111/ur-live` 저장소 열기
2. 상단 **Settings** → 왼쪽 **Secrets and variables** → **Actions**
3. **New repository secret** 을 눌러 아래 3개를 하나씩 추가 (Name 은 정확히 그대로)
   - `ANTHROPIC_API_KEY` : console.anthropic.com 에서 발급한 API 키
   - `META_IG_ACCESS_TOKEN` : Instagram API(Instagram 로그인) 장기 액세스 토큰 (권한: instagram_business_basic, instagram_business_content_publish, instagram_business_manage_comments, instagram_business_manage_insights)
   - `META_THREADS_ACCESS_TOKEN` : Threads API 장기 액세스 토큰 (권한: threads_basic, threads_content_publish, threads_manage_replies, threads_read_replies, threads_manage_insights)
4. 장기 토큰은 60일마다 만료되므로 갱신 후 같은 이름으로 다시 저장하세요.

## 2. 수동 실행
1. 저장소 상단 **Actions** 탭 → 왼쪽에서 워크플로 선택 (예: `SNS daily post`)
2. **Run workflow** → `dry_run` 에 `1` 을 넣으면 실제 게시 없이 로그만, `0` 이면 실제 실행
3. 수동 실행한 daily post 는 시간 슬롯과 관계없이 바로 게시합니다 (하루 1회 중복 방지는 유지)

## 3. 상품/이미지 바꾸기
`data/products.json` 수정. `image_url` 이 비어 있으면 상품 페이지의 og:image 를 쓰고, 그것도 없으면 인스타는 건너뜁니다.

## 로컬 테스트 (네트워크 없이)
```bash
cd marketing-bot && npm test   # 문법 체크 + 4개 스크립트 DRY_RUN=1 실행
```
