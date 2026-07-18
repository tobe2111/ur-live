/**
 * 🆕 2026-06-27 유어애즈 — AI 마케터 (Claude 진단/추천, 읽기 전용).
 *
 *   유어애즈가 이미 모은 데이터(검색광고 실적 + 연관키워드 + 검색추세 + 쇼핑경쟁)를
 *   Claude 에게 넘겨 한국어 진단 + 실행가능한 추천을 받는다. **읽기 전용 — 자동 실행 없음**
 *   (입찰/키워드 변경은 사용자가 직접). 우리 강점: 자체 LLM 보유.
 *
 *   ⚠️ 데이터 grounding: 컨텍스트에 있는 수치만 근거로 답하도록 강제(환각 방지).
 *   미설정(ANTHROPIC_API_KEY 없음) 시 NOT_CONFIGURED.
 */
export interface AiMarketerContext {
  connected: boolean
  stats?: { days: number; impCnt: number; clkCnt: number; salesAmt: number; ccnt: number; ctr: number; cpc: number; topCampaigns: Array<{ name: string; salesAmt: number; clkCnt: number; ccnt: number }> }
  keyword?: { seed: string; related: Array<{ keyword: string; monthlyTotal: number; compIdx: string }>; shoppingTotal: number; trendPct: number }
  // 전주 대비(WoW) 추세 — ad_daily_metrics 시계열 기반(있을 때만). 증감률(%)·최근/직전 ROAS.
  trend?: { wowCostPct: number | null; wowConvPct: number | null; recentRoas: number | null; prevRoas: number | null; days: number }
  // 🆕 2026-07-01 grounding 확장 — 유어애즈가 이미 모은 4종 데이터를 진단에 주입(전부 optional·fail-soft).
  //   키워드 효율(낭비 키워드), 쇼핑 오가닉 순위(변동), 부정클릭 의심, 최저가 역전(가격경쟁력).
  efficiency?: { days: number; scanned: number; waste: Array<{ keyword: string; cost: number; clicks: number }>; top: Array<{ keyword: string; cost: number; conv: number; roas: number | null }> }
  ranks?: Array<{ keyword: string; mall: string; rank: number | null; prevRank: number | null }>
  clickguard?: { days: number; totalClicks: number; adClicks: number; suspiciousIps: number }
  price?: Array<{ query: string; myPrice: number | null; lowest: number | null; lowestMall: string | null; undercut: boolean }>
}

const SYSTEM = [
  '너는 네이버 검색광고 전문 마케터다.',
  '주어진 데이터만 근거로 간결하고 실행가능한 한국어 조언을 한다.',
  '데이터에 없는 수치나 사실을 지어내지 마라. 모르면 모른다고 한다.',
  '출력은 마크다운으로, 아래 섹션을 순서대로: ## 진단 / ## 잘되는 점 / ## 개선할 점 / ## 추천 액션 / ## 주의.',
  'trend(전주 대비 증감률·ROAS 변화)가 있으면 반드시 진단에 반영하라 — 예: 광고비는 늘었는데 ROAS가 떨어졌으면 경고, 전환매출이 오르면 확대 제안.',
  'efficiency.waste(전환 0인데 비용 큰 낭비 키워드)가 있으면 제외/입찰인하 후보로 반드시 짚어라.',
  'ranks(쇼핑 오가닉 순위)가 있으면 순위 하락 키워드는 광고 보강, 오가닉 상위 키워드는 광고비 절감 여지를 검토하라.',
  'clickguard.suspiciousIps 가 0보다 크면 부정클릭 의심을 경고하고 차단 목록 검토를 권하라.',
  'price 에 undercut=true(경쟁몰이 내 가격보다 낮음) 항목이 있으면 가격경쟁력 관점(광고만으로 전환이 어려움)을 지적하라.',
  '추천 액션은 3~5개, 각 항목은 "무엇을 / 왜 / 어떻게"가 드러나게 구체적으로(키워드 추가·제외, 입찰 방향, 예산 조정 등).',
  '광고비/입찰 변경은 사용자가 직접 적용한다는 전제로 제안만 한다.',
].join(' ')

/** Claude 호출 — 진단/추천 텍스트(마크다운) 반환. */
export async function aiMarketerAdvice(apiKey: string | undefined, context: AiMarketerContext): Promise<{ ok: boolean; advice?: string; error?: string }> {
  if (!apiKey) return { ok: false, error: 'NOT_CONFIGURED' }
  if (!context.stats && !context.keyword && !context.trend) return { ok: false, error: '분석할 데이터가 없습니다 (계정 연동 또는 키워드 입력 필요)' }
  const userMsg = [
    '아래는 한 광고주의 네이버 검색광고 현황 데이터다. 이걸 근거로 진단/추천해줘.',
    '```json',
    JSON.stringify(context, null, 2),
    '```',
  ].join('\n')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    }),
  }).catch(() => null)
  if (!res) return { ok: false, error: 'AI 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { content?: Array<{ text?: string }>; error?: { message?: string } } | null
  // 업스트림(Anthropic) 원본 에러 메시지를 클라에 그대로 전달하지 않음 — 상태코드 힌트만.
  if (!res.ok) return { ok: false, error: `AI 분석에 실패했습니다 (HTTP ${res.status})` }
  const advice = (data?.content || []).map(b => b.text || '').join('').trim()
  if (!advice) return { ok: false, error: 'AI 응답이 비어 있습니다' }
  return { ok: true, advice }
}
