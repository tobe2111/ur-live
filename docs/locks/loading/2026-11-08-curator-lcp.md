# [LOADING_ADDITIVE] 2026-11-08 유어샵 첫 줄 사진 — lazy 해제 + 응답 헤더 preload

- 대표 *"계속 최적화"*.
- 잠금 접촉: `src/worker/index.ts` HTMLRewriter SSR inject 블록(CURATOR 분기)에 **한 줄 추가**(첫 화면을 그렸을 때만 `appendLcpLink`). 기존 분기·폴백 불변.
- 실측(라이브, 느린 4G 흉내 150ms/1.6Mbps): `/u/jiwon1228` 첫 줄 사진 7KB 가 `loading="lazy"` 라 우선순위가 낮아,
  CSS 뒤 출발한 스크립트 25개와 회선을 다투다 출발 697ms → 도착 2,108ms. LCP 2,180ms.
- 처방: ① `curator-ssr-body.ts rowHtml` — 서버 첫 화면 줄(4개)에서 `loading="lazy"` 제거, 첫 줄 `fetchpriority="high"`
  ② `curatorLcpImage()`(같은 순서·같은 cfImage 주소) → `Link: rel=preload; as=image; fetchpriority=high`
  ③ `PinRow` — 주인 순서 1~4 는 lazy 없이(마운트가 같은 주소를 lazy 로 다시 그려 우선순위를 낮추지 않게).
- 가드: `src/tests/unit/curator-lcp-eager-2026-11-08.test.ts`(되돌려-검증: lazy 를 다시 넣으면 빨간불 확인).
- 롤백: 이 커밋 revert.
- 판정(E4): 배포 후 같은 조건으로 `/u/jiwon1228` LCP 재측정 · 응답 헤더에 사진 Link 가 실리는지.
