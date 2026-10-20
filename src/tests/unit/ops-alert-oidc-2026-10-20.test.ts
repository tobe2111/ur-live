/**
 * 🔔 봇 실패 → 대표 카톡 (2026-10-20 대표 "카톡 나에게 보내기, 무료로")
 * 서버는 GitHub OIDC 토큰으로만 호출자를 믿는다 — 서명·발급자·대상·레포·브랜치·만료를 전부 본다.
 * ⚠️ 못 보는 것: 실제 카카오 발송(대표 계정의 talk_message 동의 필요) · GitHub 이 실제로 토큰을 주는지.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { verifyGithubOidc, claimsAllowed, GITHUB_OIDC_ISSUER, _resetJwksCache } from '../../worker/utils/github-oidc';
import { buildOpsAlertTemplate, OPS_ALERT_AUDIENCE, OPS_ALERT_REPO } from '../../worker/routes/ops-alert.routes';
import { readFileSync } from 'node:fs';

const policy = { audience: OPS_ALERT_AUDIENCE, repository: OPS_ALERT_REPO };
const now = () => Math.floor(Date.now() / 1000);
const good = () => ({ iss: GITHUB_OIDC_ISSUER, aud: OPS_ALERT_AUDIENCE, exp: now() + 300, nbf: now() - 5, repository: OPS_ALERT_REPO, ref: 'refs/heads/main' });

const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b as ArrayBuffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function mint(claims: Record<string, unknown>, kid = 'k1', keyPair?: CryptoKeyPair) {
  const kp = keyPair ?? await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const h = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid })));
  const p = b64url(new TextEncoder().encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`));
  const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid };
  return { token: `${h}.${p}.${b64url(sig)}`, jwk, kp };
}
const jwksFetch = (keys: unknown[]) => (async () => new Response(JSON.stringify({ keys }))) as unknown as typeof fetch;

describe('GitHub OIDC 판정', () => {
  beforeEach(() => _resetJwksCache());

  it('이 레포 main 의 정상 토큰은 통과', async () => {
    const { token, jwk } = await mint(good());
    expect(await verifyGithubOidc(token, policy, jwksFetch([jwk]))).not.toBeNull();
  });

  it('서명이 다른 키면 거부(위조)', async () => {
    const { token } = await mint(good());
    const other = await mint(good());
    expect(await verifyGithubOidc(token, policy, jwksFetch([other.jwk]))).toBeNull();
  });

  it('다른 레포·다른 브랜치·다른 대상·만료·다른 발급자는 거부', () => {
    expect(claimsAllowed(good(), policy)).toBe(true);
    expect(claimsAllowed({ ...good(), repository: 'evil/fork' }, policy)).toBe(false);
    expect(claimsAllowed({ ...good(), ref: 'refs/heads/attacker' }, policy)).toBe(false);
    expect(claimsAllowed({ ...good(), aud: 'something-else' }, policy)).toBe(false);
    expect(claimsAllowed({ ...good(), exp: now() - 1 }, policy)).toBe(false);
    expect(claimsAllowed({ ...good(), iss: 'https://evil.example' }, policy)).toBe(false);
  });

  it('토큰이 없거나 모양이 틀리면 거부', async () => {
    expect(await verifyGithubOidc(undefined, policy, jwksFetch([]))).toBeNull();
    expect(await verifyGithubOidc('a.b', policy, jwksFetch([]))).toBeNull();
  });
});

describe('카톡 템플릿', () => {
  it('200자 안 · 링크는 urdeal.kr/github.com 만', () => {
    const t = JSON.parse(buildOpsAlertTemplate('제목', 'x'.repeat(500), 'https://evil.example/x'));
    expect(t.object_type).toBe('text');
    expect(t.text.length).toBeLessThanOrEqual(200);
    expect(t.link.web_url).toBe('https://urdeal.kr/');
    expect(JSON.parse(buildOpsAlertTemplate('a', 'b', 'https://github.com/tobe2111/ur-live/actions/runs/1')).link.web_url).toContain('github.com');
  });
});

describe('배선', () => {
  const route = readFileSync('src/worker/routes/ops-alert.routes.ts', 'utf8');
  it('라우트는 발송 전에 OIDC 를 먼저 확인하고 하루 상한을 둔다', () => {
    expect(route.indexOf('authenticateGithubWorkflow(c.req.header')).toBeLessThan(route.indexOf('callKakaoApi(DB'));
    expect(route).toMatch(/> OPS_ALERT_DAILY_CAP/);
  });
  it('워커에 마운트돼 있다', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8')).toMatch(/app\.route\('\/', opsAlertRoutes\)/);
  });
  it('봇 워크플로 넷 다 id-token 권한이 있다', () => {
    for (const w of ['sns-daily-post', 'sns-reply-comments', 'sns-weekly-review', 'sns-influencer']) {
      expect(readFileSync(`.github/workflows/${w}.yml`, 'utf8')).toMatch(/id-token: write/);
    }
  });
});
