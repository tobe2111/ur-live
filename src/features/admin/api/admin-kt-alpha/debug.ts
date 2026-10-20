import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '../../../../worker/utils/safe-error'

export function registerDebug(r: Hono<{ Bindings: Env }>) {
  // 🛡️ 2026-05-19: 디버그용 — KT Alpha env 변수가 worker 에 어떻게 들어와있는지 확인.
  //   값은 노출하지 않고 길이/prefix/dev_mode 만 반환 (어드민만 접근).
  r.get('/kt-alpha/debug', cors(), async (c) => {
    try {
      const env = c.env as unknown as { KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
      const auth = env.KT_ALPHA_AUTH_CODE || ''
      const tokenKey = env.KT_ALPHA_TOKEN_KEY || ''
      const authToken = env.KT_ALPHA_AUTH_TOKEN || ''
      const devMode = env.KT_ALPHA_DEV_MODE || ''
      // 실제 사용될 dev_yn 값 (giftishow-api.ts:234 와 동일 로직)
      const devYn = devMode === 'N' ? 'N' : 'Y'
      // 🛡️ 2026-05-19: 실제 KT Alpha 에 전송될 custom_auth_token 값 (변경 후 PDF 사양 반영).
      //   PDF v1.04 p.9: "custom_auth_token = Token Key (이미 암호화됨, 고객사는 암호화 필요 없음)"
      const customAuthToken = authToken || tokenKey || ''

      return c.json({
        success: true,
        data: {
          auth_code: {
            length: auth.length,
            prefix4: auth.slice(0, 4),
            suffix4: auth.slice(-4),
            starts_with_REAL: auth.startsWith('REAL'),
            starts_with_DEV: auth.startsWith('DEV'),
            has_whitespace: /\s/.test(auth),
          },
          token_key: {
            length: tokenKey.length,
            ends_with_eq: tokenKey.endsWith('=='),
            has_plus: tokenKey.includes('+'),
            has_space: tokenKey.includes(' '),
            has_whitespace: /\s/.test(tokenKey),
          },
          auth_token_set: authToken.length > 0,
          dev_mode_raw: devMode,
          dev_mode_length: devMode.length,
          dev_mode_charcodes: [...devMode].map(c => c.charCodeAt(0)),
          // 실제 KT Alpha API 에 전송될 값:
          will_send_dev_yn: devYn,
          will_send_dev_yn_explanation:
            devMode === 'N' ? '상용 모드 (REAL 키 호환)' :
            devMode === '' ? '미설정 → default Y (개발 모드, REAL 키와 호환 안 됨)' :
            `잘못된 값 "${devMode}" → default Y (REAL 키와 호환 안 됨)`,
          // 실제 custom_auth_token 으로 전송될 값의 메타.
          custom_auth_token_to_send: {
            length: customAuthToken.length,
            prefix4: customAuthToken.slice(0, 4),
            suffix4: customAuthToken.slice(-4),
            source: authToken ? 'KT_ALPHA_AUTH_TOKEN (override)' : tokenKey ? 'KT_ALPHA_TOKEN_KEY (default)' : 'NONE',
          },
        },
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 🛡️ 2026-05-19: 디버그용 — KT Alpha API 한 페이지만 직접 호출 + raw 응답 반환.
  //   sync timeout 으로 진짜 에러 확인 불가일 때 사용.
  r.get('/kt-alpha/debug-call', cors(), async (c) => {
    try {
      const env = c.env as unknown as { DB: D1Database; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
      if (!env.KT_ALPHA_AUTH_CODE) {
        return c.json({ success: false, error: 'KT_ALPHA_AUTH_CODE 미설정' }, 500)
      }
      const tokenKey = env.KT_ALPHA_AUTH_TOKEN || env.KT_ALPHA_TOKEN_KEY
      if (!tokenKey) {
        return c.json({ success: false, error: 'KT_ALPHA_TOKEN_KEY/AUTH_TOKEN 미설정' }, 500)
      }
      const devYn = env.KT_ALPHA_DEV_MODE === 'N' ? 'N' : 'Y'

      // 0101 listGoods 1 페이지만 호출. start/size 쿼리로 지정 가능.
      const start = c.req.query('start') || '1'
      const size = c.req.query('size') || '5'
      const body = new URLSearchParams()
      body.append('api_code', '0101')
      body.append('custom_auth_code', env.KT_ALPHA_AUTH_CODE)
      body.append('custom_auth_token', tokenKey)
      body.append('dev_yn', devYn)
      body.append('start', start)
      body.append('size', size)

      const startTime = Date.now()
      const res = await fetch('https://bizapi.giftishow.com/bizApi/goods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString(),
      })
      const elapsed = Date.now() - startTime
      const rawText = await res.text()
      let parsed: unknown = null
      try { parsed = JSON.parse(rawText) } catch { /* not JSON */ }

      return c.json({
        success: true,
        data: {
          http_status: res.status,
          http_ok: res.ok,
          elapsed_ms: elapsed,
          request: {
            url: 'https://bizapi.giftishow.com/bizApi/goods',
            method: 'POST',
            body_keys: ['api_code', 'custom_auth_code', 'custom_auth_token', 'dev_yn', 'start', 'size'],
            // 민감값 일부만 노출.
            api_code: '0101',
            custom_auth_code_prefix: env.KT_ALPHA_AUTH_CODE.slice(0, 4) + '...' + env.KT_ALPHA_AUTH_CODE.slice(-4),
            custom_auth_token_prefix: tokenKey.slice(0, 4) + '...' + tokenKey.slice(-4),
            dev_yn: devYn,
            start,
            size,
          },
          response_text: rawText.slice(0, 2000),  // 첫 2000자만
          response_json: parsed,
        },
      })
    } catch (err) {
      return c.json({
        success: false,
        error: (err as Error).message,
        stack: (err as Error).stack?.slice(0, 500),
      }, 500)
    }
  })

  // 4. POST /balance — 비즈머니 잔액 즉시 갱신.
  r.post('/kt-alpha/balance', cors(), async (c) => {
    try {
      const env = c.env as unknown as { DB: D1Database; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
      if (!env.KT_ALPHA_AUTH_CODE) {
        return c.json({ success: false, error: 'KT_ALPHA_AUTH_CODE 미설정' }, 503)
      }
      const userIdRow = await c.env.DB.prepare(
        "SELECT value FROM platform_settings WHERE key = 'kt_alpha_user_id'"
      ).first<{ value: string }>()
      if (!userIdRow?.value) {
        return c.json({ success: false, error: 'kt_alpha_user_id 설정 안 됨' }, 400)
      }
      const { getBizMoneyBalance } = await import('../../../../worker/utils/giftishow-api')
      const bal = await getBizMoneyBalance(env, userIdRow.value)
      // 🛡️ 2026-05-21: UPSERT — UPDATE 만 쓰면 row 없을 때 silent no-op.
      await c.env.DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('kt_alpha_biz_money_balance', ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(String(bal.balance)).run().catch((e) => {
        if (import.meta.env.DEV) console.error('[admin:kt-alpha:balance] balance upsert failed:', e)
      })
      await c.env.DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('kt_alpha_biz_money_check_at', datetime('now'), datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = datetime('now'), updated_at = datetime('now')`
      ).run().catch((e) => {
        if (import.meta.env.DEV) console.error('[admin:kt-alpha:balance] check_at upsert failed:', e)
      })
      // bal.raw 가 있으면 응답에 포함 → 어드민이 KT Alpha 실제 응답 구조 디버깅 가능.
      return c.json({
        success: true,
        data: bal,
        ...(bal.balance === 0 && bal.raw ? {
          debug_hint: '잔액 0 — KT Alpha 응답 구조 확인 필요. raw 필드 참조.',
        } : {}),
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })
}
