/**
 * 🔎 인플루언서 풀 **필터 바** — `AdminInfluencerPoolPage.tsx` 에서 분리 (2026-07-29).
 *
 *   분리 이유: 지역 필터를 더하면서 페이지가 600줄(god 파일 래칫)에 닿았다. 래칫을 리베이스라인으로
 *   우회하지 않고, 성격이 같은 덩어리(필터 입력 + 매장 매칭 트리거)를 컴포넌트로 뺀다 —
 *   같은 폴더의 다른 추출물(KeywordManager · CollectDiagPanel …)과 동일한 처방.
 *
 *   순수 표시 컴포넌트다: 상태는 전부 부모가 들고 있고 여기는 값과 setter 만 받는다.
 */
import { REGION_TOKENS } from '@/shared/ads/region-tokens'
import { POOL_CATEGORIES } from '../AdminInfluencerPoolPage'

export interface PoolFiltersProps {
  platform: string; setPlatform: (v: string) => void
  category: string; setCategory: (v: string) => void
  /** 📍 활동 지역 — 수집 키워드 접두에서 캡처된 값(거주지 아님). 지역×업종으로 매칭 후보를 좁힌다. */
  region: string; setRegion: (v: string) => void
  /** 🏷️ 분류 신뢰도 — `content`(본문·소개글로 확인) vs `keyword`(발굴 키워드 상속 = 미확인). */
  catSource: string; setCatSource: (v: string) => void
  /** 📏 측정 여부 — 아직 한 번도 안 잰 리드는 연락처·본문분류가 통째로 비어 있다. */
  measured: string; setMeasured: (v: string) => void
  tier: string; setTier: (v: string) => void
  sort: string; setSort: (v: string) => void
  hasEmail: boolean; setHasEmail: (v: boolean) => void
  hasInstagram: boolean; setHasInstagram: (v: boolean) => void
  hasContact: boolean; setHasContact: (v: boolean) => void
  hideNoise: boolean; setHideNoise: (v: boolean) => void
  brandOnly: boolean; setBrandOnly: (v: boolean) => void
  inboundOnly: boolean; setInboundOnly: (v: boolean) => void
  q: string; setQ: (v: string) => void
  matchRegion: string; setMatchRegion: (v: string) => void
  matchLoading: boolean; onSellerMatch: () => void
}

const SEL = 'px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900'
const CHK = 'flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white cursor-pointer'

export default function PoolFilters(p: PoolFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <select value={p.platform} onChange={e => p.setPlatform(e.target.value)} className={SEL}>
        {/* 🏘️ 카페는 인플루언서가 아니라 커뮤니티라 기본 목록에서 빠진다(서버가 제외) — 여기서 골라야 보인다. */}
        <option value="">전체(카페 제외)</option>
        <option value="youtube">유튜브</option>
        <option value="naver_blog">네이버 블로그</option>
        <option value="naver_cafe">🏘️ 지역·커뮤니티 매체(카페)</option>
        <option value="tistory">티스토리</option>
      </select>
      <select value={p.category} onChange={e => p.setCategory(e.target.value)} className={SEL}>
        <option value="">전체 카테고리</option>
        {POOL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {/* 📍 지역 필터 — 저장된 값과 **같은 목록**(shared/ads/region-tokens)에서 고른다.
          손으로 타이핑하면 저장 안 된 표기('강남구')를 골라 조용히 0건이 된다. */}
      <select value={p.region} onChange={e => p.setRegion(e.target.value)} className={SEL} title="수집 키워드에서 캡처된 활동 지역 — 거주지가 아니라 '그 지역을 다루는 콘텐츠'라는 신호">
        <option value="">📍 전체 지역</option>
        {REGION_TOKENS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      {/* 🏷️ 분류 신뢰도 — 카테고리 값 자체는 이미 보이는데 **그게 믿을 만한 값인지**를 화면에서 못 갈랐다.
          실측 84%가 키워드 상속("강남 맛집"으로 발굴됐다고 맛집 블로거인 건 아니다) → 품질 작업의 대상 집합. */}
      <select value={p.catSource} onChange={e => p.setCatSource(e.target.value)} className={SEL} title="본문·소개글로 확인된 분류인지, 발굴 키워드에서 물려받은 값인지">
        <option value="">🏷️ 분류 신뢰도 전체</option>
        <option value="content">✅ 본문 확인됨</option>
        <option value="keyword">⚠️ 키워드 상속(미확인)</option>
      </select>
      {/* 📏 측정 여부 — 미측정 리드는 연락처·활동성·본문분류가 통째로 비어 있다(전체의 91%). */}
      <select value={p.measured} onChange={e => p.setMeasured(e.target.value)} className={SEL} title="한 번이라도 활동성 측정(RSS·홈)을 한 적이 있는지 — 미측정이면 연락처·본문분류가 비어 있다">
        <option value="">📏 측정 여부 전체</option>
        <option value="1">✅ 측정됨</option>
        <option value="0">⏳ 미측정(대기열)</option>
      </select>
      <select value={p.tier} onChange={e => p.setTier(e.target.value)} className={SEL} title="유어딜 딜엔 마이크로/중형(1만~50만)이 효율적">
        <option value="">전체 규모</option>
        <option value="sweet">⭐ 스위트스팟 (1만~50만)</option>
        <option value="nano">나노 (~1만)</option>
        <option value="micro">마이크로 (1만~10만)</option>
        <option value="mid">중형 (10만~50만)</option>
        <option value="macro">대형 (50만+)</option>
      </select>
      <select value={p.sort} onChange={e => p.setSort(e.target.value)} className={SEL}>
        <option value="fit">유어딜 핏순</option>
        <option value="score">🏅 리드 점수순</option>
        <option value="perf">📈 조회수순(롱폼 중앙값)</option>
        <option value="subscribers">구독자순</option>
        <option value="recent">최근 수집순</option>
      </select>
      <label className={CHK}>
        <input type="checkbox" checked={p.hasEmail} onChange={e => p.setHasEmail(e.target.checked)} /> ✉ 이메일 있음
      </label>
      <label className={CHK}>
        <input type="checkbox" checked={p.hasInstagram} onChange={e => p.setHasInstagram(e.target.checked)} /> IG 인스타 있음
      </label>
      <label className={CHK}>
        <input type="checkbox" checked={p.hasContact} onChange={e => p.setHasContact(e.target.checked)} /> 아무 연락처
      </label>
      <label className={CHK} title="뉴스·방송·기관·체험단모집·대행 + 브랜드 공식 채널 숨김(삭제 아님)">
        <input type="checkbox" checked={p.hideNoise} onChange={e => { p.setHideNoise(e.target.checked); if (e.target.checked) p.setBrandOnly(false) }} /> 🧹 노이즈 숨김
      </label>
      <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 bg-white cursor-pointer" title="브랜드/기업 공식 채널로 태깅된 리드만 — 오탐 검수용">
        <input type="checkbox" checked={p.brandOnly} onChange={e => { p.setBrandOnly(e.target.checked); if (e.target.checked) p.setHideNoise(false) }} /> 🏢 브랜드만
      </label>
      <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-300 text-sm text-violet-700 bg-violet-50 cursor-pointer" title="스스로 신청한 리드(사전동의 — 자유 연락 가능)">
        <input type="checkbox" checked={p.inboundOnly} onChange={e => p.setInboundOnly(e.target.checked)} /> 📥 신청·동의
      </label>
      <input value={p.q} onChange={e => p.setQ(e.target.value)} placeholder="이름·핸들·이메일·카테고리·소개 검색 (예: 강남 카페)" title="여러 단어를 넣으면 모두 포함된 채널만 나옵니다. 채널 소개글까지 검색합니다." className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
      <input value={p.matchRegion} onChange={e => p.setMatchRegion(e.target.value)} placeholder="지역(예: 강남·서울)" className="w-[140px] px-3 py-2 rounded-lg border border-indigo-200 text-sm text-gray-900" title="유어딜 매장 매칭 시 지역(시/군구/동) 필터 — 위 📍 지역 필터(리드 쪽)와 별개다" />
      <button onClick={p.onSellerMatch} disabled={p.matchLoading} className="px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium disabled:opacity-50" title="선택 카테고리(+지역)의 유어딜 매장 목록(읽기 전용)">
        {p.matchLoading ? '조회 중…' : '🔗 유어딜 매장 매칭'}
      </button>
    </div>
  )
}
