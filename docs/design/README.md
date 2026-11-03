# 디자인 시안 archive

이 폴더는 사용자가 제공한 UI/UX 디자인 시안과 그 구현 상태를 추적합니다.

## 작성 규칙

1. **파일명**: `<page-or-component-name>.md` (예: `home-sidebar.md`, `checkout-page.md`)
2. **각 파일 구조**:
   - 시안 이미지 또는 설명
   - 시안 받은 날짜 / 출처
   - 핵심 요구사항 (섹션별)
   - 현재 구현 vs 시안 차이점 표
   - 구현 todo 체크리스트
   - 완료 시 commit hash 마킹

## 시안 받았을 때 절차 (필수)

1. 이미지를 `docs/design/<page-name>.png` 으로 저장 (Claude Code 가 multimodal 이라 첨부 이미지 직접 읽음 — 저장은 사용자 수동)
2. `docs/design/<page-name>.md` 작성: 시안 설명 + todo
3. 같은 commit 으로 push (구현 전이라도)
4. 구현 완료 시 같은 파일 하단에 `## ✅ 구현 완료` 섹션 + commit hash 추가

## 미구현 시안

🔀 **표는 한 줄 = 파일 하나다** (2026-11-03 — 대표 *"낭비 없이 빨리 각 세션의 배포들을"* → *"가장 이상적으로 해줘"*).
종전엔 모든 세션이 이 표 **맨 위에** 한 줄씩 끼워 넣어, 무관한 PR 끼리 같은 줄을 다퉜다(최근 3일 머지 109건 중 13건이 이 파일).
인계 목차를 고친 것과 같은 처방이다(`docs/handoff/` — 파일 하나씩 · 목차는 생성물).

- **새 시안**: `docs/design/index/<날짜>-<슬러그>.md` 파일 하나에 표 한 줄을 적는다
  (`| 페이지 | 시안 받은 날 | 상태 | [파일](./<시안>.md) |`). 이 README 에는 적지 않는다.
- **상태가 바뀌면**: 그 줄 파일만 고친다.
- **목차 보기**: `node scripts/generate-design-index.mjs` → `docs/design/INDEX.local.md`(추적 안 함 · 최신순)
  또는 그냥 `ls docs/design/index/`(파일명이 날짜 접두사라 정렬이 곧 최신순).

