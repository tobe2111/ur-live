# PII at-rest 암호화 — 활성화 롤아웃 설계 (flip 패턴)

> 대표 확정(2026-07-13): **인프라·플래그는 코드로 지금**, **라이브 실제 암호화 스위치는 staging 검증 후**.
> flip·경로 B 와 같은 패턴 — 준비는 지금, 켜는 건 검증 후. 이 문서 = 켜기 위한 순서·게이트.

## 현재 상태 (완료 — 라이브 무영향)

- `src/worker/utils/pii-crypto.ts`
  - `piiEncryptionEnabled(env)` — `PII_ENCRYPTION_ENABLED==='true'` + 키 존재일 때만 true. 기본 OFF.
  - `encryptPii(v, env)` — 쓰기 암호화(OFF/키없음/빈값이면 원본, never throw).
  - `decryptPii(v, env)` — 읽기 복호화, **dual-read**(암호문↔평문 혼재 허용), 실패 시 원본.
  - `blindIndex(v, env)` — 조회키용 결정적 HMAC-SHA256(hex). `WHERE bidx=?` 로 등가 조회.
- env: `PII_ENCRYPTION_ENABLED`(마스터 스위치, 기본 OFF), `PII_BLIND_INDEX_KEY`(선택, 없으면 DATA_ENCRYPTION_KEY 파생).
- **어떤 라이브 읽기/쓰기 경로도 미배선** — 순수 인프라. 기존 동작 byte-불변.

## 왜 지금 켜면 안 되나 (blind big-bang 금지)

1. **조회키 컬럼**(`users.kakao_id`·`users.email`·`users.phone`): `WHERE = ?` 로 조회. 랜덤 IV AES-GCM 은 매번 다른 암호문 → 등가 조회 불가 → **암호화하면 로그인/계정매칭 전면 붕괴**. 반드시 **blind index 컬럼**(결정적 HMAC)을 추가하고 조회를 그쪽으로 dual-mode 전환해야 함.
2. **표시 지점 산재**: 이름/이메일/전화 표시가 raw SQL 로 코드 전역. 복호화 미배선 지점은 암호문 노출.
3. **이 원격환경은 배포·테스트 불가**(npm 403) → 검증 없이 켜면 확인 불가. → staging 필수.

## 활성화 순서 (staging 전용 세션)

각 단계는 **OFF 상태에서 안전하게 배선**(dual-mode/dual-read) → 마지막에만 스위치 ON.

### 1. 스키마 (blind index 컬럼 추가 — repair-schema 등록)
조회키 컬럼별 인덱스 컬럼 + UNIQUE/조회 인덱스:
- `users.kakao_id_bidx`, `users.email_bidx`, `users.phone_bidx` (필요 시 `sellers.business_number_bidx`).

### 2. 쓰기 배선 (dual-write, 여전히 OFF 라 평문)
PII 를 INSERT/UPDATE 하는 지점(대표: `KakaoAuthService.upsertUser`)에서:
- 값 = `encryptPii(v, env)` (OFF 면 평문 그대로), 인덱스 = `blindIndex(v, env)` (키 있으면 채움).
- OFF 에서도 blind index 는 채워둘 수 있음(조회 dual-mode 준비) — 단 표시값은 평문 유지.

### 3. 조회 배선 (dual-mode)
`WHERE kakao_id=?`·`WHERE email=?` 등 조회지점을 `bidx` 우선 + 평문 폴백으로:
`WHERE kakao_id_bidx = ? OR kakao_id = ?` (인덱스 값 있으면 인덱스로, 없으면 평문). 마이그레이션 중 혼재 안전.

### 4. 표시 배선 (decryptPii)
이름/이메일/전화를 사용자·어드민에 반환하는 지점을 `decryptPii(v, env)` 경유. dual-read 라 평문도 OK.

### 5. Backfill (기존 평문 → 암호문 + 인덱스)
admin 전용·멱등·배치 재암호화 엔드포인트로 기존 행을 `encryptPii`+`blindIndex` 로 갱신(플래그 ON 후 또는 인덱스만 먼저).

### 6. 스위치 ON + 검증
`PII_ENCRYPTION_ENABLED='true'` → 신규 쓰기 암호화. staging 실검증: 카카오 로그인(bidx 조회)·프로필/어드민 표시(복호화)·검색·same-email 자동연결 전부 통과 확인. 이후 prod.

## 대상 컬럼 분류 (정밀 매핑 — 2026-07-13)

### 표시전용(DISPLAY-ONLY) = blind index 불필요, 복호화만 (안전·우선)

**A. `sellers.bank_account`(+`bank_name`/`account_holder`) — 🥇 첫 파일럿 (가장 민감·경계 명확)**
- **쓰기 1경로**: `seller-profile.routes.ts:258`(UPDATE, bankChanged 게이트) + `:288`(per-col fallback). → 여기서 `encryptPii`.
- **읽기 10지점**(전부 `WHERE id=?`, 조회키 아님): seller-profile.routes.ts:71·296(이미 `maskBankAccount` — **복호화를 마스킹 前에**), seller-account.routes.ts:67, admin-sellers.routes.ts:81·96·111·168, payouts-generate.ts:83, admin-payouts.routes.ts:127, restaurant-settlement.routes.ts:129~131. → 각 지점 `decryptPii`.
- ⚠️ **파생 스냅샷**: 정산/지급 시 `payouts.account_number`·`settlements.account_number`·`user_withdrawals.bank_account` 로 평문 복사(payouts-generate.ts:106 등). 이 파생 컬럼도 암호화할지 별도 결정(같은 비밀 보유).

**B. `shipping_addresses.address/address_detail/phone/recipient_name`**
- 쓰기 2지점(dbHelper insert/update: shipping-address.routes.ts:198/203·305), 읽기 5지점(:124·209·289·307·348, 전부 id/user_id 키). 조회키 없음.
- ⚠️ 주문 스냅샷 `orders.shipping_address/…recipient_name` 은 별도 컬럼 — 별도 결정.

**C. `sellers.business_number`** — 코드에 등가조회 없음(`idx_sellers_business_number` 인덱스는 있으나 equality 미사용). 표시/세금계산서 ~25지점(전부 id 키). ⚠️ 인덱스 dedup 유일성에 의존한다면 blind index 필요(random-IV 가 유일성 깨뜨림).

### 조회키(LOOKUP KEY) = blind index 필수

**D. `users.kakao_id` — 순수 등가(`= ?`), blind index 로 전부 복원**
- 로그인 핫패스 3: KakaoAuthService.ts:296·304·449. + deleted_accounts: KakaoAuthService.ts:269, delete-account.service.ts:318·342·387. + admin dedup admin-users.routes.ts:459. (총 8)
- ⚠️ **`deleted_accounts.kakao_id`** 도 등가비교 — 같은 blind index 배선 필요.

**E. `users.email` — 등가는 blind index 가능하나 ⛔ LIKE 검색이 차단 이슈**
- 등가: auth.routes.ts:63·134(비번로그인), KakaoAuth:394(takeover)·517(auto-link COUNT), GoogleAuth:92, delete-account:409, admin dedup:458.
- ⛔ **admin 부분검색 LIKE**: admin-users.routes.ts:78·81, admin-misc.routes.ts:235 — exact HMAC blind index 로 **불가**. 검색 재설계/포기 결정 필요.
- ⚠️ **커플링**: `users.email` 암호화 시 `sellers.email`(auto-link 조인 KakaoAuth:516, LOWER 매칭)도 함께 안 하면 same-email 자동연결이 조용히 끊김.

**F. `users.phone` / **G. `users.name`** — 등가 dedup(admin-users:460/456)만 blind index 가능, LIKE 검색(admin-users:78/81, admin-misc:235)은 불가. name 은 매 로그인 덮어씀(KakaoAuth:339 → 매 로그인 index 재계산). phone 표시읽기 ~10(전부 id 키 SMS/알림).

### 권장 순서
**A(bank_account) → B(shipping) 파일럿(표시전용, blind index 0, staging 검증 쉬움) → D(kakao_id, 순수 등가) → E/F/G(email/phone/name — LIKE 검색 재설계 선결).** email 은 sellers.email 동반 필수.

## 롤백
스위치 OFF → 신규 쓰기 평문. 기존 암호문은 dual-read 로 계속 복호화(키 유지 필요). 키 폐기 금지(암호문 복구 불가).
