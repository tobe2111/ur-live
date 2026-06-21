/**
 * 🛡️ 2026-04-28: 인앱 브라우저 UA detection — index.html inline script 와 동일 로직.
 *
 * index.html 의 inline <script> 안 코드를 단위 테스트로 검증.
 * 회귀 방어: 일반 모바일 브라우저 (Chrome/Safari/Whale/Samsung) 가 false 인지,
 * 인앱 (Kakao/네이버/페북/IG/라인) 이 정확히 detect 되는지.
 */
import { describe, it, expect } from 'vitest';

const PATTERNS = {
  kakao: /KAKAOTALK/i,
  naver: /NAVER\(inapp/i,
  facebook: /FB_IAB|FBAV|FBAN/i,
  instagram: /Instagram/i,
  line: /\bLine\//i,
};

function detect(ua: string) {
  return {
    kakao: PATTERNS.kakao.test(ua),
    naver: PATTERNS.naver.test(ua),
    facebook: PATTERNS.facebook.test(ua),
    instagram: PATTERNS.instagram.test(ua),
    line: PATTERNS.line.test(ua),
  };
}

function any(r: ReturnType<typeof detect>) {
  return r.kakao || r.naver || r.facebook || r.instagram || r.line;
}

describe('인앱 detection — 정상 브라우저는 false (회귀 방어)', () => {
  const NORMAL = [
    ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'],
    ['iPad Safari', 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'],
    ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; SM-G990B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'],
    ['Samsung Internet', 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/119.0.0.0 Mobile Safari/537.36'],
    ['Whale Mobile (NAVER 본사 Whale 브라우저, 인앱 아님)', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Whale/3.27.91.18'],
    ['Edge Android', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0'],
    ['Firefox Android', 'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0'],
    ['Desktop Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'],
    ['Desktop Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'],
    ['Desktop Firefox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'],
  ];

  for (const [name, ua] of NORMAL) {
    it(`${name} → false (모든 인앱 패턴)`, () => {
      const r = detect(ua);
      expect(any(r), `${name} matched: ${JSON.stringify(r)}`).toBe(false);
    });
  }
});

describe('인앱 detection — 실제 인앱은 정확히 매칭', () => {
  it('iOS 카카오톡 → kakao', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.5';
    const r = detect(ua);
    expect(r.kakao).toBe(true);
    expect(r.naver || r.facebook || r.instagram || r.line).toBe(false);
  });

  it('Android 카카오톡 → kakao', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-G990B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36;KAKAOTALK 10.5.5';
    expect(detect(ua).kakao).toBe(true);
  });

  it('iOS 네이버 인앱 → naver', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20F66 NAVER(inapp; search; 2000; 12.5.5)';
    const r = detect(ua);
    expect(r.naver).toBe(true);
    expect(r.kakao || r.facebook || r.instagram || r.line).toBe(false);
  });

  it('iOS 페이스북 (FBIOS) → facebook', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/441.0]';
    expect(detect(ua).facebook).toBe(true);
  });

  it('Android 페이스북 (FB_IAB) → facebook', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/441.0.0.42.116;]';
    expect(detect(ua).facebook).toBe(true);
  });

  it('iOS 인스타그램 → instagram', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 311.0.0.31.118';
    expect(detect(ua).instagram).toBe(true);
  });

  it('iOS 라인 → line', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.5.0';
    expect(detect(ua).line).toBe(true);
  });

  it('빈 UA → 모두 false', () => {
    const r = detect('');
    expect(any(r)).toBe(false);
  });
});

describe('자동 redirect scheme 결정', () => {
  // index.html inline + in-app-browser.ts 와 동일 형식(SSOT). 🛡️ 2026-06-20 (C1):
  //   Android intent 에 S.browser_fallback_url 포함 — Chrome 미설치 단말 빈 화면 방지.
  function resolveScheme(ua: string, url: string): string {
    const isKakao = /KAKAOTALK/i.test(ua);
    const isLine = /\bLine\//i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    if (isKakao && isIOS) return 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    if (isLine && (isIOS || isAndroid)) {
      const sep = url.includes('?') ? '&' : '?';
      return url + sep + 'openExternalBrowser=1';
    }
    if (isAndroid) {
      const t = url.replace(/^https?:\/\//, '');
      return 'intent://' + t + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
    }
    return '';
  }

  it('iOS 카톡 → kakaotalk:// 스킴', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 KAKAOTALK 10.5.5';
    const s = resolveScheme(ua, 'https://live.ur-team.com/');
    expect(s).toMatch(/^kakaotalk:\/\/web\/openExternal\?url=/);
    expect(s).toContain(encodeURIComponent('https://live.ur-team.com/'));
  });

  it('Android 카톡 → intent:// (Chrome) + S.browser_fallback_url', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/119.0.0.0 Mobile Safari/537.36;KAKAOTALK 10.5.5';
    const s = resolveScheme(ua, 'https://live.ur-team.com/');
    // 🛡️ 2026-06-20 (C1): Chrome 미설치 단말 빈 화면 방지 — fallback URL 필수.
    expect(s).toMatch(/^intent:\/\/.+#Intent;scheme=https;package=com\.android\.chrome;S\.browser_fallback_url=.+;end$/);
    expect(s).toContain('S.browser_fallback_url=' + encodeURIComponent('https://live.ur-team.com/'));
  });

  it('iOS 라인 → openExternalBrowser=1 쿼리', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Line/13.5.0';
    const s = resolveScheme(ua, 'https://live.ur-team.com/');
    expect(s).toBe('https://live.ur-team.com/?openExternalBrowser=1');
  });

  it('iOS 라인 — 기존 쿼리 있으면 & 로 append', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Line/13.5.0';
    const s = resolveScheme(ua, 'https://live.ur-team.com/?foo=bar');
    expect(s).toBe('https://live.ur-team.com/?foo=bar&openExternalBrowser=1');
  });

  it('iOS 페이스북 → 빈 문자열 (자동 호출 스킴 없음, 수동 가이드만)', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 [FBAN/FBIOS]';
    expect(resolveScheme(ua, 'https://live.ur-team.com/')).toBe('');
  });

  it('일반 브라우저 → 빈 문자열', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(resolveScheme(ua, 'https://live.ur-team.com/')).toBe('');
  });
});

describe('isIOS — iPadOS 데스크톱 UA 판별 (A3)', () => {
  // in-app-browser.ts isIOS() 와 동일 로직 미러. iPadOS 13+ 사파리는 기본 데스크톱 UA(Macintosh).
  function isIOS(ua: string, maxTouchPoints: number): boolean {
    if (/iphone|ipad|ipod/i.test(ua)) return true;
    if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return true;
    return false;
  }
  const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

  it('iPadOS 데스크톱 UA(Macintosh) + touch → iOS true', () => {
    expect(isIOS(MAC_UA, 5)).toBe(true);
  });
  it('진짜 데스크톱 Mac (touch 없음) → false', () => {
    expect(isIOS(MAC_UA, 0)).toBe(false);
    expect(isIOS(MAC_UA, 1)).toBe(false);
  });
  it('iPhone UA → true (touch 무관)', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 0)).toBe(true);
  });
  it('iPad UA(레거시) → true', () => {
    expect(isIOS('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 0)).toBe(true);
  });
});
