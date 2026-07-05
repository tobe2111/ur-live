# 파트너 약관-as-계약 (에이전시·셀러 온보딩) — 설계 스펙

> 출처: 2026-07-04 대표 지시(구두 스펙). "계정 발급 = 계약 체결. 종이계약 없이 시스템(약관 동의)이
> 계약을 대신한다. 셀러 입점도 같은 원리." **기능 요건** — 에이전시(그리고 셀러) 가입 시 약관 동의가 필요.
> 채팅은 휘발되므로 즉시 박제(디자인 룰).

## 0. 위치 — 에이전시/셀러 온보딩의 기능 요건 (타이밍 중립)

이 문서는 **약관 동의를 가입 플로우에 넣는 기능 스펙**이다. 특정 계약/파트너 건과 무관하게, 에이전시·셀러
온보딩을 구현할 때 적용한다.

- 현재 에이전시는 `AGENCY_HIDDEN=true` 로 **셸브** 상태 → **지금 당장 재개/구현할 필요 없음**. 이 스펙은
  에이전시 온보딩을 (린하게) 구현/재개하는 시점에 그 가입 플로우에 반영한다.
- **셀러 온보딩은 지금도 라이브** → 약관 동의(clickwrap)는 **셀러 입점에 먼저 적용해도 됨**(에이전시와 공용 컴포넌트).
- **약관이 대체하는 범위 = 커미션/정산 관계(영입·판매수수료)만.** 성격이 다른 별건 용역은 여전히 별도 서면 계약.

## 1. 모델: 계정 발급 = 계약 체결 (clickwrap 계약)

가입 플로우 마지막에 **약관 동의(clickwrap)** 를 넣어, 승인/계정발급 시점에 **계약이 성립**한 것으로 본다.
법적 효력(전자문서·전자거래기본법 + 약관규제법)을 가지려면 아래 §2 의 4대 요건을 반드시 구현.

## 2. 약관규제법 4대 구현 요건 (법적 효력 확보 — 필수)

### ① 중요조항 개별 노출 + 개별 동의 (전체동의 하나로 뭉치기 금지)
"전체 동의" 체크 하나면, 분쟁 시 "그 조항은 설명 못 받았다"가 통할 수 있음(약관규제법 §3 명시·설명의무).
**아래 4개 중요조항은 각각 요약 박스로 노출 + 개별 체크박스**로 동의받는다(배민·쿠팡 입점 플로우 패턴):
1. **커미션율** (영입 가게 GMV의 %, 현행 코드 default 2% / 스펙 1% — §6 결정필요)
2. **24개월 한도** (영입 커미션 지급 상한 기간)
3. **환불 시 커미션 회수** (clawback — 환불되면 적립 커미션 역전)
4. **해지 조건** (파트너/회사 각각의 해지 사유·절차)

### ② 동의 기록을 버전과 함께 저장
누가·언제·**약관 몇 번째 버전**에 동의했는지 DB 영속. 약관은 살아있는 문서 → 버전 없으면
"내가 동의한 건 그 내용이 아니다"에 대응 불가. 최소: `subject`, `terms_type`, `terms_version`,
`agreed_at`, `per_clause_consent`(4개 개별), `ip`, `user_agent`.

### ③ 요율 변경 절차를 약관에 미리 포함
커미션율은 어드민 조정값(`agencies.commission_rate`) → 약관에 다음 조항이 **미리** 있어야 나중에 만질 수 있음:
> "요율은 회사 정책에 따라 변경될 수 있으며, **파트너에게 불리한 변경은 시행 30일 전 고지**하고,
> 파트너가 동의하지 않으면 계약을 해지할 수 있다."

이 조항 없이 요율 변경 = 계약 위반. (운영 배선: 요율 상향 등 불리한 변경 시 30일前 고지 + 재동의/해지 옵션 → §4 Phase 2)

### ④ 가입 시 사업자번호 검증
에이전시는 세금계산서 발행·원천징수 면제 판단이 걸려 **사업자 필수**. 셀러 입점처럼 사업자번호 검증을
가입 필수 단계로. (✅ 셀러는 이미 `business_number`·`business_registration_status/image/verified_*` 보유 → 에이전시에 동형 이식)

## 3. 현황 vs 신규 (구현 스코프)

| 항목 | 현황 | 필요 |
|---|---|---|
| clickwrap 약관동의 시스템 | ❌ 없음 (정적 `TermsOfServicePage`만) | **신규** — 버전관리 약관 + 개별동의 UI + 동의기록 테이블 |
| 사업자번호 검증 | ✅ 셀러 보유(`sellers.business_number` 등) | 에이전시에 **동형 이식** + 셀러 온보딩에도 약관동의 연결 |
| 에이전시 가입 페이지 | 얇은 "카카오로 권한 신청"(`AgencyRegisterBusinessPage`) | 사업자번호 + 약관 4체크 단계 **추가** |
| `agencies` 테이블 | commission_rate만 | `business_number`·`business_registration_*`·`agreed_terms_version` 추가 |
| 요율 변경 고지 배선 | ❌ 없음 | Phase 2 (불리 변경 30일 고지·재동의/해지) |

## 4. 구현 계획

### DB 스키마 (신규)
```
-- 버전관리 약관 문서 (agency / seller 별)
partner_terms(
  id, terms_type TEXT('agency'|'seller'), version INT, effective_from,
  title, body TEXT,               -- 전문
  key_clauses JSON,               -- ①의 4개 중요조항 {commission_rate, cap_24m, clawback, termination} 요약문
  is_active INT, created_at
)  -- UNIQUE(terms_type, version)

-- 동의 기록 (계약 성립 증거)
partner_terms_agreements(
  id, terms_type, terms_version,
  subject_type TEXT('agency'|'seller'), subject_id INT, user_id INT,
  per_clause_consent JSON,        -- {commission_rate:true, cap_24m:true, clawback:true, termination:true}
  agreed_at, ip_address, user_agent, created_at
)  -- UNIQUE(subject_type, subject_id, terms_type, terms_version)  ← 멱등

-- agencies 컬럼 추가 (repair-schema 경유, sellers 미러)
ALTER agencies ADD business_number / business_registration_status / _image_url / _verified_at / agreed_terms_version
```

### UI (재사용 컴포넌트)
- **`PartnerTermsConsent`** — 중요조항 4개를 각각 요약 박스 + 개별 체크박스로 렌더, 전문 링크, 4개 전부
  체크해야 '동의하고 계속' 활성. **에이전시·셀러 공용**(props: `termsType`, `keyClauses`).
- 라이트 standalone 페이지면 `force-light-theme` 필수(로그인 입력 가드 룰).

### 플로우 (에이전시 · 셀러 동일 골격)
1. 카카오 인증 → 2. **사업자번호 입력·검증**(④) → 3. **`PartnerTermsConsent`** 4개 개별동의(①) →
4. 제출 시 계정 생성(status pending) + **동의기록 INSERT**(②: agreed_at·terms_version·per_clause·ip) →
5. 어드민 승인 = **계약 성립**. 동의기록이 계약 증거.

### Phase 2 (요율 변경 배선 — ③의 운영측)
어드민이 `commission_rate` 를 **불리하게**(파트너 몫 감소) 변경 시: 변경예약 이벤트 기록 → 파트너에게
**30일 전 고지**(대시보드/알림) → 30일 후 발효, 그 사이 파트너는 해지 가능. (현행 즉시반영과 별개 게이트)

## 5. 서비스 분리 주의
이건 **소비자 유어딜 축**(에이전시=매장영입 파트너 / 셀러=사업자 유저). 도매몰(판매사·제조사)과 무관 —
도매 온보딩 약관은 별도. 명칭 SSOT 준수(에이전시/사업자 유저).

## 6. 미결 결정 (대표 확인 필요 — 구현 착수 전)
1. **적용 대상·순서**: 셀러 온보딩(라이브)에 먼저 적용 vs 에이전시 재개 시점에 맞춰? (공용 컴포넌트라 어느 쪽이든 무방)
2. **약관 실제 문언**: 4개 중요조항 + 전문의 **법적 텍스트는 누가 제공**(대표/법무)? — 시스템은 구현 가능하나
   구속력 있는 약관 문안은 개발자가 창작 불가. 문안 확정 = version 1. (착수의 실질 블로커)
3. **커미션율 표기**: 스펙의 **1%** vs 현행 코드 default **2%** (SSOT §13 "에이전시 2→1% cutover gated"). 약관 ① 문구에 들어갈 값 확정.
4. **에이전시 재개 여부**: 에이전시 온보딩 구현은 `AGENCY_HIDDEN` 해제를 전제. 지금은 셸브 유지(급하지 않음).

## 구현 로그
- (미착수) — 본 문서는 스펙 박제. 위 §6 결정 후 착수.
