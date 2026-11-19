# [LOADING_ADDITIVE] 교환권 브랜드 칩 — 로고 실패 시 이름 두 글자 (2026-11-18)

- 파일: `src/pages/vouchers/shared.tsx` `BrandChip`
- 변경: `cfImageOnError` 가 2단계(원본까지 실패 → 그림 숨김)에 이르면 상태 `iconFailed` 로 로고 없는 브랜드와 같은 이름 두 글자를 그린다.
- 로딩 경로 무변경: src·width/height·lazy·cfImage 분기 그대로. 실패한 칩에서만 리렌더 1회.
- 근거: 로그아웃 화면 재검토에서 브랜드 줄이 빈 흰 칸으로 보였다(이 환경은 bizimg.giftishow.com 연결 리셋 — 실사용자 실패율은 미측정, 2026-10-31 기록 30장 중 25장 실패는 리사이저 경로였다).
