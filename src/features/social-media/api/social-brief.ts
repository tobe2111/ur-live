/**
 * 🆕 2026-07-15 소셜 자동화 — grounding brief + 플랫폼 포맷 스펙 + 출력 검증.
 *
 * 유어딜 "자체 홍보" 이므로 blog-ai 의 PROMO_BRIEF / OUTPUT_FORBIDDEN / findForbidden 을
 * SSOT 로 재사용한다(운영/내부 정보 유출·폐기 용어·도매 유입을 동일하게 원천 차단).
 * 여기서는 플랫폼별(스레드/인스타/유튜브) 출력 포맷 규칙만 추가로 정의한다.
 *
 * 설계: docs/design/social-media-automation.md
 */
import { PROMO_BRIEF, findForbidden } from '../../blog/api/blog-ai'
export { PROMO_BRIEF, findForbidden }
export { PROMO_TOPICS } from '../../blog/api/blog-ai'
export type { PromoTopic } from '../../blog/api/blog-ai'

export type SocialPlatform = 'threads' | 'instagram' | 'youtube'
export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = ['threads', 'instagram', 'youtube'] as const
export function isSocialPlatform(v: unknown): v is SocialPlatform {
  return typeof v === 'string' && (SOCIAL_PLATFORMS as readonly string[]).includes(v)
}

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  threads: '스레드', instagram: '인스타그램', youtube: '유튜브',
}

/** 플랫폼별 미디어 요구: instagram 은 미디어 필수(텍스트-only 불가), youtube 는 영상 필수. */
export const PLATFORM_MEDIA: Record<SocialPlatform, 'none' | 'image' | 'video'> = {
  threads: 'none',      // 텍스트만으로 게시 가능(이미지 선택)
  instagram: 'image',   // 피드는 미디어 필수
  youtube: 'video',     // 영상 필수
}

/**
 * "AI 티" 제거 규칙 — 대표 요청 2026-07-15 "AI티가 나지않게".
 * content-studio BASE_RULES 와 같은 철학: 사람이 쓴 것처럼 자연스럽게.
 */
export const HUMAN_VOICE_RULES = [
  '사람이 직접 쓴 것처럼 자연스럽게 써라. AI가 쓴 티가 나면 안 된다.',
  '이모지를 절대 쓰지 마라.',
  '"~하세요!" 남발, 느낌표 도배, "여러분", "지금 바로", "놓치지 마세요" 같은 상투어를 쓰지 마라.',
  '"최고", "1위", "완벽", "최적의" 같은 과장·최상급 표현을 쓰지 마라(광고법 존중).',
  '문장 길이를 일부러 다양하게(짧은 문장과 긴 문장을 섞어) 리듬을 준다.',
  '기계적인 나열("첫째, 둘째, 셋째") 대신 구체적인 상황·장면으로 이야기하듯 쓴다.',
  '뻔한 도입("바쁜 일상 속에서", "요즘 같은 시대에")으로 시작하지 마라.',
  'brief 에 없는 수치·사실·후기를 지어내지 마라.',
].join(' ')

/** 플랫폼별 시스템 프롬프트(순수 — 테스트 가능). blog-ai 규칙(폐기어/운영정보 금지) 위에 얹는다. */
export function socialSystemPrompt(platform: SocialPlatform): string {
  const fmt: Record<SocialPlatform, string> = {
    threads: [
      '스레드(Threads) 게시물 초안을 쓴다. 대화체·짧은 호흡. 500자 이내.',
      '반드시 아래 JSON 만 출력(다른 말 X): {"title":"내부 라벨(짧게)","body":"스레드 본문(줄바꿈 허용, 500자 이내)","hashtags":["해시태그3~5개(#없이 단어만)"]}',
    ].join(' '),
    instagram: [
      '인스타그램 피드 캡션 초안을 쓴다. 첫 줄 훅 → 3~5문장 → 마지막 CTA. 캡션 300자 이내.',
      '반드시 아래 JSON 만 출력: {"title":"내부 라벨","body":"캡션(줄바꿈 허용, 300자 이내)","hashtags":["관련 해시태그 12~15개(#없이 단어만)"]}',
    ].join(' '),
    youtube: [
      '유튜브 숏폼(Shorts) 대본 + 메타데이터 초안을 쓴다. 첫 3초 훅이 스크롤을 멈추게.',
      'title=영상 제목(핵심 키워드 앞쪽, 60자 이내), body=영상 설명란(첫 2줄에 핵심 + 대본 요약 + 마지막 줄 유어딜 안내).',
      '반드시 아래 JSON 만 출력: {"title":"영상 제목","body":"설명란(줄바꿈 허용)","hashtags":["태그 8~12개(#없이 단어만)"]}',
    ].join(' '),
  }
  return `${PROMO_BRIEF}\n\n## 사람처럼 쓰기(필수)\n${HUMAN_VOICE_RULES}\n\n## 출력 형식\n${fmt[platform]}`
}
