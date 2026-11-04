# 한국 손님이 서울(ICN) 대신 홍콩·도쿄·LA 서버로 붙는 문제에 돈을 쓸까요?

상태: open
등급: C
역할: dev
올린 날: 2026-11-04
기한: 2026-11-18

## 질문
지금은 유료 전환 없이 "한국 실측 계측 + 코드 최적화"를 계속하고, 2주 뒤 실측을 보고 다시 판단할까요? (예 / 아니오 — 아니오면 아래 2·3 중 번호)

## 근거 (실측)
- 실사용 측정(어드민 `/api/analytics/summary?day=…` 의 `TTFB:colo:*`, 2026-10-29~11-04): 한국 손님이 붙은 데이터센터는
  **HKG(대부분) · NRT · LAX**, **ICN 0건**. 첫 응답 중간값 HKG 0.17~0.65초 · NRT 0.13~2.1초 · LAX 0.24~1.3초.
- DB(D1) 원본은 미국 동부(ENAM) · 읽기 복제 `auto` 켜짐(CF API). 캐시가 빈 요청은 질의 하나당 ≈0.2초.
- Cloudflare 커뮤니티에 같은 증상 보고가 다수 — **무료·유료 모두**에서 나오고, **Pro + Argo 를 켜도 데이터센터가 안 바뀌었다**는 보고가 있다
  (Argo 는 Cloudflare↔원본 구간만 다룬다). 원인은 한국 통신사↔Cloudflare 경로(피어링)로 추정되며 Cloudflare 공식 설명은 찾지 못했다.
  - https://community.cloudflare.com/t/zone-consistently-routed-to-lax-sjc-instead-of-icn-for-korean-traffic-argo-made-n/950006
  - https://community.cloudflare.com/t/korean-visitor-traffic-consistently-routed-away-from-icn-seoul-to-distant-pops-h/961652
  - https://community.cloudflare.com/t/south-korea-traffic-routed-to-lax-sjc-instead-of-icn-causing-high-latency/954093
- ⚠️ 확인 못 한 것: Enterprise 요금제에서 한국 경로가 달라지는지(공식 문서 없음 — 영업 문의로만 확인 가능).

## 선택지
1. **유료 전환 보류 + 코드 최적화 계속**(PR #2191·#2193·#2197 — 차례 묻기 축소·첫 코드 −184/−129KB·공개 API 실제 캐시) +
   새 계측(`D1` 표본 — 한국 손님 질의를 어느 지역이 답하는지)으로 2주 관측. 머니 접촉 없음.
2. **Cloudflare Enterprise 영업 문의** — 한국 경로 보장이 되는지 서면으로 받은 뒤 결정. 비용은 월 수백만 원대로 알려져 있다(견적 필요). 머니 접촉 있음(구독).
3. **Pro($20/월) + Argo 시험** — 위 보고상 효과가 없을 가능성이 높다. 머니 접촉 있음(소액).

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)
1. 유료로 해결된다는 근거가 없고, 코드 쪽에서 아직 줄일 왕복이 남아 있다.

## 롤백
선택지 1 은 되돌릴 것이 없다(현상 유지). 2·3 은 요금제 다운그레이드.

## 결정 (대표가 한 말 그대로)

## 반영 커밋
