import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { InstagramLogo, YouTubeLogo } from '@/components/icons/sns-logos'
import type { UShopSnsPost } from '@/shared/ushop-sns-posts'

/**
 * 🖼️ 유어샵 SNS 최근 게시물 — 2026-11-03 유어샵 B + SNS(대표 *"응 그 순서대로 하자"* 의 세 번째).
 *
 * 진열 판 **아래**에 선다 — 위에 두면 늦게 도착할 때 진열을 밀어낸다(그래서 자리도 예약하지 않는다:
 *   아래에서 늘어나는 것은 읽던 줄을 안 움직인다). 게시물이 없으면 아무것도 안 그린다.
 * 연동된 계정 · 이름표 주소와 같은 계정일 때만 서버가 준다(판정은 서버 `sameSnsAccount`).
 * 썸네일은 플랫폼 CDN 주소 그대로다(인스타 주소는 서명이 붙어 시간이 지나면 만료 — 서버가 6시간마다 새로 받는다).
 *   깨지면 그 칸을 감춘다(깨진 그림 아이콘을 보이지 않는다).
 */
export default function UShopSnsPosts({ handle }: { handle: string }) {
  const q = useApiQuery<UShopSnsPost[]>(
    ['curator', 'sns-posts', handle],
    `/api/curator/${encodeURIComponent(handle)}/sns-posts`,
    { select: (raw) => ((raw as { posts?: UShopSnsPost[] })?.posts ?? []), staleTime: 10 * 60_000 },
  )
  const posts = q.data ?? []
  if (!posts.length) return null
  return (
    <section className="mx-3 mt-3 rounded-2xl bg-surface py-4 lg:mx-0" data-testid="ushop-sns-posts" aria-label="최근 게시물">
      <h2 className="px-5 text-[16px] font-semibold text-gray-900 dark:text-white">최근 게시물</h2>
      <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide px-5">
        {posts.map((p) => (
          <a
            key={p.url}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={p.platform === 'instagram' ? '인스타그램 게시물' : '유튜브 영상'}
            className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-wash active:opacity-80"
          >
            <img
              src={p.thumb}
              alt=""
              width={96}
              height={96}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => { const a = e.currentTarget.closest('a'); if (a) a.style.display = 'none' }}
            />
            <span aria-hidden="true" className="absolute left-2 top-2 w-5 h-5 rounded-md bg-black/45 text-white flex items-center justify-center">
              {p.platform === 'instagram' ? <InstagramLogo size={12} /> : <YouTubeLogo size={12} />}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
