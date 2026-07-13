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

## 대상 컬럼 분류 (조회키 = blind index 필요 / 표시전용 = 복호화만)

> 정밀 file:line 지점 매핑은 활성화 세션에서 재확인. 분류 기준:

| 컬럼 | 분류 | 처리 |
|---|---|---|
| `users.kakao_id` | 🔑 조회키(카카오 로그인) | blind index + dual-mode 조회 |
| `users.email` | 🔑 조회키(로그인·same-email 연결·검색) | blind index + dual-mode + 검색은 bidx/LIKE 정책 결정 |
| `users.phone` | 🔑 조회키(검색·선물) + 표시 | blind index + 복호화 |
| `users.name` | 표시전용(+full-state dedup) | 복호화(dedup 은 bidx 선택) |
| `sellers.bank_account`(+holder/bank) | 표시전용(정산/어드민) | **최우선 안전 타깃** — 복호화만, 조회 없음 |
| `shipping_addresses.address/phone/recipient_name` | 표시전용(주문/배송) | 복호화만 |
| `sellers.business_number` | 조회 가능성 | 확인 후 조회키면 blind index |

> 권장: **`sellers.bank_account`(가장 민감·조회 없음) 를 첫 파일럿**으로 end-to-end 배선·검증 후, 조회키 컬럼(email/kakao_id/phone)으로 확대.

## 롤백
스위치 OFF → 신규 쓰기 평문. 기존 암호문은 dual-read 로 계속 복호화(키 유지 필요). 키 폐기 금지(암호문 복구 불가).
