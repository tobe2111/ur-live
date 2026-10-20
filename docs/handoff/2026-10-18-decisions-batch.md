# 2026-10-18 결재함 셋 + 셀프 가맹점 한 줄 (대표 *"모두 가장 이상적으로 진행해줘"*)

## 다음 세션의 첫 액션
1. 이 브랜치 PR 의 Verify 가 head sha 에 초록인지 → 자동 머지 됐는지 확인(`gh api repos/tobe2111/ur-live/pulls/<번호> --jq '{merged,mergeable_state}'`).
2. 배포 뒤 E4 셋:
   - **유어샵 카드**: `urdeal.kr/u/jiwon1228` 에서 진열 카드를 눌렀을 때 주소가 `/u/…/p/…` 를 거치지 않고 `/pass/:id`·`/stays/:id` 로 바로 가는지(네트워크에 302 없음) · 같은 순간 `POST /api/curator/jiwon1228/p/<id>/click` 이 204 인지 · D1 `pin_click_logs` 에 행이 생기는지.
   - **줄표**: `curl -A '<Googlebot UA>' https://urdeal.kr/blog` 의 `<title>` 에 `—` 가 0 인지 · 소개 없는 유어샵(`/u/user5`)의 `description` 이 `…님이 고른 교환권·이용권 모음` 인지.
   - **측정량 경보**: 다음 09:00 KST 하트비트 `cron_hb:measure-volume` 이 `ok: true` + `measured_24h` 1만 안팎인지(`GET /api/admin/cron-heartbeats`).
3. 셀프 가맹점은 **게이트 OFF 라 라이브 변화 0** — 판정은 staging S-BRANDX-6·7(게이트 ON 전).

## 완료분
| 커밋 | 무엇 | 결재 |
|---|---|---|
| `c1cba7cf0` | 유어샵 진열 카드 → 상세 앱 안 이동. 소개 귀속(`storeAffiliateRef`) + 클릭 기록 비콘(`POST /api/curator/:h/p/:id/click`, 204). 302 경로는 공유 링크용으로 살아 있다 | `2026-10-15-ushop-pin-spa-nav` 안 1 |
| `00fa83ef9` | 유어애즈 알람 레인 침묵 임계 32 → 62분(`alarmLaneGapMinutes`) + 측정량 경보(`measure-volume`, 하루 5,000 미만 또는 못 셈 → 실패 하트비트) | `2026-10-15-ads-alarm-stall-alert` 안 2 |
| `c90a84d91` | 잠금 `worker/index.ts` 라이브 줄표 3곳 + 유어샵 설명 폴백 한 벌(`ushopDescFallback`). anti-slop 잠금 래칫 7 → 3 | `2026-10-14-locked-emdash` 안 1 |
| `0ff635a59` | 손님 셀프 사용도 받는 가맹점(다른 점주 지점) 열기 + 받은 지점 기록. 잠금 `group-buy-public.routes` 줄 수 1139 유지 | `2026-10-18-franchise-cross-owner-redeem` 후속 |

각각 가드 + 주입(6 · 5 · 3 · 4건, 전부 빨간불 확인).

## 이번에 틀렸던 판단
- 셀프 경로가 "다른 점주 지점을 안 받는다" 는 3단계의 **의도된 fail-closed** 로 적혀 있었는데, 결재 ①②③ 어디에도 셀프 경로 제외가 없다. 게이트를 켜면 카운터·스캔은 열리고 셀프만 조용히 막히는 비대칭이었다. ⇒ 결재 범위에 없는 제외는 결함으로 본다.
- `recordVoucherRedeemStore` 를 셀프에 넣을 때 원장 경로를 찾았는데, 셀프는 원장을 안 쓴다(주간 정산 `REDEEM_STORE_SETTLEMENT_SQL` 이 기록을 읽는다). 그래서 기록만으로 결재 ③(쓴 지점 정산)이 성립한다.

## 남은 결정/대기 (대표)
- 브랜드 3단계 게이트 ON(`brand_cross_owner_redeem_enabled`) — staging S-BRANDX-1~7 뒤.
- 브랜드 결제 E4(테스트 이용권 + 실결제) — 세션은 못 한다.
