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
