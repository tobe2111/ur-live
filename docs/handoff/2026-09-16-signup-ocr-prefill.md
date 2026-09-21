# 2026-09-16 — 가입 앞문 등록증 자동 채움 + 제출 전 확인 (PR #1491)

대표 참고 시안 5장(당근비즈니스풍) 중 **④ 제출 전 확인 · ⑤ 정보를 확인해 주세요**.
①② 주소 검색은 #1489 에서 이미 머지됐다.

## 다음 세션의 첫 액션

```bash
curl -sS https://api.github.com/repos/tobe2111/ur-live/pulls/1491 \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['state'],d['draft'],d.get('mergeable_state'))"
```

- **`open True clean` 이면 대표 검토 대기다.** 초록이어도 머지하지 말 것 — 대표가 내용을 아직 안 봤다.
- 대표가 승인하면 머지 → 배포 후 **E4 판정**: 실제 사업자등록증 사진 한 장으로
  `/seller/register/supplier` 에서 칸이 채워지는지. **정확도는 여기서만 잰다**(단위시험은 못 잰다).
- 프리뷰: `https://signup-ocr-prefill.ur-wholesale.pages.dev/seller/register/supplier`

## 완료분

| 무엇 | 어디 |
|---|---|
| 업로드 라우트에 opt-in OCR(`ocr=1`) | `features/upload/api/upload.routes.ts` |
| 추출값 모양 SSOT | `shared/ocr-prefill.ts` (신규) |
| 부품이 `onRead` 받을 때만 요청 | `components/BusinessCertUpload.tsx` |
| 빈 칸에만 채움 + '사진에서' 딱지 | `pages/SellerRegisterSupplierPage.tsx` `applyOcr` |
| 제출 전 확인 시트 | `pages/seller-register/ReviewSheet.tsx` (신규) |
| 가드 17건 + 주입 10건 | `tests/unit/seller-signup-ocr-2026-09-16.test.ts` · `scripts/mutations/seller-signup-ocr.mjs` |

머지 완료: **#1492**(감사 불변식 개수 113→114 — main 수리) `bf690c84e`.

## 🩸 이번에 틀렸던 판단 — 여기가 제일 값지다

### ① 로컬 주입 검증을 **너무 좁게** 돌렸다
`check-guard-mutations.mjs --only=가입OCR` 로 **내가 새로 만든 10건만** 돌리고 푸시했다.
CI 가 잡은 건 **기존 가드 4건**이었다 — 내 코드 변경이 남의 앵커를 옮겨 놓은 것.

⇒ **푸시 전에는 `--only` 가 아니라 `--changed` 를 돌릴 것.** pre-push 게이트는 이 검사를
CI 로 넘기므로(EXCLUDE 3건 중 하나) 로컬에서 자동으로 안 돈다. 손으로 불러야 한다.

### ② "못 찾으면 통과" — 같은 함정에 **두 시험이** 걸렸다
둘 다 내가 오늘 만든 것이고, 확인 시트를 붙이며 코드가 이동하자 조용히 헛돌았다.

| 시험 | 어떻게 헛돌았나 |
|---|---|
| `register-front-door-cert` | `async function submit` 부터 잘라 게이트를 찾는데, 검사가 앞의 `review()` 로 옮겨 가 **잘라 낸 구간이 거의 비었다** |
| `seller-signup-c` | `indexOf('onClick={submit}')` 가 **-1** → `slice(-1)` 이 **마지막 한 글자** |

⇒ 앵커는 **먼저 찾았는지 확인**하고, 못 찾거나 구간이 짧으면 **통과가 아니라 실패**로.

### ③ 렌더가 또 코드로 못 본 결함을 잡았다 (네 건)
가장 큰 것: **등록증 칸이 채워 줄 세 칸 *밑*에 있었다.** 사장님이 세 칸을 손으로 다 친
**뒤에야** *"사진을 올리면 채워 드려요"* 를 읽는다 — 자동 채움이 아무 일도 안 하는 배치였다.
나머지: 업로드 버튼 이모지 · 시트가 하나도 안 읽었을 때도 "사진에서 채운 값" 이라고 함 ·
`사업자등록증` 이 행과 '남는 것' 에 두 번.

### ④ 감사 불변식 개수는 **동시 머지에 구조적으로 취약하다**
#1483·#1485 가 각각 가드를 더하며 **각자의 base(112)에서 113 으로** 올렸다. 둘 다 혼자서는
옳았는데 합쳐지니 실제 114 · 문서 113 → **레포의 모든 PR 이 빨간불**. #1492 로 수리.
handoff 파일·시드 버전이 이미 겪은 그 클래스다(둘 다 구조를 바꿔 해결했다).

## 남은 결정 / 대기

1. **중개사 5단계 (대표 판단)** — 중개사가 어떻게 돈을 받는가.
   (a) 플랫폼 밖에서 직접 / (b) 매장 promo 재원에서 적립(세션 추천).
   머니 경로 = 등급 C → 결재 + 단독 세션 + staging 실결제. **6단계(해지)도 미정.**
2. **다음 우선순위 (대표 판단)** — 참고 시안 ②(핀 드래그 역지오코딩) · ③(등록증/영업신고증 `0/2` 슬롯).
   ⚠️ **③ 은 당근 모델과 정면으로 부딪친다**(문 앞에서 서류를 요구하지 않는다) — 방향부터 정할 것.
   서버도 붙는다: 영업신고증을 가입 payload 로 받아 `seller_meta.food_permit_url` 에.
3. **`slice(indexOf())` 앵커 함정 — 레포에 216건** (`src/tests/**`). 지금은 앵커가 살아 있어
   안 터지지만 위 ②와 같은 클래스다. 확인된 잔여 3곳:
   `danggeun-approval-gates-2026-09-16.test.ts:60,236` · `payout-use-gate-2026-09-16.test.ts:204`.
   ⚠️ **다만 이건 주입 러너가 이미 결과를 잡는다**(오늘 실제로 잡았다) — 래칫 가드를 새로 만들지,
   216건을 그냥 동결할지는 대표/다음 세션 판단. 세션이 제안만 하고 안 만들었다.
4. **E4 미판정**: 사용 확인 게이트(0 attributions 라 효과 측정 불가) · OCR 정확도.
