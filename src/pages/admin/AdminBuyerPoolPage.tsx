import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🌐 2026-07-20 유통스타트 해외 수출 바이어 파이프라인 (/admin/buyer-pool).
 *   인플루언서 풀(영입 깔때기)과 결이 다름 — **의도 자격심사 + 매칭 스코어 + 회사→담당자 2단 + BD 파이프라인**.
 *   격리 테이블 `overseas_buyer_leads`. API: /api/admin/buyer-pool/*. 게이트 OFF 면 수집 no-op.
 *   ⚠️ 공개 비즈니스 컨택만 — 콜드 아웃리치는 GDPR·CAN-SPAM·CASL 별도(수집 ≠ 발송).
 */
interface Lead {
  id: number; source: string; intent_signal: string; company: string; country: string | null
  target_market: string | null; category: string | null; imports_from_korea: number | null
  website: string | null; email: string | null; phone: string | null; address: string | null
  decision_maker: string | null; decision_maker_title: string | null; decision_maker_email: string | null
  est_volume: string | null; match_score: number | null; description: string | null
  source_keyword: string | null; status: string; memo: string | null; inquiry_title: string | null
  contacted_at: string | null; follow_up_at: string | null; collected_at: string
}
interface Stats { total: number; hot: number; proven: number; with_contact: number; with_dm: number; active_pipeline: number; recent7: number }
interface Dist { k: string; n: number }
interface Target { id: number; category: string; country: string; keyword: string | null; active: number; hits: number; found_total: number; saved_total: number; last_run_at: string | null }
type IntentTiers = Record<string, { label: string; weight: number }>

// BD 파이프라인 단계 — 자격심사·샘플·협상.
const STAGE_META: Record<string, { label: string; cls: string }> = {
  lead: { label: '리드', cls: 'bg-gray-100 text-gray-600' },
  qualified: { label: '자격확인', cls: 'bg-blue-100 text-blue-700' },
  sampling: { label: '샘플발송', cls: 'bg-cyan-100 text-cyan-700' },
  negotiating: { label: '협상', cls: 'bg-amber-100 text-amber-700' },
  won: { label: '성사', cls: 'bg-emerald-100 text-emerald-700' },
  lost: { label: '실패', cls: 'bg-gray-100 text-gray-400' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const STAGE_ORDER = ['lead', 'qualified', 'sampling', 'negotiating', 'won', 'lost', 'hold']

// 북마클릿 — 모든 B2B 사이트에서 클릭 시 상세 페이지들을 세션으로 읽어 유어딜로 전송(F12·쿠키 불필요).
//   상세 링크를 사이트-무관 휴리스틱(detail/view/offer/inqry/lead/goods + id)으로 탐색 + 화면 우상단 상태박스로 진행 표시.
function buildBookmarklet(token: string): string {
  const api = `${window.location.origin}/api/buyer-ingest`
  const code = `(async()=>{try{var T=${JSON.stringify(token)},A=${JSON.stringify(api)};` +
    `var b=document.createElement('div');b.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483647;background:#111;color:#fff;padding:10px 14px;border-radius:8px;font:13px/1.4 -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);max-width:300px';document.body.appendChild(b);var S=function(t){b.textContent=t};S('유어딜: 리스트 페이지 자동수집 중...');` +
    `var host=location.host,HINT=/detail|view|inqry|inquiry|offer|lead|goods|read/i,IDRE=/[?&]\\w*(sn|no|id|seq|idx|code|num)=\\d+/i;` +
    // 문서(현재 페이지/리스트 iframe)에서 상세 링크 추출 — 앵커 href 우선, 없으면 HTML 정규식 폴백.
    `var linksFrom=function(doc,base){var out=[],cur=String(base||'').split('#')[0];try{[].slice.call(doc.querySelectorAll('a[href]')).forEach(function(a){try{var x=new URL(a.getAttribute('href'),base);if(x.host===host&&HINT.test(x.pathname+x.search)&&IDRE.test(x.search)&&x.href.split('#')[0]!==cur)out.push(x.href.split('#')[0])}catch(e){}})}catch(e){}if(!out.length){var ht='';try{ht=doc.documentElement.outerHTML}catch(e){}var m,r1=/[\\w./-]*(?:inqryDetail|offerDetail|goodsDetail|buyOffer|itemView|prdDetail|Detail|View)[\\w./-]*\\.(?:do|jsp|html?|nhn)\\?[^"'\\s<>()]*(?:sn|no|id|seq|idx|num)=\\d+/gi;while((m=r1.exec(ht))){try{out.push(new URL(m[0],base).href.split('#')[0])}catch(e){}}if(/buykorea/i.test(host)){var r2=/inqrySn['"\\s:=,>]+(\\d{4,})/gi;while((m=r2.exec(ht))){out.push(location.origin+'/seller/ec/inq/inqryDetail.do?inqrySn='+m[1])}}}return out};` +
    // 리스트 iframe 링크 시그니처/대기 + 다음페이지 컨트롤 탐지·실행(GET 파라미터 & POST/JS 클릭 겸용).
    `var sigOf=function(a){return a.slice().sort().join('|').slice(0,4000)};` +
    `var readList=function(fr){try{return linksFrom(fr.contentDocument,fr.contentWindow.location.href)}catch(e){return[]}};` +
    `var waitList=function(fr,prev){return new Promise(function(res){var n=0;var p=function(){n++;var a=readList(fr),s=sigOf(a);if((s&&s!==prev)||n>=16){res(a)}else setTimeout(p,300)};setTimeout(p,400)})};` +
    `var findNext=function(doc,pg){try{var as=[].slice.call(doc.querySelectorAll('a'));for(var i=0;i<as.length;i++){var t=(as[i].textContent||'').trim(),h=(as[i].getAttribute('href')||'')+' '+(as[i].getAttribute('onclick')||'');if(t===String(pg)&&/page|link_page|goPage|fnPage|fn_egov|movePage|list|Index|No=/i.test(h))return as[i]}for(var j=0;j<as.length;j++){var t2=(as[j].textContent||'').trim();if(/^(다음|next|›|»|＞|>)$/i.test(t2))return as[j]}}catch(e){}return null};` +
    `var fire=function(win,a){try{var h=a.getAttribute('href')||'',o=a.getAttribute('onclick')||'';if(/^javascript:/i.test(h)){win.eval('(function(){'+h.replace(/^javascript:/i,'')+'})()');return true}if(o){win.eval('(function(){'+o+'})()');return true}if(h){win.location.href=new URL(h,win.location.href).href;return true}a.click();return true}catch(e){return false}};` +
    // 페이지 파라미터 탐지(URL → 페이지네이션 앵커) — GET 폴백용. 없으면 pageIndex.
    `var baseUrl=location.href.split('#')[0],PGRE=/[?&](pageIndex|pageNo|pageNum|currentPageNo|cpage|nowPage|pgno|page)=(\\d+)/i;` +
    `var pm=baseUrl.match(PGRE),pname=pm?pm[1]:'';if(!pname){try{var pas=document.querySelectorAll('a[href]');for(var k=0;k<pas.length&&!pname;k++){var hv=pas[k].getAttribute('href')||'';var hm=hv.match(PGRE);if(hm)pname=hm[1]}}catch(e){}}if(!pname)pname='pageIndex';` +
    `var pageUrl=function(n){var re=new RegExp('([?&]'+pname+'=)\\\\d+','i');if(re.test(baseUrl))return baseUrl.replace(re,'$1'+n);return baseUrl+(baseUrl.indexOf('?')>=0?'&':'?')+pname+'='+n};` +
    `var self=IDRE.test(location.search)&&HINT.test(location.pathname);` +
    // 1페이지(현재 DOM) 수집 후, 리스트 iframe 으로 다음 페이지를 클릭(POST/JS) 또는 GET 으로 넘기며 누적(끝/안전상한까지).
    `var seen={},L=[],addL=function(a){for(var q=0;q<a.length;q++){if(a[q]&&!seen[a[q]]){seen[a[q]]=1;L.push(a[q])}}};` +
    `addL(linksFrom(document,baseUrl));var LP=1,MAXP=40,DCAP=600;` +
    `if(!self){var lf=document.createElement('iframe');lf.style.cssText='position:fixed;left:-9999px;top:0;width:1200px;height:1400px;border:0';document.body.appendChild(lf);` +
    `await new Promise(function(res){var to=setTimeout(res,15000);lf.onload=function(){clearTimeout(to);setTimeout(res,700)};lf.src=baseUrl});` +
    `var prevSig=sigOf(readList(lf));addL(readList(lf));` +
    `for(var pg=2;pg<=MAXP&&L.length<DCAP;pg++){S('유어딜: 리스트 '+pg+'페이지 수집 중 · 상세링크 '+L.length+'개');var a=findNext(lf.contentDocument,pg),got=null;if(a&&fire(lf.contentWindow,a)){got=await waitList(lf,prevSig)}else{try{lf.src=pageUrl(pg)}catch(e){}got=await waitList(lf,prevSig)}var ns=sigOf(got||[]);if(!ns||ns===prevSig)break;prevSig=ns;addL(got);LP=pg;await new Promise(function(x){setTimeout(x,120)})}` +
    `try{lf.remove()}catch(e){}}` +
    `var TF=L.length;L=L.slice(0,DCAP);` +
    `if(!L.length&&!self){S('❌ 상세 링크를 못 찾았어요. 구매요청 리스트 페이지(목록)에서 눌러주세요.');setTimeout(function(){b.remove()},8000);return}` +
    // ② 이미 저장된 상세 건너뛰기 — 서버에 ref(host|id) 조회 후 신규만 남김(재수집 효율).
    `var refKey=function(u){try{var h=new URL(u).host.replace(/^www\\./,'');var m=u.match(/[?&](\\w*(?:sn|no|id|seq|idx|code|num))=(\\d+)/i);return h+'|'+(m?m[1].toLowerCase()+'='+m[2]:u.split('#')[0].slice(-80))}catch(e){return String(u).slice(0,120)}};` +
    `var allRefs=L.map(refKey),known={};if(!self){try{var kr=await fetch(A+'/known',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:T,refs:allRefs})});if(kr.ok){var kj=await kr.json();if(kj&&kj.known)for(var z=0;z<kj.known.length;z++)known[kj.known[z]]=1}}catch(e){}}` +
    `var FOUND=L.length,skip=0,L2=[],RF=[];for(var w=0;w<L.length;w++){if(known[allRefs[w]]){skip++}else{L2.push(L[w]);RF.push(allRefs[w])}}L=L2;` +
    `if(!L.length&&!self){S('✅ 새 상세 없음 — '+FOUND+'건 모두 이미 저장됨(리스트 '+LP+'p)');setTimeout(function(){b.remove()},9000);return}` +
    // ⚠️ buyKorea 는 fetch 요청을 로그인으로 돌려보냄 → 숨은 iframe 으로 실제 이동시켜 세션째 읽는다(같은 사이트라 DOM 접근 가능).
    `var readIf=function(url){return new Promise(function(res){var f=document.createElement('iframe');f.style.cssText='position:fixed;left:-9999px;top:0;width:1200px;height:900px;border:0';var done=false,tm;var fin=function(h){if(done)return;done=true;clearTimeout(tm);try{f.remove()}catch(e){}res(h||'')};f.onload=function(){var n=0;var poll=function(){n++;var html='',ok=false;try{html=f.contentDocument.documentElement.outerHTML;ok=/회사명|Company\\s*Name|인콰이어리\\s*번호|Buyer\\s*Info|국가\\s*\\/?\\s*도시|현재\\s*수입/i.test(html)}catch(e){}if(ok||n>=16){fin(html)}else setTimeout(poll,300)};setTimeout(poll,350)};tm=setTimeout(function(){fin('')},18000);f.src=url;document.body.appendChild(f)})};` +
    `var CHUNK=6,MAXB=1.2e6,buf=[],bb=0,tS=0,tP=0,tR=0,ef=0,err='',lg=0;` +
    `var strip=function(h){return String(h||'').replace(/<script[\\s\\S]*?<\\/script>/gi,' ').replace(/<style[\\s\\S]*?<\\/style>/gi,' ').replace(/<svg[\\s\\S]*?<\\/svg>/gi,' ').replace(/<!--[\\s\\S]*?-->/g,' ')};` +
    `var push=function(h,r){h=String(h||'');var ld='',lm,lre=/<script[^>]*ld\\+json[^>]*>([\\s\\S]*?)<\\/script>/gi;while((lm=lre.exec(h))){ld+=' '+lm[1]}h=strip(h)+(ld?(' __JSONLD__'+ld.replace(/\\s+/g,' ')+'__JSONLD__'):'');buf.push({h:h,r:r||''});bb+=h.length;tR++};` +
    `var send=async function(batch){if(!batch.length)return;try{var res=await fetch(A,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:T,htmls:batch.map(function(x){return x.h}),refs:batch.map(function(x){return x.r})})});if(!res.ok){ef++;err='HTTP '+res.status;return}var j=await res.json();if(j&&j.result){tS+=(j.result.saved||0);tP+=(j.result.parsed||0)}else{ef++;if(j&&j.error)err=j.error}}catch(e){ef++;err=String(e&&e.message||e)}};` +
    `if(self)push(document.documentElement.outerHTML,refKey(location.href));` +
    // ① 상세를 CONC개씩 병렬로 읽어 수집 시간 단축(순차 대비 ~3배).
    `var CONC=3;for(var i=0;i<L.length;i+=CONC){var sl=L.slice(i,i+CONC),rl=RF.slice(i,i+CONC);S('유어딜: 상세 읽는 중 '+(i+1)+'-'+Math.min(i+CONC,L.length)+'/'+L.length+' (리스트 '+LP+'p) · 저장 '+tS);var hs=await Promise.all(sl.map(function(u){return readIf(u)}));for(var j=0;j<hs.length;j++){var html=hs[j];if(html){if(/일반회원\\s*로그인|아이디를\\s*입력|비밀번호를\\s*입력/i.test(html.slice(0,6000)))lg++;push(html,rl[j])}}if(buf.length>=CHUNK||bb>=MAXB){await send(buf);buf=[];bb=0}await new Promise(function(x){setTimeout(x,80)})}` +
    `await send(buf);buf=[];bb=0;` +
    `if(ef||err){S('❌ 전송 실패: '+(err||('배치 '+ef))+' (읽음 '+tR+' · 저장 '+tS+') — 관리자 문의')}` +
    `else if(tR===0){S('❌ 상세를 못 읽음(iframe 차단?) · 링크 '+L.length+'개 — 관리자에게 알려주세요')}` +
    `else if(lg>=tR&&!tP){S('⚠️ 로그인 페이지가 읽혔어요 — buyKorea 재로그인 후 다시 눌러주세요')}` +
    `else if(!tP){S('⚠️ '+tR+'개 읽었지만 파싱 0 — 상세 1건을 Ctrl+A→Ctrl+C 해서 관리자에게 보내주세요')}` +
    `else{S('✅ 완료 · 리스트 '+LP+'p 자동수집 · 신규읽음 '+tR+' · 파싱 '+tP+' · 저장 '+tS+'건'+(skip?(' · 기존 '+skip+'건 건너뜀'):'')+(TF>FOUND?(' (상세 '+TF+'개 중 '+DCAP+'개까지 — 다시 눌러 이어서)'):'')+(LP>=MAXP?' (안전상 '+MAXP+'p까지)':''))}setTimeout(function(){b.remove()},24000);` +
    `}catch(e){alert('유어딜 전송 실패: '+e)}})()`
  return 'javascript:' + encodeURIComponent(code)
}

// 무료 B2B 구매리드(바이어 구매요청) 수집처. 2단계: ① 리스트(발굴) ② 각 상세(연락처).
// 전부 무료 가입, 유료 provider 없음. list=구매요청 목록, detail=각 건의 상세(회사명·이메일·홈페이지).
const BUYER_SOURCES: { name: string; url: string; org: string; list: string; detail: string }[] = [
  { name: 'buyKorea', url: 'https://www.buykorea.org', org: 'KOTRA (대한무역투자진흥공사)', list: '로그인 → 「인콰이어리(Inquiry)」 → 「일반상품」/카테고리(미용·식음료 등) → 구매요청 리스트를 100/200개 펼쳐 복사', detail: '리스트에서 각 건 클릭 → 상세(회사명·국가·이메일·웹사이트·현재수입국) 페이지를 Ctrl+A → Ctrl+C → 붙여넣기' },
  { name: 'tradeKorea', url: 'https://www.tradekorea.com', org: 'KITA (한국무역협회)', list: '로그인 → 「Buying Offers」(구매오퍼) → Category/Country 필터 → 리스트 복사', detail: '각 Offer 클릭 → 상세(Company·Email·Homepage·Contact) 페이지 복사 → 붙여넣기' },
  { name: 'GoBizKorea', url: 'https://www.gobizkorea.com', org: '중소기업유통센터', list: '로그인 → 「Buying Leads」(구매정보) → 리스트 복사', detail: '각 Lead 클릭 → 상세(Buyer·Email·Website) 페이지 복사 → 붙여넣기' },
  { name: 'EC21', url: 'https://www.ec21.com', org: '글로벌 B2B 마켓플레이스', list: '로그인 → 「Trade Leads → Buying Leads」 → 키워드/카테고리 검색 → 리스트 복사', detail: '각 Buy Offer 클릭 → 상세(Company·Contact·Email) 페이지 복사 → 붙여넣기' },
  { name: 'ECPlaza', url: 'https://www.ecplaza.net', org: '글로벌 B2B 마켓플레이스', list: '로그인 → 「Trade Leads → Buy Offers」 → 리스트 복사', detail: '각 Buy Offer 클릭 → 상세(Company·Email·Website) 페이지 복사 → 붙여넣기' },
]

function scoreCls(s: number | null): string {
  const v = s ?? 0
  if (v >= 70) return 'bg-emerald-500 text-white'
  if (v >= 50) return 'bg-amber-400 text-white'
  return 'bg-gray-200 text-gray-600'
}

export default function AdminBuyerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, hot: 0, proven: 0, with_contact: 0, with_dm: 0, active_pipeline: 0, recent7: 0 })
  const [byIntent, setByIntent] = useState<Dist[]>([])
  const [byCountry, setByCountry] = useState<Dist[]>([])
  const [byCategory, setByCategory] = useState<Dist[]>([])
  const [intentTiers, setIntentTiers] = useState<IntentTiers>({})
  const [meta, setMeta] = useState<{ enabled: boolean; feeds: number; autoFetchEnabled: boolean }>({ enabled: false, feeds: 0, autoFetchEnabled: false })
  const [targets, setTargets] = useState<Target[]>([])
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')
  const [intent, setIntent] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [hasContact, setHasContact] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [newCountry, setNewCountry] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const emptyForm = { company: '', country: '', category: '', target_market: '', intent_signal: 'buying_lead', imports_from_korea: false, website: '', email: '', address: '', decision_maker: '', decision_maker_title: '', decision_maker_email: '', est_volume: '', description: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [importing, setImporting] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showAuto, setShowAuto] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [autoCookie, setAutoCookie] = useState('')
  const [autoListUrl, setAutoListUrl] = useState('')
  const [autoMax, setAutoMax] = useState(10)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoSave, setAutoSave] = useState(true)
  const [ingestToken, setIngestToken] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const bmRef = useRef<HTMLAnchorElement>(null)
  const [autoConfig, setAutoConfig] = useState<{ sources: { host: string; url: string; label: string }[]; cookieHosts: string[]; enabled: boolean; cronEnabled: boolean }>({ sources: [], cookieHosts: [], enabled: false, cronEnabled: false })

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/buyer-pool/stats')
      if (r.data?.success) {
        setStats(r.data.stats); setByIntent(r.data.byIntent || []); setByCountry(r.data.byCountry || []); setByCategory(r.data.byCategory || [])
        setIntentTiers(r.data.intentTiers || {})
        setMeta({ enabled: !!r.data.enabled, feeds: r.data.feeds || 0, autoFetchEnabled: !!r.data.autoFetchEnabled })
        setLoadError(false)
      }
    } catch { setLoadError(true) } // 실패를 '0건'으로 오표시하지 않도록 배너 노출.
  }, [])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (country) params.set('country', country)
      if (intent) params.set('intent', intent)
      if (minScore > 0) params.set('minScore', String(minScore))
      if (hasContact) params.set('hasContact', '1')
      if (q.trim()) params.set('q', q.trim())
      const r = await api.get(`/api/admin/buyer-pool?${params.toString()}`)
      if (r.data?.success) { setLeads(r.data.leads || []); setLoadError(false) }
    } catch { setLoadError(true); toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [status, country, intent, minScore, hasContact, q])

  const loadTargets = useCallback(async () => {
    try { const r = await api.get('/api/admin/buyer-pool/targets'); if (r.data?.success) setTargets(r.data.targets || []) } catch { /* noop */ }
  }, [])

  const loadAutoConfig = useCallback(async () => {
    try { const r = await api.get('/api/admin/buyer-pool/auto-fetch/config'); if (r.data?.success) setAutoConfig({ sources: r.data.sources || [], cookieHosts: r.data.cookieHosts || [], enabled: !!r.data.enabled, cronEnabled: !!r.data.cronEnabled }) } catch { /* noop */ }
  }, [])

  useEffect(() => { loadStats(); loadTargets(); loadAutoConfig() }, [loadStats, loadTargets, loadAutoConfig])
  useEffect(() => { loadLeads() }, [loadLeads])

  const collect = async () => {
    setCollecting(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/collect')
      const res = r.data?.result
      if (res?.ran) toast.success(`수집 완료 — 발굴 ${res.found} · 신규 ${res.saved} (타깃: ${(res.targets || []).join(', ') || '없음'})`)
      else toast.info(`수집 안 함 (${res?.reason || '알 수 없음'})`)
      await Promise.all([loadStats(), loadLeads(), loadTargets()])
    } catch { toast.error('수집 실행 실패') } finally { setCollecting(false) }
  }

  const patch = async (id: number, body: Record<string, unknown>) => {
    try {
      const r = await api.patch(`/api/admin/buyer-pool/${id}`, body)
      if (r.data?.success) { setLeads(prev => prev.map(l => l.id === id ? { ...l, ...body } as Lead : l)); loadStats() }
      else toast.error(r.data?.error || '수정 실패')
    } catch { toast.error('수정 실패') }
  }

  const remove = async (id: number) => {
    if (!confirm('이 바이어를 삭제할까요?')) return
    try { await api.delete(`/api/admin/buyer-pool/${id}`); setLeads(prev => prev.filter(l => l.id !== id)); setSelected(prev => { const n = new Set(prev); n.delete(id); return n }); loadStats() } catch { toast.error('삭제 실패') }
  }

  // 체크박스 선택 토글 / 현재 목록 전체선택 토글.
  const toggleOne = (id: number) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(leads.map(l => l.id)))

  // 선택 삭제(체크된 리드) — 서버 bulk-delete 후 로컬 반영.
  const deleteSelected = async () => {
    const ids = leads.filter(l => selected.has(l.id)).map(l => l.id)
    if (!ids.length) { toast.error('선택된 리드가 없습니다'); return }
    if (!confirm(`선택한 ${ids.length}개 리드를 삭제할까요?`)) return
    setBulkDeleting(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/bulk-delete', { ids })
      if (r.data?.success) { const del = new Set(ids); setLeads(prev => prev.filter(l => !del.has(l.id))); setSelected(new Set()); loadStats(); toast.success(`${r.data.deleted}개 삭제`) }
      else toast.error(r.data?.error || '삭제 실패')
    } catch { toast.error('삭제 실패') } finally { setBulkDeleting(false) }
  }

  // 전체 삭제(풀 비우기) — 파괴적: 타이핑 확인(DELETE) 후 서버 이중 확인.
  const deleteAll = async () => {
    if (!leads.length && stats.total === 0) { toast.error('삭제할 리드가 없습니다'); return }
    const ans = prompt(`⚠️ 수집된 바이어 리드 전체를 삭제합니다(복구 불가).\n진행하려면 DELETE 를 입력하세요.`)
    if (ans !== 'DELETE') return
    setBulkDeleting(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/bulk-delete', { all: true, confirm: 'DELETE_ALL' })
      if (r.data?.success) { setLeads([]); setSelected(new Set()); loadStats(); toast.success(`전체 ${r.data.deleted}개 삭제`) }
      else toast.error(r.data?.error || '삭제 실패')
    } catch { toast.error('삭제 실패') } finally { setBulkDeleting(false) }
  }

  const addTarget = async () => {
    if (newCat.trim().length < 2 || newCountry.trim().length < 2) { toast.error('카테고리·시장을 입력하세요'); return }
    try {
      const r = await api.post('/api/admin/buyer-pool/targets', { category: newCat.trim(), country: newCountry.trim() })
      if (r.data?.success) { setNewCat(''); setNewCountry(''); loadTargets(); loadLeads() } else toast.error(r.data?.error || '추가 실패')
    } catch { toast.error('추가 실패') }
  }
  const toggleTarget = async (t: Target) => {
    try { await api.patch(`/api/admin/buyer-pool/targets/${t.id}`, { active: !t.active }); loadTargets(); loadLeads() } catch { toast.error('변경 실패') }
  }

  const submitAdd = async () => {
    if (form.company.trim().length < 2) { toast.error('회사명을 입력하세요'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/admin/buyer-pool', { ...form, imports_from_korea: form.imports_from_korea ? 1 : null })
      if (r.data?.success) {
        toast.success(r.data.saved > 0 ? '바이어 추가됨' : '이미 등록된 회사입니다')
        setForm(emptyForm); setShowAdd(false); await Promise.all([loadStats(), loadLeads()])
      } else toast.error(r.data?.error || '추가 실패')
    } catch { toast.error('추가 실패') } finally { setSaving(false) }
  }

  const submitBulk = async () => {
    if (bulkText.trim().split(/\r?\n/).filter(Boolean).length < 2) { toast.error('리스트/표를 붙여넣어 주세요'); return }
    setImporting(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/import', { text: bulkText })
      if (r.data?.success) {
        toast.success(`${r.data.parsed}건 파싱 · ${r.data.saved}건 신규 저장`)
        setBulkText(''); await Promise.all([loadStats(), loadLeads()])
      } else toast.error(r.data?.error || '가져오기 실패')
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || '가져오기 실패 — 리스트/표 형식을 확인해 주세요')
    } finally { setImporting(false) }
  }

  const runAutoFetch = async () => {
    if (autoCookie.trim().length < 10) { toast.error('로그인 쿠키를 붙여넣어 주세요'); return }
    if (!/^https?:\/\//.test(autoListUrl.trim())) { toast.error('리스트 페이지 URL을 넣어 주세요'); return }
    setAutoRunning(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/auto-fetch', { cookie: autoCookie.trim(), listUrl: autoListUrl.trim(), max: autoMax, save: autoSave })
      const res = r.data?.result
      if (res?.ran && !res.reason) { toast.success(`상세 ${res.fetched}건 방문 · ${res.parsed}건 추출 · ${res.saved}건 신규/보강 (실패 ${res.errors})`); if (autoSave) setAutoCookie('') }
      else toast.error(res?.reason || '자동 수집 실패')
      await Promise.all([loadStats(), loadLeads(), loadAutoConfig()])
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || '자동 수집 실패')
    } finally { setAutoRunning(false) }
  }

  const runSaved = async () => {
    setAutoRunning(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/auto-fetch/run-saved', { max: autoMax })
      const res = r.data?.result
      if (res?.ran) {
        const expired = (res.sources || []).filter((s: { reason?: string }) => s.reason?.startsWith('COOKIE_EXPIRED')).map((s: { label: string }) => s.label)
        toast.success(`저장된 소스 ${res.sources?.length || 0}곳 · 총 ${res.saved}건 신규/보강` + (expired.length ? ` · ⚠️ 쿠키 만료: ${expired.join(', ')}` : ''))
      } else toast.error(res?.reason || '저장된 소스가 없습니다')
      await Promise.all([loadStats(), loadLeads(), loadAutoConfig()])
    } catch { toast.error('자동 수집 실패') } finally { setAutoRunning(false) }
  }

  const forgetSource = async (url: string) => {
    try { await api.post('/api/admin/buyer-pool/auto-fetch/forget', { url }); loadAutoConfig() } catch { toast.error('삭제 실패') }
  }
  const toggleCron = async (enabled: boolean) => {
    try { await api.post('/api/admin/buyer-pool/auto-fetch/cron', { enabled }); setAutoConfig(c => ({ ...c, cronEnabled: enabled })); toast.success(enabled ? '매일 밤 무인 자동 수집 ON' : '무인 자동 수집 OFF') } catch { toast.error('변경 실패') }
  }

  const loadToken = useCallback(async () => {
    try { const r = await api.get('/api/admin/buyer-pool/ingest-token'); if (r.data?.success) setIngestToken(r.data.token) } catch { /* noop */ }
  }, [])
  // 북마클릿은 「수집 방법(showGuide)」·「상세 자동수집(showAuto)」 어느 패널에서든 필요 → 둘 중 하나 열리면 토큰 로드.
  useEffect(() => { if ((showGuide || showAuto) && !ingestToken) loadToken() }, [showGuide, showAuto, ingestToken, loadToken])
  // 패널이 열릴 때 버튼이 마운트되므로 deps 에 포함(안 그러면 href 미주입 = 드래그해도 빈 북마클릿).
  useEffect(() => { if (bmRef.current && ingestToken) bmRef.current.setAttribute('href', buildBookmarklet(ingestToken)) }, [ingestToken, showGuide])
  const resetToken = async () => {
    try { const r = await api.post('/api/admin/buyer-pool/ingest-token/reset'); if (r.data?.success) { setIngestToken(r.data.token); toast.success('토큰 재발급 — 북마클릿을 다시 등록하세요') } } catch { toast.error('재발급 실패') }
  }
  // 드래그가 막히는 브라우저(크롬 최신 등) 대비 — 북마클릿 코드를 클립보드로 복사(즐겨찾기 URL 에 붙여넣기).
  const copyBookmarklet = async () => {
    if (!ingestToken) { toast.error('잠시 후 다시 시도해주세요(토큰 로딩 중)'); return }
    try { await navigator.clipboard.writeText(buildBookmarklet(ingestToken)); toast.success('북마클릿 코드 복사됨 — 즐겨찾기 새로 만들고 URL 칸에 붙여넣기(Ctrl+V)') }
    catch { toast.error('복사 실패 — 아래 코드를 길게 눌러 직접 복사하세요') }
  }

  const [enriching, setEnriching] = useState(false)
  const enrichWebsites = async () => {
    setEnriching(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/enrich-websites', { max: 15 })
      const res = r.data?.result
      if (res?.ran) toast.success(res.scanned === 0 ? (res.reason || '대상 없음') : `웹사이트 ${res.scanned}곳 방문 · 이메일/전화 ${res.enriched}건 확보`)
      else toast.error(res?.reason || '이메일 추출 실패')
      await Promise.all([loadStats(), loadLeads()])
    } catch { toast.error('이메일 추출 실패') } finally { setEnriching(false) }
  }

  // window.open 은 쿠키만 보내 Bearer(localStorage) 인증 어드민에선 401 → 에러 JSON 다운로드됨.
  //   axios(Bearer 첨부)로 blob 받아 저장.
  const exportCsv = async () => {
    try {
      const r = await api.get('/api/admin/buyer-pool/export?format=csv', { responseType: 'blob' })
      const url = URL.createObjectURL(r.data as Blob)
      const a = document.createElement('a'); a.href = url; a.download = 'overseas-buyers.csv'; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast.error('CSV 내보내기 실패') }
  }

  return (
    <AdminLayout title="해외 바이어 풀">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <DashboardPageHeader title="🌐 해외 바이어 파이프라인" subtitle="유통스타트 수출 — 의도 자격심사 · 매칭 스코어 · 회사→담당자" />

        {/* 3단계 안내 — 대표가 실제로 하는 일 */}
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
            <span className="font-semibold text-indigo-700">이렇게 쓰세요:</span>
            <span><b>①</b> 「📋 수집 방법 · 북마클릿」 열어 즐겨찾기 등록 → buyKorea에서 클릭</span>
            <span className="text-gray-300">→</span>
            <span><b>②</b> 「🌐 이메일 찾기」로 연락처 보강</span>
            <span className="text-gray-300">→</span>
            <span><b>③</b> 「CSV 내보내기」로 저장</span>
          </div>
        </div>

        {/* 로드 실패 배너 — '0건'을 실제 빈 풀로 오인하지 않게 */}
        {loadError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-2">
            <span>⚠️ 데이터를 불러오지 못했습니다(네트워크·서버 오류). 아래 숫자·목록은 정확하지 않을 수 있습니다.</span>
            <button onClick={() => { loadStats(); loadLeads() }} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium shrink-0">다시 시도</button>
          </div>
        )}

        {/* 핵심 숫자 3개만 (나머지는 접기) */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { l: '전체 바이어', v: stats.total },
            { l: '연락처 확보', v: stats.with_contact },
            { l: '담당자 확보', v: stats.with_dm },
          ].map(s => (
            <div key={s.l} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">{s.l}</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(s.v)}</div>
            </div>
          ))}
        </div>

        {/* 상세 통계·국가·카테고리 — 접기(기본 숨김) */}
        <div className="mb-4">
          <button onClick={() => setShowStats(v => !v)} className="text-xs text-gray-500 hover:text-gray-700">📊 국가·카테고리·상세 통계 {showStats ? '접기 ▲' : '펼치기 ▼'}</button>
          {showStats && (
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { l: '🔥 핫리드 (스코어≥70)', v: stats.hot },
                  { l: '한국 수입 이력', v: stats.proven },
                  { l: '진행 중 파이프라인', v: stats.active_pipeline },
                  { l: '최근 7일', v: stats.recent7 },
                ].map(s => (
                  <div key={s.l} className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="text-xs text-gray-500">{s.l}</div>
                    <div className="text-xl font-bold text-gray-900">{formatNumber(s.v)}</div>
                  </div>
                ))}
              </div>
              {(byCountry.length > 0 || byCategory.length > 0) && (
                <div className="grid lg:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2">국가별 (클릭해 필터)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {byCountry.map(d => <button key={d.k} onClick={() => setCountry(country === d.k ? '' : d.k)} className={`px-2 py-1 rounded-full text-xs ${country === d.k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{d.k} {d.n}</button>)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2">카테고리별</div>
                    <div className="flex flex-wrap gap-1.5">
                      {byCategory.map(d => <span key={d.k} className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{d.k} {d.n}</span>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 액션 바 — 자주 쓰는 3개만 크게, 나머지는 「고급」에 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => setShowGuide(v => !v)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">📋 수집 방법 · 북마클릿 {showGuide ? '숨기기' : ''}</button>
          <button onClick={enrichWebsites} disabled={enriching} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50" title="연락처 없는 리드의 웹사이트를 방문해 이메일·주소를 채웁니다">{enriching ? '이메일 찾는 중…' : '🌐 이메일 찾기'}</button>
          <button onClick={exportCsv} className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 font-medium">CSV 내보내기</button>
          <button onClick={() => setShowAdvanced(v => !v)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-500">고급 {showAdvanced ? '▲' : '▼'}</button>
          {showAdvanced && <>
            <button onClick={() => setShowAdd(v => !v)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700">+ 직접 추가</button>
            <button onClick={collect} disabled={collecting} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 disabled:opacity-50">{collecting ? '수집 중…' : '피드 수집'}</button>
            <button onClick={() => setShowAuto(v => !v)} className="px-3 py-2 rounded-lg bg-white border border-red-200 text-sm text-red-600">🤖 상세 자동 수집 {showAuto ? '숨기기' : ''}</button>
            <button onClick={() => setShowTargets(v => !v)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700">매칭 타깃 {showTargets ? '숨기기' : '관리'}</button>
          </>}
          <div className="flex-1" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="회사/이메일/담당자" className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 w-44" />
          <select value={String(minScore)} onChange={e => setMinScore(Number(e.target.value))} className="px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-900">
            <option value="0">전체 스코어</option>
            <option value="70">🔥 70+</option>
            <option value="50">50+</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-900">
            <option value="">전체 단계</option>
            {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm text-gray-600"><input type="checkbox" checked={hasContact} onChange={e => setHasContact(e.target.checked)} /> 컨택만</label>
          {(country || intent) && <button onClick={() => { setCountry(''); setIntent('') }} className="text-xs text-gray-500 underline">필터 해제</button>}
        </div>

        {/* 📋 수집 방법 안내 — 2단계(발굴→연락처), 전 사이트 공통, 전부 무료 */}
        {showGuide && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">📋 바이어 수집 방법</div>

            {/* 🔖 방법 1 (추천) — 원클릭 북마클릿. 맨 위·크게 */}
            <div className="mb-3 rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4">
              <div className="text-sm font-bold text-indigo-700 mb-1.5">🔖 방법 1 (추천) · 원클릭 북마클릿 — F12·쿠키 필요 없음</div>
              <ol className="text-xs text-gray-700 mb-2.5 ml-4 list-decimal space-y-1">
                <li><b>아래 파란 버튼을 브라우저 상단 「즐겨찾기 바(북마크바)」로 드래그</b>해 등록합니다. <span className="text-gray-400">(최초 1회만. 즐겨찾기 바가 안 보이면 Ctrl+Shift+B)</span></li>
                <li><b>buyKorea에 로그인</b>하고 「인콰이어리」 구매요청 <b>리스트 페이지</b>를 엽니다.</li>
                <li>방금 등록한 <b>즐겨찾기(📥 유어딜 바이어 수집)를 클릭</b>합니다. 끝!</li>
              </ol>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {/* href 는 ref 로 주입(React 의 javascript: 차단 우회) */}
                <a ref={bmRef} onClick={e => e.preventDefault()} draggable className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold cursor-move select-none inline-block shadow" title="이 버튼을 브라우저 즐겨찾기 바로 드래그하세요">📥 유어딜 바이어 수집</a>
                <span className="text-xs text-indigo-600 font-semibold">← 즐겨찾기 바로 <u>드래그</u></span>
                <button onClick={copyBookmarklet} className="px-3 py-2 rounded-lg bg-white border border-indigo-300 text-indigo-700 text-xs font-semibold">📋 드래그 안 되면: 코드 복사</button>
                {ingestToken && <button onClick={resetToken} className="text-[11px] text-gray-400 underline ml-1">토큰 재발급</button>}
              </div>
              <details className="mb-2">
                <summary className="text-[11px] text-indigo-600 cursor-pointer">🖱️ 드래그가 안 되나요? (크롬 최신 버전 등) — 코드 복사로 등록하기</summary>
                <div className="mt-1.5 rounded-lg bg-white p-2.5 text-[11px] text-gray-600 leading-relaxed">
                  <b>「📋 코드 복사」</b> 누른 뒤:<br/>
                  ① 브라우저 즐겨찾기 <b>아무거나 하나 새로 만들기</b> (주소창 옆 ⭐ 또는 Ctrl+D)<br/>
                  ② 그 즐겨찾기 <b>편집</b> → 이름 = <b>유어딜 바이어 수집</b>, <b>URL 칸</b>에 <b>붙여넣기(Ctrl+V)</b> → 저장<br/>
                  ③ 이제 buyKorea 리스트에서 그 즐겨찾기를 누르면 수집됩니다.
                </div>
              </details>
              <div className="rounded-lg bg-white/70 p-2 text-[11px] text-gray-600">
                ✅ 누르면 화면 우상단에 <b>「리스트 2/5 페이지 수집… → 상세 수집 … → ✅ 저장 N건」</b>이 뜨며, 리스트의 <b>모든 페이지를 자동으로 넘기며</b> 각 상세로 들어가 회사명·국가·웹사이트·품목·수량·주소를 저장합니다. 상세를 하나씩 열 필요 없습니다.<br/>※ 바이어 <b>이메일은 사이트가 가려서</b>, 수집 후 위의 <b>「🌐 이메일 찾기」</b> 버튼으로 채웁니다.
              </div>
            </div>

            <div className="text-xs font-semibold text-gray-700 mb-1">또는 · 방법 2 · 수동 복사 붙여넣기 (북마클릿이 안 되는 사이트용)</div>
            <p className="text-xs text-gray-600 mb-3">구매요청 <b>리스트를 Ctrl+A → Ctrl+C</b> 한 뒤, 「고급 ▼ → + 직접 추가」 맨 아래 칸에 <b>Ctrl+V → 붙여넣기 일괄 추가</b>. 상세 페이지도 같은 방법으로 붙여넣으면 회사·연락처가 같은 행에 채워집니다. 아래는 사이트별 리스트 위치 안내입니다.</p>
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg bg-white border border-gray-200 p-2.5">
                <div className="text-xs font-semibold text-gray-900">1단계 · 발굴 (리스트)</div>
                <div className="text-[11px] text-gray-600 mt-0.5">구매요청 목록을 <b>Ctrl+A → Ctrl+C → Ctrl+V</b> → 제품·국가·카테고리가 잡힙니다. 아직 연락처는 없고 「상세 확인」 표시가 붙습니다.</div>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-2.5">
                <div className="text-xs font-semibold text-gray-900">2단계 · 연락처 (상세)</div>
                <div className="text-[11px] text-gray-600 mt-0.5">관심 건을 클릭해 상세 페이지를 <b>Ctrl+A → Ctrl+C → Ctrl+V</b> → 회사명·이메일·홈페이지·담당자·전화가 <b>같은 행에 자동 보강</b>됩니다(중복 안 생김).</div>
              </div>
            </div>
            <div className="space-y-2">
              {BUYER_SOURCES.map((s, i) => (
                <div key={s.name} className="rounded-lg bg-white border border-gray-200 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gray-900 text-white text-[11px] flex items-center justify-center font-bold">{i + 1}</span>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 underline">{s.name}</a>
                    <span className="text-[11px] text-gray-400">{s.org}</span>
                    {i === 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">추천</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-700"><b>① 리스트:</b> {s.list}</div>
                  <div className="mt-0.5 text-xs text-gray-700"><b>② 상세:</b> {s.detail}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
              💡 <b>방법 1(북마클릿)이 대부분 사이트에서 가장 빠릅니다</b> — 리스트 전체 페이지를 자동으로 돌아 상세까지 수집. 수동 복사는 북마클릿이 안 될 때만 쓰세요. ⚠️ 수집한 컨택으로의 콜드 발송은 대상국 규제(GDPR/CAN-SPAM/CASL)를 따르세요.
            </div>
          </div>
        )}

        {/* 🤖 상세 서버 자동 수집 (대표 승인 "위험 감수" — 계정 정지 위험, 게이트 무장 필요) */}
        {showAuto && (
          <div className="mb-4 rounded-xl border-2 border-red-200 bg-red-50/50 p-4">
            <div className="text-[11px] text-gray-500 mb-2">💡 대부분은 「📋 수집 방법·북마클릿」의 <b>방법 1(북마클릿)</b>이면 충분합니다. 아래는 서버가 저장된 쿠키로 직접 방문하는 <b>고급·위험</b> 방식입니다.</div>
            <div className="text-sm font-semibold text-red-700 mb-1">🤖 상세 페이지 서버 자동 수집 (실험 · 위험)</div>
            <div className="text-xs text-red-700 bg-red-100/70 rounded-lg p-2 mb-3">
              ⚠️ 이 기능은 <b>대표님 로그인 쿠키로 서버가 상세 페이지들을 자동 방문</b>합니다. buyKorea·tradeKorea·EC21·ECPlaza·GoBizKorea 각 사이트 약관은 자동·대량 수집을 금지하며, <b>계정이 정지될 수 있습니다.</b> 위험을 감수하고 사용하세요. (방어: 소량 배치 · 요청 간 지연 · 쿠키는 저장하지 않고 이 요청에만 사용)
              {!meta.autoFetchEnabled && <div className="mt-1 font-semibold">🔒 현재 OFF — Cloudflare 환경변수 <code>BUYER_AUTO_FETCH_ENABLED=true</code> 를 설정해야 작동합니다.</div>}
            </div>
            <ol className="text-[11px] text-gray-600 ml-4 list-decimal space-y-0.5 mb-2">
              <li>수집할 사이트에 <b>로그인</b>한 뒤, 구매요청 <b>리스트 페이지</b>를 엽니다.</li>
              <li>브라우저 <b>F12 → Network</b> 탭 → 아무 요청 클릭 → <b>Request Headers</b> 의 <code>cookie:</code> 값을 통째로 복사해 아래에 붙여넣기.</li>
              <li>그 리스트 페이지의 <b>주소(URL)</b>를 복사해 붙여넣고 「자동 수집 실행」.</li>
            </ol>
            <textarea value={autoCookie} onChange={e => setAutoCookie(e.target.value)} rows={2} placeholder="로그인 쿠키(cookie: 헤더 값 전체) 붙여넣기" className="w-full px-2 py-1.5 rounded-lg border border-red-200 text-xs font-mono text-gray-900 mb-2" />
            <div className="flex flex-wrap items-center gap-2">
              <input value={autoListUrl} onChange={e => setAutoListUrl(e.target.value)} placeholder="리스트 페이지 URL (예: https://www.buykorea.org/seller/ec/inq/selectInquiryList.do?...)" className="flex-1 min-w-[240px] px-2 py-1.5 rounded-lg border border-red-200 text-sm text-gray-900" />
              <label className="text-xs text-gray-600">최대 <input type="number" min={1} max={30} value={autoMax} onChange={e => setAutoMax(Math.min(30, Math.max(1, Number(e.target.value) || 10)))} className="w-16 px-2 py-1.5 rounded-lg border border-red-200 text-sm text-gray-900" />건</label>
              <button onClick={runAutoFetch} disabled={autoRunning} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">{autoRunning ? '수집 중…' : '자동 수집 실행'}</button>
            </div>
            <label className="mt-2 flex items-center gap-1.5 text-xs text-gray-700"><input type="checkbox" checked={autoSave} onChange={e => setAutoSave(e.target.checked)} /> <b>쿠키·URL 저장</b> (다음부턴 아래 「저장된 소스 전부 수집」 버튼 한 번이면 됩니다 · 쿠키는 암호화 저장, 만료 시에만 다시 붙여넣기)</label>

            {/* 저장된 소스 — 재입력 없이 원클릭/반복 수집 */}
            <div className="mt-3 pt-3 border-t border-red-100">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold text-gray-800">💾 저장된 소스 {autoConfig.sources.length > 0 && `(${autoConfig.sources.length})`} {autoConfig.cookieHosts.length > 0 && <span className="text-[11px] font-normal text-emerald-600">· 쿠키 저장됨: {autoConfig.cookieHosts.join(', ')}</span>}</div>
                {autoConfig.sources.length > 0 && <button onClick={runSaved} disabled={autoRunning} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium disabled:opacity-50">{autoRunning ? '수집 중…' : '▶ 저장된 소스 전부 수집'}</button>}
              </div>
              {autoConfig.sources.length === 0 ? (
                <div className="text-[11px] text-gray-400">아직 없습니다. 위에서 「쿠키·URL 저장」 체크하고 한 번 실행하면 여기에 쌓입니다.</div>
              ) : (
                <div className="space-y-1">
                  {autoConfig.sources.map(s => (
                    <div key={s.url} className="flex items-center gap-2 text-[11px] bg-white rounded-lg border border-gray-200 px-2 py-1">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{s.host}</span>
                      <span className="flex-1 truncate text-gray-500" title={s.url}>{s.url}</span>
                      <button onClick={() => forgetSource(s.url)} className="text-gray-300 hover:text-red-500 shrink-0">삭제</button>
                    </div>
                  ))}
                </div>
              )}
              {/* 🌙 완전 무인 — 매일 밤 저장 소스 자동 수집 + 웹사이트 이메일 보강 */}
              <label className="mt-2 flex items-start gap-1.5 text-xs text-gray-700">
                <input type="checkbox" checked={autoConfig.cronEnabled} onChange={e => toggleCron(e.target.checked)} className="mt-0.5" />
                <span><b>🌙 매일 밤 무인 자동 수집</b> — 저장된 소스를 매일 자동으로 수집하고, 웹사이트에서 이메일까지 채웁니다. (저장된 쿠키가 유효한 동안만 · 쿠키 만료 시 다시 붙여넣기 필요{!autoConfig.cronEnabled ? '' : ' · 현재 ON'})</span>
              </label>
            </div>
            <div className="mt-2 text-[11px] text-gray-400">※ 한 번에 최대 30건(계정 보호). buyKorea 외 사이트는 리스트 HTML 구조에 따라 링크 인식이 다를 수 있어, 안 되면 상세 URL 직접 지정이 안전합니다. 무인 수집은 <code>BUYER_AUTO_FETCH_ENABLED=true</code> + 위 토글 ON 일 때만 작동(매일 UTC 03시 = 한국 낮 12시).</div>
          </div>
        )}

        {/* 바이어 직접 추가 (LinkedIn/buyKorea 손수 발굴분 — 완전 무료 수동 입력) */}
        {showAdd && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500 mb-2">LinkedIn·buyKorea 등에서 찾은 바이어를 직접 입력 → 매칭 스코어·파이프라인 자동 반영. 회사명만 필수.</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="회사명 *" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="국가 (Vietnam)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="카테고리 (K-beauty)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <select value={form.intent_signal} onChange={e => setForm(f => ({ ...f, intent_signal: e.target.value }))} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900">
                {Object.entries(intentTiers).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input value={form.decision_maker} onChange={e => setForm(f => ({ ...f, decision_maker: e.target.value }))} placeholder="담당자 이름" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.decision_maker_title} onChange={e => setForm(f => ({ ...f, decision_maker_title: e.target.value }))} placeholder="담당자 직책" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.decision_maker_email} onChange={e => setForm(f => ({ ...f, decision_maker_email: e.target.value }))} placeholder="담당자 이메일" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="회사 이메일" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="웹사이트/홈페이지 URL" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 lg:col-span-2" />
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="회사 주소" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 lg:col-span-2" />
              <input value={form.est_volume} onChange={e => setForm(f => ({ ...f, est_volume: e.target.value }))} placeholder="규모/물량 (선택)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <label className="flex items-center gap-1.5 text-sm text-gray-600 px-1"><input type="checkbox" checked={form.imports_from_korea} onChange={e => setForm(f => ({ ...f, imports_from_korea: e.target.checked }))} /> 한국 수입 이력</label>
            </div>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="메모 (취급 품목, 요청사항 등)" rows={2} className="mt-2 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
            <div className="mt-2 flex gap-2">
              <button onClick={submitAdd} disabled={saving} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50">{saving ? '저장 중…' : '추가'}</button>
              <button onClick={() => { setForm(emptyForm); setShowAdd(false) }} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-600">취소</button>
            </div>

            {/* 여러 건 붙여넣기 (buyKorea 목록 복붙 / 엑셀·시트) */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-1.5"><b>buyKorea·tradeKorea·EC21 등 구매요청 리스트를 통째로 복사(Ctrl+A → Ctrl+C)해 붙여넣기(Ctrl+V)</b> → 제품·국가·카테고리 자동 추출(여러 건 한 번에). 상세 페이지를 붙여넣으면 회사명·담당자·이메일·현재수입국까지 채워집니다(마스킹된 연락처는 자동 제외). 엑셀/시트 표(첫 줄 헤더, 탭·쉼표 구분)도 인식. <button type="button" onClick={() => setShowGuide(true)} className="text-blue-600 underline">수집 방법 보기</button></div>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={4} placeholder={'buyKorea 인콰이어리 페이지 전체를 붙여넣거나,\ncompany\tcountry\tcategory\temail\nABC Trading\tVietnam\tK-beauty\tbuyer@abc.com'} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono text-gray-900" />
              <button onClick={submitBulk} disabled={importing} className="mt-2 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{importing ? '가져오는 중…' : '붙여넣기 일괄 추가'}</button>
            </div>
          </div>
        )}

        {/* 매칭 타깃 관리 (= 무엇을 어디로 미는가 = 매칭 기준) */}
        {showTargets && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500 mb-2">매칭 타깃 = 우리 수출 카테고리 × 타깃 시장. 여기 있는 조합에 부합하는 바이어가 매칭 스코어 +25 (변경 시 풀 자동 재스코어).</div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="카테고리(K-beauty)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 w-40" />
              <input value={newCountry} onChange={e => setNewCountry(e.target.value)} placeholder="시장(Vietnam)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 w-40" />
              <button onClick={addTarget} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm">타깃 추가</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {targets.map(t => (
                <button key={t.id} onClick={() => toggleTarget(t)} title={`발굴 ${t.found_total} · 저장 ${t.saved_total}`}
                  className={`px-2 py-1 rounded-full text-xs ${t.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400 line-through'}`}>
                  {t.category}·{t.country} {t.saved_total > 0 ? `(${t.saved_total})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 리스트 — 매칭 스코어 우선 정렬 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* 선택/전체 삭제 툴바 */}
          {!loading && leads.length > 0 && (
            <div className="px-3 py-2 flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 select-none">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-blue-600" />
                전체선택
              </label>
              {selected.size > 0 && <span className="text-gray-500">{selected.size}개 선택됨</span>}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={deleteSelected} disabled={bulkDeleting || selected.size === 0}
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium disabled:opacity-40">
                  선택 삭제{selected.size > 0 ? ` (${selected.size})` : ''}
                </button>
                <button onClick={deleteAll} disabled={bulkDeleting}
                  className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs font-medium disabled:opacity-40">
                  전체 삭제
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">불러오는 중…</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              바이어가 없습니다. {meta.feeds === 0 ? '무료 피드/오픈API URL(BUYER_FEED_URLS)을 등록한 뒤 「지금 수집」을 눌러주세요.' : '「지금 수집」을 눌러 발굴을 시작하세요.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {leads.map(l => (
                <div key={l.id} className={`p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${selected.has(l.id) ? 'bg-blue-50' : ''}`}>
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} className="w-4 h-4 shrink-0 accent-blue-600" title="선택" />
                  <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold ${scoreCls(l.match_score)}`} title="매칭 스코어">{l.match_score ?? '–'}</div>
                  <div className="min-w-[180px] flex-1">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                      {l.company}
                      {l.imports_from_korea === 1 && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">🇰🇷 수입이력</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[intentTiers[l.intent_signal]?.label || l.intent_signal, l.category, l.country, l.target_market && `→${l.target_market}`, l.est_volume].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="min-w-[200px] text-xs text-gray-600">
                    {l.decision_maker && <div className="text-gray-800">👤 {l.decision_maker}{l.decision_maker_title ? ` (${l.decision_maker_title})` : ''}</div>}
                    {l.decision_maker_email && <div>✉ {l.decision_maker_email}</div>}
                    {!l.decision_maker_email && l.email && <div>✉ {l.email}</div>}
                    {l.phone && <div>☎ {l.phone}</div>}
                    {l.address && <div className="text-gray-600" title="회사 주소">📍 {l.address}</div>}
                    {l.website && <a href={l.website.startsWith('http') ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">🌐 {l.website}</a>}
                    {!l.email && !l.decision_maker_email && !l.phone && !l.website && <span className="text-amber-600" title="상세 페이지를 붙여넣으면 이 행에 연락처가 채워집니다">🔎 상세 확인 필요</span>}
                  </div>
                  <select value={l.status} onChange={e => patch(l.id, { status: e.target.value })}
                    className={`px-2 py-1 rounded-full text-xs border-0 ${STAGE_META[l.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                    {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                  </select>
                  <button onClick={() => remove(l.id)} className="text-xs text-gray-300 hover:text-red-500">삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          ⚠️ 수집된 컨택은 공개된 비즈니스 정보입니다. 마케팅 발송(콜드 아웃리치)은 대상국 규제(EU GDPR·미국 CAN-SPAM·캐나다 CASL)를 따르세요 — 이 도구는 발굴·자격심사·매칭까지만 담당합니다.
        </p>
      </div>
    </AdminLayout>
  )
}
