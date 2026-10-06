#!/usr/bin/env node
/**
 * 🎨 lucide **뜻 아이콘** → 유어딜 세트 (2026-09-29, 대표 UI 네 트랙 중 ④)
 *
 * 경계는 CLAUDE.md 가 정한 것 그대로다 — **뜻**(우리 물건의 이름)은 우리가 그리고,
 * **조작**(화살표·닫기·검색·확인·로딩)은 lucide 그대로. 아래 표에 없는 이름은 안 건드린다.
 *
 * ⚠️ JSX 사용(`<Name`·`</Name>`)과 **명시적 값 자리**(`icon: Name` / `icon={Name}` / `Icon={Name}`)만
 *    바꾼다. 파일 전체 단어 치환은 안 한다 — `Store`·`Home`·`Info`·`Package` 는 흔한 낱말이라
 *    문자열·주석·다른 식별자에 섞여 있고, 통째로 바꾸면 조용히 문구가 망가진다.
 *    놓친 참조는 import 를 뺐으므로 **tsc 가 잡는다**(그게 이 코드모드의 안전망이다).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** lucide 이름 → 유어딜 이름. 뜻이 1:1 로 맞는 것만 넣는다. */
const MAP = {
  MapPin: 'PinIcon', Gift: 'GiftBoxIcon', AlertCircle: 'AlertIcon', Bell: 'BellIcon',
  Users: 'PeopleIcon', Clock: 'ClockIcon', Store: 'StoreIcon', ShoppingBag: 'BagIcon',
  CheckCircle2: 'OkIcon', CheckCircle: 'OkIcon', XCircle: 'BadIcon', Wallet: 'WalletIcon',
  Heart: 'HeartIcon', Package: 'BoxIcon', Ticket: 'TicketStubIcon', Home: 'HomeIcon',
  Info: 'InfoIcon', ShoppingCart: 'BagIcon', AlertTriangle: 'WarnIcon', Star: 'StarIcon',
  MessageCircle: 'MessageIcon', Truck: 'TruckIcon', Receipt: 'ReceiptIcon',
  LogOut: 'LogOutIcon', Mail: 'MailIcon', Settings: 'SettingsIcon', Scan: 'ScanIcon',
}

const LOCK = new Set([...readFileSync('CLAUDE.md', 'utf8').matchAll(/^\| `(src\/[^`]+?)`/gm)].map((m) => m[1]))
/** 잠금 파일의 **거울**(byte-동일이 존재 이유) — 원본이 잠겨 있으면 같이 얼린다. */
const MIRRORS = new Set(['src/pages/vouchers/TopChromeReserve.tsx'])

const files = execSync(
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))
  /**
   * 🔓 2026-09-30 — 대표 승인("다 순서대로 이상적으로 해줘")으로 잠금표 파일도 범위에 든다.
   * `--locked` 를 주면 **잠금표 파일만**, 안 주면 종전대로 잠금표를 뺀 나머지만 훑는다.
   * 승인 없이 잠금 파일을 건드리는 일이 기본값이 되면 안 되므로 **플래그로 명시**하게 둔다.
   * ⚠️ 거울(`MIRRORS`)은 원본과 **같이** 움직여야 하므로 `--locked` 에 포함한다.
   */
  .filter((f) => (process.argv.includes('--locked') ? LOCK.has(f) || MIRRORS.has(f) : !LOCK.has(f) && !MIRRORS.has(f)))

const write = !process.argv.includes('--dry')
let touched = 0, swapped = 0
for (const f of files) {
  let src = readFileSync(f, 'utf8')
  const orig = src
  const imports = [...src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'lucide-react'\n?/g)]
  if (!imports.length) continue

  const moved = new Map() // lucide 이름 -> 유어딜 이름
  for (const im of imports) {
    for (const raw of im[1].split(',')) {
      const n = raw.trim().replace(/^type\s+/, '')
      if (!n || /\s+as\s+/.test(n)) continue       // 별칭은 건너뛴다(뜻이 달라졌을 수 있다)
      if (MAP[n]) moved.set(n, MAP[n])
    }
  }
  if (!moved.size) continue

  // ① lucide import 에서 옮긴 이름 제거 (비면 줄 자체 삭제)
  src = src.replace(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'lucide-react'\n?/g, (whole, list) => {
    const keep = list.split(',').map((s) => s.trim()).filter(Boolean).filter((n) => !moved.has(n.replace(/^type\s+/, '')))
    return keep.length ? `import { ${keep.join(', ')} } from 'lucide-react'\n` : ''
  })

  // ② 유어딜 import 병합(있으면 더하고, 없으면 첫 import 줄 앞에 새로)
  const want = [...new Set(moved.values())]
  const UR = /import\s*\{([^}]*)\}\s*from\s*'@\/components\/icons\/urdeal-icons'\n?/
  if (UR.test(src)) {
    src = src.replace(UR, (_w, list) => {
      const all = [...new Set([...list.split(',').map((s) => s.trim()).filter(Boolean), ...want])]
      return `import { ${all.join(', ')} } from '@/components/icons/urdeal-icons'\n`
    })
  } else if (/^import .*\n/m.test(src)) {
    src = src.replace(/^(import .*\n)/m, `$1import { ${want.join(', ')} } from '@/components/icons/urdeal-icons'\n`)
  } else {
    // 🩸 lucide 가 **유일한 import** 였던 파일 — 위 정규식이 걸 자리가 없어 새 import 가 조용히 사라졌다
    //    (실측 1건: floating-action-bar.tsx). 그러면 tsc 가 잡지만, 애초에 안 만드는 게 맞다.
    src = `import { ${want.join(', ')} } from '@/components/icons/urdeal-icons'\n` + src
  }

  // ③ 사용처 — JSX 와 명시적 값 자리만
  for (const [from, to] of moved) {
    src = src.replace(new RegExp(`<${from}(?=[\\s/>])`, 'g'), `<${to}`)
    src = src.replace(new RegExp(`</${from}>`, 'g'), `</${to}>`)
    src = src.replace(new RegExp(`(\\b(?:icon|Icon|leading|trailing)\\s*[:=]\\s*\\{?\\s*)${from}\\b`, 'g'), `$1${to}`)
    swapped += (orig.match(new RegExp(`<${from}\\b`, 'g')) || []).length
  }
  if (src !== orig) { touched++; if (write) writeFileSync(f, src) }
}
console.log(`${write ? '✍️' : '👀'} 파일 ${touched} · 교체 ${swapped}건`)
