/**
 * 🏭 2026-06-16 (서브페이지 시안 05 고객센터): /wholesale/support
 *   네이비 히어로(검색) + FAQ(카테고리 탭·아코디언) + 우측 1:1 문의/연락처 카드.
 *   1:1 문의는 기존 신고·제안 게시판(/wholesale/board?tab=report) 재사용 — 새 백엔드 없음.
 *   라이트 고정(WT) — dark: 없음.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, ChevronDown, MessageSquare, Phone } from 'lucide-react'
import SEO from '@/components/SEO'
import { WT } from './wholesale-theme'
import { WholesaleWordmark } from '@/pages/wholesale-catalog/WholesaleLogo'
import { BUSINESS_INFO } from './WholesaleFooter'

type Cat = '전체' | '주문·결제' | '정산·세금' | '등급·회원' | '배송·반품'

interface Faq { cat: Exclude<Cat, '전체'>; q: string; a: string }

const FAQS: Faq[] = [
  { cat: '주문·결제', q: '예치금은 어떻게 충전하나요?', a: '도매몰 대시보드 > 예치금 메뉴에서 충전 금액을 선택하고 안내된 계좌로 송금하시면, 관리자 확인 후 예치금이 충전됩니다. 입금자명을 정확히 입력해주세요.' },
  { cat: '주문·결제', q: '결제 수단은 무엇이 있나요?', a: '유통스타트 도매몰은 예치금(선불 충전)으로 주문을 결제합니다. 충전은 계좌이체(무통장입금)로 진행되며, 입금 확인 후 즉시 주문에 사용할 수 있습니다.' },
  { cat: '주문·결제', q: '최소 주문 수량(MOQ)이 있나요?', a: '상품마다 최소 주문 수량과 주문 단위가 다릅니다. 카탈로그 상품 카드와 상세 페이지에서 MOQ를 확인할 수 있으며, 장바구니에서도 제조사별 최소 주문 금액을 안내합니다.' },
  { cat: '정산·세금', q: '세금계산서는 언제 발행되나요?', a: '예치금 충전 시 입금이 확인되면 전자세금계산서가 자동 발행됩니다. 발행 내역은 대시보드 > 자료 메뉴에서 확인·다운로드할 수 있습니다.' },
  { cat: '정산·세금', q: '거래명세서는 어디서 받나요?', a: '주문 건별 거래명세서는 대시보드 > 거래내역 / 자료 메뉴에서 확인하고 PDF로 내려받을 수 있습니다.' },
  { cat: '등급·회원', q: '회원 등급은 어떻게 정해지나요?', a: '일반 등급은 가입 승인 시 부여되며, 플러스(연 구독)·프리미엄(매출 기준) 등급으로 올라갈수록 더 낮은 공급가가 적용됩니다. 등급별 마진은 카탈로그 공급가에 자동 반영됩니다.' },
  { cat: '등급·회원', q: '직원 계정을 추가할 수 있나요?', a: '유통사 owner/관리자 계정은 대시보드 > 직원 계정 메뉴에서 직원을 초대할 수 있습니다. 직원은 본인 계정으로 로그인하되 회사의 예치금·주문·카탈로그를 공유합니다.' },
  { cat: '배송·반품', q: '배송은 얼마나 걸리나요?', a: '제조사별 출고 정책에 따라 다르며, 보통 결제 확인 후 1~3영업일 내 출고됩니다. 자세한 일정은 공지·자료실 > 배송 안내를 참고하세요.' },
  { cat: '배송·반품', q: '반품·교환은 어떻게 하나요?', a: '상품 하자·오배송은 수령 후 7일 이내 고객센터로 접수해주세요. 단순 변심에 의한 반품은 도매 거래 특성상 제한될 수 있습니다.' },
]

const KEYWORDS = ['예치금 충전', '세금계산서', '회원 등급', '배송', '반품', 'MOQ']
const CATS: Cat[] = ['전체', '주문·결제', '정산·세금', '등급·회원', '배송·반품']

export default function WholesaleSupportPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<Cat>('전체')
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FAQS.filter(f => {
      if (cat !== '전체' && f.cat !== cat) return false
      if (q && !(f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))) return false
      return true
    })
  }, [query, cat])

  const goInquiry = () => navigate('/wholesale/board?tab=report')

  return (
    <div className="min-h-screen pb-20" style={{ background: WT.fill }}>
      <SEO title="고객센터 — 유통스타트" description="자주 묻는 질문, 1:1 문의, 고객센터 연락처" url="/wholesale/support" noindex />

      {/* 로고 브레드크럼 헤더 */}
      <header className="sticky top-0 z-30" style={{ background: '#fff', borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 flex items-center gap-3 h-14">
          <button onClick={() => navigate('/wholesale')} aria-label="도매몰 홈" className="shrink-0">
            <WholesaleWordmark height={26} />
          </button>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: WT.ink4 }} />
          <span className="text-[14px] font-bold" style={{ color: WT.ink }}>고객센터</span>
        </div>
      </header>

      {/* 네이비 히어로 + 검색 */}
      <section style={{ background: WT.ink }}>
        <div className="ur-content-wide px-5 lg:px-8 py-9 lg:py-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="flex justify-center mb-4"><WholesaleWordmark height={26} dark /></div>
            <h1 className="text-[22px] lg:text-[26px] font-extrabold tracking-[-0.02em] text-white">무엇을 도와드릴까요?</h1>
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white px-4" style={{ height: 52 }}>
              <Search className="w-5 h-5 shrink-0" style={{ color: WT.ink4 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="궁금한 점을 검색하세요 (예: 정산, 세금계산서, 등급)"
                className="flex-1 bg-transparent outline-none text-[14px] text-gray-900"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {KEYWORDS.map(k => (
                <button key={k} onClick={() => setQuery(k)}
                  className="text-[12px] rounded-full px-3 py-1.5 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.25)' }}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="ur-content-wide px-5 lg:px-8 pt-6 grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* FAQ */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <h2 className="text-[17px] font-extrabold mr-1" style={{ color: WT.ink }}>자주 묻는 질문</h2>
            {CATS.map(c => {
              const on = cat === c
              return (
                <button key={c} onClick={() => { setCat(c); setOpenIdx(null) }}
                  className="text-[12px] font-semibold rounded-full px-3 py-1.5 transition-colors"
                  style={on ? { background: WT.ink, color: '#fff' } : { background: '#fff', color: WT.ink2, border: '1px solid ' + WT.line2 }}>
                  {c}
                </button>
              )
            })}
          </div>

          <div className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid ' + WT.line2 }}>
            {filtered.length === 0 ? (
              <div className="py-14 text-center" style={{ color: WT.ink3 }}>
                <Search className="w-6 h-6 mx-auto mb-2" style={{ color: WT.ink4 }} />
                <p className="text-[13px]">검색 결과가 없어요. 1:1 문의를 남겨주세요.</p>
              </div>
            ) : filtered.map((f, i) => {
              const open = openIdx === i
              return (
                <div key={f.q} style={i ? { borderTop: '1px solid ' + WT.line } : undefined}>
                  <button onClick={() => setOpenIdx(open ? null : i)} className="w-full flex items-center gap-3 px-4 lg:px-5 py-4 text-left">
                    <span className="text-[11px] font-bold rounded-md px-2 py-1 shrink-0" style={{ color: WT.brand, background: WT.brandSoft }}>{f.cat}</span>
                    <span className="flex-1 text-[14px] font-semibold" style={{ color: WT.ink }}>{f.q}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: WT.ink4 }} />
                  </button>
                  {open && (
                    <div className="px-4 lg:px-5 pb-4 pl-14 lg:pl-[68px] text-[13.5px] leading-relaxed" style={{ color: WT.ink2 }}>{f.a}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 우측 — 1:1 문의 + 연락처 */}
        <aside className="space-y-3">
          <div className="rounded-2xl bg-white p-5" style={{ border: '1px solid ' + WT.line2 }}>
            <div className="inline-flex items-center gap-1.5 text-[14px] font-extrabold mb-1" style={{ color: WT.ink }}>
              <MessageSquare className="w-4 h-4" style={{ color: WT.brand }} /> 1:1 문의
            </div>
            <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: WT.ink3 }}>평일 10:00~17:00 · 보통 1영업일 내 답변</p>
            <button onClick={goInquiry} className="w-full h-11 rounded-xl text-white text-[13.5px] font-bold" style={{ background: WT.brand }}>문의 작성하기</button>
            <button onClick={goInquiry} className="mt-2 w-full h-11 rounded-xl text-[13px] font-semibold" style={{ border: '1px solid ' + WT.line2, color: WT.ink }}>내 문의 내역</button>
          </div>

          <div className="rounded-2xl bg-white p-5" style={{ border: '1px solid ' + WT.line2 }}>
            <div className="text-[12.5px]" style={{ color: WT.ink3 }}>고객센터 · 제휴문의</div>
            <a href={`tel:${BUSINESS_INFO.tel}`} className="flex items-center gap-1.5 text-[20px] font-extrabold my-1" style={{ color: WT.ink }}>
              <Phone className="w-4 h-4" style={{ color: WT.brand }} /> {BUSINESS_INFO.tel}
            </a>
            <a href={`mailto:${BUSINESS_INFO.csEmail}`} className="text-[12.5px] font-semibold hover:underline" style={{ color: WT.brand }}>{BUSINESS_INFO.csEmail}</a>
            <p className="text-[12px] mt-2 leading-relaxed" style={{ color: WT.ink4 }}>
              평일 10:00~17:00<br />점심 12:00~13:00 · 주말·공휴일 휴무<br />Fax. {BUSINESS_INFO.fax}
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
