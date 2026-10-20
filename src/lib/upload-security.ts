/**
 * 파일 업로드 보안 유틸리티
 */

// 허용된 이미지 MIME 타입
// NOTE: SVG is intentionally excluded because SVG files can embed JavaScript
// (XSS risk when served inline). If SVG support is ever re-added, it must be
// sanitized server-side (e.g. via DOMPurify in a secure context).
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

// 최대 파일 크기: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 파일 검증
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
}

export function validateUploadFile(
  file: File | Blob,
  filename: string,
  contentType: string
): FileValidationResult {
  // 1. 파일 크기 검증
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 허용됩니다.`
    };
  }

  // 2. MIME 타입 검증
  if (!ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다. 허용: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    };
  }

  // 3. 파일 확장자 검증
  const ext = filename.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  
  if (!ext || !allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: '지원하지 않는 파일 확장자입니다.'
    };
  }

  // 4. 파일명 sanitize (보안상 위험한 문자 제거)
  const sanitizedFilename = sanitizeFilename(filename);

  return {
    valid: true,
    sanitizedFilename
  };
}

/**
 * 안전한 파일명 생성
 */
export function generateSecureFilename(originalFilename: string): string {
  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().substring(0, 8);
  
  return `upload_${timestamp}_${randomId}.${ext}`;
}

/**
 * 파일명 sanitize (위험한 문자 제거)
 */
function sanitizeFilename(filename: string): string {
  // 🛡️ 경로 순회 공격 방지 (강화):
  //   - 모든 경로 구분자 (/, \) 의 basename 만 사용
  //   - null byte (poison-null) 제거
  //   - URL-encoded traversal (..%2f, ..%5c) 무력화
  //   - 선행 점(.) 제거 (숨김파일 / 확장자만 있는 파일 방지)
  let sanitized = filename;

  // 1) URL decode 시도 (예: ..%2f → ../). 디코드 실패 시 원본 유지.
  try {
    sanitized = decodeURIComponent(sanitized);
  } catch {
    // malformed URI — 원본 그대로 진행
  }

  // 2) null byte 및 제어문자 제거
  sanitized = sanitized.replace(/[\x00-\x1f]/g, '');

  // 3) 경로 구분자 기준 basename 만 추출 (../, ..\, /etc/passwd 등 차단)
  sanitized = sanitized.replace(/\\/g, '/');
  const lastSlash = sanitized.lastIndexOf('/');
  if (lastSlash >= 0) sanitized = sanitized.slice(lastSlash + 1);

  // 4) 선행 점(.) 제거 — ".env", "..", "..." 등 차단
  sanitized = sanitized.replace(/^\.+/, '');

  // 5) 특수문자 제거 (알파벳, 숫자, -, _, . 만 허용)
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '_');

  // 6) 연속된 언더스코어 제거
  sanitized = sanitized.replace(/_+/g, '_');

  // 7) 빈 문자열 fallback
  if (!sanitized || sanitized === '.') {
    sanitized = `file_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Content-Type에서 파일 확장자 추출
 */
export function getExtensionFromContentType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };
  
  return typeMap[contentType.toLowerCase()] || 'jpg';
}

/**
 * 파일 매직 바이트 검증 (실제 파일 타입 확인)
 *
 * @param arrayBuffer  파일의 바이너리 내용
 * @param expectedType (선택) 클라이언트가 신고한 MIME 타입. 전달되면
 *   감지된 타입과 일치하는지 추가로 검증한다.
 */
export async function validateFileMagicBytes(
  arrayBuffer: ArrayBuffer,
  expectedType?: string
): Promise<{ valid: boolean; detectedType?: string; error?: string }> {
  const bytes = new Uint8Array(arrayBuffer);

  let detectedType: string | null = null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    detectedType = 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    detectedType = 'image/png';
  }
  // GIF: 47 49 46 38
  else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    detectedType = 'image/gif';
  }
  // WebP: 52 49 46 46 ... 57 45 42 50
  else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    detectedType = 'image/webp';
  }

  if (!detectedType) {
    return { valid: false, error: '허용되지 않는 파일 형식이거나 손상된 파일입니다.' };
  }

  if (expectedType) {
    const expected = expectedType.toLowerCase();
    // jpeg/jpg are the same format
    const normalized = expected === 'image/jpg' ? 'image/jpeg' : expected;
    if (normalized !== detectedType) {
      return {
        valid: false,
        detectedType,
        error: `파일 내용(${detectedType})과 신고된 형식(${expectedType})이 일치하지 않습니다.`,
      };
    }
  }

  return { valid: true, detectedType };
}
