# 2026-09-07 — 대행사 향 서비스 소개·제안서 (.pptx, 16장 v2 "매장 모집 실행서")

**어느 레일**: 유어딜(소비자 서비스) 대외 문서. 코드 무접촉(`src/` 변경 0). 머니 경로 없음.

## v2 (대표 피드백 "내용이 모호하다. 대행사가 매장을 모집하게 하고 싶다")
v1 은 구조 설명이었고 "그래서 내일 어디 가서 뭘 하면 얼마가 남는가"가 없었다. v2 는 순서를 행동으로 바꿨다:
한 장 요약 → 이용권 예시(가격) → 돈 흐름 → **매장 1곳 단위 경제(가정 공개, 차트)** → **사장님 셈법** →
**데려올 매장 체크리스트 6** → **등록 10분 절차** → **설득 대본 + 거절 5 응답** → 인플루언서 5단계 →
주간 루틴 + 화면 6 → 사장님 안심 4 → 유어딜 지원 6 → **8주 파일럿 조건** → 손님 경험 → FAQ·CTA.
새로 확인한 사실: 매장 등록 = 사업자번호·대표자명·개업일 국세청 진위확인 + 카카오맵 장소 연결 + 채널 선택 + 확인 PIN
(`seller-stores.routes.ts`, 사장님 서명 불필요·대행사 계정으로 등록). 정산 = `used` 이용권만 주간(`auto-settlement.ts`).

## 만든 것
- `docs/business/proposals/urdeal-agency-proposal.pptx` — 대행사(중개사) 향 제안서 14장, 16:9.
- `docs/business/proposals/urdeal-agency-proposal.build.mjs` — pptxgenjs 생성기(재생성 절차는 proposals/README.md).

## 내용의 근거 (전부 SSOT 또는 라이브 실측)
| 주장 | 출처 |
|---|---|
| 직접 입점 10% / 대행사 경유 5%, 유어딜은 대행사에게 지급하지 않음, 대행사 보수는 매장 몫 95% 안에서 매장과 직접 | `store-operator-model.md` §7 (2026-09-04 대표 확정), `fee-resolver.ts` 기본값 |
| 대행사 도구 = 셀러 대시보드 6화면(`/seller/stores·operators·influencers·influencer-deals·promo-spend·operating`) | 2026-09-07 main 라우트 실재 확인 |
| 운영자 마스킹·계좌 변경 403·회수 언제든 | `store-operator-model.md` §7.7 |
| 판매 중 이용권 338건 | `GET /api/group-buy/products?status=active` 2026-09-07 |
| 인플루언서 DB 198,704 / 연락 가능 45,725 / 블로그 170,307 / 유튜브 17,986 / 카페 9,803 | `GET /api/admin/ads/influencer-pool/stats` 2026-09-07 |
| 시장 규모 3종 | 사업계획서 B-1 공개 통계 |

## 일부러 뺀 것
- 셀러 등급별 수수료 인하(가이드의 3%/4%/5% 표) — `fee-resolver.ts` 에 등급 분기가 없어 라이브 정산과 일치한다는 확신이 없었다. 대외 문서에 넣지 않았다.
- 어필리에이트·초대·멀티티어 — 전부 종료된 축(2026-08-22/23). 언급 0.
- 에이전시 대시보드·1%·24개월 — 2026-09-04 삭제. 언급 0.

## 검증
- `validate.py` PASS · 14장 전부 LibreOffice 렌더로 눈 확인(제목 넘침 2건·겹침 3건 수정 후 재확인).
- 이 세션에서 알게 된 환경 사실: 컨테이너에 `libreoffice-impress` 가 없어 pptx→pdf 변환이 "source file could not be loaded" 로 실패한다. `apt-get update && apt-get install libreoffice-impress` 로 해결(첫 시도는 apt 인덱스가 낡아 404). `pdftoppm` 도 없어 `pymupdf` 로 래스터화했다.

## Notion 미기록
문서 산출물이라 개발 업데이트 로그 대상 아님(MCP 미사용).

## 다음 세션
- 대표가 요율·문구를 바꾸면 생성기를 고치고 다시 빌드(README 절차). 전달 전 2·10 장 숫자 재실측.
