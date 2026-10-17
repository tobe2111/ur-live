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
