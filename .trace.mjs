import { chromium } from 'playwright'
import fs from 'fs'
const [url,out]=process.argv.slice(2)
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:[`--proxy-server=${process.env.HTTPS_PROXY}`,'--ssl-version-max=tls1.2','--ignore-certificate-errors'] })
const ctx = await b.newContext({ userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport:{width:390,height:844}, deviceScaleFactor:3, ignoreHTTPSErrors:true })
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p)
await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6e6/8,uploadThroughput:750e3/8})
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
const ev=[]; cdp.on('Tracing.dataCollected',d=>ev.push(...d.value))
const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r))
await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,v8,v8.execute,blink,loading',transferMode:'ReportEvents'})
await p.goto(url,{waitUntil:'load',timeout:90000}); await p.waitForTimeout(5000)
await cdp.send('Tracing.end'); await done
fs.writeFileSync(out,JSON.stringify(ev)); await b.close()
