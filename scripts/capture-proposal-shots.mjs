#!/usr/bin/env node
/**
 * 대외 제안서(docs/business/proposals/*.html)에 넣을 라이브 화면 캡처.
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/capture-proposal-shots.mjs [출력디렉터리]
 *
 * ⚠️ 이 원격 환경에서 Chromium 은 스스로 TLS 터널을 못 연다.
 * 프록시를 `--proxy-server` 로 물려도 CONNECT 는 붙었다가 handshake 중간에
 * 끊긴다(ERR_CONNECTION_RESET · 프록시 로그상 `ws_closed_mid_exchange`).
 * 그래서 브라우저에 네트워크를 맡기지 않고 **모든 요청을 Node 의 fetch 로
 * 대신 받아 채워 넣는다**(Node 는 HTTPS_PROXY + CA 번들을 정상으로 읽는다).
 * `NODE_USE_ENV_PROXY=1` 없이 돌리면 전부 실패한다.
 *
 * 캡처본에는 개인정보가 섞일 수 있다. 매장 전화번호처럼 문서로 돌아다니면
 * 곤란한 값은 그대로 두지 말고 가린 뒤 넣는다(`mask` 셀렉터).
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const sharp = require('sharp')

const OUT = path.resolve(process.argv[2] || 'proposal-shots')
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const ORIGIN = 'https://urdeal.kr'

/** 캡처 대상. y 는 스크롤 위치(논리 px). */
const SHOTS = [
  { name: 'home', url: '/', y: 0 },
  { name: 'shop', url: '/u/jiwon1228', y: 0, cropTop: 130 },
  { name: 'detail', url: '/group-buy/2876', y: 0, mask: 'a[href^="tel:"]' },
  { name: 'use', url: '/group-buy/2876', y: 1100 },
]

const W = 430
const H = 930 // 1 : 2.163 — 390x844 뷰포트와 같은 비율

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  })

  await ctx.route('**', async (route) => {
    const req = route.request()
    const url = req.url()
    if (!/^https?:/.test(url)) return route.continue()
    try {
      const headers = { ...req.headers() }
      delete headers['accept-encoding']
      const init = { method: req.method(), headers, redirect: 'follow' }
      const post = req.postDataBuffer()
      if (post) init.body = post
      const res = await fetch(url, init)
      const body = Buffer.from(await res.arrayBuffer())
      const out = {}
      for (const [k, v] of res.headers) {
        const lk = k.toLowerCase()
        // 재압축·길이·CSP 는 우리가 대신 받은 순간 의미가 없다
        if (lk === 'content-encoding' || lk === 'content-length' || lk === 'content-security-policy') continue
        out[k] = v
      }
      await route.fulfill({ status: res.status, headers: out, body })
    } catch {
      await route.abort()
    }
  })

  for (const shot of SHOTS) {
    const page = await ctx.newPage()
    const raw = path.join(OUT, `${shot.name}.png`)
    try {
      await page.goto(ORIGIN + shot.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(5500)
      // 한 번 지나쳐 lazy 이미지를 깨운 뒤 목표 위치로 되돌아온다
      await page.evaluate((y) => window.scrollTo(0, y + 500), shot.y)
      await page.waitForTimeout(1800)
      await page.evaluate((y) => window.scrollTo(0, y), shot.y)
      await page.waitForTimeout(2200)

      let masks = []
      if (shot.mask) {
        masks = await page.evaluate((sel) => {
          const found = []
          document.querySelectorAll(sel).forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) found.push({ x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height })
          })
          return found
        }, shot.mask)
      }

      await page.screenshot({ path: raw })
      await postProcess(raw, path.join(OUT, `${shot.name}.jpg`), shot, masks)
      console.log(`${shot.name} OK`)
    } catch (err) {
      console.log(`${shot.name} FAIL ${String(err.message).split('\n')[0]}`)
    }
    await page.close()
  }

  await browser.close()
  console.log(`\n캡처 위치: ${OUT}`)
}

async function postProcess(src, dest, shot, masks) {
  const meta = await sharp(src).metadata()
  let buf = fs.readFileSync(src)

  const scale = 2 // 화면 좌표는 논리 px, 이미지는 deviceScaleFactor 배
  for (const m of masks) {
    const box = {
      left: Math.max(0, Math.round(m.x * scale) - 6),
      top: Math.max(0, Math.round(m.y * scale) - 4),
      width: Math.round(m.w * scale) + 12,
      height: Math.round(m.h * scale) + 8,
    }
    if (box.left + box.width > meta.width || box.top + box.height > meta.height) continue
    const blurred = await sharp(buf).extract(box).blur(12).toBuffer()
    buf = await sharp(buf).composite([{ input: blurred, left: box.left, top: box.top }]).png().toBuffer()
  }

  if (shot.cropTop) {
    buf = await sharp(buf)
      .extract({ left: 0, top: shot.cropTop, width: meta.width, height: meta.height - shot.cropTop })
      .png()
      .toBuffer()
  }

  await sharp(buf)
    .resize({ width: W, height: H, fit: 'cover', position: 'top' })
    .jpeg({ quality: 68, mozjpeg: true })
    .toFile(dest)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
