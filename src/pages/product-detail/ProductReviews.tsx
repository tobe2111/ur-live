import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SharePrompt from '@/components/SharePrompt'
import ReviewCard, { type ReviewItem } from './ReviewCard'
/** 리뷰 최소 글자 수 — 버튼 비활성 조건과 안내 문구가 **같은 값**을 봐야 한다(따로 두면 갈린다). */
const MIN_REVIEW_LEN = 10

function ReviewForm({ productId, onSubmitted }: { productId: string | number; onSubmitted: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  // 🛡️ 2026-05-21: 리뷰 사진 첨부 (max 5). compress 후 upload-image → URL 저장.
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  // 🩸 2026-09-03 (대표 신고 — "10자 이상 썼는데도 버튼이 흐릿한 비활성"): 버튼을 클라 state 에
  //   묶는 패러다임을 걷어냈다(아래 버튼 주석 참조). 대신 **클릭 시점**에 재고, 이유는 여기에 남긴다.
  //   토스트로만 알리면 안 된다 — 토스트는 화면 **맨 위**(`fixed top-4`)에 뜨는데 리뷰 폼은 페이지
  //   맨 아래고, 모바일은 키보드까지 올라와 있어 사용자가 그걸 볼 방법이 없다.
  const [hint, setHint] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  // 🏁 2026-06-12 (전수조사 🔴 G5): 리워드 안내 금액을 서버 설정값(platform_settings)과 일치 —
  //   기존 하드코딩 50/100/200 은 실지급(default 100/300/500)과 불일치했음.
  const [rewards, setRewards] = useState({ text: 100, image: 300, video: 500 })

  useEffect(() => {
    if (!open) return
    api.get('/api/reviews/reward-config').then(r => {
      const d = r.data?.data
      if (r.data?.success && d && Number.isFinite(d.text)) setRewards({ text: d.text, image: d.image, video: d.video })
    }).catch(() => { /* 안내 배너 — 기본값 유지 */ })
  }, [open])

  if (!open) {
    return (
      <div className="mt-3">
        {/* 🎫 2026-09-03 (대표 — "이용권 사용해야 리뷰 쓸 수 있게 해야지"): 자격을 **쓰기 전에** 알린다.
            종전엔 별점 고르고 사진 붙이고 열 줄 쓴 다음 누르고 나서야 "안 된다" 를 들었다.
            요청은 여기서만 한다(상세 페이지 열 때가 아니라 **쓰려고 누를 때**) — 모든 방문자에게
            자격 조회를 한 번씩 더 물리지 않으려는 것. */}
        <button
          onClick={async () => {
            setChecking(true)
            try {
              const r = await api.get(`/api/reviews/product/${productId}/eligibility`)
              const d = r.data?.data
              if (d && d.ok === false) { setHint(d.reason || t('reviews.cannotWrite', { defaultValue: '지금은 리뷰를 쓸 수 없어요' })); return }
            } catch (err) {
              const st = (err as { response?: { status?: number } }).response?.status
              if (st === 401) { setHint(t('reviews.loginFirst', { defaultValue: '로그인 후 리뷰를 쓸 수 있어요' })); return }
              // ⚠️ 판정 자체가 실패하면 **막지 않는다** — 여긴 안내용이고 최종 권위는 POST 다.
              //   여기서 막으면 조회 한 번 삐끗에 정당한 사용자가 리뷰를 못 쓴다.
            } finally { setChecking(false) }
            setHint(null); setOpen(true)
          }}
          disabled={checking}
          className="w-full py-2.5 border border-rule-strong rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1D1F29] disabled:opacity-50"
        >
          {checking ? t('reviews.checking', { defaultValue: '확인 중...' }) : t('reviews.writeBtn', { defaultValue: '리뷰 작성하기' })}
        </button>
        {hint && (
          <p className="mt-2 text-[12px] text-gray-600 dark:text-gray-300 text-center">{hint}</p>
        )}
      </div>
    )
  }

  // 🎫 2026-09-02 (대표 "리뷰 작성란 다크에서 글자 안 보임 · 디자인도 손봐야"): 카드 테두리 0 + surface 두 톤,
  //   핑크 정보상자·선물 이모지 → 회색 한 줄, 별은 브랜드 글자색 하나. textarea 는 아래 주석 참조.
  return (
    <div className="mt-3 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{t('reviews.title', { defaultValue: '리뷰 작성' })}</h3>
      <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-3">{t('reviews.rewardBanner', { defaultValue: '텍스트 {{text}}딜, 사진 {{image}}딜, 영상 {{video}}딜 리워드', text: rewards.text, image: rewards.image, video: rewards.video })}</p>
      <div className="flex gap-1 mb-3" role="radiogroup" aria-label={t('reviews.rating', { defaultValue: '별점' })}>
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} type="button" role="radio" aria-checked={s === rating} aria-label={`${s}`} onClick={() => setRating(s)} className={`text-xl ${s <= rating ? 'text-brand-text' : 'text-gray-200 dark:text-[#3A3D44]'}`}>★</button>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={t('reviews.placeholder', { defaultValue: '상품은 어떠셨나요? 최소 10자 이상 작성해주세요.' })}
        rows={3}
        maxLength={2000}
        aria-label={t('reviews.contentLabel', { defaultValue: '리뷰 내용' })}
        // 🩸 2026-09-02: `dark:bg-*` 가 없어 다크에서 브라우저 기본 흰 배경 + 전역 `.dark textarea{color:gray-100}` 글자
        //   = 흰 바탕에 흰 글자(placeholder 만 보임). 입력창은 카드 안의 한 톤 낮은 면(--bg)이다.
        className="w-full px-3 py-2 rounded-xl bg-[#F8F7FC] dark:bg-[#11141C] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-brand/40"
      />

      {/* 남은 글자 안내(항상) + 클릭·서버 판정 사유(hint). 둘은 같은 자리에 쓴다 — 사용자가
          "왜 안 되는지" 를 찾아 헤매지 않게. */}
      {content.length < MIN_REVIEW_LEN && !hint && (
        <p className="mt-1.5 text-[12px] text-gray-500 dark:text-gray-400">
          {t('reviews.minLength', {
            defaultValue: '{{n}}자 더 쓰면 등록할 수 있어요',
            n: MIN_REVIEW_LEN - content.length,
          })}
        </p>
      )}
      {hint && (
        <p className="mt-1.5 text-[12px] font-medium text-gray-800 dark:text-gray-100">{hint}</p>
      )}

      {/* 🛡️ 2026-05-21: 사진 업로드 — 최대 5장, 5MB/장. 리워드 100딜 (사진 첨부 시). */}
      <div className="mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          {images.map((url, idx) => (
            <div key={idx} className="relative w-16 h-16">
              <img src={url} alt="" className="w-full h-full object-cover rounded-md" />
              <button
                type="button"
                onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 text-white rounded-full text-[10px] font-bold flex items-center justify-center"
                aria-label="삭제"
              >×</button>
            </div>
          ))}
          {images.length < 5 && (
            <label className="w-16 h-16 border border-dashed border-rule-strong rounded-xl flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 active:scale-95 transition">
              {uploading ? (
                <span className="text-[10px]">업로드 중</span>
              ) : (
                <>
                  <span className="text-xl">+</span>
                  <span className="text-[9px]">{images.length}/5</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하만 가능'); return }
                  setUploading(true)
                  try {
                    const { compressForThumbnail } = await import('@/lib/image-compress')
                    const compressed = await compressForThumbnail(file)
                    const fd = new FormData()
                    fd.append('image', compressed)
                    const res = await api.post('/api/seller/upload-image', fd)
                    if (res.data?.success && res.data.url) {
                      setImages(prev => [...prev, res.data.url])
                    } else {
                      toast.error(res.data?.error || '업로드 실패')
                    }
                  } catch (err: unknown) {
                    toast.error((err as Error).message || '업로드 실패')
                  } finally {
                    setUploading(false)
                    e.target.value = ''
                  }
                }}
              />
            </label>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => setOpen(false)} className="flex-1 py-2 bg-gray-100 dark:bg-[#11141C] text-gray-600 dark:text-gray-300 text-sm rounded-xl font-medium">{t('common.cancel', { defaultValue: '취소' })}</button>
        {/* 🩸 2026-09-03 (대표 신고 — "10자 이상 썼는데도 흐릿한 비활성"): 버튼을 클라 state
            (`content.length`)에 묶는 **hard-disable 패러다임을 걷어냈다.**

            실제 컴포넌트를 렌더해 12자를 넣으면 버튼은 활성된다(단위 테스트로 고정) — 즉 로직은
            맞는데 대표님 환경에서는 잠겼다. 원인 후보(모바일 한글 IME 조합 중 state 지연, 인앱
            브라우저, 캐시된 옛 청크)를 하나씩 좁히는 대신 **잠길 수 있는 구조 자체를 없앤다.**

            같은 교훈이 이 레포에 이미 있다 — 2026-06-26 `TossPaymentWidget` 은 약관 동의를 state 로
            미러링해 버튼에 묶었다가 desync 로 결제 버튼이 잠기는 사고를 냈고, **클릭-시점 검증**으로
            전환했다(대표 "대형 서비스처럼"). 리뷰 버튼만 그 옛 패러다임에 남아 있었다.

            ⇒ 버튼은 제출 중에만 잠긴다. 길이는 **누를 때** 재고, 모자라면 그 자리에 이유를 쓴다.
               규칙(10자)은 그대로다 — 바뀐 것은 "언제 재는가" 와 "어디에 말하는가" 뿐. */}
        <button
          disabled={submitting}
          onClick={async () => {
            const body = content.trim()
            if (body.length < MIN_REVIEW_LEN) {
              setHint(t('reviews.minLength', {
                defaultValue: '{{n}}자 더 쓰면 등록할 수 있어요',
                n: MIN_REVIEW_LEN - body.length,
              }))
              taRef.current?.focus()
              return
            }
            setHint(null)
            setSubmitting(true)
            try {
              const res = await api.post('/api/reviews', { product_id: Number(productId), rating, content, images })
              if (res.data.success) {
                setOpen(false); setContent(''); setRating(5); setImages([])
                onSubmitted()
                if (res.data.reward) setShowSharePrompt(true)
              } else {
                toast.error(res.data.error || t('reviews.writeFailed', { defaultValue: '리뷰 작성 실패' }))
              }
            } catch (err: unknown) {
              // 🛡️ 2026-05-21: 백엔드 응답 형식 분기 — 구매자 전용 403 등 상세 메시지 노출.
              const ax = err as { response?: { status?: number; data?: { error?: string; error_code?: string } } }
              const status = ax.response?.status
              const code = ax.response?.data?.error_code
              const serverMsg = ax.response?.data?.error
              // 🎫 2026-09-02: 이용권은 `VOUCHER_NOT_USED`(사용 전) — 서버 문구를 그대로 쓴다.
              if (code === 'NOT_PURCHASED' || code === 'VOUCHER_NOT_USED' || status === 403) {
                const msg = serverMsg || '리뷰는 해당 상품을 구매하신 분만 작성하실 수 있어요'
                // 🩸 인라인에도 남긴다 — 토스트는 화면 맨 위라 여기(페이지 맨 아래 + 키보드)에서 안 보인다.
                setHint(msg)
                toast.error(msg, { duration: 5000 })
              } else {
                const msg = serverMsg || (err instanceof Error ? err.message : t('reviews.writeError', { defaultValue: '리뷰 작성에 실패했습니다' }))
                toast.error(msg)
              }
            } finally { setSubmitting(false) }
          }}
          className="flex-[2] py-2 bg-brand hover:bg-brand-dark text-white text-sm rounded-xl font-bold disabled:opacity-40"
        >
          {submitting ? t('reviews.submitting', { defaultValue: '등록 중...' }) : t('reviews.submit', { defaultValue: '리뷰 등록' })}
        </button>
      </div>
      {showSharePrompt && (
        <SharePrompt
          title={t('reviews.sharedTitle', { defaultValue: '리뷰가 등록되었어요' })}
          message={t('reviews.sharedMessage', { defaultValue: '딜 포인트가 지급되었어요. 이 상품을 친구에게 추천해보세요!' })}
          shareTitle={t('reviews.sharedShareTitle', { defaultValue: '이 상품 추천해요!' })}
          shareDescription={t('reviews.sharedShareDesc', { defaultValue: '유어딜에서 좋은 상품을 발견했어요' })}
          shareLink={`/products/${productId}`}
          shareButtonText={t('reviews.sharedShareBtn', { defaultValue: '상품 보러가기' })}
          onClose={() => setShowSharePrompt(false)}
        />
      )}
    </div>
  )
}

interface ReviewSummary {
  avg_rating: number
  total_count: number
  star_1?: number
  star_2?: number
  star_3?: number
  star_4?: number
  star_5?: number
  [key: string]: number | undefined
}

// 🧩 2026-08-19: 리뷰 모양은 `ReviewCard`(카드 SSOT)의 타입을 그대로 쓴다 — 두 벌이면 갈린다.
type Review = ReviewItem


export default function ProductReviews({ productId, limit = 5 }: { productId: number | string; limit?: number }) {
  const { t } = useTranslation()
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  // 🗑️ 2026-07-07 (로딩 낭비 감사): 리뷰는 상품상세 최하단(폴드 밖)이라 마운트 즉시 summary+list 를
  //   받던 것을 IntersectionObserver 로 게이팅(600px). 부모(ProductDetailPage)가 above-fold 평점용
  //   경량 summary 를 이미 갖고 있어, 여기 상세 summary/목록은 섹션 근처 스크롤 시에만 로드 → 마운트
  //   중복 요청 제거. HomeProductsRail 동일 패턴.
  const [inView, setInView] = useState(false)
  const gateRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = gateRef.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setInView(true); io.disconnect() }
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  // summary 는 limit 무관 — 전체보기(5→100) 토글이 summary 를 재요청하지 않도록 list 와 분리.
  useEffect(() => {
    if (!inView) return
    api.get(`/api/reviews/product/${productId}/summary`)
      .then(r => { if (r?.data?.success) setSummary(r.data.data) })
      .catch(() => { /* silent */ })
  }, [productId, inView])

  useEffect(() => {
    if (!inView) return
    api.get(`/api/reviews/product/${productId}?limit=${limit}`)
      // 🔴 2026-08-02: 배열이 아니면 **빈 배열**. 이전엔 `r.data.data.reviews` 를 그대로 넣어서,
      //   응답에 `reviews` 가 없기만 해도 아래 `reviews.length` 가 터지고 ErrorBoundary 가
      //   **상품 상세 페이지 전체**를 삼켰다(리뷰 한 칸이 아니라 화면 전체). 렌더 스모크에서 실측.
      .then(r => { if (r?.data?.success) setReviews(Array.isArray(r.data.data?.reviews) ? r.data.data.reviews : []) })
      .catch(() => { /* silent */ })
  }, [productId, limit, inView])

  const avgRating = summary?.avg_rating ?? 0
  const totalCount = summary?.total_count ?? 0

  return (
    <div>
      {/* 🗑️ 2026-07-07 폴드-아래 게이트 센티넬: 뷰포트 600px 안에 들어오면 리뷰 summary/목록 로드. */}
      <div ref={gateRef} aria-hidden style={{ height: 1 }} />
      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
        {t('reviews.heading', { defaultValue: '리뷰' })} {totalCount > 0 && <span className="text-gray-500 dark:text-gray-400 font-normal">({totalCount})</span>}
      </h2>

      {totalCount > 0 ? (
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{avgRating}</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className={`text-sm ${s <= Math.round(avgRating) ? 'text-brand-text' : 'text-gray-200 dark:text-[#3A3D44]'}`}>★</span>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map(s => {
              const count = summary?.[`star_${s}`] ?? 0
              const pct = totalCount > 0 ? (count / totalCount) * 100 : 0
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 w-3">{s}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#1D1F29] rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">{t('reviews.noReviews', { defaultValue: '아직 리뷰가 없습니다.' })}</p>
      )}

      <ReviewForm productId={productId} onSubmitted={() => {
        api.get(`/api/reviews/product/${productId}?limit=${limit}`).then(r => { if (r.data.success) setReviews(r.data.data.reviews) })
        api.get(`/api/reviews/product/${productId}/summary`).then(r => { if (r.data.success) setSummary(r.data.data) })
      }} />

      {/* ⭐ 2026-08-19 (대표 시안 — 그루폰 리뷰): 카드 한 벌(`ReviewCard`) + **PC 2열**.
          한 줄에 하나씩 쌓으면 리뷰 5개가 화면을 다 먹는다(그루폰도 2열이다).
          구분선은 카드 사이에만 — 테두리 상자를 씌우면 "AI가 만든 티"가 난다(대표 지적). */}
      {reviews.length > 0 && (
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-10 divide-y divide-gray-100 dark:divide-[#2C2F35] lg:divide-y-0">
          {reviews.map((r) => (
            <div key={r.id} className="lg:border-t lg:border-gray-100 dark:lg:border-[#2C2F35]">
              <ReviewCard r={r} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
