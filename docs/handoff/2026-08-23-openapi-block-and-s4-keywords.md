# 2026-08-23 — 오픈API 차단 자동 방어 + 4단계 고수율 키워드 (유어애즈)

대표 지시 *"모두 다 하자"* — 전날 "영구적이야?" 에 대해 제가 지목한 **비영구 갭 2건**을 마감한 세션.

## 다음 세션의 첫 액션

배포 후 24시간 뒤 아래 두 값을 본다(둘 다 KST 기준일).

```bash
# ① 차단 관측 — blocked 가 0 이어야 정상. 0 이 아니면 tripped 여부와 last_status 를 본다
#    (어드민 토큰 $TOK 취득은 CLAUDE.md "어드민 진단 접근" 절차)
D1=d4630482-b97e-4e96-bb96-abde4ef8cc95   # ADS_DB
#    ads_naver_openapi_block / ads_webkr_stats 는 platform_settings(메인 DB) 에 있다
#    → 메인 D1 d9530ba6-7a26-4c02-9295-3ce5aef112a3
SELECT value FROM platform_settings WHERE key IN ('ads_naver_openapi_block','ads_webkr_stats');

# ② 4단계 키워드가 실제로 시드됐는가 (ADS_DB)
SELECT COUNT(*) FROM ad_company_keywords WHERE keyword LIKE '%SNS 마케팅 대행';   -- 기대 ≈235
SELECT value FROM platform_settings WHERE key='ads_company_kw_seed';             -- "5:<n>:<hash>"
```

**판정**: `ads_company_kw_seed` 가 `5:` 로 시작하고 n 이 전체 행 수(≈5,965)에 도달하면 시드 완료.
시드 청크가 회당 500이라 **3회차(≈3시간)** 걸린다. `5:` 로 안 바뀌면 `resumeSeedIndex` 지문이
어긋난 것 — 그때는 앞부분이 밀렸다는 뜻이므로 grid 의 spread 순서를 먼저 볼 것.

## 완료분

| 것 | 파일 | PR |
|---|---|---|
| 오픈API 429/403 연속 감지 + 게이트 + 일별 카운터 | `naver-openapi-block.ts`(신규) · `webkr-search.ts` · `webkr-collect.ts` | (이 PR) |
| 4단계 고수율 키워드 6업종 × 235 시군구 | `company-keyword-grid.ts` · `company-collect.ts`(시드 v5) | 〃 |
| 가드 7건(총 416) · 되돌려-검증 완료 | `ads-naver-openapi-block.test.ts`(신규) · `company-keyword-grid-s4.test.ts`(신규) · `check-guard-mutations.mjs` | 〃 |

검증: 유닛 5,708 pass(443 파일) · tsc 0 · audit-gate **ALL GREEN 88** · 주입 잔재 0.

## 이번에 틀렸던 판단 (제일 값진 것)

1. **"네이버 차단 자동 방어가 없다"의 범위를 틀리게 잡았다.** 대표에게 그렇게 보고한 뒤 실제로
   `naver-crawl-block.ts` 를 읽어 보니 그건 **공개 페이지 크롤**(m.blog / rss) 전용이었다. 진짜 갭은
   그게 아니라 **오픈API 경로에 streak 추적이 아예 없다**는 것이었다 — 결과적으로 결론(방어 0)은
   같았지만 근거가 달랐다. **파일 이름으로 커버 범위를 추정하지 말 것.**

2. **"신규 행 비율"을 발굴 가치로 읽었다.** 전날 간판·광고물 제작이 신규 행 99.6% 로 1위라고
   보고했는데, 이메일 수율로 다시 재니 **9.4% 로 최하위**였다. 인테리어는 2,876행에 이메일 14건(0.5%).
   ⇒ **행이 늘어나는 것과 발송 가능 리드가 늘어나는 것은 다른 축이다.** CLAUDE.md 가 못 박은 지표
   ("제안 보낼 수 있는 리드 수")로 재지 않으면 확장 방향을 정반대로 잡는다. 매장 생태계 업종
   전국 확장을 이 근거로 **하지 않기로** 했다.

## 남은 결정 / 대기

- **회전 주기**: 키워드가 4,555 → ≈5,965(+31%). 신선 키워드 우선 픽이 있어 새 업종은 먼저 돌지만,
  기존 광맥의 재방문 간격은 그만큼 늘어난다. 배포 1주 뒤 `saved_total` 증가율이 +31% 미만이면
  확장이 희석으로 작용한 것 — 그때 4단계를 tier 2 로 낮추는 것을 검토(대표 판단 불필요, 데이터로).
- **차단 시 백오프는 없다.** 이 방어는 "회차 안의 손실 차단"까지다. 다음 인보케이션은 모듈 스코프가
  새로 시작하므로 자동으로 다시 쏜다(영구 정지가 더 나쁜 실패라 의도한 것). 라이브에서 blocked 가
  지속적으로 잡히면 그때 회차 간 백오프를 별도로 설계할 것 — **지금은 관측 근거가 0이라 안 만든다.**
