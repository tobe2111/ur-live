# 유어딜(Ur Deal) 확정 브랜드 자산 — 2026-07 Final

> 출처: 대표 클로드 디자인 핸드오프 번들 `Ur Deal 로고 Final.dc.html` (2026-07-19 수령).
> 이 폴더가 **브랜드 자산 SSOT** — 앱 출시 시 앱 아이콘도 여기서 추출한다.

## 확정 사양
- **기본 앱 아이콘**: 로즈 `#E0526B` 배경 + 흰 `ur` (점 없음, Poppins 800)
- **세컨더리(비즈니스·셀러·문서)**: 네이비 `#1A2C42` + 흰 `u` + 밝힌 로즈 `r` `#EF6E85` (32px 이하는 r 획 +0.4~0.6px 굵힘)
- **워드마크**: `urdeal.` — Poppins 800, 자간 −3.5%, 마침표 = 획 굵기 지름의 로즈 원(베이스라인 위)
  - 4색: 네이비(기본) / 로즈(포인트) / 화이트(어두운 배경) / 흑백(인쇄)
- **한글 유어딜**: 커스텀 레터링(점 없음) — 700 굵기(획 12.5, ㄹ받침 10), 플랫 획 끝·소프트 꺾임, ㅇ 지름 42, 상단선 8·베이스라인 104/109
- **플랫 고정** — 그라데이션은 마케팅 배경에서만 허용

## 규칙
- 클리어스페이스: 사방 x = 소문자 u 엑스하이트 (심볼 단독 동일)
- 워드마크 최소 가로 64px — 미만은 심볼만
- 락업: 가로(심볼+워드마크, 간격=심볼 폭 ¼) / 세로(스플래시·표지) / 병기(국문 우선, 간격=u 높이, 한글엔 마침표 없음)
- 마스커블: 심볼을 중앙 80% 안에
- 금지: 당근·토스·배민 유사 형태, 커머스 클리셰(핀·장바구니), 가는 획, 3색 초과, 로고 그라데이션

## 파일
- `urdeal-wordmark-{navy,rose,white,mono}.svg` — 워드마크 4색 (⚠️ Poppins @import 참조 — 오프라인 툴은 PNG 기준)
- `yueodil-lettering-{navy,white,mono}.svg` — 한글 레터링 (순수 패스, 폰트 무관)
- `ur-icon-{rose,maskable}.svg` / `ur-icon-biz-navy.svg` — 아이콘 (Poppins 참조)
- `wordmark-navy-2x.png`(662×220) / `hangul-lettering-2x.png`(740×288) — 실렌더 납품본
- `kakao-channel-640.png` — 카카오 채널 프로필용 (대표 수동 업로드)

## 사이트 반영 현황 (2026-07-19)
- `public/favicon-32.png`·`favicon-16.png`·`favicon.svg`(32px 임베드) — 브라우저 탭 (index.html 링크)
- `public/icon-192.png`·`icon-512.png`·`icon-maskable-512.png`(납품) + `icon-maskable-192.png`(512 박스필터 다운스케일) — PWA
- `public/apple-touch-icon.png` ← `icon-ios-180`
- `public/favicon-biz-32.png`·`icon-biz-192.png`·`icon-biz-512.png` — 세컨더리. 셀러 대시보드 탭 파비콘 스왑(`src/lib/biz-favicon.ts`)
- `public/og-image.png`(1200×630 국문 우선 병기 합성) + `og-image.svg`(동일 임베드) — 기본 OG (`SEO.tsx`·index.html)
- 인앱 워드마크: `src/components/brand/UrDealLogo.tsx`(SSOT — 소문자 urdeal + 로즈 점) + worker 정적 로더 미러. Poppins 800 은 index.html 에서 `&text=urdeal` 서브셋만 로드
- 도매몰(유통스타트)은 별도 브랜드 유지 — worker 가 `favicon-utong.svg` 로 전면 교체(서비스 분리)
