#!/usr/bin/env node
/**
 * Secret Rotation Helper (TD-002)
 *
 * 자동 생성 가능한 시크릿 (JWT_SECRET, REFRESH_TOKEN_SECRET 등) 의 새 값을 만들어주고,
 * Cloudflare Pages Dashboard 에 입력할 정확한 값을 출력.
 *
 * 사용:
 *   node scripts/rotate-secrets.mjs                  # JWT + REFRESH 쌍
 *   node scripts/rotate-secrets.mjs --jwt            # JWT_SECRET 만
 *   node scripts/rotate-secrets.mjs --refresh        # REFRESH_TOKEN_SECRET 만
 *   node scripts/rotate-secrets.mjs --all            # JWT + REFRESH + INTERNAL_CRON_TOKEN + WEBHOOK_SECRET 등
 *
 * ⚠️ 주의:
 *   - 출력된 값은 한 번만 보입니다 (Cloudflare 대시보드 저장 후 사라짐)
 *   - 외부 키 (Firebase / Toss / Kakao) 는 자동 생성 불가 — 각 콘솔에서 재발급 필요
 *
 * 작성: 2026-04-26 (N2)
 */

import crypto from 'crypto';

const args = new Set(process.argv.slice(2));
const all = args.has('--all') || args.size === 0;
const onlyJwt = args.has('--jwt') && !all;
const onlyRefresh = args.has('--refresh') && !all;

function genHexBytes(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function genBase64Bytes(bytes) {
  return crypto.randomBytes(bytes).toString('base64');
}

const targets = [];

if (all || onlyJwt || (!onlyRefresh && !onlyJwt)) {
  targets.push({
    key: 'JWT_SECRET',
    value: genBase64Bytes(32),  // 256-bit
    purpose: 'JWT 토큰 서명 (사용자/셀러/어드민/에이전시 모든 인증)',
    rotation_impact: '⚠️ rotation 시 모든 사용자 재로그인 필요',
  });
}

if (all || onlyRefresh || (!onlyRefresh && !onlyJwt)) {
  targets.push({
    key: 'REFRESH_TOKEN_SECRET',
    value: genBase64Bytes(32),
    purpose: 'Refresh token 서명',
    rotation_impact: '⚠️ rotation 시 자동 갱신 세션 끊김',
  });
}

if (all) {
  targets.push({
    key: 'INTERNAL_CRON_TOKEN',
    value: genHexBytes(32),  // 64 hex chars
    purpose: 'Cron 인증 (TD-008) — /api/orders/internal/* 보호',
    rotation_impact: '✅ rotation 안전 — cron 자체 검증만',
  });

  targets.push({
    key: 'TOSS_WEBHOOK_SECRET',
    value: genBase64Bytes(32),
    purpose: 'Toss webhook HMAC 서명 검증',
    rotation_impact: '⚠️ Toss Dashboard 에도 같은 값 등록 필요',
  });
}

console.log('\n🔐 Secret Rotation — Generated Values');
console.log('━'.repeat(70));
console.log('이 값들은 ONE-SHOT 입니다. 화면 닫기 전에 Cloudflare 에 등록하세요.\n');

for (const t of targets) {
  console.log(`📋 ${t.key}`);
  console.log(`   목적:  ${t.purpose}`);
  console.log(`   영향:  ${t.rotation_impact}`);
  console.log(`   값:    ${t.value}`);
  console.log('');
}

console.log('━'.repeat(70));
console.log('\n📝 Cloudflare Pages 에 등록:');
console.log('   1. https://dash.cloudflare.com → Workers & Pages → ur-live');
console.log('   2. Settings → Variables and Secrets');
console.log('   3. 각 KEY 마다 [Edit] → 새 값 붙여넣기 → [Save]');
console.log('   4. 적용 위해 비어있는 commit 으로 재배포:');
console.log('        git commit --allow-empty -m "rotate secrets"');
console.log('        git push');
console.log('');
console.log('🔥 rotation 후 검증:');
console.log('   curl -X POST https://live.ur-team.com/api/auth/login \\');
console.log('     -d \'{"email":"test@x.com","password":"x"}\'');
console.log('   → 401 응답 정상 (잘못된 패스워드)');
console.log('   → 500 "JWT_SECRET is not configured" 면 등록 실패');
console.log('');
console.log('🚫 외부 시크릿 (수동 재발급 필요):');
console.log('   - FIREBASE_PRIVATE_KEY  → Firebase Console > 서비스 계정 > 새 키 생성');
console.log('   - VITE_FIREBASE_API_KEY → Firebase Console > 프로젝트 설정 > 웹 API 키');
console.log('   - TOSS_SECRET_KEY      → 토스페이먼츠 대시보드 > API 키');
console.log('   - VITE_KAKAO_APP_KEY   → Kakao Developers > 앱 > 보안 > REST API 키');
console.log('');
