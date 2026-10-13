/**
 * 📄 어드민 대외 소개서 = 지금 쓰는 PDF 다섯 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/admin-proposals-asset.test.ts
 *
 * 막는 사고: 어드민이 2026-08-30 에 만든 **9장 HTML 구판**을 띄우고 있었고, 그 구판은
 * **2026-09-16 에 폐지된 영입 커미션 2%** 를 계속 팔고 있었다 — 거기서 열어 보내면
 * 없는 커미션을 약속하는 문서가 나간다. 에러도 빌드 실패도 없는 부류다.
 */
const TEST = 'src/tests/unit/admin-proposals-asset.test.ts'
const PAGE = 'src/pages/admin/AdminProposalsPage.tsx'
const PREPARE = 'scripts/build-prepare.mjs'
const VITE = 'vite.config.ts'

export default [
  {
    name: '📄 9장 구판 HTML 로 되돌아간다 — 폐지된 영입 2% 를 다시 판다',
    file: PAGE,
    find: "    url: '/static/proposals/urdeal-influencer-deck.pdf',",
    replace: "    url: '/static/proposals/influencer-proposal.html',",
    test: TEST,
    why: '구판은 2026-09-16 폐지된 커미션을 팔고 있었다 — 어드민에서 열어 보내면 거짓 약속이 나간다.',
  },
  {
    name: '📄 소개서를 `?raw` 로 번들에 싣는다 — 페이지 청크 254KB',
    file: PAGE,
    find: "import { FileText, Download, Maximize2 } from 'lucide-react'",
    replace: "import { FileText, Download, Maximize2 } from 'lucide-react'\nimport _deck from '../../../docs/business/proposals/urdeal-influencer-deck.pdf?raw'",
    test: TEST,
    why: '화면 캡처 base64 가 그대로 JS 가 되어 `check-bundle-size --budget` 이 CI 를 세웠던 직접 원인.',
  },
  {
    name: '📄 `/static/` 밖으로 옮긴다 — 워커가 SPA 셸을 돌려줘 빈 화면',
    file: PAGE,
    find: "    url: '/static/proposals/urdeal-agency-proposal.pdf',",
    replace: "    url: '/proposals/urdeal-agency-proposal.pdf',",
    test: TEST,
    why: '`_routes.json` 이 그 접두사만 워커에서 제외한다 — 다른 경로면 PDF 대신 HTML 이 온다.',
  },
  {
    name: '📄 장수 표기가 실제 PDF 와 어긋난다',
    file: PAGE,
    find: '    slides: 30,',
    replace: '    slides: 31,',
    test: TEST,
    why: '덱을 다시 뽑으면 장수가 바뀌는데 숫자는 손으로 적혀 있다 — 받는 사람이 확인하면 드러난다.',
  },
  {
    name: '📄 배포 복사가 사라진다 — 라이브에서 소개서 다섯이 통째로 404',
    file: PREPARE,
    find: "    if (!name.endsWith('.pdf')) continue",
    replace: "    if (!name.endsWith('.pdfx')) continue",
    test: TEST,
    why: 'docs/ 에만 있고 `dist/client/static/` 으로 안 가면 어드민 미리보기가 전부 빈 화면이다.',
  },
  {
    name: '📄 dev 배선이 주석 처리된다 — 다음 세션이 public/ 에 사본을 만든다',
    file: VITE,
    find: '    proposalPdfDevPlugin(),',
    replace: '    // proposalPdfDevPlugin(),',
    test: TEST,
    why: 'dev 에서 빈 화면을 보면 "고치려고" public/ 사본을 만들고, 그 사본이 옛 소개서를 서빙하게 된다.',
  },
]
