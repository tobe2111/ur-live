# 2026-10-25 PC 글자 쿠팡 기준 (대표 "2번 · 쿠팡 참고")

## 결정
- 대표: Pretendard(안 1) **안 함**. 쿠팡식(기기 글꼴)으로 가되 큰 글자·굵기를 쿠팡에 맞춘다.
- 근거(대표 PC 개발자 도구): 쿠팡 제목 `로켓직구 글로벌특가` = 24px · 700 · **렌더된 글꼴 Noto Sans KR**(목록은 Apple SD Gothic Neo, Noto Sans TC, Noto Sans JP …).

## 한 것
- PC(1024+) 글꼴 순서: Apple SD Gothic Neo → **Noto Sans KR → 맑은 고딕**(종전 맑은 고딕이 앞). 다운로드 0.
- PC 상세 제목(DetailTitleHeader) 28/800/−2.8% → 24/700/−2%.
- 상세 트리 인라인 fontSize 30곳 스케일 정렬 · 지도 핀 굵기 ≤700 · FcfsBadge 10/10.5px → 12px·500.

## 이번에 틀린 판단
- 압축 뒤 오전 결론(Pretendard 철회 → 쿠팡식 #2003)을 잊고 Pretendard 를 다시 제안했다. 대표가 "쿠팡 방식이면 문제 없다며?" 로 잡았다.
- "윈도우 = 맑은 고딕" 이라고 단정했는데, 대표 PC 엔 Noto Sans KR 이 있었다(쿠팡이 그걸로 그린다). 순서가 진짜 원인이었다.

## 다음 세션 첫 액션
- 배포 뒤 대표 PC 에서 urdeal.kr 상품 제목 → 검사 → 계산됨 → "렌더링된 글꼴" 이 Noto Sans KR 인지 확인 요청.
- 미확인: 쿠팡 letter-spacing(대표가 보낸 화면은 font-weight 까지만). 우리는 −2% 유지.
- 대표 PC 의 Noto Sans KR 이 설치 글꼴인지 쿠팡 웹폰트인지 미확인(쿠팡이 Access Denied 로 막아 네트워크 탭 확인 실패). 설치 글꼴이 아니면 이 순서 변경은 그 PC 에서 효과 0.

## 2026-10-26 후속 — 창 폭 1024 미만 PC 에서 규칙이 안 걸림

- 대표 스크린샷: `/life` h1 의 Font 가 `UrDigits, -apple-system, BlinkMac…` (종전 목록) + 크기 24px(`lg:text-[34px]` 미적용) = 뷰포트 1024 미만(개발자 도구 도킹 등). PC 블록이 미디어쿼리라 안 걸렸다.
- 처방: 기본 목록을 `-apple-system, BlinkMacSystemFont, "Noto Sans KR", "Malgun Gothic", system-ui, …` 로. 애플은 앞 두 키워드가 잡혀 그대로, 안드로이드는 그 이름 글꼴이 없어 system-ui 로 → 폰 불변. 윈도우는 창 폭 무관 한글 글꼴. index.css · tailwind sans · index.html 세 곳 같은 순서.
- 🩸 틀린 판단: "PC = 1024px+" 로 판정했다. PC 라도 창이 좁을 수 있다 — 플랫폼 문제를 폭으로 풀면 안 된다.
- 여전히 미확인: 대표 PC 에 Noto Sans KR 이 **설치**돼 있는가(쿠팡이 웹폰트로 받는 것일 수 있다). 개발자 도구 → 계산됨 → **렌더링된 글꼴**(Font 목록 줄이 아니라 맨 아래 칸)으로 판정.

## 2026-10-26 후속 2 — PC 전용 Pretendard (대표 승인 "승인해줄게")

- 로더 `ur-pret-loader`(index.html) · 시트 `public/static/fonts/pretendard-pc-v1.3.9-2.css` · 가드 `self-hosted-fonts` ②-1~②-7 · 주입 4건.
- 실측: load 동일 · 첫 글꼴 요청 load 뒤 · 재방문 캐시로 첫 그림 전 준비. 숫자는 CLAUDE.md 로딩 audit log 2026-10-26.
- 🩸 틀린 판단 둘: ① 처음 오는 PC 에도 시트를 바로 넣었다 → load 0.3초 지연(고쳤다) ② CDP 회선 흉내 측정이 캐시를 안 써 재방문 결과가 거짓이었다 — 재방문은 흉내 없이 잴 것.
- 안 한 것: 맑은 고딕 `size-adjust`(이 환경에 그 글꼴이 없어 값을 못 잰다).
- 다음 첫 액션: 배포 후 대표에게 윈도우 PC 렌더링된 글꼴 = Pretendard Variable 확인 요청. 첫 방문 글자 바뀜이 거슬린다고 하면 그때 `size-adjust` 를 대표 PC 실측으로.

## 후속 3 (2026-10-26) — 시트 주소 교체
- 배포 전 라이브 확인 때 `/static/fonts/pretendard-pc-v1.3.9-2.css` 를 요청해, 파일이 없던 시점의 SPA 대체 응답(text/html)이 immutable 1년으로 엣지 캐시에 붙었다(HIT, age 789s). `?x=1` 붙이면 text/css 정상.
- 처방: 파일 이름 `-v1.3.9-3` 으로 교체(퍼지는 대표 권한). 판정: 배포 뒤 쿼리 없이 `curl -sI .../pretendard-pc-v1.3.9-3.css` → text/css.
- 교훈: 새 immutable 주소는 배포 전에 라이브에서 찌르지 말 것.
