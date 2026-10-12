import { chromium } from 'playwright'
const b=await chromium.launch({executablePath:process.env.CHROME||undefined})
const p=await b.newPage({viewport:{width:1600,height:800}})
for(const k of ['wave','gift','find','qr']){await p.goto('file://'+new URL('./udal-banner.html',import.meta.url).pathname+'#'+k);await p.reload();await p.waitForTimeout(400);await p.screenshot({path:`udal-banner-${k}.png`})}
await b.close()
