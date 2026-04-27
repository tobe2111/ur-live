/**
 * 채팅 자동 모더레이션 — Phase 3-3
 *
 * 한국어/영어 욕설/스팸/광고 필터. 외부 AI 호출 X (비용 + 의존성 회피).
 * 패턴 기반 단순 차단 + 점수 기반 분류.
 *
 * 분류:
 *   clean    — 정상
 *   profane  — 욕설/비속어
 *   spam     — 반복/광고
 *   suspicious — 의심 (URL / 외부 연락처)
 *
 * 사용:
 *   const result = moderateChat(message);
 *   if (result.action === 'block') return;
 *   if (result.action === 'warn') addWarningFlag();
 */

// 한국어 욕설 사전 (단순 — 본격 운영 시 외부 사전 사용 권장)
// 본 사전은 가장 흔한 표현만. 우회 표현은 패턴 기반에서 추가 검출.
const KOREAN_PROFANITY = [
  '시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '시바', '씨바', '시팔', '씨팔',
  '개새끼', '개새', '개시발', '개씨발', 'ㄱㅅㅋ',
  '병신', 'ㅂㅅ', '븅신',
  '존나', '졸라', 'ㅈㄴ',
  '좆같', '좃같', '좆나',
  '미친', 'ㅁㅊ',
  '엿먹', '엿이나',
  '꺼져', '닥쳐',
  '죽어', '디져',
  '븅신', '뷰웅신',
  '쌍놈', '쌍년',
];

const ENGLISH_PROFANITY = [
  'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'damn',
];

// URL/외부 연락처 패턴 (라이브 외부로 유도하는 광고)
const URL_PATTERN = /(https?:\/\/|www\.|[\w-]+\.(com|kr|net|co|org|io|me)\b)/i;
const PHONE_PATTERN = /\b(010|011|016|017|018|019)[-\s]?\d{3,4}[-\s]?\d{4}\b/;
const KAKAO_ID_PATTERN = /(카카오\s*톡\s*아\s*이\s*디|kakaotalk|kakao\s*id)\s*[:：]?\s*\S+/i;

export type ModerationAction = 'allow' | 'warn' | 'block';
export type ModerationCategory = 'clean' | 'profane' | 'spam' | 'suspicious';

export interface ModerationResult {
  action: ModerationAction;
  category: ModerationCategory;
  matched_patterns: string[];
  cleaned_message?: string; // warn 인 경우 마스킹 처리된 메시지
}

function normalizeForMatching(s: string): string {
  // 한글(자모/완성형) + 영숫자만 유지 — 띄어쓰기/특수문자만 제거하여 우회 표현 검출.
  // 🛡️ 2026-04-27 (FIX): 이전 `[\s\W_]+` 는 한글도 \W 로 분류해 모두 제거 → 모든 메시지 block 버그.
  return s.toLowerCase().replace(/[^ㄱ-ㅣ가-힣a-z0-9]+/g, '');
}

export function moderateChat(message: string): ModerationResult {
  const trimmed = message.trim();
  if (!trimmed) {
    return { action: 'allow', category: 'clean', matched_patterns: [] };
  }

  const matched: string[] = [];
  let category: ModerationCategory = 'clean';
  let action: ModerationAction = 'allow';

  // 1) 욕설 검출 (한/영) — 정규화 후 매칭
  const normalized = normalizeForMatching(trimmed);
  for (const word of KOREAN_PROFANITY) {
    const normWord = normalizeForMatching(word);
    if (normalized.includes(normWord)) {
      matched.push(`profane:${word}`);
      category = 'profane';
    }
  }
  for (const word of ENGLISH_PROFANITY) {
    if (normalized.includes(word.toLowerCase())) {
      matched.push(`profane:${word}`);
      category = 'profane';
    }
  }

  // 2) URL 검출
  if (URL_PATTERN.test(trimmed)) {
    matched.push('suspicious:url');
    if (category === 'clean') category = 'suspicious';
  }

  // 3) 전화번호 검출
  if (PHONE_PATTERN.test(trimmed)) {
    matched.push('suspicious:phone');
    if (category === 'clean') category = 'suspicious';
  }

  // 4) 카카오톡 ID 검출
  if (KAKAO_ID_PATTERN.test(trimmed)) {
    matched.push('suspicious:kakao_id');
    if (category === 'clean') category = 'suspicious';
  }

  // 5) 같은 글자 반복 (스팸)
  if (/(.)\1{6,}/.test(trimmed)) {
    matched.push('spam:char_repeat');
    if (category === 'clean') category = 'spam';
  }

  // 6) 전체 대문자/특수문자 (스팸)
  if (trimmed.length > 10 && /^[A-Z\s\d\W]+$/.test(trimmed) && !/[가-힣]/.test(trimmed)) {
    matched.push('spam:all_caps');
    if (category === 'clean') category = 'spam';
  }

  // 액션 결정
  if (category === 'profane') {
    action = 'block';
  } else if (category === 'suspicious' || category === 'spam') {
    action = 'warn';
  }

  // warn 인 경우 마스킹 메시지 생성
  let cleaned: string | undefined;
  if (action === 'warn') {
    cleaned = trimmed
      .replace(URL_PATTERN, '[링크 제거됨]')
      .replace(PHONE_PATTERN, '[연락처 제거됨]')
      .replace(KAKAO_ID_PATTERN, '[ID 제거됨]');
  }

  return { action, category, matched_patterns: matched, cleaned_message: cleaned };
}
