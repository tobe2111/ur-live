var zs=Object.defineProperty;var cs=e=>{throw TypeError(e)};var Gs=(e,t,r)=>t in e?zs(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var S=(e,t,r)=>Gs(e,typeof t!="symbol"?t+"":t,r),Qe=(e,t,r)=>t.has(e)||cs("Cannot "+r);var m=(e,t,r)=>(Qe(e,t,"read from private field"),r?r.call(e):t.get(e)),R=(e,t,r)=>t.has(e)?cs("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),T=(e,t,r,s)=>(Qe(e,t,"write to private field"),s?s.call(e,r):t.set(e,r),r),j=(e,t,r)=>(Qe(e,t,"access private method"),r);var us=(e,t,r,s)=>({set _(a){T(e,t,a,r)},get _(){return m(e,t,s)}});var ls=(e,t,r)=>(s,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,u=!1,l;if(e[i]?(l=e[i][0][0],s.req.routeIndex=i):l=i===e.length&&a||void 0,l)try{c=await l(s,()=>o(i+1))}catch(d){if(d instanceof Error&&t)s.error=d,c=await t(d,s),u=!0;else throw d}else s.finalized===!1&&r&&(c=await r(s));return c&&(s.finalized===!1||u)&&(s.res=c),s}},Xs=Symbol(),Qs=async(e,t=Object.create(null))=>{const{all:r=!1,dot:s=!1}=t,n=(e instanceof Rs?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?Zs(e,{all:r,dot:s}):{}};async function Zs(e,t){const r=await e.formData();return r?er(r,t):{}}function er(e,t){const r=Object.create(null);return e.forEach((s,a)=>{t.all||a.endsWith("[]")?sr(r,a,s):r[a]=s}),t.dot&&Object.entries(r).forEach(([s,a])=>{s.includes(".")&&(rr(r,s,a),delete r[s])}),r}var sr=(e,t,r)=>{e[t]!==void 0?Array.isArray(e[t])?e[t].push(r):e[t]=[e[t],r]:t.endsWith("[]")?e[t]=[r]:e[t]=r},rr=(e,t,r)=>{let s=e;const a=t.split(".");a.forEach((n,o)=>{o===a.length-1?s[n]=r:((!s[n]||typeof s[n]!="object"||Array.isArray(s[n])||s[n]instanceof File)&&(s[n]=Object.create(null)),s=s[n])})},bs=e=>{const t=e.split("/");return t[0]===""&&t.shift(),t},tr=e=>{const{groups:t,path:r}=ar(e),s=bs(r);return nr(s,t)},ar=e=>{const t=[];return e=e.replace(/\{[^}]+\}/g,(r,s)=>{const a=`@${s}`;return t.push([a,r]),a}),{groups:t,path:e}},nr=(e,t)=>{for(let r=t.length-1;r>=0;r--){const[s]=t[r];for(let a=e.length-1;a>=0;a--)if(e[a].includes(s)){e[a]=e[a].replace(s,t[r][1]);break}}return e},Ke={},or=(e,t)=>{if(e==="*")return"*";const r=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(r){const s=`${e}#${t}`;return Ke[s]||(r[2]?Ke[s]=t&&t[0]!==":"&&t[0]!=="*"?[s,r[1],new RegExp(`^${r[2]}(?=/${t})`)]:[e,r[1],new RegExp(`^${r[2]}$`)]:Ke[s]=[e,r[1],!0]),Ke[s]}return null},ts=(e,t)=>{try{return t(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,r=>{try{return t(r)}catch{return r}})}},ir=e=>ts(e,decodeURI),ws=e=>{const t=e.url,r=t.indexOf("/",t.indexOf(":")+4);let s=r;for(;s<t.length;s++){const a=t.charCodeAt(s);if(a===37){const n=t.indexOf("?",s),o=t.slice(r,n===-1?void 0:n);return ir(o.includes("%25")?o.replace(/%25/g,"%2525"):o)}else if(a===63)break}return t.slice(r,s)},cr=e=>{const t=ws(e);return t.length>1&&t.at(-1)==="/"?t.slice(0,-1):t},be=(e,t,...r)=>(r.length&&(t=be(t,...r)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${t==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(t==null?void 0:t[0])==="/"?t.slice(1):t}`}`),Ts=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const t=e.split("/"),r=[];let s="";return t.forEach(a=>{if(a!==""&&!/\:/.test(a))s+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){r.length===0&&s===""?r.push("/"):r.push(s);const n=a.replace("?","");s+="/"+n,r.push(s)}else s+="/"+a}),r.filter((a,n,o)=>o.indexOf(a)===n)},Ze=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?ts(e,Is):e):e,Ss=(e,t,r)=>{let s;if(!r&&t&&!/[%+]/.test(t)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(t,o+1)||(o=e.indexOf(`&${t}`,o+1));o!==-1;){const i=e.charCodeAt(o+t.length+1);if(i===61){const c=o+t.length+2,u=e.indexOf("&",c);return Ze(e.slice(c,u===-1?void 0:u))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${t}`,o+1)}if(s=/[%+]/.test(e),!s)return}const a={};s??(s=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(s&&(c=Ze(c)),n=o,c==="")continue;let u;i===-1?u="":(u=e.slice(i+1,o===-1?void 0:o),s&&(u=Ze(u))),r?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(u)):a[c]??(a[c]=u)}return t?a[t]:a},ur=Ss,lr=(e,t)=>Ss(e,t,!0),Is=decodeURIComponent,ds=e=>ts(e,Is),Se,B,te,vs,Os,rs,ae,_s,Rs=(_s=class{constructor(e,t="/",r=[[]]){R(this,te);S(this,"raw");R(this,Se);R(this,B);S(this,"routeIndex",0);S(this,"path");S(this,"bodyCache",{});R(this,ae,e=>{const{bodyCache:t,raw:r}=this,s=t[e];if(s)return s;const a=Object.keys(t)[0];return a?t[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):t[e]=r[e]()});this.raw=e,this.path=t,T(this,B,r),T(this,Se,{})}param(e){return e?j(this,te,vs).call(this,e):j(this,te,Os).call(this)}query(e){return ur(this.url,e)}queries(e){return lr(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const t={};return this.raw.headers.forEach((r,s)=>{t[s]=r}),t}async parseBody(e){var t;return(t=this.bodyCache).parsedBody??(t.parsedBody=await Qs(this,e))}json(){return m(this,ae).call(this,"text").then(e=>JSON.parse(e))}text(){return m(this,ae).call(this,"text")}arrayBuffer(){return m(this,ae).call(this,"arrayBuffer")}blob(){return m(this,ae).call(this,"blob")}formData(){return m(this,ae).call(this,"formData")}addValidatedData(e,t){m(this,Se)[e]=t}valid(e){return m(this,Se)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[Xs](){return m(this,B)}get matchedRoutes(){return m(this,B)[0].map(([[,e]])=>e)}get routePath(){return m(this,B)[0].map(([[,e]])=>e)[this.routeIndex].path}},Se=new WeakMap,B=new WeakMap,te=new WeakSet,vs=function(e){const t=m(this,B)[0][this.routeIndex][1][e],r=j(this,te,rs).call(this,t);return r&&/\%/.test(r)?ds(r):r},Os=function(){const e={},t=Object.keys(m(this,B)[0][this.routeIndex][1]);for(const r of t){const s=j(this,te,rs).call(this,m(this,B)[0][this.routeIndex][1][r]);s!==void 0&&(e[r]=/\%/.test(s)?ds(s):s)}return e},rs=function(e){return m(this,B)[1]?m(this,B)[1][e]:e},ae=new WeakMap,_s),dr={Stringify:1},js=async(e,t,r,s,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:t,buffer:a,context:s}))).then(i=>Promise.all(i.filter(Boolean).map(c=>js(c,t,!1,s,a))).then(()=>a[0]))):Promise.resolve(e)},pr="text/plain; charset=UTF-8",es=(e,t)=>({"Content-Type":e,...t}),Pe,He,Z,Ie,ee,W,Ue,Re,ve,me,xe,$e,ne,we,fs,mr=(fs=class{constructor(e,t){R(this,ne);R(this,Pe);R(this,He);S(this,"env",{});R(this,Z);S(this,"finalized",!1);S(this,"error");R(this,Ie);R(this,ee);R(this,W);R(this,Ue);R(this,Re);R(this,ve);R(this,me);R(this,xe);R(this,$e);S(this,"render",(...e)=>(m(this,Re)??T(this,Re,t=>this.html(t)),m(this,Re).call(this,...e)));S(this,"setLayout",e=>T(this,Ue,e));S(this,"getLayout",()=>m(this,Ue));S(this,"setRenderer",e=>{T(this,Re,e)});S(this,"header",(e,t,r)=>{this.finalized&&T(this,W,new Response(m(this,W).body,m(this,W)));const s=m(this,W)?m(this,W).headers:m(this,me)??T(this,me,new Headers);t===void 0?s.delete(e):r!=null&&r.append?s.append(e,t):s.set(e,t)});S(this,"status",e=>{T(this,Ie,e)});S(this,"set",(e,t)=>{m(this,Z)??T(this,Z,new Map),m(this,Z).set(e,t)});S(this,"get",e=>m(this,Z)?m(this,Z).get(e):void 0);S(this,"newResponse",(...e)=>j(this,ne,we).call(this,...e));S(this,"body",(e,t,r)=>j(this,ne,we).call(this,e,t,r));S(this,"text",(e,t,r)=>!m(this,me)&&!m(this,Ie)&&!t&&!r&&!this.finalized?new Response(e):j(this,ne,we).call(this,e,t,es(pr,r)));S(this,"json",(e,t,r)=>j(this,ne,we).call(this,JSON.stringify(e),t,es("application/json",r)));S(this,"html",(e,t,r)=>{const s=a=>j(this,ne,we).call(this,a,t,es("text/html; charset=UTF-8",r));return typeof e=="object"?js(e,dr.Stringify,!1,{}).then(s):s(e)});S(this,"redirect",(e,t)=>{const r=String(e);return this.header("Location",/[^\x00-\xFF]/.test(r)?encodeURI(r):r),this.newResponse(null,t??302)});S(this,"notFound",()=>(m(this,ve)??T(this,ve,()=>new Response),m(this,ve).call(this,this)));T(this,Pe,e),t&&(T(this,ee,t.executionCtx),this.env=t.env,T(this,ve,t.notFoundHandler),T(this,$e,t.path),T(this,xe,t.matchResult))}get req(){return m(this,He)??T(this,He,new Rs(m(this,Pe),m(this,$e),m(this,xe))),m(this,He)}get event(){if(m(this,ee)&&"respondWith"in m(this,ee))return m(this,ee);throw Error("This context has no FetchEvent")}get executionCtx(){if(m(this,ee))return m(this,ee);throw Error("This context has no ExecutionContext")}get res(){return m(this,W)||T(this,W,new Response(null,{headers:m(this,me)??T(this,me,new Headers)}))}set res(e){if(m(this,W)&&e){e=new Response(e.body,e);for(const[t,r]of m(this,W).headers.entries())if(t!=="content-type")if(t==="set-cookie"){const s=m(this,W).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of s)e.headers.append("set-cookie",a)}else e.headers.set(t,r)}T(this,W,e),this.finalized=!0}get var(){return m(this,Z)?Object.fromEntries(m(this,Z)):{}}},Pe=new WeakMap,He=new WeakMap,Z=new WeakMap,Ie=new WeakMap,ee=new WeakMap,W=new WeakMap,Ue=new WeakMap,Re=new WeakMap,ve=new WeakMap,me=new WeakMap,xe=new WeakMap,$e=new WeakMap,ne=new WeakSet,we=function(e,t,r){const s=m(this,W)?new Headers(m(this,W).headers):m(this,me)??new Headers;if(typeof t=="object"&&"headers"in t){const n=t.headers instanceof Headers?t.headers:new Headers(t.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?s.append(o,i):s.set(o,i)}if(r)for(const[n,o]of Object.entries(r))if(typeof o=="string")s.set(n,o);else{s.delete(n);for(const i of o)s.append(n,i)}const a=typeof t=="number"?t:(t==null?void 0:t.status)??m(this,Ie);return new Response(e,{status:a,headers:s})},fs),P="ALL",_r="all",fr=["get","post","put","delete","options","patch"],Ds="Can not add a route since the matcher is already built.",Ns=class extends Error{},Er="__COMPOSED_HANDLER",hr=e=>e.text("404 Not Found",404),ps=(e,t)=>{if("getResponse"in e){const r=e.getResponse();return t.newResponse(r.body,r)}return console.error(e),t.text("Internal Server Error",500)},V,H,As,J,de,We,Be,Oe,yr=(Oe=class{constructor(t={}){R(this,H);S(this,"get");S(this,"post");S(this,"put");S(this,"delete");S(this,"options");S(this,"patch");S(this,"all");S(this,"on");S(this,"use");S(this,"router");S(this,"getPath");S(this,"_basePath","/");R(this,V,"/");S(this,"routes",[]);R(this,J,hr);S(this,"errorHandler",ps);S(this,"onError",t=>(this.errorHandler=t,this));S(this,"notFound",t=>(T(this,J,t),this));S(this,"fetch",(t,...r)=>j(this,H,Be).call(this,t,r[1],r[0],t.method));S(this,"request",(t,r,s,a)=>t instanceof Request?this.fetch(r?new Request(t,r):t,s,a):(t=t.toString(),this.fetch(new Request(/^https?:\/\//.test(t)?t:`http://localhost${be("/",t)}`,r),s,a)));S(this,"fire",()=>{addEventListener("fetch",t=>{t.respondWith(j(this,H,Be).call(this,t.request,t,void 0,t.request.method))})});[...fr,_r].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?T(this,V,o):j(this,H,de).call(this,n,m(this,V),o),i.forEach(c=>{j(this,H,de).call(this,n,m(this,V),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){T(this,V,c);for(const u of[n].flat())i.map(l=>{j(this,H,de).call(this,u.toUpperCase(),m(this,V),l)})}return this},this.use=(n,...o)=>(typeof n=="string"?T(this,V,n):(T(this,V,"*"),o.unshift(n)),o.forEach(i=>{j(this,H,de).call(this,P,m(this,V),i)}),this);const{strict:s,...a}=t;Object.assign(this,a),this.getPath=s??!0?t.getPath??ws:cr}route(t,r){const s=this.basePath(t);return r.routes.map(a=>{var o;let n;r.errorHandler===ps?n=a.handler:(n=async(i,c)=>(await ls([],r.errorHandler)(i,()=>a.handler(i,c))).res,n[Er]=a.handler),j(o=s,H,de).call(o,a.method,a.path,n)}),this}basePath(t){const r=j(this,H,As).call(this);return r._basePath=be(this._basePath,t),r}mount(t,r,s){let a,n;s&&(typeof s=="function"?n=s:(n=s.optionHandler,s.replaceRequest===!1?a=c=>c:a=s.replaceRequest));const o=n?c=>{const u=n(c);return Array.isArray(u)?u:[u]}:c=>{let u;try{u=c.executionCtx}catch{}return[c.env,u]};a||(a=(()=>{const c=be(this._basePath,t),u=c==="/"?0:c.length;return l=>{const d=new URL(l.url);return d.pathname=d.pathname.slice(u)||"/",new Request(d,l)}})());const i=async(c,u)=>{const l=await r(a(c.req.raw),...o(c));if(l)return l;await u()};return j(this,H,de).call(this,P,be(t,"*"),i),this}},V=new WeakMap,H=new WeakSet,As=function(){const t=new Oe({router:this.router,getPath:this.getPath});return t.errorHandler=this.errorHandler,T(t,J,m(this,J)),t.routes=this.routes,t},J=new WeakMap,de=function(t,r,s){t=t.toUpperCase(),r=be(this._basePath,r);const a={basePath:this._basePath,path:r,method:t,handler:s};this.router.add(t,r,[s,a]),this.routes.push(a)},We=function(t,r){if(t instanceof Error)return this.errorHandler(t,r);throw t},Be=function(t,r,s,a){if(a==="HEAD")return(async()=>new Response(null,await j(this,H,Be).call(this,t,r,s,"GET")))();const n=this.getPath(t,{env:s}),o=this.router.match(a,n),i=new mr(t,{path:n,matchResult:o,env:s,executionCtx:r,notFoundHandler:m(this,J)});if(o[0].length===1){let u;try{u=o[0][0][0][0](i,async()=>{i.res=await m(this,J).call(this,i)})}catch(l){return j(this,H,We).call(this,l,i)}return u instanceof Promise?u.then(l=>l||(i.finalized?i.res:m(this,J).call(this,i))).catch(l=>j(this,H,We).call(this,l,i)):u??m(this,J).call(this,i)}const c=ls(o[0],this.errorHandler,m(this,J));return(async()=>{try{const u=await c(i);if(!u.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return u.res}catch(u){return j(this,H,We).call(this,u,i)}})()},Oe),Cs=[];function gr(e,t){const r=this.buildAllMatchers(),s=((a,n)=>{const o=r[a]||r[P],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],Cs];const u=c.indexOf("",1);return[o[1][u],c]});return this.match=s,s(e,t)}var Ve="[^/]+",Le=".*",Me="(?:|/.*)",Te=Symbol(),br=new Set(".\\+*[^]$()");function wr(e,t){return e.length===1?t.length===1?e<t?-1:1:-1:t.length===1||e===Le||e===Me?1:t===Le||t===Me?-1:e===Ve?1:t===Ve?-1:e.length===t.length?e<t?-1:1:t.length-e.length}var _e,fe,z,ye,Tr=(ye=class{constructor(){R(this,_e);R(this,fe);R(this,z,Object.create(null))}insert(t,r,s,a,n){if(t.length===0){if(m(this,_e)!==void 0)throw Te;if(n)return;T(this,_e,r);return}const[o,...i]=t,c=o==="*"?i.length===0?["","",Le]:["","",Ve]:o==="/*"?["","",Me]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let u;if(c){const l=c[1];let d=c[2]||Ve;if(l&&c[2]&&(d===".*"||(d=d.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(d))))throw Te;if(u=m(this,z)[d],!u){if(Object.keys(m(this,z)).some(_=>_!==Le&&_!==Me))throw Te;if(n)return;u=m(this,z)[d]=new ye,l!==""&&T(u,fe,a.varIndex++)}!n&&l!==""&&s.push([l,m(u,fe)])}else if(u=m(this,z)[o],!u){if(Object.keys(m(this,z)).some(l=>l.length>1&&l!==Le&&l!==Me))throw Te;if(n)return;u=m(this,z)[o]=new ye}u.insert(i,r,s,a,n)}buildRegExpStr(){const r=Object.keys(m(this,z)).sort(wr).map(s=>{const a=m(this,z)[s];return(typeof m(a,fe)=="number"?`(${s})@${m(a,fe)}`:br.has(s)?`\\${s}`:s)+a.buildRegExpStr()});return typeof m(this,_e)=="number"&&r.unshift(`#${m(this,_e)}`),r.length===0?"":r.length===1?r[0]:"(?:"+r.join("|")+")"}},_e=new WeakMap,fe=new WeakMap,z=new WeakMap,ye),ze,Fe,Es,Sr=(Es=class{constructor(){R(this,ze,{varIndex:0});R(this,Fe,new Tr)}insert(e,t,r){const s=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const u=`@\\${o}`;return a[o]=[u,c],o++,i=!0,u}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return m(this,Fe).insert(n,t,s,m(this,ze),r),s}buildRegExp(){let e=m(this,Fe).buildRegExpStr();if(e==="")return[/^$/,[],[]];let t=0;const r=[],s=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(r[++t]=Number(n),"$()"):(o!==void 0&&(s[Number(o)]=++t),"")),[new RegExp(`^${e}`),r,s]}},ze=new WeakMap,Fe=new WeakMap,Es),Ir=[/^$/,[],Object.create(null)],Ye=Object.create(null);function ks(e){return Ye[e]??(Ye[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(t,r)=>r?`\\${r}`:"(?:|/.*)")}$`))}function Rr(){Ye=Object.create(null)}function vr(e){var u;const t=new Sr,r=[];if(e.length===0)return Ir;const s=e.map(l=>[!/\*|\/:/.test(l[0]),...l]).sort(([l,d],[_,E])=>l?1:_?-1:d.length-E.length),a=Object.create(null);for(let l=0,d=-1,_=s.length;l<_;l++){const[E,f,y]=s[l];E?a[f]=[y.map(([b])=>[b,Object.create(null)]),Cs]:d++;let h;try{h=t.insert(f,d,E)}catch(b){throw b===Te?new Ns(f):b}E||(r[d]=y.map(([b,g])=>{const D=Object.create(null);for(g-=1;g>=0;g--){const[N,w]=h[g];D[N]=w}return[b,D]}))}const[n,o,i]=t.buildRegExp();for(let l=0,d=r.length;l<d;l++)for(let _=0,E=r[l].length;_<E;_++){const f=(u=r[l][_])==null?void 0:u[1];if(!f)continue;const y=Object.keys(f);for(let h=0,b=y.length;h<b;h++)f[y[h]]=i[f[y[h]]]}const c=[];for(const l in o)c[l]=r[o[l]];return[n,c,a]}function ge(e,t){if(e){for(const r of Object.keys(e).sort((s,a)=>a.length-s.length))if(ks(r).test(t))return[...e[r]]}}var oe,ie,Ge,Ls,hs,Or=(hs=class{constructor(){R(this,Ge);S(this,"name","RegExpRouter");R(this,oe);R(this,ie);S(this,"match",gr);T(this,oe,{[P]:Object.create(null)}),T(this,ie,{[P]:Object.create(null)})}add(e,t,r){var i;const s=m(this,oe),a=m(this,ie);if(!s||!a)throw new Error(Ds);s[e]||[s,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[P]).forEach(u=>{c[e][u]=[...c[P][u]]})}),t==="/*"&&(t="*");const n=(t.match(/\/:/g)||[]).length;if(/\*$/.test(t)){const c=ks(t);e===P?Object.keys(s).forEach(u=>{var l;(l=s[u])[t]||(l[t]=ge(s[u],t)||ge(s[P],t)||[])}):(i=s[e])[t]||(i[t]=ge(s[e],t)||ge(s[P],t)||[]),Object.keys(s).forEach(u=>{(e===P||e===u)&&Object.keys(s[u]).forEach(l=>{c.test(l)&&s[u][l].push([r,n])})}),Object.keys(a).forEach(u=>{(e===P||e===u)&&Object.keys(a[u]).forEach(l=>c.test(l)&&a[u][l].push([r,n]))});return}const o=Ts(t)||[t];for(let c=0,u=o.length;c<u;c++){const l=o[c];Object.keys(a).forEach(d=>{var _;(e===P||e===d)&&((_=a[d])[l]||(_[l]=[...ge(s[d],l)||ge(s[P],l)||[]]),a[d][l].push([r,n-u+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(m(this,ie)).concat(Object.keys(m(this,oe))).forEach(t=>{e[t]||(e[t]=j(this,Ge,Ls).call(this,t))}),T(this,oe,T(this,ie,void 0)),Rr(),e}},oe=new WeakMap,ie=new WeakMap,Ge=new WeakSet,Ls=function(e){const t=[];let r=e===P;return[m(this,oe),m(this,ie)].forEach(s=>{const a=s[e]?Object.keys(s[e]).map(n=>[n,s[e][n]]):[];a.length!==0?(r||(r=!0),t.push(...a)):e!==P&&t.push(...Object.keys(s[P]).map(n=>[n,s[P][n]]))}),r?vr(t):null},hs),ce,se,ys,jr=(ys=class{constructor(e){S(this,"name","SmartRouter");R(this,ce,[]);R(this,se,[]);T(this,ce,e.routers)}add(e,t,r){if(!m(this,se))throw new Error(Ds);m(this,se).push([e,t,r])}match(e,t){if(!m(this,se))throw new Error("Fatal error");const r=m(this,ce),s=m(this,se),a=r.length;let n=0,o;for(;n<a;n++){const i=r[n];try{for(let c=0,u=s.length;c<u;c++)i.add(...s[c]);o=i.match(e,t)}catch(c){if(c instanceof Ns)continue;throw c}this.match=i.match.bind(i),T(this,ce,[i]),T(this,se,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(m(this,se)||m(this,ce).length!==1)throw new Error("No active router has been determined yet.");return m(this,ce)[0]}},ce=new WeakMap,se=new WeakMap,ys),Ce=Object.create(null),ue,F,Ee,je,U,re,pe,De,Dr=(De=class{constructor(t,r,s){R(this,re);R(this,ue);R(this,F);R(this,Ee);R(this,je,0);R(this,U,Ce);if(T(this,F,s||Object.create(null)),T(this,ue,[]),t&&r){const a=Object.create(null);a[t]={handler:r,possibleKeys:[],score:0},T(this,ue,[a])}T(this,Ee,[])}insert(t,r,s){T(this,je,++us(this,je)._);let a=this;const n=tr(r),o=[];for(let i=0,c=n.length;i<c;i++){const u=n[i],l=n[i+1],d=or(u,l),_=Array.isArray(d)?d[0]:u;if(_ in m(a,F)){a=m(a,F)[_],d&&o.push(d[1]);continue}m(a,F)[_]=new De,d&&(m(a,Ee).push(d),o.push(d[1])),a=m(a,F)[_]}return m(a,ue).push({[t]:{handler:s,possibleKeys:o.filter((i,c,u)=>u.indexOf(i)===c),score:m(this,je)}}),a}search(t,r){var c;const s=[];T(this,U,Ce);let n=[this];const o=bs(r),i=[];for(let u=0,l=o.length;u<l;u++){const d=o[u],_=u===l-1,E=[];for(let f=0,y=n.length;f<y;f++){const h=n[f],b=m(h,F)[d];b&&(T(b,U,m(h,U)),_?(m(b,F)["*"]&&s.push(...j(this,re,pe).call(this,m(b,F)["*"],t,m(h,U))),s.push(...j(this,re,pe).call(this,b,t,m(h,U)))):E.push(b));for(let g=0,D=m(h,Ee).length;g<D;g++){const N=m(h,Ee)[g],w=m(h,U)===Ce?{}:{...m(h,U)};if(N==="*"){const L=m(h,F)["*"];L&&(s.push(...j(this,re,pe).call(this,L,t,m(h,U))),T(L,U,w),E.push(L));continue}const[C,k,I]=N;if(!d&&!(I instanceof RegExp))continue;const A=m(h,F)[C],x=o.slice(u).join("/");if(I instanceof RegExp){const L=I.exec(x);if(L){if(w[k]=L[0],s.push(...j(this,re,pe).call(this,A,t,m(h,U),w)),Object.keys(m(A,F)).length){T(A,U,w);const G=((c=L[0].match(/\//))==null?void 0:c.length)??0;(i[G]||(i[G]=[])).push(A)}continue}}(I===!0||I.test(d))&&(w[k]=d,_?(s.push(...j(this,re,pe).call(this,A,t,w,m(h,U))),m(A,F)["*"]&&s.push(...j(this,re,pe).call(this,m(A,F)["*"],t,w,m(h,U)))):(T(A,U,w),E.push(A)))}}n=E.concat(i.shift()??[])}return s.length>1&&s.sort((u,l)=>u.score-l.score),[s.map(({handler:u,params:l})=>[u,l])]}},ue=new WeakMap,F=new WeakMap,Ee=new WeakMap,je=new WeakMap,U=new WeakMap,re=new WeakSet,pe=function(t,r,s,a){const n=[];for(let o=0,i=m(t,ue).length;o<i;o++){const c=m(t,ue)[o],u=c[r]||c[P],l={};if(u!==void 0&&(u.params=Object.create(null),n.push(u),s!==Ce||a&&a!==Ce))for(let d=0,_=u.possibleKeys.length;d<_;d++){const E=u.possibleKeys[d],f=l[u.score];u.params[E]=a!=null&&a[E]&&!f?a[E]:s[E]??(a==null?void 0:a[E]),l[u.score]=!0}}return n},De),he,gs,Nr=(gs=class{constructor(){S(this,"name","TrieRouter");R(this,he);T(this,he,new Dr)}add(e,t,r){const s=Ts(t);if(s){for(let a=0,n=s.length;a<n;a++)m(this,he).insert(e,s[a],r);return}m(this,he).insert(e,t,r)}match(e,t){return m(this,he).search(e,t)}},he=new WeakMap,gs),Ms=class extends yr{constructor(e={}){super(e),this.router=e.router??new jr({routers:[new Or,new Nr]})}},O=e=>{const r={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},s=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(r.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(r.allowMethods);return async function(o,i){var l;function c(d,_){o.res.headers.set(d,_)}const u=await s(o.req.header("origin")||"",o);if(u&&c("Access-Control-Allow-Origin",u),r.credentials&&c("Access-Control-Allow-Credentials","true"),(l=r.exposeHeaders)!=null&&l.length&&c("Access-Control-Expose-Headers",r.exposeHeaders.join(",")),o.req.method==="OPTIONS"){r.origin!=="*"&&c("Vary","Origin"),r.maxAge!=null&&c("Access-Control-Max-Age",r.maxAge.toString());const d=await a(o.req.header("origin")||"",o);d.length&&c("Access-Control-Allow-Methods",d.join(","));let _=r.allowHeaders;if(!(_!=null&&_.length)){const E=o.req.header("Access-Control-Request-Headers");E&&(_=E.split(/\s*,\s*/))}return _!=null&&_.length&&(c("Access-Control-Allow-Headers",_.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),r.origin!=="*"&&o.header("Vary","Origin",{append:!0})}};function Ar(e){const t=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],r=[];for(const s of t)e[s]||r.push(s);if(r.length>0)throw new Error(`Missing required environment variables: ${r.join(", ")}

Please configure them:
`+r.map(s=>s==="TOSS_SECRET_KEY"||s==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${s} --project-name ur-live`:`  Check wrangler.jsonc for ${s} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function Cr(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function kr(e){const t=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),t.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):t.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(r){t.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:r instanceof Error?r.message:String(r)})}try{if(!e.SESSION_KV)t.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const r="test:env:check";await e.SESSION_KV.put(r,"ok",{expirationTtl:60}),await e.SESSION_KV.get(r)==="ok"?t.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):t.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(r){t.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:r instanceof Error?r.message:String(r)})}try{if(!e.CACHE_KV)t.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const r="test:cache:check";await e.CACHE_KV.put(r,"ok",{expirationTtl:60}),await e.CACHE_KV.get(r)==="ok"?t.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):t.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(r){t.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:r instanceof Error?r.message:String(r)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?t.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):t.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):t.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?t.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):t.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):t.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),t}function Lr(e){const t=[];t.push(""),t.push("========================================"),t.push("환경 변수 테스트 결과"),t.push("========================================"),t.push("");let r=0,s=0,a=0;for(const n of e){const o=n.status==="pass"?"✅":n.status==="warn"?"⚠️":"❌";t.push(`${o} ${n.name}: ${n.message}`),n.details&&t.push(`   → ${n.details}`),n.status==="pass"&&r++,n.status==="warn"&&s++,n.status==="fail"&&a++}return t.push(""),t.push("========================================"),t.push(`총 ${e.length}개 테스트:`),t.push(`  ✅ 성공: ${r}`),s>0&&t.push(`  ⚠️  경고: ${s}`),a>0&&t.push(`  ❌ 실패: ${a}`),t.push("========================================"),t.push(""),a>0?(t.push("❌ 환경 변수 설정이 완료되지 않았습니다."),t.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):s>0?t.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):t.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),t.join(`
`)}async function Mr(e){const t=await kr(e),r=t.filter(n=>n.status==="pass").length,s=t.filter(n=>n.status==="warn").length,a=t.filter(n=>n.status==="fail").length;return{success:a===0,summary:{total:t.length,pass:r,warn:s,fail:a},results:t,formatted:Lr(t)}}const ss={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function Pr(){const e=ss.ENV==="production";return{baseUrl:ss.TEST_BASE_URL,apiKey:ss.TEST_API_KEY,isProduction:e}}async function Ps(e,t){const r=Pr(),s=`${r.baseUrl}${e}`;try{const a=await fetch(s,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r.apiKey}`},body:JSON.stringify(t)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function Hr(e){try{const t={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((s,a)=>({SerialNum:a+1,ItemName:s.name,Qty:s.quantity,UnitPrice:s.unitPrice,SupplyCost:s.supplyPrice,Tax:s.taxAmount,Remark:s.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},r=await Ps("/eTaxInvoice/RegistAndIssue",t);if(r.code!==1)throw new Error(`바로빌 발행 실패: ${r.message}`);return{success:!0,ntsConfirmNumber:r.ntsconfirmNum,invoiceKey:r.invoiceKey,message:r.message}}catch(t){throw console.error("바로빌 세금계산서 발행 실패:",t),t}}async function Ur(e,t,r){try{const a=await Ps("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:t,Memo:r});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(s){throw console.error("바로빌 세금계산서 취소 실패:",s),s}}function ke(){return!1}async function xr(e){return await Hr(e)}function $r(e,t,r){const s=Number(t.total_amount),a=Math.floor(s/1.1),n=s-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:t.buyer_business_number,buyerBusinessName:t.buyer_business_name||t.user_name,buyerCEO:t.buyer_ceo_name,buyerAddress:t.shipping_address,buyerEmail:t.user_email,buyerTel:t.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:r.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),u=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:u,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:s,memo:`주문번호: ${t.order_number}`,orderNo:t.order_number}}class Y extends Error{constructor(t,r,s){super(t),this.statusCode=r,this.code=s,this.name="AuthError"}}function Fr(e){return`${crypto.randomUUID()}-${e}`}function qr(e){var n,o,i,c,u,l,d;const t=e.id.toString(),r=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",s=((c=e.kakao_account)==null?void 0:c.email)||null,a=((u=e.properties)==null?void 0:u.profile_image)||((d=(l=e.kakao_account)==null?void 0:l.profile)==null?void 0:d.profile_image_url)||null;return{kakaoId:t,nickname:r,email:s,profileImage:a}}async function Kr(e,t,r,s,a){try{const n=await e.prepare(`
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
    `).bind(t,r,s,a).first();if(!n)throw new Y("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",n.id),n}catch(n){throw n instanceof Y?n:(console.error("[Auth] Database error during upsert:",n),new Y("Database error",500,"DB_ERROR"))}}async function Wr(e){try{const t=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!t.ok){const s=await t.text();throw console.error("[Kakao API] Failed to get user info:",s),new Y("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const r=await t.json();if(!r.id)throw new Y("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return r}catch(t){throw t instanceof Y?t:(console.error("[Kakao API] Network error:",t),new Y("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function Br(e,t,r){try{const s=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:r,redirect_uri:t,code:e}).toString()});if(!s.ok){const n=await s.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new Y(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await s.json()).access_token}catch(s){throw s instanceof Y?s:(console.error("[Kakao OAuth] Network error:",s),new Y("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function Hs(e,t){const r=await Wr(t),{kakaoId:s,nickname:a,email:n,profileImage:o}=qr(r);console.log("[Auth] Processing login for Kakao user:",s);const i=await Kr(e,s,a,n,o),c=Fr(i.id);return{user:i,sessionToken:c}}async function Us(e,t,r=30){try{const s=await e.get(t,"json");if(!s)return console.log(`[Cache MISS] ${t}`),null;const a=Date.now()-s.timestamp;return a>r*1e3?(console.log(`[Cache EXPIRED] ${t} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${t} (age: ${Math.round(a/1e3)}s)`),s.data)}catch(s){return console.error(`[Cache] Get error for key "${t}":`,s),null}}async function Je(e,t,r,s=30){try{const a={data:r,timestamp:Date.now()};await e.put(t,JSON.stringify(a),{expirationTtl:s}),console.log(`[Cache SET] ${t} (TTL: ${s}s)`)}catch(a){console.error(`[Cache] Set error for key "${t}":`,a)}}function Yr(e){const t=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:t,message:"API Request",context:e,duration:e.duration}))}function Vr(e){return{name:"tosspayments",async confirmPayment(t){try{const r=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:t.paymentKey,orderId:t.orderId,amount:t.amount})}),s=await r.json();if(!r.ok)return{success:!1,orderId:t.orderId,paymentKey:t.paymentKey,method:"",totalAmount:t.amount,status:"FAILED",approvedAt:"",error:s.message||"결제 승인 실패",rawData:s};let a={};s.card&&(a={cardCompany:s.card.company,cardNumber:s.card.number,installmentMonths:s.card.installmentPlanMonths||0});let n={};return s.virtualAccount&&(n={virtualAccountBank:s.virtualAccount.bankCode,virtualAccountNumber:s.virtualAccount.accountNumber,virtualAccountHolder:s.virtualAccount.customerName,virtualAccountDueDate:s.virtualAccount.dueDate}),{success:!0,orderId:s.orderId,paymentKey:s.paymentKey,method:s.method,totalAmount:s.totalAmount,status:s.status,approvedAt:s.approvedAt,transactionId:s.transactionKey,...a,...n,rawData:s}}catch(r){return{success:!1,orderId:t.orderId,paymentKey:t.paymentKey,method:"",totalAmount:t.amount,status:"FAILED",approvedAt:"",error:r.message,rawData:null}}},async cancelPayment(t){try{const r={cancelReason:t.cancelReason};t.cancelAmount&&(r.cancelAmount=t.cancelAmount);const s=await fetch(`https://api.tosspayments.com/v1/payments/${t.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(r)}),a=await s.json();return s.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(r){return{success:!1,error:r.message}}},async getPayment(t){try{const r=await fetch(`https://api.tosspayments.com/v1/payments/${t}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),s=await r.json();if(!r.ok)throw new Error(s.message);return{success:!0,orderId:s.orderId,paymentKey:s.paymentKey,method:s.method,totalAmount:s.totalAmount,status:s.status,approvedAt:s.approvedAt,rawData:s}}catch(r){throw r}}}}function Jr(e,t){switch(e.toLowerCase()){case"tosspayments":return Vr(t);default:throw new Error(`Unknown payment provider: ${e}`)}}const p=new Ms;p.use("*",async(e,t)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{Ar(e.env),Cr(e.env)}catch(s){console.error("[ENV] Validation failed:",s)}await t()});async function xs(e,t){if(!t)return null;try{const r=await e.get(`session:${t}`);if(!r)return null;const s=JSON.parse(r);return s.expires_at&&Date.now()>s.expires_at?(await e.delete(`session:${t}`),null):{user_id:s.user_id,user_type:s.user_type||"user"}}catch(r){return console.error("[Auth] Session lookup error:",r),null}}async function q(e,t){var n;const{SESSION_KV:r}=e.env;let s=e.req.header("X-Session-Token");if(s||(s=(n=e.req.header("Authorization"))==null?void 0:n.replace("Bearer ","")),!s){const o=e.req.header("Cookie");if(o){const i=o.match(/session=([^;]+)/);s=i?i[1]:void 0}}const a=await xs(r,s);if(!a)return e.json({success:!1,error:"인증이 필요합니다. 로그인 해주세요."},401);try{if(s){const o=await r.get(`session:${s}`);if(o){const i=JSON.parse(o),c=i.expires_at-Date.now(),u=10080*60*1e3;if(c<u){const l=Date.now()+2592e6;await r.put(`session:${s}`,JSON.stringify({...i,expires_at:l}),{expirationTtl:720*60*60}),console.log("[Auth] ✅ Session auto-renewed for user:",a.user_id,"- New expiration:",new Date(l).toISOString())}}}}catch(o){console.error("[Auth] Session renewal error:",o)}e.set("userId",a.user_id),e.set("userType",a.user_type),await t()}async function as(e,t){try{const r=await e.get(t);return r?JSON.parse(r):null}catch(r){return console.error("[Cache] Read error:",r),null}}async function ns(e,t,r,s=60){try{await e.put(t,JSON.stringify(r),{expirationTtl:s})}catch(a){console.error("[Cache] Write error:",a)}}async function os(e,...t){try{await Promise.all(t.map(r=>e.delete(r)))}catch(r){console.error("[Cache] Delete error:",r)}}async function qe(e,t,r,s,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(t,r,s,a,n,o||null).run(),console.log(`[Notification] Created for ${r} ${t}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function zr(e,t,r,s,a){await qe(e,t,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${s}님의 주문 (${r}) - ${Xr(a)}`,"/seller/orders")}async function $s(e,t,r,s,a,n){let o="",i="";switch(s){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${r}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${r}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${r}가 배송 완료되었습니다`;break;default:return}await qe(e,t,"user","shipping_status",o,i,"/my-orders")}async function Gr(e,t,r,s,a){await qe(e,t,"seller","low_stock","⚠️ 재고 부족 알림",`${r}의 재고가 ${s}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function Xr(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function Qr(e,t,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const s=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:t,description:r,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!s.ok){const d=await s.text();throw new Error(`YouTube Broadcast 생성 실패: ${d}`)}const n=(await s.json()).id,o=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${t} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!o.ok){const d=await o.text();throw new Error(`YouTube Stream 생성 실패: ${d}`)}const i=await o.json(),c=i.id,u=i.cdn.ingestionInfo.streamName,l=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:n,streamId:c,streamKey:u,streamUrl:l}}catch(s){throw console.error("[YouTube API] Live broadcast creation failed:",s),s}}async function Zr(e,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${t}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!r.ok){const s=await r.text();throw new Error(`YouTube 방송 종료 실패: ${s}`)}}catch(r){throw console.error("[YouTube API] Live broadcast end failed:",r),r}}async function et(e,t,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let s=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${t}&part=snippet,authorDetails`;r&&(s+=`&pageToken=${r}`);const a=await fetch(s,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const o=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${o}`)}const n=await a.json();return{messages:n.items||[],nextPageToken:n.nextPageToken,pollingIntervalMillis:n.pollingIntervalMillis||5e3}}catch(s){throw console.error("[YouTube API] Get chat messages failed:",s),s}}async function st(e,t){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const r=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},s=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}&key=${e.apiKey}`,a=await fetch(s,{headers:r});if(!a.ok){const u=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${u}`)}const n=await a.json();if(!n.items||n.items.length===0)throw new Error("Video not found");const o=n.items[0],i=o.statistics,c=o.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(r){throw console.error("[YouTube API] Get live stats failed:",r),r}}function Fs(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const t=new URL(e);if(t.hostname.includes("youtube.com")){const r=t.searchParams.get("v");if(r)return r;const s=t.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(s)return s[2]}if(t.hostname==="youtu.be"){const r=t.pathname.slice(1).split("?")[0];if(r&&r.length===11)return r}return null}catch{return null}}function qs(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){const r=t.pathname.match(/\/video\/(\d+)/);if(r)return r[1];const s=t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(s)return s[1]}return t.hostname.includes("vm.tiktok.com")||t.hostname.includes("vt.tiktok.com")?t.pathname.slice(1):null}catch{return null}}function rt(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){if(t.pathname.includes("/live"))return"live";if(t.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Ks(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){const r=t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return t.hostname.includes("vm.tiktok.com")||t.hostname.includes("vt.tiktok.com")?t.pathname.slice(1):null}catch{return null}}p.use("*",async(e,t)=>{await t(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const r=new URL(e.req.url);r.hostname!=="localhost"&&r.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",O());p.use("/api/*",async(e,t)=>{const r=Date.now(),s=e.req.method,a=e.req.path;await t();const n=Date.now()-r,o=e.res.status,i={method:s,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),Yr(i)});p.use("/static/*",async(e,t)=>{await t(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/images/*",async(e,t)=>{await t(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});async function Ws(e,t,r,s){const a=crypto.randomUUID(),n=Date.now()+1440*60*1e3,o={user_id:t,user_type:r,userData:s,expires_at:n};return await e.put(`session:${a}`,JSON.stringify(o),{expirationTtl:86400}),console.log(`[createSession] ✅ Session created for ${r} user ${t}`),a}async function Ne(e,t){const r=await e.get(`session:${t}`);if(!r)return null;const s=JSON.parse(r);return s.expires_at&&Date.now()>s.expires_at?(await e.delete(`session:${t}`),null):{session_token:t,[`${s.user_type}_id`]:s.user_id,user_type:s.user_type,...s.userData}}p.post("/api/auth/user/register",O(),async e=>{const{DB:t}=e.env;try{const{email:r,password:s,name:a,phone:n}=await e.req.json();if(!r||!s||!a)return e.json({success:!1,error:"이메일, 비밀번호, 이름은 필수입니다"},400);const o=`placeholder_hash_for_${s}`;try{const c=(await t.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(r,o,a,n||null).run()).meta.last_row_id,u=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:u,user:{id:c,email:r,name:a,phone:n}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(r){return console.error("[User Register] Error:",r),e.json({success:!1,error:r.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/auth/user/login",O(),async e=>{const{DB:t,SESSION_KV:r}=e.env;try{const{email:s,password:a}=await e.req.json();if(!s||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await t.prepare("SELECT * FROM users WHERE email = ?").bind(s).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${a}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await t.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();const i=crypto.randomUUID(),c=Date.now()+1440*60*1e3;return await r.put(`session:${i}`,JSON.stringify({user_id:n.id,user_type:"user",expires_at:c}),{expirationTtl:1440*60}),console.log("[User Login] Session created in SESSION_KV for user:",n.id),e.json({success:!0,data:{session_token:i,user:{id:n.id,email:n.email,name:n.name,phone:n.phone,profile_image:n.profile_image}}})}catch(s){return console.error("[User Login] Error:",s),e.json({success:!1,error:s.message||"로그인 중 오류가 발생했습니다"},500)}});p.post("/api/auth/login",O(),async e=>{const{DB:t}=e.env;try{const{username:r,password:s,userType:a}=await e.req.json();if(!r||!s||!a)return e.json({success:!1,error:"아이디와 비밀번호를 입력해주세요"},400);let n,o=a==="admin"?"admins":"sellers";if(n=await t.prepare(`SELECT * FROM ${o} WHERE username = ? OR email = ?`).bind(r,r).first(),!n)return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);const i=a==="admin"&&(r==="admin"||r==="admin@example.com")&&s==="admin123",c=a==="seller"&&(r==="seller1"&&s==="seller123"||r==="seller2"&&s==="seller123"),u=n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${s}`);if(!(i||c||u))return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);if(!n.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(a==="seller"&&n.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다"},403);const d=await Ws(e.env.SESSION_KV,n.id,a,{username:n.username,name:n.name,email:n.email,businessName:n.business_name,role:n.role});return await t.prepare(`UPDATE ${o} SET last_login_at = datetime('now') WHERE id = ?`).bind(n.id).run(),e.json({success:!0,data:{sessionToken:d,user:{id:n.id,username:n.username,name:n.name,email:n.email,type:a,businessName:n.business_name,role:n.role}}})}catch(r){return console.error("Login error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/auth/logout",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token");return r&&await e.env.SESSION_KV.delete(`session:${r}`),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/register",O(),async e=>{const{DB:t}=e.env;try{const{email:r,password:s,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!r||!s||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(s.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=r.split("@")[0],u=`placeholder_hash_for_${s}`;try{const l=await t.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,r,u,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:l.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(l){const d=l.message||"";if(d.includes("UNIQUE")||d.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw l}}catch(r){return console.error("Seller registration error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/login",O(),async e=>{const{DB:t}=e.env;try{const{email:r,password:s}=await e.req.json();if(!r||!s)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await t.prepare("SELECT * FROM admins WHERE email = ?").bind(r).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(r==="admin@example.com"&&s==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${s}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=await Ws(e.env.SESSION_KV,a.id,"admin",{username:a.username,email:a.email,name:a.name,role:a.role});return await t.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),e.json({success:!0,data:{token:i,admin:{id:a.id,username:a.username,email:a.email,name:a.name,role:a.role}}})}catch(r){return console.error("Admin login error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/auth/verify",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const s=await Ne(e.env.SESSION_KV,r);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=s.user_type==="admin"?"admins":"sellers",n=s.user_type==="admin"?s.admin_id:s.seller_id,o=await t.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:s.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name,role:o.role}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/auth/kakao/sync/callback",async e=>{var r,s,a,n,o,i,c,u,l,d,_,E,f;const{DB:t}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!t);const y=e.req.query("code"),h=e.req.query("state")||"/",b=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!y,state:h,error:b}),b)return console.error("[Kakao Sync] OAuth error:",b),e.redirect(`${h}?error=kakao_oauth_${b}`);if(!y)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${h}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const g=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",D=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",g.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",D),console.log("[Kakao Sync] Step 1: Fetching access token...");const N=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:g,redirect_uri:D,code:y})});if(console.log("[Kakao Sync] Token response status:",N.status),console.log("[Kakao Sync] Token request details:",{client_id:g,redirect_uri:D,code_length:y.length,code_prefix:y.substring(0,20)}),!N.ok){const K=await N.text();return console.error("[Kakao Sync] Token request failed:",K),e.redirect(`${h}?error=token_request_failed&detail=${encodeURIComponent(K)}`)}const w=await N.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!w.access_token,error:w.error,errorDescription:w.error_description}),!w.access_token)return console.error("[Kakao Sync] Token error:",w),e.redirect(`${h}?error=token_failed&detail=${encodeURIComponent(w.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const C=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${w.access_token}`}});console.log("[Kakao Sync] User response status:",C.status);const k=await C.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!k.id,id:k.id,hasNickname:!!((r=k.properties)!=null&&r.nickname||(a=(s=k.kakao_account)==null?void 0:s.profile)!=null&&a.nickname)}),!k.id)return console.error("[Kakao Sync] Failed to get user info:",k),e.redirect(`${h}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const I=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${w.access_token}`}});console.log("[Kakao Sync] Terms response status:",I.status);let A=null;if(I.ok?(A=await I.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=A.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=A.allowed_service_terms)==null?void 0:o.map(K=>K.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!t)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${h}?error=db_not_available`);const x=k.id.toString(),L=((i=k.properties)==null?void 0:i.nickname)||((u=(c=k.kakao_account)==null?void 0:c.profile)==null?void 0:u.nickname)||"Kakao User",G=((l=k.kakao_account)==null?void 0:l.email)||"",X=((d=k.properties)==null?void 0:d.profile_image)||((E=(_=k.kakao_account)==null?void 0:_.profile)==null?void 0:E.profile_image_url)||"",Ae=w.access_token,$=((f=A==null?void 0:A.allowed_service_terms)==null?void 0:f.map(K=>K.tag))||[],le=JSON.stringify($);console.log("[Kakao Sync] User data:",{kakaoId:x,nickname:L,email:G?"exists":"none",serviceTerms:$});try{const K=await t.prepare("SELECT * FROM users WHERE kakao_id = ?").bind(x).first();console.log("[Kakao Sync] Existing user check:",!!K);let Q;K?(Q=K.id,await t.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L,G,X,Q).run(),console.log("[Kakao Sync] Updated user:",Q)):(Q=(await t.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(x,L,G||null,X||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",Q)),console.log("[Kakao Sync] User saved successfully, userId:",Q),console.log("[Kakao Sync] Step 4: Creating session...");const{SESSION_KV:Vs}=e.env,Xe=crypto.randomUUID(),Js=Date.now()+1440*60*1e3;await Vs.put(`session:${Xe}`,JSON.stringify({user_id:Q,user_type:"user",expires_at:Js}),{expirationTtl:1440*60}),console.log("[Kakao Sync] Session created successfully in SESSION_KV"),console.log("[Kakao Sync] Step 5: Redirecting...");const is=h.includes("?")?`${h}&login=success&session=${Xe}&userId=${Q}&userName=${encodeURIComponent(L)}`:`${h}?login=success&session=${Xe}&userId=${Q}&userName=${encodeURIComponent(L)}`;return console.log("[Kakao Sync] Redirect URL:",is),e.redirect(is)}catch(K){return console.error("[Kakao Sync] Database error:",K),console.error("[Kakao Sync] DB error details:",{message:K.message,name:K.name}),e.redirect(`${h}?error=database_error&detail=${encodeURIComponent(K.message)}`)}}catch(y){console.error("[Kakao Sync] Exception:",y),console.error("[Kakao Sync] Error details:",{message:y.message,stack:y.stack,name:y.name});const h=e.req.query("state")||"/",b=encodeURIComponent(y.message||"unknown");return e.redirect(`${h}?error=kakao_sync_failed&detail=${b}`)}});p.post("/api/auth/kakao/callback",O(),async e=>{const{DB:t}=e.env;try{const{code:r,redirect_uri:s}=await e.req.json();if(!r)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=s||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow");const n=await Br(r,a,e.env.KAKAO_REST_API_KEY),{user:o,sessionToken:i}=await Hs(t,n),c=Date.now()+720*60*60*1e3;return await e.env.SESSION_KV.put(`session:${i}`,JSON.stringify({user_id:o.id,user_type:"user",expires_at:c}),{expirationTtl:720*60*60}),console.log("[Kakao Callback] ✅ Session saved to SESSION_KV for user:",o.id,"- Expires:",new Date(c).toISOString()),e.json({success:!0,data:{session_token:i,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image}}})}catch(r){return console.error("[Kakao Callback] Error:",r),r instanceof Y?e.json({success:!1,error:r.message,code:r.code},r.statusCode):e.json({success:!1,error:r.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/sync",O(),async e=>{const{DB:t}=e.env;try{const{accessToken:r}=await e.req.json();if(!r)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Sync] Verifying access token");const{user:s,sessionToken:a}=await Hs(t,r),n=Date.now()+720*60*60*1e3;return await e.env.SESSION_KV.put(`session:${a}`,JSON.stringify({user_id:s.id,user_type:"user",expires_at:n}),{expirationTtl:720*60*60}),console.log("[Kakao Sync] ✅ Session saved to SESSION_KV for user:",s.id,"- Expires:",new Date(n).toISOString()),console.log("[Kakao Sync] Login successful"),e.json({success:!0,data:{session_token:a,user:{id:s.id,name:s.name,email:s.email,profile_image:s.profile_image}}})}catch(r){return console.error("[Kakao Sync] Error:",r),r instanceof Y?e.json({success:!1,error:r.message,code:r.code},r.statusCode):e.json({success:!1,error:r instanceof Error?r.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});p.get("/api/auth/validate",O(),async e=>{var r;const{SESSION_KV:t}=e.env;try{const s=e.req.header("X-Session-Token")||((r=e.req.header("Authorization"))==null?void 0:r.replace("Bearer ",""))||"";if(!s)return e.json({success:!1,error:"No session token provided",code:"NO_TOKEN"},401);const a=await xs(t,s);return a?e.json({success:!0,data:{user_id:a.user_id,user_type:a.user_type,session_valid:!0}}):e.json({success:!1,error:"Session expired or invalid",code:"SESSION_EXPIRED"},401)}catch(s){return console.error("[Auth Validate] Error:",s),e.json({success:!1,error:"Validation failed",code:"VALIDATION_ERROR"},500)}});p.post("/api/auth/kakao/logout",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token")||"";return r&&(await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(r){return console.error("[Kakao Sync] Logout error:",r),e.json({success:!1,error:"Logout failed"},500)}});p.post("/api/auth/kakao/unlink",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await t.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(r).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await t.prepare(`
      SELECT * FROM users WHERE id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(r).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const n=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),o=await n.json();n.ok?console.log("[Kakao Unlink] Kakao unlink successful:",o.id):console.warn("[Kakao Unlink] Kakao unlink failed:",o)}catch(n){console.error("[Kakao Unlink] Kakao API error:",n)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(),console.log("[Kakao Unlink] Sessions deleted"),await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await t.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(r){return console.error("[Kakao Unlink] Error:",r),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});p.post("/webhooks/kakao/unlink",async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),{user_id:s,referrer_type:a}=r;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:s,referrer_type:a}),!s)return e.json({success:!1,error:"user_id is required"},400);const n=await t.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(s.toString()).first();return n?(console.log("[Kakao Webhook] Deleting user data for user:",n.id),await t.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await t.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",s),e.json({success:!0}))}catch(r){return console.error("[Kakao Webhook] Error:",r),e.json({success:!1,error:"Webhook processing failed"},500)}});p.get("/api/auth/user/verify",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const s=await Ne(e.env.SESSION_KV,r);if(!s||s.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=parseInt(r.split("_")[1]),n=await t.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();return n?e.json({success:!0,data:{user:{id:n.id,name:n.name,email:n.email,profileImage:n.profile_image,phone:n.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/shipping-addresses",O(),q,async e=>{const{DB:t}=e.env,r=e.get("userId");try{const s=await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();return e.json({success:!0,data:s.results||[]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/shipping-addresses/:userId",O(),q,async e=>{const{DB:t}=e.env,r=e.get("userId"),s=parseInt(e.req.param("userId"));try{if(s!==r)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/shipping-addresses",O(),async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),s=r.user_id,a=r.recipient_name,n=r.phone,o=r.postal_code,i=r.address,c=r.address_detail,u=r.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(r)),!s||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:s,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);u&&await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(s).run();const l=await t.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s,a,n,o||"",i,c||"",u?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:l.meta.last_row_id}),e.json({success:!0,data:{id:l.meta.last_row_id}})}catch(r){return console.error("[POST /api/shipping-addresses] Error:",r),e.json({success:!1,error:r.message},500)}});p.put("/api/shipping-addresses/:id",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("id"),s=await e.req.json(),a=s.user_id,n=s.recipient_name,o=s.phone,i=s.postal_code,c=s.address,u=s.address_detail,l=s.is_default;return l&&await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await t.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,u||"",l?1:0,r,a).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/shipping-addresses/:id",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("id"),s=e.req.query("userId");return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r,s).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});async function M(e){const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await Ne(e.env.SESSION_KV,t);return!r||r.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:r.admin_id,userData:r}}async function v(e){const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await Ne(e.env.SESSION_KV,t);return!r||r.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:r.seller_id,userData:r}}p.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));p.get("/api/test/env",async e=>{try{const t=await Mr(e.env);return e.json(t)}catch(t){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:t instanceof Error?t.message:String(t)},500)}});p.get("/api/streams",async e=>{const{DB:t,CACHE_KV:r}=e.env;try{const s="streams:live",a=await r.get(s,"json");if(a)return e.json({success:!0,data:a,cached:!0});const n=await t.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();return await r.put(s,JSON.stringify(n.results),{expirationTtl:600}),e.json({success:!0,data:n.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/streams/:id",async e=>{const{DB:t}=e.env,r=e.req.param("id");try{const s=await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(r).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"Stream not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/live-streams",async e=>{const{DB:t}=e.env,{status:r,seller_id:s,limit:a="20",offset:n="0"}=e.req.query();try{let o=`
      SELECT ls.*, 
             s.display_name as seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE 1=1
    `;const i=[];r&&(o+=" AND ls.status = ?",i.push(r)),s&&(o+=" AND ls.seller_id = ?",i.push(s)),o+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',o+=" LIMIT ? OFFSET ?",i.push(parseInt(a),parseInt(n));const{results:c}=await t.prepare(o).bind(...i).all();return e.json({success:!0,data:c})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});p.get("/api/live-streams/:id",async e=>{const{DB:t}=e.env,r=e.req.param("id");try{const s=await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(r).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"Stream not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/products",async e=>{const{DB:t,CACHE_KV:r}=e.env;try{const s=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${s||"all"}:${a}:${n}`,i=await as(r,o);if(i)return e.json({success:!0,data:i,cached:!0});let c;s==="true"?c=`
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
      `:c=`
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
      `;const l=(await t.prepare(c).bind(a,n).all()).results||[];return await ns(r,o,l,300),e.json({success:!0,data:l,cached:!1})}catch(s){return console.error("Products list error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/products/popular",async e=>{const{DB:t,CACHE_KV:r}=e.env;try{const s=await as(r,"products:popular");if(s)return e.json({success:!0,data:s,cached:!0});const n=(await t.prepare(`
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
    `).all()).results||[];return await ns(r,"products:popular",n,600),e.json({success:!0,data:n,cached:!1})}catch(s){return console.error("Popular products error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/search/suggestions",async e=>{const{DB:t}=e.env;try{const r=e.req.query("q")||"";if(!r.trim()||r.length<2)return e.json({success:!0,data:{suggestions:[]}});const s=`%${r}%`,a=await t.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(s).all(),n=await t.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(s,s).all(),o=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(n.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:o}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/products/search",async e=>{const{DB:t}=e.env;try{const r=e.req.query("q")||"",s=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!r.trim())return e.json({success:!1,error:"Search query is required"},400);const n=`%${r}%`,o=await t.prepare(`
      SELECT 
        p.*,
        s.display_name as seller_name,
        s.username as seller_username
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(n,n,n,s,a).all(),i=await t.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
    `).bind(n,n,n).first();return e.json({success:!0,data:{products:o.results||[],total:(i==null?void 0:i.total)||0,query:r,limit:s,offset:a}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/products/:id",async e=>{const{DB:t}=e.env,r=e.req.param("id");try{const s=await t.prepare(`
      SELECT 
        p.*,
        COALESCE(s.name, s.username, 'UR Live') as seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ? AND p.is_active = 1
    `).bind(r).first();if(!s)return e.json({success:!1,error:"Product not found"},404);const a=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(r).all();return e.json({success:!0,data:{product:s,options:a.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/products/:id/stock",async e=>{const{DB:t}=e.env,r=e.req.param("id");try{const s=await t.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(r).first();return s?e.json({success:!0,data:{productId:s.id,productName:s.name,stock:s.stock,available:s.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/streams/:streamId/products",async e=>{const{DB:t}=e.env,r=e.req.param("streamId");try{const s=await t.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(r).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/cart",q,async e=>{const{DB:t}=e.env,r=e.get("userId");try{const s=await t.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:`장바구니 조회 실패: ${s.message}`},500)}});p.get("/api/cart/:userId",q,async e=>{const{DB:t}=e.env,r=e.get("userId"),s=e.req.param("userId");try{let a=await t.prepare("SELECT id FROM users WHERE id = ?").bind(r).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(s!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await t.prepare(`
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
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/users",async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),{kakaoId:s,name:a,email:n,phone:o}=r;if(!s||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(s).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await t.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(s,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(r){return console.error("Error creating user:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/cart",async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),{userId:s,kakaoId:a,productId:n,optionId:o,quantity:i,priceSnapshot:c,liveStreamId:u}=r,l=a||s;if(!l)return e.json({success:!1,error:"userId or kakaoId is required"},400);let d=await t.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();if(d||(d=await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()),!d)return e.json({success:!1,error:"User not found"},404);const _=d.id,E=await t.prepare("SELECT stock FROM products WHERE id = ?").bind(n).first();if(!E||E.stock<i)return e.json({success:!1,error:"Insufficient stock"},400);const f=await t.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(_,n,o||null,o||null).first();let y;if(f){const h=f.quantity+i;await t.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(h,c,f.id).run(),y=f.id}else y=(await t.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(_,n,o||null,i,c,u||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:y,isUpdate:!!f}})}catch(r){return console.error("[API /api/cart POST] Error:",r),console.error("[API /api/cart POST] Error message:",r.message),console.error("[API /api/cart POST] Error stack:",r.stack),e.json({success:!1,error:"Failed to add to cart: "+(r.message||"Unknown error")},500)}});p.delete("/api/cart/:cartItemId",async e=>{const{DB:t}=e.env,r=e.req.param("cartItemId");try{return await t.prepare("DELETE FROM cart_items WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/cart/clear/:userId",async e=>{const{DB:t}=e.env,r=e.req.param("userId");try{return await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(r).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/cart/:cartItemId",async e=>{const{DB:t}=e.env,r=e.req.param("cartItemId");try{const s=await e.req.json(),{quantity:a}=s;if(!a||a<1)return e.json({success:!1,error:"Invalid quantity"},400);const n=await t.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(r).first();return n?n.stock<a?e.json({success:!1,error:"Insufficient stock"},400):(await t.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,r).run(),e.json({success:!0})):e.json({success:!1,error:"Cart item not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders",async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),{userId:s,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:u,recipientPhone:l,deliveryMemo:d,totalAmount:_,shippingFee:E,orderNumber:f,paymentKey:y,paymentMethod:h}=r;if(o&&o.length>0){const I=[];for(const $ of o){const le=await t.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind($.productId).first();if(!le)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${$.productId})`},400);if(le.stock<$.quantity)return e.json({success:!1,error:`재고 부족: ${le.name} (남은 재고: ${le.stock}개)`},400);I.push({product_id:$.productId,option_id:$.optionId||null,quantity:$.quantity,price:$.price,product_name:le.name,product_stock:le.stock})}const A=Date.now(),x=Math.random().toString(36).substring(2,8).toUpperCase(),L=f||`ORDER_${A}_${x}`,G=c?`${i} ${c}`:i,Ae=(await t.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(L,s||null,_||0,"pending","pending",G||null,u||null,l||null,d||null,y||null).run()).meta.last_row_id;for(const $ of I)await t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ae,$.product_id,$.option_id,$.quantity,$.price,$.product_name).run();return e.json({success:!0,data:{orderId:Ae,orderNumber:L,totalAmount:_}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const b=a.map(()=>"?").join(","),g=await t.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${b})
    `).bind(...a).all();if(g.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const I of g.results)if(I.product_stock<I.quantity)return e.json({success:!1,error:`Insufficient stock for ${I.product_name}`},400);const D=g.results.reduce((I,A)=>I+A.price_snapshot*A.quantity,0),N=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,C=(await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(N,s,D,n.address,n.name,n.phone).run()).meta.last_row_id,k=[];for(const I of g.results){let A=!1,x="";for(let L=0;L<3;L++){if((await t.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND stock >= ?
            AND is_active = 1
        `).bind(I.quantity,I.product_id,I.quantity).run()).meta.changes>0){A=!0;break}const X=await t.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(I.product_id).first();if(!X||X.stock<I.quantity){x=`재고 부족: ${I.product_name} (남은 재고: ${(X==null?void 0:X.stock)||0}개)`;break}L<2?await new Promise(Ae=>setTimeout(Ae,50*L)):x="주문 처리 중 오류 발생. 다시 시도해주세요. (동시성 충돌)"}if(!A)return e.json({success:!1,error:x||"주문 처리 중 오류가 발생했습니다."},x.includes("재고 부족")?400:409);k.push(t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(C,I.product_id,I.option_id,I.quantity,I.price_snapshot,I.product_name))}k.push(t.prepare(`DELETE FROM cart_items WHERE id IN (${b})`).bind(...a)),await t.batch(k);try{const I=new Set;for(const A of g.results){const x=await t.prepare("SELECT seller_id FROM products WHERE id = ?").bind(A.product_id).first();x&&x.seller_id&&I.add(x.seller_id)}for(const A of I)await zr(t,A,N,buyerName||shippingName||"고객",D)}catch(I){console.error("[Order] Notification error:",I)}return e.json({success:!0,data:{orderId:C,orderNumber:N,totalAmount:D}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/current-product",async e=>{const{DB:t,LIVE_CACHE:r}=e.env,s=e.req.param("streamId");try{const a=`current-product:${s}`,n=await Us(r,a,3);if(n)return e.json({success:!0,data:n});const o=await t.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(s).first();if(!o||!o.current_product_id)return await Je(r,a,null,3),e.json({success:!0,data:null});const i=await t.prepare("SELECT * FROM products WHERE id = ?").bind(o.current_product_id).first(),c=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(),u={product:i,options:c.results};return await Je(r,a,u,3),e.json({success:!0,data:u})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:t}=e.env,r=e.req.param("streamId"),s=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${r}`,n=`current-product:${r}`,o=25e3,i=Date.now();for(;Date.now()-i<o;){const c=await t.get(a)||"0";if(c!==s){const u=await Us(t,n,30);return e.json({success:!0,timestamp:c,data:u,changed:!0})}await new Promise(u=>setTimeout(u,1e3))}return e.json({success:!0,timestamp:s,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/streams",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=r.sellerId,a=await t.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(s).all();return e.json({success:!0,data:a.results||[]})}catch(s){return console.error("Error loading seller streams:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/streams",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:s,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:u,seller_instagram:l,seller_youtube:d,seller_facebook:_}=await e.req.json();let E=n,f="youtube",y=null,h=null,b=i;if(o&&!E&&(E=Fs(o),!E))if(E=qs(o),y=Ks(o),h=rt(o),E)f="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!b&&E&&f==="youtube"&&(b=`https://img.youtube.com/vi/${E}/maxresdefault.jpg`),!s||!E)return e.json({success:!1,error:"Title and live stream URL are required"},400);const g=await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s,a||null,E,u||"scheduled",c||null,r.sellerId,l||null,d||null,_||null,f,y,h,b||null).run(),D=await t.prepare("SELECT * FROM live_streams WHERE id = ?").bind(g.meta.last_row_id).first(),N=await t.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(r.sellerId).first();try{const{sendLiveStreamCreatedEmail:w}=await Promise.resolve().then(()=>it);w({streamId:g.meta.last_row_id,title:s,sellerName:(N==null?void 0:N.display_name)||(N==null?void 0:N.username)||"알 수 없음",platform:f,scheduledAt:c,status:u||"scheduled"}).then(C=>{C.success?console.log(`[Email] Live stream notification sent for stream #${C.meta.last_row_id}`):console.error("[Email] Failed to send notification:",C.error)}).catch(C=>{console.error("[Email] Exception while sending notification:",C)})}catch(w){console.error("[Email] Failed to send live stream notification:",w)}return e.json({success:!0,data:D})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/streams/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:u,status:l,seller_instagram:d,seller_youtube:_,seller_facebook:E}=await e.req.json(),f=[],y=[];if(n!==void 0&&(f.push("title = ?"),y.push(n)),o!==void 0&&(f.push("description = ?"),y.push(o)),c!==void 0||i!==void 0){let h=i,b="youtube",g=null;if(c&&(h=Fs(c),!h))if(h=qs(c),g=Ks(c),h)b="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);h!==void 0&&(f.push("youtube_video_id = ?"),y.push(h),f.push("platform = ?"),y.push(b),b==="tiktok"&&g&&(f.push("tiktok_username = ?"),y.push(g)))}return l!==void 0&&(f.push("status = ?"),y.push(l)),u!==void 0&&(f.push("scheduled_at = ?"),y.push(u)),d!==void 0&&(f.push("seller_instagram = ?"),y.push(d)),_!==void 0&&(f.push("seller_youtube = ?"),y.push(_)),E!==void 0&&(f.push("seller_facebook = ?"),y.push(E)),f.length===0?e.json({success:!1,error:"No fields to update"},400):(f.push("updated_at = datetime('now')"),await t.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...y,s).run(),e.json({success:!0}))}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/streams/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");return await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first()?(await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/youtube/create-live",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:s,description:a,scheduled_at:n}=await e.req.json();if(!s)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await Qr({accessToken:o},s,a||""),u=(await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s,a||null,i.broadcastId,n||null,r.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await qe(t,r.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${s} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${u}`),e.json({success:!0,data:{streamId:u,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(s){return console.error("[YouTube Live] Create broadcast error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("streamId"),a=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const o=a.youtube_broadcast_id||a.youtube_video_id;return o?(await Zr({accessToken:n},o),await t.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(),await qe(t,r.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(s){return console.error("[YouTube Live] End broadcast error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("streamId"),a=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=a.youtube_video_id;if(!n)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const o=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!o&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await st({apiKey:o,accessToken:i},n);return e.json({success:!0,data:{streamId:s,videoId:n,stats:c}})}catch(s){return console.error("[YouTube Live] Get stats error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("streamId"),a=e.req.query("pageToken"),n=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first();if(!n)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=n.youtube_live_chat_id;if(!o)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await et({accessToken:i},o,a);return e.json({success:!0,data:c})}catch(s){return console.error("[YouTube Live] Get chat messages error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/streams",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:s,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!s)return e.json({success:!1,error:"제목은 필수입니다"},400);const u=o||"youtube";if(u==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(u==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const l=await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(s,a||null,n||null,u,i||null,c||"scheduled",r.sellerId||null).run();return e.json({success:!0,data:{id:l.meta.last_row_id,title:s,description:a,youtube_video_id:n,platform:u,tiktok_username:i,status:c||"scheduled"}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/streams/:id",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:u}=await e.req.json();return await t.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,u,s).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1").bind(a,r.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,s).run();const{LIVE_CACHE:c}=e.env,u=`product-timestamp:${s}`,l=`current-product:${s}`,d=Date.now().toString();return await c.put(u,d),await Je(c,l,{product:o,options:i.results},30),e.json({success:!0,data:{product:o,options:i.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/admin/streams/:id",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");return await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(s).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:t}=e.env,r=e.req.param("streamId");try{const{productId:s}=await e.req.json(),a=await t.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(s).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s).all();await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(s,r).run();const{LIVE_CACHE:o}=e.env,i=`product-timestamp:${r}`,c=`current-product:${r}`,u=Date.now().toString();return await o.put(i,u),await Je(o,c,{product:a,options:n.results},30),e.json({success:!0,data:{product:a,options:n.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/wishlists",O(),async e=>{const{DB:t}=e.env;try{const{userId:r,productId:s}=await e.req.json();if(!r||!s)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await t.prepare("SELECT id FROM users WHERE id = ?").bind(r).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const n=await t.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(s).first();if(!n)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,s).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await t.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(r,s).run();return e.json({success:!0,data:{id:i.meta.last_row_id,userId:r,productId:s,productName:n.name}})}catch(r){return console.error("[Wishlist] Add error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/wishlists/:id",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("id"),{userId:s}=e.req.query();return s?await t.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(r,s).first()?(await t.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(r,s).run(),e.json({success:!0,message:"찜 목록에서 삭제되었습니다."})):e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(r){return console.error("[Wishlist] Delete error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/wishlists/product/:productId",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("productId"),{userId:s}=e.req.query();return s?(await t.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s,r).run()).meta.changes===0?e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!0,message:"찜 목록에서 삭제되었습니다."}):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(r){return console.error("[Wishlist] Delete by product error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/wishlists/:userId",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("userId"),s=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0"),{results:n}=await t.prepare(`
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
    `).bind(r,s,a).all(),o=await t.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(r).first();return e.json({success:!0,data:{items:n,total:(o==null?void 0:o.count)||0,limit:s,offset:a}})}catch(r){return console.error("[Wishlist] Get error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/wishlists/check/:userId/:productId",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("userId"),s=e.req.param("productId"),a=await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,s).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(r){return console.error("[Wishlist] Check error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/shipping-addresses/:id",q,async e=>{const{DB:t}=e.env,r=e.req.param("id");e.get("userId");try{return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r,userId).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products",async e=>{const{DB:t,CACHE_KV:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const a=`seller:${s.sellerId}:products`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(s.sellerId).all();return await r.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/seller/upload-image",async e=>{var s;const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{image:a,filename:n}=await e.req.json();if(!a)return e.json({success:!1,error:"Image data is required"},400);const o=e.env.IMAGES;if(o){console.log("[Image Upload] Using R2 storage");const i=a.replace(/^data:image\/\w+;base64,/,""),c=Uint8Array.from(atob(i),_=>_.charCodeAt(0)),u=(n==null?void 0:n.split(".").pop())||"jpg",l=`products/${r.sellerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${u}`;await o.put(l,c,{httpMetadata:{contentType:((s=a.match(/^data:(image\/\w+);base64,/))==null?void 0:s[1])||"image/jpeg"}});const d=`/api/images/${l}`;return e.json({success:!0,url:d,storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),a.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:a,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(a){return console.error("[Image Upload] Error:",a),e.json({success:!1,error:a.message},500)}});p.get("/api/images/*",async e=>{var t;try{const r=e.env.IMAGES;if(!r)return e.json({success:!1,error:"R2 not configured"},503);const s=e.req.path.replace("/api/images/",""),a=await r.get(s);return a?new Response(a.body,{headers:{"Content-Type":((t=a.httpMetadata)==null?void 0:t.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"}}):e.notFound()}catch(r){return console.error("[Image Get] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/products",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{name:s,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:u,category:l,live_stream_id:d,is_active:_}=await e.req.json();if(!s||!n)return e.json({success:!1,error:"Name and price are required"},400);if(d&&!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d,r.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const E=await t.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(s,a||null,n,o||null,i||0,c||null,u||0,l||null,d||null,r.sellerId,_!==void 0?_:1).run(),f=await t.prepare("SELECT * FROM products WHERE id = ?").bind(E.meta.last_row_id).first();return await os(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0,data:f})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),a=await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(s,r.sellerId).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/products/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:u,stock:l,category:d,is_active:_}=await e.req.json(),E=[],f=[];if(n!==void 0&&(E.push("name = ?"),f.push(n)),o!==void 0&&(E.push("description = ?"),f.push(o)),i!==void 0&&(E.push("price = ?"),f.push(i)),c!==void 0&&(E.push("original_price = ?"),f.push(c),i!==void 0&&c)){const h=Math.round((c-i)/c*100);E.push("discount_rate = ?"),f.push(h)}if(u!==void 0&&(E.push("image_url = ?"),f.push(u)),l!==void 0&&(E.push("stock = ?"),f.push(l)),d!==void 0&&(E.push("category = ?"),f.push(d)),_!==void 0&&(E.push("is_active = ?"),f.push(_?1:0)),E.push("updated_at = CURRENT_TIMESTAMP"),f.push(s,r.sellerId),E.length===1)return e.json({success:!1,error:"No fields to update"},400);await t.prepare(`UPDATE products SET ${E.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...f).run();const y=await t.prepare("SELECT * FROM products WHERE id = ?").bind(s).first();return await os(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0,data:y})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/products/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await t.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(s).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(s).run(),await t.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(s).run(),await t.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(s).run(),await t.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).run(),await os(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0}))}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await t.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(s).all();return e.json({success:!0,data:n.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const u=await t.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(s,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:u.meta.last_row_id,product_id:s,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("productId"),a=e.req.param("optionId");return await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first()?(await t.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,s).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/stats",async e=>{const{DB:t,CACHE_KV:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const a=`seller:${s.sellerId}:stats`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(s.sellerId).first(),i=await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(s.sellerId).first(),c=await t.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(s.sellerId).first(),u=await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(s.sellerId).first(),l=await t.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(s.sellerId).first(),_={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:u.count||0,totalRevenue:u.total||0,activeStreams:l.count||0,totalViewers:0};return await r.put(a,JSON.stringify(_),{expirationTtl:60}),e.json({success:!0,data:_})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/stats/sales",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.query("period")||"daily";let a,n,o;switch(s){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await t.prepare(`
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
    `).bind(r.sellerId).all();return e.json({success:!0,data:{period:s,sales:i.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/stats/products",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await t.prepare(`
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
    `).bind(r.sellerId,s).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/business-info",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{business_number:s,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:u,phone:l,email:d}=await e.req.json();if(!s||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const _=await t.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();let E;return _?E=await t.prepare(`
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
      `).bind(s,a,n,o,i,c,u,l,d,r.sellerId).run():E=await t.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(r.sellerId,s,a,n,o,i,c,u,l,d).run(),e.json({success:!0,data:{id:_?_.id:E.meta.last_row_id,seller_id:r.sellerId,business_number:s,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(s){return console.error("사업자 정보 등록 오류:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/business-info",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);const s=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(s).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(s).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});p.get("/api/admin/seller-business",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:s.results||[]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/orders",q,async e=>{const{DB:t}=e.env,r=e.get("userId");try{const s=await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(r).all(),a=await Promise.all(s.results.map(async n=>{const o=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(n.id).all();return{...n,items:o.results}}));return e.json({success:!0,data:a})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/orders/user/:userId",q,async e=>{const{DB:t}=e.env,r=e.get("userId"),s=parseInt(e.req.param("userId"));try{if(s!==r)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(r).all(),n=await Promise.all(a.results.map(async o=>{const i=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(o.id).all();return{...o,items:i.results}}));return e.json({success:!0,data:n})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/orders/:orderNumber",async e=>{const{DB:t}=e.env,r=e.req.param("orderNumber");try{const s=await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(r).first();if(!s)return e.json({success:!1,error:"Order not found"},404);const a=await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(s.id).all();return e.json({success:!0,data:{...s,items:a.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders/:orderId/cancel",async e=>{const{DB:t}=e.env,r=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await t.prepare("SELECT * FROM orders WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(r).all();for(const i of o.results)await t.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.quantity,i.product_id).run();return await t.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,r).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:r,reason:a,itemsRestored:o.results.length}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:t}=e.env;try{const r=e.req.param("streamId"),s=await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();return s?e.json({success:!0,data:{viewer_count:s.viewer_count||0}}):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/streams/:streamId/viewer-count",async e=>{const{DB:t}=e.env,r=await M(e),s=r.success?{success:!1}:await v(e);if(!r.success&&!s.success)return e.json({success:!1,error:"Unauthorized"},401);try{const a=e.req.param("streamId"),{viewer_count:n}=await e.req.json();return typeof n!="number"||n<0?e.json({success:!1,error:"Invalid viewer count"},400):s.success&&!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a,s.sellerId).first()?e.json({success:!1,error:"Stream not found or unauthorized"},404):(await t.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{viewer_count:n}}))}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/streams/:streamId/view",async e=>{const{DB:t}=e.env;try{const r=e.req.param("streamId");await t.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(r).run();const s=await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();return e.json({success:!0,data:{viewer_count:(s==null?void 0:s.viewer_count)||0}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/payments/confirm",async e=>{var s;const{DB:t}=e.env;let r=null;try{r=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=r;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!n,amount:!!o}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await t.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",n),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:n},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(o)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(o),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(o),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const u="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const l={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(l,null,2)),console.log("[Payment] 📊 amount 타입:",typeof l.amount),console.log("[Payment] 📊 amount 값:",l.amount);const d=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:u,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(l)}),_=await d.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",d.status),console.log("  - 응답 OK?:",d.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(_).substring(0,300)),!d.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",d.status),console.error("[Payment] 에러 코드:",_.code),console.error("[Payment] 에러 메시지:",_.message),console.error("[Payment] 전체 응답:",JSON.stringify(_,null,2)),e.json({success:!1,error:_.message||"결제 승인에 실패했습니다.",code:_.code,tossError:_},d.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await t.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const E=await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();for(const f of E.results)(await t.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(f.quantity,f.product_id,f.quantity).run()).meta.changes===0&&console.error(`[Payment] ⚠️ 재고 부족: product_id=${f.product_id}`);console.log("[Payment] ✅ 재고 차감 완료")}catch(E){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",E)}return e.json({success:!0,data:_})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:r==null?void 0:r.orderId,error:a.message,stack:(s=a.stack)==null?void 0:s.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});p.post("/api/chat/:liveStreamId/messages",O(),async e=>{const{DB:t}=e.env,r=e.req.param("liveStreamId");try{const s=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:u}=s;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await t.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(r,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const l=["씨발","개새끼","병신","좆","시발"];let d=i;l.forEach(E=>{const f=new RegExp(E,"gi");d=d.replace(f,"*".repeat(E.length))});const _=await t.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,n,o||null,d,c?1:0,u?1:0).run();return e.json({success:!0,data:{id:_.meta.last_row_id,message:d}})}catch(s){return console.error("Error sending chat message:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/chat/:liveStreamId/messages",O(),async e=>{const{DB:t}=e.env,r=e.req.param("liveStreamId"),s=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
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
    `;const o=[r];s&&(n+=" AND id > ?",o.push(Number(s))),n+=" ORDER BY created_at DESC LIMIT ?",o.push(a);const c=(await t.prepare(n).bind(...o).all()).results.reverse();return e.json({success:!0,data:c})}catch(n){return console.error("Error fetching chat messages:",n),e.json({success:!1,error:n.message},500)}});p.delete("/api/chat/:liveStreamId/messages/:messageId",O(),async e=>{const{DB:t}=e.env,r=e.req.param("messageId");try{return await t.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(s){return console.error("Error deleting chat message:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/chat/:liveStreamId/ban",O(),async e=>{const{DB:t}=e.env,r=e.req.param("liveStreamId");try{const s=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=s;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const u=new Date;u.setMinutes(u.getMinutes()+i),c=u.toISOString()}return await t.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(r,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(s){return console.error("Error banning user:",s),e.json({success:!1,error:s.message},500)}});p.delete("/api/chat/:liveStreamId/ban/:userId",O(),async e=>{const{DB:t}=e.env,r=e.req.param("liveStreamId"),s=e.req.param("userId");try{return await t.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(r,s).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});p.post("/api/payments/webhook",async e=>{const{DB:t}=e.env;try{const r=await e.req.json();switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:r.eventType,orderId:r.orderId,status:r.status,timestamp:new Date().toISOString()}),r.eventType){case"PAYMENT_STATUS_CHANGED":await tt(t,r);break;case"VIRTUAL_ACCOUNT_ISSUED":await at(t,r);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",r.eventType)}return e.json({success:!0})}catch(r){return console.error("[Webhook] ❌ 웹훅 처리 실패:",r.message),e.json({success:!1,error:r.message},500)}});async function tt(e,t){const{orderId:r,status:s,paymentKey:a}=t;console.log("[Webhook] 결제 상태 변경:",{orderId:r,status:s}),await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(s,JSON.stringify(t),a).run(),(s==="DONE"||s==="completed")&&(await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",r))}async function at(e,t){const{orderId:r,virtualAccount:s}=t;console.log("[Webhook] 가상계좌 발급:",{orderId:r,bank:s==null?void 0:s.bank,accountNumber:s==null?void 0:s.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(s==null?void 0:s.bank,s==null?void 0:s.accountNumber,s==null?void 0:s.customerName,s==null?void 0:s.dueDate,JSON.stringify(t),r).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",r)}p.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:t}=e.env;try{const r=e.req.param("paymentKey"),s=await e.req.json(),{cancelReason:a,cancelAmount:n}=s;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:r,cancelReason:a,cancelAmount:n}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const o=await t.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(r).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const u=Jr(i,c),l=n&&n<o.amount,d=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:r,cancelAmount:d,isPartial:l});const _=await u.cancelPayment({paymentKey:r,cancelReason:a,cancelAmount:d});return _.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:r,cancelAmount:d,canceledAt:_.canceledAt}),await t.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED",_.canceledAt||new Date().toISOString(),JSON.stringify(_),r).run(),await t.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${r}`),e.json({success:!0,data:{paymentKey:r,orderId:o.order_id,cancelAmount:d,canceledAt:_.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,_.error),e.json({success:!1,error:_.error||"결제 취소에 실패했습니다."},400))}catch(r){return console.error("[Payment] ❌ 결제 취소 처리 실패:",r.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});p.get("/api/payments/:paymentKey",async e=>{const{DB:t}=e.env;try{const r=e.req.param("paymentKey"),s=await t.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(r).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404)}catch(r){return console.error("[Payment] ❌ 결제 조회 실패:",r.message),e.json({success:!1,error:"결제 조회 중 오류가 발생했습니다."},500)}});p.get("/api/payments/order/:orderId",async e=>{const{DB:t}=e.env;try{const r=e.req.param("orderId"),s=await t.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(r).all();return e.json({success:!0,data:s.results||[]})}catch(r){return console.error("[Payment] ❌ 결제 목록 조회 실패:",r.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});p.get("/api/seller/orders",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT DISTINCT o.*, u.name as user_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC
    `).bind(r.sellerId).all(),a=await Promise.all(s.results.map(async n=>{const o=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ? AND oi.seller_id = ?
        `).bind(n.id,r.sellerId).all();return{...n,items:o.results}}));return e.json({success:!0,data:a})}catch(s){return e.json({success:!1,error:s.message},500)}});p.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(s).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,r.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,s).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${s}, 자동 발행 시작...`);const c=await t.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(s).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const u=await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();if(!u)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${r.sellerId}`),await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(s,r.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${s}`);const l=await t.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),d=Number(c.total_amount),_=Math.floor(d/1.1),E=d-_,f=new Date().toISOString().split("T")[0].replace(/-/g,""),y=Math.random().toString(36).substring(2,8).toUpperCase(),h=`${f}-${y}`,g=(await t.prepare(`
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
            `).bind(r.sellerId,s,h,u.business_number,u.business_name,u.ceo_name,u.address||"",u.business_type||"",u.business_category||"",u.email||"",u.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",_,E,d,`AUTO-${Date.now()}-${y}`).run()).meta.last_row_id;for(const D of l.results){const N=Math.floor(Number(D.price)*Number(D.quantity)/1.1),w=Number(D.price)*Number(D.quantity)-N;await t.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(g,D.product_name||"상품명 없음",D.quantity,D.price,N,w,D.option_name||"").run()}await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(s,r.sellerId,g).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${g}, invoice_number=${h}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${s}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await t.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(s,r.sellerId,c.message).run()}catch(u){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",u)}}try{const c=await t.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(s).first();if(c&&c.user_id){const l={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];l&&await $s(t,c.user_id,s,l)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(s).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,r.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await t.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,s).run();try{const c=await t.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(s).first();c&&c.user_id&&await $s(t,c.user_id,s,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders/:orderNumber/refund",async e=>{const{DB:t}=e.env,r=e.req.param("orderNumber"),{reason:s}=await e.req.json();try{const a=await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(r).first();return a?["paid","preparing","shipped","delivered"].includes(a.status)?a.status==="refunded"||a.status==="cancelled"?e.json({success:!1,error:"이미 환불 또는 취소된 주문입니다."},400):(await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded",r).run(),e.json({success:!0,message:"환불 요청이 접수되었습니다. 고객센터(0507-0177-0432)에서 처리 예정입니다.",requiresManualProcessing:!0})):e.json({success:!1,error:"환불이 불가능한 주문 상태입니다."},400):e.json({success:!1,error:"Order not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/admin/orders",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/sellers",async e=>{const{DB:t}=e.env,{limit:r="20",offset:s="0"}=e.req.query();try{const a=`
      SELECT id, business_name, name as display_name, 
             commission_rate, created_at
      FROM sellers 
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,{results:n}=await t.prepare(a).bind(parseInt(r),parseInt(s)).all();return e.json({success:!0,data:n})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});p.get("/api/admin/sellers",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/sellers",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{username:s,password:a,name:n,email:o,phone:i,business_name:c,business_number:u}=await e.req.json();if(!s||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await t.prepare("SELECT id FROM sellers WHERE username = ?").bind(s).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await t.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const _=`$2a$10$placeholder_hash_for_${a}`,E=await t.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(s,_,n,o,i||null,c,u||null,r.adminId).run();return e.json({success:!0,data:{id:E.meta.last_row_id,username:s,name:n,email:o,business_name:c}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/sellers/:id",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:u,status:l}=await e.req.json();return await t.prepare("SELECT id FROM sellers WHERE id = ?").bind(s).first()?(await t.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,u,l,s).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/admin/sellers/:id",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),a=await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(s).first();return a?(await t.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(),await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(s).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(s).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await t.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,s).run(),await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(s).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(s){return e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await t.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(s).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await t.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,s).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${s}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:s,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(s){return console.error("수수료율 변경 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),a=await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(s).first();return a?a.status==="approved"?e.json({success:!1,error:"이미 승인된 판매자입니다"},400):(await t.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(r.adminId,s).run(),console.log(`셀러 승인: ${a.username} (ID: ${s}) by Admin ID: ${r.adminId}`),e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:s,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 승인 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(s).first();return n?n.status==="rejected"?e.json({success:!1,error:"이미 거부된 판매자입니다"},400):(await t.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,r.adminId,s).run(),console.log(`셀러 거부: ${n.username} (ID: ${s}), 사유: ${a}`),e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:s,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 거부 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/sellers/pending",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:s.results,count:s.results.length})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/public/seller/:sellerId",async e=>{const{DB:t,CACHE_KV:r}=e.env;try{const s=e.req.param("sellerId"),a=`public:seller:${s}`,n=await as(r,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(s).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=await t.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(s).all(),c=await t.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(s).all(),u=await t.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(s).all(),l=await t.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(s).first(),d={profile:o,live_streams:i.results,scheduled_streams:c.results,products:u.results,stats:l};return await ns(r,a,d,60),e.json({success:!0,data:d})}catch(s){return console.error("셀러 프로필 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/public/seller/username/:username",async e=>{const{DB:t}=e.env;try{const r=e.req.param("username"),s=await t.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();return s?e.json({success:!0,data:{seller_id:s.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/stats",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{period:s}=e.req.query();let a="";const n=new Date;switch(s){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await t.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as total_seller_amount
      FROM orders o
      WHERE payment_status = 'completed' 
        AND is_cancelled = 0
        ${a}
    `).first(),i=await t.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:s||"all"}})}catch(s){return console.error("정산 통계 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlement/records",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{seller_id:s,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];s&&(o.push("o.seller_id = ?"),i.push(s)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const d=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${d}'`);break;case"week":const _=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${_}'`);break;case"month":const E=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${E}'`);break}const u=o.length>0?`WHERE ${o.join(" AND ")}`:"",l=await t.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:l.results})}catch(s){return console.error("정산 내역 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await t.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(s).first();return n?(await t.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,s).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:s,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(s){return console.error("정산 상태 변경 실패:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/settlement/batch-complete",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{order_ids:s}=await e.req.json();if(!Array.isArray(s)||s.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of s)try{await t.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:s.length,success:a,failed:n}})}catch(s){return console.error("일괄 정산 처리 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlement/export-csv",async e=>{const{DB:t}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{seller_id:s,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];s&&(n.push("o.seller_id = ?"),o.push(s));const i=new Date;switch(a){case"today":const f=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${f}'`);break;case"week":const y=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${y}'`);break;case"month":const h=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${h}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",l=(await t.prepare(`
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
    `).bind(...o).all()).results;if(l.length===0)return e.json({success:!1,error:"데이터가 없습니다"},404);const d=Object.keys(l[0]);let _=d.join(",")+`
`;l.forEach(f=>{const y=d.map(h=>{const b=f[h];if(b==null)return"";const g=String(b);return g.includes(",")||g.includes('"')||g.includes(`
`)?`"${g.replace(/"/g,'""')}"`:g});_+=y.join(",")+`
`});const E="\uFEFF";return new Response(E+_,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(s){return console.error("CSV 내보내기 실패:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/orders/create",async e=>{const{DB:t}=e.env;try{const{userId:r,cartItems:s,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:u,buyerCeoName:l}=await e.req.json();console.log("주문 생성 요청:",{userId:r,cartItems:s==null?void 0:s.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let d=10;if(o){const w=await t.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();w&&w.commission_rate!==null&&(d=w.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:d});const _=Math.floor(a*(d/100)),E=a-_;let f=null;if(n){const w=await t.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(n,r).first();if(!w)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);f=w}if(!r)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const y=r,h=Date.now(),b=Math.random().toString(36).substring(2,8).toUpperCase(),g=`ORDER_${h}_${b}`;for(const w of s){const C=await t.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(w.product_id).first();if(!C)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${w.product_id})`},400);if(C.stock<w.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${w.product_id})`},400)}const N=(await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(g,y,a,"pending",o||null,d,_,E,n||null,(f==null?void 0:f.recipient_name)||null,(f==null?void 0:f.phone)||null,f!=null&&f.address?`${f.address} ${f.address_detail}`:null,(f==null?void 0:f.postal_code)||null,i?1:0,c||null,u||null,l||null).run()).meta.last_row_id;for(const w of s){await t.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(N,w.product_id,w.option_id||null,w.quantity,w.price_snapshot||w.price).run(),await t.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(w.quantity,w.product_id).run();try{const C=await t.prepare(`
          SELECT id, name, stock, stock_alert_threshold, seller_id 
          FROM products 
          WHERE id = ?
        `).bind(w.product_id).first();if(C){const k=C.stock_alert_threshold||5,I=C.stock;I<=k&&C.seller_id&&(await Gr(t,C.seller_id,C.name,I,k),console.log(`[Low Stock Alert] ${C.name}: ${I} <= ${k}`))}}catch(C){console.error("[Low Stock Alert] Error:",C)}}return console.log("주문 생성 완료:",{orderId:N,orderNumber:g}),e.json({success:!0,orderId:N,orderNumber:g,totalAmount:a})}catch(r){return console.error("주문 생성 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/orders/:orderNumber/refund",O(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("orderNumber"),{reason:s}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:r,reason:s});const a=await t.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(r).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다"},404);if(a.payment_status==="cancelled")return e.json({success:!1,error:"이미 취소된 주문입니다"},400);await t.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(s||"구매자 요청",r).run(),console.log("[Order Refund] 주문 상태 업데이트 완료:",r);const n=await t.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();for(const o of n.results)await t.prepare(`
        UPDATE products 
        SET stock = stock + ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(o.quantity,o.product_id).run(),console.log("[Order Refund] 재고 복구:",{productId:o.product_id,quantity:o.quantity});return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:r,reason:s}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:r,cancelDate:new Date().toISOString()}})}catch(r){return console.error("[Order Refund] Error:",r),e.json({success:!1,error:r.message||"주문 취소 중 오류가 발생했습니다"},500)}});p.get("/api/seller/sales",O(),async e=>{try{const{DB:t}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const s=await Ne(e.env.SESSION_KV,r);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(s.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=s.seller_id||s.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await t.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();if(!u)return e.json({success:!1,error:"셀러를 찾을 수 없습니다."},404);const l=await t.prepare(`
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
    `).bind(a,i,c).first(),d=await t.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:u,stats:l,orders:(d==null?void 0:d.results)||[]}})}catch(t){return console.error("Seller sales query error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/settlement-csv",O(),async e=>{try{const{DB:t}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const s=await Ne(e.env.SESSION_KV,r);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(s.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=s.seller_id||s.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await t.prepare(`
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
`;for(const d of(u==null?void 0:u.results)||[]){const _=d.status==="delivered"?"배송완료":d.status==="shipped"?"배송중":d.status==="preparing"?"상품준비중":d.status==="paid"?"결제완료":"대기중",E=d.buyer_business_name||"-",f=d.buyer_business_number||"-",y=d.invoice_number||"-",h=d.issue_date||"-",b=d.tax_invoice_status==="issued"?"발행완료":d.tax_invoice_status==="cancelled"?"취소":"-",g=d.nts_confirm_number||"-";l+=`${d.order_number},${d.created_at},${d.user_name||"익명"},${d.total_amount},${d.commission_amount},${d.seller_amount},${_},${E},${f},${y},${h},${b},${g}
`}return new Response(l,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(t){return console.error("CSV download error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/tax-invoices/issue",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{order_number:s}=await e.req.json();if(!s)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(s).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!a.issue_tax_invoice)return e.json({success:!1,error:"세금계산서 발행이 요청되지 않은 주문입니다."},400);const n=await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(r.sellerId).first();if(!n)return e.json({success:!1,error:"승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요."},400);const o=await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),u=i-c,l=new Date().toISOString().split("T")[0],d=`${l}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,_=$r(n,a,o.results);let E,f,y;try{E=await xr(_),f=E.ntsConfirmNumber,y=E.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:f,invoiceKey:y,mockMode:ke()})}catch(g){console.error("바로빌 API 호출 실패:",g),f="FAILED",y=null}const b=(await t.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r.sellerId,s,"tax",d,l,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,u,i,f==="FAILED"?"failed":"issued",ke()?"mock":"barobill",y,f).run()).meta.last_row_id;for(const g of o.results){const D=Math.floor(Number(g.price)*Number(g.quantity)/1.1),N=Number(g.price)*Number(g.quantity)-D;await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(b,g.id,g.product_name,g.quantity,g.price,D,N).run()}return e.json({success:!0,data:{invoice_id:b,invoice_number:d,issue_date:l,total_amount:i,supply_price:c,tax_amount:u,status:f==="FAILED"?"failed":"issued",nts_confirm_number:f,api_invoice_key:y,mock_mode:ke(),message:f==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":ke()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(s){return console.error("세금계산서 발행 오류:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/tax-invoices",async e=>{var s;const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[r.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const u=await t.prepare(i).bind(...c).all();return e.json({success:!0,data:u.results||[],total:((s=u.results)==null?void 0:s.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/tax-invoices/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),a=await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(s,r.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await t.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(s).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{reason:a}=await e.req.json(),n=await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(s,r.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!ke()){const u=await t.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(r.sellerId).first();u&&u.business_number&&await Ur(u.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(u){console.error("바로빌 취소 API 호출 실패:",u)}return await t.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{status:s,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[r.sellerId];s&&(n+=" AND log.status = ?",o.push(s)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await t.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${s}`);const a=await t.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(s,r.sellerId).first();if(!a)return e.json({success:!1,error:"재시도할 실패 로그를 찾을 수 없습니다."},404);const n=Number(a.retry_count||0);if(n>=3)return e.json({success:!1,error:"최대 재시도 횟수(3회)를 초과했습니다."},400);const o=await t.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(s).first();if(!o)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!o.buyer_business_number||!o.buyer_business_name)return e.json({success:!1,error:"주문에 사업자 정보가 없습니다."},400);const i=await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();if(!i)return e.json({success:!1,error:"판매자 사업자 정보가 승인되지 않았습니다."},400);const c=await t.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(),u=Number(o.total_amount),l=Math.floor(u/1.1),d=u-l,_=new Date().toISOString().split("T")[0].replace(/-/g,""),E=Math.random().toString(36).substring(2,8).toUpperCase(),f=`${_}-${E}`,h=(await t.prepare(`
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
    `).bind(r.sellerId,s,f,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",l,d,u,`RETRY-${Date.now()}-${E}`).run()).meta.last_row_id;for(const b of c.results){const g=Math.floor(Number(b.price)*Number(b.quantity)/1.1),D=Number(b.price)*Number(b.quantity)-g;await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(h,b.product_name||"상품명 없음",b.quantity,b.price,g,D,b.option_name||"").run()}return await t.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(s,r.sellerId,h,n+1).run(),await t.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${h}, retry_count=${n+1}`),e.json({success:!0,data:{invoice_id:h,invoice_number:f,retry_count:n+1}})}catch(s){console.error("[TAX INVOICE RETRY] 재시도 실패:",s);try{const a=e.req.param("orderNumber"),n=await t.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,r.sellerId).first(),o=Number((n==null?void 0:n.retry_count)||0);await t.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,r.sellerId,s.message,o+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:s.message},500)}});p.get("/live/:id",async e=>{try{const t=new URL("/static/live.html",e.req.url);let s=await(await fetch(t.toString())).text();const n=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return s=s.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${n}`),console.log("[Live Page] Environment variables injected"),new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving live page:",t),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/cart",async e=>{try{const t=new URL("/static/cart.html",e.req.url);let s=await(await fetch(t.toString())).text();return s=s.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),s=s.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving cart page:",t),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/my-orders",async e=>{try{const t=new URL("/static/my-orders.html",e.req.url),s=await(await fetch(t.toString())).text();return new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving my orders page:",t),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/payment-result",async e=>{try{const t=new URL("/payment-result.html",e.req.url),s=await(await fetch(t.toString())).text();return new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving payment result page:",t),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/api/seller/profile",async e=>{const{DB:t}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const s=await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();if(!s||!s.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await t.prepare(`
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
    `).bind(s.seller_id).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404)}catch(s){return console.error("프로필 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/seller/profile",async e=>{const{DB:t}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const s=await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();if(!s||!s.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:u,website_url:l,kakao_chat_link:d}=await e.req.json(),_=[],E=[];if(a!==void 0&&(_.push("profile_image = ?"),E.push(a)),n!==void 0&&(_.push("bio = ?"),E.push(n)),o!==void 0&&(_.push("sns_instagram = ?"),E.push(o)),i!==void 0&&(_.push("sns_youtube = ?"),E.push(i)),c!==void 0&&(_.push("sns_facebook = ?"),E.push(c)),u!==void 0&&(_.push("sns_twitter = ?"),E.push(u)),l!==void 0&&(_.push("website_url = ?"),E.push(l)),d!==void 0&&(_.push("kakao_chat_link = ?"),E.push(d)),_.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);_.push("updated_at = datetime('now')"),E.push(s.seller_id),await t.prepare(`
      UPDATE sellers 
      SET ${_.join(", ")}
      WHERE id = ?
    `).bind(...E).run();const f=await t.prepare(`
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
    `).bind(s.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:f})}catch(s){return console.error("프로필 업데이트 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/public/:sellerId",async e=>{const{DB:t}=e.env,r=e.req.param("sellerId");try{const s=await t.prepare(`
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
    `).bind(r).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 프로필 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/:sellerId/streams",async e=>{const{DB:t}=e.env,r=e.req.param("sellerId");try{const s=await t.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("라이브 목록 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/:sellerId/products-public",async e=>{const{DB:t}=e.env,r=e.req.param("sellerId");try{const s=await t.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("상품 목록 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/notifications",q,async e=>{const{DB:t}=e.env;try{const r=e.get("userId"),s=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),n=e.req.query("unread_only")==="true";let o=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;n&&(o+=" AND is_read = 0"),o+=" ORDER BY created_at DESC LIMIT ?";const i=await t.prepare(o).bind(r,s,a).all();return e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/notifications/unread-count",q,async e=>{const{DB:t}=e.env;try{const r=e.get("userId"),s=e.get("userType"),a=await t.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r,s).first();return e.json({success:!0,count:(a==null?void 0:a.count)||0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/notifications/:id/read",q,async e=>{const{DB:t}=e.env;try{const r=e.req.param("id"),s=e.get("userId"),a=e.get("userType");return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r,s,a).first()?(await t.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/notifications/read-all",q,async e=>{const{DB:t}=e.env;try{const r=e.get("userId"),s=e.get("userType");return await t.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r,s).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/notifications/:id",q,async e=>{const{DB:t}=e.env;try{const r=e.req.param("id"),s=e.get("userId"),a=e.get("userType");return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r,s,a).first()?(await t.prepare("DELETE FROM notifications WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/banners",async e=>{const{DB:t}=e.env;try{const r=new Date().toISOString(),s=await t.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(r,r).all();return e.json({success:!0,data:s.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/admin/banners",q,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const s=await t.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();return e.json({success:!0,data:s.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/banners",q,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:s,image_url:a,link_url:n,description:o,is_active:i,display_order:c,start_date:u,end_date:l}=await e.req.json();if(!s||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const d=await t.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(s,a,n||null,o||null,i!==!1?1:0,c||0,u||null,l||null).run();return e.json({success:!0,id:d.meta.last_row_id})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/banners/:id",q,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const s=e.req.param("id"),{title:a,image_url:n,link_url:o,description:i,is_active:c,display_order:u,start_date:l,end_date:d}=await e.req.json();return await t.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,n,o||null,i||null,c?1:0,u||0,l||null,d||null,s).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/banners/:id",q,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const s=e.req.param("id");return await t.prepare("DELETE FROM banners WHERE id = ?").bind(s).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/order-complete",e=>e.redirect("/order-complete.html",302));p.notFound(e=>{const t=e.req.path;return t.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${t} was not found.`},404):new Response(null,{status:404})});p.onError((e,t)=>{const r=t.req.path;if(console.error("[Global Error Handler]",{path:r,method:t.req.method,error:e.message,stack:e.stack}),r.startsWith("/api/")){let s=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(s=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(s=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(s=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(s=400,a="잘못된 요청입니다."),t.json({success:!1,error:e.message||a},s)}return t.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>오류 발생 - 유어 라이브</title>
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
  `,500)});const ms=new Ms,nt=Object.assign({"/src/index.tsx":p});let Bs=!1;for(const[,e]of Object.entries(nt))e&&(ms.route("/",e),ms.notFound(e.notFoundHandler),Bs=!0);if(!Bs)throw new Error("Can't import modules from ['/src/index.tsx']");async function Ys(e){try{const{to:t,subject:r,htmlContent:s,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:t}]}],from:{email:"noreply@live.ur-team.com",name:"유어 라이브"},subject:r,content:[{type:"text/html",value:s},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",t),{success:!0}}catch(t){return console.error("[Email] Exception:",t),{success:!1,error:t.message}}}async function ot(e){const{streamId:t,title:r,sellerName:s,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${t}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",u=`
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
        <span class="value"><strong>${r}</strong></span>
      </div>
      
      <div class="info-row">
        <span class="label">판매자</span>
        <span class="value">${s}</span>
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
        <span class="value">#${t}</span>
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
제목: ${r}
판매자: ${s}
플랫폼: ${a==="youtube"?"YouTube":"TikTok"}
${n?`예약 시간: ${new Date(n).toLocaleString("ko-KR")}`:""}
라이브 ID: #${t}

🔗 라이브 페이지: ${i}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `;return Ys({to:"jiwon@ur-team.com",subject:`[유어 라이브] 🎉 새 라이브 스트림 생성: ${r}`,htmlContent:u,textContent:l})}const it=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:Ys,sendLiveStreamCreatedEmail:ot},Symbol.toStringTag,{value:"Module"}));export{ms as default};
