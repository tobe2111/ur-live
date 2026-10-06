/**
 * 🏪 이용권 상세 — **상품 구성 + 가게 소개** (2026-09-24 대표 문서 ①).
 *
 * ## 무엇이 문제였나
 * 대표가 `/pass/2645` 에서 *"두툼한 삼겹살 500g 과 김치찌개…"* 한 줄에 빨간 박스를 치고
 * **"왜 터무니없이 저 자리에 있지?"** 라고 물었다. 그 문장은 상품 설명(`description`)인데
 * `gb-sec-info` 안에서 `<UsageGuide>` **바로 뒤**에 제목도 구분선도 없이 붙어 있었다 —
 * 바로 위 '유의사항' 불릿의 꼬리처럼 읽힌다.
 * 원인은 디자인이 아니라 이사 자국이다: 2026-09-15 `faed018ff`(#1432, 안 B 마무리)가
 * `UsageGuide` 를 이 앵커로 끌어올리면서 설명 문단이 그 뒤로 밀렸다(`git log -S` 로 확인 — 같은 커밋).
 *
 * ## 그리고 소개란이 없었다
 * 대표 요청: *"소개란이 따로 있었으면 좋겠다 / 글·사진 조합이었으면 좋겠음."*
 * 실측해 보니 **서버는 이미 보내고 있었다** — 라이브 `/api/group-buy/products/2645` 응답에
 * `long_description` · `seller_bio` · `seller_avatar` 가 다 있는데 상세 페이지의 사용 횟수가
 * `long_description` **0회** · `seller_bio` **0회** 였다. 만들 게 아니라 **그리면 되는 것**이었다.
 *
 * ## 이 부품이 하는 일
 *   ① `상품 구성` — `description`(제목과 같으면 생략 · 종전 조건 그대로)
 *   ② `가게 소개` — `long_description` 본문 + 사장님 한마디(`seller_bio` 말풍선 + 아바타)
 * 값이 없으면 그 블록이 **스스로 사라진다**(빈 제목만 남기지 않는다). 셋 다 없으면 `null`.
 *
 * ⚠️ **사진은 여기서 다시 그리지 않는다.** `detail_images` 는 상단 스와이프 갤러리에 이미
 * 병합돼 있어(`GroupBuyDetailPage` 의 갤러리 병합 로직) 여기 넣으면 같은 사진이 두 번 나온다.
 * "글·사진 조합"의 사진은 갤러리와 아바타가 맡는다.
 */
import { cfImage } from '@/utils/cf-image'

/** 이 상품에 '가게 소개' 로 보여 줄 것이 하나라도 있는가. */
export interface StoreIntroSource {
  description?: string | null
  productName?: string | null
  longDescription?: string | null
  sellerBio?: string | null
}

/**
 * 🔗 **탭과 섹션이 같은 판정을 쓰게 하는 SSOT.**
 *
 * 🩸 2026-09-25 라이브 판정에서 잡은 결함: 상세 탭 목록은 '가게 소개' 를 **무조건** 그렸는데
 * 이 부품은 내용이 없으면 `null` 을 돌려준다. 그래서 설명·소개·사장님 말이 전부 빈 상품에서는
 * **눌러도 아무 데도 안 가는 탭**이 남았다(실측: 활성 2,620건 중 최대 23건).
 * 조건을 두 벌로 두면 반드시 갈리므로 판정을 여기 하나로 모은다.
 */
export function hasStoreIntro(src: StoreIntroSource): boolean {
  const raw = (src.description || '').trim()
  const spec = raw && raw !== (src.productName || '').trim() ? raw : ''
  return !!((src.longDescription || '').trim() || (src.sellerBio || '').trim() || spec)
}

export default function StoreIntro({
  description, productName, longDescription, sellerBio, sellerAvatar, sellerName, storeName,
}: {
  description?: string | null
  productName?: string | null
  longDescription?: string | null
  sellerBio?: string | null
  sellerAvatar?: string | null
  sellerName?: string | null
  storeName?: string | null
}) {
  const body = (longDescription || '').trim()
  const bio = (sellerBio || '').trim()
  // 종전 조건 그대로 — 설명이 제목과 같은 말이면 두 번 쓰지 않는다(이사 전 `GroupBuyDetailPage` 의 가드).
  const raw = (description || '').trim()
  const spec = raw && raw !== (productName || '').trim() ? raw : ''
  // 판정은 `hasStoreIntro` 하나만 쓴다 — 탭이 같은 함수를 보고 뜰지 말지 정한다.
  if (!hasStoreIntro({ description, productName, longDescription, sellerBio })) return null

  const who = (storeName || sellerName || '').trim()
  const avatar = sellerAvatar ? (cfImage(sellerAvatar, { width: 120, format: 'auto' }) || sellerAvatar) : null

  return (
    <div id="gb-sec-store" style={{ padding: '22px 18px', scrollMarginTop: 116 }}>
      {spec && (
        <>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>상품 구성</div>
          <p style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.72, color: 'var(--gbd-ink2)', whiteSpace: 'pre-line' }}>{spec}</p>
        </>
      )}

      {(body || bio) && (
        <>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em', marginTop: spec ? 26 : 0 }}>가게 소개</div>
          {body && <p style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.72, color: 'var(--gbd-ink2)', whiteSpace: 'pre-line' }}>{body}</p>}
          {bio && (
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginTop: body ? 16 : 12 }}>
              {avatar
                ? <div role="img" aria-label={who || '사장님'} style={{ width: 36, height: 36, borderRadius: '50%', flex: '0 0 auto', backgroundColor: 'var(--gbd-chip)', backgroundImage: `url("${avatar}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', flex: '0 0 auto', background: 'var(--gbd-chip)' }} />}
              <div style={{ flex: 1, minWidth: 0, background: 'var(--gbd-chip)', borderRadius: 14, padding: '13px 15px' }}>
                {who && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-sub)' }}>{who} 사장님</div>}
                <p style={{ margin: who ? '6px 0 0' : 0, fontSize: 14, lineHeight: 1.7, color: 'var(--gbd-ink2)', whiteSpace: 'pre-line' }}>{bio}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
