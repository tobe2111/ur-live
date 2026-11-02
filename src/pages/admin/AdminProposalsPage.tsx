/**
 * 📄 2026-08-30 (대표 요청): 대외 소개서를 어드민에서 열람하고 내려받는다.
 *
 *   🔁 **2026-10-12 — 9장 구판 HTML → 실제 소개서 PDF 다섯으로 교체** (대표 "고쳐줘").
 *      이 화면은 2026-08-30 에 만든 `public/static/proposals/influencer-proposal.html`(9장)을 띄우고
 *      있었는데, 그 뒤 소개서가 생성기(`docs/business/proposals/*.build.mjs` → `.pptx`/`.pdf`)로 옮겨가
 *      인플루언서 소개서는 **20장 v4** 가 됐다. 구판은 거기서 갈라져 나온 채 남아,
 *      **폐지된 영입 커미션 2%**("내가 데려온 매장은 1년간 매출의 2%", 2026-09-16 폐지)를
 *      여전히 팔고 있었다 — 어드민에서 열어 보내면 **없는 커미션을 약속하는 문서**가 나간다.
 *      ⇒ 구판 HTML 은 삭제했다(남겨 두면 다음 세션이 "되살리면 되지" 로 읽는다).
 *
 *   📦 **파일이 어디서 오는가**: 소개서의 집은 `docs/business/proposals/` 다(생성기 `.build.mjs` +
 *      `.pptx` + `.pdf`). 배포 때 `scripts/build-prepare.mjs` 가 **PDF 만** `dist/client/static/proposals/`
 *      로 복사한다. 🔴 **`public/` 에 사본을 두지 말 것** — PDF 를 다시 뽑을 때 한쪽만 갱신되면
 *      어드민이 옛 소개서를 **조용히** 서빙한다(2026-10-12 에 덱 다섯을 라이브와 맞추며 바로잡은
 *      드리프트와 같은 클래스). dev 서버는 `vite.config.ts` 의 `proposalPdfDevPlugin` 이 같은 주소를
 *      원본 파일로 이어 준다.
 *
 *   ⚠️ **`?raw` import 로 되돌리지 말 것.** 처음엔 docs/ 원본을 `?raw` 로 가져왔는데, 소개서에 라이브
 *      화면 캡처를 base64 로 심자 그 문자열이 그대로 JS 청크가 되어 **이 페이지 청크가 254KB** 로 불고
 *      `check-bundle-size --budget`(총 raw JS 8.6MB)이 빨간불을 냈다. 정적 자산이면 번들에 0바이트다.
 *
 *   ⚠️ 경로는 `/static/*` 아래여야 한다. `_routes.json` 이 그 접두사를 워커에서 제외하고 있어
 *      Pages 가 파일을 직접 서빙한다. 다른 경로에 두면 워커가 SPA 셸을 돌려준다.
 *
 *   ⚠️ PDF 를 서버에서 만들지 않는다. 생성기가 이미 16:9 PDF 를 뽑아 두므로 이 화면은 **그 파일을
 *      그대로** 보여 주고 내려받게만 한다(종전의 "브라우저 인쇄로 PDF 저장" 단계가 사라졌다).
 *      ⇒ 인쇄 경로가 없어져 2026-09-07 의 *인쇄하면 캡처가 빈 상자* 사고 클래스도 같이 사라졌다.
 *
 *   🔓 이 파일들은 `/static/` 아래라 **로그인 없이도 주소를 알면 받을 수 있다**(종전 HTML 도 그랬다).
 *      소개서는 애초에 파트너에게 건네는 문서이고 PDF 자체가 공개 저장소에 커밋돼 있어 추가 노출은
 *      없다. 검색 노출은 `public/robots.txt` 의 `Disallow: /static/proposals/` 가 막는다.
 */
import { useCallback, useState } from 'react'
import { FileText, Download, Maximize2 } from 'lucide-react'
import { formatKST } from '@/utils/date'
import { useProposalManifest, useAutoPdf, deckNameOf } from './proposals/useAutoProposal'

/**
 * 🔢 `slides` 는 손으로 적는 숫자가 아니다 — `src/tests/unit/admin-proposals-asset.test.ts` 가
 *    실제 PDF 의 페이지 수를 세어 대조한다(덱을 다시 뽑아 장수가 바뀌면 빨간불).
 */
const PROPOSALS = [
  {
    key: 'store-owner',
    label: '매장 사장님',
    url: '/static/proposals/urdeal-store-owner-deck.pdf',
    summary: '대표 최종 구성안 9장 + 손님 흐름 · 페르소나 · 쌓이는 자산 · 입점 절차.',
    audience: '매장 사장님 (대면 소개)',
    slides: 15,
    source: 'urdeal-store-owner-deck.pptx',
  },
  {
    key: 'store-owner-detail',
    label: '매장 사장님 (상세판)',
    url: '/static/proposals/urdeal-store-owner-deck-detail.pdf',
    summary: '같은 내용에 실제 상품의 정산 계산과 카테고리 평균을 더한 상세판.',
    audience: '매장 사장님 (숫자를 보는 자리)',
    slides: 17,
    source: 'urdeal-store-owner-deck-detail.pptx',
  },
  {
    key: 'merchant-association',
    label: '상인회',
    url: '/static/proposals/urdeal-merchant-association-deck.pdf',
    summary: '공동 사업(전단·축제·쿠폰)과의 비교 · 세 가지 길(직접 10% / 유어딜 대행 10% / 상인회 중개 5%) · 마지막 장이 입점 요청 3가지.',
    audience: '상인회 · 상가 번영회 (설명회)',
    slides: 20,
    source: 'urdeal-merchant-association-deck.pptx',
  },
  {
    key: 'influencer',
    label: '인플루언서 제휴',
    url: '/static/proposals/urdeal-influencer-deck.pdf',
    summary: '중개사 계정 · 유어딜 5% 흐름 · 매장 코드와 협업 코드 · 정산은 "이용권 사용 후". 영입 커미션 2% 는 2026-09-16 폐지라 들어 있지 않습니다.',
    audience: '인플루언서 · 크리에이터',
    slides: 20,
    source: 'urdeal-influencer-deck.pptx',
  },
  {
    key: 'agency',
    label: '대행사 제휴',
    url: '/static/proposals/urdeal-agency-proposal.pdf',
    summary: '매장 코드 · 두 요율 · 코드 링크 매칭 · 귀사 몫 유어딜 직접 송금. 매장 모집 실행서를 겸합니다.',
    audience: '대행사 (매장 모집 파트너)',
    slides: 30,
    source: 'urdeal-agency-proposal.pptx',
  },
] as const

type Key = (typeof PROPOSALS)[number]['key']

export default function AdminProposalsPage() {
  const [tab, setTab] = useState<Key>('store-owner')
  const active = PROPOSALS.find(p => p.key === tab) ?? PROPOSALS[0]
  // 📄 2026-11-02: 자동 생성 최신본(워크플로 proposals.yml → GitHub Release) 을 먼저 쓴다. 없으면 저장된 판.
  const auto = useProposalManifest()
  const deck = deckNameOf(active.url)
  const autoDeck = auto.mode === 'auto' ? auto.manifest.decks.find(d => d.name === deck) : undefined
  const pdf = useAutoPdf(deck, !!autoDeck)
  const viewUrl = pdf.url ?? active.url
  const usingAuto = !!pdf.url
  const warnings = auto.mode === 'auto' ? auto.manifest.warnings.filter(w => w.decks.includes(deck)) : []

  const openFull = useCallback(() => {
    window.open(viewUrl, '_blank', 'noopener')
  }, [viewUrl])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-gray-400" />
        <h1 className="text-xl font-extrabold text-gray-900">대외 소개서</h1>
      </div>
      <p className="text-[13px] text-gray-500 mb-4">
        매일 새벽 라이브 숫자로 다시 만든 최신본을 띄웁니다. 못 불러오면 저장소(<code className="px-1 rounded bg-gray-100 text-[0.85em]">docs/business/proposals/</code>)의 판으로 내려가고 아래에 그렇게 적힙니다.
      </p>

      {PROPOSALS.length > 1 && (
        <div className="flex gap-1.5 mb-4 border-b border-gray-200 overflow-x-auto">
          {PROPOSALS.map(p => (
            <button
              key={p.key}
              onClick={() => setTab(p.key)}
              className={`shrink-0 px-3.5 py-2 text-[13px] font-bold -mb-px border-b-2 transition-colors ${
                tab === p.key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-[var(--dash-radius,16px)] border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-gray-900">{active.label} 소개서</p>
            <p className="text-[12.5px] text-gray-500 mt-0.5">{active.summary}</p>
            <p className="text-[11.5px] text-gray-400 mt-1">
              대상 {active.audience} · 슬라이드 {active.slides}장 · 16:9
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openFull}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-[13px] font-bold text-gray-700 hover:bg-gray-50"
            >
              <Maximize2 className="w-4 h-4" />
              새 창에서 보기
            </button>
            <a
              href={viewUrl}
              download={`${deck}.pdf`}
              className="ur-btn ur-btn-md ur-btn-primary inline-flex items-center gap-1.5 text-[13px]"
            >
              <Download className="w-4 h-4" />
              PDF 내려받기
            </a>
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 space-y-1">
          {/* 🔴 지금 보는 것이 자동 생성본인지 저장된 판인지 숨기지 않는다 */}
          {auto.mode === 'auto' && usingAuto ? (
            <p data-testid="proposal-source" className="text-[12px] text-gray-700">
              자동 생성본 · {formatKST(auto.manifest.builtAt)} 생성 · 숫자 기준 {auto.manifest.facts.measuredAt}
              {' '}(판매 중 이용권 {auto.manifest.facts.activeVouchers}건 · 실제 매장 {auto.manifest.facts.realStores}건)
            </p>
          ) : auto.mode === 'loading' || (autoDeck && !pdf.failed) ? (
            <p data-testid="proposal-source" className="text-[12px] text-gray-500">자동 생성본을 확인하는 중…</p>
          ) : (
            <p data-testid="proposal-source" className="text-[12px] font-bold text-tone-bad">
              {auto.mode === 'fallback' ? auto.reason : '이 소개서의 자동 생성본을 불러오지 못했습니다'} — 저장소에 있는 판을 보여 줍니다(숫자가 낡았을 수 있습니다).
            </p>
          )}
          <p className="text-[12px] text-gray-500">
            숫자(판매 중 이용권 · 평균 판매가 · 예시 상품)는 매일 새벽 라이브에서 다시 재서 다섯 소개서가 함께 바뀝니다. 문장을 고칠 일이 있으면
            {' '}<code className="px-1 rounded bg-white border border-gray-200 text-[0.9em]">docs/business/proposals/{active.source.replace('.pptx', '.build.mjs')}</code> 수정을 요청해 주세요.
          </p>
          {warnings.length > 0 && (
            <ul data-testid="proposal-warnings" className="mt-1 rounded-lg bg-tone-bad-bg px-3 py-2 text-[12px] text-tone-bad space-y-0.5">
              {warnings.map(w => (
                <li key={w.id}>덱 확인 필요: {w.message}</li>
              ))}
            </ul>
          )}
        </div>

        {/* PDF 는 브라우저 기본 뷰어가 그린다 — 확대·페이지 이동·인쇄가 그 안에 있어 우리가 배율을 계산하지 않는다
            (종전 HTML 때는 1280px 시트를 `transform: scale()` 로 줄이고 `contentDocument` 로 높이를 읽었는데,
             PDF iframe 은 플러그인 문서라 `contentDocument` 가 null 이고 그 기계장치가 통째로 불필요하다). */}
        <iframe
          key={viewUrl}
          title={`${active.label} 소개서`}
          src={viewUrl}
          className="block w-full border-0 bg-[#EFEBE8]"
          style={{ height: 'max(420px, calc(100dvh - 300px))' }}
        />
      </div>
    </div>
  )
}
