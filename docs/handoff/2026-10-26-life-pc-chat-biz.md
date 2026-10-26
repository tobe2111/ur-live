# 2026-10-26 생활 견적 — PC 화면 · 고르기 전 질문 · 업체 소개 페이지 · 후기 사진

대표: *"생활 카테고리 페이지들 중에서 PC 버전으로도 보여야 하지 않을까?"* → *"1,2,3 모두 진행해줘."*

## 한 것
- 🖥️ PC: `/life`·`/life/*` 를 `pc-fullbleed` SSOT 에 등록(430 액자 해제). `/life` 는 lg 에서 2열(카테고리 / 자주 묻는 질문·업체 CTA). 상세 화면은 720 중앙.
- 💬 질문: `home_service_messages`(견적 하나에 대화). 손님 `GET/POST /api/home-service/requests/:id/quotes/:qid/messages`, 사장님 `GET/POST /api/home-service/pro/quotes/:qid/messages`. 연락처(전화·카톡 아이디·오픈채팅) 적으면 거절(`shared/home-service-chat.ts`). 열린 요청의 보낸 견적 + 고른 견적만 쓰기 가능, 견적당 60줄. 상대에게 인앱 알림(알림톡 아님 — 새 템플릿은 심사 필요).
- 🏢 업체 페이지: `GET /api/home-service/pros/:id`(공개, 연락처 없음) + `/life/biz/:id`. 견적 카드의 업체 이름이 링크, 사장님 화면에 "내 업체 페이지 · 링크 보내기".
- 📷 후기 사진 5장 — 그 손님이 올린 우리 업로드 주소만(`parseReview(body, userId)`), 읽을 때 다시 거름.

## 다음 세션 첫 액션
1. 배포 뒤 `curl https://urdeal.kr/api/home-service/pros/<사장님 seller_id>` → 200 · `phone` 문자열 없음.
2. PC(1440)로 `https://urdeal.kr/life` 열어 2열인지.
3. 질문 대화 전 과정(손님 질문 → 사장님 답)은 손님+사장님 계정이 필요 — 테스트 계정으로.

## 틀렸던 판단
- 없음(이번 작업 중). 단, 연락처 필터는 글자 규칙이라 "공일공…" 처럼 한글로 쓴 번호는 못 막는다 — 사람이 신고로 처리.

## 대기
- 업체 페이지 서버 메타(카톡 미리보기 제목)·sitemap 등재는 안 했다(사장님 수가 적어 thin). 업체가 늘면 추가.
