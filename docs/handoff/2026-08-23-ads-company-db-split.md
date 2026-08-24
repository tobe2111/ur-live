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

## 4. 현재 상태 (세션 종료 시점)

- 업체 키워드 4,555행 ✅ 이관·행수 일치
- 업체 리드 358,537행 ⏳ 이관 중 (약 45분 소요, 15,000행/2분)
- 코드 ✅ tsc 0 · 유닛 6건 · 매니페스트 411개 통과
- **PR 미머지** — 이관·검증이 끝나기 전에는 머지하지 않는다

## 5. 🩸 이번에 틀렸던 판단

**"유어애즈 DB 16시간 남았다"** 고 대표에게 보고했는데 **가장 가파른 구간(1.78MB/h)만 보고 단정**한 값이었다.
직후 구간은 0.42MB/h 였고, SQLite 파일은 **덩어리로 자란다**. 실제 시한은 16시간~3일 폭이다.
⇒ **주기가 있는 계에서 좁은 창으로 외삽하지 말 것.** 이 세션에서만 같은 실수를 두 번 했다
(하트비트 침묵을 예산 탓으로 오진 → 실제로는 DB 포화).
