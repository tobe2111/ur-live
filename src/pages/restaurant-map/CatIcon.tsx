/**
 * 🍽️→ 선 아이콘 (2026-09-03 대표 지적 — "이런 부분에서의 아이콘도 문제 아닐까")
 *
 * 사진 없는 자리에 `🍽️` 를 띄우고 있었다. 이모지는 OS 마다 다른 그림이 나오고(애플 컬러 /
 * 노토 / Segoe) 같은 화면의 lucide 선 아이콘과 언어가 갈린다 — 무엇보다 "아직 안 채운 자리"로
 * 읽힌다. 지도 목록·선택 카드 **네 곳**이 각자 이모지를 갖고 있었으므로 규칙은 여기 하나로.
 */
import { dealCategoryMeta } from '@/shared/deal-category-icon'

export default function CatIcon({ cat, className }: { cat?: string | null; className?: string }) {
  const { Icon } = dealCategoryMeta(cat)
  return <Icon className={className} strokeWidth={1.6} aria-hidden="true" />
}
