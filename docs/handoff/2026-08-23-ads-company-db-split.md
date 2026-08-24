# 2026-08-23 — 유어애즈 DB 2차 분리: 업체 계열 → `urads-company-db`

## 0. 다음 세션의 첫 액션

**이관이 끝났는지, 그리고 유실이 없는지부터 확인한다. 검증 전에는 옛 테이블을 절대 지우지 않는다.**

```bash
# 1) 행 수 대조
python3 - <<'PY'
import json,urllib.request
CF='https://api.cloudflare.com/client/v4'; A=open('/tmp/cfa.txt').read().strip(); T=open('/tmp/cft.txt').read().strip()
OLD='d4630482-b97e-4e96-bb96-abde4ef8cc95'; NEW='0e9a8f82-32fb-4584-878c-cdaec6c0aff0'
def q(sql,db):
    r=urllib.request.Request(f'{CF}/accounts/{A}/d1/database/{db}/query',
      data=json.dumps({'sql':sql}).encode(),
      headers={'Authorization':f'Bearer {T}','Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))['result'][0]['results']
for t in ('ad_company_leads','ad_company_keywords'):
    a=q(f'SELECT COUNT(*) n FROM {t}',OLD)[0]['n']; b=q(f'SELECT COUNT(*) n FROM {t}',NEW)[0]['n']
    print(f'{t:22s} 옛 {a:>8,}  새 {b:>8,}  {"일치" if a==b else "불일치"}')
PY
# 2) 키 집합 전수 대조 — 개수만으로는 판정 불가(서로 다른 행일 수 있다)
#    scratchpad 의 keydiff.py 를 OLD→NEW 로 돌린다.
```

## 1. 왜 (실측)

```
유어애즈 DB  471.7MB / 500MB = 94.3%   ← 본진에서 겪은 "꽉 차서 새 행 INSERT 실패" 재연 직전
증가 속도    0.4~1.8 MB/시간 (덩어리로 자람 — 좁은 창으로 단정하지 말 것)
```

**어느 테이블을 옮길지는 행 수가 아니라 실측 부피로 정했다:**

| 테이블 | 데이터 | 행 | 인덱스 | 예상 회수 |
|---|---:|---:|---:|---:|
| **ad_company_leads** | 50.0MB | 358,185 | 6 | **~150MB** |
| ad_influencer_leads | 75.8MB | 137,385 | 6 | ~115MB |
| store_prospects | 38.8MB | 220,773 | 4 | ~90MB |

⚠️ **데이터는 인플루언서가 크지만 인덱스는 행 수에 비례한다** — 업체가 358,185행 × 6인덱스라
항목이 2.6배 많아 실제 회수량이 가장 크다. 데이터 169MB / 파일 472MB 이므로 **300MB가 인덱스+오버헤드**다.

안전성 실측: 유어애즈 테이블끼리 **JOIN 0건**, **혼합 batch 0건**. 어느 조합으로 나눠도 쿼리가 안 깨진다.
그래도 업체 리드↔업체 키워드는 `company-discovery` 가 함께 쓰므로 **한 쌍으로 묶어** 옮긴다.

## 2. 무엇을 했나

- **라우터 3분기화** (`shared/ads/leads-db.ts`) — `company` / `ads` / `main`.
  `SIDE` 표식을 불리언 → 3값으로 바꿔야 batch 혼합 검사가 세 갈래를 구분한다.
  🔁 **`ADS_COMPANY_DB` 미바인딩이면 `ADS_DB` 로 폴백** — 배선 선배포가 안전하다.
- `wrangler.toml` · `wrangler-ads.toml` 에 Worker 바인딩 추가(대표가 Pages 는 완료).
- 새 DB에 스키마 복제(테이블 2 + 인덱스 5, 컬럼 전수 일치 확인).
- 가드 `ads-company-db.test.ts` 6건 + 주입 매니페스트 2건. **되돌려-검증 3종 빨강 확인.**

## 3. ⚠️ 순서를 어기면 사고다

```
이관 → 검증(키 대조) → 배선 배포 → 화면 확인 → **그 다음에만** 옛 테이블 정리
```
- **배선을 먼저 배포하면** 읽기가 아직 덜 찬 새 DB로 가서 업체 화면이 부분만 보인다.
- **검증 없이 옛 테이블을 지우면** 못 옮긴 행이 영구 소멸한다.
어제 본진 정리 때 이 순서를 지켜 유실 0 이었다 — 같은 절차를 그대로 쓴다.

## 4. 현재 상태 (2026-08-24 10:50 KST 갱신)

**이관 완료 · 키 집합 전수 대조 유실 0 (양방향).**

```
ad_company_leads       옛 358,672  새 358,672   옛에만 0 · 새에만 0
ad_company_keywords    옛   5,965  새   5,965   옛에만 0 · 새에만 0
```
(키워드 1,410행이 뒤처져 있어 `catchup.py` 로 따라잡은 뒤 재대조해서 0 을 확인했다.)

- 코드 ✅ tsc 0 · 유닛 6건 · 매니페스트 416개(main 414 + 2, 잃음 0)
- **PR #1199 (draft) CI 진행 중** — 이관·검증이 끝났으므로 이제 머지해도 된다
- ⚠️ **옛 테이블은 아직 안 지웠다** — 배포 후 따라잡기 이관·재대조 다음이다

## 5. 🩸 이번에 틀렸던 판단

**"유어애즈 DB 16시간 남았다"** 고 대표에게 보고했는데 **가장 가파른 구간(1.78MB/h)만 보고 단정**한 값이었다.
직후 구간은 0.42MB/h 였고, SQLite 파일은 **덩어리로 자란다**. 실제 시한은 16시간~3일 폭이다.
⇒ **주기가 있는 계에서 좁은 창으로 외삽하지 말 것.** 이 세션에서만 같은 실수를 두 번 했다
(하트비트 침묵을 예산 탓으로 오진 → 실제로는 DB 포화).


## 6. 🔥 시급도 (2026-08-24 10:50 KST 실측)

```
urads-company-db   144.9 MB / 500 MB = 28.97%   (새 DB — 이관분)
urads-leads-db     454.5 MB / 500 MB = 90.90%   ← 남은 여유 45.5 MB
```

증가 속도 0.4~1.8 MB/h 이므로 여유는 **약 26시간~4일**(폭이 넓다 — §5 교훈대로 좁은 창으로
단정하지 말 것). 옛 DB에서 업체 테이블 2개를 지우면 **약 145 MB 회수 → 62% 안팎**으로 내려간다.
본진 정리 때 `DROP TABLE` 이 `file_size` 를 **즉시** 반환하는 것을 실측했다(100% → 8.00%).

## 7. 배포 직후 런북 (이 순서 그대로)

```bash
cp <scratchpad>/.cfacc /tmp/cfa.txt; cp <scratchpad>/.cftok /tmp/cft.txt

# 1) 배포 창 동안 옛 DB로 들어간 유입분을 찾는다(키 집합 차집합)
python3 <scratchpad>/keydiff2.py          # → /tmp/lag_<table>.json 생성

# 2) 따라잡기 이관
python3 <scratchpad>/catchup.py ad_company_leads
python3 <scratchpad>/catchup.py ad_company_keywords

# 3) 재대조 — **옛에만 0 이 나올 때까지 반복**
python3 <scratchpad>/keydiff2.py

# 4) 어드민 업체 화면이 새 DB로 잘 읽는지 눈으로 확인(0건이면 중단)

# 5) 그 다음에만 옛 테이블 정리 + file_size 재측정
#    DROP TABLE ad_company_leads / ad_company_keywords  (옛 DB에서만)
```

⚠️ **4번을 건너뛰지 말 것.** 배선이 새 DB를 못 읽는데 옛 테이블을 지우면 되돌릴 수단이 사라진다.
지우기 전까지는 `ADS_COMPANY_DB` 바인딩을 떼는 것만으로 즉시 롤백된다(폴백이 옛 DB로 돌려보낸다).


## 8. 🩸 "유실 0" 의 범위를 좁게 봤다 (2026-08-24 정정)

§4 의 키 집합 대조는 **행이 존재하는가**만 본다. 옛 DB 는 이관 뒤에도 계속 enrich 되므로
**같은 행의 값이 갱신**되는데, 그건 키 대조로 안 잡힌다. 실측:

```
이관 시작(00:50) 이후 제자리 수정된 행   225건
   collected_at 144 · kakao_checked_at 57 · enrich_checked_at 36
```

옛 테이블을 그대로 지웠으면 이 225건이 **이관 시점의 옛 값으로 되돌아갔을** 것이다.
행 수는 맞으니 아무도 몰랐을 것이고 — 이 레포가 반복해 만난 "조용한 부재" 클래스다.

**조치**: `catchup2.py`(시각 컬럼으로 건드린 행을 골라 `INSERT OR REPLACE`)를 따라잡기
절차 §7 의 2b 단계로 넣었다. 다행히 **rowid 가 보존**돼 있어(옛 max 625,228 / 새 625,102)
새 행과 수정 행을 둘 다 싸게 골라낼 수 있다.

⇒ **교훈: "몇 건인가"가 같다고 "같은 데이터"가 아니다.** 이관 검증은 존재·값 **둘 다** 봐야 한다.
