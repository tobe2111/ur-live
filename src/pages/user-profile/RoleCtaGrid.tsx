/**
 * 🛡️ 2026-05-21 v4: 마이페이지 역할 진입 CTA — 영구 디자인.
 *
 * v4 (2026-05-21): 보유한 role 의 "대시보드 바로가기" 단축 카드 추가.
 *   - 셀러 토큰 있으면: 📊 셀러 대시보드 → /seller
 *   - 둘 다 있는 사용자도 양쪽 진입 가능 (셀러+에이전시 겸업).
 *
 * v3 영구 디자인:
 *   - 단일 화이트 카드 컨테이너 안에 list 형식 (당근 마이페이지 "내 메뉴" 패턴).
 *   - 각 항목: emoji + 제목 + 설명 + ›
 *   - 깔끔한 divider, 색은 emoji 자체 색만 사용 (시각 노이즈 zero).
 *   - 로그인 상태로 자동 필터.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
// 🎨 2026-09-28: 셋 다 '무엇을 하는 곳' 이라 유어딜 아이콘. 특히 '내 가게 등록' 은
//    장바구니(ShoppingBag)였는데 **사는 행위**로 읽혔다 — 실제 뜻은 가게를 내는 것이다.
import { UrShopIcon, ProposeIcon, ShopPlusIcon } from '@/components/icons/urdeal-icons'
import { GroupLabel, ListPlate, ListRow, rowIcon } from './list-grammar'
import { COMMUNITY_PROPOSAL_HIDDEN } from '@/shared/feature-flags'

interface Cta {
  /** 🖊️ 2026-08-30: 이모지 문자열 → lucide 컴포넌트.
   *  이모지는 OS 마다 다른 그림이 나오고(애플 컬러 / 노토 / Segoe) 메뉴 아이콘 자리에서는
   *  "임시로 채워 둔 것" 으로 읽힌다. 같은 화면의 `ChevronRight` 와도 언어가 갈렸다. */
  Icon: LucideIcon
  title: string
  desc: string
  to: string
  show: () => boolean
  accent?: boolean // 보유 role 의 대시보드 단축 — 시각적 강조
}

export default function RoleCtaGrid() {
  const { t } = useTranslation()
  const { dashboardItems, signupItems } = useMemo(() => {
    const hasSellerToken = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
    // 내 바로가기 (모든 유저가 가진 유어샵 + 보유 role 의 대시보드 단축)
    const dash: Cta[] = [
      { Icon: UrShopIcon, title: t('roleCta.linkshop', { defaultValue: '내 유어샵' }), desc: t('roleCta.linkshopDesc', { defaultValue: '이용권을 담아 진열하고 소개해요' }), to: '/u/me', show: () => true, accent: true },
      // 🚪 2026-09-28 (대표 확정 — 판매로 가는 문이 넷이고 셋이 복제였다): '셀러 대시보드' 타일 제거.
      //   이 타일과 페이지 최하단 '판매자 모드로 전환' 버튼은 **목적지가 같다**(`/seller`). 같은 일을
      //   하는 문이 둘이면 한쪽만 고쳐지는 날이 오고, 실제로 그렇게 됐다(타일은 `<Link>` 인데
      //   전환 버튼은 `active_role` 을 심고 하드 내비게이션한다 — 같은 곳에 가면서 하는 일이 달랐다).
      //   ⇒ 넓은 화면 대시보드로 가는 문은 **최하단 전환 버튼 하나**로. 매일 쓰는 판매 도구는
      //   페이지 맨 위 '내 가게' 섹션이 맡는다(2026-09-25 §18 — 앉아서 하는 일만 대시보드).
    ]
    // 신규 가입 CTA (보유 안 한 role 만)
    const signup: Cta[] = [
      // 🧭 2026-06-10 (전략 정합 — 라이브 영구 중단·동네딜 집중): 라이브 셀러 CTA 제거,
      //   동네 공구 제안 + 역할 전환(사업자/에이전시) 중심으로 재구성.
      { Icon: ProposeIcon, title: t('roleCta.proposeGb', { defaultValue: '동네 공구 제안' }), desc: t('roleCta.proposeGbDesc', { defaultValue: '원하는 가게 제안하면 모아서 열어드려요' }), to: '/community-group-buy/new', show: () => !COMMUNITY_PROPOSAL_HIDDEN },
      // 🏷️ 2026-08-26: '내 쇼핑몰 열기' → '내 가게 등록'. 유어샵은 가입하면 **이미 있다** — 여기서
      //   새로 만드는 건 매장이다. 목적지도 매장 등록(/store/new)으로(대표 확정 '매장 등록이 선행').
      { Icon: ShopPlusIcon, title: t('roleCta.openShop', { defaultValue: '내 가게 등록' }), desc: t('roleCta.openShopDesc', { defaultValue: '카카오맵에서 내 가게를 찾아 이용권을 팔아요' }), to: '/store/new', show: () => !hasSellerToken },
      // 🌇 2026-09-04 에이전시 완전 일몰(대표 확정) — 09-02 에 신규 가입 CTA 만 뺐고 "이미 에이전시인
      //   사람의 대시보드 바로가기는 유지" 했는데, 그 대시보드 자체가 사라졌다. 바로가기도 함께 제거.
    ]
    return {
      dashboardItems: dash.filter(c => c.show()),
      signupItems: signup.filter(c => c.show()),
    }
  }, [t])

  if (dashboardItems.length === 0 && signupItems.length === 0) return null

  /**
   * 🧾 2026-09-28: 이 목록은 **자기 문법을 갖고 있었다** — 테두리(`border border-line`) · 13px 행 ·
   *   11px 설명 · 흐린 화살표(`text-gray-300`). 같은 화면의 판매 묶음·`내가 산 것` 과 셋이 갈려 있었고,
   *   테두리는 표면 규칙 ①(*"카드 테두리 0"*) 위반이었다. ⇒ `list-grammar` 한 벌로.
   *   경로가 실재하는 줄이라 `to` 로 준다(우클릭·새 탭이 그대로 된다).
   */
  const Row = (c: Cta) => (
    <ListRow key={c.to} to={c.to} icon={rowIcon(c.Icon)} label={c.title} hint={c.desc} />
  )

  return (
    <section className="w-full min-w-0 space-y-4">
      {dashboardItems.length > 0 && (
        <div>
          <GroupLabel>{t('roleCta.myShortcuts', { defaultValue: '내 바로가기' })}</GroupLabel>
          <ListPlate>{dashboardItems.map(Row)}</ListPlate>
        </div>
      )}
      {signupItems.length > 0 && (
        <div>
          <GroupLabel>{t('roleCta.startNewRole', { defaultValue: '추가 역할로 시작하기' })}</GroupLabel>
          <ListPlate>{signupItems.map(Row)}</ListPlate>
        </div>
      )}
    </section>
  )
}
