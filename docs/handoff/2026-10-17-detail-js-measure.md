# 2026-10-17 — 이용권 상세 "JS 줄이기" 실측 → 방향 정정

대표 *"계속 해줘"* (다른 세션 계획의 1단계 = 상세 JS 줄이기).

## 결론: JS 무게는 병목이 아니다 (실측)

라이브 `/pass/2919` 를 느린 4G(1.6Mbps·150ms)·CPU 4배·아이폰 13 으로 3회 + CPU 프로파일:

| | 값 |
|---|---|
| FCP / LCP | 1.8~2.5s / 2.5~3.4s (히어로는 서버가 그린다 — 2026-09-15) |
| 프로파일 6.2s 중 | idle 4.2s · **(program) 1.3s** · 앱 JS 함수 self 합 ~0.6s |
| 상세 전용 JS | brotli ~27KB (boot 156KB + lz-common 17KB 위에) |

- 상세 전용 코드에서 첫 화면에 안 보이는 부품(PC 구매상자·셀러카드·선착순·공유보상 배너)을 전부 lazy 로 빼도 **raw 10KB ≈ brotli 3KB**.
- 2026-10-15 세션도 "상한 ~15KB ≈ 0.1초 — 효과 대비 위험이 커 보류" 로 같은 결론이었다. **이 방향으로 더 파지 말 것.**

## 한 것 (이번 PR)

- `passDetailDescription` 이 `toLocaleString('ko-KR')` 로 Intl 로캘 데이터를 첫 렌더에서 적재 — **라이브 64ms, 로컬 56~95ms @CPU×4** 를 혼자 썼다.
  → `formatNumber`(정수 빠른 길, Intl 과 같은 문자열) 로 교체. 수정 후 프로파일에서 그 함수가 사라짐.
  서버 출력 byte-동일(기존 라이브 픽스처 테스트 17건 통과).
- 가드 `pass-description-intl-free-2026-10-17.test.ts` + 주입 1건(빨간불 확인).

## 🩸 틀렸던 판단

- `DetailFloatingHeader` 가 마운트 effect 에서 `offsetHeight`/`scrollY` 를 읽어 강제 배치(프로파일 self 150~170ms)라 보고 첫 확인을 idle 로 미뤘다.
  **전후 5회 A/B: TBT 중앙값 946 → 862ms, 흔들림 ±200ms — 오차 안.** 배치 비용이 *옮겨 갔을 뿐* 없어지지 않은 것으로 보여 **되돌렸다.**
  ⇒ 프로파일 self 시간에 잡힌 "강제 배치"는 어차피 할 배치일 수 있다. **총 작업 시간 A/B 로만 판정할 것.**

## 다음 세션 첫 액션

1. 사본 판정(D1 replication) — `2026-10-15-sections-roundtrips.md` 의 2026-10-17 절. 내일 09:25 KST SLO.
2. 상세 개선을 계속한다면 JS 가 아니라 **(program) 1.3s** 의 정체(스타일 재계산·배치·파싱 중 무엇인가)를 Performance trace 로 먼저 가를 것.

## 🔁 후속(같은 날) — "(program) 1.3s" 의 정체 = **이 컨테이너의 한글 글꼴 부재**(착시)

Chrome 트레이스(라이브 `/pass/2919`, 느린 4G·CPU 4배) 메인 스레드 self 시간:

| | 글꼴 그대로 | 한글 글꼴 별칭 후 |
|---|---|---|
| `InlineNode::ShapeTextIncludingFirstLine`(글자 모양 계산) | **540~670ms** | 목록에서 사라짐 |
| JS(`FunctionCall`) | 390~590ms | 310~380ms |
| 배치(`performLayout`) | 106~249ms | 105~126ms |
| 스타일 재계산 | 44~154ms | 38~48ms |

- 이 컨테이너엔 `Apple SD Gothic Neo`·`system-ui` 한글 글꼴이 없어 글자마다 대체 글꼴을 찾는다 — 실제 폰엔 없는 비용이다
  (2026-10-14 `css-first-boot` 항목이 같은 함정을 적어 뒀는데 또 밟았다).
- **재는 법**: `~/.config/fontconfig/fonts.conf` 에 `Apple SD Gothic Neo`·`system-ui`·`-apple-system`·`sans-serif` → `WenQuanYi Zen Hei` 별칭 + `fc-cache -f`. 그 뒤에 잰 값만 폰 값으로 읽을 것.

글꼴을 맞춘 뒤 4회(라이브):

| TTFB | FCP | LCP | TBT@CPU×4 |
|---|---|---|---|
| 0.40~1.00s | 0.64~1.22s | **1.22~2.42s** | 145~211ms |

- LCP = 히어로 사진(51KB). HTML 도착 **~70ms 뒤** 출발해 그 다운로드가 끝나는 순간이 LCP 다 — 이미 바닥에 가깝다.
- ⇒ **상세의 클라이언트 쪽은 더 줄일 게 거의 없다.** 남은 지렛대는 TTFB(D1 사본 — 판정 대기)와 회선뿐.
  사진 화질을 낮추면 ~13KB(≈65ms) 를 얻지만 화질 교환이라 대표 판단이고 권하지 않는다.
- 🩸 **이 세션이 대표에게 "브라우저 자체 처리 1.3초를 갈라 보자" 고 올린 전제가 이 착시였다.** 정정했다.
## 🔁 후속 2 — 다른 화면 전수(글꼴 맞춤) → 두 가지 고침

| 화면 | 첫 그림 | LCP | 비고 |
|---|---|---|---|
| `/` | 0.7~1.5s | 1.8~3.3s | 양호 |
| `/u/jiwon1228` | 0.9~1.1s | = FCP | 양호 |
| `/vouchers` | **2.4~2.9s** | 3.6~4.0s | 서버 첫 화면이 있는데 CSS 먼저 미적용 |
| `/map` | 2.4~2.9s | 3.9~4.5s | 지도 타일(알려진 것) |
| `/stays` | 2.2s | **~5.0s** | 사진 15장 동시 출발 |

1. **`css-first-boot.ts` 적용 표면에 `/vouchers`·`/stays/:id`** — 10-12 제외 판정의 전제(스크립트에 달림)가 그 뒤 깨졌는데 목록만 안 따라왔다.
   A/B(라이브 HTML 에 같은 변환): 첫 그림 2.45 → 0.23s · 2.35 → 0.18s. 가드 ⑤-2 가 ROOTS 와 대조.
2. **`/stays` 첫 줄 첫 장만 `aboveFold`** — 전부 lazy 인데 느린 회선 lazy 여백이 커 15장이 3.36s 에 동시 출발.

⚠️ E4(배포 후): 라이브 `/vouchers`·`/stays/2887` HTML 에 `ur-modulepreload` · 첫 그림이 HTML 뒤 ~0.3s · `/stays` LCP 가 5s 에서 내려왔는지.
🔬 A/B 방법: playwright `page.route(target, fulfill(variantHTML))` — 문서만 바꾸고 나머지는 실제 회선. 부트 스크립트·`<style id="ur-critical">` 는 이미 적용된 `/pass/2919` 응답에서 복사했다.
