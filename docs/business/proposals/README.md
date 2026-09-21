# 대외 제안서

원본 파일은 여기가 아니라 **`public/static/proposals/`** 에 있습니다.

| 문서 | 파일 | 어드민 |
|---|---|---|
| 인플루언서 제휴 제안 (16:9, 9장) | `public/static/proposals/influencer-proposal.html` | `/admin/proposals` |
| 대행사 제휴 제안 (16:9, 30장 v8 — **09-19 확정 플로우**: 매장 코드·두 요율·코드 링크 매칭·귀사 몫 유어딜 직접 송금. PART 구분 장 4·직접 vs 경유 표·플라이휠·페르소나·목표별 설계·인출선·절차 3열, PowerPoint, 매장 모집 실행서) | `docs/business/proposals/urdeal-agency-proposal.pptx` + 같은 이름 `.pdf` (생성기 `urdeal-agency-proposal.build.mjs`) | 없음. 파일로 전달 |
| 매장 사장님 소개 (16:9, 15장 v7 — 대표 최종 구성안 9장 + 손님 흐름 + 페르소나·목표별 설계·쌓이는 자산·절차 3열, PowerPoint. 상세판 17장은 `urdeal-store-owner-deck-detail.*`) | `docs/business/proposals/urdeal-store-owner-deck.pptx` + 같은 이름 `.pdf` (생성기 `urdeal-store-owner-deck.build.mjs`, 공통 모듈 `deck-common.mjs`) | 없음. 파일로 전달 |
| 인플루언서 제휴 소개 (16:9, 20장 v4 — **중개사 계정 · 유어딜 5% 흐름 + 09-19 확정 플로우**(코드 링크 한 탭 매칭·매장 단위 링크·매장 코드), 영입 2% 제거, 정산은 "이용권 사용 후", 유어쇼츠·이용권 지갑·QR 화면, SNS 로고, https 하이퍼링크. PART 구분 장 3·플라이휠·페르소나·인출선·절차 3열, PowerPoint) | `docs/business/proposals/urdeal-influencer-deck.pptx` + 같은 이름 `.pdf` (생성기 `urdeal-influencer-deck.build.mjs`, 공통 모듈 `deck-common.mjs`). 기존 9장 HTML(`public/static/proposals/influencer-proposal.html`)을 대체한다 | 없음. 파일로 전달 (어드민 `/admin/proposals` 의 HTML 은 구판) |
| 소개서 3종 기획서 | `docs/business/proposals/three-decks-plan-2026-09.md` | 없음 |

## 왜 docs/ 가 아니라 public/static/ 인가

처음에는 `docs/business/proposals/` 에 두고 어드민이 `?raw` 로 가져왔습니다
(`AdminPlatformModelPage` 가 SSOT 문서에 쓰는 패턴). 그런데 제안서에 **라이브 화면 캡처를
base64 로 심자** 그 문자열이 그대로 JS 청크가 되어 `AdminProposalsPage` 청크가 **254KB** 로
불었고, `check-bundle-size --budget`(총 raw JS 8.6MB)이 CI 를 세웠습니다.

정적 자산으로 두면 번들에 1바이트도 안 들어가고, 배포마다 자동 최신인 성질은 그대로입니다.

⚠️ **경로는 `/static/` 아래여야 합니다.** `public/_routes.json` 이 그 접두사만 워커에서
제외하고 있어 Pages 가 파일을 직접 서빙합니다. 다른 경로로 옮기면 워커가 SPA 셸을 돌려주고
미리보기가 빈 화면이 됩니다. 이 세 가지는 `src/tests/unit/admin-proposals-asset.test.ts` 가
강제합니다(되돌려-검증 완료).

## 화면 캡처를 다시 찍으려면

```bash
NODE_USE_ENV_PROXY=1 node scripts/capture-proposal-shots.mjs /tmp/shots
```

- 캡처에 **매장 전화번호가 그대로 나옵니다.** 상세 화면은 `a[href^="tel:"]` 를 블러 처리하도록
  잡아 뒀습니다. 대상 화면을 바꾸면 가릴 것이 또 있는지 먼저 보세요. 문서는 돌아다닙니다.
- 유어샵은 `/u/jiwon1228`(대표 계정)을 씁니다. 남의 유어샵을 대외 문서에 넣지 마세요.
- 색은 `src/index.css` 의 `--ink` / `--ink-soft` 를 **복사해 쓰는 구조**라 자동으로 안 따라옵니다.
  서비스 테마가 바뀌면 제안서도 같이 고쳐야 합니다.

## 참고 덱에서 가져온 장치 (2026-09-15)

대표가 보낸 두 번째 참고 덱(히로인스 소셜 마케팅 상품 소개서 36장)에서 **구조를 보여주는 장치**만 가져와 `deck-common.mjs` 헬퍼로 넣었다.
세 덱이 같은 헬퍼를 쓴다: `section`(브랜드 블루 구분 장 + 이후 장 우상단 "PART n · …" 라벨) · `takeaway`(하단 한 줄 결론 바) ·
`callouts`(화면 인출선, 폰 프레임 안 비율 좌표) · `personas`(말풍선 페르소나 행, 다크) · `procedureColumns`(트랙별 절차 N열) ·
`flywheel`(링 + 노드 + 화살표) · `table({ hiCol, leftAlign })`(강조 열). **안 가져온 것**: 규모 지표 타일·ROAS·만족도 도넛(대응 숫자가 없고
"매출 O%" 금지) · 로고 월 · 3D 광택 아이콘(아이콘 규칙 위반) · 경쟁 채널 시장가 표(출처 없는 남의 가격).
🩸 LibreOffice PDF 변환에서 `transparency` 가 걸린 텍스트 런의 **숫자가 사라진다**(`PART 1` → `PART`). 투명도 대신 옅은 색(`CFE0FD`)을 쓴다.

## 인플루언서 덱 v3 — 중개사 흐름 (2026-09-19)

대표 20장 전수 지시. **인플루언서는 셀러 대시보드에 중개사 계정으로 가입**하므로 덱은 직접 10% 가 아니라 **중개 5%** 흐름으로 말한다.
**영입 2%(직접 입점 1년) 규정은 폐지** — 이 덱에서 전부 뺐다(⚠️ 사장님 덱은 원래 0건, **대행사 덱 비교표 1행**(`urdeal-agency-proposal.build.mjs:170`)과
코드 `influencer_store_intro_pct=2` · `actor-benefit-map.md` 는 아직 2% 를 말한다 — 대표 확인 뒤 정리). 카드 수수료 2.75% 는 이 덱에서 말하지 않는다.
정산 시점은 대표 지시대로 **"팔로워가 이용권을 사용한 뒤"** 로 적었다(⚠️ 코드는 결제+7일 `available_at` — 문구와 다르다, 대표 확인 필요).
화면: 유어샵 재캡처 · 유어쇼츠 `/videos?v=jHPacJoCEt8`(이용권이 붙은 라이브 영상 — 재생 자리는 이 환경에서 유튜브가 막혀 어둡게 나온다) ·
이용권 지갑·QR(`/my-vouchers`, 예시 데이터). 캡처 하네스는 `capture-seller-shots.mjs` 를 복제해 `vouchers/my` mock + "사용하기" 클릭 + 바텀시트를 위로 올리는 style 을 더한 것.
SNS 로고는 `react-icons/si`(`icon()` 이 Fi → Si 순으로 찾고, `icons` 항목을 `['SiNaver','03C75A']` 처럼 색과 함께 넘긴다). 연락처는 `https://` 전체 주소 + `hyperlink`(PDF 에서 눌린다).
⚠️ **07 경로 A(13페이지)는 대표가 "실제 플로우를 다시 봐야 한다 · 마지막에 재작업"** — 자격(인플루언서/대행사/중개사) 선택 가입은 라이브에 없다(`/seller/register/supplier` 는 사업자 정보 폼). 지금은 URL 만 빼고 문구만 바꿔 둔 상태.

## 인플루언서 덱 v4 · 대행사 덱 v8 — 대표 확정 플로우 (2026-09-19)

SSOT 는 `docs/decisions/2026-09-19-broker-matching-flow.md`(대표 말 그대로 11단계 + 불변식 9개 + 구현 순서). 두 덱이 같은 플로우를 각자 시점에서 말한다:
- **매칭은 "제안·수락" 이 아니라 매장 코드다.** 대행사가 매장을 등록하면 코드가 자동 생성되고 **중개사 몫 % · 인플루언서 소개비 %** 를 그때 정한다.
  인플루언서에게는 **코드가 담긴 링크 한 탭**(가입 + 즉시 매칭). 직접 온 사람은 마이페이지에서 코드 입력. 마이페이지에 **매장 단위 고유 링크**(복사·카톡 공유, 이용권이 바뀌어도 그대로).
- **사장님이 가입하며 코드를 입력해 주인이 된다**(원안의 "대행사가 코드 입력"을 대표가 뒤집음 — 권한을 내주는 쪽이 입력해야 동의). 등록증 확인 그대로, 첫 정산 전까지만, 판매는 안 막는다.
- **대행사 몫은 유어딜이 직접 송금**(09-16 결재) — 대행사 덱의 "보수·청구·매장과 직접" 문구를 전부 걷어냈다(PDF 텍스트에서 `보수` 0 · `청구` 0). 영입 2% 행 삭제.
- ✅ **코드는 같은 날 PR #1499(`e3e182c2`) 로 main 에 있다** — 승계 코드(`/store/find?code=`) · 협업 코드(`/i/join/:code`, 마이페이지 입력) · 매장 링크(`/s/{id}?ref=`) · 딜 % 조정 · `/seller/operating` 인플루언서별 성과. **귀사 몫 직접 송금(`broker-share.ts`)만 게이트 `broker_share_enabled` OFF**(S-BROKER 뒤 대표가 켠다) — 대행사 덱 §14 가 그 사실을 문장으로 밝힌다. 인플루언서 경로 A 는 아직 카드(배포 후 `/i/join` 과 마이페이지를 캡처해 교체).
- 소개비 %의 정확한 모델: 매장 등록 때 **중개사 몫 % · 인플루언서 상한 %** → 개별 소개비는 **협업 코드의 기본 %** + 딜별 조정(이후 판매분부터), 상한을 못 넘는다. 두 덱의 "소개비" 문구는 이 모델로 맞췄다("등록 때 정한 소개비" 라고 쓰면 틀린다).
- 인플루언서 덱 `shotKeys` 에서 `influencer-offer` 제거(제안 화면은 더 이상 안 쓴다 — 파일은 남겨 둠).

## 공통 모듈 `deck-common.mjs` (2026-09-13)

색·글꼴·헬퍼(chrome/title/card/phone/kv/table)와 세 덱이 글자 그대로 공유하는 사실(`FACTS`: 요율, 카드비 문구, 실측 숫자,
연락처)이 여기 있다. **요율이나 실측 숫자가 바뀌면 이 파일 한 곳만 고친다.** 카드 수수료는 "현재 약 2.75%, 카드사 정책에
따라 바뀔 수 있음" 으로 적는다(대표 2026-09-13). 세 덱이 공유하는 블록: `customerSteps`(손님 4단계 폰 4장) · `honesty`(정직 고지).
대행사 v4 생성기는 아직 자기 헬퍼를 쓴다(v5 에서 이 모듈로 옮긴다).

## 매장 사장님 안내 (.pptx) 다시 만들려면

```bash
mkdir -p /tmp/deck && cd /tmp/deck && npm init -y && npm i pptxgenjs sharp react react-dom react-icons
ln -sfn /tmp/deck/node_modules /path/to/ur-live/docs/business/proposals/node_modules   # ESM import 는 NODE_PATH 를 안 본다
cd /path/to/ur-live/docs/business/proposals && node urdeal-store-owner-deck.build.mjs out.pptx
```

- 12장 구성과 근거는 `three-decks-plan-2026-09.md` §2. 5장의 셈법은 라이브 유일의 실제 매장 이용권(id 2888, 25,000 → 16,500원)을 쓴다.
  재료비 35% 는 가정이고 슬라이드에도 그렇게 적혀 있다.
- 셀러 화면은 `capture-seller-shots.mjs` 로 계정 없이 찍는다. 2026-09-13 에 `/seller/settlements`(정산) · `/store/new`(등록 마법사 1단계·3단계) 를 추가했다.
  🩸 정산 화면은 처음에 에러 경계가 떴다: `DealBalanceCard` 가 `balance.total.toLocaleString()` 을 부르는데 예시 응답에 `total` 이 없었다.
  프로덕션 React 는 에러 경계가 잡은 오류를 콘솔에 남기지 않으므로 **컴포넌트가 읽는 필드를 코드에서 확인해 예시 응답을 맞춰야 한다.**
  🩸 등록 마법사는 소비자 로그인(`user_id`)이 필요한데, 그 신호를 넣으면 화면 장식이 `/api/curator/me/*`·`/api/wishlists`·`/api/auth/session/health` 를 부르고
  401 이 나면 소비자 클라이언트가 로그아웃시켜 `/login` 으로 튕긴다. 그 셋을 성공 응답으로 모킹해야 한다.

## 대행사 제안서 (.pptx) 다시 만들려면

```bash
mkdir -p /tmp/deck && cd /tmp/deck && npm init -y && npm i pptxgenjs sharp react react-dom react-icons
node /path/to/ur-live/docs/business/proposals/urdeal-agency-proposal.build.mjs ./urdeal-agency-proposal.pptx
```

- 요율(직접 10% / 중개 5%)과 "유어딜은 중개사에게 지급하지 않는다"는 2026-09-04 대표 확정입니다.
  `docs/design/store-operator-model.md` §7 이 SSOT 이고, 바뀌면 1·2·4·5·6·16 장을 같이 고쳐야 합니다.
- 라이브 실측 숫자(2026-09-07): 활성 이용권 338건 중 식사 평균가 32,339원(242개)·숙박 155,824원(51개)·실제 매장 등록 1개(나머지는 데모),
  인플루언서 DB 198,704명·연락 가능 45,725명(`/api/admin/ads/influencer-pool/stats`). 전달 전에 다시 재서 3·5·10·14 장을 갱신하세요.
- **v4 (2026-09-07)**: 대표가 보낸 참고 PDF("유어딜 중개사 파트너 제안" 5장, A4)를 반영했습니다. 표지 "5%만 가져갑니다"와 5% / 95% / 0원,
  돈 흐름도(손님→카드사→유어딜→매장→귀사 보수)와 "흔한 오해 / 실제", 규모별 표(10·30·100·300곳, 귀사 3% 예시), 운영자 권한 가능/차단 표,
  정직 고지 장(운영자별 귀속 미추적·초기 상태·대표 인용), 시작하는 방법 3단계. 단위 경제는 참고 PDF 와 같은 기준(평균가 32,339원, 하루 1건, 보수 3% 예시)으로 통일했습니다.
  ⚠️ 참고 PDF 의 "채널은 나중에 어드민에서만 바꿀 수 있다"는 코드와 다릅니다 — 매장 소유자도 `POST /api/seller/stores/:id/channel` 로 바꿀 수 있어 "매장 주인이나 유어딜만"으로 적었습니다.
- 5·6 장의 단위 경제(판매가 2만원, 월 60건, 보수 10%, 재료비 35%)와 14 장의 파일럿 목표는 **가정·제안**입니다. 슬라이드에도 그렇게 적혀 있습니다.
- 글꼴은 **Pretendard** 입니다(v3, 대표 지시). PowerPoint 로 여는 PC 에 Pretendard 가 없으면 대체 글꼴로 보이므로
  **대외 전달은 PDF 로** 하세요. 리눅스에서 뽑으려면 `~/.fonts` 에 Pretendard OTF 를 넣고 `fc-cache -f`.
- **폰 프레임은 `phone-frame.mjs` 가 PNG 로 미리 굽습니다**(둥근 화면 + 베젤 + 그림자). pptxgenjs 는 이미지를
  둥글게 못 자릅니다(`rounding:true` 는 원형 크롭). 스타일 4종 시안은 `phone-frame-styles.png`, 선택은
  `PHONE_STYLE=minimal|island|card|light`(기본 minimal, 대표 확정 대기).
- **라이브 모바일 캡처**(`shots/home·detail·use·shop.jpg`, 390×844)가 1·3·7·9·15 장에, 셀러 화면 4장(`shots/seller-*.jpg`)이 8·10·11·12 장에 들어갑니다.
  다시 찍으려면 아래 캡처 절차 그대로. 캡처 폴더를 `SHOTS_DIR` 로 넘기면 되고, 없으면 빈 슬롯으로 그립니다.
- **셀러 대시보드 화면(8·10·11·12 장)은 셀러 계정 없이 찍었습니다.** `capture-seller-shots.mjs` 가 실제 urdeal.kr
  프론트를 띄우되 `/api/seller/*` 응답만 예시 데이터로 대체합니다(Playwright `route`). 로그인도, 프로덕션 쓰기도 없습니다.
  클라이언트 가드가 토큰의 `exp` 만 보므로 서명 없는 JWT 를 localStorage 에 넣어 화면을 엽니다. 슬라이드에는
  "예시 데이터로 렌더한 실제 화면"이라고 적혀 있습니다. 화면 UI 가 바뀌면 다시 찍으세요:
  ```bash
  NODE_USE_ENV_PROXY=1 NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules:/opt/node22/lib/node_modules:/tmp/deck/node_modules \
    node docs/business/proposals/capture-seller-shots.mjs /tmp/shots
  ```
  🩸 처음엔 `/seller/stores` 가 에러 경계로 떴습니다. 알림 벨(`/api/dashboard-notifications`)·유입 바인딩이 401 을 내면
  소비자용 클라이언트가 throw 하고, `ReviewBonusCard` 가 `/api/seller/stores/review-bonus` 의 빈 배열에 `.toLocaleString()` 을
  부릅니다. 그 엔드포인트들을 이름을 밝혀 명시적으로 모킹한 것이 해결책입니다(무차별 401→200 치환은 하지 않습니다).

### PDF 로 뽑으려면 (리눅스)
`libreoffice-impress` + `fonts-nanum` + `python3-uno` 가 있어야 합니다. 맑은 고딕을 나눔고딕으로
매핑하는 fontconfig alias 를 두고, `export-pptx-to-pdf.py <in.pptx> <out.pdf>` 를 돌립니다.
이 스크립트가 LibreOffice 의 "아시아/비아시아 문자 간 자동 여백" 문단 속성을 꺼서 "월 12 만원" 처럼
벌어지는 표시를 없앱니다(PowerPoint 원본엔 없는 현상). 차트 안 글자는 별도 객체라 여백이 남고, **pptx 표(addTable) 셀도 보정이 안 먹습니다** —
그래서 5 장의 규모별 표는 표 객체가 아니라 텍스트 상자로 그립니다.

## 인플루언서 제휴 소개 (.pptx) 다시 만들려면

사장님 덱과 같은 절차다. 캡처는 `capture-seller-shots.mjs` 의 `influencer-offer`(제안 수락, 예시 데이터) ·
`influencer-settlement`(내 정산, 예시 데이터) · `ushop`(라이브 `/u/jiwon1228`) · `creators-apply`(라이브 신청 폼) 네 장.

```bash
cd /path/to/ur-live/docs/business/proposals && node urdeal-influencer-deck.build.mjs out.pptx
python3 export-pptx-to-pdf.py "$PWD/out.pptx" "$PWD/out.pdf"   # 절대경로만 받는다
```

정산 문구는 `src/worker/cron/influencer-payout.ts` 실값이다(T+7 확정, 매월 1일 집계, 현금 10만원부터, 딜은 하한 없음,
지급은 어드민이 처리). `/videos`(유어쇼츠) 캡처는 이 환경이 유튜브를 막아 재생기 자리가 비므로 덱에 넣지 않았다.

## 어드민 화면 캡처 (`capture-admin-shots.mjs`)

자동화 어드민 계정(환경변수 `URDEAL_ADMIN_EMAIL` / `URDEAL_ADMIN_PASSWORD`)으로 `/admin/influencer-pool` 을 데스크톱으로 열어
연락처(이메일 · 인스타/틱톡 핸들)만 블러 처리한 뒤 통계 카드 줄과 목록 표를 잘라 저장한다. 사장님 덱 4장이 `shots/admin-influencer-pool-table.jpg` 를 쓴다.
토큰은 메모리에만 두고 파일로 남기지 않는다. 브라우저 이그레스가 막힌 환경이라 요청을 node fetch 로 대신 보낸다(캡처 스크립트들과 같은 방식).
아바타는 외부 CDN 이라 못 받아 중립 원으로 바꿔 그린다.

```bash
NODE_USE_ENV_PROXY=1 NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules:/opt/node22/lib/node_modules:/tmp/deck/node_modules \
  node docs/business/proposals/capture-admin-shots.mjs <출력 폴더>
```
