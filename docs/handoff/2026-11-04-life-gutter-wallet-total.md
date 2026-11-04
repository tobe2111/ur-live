# 2026-11-04 — 생활 견적 양쪽 여백 · 내 이용권 합계 판 제거

1. **생활 견적(/life) 양쪽 40px** — 대표 *"이 페이지 양쪽 공백 왜이렇게 두는거야?"*. 원인: 2026-11-02 평면(A안)으로 판 바탕을 걷었는데
   판 안쪽 `px-5` 가 남아 바깥 `px-5` 와 겹쳤다(20+20). `LifePage` CARD·안내문 · `LifeHero` · `LifeRequestFormPage` 목록에서 안쪽 가로 여백 제거 → 20px.
   ⚠️ 같은 클래스(평면 판 + 안쪽 px)가 다른 화면에도 있을 수 있다 — 화면으로 확인할 것.
2. **내 이용권 합계 판** — 대표 *"쓸 수 있는 이용권 합계 없애줘"*. `WalletSummaryCard` 삭제(잠금 기록 `docs/locks/loading/2026-11-04-wallet-total-removed.md`).
3. **지도에서 보기 아래 카드** — 대표 *"중앙정렬도 안 되어있어"*. 한 장이면 80% 폭 → 꽉.
4. **유어샵 '최근 30일' 판 → 관리 화면** — 대표 *"관리 버튼 안에 넣거나 해줘"*. `OwnerSummaryCard` 를 `/u/me/manage` '수익과 정산' 맨 위로
   (그 자리의 30일 적립 띠 `OwnerEarningsStrip` 을 대신 — 같은 숫자 두 번 방지, 파일 삭제). 담기·공유 버튼은 뺐다(관리 화면 '이용권 담기' 줄 · 유어샵 머리 공유).
5. **'내 유어샵으로 버는 법' → 에이전시** — 대표 *"에이전시 등록 이런거 하는게 좋지 않을까?"*. `EarnLadder` 삭제, 관리 화면에
   '에이전시' 구역(등록 `/agency/signup` · 로그인 `/agency/login`). 영입 2% 재유입 감시는 `store-intro-abolished` 시험이 계속 맡는다.
- 가드 `consumer-fixes-2026-11-04` + 주입 2 · 재조준: ushop-owner-summary · ushop-manage-settlement · ushop-e3-manage · urshop-earn-ladder ④.
