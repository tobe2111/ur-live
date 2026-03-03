var na=Object.defineProperty;var wt=e=>{throw TypeError(e)};var oa=(e,s,t)=>s in e?na(e,s,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[s]=t;var v=(e,s,t)=>oa(e,typeof s!="symbol"?s+"":s,t),zs=(e,s,t)=>s.has(e)||wt("Cannot "+t);var E=(e,s,t)=>(zs(e,s,"read from private field"),t?t.call(e):s.get(e)),D=(e,s,t)=>s.has(e)?wt("Cannot add the same private member more than once"):s instanceof WeakSet?s.add(e):s.set(e,t),R=(e,s,t,r)=>(zs(e,s,"write to private field"),r?r.call(e,t):s.set(e,t),t),N=(e,s,t)=>(zs(e,s,"access private method"),t);var St=(e,s,t,r)=>({set _(a){R(e,s,a,t)},get _(){return E(e,s,r)}});import ia from"crypto";var Tt=(e,s,t)=>(r,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,u=!1,l;if(e[i]?(l=e[i][0][0],r.req.routeIndex=i):l=i===e.length&&a||void 0,l)try{c=await l(r,()=>o(i+1))}catch(d){if(d instanceof Error&&s)r.error=d,c=await s(d,r),u=!0;else throw d}else r.finalized===!1&&t&&(c=await t(r));return c&&(r.finalized===!1||u)&&(r.res=c),r}},ca=Symbol(),ua=async(e,s=Object.create(null))=>{const{all:t=!1,dot:r=!1}=s,n=(e instanceof or?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?la(e,{all:t,dot:r}):{}};async function la(e,s){const t=await e.formData();return t?da(t,s):{}}function da(e,s){const t=Object.create(null);return e.forEach((r,a)=>{s.all||a.endsWith("[]")?pa(t,a,r):t[a]=r}),s.dot&&Object.entries(t).forEach(([r,a])=>{r.includes(".")&&(fa(t,r,a),delete t[r])}),t}var pa=(e,s,t)=>{e[s]!==void 0?Array.isArray(e[s])?e[s].push(t):e[s]=[e[s],t]:s.endsWith("[]")?e[s]=[t]:e[s]=t},fa=(e,s,t)=>{let r=e;const a=s.split(".");a.forEach((n,o)=>{o===a.length-1?r[n]=t:((!r[n]||typeof r[n]!="object"||Array.isArray(r[n])||r[n]instanceof File)&&(r[n]=Object.create(null)),r=r[n])})},sr=e=>{const s=e.split("/");return s[0]===""&&s.shift(),s},ma=e=>{const{groups:s,path:t}=_a(e),r=sr(t);return ha(r,s)},_a=e=>{const s=[];return e=e.replace(/\{[^}]+\}/g,(t,r)=>{const a=`@${r}`;return s.push([a,t]),a}),{groups:s,path:e}},ha=(e,s)=>{for(let t=s.length-1;t>=0;t--){const[r]=s[t];for(let a=e.length-1;a>=0;a--)if(e[a].includes(r)){e[a]=e[a].replace(r,s[t][1]);break}}return e},Ds={},Ea=(e,s)=>{if(e==="*")return"*";const t=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(t){const r=`${e}#${s}`;return Ds[r]||(t[2]?Ds[r]=s&&s[0]!==":"&&s[0]!=="*"?[r,t[1],new RegExp(`^${t[2]}(?=/${s})`)]:[e,t[1],new RegExp(`^${t[2]}$`)]:Ds[r]=[e,t[1],!0]),Ds[r]}return null},ut=(e,s)=>{try{return s(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,t=>{try{return s(t)}catch{return t}})}},ga=e=>ut(e,decodeURI),tr=e=>{const s=e.url,t=s.indexOf("/",s.indexOf(":")+4);let r=t;for(;r<s.length;r++){const a=s.charCodeAt(r);if(a===37){const n=s.indexOf("?",r),o=s.indexOf("#",r),i=n===-1?o===-1?void 0:o:o===-1?n:Math.min(n,o),c=s.slice(t,i);return ga(c.includes("%25")?c.replace(/%25/g,"%2525"):c)}else if(a===63||a===35)break}return s.slice(t,r)},ba=e=>{const s=tr(e);return s.length>1&&s.at(-1)==="/"?s.slice(0,-1):s},Ve=(e,s,...t)=>(t.length&&(s=Ve(s,...t)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${s==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(s==null?void 0:s[0])==="/"?s.slice(1):s}`}`),rr=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const s=e.split("/"),t=[];let r="";return s.forEach(a=>{if(a!==""&&!/\:/.test(a))r+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){t.length===0&&r===""?t.push("/"):t.push(r);const n=a.replace("?","");r+="/"+n,t.push(r)}else r+="/"+a}),t.filter((a,n,o)=>o.indexOf(a)===n)},Gs=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?ut(e,nr):e):e,ar=(e,s,t)=>{let r;if(!t&&s&&!/[%+]/.test(s)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(s,o+1)||(o=e.indexOf(`&${s}`,o+1));o!==-1;){const i=e.charCodeAt(o+s.length+1);if(i===61){const c=o+s.length+2,u=e.indexOf("&",c);return Gs(e.slice(c,u===-1?void 0:u))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${s}`,o+1)}if(r=/[%+]/.test(e),!r)return}const a={};r??(r=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(r&&(c=Gs(c)),n=o,c==="")continue;let u;i===-1?u="":(u=e.slice(i+1,o===-1?void 0:o),r&&(u=Gs(u))),t?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(u)):a[c]??(a[c]=u)}return s?a[s]:a},ya=ar,wa=(e,s)=>ar(e,s,!0),nr=decodeURIComponent,xt=e=>ut(e,nr),Qe,ae,ye,ir,cr,rt,Te,Yt,or=(Yt=class{constructor(e,s="/",t=[[]]){D(this,ye);v(this,"raw");D(this,Qe);D(this,ae);v(this,"routeIndex",0);v(this,"path");v(this,"bodyCache",{});D(this,Te,e=>{const{bodyCache:s,raw:t}=this,r=s[e];if(r)return r;const a=Object.keys(s)[0];return a?s[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):s[e]=t[e]()});this.raw=e,this.path=s,R(this,ae,t),R(this,Qe,{})}param(e){return e?N(this,ye,ir).call(this,e):N(this,ye,cr).call(this)}query(e){return ya(this.url,e)}queries(e){return wa(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const s={};return this.raw.headers.forEach((t,r)=>{s[r]=t}),s}async parseBody(e){var s;return(s=this.bodyCache).parsedBody??(s.parsedBody=await ua(this,e))}json(){return E(this,Te).call(this,"text").then(e=>JSON.parse(e))}text(){return E(this,Te).call(this,"text")}arrayBuffer(){return E(this,Te).call(this,"arrayBuffer")}blob(){return E(this,Te).call(this,"blob")}formData(){return E(this,Te).call(this,"formData")}addValidatedData(e,s){E(this,Qe)[e]=s}valid(e){return E(this,Qe)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[ca](){return E(this,ae)}get matchedRoutes(){return E(this,ae)[0].map(([[,e]])=>e)}get routePath(){return E(this,ae)[0].map(([[,e]])=>e)[this.routeIndex].path}},Qe=new WeakMap,ae=new WeakMap,ye=new WeakSet,ir=function(e){const s=E(this,ae)[0][this.routeIndex][1][e],t=N(this,ye,rt).call(this,s);return t&&/\%/.test(t)?xt(t):t},cr=function(){const e={},s=Object.keys(E(this,ae)[0][this.routeIndex][1]);for(const t of s){const r=N(this,ye,rt).call(this,E(this,ae)[0][this.routeIndex][1][t]);r!==void 0&&(e[t]=/\%/.test(r)?xt(r):r)}return e},rt=function(e){return E(this,ae)[1]?E(this,ae)[1][e]:e},Te=new WeakMap,Yt),Sa={Stringify:1},ur=async(e,s,t,r,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:s,buffer:a,context:r}))).then(i=>Promise.all(i.filter(Boolean).map(c=>ur(c,s,!1,r,a))).then(()=>a[0]))):Promise.resolve(e)},Ta="text/plain; charset=UTF-8",Xs=(e,s)=>({"Content-Type":e,...s}),He=(e,s)=>new Response(e,s),bs,ys,he,Ze,Ee,se,ws,es,ss,ke,Ss,Ts,de,Ye,at,zt,xa=(zt=class{constructor(e,s){D(this,de);D(this,bs);D(this,ys);v(this,"env",{});D(this,he);v(this,"finalized",!1);v(this,"error");D(this,Ze);D(this,Ee);D(this,se);D(this,ws);D(this,es);D(this,ss);D(this,ke);D(this,Ss);D(this,Ts);v(this,"render",(...e)=>(E(this,es)??R(this,es,s=>this.html(s)),E(this,es).call(this,...e)));v(this,"setLayout",e=>R(this,ws,e));v(this,"getLayout",()=>E(this,ws));v(this,"setRenderer",e=>{R(this,es,e)});v(this,"header",(e,s,t)=>{this.finalized&&R(this,se,He(E(this,se).body,E(this,se)));const r=E(this,se)?E(this,se).headers:E(this,ke)??R(this,ke,new Headers);s===void 0?r.delete(e):t!=null&&t.append?r.append(e,s):r.set(e,s)});v(this,"status",e=>{R(this,Ze,e)});v(this,"set",(e,s)=>{E(this,he)??R(this,he,new Map),E(this,he).set(e,s)});v(this,"get",e=>E(this,he)?E(this,he).get(e):void 0);v(this,"newResponse",(...e)=>N(this,de,Ye).call(this,...e));v(this,"body",(e,s,t)=>N(this,de,Ye).call(this,e,s,t));v(this,"text",(e,s,t)=>N(this,de,at).call(this)&&!s&&!t?He(e):N(this,de,Ye).call(this,e,s,Xs(Ta,t)));v(this,"json",(e,s,t)=>N(this,de,at).call(this)&&!s&&!t?Response.json(e):N(this,de,Ye).call(this,JSON.stringify(e),s,Xs("application/json",t)));v(this,"html",(e,s,t)=>{const r=a=>N(this,de,Ye).call(this,a,s,Xs("text/html; charset=UTF-8",t));return typeof e=="object"?ur(e,Sa.Stringify,!1,{}).then(r):r(e)});v(this,"redirect",(e,s)=>{const t=String(e);return this.header("Location",/[^\x00-\xFF]/.test(t)?encodeURI(t):t),this.newResponse(null,s??302)});v(this,"notFound",()=>(E(this,ss)??R(this,ss,()=>He()),E(this,ss).call(this,this)));R(this,bs,e),s&&(R(this,Ee,s.executionCtx),this.env=s.env,R(this,ss,s.notFoundHandler),R(this,Ts,s.path),R(this,Ss,s.matchResult))}get req(){return E(this,ys)??R(this,ys,new or(E(this,bs),E(this,Ts),E(this,Ss))),E(this,ys)}get event(){if(E(this,Ee)&&"respondWith"in E(this,Ee))return E(this,Ee);throw Error("This context has no FetchEvent")}get executionCtx(){if(E(this,Ee))return E(this,Ee);throw Error("This context has no ExecutionContext")}get res(){return E(this,se)||R(this,se,He(null,{headers:E(this,ke)??R(this,ke,new Headers)}))}set res(e){if(E(this,se)&&e){e=He(e.body,e);for(const[s,t]of E(this,se).headers.entries())if(s!=="content-type")if(s==="set-cookie"){const r=E(this,se).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of r)e.headers.append("set-cookie",a)}else e.headers.set(s,t)}R(this,se,e),this.finalized=!0}get var(){return E(this,he)?Object.fromEntries(E(this,he)):{}}},bs=new WeakMap,ys=new WeakMap,he=new WeakMap,Ze=new WeakMap,Ee=new WeakMap,se=new WeakMap,ws=new WeakMap,es=new WeakMap,ss=new WeakMap,ke=new WeakMap,Ss=new WeakMap,Ts=new WeakMap,de=new WeakSet,Ye=function(e,s,t){const r=E(this,se)?new Headers(E(this,se).headers):E(this,ke)??new Headers;if(typeof s=="object"&&"headers"in s){const n=s.headers instanceof Headers?s.headers:new Headers(s.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?r.append(o,i):r.set(o,i)}if(t)for(const[n,o]of Object.entries(t))if(typeof o=="string")r.set(n,o);else{r.delete(n);for(const i of o)r.append(n,i)}const a=typeof s=="number"?s:(s==null?void 0:s.status)??E(this,Ze);return He(e,{status:a,headers:r})},at=function(){return!E(this,ke)&&!E(this,Ze)&&!this.finalized},zt),K="ALL",Ra="all",Ia=["get","post","put","delete","options","patch"],lr="Can not add a route since the matcher is already built.",dr=class extends Error{},va="__COMPOSED_HANDLER",Aa=e=>e.text("404 Not Found",404),Rt=(e,s)=>{if("getResponse"in e){const t=e.getResponse();return s.newResponse(t.body,t)}return console.error(e),s.text("Internal Server Error",500)},ce,J,pr,ue,Oe,ks,Ns,ts,Da=(ts=class{constructor(s={}){D(this,J);v(this,"get");v(this,"post");v(this,"put");v(this,"delete");v(this,"options");v(this,"patch");v(this,"all");v(this,"on");v(this,"use");v(this,"router");v(this,"getPath");v(this,"_basePath","/");D(this,ce,"/");v(this,"routes",[]);D(this,ue,Aa);v(this,"errorHandler",Rt);v(this,"onError",s=>(this.errorHandler=s,this));v(this,"notFound",s=>(R(this,ue,s),this));v(this,"fetch",(s,...t)=>N(this,J,Ns).call(this,s,t[1],t[0],s.method));v(this,"request",(s,t,r,a)=>s instanceof Request?this.fetch(t?new Request(s,t):s,r,a):(s=s.toString(),this.fetch(new Request(/^https?:\/\//.test(s)?s:`http://localhost${Ve("/",s)}`,t),r,a)));v(this,"fire",()=>{addEventListener("fetch",s=>{s.respondWith(N(this,J,Ns).call(this,s.request,s,void 0,s.request.method))})});[...Ia,Ra].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?R(this,ce,o):N(this,J,Oe).call(this,n,E(this,ce),o),i.forEach(c=>{N(this,J,Oe).call(this,n,E(this,ce),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){R(this,ce,c);for(const u of[n].flat())i.map(l=>{N(this,J,Oe).call(this,u.toUpperCase(),E(this,ce),l)})}return this},this.use=(n,...o)=>(typeof n=="string"?R(this,ce,n):(R(this,ce,"*"),o.unshift(n)),o.forEach(i=>{N(this,J,Oe).call(this,K,E(this,ce),i)}),this);const{strict:r,...a}=s;Object.assign(this,a),this.getPath=r??!0?s.getPath??tr:ba}route(s,t){const r=this.basePath(s);return t.routes.map(a=>{var o;let n;t.errorHandler===Rt?n=a.handler:(n=async(i,c)=>(await Tt([],t.errorHandler)(i,()=>a.handler(i,c))).res,n[va]=a.handler),N(o=r,J,Oe).call(o,a.method,a.path,n)}),this}basePath(s){const t=N(this,J,pr).call(this);return t._basePath=Ve(this._basePath,s),t}mount(s,t,r){let a,n;r&&(typeof r=="function"?n=r:(n=r.optionHandler,r.replaceRequest===!1?a=c=>c:a=r.replaceRequest));const o=n?c=>{const u=n(c);return Array.isArray(u)?u:[u]}:c=>{let u;try{u=c.executionCtx}catch{}return[c.env,u]};a||(a=(()=>{const c=Ve(this._basePath,s),u=c==="/"?0:c.length;return l=>{const d=new URL(l.url);return d.pathname=d.pathname.slice(u)||"/",new Request(d,l)}})());const i=async(c,u)=>{const l=await t(a(c.req.raw),...o(c));if(l)return l;await u()};return N(this,J,Oe).call(this,K,Ve(s,"*"),i),this}},ce=new WeakMap,J=new WeakSet,pr=function(){const s=new ts({router:this.router,getPath:this.getPath});return s.errorHandler=this.errorHandler,R(s,ue,E(this,ue)),s.routes=this.routes,s},ue=new WeakMap,Oe=function(s,t,r){s=s.toUpperCase(),t=Ve(this._basePath,t);const a={basePath:this._basePath,path:t,method:s,handler:r};this.router.add(s,t,[r,a]),this.routes.push(a)},ks=function(s,t){if(s instanceof Error)return this.errorHandler(s,t);throw s},Ns=function(s,t,r,a){if(a==="HEAD")return(async()=>new Response(null,await N(this,J,Ns).call(this,s,t,r,"GET")))();const n=this.getPath(s,{env:r}),o=this.router.match(a,n),i=new xa(s,{path:n,matchResult:o,env:r,executionCtx:t,notFoundHandler:E(this,ue)});if(o[0].length===1){let u;try{u=o[0][0][0][0](i,async()=>{i.res=await E(this,ue).call(this,i)})}catch(l){return N(this,J,ks).call(this,l,i)}return u instanceof Promise?u.then(l=>l||(i.finalized?i.res:E(this,ue).call(this,i))).catch(l=>N(this,J,ks).call(this,l,i)):u??E(this,ue).call(this,i)}const c=Tt(o[0],this.errorHandler,E(this,ue));return(async()=>{try{const u=await c(i);if(!u.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return u.res}catch(u){return N(this,J,ks).call(this,u,i)}})()},ts),fr=[];function Oa(e,s){const t=this.buildAllMatchers(),r=((a,n)=>{const o=t[a]||t[K],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],fr];const u=c.indexOf("",1);return[o[1][u],c]});return this.match=r,r(e,s)}var Ms="[^/]+",fs=".*",ms="(?:|/.*)",ze=Symbol(),Ca=new Set(".\\+*[^]$()");function ka(e,s){return e.length===1?s.length===1?e<s?-1:1:-1:s.length===1||e===fs||e===ms?1:s===fs||s===ms?-1:e===Ms?1:s===Ms?-1:e.length===s.length?e<s?-1:1:s.length-e.length}var Ne,je,le,$e,Na=($e=class{constructor(){D(this,Ne);D(this,je);D(this,le,Object.create(null))}insert(s,t,r,a,n){if(s.length===0){if(E(this,Ne)!==void 0)throw ze;if(n)return;R(this,Ne,t);return}const[o,...i]=s,c=o==="*"?i.length===0?["","",fs]:["","",Ms]:o==="/*"?["","",ms]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let u;if(c){const l=c[1];let d=c[2]||Ms;if(l&&c[2]&&(d===".*"||(d=d.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(d))))throw ze;if(u=E(this,le)[d],!u){if(Object.keys(E(this,le)).some(f=>f!==fs&&f!==ms))throw ze;if(n)return;u=E(this,le)[d]=new $e,l!==""&&R(u,je,a.varIndex++)}!n&&l!==""&&r.push([l,E(u,je)])}else if(u=E(this,le)[o],!u){if(Object.keys(E(this,le)).some(l=>l.length>1&&l!==fs&&l!==ms))throw ze;if(n)return;u=E(this,le)[o]=new $e}u.insert(i,t,r,a,n)}buildRegExpStr(){const t=Object.keys(E(this,le)).sort(ka).map(r=>{const a=E(this,le)[r];return(typeof E(a,je)=="number"?`(${r})@${E(a,je)}`:Ca.has(r)?`\\${r}`:r)+a.buildRegExpStr()});return typeof E(this,Ne)=="number"&&t.unshift(`#${E(this,Ne)}`),t.length===0?"":t.length===1?t[0]:"(?:"+t.join("|")+")"}},Ne=new WeakMap,je=new WeakMap,le=new WeakMap,$e),Ws,xs,Gt,ja=(Gt=class{constructor(){D(this,Ws,{varIndex:0});D(this,xs,new Na)}insert(e,s,t){const r=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const u=`@\\${o}`;return a[o]=[u,c],o++,i=!0,u}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return E(this,xs).insert(n,s,r,E(this,Ws),t),r}buildRegExp(){let e=E(this,xs).buildRegExpStr();if(e==="")return[/^$/,[],[]];let s=0;const t=[],r=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(t[++s]=Number(n),"$()"):(o!==void 0&&(r[Number(o)]=++s),"")),[new RegExp(`^${e}`),t,r]}},Ws=new WeakMap,xs=new WeakMap,Gt),La=[/^$/,[],Object.create(null)],js=Object.create(null);function mr(e){return js[e]??(js[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(s,t)=>t?`\\${t}`:"(?:|/.*)")}$`))}function Ma(){js=Object.create(null)}function Fa(e){var u;const s=new ja,t=[];if(e.length===0)return La;const r=e.map(l=>[!/\*|\/:/.test(l[0]),...l]).sort(([l,d],[f,m])=>l?1:f?-1:d.length-m.length),a=Object.create(null);for(let l=0,d=-1,f=r.length;l<f;l++){const[m,_,h]=r[l];m?a[_]=[h.map(([y])=>[y,Object.create(null)]),fr]:d++;let w;try{w=s.insert(_,d,m)}catch(y){throw y===ze?new dr(_):y}m||(t[d]=h.map(([y,g])=>{const T=Object.create(null);for(g-=1;g>=0;g--){const[b,x]=w[g];T[b]=x}return[y,T]}))}const[n,o,i]=s.buildRegExp();for(let l=0,d=t.length;l<d;l++)for(let f=0,m=t[l].length;f<m;f++){const _=(u=t[l][f])==null?void 0:u[1];if(!_)continue;const h=Object.keys(_);for(let w=0,y=h.length;w<y;w++)_[h[w]]=i[_[h[w]]]}const c=[];for(const l in o)c[l]=t[o[l]];return[n,c,a]}function qe(e,s){if(e){for(const t of Object.keys(e).sort((r,a)=>a.length-r.length))if(mr(t).test(s))return[...e[t]]}}var xe,Re,Hs,_r,Xt,$a=(Xt=class{constructor(){D(this,Hs);v(this,"name","RegExpRouter");D(this,xe);D(this,Re);v(this,"match",Oa);R(this,xe,{[K]:Object.create(null)}),R(this,Re,{[K]:Object.create(null)})}add(e,s,t){var i;const r=E(this,xe),a=E(this,Re);if(!r||!a)throw new Error(lr);r[e]||[r,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[K]).forEach(u=>{c[e][u]=[...c[K][u]]})}),s==="/*"&&(s="*");const n=(s.match(/\/:/g)||[]).length;if(/\*$/.test(s)){const c=mr(s);e===K?Object.keys(r).forEach(u=>{var l;(l=r[u])[s]||(l[s]=qe(r[u],s)||qe(r[K],s)||[])}):(i=r[e])[s]||(i[s]=qe(r[e],s)||qe(r[K],s)||[]),Object.keys(r).forEach(u=>{(e===K||e===u)&&Object.keys(r[u]).forEach(l=>{c.test(l)&&r[u][l].push([t,n])})}),Object.keys(a).forEach(u=>{(e===K||e===u)&&Object.keys(a[u]).forEach(l=>c.test(l)&&a[u][l].push([t,n]))});return}const o=rr(s)||[s];for(let c=0,u=o.length;c<u;c++){const l=o[c];Object.keys(a).forEach(d=>{var f;(e===K||e===d)&&((f=a[d])[l]||(f[l]=[...qe(r[d],l)||qe(r[K],l)||[]]),a[d][l].push([t,n-u+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(E(this,Re)).concat(Object.keys(E(this,xe))).forEach(s=>{e[s]||(e[s]=N(this,Hs,_r).call(this,s))}),R(this,xe,R(this,Re,void 0)),Ma(),e}},xe=new WeakMap,Re=new WeakMap,Hs=new WeakSet,_r=function(e){const s=[];let t=e===K;return[E(this,xe),E(this,Re)].forEach(r=>{const a=r[e]?Object.keys(r[e]).map(n=>[n,r[e][n]]):[];a.length!==0?(t||(t=!0),s.push(...a)):e!==K&&s.push(...Object.keys(r[K]).map(n=>[n,r[K][n]]))}),t?Fa(s):null},Xt),Ie,ge,Qt,Ua=(Qt=class{constructor(e){v(this,"name","SmartRouter");D(this,Ie,[]);D(this,ge,[]);R(this,Ie,e.routers)}add(e,s,t){if(!E(this,ge))throw new Error(lr);E(this,ge).push([e,s,t])}match(e,s){if(!E(this,ge))throw new Error("Fatal error");const t=E(this,Ie),r=E(this,ge),a=t.length;let n=0,o;for(;n<a;n++){const i=t[n];try{for(let c=0,u=r.length;c<u;c++)i.add(...r[c]);o=i.match(e,s)}catch(c){if(c instanceof dr)continue;throw c}this.match=i.match.bind(i),R(this,Ie,[i]),R(this,ge,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(E(this,ge)||E(this,Ie).length!==1)throw new Error("No active router has been determined yet.");return E(this,Ie)[0]}},Ie=new WeakMap,ge=new WeakMap,Qt),ls=Object.create(null),Pa=e=>{for(const s in e)return!0;return!1},ve,ee,Le,rs,G,be,Ce,as,Wa=(as=class{constructor(s,t,r){D(this,be);D(this,ve);D(this,ee);D(this,Le);D(this,rs,0);D(this,G,ls);if(R(this,ee,r||Object.create(null)),R(this,ve,[]),s&&t){const a=Object.create(null);a[s]={handler:t,possibleKeys:[],score:0},R(this,ve,[a])}R(this,Le,[])}insert(s,t,r){R(this,rs,++St(this,rs)._);let a=this;const n=ma(t),o=[];for(let i=0,c=n.length;i<c;i++){const u=n[i],l=n[i+1],d=Ea(u,l),f=Array.isArray(d)?d[0]:u;if(f in E(a,ee)){a=E(a,ee)[f],d&&o.push(d[1]);continue}E(a,ee)[f]=new as,d&&(E(a,Le).push(d),o.push(d[1])),a=E(a,ee)[f]}return E(a,ve).push({[s]:{handler:r,possibleKeys:o.filter((i,c,u)=>u.indexOf(i)===c),score:E(this,rs)}}),a}search(s,t){var l;const r=[];R(this,G,ls);let n=[this];const o=sr(t),i=[],c=o.length;let u=null;for(let d=0;d<c;d++){const f=o[d],m=d===c-1,_=[];for(let w=0,y=n.length;w<y;w++){const g=n[w],T=E(g,ee)[f];T&&(R(T,G,E(g,G)),m?(E(T,ee)["*"]&&N(this,be,Ce).call(this,r,E(T,ee)["*"],s,E(g,G)),N(this,be,Ce).call(this,r,T,s,E(g,G))):_.push(T));for(let b=0,x=E(g,Le).length;b<x;b++){const j=E(g,Le)[b],C=E(g,G)===ls?{}:{...E(g,G)};if(j==="*"){const F=E(g,ee)["*"];F&&(N(this,be,Ce).call(this,r,F,s,E(g,G)),R(F,G,C),_.push(F));continue}const[A,W,$]=j;if(!f&&!($ instanceof RegExp))continue;const L=E(g,ee)[A];if($ instanceof RegExp){if(u===null){u=new Array(c);let z=t[0]==="/"?1:0;for(let I=0;I<c;I++)u[I]=z,z+=o[I].length+1}const F=t.substring(u[d]),Z=$.exec(F);if(Z){if(C[W]=Z[0],N(this,be,Ce).call(this,r,L,s,E(g,G),C),Pa(E(L,ee))){R(L,G,C);const z=((l=Z[0].match(/\//))==null?void 0:l.length)??0;(i[z]||(i[z]=[])).push(L)}continue}}($===!0||$.test(f))&&(C[W]=f,m?(N(this,be,Ce).call(this,r,L,s,C,E(g,G)),E(L,ee)["*"]&&N(this,be,Ce).call(this,r,E(L,ee)["*"],s,C,E(g,G))):(R(L,G,C),_.push(L)))}}const h=i.shift();n=h?_.concat(h):_}return r.length>1&&r.sort((d,f)=>d.score-f.score),[r.map(({handler:d,params:f})=>[d,f])]}},ve=new WeakMap,ee=new WeakMap,Le=new WeakMap,rs=new WeakMap,G=new WeakMap,be=new WeakSet,Ce=function(s,t,r,a,n){for(let o=0,i=E(t,ve).length;o<i;o++){const c=E(t,ve)[o],u=c[r]||c[K],l={};if(u!==void 0&&(u.params=Object.create(null),s.push(u),a!==ls||n&&n!==ls))for(let d=0,f=u.possibleKeys.length;d<f;d++){const m=u.possibleKeys[d],_=l[u.score];u.params[m]=n!=null&&n[m]&&!_?n[m]:a[m]??(n==null?void 0:n[m]),l[u.score]=!0}}},as),Me,Zt,Ha=(Zt=class{constructor(){v(this,"name","TrieRouter");D(this,Me);R(this,Me,new Wa)}add(e,s,t){const r=rr(s);if(r){for(let a=0,n=r.length;a<n;a++)E(this,Me).insert(e,r[a],t);return}E(this,Me).insert(e,s,t)}match(e,s){return E(this,Me).search(e,s)}},Me=new WeakMap,Zt),hr=class extends Da{constructor(e={}){super(e),this.router=e.router??new Ua({routers:[new $a,new Ha]})}},S=e=>{const t={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},r=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(t.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(t.allowMethods);return async function(o,i){var l;function c(d,f){o.res.headers.set(d,f)}const u=await r(o.req.header("origin")||"",o);if(u&&c("Access-Control-Allow-Origin",u),t.credentials&&c("Access-Control-Allow-Credentials","true"),(l=t.exposeHeaders)!=null&&l.length&&c("Access-Control-Expose-Headers",t.exposeHeaders.join(",")),o.req.method==="OPTIONS"){t.origin!=="*"&&c("Vary","Origin"),t.maxAge!=null&&c("Access-Control-Max-Age",t.maxAge.toString());const d=await a(o.req.header("origin")||"",o);d.length&&c("Access-Control-Allow-Methods",d.join(","));let f=t.allowHeaders;if(!(f!=null&&f.length)){const m=o.req.header("Access-Control-Request-Headers");m&&(f=m.split(/\s*,\s*/))}return f!=null&&f.length&&(c("Access-Control-Allow-Headers",f.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),t.origin!=="*"&&o.header("Vary","Origin",{append:!0})}};function qa(e){var a;const s=((a=e.split(".").pop())==null?void 0:a.toLowerCase())||"jpg",t=Date.now(),r=crypto.randomUUID().substring(0,8);return`upload_${t}_${r}.${s}`}async function Ba(e){const s=new Uint8Array(e);return s[0]===255&&s[1]===216&&s[2]===255?{valid:!0,detectedType:"image/jpeg"}:s[0]===137&&s[1]===80&&s[2]===78&&s[3]===71?{valid:!0,detectedType:"image/png"}:s[0]===71&&s[1]===73&&s[2]===70&&s[3]===56?{valid:!0,detectedType:"image/gif"}:s[0]===82&&s[1]===73&&s[2]===70&&s[3]===70&&s[8]===87&&s[9]===69&&s[10]===66&&s[11]===80?{valid:!0,detectedType:"image/webp"}:{valid:!1}}function Ka(e){const s=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],t=[];for(const r of s)e[r]||t.push(r);if(t.length>0)throw new Error(`Missing required environment variables: ${t.join(", ")}

Please configure them:
`+t.map(r=>r==="TOSS_SECRET_KEY"||r==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${r} --project-name ur-live`:`  Check wrangler.jsonc for ${r} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function Ja(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function Va(e){const s=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),s.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):s.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(t){s.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:t instanceof Error?t.message:String(t)})}try{if(!e.SESSION_KV)s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const t="test:env:check";await e.SESSION_KV.put(t,"ok",{expirationTtl:60}),await e.SESSION_KV.get(t)==="ok"?s.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):s.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(t){s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:t instanceof Error?t.message:String(t)})}try{if(!e.CACHE_KV)s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const t="test:cache:check";await e.CACHE_KV.put(t,"ok",{expirationTtl:60}),await e.CACHE_KV.get(t)==="ok"?s.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):s.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(t){s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:t instanceof Error?t.message:String(t)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?s.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):s.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?s.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):s.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),e.FIREBASE_PRIVATE_KEY?e.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")?s.push({name:"FIREBASE_PRIVATE_KEY",status:"pass",message:`FIREBASE_PRIVATE_KEY configured (${e.FIREBASE_PRIVATE_KEY.length} chars)`}):s.push({name:"FIREBASE_PRIVATE_KEY",status:"warn",message:"FIREBASE_PRIVATE_KEY format may be invalid",details:"Expected format: -----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}):s.push({name:"FIREBASE_PRIVATE_KEY",status:"fail",message:"FIREBASE_PRIVATE_KEY not configured",details:"Add FIREBASE_PRIVATE_KEY in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_CLIENT_EMAIL?!e.FIREBASE_CLIENT_EMAIL.includes("@")||!e.FIREBASE_CLIENT_EMAIL.includes("iam.gserviceaccount.com")?s.push({name:"FIREBASE_CLIENT_EMAIL",status:"warn",message:"FIREBASE_CLIENT_EMAIL format may be invalid",details:"Expected format: *@*.iam.gserviceaccount.com"}):s.push({name:"FIREBASE_CLIENT_EMAIL",status:"pass",message:`FIREBASE_CLIENT_EMAIL configured: ${e.FIREBASE_CLIENT_EMAIL}`}):s.push({name:"FIREBASE_CLIENT_EMAIL",status:"fail",message:"FIREBASE_CLIENT_EMAIL not configured",details:"Add FIREBASE_CLIENT_EMAIL in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_PROJECT_ID?s.push({name:"FIREBASE_PROJECT_ID",status:"pass",message:`FIREBASE_PROJECT_ID configured: ${e.FIREBASE_PROJECT_ID}`}):s.push({name:"FIREBASE_PROJECT_ID",status:"fail",message:"FIREBASE_PROJECT_ID not configured",details:"Add FIREBASE_PROJECT_ID in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_DATABASE_URL?!e.FIREBASE_DATABASE_URL.startsWith("https://")||!e.FIREBASE_DATABASE_URL.includes("firebaseio.com")?s.push({name:"FIREBASE_DATABASE_URL",status:"warn",message:"FIREBASE_DATABASE_URL format may be invalid",details:"Expected format: https://*.firebaseio.com"}):s.push({name:"FIREBASE_DATABASE_URL",status:"pass",message:`FIREBASE_DATABASE_URL configured: ${e.FIREBASE_DATABASE_URL}`}):s.push({name:"FIREBASE_DATABASE_URL",status:"fail",message:"FIREBASE_DATABASE_URL not configured",details:"Add FIREBASE_DATABASE_URL in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),s}function Ya(e){const s=[];s.push(""),s.push("========================================"),s.push("환경 변수 테스트 결과"),s.push("========================================"),s.push("");let t=0,r=0,a=0;for(const n of e){const o=n.status==="pass"?"✅":n.status==="warn"?"⚠️":"❌";s.push(`${o} ${n.name}: ${n.message}`),n.details&&s.push(`   → ${n.details}`),n.status==="pass"&&t++,n.status==="warn"&&r++,n.status==="fail"&&a++}return s.push(""),s.push("========================================"),s.push(`총 ${e.length}개 테스트:`),s.push(`  ✅ 성공: ${t}`),r>0&&s.push(`  ⚠️  경고: ${r}`),a>0&&s.push(`  ❌ 실패: ${a}`),s.push("========================================"),s.push(""),a>0?(s.push("❌ 환경 변수 설정이 완료되지 않았습니다."),s.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):r>0?s.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):s.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),s.join(`
`)}async function za(e){const s=await Va(e),t=s.filter(n=>n.status==="pass").length,r=s.filter(n=>n.status==="warn").length,a=s.filter(n=>n.status==="fail").length;return{success:a===0,summary:{total:s.length,pass:t,warn:r,fail:a},results:s,formatted:Ya(s)}}const Qs={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function Ga(){const e=Qs.ENV==="production";return{baseUrl:Qs.TEST_BASE_URL,apiKey:Qs.TEST_API_KEY,isProduction:e}}async function Er(e,s){const t=Ga(),r=`${t.baseUrl}${e}`;try{const a=await fetch(r,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t.apiKey}`},body:JSON.stringify(s)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function Xa(e){try{const s={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((r,a)=>({SerialNum:a+1,ItemName:r.name,Qty:r.quantity,UnitPrice:r.unitPrice,SupplyCost:r.supplyPrice,Tax:r.taxAmount,Remark:r.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},t=await Er("/eTaxInvoice/RegistAndIssue",s);if(t.code!==1)throw new Error(`바로빌 발행 실패: ${t.message}`);return{success:!0,ntsConfirmNumber:t.ntsconfirmNum,invoiceKey:t.invoiceKey,message:t.message}}catch(s){throw console.error("바로빌 세금계산서 발행 실패:",s),s}}async function Qa(e,s,t){try{const a=await Er("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:s,Memo:t});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(r){throw console.error("바로빌 세금계산서 취소 실패:",r),r}}function ps(){return!1}async function Za(e){return await Xa(e)}function en(e,s,t){const r=Number(s.total_amount),a=Math.floor(r/1.1),n=r-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:s.buyer_business_number,buyerBusinessName:s.buyer_business_name||s.user_name,buyerCEO:s.buyer_ceo_name,buyerAddress:s.shipping_address,buyerEmail:s.user_email,buyerTel:s.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:t.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),u=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:u,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:r,memo:`주문번호: ${s.order_number}`,orderNo:s.order_number}}class ne extends Error{constructor(s,t,r){super(s),this.statusCode=t,this.code=r,this.name="AuthError"}}function sn(e){return`${crypto.randomUUID()}-${e}`}function tn(e){var n,o,i,c,u,l,d;const s=e.id.toString(),t=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",r=((c=e.kakao_account)==null?void 0:c.email)||null,a=((u=e.properties)==null?void 0:u.profile_image)||((d=(l=e.kakao_account)==null?void 0:l.profile)==null?void 0:d.profile_image_url)||null;return{kakaoId:s,nickname:t,email:r,profileImage:a}}async function rn(e,s,t,r,a){try{const n=await e.prepare(`
      INSERT INTO users (
        kakao_id, name, email, profile_image, 
        created_at, last_login_at, updated_at
      )
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(kakao_id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        profile_image = excluded.profile_image,
        last_login_at = datetime('now'),
        updated_at = datetime('now')
      RETURNING id, kakao_id, name, email, profile_image
    `).bind(s,t,r,a).first();if(!n)throw new ne("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",n.id),n}catch(n){throw n instanceof ne?n:(console.error("[Auth] Database error during upsert:",n),new ne("Database error",500,"DB_ERROR"))}}async function an(e){try{const s=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!s.ok){const r=await s.text();throw console.error("[Kakao API] Failed to get user info:",r),new ne("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const t=await s.json();if(!t.id)throw new ne("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return t}catch(s){throw s instanceof ne?s:(console.error("[Kakao API] Network error:",s),new ne("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function nn(e,s,t){try{const r=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:t,redirect_uri:s,code:e}).toString()});if(!r.ok){const n=await r.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new ne(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await r.json()).access_token}catch(r){throw r instanceof ne?r:(console.error("[Kakao OAuth] Network error:",r),new ne("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function gr(e,s){const t=await an(s),{kakaoId:r,nickname:a,email:n,profileImage:o}=tn(t);console.log("[Auth] Processing login for Kakao user:",r);const i=await rn(e,r,a,n,o),c=sn(i.id);return{user:i,sessionToken:c}}async function br(e,s,t=30){try{const r=await e.get(s,"json");if(!r)return console.log(`[Cache MISS] ${s}`),null;const a=Date.now()-r.timestamp;return a>t*1e3?(console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${s} (age: ${Math.round(a/1e3)}s)`),r.data)}catch(r){return console.error(`[Cache] Get error for key "${s}":`,r),null}}async function Fs(e,s,t,r=30){try{const a={data:t,timestamp:Date.now()};await e.put(s,JSON.stringify(a),{expirationTtl:r}),console.log(`[Cache SET] ${s} (TTL: ${r}s)`)}catch(a){console.error(`[Cache] Set error for key "${s}":`,a)}}function on(e){const s=e.req.header("CF-Connecting-IP");if(s)return s;const t=e.req.header("X-Forwarded-For");if(t)return t.split(",")[0].trim();const r=e.req.header("X-Real-IP");return r||"unknown"}function cn(e,s){return`ratelimit:${e}:${s}`}const Zs=new Map;async function un(e,s,t){var f;const r=new URL(e.req.url).pathname,a=cn(s,r),n=Date.now(),o=t.windowMs*1e3,c=e.get("user")&&t.authenticatedMultiplier?t.maxRequests*t.authenticatedMultiplier:t.maxRequests;try{const m=(f=e.env)==null?void 0:f.RATE_LIMIT_KV;if(m){const _=await m.get(a);let h;_?(h=JSON.parse(_),n>h.resetTime?h={count:1,resetTime:n+o}:h.count++):h={count:1,resetTime:n+o};const w=Math.ceil(o/1e3);await m.put(a,JSON.stringify(h),{expirationTtl:w});const y=h.count<=c,g=Math.max(0,c-h.count);return{allowed:y,remaining:g,resetTime:h.resetTime}}}catch(m){console.error("KV Rate Limit Error:",m)}let u=Zs.get(a);u&&n>u.resetTime&&(Zs.delete(a),u=void 0),u?u.count++:u={count:1,resetTime:n+o},Zs.set(a,u);const l=u.count<=c,d=Math.max(0,c-u.count);return{allowed:l,remaining:d,resetTime:u.resetTime}}function Ue(e){return async(s,t)=>{const r=on(s);if(e.skipIps&&e.skipIps.includes(r))return t();if(e.pathPattern){const n=new URL(s.req.url).pathname;if(!e.pathPattern.test(n))return t()}const a=await un(s,r,e);if(s.header("X-RateLimit-Limit",e.maxRequests.toString()),s.header("X-RateLimit-Remaining",a.remaining.toString()),s.header("X-RateLimit-Reset",new Date(a.resetTime).toISOString()),!a.allowed){const n=Math.ceil((a.resetTime-Date.now())/1e3);return s.header("Retry-After",n.toString()),s.json({success:!1,error:e.message||"Too many requests. Please try again later.",retryAfter:n,resetTime:new Date(a.resetTime).toISOString()},429)}return t()}}const Pe={api:{windowMs:60,maxRequests:60,message:"API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",authenticatedMultiplier:2},auth:{windowMs:60,maxRequests:5,message:"로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",pathPattern:/^\/api\/auth\//},order:{windowMs:60,maxRequests:10,message:"주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/orders/,authenticatedMultiplier:2},cart:{windowMs:60,maxRequests:20,message:"장바구니 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/cart/,authenticatedMultiplier:2},refund:{windowMs:3600,maxRequests:3,message:"환불 요청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.",pathPattern:/^\/api\/orders\/.*\/refund/},alimtalk:{windowMs:60,maxRequests:10,message:"알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/seller\/alimtalk\/send/},upload:{windowMs:60,maxRequests:5,message:"파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/.*\/upload/}};class B extends Error{constructor(s,t,r="VALIDATION_ERROR"){super(t),this.field=s,this.code=r,this.name="ValidationError"}}function ln(e,s){const{field:t,required:r,type:a,min:n,max:o,pattern:i,enum:c,custom:u,message:l}=s;if(r&&(e==null||e===""))throw new B(t,l||`${t}은(는) 필수 항목입니다.`,"REQUIRED");if(!(e==null||e==="")){if(a)switch(a){case"string":if(typeof e!="string")throw new B(t,l||`${t}은(는) 문자열이어야 합니다.`,"INVALID_TYPE");break;case"number":const d=typeof e=="string"?Number(e):e;if(typeof d!="number"||isNaN(d))throw new B(t,l||`${t}은(는) 숫자여야 합니다.`,"INVALID_TYPE");break;case"boolean":if(typeof e!="boolean")throw new B(t,l||`${t}은(는) true/false 값이어야 합니다.`,"INVALID_TYPE");break;case"email":if(typeof e!="string"||!fn(e))throw new B(t,l||`${t}은(는) 유효한 이메일 주소여야 합니다.`,"INVALID_EMAIL");break;case"url":if(typeof e!="string"||!mn(e))throw new B(t,l||`${t}은(는) 유효한 URL이어야 합니다.`,"INVALID_URL");break;case"phone":if(typeof e!="string"||!_n(e))throw new B(t,l||`${t}은(는) 유효한 전화번호여야 합니다.`,"INVALID_PHONE");break;case"date":if(!(e instanceof Date)&&!hn(e))throw new B(t,l||`${t}은(는) 유효한 날짜여야 합니다.`,"INVALID_DATE");break;case"array":if(!Array.isArray(e))throw new B(t,l||`${t}은(는) 배열이어야 합니다.`,"INVALID_TYPE");break;case"object":if(typeof e!="object"||e===null||Array.isArray(e))throw new B(t,l||`${t}은(는) 객체여야 합니다.`,"INVALID_TYPE");break}if(typeof e=="string"){if(n!==void 0&&e.length<n)throw new B(t,l||`${t}은(는) 최소 ${n}자 이상이어야 합니다.`,"TOO_SHORT");if(o!==void 0&&e.length>o)throw new B(t,l||`${t}은(는) 최대 ${o}자 이하여야 합니다.`,"TOO_LONG")}if(typeof e=="number"){if(n!==void 0&&e<n)throw new B(t,l||`${t}은(는) 최소 ${n} 이상이어야 합니다.`,"TOO_SMALL");if(o!==void 0&&e>o)throw new B(t,l||`${t}은(는) 최대 ${o} 이하여야 합니다.`,"TOO_LARGE")}if(Array.isArray(e)){if(n!==void 0&&e.length<n)throw new B(t,l||`${t}은(는) 최소 ${n}개 이상이어야 합니다.`,"TOO_FEW");if(o!==void 0&&e.length>o)throw new B(t,l||`${t}은(는) 최대 ${o}개 이하여야 합니다.`,"TOO_MANY")}if(i&&typeof e=="string"&&!i.test(e))throw new B(t,l||`${t}의 형식이 올바르지 않습니다.`,"INVALID_FORMAT");if(c&&!c.includes(e))throw new B(t,l||`${t}은(는) 다음 중 하나여야 합니다: ${c.join(", ")}`,"INVALID_ENUM");if(u&&u(e)===!1)throw new B(t,l||`${t}의 값이 유효하지 않습니다.`,"CUSTOM_VALIDATION_FAILED")}}function dn(e,s){for(const t of s){const r=e[t.field];ln(r,t)}}function pn(e){return async(s,t)=>{try{let r={};const a=s.req.header("content-type")||"";a.includes("application/json")?r=await s.req.json().catch(()=>({})):(a.includes("application/x-www-form-urlencoded")||a.includes("multipart/form-data"))&&(r=await s.req.parseBody().catch(()=>({})));const n=new URL(s.req.url);for(const[o,i]of n.searchParams.entries())o in r||(r[o]=i);dn(r,e),s.set("validatedData",r),await t()}catch(r){if(r instanceof B)return s.json({success:!1,error:r.message,field:r.field,code:r.code},400);throw r}}}function fn(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=255}function mn(e){try{const s=new URL(e);return s.protocol==="http:"||s.protocol==="https:"}catch{return!1}}function _n(e){return/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e)}function hn(e){if(typeof e!="string")return!1;const s=new Date(e);return!isNaN(s.getTime())}const En=[{field:"email",required:!0,type:"email",max:255,message:"유효한 이메일 주소를 입력해주세요."},{field:"password",required:!0,type:"string",min:8,max:100,pattern:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:"비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다."},{field:"name",required:!0,type:"string",min:2,max:50,message:"이름은 2-50자 사이여야 합니다."},{field:"phone",required:!1,type:"phone",message:"유효한 전화번호를 입력해주세요. (예: 010-1234-5678)"}];function qs(e){const s=new URLSearchParams;for(const[t,r]of Object.entries(e))r!=null&&s.append(t,String(r));return s}function lt(e,s){if(e.result_code!=="1")throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`)}async function dt(e){console.log("[Aligo] 토큰 생성 시작");const t=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:qs({apikey:e.ALIGO_API_KEY,userid:e.ALIGO_USER_ID})})).json();return lt(t,"Token Create"),console.log("[Aligo] ✅ 토큰 생성 성공:",t.token.substring(0,20)+"..."),{token:t.token,urtime:t.urtime}}async function gn(e,s){console.log("[Aligo] 카카오 채널 등록:",s.channelId);const{token:t}=await dt(e),a=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:qs({token:t,userid:e.ALIGO_USER_ID,plusid:s.channelId,phonenumber:s.phoneNumber})})).json();return lt(a,"Channel Register"),console.log("[Aligo] ✅ 카카오 채널 등록 성공, senderKey:",a.senderkey),{success:!0,senderKey:a.senderkey}}async function bn(e,s,t){console.log("[Aligo] 템플릿 등록:",t.templateCode);const{token:r}=await dt(e),n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:qs({token:r,userid:e.ALIGO_USER_ID,senderkey:s,tpl_name:t.name,tpl_content:t.content,tpl_code:t.templateCode})})).json();return lt(n,"Template Register"),console.log("[Aligo] ✅ 템플릿 등록 성공:",n.tpl_code),{success:!0,templateCode:n.tpl_code}}async function pt(e,s){console.log("[Aligo] 알림톡 발송:",s.to);try{const{token:t}=await dt(e),r=s.buttons?JSON.stringify({button:s.buttons}):void 0,n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:qs({token:t,userid:e.ALIGO_USER_ID,senderkey:s.senderKey,tpl_code:s.templateCode,receiver_1:s.to,subject_1:"알림톡",message_1:s.message,button_1:r})})).json();return n.result_code!=="1"?(console.error("[Aligo] ❌ 알림톡 발송 실패:",n.message),{success:!1,error:n.message}):(console.log("[Aligo] ✅ 알림톡 발송 성공, messageId:",n.msg_id),{success:!0,messageId:n.msg_id})}catch(t){return console.error("[Aligo] ❌ 알림톡 발송 에러:",t.message),{success:!1,error:t.message}}}function yn(e,s){let t=e;for(const[r,a]of Object.entries(s)){const n=new RegExp(`#{${r}}`,"g");t=t.replace(n,a)}return t}function yr(e){let s=e.replace(/-/g,"");if(!s.startsWith("010"))throw new Error("Invalid phone number format. Must start with 010");if(s.length!==11)throw new Error("Invalid phone number length. Must be 11 digits");return s}async function wn(e,s){const t=await e.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(s).first();if(!t)throw new Error(`Order not found: ${s}`);const r=await e.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(s).all();return{order:t,products:r.results}}async function Sn(e,s){const t=await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(s).first();return t||(console.warn(`No active alimtalk account for seller ${s}`),null)}async function It(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id,s.template_code,s.recipient_phone,s.message,s.cost,s.status,s.order_id||null).run()}async function Tn(e,s,t){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(t,s).run()}async function xn(e,s){try{const{order:t,products:r}=await wn(e.DB,s),a=await Sn(e.DB,t.seller_id);if(!a)return console.warn(`Skipping alimtalk for order ${s}: no active account`),{success:!1,reason:"no_account"};const n=15;if(a.balance<n)return console.warn(`Skipping alimtalk for order ${s}: insufficient balance`),{success:!1,reason:"insufficient_balance"};const o=r.map(u=>`${u.name} ${u.quantity}개 (${u.price.toLocaleString()}원)`).join(`
`),i=`[주문 확인]

주문번호: ${t.order_number}
주문일시: ${new Date(t.created_at).toLocaleString("ko-KR")}

주문 상품:
${o}

총 결제금액: ${t.total_amount.toLocaleString()}원

배송지: ${t.shipping_address}
수령인: ${t.shipping_name}
연락처: ${t.shipping_phone}

주문해 주셔서 감사합니다!`,c=await pt(e,{senderKey:a.sender_key,templateCode:"order_confirm",to:t.buyer_phone,message:i});return c.success?(await Tn(e.DB,t.seller_id,n),await It(e.DB,{seller_id:t.seller_id,template_code:"order_confirm",recipient_phone:t.buyer_phone,message:i,cost:n,status:"sent",order_id:s}),console.log(`Order confirmation sent for order ${s}`),{success:!0}):(await It(e.DB,{seller_id:t.seller_id,template_code:"order_confirm",recipient_phone:t.buyer_phone,message:i,cost:0,status:"failed",order_id:s}),console.error(`Failed to send order confirmation for order ${s}:`,c.error),{success:!1,error:c.error})}catch(t){return console.error(`Error sending order confirmation for order ${s}:`,t),{success:!1,error:t.message}}}function Rn(e,s){let t=e;return Object.entries(s).forEach(([r,a])=>{const n=new RegExp(`#{${r}}`,"g");t=t.replace(n,a)}),t}function In(e,s){const r=Array.from(e.matchAll(/#{(\w+)}/g),a=>a[1]).filter(a=>!s[a]);return{valid:r.length===0,missingVars:r}}async function vn(e,s,t){const r=await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();if(!r)throw new Error(`Account not found: ${s}`);return{sufficient:r.balance>=t,currentBalance:r.balance}}async function An(e,s,t){const r=await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(t,s,t).run();if(!r.success||r.meta.changes===0)throw new Error("Insufficient balance or account not found")}async function vt(e,s,t){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t,s).run()}async function et(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s.accountId,s.templateId,s.orderId||null,s.recipientPhone,s.messageContent,s.status,s.cost,s.aligoMessageId||null,s.failedReason||null).run()}async function Dn(e,s,t,r){await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t,r,s).run()}async function On(e,s,t,r,a,n,o,i,c){try{const u={...i,...o.variables},l=Rn(r,u),d=await pt(e,{senderKey:a,templateCode:n,to:o.phone,message:l});return d.success?(await et(e.DB,{accountId:s,templateId:t,recipientPhone:o.phone,messageContent:l,status:"sent",cost:c,aligoMessageId:d.messageId}),{phone:o.phone,status:"sent",messageId:d.messageId,cost:c}):(await et(e.DB,{accountId:s,templateId:t,recipientPhone:o.phone,messageContent:l,status:"failed",cost:0,failedReason:d.error}),await vt(e.DB,s,c),{phone:o.phone,status:"failed",error:d.error,cost:0})}catch(u){return console.error(`Failed to send alimtalk to ${o.phone}:`,u),await et(e.DB,{accountId:s,templateId:t,recipientPhone:o.phone,messageContent:"",status:"failed",cost:0,failedReason:u.message}),await vt(e.DB,s,c),{phone:o.phone,status:"failed",error:u.message,cost:0}}}async function ft(e,s){const{accountId:t,templateId:r,recipients:a,variables:n}=s;console.log(`[Alimtalk] Starting bulk send: ${a.length} recipients`);try{const o=await e.DB.prepare(`
      SELECT 
        id,
        sender_key,
        balance,
        status
      FROM alimtalk_accounts
      WHERE id = ?
    `).bind(t).first();if(!o)throw new Error("Account not found");if(o.status!=="active")throw new Error("Account is not active");const i=await e.DB.prepare(`
      SELECT 
        id,
        template_code,
        template_content,
        status
      FROM alimtalk_templates
      WHERE id = ? AND account_id = ?
    `).bind(r,t).first();if(!i)throw new Error("Template not found");if(i.status!=="approved")throw new Error("Template is not approved");const c=In(i.template_content,n);if(!c.valid)throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);const u=15,l=a.length*u,d=await vn(e.DB,t,l);if(!d.sufficient)throw new Error(`Insufficient balance. Required: ${l}, Current: ${d.currentBalance}`);await An(e.DB,t,l),console.log(`[Alimtalk] Deducted ${l} points from account ${t}`);const f=[];let m=0,_=0,h=0;for(const w of a){const y=await On(e,t,r,i.template_content,o.sender_key,i.template_code,w,n,u);f.push(y),y.status==="sent"?m++:(_++,h+=u),f.length%10===0&&await new Promise(g=>setTimeout(g,1e3))}return await Dn(e.DB,t,m,_),console.log(`[Alimtalk] Completed: ${m} sent, ${_} failed, ${h} refunded`),{success:!0,totalRecipients:a.length,successCount:m,failedCount:_,refundedAmount:h,messages:f}}catch(o){return console.error("[Alimtalk] Bulk send failed:",o),{success:!1,totalRecipients:a.length,successCount:0,failedCount:a.length,refundedAmount:0,messages:[],error:o.message}}}async function Cn(e,s,t,r,a){const n=await e.DB.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(r).first();if(!n)throw new Error(`Order not found: ${r}`);const i=(await e.DB.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(r).all()).results.map(l=>`${l.name} ${l.quantity}개 (${l.price.toLocaleString()}원)`).join(`
`),c={orderNumber:n.order_number,orderDate:new Date(n.created_at).toLocaleString("ko-KR"),productList:i,totalAmount:n.total_amount.toLocaleString(),shippingAddress:n.shipping_address,shippingName:n.shipping_name,shippingPhone:n.shipping_phone,buyerName:n.buyer_name,customMessage:a||"감사합니다!"},u=[{phone:n.buyer_phone,name:n.buyer_name}];return ft(e,{accountId:s,templateId:t,recipients:u,variables:c})}async function kn(e,s,t,r,a={}){const n=r.map(o=>({phone:o.phone,name:o.name,variables:Object.entries(o).filter(([i])=>i!=="phone"&&i!=="name").reduce((i,[c,u])=>({...i,[c]:u}),{})}));return ft(e,{accountId:s,templateId:t,recipients:n,variables:a})}function Nn(e,s=.1){return Math.floor(e*s)}function jn(){const e=new Date,s=new Date(e.getFullYear(),e.getMonth()-1,1),t=s.getFullYear(),r=String(s.getMonth()+1).padStart(2,"0"),a=new Date(t,s.getMonth()+1,0).getDate();return{startDate:`${t}-${r}-01`,endDate:`${t}-${r}-${a}`}}async function Ln(e,s,t){try{const r=await e.prepare(`
      SELECT id, business_name FROM sellers WHERE id = ?
    `).bind(s).first();if(!r)return null;const a=await e.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.total_amount,
        o.shipping_fee,
        o.status,
        GROUP_CONCAT(p.name, ', ') as product_names,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.seller_id = ?
        AND DATE(o.created_at) BETWEEN ? AND ?
        AND o.status IN ('delivered', 'confirmed')
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).bind(s,t.startDate,t.endDate).all();if(!a.results||a.results.length===0)return{seller_id:s,seller_name:r.business_name,total_sales:0,total_orders:0,platform_fee:0,shipping_fee:0,refund_amount:0,settlement_amount:0,orders:[]};const n=[];let o=0,i=0,c=0;for(const f of a.results){const m=f.total_amount-f.shipping_fee,_=Nn(m);n.push({order_id:f.id,order_number:f.order_number,order_date:f.created_at,product_name:f.product_names||"",quantity:f.total_quantity||1,price:m,shipping_fee:f.shipping_fee||0,platform_fee:_,status:f.status}),o+=m,i+=f.shipping_fee||0,c+=_}const u=await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(s,t.startDate,t.endDate).first(),l=(u==null?void 0:u.refund_amount)||0,d=o-c-l+i;return{seller_id:s,seller_name:r.business_name,total_sales:o,total_orders:n.length,platform_fee:c,shipping_fee:i,refund_amount:l,settlement_amount:d,orders:n}}catch(r){return console.error(`Failed to calculate settlement for seller ${s}:`,r),null}}async function Mn(e,s){console.log(`[Settlement] Generating report for ${s.startDate} ~ ${s.endDate}`);const t=await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(s.startDate,s.endDate).all(),r=[];let a=0,n=0,o=0;for(const c of t.results){const u=await Ln(e,c.id,s);u&&(r.push(u),a+=u.total_sales,n+=u.platform_fee,o+=u.settlement_amount)}const i={period:s,generated_at:new Date().toISOString(),total_sales:a,total_platform_fee:n,total_settlement:o,sellers:r};return console.log(`[Settlement] Report generated: ${r.length} sellers, ${a.toLocaleString()}원`),i}async function Fn(e,s){const r=(await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(s.period.startDate,s.period.endDate,s.total_sales,s.total_platform_fee,s.total_settlement,s.generated_at).run()).meta.last_row_id;for(const a of s.sellers)await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a.seller_id,a.total_sales,a.total_orders,a.platform_fee,a.shipping_fee,a.refund_amount,a.settlement_amount).run();console.log(`[Settlement] Report saved: ID ${r}`)}async function $n(e,s){const t=await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(s).first();if(!t)return null;const a=(await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(s).all()).results.map(n=>({seller_id:n.seller_id,seller_name:n.seller_name,total_sales:n.total_sales,total_orders:n.total_orders,platform_fee:n.platform_fee,shipping_fee:n.shipping_fee,refund_amount:n.refund_amount,settlement_amount:n.settlement_amount,orders:[]}));return{period:{startDate:t.period_start,endDate:t.period_end},generated_at:t.generated_at,total_sales:t.total_sales,total_platform_fee:t.total_platform_fee,total_settlement:t.total_settlement,sellers:a}}async function Un(e,s){const t=new TextEncoder;let r;const a=new ReadableStream({async start(n){console.log(`[SSE] Client connected to stream ${e}`);try{const o=await s.DB.prepare(`
          SELECT 
            id,
            title,
            status,
            viewer_count,
            like_count
          FROM live_streams
          WHERE id = ?
        `).bind(e).first();if(o){const i={type:"status",data:o,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(t.encode(`data: ${c}

`))}}catch(o){console.error("[SSE] Failed to fetch initial data:",o)}r=setInterval(async()=>{try{const o=await s.DB.prepare(`
            SELECT 
              viewer_count,
              like_count,
              comment_count
            FROM live_streams
            WHERE id = ?
          `).bind(e).first();if(o){const i={type:"viewer_count",data:o,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(t.encode(`data: ${c}

`))}n.enqueue(t.encode(`: ping

`))}catch(o){console.error("[SSE] Update failed:",o)}},3e4)},cancel(){console.log(`[SSE] Client disconnected from stream ${e}`),r&&clearInterval(r)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Pn(e,s){const t=new TextEncoder;let r=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Chat] Client connected to stream ${e}`);try{const i=await s.DB.prepare(`
          SELECT 
            id,
            user_id,
            user_name,
            user_avatar,
            message,
            is_seller,
            is_admin,
            created_at
          FROM chat_messages
          WHERE live_stream_id = ?
          ORDER BY id DESC
          LIMIT 50
        `).bind(e).all();if(i.results.length>0){r=i.results[0].id;const c={type:"chat",data:i.results.reverse(),timestamp:new Date().toISOString()},u=JSON.stringify(c);o.enqueue(t.encode(`data: ${u}

`))}}catch(i){console.error("[SSE Chat] Failed to fetch initial messages:",i)}a=setInterval(async()=>{try{const i=await s.DB.prepare(`
            SELECT 
              id,
              user_id,
              user_name,
              user_avatar,
              message,
              is_seller,
              is_admin,
              created_at
            FROM chat_messages
            WHERE live_stream_id = ? AND id > ?
            ORDER BY id ASC
          `).bind(e,r).all();if(i.results.length>0){r=i.results[i.results.length-1].id;const c={type:"chat",data:i.results,timestamp:new Date().toISOString()},u=JSON.stringify(c);o.enqueue(t.encode(`data: ${u}

`))}else o.enqueue(t.encode(`: ping

`))}catch(i){console.error("[SSE Chat] Polling failed:",i)}},5e3)},cancel(){console.log(`[SSE Chat] Client disconnected from stream ${e}`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Wn(e,s){const t=new TextEncoder;let r=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Orders] Seller ${e} connected`);try{const i=await s.DB.prepare(`
          SELECT id FROM orders
          WHERE seller_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).bind(e).first();i&&(r=i.id)}catch(i){console.error("[SSE Orders] Failed to fetch last order:",i)}a=setInterval(async()=>{try{const i=await s.DB.prepare(`
            SELECT 
              o.id,
              o.order_number,
              o.total_amount,
              o.status,
              o.created_at,
              u.name as buyer_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.seller_id = ? AND o.id > ?
            ORDER BY o.id ASC
          `).bind(e,r).all();if(i.results.length>0){r=i.results[i.results.length-1].id;const c={type:"order",data:i.results,timestamp:new Date().toISOString()},u=JSON.stringify(c);o.enqueue(t.encode(`data: ${u}

`))}else o.enqueue(t.encode(`: ping

`))}catch(i){console.error("[SSE Orders] Polling failed:",i)}},1e4)},cancel(){console.log(`[SSE Orders] Seller ${e} disconnected`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Hn(e,s){const t=new TextEncoder;let r;const a=new ReadableStream({async start(n){console.log(`[SSE Stock] Seller ${e} connected`),r=setInterval(async()=>{try{const o=await s.DB.prepare(`
            SELECT 
              id,
              name,
              stock,
              low_stock_threshold
            FROM products
            WHERE seller_id = ?
              AND stock <= low_stock_threshold
              AND stock > 0
          `).bind(e).all();if(o.results.length>0){const i={type:"stock",data:o.results,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(t.encode(`data: ${c}

`))}else n.enqueue(t.encode(`: ping

`))}catch(o){console.error("[SSE Stock] Polling failed:",o)}},6e4)},cancel(){console.log(`[SSE Stock] Seller ${e} disconnected`),r&&clearInterval(r)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function qn(e,s,t,r){await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s,t,r.endpoint,r.keys.p256dh,r.keys.auth).run(),console.log(`[Push] Subscription saved for ${t} ${s}`)}async function Bn(e,s){await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(),console.log(`[Push] Subscription deleted: ${s}`)}function Kn(e){if(e.req.method!=="GET")return!1;const s=e.req.header("Authorization"),t=e.req.header("X-Session-Token");if(s||t)return!1;const a=new URL(e.req.url).pathname;return!(a.includes("/api/products/")&&a.includes("/stock")||a.includes("/api/streams/")&&a.includes("/status")||a.includes("/current-product")||a.includes("/api/chat")||a.includes("/api/sse")||a.includes("/api/orders")||a.includes("/api/payment"))}function Jn(e,s){return s||new URL(e.req.url).toString()}function Vn(e){const s=[];return s.push("public"),s.push(`max-age=${e.ttl}`),e.sMaxAge!==void 0?s.push(`s-maxage=${e.sMaxAge}`):s.push(`s-maxage=${e.ttl}`),e.staleWhileRevalidate&&s.push(`stale-while-revalidate=${e.staleWhileRevalidate}`),s.join(", ")}function Bs(e){return async(s,t)=>{var i;if(e.skipCache||!Kn(s))return t();const r=Jn(s,e.cacheKey),a=caches.default;let n=await a.match(r);if(n){console.log(`[Cache HIT] ${r}`);const c=new Headers(n.headers);return c.set("X-Cache","HIT"),c.set("X-Cache-Key",r),new Response(n.body,{status:n.status,statusText:n.statusText,headers:c})}console.log(`[Cache MISS] ${r}`),await t();const o=s.res;if(o.status>=200&&o.status<300){const c=Vn(e);o.headers.set("Cache-Control",c),o.headers.set("X-Cache","MISS"),o.headers.set("X-Cache-Key",r);const u=e.varyBy||["Accept-Encoding"];o.headers.set("Vary",u.join(", "));const l=o.clone();(i=s.executionCtx)==null||i.waitUntil(a.put(r,l))}}}const Ks={products:{ttl:10,sMaxAge:60,staleWhileRevalidate:120},liveStreams:{ttl:5,sMaxAge:10,staleWhileRevalidate:30},microCache:{ttl:10,sMaxAge:10,staleWhileRevalidate:30}};class Yn extends Error{constructor(s,t,r,a){super(r),this.statusCode=s,this.code=t,this.details=a,this.name="AppError",Error.captureStackTrace(this,this.constructor)}}async function zn(e,s,t,r){if(e)try{const a={title:`✅ ${s}`,description:t,color:3066993,fields:[],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Monitor"}};if(r)for(const[n,o]of Object.entries(r))a.fields.push({name:n,value:String(o),inline:!0});await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[a]})})}catch(a){console.error("[Discord] Failed to send success alert:",a)}}async function Gn(e,s,t){if(e)try{const r=["📊 **KV 사용량 경고**","","현재 사용량:",`• 읽기: ${s.toFixed(1)}%`,`• 쓰기: ${t.toFixed(1)}%`,"","50% 이상 사용 중입니다. 유료 플랜 업그레이드를 고려하세요.","https://dash.cloudflare.com"].join(`
`);await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:r})})}catch(r){console.error("[Discord] Failed to send KV warning:",r)}}class wr{constructor(s){this.accessToken=null,this.tokenExpiry=0,this.databaseURL=s.FIREBASE_DATABASE_URL,this.projectId=s.FIREBASE_PROJECT_ID,this.privateKey=s.FIREBASE_PRIVATE_KEY,this.clientEmail=s.FIREBASE_CLIENT_EMAIL,(!this.databaseURL||!this.projectId||!this.privateKey||!this.clientEmail)&&console.warn("⚠️ Firebase Admin credentials not configured, using unauthenticated mode")}async set(s,t){const r=`${this.databaseURL}/${s}.json`,a=await fetch(r,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!a.ok){const n=await a.text();throw console.error(`❌ Firebase set failed for ${s}:`,n),new Error(`Firebase set failed: ${a.statusText}`)}console.log(`✅ Firebase: Set data at ${s}`)}async update(s,t){const r=`${this.databaseURL}/${s}.json`,a=await fetch(r,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!a.ok){const n=await a.text();throw console.error(`❌ Firebase update failed for ${s}:`,n),new Error(`Firebase update failed: ${a.statusText}`)}console.log(`✅ Firebase: Updated data at ${s}`)}async get(s){const t=`${this.databaseURL}/${s}.json`,r=await fetch(t,{method:"GET"});if(!r.ok)throw new Error(`Firebase get failed: ${r.statusText}`);return await r.json()}async delete(s){const t=`${this.databaseURL}/${s}.json`,r=await fetch(t,{method:"DELETE"});if(!r.ok)throw new Error(`Firebase delete failed: ${r.statusText}`);console.log(`✅ Firebase: Deleted data at ${s}`)}async updateStreamStatus(s,t){try{await this.update(`streams/stream${s}`,{...t,updated_at:Date.now()}),console.log(`✅ Firebase: Stream ${s} updated`,t)}catch(r){console.error(`❌ Firebase: Failed to update stream ${s}`,r)}}async updateProductStock(s,t,r){try{await this.update(`products/product${s}`,{id:s,stock:t,...r,updated_at:Date.now()}),console.log(`✅ Firebase: Product ${s} stock updated to ${t}`)}catch(a){console.error(`❌ Firebase: Failed to update product ${s}`,a)}}async changeCurrentProduct(s,t){try{await this.updateStreamStatus(s,{current_product_id:t}),console.log(`✅ Firebase: Stream ${s} current product changed to ${t}`)}catch(r){console.error(`❌ Firebase: Failed to change product for stream ${s}`,r)}}async sendLowStockAlert(s,t,r){try{const a=`chats/stream${s}`,n=Date.now();await this.set(`${a}/alert_${n}`,{username:"시스템",text:`⚠️ ${t}의 재고가 ${r}개 남았습니다!`,timestamp:n,isSystem:!0}),console.log(`✅ Firebase: Low stock alert sent for stream ${s}`)}catch(a){console.error("❌ Firebase: Failed to send low stock alert",a)}}async sendSoldOutAlert(s,t){try{const r=`chats/stream${s}`,a=Date.now();await this.set(`${r}/soldout_${a}`,{username:"시스템",text:`🔴 ${t}이(가) 품절되었습니다!`,timestamp:a,isSystem:!0}),console.log(`✅ Firebase: Sold out alert sent for stream ${s}`)}catch(r){console.error("❌ Firebase: Failed to send sold out alert",r)}}async createCustomToken(s,t){try{if(console.log(`[Firebase Custom Token] Creating for UID: ${s}`),console.log("[Firebase Custom Token] Claims:",JSON.stringify(t)),!this.privateKey||!this.clientEmail||!this.projectId){const y=[];throw this.privateKey||y.push("FIREBASE_PRIVATE_KEY"),this.clientEmail||y.push("FIREBASE_CLIENT_EMAIL"),this.projectId||y.push("FIREBASE_PROJECT_ID"),new Error(`Firebase credentials not configured: missing ${y.join(", ")}`)}console.log(`[Firebase Custom Token] Using project: ${this.projectId}`),console.log(`[Firebase Custom Token] Using service account: ${this.clientEmail}`);const r={alg:"RS256",typ:"JWT"},a=Math.floor(Date.now()/1e3),n={iss:this.clientEmail,sub:this.clientEmail,aud:"https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",iat:a,exp:a+3600,uid:s,claims:t||{}},o=y=>{const g=JSON.stringify(y),T=new TextEncoder().encode(g);let b="";for(let j=0;j<T.length;j++)b+=String.fromCharCode(T[j]);return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")};console.log("[Firebase Custom Token] Encoding header and payload...");const i=o(r),c=o(n),u=`${i}.${c}`;console.log("[Firebase Custom Token] Parsing private key...");const l=this.privateKey.replace(/\\n/g,`
`);if(!l.includes("-----BEGIN PRIVATE KEY-----"))throw new Error("Invalid private key format: missing PEM header");if(!l.includes("-----END PRIVATE KEY-----"))throw new Error("Invalid private key format: missing PEM footer");console.log("[Firebase Custom Token] Converting PEM to DER...");const d=await this.pemToDer(l);console.log("[Firebase Custom Token] Importing crypto key...");const f=await crypto.subtle.importKey("pkcs8",d,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},!1,["sign"]);console.log("[Firebase Custom Token] Signing token...");const m=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",f,new TextEncoder().encode(u)),h=btoa(String.fromCharCode(...new Uint8Array(m))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,""),w=`${u}.${h}`;return console.log("[Firebase Custom Token] ✅ Token created successfully"),w}catch(r){throw console.error("[Firebase Custom Token] ❌ Failed to create token:",r),console.error("[Firebase Custom Token] Error name:",r.name),console.error("[Firebase Custom Token] Error message:",r.message),console.error("[Firebase Custom Token] Error stack:",r.stack),new Error(`Failed to create Firebase custom token: ${r.message}`)}}async pemToDer(s){const a=s.substring("-----BEGIN PRIVATE KEY-----".length,s.length-"-----END PRIVATE KEY-----".length-1).trim(),n=atob(a),o=new Uint8Array(n.length);for(let i=0;i<n.length;i++)o[i]=n.charCodeAt(i);return o.buffer}}function ns(e){return new wr(e)}async function Xn(e,s,t){try{s==="stream"?await e.updateStreamStatus(t.id,{id:t.id,title:t.title,status:t.status,current_product_id:t.current_product_id,viewer_count:t.viewer_count||0,seller_id:t.seller_id,youtube_video_id:t.youtube_video_id}):s==="product"&&await e.updateProductStock(t.id,t.stock,{name:t.name,price:t.price,original_price:t.original_price,discount_rate:t.discount_rate,image_url:t.image_url})}catch(r){console.error(`❌ Firebase sync failed for ${s}:`,r)}}const Qn=Object.freeze(Object.defineProperty({__proto__:null,FirebaseAdmin:wr,initFirebaseAdmin:ns,syncD1ToFirebase:Xn},Symbol.toStringTag,{value:"Module"})),mt=crypto,Sr=e=>e instanceof CryptoKey,Os=new TextEncoder,Js=new TextDecoder;function Zn(...e){const s=e.reduce((a,{length:n})=>a+n,0),t=new Uint8Array(s);let r=0;for(const a of e)t.set(a,r),r+=a.length;return t}const eo=e=>{const s=atob(e),t=new Uint8Array(s.length);for(let r=0;r<s.length;r++)t[r]=s.charCodeAt(r);return t},Fe=e=>{let s=e;s instanceof Uint8Array&&(s=Js.decode(s)),s=s.replace(/-/g,"+").replace(/_/g,"/").replace(/\s/g,"");try{return eo(s)}catch{throw new TypeError("The input to be decoded is not correctly encoded.")}};class X extends Error{constructor(s,t){var r;super(s,t),this.code="ERR_JOSE_GENERIC",this.name=this.constructor.name,(r=Error.captureStackTrace)==null||r.call(Error,this,this.constructor)}}X.code="ERR_JOSE_GENERIC";class ie extends X{constructor(s,t,r="unspecified",a="unspecified"){super(s,{cause:{claim:r,reason:a,payload:t}}),this.code="ERR_JWT_CLAIM_VALIDATION_FAILED",this.claim=r,this.reason=a,this.payload=t}}ie.code="ERR_JWT_CLAIM_VALIDATION_FAILED";class _s extends X{constructor(s,t,r="unspecified",a="unspecified"){super(s,{cause:{claim:r,reason:a,payload:t}}),this.code="ERR_JWT_EXPIRED",this.claim=r,this.reason=a,this.payload=t}}_s.code="ERR_JWT_EXPIRED";class Tr extends X{constructor(){super(...arguments),this.code="ERR_JOSE_ALG_NOT_ALLOWED"}}Tr.code="ERR_JOSE_ALG_NOT_ALLOWED";class me extends X{constructor(){super(...arguments),this.code="ERR_JOSE_NOT_SUPPORTED"}}me.code="ERR_JOSE_NOT_SUPPORTED";class so extends X{constructor(s="decryption operation failed",t){super(s,t),this.code="ERR_JWE_DECRYPTION_FAILED"}}so.code="ERR_JWE_DECRYPTION_FAILED";class to extends X{constructor(){super(...arguments),this.code="ERR_JWE_INVALID"}}to.code="ERR_JWE_INVALID";class V extends X{constructor(){super(...arguments),this.code="ERR_JWS_INVALID"}}V.code="ERR_JWS_INVALID";class Rs extends X{constructor(){super(...arguments),this.code="ERR_JWT_INVALID"}}Rs.code="ERR_JWT_INVALID";class ro extends X{constructor(){super(...arguments),this.code="ERR_JWK_INVALID"}}ro.code="ERR_JWK_INVALID";class _t extends X{constructor(){super(...arguments),this.code="ERR_JWKS_INVALID"}}_t.code="ERR_JWKS_INVALID";class ht extends X{constructor(s="no applicable key found in the JSON Web Key Set",t){super(s,t),this.code="ERR_JWKS_NO_MATCHING_KEY"}}ht.code="ERR_JWKS_NO_MATCHING_KEY";class xr extends X{constructor(s="multiple matching keys found in the JSON Web Key Set",t){super(s,t),this.code="ERR_JWKS_MULTIPLE_MATCHING_KEYS"}}xr.code="ERR_JWKS_MULTIPLE_MATCHING_KEYS";class Rr extends X{constructor(s="request timed out",t){super(s,t),this.code="ERR_JWKS_TIMEOUT"}}Rr.code="ERR_JWKS_TIMEOUT";class Ir extends X{constructor(s="signature verification failed",t){super(s,t),this.code="ERR_JWS_SIGNATURE_VERIFICATION_FAILED"}}Ir.code="ERR_JWS_SIGNATURE_VERIFICATION_FAILED";function fe(e,s="algorithm.name"){return new TypeError(`CryptoKey does not support this operation, its ${s} must be ${e}`)}function ds(e,s){return e.name===s}function st(e){return parseInt(e.name.slice(4),10)}function ao(e){switch(e){case"ES256":return"P-256";case"ES384":return"P-384";case"ES512":return"P-521";default:throw new Error("unreachable")}}function no(e,s){if(s.length&&!s.some(t=>e.usages.includes(t))){let t="CryptoKey does not support this operation, its usages must include ";if(s.length>2){const r=s.pop();t+=`one of ${s.join(", ")}, or ${r}.`}else s.length===2?t+=`one of ${s[0]} or ${s[1]}.`:t+=`${s[0]}.`;throw new TypeError(t)}}function oo(e,s,...t){switch(s){case"HS256":case"HS384":case"HS512":{if(!ds(e.algorithm,"HMAC"))throw fe("HMAC");const r=parseInt(s.slice(2),10);if(st(e.algorithm.hash)!==r)throw fe(`SHA-${r}`,"algorithm.hash");break}case"RS256":case"RS384":case"RS512":{if(!ds(e.algorithm,"RSASSA-PKCS1-v1_5"))throw fe("RSASSA-PKCS1-v1_5");const r=parseInt(s.slice(2),10);if(st(e.algorithm.hash)!==r)throw fe(`SHA-${r}`,"algorithm.hash");break}case"PS256":case"PS384":case"PS512":{if(!ds(e.algorithm,"RSA-PSS"))throw fe("RSA-PSS");const r=parseInt(s.slice(2),10);if(st(e.algorithm.hash)!==r)throw fe(`SHA-${r}`,"algorithm.hash");break}case"EdDSA":{if(e.algorithm.name!=="Ed25519"&&e.algorithm.name!=="Ed448")throw fe("Ed25519 or Ed448");break}case"Ed25519":{if(!ds(e.algorithm,"Ed25519"))throw fe("Ed25519");break}case"ES256":case"ES384":case"ES512":{if(!ds(e.algorithm,"ECDSA"))throw fe("ECDSA");const r=ao(s);if(e.algorithm.namedCurve!==r)throw fe(r,"algorithm.namedCurve");break}default:throw new TypeError("CryptoKey does not support this operation")}no(e,t)}function vr(e,s,...t){var r;if(t=t.filter(Boolean),t.length>2){const a=t.pop();e+=`one of type ${t.join(", ")}, or ${a}.`}else t.length===2?e+=`one of type ${t[0]} or ${t[1]}.`:e+=`of type ${t[0]}.`;return s==null?e+=` Received ${s}`:typeof s=="function"&&s.name?e+=` Received function ${s.name}`:typeof s=="object"&&s!=null&&(r=s.constructor)!=null&&r.name&&(e+=` Received an instance of ${s.constructor.name}`),e}const At=(e,...s)=>vr("Key must be ",e,...s);function Ar(e,s,...t){return vr(`Key for the ${e} algorithm must be `,s,...t)}const Dr=e=>Sr(e)?!0:(e==null?void 0:e[Symbol.toStringTag])==="KeyObject",$s=["CryptoKey"],io=(...e)=>{const s=e.filter(Boolean);if(s.length===0||s.length===1)return!0;let t;for(const r of s){const a=Object.keys(r);if(!t||t.size===0){t=new Set(a);continue}for(const n of a){if(t.has(n))return!1;t.add(n)}}return!0};function co(e){return typeof e=="object"&&e!==null}function Ae(e){if(!co(e)||Object.prototype.toString.call(e)!=="[object Object]")return!1;if(Object.getPrototypeOf(e)===null)return!0;let s=e;for(;Object.getPrototypeOf(s)!==null;)s=Object.getPrototypeOf(s);return Object.getPrototypeOf(e)===s}const uo=(e,s)=>{if(e.startsWith("RS")||e.startsWith("PS")){const{modulusLength:t}=s.algorithm;if(typeof t!="number"||t<2048)throw new TypeError(`${e} requires key modulusLength to be 2048 bits or larger`)}};function os(e){return Ae(e)&&typeof e.kty=="string"}function lo(e){return e.kty!=="oct"&&typeof e.d=="string"}function po(e){return e.kty!=="oct"&&typeof e.d>"u"}function fo(e){return os(e)&&e.kty==="oct"&&typeof e.k=="string"}function mo(e){let s,t;switch(e.kty){case"RSA":{switch(e.alg){case"PS256":case"PS384":case"PS512":s={name:"RSA-PSS",hash:`SHA-${e.alg.slice(-3)}`},t=e.d?["sign"]:["verify"];break;case"RS256":case"RS384":case"RS512":s={name:"RSASSA-PKCS1-v1_5",hash:`SHA-${e.alg.slice(-3)}`},t=e.d?["sign"]:["verify"];break;case"RSA-OAEP":case"RSA-OAEP-256":case"RSA-OAEP-384":case"RSA-OAEP-512":s={name:"RSA-OAEP",hash:`SHA-${parseInt(e.alg.slice(-3),10)||1}`},t=e.d?["decrypt","unwrapKey"]:["encrypt","wrapKey"];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}case"EC":{switch(e.alg){case"ES256":s={name:"ECDSA",namedCurve:"P-256"},t=e.d?["sign"]:["verify"];break;case"ES384":s={name:"ECDSA",namedCurve:"P-384"},t=e.d?["sign"]:["verify"];break;case"ES512":s={name:"ECDSA",namedCurve:"P-521"},t=e.d?["sign"]:["verify"];break;case"ECDH-ES":case"ECDH-ES+A128KW":case"ECDH-ES+A192KW":case"ECDH-ES+A256KW":s={name:"ECDH",namedCurve:e.crv},t=e.d?["deriveBits"]:[];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}case"OKP":{switch(e.alg){case"Ed25519":s={name:"Ed25519"},t=e.d?["sign"]:["verify"];break;case"EdDSA":s={name:e.crv},t=e.d?["sign"]:["verify"];break;case"ECDH-ES":case"ECDH-ES+A128KW":case"ECDH-ES+A192KW":case"ECDH-ES+A256KW":s={name:e.crv},t=e.d?["deriveBits"]:[];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}default:throw new me('Invalid or unsupported JWK "kty" (Key Type) Parameter value')}return{algorithm:s,keyUsages:t}}const Or=async e=>{if(!e.alg)throw new TypeError('"alg" argument is required when "jwk.alg" is not present');const{algorithm:s,keyUsages:t}=mo(e),r=[s,e.ext??!1,e.key_ops??t],a={...e};return delete a.alg,delete a.use,mt.subtle.importKey("jwk",a,...r)},Cr=e=>Fe(e);let Be,Ke;const kr=e=>(e==null?void 0:e[Symbol.toStringTag])==="KeyObject",Us=async(e,s,t,r,a=!1)=>{let n=e.get(s);if(n!=null&&n[r])return n[r];const o=await Or({...t,alg:r});return a&&Object.freeze(s),n?n[r]=o:e.set(s,{[r]:o}),o},_o=(e,s)=>{if(kr(e)){let t=e.export({format:"jwk"});return delete t.d,delete t.dp,delete t.dq,delete t.p,delete t.q,delete t.qi,t.k?Cr(t.k):(Ke||(Ke=new WeakMap),Us(Ke,e,t,s))}return os(e)?e.k?Fe(e.k):(Ke||(Ke=new WeakMap),Us(Ke,e,e,s,!0)):e},ho=(e,s)=>{if(kr(e)){let t=e.export({format:"jwk"});return t.k?Cr(t.k):(Be||(Be=new WeakMap),Us(Be,e,t,s))}return os(e)?e.k?Fe(e.k):(Be||(Be=new WeakMap),Us(Be,e,e,s,!0)):e},Eo={normalizePublicKey:_o,normalizePrivateKey:ho};async function Nr(e,s){if(!Ae(e))throw new TypeError("JWK must be an object");switch(s||(s=e.alg),e.kty){case"oct":if(typeof e.k!="string"||!e.k)throw new TypeError('missing "k" (Key Value) Parameter value');return Fe(e.k);case"RSA":if("oth"in e&&e.oth!==void 0)throw new me('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');case"EC":case"OKP":return Or({...e,alg:s});default:throw new me('Unsupported "kty" (Key Type) Parameter value')}}const Ge=e=>e==null?void 0:e[Symbol.toStringTag],nt=(e,s,t)=>{var r,a;if(s.use!==void 0&&s.use!=="sig")throw new TypeError("Invalid key for this operation, when present its use must be sig");if(s.key_ops!==void 0&&((a=(r=s.key_ops).includes)==null?void 0:a.call(r,t))!==!0)throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${t}`);if(s.alg!==void 0&&s.alg!==e)throw new TypeError(`Invalid key for this operation, when present its alg must be ${e}`);return!0},go=(e,s,t,r)=>{if(!(s instanceof Uint8Array)){if(r&&os(s)){if(fo(s)&&nt(e,s,t))return;throw new TypeError('JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present')}if(!Dr(s))throw new TypeError(Ar(e,s,...$s,"Uint8Array",r?"JSON Web Key":null));if(s.type!=="secret")throw new TypeError(`${Ge(s)} instances for symmetric algorithms must be of type "secret"`)}},bo=(e,s,t,r)=>{if(r&&os(s))switch(t){case"sign":if(lo(s)&&nt(e,s,t))return;throw new TypeError("JSON Web Key for this operation be a private JWK");case"verify":if(po(s)&&nt(e,s,t))return;throw new TypeError("JSON Web Key for this operation be a public JWK")}if(!Dr(s))throw new TypeError(Ar(e,s,...$s,r?"JSON Web Key":null));if(s.type==="secret")throw new TypeError(`${Ge(s)} instances for asymmetric algorithms must not be of type "secret"`);if(t==="sign"&&s.type==="public")throw new TypeError(`${Ge(s)} instances for asymmetric algorithm signing must be of type "private"`);if(t==="decrypt"&&s.type==="public")throw new TypeError(`${Ge(s)} instances for asymmetric algorithm decryption must be of type "private"`);if(s.algorithm&&t==="verify"&&s.type==="private")throw new TypeError(`${Ge(s)} instances for asymmetric algorithm verifying must be of type "public"`);if(s.algorithm&&t==="encrypt"&&s.type==="private")throw new TypeError(`${Ge(s)} instances for asymmetric algorithm encryption must be of type "public"`)};function jr(e,s,t,r){s.startsWith("HS")||s==="dir"||s.startsWith("PBES2")||/^A\d{3}(?:GCM)?KW$/.test(s)?go(s,t,r,e):bo(s,t,r,e)}jr.bind(void 0,!1);const Dt=jr.bind(void 0,!0);function yo(e,s,t,r,a){if(a.crit!==void 0&&(r==null?void 0:r.crit)===void 0)throw new e('"crit" (Critical) Header Parameter MUST be integrity protected');if(!r||r.crit===void 0)return new Set;if(!Array.isArray(r.crit)||r.crit.length===0||r.crit.some(o=>typeof o!="string"||o.length===0))throw new e('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');let n;t!==void 0?n=new Map([...Object.entries(t),...s.entries()]):n=s;for(const o of r.crit){if(!n.has(o))throw new me(`Extension Header Parameter "${o}" is not recognized`);if(a[o]===void 0)throw new e(`Extension Header Parameter "${o}" is missing`);if(n.get(o)&&r[o]===void 0)throw new e(`Extension Header Parameter "${o}" MUST be integrity protected`)}return new Set(r.crit)}const wo=(e,s)=>{if(s!==void 0&&(!Array.isArray(s)||s.some(t=>typeof t!="string")))throw new TypeError(`"${e}" option must be an array of strings`);if(s)return new Set(s)};function So(e,s){const t=`SHA-${e.slice(-3)}`;switch(e){case"HS256":case"HS384":case"HS512":return{hash:t,name:"HMAC"};case"PS256":case"PS384":case"PS512":return{hash:t,name:"RSA-PSS",saltLength:e.slice(-3)>>3};case"RS256":case"RS384":case"RS512":return{hash:t,name:"RSASSA-PKCS1-v1_5"};case"ES256":case"ES384":case"ES512":return{hash:t,name:"ECDSA",namedCurve:s.namedCurve};case"Ed25519":return{name:"Ed25519"};case"EdDSA":return{name:s.name};default:throw new me(`alg ${e} is not supported either by JOSE or your javascript runtime`)}}async function To(e,s,t){if(s=await Eo.normalizePublicKey(s,e),Sr(s))return oo(s,e,t),s;if(s instanceof Uint8Array){if(!e.startsWith("HS"))throw new TypeError(At(s,...$s));return mt.subtle.importKey("raw",s,{hash:`SHA-${e.slice(-3)}`,name:"HMAC"},!1,[t])}throw new TypeError(At(s,...$s,"Uint8Array","JSON Web Key"))}const xo=async(e,s,t,r)=>{const a=await To(e,s,"verify");uo(e,a);const n=So(e,a.algorithm);try{return await mt.subtle.verify(n,a,t,r)}catch{return!1}};async function Ro(e,s,t){if(!Ae(e))throw new V("Flattened JWS must be an object");if(e.protected===void 0&&e.header===void 0)throw new V('Flattened JWS must have either of the "protected" or "header" members');if(e.protected!==void 0&&typeof e.protected!="string")throw new V("JWS Protected Header incorrect type");if(e.payload===void 0)throw new V("JWS Payload missing");if(typeof e.signature!="string")throw new V("JWS Signature missing or incorrect type");if(e.header!==void 0&&!Ae(e.header))throw new V("JWS Unprotected Header incorrect type");let r={};if(e.protected)try{const h=Fe(e.protected);r=JSON.parse(Js.decode(h))}catch{throw new V("JWS Protected Header is invalid")}if(!io(r,e.header))throw new V("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");const a={...r,...e.header},n=yo(V,new Map([["b64",!0]]),t==null?void 0:t.crit,r,a);let o=!0;if(n.has("b64")&&(o=r.b64,typeof o!="boolean"))throw new V('The "b64" (base64url-encode payload) Header Parameter must be a boolean');const{alg:i}=a;if(typeof i!="string"||!i)throw new V('JWS "alg" (Algorithm) Header Parameter missing or invalid');const c=t&&wo("algorithms",t.algorithms);if(c&&!c.has(i))throw new Tr('"alg" (Algorithm) Header Parameter value not allowed');if(o){if(typeof e.payload!="string")throw new V("JWS Payload must be a string")}else if(typeof e.payload!="string"&&!(e.payload instanceof Uint8Array))throw new V("JWS Payload must be a string or an Uint8Array instance");let u=!1;typeof s=="function"?(s=await s(r,e),u=!0,Dt(i,s,"verify"),os(s)&&(s=await Nr(s,i))):Dt(i,s,"verify");const l=Zn(Os.encode(e.protected??""),Os.encode("."),typeof e.payload=="string"?Os.encode(e.payload):e.payload);let d;try{d=Fe(e.signature)}catch{throw new V("Failed to base64url decode the signature")}if(!await xo(i,s,d,l))throw new Ir;let m;if(o)try{m=Fe(e.payload)}catch{throw new V("Failed to base64url decode the payload")}else typeof e.payload=="string"?m=Os.encode(e.payload):m=e.payload;const _={payload:m};return e.protected!==void 0&&(_.protectedHeader=r),e.header!==void 0&&(_.unprotectedHeader=e.header),u?{..._,key:s}:_}async function Io(e,s,t){if(e instanceof Uint8Array&&(e=Js.decode(e)),typeof e!="string")throw new V("Compact JWS must be a string or Uint8Array");const{0:r,1:a,2:n,length:o}=e.split(".");if(o!==3)throw new V("Invalid Compact JWS");const i=await Ro({payload:a,protected:r,signature:n},s,t),c={payload:i.payload,protectedHeader:i.protectedHeader};return typeof s=="function"?{...c,key:i.key}:c}const vo=e=>Math.floor(e.getTime()/1e3),Lr=60,Mr=Lr*60,Et=Mr*24,Ao=Et*7,Do=Et*365.25,Oo=/^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i,Ot=e=>{const s=Oo.exec(e);if(!s||s[4]&&s[1])throw new TypeError("Invalid time period format");const t=parseFloat(s[2]),r=s[3].toLowerCase();let a;switch(r){case"sec":case"secs":case"second":case"seconds":case"s":a=Math.round(t);break;case"minute":case"minutes":case"min":case"mins":case"m":a=Math.round(t*Lr);break;case"hour":case"hours":case"hr":case"hrs":case"h":a=Math.round(t*Mr);break;case"day":case"days":case"d":a=Math.round(t*Et);break;case"week":case"weeks":case"w":a=Math.round(t*Ao);break;default:a=Math.round(t*Do);break}return s[1]==="-"||s[4]==="ago"?-a:a},Ct=e=>e.toLowerCase().replace(/^application\//,""),Co=(e,s)=>typeof e=="string"?s.includes(e):Array.isArray(e)?s.some(Set.prototype.has.bind(new Set(e))):!1,ko=(e,s,t={})=>{let r;try{r=JSON.parse(Js.decode(s))}catch{}if(!Ae(r))throw new Rs("JWT Claims Set must be a top-level JSON object");const{typ:a}=t;if(a&&(typeof e.typ!="string"||Ct(e.typ)!==Ct(a)))throw new ie('unexpected "typ" JWT header value',r,"typ","check_failed");const{requiredClaims:n=[],issuer:o,subject:i,audience:c,maxTokenAge:u}=t,l=[...n];u!==void 0&&l.push("iat"),c!==void 0&&l.push("aud"),i!==void 0&&l.push("sub"),o!==void 0&&l.push("iss");for(const _ of new Set(l.reverse()))if(!(_ in r))throw new ie(`missing required "${_}" claim`,r,_,"missing");if(o&&!(Array.isArray(o)?o:[o]).includes(r.iss))throw new ie('unexpected "iss" claim value',r,"iss","check_failed");if(i&&r.sub!==i)throw new ie('unexpected "sub" claim value',r,"sub","check_failed");if(c&&!Co(r.aud,typeof c=="string"?[c]:c))throw new ie('unexpected "aud" claim value',r,"aud","check_failed");let d;switch(typeof t.clockTolerance){case"string":d=Ot(t.clockTolerance);break;case"number":d=t.clockTolerance;break;case"undefined":d=0;break;default:throw new TypeError("Invalid clockTolerance option type")}const{currentDate:f}=t,m=vo(f||new Date);if((r.iat!==void 0||u)&&typeof r.iat!="number")throw new ie('"iat" claim must be a number',r,"iat","invalid");if(r.nbf!==void 0){if(typeof r.nbf!="number")throw new ie('"nbf" claim must be a number',r,"nbf","invalid");if(r.nbf>m+d)throw new ie('"nbf" claim timestamp check failed',r,"nbf","check_failed")}if(r.exp!==void 0){if(typeof r.exp!="number")throw new ie('"exp" claim must be a number',r,"exp","invalid");if(r.exp<=m-d)throw new _s('"exp" claim timestamp check failed',r,"exp","check_failed")}if(u){const _=m-r.iat,h=typeof u=="number"?u:Ot(u);if(_-d>h)throw new _s('"iat" claim timestamp check failed (too far in the past)',r,"iat","check_failed");if(_<0-d)throw new ie('"iat" claim timestamp check failed (it should be in the past)',r,"iat","check_failed")}return r};async function No(e,s,t){var o;const r=await Io(e,s,t);if((o=r.protectedHeader.crit)!=null&&o.includes("b64")&&r.protectedHeader.b64===!1)throw new Rs("JWTs MUST NOT use unencoded payload");const n={payload:ko(r.protectedHeader,r.payload,t),protectedHeader:r.protectedHeader};return typeof s=="function"?{...n,key:r.key}:n}function jo(e){switch(typeof e=="string"&&e.slice(0,2)){case"RS":case"PS":return"RSA";case"ES":return"EC";case"Ed":return"OKP";default:throw new me('Unsupported "alg" value for a JSON Web Key Set')}}function Lo(e){return e&&typeof e=="object"&&Array.isArray(e.keys)&&e.keys.every(Mo)}function Mo(e){return Ae(e)}function Fr(e){return typeof structuredClone=="function"?structuredClone(e):JSON.parse(JSON.stringify(e))}class Fo{constructor(s){if(this._cached=new WeakMap,!Lo(s))throw new _t("JSON Web Key Set malformed");this._jwks=Fr(s)}async getKey(s,t){const{alg:r,kid:a}={...s,...t==null?void 0:t.header},n=jo(r),o=this._jwks.keys.filter(u=>{let l=n===u.kty;if(l&&typeof a=="string"&&(l=a===u.kid),l&&typeof u.alg=="string"&&(l=r===u.alg),l&&typeof u.use=="string"&&(l=u.use==="sig"),l&&Array.isArray(u.key_ops)&&(l=u.key_ops.includes("verify")),l)switch(r){case"ES256":l=u.crv==="P-256";break;case"ES256K":l=u.crv==="secp256k1";break;case"ES384":l=u.crv==="P-384";break;case"ES512":l=u.crv==="P-521";break;case"Ed25519":l=u.crv==="Ed25519";break;case"EdDSA":l=u.crv==="Ed25519"||u.crv==="Ed448";break}return l}),{0:i,length:c}=o;if(c===0)throw new ht;if(c!==1){const u=new xr,{_cached:l}=this;throw u[Symbol.asyncIterator]=async function*(){for(const d of o)try{yield await kt(l,d,r)}catch{}},u}return kt(this._cached,i,r)}}async function kt(e,s,t){const r=e.get(s)||e.set(s,{}).get(s);if(r[t]===void 0){const a=await Nr({...s,ext:!0},t);if(a instanceof Uint8Array||a.type!=="public")throw new _t("JSON Web Key Set members must be public keys");r[t]=a}return r[t]}function Nt(e){const s=new Fo(e),t=async(r,a)=>s.getKey(r,a);return Object.defineProperties(t,{jwks:{value:()=>Fr(s._jwks),enumerable:!0,configurable:!1,writable:!1}}),t}const $o=async(e,s,t)=>{let r,a,n=!1;typeof AbortController=="function"&&(r=new AbortController,a=setTimeout(()=>{n=!0,r.abort()},s));const o=await fetch(e.href,{signal:r?r.signal:void 0,redirect:"manual",headers:t.headers}).catch(i=>{throw n?new Rr:i});if(a!==void 0&&clearTimeout(a),o.status!==200)throw new X("Expected 200 OK from the JSON Web Key Set HTTP response");try{return await o.json()}catch{throw new X("Failed to parse the JSON Web Key Set HTTP response as JSON")}};function Uo(){return typeof WebSocketPair<"u"||typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"||typeof EdgeRuntime<"u"&&EdgeRuntime==="vercel"}let ot;var Cs,er;(typeof navigator>"u"||!((er=(Cs=navigator.userAgent)==null?void 0:Cs.startsWith)!=null&&er.call(Cs,"Mozilla/5.0 ")))&&(ot="jose/v5.10.0");const tt=Symbol();function Po(e,s){return!(typeof e!="object"||e===null||!("uat"in e)||typeof e.uat!="number"||Date.now()-e.uat>=s||!("jwks"in e)||!Ae(e.jwks)||!Array.isArray(e.jwks.keys)||!Array.prototype.every.call(e.jwks.keys,Ae))}class Wo{constructor(s,t){if(!(s instanceof URL))throw new TypeError("url must be an instance of URL");this._url=new URL(s.href),this._options={agent:t==null?void 0:t.agent,headers:t==null?void 0:t.headers},this._timeoutDuration=typeof(t==null?void 0:t.timeoutDuration)=="number"?t==null?void 0:t.timeoutDuration:5e3,this._cooldownDuration=typeof(t==null?void 0:t.cooldownDuration)=="number"?t==null?void 0:t.cooldownDuration:3e4,this._cacheMaxAge=typeof(t==null?void 0:t.cacheMaxAge)=="number"?t==null?void 0:t.cacheMaxAge:6e5,(t==null?void 0:t[tt])!==void 0&&(this._cache=t==null?void 0:t[tt],Po(t==null?void 0:t[tt],this._cacheMaxAge)&&(this._jwksTimestamp=this._cache.uat,this._local=Nt(this._cache.jwks)))}coolingDown(){return typeof this._jwksTimestamp=="number"?Date.now()<this._jwksTimestamp+this._cooldownDuration:!1}fresh(){return typeof this._jwksTimestamp=="number"?Date.now()<this._jwksTimestamp+this._cacheMaxAge:!1}async getKey(s,t){(!this._local||!this.fresh())&&await this.reload();try{return await this._local(s,t)}catch(r){if(r instanceof ht&&this.coolingDown()===!1)return await this.reload(),this._local(s,t);throw r}}async reload(){this._pendingFetch&&Uo()&&(this._pendingFetch=void 0);const s=new Headers(this._options.headers);ot&&!s.has("User-Agent")&&(s.set("User-Agent",ot),this._options.headers=Object.fromEntries(s.entries())),this._pendingFetch||(this._pendingFetch=$o(this._url,this._timeoutDuration,this._options).then(t=>{this._local=Nt(t),this._cache&&(this._cache.uat=Date.now(),this._cache.jwks=t),this._jwksTimestamp=Date.now(),this._pendingFetch=void 0}).catch(t=>{throw this._pendingFetch=void 0,t})),await this._pendingFetch}}function Ho(e,s){const t=new Wo(e,s),r=async(a,n)=>t.getKey(a,n);return Object.defineProperties(r,{coolingDown:{get:()=>t.coolingDown(),enumerable:!0,configurable:!1},fresh:{get:()=>t.fresh(),enumerable:!0,configurable:!1},reload:{value:()=>t.reload(),enumerable:!0,configurable:!1,writable:!1},reloading:{get:()=>!!t._pendingFetch,enumerable:!0,configurable:!1},jwks:{value:()=>{var a;return(a=t._local)==null?void 0:a.jwks()},enumerable:!0,configurable:!1,writable:!1}}),r}const qo="https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";let Ls=null;function Bo(){return Ls||(Ls=Ho(new URL(qo)),console.log("[Firebase Token] ✅ JWKS cache initialized")),Ls}function Ko(){Ls=null,console.warn("[Firebase Token] 🔄 JWKS cache invalidated")}async function $r(e,s){try{console.log("[Firebase Token] 🔍 Starting verification"),console.log("[Firebase Token] 📊 Token length:",e.length),console.log("[Firebase Token] 🏢 Project ID:",s);const t=Bo(),{payload:r}=await No(e,t,{issuer:`https://securetoken.google.com/${s}`,audience:s,algorithms:["RS256"]});if(console.log("[Firebase Token] ✅ JWT signature verified"),!r.sub)throw new Error("Token missing subject (uid)");const a=Math.floor(Date.now()/1e3);if(r.exp&&r.exp<a)throw console.error("[Firebase Token] ❌ Token expired:",{exp:r.exp,now:a,expiredBy:a-r.exp}),new _s("Token has expired");if(r.iat&&r.iat>a+300)throw console.error("[Firebase Token] ❌ Token issued in future:",{iat:r.iat,now:a,diff:r.iat-a}),new Error("Token not yet valid (issued in future)");console.log("[Firebase Token] ✅ Time validation passed:",{iat:r.iat,exp:r.exp,now:a});const n=r.sub,o=typeof r.role=="string"?r.role:void 0,i=typeof r.userId=="number"?r.userId:void 0,c=typeof r.userName=="string"?r.userName:void 0,u=typeof r.email=="string"?r.email:void 0;return console.log("[Firebase Token] ✅ Token verified successfully"),console.log("[Firebase Token] 👤 User:",{uid:n,role:o,userId:i,userName:c,email:u?"exists":"none"}),{...r,uid:n,role:o,userId:i,userName:c,email:u}}catch(t){throw console.error("[Firebase Token] ❌ Verification failed:",{error:t instanceof Error?t.message:"Unknown",name:t instanceof Error?t.name:void 0,tokenPreview:e.substring(0,30)+"..."}),t instanceof Rs&&t.message.includes("kid")&&(Ko(),console.warn("[Firebase Token] 🔄 JWKS cache invalidated → retry possible")),t}}function Ur(e){if(e instanceof _s)return{code:"TOKEN_EXPIRED",message:"Token has expired. Please login again."};if(e instanceof Rs){if(e.message.includes("issuer"))return{code:"INVALID_ISSUER",message:"Token issuer mismatch"};if(e.message.includes("audience"))return{code:"INVALID_AUDIENCE",message:"Token audience mismatch"};if(e.message.includes("signature"))return{code:"INVALID_SIGNATURE",message:"Invalid token signature"};if(e.message.includes("kid"))return{code:"INVALID_KID",message:"Public key not found for token"}}return e instanceof Error&&e.message.includes("not yet valid")?{code:"TOKEN_NOT_YET_VALID",message:"Token issued in the future"}:{code:"VERIFICATION_FAILED",message:e instanceof Error?e.message:"Token verification failed"}}var it=null;function Jo(e){try{return crypto.getRandomValues(new Uint8Array(e))}catch{}try{return ia.randomBytes(e)}catch{}if(!it)throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");return it(e)}function Vo(e){it=e}function gt(e,s){if(e=e||bt,typeof e!="number")throw Error("Illegal arguments: "+typeof e+", "+typeof s);e<4?e=4:e>31&&(e=31);var t=[];return t.push("$2b$"),e<10&&t.push("0"),t.push(e.toString()),t.push("$"),t.push(Ps(Jo(hs),hs)),t.join("")}function Pr(e,s,t){if(typeof s=="function"&&(t=s,s=void 0),typeof e=="function"&&(t=e,e=void 0),typeof e>"u")e=bt;else if(typeof e!="number")throw Error("illegal arguments: "+typeof e);function r(a){pe(function(){try{a(null,gt(e))}catch(n){a(n)}})}if(t){if(typeof t!="function")throw Error("Illegal callback: "+typeof t);r(t)}else return new Promise(function(a,n){r(function(o,i){if(o){n(o);return}a(i)})})}function Wr(e,s){if(typeof s>"u"&&(s=bt),typeof s=="number"&&(s=gt(s)),typeof e!="string"||typeof s!="string")throw Error("Illegal arguments: "+typeof e+", "+typeof s);return ct(e,s)}function Hr(e,s,t,r){function a(n){typeof e=="string"&&typeof s=="number"?Pr(s,function(o,i){ct(e,i,n,r)}):typeof e=="string"&&typeof s=="string"?ct(e,s,n,r):pe(n.bind(this,Error("Illegal arguments: "+typeof e+", "+typeof s)))}if(t){if(typeof t!="function")throw Error("Illegal callback: "+typeof t);a(t)}else return new Promise(function(n,o){a(function(i,c){if(i){o(i);return}n(c)})})}function qr(e,s){for(var t=e.length^s.length,r=0;r<e.length;++r)t|=e.charCodeAt(r)^s.charCodeAt(r);return t===0}function Yo(e,s){if(typeof e!="string"||typeof s!="string")throw Error("Illegal arguments: "+typeof e+", "+typeof s);return s.length!==60?!1:qr(Wr(e,s.substring(0,s.length-31)),s)}function zo(e,s,t,r){function a(n){if(typeof e!="string"||typeof s!="string"){pe(n.bind(this,Error("Illegal arguments: "+typeof e+", "+typeof s)));return}if(s.length!==60){pe(n.bind(this,null,!1));return}Hr(e,s.substring(0,29),function(o,i){o?n(o):n(null,qr(i,s))},r)}if(t){if(typeof t!="function")throw Error("Illegal callback: "+typeof t);a(t)}else return new Promise(function(n,o){a(function(i,c){if(i){o(i);return}n(c)})})}function Go(e){if(typeof e!="string")throw Error("Illegal arguments: "+typeof e);return parseInt(e.split("$")[2],10)}function Xo(e){if(typeof e!="string")throw Error("Illegal arguments: "+typeof e);if(e.length!==60)throw Error("Illegal hash length: "+e.length+" != 60");return e.substring(0,29)}function Qo(e){if(typeof e!="string")throw Error("Illegal arguments: "+typeof e);return Br(e)>72}var pe=typeof setImmediate=="function"?setImmediate:typeof scheduler=="object"&&typeof scheduler.postTask=="function"?scheduler.postTask.bind(scheduler):setTimeout;function Br(e){for(var s=0,t=0,r=0;r<e.length;++r)t=e.charCodeAt(r),t<128?s+=1:t<2048?s+=2:(t&64512)===55296&&(e.charCodeAt(r+1)&64512)===56320?(++r,s+=4):s+=3;return s}function Zo(e){for(var s=0,t,r,a=new Array(Br(e)),n=0,o=e.length;n<o;++n)t=e.charCodeAt(n),t<128?a[s++]=t:t<2048?(a[s++]=t>>6|192,a[s++]=t&63|128):(t&64512)===55296&&((r=e.charCodeAt(n+1))&64512)===56320?(t=65536+((t&1023)<<10)+(r&1023),++n,a[s++]=t>>18|240,a[s++]=t>>12&63|128,a[s++]=t>>6&63|128,a[s++]=t&63|128):(a[s++]=t>>12|224,a[s++]=t>>6&63|128,a[s++]=t&63|128);return a}var Je="./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""),Se=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,54,55,56,57,58,59,60,61,62,63,-1,-1,-1,-1,-1,-1,-1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,-1,-1,-1,-1,-1,-1,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,-1,-1,-1,-1,-1];function Ps(e,s){var t=0,r=[],a,n;if(s<=0||s>e.length)throw Error("Illegal len: "+s);for(;t<s;){if(a=e[t++]&255,r.push(Je[a>>2&63]),a=(a&3)<<4,t>=s){r.push(Je[a&63]);break}if(n=e[t++]&255,a|=n>>4&15,r.push(Je[a&63]),a=(n&15)<<2,t>=s){r.push(Je[a&63]);break}n=e[t++]&255,a|=n>>6&3,r.push(Je[a&63]),r.push(Je[n&63])}return r.join("")}function Kr(e,s){var t=0,r=e.length,a=0,n=[],o,i,c,u,l,d;if(s<=0)throw Error("Illegal len: "+s);for(;t<r-1&&a<s&&(d=e.charCodeAt(t++),o=d<Se.length?Se[d]:-1,d=e.charCodeAt(t++),i=d<Se.length?Se[d]:-1,!(o==-1||i==-1||(l=o<<2>>>0,l|=(i&48)>>4,n.push(String.fromCharCode(l)),++a>=s||t>=r)||(d=e.charCodeAt(t++),c=d<Se.length?Se[d]:-1,c==-1)||(l=(i&15)<<4>>>0,l|=(c&60)>>2,n.push(String.fromCharCode(l)),++a>=s||t>=r)));)d=e.charCodeAt(t++),u=d<Se.length?Se[d]:-1,l=(c&3)<<6>>>0,l|=u,n.push(String.fromCharCode(l)),++a;var f=[];for(t=0;t<a;t++)f.push(n[t].charCodeAt(0));return f}var hs=16,bt=10,ei=16,si=100,jt=[608135816,2242054355,320440878,57701188,2752067618,698298832,137296536,3964562569,1160258022,953160567,3193202383,887688300,3232508343,3380367581,1065670069,3041331479,2450970073,2306472731],Lt=[3509652390,2564797868,805139163,3491422135,3101798381,1780907670,3128725573,4046225305,614570311,3012652279,134345442,2240740374,1667834072,1901547113,2757295779,4103290238,227898511,1921955416,1904987480,2182433518,2069144605,3260701109,2620446009,720527379,3318853667,677414384,3393288472,3101374703,2390351024,1614419982,1822297739,2954791486,3608508353,3174124327,2024746970,1432378464,3864339955,2857741204,1464375394,1676153920,1439316330,715854006,3033291828,289532110,2706671279,2087905683,3018724369,1668267050,732546397,1947742710,3462151702,2609353502,2950085171,1814351708,2050118529,680887927,999245976,1800124847,3300911131,1713906067,1641548236,4213287313,1216130144,1575780402,4018429277,3917837745,3693486850,3949271944,596196993,3549867205,258830323,2213823033,772490370,2760122372,1774776394,2652871518,566650946,4142492826,1728879713,2882767088,1783734482,3629395816,2517608232,2874225571,1861159788,326777828,3124490320,2130389656,2716951837,967770486,1724537150,2185432712,2364442137,1164943284,2105845187,998989502,3765401048,2244026483,1075463327,1455516326,1322494562,910128902,469688178,1117454909,936433444,3490320968,3675253459,1240580251,122909385,2157517691,634681816,4142456567,3825094682,3061402683,2540495037,79693498,3249098678,1084186820,1583128258,426386531,1761308591,1047286709,322548459,995290223,1845252383,2603652396,3431023940,2942221577,3202600964,3727903485,1712269319,422464435,3234572375,1170764815,3523960633,3117677531,1434042557,442511882,3600875718,1076654713,1738483198,4213154764,2393238008,3677496056,1014306527,4251020053,793779912,2902807211,842905082,4246964064,1395751752,1040244610,2656851899,3396308128,445077038,3742853595,3577915638,679411651,2892444358,2354009459,1767581616,3150600392,3791627101,3102740896,284835224,4246832056,1258075500,768725851,2589189241,3069724005,3532540348,1274779536,3789419226,2764799539,1660621633,3471099624,4011903706,913787905,3497959166,737222580,2514213453,2928710040,3937242737,1804850592,3499020752,2949064160,2386320175,2390070455,2415321851,4061277028,2290661394,2416832540,1336762016,1754252060,3520065937,3014181293,791618072,3188594551,3933548030,2332172193,3852520463,3043980520,413987798,3465142937,3030929376,4245938359,2093235073,3534596313,375366246,2157278981,2479649556,555357303,3870105701,2008414854,3344188149,4221384143,3956125452,2067696032,3594591187,2921233993,2428461,544322398,577241275,1471733935,610547355,4027169054,1432588573,1507829418,2025931657,3646575487,545086370,48609733,2200306550,1653985193,298326376,1316178497,3007786442,2064951626,458293330,2589141269,3591329599,3164325604,727753846,2179363840,146436021,1461446943,4069977195,705550613,3059967265,3887724982,4281599278,3313849956,1404054877,2845806497,146425753,1854211946,1266315497,3048417604,3681880366,3289982499,290971e4,1235738493,2632868024,2414719590,3970600049,1771706367,1449415276,3266420449,422970021,1963543593,2690192192,3826793022,1062508698,1531092325,1804592342,2583117782,2714934279,4024971509,1294809318,4028980673,1289560198,2221992742,1669523910,35572830,157838143,1052438473,1016535060,1802137761,1753167236,1386275462,3080475397,2857371447,1040679964,2145300060,2390574316,1461121720,2956646967,4031777805,4028374788,33600511,2920084762,1018524850,629373528,3691585981,3515945977,2091462646,2486323059,586499841,988145025,935516892,3367335476,2599673255,2839830854,265290510,3972581182,2759138881,3795373465,1005194799,847297441,406762289,1314163512,1332590856,1866599683,4127851711,750260880,613907577,1450815602,3165620655,3734664991,3650291728,3012275730,3704569646,1427272223,778793252,1343938022,2676280711,2052605720,1946737175,3164576444,3914038668,3967478842,3682934266,1661551462,3294938066,4011595847,840292616,3712170807,616741398,312560963,711312465,1351876610,322626781,1910503582,271666773,2175563734,1594956187,70604529,3617834859,1007753275,1495573769,4069517037,2549218298,2663038764,504708206,2263041392,3941167025,2249088522,1514023603,1998579484,1312622330,694541497,2582060303,2151582166,1382467621,776784248,2618340202,3323268794,2497899128,2784771155,503983604,4076293799,907881277,423175695,432175456,1378068232,4145222326,3954048622,3938656102,3820766613,2793130115,2977904593,26017576,3274890735,3194772133,1700274565,1756076034,4006520079,3677328699,720338349,1533947780,354530856,688349552,3973924725,1637815568,332179504,3949051286,53804574,2852348879,3044236432,1282449977,3583942155,3416972820,4006381244,1617046695,2628476075,3002303598,1686838959,431878346,2686675385,1700445008,1080580658,1009431731,832498133,3223435511,2605976345,2271191193,2516031870,1648197032,4164389018,2548247927,300782431,375919233,238389289,3353747414,2531188641,2019080857,1475708069,455242339,2609103871,448939670,3451063019,1395535956,2413381860,1841049896,1491858159,885456874,4264095073,4001119347,1565136089,3898914787,1108368660,540939232,1173283510,2745871338,3681308437,4207628240,3343053890,4016749493,1699691293,1103962373,3625875870,2256883143,3830138730,1031889488,3479347698,1535977030,4236805024,3251091107,2132092099,1774941330,1199868427,1452454533,157007616,2904115357,342012276,595725824,1480756522,206960106,497939518,591360097,863170706,2375253569,3596610801,1814182875,2094937945,3421402208,1082520231,3463918190,2785509508,435703966,3908032597,1641649973,2842273706,3305899714,1510255612,2148256476,2655287854,3276092548,4258621189,236887753,3681803219,274041037,1734335097,3815195456,3317970021,1899903192,1026095262,4050517792,356393447,2410691914,3873677099,3682840055,3913112168,2491498743,4132185628,2489919796,1091903735,1979897079,3170134830,3567386728,3557303409,857797738,1136121015,1342202287,507115054,2535736646,337727348,3213592640,1301675037,2528481711,1895095763,1721773893,3216771564,62756741,2142006736,835421444,2531993523,1442658625,3659876326,2882144922,676362277,1392781812,170690266,3921047035,1759253602,3611846912,1745797284,664899054,1329594018,3901205900,3045908486,2062866102,2865634940,3543621612,3464012697,1080764994,553557557,3656615353,3996768171,991055499,499776247,1265440854,648242737,3940784050,980351604,3713745714,1749149687,3396870395,4211799374,3640570775,1161844396,3125318951,1431517754,545492359,4268468663,3499529547,1437099964,2702547544,3433638243,2581715763,2787789398,1060185593,1593081372,2418618748,4260947970,69676912,2159744348,86519011,2512459080,3838209314,1220612927,3339683548,133810670,1090789135,1078426020,1569222167,845107691,3583754449,4072456591,1091646820,628848692,1613405280,3757631651,526609435,236106946,48312990,2942717905,3402727701,1797494240,859738849,992217954,4005476642,2243076622,3870952857,3732016268,765654824,3490871365,2511836413,1685915746,3888969200,1414112111,2273134842,3281911079,4080962846,172450625,2569994100,980381355,4109958455,2819808352,2716589560,2568741196,3681446669,3329971472,1835478071,660984891,3704678404,4045999559,3422617507,3040415634,1762651403,1719377915,3470491036,2693910283,3642056355,3138596744,1364962596,2073328063,1983633131,926494387,3423689081,2150032023,4096667949,1749200295,3328846651,309677260,2016342300,1779581495,3079819751,111262694,1274766160,443224088,298511866,1025883608,3806446537,1145181785,168956806,3641502830,3584813610,1689216846,3666258015,3200248200,1692713982,2646376535,4042768518,1618508792,1610833997,3523052358,4130873264,2001055236,3610705100,2202168115,4028541809,2961195399,1006657119,2006996926,3186142756,1430667929,3210227297,1314452623,4074634658,4101304120,2273951170,1399257539,3367210612,3027628629,1190975929,2062231137,2333990788,2221543033,2438960610,1181637006,548689776,2362791313,3372408396,3104550113,3145860560,296247880,1970579870,3078560182,3769228297,1714227617,3291629107,3898220290,166772364,1251581989,493813264,448347421,195405023,2709975567,677966185,3703036547,1463355134,2715995803,1338867538,1343315457,2802222074,2684532164,233230375,2599980071,2000651841,3277868038,1638401717,4028070440,3237316320,6314154,819756386,300326615,590932579,1405279636,3267499572,3150704214,2428286686,3959192993,3461946742,1862657033,1266418056,963775037,2089974820,2263052895,1917689273,448879540,3550394620,3981727096,150775221,3627908307,1303187396,508620638,2975983352,2726630617,1817252668,1876281319,1457606340,908771278,3720792119,3617206836,2455994898,1729034894,1080033504,976866871,3556439503,2881648439,1522871579,1555064734,1336096578,3548522304,2579274686,3574697629,3205460757,3593280638,3338716283,3079412587,564236357,2993598910,1781952180,1464380207,3163844217,3332601554,1699332808,1393555694,1183702653,3581086237,1288719814,691649499,2847557200,2895455976,3193889540,2717570544,1781354906,1676643554,2592534050,3230253752,1126444790,2770207658,2633158820,2210423226,2615765581,2414155088,3127139286,673620729,2805611233,1269405062,4015350505,3341807571,4149409754,1057255273,2012875353,2162469141,2276492801,2601117357,993977747,3918593370,2654263191,753973209,36408145,2530585658,25011837,3520020182,2088578344,530523599,2918365339,1524020338,1518925132,3760827505,3759777254,1202760957,3985898139,3906192525,674977740,4174734889,2031300136,2019492241,3983892565,4153806404,3822280332,352677332,2297720250,60907813,90501309,3286998549,1016092578,2535922412,2839152426,457141659,509813237,4120667899,652014361,1966332200,2975202805,55981186,2327461051,676427537,3255491064,2882294119,3433927263,1307055953,942726286,933058658,2468411793,3933900994,4215176142,1361170020,2001714738,2830558078,3274259782,1222529897,1679025792,2729314320,3714953764,1770335741,151462246,3013232138,1682292957,1483529935,471910574,1539241949,458788160,3436315007,1807016891,3718408830,978976581,1043663428,3165965781,1927990952,4200891579,2372276910,3208408903,3533431907,1412390302,2931980059,4132332400,1947078029,3881505623,4168226417,2941484381,1077988104,1320477388,886195818,18198404,3786409e3,2509781533,112762804,3463356488,1866414978,891333506,18488651,661792760,1628790961,3885187036,3141171499,876946877,2693282273,1372485963,791857591,2686433993,3759982718,3167212022,3472953795,2716379847,445679433,3561995674,3504004811,3574258232,54117162,3331405415,2381918588,3769707343,4154350007,1140177722,4074052095,668550556,3214352940,367459370,261225585,2610173221,4209349473,3468074219,3265815641,314222801,3066103646,3808782860,282218597,3406013506,3773591054,379116347,1285071038,846784868,2669647154,3771962079,3550491691,2305946142,453669953,1268987020,3317592352,3279303384,3744833421,2610507566,3859509063,266596637,3847019092,517658769,3462560207,3443424879,370717030,4247526661,2224018117,4143653529,4112773975,2788324899,2477274417,1456262402,2901442914,1517677493,1846949527,2295493580,3734397586,2176403920,1280348187,1908823572,3871786941,846861322,1172426758,3287448474,3383383037,1655181056,3139813346,901632758,1897031941,2986607138,3066810236,3447102507,1393639104,373351379,950779232,625454576,3124240540,4148612726,2007998917,544563296,2244738638,2330496472,2058025392,1291430526,424198748,50039436,29584100,3605783033,2429876329,2791104160,1057563949,3255363231,3075367218,3463963227,1469046755,985887462],Jr=[1332899944,1700884034,1701343084,1684370003,1668446532,1869963892];function Es(e,s,t,r){var a,n=e[s],o=e[s+1];return n^=t[0],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^t[1],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^t[2],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^t[3],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^t[4],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^t[5],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^t[6],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^t[7],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^t[8],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^t[9],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^t[10],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^t[11],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^t[12],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^t[13],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^t[14],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^t[15],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^t[16],e[s]=o^t[ei+1],e[s+1]=n,e}function Xe(e,s){for(var t=0,r=0;t<4;++t)r=r<<8|e[s]&255,s=(s+1)%e.length;return{key:r,offp:s}}function Mt(e,s,t){for(var r=0,a=[0,0],n=s.length,o=t.length,i,c=0;c<n;c++)i=Xe(e,r),r=i.offp,s[c]=s[c]^i.key;for(c=0;c<n;c+=2)a=Es(a,0,s,t),s[c]=a[0],s[c+1]=a[1];for(c=0;c<o;c+=2)a=Es(a,0,s,t),t[c]=a[0],t[c+1]=a[1]}function ti(e,s,t,r){for(var a=0,n=[0,0],o=t.length,i=r.length,c,u=0;u<o;u++)c=Xe(s,a),a=c.offp,t[u]=t[u]^c.key;for(a=0,u=0;u<o;u+=2)c=Xe(e,a),a=c.offp,n[0]^=c.key,c=Xe(e,a),a=c.offp,n[1]^=c.key,n=Es(n,0,t,r),t[u]=n[0],t[u+1]=n[1];for(u=0;u<i;u+=2)c=Xe(e,a),a=c.offp,n[0]^=c.key,c=Xe(e,a),a=c.offp,n[1]^=c.key,n=Es(n,0,t,r),r[u]=n[0],r[u+1]=n[1]}function Ft(e,s,t,r,a){var n=Jr.slice(),o=n.length,i;if(t<4||t>31)if(i=Error("Illegal number of rounds (4-31): "+t),r){pe(r.bind(this,i));return}else throw i;if(s.length!==hs)if(i=Error("Illegal salt length: "+s.length+" != "+hs),r){pe(r.bind(this,i));return}else throw i;t=1<<t>>>0;var c,u,l=0,d;typeof Int32Array=="function"?(c=new Int32Array(jt),u=new Int32Array(Lt)):(c=jt.slice(),u=Lt.slice()),ti(s,e,c,u);function f(){if(a&&a(l/t),l<t)for(var _=Date.now();l<t&&(l=l+1,Mt(e,c,u),Mt(s,c,u),!(Date.now()-_>si)););else{for(l=0;l<64;l++)for(d=0;d<o>>1;d++)Es(n,d<<1,c,u);var h=[];for(l=0;l<o;l++)h.push((n[l]>>24&255)>>>0),h.push((n[l]>>16&255)>>>0),h.push((n[l]>>8&255)>>>0),h.push((n[l]&255)>>>0);if(r){r(null,h);return}else return h}r&&pe(f)}if(typeof r<"u")f();else for(var m;;)if(typeof(m=f())<"u")return m||[]}function ct(e,s,t,r){var a;if(typeof e!="string"||typeof s!="string")if(a=Error("Invalid string / salt: Not a string"),t){pe(t.bind(this,a));return}else throw a;var n,o;if(s.charAt(0)!=="$"||s.charAt(1)!=="2")if(a=Error("Invalid salt version: "+s.substring(0,2)),t){pe(t.bind(this,a));return}else throw a;if(s.charAt(2)==="$")n="\0",o=3;else{if(n=s.charAt(2),n!=="a"&&n!=="b"&&n!=="y"||s.charAt(3)!=="$")if(a=Error("Invalid salt revision: "+s.substring(2,4)),t){pe(t.bind(this,a));return}else throw a;o=4}if(s.charAt(o+2)>"$")if(a=Error("Missing salt rounds"),t){pe(t.bind(this,a));return}else throw a;var i=parseInt(s.substring(o,o+1),10)*10,c=parseInt(s.substring(o+1,o+2),10),u=i+c,l=s.substring(o+3,o+25);e+=n>="a"?"\0":"";var d=Zo(e),f=Kr(l,hs);function m(_){var h=[];return h.push("$2"),n>="a"&&h.push(n),h.push("$"),u<10&&h.push("0"),h.push(u.toString()),h.push("$"),h.push(Ps(f,f.length)),h.push(Ps(_,Jr.length*4-1)),h.join("")}if(typeof t>"u")return m(Ft(d,f,u));Ft(d,f,u,function(_,h){_?t(_,null):t(null,m(h))},r)}function ri(e,s){return Ps(e,s)}function ai(e,s){return Kr(e,s)}const Vr={setRandomFallback:Vo,genSaltSync:gt,genSalt:Pr,hashSync:Wr,hash:Hr,compareSync:Yo,compare:zo,getRounds:Go,getSalt:Xo,truncates:Qo,encodeBase64:ri,decodeBase64:ai},yt=e=>e.JWT_SECRET||"default-jwt-secret-change-in-production-12345678901234567890";async function Yr(e,s){const t={alg:"HS256",typ:"JWT"},r=Math.floor(Date.now()/1e3),a={...e,iat:r,exp:r+720*60*60},n=m=>{const _=JSON.stringify(m);return btoa(_).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")},o=n(t),i=n(a),c=`${o}.${i}`,u=new TextEncoder,l=await crypto.subtle.importKey("raw",u.encode(s),{name:"HMAC",hash:"SHA-256"},!1,["sign"]),d=await crypto.subtle.sign("HMAC",l,u.encode(c)),f=btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");return`${c}.${f}`}async function ni(e,s){try{const t=e.split(".");if(t.length!==3)return null;const[r,a,n]=t,o=`${r}.${a}`,i=new TextEncoder,c=await crypto.subtle.importKey("raw",i.encode(s),{name:"HMAC",hash:"SHA-256"},!1,["sign","verify"]),u=await crypto.subtle.sign("HMAC",c,i.encode(o)),l=btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");if(n!==l)return console.warn("[JWT] Invalid signature"),null;const f=(_=>{_=_.replace(/-/g,"+").replace(/_/g,"/");const h=_.length%4;return h&&(_+="=".repeat(4-h)),JSON.parse(atob(_))})(a),m=Math.floor(Date.now()/1e3);return f.exp&&f.exp<m?(console.warn("[JWT] Token expired"),null):f}catch(t){return console.error("[JWT] Verification error:",t),null}}async function oi(e){return await Vr.hash(e,10)}async function zr(e,s){return await Vr.compare(e,s)}const _e=new Map;let Y={hits:0,misses:0,writes:0,evictions:0};function we(e){const s=_e.get(e);return s?s.expires<Date.now()?(_e.delete(e),Y.evictions++,Y.misses++,null):(Y.hits++,s.data):(Y.misses++,null)}function Q(e,s,t){const r=Date.now()+t*1e3;if(_e.set(e,{data:s,expires:r}),Y.writes++,_e.size>1e3){const a=_e.keys().next().value;a&&(_e.delete(a),Y.evictions++)}}function ii(e){let s=0;for(const t of _e.keys())t.includes(e)&&(_e.delete(t),s++);return s}async function is(e,s){const t=Array.isArray(s)?s:[s];for(const r of t){const a=ii(r);a>0&&console.log(`[Cache] 🧹 메모리 캐시 삭제: ${r} (${a}개)`);try{await e.CACHE_KV.delete(r),console.log(`[Cache] 🧹 KV 캐시 삭제: ${r}`)}catch(n){console.error(`[Cache] ❌ KV 캐시 삭제 실패: ${r}`,n)}}}const cs={LIVE_STREAMS:["streams:live","streams:all","streams:scheduled","live_streams:live:all:20:0","live_streams:"],PRODUCTS:["products:","featured_products"],CART:e=>[`cart:${e}`],ORDERS:e=>[`orders:${e}`],ALL:["streams:","live_streams:","products:","cart:","orders:"]};function ci(e){const s=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:s,message:"API Request",context:e,duration:e.duration}))}function ui(e){return{name:"tosspayments",async confirmPayment(s){try{const t=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:s.paymentKey,orderId:s.orderId,amount:s.amount})}),r=await t.json();if(!t.ok)return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:r.message||"결제 승인 실패",rawData:r};let a={};r.card&&(a={cardCompany:r.card.company,cardNumber:r.card.number,installmentMonths:r.card.installmentPlanMonths||0});let n={};return r.virtualAccount&&(n={virtualAccountBank:r.virtualAccount.bankCode,virtualAccountNumber:r.virtualAccount.accountNumber,virtualAccountHolder:r.virtualAccount.customerName,virtualAccountDueDate:r.virtualAccount.dueDate}),{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,transactionId:r.transactionKey,...a,...n,rawData:r}}catch(t){return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:t.message,rawData:null}}},async cancelPayment(s){try{const t={cancelReason:s.cancelReason};s.cancelAmount&&(t.cancelAmount=s.cancelAmount);const r=await fetch(`https://api.tosspayments.com/v1/payments/${s.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(t)}),a=await r.json();return r.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(t){return{success:!1,error:t.message}}},async getPayment(s){try{const t=await fetch(`https://api.tosspayments.com/v1/payments/${s}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),r=await t.json();if(!t.ok)throw new Error(r.message);return{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,rawData:r}}catch(t){throw t}}}}function li(e,s){switch(e.toLowerCase()){case"tosspayments":return ui(s);default:throw new Error(`Unknown payment provider: ${e}`)}}const p=new hr;p.use("*",async(e,s)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{Ka(e.env),Ja(e.env)}catch(r){console.error("[ENV] Validation failed:",r)}await s()});async function di(e){try{const s=e.req.header("Authorization");console.log("[Firebase Auth] 🔍 Authorization header:",s?`Bearer ${s.substring(7,50)}...`:"MISSING");const t=(s==null?void 0:s.replace("Bearer ",""))||"";if(!t)return console.warn("[Firebase Auth] ❌ No token provided"),null;console.log("[Firebase Auth] 🔑 Token length:",t.length),console.log("[Firebase Auth] 🔑 Token preview:",t.substring(0,50)+"...");try{const r=t.split(".");if(r.length===3){const a=r[1],n=atob(a.replace(/-/g,"+").replace(/_/g,"/")),o=JSON.parse(n);if(console.log("[Firebase Auth] 🔍 Token Payload (BEFORE verification):",{iss:o.iss,aud:o.aud,sub:o.sub,exp:o.exp,iat:o.iat}),o.iss&&o.iss.includes("iam.gserviceaccount.com"))return console.error("[Firebase Auth] 🚨🚨🚨 CUSTOM TOKEN DETECTED! 🚨🚨🚨"),console.error("[Firebase Auth] ❌ This is a Custom Token, not an ID Token!"),console.error("[Firebase Auth] ❌ Custom Token should be exchanged for ID Token on client!"),{userId:0,userType:"",errorDetails:{code:"CUSTOM_TOKEN_DETECTED",message:"Custom Token should be exchanged for ID Token on client",tokenInfo:{iss:o.iss,aud:o.aud,sub:o.sub}}}}}catch(r){console.warn("[Firebase Auth] ⚠️ Could not decode token payload (might be corrupted):",r)}try{console.log("[Firebase Auth] 🔐 Verifying token with project:",e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284");const r=await $r(t,e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284");if(console.log("[Firebase Auth] ✅ Firebase token verified!"),console.log("[Firebase Auth] 📋 Token payload:",{uid:r.uid,iss:r.iss,aud:r.aud,exp:r.exp,iat:r.iat}),r.userId){console.log("[Firebase Auth] 🎯 Using userId from Custom Claims:",r.userId);const o=await e.env.DB.prepare(`
          SELECT id, email, name, firebase_uid FROM users WHERE id = ?
        `).bind(r.userId).first();if(o){if(!o.firebase_uid)try{await e.env.DB.prepare(`
                UPDATE users SET firebase_uid = ? WHERE id = ?
              `).bind(r.uid,o.id).run(),console.log("[Firebase Auth] ✅ firebase_uid updated via Custom Claims:",o.id)}catch(c){console.warn("[Firebase Auth] ⚠️ firebase_uid update failed:",c)}const i=r.role||"user";return console.log("[Firebase Auth] ✅ User authenticated via Custom Claims"),{userId:o.id,userType:i,email:o.email,firebaseUID:r.uid}}}let a=await e.env.DB.prepare(`
        SELECT id, email, name, firebase_uid FROM users WHERE firebase_uid = ?
      `).bind(r.uid).first();if(!a&&r.uid.startsWith("kakao_")){const o=r.uid.replace("kakao_","");if(console.warn("[Firebase Auth] firebase_uid not found, trying kakao_id fallback:",o),a=await e.env.DB.prepare(`
          SELECT id, email, name, firebase_uid FROM users 
          WHERE kakao_id = ? AND firebase_uid IS NULL
        `).bind(o).first(),a){console.log("[Firebase Auth] ✅ Found user via kakao_id fallback:",a.id);try{await e.env.DB.prepare(`
              UPDATE users SET firebase_uid = ? WHERE id = ?
            `).bind(r.uid,a.id).run(),console.log("[Firebase Auth] ✅ firebase_uid updated for existing user:",a.id)}catch(i){console.error("[Firebase Auth] ❌ firebase_uid update failed:",i)}}}if(!a)return console.warn("[Firebase Auth] User not found for UID:",r.uid),{userId:0,userType:"",errorDetails:{code:"USER_NOT_FOUND",message:"User not found in database",tokenInfo:{uid:r.uid}}};const n=r.role||"user";return console.log("[Firebase Auth] ✅ User authenticated:",{userId:a.id,userType:n,email:a.email,firebaseUID:r.uid}),{userId:a.id,userType:n,email:a.email,firebaseUID:r.uid}}catch(r){console.error("[Firebase Auth] Token verification failed:",r);const a=Ur(r);return{userId:0,userType:"",errorDetails:{code:a.code,message:a.message,tokenInfo:{length:t.length,preview:t.substring(0,30)+"..."}}}}}catch(s){return console.error("[Firebase Auth Error]",s),null}}async function We(e,s,t){if(!s)return null;const r=`session:${s}`;try{const a=we(r);if(a)return a;const n=await e.get(r);if(!n)return null;const o=JSON.parse(n);if(o.expires_at&&Date.now()>o.expires_at)return t!=null&&t.executionCtx||await e.delete(r),null;const i={user_id:o.user_id,user_type:o.user_type||"user",created_at:o.created_at};return Q(r,i,900),i}catch(a){return console.error("[Auth] Session lookup error:",a),null}}async function k(e,s){const t=e.req.header("Authorization");if(console.log("[requireAuth] 🔍 Header check:",t?"EXISTS":"MISSING"),!t)return e.json({success:!1,error:"Missing Authorization header",code:"NO_AUTH_HEADER"},401);const r=t.replace("Bearer ",""),a=yt(e.env),n=await ni(r,a);if(n){console.log("[requireAuth] ✅ JWT verified:",n.type,n.email),e.set("user",{userId:n.id,userType:n.type,email:n.email,name:n.name}),e.set("userId",n.id),e.set("userType",n.type),e.set("email",n.email),await s();return}const o=await di(e);if(!o||o.userId===0){const i=(o==null?void 0:o.errorDetails)||{code:"AUTH_FAILED",message:"Token verification failed - not a valid JWT or Firebase token"};return e.json({success:!1,error:i.message,code:i.code},401)}console.log("[requireAuth] ✅ Firebase verified:",o.userType,o.email),e.set("user",{userId:o.userId,userType:o.userType,email:o.email,firebaseUID:o.firebaseUID}),e.set("userId",o.userId),e.set("userType",o.userType),e.set("email",o.email),e.set("firebaseUID",o.firebaseUID),await s()}async function pi(e,s){const t=e.get("userType"),r=e.get("userId");if(t!=="admin")return console.warn("[Security] Unauthorized admin access attempt:",{userId:r,userType:t}),e.json({success:!1,error:"관리자 권한이 필요합니다."},403);await s()}async function fi(e,s){const t=e.get("userType"),r=e.get("userId");if(t!=="seller")return console.warn("[Security] Unauthorized seller access attempt:",{userId:r,userType:t}),e.json({success:!1,error:"판매자 권한이 필요합니다."},403);await s()}async function mi(e){return async(s,t)=>{const r=s.get("userId");if(s.get("userType")==="admin"){await t();return}const n=s.req.param("userId");if(n&&n!==String(r))return console.warn("[Security] Unauthorized resource access attempt:",{resourceType:e,requestedUserId:n,actualUserId:r}),s.json({success:!1,error:"본인의 정보만 조회할 수 있습니다."},403);await t()}}async function _i(e,s){try{const t=we(s);if(t!==null)return t;const r=await e.get(s);if(r){const a=JSON.parse(r);return Q(s,a,300),a}return null}catch(t){return console.error("[Cache] Read error:",t),null}}async function gs(e,s,t,r=60,a=!1){try{Q(s,t,r),a?(await e.put(s,JSON.stringify(t),{expirationTtl:r}),console.log(`[Cache] ✅ Saved to both Memory + KV: ${s}`)):console.log(`[Cache] ✅ Saved to Memory only (KV Write skipped): ${s}`)}catch(n){console.error("[Cache] Write error:",n)}}async function Is(e,...s){try{await Promise.all(s.map(t=>e.delete(t)))}catch(t){console.error("[Cache] Delete error:",t)}}async function vs(e,s,t,r,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s,t,r,a,n,o||null).run(),console.log(`[Notification] Created for ${t} ${s}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function hi(e,s,t,r,a){await vs(e,s,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${r}님의 주문 (${t}) - ${Ei(a)}`,"/seller/orders")}async function Gr(e,s,t,r,a,n){let o="",i="";switch(r){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${t}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${t}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${t}가 배송 완료되었습니다`;break;default:return}await vs(e,s,"user","shipping_status",o,i,"/my-orders")}async function Xr(e,s,t,r,a){await vs(e,s,"seller","low_stock","⚠️ 재고 부족 알림",`${t}의 재고가 ${r}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function Ei(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function gi(e,s,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:s,description:t,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!r.ok){const d=await r.text();throw new Error(`YouTube Broadcast 생성 실패: ${d}`)}const n=(await r.json()).id,o=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${s} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!o.ok){const d=await o.text();throw new Error(`YouTube Stream 생성 실패: ${d}`)}const i=await o.json(),c=i.id,u=i.cdn.ingestionInfo.streamName,l=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:n,streamId:c,streamKey:u,streamUrl:l}}catch(r){throw console.error("[YouTube API] Live broadcast creation failed:",r),r}}async function bi(e,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const t=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${s}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!t.ok){const r=await t.text();throw new Error(`YouTube 방송 종료 실패: ${r}`)}}catch(t){throw console.error("[YouTube API] Live broadcast end failed:",t),t}}async function yi(e,s,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let r=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${s}&part=snippet,authorDetails`;t&&(r+=`&pageToken=${t}`);const a=await fetch(r,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const o=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${o}`)}const n=await a.json();return{messages:n.items||[],nextPageToken:n.nextPageToken,pollingIntervalMillis:n.pollingIntervalMillis||5e3}}catch(r){throw console.error("[YouTube API] Get chat messages failed:",r),r}}async function wi(e,s){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const t=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},r=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}&key=${e.apiKey}`,a=await fetch(r,{headers:t});if(!a.ok){const u=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${u}`)}const n=await a.json();if(!n.items||n.items.length===0)throw new Error("Video not found");const o=n.items[0],i=o.statistics,c=o.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(t){throw console.error("[YouTube API] Get live stats failed:",t),t}}function Qr(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const s=new URL(e);if(s.hostname.includes("youtube.com")){const t=s.searchParams.get("v");if(t)return t;const r=s.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(r)return r[2]}if(s.hostname==="youtu.be"){const t=s.pathname.slice(1).split("?")[0];if(t&&t.length===11)return t}return null}catch{return null}}function Zr(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const t=s.pathname.match(/\/video\/(\d+)/);if(t)return t[1];const r=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}function Si(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){if(s.pathname.includes("/live"))return"live";if(s.pathname.includes("/video/"))return"video"}return null}catch{return null}}function ea(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const t=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(t)return t[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}p.use("*",async(e,s)=>{await s(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const t=new URL(e.req.url);t.hostname!=="localhost"&&t.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",S());p.use(Ue(Pe.auth));p.use(Ue(Pe.alimtalk));p.use(Ue(Pe.order));p.use(Ue(Pe.refund));p.use(Ue(Pe.cart));p.use(Ue(Pe.upload));p.use("/api/*",Ue(Pe.api));p.use("*",async(e,s)=>{await s(),e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"),e.header("X-Frame-Options","DENY"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",async(e,s)=>{const t=Date.now(),r=e.req.method,a=e.req.path;await s();const n=Date.now()-t,o=e.res.status,i={method:r,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),ci(i)});p.use("/static/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/images/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/api/admin*",async(e,s)=>{if(e.req.path==="/api/admin/login")return s();const t=await k(e,()=>Promise.resolve());if(t)return t;const r=await pi(e,()=>Promise.resolve());return r||s()});p.use("/api/seller*",async(e,s)=>{if(e.req.path==="/api/seller/register")return s();const t=await k(e,()=>Promise.resolve());if(t)return t;const r=await fi(e,()=>Promise.resolve());return r||s()});async function us(e,s){const t=await e.get(`session:${s}`);if(!t)return null;const r=JSON.parse(t);return r.expires_at&&Date.now()>r.expires_at?(await e.delete(`session:${s}`),null):{session_token:s,[`${r.user_type}_id`]:r.user_id,user_type:r.user_type,...r.userData}}p.post("/api/auth/user/register",S(),pn(En),async e=>{const{DB:s}=e.env;try{const{email:t,password:r,name:a,phone:n}=e.get("validatedData"),o=`placeholder_hash_for_${r}`;try{const c=(await s.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(t,o,a,n||null).run()).meta.last_row_id,u=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:u,user:{id:c,email:t,name:a,phone:n}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(t){return console.error("[User Register] Error:",t),e.json({success:!1,error:t.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/auth/user/login",S(),async e=>{const{DB:s,SESSION_KV:t}=e.env;try{const{email:r,password:a}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await s.prepare(`
      SELECT id, email, name, kakao_id, password_hash, password, created_at
      FROM users 
      WHERE email = ?
    `).bind(r).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${a}`)||n.password&&n.password===a))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await s.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();const i=crypto.randomUUID(),c=Date.now()+720*60*60*1e3;return await t.put(`session:${i}`,JSON.stringify({user_id:n.id,user_type:"user",expires_at:c,created_at:Date.now()}),{expirationTtl:720*60*60}),console.log("[User Login] Session created in SESSION_KV for user:",n.id),e.json({success:!0,data:{session_token:i,user:{id:n.id,email:n.email,name:n.name,phone:n.phone,profile_image:n.profile_image}}})}catch(r){return console.error("[User Login] Error:",r),e.json({success:!1,error:r.message||"로그인 중 오류가 발생했습니다"},500)}});p.post("/api/auth/login",S(),async e=>e.json({success:!1,error:"This endpoint is deprecated. Please use Firebase Authentication.",message:"Admin/Seller login should use /api/admin/login or /api/seller/login with Firebase Auth",code:"DEPRECATED_ENDPOINT"},410));p.post("/api/auth/logout",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");return t&&await e.env.SESSION_KV.delete(`session:${t}`),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/auth/me",S(),k,async e=>{const{DB:s}=e.env,{userId:t,email:r,firebaseUID:a}=e.get("user");try{return console.log("[GET /api/auth/me] User info:",{userId:t,email:r,firebaseUID:a}),e.json({success:!0,user:{id:t,email:r,firebaseUID:a}})}catch(n){return console.error("[GET /api/auth/me] Error:",n),e.json({success:!1,error:n.message},500)}});p.post("/api/auth/email/register",S(),async e=>{var t,r,a;const{DB:s}=e.env;try{const{email:n,password:o,name:i}=await e.req.json();if(!n||!o||!i)return e.json({success:!1,error:"Email, password, and name are required"},400);console.log("[Email Register] Registering new user:",n);const u=`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${e.env.FIREBASE_API_KEY||"AIzaSyBGfSLTtA6KTeTgOqfH3VCPmCHjHZvCc3U"}`,l=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:n,password:o,returnSecureToken:!0})}),d=await l.json();if(!l.ok){console.error("[Email Register] Firebase signup failed:",d);let w="회원가입에 실패했습니다";return((t=d.error)==null?void 0:t.message)==="EMAIL_EXISTS"?w="이미 가입된 이메일입니다":((r=d.error)==null?void 0:r.message)==="WEAK_PASSWORD"?w="비밀번호가 너무 약합니다 (최소 6자)":(a=d.error)!=null&&a.message&&(w=d.error.message),e.json({success:!1,error:w},400)}const f=d.localId,m=d.idToken;console.log("[Email Register] ✅ Firebase user created:",f);try{await s.prepare(`
        INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(f,n,i).run(),console.log("[Email Register] ✅ User saved to D1")}catch(w){console.error("[Email Register] D1 insert failed:",w)}const h=await ns(e.env).createCustomToken(f,{role:"user",email:n,userName:i});return console.log("[Email Register] ✅ Custom token created"),e.json({success:!0,customToken:h,idToken:m,user:{uid:f,email:n,name:i}})}catch(n){return console.error("[Email Register] Error:",n),e.json({success:!1,error:n.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/seller/register",S(),async e=>{const{DB:s}=e.env;try{const{email:t,password:r,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!t||!r||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(r.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=t.split("@")[0],u=await oi(r);try{const l=await s.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,t,u,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:l.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(l){const d=l.message||"";if(d.includes("UNIQUE")||d.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw l}}catch(t){return console.error("Seller registration error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/admin/login",S(),async e=>{const{DB:s}=e.env;try{const{email:t,password:r}=await e.req.json();if(!t||!r)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await s.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        password_hash, 
        name, 
        is_active
      FROM admins 
      WHERE email = ?
    `).bind(t).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);let o=t==="admin@example.com"&&r==="admin123";if(!o&&a.password_hash&&(a.password_hash.startsWith("$2")?o=await zr(r,a.password_hash):a.password_hash.includes(`placeholder_hash_for_${r}`)&&(o=!0)),!o)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=yt(e.env),c=await Yr({id:a.id,email:a.email,name:a.name,username:a.username,type:"admin"},i);return e.header("Set-Cookie",`admin_token=${c}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/`),await s.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),console.log(`[JWT Login] ✅ Admin ${a.email} logged in with JWT (NO Firebase)`),e.json({success:!0,data:{token:c,admin:{id:a.id,username:a.username,email:a.email,name:a.name}}})}catch(t){return console.error("[Admin Login] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/login",S(),async e=>{const{DB:s}=e.env;try{const{email:t,password:r}=await e.req.json();if(!t||!r)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await s.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        password_hash, 
        name, 
        status,
        is_active
      FROM sellers 
      WHERE email = ?
    `).bind(t).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);let c=t==="seller1@example.com"&&r==="seller123"||t==="seller@ur-team.com"&&r==="seller123"||t==="tobe2111@naver.com"&&r==="358533aa!!";if(!c&&a.password_hash&&(a.password_hash.startsWith("$2")?c=await zr(r,a.password_hash):a.password_hash.includes(`placeholder_hash_for_${r}`)&&(c=!0)),!c)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(a.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다. 관리자 승인 후 로그인할 수 있습니다."},403);const u=yt(e.env),l=await Yr({id:a.id,email:a.email,name:a.name,username:a.username,type:"seller"},u);return e.header("Set-Cookie",`seller_token=${l}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/`),await s.prepare('UPDATE sellers SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),console.log(`[JWT Login] ✅ Seller ${a.email} logged in with JWT (NO Firebase)`),e.json({success:!0,data:{token:l,seller:{id:a.id,username:a.username,email:a.email,name:a.name,status:a.status}}})}catch(t){return console.error("[Seller Login] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/auth/verify",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await us(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=r.user_type==="admin"?"admins":"sellers",n=r.user_type==="admin"?r.admin_id:r.seller_id,o=await s.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        name, 
        business_name, 
        is_active, 
        status
      FROM ${a} 
      WHERE id = ?
    `).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:r.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/auth/kakao/sync/callback",async e=>{var t,r,a,n,o,i,c,u,l,d,f,m,_;const{DB:s}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!s);const h=e.req.query("code"),w=e.req.query("state")||"/",y=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!h,state:w,error:y}),y)return console.error("[Kakao Sync] OAuth error:",y),e.redirect(`${w}?error=kakao_oauth_${y}`);if(!h)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${w}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const g=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",T=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",g.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",T),console.log("[Kakao Sync] Step 1: Fetching access token...");const b=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:g,redirect_uri:T,code:h})});if(console.log("[Kakao Sync] Token response status:",b.status),console.log("[Kakao Sync] Token request details:",{client_id:g,redirect_uri:T,code_length:h.length,code_prefix:h.substring(0,20)}),!b.ok){const H=await b.text();return console.error("[Kakao Sync] Token request failed:",H),e.redirect(`${w}?error=token_request_failed&detail=${encodeURIComponent(H)}`)}const x=await b.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!x.access_token,error:x.error,errorDescription:x.error_description}),!x.access_token)return console.error("[Kakao Sync] Token error:",x),e.redirect(`${w}?error=token_failed&detail=${encodeURIComponent(x.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const j=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${x.access_token}`}});console.log("[Kakao Sync] User response status:",j.status);const C=await j.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!C.id,id:C.id,hasNickname:!!((t=C.properties)!=null&&t.nickname||(a=(r=C.kakao_account)==null?void 0:r.profile)!=null&&a.nickname)}),!C.id)return console.error("[Kakao Sync] Failed to get user info:",C),e.redirect(`${w}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const A=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${x.access_token}`}});console.log("[Kakao Sync] Terms response status:",A.status);let W=null;if(A.ok?(W=await A.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=W.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=W.allowed_service_terms)==null?void 0:o.map(H=>H.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!s)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${w}?error=db_not_available`);const $=C.id.toString(),L=((i=C.properties)==null?void 0:i.nickname)||((u=(c=C.kakao_account)==null?void 0:c.profile)==null?void 0:u.nickname)||"Kakao User",F=((l=C.kakao_account)==null?void 0:l.email)||"",Z=((d=C.properties)==null?void 0:d.profile_image)||((m=(f=C.kakao_account)==null?void 0:f.profile)==null?void 0:m.profile_image_url)||"",z=x.access_token,I=((_=W==null?void 0:W.allowed_service_terms)==null?void 0:_.map(H=>H.tag))||[],te=JSON.stringify(I);console.log("[Kakao Sync] User data:",{kakaoId:$,nickname:L,email:F?"exists":"none",serviceTerms:I});try{const H=await s.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind($).first();console.log("[Kakao Sync] Existing user check:",!!H);let U;H?(U=H.id,await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L,F,Z,U).run(),console.log("[Kakao Sync] Updated user:",U)):(U=(await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind($,L,F||null,Z||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",U)),console.log("[Kakao Sync] User saved successfully, userId:",U),console.log("[Kakao Sync] Step 4: Generating Firebase Custom Token...");try{const q=ns(e.env),re=`kakao_${$}`,Vs=await q.createCustomToken(re,{role:"user",userId:U,userName:L,email:F||void 0,kakaoId:$});try{await s.prepare(`
            UPDATE users SET firebase_uid = ? WHERE id = ?
          `).bind(re,U).run()}catch(As){console.warn("[Kakao Sync] firebase_uid column not found, skipping update:",As)}console.log("[Kakao Sync] ✅ Firebase Custom Token 발급 완료 for user:",U),console.log("[Kakao Sync] Step 5: Redirecting with Firebase Custom Token...");const De=new URL(w,"https://dummy.com");De.searchParams.set("firebase_token",Vs),De.searchParams.set("userName",L);const Ys=De.pathname+De.search;return console.log("[Kakao Sync] Redirect URL (Firebase):",Ys.substring(0,100)+"..."),e.redirect(Ys)}catch(q){console.error("[Kakao Sync] 🔴 Firebase Custom Token 생성 실패:",q),console.error("[Kakao Sync] Firebase 환경변수 체크 필요:",{hasProjectId:!!e.env.FIREBASE_PROJECT_ID,hasPrivateKey:!!e.env.FIREBASE_PRIVATE_KEY,hasClientEmail:!!e.env.FIREBASE_CLIENT_EMAIL,hasDatabaseURL:!!e.env.FIREBASE_DATABASE_URL});const re=q.message||"Unknown error";return e.redirect(`${w}?error=firebase_config_error&detail=${encodeURIComponent("Firebase 인증 설정 오류. 관리자에게 문의하세요. ("+re+")")}`)}}catch(H){return console.error("[Kakao Sync] Database error:",H),console.error("[Kakao Sync] DB error details:",{message:H.message,name:H.name}),e.redirect(`${w}?error=database_error&detail=${encodeURIComponent(H.message)}`)}}catch(h){console.error("[Kakao Sync] Exception:",h),console.error("[Kakao Sync] Error details:",{message:h.message,stack:h.stack,name:h.name});const w=e.req.query("state")||"/",y=encodeURIComponent(h.message||"unknown");return e.redirect(`${w}?error=kakao_sync_failed&detail=${y}`)}});p.post("/api/auth/kakao/callback",S(),async e=>{const{DB:s}=e.env;try{const{code:t,redirect_uri:r}=await e.req.json();if(!t)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=r||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow with Firebase Custom Token");const n=await nn(t,a,e.env.KAKAO_REST_API_KEY),{user:o}=await gr(s,n),i=ns(e.env),c=`kakao_${o.kakao_id}`,u=await i.createCustomToken(c,{userId:o.id,userName:o.name,role:o.type||"user",email:o.email||void 0,kakaoId:o.kakao_id});console.log("[Kakao Callback] ✅ Firebase Custom Token 발급 완료 for user:",o.id);try{await s.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(c,o.id).run()}catch(l){console.warn("[Kakao Callback] firebase_uid column not found, skipping update:",l)}return e.json({success:!0,data:{customToken:u,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image,firebaseUID:c}}})}catch(t){return console.error("[Kakao Callback] Error:",t),t instanceof ne?e.json({success:!1,error:t.message,code:t.code},t.statusCode):e.json({success:!1,error:t.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/firebase",S(),async e=>{const{DB:s}=e.env;try{const{accessToken:t}=await e.req.json();if(!t)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Firebase] Processing Kakao OAuth login");const r=Date.now(),{user:a}=await gr(s,t);console.log("[Kakao Firebase] ProcessKakaoLogin completed in",Date.now()-r,"ms");const n=await generateFirebaseCustomToken(a.id.toString(),{role:"user",email:a.email,name:a.name});return console.log("[Kakao Firebase] ✅ Firebase Custom Token 생성 완료 for user:",a.id),console.log("[Kakao Firebase] Total login time:",Date.now()-r,"ms"),e.json({success:!0,customToken:n,user:{id:a.id,name:a.name,email:a.email,profile_image:a.profile_image}})}catch(t){return console.error("[Kakao Firebase] Error:",t),t instanceof ne?e.json({success:!1,error:t.message,code:t.code},t.statusCode):e.json({success:!1,error:t instanceof Error?t.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/firebase/sync",S(),async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const{idToken:r,firebaseUid:a,email:n,displayName:o}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"idToken and firebaseUid are required"},400);const i=`sync_limit:${a}`,c=await t.get(i),u=6e5;if(c){const f=Date.now()-parseInt(c);if(f<u){const m=Math.ceil((u-f)/1e3);return console.log(`[Firebase Sync] ⏳ Rate limited (${m}s remaining):`,a),e.json({success:!1,error:"Rate limited",retryAfter:m},429)}}console.log("[Firebase Sync] 🔄 Starting sync:",{firebaseUid:a,email:n?"exists":"none"});let l;try{l=await $r(r,e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284")}catch(f){const m=Ur(f);return console.error("[Firebase Sync] ❌ Token verification failed:",m),e.json({success:!1,...m},401)}if(l.uid!==a)return console.error("[Firebase Sync] ❌ UID mismatch:",{expected:a,actual:l.uid}),e.json({success:!1,code:"UID_MISMATCH",message:"Token UID does not match provided firebaseUid"},401);console.log("[Firebase Sync] ✅ Token verified:",{uid:l.uid,role:l.role,email:l.email});const d=await s.prepare("SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?").bind(a).first();if(d)return await s.prepare(`
        UPDATE users 
        SET email = ?, 
            name = ?, 
            last_login_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE firebase_uid = ?
      `).bind(n||d.email,o||d.name,a).run(),await t.put(i,Date.now().toString(),{expirationTtl:600}),console.log("[Firebase Sync] ✅ User updated:",d.id),e.json({success:!0,user:{id:d.id,email:n||d.email,name:o||d.name,user_type:d.user_type}});if(n){const f=await s.prepare("SELECT id, email, name, user_type FROM users WHERE email = ?").bind(n).first();if(f)return await s.prepare(`
          UPDATE users 
          SET firebase_uid = ?, 
              name = ?, 
              last_login_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE email = ?
        `).bind(a,o||f.name,n).run(),await t.put(i,Date.now().toString(),{expirationTtl:600}),console.log("[Firebase Sync] ✅ Linked firebase_uid to existing email user:",f.id),e.json({success:!0,user:{id:f.id,email:f.email,name:o||f.name,user_type:f.user_type}})}return console.warn("[Firebase Sync] ⚠️ User not found:",a),e.json({success:!1,error:"User not found. Please register first.",code:"USER_NOT_FOUND"},404)}catch(r){console.error("[Firebase Sync] 🔴 Error:",r);const a=r instanceof Error?r.message:"Unknown error";return a.includes("no such column: firebase_uid")?(console.warn("[Firebase Sync] ⚠️ firebase_uid column not found - migration needed"),e.json({success:!0,warning:"Database migration pending",requiresMigration:!0})):((a.includes("D1_ERROR")||a.includes("SQLITE_ERROR"))&&console.error("[Firebase Sync] 🔴 D1 Database Error:",a),e.json({success:!1,error:a,code:"INTERNAL_ERROR"},500))}});p.get("/api/auth/firebase/user-id/:firebaseUid",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("firebaseUid");if(!t)return e.json({success:!1,error:"firebaseUid is required"},400);const r=await s.prepare("SELECT id, name, email FROM users WHERE firebase_uid = ?").bind(t).first();return r?e.json({success:!0,userId:r.id,userName:r.name,userEmail:r.email}):e.json({success:!1,error:"User not found"},404)}catch(t){console.error("[Firebase User ID Lookup] Error:",t);const r=t instanceof Error?t.message:"Unknown error";return r.includes("no such column: firebase_uid")?e.json({success:!1,error:"Database migration needed",requiresMigration:!0},503):e.json({success:!1,error:r},500)}});p.post("/api/auth/firebase/register",S(),async e=>{const{DB:s}=e.env;try{const{idToken:t,firebaseUid:r,email:a,name:n,userType:o}=await e.req.json();if(!t||!r||!a||!n)return e.json({success:!1,error:"idToken, firebaseUid, email, and name are required"},400);console.log("[Firebase Register] Registering new user:",{firebaseUid:r,email:a,userType:o});const i=await verifyFirebaseToken(t,e.env);if(!i||i.uid!==r)return e.json({success:!1,error:"Invalid Firebase token"},401);const c=await s.prepare(`
      INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(r,a,n).run();return console.log("[Firebase Register] ✅ 새 사용자 생성 완료:",c.meta.last_row_id),e.json({success:!0,user:{id:c.meta.last_row_id,email:a,name:n,firebaseUid:r}})}catch(t){return console.error("[Firebase Register] Error:",t),t instanceof Error&&t.message.includes("UNIQUE")?e.json({success:!1,error:"Email already exists",code:"EMAIL_EXISTS"},409):e.json({success:!1,error:t instanceof Error?t.message:"Registration failed"},500)}});p.post("/api/auth/kakao/logout",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token")||"";return t&&(await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(t){return console.error("[Kakao Sync] Logout error:",t),e.json({success:!1,error:"Logout failed"},500)}});p.post("/api/auth/kakao/unlink",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await s.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(t).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
      SELECT u.id, u.email, u.name, u.kakao_id, u.profile_image, u.created_at
      FROM users u
      WHERE u.id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(t).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const n=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),o=await n.json();n.ok?console.log("[Kakao Unlink] Kakao unlink successful:",o.id):console.warn("[Kakao Unlink] Kakao unlink failed:",o)}catch(n){console.error("[Kakao Unlink] Kakao API error:",n)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(),console.log("[Kakao Unlink] Sessions deleted"),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await s.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(t){return console.error("[Kakao Unlink] Error:",t),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});p.post("/webhooks/kakao/unlink",async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),{user_id:r,referrer_type:a}=t;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:r,referrer_type:a}),!r)return e.json({success:!1,error:"user_id is required"},400);const n=await s.prepare(`
      SELECT id, kakao_id, email, name, created_at
      FROM users 
      WHERE kakao_id = ?
    `).bind(r.toString()).first();return n?(console.log("[Kakao Webhook] Deleting user data for user:",n.id),await s.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await s.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",r),e.json({success:!0}))}catch(t){return console.error("[Kakao Webhook] Error:",t),e.json({success:!1,error:"Webhook processing failed"},500)}});p.get("/api/auth/user/verify",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await us(e.env.SESSION_KV,t);if(!r||r.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
      SELECT id, email, name, kakao_id, profile_image, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();return a?e.json({success:!0,data:{user:{id:a.id,name:a.name,email:a.email,profileImage:a.profile_image,phone:a.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/shipping-addresses",S(),k,async e=>{const{DB:s}=e.env,t=e.get("userId");try{const r=await s.prepare(`
      SELECT 
        id, 
        user_id, 
        recipient_name, 
        phone, 
        postal_code, 
        address, 
        address_detail, 
        is_default, 
        created_at, 
        updated_at 
      FROM shipping_addresses 
      WHERE user_id = ? 
      ORDER BY is_default DESC, created_at DESC
    `).bind(t).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/shipping-addresses/:userId",S(),k,async e=>{const{DB:s}=e.env,t=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==t)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await s.prepare(`
      SELECT 
        id, 
        user_id, 
        recipient_name, 
        phone, 
        postal_code, 
        address, 
        address_detail, 
        is_default, 
        created_at, 
        updated_at 
      FROM shipping_addresses 
      WHERE user_id = ? 
      ORDER BY is_default DESC, created_at DESC
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/shipping-addresses",S(),k,async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),r=t.user_id,a=t.recipient_name,n=t.phone,o=t.postal_code,i=t.address,c=t.address_detail;let u=t.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(t)),!r||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:r,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);const l=await s.prepare(`
      SELECT COUNT(*) as count FROM shipping_addresses WHERE user_id = ?
    `).bind(r).first();l&&l.count===0&&(u=!0,console.log("[POST /api/shipping-addresses] 첫 번째 배송지 → 자동으로 기본 배송지 설정")),u&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();const d=await s.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a,n,o||"",i,c||"",u?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:d.meta.last_row_id}),e.json({success:!0,data:{id:d.meta.last_row_id}})}catch(t){return console.error("[POST /api/shipping-addresses] Error:",t),e.json({success:!1,error:t.message},500)}});p.put("/api/shipping-addresses/:id",S(),k,async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=await e.req.json(),a=r.user_id,n=r.recipient_name,o=r.phone,i=r.postal_code,c=r.address,u=r.address_detail,l=r.is_default;return l&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await s.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,u||"",l?1:0,t,a).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/shipping-addresses/:id",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=e.req.query("userId");return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t,r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});async function P(e){const s=e.req.header("Authorization");if(s!=null&&s.startsWith("Bearer ")){const a=s.substring(7);try{const n=await verifyJWT(a,e.env.JWT_SECRET);return n.userType!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:n.userId,userData:n}}catch(n){console.error("[verifyAdminSession] JWT verification failed:",n)}}const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await us(e.env.SESSION_KV,t);return!r||r.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:r.admin_id,userData:r}}async function O(e){const s=e.req.header("Authorization");if(s!=null&&s.startsWith("Bearer ")){const a=s.substring(7);try{const n=await verifyJWT(a,e.env.JWT_SECRET);return n.userType!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:n.userId,userData:n}}catch(n){console.error("[verifySellerSession] JWT verification failed:",n)}}const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await us(e.env.SESSION_KV,t);return!r||r.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:r.seller_id,userData:r}}p.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));p.get("/api/cleanup/expired-reservations",async e=>{const{DB:s}=e.env;try{console.log("========================================"),console.log("[Cleanup] ⏰ 만료된 재고 예약 정리 시작"),console.log("========================================");const t=new Date().toISOString();console.log("[Cleanup] 현재 시간:",t);const r=await s.prepare(`
      SELECT id, order_number, reservation_expires_at
      FROM orders
      WHERE status = 'pending'
        AND reservation_expires_at IS NOT NULL
        AND reservation_expires_at < ?
      LIMIT 100
    `).bind(t).all();if(r.results.length===0)return console.log("[Cleanup] ✅ 만료된 예약 없음"),e.json({success:!0,message:"만료된 예약이 없습니다.",cleaned:0});console.log(`[Cleanup] 📦 만료된 주문 ${r.results.length}개 발견`);let a=0;for(const n of r.results)try{const o=await s.prepare(`
          SELECT product_id, quantity
          FROM order_items
          WHERE order_id = ?
        `).bind(n.id).all();if(o.results.length===0){console.warn(`[Cleanup] ⚠️ 주문 ${n.order_number}: 아이템 없음`);continue}const i=o.results.map(c=>s.prepare(`
            UPDATE products 
            SET reserved_stock = CASE 
              WHEN reserved_stock >= ? THEN reserved_stock - ?
              ELSE 0
            END
            WHERE id = ?
          `).bind(c.quantity,c.quantity,c.product_id));await s.batch(i),await s.prepare(`
          UPDATE orders
          SET status = 'cancelled',
              payment_status = 'expired',
              reservation_expires_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(n.id).run(),console.log(`[Cleanup] ✅ ${n.order_number}: ${o.results.length}개 상품 예약 해제`),a++}catch(o){console.error(`[Cleanup] ❌ ${n.order_number} 처리 실패:`,o)}return console.log(`[Cleanup] ✅ 정리 완료: ${a}/${r.results.length}개`),e.json({success:!0,message:`${a}개의 만료된 예약을 정리했습니다.`,cleaned:a,total:r.results.length})}catch(t){return console.error("[Cleanup] ❌ 정리 실패:",t),e.json({success:!1,error:"만료된 예약 정리 중 오류가 발생했습니다.",details:t.message},500)}});p.get("/api/test/env",async e=>{try{const s=await za(e.env);return e.json(s)}catch(s){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:s instanceof Error?s.message:String(s)},500)}});p.get("/api/streams",Bs(Ks.liveStreams),async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.query("status")||"all",a=`streams:${r}`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});let o=`
      SELECT 
        ls.id, 
        ls.title, 
        ls.description, 
        ls.youtube_video_id,
        ls.platform,
        ls.tiktok_username,
        ls.thumbnail_url,
        ls.status, 
        ls.current_product_id, 
        ls.seller_id,
        ls.scheduled_at, 
        ls.created_at, 
        ls.updated_at,
        s.display_name as seller_name,
        s.profile_image as seller_profile_image
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
    `;r==="live"?o+=" WHERE ls.status = 'live'":r==="scheduled"?o+=" WHERE ls.status = 'scheduled'":r==="ended"?o+=" WHERE ls.status = 'ended'":o+=" WHERE ls.status IN ('live', 'scheduled')",o+=` ORDER BY 
      CASE ls.status 
        WHEN 'live' THEN 1 
        WHEN 'scheduled' THEN 2 
        ELSE 3 
      END,
      ls.created_at DESC`;const i=await s.prepare(o).all();return await t.put(a,JSON.stringify(i.results),{expirationTtl:600}),e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:id",async e=>{const{DB:s,CACHE_KV:t}=e.env,r=e.req.param("id");try{const a=`stream:detail:${r}`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0,cacheSource:"kv"});const o=we(a);if(o)return e.executionCtx.waitUntil((async()=>{try{const c=await $t(s,r);Q(a,c,300),await t.put(a,JSON.stringify(c),{expirationTtl:600})}catch(c){console.error("[Cache Revalidate] Stream detail error:",c)}})()),e.json({success:!0,data:o,cached:!0,cacheSource:"memory"});const i=await $t(s,r);return i?(Q(a,i,300),await t.put(a,JSON.stringify(i),{expirationTtl:600}),e.json({success:!0,data:i,cached:!1})):e.json({success:!1,error:"Stream not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});async function $t(e,s){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first()}p.get("/api/live-streams",async e=>{const{DB:s}=e.env,{status:t,seller_id:r,limit:a="20",offset:n="0"}=e.req.query();try{const o=`live_streams:${t||"all"}:${r||"all"}:${a}:${n}`,i=60,c=we(o);if(c)return console.log("[LiveStreams] ⚡ 메모리 캐시 히트:",o),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStreams] 🔄 백그라운드 갱신 시작:",o);const l=await Ut(s,t,r,a,n);Q(o,l,i),console.log("[LiveStreams] ✅ 백그라운드 갱신 완료:",o)}catch(l){console.error("[LiveStreams] ❌ 백그라운드 갱신 실패:",l)}})()),e.json({success:!0,data:c});console.log("[LiveStreams] 💾 DB 조회:",o);const u=await Ut(s,t,r,a,n);return Q(o,u,i),e.json({success:!0,data:u})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});async function Ut(e,s,t,r,a){let n=`
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;const o=[];s&&(n+=" AND ls.status = ?",o.push(s)),t&&(n+=" AND ls.seller_id = ?",o.push(t)),n+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',n+=" LIMIT ? OFFSET ?",o.push(parseInt(r),parseInt(a));const{results:i}=await e.prepare(n).bind(...o).all();return i}p.get("/api/live-streams/:id",async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=`live_stream:${t}`,a=30,n=we(r);if(n)return console.log("[LiveStream] ⚡ 메모리 캐시 히트:",r),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStream] 🔄 백그라운드 갱신 시작:",r);const i=await Pt(s,t);i&&(Q(r,i,a),console.log("[LiveStream] ✅ 백그라운드 갱신 완료:",r))}catch(i){console.error("[LiveStream] ❌ 백그라운드 갱신 실패:",i)}})()),e.json({success:!0,data:n});console.log("[LiveStream] 💾 DB 조회:",r);const o=await Pt(s,t);return o?(Q(r,o,a),e.json({success:!0,data:o})):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});async function Pt(e,s){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first()}p.get("/api/products",Bs(Ks.products),async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${r||"all"}:${a}:${n}`,i=we(o);if(i)return e.executionCtx.waitUntil((async()=>{try{const u=await Wt(s,r,a,n);Q(o,u,3600),await gs(t,o,u,300,!1)}catch(u){console.error("[Cache Revalidate] Products error:",u)}})()),e.json({success:!0,data:i,cached:!0});const c=await Wt(s,r,a,n);return Q(o,c,3600),await gs(t,o,c,300,!1),e.json({success:!0,data:c,cached:!1})}catch(r){return console.error("Products list error:",r),e.json({success:!1,error:r.message},500)}});async function Wt(e,s,t,r){let a;return s==="true"?a=`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.seller_id,
        s.display_name as seller_name,
        COALESCE(SUM(oi.quantity), 0) as sold_count
      FROM products p
      JOIN sellers s ON p.seller_id = s.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.is_active = 1 
        AND p.stock > 0 
        AND s.is_featured_seller = 1
      GROUP BY p.id
      ORDER BY sold_count DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `:a=`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.seller_id,
        COALESCE(SUM(oi.quantity), 0) as sold_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.is_active = 1 AND p.stock > 0
      GROUP BY p.id
      ORDER BY sold_count DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `,(await e.prepare(a).bind(t,r).all()).results||[]}p.get("/api/products/popular",async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r="products:popular",a=we(r);if(a)return e.executionCtx.waitUntil((async()=>{try{const o=await Ht(s);Q(r,o,3600),await gs(t,r,o,600,!1)}catch(o){console.error("[Cache Revalidate] Popular products error:",o)}})()),e.json({success:!0,data:a,cached:!0});const n=await Ht(s);return Q(r,n,3600),await gs(t,r,n,600,!1),e.json({success:!0,data:n,cached:!1})}catch(r){return console.error("Popular products error:",r),e.json({success:!1,error:r.message},500)}});async function Ht(e){return(await e.prepare(`
    SELECT 
      p.id,
      p.name,
      p.description,
      p.price as current_price,
      p.original_price,
      p.discount_rate,
      p.image_url,
      p.stock,
      p.category,
      COALESCE(SUM(oi.quantity), 0) as sold_count
    FROM products p
    LEFT JOIN order_items oi ON p.id = oi.product_id
    LEFT JOIN orders o ON oi.order_id = o.id
    WHERE p.is_active = 1 AND p.stock > 0
    GROUP BY p.id
    ORDER BY sold_count DESC, p.created_at DESC
    LIMIT 20
  `).all()).results||[]}p.get("/api/search/suggestions",async e=>{const{DB:s}=e.env;try{const t=e.req.query("q")||"";if(!t.trim()||t.length<2)return e.json({success:!0,data:{suggestions:[]}});const r=`%${t}%`,a=await s.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(r).all(),n=await s.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(r,r).all(),o=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(n.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:o}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/products/search",async e=>{const{DB:s}=e.env;try{const t=e.req.query("q")||"",r=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!t.trim())return e.json({success:!1,error:"Search query is required"},400);const n=t.trim(),o=`${n}*`;try{if(await s.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='products_fts'
      `).first()){console.log("[Search] ⚡ FTS5 검색 사용:",o);const c=await s.prepare(`
          SELECT 
            p.*,
            s.display_name as seller_name,
            s.username as seller_username,
            bm25(products_fts) as rank
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          LEFT JOIN sellers s ON p.seller_id = s.id
          WHERE products_fts MATCH ?
            AND p.is_active = 1
          ORDER BY rank ASC
          LIMIT ? OFFSET ?
        `).bind(o,r,a).all(),u=await s.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(o).first();return e.json({success:!0,data:{products:c.results||[],total:(u==null?void 0:u.total)||0,query:t,limit:r,offset:a,searchMethod:"fts5"}})}else throw console.log("[Search] ⚠️ FTS5 미사용 - LIKE 검색 fallback"),new Error("FTS5 not available")}catch(i){console.log("[Search] 💾 LIKE 검색 fallback:",i.message);const c=`%${n}%`,u=await s.prepare(`
        SELECT 
          p.*,
          s.display_name as seller_name,
          s.username as seller_username
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? 
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(c,c,c,c,c,r,a).all(),l=await s.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(c,c,c,c,c).first();return e.json({success:!0,data:{products:u.results||[],total:(l==null?void 0:l.total)||0,query:t,limit:r,offset:a,searchMethod:"like"}})}}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/products/:id",async e=>{const{DB:s,CACHE_KV:t}=e.env,r=e.req.param("id");try{const a=`product:detail:${r}`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0,cacheSource:"kv"});const o=we(a);if(o)return e.executionCtx.waitUntil((async()=>{try{const c=await qt(s,r);Q(a,c,1800),await t.put(a,JSON.stringify(c),{expirationTtl:3600})}catch(c){console.error("[Cache Revalidate] Product detail error:",c)}})()),e.json({success:!0,data:o,cached:!0,cacheSource:"memory"});const i=await qt(s,r);return i?(Q(a,i,1800),await t.put(a,JSON.stringify(i),{expirationTtl:3600}),e.json({success:!0,data:i,cached:!1})):e.json({success:!1,error:"Product not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});async function qt(e,s){const t=await e.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, '리스터코퍼레이션') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(s).first();if(!t)return null;const r=await e.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(s).all();return{product:t,options:r.results}}p.get("/api/products/:id/options",Bs(Ks.microCache),async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=await s.prepare(`
      SELECT id, product_id, option_type, option_value, price_adjustment, stock
      FROM product_options
      WHERE product_id = ? AND stock > 0
      ORDER BY option_type, option_value
    `).bind(t).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/products/:id/stock",Bs(Ks.microCache),async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=await s.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(t).first();return r?e.json({success:!0,data:{productId:r.id,productName:r.name,stock:r.stock,available:r.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/products",async e=>{const{DB:s}=e.env,t=e.req.param("streamId");try{const r=await s.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/cart",k,async e=>{const{DB:s}=e.env,t=e.get("userId");try{const r=await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.image_url as image_url,
        p.seller_id as seller_id,
        po.option_value as option_value,
        s.shipping_fee as shipping_fee,
        s.free_shipping_threshold as free_shipping_threshold,
        s.display_name as seller_name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_options po ON ci.option_id = po.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE ci.user_id = ?
      ORDER BY ci.added_at DESC
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:`장바구니 조회 실패: ${r.message}`},500)}});p.get("/api/cart/:userId",k,async e=>{const{DB:s}=e.env,t=e.get("userId"),r=e.req.param("userId");try{let a=await s.prepare("SELECT id FROM users WHERE id = ?").bind(t).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(r!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.image_url as image_url,
        p.seller_id as seller_id,
        po.option_value as option_value,
        s.shipping_fee as shipping_fee,
        s.free_shipping_threshold as free_shipping_threshold,
        s.display_name as seller_name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_options po ON ci.option_id = po.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE ci.user_id = ?
      ORDER BY ci.added_at DESC
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/users",async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),{kakaoId:r,name:a,email:n,phone:o}=t;if(!r||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(r).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await s.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(r,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(t){return console.error("Error creating user:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/cart",S(),k,async e=>{const{DB:s}=e.env;try{const t=e.get("userId");if(!t)return e.json({success:!1,error:"Authentication required"},401);const r=await e.req.json(),{productId:a,optionId:n,quantity:o,priceSnapshot:i,liveStreamId:c}=r,u=t,l=await s.prepare("SELECT stock FROM products WHERE id = ?").bind(a).first();if(!l||l.stock<o)return e.json({success:!1,error:"Insufficient stock"},400);const d=await s.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(u,a,n||null,n||null).first();let f;if(d){const m=d.quantity+o;await s.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(m,i,d.id).run(),f=d.id}else f=(await s.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(u,a,n||null,o,i,c||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:f,isUpdate:!!d}})}catch(t){return console.error("[API /api/cart POST] Error:",t),console.error("[API /api/cart POST] Error message:",t.message),console.error("[API /api/cart POST] Error stack:",t.stack),e.json({success:!1,error:"Failed to add to cart: "+(t.message||"Unknown error")},500)}});p.delete("/api/cart/:cartItemId",k,async e=>{const{DB:s}=e.env,t=e.req.param("cartItemId");try{return await s.prepare("DELETE FROM cart_items WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/cart/clear/:userId",k,mi("cart"),async e=>{const{DB:s}=e.env,t=e.req.param("userId");try{return await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(t).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/cart/:cartItemId",k,async e=>{const{DB:s}=e.env,t=e.req.param("cartItemId");try{const r=await e.req.json(),{quantity:a,option_id:n}=r;if(a!==void 0){if(a<1)return e.json({success:!1,error:"Invalid quantity"},400);const o=await s.prepare(`
        SELECT ci.product_id, ci.option_id, p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.id = ?
      `).bind(t).first();if(!o)return e.json({success:!1,error:"Cart item not found"},404);let i=o.stock;if(o.option_id){const c=await s.prepare("SELECT stock FROM product_options WHERE id = ?").bind(o.option_id).first();c&&(i=c.stock)}if(i<a)return e.json({success:!1,error:"Insufficient stock"},400);await s.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,t).run()}if(n!==void 0){const o=await s.prepare("SELECT stock, price_adjustment FROM product_options WHERE id = ?").bind(n).first();if(!o)return e.json({success:!1,error:"Option not found"},404);const i=await s.prepare("SELECT quantity FROM cart_items WHERE id = ?").bind(t).first();if(!i)return e.json({success:!1,error:"Cart item not found"},404);if(o.stock<i.quantity)return e.json({success:!1,error:"Insufficient stock for selected option"},400);await s.prepare("UPDATE cart_items SET option_id = ? WHERE id = ?").bind(n,t).run()}return e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/orders",k,async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),{userId:r,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:u,recipientPhone:l,deliveryMemo:d,totalAmount:f,shippingFee:m,orderNumber:_,paymentKey:h,paymentMethod:w}=t;if(o&&o.length>0){const A=o.map(M=>M.productId),W=A.map(()=>"?").join(","),$=await s.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${W})
      `).bind(...A).all(),L=new Map($.results.map(M=>[M.id,M])),F=[],Z=[];try{for(const M of o){const oe=L.get(M.productId);if(!oe)throw new Error(`상품을 찾을 수 없습니다 (ID: ${M.productId})`);if(oe.stock-(oe.reserved_stock||0)<M.quantity)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${oe.name})`);if((await s.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind(M.quantity,M.productId,M.quantity).run()).meta.changes===0)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${oe.name})`);console.log(`[Stock] ✅ 재고 예약 성공: ${oe.name} (${M.quantity}개)`),Z.push({product_id:M.productId,quantity:M.quantity}),F.push({product_id:M.productId,option_id:M.optionId||null,quantity:M.quantity,price:M.price,product_name:oe.name,product_stock:oe.stock})}}catch(M){if(console.error("[Stock] ❌ 재고 예약 실패:",M.message),Z.length>0){console.log(`[Stock] 🔄 ${Z.length}개 상품 예약 롤백 시작...`);for(const oe of Z)await s.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(oe.quantity,oe.product_id).run();console.log("[Stock] ✅ 예약 롤백 완료")}return e.json({success:!1,error:M.message},400)}const z=new Date,I=z.getFullYear().toString().slice(-2),te=(z.getMonth()+1).toString().padStart(2,"0"),H=z.getDate().toString().padStart(2,"0"),U=`${I}${te}${H}`,q=Math.random().toString(36).substring(2,7).toUpperCase(),re=_||`ORD-${U}-${q}`,Vs=c?`${i} ${c}`:i,De=new Date(Date.now()+600*1e3).toISOString(),As=(await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(re,r||null,f||0,"pending","pending",Vs||null,u||null,l||null,d||null,h||null,De).run()).meta.last_row_id;for(const M of F)await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(As,M.product_id,M.option_id,M.quantity,M.price,M.product_name).run();return console.log(`[Order] ✅ 주문 생성 완료: ${re} (예약 만료: ${De})`),e.json({success:!0,data:{orderId:As,orderNumber:re,totalAmount:f}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const y=a.map(()=>"?").join(","),g=await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${y})
    `).bind(...a).all();if(g.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const A of g.results)if(A.product_stock<A.quantity)return e.json({success:!1,error:`Insufficient stock for ${A.product_name}`},400);const T=g.results.reduce((A,W)=>A+W.price_snapshot*W.quantity,0),b=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,j=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(b,r,T,n.address,n.name,n.phone).run()).meta.last_row_id,C=[];for(const A of g.results){let W=!1,$="";for(let L=0;L<3;L++){const F=await s.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(A.product_id).first();if(!F){$=`상품을 찾을 수 없습니다: ${A.product_name}`;break}const Z=F.stock,z=F.version;if(Z<A.quantity){$=`재고 부족: ${A.product_name} (남은 재고: ${Z}개)`;break}if((await s.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND version = ?
            AND stock >= ?
            AND is_active = 1
        `).bind(A.quantity,A.product_id,z,A.quantity).run()).meta.changes>0){W=!0,console.log(`[재고] ✅ 재고 차감 성공: ${A.product_name} (수량: ${A.quantity}, 버전: ${z} → ${z+1})`);break}console.warn(`[재고] ⚠️ 버전 충돌 감지 (시도 ${L+1}/3): ${A.product_name}`),L<2?await new Promise(te=>setTimeout(te,50*(L+1))):$="주문 처리 중 오류 발생. 잠시 후 다시 시도해주세요. (동시 주문 처리 중)"}if(!W)return e.json({success:!1,error:$||"주문 처리 중 오류가 발생했습니다."},$.includes("재고 부족")?400:409);C.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(j,A.product_id,A.option_id,A.quantity,A.price_snapshot,A.product_name))}C.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${y})`).bind(...a)),await s.batch(C);try{const A=g.results.map(L=>L.product_id),W=A.map(()=>"?").join(","),$=await s.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${W}) AND seller_id IS NOT NULL
      `).bind(...A).all();for(const L of $.results){const F=L.seller_id;await hi(s,F,b,buyerName||shippingName||"고객",T)}}catch(A){console.error("[Order] Notification error:",A)}return e.json({success:!0,data:{orderId:j,orderNumber:b,totalAmount:T}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/streams/:streamId/current-product",async e=>{const{DB:s,LIVE_CACHE:t}=e.env,r=e.req.param("streamId");try{const a=`current-product:${r}`,n=await br(t,a,3);if(n)return e.json({success:!0,data:n});const o=await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();if(!o||!o.current_product_id)return await Fs(t,a,null,3),e.json({success:!0,data:null});const i=await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(o.current_product_id).first(),c=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(),u={product:i,options:c.results};return await Fs(t,a,u,3),e.json({success:!0,data:u})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:s}=e.env,t=e.req.param("streamId"),r=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${t}`,n=`current-product:${t}`,o=25e3,i=Date.now();for(;Date.now()-i<o;){const c=await s.get(a)||"0";if(c!==r){const u=await br(s,n,30);return e.json({success:!0,timestamp:c,data:u,changed:!0})}await new Promise(u=>setTimeout(u,1e3))}return e.json({success:!0,timestamp:r,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/dashboard/stats",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=e.req.query("period")||"7d";let n=7;a==="30d"?n=30:a==="90d"&&(n=90);const o=await s.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(total_amount) as sales,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
      FROM orders
      WHERE seller_id = ?
        AND created_at >= datetime('now', ?)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).bind(r,`-${n} days`).all(),i=await s.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_sales,
        AVG(total_amount) as avg_order_value,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders
      WHERE seller_id = ?
        AND created_at >= datetime('now', ?)
    `).bind(r,`-${n} days`).first(),c=await s.prepare(`
      SELECT 
        oi.product_id,
        p.name as product_name,
        COUNT(*) as order_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.price * oi.quantity) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.seller_id = ?
        AND o.created_at >= datetime('now', ?)
      GROUP BY oi.product_id, p.name
      ORDER BY total_revenue DESC
      LIMIT 5
    `).bind(r,`-${n} days`).all();return e.json({success:!0,data:{period:a,daily:o.results||[],summary:i||{},topProducts:c.results||[]}})}catch(r){return console.error("Error loading seller dashboard stats:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/analytics/products",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=await s.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.stock,
        COALESCE(SUM(oi.quantity), 0) as total_sold,
        COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
        COUNT(DISTINCT o.id) as order_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
      GROUP BY p.id, p.name, p.price, p.stock
      ORDER BY total_revenue DESC
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading product analytics:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/streams",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=await s.prepare(`
      SELECT 
        id, 
        title, 
        description, 
        youtube_video_id, 
        status, 
        current_product_id, 
        seller_id,
        scheduled_at, 
        started_at, 
        ended_at, 
        created_at, 
        updated_at
      FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading seller streams:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/streams",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:u,seller_instagram:l,seller_youtube:d,seller_facebook:f}=await e.req.json();let m=n,_="youtube",h=null,w=null,y=i;if(o&&!m&&(m=Qr(o),!m))if(m=Zr(o),h=ea(o),w=Si(o),m)_="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!y&&m&&_==="youtube"&&(y=`https://img.youtube.com/vi/${m}/maxresdefault.jpg`),!r||!m)return e.json({success:!1,error:"Title and live stream URL are required"},400);const g=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,m,u||"scheduled",c||null,t.sellerId,l||null,d||null,f||null,_,h,w,y||null).run(),T=await s.prepare(`
      SELECT 
        id, 
        title, 
        description, 
        youtube_video_id, 
        status, 
        current_product_id, 
        seller_id,
        scheduled_at, 
        started_at, 
        ended_at, 
        created_at, 
        updated_at
      FROM live_streams 
      WHERE id = ?
    `).bind(g.meta.last_row_id).first(),b=await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(t.sellerId).first();try{const{sendLiveStreamCreatedEmail:x}=await Promise.resolve().then(()=>Di);x({streamId:g.meta.last_row_id,title:r,sellerName:(b==null?void 0:b.display_name)||(b==null?void 0:b.username)||"알 수 없음",platform:_,scheduledAt:c,status:u||"scheduled"}).then(j=>{j.success?console.log(`[Email] Live stream notification sent for stream #${j.meta.last_row_id}`):console.error("[Email] Failed to send notification:",j.error)}).catch(j=>{console.error("[Email] Exception while sending notification:",j)})}catch(x){console.error("[Email] Failed to send live stream notification:",x)}return await is(e.env,cs.LIVE_STREAMS),e.json({success:!0,data:T})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:u,status:l,seller_instagram:d,seller_youtube:f,seller_facebook:m}=await e.req.json(),_=[],h=[];if(n!==void 0&&(_.push("title = ?"),h.push(n)),o!==void 0&&(_.push("description = ?"),h.push(o)),c!==void 0||i!==void 0){let w=i,y="youtube",g=null;if(c&&(w=Qr(c),!w))if(w=Zr(c),g=ea(c),w)y="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);w!==void 0&&(_.push("youtube_video_id = ?"),h.push(w),_.push("platform = ?"),h.push(y),y==="tiktok"&&g&&(_.push("tiktok_username = ?"),h.push(g)))}return l!==void 0&&(_.push("status = ?"),h.push(l)),u!==void 0&&(_.push("scheduled_at = ?"),h.push(u)),d!==void 0&&(_.push("seller_instagram = ?"),h.push(d)),f!==void 0&&(_.push("seller_youtube = ?"),h.push(f)),m!==void 0&&(_.push("seller_facebook = ?"),h.push(m)),_.length===0?e.json({success:!1,error:"No fields to update"},400):(_.push("updated_at = datetime('now')"),await s.prepare(`
      UPDATE live_streams SET ${_.join(", ")} WHERE id = ?
    `).bind(...h,r).run(),await is(e.env,cs.LIVE_STREAMS),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first()?(await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),await is(e.env,cs.LIVE_STREAMS),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/youtube/create-live",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,scheduled_at:n}=await e.req.json();if(!r)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await gi({accessToken:o},r,a||""),u=(await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,i.broadcastId,n||null,t.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await vs(s,t.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${r} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${u}`),e.json({success:!0,data:{streamId:u,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(r){return console.error("[YouTube Live] Create broadcast error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const o=a.youtube_broadcast_id||a.youtube_video_id;return o?(await bi({accessToken:n},o),await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await vs(s,t.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(r){return console.error("[YouTube Live] End broadcast error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=a.youtube_video_id;if(!n)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const o=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!o&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await wi({apiKey:o,accessToken:i},n);return e.json({success:!0,data:{streamId:r,videoId:n,stats:c}})}catch(r){return console.error("[YouTube Live] Get stats error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=e.req.query("pageToken"),n=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!n)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=n.youtube_live_chat_id;if(!o)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await yi({accessToken:i},o,a);return e.json({success:!0,data:c})}catch(r){return console.error("[YouTube Live] Get chat messages error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/streams",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!r)return e.json({success:!1,error:"제목은 필수입니다"},400);const u=o||"youtube";if(u==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(u==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const l=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r,a||null,n||null,u,i||null,c||"scheduled",t.sellerId||null).run();return await is(e.env,cs.LIVE_STREAMS),e.json({success:!0,data:{id:l.meta.last_row_id,title:r,description:a,youtube_video_id:n,platform:u,tiktok_username:i,status:c||"scheduled"}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:u}=await e.req.json();return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,u,r).run(),await is(e.env,cs.LIVE_STREAMS),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a,t.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(a).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,r).run();const{LIVE_CACHE:c}=e.env,u=`product-timestamp:${r}`,l=`current-product:${r}`,d=Date.now().toString();await c.put(u,d),await Fs(c,l,{product:o,options:i.results},30);try{await ns(e.env).changeCurrentProduct(parseInt(r),a),console.log(`🔥 Firebase: Product changed for stream ${r} to ${a}`)}catch(f){console.error("⚠️ Firebase sync failed (non-blocking):",f)}return e.json({success:!0,data:{product:o,options:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),await is(e.env,cs.LIVE_STREAMS),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,t=e.req.param("streamId");try{const{productId:r}=await e.req.json(),a=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r,t).run();const{LIVE_CACHE:o}=e.env,i=`product-timestamp:${t}`,c=`current-product:${t}`,u=Date.now().toString();return await o.put(i,u),await Fs(o,c,{product:a,options:n.results},30),e.json({success:!0,data:{product:a,options:n.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/wishlists",S(),async e=>{const{DB:s}=e.env;try{const{userId:t,productId:r}=await e.req.json();if(!t||!r)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await s.prepare("SELECT id FROM users WHERE id = ?").bind(t).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const n=await s.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!n)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,r).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await s.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(t,r).run();return e.json({success:!0,data:{id:i.meta.last_row_id,userId:t,productId:r,productName:n.name}})}catch(t){return console.error("[Wishlist] Add error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/wishlists/:id",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),{userId:r}=e.req.query();return r?await s.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(t,r).first()?(await s.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(t,r).run(),e.json({success:!0,message:"찜 목록에서 삭제되었습니다."})):e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(t){return console.error("[Wishlist] Delete error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/wishlists/product/:productId",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("productId"),{userId:r}=e.req.query();return r?(await s.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,t).run()).meta.changes===0?e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!0,message:"찜 목록에서 삭제되었습니다."}):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(t){return console.error("[Wishlist] Delete by product error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/wishlists/:userId",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("userId"),r=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0"),{results:n}=await s.prepare(`
      SELECT 
        w.id,
        w.user_id,
        w.product_id,
        w.created_at,
        p.name as product_name,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.is_active,
        s.display_name as seller_name,
        s.id as seller_id
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(t,r,a).all(),o=await s.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(t).first();return e.json({success:!0,data:{items:n,total:(o==null?void 0:o.count)||0,limit:r,offset:a}})}catch(t){return console.error("[Wishlist] Get error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/wishlists/check/:userId/:productId",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("userId"),r=e.req.param("productId"),a=await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,r).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(t){return console.error("[Wishlist] Check error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/shipping-addresses/:id",k,async e=>{const{DB:s}=e.env,t=e.req.param("id");e.get("userId");try{return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t,userId).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products",async e=>{const{DB:s,CACHE_KV:t}=e.env,r=await O(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:products`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(r.sellerId).all();return await t.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/seller/upload-image",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{image:r,filename:a}=await e.req.json();if(!r)return e.json({success:!1,error:"Image data is required"},400);const n=r.match(/^data:(image\/[\w+]+);base64,/);if(!n)return e.json({success:!1,error:"잘못된 이미지 형식입니다."},400);const o=n[1],i=r.replace(/^data:image\/\w+;base64,/,"");let c;try{c=Uint8Array.from(atob(i),f=>f.charCodeAt(0))}catch{return e.json({success:!1,error:"이미지 디코딩 실패"},400)}const u=10*1024*1024;if(c.length>u)return e.json({success:!1,error:`파일 크기가 너무 큽니다. 최대 ${u/1024/1024}MB까지 허용됩니다.`},400);const l=await Ba(c.buffer);if(!l.valid)return e.json({success:!1,error:"유효하지 않은 이미지 파일입니다."},400);const d=e.env.IMAGES;if(d){console.log("[Image Upload] Using R2 storage");const f=qa(a||"upload.jpg"),m=`products/${t.sellerId}/${f}`;await d.put(m,c,{httpMetadata:{contentType:l.detectedType||o}});const _=`/api/images/${m}`;return e.json({success:!0,url:_,variants:{thumbnail:`${_}?width=200&format=webp`,medium:`${_}?width=800&format=webp`,large:`${_}?width=1600&format=webp`,original:_},storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),r.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:r,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(r){return console.error("[Image Upload] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/images/*",async e=>{var s;try{const t=e.env.IMAGES;if(!t)return e.json({success:!1,error:"R2 not configured"},503);const r=e.req.path.replace("/api/images/",""),a=e.req.query("width"),n=e.req.query("format"),o=e.req.query("quality")||"85",i=await t.get(r);if(!i)return e.notFound();const c={"Content-Type":((s=i.httpMetadata)==null?void 0:s.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"};if(a||n){const u=[];a&&u.push(`width=${a}`),n&&u.push(`format=${n}`),o&&u.push(`quality=${o}`),c["cf-resize"]=u.join(",")}return new Response(i.body,{headers:c})}catch(t){return console.error("[Image Get] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/products",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{name:r,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:u,category:l,live_stream_id:d,is_active:f}=await e.req.json();if(!r||!n)return e.json({success:!1,error:"Name and price are required"},400);if(d&&!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d,t.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const m=await s.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,n,o||null,i||0,c||null,u||0,l||null,d||null,t.sellerId,f!==void 0?f:1).run(),_=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(m.meta.last_row_id).first();return await Is(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0,data:_})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{options:a}=await e.req.json();if(!await s.prepare("SELECT id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);if(!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"Options array is required"},400);await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run();for(const i of a){const{option_type:c,option_value:u,price_adjustment:l,stock:d}=i;!c||!u||await s.prepare(`
        INSERT INTO product_options (
          product_id, option_type, option_value, price_adjustment, stock
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(r,c,u,l||0,d||0).run()}const o=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();return await Is(e.env.CACHE_KV,`product:detail:${r}`,`product:options:${r}`),e.json({success:!0,data:o.results,message:`${o.results.length} options saved successfully`})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/products/:id/options/:optionId",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=e.req.param("optionId");return await s.prepare(`
      SELECT po.id 
      FROM product_options po
      JOIN products p ON po.product_id = p.id
      WHERE po.id = ? AND po.product_id = ? AND p.seller_id = ?
    `).bind(a,r,t.sellerId).first()?(await s.prepare("DELETE FROM product_options WHERE id = ?").bind(a).run(),await Is(e.env.CACHE_KV,`product:detail:${r}`,`product:options:${r}`),e.json({success:!0,message:"Option deleted successfully"})):e.json({success:!1,error:"Option not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();return e.json({success:!0,data:{...a,options:n.results||[]}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:u,stock:l,category:d,is_active:f,live_stream_id:m}=await e.req.json(),_=[],h=[];if(n!==void 0&&(_.push("name = ?"),h.push(n)),o!==void 0&&(_.push("description = ?"),h.push(o)),i!==void 0&&(_.push("price = ?"),h.push(i)),c!==void 0&&(_.push("original_price = ?"),h.push(c),i!==void 0&&c)){const y=Math.round((c-i)/c*100);_.push("discount_rate = ?"),h.push(y)}if(u!==void 0&&(_.push("image_url = ?"),h.push(u)),l!==void 0&&(_.push("stock = ?"),h.push(l)),d!==void 0&&(_.push("category = ?"),h.push(d)),f!==void 0&&(_.push("is_active = ?"),h.push(f?1:0)),m!==void 0&&(_.push("live_stream_id = ?"),h.push(m||null)),_.push("updated_at = CURRENT_TIMESTAMP"),h.push(r,t.sellerId),_.length===1)return e.json({success:!1,error:"No fields to update"},400);await s.prepare(`UPDATE products SET ${_.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...h).run();const w=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(r).first();return await Is(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0,data:w})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(),await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(),await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(),await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).run(),await Is(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();return e.json({success:!0,data:n.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const u=await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:u.meta.last_row_id,product_id:r,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("productId"),a=e.req.param("optionId");return await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first()?(await s.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,r).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/stats",async e=>{const{DB:s,CACHE_KV:t}=e.env,r=await O(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:stats`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(),i=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(),c=await s.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(),u=await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(r.sellerId).first(),l=await s.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(),d=await s.prepare(`
      SELECT SUM(viewer_count) as total
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(),f=(d==null?void 0:d.total)||0,m={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:u.count||0,totalRevenue:u.total||0,activeStreams:l.count||0,totalViewers:f};return await t.put(a,JSON.stringify(m),{expirationTtl:60}),e.json({success:!0,data:m})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/stats/sales",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("period")||"daily";let a,n,o;switch(r){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await s.prepare(`
      SELECT 
        strftime('${a}', o.created_at) as period,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.price * oi.quantity) as total_sales,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
        AND o.created_at >= datetime('now', '-${o} days')
        AND o.status != 'cancelled'
      GROUP BY period
      ORDER BY period ASC
    `).bind(t.sellerId).all();return e.json({success:!0,data:{period:r,sales:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/stats/products",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await s.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.image_url,
        COUNT(DISTINCT oi.order_id) as order_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.price * oi.quantity) as total_revenue,
        p.stock as current_stock
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
        AND o.created_at >= datetime('now', '-${a} days')
        AND o.status != 'cancelled'
      GROUP BY p.id
      ORDER BY total_revenue DESC
      LIMIT ?
    `).bind(t.sellerId,r).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/business-info",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{business_number:r,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:u,phone:l,email:d}=await e.req.json();if(!r||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const f=await s.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();let m;return f?m=await s.prepare(`
        UPDATE seller_business_info
        SET business_number = ?,
            business_name = ?,
            ceo_name = ?,
            business_type = ?,
            business_category = ?,
            postal_code = ?,
            address = ?,
            phone = ?,
            email = ?,
            is_verified = 0,
            verified_at = NULL,
            updated_at = datetime('now')
        WHERE seller_id = ?
      `).bind(r,a,n,o,i,c,u,l,d,t.sellerId).run():m=await s.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(t.sellerId,r,a,n,o,i,c,u,l,d).run(),e.json({success:!0,data:{id:f?f.id:m.meta.last_row_id,seller_id:t.sellerId,business_number:r,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(r){return console.error("사업자 정보 등록 오류:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/business-info",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);const r=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});p.get("/api/admin/seller-business",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/orders",k,async e=>{const{DB:s}=e.env,t=e.get("userId");try{const r=await s.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(t).all(),a=new Map;for(const o of r.results){const i=o.id;a.has(i)||a.set(i,{id:o.id,user_id:o.user_id,order_number:o.order_number,status:o.status,total_amount:o.total_amount,shipping_fee:o.shipping_fee,payment_method:o.payment_method,payment_key:o.payment_key,shipping_address:o.shipping_address,shipping_name:o.shipping_name,shipping_phone:o.shipping_phone,delivery_request:o.delivery_request,created_at:o.created_at,updated_at:o.updated_at,items:[]}),o.item_id&&a.get(i).items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value})}const n=Array.from(a.values());return e.json({success:!0,data:n})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/orders/user/:userId",k,async e=>{const{DB:s}=e.env,t=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==t)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await s.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(t).all(),n=new Map;for(const i of a.results){const c=i.id;n.has(c)||n.set(c,{id:i.id,user_id:i.user_id,order_number:i.order_number,status:i.status,total_amount:i.total_amount,shipping_fee:i.shipping_fee,payment_method:i.payment_method,payment_key:i.payment_key,shipping_address:i.shipping_address,shipping_name:i.shipping_name,shipping_phone:i.shipping_phone,delivery_request:i.delivery_request,created_at:i.created_at,updated_at:i.updated_at,items:[]}),i.item_id&&n.get(c).items.push({id:i.item_id,product_id:i.product_id,option_id:i.option_id,quantity:i.quantity,price:i.item_price,product_name:i.product_name,image_url:i.image_url,option_value:i.option_value})}const o=Array.from(n.values());return e.json({success:!0,data:o})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/orders/:orderNumber",k,async e=>{const{DB:s}=e.env,t=e.req.param("orderNumber");try{const r=await s.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.order_number = ?
      ORDER BY oi.id ASC
    `).bind(t).all();if(r.results.length===0)return e.json({success:!1,error:"Order not found"},404);const a=r.results[0],n={id:a.id,user_id:a.user_id,order_number:a.order_number,status:a.status,total_amount:a.total_amount,shipping_fee:a.shipping_fee,payment_method:a.payment_method,payment_key:a.payment_key,shipping_address:a.shipping_address,shipping_name:a.shipping_name,shipping_phone:a.shipping_phone,delivery_request:a.delivery_request,created_at:a.created_at,updated_at:a.updated_at,items:[]};for(const o of r.results)o.item_id&&n.items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value});return e.json({success:!0,data:n})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/orders/:orderId/cancel",k,async e=>{const{DB:s}=e.env,t=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await s.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(t).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(t).all();if(o.results.length>0){const i=o.results.map(c=>s.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity,c.product_id));await s.batch(i)}return await s.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,t).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:t,reason:a,itemsRestored:o.results.length}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/streams/:streamId/viewer/join",async e=>{const{SESSION_KV:s}=e.env;try{const t=e.req.param("streamId"),r=e.req.header("X-Session-ID")||crypto.randomUUID(),a=`stream:${t}:viewer:${r}`;return await s.put(a,Date.now().toString(),{expirationTtl:60}),e.json({success:!0,sessionId:r,message:"Viewer session updated"})}catch(t){return console.error("[Viewer Join] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:s,SESSION_KV:t}=e.env;try{const r=e.req.param("streamId");let a=null,n=null;try{a=await s.prepare("SELECT id, manual_viewer_count FROM live_streams WHERE id = ?").bind(r).first(),a&&(n=a.manual_viewer_count)}catch{console.warn("[Viewer Count] manual_viewer_count column not found, using fallback query"),a=await s.prepare("SELECT id FROM live_streams WHERE id = ?").bind(r).first()}if(!a)return e.json({success:!1,error:"Stream not found"},404);if(n!=null)return e.json({success:!0,data:{viewer_count:n,is_manual:!0}});const o=`stream:${r}:viewer:`,c=(await t.list({prefix:o})).keys.length;return e.json({success:!0,data:{viewer_count:c,is_manual:!1}})}catch(r){return console.error("[Viewer Count] Error:",r),e.json({success:!1,error:r.message},500)}});p.put("/api/streams/:streamId/viewer-count",k,async e=>{const{DB:s}=e.env,{userId:t,userType:r}=e.get("user");try{const a=e.req.param("streamId"),{manual_count:n}=await e.req.json();if(r!=="seller")return e.json({success:!1,error:"Only sellers can manipulate viewer count"},403);const o=await s.prepare(`
      SELECT ls.id, s.can_manipulate_stats
      FROM live_streams ls
      JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.id = ? AND ls.seller_id = ?
    `).bind(a,t).first();return o?o.can_manipulate_stats?(await s.prepare("UPDATE live_streams SET manual_viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{manual_count:n,message:n===null?"Reverted to actual viewer count":"Manual viewer count updated"}})):e.json({success:!1,error:"You do not have permission to manipulate stats. Please contact admin for approval."},403):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(a){return console.error("[Update Viewer Count] Error:",a),e.json({success:!1,error:a.message},500)}});p.post("/api/streams/:streamId/fake-cart-notification",k,async e=>{const{DB:s}=e.env,{userId:t,userType:r}=e.get("user");try{const a=e.req.param("streamId"),{product_name:n,quantity:o=1}=await e.req.json();if(r!=="seller")return e.json({success:!1,error:"Only sellers can send fake notifications"},403);const i=await s.prepare(`
      SELECT ls.id, s.can_manipulate_stats, s.display_name
      FROM live_streams ls
      JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.id = ? AND ls.seller_id = ?
    `).bind(a,t).first();if(!i)return e.json({success:!1,error:"Stream not found or unauthorized"},404);if(!i.can_manipulate_stats)return e.json({success:!1,error:"You do not have permission to send fake notifications. Please contact admin for approval."},403);const c=`🎉 ${n} ${o}개가 장바구니에 추가되었습니다!`;try{await(await Promise.resolve().then(()=>Qn)).getDatabase().ref(`chats/stream${a}`).push({userId:0,userName:"System",userType:"system",message:c,timestamp:Date.now(),isSeller:!1,isAdmin:!1}),console.log(`[Fake Cart Notification] ✅ Message sent to Firebase: ${c}`)}catch(u){console.error("[Fake Cart Notification] Firebase error:",u)}return e.json({success:!0,data:{message:c,note:"Fake notification sent to chat"}})}catch(a){return console.error("[Fake Cart Notification] Error:",a),e.json({success:!1,error:a.message},500)}});p.post("/api/payments/confirm",async e=>{var r;const{DB:s}=e.env;let t=null;try{t=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=t;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!n,amount:!!o}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await s.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",n),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:n},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(o)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(o),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(o),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const u="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const l={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(l,null,2)),console.log("[Payment] 📊 amount 타입:",typeof l.amount),console.log("[Payment] 📊 amount 값:",l.amount);const d=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:u,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(l)}),f=await d.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",d.status),console.log("  - 응답 OK?:",d.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(f).substring(0,300)),!d.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",d.status),console.error("[Payment] 에러 코드:",f.code),console.error("[Payment] 에러 메시지:",f.message),console.error("[Payment] 전체 응답:",JSON.stringify(f,null,2)),e.json({success:!1,error:f.message||"결제 승인에 실패했습니다.",code:f.code,tossError:f},d.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await s.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            reservation_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const m=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();if(m.results.length>0){console.log(`[Stock] 🔒 재고 확정 시작: ${m.results.length}개 상품`);const _=m.results.map(y=>s.prepare(`
            UPDATE products 
            SET stock = stock - ?,
                reserved_stock = reserved_stock - ?
            WHERE id = ?
          `).bind(y.quantity,y.quantity,y.product_id)),h=await s.batch(_);let w=0;for(let y=0;y<h.length;y++)if(h[y].meta.changes>0){w++;const g=m.results[y];console.log(`[Stock] ✅ 재고 확정: product_id=${g.product_id}, quantity=${g.quantity}`)}else{const g=m.results[y];console.error(`[Stock] ⚠️ 재고 확정 실패: product_id=${g.product_id}`)}console.log(`[Stock] ✅ 재고 확정 완료: ${w}/${m.results.length}개 성공`);try{const y=m.results.map(b=>b.product_id),g=y.map(()=>"?").join(","),T=await s.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${g})
          `).bind(...y).all();for(const b of T.results){const x=b.stock_alert_threshold||10,j=b.stock||0,C=b.reserved_stock||0,A=j-C;A<=x&&b.seller_id&&(await Xr(s,b.seller_id,b.name,A,x),console.log(`[Low Stock Alert] 📢 ${b.name}: 가용재고 ${A}개 (임계값 ${x}개)`))}}catch(y){console.error("[Low Stock Alert] ⚠️ 알림 전송 실패:",y)}}try{const _=i.id,h=await xn(e.env,_);h.success?console.log(`[Payment] ✅ 알림톡 발송 성공 (주문 ${_})`):console.warn(`[Payment] ⚠️ 알림톡 발송 실패 (주문 ${_}):`,h.reason||h.error)}catch(_){console.error("[Payment] ⚠️ 알림톡 발송 중 오류:",_)}}catch(m){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",m)}if(e.env.DISCORD_WEBHOOK_URL)try{await zn(e.env.DISCORD_WEBHOOK_URL,"결제 성공",`주문번호 ${n} 결제 완료`,{주문번호:n,결제금액:`₩${Number(o).toLocaleString()}`,결제키:a.substring(0,20)+"...",사용자ID:i.user_id})}catch(m){console.error("[Discord] 결제 성공 알림 실패:",m)}return e.json({success:!0,data:f})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:t==null?void 0:t.orderId,error:a.message,stack:(r=a.stack)==null?void 0:r.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});p.post("/api/payments/rollback",async e=>{var t;const{DB:s}=e.env;try{const{orderId:r,reason:a}=await e.req.json();if(console.log("========================================"),console.log("[Rollback] 🔄 재고 예약 해제 시작"),console.log("========================================"),console.log("[Rollback] 주문 번호:",r),console.log("[Rollback] 사유:",a||"결제 실패"),!r)return e.json({success:!1,error:"주문 번호가 필요합니다."},400);const n=await s.prepare("SELECT id, order_number, status FROM orders WHERE order_number = ?").bind(r).first();if(!n)return console.warn("[Rollback] ⚠️ 주문을 찾을 수 없음:",r),e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(n.status==="paid")return console.warn("[Rollback] ⚠️ 이미 결제 완료된 주문:",r),e.json({success:!1,error:"이미 결제가 완료된 주문입니다."},400);console.log("[Rollback] ✅ 주문 확인됨:",n.order_number);const o=await s.prepare(`
      SELECT product_id, quantity 
      FROM order_items 
      WHERE order_id = ?
    `).bind(n.id).all();if(o.results.length===0)return console.warn("[Rollback] ⚠️ 주문 아이템 없음"),e.json({success:!1,error:"주문 아이템을 찾을 수 없습니다."},404);console.log(`[Rollback] 📦 ${o.results.length}개 상품 예약 해제 시작...`);const i=o.results.map(l=>s.prepare(`
        UPDATE products 
        SET reserved_stock = CASE 
          WHEN reserved_stock >= ? THEN reserved_stock - ?
          ELSE 0
        END
        WHERE id = ?
      `).bind(l.quantity,l.quantity,l.product_id)),c=await s.batch(i);let u=0;for(let l=0;l<c.length;l++)if(c[l].meta.changes>0){u++;const d=o.results[l];console.log(`[Rollback] ✅ 예약 해제: product_id=${d.product_id}, quantity=${d.quantity}`)}return console.log(`[Rollback] ✅ 예약 해제 완료: ${u}/${o.results.length}개 성공`),await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'failed',
          reservation_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(),console.log("[Rollback] ✅ 주문 취소 완료:",r),e.json({success:!0,message:"재고 예약이 해제되었습니다.",data:{orderId:r,releasedItems:u}})}catch(r){return console.error("[Rollback] ❌ 예약 해제 실패:",{error:r.message,stack:(t=r.stack)==null?void 0:t.substring(0,500)}),e.json({success:!1,error:"재고 예약 해제 중 오류가 발생했습니다.",details:r.message},500)}});p.post("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:u}=r;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await s.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(t,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const l=["씨발","개새끼","병신","좆","시발"];let d=i;l.forEach(m=>{const _=new RegExp(m,"gi");d=d.replace(_,"*".repeat(m.length))});const f=await s.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a||null,n,o||null,d,c?1:0,u?1:0).run();return e.json({success:!0,data:{id:f.meta.last_row_id,message:d}})}catch(r){return console.error("Error sending chat message:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId"),r=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
      SELECT 
        id,
        user_id,
        user_name,
        user_avatar,
        message,
        is_seller,
        is_admin,
        is_deleted,
        datetime(created_at) as created_at
      FROM chat_messages
      WHERE live_stream_id = ? AND is_deleted = 0
    `;const o=[t];r&&(n+=" AND id > ?",o.push(Number(r))),n+=" ORDER BY created_at DESC LIMIT ?",o.push(a);const c=(await s.prepare(n).bind(...o).all()).results.reverse();return e.json({success:!0,data:c})}catch(n){return console.error("Error fetching chat messages:",n),e.json({success:!1,error:n.message},500)}});p.delete("/api/chat/:liveStreamId/messages/:messageId",S(),async e=>{const{DB:s}=e.env,t=e.req.param("messageId");try{return await s.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(t).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(r){return console.error("Error deleting chat message:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/chat/:liveStreamId/ban",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=r;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const u=new Date;u.setMinutes(u.getMinutes()+i),c=u.toISOString()}return await s.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(t,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(r){return console.error("Error banning user:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/chat/:liveStreamId/ban/:userId",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId"),r=e.req.param("userId");try{return await s.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(t,r).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});async function Ti(e,s,t){try{const r=new TextEncoder,a=r.encode(t),n=r.encode(e),o=await crypto.subtle.importKey("raw",a,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),i=await crypto.subtle.sign("HMAC",o,n),c=Array.from(new Uint8Array(i)),u=btoa(String.fromCharCode(...c));return s===u}catch(r){return console.error("[Webhook] 서명 검증 오류:",r),!1}}p.post("/api/payments/webhook",async e=>{const{DB:s}=e.env;try{const t=e.req.header("toss-signature"),r=await e.req.text();if(t&&e.env.TOSS_SECRET_KEY){if(!await Ti(r,t,e.env.TOSS_SECRET_KEY))return console.error("[Webhook] ❌ 서명 검증 실패 - 위조된 웹훅 요청"),e.json({success:!1,error:"Invalid signature"},401);console.log("[Webhook] ✅ 서명 검증 성공")}else console.warn("[Webhook] ⚠️ 서명 검증 건너뜀 (개발 환경 또는 서명 없음)");const a=JSON.parse(r);switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:a.eventType,orderId:a.orderId,status:a.status,timestamp:new Date().toISOString()}),a.eventType){case"PAYMENT_STATUS_CHANGED":await xi(s,a);break;case"VIRTUAL_ACCOUNT_ISSUED":await Ri(s,a);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",a.eventType)}return e.json({success:!0})}catch(t){return console.error("[Webhook] ❌ 웹훅 처리 실패:",t.message),e.json({success:!1,error:t.message},500)}});async function xi(e,s){const{orderId:t,status:r,paymentKey:a}=s;console.log("[Webhook] 결제 상태 변경:",{orderId:t,status:r}),await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(r,JSON.stringify(s),a).run(),(r==="DONE"||r==="completed")&&(await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(t).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",t))}async function Ri(e,s){const{orderId:t,virtualAccount:r}=s;console.log("[Webhook] 가상계좌 발급:",{orderId:t,bank:r==null?void 0:r.bank,accountNumber:r==null?void 0:r.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(r==null?void 0:r.bank,r==null?void 0:r.accountNumber,r==null?void 0:r.customerName,r==null?void 0:r.dueDate,JSON.stringify(s),t).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",t)}p.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:s}=e.env;try{const t=e.req.param("paymentKey"),r=await e.req.json(),{cancelReason:a,cancelAmount:n}=r;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:t,cancelReason:a,cancelAmount:n}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const o=await s.prepare(`
      SELECT 
        id, 
        order_id, 
        pg_provider, 
        pg_payment_key, 
        pg_transaction_id,
        method, 
        amount, 
        status,
        card_company,
        card_number,
        installment_months,
        requested_at,
        approved_at,
        cancelled_at,
        created_at
      FROM payments 
      WHERE pg_payment_key = ?
    `).bind(t).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const u=li(i,c),l=n&&n<o.amount,d=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:t,cancelAmount:d,isPartial:l});const f=await u.cancelPayment({paymentKey:t,cancelReason:a,cancelAmount:d});return f.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:t,cancelAmount:d,canceledAt:f.canceledAt}),await s.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED",f.canceledAt||new Date().toISOString(),JSON.stringify(f),t).run(),await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${t}`),e.json({success:!0,data:{paymentKey:t,orderId:o.order_id,cancelAmount:d,canceledAt:f.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,f.error),e.json({success:!1,error:f.error||"결제 취소에 실패했습니다."},400))}catch(t){return console.error("[Payment] ❌ 결제 취소 처리 실패:",t.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});p.get("/api/payments/:paymentKey",async e=>{const{DB:s}=e.env;try{const t=e.req.param("paymentKey"),r=await s.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(t).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404)}catch(t){return console.error("[Payment] ❌ 결제 조회 실패:",t.message),e.json({success:!1,error:"결제 조회 중 오류가 발생했습니다."},500)}});p.get("/api/payments/order/:orderId",async e=>{const{DB:s}=e.env;try{const t=e.req.param("orderId"),r=await s.prepare(`
      SELECT 
        id, 
        order_id, 
        pg_provider, 
        pg_payment_key, 
        pg_transaction_id,
        method, 
        amount, 
        status,
        card_company,
        card_number,
        installment_months,
        requested_at,
        approved_at,
        cancelled_at,
        created_at
      FROM payments 
      WHERE order_id = ? 
      ORDER BY created_at DESC
    `).bind(t).all();return e.json({success:!0,data:r.results||[]})}catch(t){return console.error("[Payment] ❌ 결제 목록 조회 실패:",t.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});p.get("/api/seller/orders",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("status"),a=e.req.query("start_date"),n=e.req.query("end_date"),o=e.req.query("min_amount"),i=e.req.query("max_amount"),c=parseInt(e.req.query("page")||"1"),u=parseInt(e.req.query("limit")||"50"),l=(c-1)*u,d=["oi.seller_id = ?"],f=[t.sellerId];r&&(d.push("o.status = ?"),f.push(r)),a&&(d.push("DATE(o.created_at) >= ?"),f.push(a)),n&&(d.push("DATE(o.created_at) <= ?"),f.push(n)),o&&(d.push("o.total_amount >= ?"),f.push(parseInt(o))),i&&(d.push("o.total_amount <= ?"),f.push(parseInt(i)));const m=d.join(" AND "),_=await s.prepare(`
      SELECT 
        o.*,
        u.name as user_name,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        oi.seller_id,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE ${m}
      ORDER BY o.created_at DESC, oi.id ASC
      LIMIT ? OFFSET ?
    `).bind(...f,u,l).all(),h=await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${m}
    `).bind(...f).first(),w=(h==null?void 0:h.total)||0,y=Math.ceil(w/u),g=new Map;for(const b of _.results){const x=b.id;g.has(x)||g.set(x,{id:b.id,user_id:b.user_id,user_name:b.user_name,order_number:b.order_number,status:b.status,total_amount:b.total_amount,shipping_fee:b.shipping_fee,payment_method:b.payment_method,payment_key:b.payment_key,shipping_address:b.shipping_address,shipping_name:b.shipping_name,shipping_phone:b.shipping_phone,delivery_request:b.delivery_request,created_at:b.created_at,updated_at:b.updated_at,items:[]}),b.item_id&&g.get(x).items.push({id:b.item_id,product_id:b.product_id,option_id:b.option_id,quantity:b.quantity,price:b.item_price,seller_id:b.seller_id,product_name:b.product_name,image_url:b.image_url,option_value:b.option_value})}const T=Array.from(g.values());return e.json({success:!0,data:T,pagination:{page:c,limit:u,total:w,totalPages:y},filters:{status:r||null,startDate:a||null,endDate:n||null,minAmount:o?parseInt(o):null,maxAmount:i?parseInt(i):null}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/orders/export",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("format")||"csv",a=e.req.query("start_date"),n=e.req.query("end_date");let o=`
      SELECT 
        o.order_number,
        o.created_at,
        o.status,
        o.payment_status,
        o.total_amount,
        o.shipping_address,
        o.shipping_name,
        o.shipping_phone,
        o.tracking_number,
        o.carrier,
        u.name as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
    `;const i=[t.sellerId];a&&(o+=" AND date(o.created_at) >= ?",i.push(a)),n&&(o+=" AND date(o.created_at) <= ?",i.push(n)),o+=" GROUP BY o.id ORDER BY o.created_at DESC";const c=await s.prepare(o).bind(...i).all();if(r==="csv"){const u=["주문번호","주문일시","주문상태","결제상태","주문금액","배송지","수령인","연락처","택배사","운송장번호","구매자명","구매자이메일","구매자연락처"],l=c.results.map(h=>[h.order_number||"",h.created_at?new Date(h.created_at).toLocaleString("ko-KR"):"",h.status||"",h.payment_status||"",h.total_amount||0,h.shipping_address||"",h.shipping_name||"",h.shipping_phone||"",h.carrier||"",h.tracking_number||"",h.buyer_name||"",h.buyer_email||"",h.buyer_phone||""]),f="\uFEFF"+[u.join(","),...l.map(h=>h.map(w=>{const y=String(w);return y.includes(",")||y.includes(`
`)||y.includes('"')?`"${y.replace(/"/g,'""')}"`:y}).join(","))].join(`
`),m=new Date,_=`orders_${m.toISOString().split("T")[0]}_${m.getTime()}.csv`;return new Response(f,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${encodeURIComponent(_)}"`,"Cache-Control":"no-cache"}})}else return e.json({success:!1,error:"Unsupported format"},400)}catch(r){return console.error("Export error:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,t.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,r).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${r}, 자동 발행 시작...`);const c=await s.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(r).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const u=await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();if(!u)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${t.sellerId}`),await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(r,t.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${r}`);const l=await s.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),d=Number(c.total_amount),f=Math.floor(d/1.1),m=d-f,_=new Date().toISOString().split("T")[0].replace(/-/g,""),h=Math.random().toString(36).substring(2,8).toUpperCase(),w=`${_}-${h}`,g=(await s.prepare(`
              INSERT INTO tax_invoices (
                seller_id, order_number, invoice_number, issue_date,
                supplier_business_number, supplier_business_name, supplier_ceo_name,
                supplier_address, supplier_business_type, supplier_business_category,
                supplier_email, supplier_phone,
                buyer_business_number, buyer_business_name, buyer_ceo_name,
                buyer_address, buyer_business_type, buyer_business_category,
                buyer_email, buyer_phone,
                supply_price, tax_amount, total_amount,
                status, api_provider, nts_confirm_number,
                created_at, updated_at
              ) VALUES (?, ?, ?, DATE('now'),
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                'issued', 'barobill', ?,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
            `).bind(t.sellerId,r,w,u.business_number,u.business_name,u.ceo_name,u.address||"",u.business_type||"",u.business_category||"",u.email||"",u.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",f,m,d,`AUTO-${Date.now()}-${h}`).run()).meta.last_row_id;if(l.results.length>0){const T=l.results.map(b=>{const x=Math.floor(Number(b.price)*Number(b.quantity)/1.1),j=Number(b.price)*Number(b.quantity)-x;return s.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(g,b.product_name||"상품명 없음",b.quantity,b.price,x,j,b.option_name||"")});await s.batch(T)}await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r,t.sellerId,g).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${g}, invoice_number=${w}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${r}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await s.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(r,t.sellerId,c.message).run()}catch(u){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",u)}}try{const c=await s.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(r).first();if(c&&c.user_id){const l={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];l&&await Gr(s,c.user_id,r,l)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,t.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await s.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,r).run();try{const c=await s.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(r).first();c&&c.user_id&&await Gr(s,c.user_id,r,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/admin/orders",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/sellers",async e=>{const{DB:s}=e.env,{limit:t="20",offset:r="0"}=e.req.query();try{const a=`sellers:list:${t}:${r}`,n=we(a);if(n)return e.executionCtx.waitUntil((async()=>{try{const i=await Bt(s,parseInt(t),parseInt(r));Q(a,i,3600)}catch(i){console.error("[Cache Revalidate] Sellers error:",i)}})()),e.json({success:!0,data:n,cached:!0});const o=await Bt(s,parseInt(t),parseInt(r));return Q(a,o,3600),e.json({success:!0,data:o,cached:!1})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});async function Bt(e,s,t){const r=`
    SELECT id, business_name, name as display_name, 
           commission_rate, created_at
    FROM sellers 
    WHERE is_active = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `,{results:a}=await e.prepare(r).bind(s,t).all();return a}p.get("/api/admin/sellers",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/sellers",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{username:r,password:a,name:n,email:o,phone:i,business_name:c,business_number:u}=await e.req.json();if(!r||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await s.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await s.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const f=`$2a$10$placeholder_hash_for_${a}`,m=await s.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r,f,n,o,i||null,c,u||null,t.adminId).run();return e.json({success:!0,data:{id:m.meta.last_row_id,username:r,name:n,email:o,business_name:c}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:u,status:l}=await e.req.json();return await s.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first()?(await s.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,u,l,r).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();return a?(await s.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await s.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,r).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(r){return e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await s.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(r).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await s.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,r).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${r}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:r,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(r){return console.error("수수료율 변경 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/permissions",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{can_manipulate_stats:a}=await e.req.json();if(a!==0&&a!==1)return e.json({success:!1,error:"권한 값은 0 또는 1이어야 합니다"},400);const n=await s.prepare("SELECT id, username, name FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);await s.prepare(`
      UPDATE sellers 
      SET can_manipulate_stats = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,r).run();const o=a?"승인":"해제";return console.log(`시청자 수 조작 권한 ${o}: 판매자 ${n.username} (ID: ${r})`),e.json({success:!0,message:`판매자 '${n.username||n.name}'의 특수 권한이 ${o}되었습니다`,data:{seller_id:r,seller_username:n.username,can_manipulate_stats:a}})}catch(r){return console.error("권한 변경 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();if(!a)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(a.status==="approved")return e.json({success:!1,error:"이미 승인된 판매자입니다"},400);if(await s.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(t.adminId,r).run(),console.log(`셀러 승인: ${a.username} (ID: ${r}) by Admin ID: ${t.adminId}`),a.email)try{const{sendEmail:n,getSellerApprovalEmailHTML:o}=await Promise.resolve().then(()=>ra),i=e.env.RESEND_API_KEY||"",c=o(a.name,a.username),u=await n({to:a.email,subject:"🎉 리스터코퍼레이션 판매자 승인 완료",html:c},i,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");u.success?console.log(`[셀러 승인] 이메일 발송 성공: ${a.email}`):console.warn(`[셀러 승인] 이메일 발송 실패: ${u.error}`)}catch(n){console.error("[셀러 승인] 이메일 발송 오류:",n)}try{const{createNotification:n,NotificationTemplates:o}=await Promise.resolve().then(()=>aa),i=o.seller_approved(a.name);await n(s,{userId:parseInt(r),type:"seller_approved",title:i.title,message:i.message,linkUrl:i.linkUrl})}catch(n){console.error("[셀러 승인] 알림 생성 오류:",n)}return e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:r,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})}catch(r){return console.error("셀러 승인 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(n.status==="rejected")return e.json({success:!1,error:"이미 거부된 판매자입니다"},400);if(await s.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,t.adminId,r).run(),console.log(`셀러 거부: ${n.username} (ID: ${r}), 사유: ${a}`),n.email)try{const{sendEmail:o,getSellerRejectionEmailHTML:i}=await Promise.resolve().then(()=>ra),c=e.env.RESEND_API_KEY||"",u=i(n.name,a),l=await o({to:n.email,subject:"리스터코퍼레이션 판매자 승인 결과 안내",html:u},c,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");l.success?console.log(`[셀러 거부] 이메일 발송 성공: ${n.email}`):console.warn(`[셀러 거부] 이메일 발송 실패: ${l.error}`)}catch(o){console.error("[셀러 거부] 이메일 발송 오류:",o)}try{const{createNotification:o,NotificationTemplates:i}=await Promise.resolve().then(()=>aa),c=i.seller_rejected(a);await o(s,{userId:parseInt(r),type:"seller_rejected",title:c.title,message:c.message,linkUrl:c.linkUrl})}catch(o){console.error("[셀러 거부] 알림 생성 오류:",o)}return e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:r,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})}catch(r){return console.error("셀러 거부 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/sellers/pending",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:r.results,count:r.results.length})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/admin/dashboard/stats",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=new Date;r.setHours(0,0,0,0);const a=r.toISOString(),n=await s.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM orders
      WHERE payment_status = 'approved'
      AND status = 'paid'
      AND created_at >= ?
    `).bind(a).first(),o=(n==null?void 0:n.sales)||0,i=await s.prepare(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(a).first(),c=(i==null?void 0:i.count)||0,u=new Date(Date.now()-300*1e3).toISOString(),l=await s.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(u).first(),d=(l==null?void 0:l.count)||0,f=await s.prepare(`
      SELECT COUNT(*) as count
      FROM live_streams
      WHERE status = 'live'
    `).first(),m=(f==null?void 0:f.count)||0;return e.json({success:!0,stats:{todaySales:o,todayOrders:c,currentVisitors:d,liveStreams:m},timestamp:new Date().toISOString()})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/public/seller/:sellerId",async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.param("sellerId"),a=`public:seller:${r}`,n=await _i(t,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=await s.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(r).all(),c=await s.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(r).all(),u=await s.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(r).all(),l=await s.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(r).first(),d={profile:o,live_streams:i.results,scheduled_streams:c.results,products:u.results,stats:l};return await gs(t,a,d,60,!1),e.json({success:!0,data:d})}catch(r){return console.error("셀러 프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/public/seller/username/:username",async e=>{const{DB:s}=e.env;try{const t=e.req.param("username"),r=await s.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(t).first();return r?e.json({success:!0,data:{seller_id:r.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/settlement/stats",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{period:r}=e.req.query();let a="";const n=new Date;switch(r){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await s.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as total_seller_amount
      FROM orders o
      WHERE payment_status = 'completed' 
        AND is_cancelled = 0
        ${a}
    `).first(),i=await s.prepare(`
      SELECT 
        s.id as seller_id,
        s.username as seller_name,
        s.business_name,
        s.commission_rate,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        COALESCE(SUM(o.commission_amount), 0) as commission_amount,
        COALESCE(SUM(o.seller_amount), 0) as seller_amount,
        SUM(CASE WHEN o.settlement_status = 'pending' THEN o.seller_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN o.settlement_status = 'completed' THEN o.seller_amount ELSE 0 END) as settled_amount
      FROM sellers s
      LEFT JOIN orders o ON s.id = o.seller_id 
        AND o.payment_status = 'completed' 
        AND o.is_cancelled = 0
        ${a}
      GROUP BY s.id
      HAVING order_count > 0
      ORDER BY total_sales DESC
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:r||"all"}})}catch(r){return console.error("정산 통계 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/records",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{seller_id:r,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];r&&(o.push("o.seller_id = ?"),i.push(r)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const d=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${d}'`);break;case"week":const f=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${f}'`);break;case"month":const m=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${m}'`);break}const u=o.length>0?`WHERE ${o.join(" AND ")}`:"",l=await s.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.seller_id,
        s.username as seller_name,
        s.business_name,
        o.total_amount,
        o.commission_rate,
        o.commission_amount,
        o.seller_amount,
        o.settlement_status,
        o.settled_at,
        o.created_at,
        u.name as user_name
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      ${u}
      ORDER BY o.created_at DESC
      LIMIT 100
    `).bind(...i).all();return e.json({success:!0,data:l.results})}catch(r){return console.error("정산 내역 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await s.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(r).first();return n?(await s.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,r).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:r,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(r){return console.error("정산 상태 변경 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/settlement/batch-complete",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{order_ids:r}=await e.req.json();if(!Array.isArray(r)||r.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of r)try{await s.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:r.length,success:a,failed:n}})}catch(r){return console.error("일괄 정산 처리 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/export-csv",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{seller_id:r,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];r&&(n.push("o.seller_id = ?"),o.push(r));const i=new Date;switch(a){case"today":const _=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${_}'`);break;case"week":const h=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${h}'`);break;case"month":const w=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${w}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",l=(await s.prepare(`
      SELECT 
        o.order_number as '주문번호',
        o.created_at as '주문일시',
        s.username as '판매자ID',
        s.business_name as '사업자명',
        u.name as '구매자명',
        o.total_amount as '총금액',
        o.commission_rate as '수수료율',
        o.commission_amount as '수수료',
        o.seller_amount as '정산금액',
        o.settlement_status as '정산상태',
        o.settled_at as '정산일시'
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      ${c}
      ORDER BY o.created_at DESC
    `).bind(...o).all()).results;if(l.length===0)return e.json({success:!1,error:"데이터가 없습니다"},404);const d=Object.keys(l[0]);let f=d.join(",")+`
`;l.forEach(_=>{const h=d.map(w=>{const y=_[w];if(y==null)return"";const g=String(y);return g.includes(",")||g.includes('"')||g.includes(`
`)?`"${g.replace(/"/g,'""')}"`:g});f+=h.join(",")+`
`});const m="\uFEFF";return new Response(m+f,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(r){return console.error("CSV 내보내기 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/orders/create",k,async e=>{const{DB:s}=e.env;try{const{userId:t,cartItems:r,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:u,buyerCeoName:l}=await e.req.json();console.log("[DEPRECATED /api/orders/create] 주문 생성 요청:",{userId:t,cartItems:r==null?void 0:r.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let d=10;if(o){const I=await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();I&&I.commission_rate!==null&&(d=I.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:d});const f=Math.floor(a*(d/100)),m=a-f;let _=null;if(n){const I=await s.prepare(`
        SELECT 
          id, 
          user_id, 
          recipient_name, 
          phone, 
          postal_code, 
          address, 
          address_detail, 
          is_default, 
          created_at, 
          updated_at 
        FROM shipping_addresses 
        WHERE id = ? AND user_id = ?
      `).bind(n,t).first();if(!I)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);_=I}if(!t)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const h=t,w=new Date,y=w.getFullYear().toString().slice(-2),g=(w.getMonth()+1).toString().padStart(2,"0"),T=w.getDate().toString().padStart(2,"0"),b=`${y}${g}${T}`,x=Math.random().toString(36).substring(2,7).toUpperCase(),j=`ORD-${b}-${x}`,C=r.map(I=>I.product_id),A=C.map(()=>"?").join(","),W=await s.prepare(`
      SELECT id, stock FROM products WHERE id IN (${A})
    `).bind(...C).all(),$=new Map(W.results.map(I=>[I.id,I.stock]));for(const I of r){const te=$.get(I.product_id);if(te===void 0)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${I.product_id})`},400);if(te<I.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${I.product_id})`},400)}const F=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(j,h,a,"pending",o||null,d,f,m,n||null,(_==null?void 0:_.recipient_name)||null,(_==null?void 0:_.phone)||null,_!=null&&_.address?`${_.address} ${_.address_detail}`:null,(_==null?void 0:_.postal_code)||null,i?1:0,c||null,u||null,l||null).run()).meta.last_row_id,Z=r.map(I=>s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(F,I.product_id,I.option_id||null,I.quantity,I.price_snapshot||I.price)),z=r.map(I=>s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(I.quantity,I.product_id));await s.batch([...Z,...z]);try{const I=ns(e.env),te=r.map(q=>q.product_id),H=te.map(()=>"?").join(","),U=await s.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${H})
      `).bind(...te).all();await Promise.all(U.results.map(q=>I.updateProductStock(q.id,q.stock,{name:q.name,price:q.price,original_price:q.original_price,discount_rate:q.discount_rate,image_url:q.image_url}))),console.log(`🔥 Firebase: Stock updated for ${U.results.length} products`)}catch(I){console.error("⚠️ Firebase stock sync failed (non-blocking):",I)}try{const I=r.map(U=>U.product_id),te=I.map(()=>"?").join(","),H=await s.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${te})
      `).bind(...I).all();for(const U of H.results){const q=U.stock_alert_threshold||5,re=U.stock;re<=q&&U.seller_id&&(await Xr(s,U.seller_id,U.name,re,q),console.log(`[Low Stock Alert] ${U.name}: ${re} <= ${q}`))}}catch(I){console.error("[Low Stock Alert] Error:",I)}return console.log("주문 생성 완료:",{orderId:F,orderNumber:j}),e.json({success:!0,orderId:F,orderNumber:j,totalAmount:a})}catch(t){return console.error("주문 생성 실패:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/orders/:orderNumber/refund",S(),k,async e=>{const{DB:s}=e.env;try{const t=e.req.param("orderNumber"),{reason:r}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:t,reason:r});const a=await s.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(t).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다"},404);if(a.payment_status==="cancelled")return e.json({success:!1,error:"이미 취소된 주문입니다"},400);await s.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r||"구매자 요청",t).run(),console.log("[Order Refund] 주문 상태 업데이트 완료:",t);const n=await s.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();if(n.results.length>0){const o=n.results.map(i=>s.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(i.quantity,i.product_id));await s.batch(o),console.log("[Order Refund] 재고 복구 완료:",{items:n.results.length})}return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:t,reason:r}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:t,cancelDate:new Date().toISOString()}})}catch(t){return console.error("[Order Refund] Error:",t),e.json({success:!1,error:t.message||"주문 취소 중 오류가 발생했습니다"},500)}});p.use("/api/seller/*",k);p.get("/api/seller/sales",S(),async e=>{try{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await us(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await s.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();if(!u)return e.json({success:!1,error:"셀러를 찾을 수 없습니다."},404);const l=await s.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as net_amount
      FROM orders
      WHERE seller_id = ?
        AND payment_status = 'approved'
        AND DATE(created_at) >= DATE(?)
        AND DATE(created_at) <= DATE(?)
    `).bind(a,i,c).first(),d=await s.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.commission_amount,
        o.seller_amount,
        o.payment_status,
        o.created_at,
        u.name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.seller_id = ?
        AND DATE(o.created_at) >= DATE(?)
        AND DATE(o.created_at) <= DATE(?)
      ORDER BY o.created_at DESC
      LIMIT 100
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:u,stats:l,orders:(d==null?void 0:d.results)||[]}})}catch(s){return console.error("Seller sales query error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/settlement-csv",S(),async e=>{try{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await us(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await s.prepare(`
      SELECT 
        o.order_number,
        o.total_amount,
        o.commission_amount,
        o.seller_amount,
        o.payment_status,
        o.status,
        o.created_at,
        u.name as user_name,
        o.buyer_business_name,
        o.buyer_business_number,
        ti.id as tax_invoice_id,
        ti.invoice_number,
        ti.issue_date,
        ti.status as tax_invoice_status,
        ti.nts_confirm_number
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN tax_invoices ti ON o.order_number = ti.order_number
      WHERE o.seller_id = ?
        AND o.payment_status IN ('approved', 'completed')
        AND DATE(o.created_at) >= DATE(?)
        AND DATE(o.created_at) <= DATE(?)
      ORDER BY o.created_at DESC
    `).bind(a,i,c).all();let l=`주문번호,주문일시,주문자,총금액,수수료(10%),정산금액(90%),주문상태,사업자명,사업자번호,세금계산서번호,발행일자,계산서상태,국세청승인번호
`;for(const d of(u==null?void 0:u.results)||[]){const f=d.status==="delivered"?"배송완료":d.status==="shipped"?"배송중":d.status==="preparing"?"상품준비중":d.status==="paid"?"결제완료":"대기중",m=d.buyer_business_name||"-",_=d.buyer_business_number||"-",h=d.invoice_number||"-",w=d.issue_date||"-",y=d.tax_invoice_status==="issued"?"발행완료":d.tax_invoice_status==="cancelled"?"취소":"-",g=d.nts_confirm_number||"-";l+=`${d.order_number},${d.created_at},${d.user_name||"익명"},${d.total_amount},${d.commission_amount},${d.seller_amount},${f},${m},${_},${h},${w},${y},${g}
`}return new Response(l,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(s){return console.error("CSV download error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/issue",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{order_number:r}=await e.req.json();if(!r)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(r).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!a.issue_tax_invoice)return e.json({success:!1,error:"세금계산서 발행이 요청되지 않은 주문입니다."},400);const n=await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(t.sellerId).first();if(!n)return e.json({success:!1,error:"승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요."},400);const o=await s.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),u=i-c,l=new Date().toISOString().split("T")[0],d=`${l}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,f=en(n,a,o.results);let m,_,h;try{m=await Za(f),_=m.ntsConfirmNumber,h=m.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:_,invoiceKey:h,mockMode:ps()})}catch(g){console.error("바로빌 API 호출 실패:",g),_="FAILED",h=null}const y=(await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t.sellerId,r,"tax",d,l,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,u,i,_==="FAILED"?"failed":"issued",ps()?"mock":"barobill",h,_).run()).meta.last_row_id;for(const g of o.results){const T=Math.floor(Number(g.price)*Number(g.quantity)/1.1),b=Number(g.price)*Number(g.quantity)-T;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(y,g.id,g.product_name,g.quantity,g.price,T,b).run()}return e.json({success:!0,data:{invoice_id:y,invoice_number:d,issue_date:l,total_amount:i,supply_price:c,tax_amount:u,status:_==="FAILED"?"failed":"issued",nts_confirm_number:_,api_invoice_key:h,mock_mode:ps(),message:_==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":ps()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(r){return console.error("세금계산서 발행 오류:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/tax-invoices",async e=>{var r;const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[t.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const u=await s.prepare(i).bind(...c).all();return e.json({success:!0,data:u.results||[],total:((r=u.results)==null?void 0:r.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/tax-invoices/:id",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await s.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(r).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json(),n=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,t.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!ps()){const u=await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(t.sellerId).first();u&&u.business_number&&await Qa(u.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(u){console.error("바로빌 취소 API 호출 실패:",u)}return await s.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{status:r,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[t.sellerId];r&&(n+=" AND log.status = ?",o.push(r)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await s.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${r}`);const a=await s.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"재시도할 실패 로그를 찾을 수 없습니다."},404);const n=Number(a.retry_count||0);if(n>=3)return e.json({success:!1,error:"최대 재시도 횟수(3회)를 초과했습니다."},400);const o=await s.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(r).first();if(!o)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!o.buyer_business_number||!o.buyer_business_name)return e.json({success:!1,error:"주문에 사업자 정보가 없습니다."},400);const i=await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();if(!i)return e.json({success:!1,error:"판매자 사업자 정보가 승인되지 않았습니다."},400);const c=await s.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(),u=Number(o.total_amount),l=Math.floor(u/1.1),d=u-l,f=new Date().toISOString().split("T")[0].replace(/-/g,""),m=Math.random().toString(36).substring(2,8).toUpperCase(),_=`${f}-${m}`,w=(await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name,
        supplier_address, supplier_business_type, supplier_business_category,
        supplier_email, supplier_phone,
        buyer_business_number, buyer_business_name, buyer_ceo_name,
        buyer_address, buyer_business_type, buyer_business_category,
        buyer_email, buyer_phone,
        supply_price, tax_amount, total_amount,
        status, api_provider, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, DATE('now'),
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        'issued', 'barobill', ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).bind(t.sellerId,r,_,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",l,d,u,`RETRY-${Date.now()}-${m}`).run()).meta.last_row_id;for(const y of c.results){const g=Math.floor(Number(y.price)*Number(y.quantity)/1.1),T=Number(y.price)*Number(y.quantity)-g;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(w,y.product_name||"상품명 없음",y.quantity,y.price,g,T,y.option_name||"").run()}return await s.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r,t.sellerId,w,n+1).run(),await s.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${w}, retry_count=${n+1}`),e.json({success:!0,data:{invoice_id:w,invoice_number:_,retry_count:n+1}})}catch(r){console.error("[TAX INVOICE RETRY] 재시도 실패:",r);try{const a=e.req.param("orderNumber"),n=await s.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,t.sellerId).first(),o=Number((n==null?void 0:n.retry_count)||0);await s.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,t.sellerId,r.message,o+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:r.message},500)}});p.get("/live/:id",async e=>{try{const s=new URL("/static/live.html",e.req.url);let r=await(await fetch(s.toString())).text();const n=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return r=r.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${n}`),console.log("[Live Page] Environment variables injected"),new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving live page:",s),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/cart",async e=>{try{const s=new URL("/static/cart.html",e.req.url);let r=await(await fetch(s.toString())).text();return r=r.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),r=r.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving cart page:",s),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/my-orders",async e=>{try{const s=new URL("/static/my-orders.html",e.req.url),r=await(await fetch(s.toString())).text();return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving my orders page:",s),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/payment-result",async e=>{try{const s=new URL("/payment-result.html",e.req.url),r=await(await fetch(s.toString())).text();return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving payment result page:",s),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/api/seller/profile",async e=>{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const r=await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(t).first();if(!r||!r.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        kakao_chat_link,
        status,
        created_at
      FROM sellers 
      WHERE id = ?
    `).bind(r.seller_id).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404)}catch(r){return console.error("프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/seller/profile",async e=>{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const r=await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(t).first();if(!r||!r.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:u,website_url:l,kakao_chat_link:d}=await e.req.json(),f=[],m=[];if(a!==void 0&&(f.push("profile_image = ?"),m.push(a)),n!==void 0&&(f.push("bio = ?"),m.push(n)),o!==void 0&&(f.push("sns_instagram = ?"),m.push(o)),i!==void 0&&(f.push("sns_youtube = ?"),m.push(i)),c!==void 0&&(f.push("sns_facebook = ?"),m.push(c)),u!==void 0&&(f.push("sns_twitter = ?"),m.push(u)),l!==void 0&&(f.push("website_url = ?"),m.push(l)),d!==void 0&&(f.push("kakao_chat_link = ?"),m.push(d)),f.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);f.push("updated_at = datetime('now')"),m.push(r.seller_id),await s.prepare(`
      UPDATE sellers 
      SET ${f.join(", ")}
      WHERE id = ?
    `).bind(...m).run();const _=await s.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        kakao_chat_link,
        status,
        created_at
      FROM sellers 
      WHERE id = ?
    `).bind(r.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:_})}catch(r){return console.error("프로필 업데이트 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/public/:sellerId",async e=>{const{DB:s}=e.env,t=e.req.param("sellerId");try{const r=await s.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        is_active,
        status,
        created_at
      FROM sellers 
      WHERE id = ? AND is_active = 1 AND status = 'approved'
    `).bind(t).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/:sellerId/streams",async e=>{const{DB:s}=e.env,t=e.req.param("sellerId");try{const r=await s.prepare(`
      SELECT 
        id,
        title,
        description,
        youtube_video_id,
        status,
        viewer_count,
        scheduled_at,
        created_at
      FROM live_streams 
      WHERE seller_id = ?
      ORDER BY 
        CASE status
          WHEN 'live' THEN 1
          WHEN 'scheduled' THEN 2
          WHEN 'ended' THEN 3
        END,
        created_at DESC
      LIMIT 50
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return console.error("라이브 목록 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/:sellerId/products-public",async e=>{const{DB:s}=e.env,t=e.req.param("sellerId");try{const r=await s.prepare(`
      SELECT 
        id,
        name,
        price,
        original_price,
        discount_rate,
        stock,
        image_url,
        category,
        is_active
      FROM products 
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return console.error("상품 목록 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/notifications",k,async e=>{const{DB:s}=e.env;try{const t=e.get("userId"),r=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),n=e.req.query("unread_only")==="true";let o=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;n&&(o+=" AND is_read = 0"),o+=" ORDER BY created_at DESC LIMIT ?";const i=await s.prepare(o).bind(t,r,a).all();return e.json({success:!0,data:i.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/notifications/unread-count",k,async e=>{const{DB:s}=e.env;try{const t=e.get("userId"),r=e.get("userType"),a=await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(t,r).first();return e.json({success:!0,count:(a==null?void 0:a.count)||0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/notifications/:id/read",k,async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=e.get("userId"),a=e.get("userType");return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(t,r,a).first()?(await s.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(t).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/notifications/read-all",k,async e=>{const{DB:s}=e.env;try{const t=e.get("userId"),r=e.get("userType");return await s.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(t,r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/notifications/:id",k,async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=e.get("userId"),a=e.get("userType");return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(t,r,a).first()?(await s.prepare("DELETE FROM notifications WHERE id = ?").bind(t).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/banners",async e=>{const{DB:s}=e.env;try{const t=new Date().toISOString(),r=await s.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(t,t).all();return e.json({success:!0,data:r.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/admin/banners",k,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=await s.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/admin/banners",k,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:r,image_url:a,link_url:n,description:o,is_active:i,display_order:c,start_date:u,end_date:l}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const d=await s.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a,n||null,o||null,i!==!1?1:0,c||0,u||null,l||null).run();return e.json({success:!0,id:d.meta.last_row_id})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/admin/banners/:id",k,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id"),{title:a,image_url:n,link_url:o,description:i,is_active:c,display_order:u,start_date:l,end_date:d}=await e.req.json();return await s.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,n,o||null,i||null,c?1:0,u||0,l||null,d||null,r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/admin/banners/:id",k,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id");return await s.prepare("DELETE FROM banners WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/order-complete",e=>e.redirect("/order-complete.html",302));p.notFound(e=>{const s=e.req.path;return s.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${s} was not found.`},404):new Response(null,{status:404})});p.onError((e,s)=>{const t=s.req.path;if(e instanceof Yn)return console.error("[AppError]",{path:t,method:s.req.method,code:e.code,message:e.message,statusCode:e.statusCode}),s.json({success:!1,error:{code:e.code,message:e.message,...e.details&&{details:e.details}}},e.statusCode);if(console.error("[Global Error Handler]",{path:t,method:s.req.method,error:e.message,stack:e.stack}),t.startsWith("/api/")){let r=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(r=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(r=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(r=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(r=400,a="잘못된 요청입니다."),s.json({success:!1,error:e.message||a},r)}return s.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>오류 발생 - 리스터코퍼레이션</title>
      <script src="https://cdn.tailwindcss.com"><\/script>
    </head>
    <body class="bg-gray-50">
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="max-w-md w-full text-center">
          <div class="mb-8">
            <svg class="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 class="text-3xl font-bold text-gray-900 mb-4">오류가 발생했습니다</h1>
          <p class="text-gray-600 mb-8">
            죄송합니다. 일시적인 오류가 발생했습니다.<br/>
            잠시 후 다시 시도해주세요.
          </p>
          <div class="space-y-3">
            <a 
              href="/" 
              class="inline-block w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              홈으로 돌아가기
            </a>
            <button 
              onclick="window.history.back()" 
              class="inline-block w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              이전 페이지로
            </button>
          </div>
          
        </div>
      </div>
    </body>
    </html>
  `,500)});p.get("/api/admin/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const t=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:t.results})}catch(t){return console.error("[Admin Alimtalk Pricing] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/admin/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const{plan_name:t,min_quantity:r,max_quantity:a,unit_price:n}=await e.req.json();if(!t||!r||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await s.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(t,r,a||null,n).run();return e.json({success:!0,pricing_id:o.meta.last_row_id})}catch(t){return console.error("[Admin Alimtalk Pricing Create] Error:",t),e.json({success:!1,error:t.message},500)}});p.put("/api/admin/alimtalk/pricing/:id",S(),async e=>{const{env:s}=e,t=e.req.param("id");try{const{plan_name:r,min_quantity:a,max_quantity:n,unit_price:o,is_active:i}=await e.req.json();return(await s.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r,a,n||null,o,i?1:0,t).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing updated successfully"})}catch(r){return console.error("[Admin Alimtalk Pricing Update] Error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/alimtalk/pricing/:id",S(),async e=>{const{env:s}=e,t=e.req.param("id");try{return(await s.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(t).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing deleted successfully"})}catch(r){return console.error("[Admin Alimtalk Pricing Delete] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/alimtalk/accounts",S(),async e=>{const{env:s}=e;try{const t=await s.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();return e.json({success:!0,accounts:t.results})}catch(t){return console.error("[Admin Alimtalk Accounts] Error:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/admin/alimtalk/accounts/:id/status",S(),async e=>{const{env:s}=e,t=e.req.param("id");try{const{status:r}=await e.req.json();return["active","suspended","rejected"].includes(r)?(await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r,t).run()).meta.changes===0?e.json({success:!1,error:"Account not found"},404):e.json({success:!0,message:`Account ${r} successfully`}):e.json({success:!1,error:"Invalid status"},400)}catch(r){return console.error("[Admin Alimtalk Account Status] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/alimtalk/statistics",S(),async e=>{const{env:s}=e;try{const{start_date:t,end_date:r}=e.req.query(),a=await s.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_revenue
      FROM alimtalk_messages
      WHERE created_at >= ? AND created_at <= ?
    `).bind(t||"2000-01-01",r||"2100-01-01").first(),n=await s.DB.prepare(`
      SELECT 
        s.id,
        s.name as seller_name,
        COUNT(m.id) as messages_sent,
        SUM(m.cost) as revenue,
        a.balance
      FROM sellers s
      JOIN alimtalk_accounts a ON s.id = a.seller_id
      LEFT JOIN alimtalk_messages m ON a.id = m.account_id
      WHERE m.created_at >= ? AND m.created_at <= ?
      GROUP BY s.id
      ORDER BY revenue DESC
      LIMIT 10
    `).bind(t||"2000-01-01",r||"2100-01-01").all();return e.json({success:!0,statistics:{total:a,by_seller:n.results}})}catch(t){return console.error("[Admin Alimtalk Statistics] Error:",t),e.json({success:!1,error:t.message},500)}});p.use("/api/seller/alimtalk/*",k);p.get("/api/seller/alimtalk/account",S(),async e=>{const{env:s}=e;try{const t=e.get("user");if(!t||t.userType!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const r=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(t.userId).first();return e.json({success:!0,account:r})}catch(t){return console.error("[Seller Alimtalk Account] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/register",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await We(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{channel_id:a,phone_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=yr(n),i=await gn(s,{channelId:a,phoneNumber:o});if(!i.success)return e.json({success:!1,error:"Failed to register Kakao channel"},500);const c=await s.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(r.user_id,a,a,i.senderKey,o).run();return e.json({success:!0,account_id:c.meta.last_row_id,sender_key:i.senderKey,message:"Kakao channel registered successfully"})}catch(t){return console.error("[Seller Alimtalk Register] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await We(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!a)return e.json({success:!1,error:"Alimtalk account not found"},404);const n=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();return e.json({success:!0,templates:n.results})}catch(t){return console.error("[Seller Alimtalk Templates] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await We(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_code:a,template_name:n,template_content:o,template_type:i}=await e.req.json();if(!a||!n||!o)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(!(await bn(s,c.sender_key,{name:n,content:o,templateCode:a})).success)return e.json({success:!1,error:"Failed to register template"},500);const l=await s.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id,a,n,o,i||"basic").run();return e.json({success:!0,template_id:l.meta.last_row_id,message:"Template registered successfully. Approval pending (1-2 days)"})}catch(t){return console.error("[Seller Alimtalk Template Register] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const t=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:t.results})}catch(t){return console.error("[Seller Alimtalk Pricing] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/charge",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await We(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{amount:a,pricing_id:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();if(!i)return e.json({success:!1,error:"Pricing not found"},404);const c=a*i.unit_price,u=`alimtalk_${o.id}_${Date.now()}`,l=await s.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id,a,c,i.unit_price,u).run(),d=`https://api.tosspayments.com/v1/payment/${u}`;return e.json({success:!0,charge_id:l.meta.last_row_id,order_id:u,amount:a,price:c,unit_price:i.unit_price,payment_url:d})}catch(t){return console.error("[Seller Alimtalk Charge] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/charge/complete",S(),async e=>{const{env:s}=e;try{const{order_id:t,payment_id:r}=await e.req.json();if(!t)return e.json({success:!1,error:"Missing order_id"},400);const a=await s.DB.prepare(`
      SELECT * FROM alimtalk_charges WHERE order_id = ? AND payment_status = 'pending'
    `).bind(t).first();return a?(await s.DB.prepare(`
      UPDATE alimtalk_charges 
      SET payment_status = 'completed', 
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r||null,a.id).run(),await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a.amount,a.account_id).run(),e.json({success:!0,message:"Charge completed successfully",charged_amount:a.amount})):e.json({success:!1,error:"Charge not found or already completed"},404)}catch(t){return console.error("[Seller Alimtalk Charge Complete] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/send",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await We(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_id:a,recipient_phone:n,variables:o,order_id:i}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(c.balance<1)return e.json({success:!1,error:"Insufficient balance. Please charge first."},400);const u=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a,c.id).first();if(!u)return e.json({success:!1,error:"Template not found or not approved"},404);const l=yn(u.template_content,o||{}),d=yr(n),f=await pt(s,{senderKey:c.sender_key,templateCode:u.template_code,to:d,message:l});if(!f.success)return await s.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id,a,i||null,d,l,f.error).run(),e.json({success:!1,error:f.error},500);const m=await s.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id,a,i||null,d,l,15,f.messageId).run();return await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(),e.json({success:!0,message_id:m.meta.last_row_id,aligo_message_id:f.messageId,status:"sent",remaining_balance:c.balance-1})}catch(t){return console.error("[Seller Alimtalk Send] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/messages",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await We(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{page:a="1",limit:n="20",status:o}=e.req.query(),i=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!i)return e.json({success:!1,error:"Alimtalk account not found"},404);const c=(parseInt(a)-1)*parseInt(n);let u=`
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;const l=[i.id];o&&(u+=" AND m.status = ?",l.push(o)),u+=" ORDER BY m.created_at DESC LIMIT ? OFFSET ?",l.push(parseInt(n),c);const d=await s.DB.prepare(u).bind(...l).all(),f=await s.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();return e.json({success:!0,messages:d.results,pagination:{total:f.total,page:parseInt(a),limit:parseInt(n)}})}catch(t){return console.error("[Seller Alimtalk Messages] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/statistics",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await We(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{start_date:a,end_date:n}=e.req.query(),o=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await s.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_cost
      FROM alimtalk_messages
      WHERE account_id = ?
        AND created_at >= ?
        AND created_at <= ?
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").first(),c=await s.DB.prepare(`
      SELECT 
        t.template_name,
        COUNT(m.id) as count
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
        AND m.created_at >= ?
        AND m.created_at <= ?
      GROUP BY t.id
      ORDER BY count DESC
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").all(),u=i.total_sent>0?(i.total_success/i.total_sent*100).toFixed(2):0;return e.json({success:!0,statistics:{total_sent:i.total_sent,total_success:i.total_success,total_failed:i.total_failed,success_rate:u,total_cost:i.total_cost,by_template:c.results}})}catch(t){return console.error("[Seller Alimtalk Statistics] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/send",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,recipients:a,variables:n}=t;if(!r||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and recipients are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await ft(e.env,{accountId:o.id,templateId:parseInt(r),recipients:a.map(c=>({phone:c.phone,name:c.name,variables:c.variables||{}})),variables:n||{}});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/send/order",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,orderId:a,customMessage:n}=t;if(!r||!a)return e.json({success:!1,error:"templateId and orderId are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);if(!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a),parseInt(s)).first())return e.json({success:!1,error:"Order not found or unauthorized"},404);const c=await Cn(e.env,o.id,parseInt(r),parseInt(a),n);return e.json({success:c.success,data:{total:c.totalRecipients,sent:c.successCount,failed:c.failedCount,refunded:c.refundedAmount},messages:c.messages})}catch(s){return console.error("[Alimtalk Send Order] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/send/bulk",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,rows:a,variables:n}=t;if(!r||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and rows are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await kn(e.env,o.id,parseInt(r),a,n||{});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send Bulk] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/templates/:id/preview",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=e.req.param("id"),r=await e.req.json(),{variables:a}=r,n=await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(t),parseInt(s)).first();if(!n)return e.json({success:!1,error:"Template not found"},404);let o=n.template_content;return a&&Object.entries(a).forEach(([i,c])=>{const u=new RegExp(`#{${i}}`,"g");o=o.replace(u,c)}),e.json({success:!0,data:{template_name:n.template_name,original:n.template_content,preview:o,required_variables:Array.from(n.template_content.matchAll(/#{(\w+)}/g),i=>i[1])}})}catch(s){return console.error("[Alimtalk Preview] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements",S(),async e=>{try{const s=await e.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("[Admin Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements/:id",S(),async e=>{try{const s=parseInt(e.req.param("id")),t=await $n(e.env.DB,s);return t?e.json({success:!0,data:t}):e.json({success:!1,error:"Settlement not found"},404)}catch(s){return console.error("[Admin Settlement Detail] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/settlements/generate",S(),async e=>{try{const s=await e.req.json(),{startDate:t,endDate:r}=s,a=t&&r?{startDate:t,endDate:r}:jn(),n=await Mn(e.env.DB,a);return await Fn(e.env.DB,n),e.json({success:!0,data:n})}catch(s){return console.error("[Admin Generate Settlement] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.env.DB.prepare(`
      SELECT 
        s.id,
        s.period_start,
        s.period_end,
        sd.total_sales,
        sd.total_orders,
        sd.platform_fee,
        sd.shipping_fee,
        sd.refund_amount,
        sd.settlement_amount,
        sd.status,
        sd.paid_at
      FROM settlements s
      JOIN settlement_details sd ON s.id = sd.settlement_id
      WHERE sd.seller_id = ?
      ORDER BY s.period_start DESC
      LIMIT 50
    `).bind(parseInt(s)).all();return e.json({success:!0,data:t.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements/calculate",S(),async e=>{const{DB:s}=e.env;if(!(await P(e)).success)return e.json({success:!1,error:"관리자 권한이 필요합니다"},401);try{const r=e.req.query("seller_id"),a=e.req.query("period")||"monthly",n=e.req.query("format")||"json";let o=e.req.query("start_date"),i=e.req.query("end_date");if(!r)return e.json({success:!1,error:"seller_id가 필요합니다"},400);const c=new Date;if(a==="weekly"){const g=new Date(c);g.setDate(c.getDate()-c.getDay()-6),g.setHours(0,0,0,0);const T=new Date(g);T.setDate(g.getDate()+6),T.setHours(23,59,59,999),o=g.toISOString().split("T")[0],i=T.toISOString().split("T")[0]}else if(a==="monthly"){const g=new Date(c.getFullYear(),c.getMonth()-1,1),T=new Date(c.getFullYear(),c.getMonth(),0);o=g.toISOString().split("T")[0],i=T.toISOString().split("T")[0]}else if(a==="custom"&&(!o||!i))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const u=await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(r).first();if(!u)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const d=(await s.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.status,
        o.total_amount,
        o.commission_rate,
        o.commission_amount,
        o.seller_amount
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.seller_id = ?
        AND o.status IN ('paid', 'preparing', 'shipped', 'delivered')
        AND DATE(o.created_at) >= ?
        AND DATE(o.created_at) <= ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).bind(r,o,i).all()).results,f=d.length,m=d.reduce((g,T)=>g+(T.total_amount||0),0),_=d.reduce((g,T)=>g+(T.commission_amount||0),0),h=m-_,w=f>0?d.reduce((g,T)=>g+(T.commission_rate||0),0)/f:0,y={sellerId:parseInt(r),sellerName:u.seller_name||"Unknown",businessName:u.business_name||null,period:{type:a,startDate:o,endDate:i},summary:{totalOrders:f,totalSales:m,totalCommission:_,netAmount:h,commissionRate:Math.round(w*100)/100},orders:d.map(g=>({orderNumber:g.order_number,createdAt:g.created_at,status:g.status,totalAmount:g.total_amount||0,commissionAmount:g.commission_amount||0,sellerAmount:g.seller_amount||0}))};if(n==="csv"){const g=[];g.push("셀러 정산서"),g.push(`셀러명,${y.sellerName}`),g.push(`사업자명,${y.businessName||"N/A"}`),g.push(`정산 기간,${y.period.startDate} ~ ${y.period.endDate}`),g.push(""),g.push("구분,금액"),g.push(`총 주문 건수,${y.summary.totalOrders}건`),g.push(`총 매출,${y.summary.totalSales.toLocaleString()}원`),g.push(`플랫폼 수수료 (${y.summary.commissionRate}%),${y.summary.totalCommission.toLocaleString()}원`),g.push(`정산 금액,${y.summary.netAmount.toLocaleString()}원`),g.push(""),g.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const x of y.orders)g.push(`${x.orderNumber},${x.createdAt},${x.status},${x.totalAmount},${x.commissionAmount},${x.sellerAmount}`);const T=g.join(`
`),b=`settlement_${r}_${o}_${i}.csv`;return e.text(T,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${b}"`})}return e.json({success:!0,data:y})}catch(r){return console.error("[Settlement] Calculation error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/settlements/my",S(),async e=>{const{DB:s}=e.env,t=await O(e);if(!t.success)return e.json({success:!1,error:"셀러 권한이 필요합니다"},401);const r=new URL(e.req.url);r.searchParams.set("seller_id",String(t.sellerId));const a=new Request(r.toString(),e.req.raw);({...e,req:new Proxy(a,{get(n,o){return o==="query"?i=>i==="seller_id"?String(t.sellerId):r.searchParams.get(i):n[o]}})});try{const n=t.sellerId,o=e.req.query("period")||"monthly",i=e.req.query("format")||"json";let c=e.req.query("start_date"),u=e.req.query("end_date");const l=new Date;if(o==="weekly"){const b=new Date(l);b.setDate(l.getDate()-l.getDay()-6),b.setHours(0,0,0,0);const x=new Date(b);x.setDate(b.getDate()+6),x.setHours(23,59,59,999),c=b.toISOString().split("T")[0],u=x.toISOString().split("T")[0]}else if(o==="monthly"){const b=new Date(l.getFullYear(),l.getMonth()-1,1),x=new Date(l.getFullYear(),l.getMonth(),0);c=b.toISOString().split("T")[0],u=x.toISOString().split("T")[0]}else if(o==="custom"&&(!c||!u))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const d=await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(n).first();if(!d)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const m=(await s.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.status,
        o.total_amount,
        o.commission_rate,
        o.commission_amount,
        o.seller_amount
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.seller_id = ?
        AND o.status IN ('paid', 'preparing', 'shipped', 'delivered')
        AND DATE(o.created_at) >= ?
        AND DATE(o.created_at) <= ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).bind(n,c,u).all()).results,_=m.length,h=m.reduce((b,x)=>b+(x.total_amount||0),0),w=m.reduce((b,x)=>b+(x.commission_amount||0),0),y=h-w,g=_>0?m.reduce((b,x)=>b+(x.commission_rate||0),0)/_:0,T={sellerId:n,sellerName:d.seller_name||"Unknown",businessName:d.business_name||null,period:{type:o,startDate:c,endDate:u},summary:{totalOrders:_,totalSales:h,totalCommission:w,netAmount:y,commissionRate:Math.round(g*100)/100},orders:m.map(b=>({orderNumber:b.order_number,createdAt:b.created_at,status:b.status,totalAmount:b.total_amount||0,commissionAmount:b.commission_amount||0,sellerAmount:b.seller_amount||0}))};if(i==="csv"){const b=[];b.push("셀러 정산서"),b.push(`셀러명,${T.sellerName}`),b.push(`사업자명,${T.businessName||"N/A"}`),b.push(`정산 기간,${T.period.startDate} ~ ${T.period.endDate}`),b.push(""),b.push("구분,금액"),b.push(`총 주문 건수,${T.summary.totalOrders}건`),b.push(`총 매출,${T.summary.totalSales.toLocaleString()}원`),b.push(`플랫폼 수수료 (${T.summary.commissionRate}%),${T.summary.totalCommission.toLocaleString()}원`),b.push(`정산 금액,${T.summary.netAmount.toLocaleString()}원`),b.push(""),b.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const C of T.orders)b.push(`${C.orderNumber},${C.createdAt},${C.status},${C.totalAmount},${C.commissionAmount},${C.sellerAmount}`);const x=b.join(`
`),j=`my_settlement_${c}_${u}.csv`;return e.text(x,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${j}"`})}return e.json({success:!0,data:T})}catch(n){return console.error("[My Settlement] Error:",n),e.json({success:!1,error:n.message},500)}});p.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.env.DB.prepare(`
      SELECT 
        s.id,
        s.period_start,
        s.period_end,
        sd.total_sales,
        sd.total_orders,
        sd.platform_fee,
        sd.shipping_fee,
        sd.refund_amount,
        sd.settlement_amount,
        sd.status,
        sd.paid_at
      FROM settlements s
      JOIN settlement_details sd ON s.id = sd.settlement_id
      WHERE sd.seller_id = ?
      ORDER BY s.period_start DESC
      LIMIT 50
    `).bind(parseInt(s)).all();return e.json({success:!0,data:t.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/live/:streamId/sse",async e=>{const s=e.req.param("streamId");return Un(s,e.env)});p.get("/api/live/:streamId/chat/sse",async e=>{const s=e.req.param("streamId");return Pn(s,e.env)});p.get("/api/seller/orders/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?Wn(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});p.get("/api/seller/stock/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?Hn(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});p.post("/api/push/subscribe",S(),async e=>{try{const s=e.req.header("X-User-ID"),t=e.req.header("X-User-Type");if(!s||!t)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json();return await qn(e.env.DB,parseInt(s),t,r),e.json({success:!0})}catch(s){return console.error("[Push Subscribe] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/push/unsubscribe",S(),async e=>{try{const{endpoint:s}=await e.req.json();return s?(await Bn(e.env.DB,s),e.json({success:!0})):e.json({success:!1,error:"Endpoint required"},400)}catch(s){return console.error("[Push Unsubscribe] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/push/vapid-public-key",S(),async e=>{try{const s=e.env.VAPID_PUBLIC_KEY||"";return e.json({success:!0,publicKey:s})}catch(s){return console.error("[Push VAPID Key] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/cache/stats",async e=>{const s=e.req.query("token"),t=e.env.STATS_SECRET_TOKEN||"your-secret-token-here";if(s!==t)return e.json({success:!1,error:"접근 권한이 없습니다. 올바른 token을 제공해주세요."},403);const r=Y.hits+Y.misses>0?(Y.hits/(Y.hits+Y.misses)*100).toFixed(2):"0.00";return e.json({success:!0,data:{cache:{...Y,hitRate:`${r}%`,cacheSize:_e.size,maxSize:1e3,memoryUsage:`${(_e.size/1e3*100).toFixed(1)}%`},description:{hits:"Memory cache로 처리된 요청 (KV 읽기 0회)",misses:"Memory cache 미스로 KV 조회한 요청",writes:"Memory cache에 저장된 항목 수",evictions:"Memory cache에서 삭제된 항목 수 (만료 또는 크기 제한)",hitRate:"Cache hit 비율 (높을수록 KV 사용량 감소)",cacheSize:"현재 Memory cache에 저장된 항목 수",maxSize:"Memory cache 최대 크기",memoryUsage:"Memory cache 사용률 (cacheSize / maxSize)"},kvUsageGuide:{currentHitRate:`${r}%`,recommendation:parseFloat(r)>=90?"✅ 캐시가 매우 효과적으로 작동하고 있습니다.":parseFloat(r)>=70?"⚠️ 캐시 히트율이 낮습니다. TTL 조정을 고려하세요.":"❌ 캐시 히트율이 매우 낮습니다. 캐시 설정을 확인하세요.",kvDailyReadsLimit:"100,000 reads/day (free tier)",kvDailyWritesLimit:"1,000 writes/day (free tier)",estimatedDailyReads:Math.round(Y.misses/(Y.hits+Y.misses||1)*1e4),estimatedDailyWrites:Math.round(Y.writes/(Y.hits+Y.misses||1)*1e3)}}})});let Kt={},Jt={};p.get("/api/debug/kv-usage",S(),async e=>{try{const s=Object.entries(Kt).sort((i,c)=>c[1]-i[1]).slice(0,20),t=Object.entries(Jt).sort((i,c)=>c[1]-i[1]).slice(0,20),r=Object.values(Kt).reduce((i,c)=>i+c,0),a=Object.values(Jt).reduce((i,c)=>i+c,0),n=r/1e3*100,o=a/1e5*100;if((n>=50||o>=50)&&e.env.DISCORD_WEBHOOK_URL)try{await Gn(e.env.DISCORD_WEBHOOK_URL,o,n)}catch(i){console.error("[Discord] KV 경고 전송 실패:",i)}return e.json({success:!0,stats:{total_writes:r,total_reads:a,daily_write_limit:1e3,daily_read_limit:1e5,write_usage_percent:n.toFixed(2)+"%",read_usage_percent:o.toFixed(2)+"%",top_writes:s,top_reads:t},recommendations:r>500?["⚠️ KV Write 사용량이 높습니다!","1. 세션 갱신 주기를 늘리세요 (현재 29일)","2. 캐시를 메모리에만 저장하세요 (forceKvWrite: false)","3. JWT 인증으로 전환하세요 (KV 사용량 90% 감소)"]:["✅ KV 사용량이 정상 범위입니다."]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/debug/user/:email",S(),async e=>{const{DB:s}=e.env,t=e.req.param("email");try{const r=await s.prepare(`
      SELECT id, firebase_uid, email, name, created_at 
      FROM users 
      WHERE email = ?
    `).bind(t).first();return r?e.json({success:!0,user:{id:r.id,firebase_uid:r.firebase_uid,email:r.email,name:r.name,created_at:r.created_at}}):e.json({success:!1,error:"User not found"},404)}catch(r){return console.error("[Debug] Error fetching user:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/debug/user/:email/firebase-uid",S(),async e=>{const{DB:s}=e.env,t=e.req.param("email");try{const{firebase_uid:r}=await e.req.json();if(!r)return e.json({success:!1,error:"firebase_uid is required"},400);const a=await s.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(t).first();return a?(await s.prepare(`
      UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?
    `).bind(r,t).run(),console.log(`[Debug] Updated Firebase UID for ${t}: ${r}`),e.json({success:!0,message:"Firebase UID updated successfully",user:{id:a.id,email:t,firebase_uid:r}})):e.json({success:!1,error:"User not found"},404)}catch(r){return console.error("[Debug] Error updating Firebase UID:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/notifications",S(),async e=>{var t;const{DB:s}=e.env;try{const r=e.req.query("userId"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0");if(!r)return e.json({success:!1,error:"userId is required"},400);const o=await s.prepare(`
      SELECT id, type, title, message, link_url, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(r,a,n).all(),i=await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).bind(r).first();return e.json({success:!0,data:{notifications:o.results||[],unread_count:(i==null?void 0:i.count)||0,total:((t=o.results)==null?void 0:t.length)||0}})}catch(r){return console.error("[Notifications] Get error:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/notifications/:id/read",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),{userId:r}=await e.req.json();return r?(await s.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).bind(t,r).run()).meta.changes===0?e.json({success:!1,error:"Notification not found"},404):e.json({success:!0,message:"Notification marked as read"}):e.json({success:!1,error:"userId is required"},400)}catch(t){return console.error("[Notifications] Mark read error:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/notifications/read-all",S(),async e=>{const{DB:s}=e.env;try{const{userId:t}=await e.req.json();return t?(await s.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `).bind(t).run(),e.json({success:!0,message:"All notifications marked as read"})):e.json({success:!1,error:"userId is required"},400)}catch(t){return console.error("[Notifications] Mark all read error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/notifications/:id",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=e.req.query("userId");return r?(await s.prepare(`
      DELETE FROM notifications
      WHERE id = ? AND user_id = ?
    `).bind(t,r).run()).meta.changes===0?e.json({success:!1,error:"Notification not found"},404):e.json({success:!0,message:"Notification deleted"}):e.json({success:!1,error:"userId is required"},400)}catch(t){return console.error("[Notifications] Delete error:",t),e.json({success:!1,error:t.message},500)}});async function Ii(e,s,t){var a,n;const r={embeds:[{title:"🚨 서버 에러 발생",color:16711680,fields:[{name:"에러 메시지",value:s.message||"Unknown error",inline:!1},{name:"발생 시각",value:new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}),inline:!0},{name:"HTTP 메소드",value:t.method||"N/A",inline:!0},{name:"API 경로",value:t.path||"N/A",inline:!1},{name:"사용자 ID",value:((a=t.userId)==null?void 0:a.toString())||"비로그인",inline:!0},{name:"사용자 타입",value:t.userType||"N/A",inline:!0},{name:"에러 스택",value:"```\n"+(((n=s.stack)==null?void 0:n.substring(0,800))||"N/A")+"\n```",inline:!1}],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Error Monitoring"}}]};try{await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)}),console.log("[Discord] Error alert sent successfully")}catch(o){console.error("[Discord Webhook] Failed to send alert:",o)}}p.onError(async(e,s)=>{if(console.error("[Error]",e),s.env.DISCORD_WEBHOOK_URL)try{await Ii(s.env.DISCORD_WEBHOOK_URL,e,{method:s.req.method,path:s.req.path,userId:s.get("userId"),userType:s.get("userType")})}catch(t){console.error("[Discord] Webhook failed, but continuing:",t)}return s.json({success:!1,error:{code:e.code||"INTERNAL_ERROR",message:e.message||"서버 오류가 발생했습니다."}},e.status||500)});const Vt=new hr,vi=Object.assign({"/src/index.tsx":p});let sa=!1;for(const[,e]of Object.entries(vi))e&&(Vt.route("/",e),Vt.notFound(e.notFoundHandler),sa=!0);if(!sa)throw new Error("Can't import modules from ['/src/index.tsx']");async function ta(e){try{const{to:s,subject:t,htmlContent:r,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:s}]}],from:{email:"noreply@live.ur-team.com",name:"리스터코퍼레이션"},subject:t,content:[{type:"text/html",value:r},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",s),{success:!0}}catch(s){return console.error("[Email] Exception:",s),{success:!1,error:s.message}}}async function Ai(e){const{streamId:s,title:t,sellerName:r,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${s}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",u=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .content {
      background: #f9fafb;
      padding: 30px 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .info-box {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    .info-row {
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #6b7280;
      display: inline-block;
      width: 120px;
    }
    .value {
      color: #111827;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
    }
    .badge-live {
      background: #fee2e2;
      color: #dc2626;
    }
    .badge-scheduled {
      background: #dbeafe;
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">🎉 새 라이브 스트림 생성!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">셀러가 새로운 라이브 방송을 개설했습니다</p>
  </div>
  
  <div class="content">
    <div class="info-box">
      <h2 style="margin-top: 0; color: #111827;">라이브 스트림 정보</h2>
      
      <div class="info-row">
        <span class="label">상태</span>
        <span class="value">
          <span class="badge ${o==="live"?"badge-live":"badge-scheduled"}">${c}</span>
        </span>
      </div>
      
      <div class="info-row">
        <span class="label">제목</span>
        <span class="value"><strong>${t}</strong></span>
      </div>
      
      <div class="info-row">
        <span class="label">판매자</span>
        <span class="value">${r}</span>
      </div>
      
      <div class="info-row">
        <span class="label">플랫폼</span>
        <span class="value">${a==="youtube"?"📺 YouTube":"🎵 TikTok"}</span>
      </div>
      
      ${n?`
      <div class="info-row">
        <span class="label">예약 시간</span>
        <span class="value">${new Date(n).toLocaleString("ko-KR")}</span>
      </div>
      `:""}
      
      <div class="info-row">
        <span class="label">라이브 ID</span>
        <span class="value">#${s}</span>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="${i}" class="button">
        🔗 라이브 페이지 바로가기
      </a>
    </div>
    
    <div style="background: #fffbeb; border: 1px solid #fde047; padding: 15px; border-radius: 8px; margin-top: 20px;">
      <p style="margin: 0; color: #92400e;">
        <strong>💡 참고:</strong> 이 이메일은 자동으로 전송되었습니다. 
        라이브 스트림을 확인하고 필요시 관리자 대시보드에서 관리하세요.
      </p>
    </div>
  </div>
  
  <div class="footer">
    <p style="margin: 5px 0;">
      <strong>리스터코퍼레이션</strong><br>
      부산광역시 금정구 놀이마당로26 1402<br>
      대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
    </p>
    <p style="margin: 15px 0 5px 0; font-size: 12px; color: #9ca3af;">
      © 2026 리스터코퍼레이션. All rights reserved.
    </p>
  </div>
</body>
</html>
  `,l=`
🎉 새 라이브 스트림 생성!

상태: ${c}
제목: ${t}
판매자: ${r}
플랫폼: ${a==="youtube"?"YouTube":"TikTok"}
${n?`예약 시간: ${new Date(n).toLocaleString("ko-KR")}`:""}
라이브 ID: #${s}

🔗 라이브 페이지: ${i}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `;return ta({to:"jiwon@ur-team.com",subject:`[리스터코퍼레이션] 🎉 새 라이브 스트림 생성: ${t}`,htmlContent:u,textContent:l})}const Di=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:ta,sendLiveStreamCreatedEmail:Ai},Symbol.toStringTag,{value:"Module"}));async function Oi(e,s,t){const r=e.from||t||"리스터코퍼레이션 <onboarding@resend.dev>",{to:a,subject:n,html:o}=e;if(!s)return console.warn("[Email] RESEND_API_KEY not configured, skipping email"),{success:!1,error:"API key not configured"};try{console.log("[Email] Sending email:",{to:a,subject:n,from:r});const i=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${s}`,"Content-Type":"application/json"},body:JSON.stringify({from:r,to:a,subject:n,html:o})}),c=await i.json();return i.ok?(console.log("[Email] Sent successfully:",{to:a,subject:n,id:c.id}),{success:!0}):(console.error("[Email] Failed to send:",c),{success:!1,error:c.message||"Failed to send email"})}catch(i){return console.error("[Email] Error:",i),{success:!1,error:i.message}}}function Ci(e,s){return`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>셀러 승인 완료</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #1d1d1f; font-size: 28px; font-weight: 700;">🎉 축하합니다!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                안녕하세요, <strong>${e}</strong>님!
              </p>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                <strong>리스터코퍼레이션</strong> 판매자로 승인되셨습니다! 🎊
              </p>
              
              <div style="background-color: #f9f9f9; border-left: 4px solid #FFD700; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #1d1d1f; font-size: 14px;">
                  <strong>판매자 정보</strong>
                </p>
                <p style="margin: 0 0 5px; color: #666; font-size: 14px;">
                  아이디: <strong>${s}</strong>
                </p>
                <p style="margin: 0; color: #666; font-size: 14px;">
                  이름: <strong>${e}</strong>
                </p>
              </div>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                이제 상품을 등록하고 라이브 방송을 시작하실 수 있습니다!
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="https://live.ur-team.com/seller" style="display: inline-block; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #1d1d1f; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);">
                  셀러 대시보드 바로가기 →
                </a>
              </div>
              
              <p style="margin: 30px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                질문이나 도움이 필요하시면 언제든지 연락주세요.<br>
                감사합니다!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                <strong>리스터코퍼레이션</strong> | 라이브 커머스 플랫폼
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                © 2026 리스터코퍼레이션. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `}function ki(e,s){return`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>셀러 승인 거부</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #1d1d1f; font-size: 24px; font-weight: 600;">판매자 승인 결과 안내</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                안녕하세요, <strong>${e}</strong>님.
              </p>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                죄송하게도 현재 리스터코퍼레이션 판매자 승인이 보류되었습니다.
              </p>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #1d1d1f; font-size: 14px;">
                  <strong>거부 사유</strong>
                </p>
                <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
                  ${s}
                </p>
              </div>
              
              <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 16px; line-height: 1.6;">
                위 사항을 보완하신 후 다시 신청해주시면 재검토하겠습니다.
              </p>
              
              <p style="margin: 30px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                추가 문의사항이 있으시면 언제든지 연락주세요.<br>
                감사합니다.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                <strong>리스터코퍼레이션</strong> | 라이브 커머스 플랫폼
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                © 2026 리스터코퍼레이션. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `}const ra=Object.freeze(Object.defineProperty({__proto__:null,getSellerApprovalEmailHTML:Ci,getSellerRejectionEmailHTML:ki,sendEmail:Oi},Symbol.toStringTag,{value:"Module"}));async function Ni(e,s){const{userId:t,type:r,title:a,message:n,linkUrl:o}=s;try{const i=await e.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(t,r,a,n,o||null).run();return console.log(`[Notification] Created for user ${t}: ${r} - ${a}`),{success:!0,id:i.meta.last_row_id}}catch(i){return console.error("[Notification] Failed to create:",i),{success:!1,error:i.message}}}const ji={seller_approved:e=>({title:"🎉 판매자 승인 완료",message:`${e}님, 축하합니다! 리스터코퍼레이션 판매자로 승인되었습니다.`,linkUrl:"/seller"}),seller_rejected:e=>({title:"판매자 승인 거부",message:`죄송합니다. 판매자 승인이 거부되었습니다. 사유: ${e}`,linkUrl:"/seller/register"}),order_complete:e=>({title:"주문 완료",message:`주문번호 ${e}의 주문이 접수되었습니다.`,linkUrl:`/orders/${e}`}),order_shipped:e=>({title:"배송 시작",message:`주문번호 ${e}의 상품이 배송 시작되었습니다.`,linkUrl:`/orders/${e}`}),order_delivered:e=>({title:"배송 완료",message:`주문번호 ${e}의 상품이 배송 완료되었습니다.`,linkUrl:`/orders/${e}`}),refund_requested:e=>({title:"환불 요청 접수",message:`주문번호 ${e}의 환불이 접수되었습니다.`,linkUrl:`/orders/${e}`}),refund_complete:(e,s)=>({title:"환불 완료",message:`주문번호 ${e}의 환불(₩${s.toLocaleString()})이 완료되었습니다.`,linkUrl:`/orders/${e}`}),product_low_stock:(e,s)=>({title:"⚠️ 재고 부족 알림",message:`${e}의 재고가 ${s}개 남았습니다.`,linkUrl:"/seller/products"}),product_sold_out:e=>({title:"❌ 품절 알림",message:`${e}이(가) 품절되었습니다.`,linkUrl:"/seller/products"})},aa=Object.freeze(Object.defineProperty({__proto__:null,NotificationTemplates:ji,createNotification:Ni},Symbol.toStringTag,{value:"Module"}));export{Vt as default};
