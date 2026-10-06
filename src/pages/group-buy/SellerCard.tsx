/**
 * 🧑‍🍳 이용권 상세 — 셀러 카드(아바타 · 이름 · 검증 배지 · 핸들 · 프로필 · SNS).
 *
 * ## 왜 추출했나 (2026-09-24)
 * 같은 커밋에서 **가게 소개 섹션**(`StoreIntro`)을 새로 붙이는데 `GroupBuyDetailPage.tsx` 가
 * 파일크기 래칫 **906 / baseline 906** 으로 여유가 0이었다. 이 블록은 상태도 데이터 조회도 없는
 * 순수 표시라 가장 깨끗하게 떨어진다(`UsageGuide`·`StoreLocation` 과 같은 이유·같은 방식).
 *
 * ⚠️ **마크업은 옮기기만 했다** — 아바타 44px, 검증 배지, `publicSellerHandle` 표시 규칙,
 * SNS 원형 36px, `normalizeUrl` 전부 그대로다. 옮기면서 고치면 무엇이 깨졌는지 알 수 없다.
 */
import { CheckCircle2, Facebook, Instagram, Music2, Youtube } from 'lucide-react'
import { cfImage } from '@/utils/cf-image'
import { publicSellerHandle } from '@/shared/seller-handle'

export interface SellerCardDetail {
  seller_name?: string | null
  seller_avatar?: string | null
  seller_username?: string | null
  seller_instagram?: string | null
  seller_youtube?: string | null
  seller_tiktok?: string | null
  seller_facebook?: string | null
}

export default function SellerCard({ d, onProfile }: { d: SellerCardDetail; onProfile: () => void }) {
  if (!d.seller_name) return null
  const snsLinks = [
    d.seller_instagram && { icon: Instagram, url: d.seller_instagram, label: 'Instagram' },
    d.seller_youtube && { icon: Youtube, url: d.seller_youtube, label: 'YouTube' },
    d.seller_tiktok && { icon: Music2, url: d.seller_tiktok, label: 'TikTok' },
    d.seller_facebook && { icon: Facebook, url: d.seller_facebook, label: 'Facebook' },
  ].filter(Boolean) as { icon: typeof Instagram; url: string; label: string }[]
  const normalizeUrl = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {d.seller_avatar
          ? <div role="img" aria-label={d.seller_name} style={{ width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', backgroundColor: 'var(--gbd-chip)', backgroundImage: `url("${cfImage(d.seller_avatar, { width: 120, format: 'auto' }) || d.seller_avatar}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          : <div style={{ width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', background: 'var(--gbd-chip)' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>{d.seller_name}</span>
            <CheckCircle2 style={{ width: 15, height: 15, color: 'var(--gbd-accent)', flex: '0 0 auto' }} />
            <span style={{ fontSize: 12, color: 'var(--gbd-sub)', whiteSpace: 'nowrap' }}>검증 셀러</span>
          </div>
          {/* 🏷️ 2026-09-03 대표 — 자동 발급 아이디(@store_xxxx)는 손님에게 의미가 없다(SSOT: shared/seller-handle). */}
          {publicSellerHandle(d.seller_username) && <div style={{ fontSize: 12.5, color: 'var(--gbd-sub)', marginTop: 2 }}>@{publicSellerHandle(d.seller_username)}</div>}
        </div>
        <button onClick={onProfile} style={{ display: 'inline-flex', alignItems: 'center', gap: 1, padding: '8px 12px', border: '1px solid var(--rule-strong)', borderRadius: 10, background: 'var(--gbd-card)', color: 'var(--gbd-ink2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
          프로필<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      {snsLinks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {snsLinks.map(({ icon: Icon, url, label }) => (
            <a key={label} href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer" aria-label={label} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gbd-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gbd-ink)' }}>
              <Icon style={{ width: 16, height: 16 }} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
