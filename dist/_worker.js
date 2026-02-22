var nr=Object.defineProperty;var Es=e=>{throw TypeError(e)};var or=(e,r,s)=>r in e?nr(e,r,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[r]=s;var R=(e,r,s)=>or(e,typeof r!="symbol"?r+"":r,s),ts=(e,r,s)=>r.has(e)||Es("Cannot "+s);var m=(e,r,s)=>(ts(e,r,"read from private field"),s?s.call(e):r.get(e)),O=(e,r,s)=>r.has(e)?Es("Cannot add the same private member more than once"):r instanceof WeakSet?r.add(e):r.set(e,s),S=(e,r,s,t)=>(ts(e,r,"write to private field"),t?t.call(e,s):r.set(e,s),s),D=(e,r,s)=>(ts(e,r,"access private method"),s);var hs=(e,r,s,t)=>({set _(a){S(e,r,a,s)},get _(){return m(e,r,t)}});var gs=(e,r,s)=>(t,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,u=!1,l;if(e[i]?(l=e[i][0][0],t.req.routeIndex=i):l=i===e.length&&a||void 0,l)try{c=await l(t,()=>o(i+1))}catch(p){if(p instanceof Error&&r)t.error=p,c=await r(p,t),u=!0;else throw p}else t.finalized===!1&&s&&(c=await s(t));return c&&(t.finalized===!1||u)&&(t.res=c),t}},ir=Symbol(),cr=async(e,r=Object.create(null))=>{const{all:s=!1,dot:t=!1}=r,n=(e instanceof Ls?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?ur(e,{all:s,dot:t}):{}};async function ur(e,r){const s=await e.formData();return s?lr(s,r):{}}function lr(e,r){const s=Object.create(null);return e.forEach((t,a)=>{r.all||a.endsWith("[]")?dr(s,a,t):s[a]=t}),r.dot&&Object.entries(s).forEach(([t,a])=>{t.includes(".")&&(pr(s,t,a),delete s[t])}),s}var dr=(e,r,s)=>{e[r]!==void 0?Array.isArray(e[r])?e[r].push(s):e[r]=[e[r],s]:r.endsWith("[]")?e[r]=[s]:e[r]=s},pr=(e,r,s)=>{let t=e;const a=r.split(".");a.forEach((n,o)=>{o===a.length-1?t[n]=s:((!t[n]||typeof t[n]!="object"||Array.isArray(t[n])||t[n]instanceof File)&&(t[n]=Object.create(null)),t=t[n])})},Ns=e=>{const r=e.split("/");return r[0]===""&&r.shift(),r},mr=e=>{const{groups:r,path:s}=_r(e),t=Ns(s);return fr(t,r)},_r=e=>{const r=[];return e=e.replace(/\{[^}]+\}/g,(s,t)=>{const a=`@${t}`;return r.push([a,s]),a}),{groups:r,path:e}},fr=(e,r)=>{for(let s=r.length-1;s>=0;s--){const[t]=r[s];for(let a=e.length-1;a>=0;a--)if(e[a].includes(t)){e[a]=e[a].replace(t,r[s][1]);break}}return e},Ye={},Er=(e,r)=>{if(e==="*")return"*";const s=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(s){const t=`${e}#${r}`;return Ye[t]||(s[2]?Ye[t]=r&&r[0]!==":"&&r[0]!=="*"?[t,s[1],new RegExp(`^${s[2]}(?=/${r})`)]:[e,s[1],new RegExp(`^${s[2]}$`)]:Ye[t]=[e,s[1],!0]),Ye[t]}return null},us=(e,r)=>{try{return r(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,s=>{try{return r(s)}catch{return s}})}},hr=e=>us(e,decodeURI),ks=e=>{const r=e.url,s=r.indexOf("/",r.indexOf(":")+4);let t=s;for(;t<r.length;t++){const a=r.charCodeAt(t);if(a===37){const n=r.indexOf("?",t),o=r.slice(s,n===-1?void 0:n);return hr(o.includes("%25")?o.replace(/%25/g,"%2525"):o)}else if(a===63)break}return r.slice(s,t)},gr=e=>{const r=ks(e);return r.length>1&&r.at(-1)==="/"?r.slice(0,-1):r},Te=(e,r,...s)=>(s.length&&(r=Te(r,...s)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${r==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(r==null?void 0:r[0])==="/"?r.slice(1):r}`}`),js=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const r=e.split("/"),s=[];let t="";return r.forEach(a=>{if(a!==""&&!/\:/.test(a))t+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){s.length===0&&t===""?s.push("/"):s.push(t);const n=a.replace("?","");t+="/"+n,s.push(t)}else t+="/"+a}),s.filter((a,n,o)=>o.indexOf(a)===n)},as=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?us(e,Cs):e):e,As=(e,r,s)=>{let t;if(!s&&r&&!/[%+]/.test(r)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(r,o+1)||(o=e.indexOf(`&${r}`,o+1));o!==-1;){const i=e.charCodeAt(o+r.length+1);if(i===61){const c=o+r.length+2,u=e.indexOf("&",c);return as(e.slice(c,u===-1?void 0:u))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${r}`,o+1)}if(t=/[%+]/.test(e),!t)return}const a={};t??(t=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(t&&(c=as(c)),n=o,c==="")continue;let u;i===-1?u="":(u=e.slice(i+1,o===-1?void 0:o),t&&(u=as(u))),s?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(u)):a[c]??(a[c]=u)}return r?a[r]:a},yr=As,wr=(e,r)=>As(e,r,!0),Cs=decodeURIComponent,ys=e=>us(e,Cs),Ie,V,ne,Ms,Us,cs,oe,Ss,Ls=(Ss=class{constructor(e,r="/",s=[[]]){O(this,ne);R(this,"raw");O(this,Ie);O(this,V);R(this,"routeIndex",0);R(this,"path");R(this,"bodyCache",{});O(this,oe,e=>{const{bodyCache:r,raw:s}=this,t=r[e];if(t)return t;const a=Object.keys(r)[0];return a?r[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):r[e]=s[e]()});this.raw=e,this.path=r,S(this,V,s),S(this,Ie,{})}param(e){return e?D(this,ne,Ms).call(this,e):D(this,ne,Us).call(this)}query(e){return yr(this.url,e)}queries(e){return wr(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const r={};return this.raw.headers.forEach((s,t)=>{r[t]=s}),r}async parseBody(e){var r;return(r=this.bodyCache).parsedBody??(r.parsedBody=await cr(this,e))}json(){return m(this,oe).call(this,"text").then(e=>JSON.parse(e))}text(){return m(this,oe).call(this,"text")}arrayBuffer(){return m(this,oe).call(this,"arrayBuffer")}blob(){return m(this,oe).call(this,"blob")}formData(){return m(this,oe).call(this,"formData")}addValidatedData(e,r){m(this,Ie)[e]=r}valid(e){return m(this,Ie)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[ir](){return m(this,V)}get matchedRoutes(){return m(this,V)[0].map(([[,e]])=>e)}get routePath(){return m(this,V)[0].map(([[,e]])=>e)[this.routeIndex].path}},Ie=new WeakMap,V=new WeakMap,ne=new WeakSet,Ms=function(e){const r=m(this,V)[0][this.routeIndex][1][e],s=D(this,ne,cs).call(this,r);return s&&/\%/.test(s)?ys(s):s},Us=function(){const e={},r=Object.keys(m(this,V)[0][this.routeIndex][1]);for(const s of r){const t=D(this,ne,cs).call(this,m(this,V)[0][this.routeIndex][1][s]);t!==void 0&&(e[s]=/\%/.test(t)?ys(t):t)}return e},cs=function(e){return m(this,V)[1]?m(this,V)[1][e]:e},oe=new WeakMap,Ss),br={Stringify:1},Ps=async(e,r,s,t,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:r,buffer:a,context:t}))).then(i=>Promise.all(i.filter(Boolean).map(c=>Ps(c,r,!1,t,a))).then(()=>a[0]))):Promise.resolve(e)},Tr="text/plain; charset=UTF-8",ns=(e,r)=>({"Content-Type":e,...r}),He,$e,se,Oe,re,K,xe,ve,De,fe,qe,Fe,ie,Se,Rs,Sr=(Rs=class{constructor(e,r){O(this,ie);O(this,He);O(this,$e);R(this,"env",{});O(this,se);R(this,"finalized",!1);R(this,"error");O(this,Oe);O(this,re);O(this,K);O(this,xe);O(this,ve);O(this,De);O(this,fe);O(this,qe);O(this,Fe);R(this,"render",(...e)=>(m(this,ve)??S(this,ve,r=>this.html(r)),m(this,ve).call(this,...e)));R(this,"setLayout",e=>S(this,xe,e));R(this,"getLayout",()=>m(this,xe));R(this,"setRenderer",e=>{S(this,ve,e)});R(this,"header",(e,r,s)=>{this.finalized&&S(this,K,new Response(m(this,K).body,m(this,K)));const t=m(this,K)?m(this,K).headers:m(this,fe)??S(this,fe,new Headers);r===void 0?t.delete(e):s!=null&&s.append?t.append(e,r):t.set(e,r)});R(this,"status",e=>{S(this,Oe,e)});R(this,"set",(e,r)=>{m(this,se)??S(this,se,new Map),m(this,se).set(e,r)});R(this,"get",e=>m(this,se)?m(this,se).get(e):void 0);R(this,"newResponse",(...e)=>D(this,ie,Se).call(this,...e));R(this,"body",(e,r,s)=>D(this,ie,Se).call(this,e,r,s));R(this,"text",(e,r,s)=>!m(this,fe)&&!m(this,Oe)&&!r&&!s&&!this.finalized?new Response(e):D(this,ie,Se).call(this,e,r,ns(Tr,s)));R(this,"json",(e,r,s)=>D(this,ie,Se).call(this,JSON.stringify(e),r,ns("application/json",s)));R(this,"html",(e,r,s)=>{const t=a=>D(this,ie,Se).call(this,a,r,ns("text/html; charset=UTF-8",s));return typeof e=="object"?Ps(e,br.Stringify,!1,{}).then(t):t(e)});R(this,"redirect",(e,r)=>{const s=String(e);return this.header("Location",/[^\x00-\xFF]/.test(s)?encodeURI(s):s),this.newResponse(null,r??302)});R(this,"notFound",()=>(m(this,De)??S(this,De,()=>new Response),m(this,De).call(this,this)));S(this,He,e),r&&(S(this,re,r.executionCtx),this.env=r.env,S(this,De,r.notFoundHandler),S(this,Fe,r.path),S(this,qe,r.matchResult))}get req(){return m(this,$e)??S(this,$e,new Ls(m(this,He),m(this,Fe),m(this,qe))),m(this,$e)}get event(){if(m(this,re)&&"respondWith"in m(this,re))return m(this,re);throw Error("This context has no FetchEvent")}get executionCtx(){if(m(this,re))return m(this,re);throw Error("This context has no ExecutionContext")}get res(){return m(this,K)||S(this,K,new Response(null,{headers:m(this,fe)??S(this,fe,new Headers)}))}set res(e){if(m(this,K)&&e){e=new Response(e.body,e);for(const[r,s]of m(this,K).headers.entries())if(r!=="content-type")if(r==="set-cookie"){const t=m(this,K).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of t)e.headers.append("set-cookie",a)}else e.headers.set(r,s)}S(this,K,e),this.finalized=!0}get var(){return m(this,se)?Object.fromEntries(m(this,se)):{}}},He=new WeakMap,$e=new WeakMap,se=new WeakMap,Oe=new WeakMap,re=new WeakMap,K=new WeakMap,xe=new WeakMap,ve=new WeakMap,De=new WeakMap,fe=new WeakMap,qe=new WeakMap,Fe=new WeakMap,ie=new WeakSet,Se=function(e,r,s){const t=m(this,K)?new Headers(m(this,K).headers):m(this,fe)??new Headers;if(typeof r=="object"&&"headers"in r){const n=r.headers instanceof Headers?r.headers:new Headers(r.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?t.append(o,i):t.set(o,i)}if(s)for(const[n,o]of Object.entries(s))if(typeof o=="string")t.set(n,o);else{t.delete(n);for(const i of o)t.append(n,i)}const a=typeof r=="number"?r:(r==null?void 0:r.status)??m(this,Oe);return new Response(e,{status:a,headers:t})},Rs),P="ALL",Rr="all",Ir=["get","post","put","delete","options","patch"],Hs="Can not add a route since the matcher is already built.",$s=class extends Error{},Or="__COMPOSED_HANDLER",vr=e=>e.text("404 Not Found",404),ws=(e,r)=>{if("getResponse"in e){const s=e.getResponse();return r.newResponse(s.body,s)}return console.error(e),r.text("Internal Server Error",500)},J,H,xs,z,me,Je,ze,Ne,Dr=(Ne=class{constructor(r={}){O(this,H);R(this,"get");R(this,"post");R(this,"put");R(this,"delete");R(this,"options");R(this,"patch");R(this,"all");R(this,"on");R(this,"use");R(this,"router");R(this,"getPath");R(this,"_basePath","/");O(this,J,"/");R(this,"routes",[]);O(this,z,vr);R(this,"errorHandler",ws);R(this,"onError",r=>(this.errorHandler=r,this));R(this,"notFound",r=>(S(this,z,r),this));R(this,"fetch",(r,...s)=>D(this,H,ze).call(this,r,s[1],s[0],r.method));R(this,"request",(r,s,t,a)=>r instanceof Request?this.fetch(s?new Request(r,s):r,t,a):(r=r.toString(),this.fetch(new Request(/^https?:\/\//.test(r)?r:`http://localhost${Te("/",r)}`,s),t,a)));R(this,"fire",()=>{addEventListener("fetch",r=>{r.respondWith(D(this,H,ze).call(this,r.request,r,void 0,r.request.method))})});[...Ir,Rr].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?S(this,J,o):D(this,H,me).call(this,n,m(this,J),o),i.forEach(c=>{D(this,H,me).call(this,n,m(this,J),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){S(this,J,c);for(const u of[n].flat())i.map(l=>{D(this,H,me).call(this,u.toUpperCase(),m(this,J),l)})}return this},this.use=(n,...o)=>(typeof n=="string"?S(this,J,n):(S(this,J,"*"),o.unshift(n)),o.forEach(i=>{D(this,H,me).call(this,P,m(this,J),i)}),this);const{strict:t,...a}=r;Object.assign(this,a),this.getPath=t??!0?r.getPath??ks:gr}route(r,s){const t=this.basePath(r);return s.routes.map(a=>{var o;let n;s.errorHandler===ws?n=a.handler:(n=async(i,c)=>(await gs([],s.errorHandler)(i,()=>a.handler(i,c))).res,n[Or]=a.handler),D(o=t,H,me).call(o,a.method,a.path,n)}),this}basePath(r){const s=D(this,H,xs).call(this);return s._basePath=Te(this._basePath,r),s}mount(r,s,t){let a,n;t&&(typeof t=="function"?n=t:(n=t.optionHandler,t.replaceRequest===!1?a=c=>c:a=t.replaceRequest));const o=n?c=>{const u=n(c);return Array.isArray(u)?u:[u]}:c=>{let u;try{u=c.executionCtx}catch{}return[c.env,u]};a||(a=(()=>{const c=Te(this._basePath,r),u=c==="/"?0:c.length;return l=>{const p=new URL(l.url);return p.pathname=p.pathname.slice(u)||"/",new Request(p,l)}})());const i=async(c,u)=>{const l=await s(a(c.req.raw),...o(c));if(l)return l;await u()};return D(this,H,me).call(this,P,Te(r,"*"),i),this}},J=new WeakMap,H=new WeakSet,xs=function(){const r=new Ne({router:this.router,getPath:this.getPath});return r.errorHandler=this.errorHandler,S(r,z,m(this,z)),r.routes=this.routes,r},z=new WeakMap,me=function(r,s,t){r=r.toUpperCase(),s=Te(this._basePath,s);const a={basePath:this._basePath,path:s,method:r,handler:t};this.router.add(r,s,[t,a]),this.routes.push(a)},Je=function(r,s){if(r instanceof Error)return this.errorHandler(r,s);throw r},ze=function(r,s,t,a){if(a==="HEAD")return(async()=>new Response(null,await D(this,H,ze).call(this,r,s,t,"GET")))();const n=this.getPath(r,{env:t}),o=this.router.match(a,n),i=new Sr(r,{path:n,matchResult:o,env:t,executionCtx:s,notFoundHandler:m(this,z)});if(o[0].length===1){let u;try{u=o[0][0][0][0](i,async()=>{i.res=await m(this,z).call(this,i)})}catch(l){return D(this,H,Je).call(this,l,i)}return u instanceof Promise?u.then(l=>l||(i.finalized?i.res:m(this,z).call(this,i))).catch(l=>D(this,H,Je).call(this,l,i)):u??m(this,z).call(this,i)}const c=gs(o[0],this.errorHandler,m(this,z));return(async()=>{try{const u=await c(i);if(!u.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return u.res}catch(u){return D(this,H,Je).call(this,u,i)}})()},Ne),qs=[];function Nr(e,r){const s=this.buildAllMatchers(),t=((a,n)=>{const o=s[a]||s[P],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],qs];const u=c.indexOf("",1);return[o[1][u],c]});return this.match=t,t(e,r)}var Xe="[^/]+",Ue=".*",Pe="(?:|/.*)",Re=Symbol(),kr=new Set(".\\+*[^]$()");function jr(e,r){return e.length===1?r.length===1?e<r?-1:1:-1:r.length===1||e===Ue||e===Pe?1:r===Ue||r===Pe?-1:e===Xe?1:r===Xe?-1:e.length===r.length?e<r?-1:1:r.length-e.length}var Ee,he,G,we,Ar=(we=class{constructor(){O(this,Ee);O(this,he);O(this,G,Object.create(null))}insert(r,s,t,a,n){if(r.length===0){if(m(this,Ee)!==void 0)throw Re;if(n)return;S(this,Ee,s);return}const[o,...i]=r,c=o==="*"?i.length===0?["","",Ue]:["","",Xe]:o==="/*"?["","",Pe]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let u;if(c){const l=c[1];let p=c[2]||Xe;if(l&&c[2]&&(p===".*"||(p=p.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(p))))throw Re;if(u=m(this,G)[p],!u){if(Object.keys(m(this,G)).some(_=>_!==Ue&&_!==Pe))throw Re;if(n)return;u=m(this,G)[p]=new we,l!==""&&S(u,he,a.varIndex++)}!n&&l!==""&&t.push([l,m(u,he)])}else if(u=m(this,G)[o],!u){if(Object.keys(m(this,G)).some(l=>l.length>1&&l!==Ue&&l!==Pe))throw Re;if(n)return;u=m(this,G)[o]=new we}u.insert(i,s,t,a,n)}buildRegExpStr(){const s=Object.keys(m(this,G)).sort(jr).map(t=>{const a=m(this,G)[t];return(typeof m(a,he)=="number"?`(${t})@${m(a,he)}`:kr.has(t)?`\\${t}`:t)+a.buildRegExpStr()});return typeof m(this,Ee)=="number"&&s.unshift(`#${m(this,Ee)}`),s.length===0?"":s.length===1?s[0]:"(?:"+s.join("|")+")"}},Ee=new WeakMap,he=new WeakMap,G=new WeakMap,we),Ze,Be,Is,Cr=(Is=class{constructor(){O(this,Ze,{varIndex:0});O(this,Be,new Ar)}insert(e,r,s){const t=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const u=`@\\${o}`;return a[o]=[u,c],o++,i=!0,u}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return m(this,Be).insert(n,r,t,m(this,Ze),s),t}buildRegExp(){let e=m(this,Be).buildRegExpStr();if(e==="")return[/^$/,[],[]];let r=0;const s=[],t=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(s[++r]=Number(n),"$()"):(o!==void 0&&(t[Number(o)]=++r),"")),[new RegExp(`^${e}`),s,t]}},Ze=new WeakMap,Be=new WeakMap,Is),Lr=[/^$/,[],Object.create(null)],Ge=Object.create(null);function Fs(e){return Ge[e]??(Ge[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(r,s)=>s?`\\${s}`:"(?:|/.*)")}$`))}function Mr(){Ge=Object.create(null)}function Ur(e){var u;const r=new Cr,s=[];if(e.length===0)return Lr;const t=e.map(l=>[!/\*|\/:/.test(l[0]),...l]).sort(([l,p],[_,E])=>l?1:_?-1:p.length-E.length),a=Object.create(null);for(let l=0,p=-1,_=t.length;l<_;l++){const[E,f,h]=t[l];E?a[f]=[h.map(([w])=>[w,Object.create(null)]),qs]:p++;let g;try{g=r.insert(f,p,E)}catch(w){throw w===Re?new $s(f):w}E||(s[p]=h.map(([w,y])=>{const N=Object.create(null);for(y-=1;y>=0;y--){const[k,T]=g[y];N[k]=T}return[w,N]}))}const[n,o,i]=r.buildRegExp();for(let l=0,p=s.length;l<p;l++)for(let _=0,E=s[l].length;_<E;_++){const f=(u=s[l][_])==null?void 0:u[1];if(!f)continue;const h=Object.keys(f);for(let g=0,w=h.length;g<w;g++)f[h[g]]=i[f[h[g]]]}const c=[];for(const l in o)c[l]=s[o[l]];return[n,c,a]}function be(e,r){if(e){for(const s of Object.keys(e).sort((t,a)=>a.length-t.length))if(Fs(s).test(r))return[...e[s]]}}var ce,ue,es,Bs,Os,Pr=(Os=class{constructor(){O(this,es);R(this,"name","RegExpRouter");O(this,ce);O(this,ue);R(this,"match",Nr);S(this,ce,{[P]:Object.create(null)}),S(this,ue,{[P]:Object.create(null)})}add(e,r,s){var i;const t=m(this,ce),a=m(this,ue);if(!t||!a)throw new Error(Hs);t[e]||[t,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[P]).forEach(u=>{c[e][u]=[...c[P][u]]})}),r==="/*"&&(r="*");const n=(r.match(/\/:/g)||[]).length;if(/\*$/.test(r)){const c=Fs(r);e===P?Object.keys(t).forEach(u=>{var l;(l=t[u])[r]||(l[r]=be(t[u],r)||be(t[P],r)||[])}):(i=t[e])[r]||(i[r]=be(t[e],r)||be(t[P],r)||[]),Object.keys(t).forEach(u=>{(e===P||e===u)&&Object.keys(t[u]).forEach(l=>{c.test(l)&&t[u][l].push([s,n])})}),Object.keys(a).forEach(u=>{(e===P||e===u)&&Object.keys(a[u]).forEach(l=>c.test(l)&&a[u][l].push([s,n]))});return}const o=js(r)||[r];for(let c=0,u=o.length;c<u;c++){const l=o[c];Object.keys(a).forEach(p=>{var _;(e===P||e===p)&&((_=a[p])[l]||(_[l]=[...be(t[p],l)||be(t[P],l)||[]]),a[p][l].push([s,n-u+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(m(this,ue)).concat(Object.keys(m(this,ce))).forEach(r=>{e[r]||(e[r]=D(this,es,Bs).call(this,r))}),S(this,ce,S(this,ue,void 0)),Mr(),e}},ce=new WeakMap,ue=new WeakMap,es=new WeakSet,Bs=function(e){const r=[];let s=e===P;return[m(this,ce),m(this,ue)].forEach(t=>{const a=t[e]?Object.keys(t[e]).map(n=>[n,t[e][n]]):[];a.length!==0?(s||(s=!0),r.push(...a)):e!==P&&r.push(...Object.keys(t[P]).map(n=>[n,t[P][n]]))}),s?Ur(r):null},Os),le,te,vs,Hr=(vs=class{constructor(e){R(this,"name","SmartRouter");O(this,le,[]);O(this,te,[]);S(this,le,e.routers)}add(e,r,s){if(!m(this,te))throw new Error(Hs);m(this,te).push([e,r,s])}match(e,r){if(!m(this,te))throw new Error("Fatal error");const s=m(this,le),t=m(this,te),a=s.length;let n=0,o;for(;n<a;n++){const i=s[n];try{for(let c=0,u=t.length;c<u;c++)i.add(...t[c]);o=i.match(e,r)}catch(c){if(c instanceof $s)continue;throw c}this.match=i.match.bind(i),S(this,le,[i]),S(this,te,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(m(this,te)||m(this,le).length!==1)throw new Error("No active router has been determined yet.");return m(this,le)[0]}},le=new WeakMap,te=new WeakMap,vs),Le=Object.create(null),de,F,ge,ke,$,ae,_e,je,$r=(je=class{constructor(r,s,t){O(this,ae);O(this,de);O(this,F);O(this,ge);O(this,ke,0);O(this,$,Le);if(S(this,F,t||Object.create(null)),S(this,de,[]),r&&s){const a=Object.create(null);a[r]={handler:s,possibleKeys:[],score:0},S(this,de,[a])}S(this,ge,[])}insert(r,s,t){S(this,ke,++hs(this,ke)._);let a=this;const n=mr(s),o=[];for(let i=0,c=n.length;i<c;i++){const u=n[i],l=n[i+1],p=Er(u,l),_=Array.isArray(p)?p[0]:u;if(_ in m(a,F)){a=m(a,F)[_],p&&o.push(p[1]);continue}m(a,F)[_]=new je,p&&(m(a,ge).push(p),o.push(p[1])),a=m(a,F)[_]}return m(a,de).push({[r]:{handler:t,possibleKeys:o.filter((i,c,u)=>u.indexOf(i)===c),score:m(this,ke)}}),a}search(r,s){var c;const t=[];S(this,$,Le);let n=[this];const o=Ns(s),i=[];for(let u=0,l=o.length;u<l;u++){const p=o[u],_=u===l-1,E=[];for(let f=0,h=n.length;f<h;f++){const g=n[f],w=m(g,F)[p];w&&(S(w,$,m(g,$)),_?(m(w,F)["*"]&&t.push(...D(this,ae,_e).call(this,m(w,F)["*"],r,m(g,$))),t.push(...D(this,ae,_e).call(this,w,r,m(g,$)))):E.push(w));for(let y=0,N=m(g,ge).length;y<N;y++){const k=m(g,ge)[y],T=m(g,$)===Le?{}:{...m(g,$)};if(k==="*"){const L=m(g,F)["*"];L&&(t.push(...D(this,ae,_e).call(this,L,r,m(g,$))),S(L,$,T),E.push(L));continue}const[A,C,I]=k;if(!p&&!(I instanceof RegExp))continue;const j=m(g,F)[A],x=o.slice(u).join("/");if(I instanceof RegExp){const L=I.exec(x);if(L){if(T[C]=L[0],t.push(...D(this,ae,_e).call(this,j,r,m(g,$),T)),Object.keys(m(j,F)).length){S(j,$,T);const X=((c=L[0].match(/\//))==null?void 0:c.length)??0;(i[X]||(i[X]=[])).push(j)}continue}}(I===!0||I.test(p))&&(T[C]=p,_?(t.push(...D(this,ae,_e).call(this,j,r,T,m(g,$))),m(j,F)["*"]&&t.push(...D(this,ae,_e).call(this,m(j,F)["*"],r,T,m(g,$)))):(S(j,$,T),E.push(j)))}}n=E.concat(i.shift()??[])}return t.length>1&&t.sort((u,l)=>u.score-l.score),[t.map(({handler:u,params:l})=>[u,l])]}},de=new WeakMap,F=new WeakMap,ge=new WeakMap,ke=new WeakMap,$=new WeakMap,ae=new WeakSet,_e=function(r,s,t,a){const n=[];for(let o=0,i=m(r,de).length;o<i;o++){const c=m(r,de)[o],u=c[s]||c[P],l={};if(u!==void 0&&(u.params=Object.create(null),n.push(u),t!==Le||a&&a!==Le))for(let p=0,_=u.possibleKeys.length;p<_;p++){const E=u.possibleKeys[p],f=l[u.score];u.params[E]=a!=null&&a[E]&&!f?a[E]:t[E]??(a==null?void 0:a[E]),l[u.score]=!0}}return n},je),ye,Ds,xr=(Ds=class{constructor(){R(this,"name","TrieRouter");O(this,ye);S(this,ye,new $r)}add(e,r,s){const t=js(r);if(t){for(let a=0,n=t.length;a<n;a++)m(this,ye).insert(e,t[a],s);return}m(this,ye).insert(e,r,s)}match(e,r){return m(this,ye).search(e,r)}},ye=new WeakMap,Ds),Ws=class extends Dr{constructor(e={}){super(e),this.router=e.router??new Hr({routers:[new Pr,new xr]})}},b=e=>{const s={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},t=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(s.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(s.allowMethods);return async function(o,i){var l;function c(p,_){o.res.headers.set(p,_)}const u=await t(o.req.header("origin")||"",o);if(u&&c("Access-Control-Allow-Origin",u),s.credentials&&c("Access-Control-Allow-Credentials","true"),(l=s.exposeHeaders)!=null&&l.length&&c("Access-Control-Expose-Headers",s.exposeHeaders.join(",")),o.req.method==="OPTIONS"){s.origin!=="*"&&c("Vary","Origin"),s.maxAge!=null&&c("Access-Control-Max-Age",s.maxAge.toString());const p=await a(o.req.header("origin")||"",o);p.length&&c("Access-Control-Allow-Methods",p.join(","));let _=s.allowHeaders;if(!(_!=null&&_.length)){const E=o.req.header("Access-Control-Request-Headers");E&&(_=E.split(/\s*,\s*/))}return _!=null&&_.length&&(c("Access-Control-Allow-Headers",_.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),s.origin!=="*"&&o.header("Vary","Origin",{append:!0})}};function qr(e){const r=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],s=[];for(const t of r)e[t]||s.push(t);if(s.length>0)throw new Error(`Missing required environment variables: ${s.join(", ")}

Please configure them:
`+s.map(t=>t==="TOSS_SECRET_KEY"||t==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${t} --project-name ur-live`:`  Check wrangler.jsonc for ${t} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function Fr(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function Br(e){const r=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),r.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):r.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(s){r.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:s instanceof Error?s.message:String(s)})}try{if(!e.SESSION_KV)r.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const s="test:env:check";await e.SESSION_KV.put(s,"ok",{expirationTtl:60}),await e.SESSION_KV.get(s)==="ok"?r.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):r.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(s){r.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:s instanceof Error?s.message:String(s)})}try{if(!e.CACHE_KV)r.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const s="test:cache:check";await e.CACHE_KV.put(s,"ok",{expirationTtl:60}),await e.CACHE_KV.get(s)==="ok"?r.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):r.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(s){r.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:s instanceof Error?s.message:String(s)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?r.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):r.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):r.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?r.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):r.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):r.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),r}function Wr(e){const r=[];r.push(""),r.push("========================================"),r.push("환경 변수 테스트 결과"),r.push("========================================"),r.push("");let s=0,t=0,a=0;for(const n of e){const o=n.status==="pass"?"✅":n.status==="warn"?"⚠️":"❌";r.push(`${o} ${n.name}: ${n.message}`),n.details&&r.push(`   → ${n.details}`),n.status==="pass"&&s++,n.status==="warn"&&t++,n.status==="fail"&&a++}return r.push(""),r.push("========================================"),r.push(`총 ${e.length}개 테스트:`),r.push(`  ✅ 성공: ${s}`),t>0&&r.push(`  ⚠️  경고: ${t}`),a>0&&r.push(`  ❌ 실패: ${a}`),r.push("========================================"),r.push(""),a>0?(r.push("❌ 환경 변수 설정이 완료되지 않았습니다."),r.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):t>0?r.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):r.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),r.join(`
`)}async function Kr(e){const r=await Br(e),s=r.filter(n=>n.status==="pass").length,t=r.filter(n=>n.status==="warn").length,a=r.filter(n=>n.status==="fail").length;return{success:a===0,summary:{total:r.length,pass:s,warn:t,fail:a},results:r,formatted:Wr(r)}}const os={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function Vr(){const e=os.ENV==="production";return{baseUrl:os.TEST_BASE_URL,apiKey:os.TEST_API_KEY,isProduction:e}}async function Ks(e,r){const s=Vr(),t=`${s.baseUrl}${e}`;try{const a=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s.apiKey}`},body:JSON.stringify(r)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function Yr(e){try{const r={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((t,a)=>({SerialNum:a+1,ItemName:t.name,Qty:t.quantity,UnitPrice:t.unitPrice,SupplyCost:t.supplyPrice,Tax:t.taxAmount,Remark:t.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},s=await Ks("/eTaxInvoice/RegistAndIssue",r);if(s.code!==1)throw new Error(`바로빌 발행 실패: ${s.message}`);return{success:!0,ntsConfirmNumber:s.ntsconfirmNum,invoiceKey:s.invoiceKey,message:s.message}}catch(r){throw console.error("바로빌 세금계산서 발행 실패:",r),r}}async function Jr(e,r,s){try{const a=await Ks("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:r,Memo:s});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(t){throw console.error("바로빌 세금계산서 취소 실패:",t),t}}function Me(){return!1}async function zr(e){return await Yr(e)}function Gr(e,r,s){const t=Number(r.total_amount),a=Math.floor(t/1.1),n=t-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:r.buyer_business_number,buyerBusinessName:r.buyer_business_name||r.user_name,buyerCEO:r.buyer_ceo_name,buyerAddress:r.shipping_address,buyerEmail:r.user_email,buyerTel:r.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:s.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),u=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:u,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:t,memo:`주문번호: ${r.order_number}`,orderNo:r.order_number}}class Y extends Error{constructor(r,s,t){super(r),this.statusCode=s,this.code=t,this.name="AuthError"}}function Xr(e){return`${crypto.randomUUID()}-${e}`}function Qr(e){var n,o,i,c,u,l,p;const r=e.id.toString(),s=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",t=((c=e.kakao_account)==null?void 0:c.email)||null,a=((u=e.properties)==null?void 0:u.profile_image)||((p=(l=e.kakao_account)==null?void 0:l.profile)==null?void 0:p.profile_image_url)||null;return{kakaoId:r,nickname:s,email:t,profileImage:a}}async function Zr(e,r,s,t,a){try{const n=await e.prepare(`
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
    `).bind(r,s,t,a).first();if(!n)throw new Y("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",n.id),n}catch(n){throw n instanceof Y?n:(console.error("[Auth] Database error during upsert:",n),new Y("Database error",500,"DB_ERROR"))}}async function et(e){try{const r=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!r.ok){const t=await r.text();throw console.error("[Kakao API] Failed to get user info:",t),new Y("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const s=await r.json();if(!s.id)throw new Y("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return s}catch(r){throw r instanceof Y?r:(console.error("[Kakao API] Network error:",r),new Y("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function st(e,r,s){try{const t=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:s,redirect_uri:r,code:e}).toString()});if(!t.ok){const n=await t.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new Y(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await t.json()).access_token}catch(t){throw t instanceof Y?t:(console.error("[Kakao OAuth] Network error:",t),new Y("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function Vs(e,r){const s=await et(r),{kakaoId:t,nickname:a,email:n,profileImage:o}=Qr(s);console.log("[Auth] Processing login for Kakao user:",t);const i=await Zr(e,t,a,n,o),c=Xr(i.id);return{user:i,sessionToken:c}}async function Ys(e,r,s=30){try{const t=await e.get(r,"json");if(!t)return console.log(`[Cache MISS] ${r}`),null;const a=Date.now()-t.timestamp;return a>s*1e3?(console.log(`[Cache EXPIRED] ${r} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${r} (age: ${Math.round(a/1e3)}s)`),t.data)}catch(t){return console.error(`[Cache] Get error for key "${r}":`,t),null}}async function Qe(e,r,s,t=30){try{const a={data:s,timestamp:Date.now()};await e.put(r,JSON.stringify(a),{expirationTtl:t}),console.log(`[Cache SET] ${r} (TTL: ${t}s)`)}catch(a){console.error(`[Cache] Set error for key "${r}":`,a)}}function rt(e){const r=e.req.header("CF-Connecting-IP");if(r)return r;const s=e.req.header("X-Forwarded-For");if(s)return s.split(",")[0].trim();const t=e.req.header("X-Real-IP");return t||"unknown"}function tt(e,r){return`ratelimit:${e}:${r}`}const is=new Map;async function at(e,r,s){var _;const t=new URL(e.req.url).pathname,a=tt(r,t),n=Date.now(),o=s.windowMs*1e3,c=e.get("user")&&s.authenticatedMultiplier?s.maxRequests*s.authenticatedMultiplier:s.maxRequests;try{const E=(_=e.env)==null?void 0:_.RATE_LIMIT_KV;if(E){const f=await E.get(a);let h;f?(h=JSON.parse(f),n>h.resetTime?h={count:1,resetTime:n+o}:h.count++):h={count:1,resetTime:n+o};const g=Math.ceil(o/1e3);await E.put(a,JSON.stringify(h),{expirationTtl:g});const w=h.count<=c,y=Math.max(0,c-h.count);return{allowed:w,remaining:y,resetTime:h.resetTime}}}catch(E){console.error("KV Rate Limit Error:",E)}let u=is.get(a);u&&n>u.resetTime&&(is.delete(a),u=void 0),u?u.count++:u={count:1,resetTime:n+o},is.set(a,u);const l=u.count<=c,p=Math.max(0,c-u.count);return{allowed:l,remaining:p,resetTime:u.resetTime}}function We(e){return async(r,s)=>{const t=rt(r);if(e.skipIps&&e.skipIps.includes(t))return s();if(e.pathPattern){const n=new URL(r.req.url).pathname;if(!e.pathPattern.test(n))return s()}const a=await at(r,t,e);if(r.header("X-RateLimit-Limit",e.maxRequests.toString()),r.header("X-RateLimit-Remaining",a.remaining.toString()),r.header("X-RateLimit-Reset",new Date(a.resetTime).toISOString()),!a.allowed){const n=Math.ceil((a.resetTime-Date.now())/1e3);return r.header("Retry-After",n.toString()),r.json({success:!1,error:e.message||"Too many requests. Please try again later.",retryAfter:n,resetTime:new Date(a.resetTime).toISOString()},429)}return s()}}const Ke={api:{windowMs:60,maxRequests:60,message:"API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",authenticatedMultiplier:2},auth:{windowMs:60,maxRequests:5,message:"로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",pathPattern:/^\/api\/auth\//},order:{windowMs:60,maxRequests:10,message:"주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/orders/,authenticatedMultiplier:2},alimtalk:{windowMs:60,maxRequests:10,message:"알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/seller\/alimtalk\/send/},upload:{windowMs:60,maxRequests:5,message:"파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/.*\/upload/}};class U extends Error{constructor(r,s,t="VALIDATION_ERROR"){super(s),this.field=r,this.code=t,this.name="ValidationError"}}function nt(e,r){const{field:s,required:t,type:a,min:n,max:o,pattern:i,enum:c,custom:u,message:l}=r;if(t&&(e==null||e===""))throw new U(s,l||`${s}은(는) 필수 항목입니다.`,"REQUIRED");if(!(e==null||e==="")){if(a)switch(a){case"string":if(typeof e!="string")throw new U(s,l||`${s}은(는) 문자열이어야 합니다.`,"INVALID_TYPE");break;case"number":const p=typeof e=="string"?Number(e):e;if(typeof p!="number"||isNaN(p))throw new U(s,l||`${s}은(는) 숫자여야 합니다.`,"INVALID_TYPE");break;case"boolean":if(typeof e!="boolean")throw new U(s,l||`${s}은(는) true/false 값이어야 합니다.`,"INVALID_TYPE");break;case"email":if(typeof e!="string"||!ct(e))throw new U(s,l||`${s}은(는) 유효한 이메일 주소여야 합니다.`,"INVALID_EMAIL");break;case"url":if(typeof e!="string"||!ut(e))throw new U(s,l||`${s}은(는) 유효한 URL이어야 합니다.`,"INVALID_URL");break;case"phone":if(typeof e!="string"||!lt(e))throw new U(s,l||`${s}은(는) 유효한 전화번호여야 합니다.`,"INVALID_PHONE");break;case"date":if(!(e instanceof Date)&&!dt(e))throw new U(s,l||`${s}은(는) 유효한 날짜여야 합니다.`,"INVALID_DATE");break;case"array":if(!Array.isArray(e))throw new U(s,l||`${s}은(는) 배열이어야 합니다.`,"INVALID_TYPE");break;case"object":if(typeof e!="object"||e===null||Array.isArray(e))throw new U(s,l||`${s}은(는) 객체여야 합니다.`,"INVALID_TYPE");break}if(typeof e=="string"){if(n!==void 0&&e.length<n)throw new U(s,l||`${s}은(는) 최소 ${n}자 이상이어야 합니다.`,"TOO_SHORT");if(o!==void 0&&e.length>o)throw new U(s,l||`${s}은(는) 최대 ${o}자 이하여야 합니다.`,"TOO_LONG")}if(typeof e=="number"){if(n!==void 0&&e<n)throw new U(s,l||`${s}은(는) 최소 ${n} 이상이어야 합니다.`,"TOO_SMALL");if(o!==void 0&&e>o)throw new U(s,l||`${s}은(는) 최대 ${o} 이하여야 합니다.`,"TOO_LARGE")}if(Array.isArray(e)){if(n!==void 0&&e.length<n)throw new U(s,l||`${s}은(는) 최소 ${n}개 이상이어야 합니다.`,"TOO_FEW");if(o!==void 0&&e.length>o)throw new U(s,l||`${s}은(는) 최대 ${o}개 이하여야 합니다.`,"TOO_MANY")}if(i&&typeof e=="string"&&!i.test(e))throw new U(s,l||`${s}의 형식이 올바르지 않습니다.`,"INVALID_FORMAT");if(c&&!c.includes(e))throw new U(s,l||`${s}은(는) 다음 중 하나여야 합니다: ${c.join(", ")}`,"INVALID_ENUM");if(u&&u(e)===!1)throw new U(s,l||`${s}의 값이 유효하지 않습니다.`,"CUSTOM_VALIDATION_FAILED")}}function ot(e,r){for(const s of r){const t=e[s.field];nt(t,s)}}function it(e){return async(r,s)=>{try{let t={};const a=r.req.header("content-type")||"";a.includes("application/json")?t=await r.req.json().catch(()=>({})):(a.includes("application/x-www-form-urlencoded")||a.includes("multipart/form-data"))&&(t=await r.req.parseBody().catch(()=>({})));const n=new URL(r.req.url);for(const[o,i]of n.searchParams.entries())o in t||(t[o]=i);ot(t,e),r.set("validatedData",t),await s()}catch(t){if(t instanceof U)return r.json({success:!1,error:t.message,field:t.field,code:t.code},400);throw t}}}function ct(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=255}function ut(e){try{const r=new URL(e);return r.protocol==="http:"||r.protocol==="https:"}catch{return!1}}function lt(e){return/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e)}function dt(e){if(typeof e!="string")return!1;const r=new Date(e);return!isNaN(r.getTime())}const pt=[{field:"email",required:!0,type:"email",max:255,message:"유효한 이메일 주소를 입력해주세요."},{field:"password",required:!0,type:"string",min:8,max:100,pattern:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:"비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다."},{field:"name",required:!0,type:"string",min:2,max:50,message:"이름은 2-50자 사이여야 합니다."},{field:"phone",required:!1,type:"phone",message:"유효한 전화번호를 입력해주세요. (예: 010-1234-5678)"}];function ss(e){const r=new URLSearchParams;for(const[s,t]of Object.entries(e))t!=null&&r.append(s,String(t));return r}function ls(e,r){if(e.result_code!=="1")throw new Error(`[Aligo ${r}] ${e.message} (code: ${e.result_code})`)}async function ds(e){console.log("[Aligo] 토큰 생성 시작");const s=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:ss({apikey:e.ALIGO_API_KEY,userid:e.ALIGO_USER_ID})})).json();return ls(s,"Token Create"),console.log("[Aligo] ✅ 토큰 생성 성공:",s.token.substring(0,20)+"..."),{token:s.token,urtime:s.urtime}}async function mt(e,r){console.log("[Aligo] 카카오 채널 등록:",r.channelId);const{token:s}=await ds(e),a=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:ss({token:s,userid:e.ALIGO_USER_ID,plusid:r.channelId,phonenumber:r.phoneNumber})})).json();return ls(a,"Channel Register"),console.log("[Aligo] ✅ 카카오 채널 등록 성공, senderKey:",a.senderkey),{success:!0,senderKey:a.senderkey}}async function _t(e,r,s){console.log("[Aligo] 템플릿 등록:",s.templateCode);const{token:t}=await ds(e),n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:ss({token:t,userid:e.ALIGO_USER_ID,senderkey:r,tpl_name:s.name,tpl_content:s.content,tpl_code:s.templateCode})})).json();return ls(n,"Template Register"),console.log("[Aligo] ✅ 템플릿 등록 성공:",n.tpl_code),{success:!0,templateCode:n.tpl_code}}async function Js(e,r){console.log("[Aligo] 알림톡 발송:",r.to);try{const{token:s}=await ds(e),t=r.buttons?JSON.stringify({button:r.buttons}):void 0,n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:ss({token:s,userid:e.ALIGO_USER_ID,senderkey:r.senderKey,tpl_code:r.templateCode,receiver_1:r.to,subject_1:"알림톡",message_1:r.message,button_1:t})})).json();return n.result_code!=="1"?(console.error("[Aligo] ❌ 알림톡 발송 실패:",n.message),{success:!1,error:n.message}):(console.log("[Aligo] ✅ 알림톡 발송 성공, messageId:",n.msg_id),{success:!0,messageId:n.msg_id})}catch(s){return console.error("[Aligo] ❌ 알림톡 발송 에러:",s.message),{success:!1,error:s.message}}}function ft(e,r){let s=e;for(const[t,a]of Object.entries(r)){const n=new RegExp(`#{${t}}`,"g");s=s.replace(n,a)}return s}function zs(e){let r=e.replace(/-/g,"");if(!r.startsWith("010"))throw new Error("Invalid phone number format. Must start with 010");if(r.length!==11)throw new Error("Invalid phone number length. Must be 11 digits");return r}async function Et(e,r){const s=await e.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(r).first();if(!s)throw new Error(`Order not found: ${r}`);const t=await e.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(r).all();return{order:s,products:t.results}}async function ht(e,r){const s=await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(r).first();return s||(console.warn(`No active alimtalk account for seller ${r}`),null)}async function bs(e,r){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(r.seller_id,r.template_code,r.recipient_phone,r.message,r.cost,r.status,r.order_id||null).run()}async function gt(e,r,s){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(s,r).run()}async function yt(e,r){try{const{order:s,products:t}=await Et(e.DB,r),a=await ht(e.DB,s.seller_id);if(!a)return console.warn(`Skipping alimtalk for order ${r}: no active account`),{success:!1,reason:"no_account"};const n=15;if(a.balance<n)return console.warn(`Skipping alimtalk for order ${r}: insufficient balance`),{success:!1,reason:"insufficient_balance"};const o=t.map(u=>`${u.name} ${u.quantity}개 (${u.price.toLocaleString()}원)`).join(`
`),i=`[주문 확인]

주문번호: ${s.order_number}
주문일시: ${new Date(s.created_at).toLocaleString("ko-KR")}

주문 상품:
${o}

총 결제금액: ${s.total_amount.toLocaleString()}원

배송지: ${s.shipping_address}
수령인: ${s.shipping_name}
연락처: ${s.shipping_phone}

주문해 주셔서 감사합니다!`,c=await Js(e,{senderKey:a.sender_key,templateCode:"order_confirm",to:s.buyer_phone,message:i});return c.success?(await gt(e.DB,s.seller_id,n),await bs(e.DB,{seller_id:s.seller_id,template_code:"order_confirm",recipient_phone:s.buyer_phone,message:i,cost:n,status:"sent",order_id:r}),console.log(`Order confirmation sent for order ${r}`),{success:!0}):(await bs(e.DB,{seller_id:s.seller_id,template_code:"order_confirm",recipient_phone:s.buyer_phone,message:i,cost:0,status:"failed",order_id:r}),console.error(`Failed to send order confirmation for order ${r}:`,c.error),{success:!1,error:c.error})}catch(s){return console.error(`Error sending order confirmation for order ${r}:`,s),{success:!1,error:s.message}}}function wt(e){const r=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:r,message:"API Request",context:e,duration:e.duration}))}function bt(e){return{name:"tosspayments",async confirmPayment(r){try{const s=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:r.paymentKey,orderId:r.orderId,amount:r.amount})}),t=await s.json();if(!s.ok)return{success:!1,orderId:r.orderId,paymentKey:r.paymentKey,method:"",totalAmount:r.amount,status:"FAILED",approvedAt:"",error:t.message||"결제 승인 실패",rawData:t};let a={};t.card&&(a={cardCompany:t.card.company,cardNumber:t.card.number,installmentMonths:t.card.installmentPlanMonths||0});let n={};return t.virtualAccount&&(n={virtualAccountBank:t.virtualAccount.bankCode,virtualAccountNumber:t.virtualAccount.accountNumber,virtualAccountHolder:t.virtualAccount.customerName,virtualAccountDueDate:t.virtualAccount.dueDate}),{success:!0,orderId:t.orderId,paymentKey:t.paymentKey,method:t.method,totalAmount:t.totalAmount,status:t.status,approvedAt:t.approvedAt,transactionId:t.transactionKey,...a,...n,rawData:t}}catch(s){return{success:!1,orderId:r.orderId,paymentKey:r.paymentKey,method:"",totalAmount:r.amount,status:"FAILED",approvedAt:"",error:s.message,rawData:null}}},async cancelPayment(r){try{const s={cancelReason:r.cancelReason};r.cancelAmount&&(s.cancelAmount=r.cancelAmount);const t=await fetch(`https://api.tosspayments.com/v1/payments/${r.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(s)}),a=await t.json();return t.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(s){return{success:!1,error:s.message}}},async getPayment(r){try{const s=await fetch(`https://api.tosspayments.com/v1/payments/${r}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),t=await s.json();if(!s.ok)throw new Error(t.message);return{success:!0,orderId:t.orderId,paymentKey:t.paymentKey,method:t.method,totalAmount:t.totalAmount,status:t.status,approvedAt:t.approvedAt,rawData:t}}catch(s){throw s}}}}function Tt(e,r){switch(e.toLowerCase()){case"tosspayments":return bt(r);default:throw new Error(`Unknown payment provider: ${e}`)}}const d=new Ws;d.use("*",async(e,r)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{qr(e.env),Fr(e.env)}catch(t){console.error("[ENV] Validation failed:",t)}await r()});async function Z(e,r){if(!r)return null;try{const s=await e.get(`session:${r}`);if(!s)return null;const t=JSON.parse(s);return t.expires_at&&Date.now()>t.expires_at?(await e.delete(`session:${r}`),null):{user_id:t.user_id,user_type:t.user_type||"user"}}catch(s){return console.error("[Auth] Session lookup error:",s),null}}async function B(e,r){var n;const{SESSION_KV:s}=e.env;let t=e.req.header("X-Session-Token");if(t||(t=(n=e.req.header("Authorization"))==null?void 0:n.replace("Bearer ","")),!t){const o=e.req.header("Cookie");if(o){const i=o.match(/session=([^;]+)/);t=i?i[1]:void 0}}const a=await Z(s,t);if(!a)return e.json({success:!1,error:"인증이 필요합니다. 로그인 해주세요."},401);try{if(t){const o=await s.get(`session:${t}`);if(o){const i=JSON.parse(o),c=i.expires_at-Date.now(),u=10080*60*1e3;if(c<u){const l=Date.now()+2592e6;await s.put(`session:${t}`,JSON.stringify({...i,expires_at:l}),{expirationTtl:720*60*60}),console.log("[Auth] ✅ Session auto-renewed for user:",a.user_id,"- New expiration:",new Date(l).toISOString())}}}}catch(o){console.error("[Auth] Session renewal error:",o)}e.set("userId",a.user_id),e.set("userType",a.user_type),await r()}async function ps(e,r){try{const s=await e.get(r);return s?JSON.parse(s):null}catch(s){return console.error("[Cache] Read error:",s),null}}async function ms(e,r,s,t=60){try{await e.put(r,JSON.stringify(s),{expirationTtl:t})}catch(a){console.error("[Cache] Write error:",a)}}async function _s(e,...r){try{await Promise.all(r.map(s=>e.delete(s)))}catch(s){console.error("[Cache] Delete error:",s)}}async function Ve(e,r,s,t,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(r,s,t,a,n,o||null).run(),console.log(`[Notification] Created for ${s} ${r}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function St(e,r,s,t,a){await Ve(e,r,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${t}님의 주문 (${s}) - ${It(a)}`,"/seller/orders")}async function Gs(e,r,s,t,a,n){let o="",i="";switch(t){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${s}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${s}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${s}가 배송 완료되었습니다`;break;default:return}await Ve(e,r,"user","shipping_status",o,i,"/my-orders")}async function Rt(e,r,s,t,a){await Ve(e,r,"seller","low_stock","⚠️ 재고 부족 알림",`${s}의 재고가 ${t}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function It(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function Ot(e,r,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const t=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:r,description:s,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!t.ok){const p=await t.text();throw new Error(`YouTube Broadcast 생성 실패: ${p}`)}const n=(await t.json()).id,o=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${r} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!o.ok){const p=await o.text();throw new Error(`YouTube Stream 생성 실패: ${p}`)}const i=await o.json(),c=i.id,u=i.cdn.ingestionInfo.streamName,l=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:n,streamId:c,streamKey:u,streamUrl:l}}catch(t){throw console.error("[YouTube API] Live broadcast creation failed:",t),t}}async function vt(e,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const s=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${r}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!s.ok){const t=await s.text();throw new Error(`YouTube 방송 종료 실패: ${t}`)}}catch(s){throw console.error("[YouTube API] Live broadcast end failed:",s),s}}async function Dt(e,r,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let t=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${r}&part=snippet,authorDetails`;s&&(t+=`&pageToken=${s}`);const a=await fetch(t,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const o=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${o}`)}const n=await a.json();return{messages:n.items||[],nextPageToken:n.nextPageToken,pollingIntervalMillis:n.pollingIntervalMillis||5e3}}catch(t){throw console.error("[YouTube API] Get chat messages failed:",t),t}}async function Nt(e,r){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const s=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},t=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${r}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${r}&key=${e.apiKey}`,a=await fetch(t,{headers:s});if(!a.ok){const u=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${u}`)}const n=await a.json();if(!n.items||n.items.length===0)throw new Error("Video not found");const o=n.items[0],i=o.statistics,c=o.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(s){throw console.error("[YouTube API] Get live stats failed:",s),s}}function Xs(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const r=new URL(e);if(r.hostname.includes("youtube.com")){const s=r.searchParams.get("v");if(s)return s;const t=r.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(t)return t[2]}if(r.hostname==="youtu.be"){const s=r.pathname.slice(1).split("?")[0];if(s&&s.length===11)return s}return null}catch{return null}}function Qs(e){try{const r=new URL(e);if(r.hostname.includes("tiktok.com")){const s=r.pathname.match(/\/video\/(\d+)/);if(s)return s[1];const t=r.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(t)return t[1]}return r.hostname.includes("vm.tiktok.com")||r.hostname.includes("vt.tiktok.com")?r.pathname.slice(1):null}catch{return null}}function kt(e){try{const r=new URL(e);if(r.hostname.includes("tiktok.com")){if(r.pathname.includes("/live"))return"live";if(r.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Zs(e){try{const r=new URL(e);if(r.hostname.includes("tiktok.com")){const s=r.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(s)return s[1]}return r.hostname.includes("vm.tiktok.com")||r.hostname.includes("vt.tiktok.com")?r.pathname.slice(1):null}catch{return null}}d.use("*",async(e,r)=>{await r(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const s=new URL(e.req.url);s.hostname!=="localhost"&&s.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});d.use("/api/*",b());d.use(We(Ke.auth));d.use(We(Ke.alimtalk));d.use(We(Ke.order));d.use(We(Ke.upload));d.use("/api/*",We(Ke.api));d.use("/api/*",async(e,r)=>{const s=Date.now(),t=e.req.method,a=e.req.path;await r();const n=Date.now()-s,o=e.res.status,i={method:t,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),wt(i)});d.use("/static/*",async(e,r)=>{await r(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});d.use("/images/*",async(e,r)=>{await r(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});async function er(e,r,s,t){const a=crypto.randomUUID(),n=Date.now()+1440*60*1e3,o={user_id:r,user_type:s,userData:t,expires_at:n};return await e.put(`session:${a}`,JSON.stringify(o),{expirationTtl:86400}),console.log(`[createSession] ✅ Session created for ${s} user ${r}`),a}async function Ae(e,r){const s=await e.get(`session:${r}`);if(!s)return null;const t=JSON.parse(s);return t.expires_at&&Date.now()>t.expires_at?(await e.delete(`session:${r}`),null):{session_token:r,[`${t.user_type}_id`]:t.user_id,user_type:t.user_type,...t.userData}}d.post("/api/auth/user/register",b(),it(pt),async e=>{const{DB:r}=e.env;try{const{email:s,password:t,name:a,phone:n}=e.get("validatedData"),o=`placeholder_hash_for_${t}`;try{const c=(await r.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(s,o,a,n||null).run()).meta.last_row_id,u=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:u,user:{id:c,email:s,name:a,phone:n}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(s){return console.error("[User Register] Error:",s),e.json({success:!1,error:s.message||"회원가입 중 오류가 발생했습니다"},500)}});d.post("/api/auth/user/login",b(),async e=>{const{DB:r,SESSION_KV:s}=e.env;try{const{email:t,password:a}=await e.req.json();if(!t||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await r.prepare("SELECT * FROM users WHERE email = ?").bind(t).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${a}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await r.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();const i=crypto.randomUUID(),c=Date.now()+1440*60*1e3;return await s.put(`session:${i}`,JSON.stringify({user_id:n.id,user_type:"user",expires_at:c}),{expirationTtl:1440*60}),console.log("[User Login] Session created in SESSION_KV for user:",n.id),e.json({success:!0,data:{session_token:i,user:{id:n.id,email:n.email,name:n.name,phone:n.phone,profile_image:n.profile_image}}})}catch(t){return console.error("[User Login] Error:",t),e.json({success:!1,error:t.message||"로그인 중 오류가 발생했습니다"},500)}});d.post("/api/auth/login",b(),async e=>{const{DB:r}=e.env;try{const{username:s,password:t,userType:a}=await e.req.json();if(!s||!t||!a)return e.json({success:!1,error:"아이디와 비밀번호를 입력해주세요"},400);let n,o=a==="admin"?"admins":"sellers";if(n=await r.prepare(`SELECT * FROM ${o} WHERE username = ? OR email = ?`).bind(s,s).first(),!n)return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);const i=a==="admin"&&(s==="admin"||s==="admin@example.com")&&t==="admin123",c=a==="seller"&&(s==="seller1"&&t==="seller123"||s==="seller2"&&t==="seller123"),u=n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${t}`);if(!(i||c||u))return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);if(!n.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(a==="seller"&&n.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다"},403);const p=await er(e.env.SESSION_KV,n.id,a,{username:n.username,name:n.name,email:n.email,businessName:n.business_name,role:n.role});return await r.prepare(`UPDATE ${o} SET last_login_at = datetime('now') WHERE id = ?`).bind(n.id).run(),e.json({success:!0,data:{sessionToken:p,user:{id:n.id,username:n.username,name:n.name,email:n.email,type:a,businessName:n.business_name,role:n.role}}})}catch(s){return console.error("Login error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/auth/logout",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.header("X-Session-Token");return s&&await e.env.SESSION_KV.delete(`session:${s}`),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.post("/api/seller/register",b(),async e=>{const{DB:r}=e.env;try{const{email:s,password:t,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!s||!t||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(t.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=s.split("@")[0],u=`placeholder_hash_for_${t}`;try{const l=await r.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,s,u,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:l.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(l){const p=l.message||"";if(p.includes("UNIQUE")||p.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw l}}catch(s){return console.error("Seller registration error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/admin/login",b(),async e=>{const{DB:r}=e.env;try{const{email:s,password:t}=await e.req.json();if(!s||!t)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await r.prepare("SELECT * FROM admins WHERE email = ?").bind(s).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(s==="admin@example.com"&&t==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${t}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=await er(e.env.SESSION_KV,a.id,"admin",{username:a.username,email:a.email,name:a.name,role:a.role});return await r.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),e.json({success:!0,data:{token:i,admin:{id:a.id,username:a.username,email:a.email,name:a.name,role:a.role}}})}catch(s){return console.error("Admin login error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/auth/verify",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const t=await Ae(e.env.SESSION_KV,s);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=t.user_type==="admin"?"admins":"sellers",n=t.user_type==="admin"?t.admin_id:t.seller_id,o=await r.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:t.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name,role:o.role}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/auth/kakao/sync/callback",async e=>{var s,t,a,n,o,i,c,u,l,p,_,E,f;const{DB:r}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!r);const h=e.req.query("code"),g=e.req.query("state")||"/",w=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!h,state:g,error:w}),w)return console.error("[Kakao Sync] OAuth error:",w),e.redirect(`${g}?error=kakao_oauth_${w}`);if(!h)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${g}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const y=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",N=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",y.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",N),console.log("[Kakao Sync] Step 1: Fetching access token...");const k=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:y,redirect_uri:N,code:h})});if(console.log("[Kakao Sync] Token response status:",k.status),console.log("[Kakao Sync] Token request details:",{client_id:y,redirect_uri:N,code_length:h.length,code_prefix:h.substring(0,20)}),!k.ok){const W=await k.text();return console.error("[Kakao Sync] Token request failed:",W),e.redirect(`${g}?error=token_request_failed&detail=${encodeURIComponent(W)}`)}const T=await k.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!T.access_token,error:T.error,errorDescription:T.error_description}),!T.access_token)return console.error("[Kakao Sync] Token error:",T),e.redirect(`${g}?error=token_failed&detail=${encodeURIComponent(T.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const A=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${T.access_token}`}});console.log("[Kakao Sync] User response status:",A.status);const C=await A.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!C.id,id:C.id,hasNickname:!!((s=C.properties)!=null&&s.nickname||(a=(t=C.kakao_account)==null?void 0:t.profile)!=null&&a.nickname)}),!C.id)return console.error("[Kakao Sync] Failed to get user info:",C),e.redirect(`${g}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const I=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${T.access_token}`}});console.log("[Kakao Sync] Terms response status:",I.status);let j=null;if(I.ok?(j=await I.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=j.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=j.allowed_service_terms)==null?void 0:o.map(W=>W.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!r)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${g}?error=db_not_available`);const x=C.id.toString(),L=((i=C.properties)==null?void 0:i.nickname)||((u=(c=C.kakao_account)==null?void 0:c.profile)==null?void 0:u.nickname)||"Kakao User",X=((l=C.kakao_account)==null?void 0:l.email)||"",Q=((p=C.properties)==null?void 0:p.profile_image)||((E=(_=C.kakao_account)==null?void 0:_.profile)==null?void 0:E.profile_image_url)||"",Ce=T.access_token,q=((f=j==null?void 0:j.allowed_service_terms)==null?void 0:f.map(W=>W.tag))||[],pe=JSON.stringify(q);console.log("[Kakao Sync] User data:",{kakaoId:x,nickname:L,email:X?"exists":"none",serviceTerms:q});try{const W=await r.prepare("SELECT * FROM users WHERE kakao_id = ?").bind(x).first();console.log("[Kakao Sync] Existing user check:",!!W);let ee;W?(ee=W.id,await r.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L,X,Q,ee).run(),console.log("[Kakao Sync] Updated user:",ee)):(ee=(await r.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(x,L,X||null,Q||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",ee)),console.log("[Kakao Sync] User saved successfully, userId:",ee),console.log("[Kakao Sync] Step 4: Creating session...");const{SESSION_KV:tr}=e.env,rs=crypto.randomUUID(),ar=Date.now()+1440*60*1e3;await tr.put(`session:${rs}`,JSON.stringify({user_id:ee,user_type:"user",expires_at:ar}),{expirationTtl:1440*60}),console.log("[Kakao Sync] Session created successfully in SESSION_KV"),console.log("[Kakao Sync] Step 5: Redirecting...");const fs=g.includes("?")?`${g}&login=success&session=${rs}&userId=${ee}&userName=${encodeURIComponent(L)}`:`${g}?login=success&session=${rs}&userId=${ee}&userName=${encodeURIComponent(L)}`;return console.log("[Kakao Sync] Redirect URL:",fs),e.redirect(fs)}catch(W){return console.error("[Kakao Sync] Database error:",W),console.error("[Kakao Sync] DB error details:",{message:W.message,name:W.name}),e.redirect(`${g}?error=database_error&detail=${encodeURIComponent(W.message)}`)}}catch(h){console.error("[Kakao Sync] Exception:",h),console.error("[Kakao Sync] Error details:",{message:h.message,stack:h.stack,name:h.name});const g=e.req.query("state")||"/",w=encodeURIComponent(h.message||"unknown");return e.redirect(`${g}?error=kakao_sync_failed&detail=${w}`)}});d.post("/api/auth/kakao/callback",b(),async e=>{const{DB:r}=e.env;try{const{code:s,redirect_uri:t}=await e.req.json();if(!s)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=t||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow");const n=await st(s,a,e.env.KAKAO_REST_API_KEY),{user:o,sessionToken:i}=await Vs(r,n),c=Date.now()+720*60*60*1e3;return await e.env.SESSION_KV.put(`session:${i}`,JSON.stringify({user_id:o.id,user_type:"user",expires_at:c}),{expirationTtl:720*60*60}),console.log("[Kakao Callback] ✅ Session saved to SESSION_KV for user:",o.id,"- Expires:",new Date(c).toISOString()),e.json({success:!0,data:{session_token:i,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image}}})}catch(s){return console.error("[Kakao Callback] Error:",s),s instanceof Y?e.json({success:!1,error:s.message,code:s.code},s.statusCode):e.json({success:!1,error:s.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});d.post("/api/auth/kakao/sync",b(),async e=>{const{DB:r}=e.env;try{const{accessToken:s}=await e.req.json();if(!s)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Sync] Verifying access token");const t=Date.now(),{user:a,sessionToken:n}=await Vs(r,s);console.log("[Kakao Sync] ProcessKakaoLogin completed in",Date.now()-t,"ms");const o=Date.now()+720*60*60*1e3,i=Date.now();return await e.env.SESSION_KV.put(`session:${n}`,JSON.stringify({user_id:a.id,user_type:"user",expires_at:o}),{expirationTtl:720*60*60}),console.log("[Kakao Sync] ✅ Session saved to SESSION_KV in",Date.now()-i,"ms"),console.log("[Kakao Sync] Total login time:",Date.now()-t,"ms"),e.json({success:!0,data:{session_token:n,user:{id:a.id,name:a.name,email:a.email,profile_image:a.profile_image}}})}catch(s){return console.error("[Kakao Sync] Error:",s),s instanceof Y?e.json({success:!1,error:s.message,code:s.code},s.statusCode):e.json({success:!1,error:s instanceof Error?s.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});d.get("/api/auth/validate",b(),async e=>{var s;const{SESSION_KV:r}=e.env;try{const t=e.req.header("X-Session-Token")||((s=e.req.header("Authorization"))==null?void 0:s.replace("Bearer ",""))||"";if(!t)return e.json({success:!1,error:"No session token provided",code:"NO_TOKEN"},401);const a=await Z(r,t);return a?e.json({success:!0,data:{user_id:a.user_id,user_type:a.user_type,session_valid:!0}}):e.json({success:!1,error:"Session expired or invalid",code:"SESSION_EXPIRED"},401)}catch(t){return console.error("[Auth Validate] Error:",t),e.json({success:!1,error:"Validation failed",code:"VALIDATION_ERROR"},500)}});d.post("/api/auth/kakao/logout",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.header("X-Session-Token")||"";return s&&(await r.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(s){return console.error("[Kakao Sync] Logout error:",s),e.json({success:!1,error:"Logout failed"},500)}});d.post("/api/auth/kakao/unlink",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await r.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(s).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await r.prepare(`
      SELECT * FROM users WHERE id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(s).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const n=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),o=await n.json();n.ok?console.log("[Kakao Unlink] Kakao unlink successful:",o.id):console.warn("[Kakao Unlink] Kakao unlink failed:",o)}catch(n){console.error("[Kakao Unlink] Kakao API error:",n)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await r.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(),console.log("[Kakao Unlink] Sessions deleted"),await r.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await r.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(s){return console.error("[Kakao Unlink] Error:",s),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});d.post("/webhooks/kakao/unlink",async e=>{const{DB:r}=e.env;try{const s=await e.req.json(),{user_id:t,referrer_type:a}=s;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:t,referrer_type:a}),!t)return e.json({success:!1,error:"user_id is required"},400);const n=await r.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(t.toString()).first();return n?(console.log("[Kakao Webhook] Deleting user data for user:",n.id),await r.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await r.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await r.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",t),e.json({success:!0}))}catch(s){return console.error("[Kakao Webhook] Error:",s),e.json({success:!1,error:"Webhook processing failed"},500)}});d.get("/api/auth/user/verify",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const t=await Ae(e.env.SESSION_KV,s);if(!t||t.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=parseInt(s.split("_")[1]),n=await r.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();return n?e.json({success:!0,data:{user:{id:n.id,name:n.name,email:n.email,profileImage:n.profile_image,phone:n.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/shipping-addresses",b(),B,async e=>{const{DB:r}=e.env,s=e.get("userId");try{const t=await r.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(s).all();return e.json({success:!0,data:t.results||[]})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/shipping-addresses/:userId",b(),B,async e=>{const{DB:r}=e.env,s=e.get("userId"),t=parseInt(e.req.param("userId"));try{if(t!==s)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await r.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(s).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/shipping-addresses",b(),async e=>{const{DB:r}=e.env;try{const s=await e.req.json(),t=s.user_id,a=s.recipient_name,n=s.phone,o=s.postal_code,i=s.address,c=s.address_detail,u=s.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(s)),!t||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:t,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);u&&await r.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(t).run();const l=await r.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a,n,o||"",i,c||"",u?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:l.meta.last_row_id}),e.json({success:!0,data:{id:l.meta.last_row_id}})}catch(s){return console.error("[POST /api/shipping-addresses] Error:",s),e.json({success:!1,error:s.message},500)}});d.put("/api/shipping-addresses/:id",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.param("id"),t=await e.req.json(),a=t.user_id,n=t.recipient_name,o=t.phone,i=t.postal_code,c=t.address,u=t.address_detail,l=t.is_default;return l&&await r.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await r.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,u||"",l?1:0,s,a).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.delete("/api/shipping-addresses/:id",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.param("id"),t=e.req.query("userId");return await r.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(s,t).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});async function M(e){const r=e.req.header("X-Session-Token");if(!r)return{success:!1,error:"인증 토큰이 없습니다"};const s=await Ae(e.env.SESSION_KV,r);return!s||s.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:s.admin_id,userData:s}}async function v(e){const r=e.req.header("X-Session-Token");if(!r)return{success:!1,error:"인증 토큰이 없습니다"};const s=await Ae(e.env.SESSION_KV,r);return!s||s.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:s.seller_id,userData:s}}d.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));d.get("/api/test/env",async e=>{try{const r=await Kr(e.env);return e.json(r)}catch(r){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:r instanceof Error?r.message:String(r)},500)}});d.get("/api/streams",async e=>{const{DB:r,CACHE_KV:s}=e.env;try{const t="streams:live",a=await s.get(t,"json");if(a)return e.json({success:!0,data:a,cached:!0});const n=await r.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();return await s.put(t,JSON.stringify(n.results),{expirationTtl:600}),e.json({success:!0,data:n.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/streams/:id",async e=>{const{DB:r}=e.env,s=e.req.param("id");try{const t=await r.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(s).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"Stream not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/live-streams",async e=>{const{DB:r}=e.env,{status:s,seller_id:t,limit:a="20",offset:n="0"}=e.req.query();try{let o=`
      SELECT ls.*, 
             s.display_name as seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE 1=1
    `;const i=[];s&&(o+=" AND ls.status = ?",i.push(s)),t&&(o+=" AND ls.seller_id = ?",i.push(t)),o+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',o+=" LIMIT ? OFFSET ?",i.push(parseInt(a),parseInt(n));const{results:c}=await r.prepare(o).bind(...i).all();return e.json({success:!0,data:c})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});d.get("/api/live-streams/:id",async e=>{const{DB:r}=e.env,s=e.req.param("id");try{const t=await r.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(s).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"Stream not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/products",async e=>{const{DB:r,CACHE_KV:s}=e.env;try{const t=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${t||"all"}:${a}:${n}`,i=await ps(s,o);if(i)return e.json({success:!0,data:i,cached:!0});let c;t==="true"?c=`
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
      `;const l=(await r.prepare(c).bind(a,n).all()).results||[];return await ms(s,o,l,300),e.json({success:!0,data:l,cached:!1})}catch(t){return console.error("Products list error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/products/popular",async e=>{const{DB:r,CACHE_KV:s}=e.env;try{const t=await ps(s,"products:popular");if(t)return e.json({success:!0,data:t,cached:!0});const n=(await r.prepare(`
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
    `).all()).results||[];return await ms(s,"products:popular",n,600),e.json({success:!0,data:n,cached:!1})}catch(t){return console.error("Popular products error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/search/suggestions",async e=>{const{DB:r}=e.env;try{const s=e.req.query("q")||"";if(!s.trim()||s.length<2)return e.json({success:!0,data:{suggestions:[]}});const t=`%${s}%`,a=await r.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(t).all(),n=await r.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(t,t).all(),o=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(n.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:o}})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/products/search",async e=>{const{DB:r}=e.env;try{const s=e.req.query("q")||"",t=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!s.trim())return e.json({success:!1,error:"Search query is required"},400);const n=`%${s}%`,o=await r.prepare(`
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
    `).bind(n,n,n,t,a).all(),i=await r.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
    `).bind(n,n,n).first();return e.json({success:!0,data:{products:o.results||[],total:(i==null?void 0:i.total)||0,query:s,limit:t,offset:a}})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/products/:id",async e=>{const{DB:r}=e.env,s=e.req.param("id");try{const t=await r.prepare(`
      SELECT 
        p.*,
        COALESCE(s.name, s.username, 'UR Live') as seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ? AND p.is_active = 1
    `).bind(s).first();if(!t)return e.json({success:!1,error:"Product not found"},404);const a=await r.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s).all();return e.json({success:!0,data:{product:t,options:a.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/products/:id/stock",async e=>{const{DB:r}=e.env,s=e.req.param("id");try{const t=await r.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(s).first();return t?e.json({success:!0,data:{productId:t.id,productName:t.name,stock:t.stock,available:t.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/streams/:streamId/products",async e=>{const{DB:r}=e.env,s=e.req.param("streamId");try{const t=await r.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(s).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/cart",B,async e=>{const{DB:r}=e.env,s=e.get("userId");try{const t=await r.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:`장바구니 조회 실패: ${t.message}`},500)}});d.get("/api/cart/:userId",B,async e=>{const{DB:r}=e.env,s=e.get("userId"),t=e.req.param("userId");try{let a=await r.prepare("SELECT id FROM users WHERE id = ?").bind(s).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(t!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await r.prepare(`
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
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/users",async e=>{const{DB:r}=e.env;try{const s=await e.req.json(),{kakaoId:t,name:a,email:n,phone:o}=s;if(!t||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await r.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(t).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await r.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(t,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(s){return console.error("Error creating user:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/cart",async e=>{const{DB:r}=e.env;try{const s=await e.req.json(),{userId:t,kakaoId:a,productId:n,optionId:o,quantity:i,priceSnapshot:c,liveStreamId:u}=s,l=a||t;if(!l)return e.json({success:!1,error:"userId or kakaoId is required"},400);let p=await r.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();if(p||(p=await r.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()),!p)return e.json({success:!1,error:"User not found"},404);const _=p.id,E=await r.prepare("SELECT stock FROM products WHERE id = ?").bind(n).first();if(!E||E.stock<i)return e.json({success:!1,error:"Insufficient stock"},400);const f=await r.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(_,n,o||null,o||null).first();let h;if(f){const g=f.quantity+i;await r.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(g,c,f.id).run(),h=f.id}else h=(await r.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(_,n,o||null,i,c,u||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:h,isUpdate:!!f}})}catch(s){return console.error("[API /api/cart POST] Error:",s),console.error("[API /api/cart POST] Error message:",s.message),console.error("[API /api/cart POST] Error stack:",s.stack),e.json({success:!1,error:"Failed to add to cart: "+(s.message||"Unknown error")},500)}});d.delete("/api/cart/:cartItemId",async e=>{const{DB:r}=e.env,s=e.req.param("cartItemId");try{return await r.prepare("DELETE FROM cart_items WHERE id = ?").bind(s).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/cart/clear/:userId",async e=>{const{DB:r}=e.env,s=e.req.param("userId");try{return await r.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(s).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/cart/:cartItemId",async e=>{const{DB:r}=e.env,s=e.req.param("cartItemId");try{const t=await e.req.json(),{quantity:a}=t;if(!a||a<1)return e.json({success:!1,error:"Invalid quantity"},400);const n=await r.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(s).first();return n?n.stock<a?e.json({success:!1,error:"Insufficient stock"},400):(await r.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,s).run(),e.json({success:!0})):e.json({success:!1,error:"Cart item not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/orders",async e=>{const{DB:r}=e.env;try{const s=await e.req.json(),{userId:t,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:u,recipientPhone:l,deliveryMemo:p,totalAmount:_,shippingFee:E,orderNumber:f,paymentKey:h,paymentMethod:g}=s;if(o&&o.length>0){const I=[];for(const q of o){const pe=await r.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind(q.productId).first();if(!pe)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${q.productId})`},400);if(pe.stock<q.quantity)return e.json({success:!1,error:`재고 부족: ${pe.name} (남은 재고: ${pe.stock}개)`},400);I.push({product_id:q.productId,option_id:q.optionId||null,quantity:q.quantity,price:q.price,product_name:pe.name,product_stock:pe.stock})}const j=Date.now(),x=Math.random().toString(36).substring(2,8).toUpperCase(),L=f||`ORDER_${j}_${x}`,X=c?`${i} ${c}`:i,Ce=(await r.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(L,t||null,_||0,"pending","pending",X||null,u||null,l||null,p||null,h||null).run()).meta.last_row_id;for(const q of I)await r.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ce,q.product_id,q.option_id,q.quantity,q.price,q.product_name).run();return e.json({success:!0,data:{orderId:Ce,orderNumber:L,totalAmount:_}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const w=a.map(()=>"?").join(","),y=await r.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${w})
    `).bind(...a).all();if(y.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const I of y.results)if(I.product_stock<I.quantity)return e.json({success:!1,error:`Insufficient stock for ${I.product_name}`},400);const N=y.results.reduce((I,j)=>I+j.price_snapshot*j.quantity,0),k=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,A=(await r.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(k,t,N,n.address,n.name,n.phone).run()).meta.last_row_id,C=[];for(const I of y.results){let j=!1,x="";for(let L=0;L<3;L++){if((await r.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND stock >= ?
            AND is_active = 1
        `).bind(I.quantity,I.product_id,I.quantity).run()).meta.changes>0){j=!0;break}const Q=await r.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(I.product_id).first();if(!Q||Q.stock<I.quantity){x=`재고 부족: ${I.product_name} (남은 재고: ${(Q==null?void 0:Q.stock)||0}개)`;break}L<2?await new Promise(Ce=>setTimeout(Ce,50*L)):x="주문 처리 중 오류 발생. 다시 시도해주세요. (동시성 충돌)"}if(!j)return e.json({success:!1,error:x||"주문 처리 중 오류가 발생했습니다."},x.includes("재고 부족")?400:409);C.push(r.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(A,I.product_id,I.option_id,I.quantity,I.price_snapshot,I.product_name))}C.push(r.prepare(`DELETE FROM cart_items WHERE id IN (${w})`).bind(...a)),await r.batch(C);try{const I=new Set;for(const j of y.results){const x=await r.prepare("SELECT seller_id FROM products WHERE id = ?").bind(j.product_id).first();x&&x.seller_id&&I.add(x.seller_id)}for(const j of I)await St(r,j,k,buyerName||shippingName||"고객",N)}catch(I){console.error("[Order] Notification error:",I)}return e.json({success:!0,data:{orderId:A,orderNumber:k,totalAmount:N}})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/streams/:streamId/current-product",async e=>{const{DB:r,LIVE_CACHE:s}=e.env,t=e.req.param("streamId");try{const a=`current-product:${t}`,n=await Ys(s,a,3);if(n)return e.json({success:!0,data:n});const o=await r.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(t).first();if(!o||!o.current_product_id)return await Qe(s,a,null,3),e.json({success:!0,data:null});const i=await r.prepare("SELECT * FROM products WHERE id = ?").bind(o.current_product_id).first(),c=await r.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(),u={product:i,options:c.results};return await Qe(s,a,u,3),e.json({success:!0,data:u})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:r}=e.env,s=e.req.param("streamId"),t=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${s}`,n=`current-product:${s}`,o=25e3,i=Date.now();for(;Date.now()-i<o;){const c=await r.get(a)||"0";if(c!==t){const u=await Ys(r,n,30);return e.json({success:!0,timestamp:c,data:u,changed:!0})}await new Promise(u=>setTimeout(u,1e3))}return e.json({success:!0,timestamp:t,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/dashboard/stats",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=s.sellerId,a=e.req.query("period")||"7d";let n=7;a==="30d"?n=30:a==="90d"&&(n=90);const o=await r.prepare(`
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
    `).bind(t,`-${n} days`).all(),i=await r.prepare(`
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
    `).bind(t,`-${n} days`).first(),c=await r.prepare(`
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
    `).bind(t,`-${n} days`).all();return e.json({success:!0,data:{period:a,daily:o.results||[],summary:i||{},topProducts:c.results||[]}})}catch(t){return console.error("Error loading seller dashboard stats:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/analytics/products",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=s.sellerId,a=await r.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(t){return console.error("Error loading product analytics:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/streams",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=s.sellerId,a=await r.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(t){return console.error("Error loading seller streams:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/seller/streams",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:t,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:u,seller_instagram:l,seller_youtube:p,seller_facebook:_}=await e.req.json();let E=n,f="youtube",h=null,g=null,w=i;if(o&&!E&&(E=Xs(o),!E))if(E=Qs(o),h=Zs(o),g=kt(o),E)f="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!w&&E&&f==="youtube"&&(w=`https://img.youtube.com/vi/${E}/maxresdefault.jpg`),!t||!E)return e.json({success:!1,error:"Title and live stream URL are required"},400);const y=await r.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a||null,E,u||"scheduled",c||null,s.sellerId,l||null,p||null,_||null,f,h,g,w||null).run(),N=await r.prepare("SELECT * FROM live_streams WHERE id = ?").bind(y.meta.last_row_id).first(),k=await r.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(s.sellerId).first();try{const{sendLiveStreamCreatedEmail:T}=await Promise.resolve().then(()=>Mt);T({streamId:y.meta.last_row_id,title:t,sellerName:(k==null?void 0:k.display_name)||(k==null?void 0:k.username)||"알 수 없음",platform:f,scheduledAt:c,status:u||"scheduled"}).then(A=>{A.success?console.log(`[Email] Live stream notification sent for stream #${A.meta.last_row_id}`):console.error("[Email] Failed to send notification:",A.error)}).catch(A=>{console.error("[Email] Exception while sending notification:",A)})}catch(T){console.error("[Email] Failed to send live stream notification:",T)}return e.json({success:!0,data:N})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/seller/streams/:id",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id");if(!await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:u,status:l,seller_instagram:p,seller_youtube:_,seller_facebook:E}=await e.req.json(),f=[],h=[];if(n!==void 0&&(f.push("title = ?"),h.push(n)),o!==void 0&&(f.push("description = ?"),h.push(o)),c!==void 0||i!==void 0){let g=i,w="youtube",y=null;if(c&&(g=Xs(c),!g))if(g=Qs(c),y=Zs(c),g)w="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);g!==void 0&&(f.push("youtube_video_id = ?"),h.push(g),f.push("platform = ?"),h.push(w),w==="tiktok"&&y&&(f.push("tiktok_username = ?"),h.push(y)))}return l!==void 0&&(f.push("status = ?"),h.push(l)),u!==void 0&&(f.push("scheduled_at = ?"),h.push(u)),p!==void 0&&(f.push("seller_instagram = ?"),h.push(p)),_!==void 0&&(f.push("seller_youtube = ?"),h.push(_)),E!==void 0&&(f.push("seller_facebook = ?"),h.push(E)),f.length===0?e.json({success:!1,error:"No fields to update"},400):(f.push("updated_at = datetime('now')"),await r.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...h,t).run(),e.json({success:!0}))}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/seller/streams/:id",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id");return await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first()?(await r.prepare("DELETE FROM live_streams WHERE id = ?").bind(t).run(),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/youtube/create-live",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:t,description:a,scheduled_at:n}=await e.req.json();if(!t)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await Ot({accessToken:o},t,a||""),u=(await r.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a||null,i.broadcastId,n||null,s.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await Ve(r,s.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${t} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${u}`),e.json({success:!0,data:{streamId:u,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(t){return console.error("[YouTube Live] Create broadcast error:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("streamId"),a=await r.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const o=a.youtube_broadcast_id||a.youtube_video_id;return o?(await vt({accessToken:n},o),await r.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),await Ve(r,s.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(t){return console.error("[YouTube Live] End broadcast error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("streamId"),a=await r.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=a.youtube_video_id;if(!n)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const o=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!o&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await Nt({apiKey:o,accessToken:i},n);return e.json({success:!0,data:{streamId:t,videoId:n,stats:c}})}catch(t){return console.error("[YouTube Live] Get stats error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("streamId"),a=e.req.query("pageToken"),n=await r.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first();if(!n)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=n.youtube_live_chat_id;if(!o)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await Dt({accessToken:i},o,a);return e.json({success:!0,data:c})}catch(t){return console.error("[YouTube Live] Get chat messages error:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/admin/streams",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:t,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!t)return e.json({success:!1,error:"제목은 필수입니다"},400);const u=o||"youtube";if(u==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(u==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const l=await r.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(t,a||null,n||null,u,i||null,c||"scheduled",s.sellerId||null).run();return e.json({success:!0,data:{id:l.meta.last_row_id,title:t,description:a,youtube_video_id:n,platform:u,tiktok_username:i,status:c||"scheduled"}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/admin/streams/:id",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:u}=await e.req.json();return await r.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,u,t).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1").bind(a,s.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await r.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();await r.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,t).run();const{LIVE_CACHE:c}=e.env,u=`product-timestamp:${t}`,l=`current-product:${t}`,p=Date.now().toString();return await c.put(u,p),await Qe(c,l,{product:o,options:i.results},30),e.json({success:!0,data:{product:o,options:i.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/admin/streams/:id",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id");return await r.prepare("DELETE FROM live_streams WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:r}=e.env,s=e.req.param("streamId");try{const{productId:t}=await e.req.json(),a=await r.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(t).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await r.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(t).all();await r.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(t,s).run();const{LIVE_CACHE:o}=e.env,i=`product-timestamp:${s}`,c=`current-product:${s}`,u=Date.now().toString();return await o.put(i,u),await Qe(o,c,{product:a,options:n.results},30),e.json({success:!0,data:{product:a,options:n.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/wishlists",b(),async e=>{const{DB:r}=e.env;try{const{userId:s,productId:t}=await e.req.json();if(!s||!t)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await r.prepare("SELECT id FROM users WHERE id = ?").bind(s).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const n=await r.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(t).first();if(!n)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await r.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s,t).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await r.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(s,t).run();return e.json({success:!0,data:{id:i.meta.last_row_id,userId:s,productId:t,productName:n.name}})}catch(s){return console.error("[Wishlist] Add error:",s),e.json({success:!1,error:s.message},500)}});d.delete("/api/wishlists/:id",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.param("id"),{userId:t}=e.req.query();return t?await r.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(s,t).first()?(await r.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(s,t).run(),e.json({success:!0,message:"찜 목록에서 삭제되었습니다."})):e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(s){return console.error("[Wishlist] Delete error:",s),e.json({success:!1,error:s.message},500)}});d.delete("/api/wishlists/product/:productId",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.param("productId"),{userId:t}=e.req.query();return t?(await r.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,s).run()).meta.changes===0?e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!0,message:"찜 목록에서 삭제되었습니다."}):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(s){return console.error("[Wishlist] Delete by product error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/wishlists/:userId",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.param("userId"),t=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0"),{results:n}=await r.prepare(`
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
    `).bind(s,t,a).all(),o=await r.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(s).first();return e.json({success:!0,data:{items:n,total:(o==null?void 0:o.count)||0,limit:t,offset:a}})}catch(s){return console.error("[Wishlist] Get error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/wishlists/check/:userId/:productId",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.param("userId"),t=e.req.param("productId"),a=await r.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s,t).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(s){return console.error("[Wishlist] Check error:",s),e.json({success:!1,error:s.message},500)}});d.delete("/api/shipping-addresses/:id",B,async e=>{const{DB:r}=e.env,s=e.req.param("id");e.get("userId");try{return await r.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(s,userId).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/products",async e=>{const{DB:r,CACHE_KV:s}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const a=`seller:${t.sellerId}:products`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await r.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(t.sellerId).all();return await s.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/seller/upload-image",async e=>{var t;const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{image:a,filename:n}=await e.req.json();if(!a)return e.json({success:!1,error:"Image data is required"},400);const o=e.env.IMAGES;if(o){console.log("[Image Upload] Using R2 storage");const i=a.replace(/^data:image\/\w+;base64,/,""),c=Uint8Array.from(atob(i),_=>_.charCodeAt(0)),u=(n==null?void 0:n.split(".").pop())||"jpg",l=`products/${s.sellerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${u}`;await o.put(l,c,{httpMetadata:{contentType:((t=a.match(/^data:(image\/\w+);base64,/))==null?void 0:t[1])||"image/jpeg"}});const p=`/api/images/${l}`;return e.json({success:!0,url:p,storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),a.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:a,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(a){return console.error("[Image Upload] Error:",a),e.json({success:!1,error:a.message},500)}});d.get("/api/images/*",async e=>{var r;try{const s=e.env.IMAGES;if(!s)return e.json({success:!1,error:"R2 not configured"},503);const t=e.req.path.replace("/api/images/",""),a=await s.get(t);return a?new Response(a.body,{headers:{"Content-Type":((r=a.httpMetadata)==null?void 0:r.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"}}):e.notFound()}catch(s){return console.error("[Image Get] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/products",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{name:t,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:u,category:l,live_stream_id:p,is_active:_}=await e.req.json();if(!t||!n)return e.json({success:!1,error:"Name and price are required"},400);if(p&&!await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(p,s.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const E=await r.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a||null,n,o||null,i||0,c||null,u||0,l||null,p||null,s.sellerId,_!==void 0?_:1).run(),f=await r.prepare("SELECT * FROM products WHERE id = ?").bind(E.meta.last_row_id).first();return await _s(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0,data:f})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/products/:id",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),a=await r.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(t,s.sellerId).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/seller/products/:id",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id");if(!await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:u,stock:l,category:p,is_active:_}=await e.req.json(),E=[],f=[];if(n!==void 0&&(E.push("name = ?"),f.push(n)),o!==void 0&&(E.push("description = ?"),f.push(o)),i!==void 0&&(E.push("price = ?"),f.push(i)),c!==void 0&&(E.push("original_price = ?"),f.push(c),i!==void 0&&c)){const g=Math.round((c-i)/c*100);E.push("discount_rate = ?"),f.push(g)}if(u!==void 0&&(E.push("image_url = ?"),f.push(u)),l!==void 0&&(E.push("stock = ?"),f.push(l)),p!==void 0&&(E.push("category = ?"),f.push(p)),_!==void 0&&(E.push("is_active = ?"),f.push(_?1:0)),E.push("updated_at = CURRENT_TIMESTAMP"),f.push(t,s.sellerId),E.length===1)return e.json({success:!1,error:"No fields to update"},400);await r.prepare(`UPDATE products SET ${E.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...f).run();const h=await r.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();return await _s(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0,data:h})}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/seller/products/:id",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id");if(!await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await r.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(t).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await r.prepare("DELETE FROM product_options WHERE product_id = ?").bind(t).run(),await r.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(t).run(),await r.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(t).run(),await r.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).run(),await _s(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0}))}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/products/:id/options",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id");if(!await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await r.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(t).all();return e.json({success:!0,data:n.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/products/:id/options",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id");if(!await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const u=await r.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(t,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:u.meta.last_row_id,product_id:t,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("productId"),a=e.req.param("optionId");return await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,s.sellerId).first()?(await r.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,t).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/stats",async e=>{const{DB:r,CACHE_KV:s}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const a=`seller:${t.sellerId}:stats`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await r.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(t.sellerId).first(),i=await r.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(t.sellerId).first(),c=await r.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(t.sellerId).first(),u=await r.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(t.sellerId).first(),l=await r.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(t.sellerId).first(),_={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:u.count||0,totalRevenue:u.total||0,activeStreams:l.count||0,totalViewers:0};return await s.put(a,JSON.stringify(_),{expirationTtl:60}),e.json({success:!0,data:_})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/stats/sales",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.query("period")||"daily";let a,n,o;switch(t){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await r.prepare(`
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
    `).bind(s.sellerId).all();return e.json({success:!0,data:{period:t,sales:i.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/stats/products",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await r.prepare(`
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
    `).bind(s.sellerId,t).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/business-info",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{business_number:t,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:u,phone:l,email:p}=await e.req.json();if(!t||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const _=await r.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();let E;return _?E=await r.prepare(`
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
      `).bind(t,a,n,o,i,c,u,l,p,s.sellerId).run():E=await r.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(s.sellerId,t,a,n,o,i,c,u,l,p).run(),e.json({success:!0,data:{id:_?_.id:E.meta.last_row_id,seller_id:s.sellerId,business_number:t,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(t){return console.error("사업자 정보 등록 오류:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/business-info",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=await r.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);const t=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await r.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(t).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await r.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(t).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});d.get("/api/admin/seller-business",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=await r.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:t.results||[]})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/orders",B,async e=>{const{DB:r}=e.env,s=e.get("userId");try{const t=await r.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(s).all(),a=await Promise.all(t.results.map(async n=>{const o=await r.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(n.id).all();return{...n,items:o.results}}));return e.json({success:!0,data:a})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/orders/user/:userId",B,async e=>{const{DB:r}=e.env,s=e.get("userId"),t=parseInt(e.req.param("userId"));try{if(t!==s)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await r.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(s).all(),n=await Promise.all(a.results.map(async o=>{const i=await r.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(o.id).all();return{...o,items:i.results}}));return e.json({success:!0,data:n})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/orders/:orderNumber",async e=>{const{DB:r}=e.env,s=e.req.param("orderNumber");try{const t=await r.prepare("SELECT * FROM orders WHERE order_number = ?").bind(s).first();if(!t)return e.json({success:!1,error:"Order not found"},404);const a=await r.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(t.id).all();return e.json({success:!0,data:{...t,items:a.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/orders/:orderId/cancel",async e=>{const{DB:r}=e.env,s=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await r.prepare("SELECT * FROM orders WHERE id = ?").bind(s).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await r.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(s).all();for(const i of o.results)await r.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.quantity,i.product_id).run();return await r.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,s).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:s,reason:a,itemsRestored:o.results.length}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:r}=e.env;try{const s=e.req.param("streamId"),t=await r.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(s).first();return t?e.json({success:!0,data:{viewer_count:t.viewer_count||0}}):e.json({success:!1,error:"Stream not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.put("/api/streams/:streamId/viewer-count",async e=>{const{DB:r}=e.env,s=await M(e),t=s.success?{success:!1}:await v(e);if(!s.success&&!t.success)return e.json({success:!1,error:"Unauthorized"},401);try{const a=e.req.param("streamId"),{viewer_count:n}=await e.req.json();return typeof n!="number"||n<0?e.json({success:!1,error:"Invalid viewer count"},400):t.success&&!await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a,t.sellerId).first()?e.json({success:!1,error:"Stream not found or unauthorized"},404):(await r.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{viewer_count:n}}))}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/streams/:streamId/view",async e=>{const{DB:r}=e.env;try{const s=e.req.param("streamId");await r.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(s).run();const t=await r.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(s).first();return e.json({success:!0,data:{viewer_count:(t==null?void 0:t.viewer_count)||0}})}catch(s){return e.json({success:!1,error:s.message},500)}});d.post("/api/payments/confirm",async e=>{var t;const{DB:r}=e.env;let s=null;try{s=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=s;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!n,amount:!!o}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await r.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",n),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:n},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(o)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(o),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(o),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const u="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const l={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(l,null,2)),console.log("[Payment] 📊 amount 타입:",typeof l.amount),console.log("[Payment] 📊 amount 값:",l.amount);const p=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:u,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(l)}),_=await p.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",p.status),console.log("  - 응답 OK?:",p.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(_).substring(0,300)),!p.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",p.status),console.error("[Payment] 에러 코드:",_.code),console.error("[Payment] 에러 메시지:",_.message),console.error("[Payment] 전체 응답:",JSON.stringify(_,null,2)),e.json({success:!1,error:_.message||"결제 승인에 실패했습니다.",code:_.code,tossError:_},p.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await r.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const E=await r.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();for(const f of E.results)(await r.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(f.quantity,f.product_id,f.quantity).run()).meta.changes===0&&console.error(`[Payment] ⚠️ 재고 부족: product_id=${f.product_id}`);console.log("[Payment] ✅ 재고 차감 완료");try{const f=i.id,h=await yt(e.env,f);h.success?console.log(`[Payment] ✅ 알림톡 발송 성공 (주문 ${f})`):console.warn(`[Payment] ⚠️ 알림톡 발송 실패 (주문 ${f}):`,h.reason||h.error)}catch(f){console.error("[Payment] ⚠️ 알림톡 발송 중 오류:",f)}}catch(E){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",E)}return e.json({success:!0,data:_})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:s==null?void 0:s.orderId,error:a.message,stack:(t=a.stack)==null?void 0:t.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});d.post("/api/chat/:liveStreamId/messages",b(),async e=>{const{DB:r}=e.env,s=e.req.param("liveStreamId");try{const t=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:u}=t;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await r.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(s,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const l=["씨발","개새끼","병신","좆","시발"];let p=i;l.forEach(E=>{const f=new RegExp(E,"gi");p=p.replace(f,"*".repeat(E.length))});const _=await r.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(s,a||null,n,o||null,p,c?1:0,u?1:0).run();return e.json({success:!0,data:{id:_.meta.last_row_id,message:p}})}catch(t){return console.error("Error sending chat message:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/chat/:liveStreamId/messages",b(),async e=>{const{DB:r}=e.env,s=e.req.param("liveStreamId"),t=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
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
    `;const o=[s];t&&(n+=" AND id > ?",o.push(Number(t))),n+=" ORDER BY created_at DESC LIMIT ?",o.push(a);const c=(await r.prepare(n).bind(...o).all()).results.reverse();return e.json({success:!0,data:c})}catch(n){return console.error("Error fetching chat messages:",n),e.json({success:!1,error:n.message},500)}});d.delete("/api/chat/:liveStreamId/messages/:messageId",b(),async e=>{const{DB:r}=e.env,s=e.req.param("messageId");try{return await r.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(s).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(t){return console.error("Error deleting chat message:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/chat/:liveStreamId/ban",b(),async e=>{const{DB:r}=e.env,s=e.req.param("liveStreamId");try{const t=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=t;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const u=new Date;u.setMinutes(u.getMinutes()+i),c=u.toISOString()}return await r.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(s,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(t){return console.error("Error banning user:",t),e.json({success:!1,error:t.message},500)}});d.delete("/api/chat/:liveStreamId/ban/:userId",b(),async e=>{const{DB:r}=e.env,s=e.req.param("liveStreamId"),t=e.req.param("userId");try{return await r.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(s,t).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});d.post("/api/payments/webhook",async e=>{const{DB:r}=e.env;try{const s=await e.req.json();switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:s.eventType,orderId:s.orderId,status:s.status,timestamp:new Date().toISOString()}),s.eventType){case"PAYMENT_STATUS_CHANGED":await jt(r,s);break;case"VIRTUAL_ACCOUNT_ISSUED":await At(r,s);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",s.eventType)}return e.json({success:!0})}catch(s){return console.error("[Webhook] ❌ 웹훅 처리 실패:",s.message),e.json({success:!1,error:s.message},500)}});async function jt(e,r){const{orderId:s,status:t,paymentKey:a}=r;console.log("[Webhook] 결제 상태 변경:",{orderId:s,status:t}),await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(t,JSON.stringify(r),a).run(),(t==="DONE"||t==="completed")&&(await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(s).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",s))}async function At(e,r){const{orderId:s,virtualAccount:t}=r;console.log("[Webhook] 가상계좌 발급:",{orderId:s,bank:t==null?void 0:t.bank,accountNumber:t==null?void 0:t.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(t==null?void 0:t.bank,t==null?void 0:t.accountNumber,t==null?void 0:t.customerName,t==null?void 0:t.dueDate,JSON.stringify(r),s).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",s)}d.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:r}=e.env;try{const s=e.req.param("paymentKey"),t=await e.req.json(),{cancelReason:a,cancelAmount:n}=t;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:s,cancelReason:a,cancelAmount:n}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const o=await r.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(s).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const u=Tt(i,c),l=n&&n<o.amount,p=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:s,cancelAmount:p,isPartial:l});const _=await u.cancelPayment({paymentKey:s,cancelReason:a,cancelAmount:p});return _.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:s,cancelAmount:p,canceledAt:_.canceledAt}),await r.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED",_.canceledAt||new Date().toISOString(),JSON.stringify(_),s).run(),await r.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${s}`),e.json({success:!0,data:{paymentKey:s,orderId:o.order_id,cancelAmount:p,canceledAt:_.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,_.error),e.json({success:!1,error:_.error||"결제 취소에 실패했습니다."},400))}catch(s){return console.error("[Payment] ❌ 결제 취소 처리 실패:",s.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});d.get("/api/payments/:paymentKey",async e=>{const{DB:r}=e.env;try{const s=e.req.param("paymentKey"),t=await r.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(s).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404)}catch(s){return console.error("[Payment] ❌ 결제 조회 실패:",s.message),e.json({success:!1,error:"결제 조회 중 오류가 발생했습니다."},500)}});d.get("/api/payments/order/:orderId",async e=>{const{DB:r}=e.env;try{const s=e.req.param("orderId"),t=await r.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(s).all();return e.json({success:!0,data:t.results||[]})}catch(s){return console.error("[Payment] ❌ 결제 목록 조회 실패:",s.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});d.get("/api/seller/orders",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=await r.prepare(`
      SELECT DISTINCT o.*, u.name as user_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC
    `).bind(s.sellerId).all(),a=await Promise.all(t.results.map(async n=>{const o=await r.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ? AND oi.seller_id = ?
        `).bind(n.id,s.sellerId).all();return{...n,items:o.results}}));return e.json({success:!0,data:a})}catch(t){return e.json({success:!1,error:t.message},500)}});d.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await r.prepare("SELECT id FROM orders WHERE order_number = ?").bind(t).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await r.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,s.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await r.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,t).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${t}, 자동 발행 시작...`);const c=await r.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(t).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const u=await r.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(s.sellerId).first();if(!u)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${s.sellerId}`),await r.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(t,s.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${t}`);const l=await r.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),p=Number(c.total_amount),_=Math.floor(p/1.1),E=p-_,f=new Date().toISOString().split("T")[0].replace(/-/g,""),h=Math.random().toString(36).substring(2,8).toUpperCase(),g=`${f}-${h}`,y=(await r.prepare(`
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
            `).bind(s.sellerId,t,g,u.business_number,u.business_name,u.ceo_name,u.address||"",u.business_type||"",u.business_category||"",u.email||"",u.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",_,E,p,`AUTO-${Date.now()}-${h}`).run()).meta.last_row_id;for(const N of l.results){const k=Math.floor(Number(N.price)*Number(N.quantity)/1.1),T=Number(N.price)*Number(N.quantity)-k;await r.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(y,N.product_name||"상품명 없음",N.quantity,N.price,k,T,N.option_name||"").run()}await r.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(t,s.sellerId,y).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${y}, invoice_number=${g}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${t}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await r.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(t,s.sellerId,c.message).run()}catch(u){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",u)}}try{const c=await r.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(t).first();if(c&&c.user_id){const l={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];l&&await Gs(r,c.user_id,t,l)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await r.prepare("SELECT id FROM orders WHERE order_number = ?").bind(t).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await r.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,s.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await r.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,t).run();try{const c=await r.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(t).first();c&&c.user_id&&await Gs(r,c.user_id,t,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/orders/:orderNumber/refund",async e=>{const{DB:r}=e.env,s=e.req.param("orderNumber"),{reason:t}=await e.req.json();try{const a=await r.prepare("SELECT * FROM orders WHERE order_number = ?").bind(s).first();return a?["paid","preparing","shipped","delivered"].includes(a.status)?a.status==="refunded"||a.status==="cancelled"?e.json({success:!1,error:"이미 환불 또는 취소된 주문입니다."},400):(await r.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded",s).run(),e.json({success:!0,message:"환불 요청이 접수되었습니다. 고객센터(0507-0177-0432)에서 처리 예정입니다.",requiresManualProcessing:!0})):e.json({success:!1,error:"환불이 불가능한 주문 상태입니다."},400):e.json({success:!1,error:"Order not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/admin/orders",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=await r.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/sellers",async e=>{const{DB:r}=e.env,{limit:s="20",offset:t="0"}=e.req.query();try{const a=`
      SELECT id, business_name, name as display_name, 
             commission_rate, created_at
      FROM sellers 
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,{results:n}=await r.prepare(a).bind(parseInt(s),parseInt(t)).all();return e.json({success:!0,data:n})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});d.get("/api/admin/sellers",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=await r.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/admin/sellers",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{username:t,password:a,name:n,email:o,phone:i,business_name:c,business_number:u}=await e.req.json();if(!t||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await r.prepare("SELECT id FROM sellers WHERE username = ?").bind(t).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await r.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const _=`$2a$10$placeholder_hash_for_${a}`,E=await r.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(t,_,n,o,i||null,c,u||null,s.adminId).run();return e.json({success:!0,data:{id:E.meta.last_row_id,username:t,name:n,email:o,business_name:c}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/admin/sellers/:id",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:u,status:l}=await e.req.json();return await r.prepare("SELECT id FROM sellers WHERE id = ?").bind(t).first()?(await r.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,u,l,t).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/admin/sellers/:id",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),a=await r.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(t).first();return a?(await r.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),await r.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(t).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await r.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(t).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await r.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,t).run(),await r.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(t).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(t){return e.json({success:!1,error:t.message},500)}});d.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await r.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(t).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await r.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,t).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${t}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:t,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(t){return console.error("수수료율 변경 실패:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),a=await r.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(t).first();return a?a.status==="approved"?e.json({success:!1,error:"이미 승인된 판매자입니다"},400):(await r.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(s.adminId,t).run(),console.log(`셀러 승인: ${a.username} (ID: ${t}) by Admin ID: ${s.adminId}`),e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:t,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 승인 실패:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await r.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(t).first();return n?n.status==="rejected"?e.json({success:!1,error:"이미 거부된 판매자입니다"},400):(await r.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,s.adminId,t).run(),console.log(`셀러 거부: ${n.username} (ID: ${t}), 사유: ${a}`),e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:t,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 거부 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/sellers/pending",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=await r.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:t.results,count:t.results.length})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/public/seller/:sellerId",async e=>{const{DB:r,CACHE_KV:s}=e.env;try{const t=e.req.param("sellerId"),a=`public:seller:${t}`,n=await ps(s,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await r.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(t).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=await r.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(t).all(),c=await r.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(t).all(),u=await r.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(t).all(),l=await r.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(t).first(),p={profile:o,live_streams:i.results,scheduled_streams:c.results,products:u.results,stats:l};return await ms(s,a,p,60),e.json({success:!0,data:p})}catch(t){return console.error("셀러 프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/public/seller/username/:username",async e=>{const{DB:r}=e.env;try{const s=e.req.param("username"),t=await r.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(s).first();return t?e.json({success:!0,data:{seller_id:t.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 조회 실패:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/admin/settlement/stats",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{period:t}=e.req.query();let a="";const n=new Date;switch(t){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await r.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as total_seller_amount
      FROM orders o
      WHERE payment_status = 'completed' 
        AND is_cancelled = 0
        ${a}
    `).first(),i=await r.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:t||"all"}})}catch(t){return console.error("정산 통계 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/settlement/records",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{seller_id:t,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];t&&(o.push("o.seller_id = ?"),i.push(t)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const p=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${p}'`);break;case"week":const _=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${_}'`);break;case"month":const E=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${E}'`);break}const u=o.length>0?`WHERE ${o.join(" AND ")}`:"",l=await r.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:l.results})}catch(t){return console.error("정산 내역 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await r.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(t).first();return n?(await r.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,t).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:t,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(t){return console.error("정산 상태 변경 실패:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/admin/settlement/batch-complete",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{order_ids:t}=await e.req.json();if(!Array.isArray(t)||t.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of t)try{await r.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:t.length,success:a,failed:n}})}catch(t){return console.error("일괄 정산 처리 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/settlement/export-csv",async e=>{const{DB:r}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{seller_id:t,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];t&&(n.push("o.seller_id = ?"),o.push(t));const i=new Date;switch(a){case"today":const f=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${f}'`);break;case"week":const h=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${h}'`);break;case"month":const g=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${g}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",l=(await r.prepare(`
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
    `).bind(...o).all()).results;if(l.length===0)return e.json({success:!1,error:"데이터가 없습니다"},404);const p=Object.keys(l[0]);let _=p.join(",")+`
`;l.forEach(f=>{const h=p.map(g=>{const w=f[g];if(w==null)return"";const y=String(w);return y.includes(",")||y.includes('"')||y.includes(`
`)?`"${y.replace(/"/g,'""')}"`:y});_+=h.join(",")+`
`});const E="\uFEFF";return new Response(E+_,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(t){return console.error("CSV 내보내기 실패:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/orders/create",async e=>{const{DB:r}=e.env;try{const{userId:s,cartItems:t,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:u,buyerCeoName:l}=await e.req.json();console.log("주문 생성 요청:",{userId:s,cartItems:t==null?void 0:t.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let p=10;if(o){const T=await r.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();T&&T.commission_rate!==null&&(p=T.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:p});const _=Math.floor(a*(p/100)),E=a-_;let f=null;if(n){const T=await r.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(n,s).first();if(!T)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);f=T}if(!s)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const h=s,g=Date.now(),w=Math.random().toString(36).substring(2,8).toUpperCase(),y=`ORDER_${g}_${w}`;for(const T of t){const A=await r.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(T.product_id).first();if(!A)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${T.product_id})`},400);if(A.stock<T.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${T.product_id})`},400)}const k=(await r.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(y,h,a,"pending",o||null,p,_,E,n||null,(f==null?void 0:f.recipient_name)||null,(f==null?void 0:f.phone)||null,f!=null&&f.address?`${f.address} ${f.address_detail}`:null,(f==null?void 0:f.postal_code)||null,i?1:0,c||null,u||null,l||null).run()).meta.last_row_id;for(const T of t){await r.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(k,T.product_id,T.option_id||null,T.quantity,T.price_snapshot||T.price).run(),await r.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(T.quantity,T.product_id).run();try{const A=await r.prepare(`
          SELECT id, name, stock, stock_alert_threshold, seller_id 
          FROM products 
          WHERE id = ?
        `).bind(T.product_id).first();if(A){const C=A.stock_alert_threshold||5,I=A.stock;I<=C&&A.seller_id&&(await Rt(r,A.seller_id,A.name,I,C),console.log(`[Low Stock Alert] ${A.name}: ${I} <= ${C}`))}}catch(A){console.error("[Low Stock Alert] Error:",A)}}return console.log("주문 생성 완료:",{orderId:k,orderNumber:y}),e.json({success:!0,orderId:k,orderNumber:y,totalAmount:a})}catch(s){return console.error("주문 생성 실패:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/orders/:orderNumber/refund",b(),async e=>{const{DB:r}=e.env;try{const s=e.req.param("orderNumber"),{reason:t}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:s,reason:t});const a=await r.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(s).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다"},404);if(a.payment_status==="cancelled")return e.json({success:!1,error:"이미 취소된 주문입니다"},400);await r.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(t||"구매자 요청",s).run(),console.log("[Order Refund] 주문 상태 업데이트 완료:",s);const n=await r.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();for(const o of n.results)await r.prepare(`
        UPDATE products 
        SET stock = stock + ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(o.quantity,o.product_id).run(),console.log("[Order Refund] 재고 복구:",{productId:o.product_id,quantity:o.quantity});return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:s,reason:t}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:s,cancelDate:new Date().toISOString()}})}catch(s){return console.error("[Order Refund] Error:",s),e.json({success:!1,error:s.message||"주문 취소 중 오류가 발생했습니다"},500)}});d.get("/api/seller/sales",b(),async e=>{try{const{DB:r}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const t=await Ae(e.env.SESSION_KV,s);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(t.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=t.seller_id||t.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await r.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();if(!u)return e.json({success:!1,error:"셀러를 찾을 수 없습니다."},404);const l=await r.prepare(`
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
    `).bind(a,i,c).first(),p=await r.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:u,stats:l,orders:(p==null?void 0:p.results)||[]}})}catch(r){return console.error("Seller sales query error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/settlement-csv",b(),async e=>{try{const{DB:r}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const t=await Ae(e.env.SESSION_KV,s);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(t.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=t.seller_id||t.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await r.prepare(`
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
`;for(const p of(u==null?void 0:u.results)||[]){const _=p.status==="delivered"?"배송완료":p.status==="shipped"?"배송중":p.status==="preparing"?"상품준비중":p.status==="paid"?"결제완료":"대기중",E=p.buyer_business_name||"-",f=p.buyer_business_number||"-",h=p.invoice_number||"-",g=p.issue_date||"-",w=p.tax_invoice_status==="issued"?"발행완료":p.tax_invoice_status==="cancelled"?"취소":"-",y=p.nts_confirm_number||"-";l+=`${p.order_number},${p.created_at},${p.user_name||"익명"},${p.total_amount},${p.commission_amount},${p.seller_amount},${_},${E},${f},${h},${g},${w},${y}
`}return new Response(l,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(r){return console.error("CSV download error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/tax-invoices/issue",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{order_number:t}=await e.req.json();if(!t)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await r.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(t).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!a.issue_tax_invoice)return e.json({success:!1,error:"세금계산서 발행이 요청되지 않은 주문입니다."},400);const n=await r.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(s.sellerId).first();if(!n)return e.json({success:!1,error:"승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요."},400);const o=await r.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),u=i-c,l=new Date().toISOString().split("T")[0],p=`${l}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,_=Gr(n,a,o.results);let E,f,h;try{E=await zr(_),f=E.ntsConfirmNumber,h=E.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:f,invoiceKey:h,mockMode:Me()})}catch(y){console.error("바로빌 API 호출 실패:",y),f="FAILED",h=null}const w=(await r.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s.sellerId,t,"tax",p,l,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,u,i,f==="FAILED"?"failed":"issued",Me()?"mock":"barobill",h,f).run()).meta.last_row_id;for(const y of o.results){const N=Math.floor(Number(y.price)*Number(y.quantity)/1.1),k=Number(y.price)*Number(y.quantity)-N;await r.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(w,y.id,y.product_name,y.quantity,y.price,N,k).run()}return e.json({success:!0,data:{invoice_id:w,invoice_number:p,issue_date:l,total_amount:i,supply_price:c,tax_amount:u,status:f==="FAILED"?"failed":"issued",nts_confirm_number:f,api_invoice_key:h,mock_mode:Me(),message:f==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":Me()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(t){return console.error("세금계산서 발행 오류:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/tax-invoices",async e=>{var t;const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[s.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const u=await r.prepare(i).bind(...c).all();return e.json({success:!0,data:u.results||[],total:((t=u.results)==null?void 0:t.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/tax-invoices/:id",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),a=await r.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(t,s.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await r.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(t).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("id"),{reason:a}=await e.req.json(),n=await r.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(t,s.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!Me()){const u=await r.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(s.sellerId).first();u&&u.business_number&&await Jr(u.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(u){console.error("바로빌 취소 API 호출 실패:",u)}return await r.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{status:t,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[s.sellerId];t&&(n+=" AND log.status = ?",o.push(t)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await r.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const t=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${t}`);const a=await r.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(t,s.sellerId).first();if(!a)return e.json({success:!1,error:"재시도할 실패 로그를 찾을 수 없습니다."},404);const n=Number(a.retry_count||0);if(n>=3)return e.json({success:!1,error:"최대 재시도 횟수(3회)를 초과했습니다."},400);const o=await r.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(t).first();if(!o)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!o.buyer_business_number||!o.buyer_business_name)return e.json({success:!1,error:"주문에 사업자 정보가 없습니다."},400);const i=await r.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(s.sellerId).first();if(!i)return e.json({success:!1,error:"판매자 사업자 정보가 승인되지 않았습니다."},400);const c=await r.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(),u=Number(o.total_amount),l=Math.floor(u/1.1),p=u-l,_=new Date().toISOString().split("T")[0].replace(/-/g,""),E=Math.random().toString(36).substring(2,8).toUpperCase(),f=`${_}-${E}`,g=(await r.prepare(`
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
    `).bind(s.sellerId,t,f,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",l,p,u,`RETRY-${Date.now()}-${E}`).run()).meta.last_row_id;for(const w of c.results){const y=Math.floor(Number(w.price)*Number(w.quantity)/1.1),N=Number(w.price)*Number(w.quantity)-y;await r.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(g,w.product_name||"상품명 없음",w.quantity,w.price,y,N,w.option_name||"").run()}return await r.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(t,s.sellerId,g,n+1).run(),await r.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${g}, retry_count=${n+1}`),e.json({success:!0,data:{invoice_id:g,invoice_number:f,retry_count:n+1}})}catch(t){console.error("[TAX INVOICE RETRY] 재시도 실패:",t);try{const a=e.req.param("orderNumber"),n=await r.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,s.sellerId).first(),o=Number((n==null?void 0:n.retry_count)||0);await r.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,s.sellerId,t.message,o+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:t.message},500)}});d.get("/live/:id",async e=>{try{const r=new URL("/static/live.html",e.req.url);let t=await(await fetch(r.toString())).text();const n=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return t=t.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${n}`),console.log("[Live Page] Environment variables injected"),new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(r){return console.error("Error serving live page:",r),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/cart",async e=>{try{const r=new URL("/static/cart.html",e.req.url);let t=await(await fetch(r.toString())).text();return t=t.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),t=t.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(r){return console.error("Error serving cart page:",r),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/my-orders",async e=>{try{const r=new URL("/static/my-orders.html",e.req.url),t=await(await fetch(r.toString())).text();return new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(r){return console.error("Error serving my orders page:",r),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/payment-result",async e=>{try{const r=new URL("/payment-result.html",e.req.url),t=await(await fetch(r.toString())).text();return new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(r){return console.error("Error serving payment result page:",r),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/api/seller/profile",async e=>{const{DB:r}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const t=await r.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(s).first();if(!t||!t.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await r.prepare(`
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
    `).bind(t.seller_id).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404)}catch(t){return console.error("프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/seller/profile",async e=>{const{DB:r}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const t=await r.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(s).first();if(!t||!t.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:u,website_url:l,kakao_chat_link:p}=await e.req.json(),_=[],E=[];if(a!==void 0&&(_.push("profile_image = ?"),E.push(a)),n!==void 0&&(_.push("bio = ?"),E.push(n)),o!==void 0&&(_.push("sns_instagram = ?"),E.push(o)),i!==void 0&&(_.push("sns_youtube = ?"),E.push(i)),c!==void 0&&(_.push("sns_facebook = ?"),E.push(c)),u!==void 0&&(_.push("sns_twitter = ?"),E.push(u)),l!==void 0&&(_.push("website_url = ?"),E.push(l)),p!==void 0&&(_.push("kakao_chat_link = ?"),E.push(p)),_.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);_.push("updated_at = datetime('now')"),E.push(t.seller_id),await r.prepare(`
      UPDATE sellers 
      SET ${_.join(", ")}
      WHERE id = ?
    `).bind(...E).run();const f=await r.prepare(`
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
    `).bind(t.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:f})}catch(t){return console.error("프로필 업데이트 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/public/:sellerId",async e=>{const{DB:r}=e.env,s=e.req.param("sellerId");try{const t=await r.prepare(`
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
    `).bind(s).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/:sellerId/streams",async e=>{const{DB:r}=e.env,s=e.req.param("sellerId");try{const t=await r.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:t.results})}catch(t){return console.error("라이브 목록 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/:sellerId/products-public",async e=>{const{DB:r}=e.env,s=e.req.param("sellerId");try{const t=await r.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:t.results})}catch(t){return console.error("상품 목록 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/notifications",B,async e=>{const{DB:r}=e.env;try{const s=e.get("userId"),t=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),n=e.req.query("unread_only")==="true";let o=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;n&&(o+=" AND is_read = 0"),o+=" ORDER BY created_at DESC LIMIT ?";const i=await r.prepare(o).bind(s,t,a).all();return e.json({success:!0,data:i.results})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/notifications/unread-count",B,async e=>{const{DB:r}=e.env;try{const s=e.get("userId"),t=e.get("userType"),a=await r.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(s,t).first();return e.json({success:!0,count:(a==null?void 0:a.count)||0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.put("/api/notifications/:id/read",B,async e=>{const{DB:r}=e.env;try{const s=e.req.param("id"),t=e.get("userId"),a=e.get("userType");return await r.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s,t,a).first()?(await r.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.put("/api/notifications/read-all",B,async e=>{const{DB:r}=e.env;try{const s=e.get("userId"),t=e.get("userType");return await r.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(s,t).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.delete("/api/notifications/:id",B,async e=>{const{DB:r}=e.env;try{const s=e.req.param("id"),t=e.get("userId"),a=e.get("userType");return await r.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s,t,a).first()?(await r.prepare("DELETE FROM notifications WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/banners",async e=>{const{DB:r}=e.env;try{const s=new Date().toISOString(),t=await r.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(s,s).all();return e.json({success:!0,data:t.results})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/admin/banners",B,async e=>{const{DB:r}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=await r.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(s){return e.json({success:!1,error:s.message},500)}});d.post("/api/admin/banners",B,async e=>{const{DB:r}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:t,image_url:a,link_url:n,description:o,is_active:i,display_order:c,start_date:u,end_date:l}=await e.req.json();if(!t||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const p=await r.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a,n||null,o||null,i!==!1?1:0,c||0,u||null,l||null).run();return e.json({success:!0,id:p.meta.last_row_id})}catch(s){return e.json({success:!1,error:s.message},500)}});d.put("/api/admin/banners/:id",B,async e=>{const{DB:r}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=e.req.param("id"),{title:a,image_url:n,link_url:o,description:i,is_active:c,display_order:u,start_date:l,end_date:p}=await e.req.json();return await r.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,n,o||null,i||null,c?1:0,u||0,l||null,p||null,t).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.delete("/api/admin/banners/:id",B,async e=>{const{DB:r}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=e.req.param("id");return await r.prepare("DELETE FROM banners WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/order-complete",e=>e.redirect("/order-complete.html",302));d.notFound(e=>{const r=e.req.path;return r.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${r} was not found.`},404):new Response(null,{status:404})});d.onError((e,r)=>{const s=r.req.path;if(console.error("[Global Error Handler]",{path:s,method:r.req.method,error:e.message,stack:e.stack}),s.startsWith("/api/")){let t=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(t=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(t=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(t=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(t=400,a="잘못된 요청입니다."),r.json({success:!1,error:e.message||a},t)}return r.html(`
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
  `,500)});d.get("/api/admin/alimtalk/pricing",b(),async e=>{const{env:r}=e;try{const s=await r.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:s.results})}catch(s){return console.error("[Admin Alimtalk Pricing] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/admin/alimtalk/pricing",b(),async e=>{const{env:r}=e;try{const{plan_name:s,min_quantity:t,max_quantity:a,unit_price:n}=await e.req.json();if(!s||!t||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await r.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(s,t,a||null,n).run();return e.json({success:!0,pricing_id:o.meta.last_row_id})}catch(s){return console.error("[Admin Alimtalk Pricing Create] Error:",s),e.json({success:!1,error:s.message},500)}});d.put("/api/admin/alimtalk/pricing/:id",b(),async e=>{const{env:r}=e,s=e.req.param("id");try{const{plan_name:t,min_quantity:a,max_quantity:n,unit_price:o,is_active:i}=await e.req.json();return(await r.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t,a,n||null,o,i?1:0,s).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing updated successfully"})}catch(t){return console.error("[Admin Alimtalk Pricing Update] Error:",t),e.json({success:!1,error:t.message},500)}});d.delete("/api/admin/alimtalk/pricing/:id",b(),async e=>{const{env:r}=e,s=e.req.param("id");try{return(await r.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(s).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing deleted successfully"})}catch(t){return console.error("[Admin Alimtalk Pricing Delete] Error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/alimtalk/accounts",b(),async e=>{const{env:r}=e;try{const s=await r.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();return e.json({success:!0,accounts:s.results})}catch(s){return console.error("[Admin Alimtalk Accounts] Error:",s),e.json({success:!1,error:s.message},500)}});d.patch("/api/admin/alimtalk/accounts/:id/status",b(),async e=>{const{env:r}=e,s=e.req.param("id");try{const{status:t}=await e.req.json();return["active","suspended","rejected"].includes(t)?(await r.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t,s).run()).meta.changes===0?e.json({success:!1,error:"Account not found"},404):e.json({success:!0,message:`Account ${t} successfully`}):e.json({success:!1,error:"Invalid status"},400)}catch(t){return console.error("[Admin Alimtalk Account Status] Error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/alimtalk/statistics",b(),async e=>{const{env:r}=e;try{const{start_date:s,end_date:t}=e.req.query(),a=await r.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_revenue
      FROM alimtalk_messages
      WHERE created_at >= ? AND created_at <= ?
    `).bind(s||"2000-01-01",t||"2100-01-01").first(),n=await r.DB.prepare(`
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
    `).bind(s||"2000-01-01",t||"2100-01-01").all();return e.json({success:!0,statistics:{total:a,by_seller:n.results}})}catch(s){return console.error("[Admin Alimtalk Statistics] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/account",b(),async e=>{const{env:r}=e;try{const s=e.req.header("X-Session-Token"),t=await Z(r,s);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await r.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(t.user_id).first();return e.json({success:!0,account:a})}catch(s){return console.error("[Seller Alimtalk Account] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/register",b(),async e=>{const{env:r}=e;try{const s=e.req.header("X-Session-Token"),t=await Z(r,s);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{channel_id:a,phone_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=zs(n),i=await mt(r,{channelId:a,phoneNumber:o});if(!i.success)return e.json({success:!1,error:"Failed to register Kakao channel"},500);const c=await r.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(t.user_id,a,a,i.senderKey,o).run();return e.json({success:!0,account_id:c.meta.last_row_id,sender_key:i.senderKey,message:"Kakao channel registered successfully"})}catch(s){return console.error("[Seller Alimtalk Register] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/templates",b(),async e=>{const{env:r}=e;try{const s=e.req.header("X-Session-Token"),t=await Z(r,s);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await r.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!a)return e.json({success:!1,error:"Alimtalk account not found"},404);const n=await r.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();return e.json({success:!0,templates:n.results})}catch(s){return console.error("[Seller Alimtalk Templates] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/templates",b(),async e=>{const{env:r}=e;try{const s=e.req.header("X-Session-Token"),t=await Z(r,s);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_code:a,template_name:n,template_content:o,template_type:i}=await e.req.json();if(!a||!n||!o)return e.json({success:!1,error:"Missing required fields"},400);const c=await r.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(t.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(!(await _t(r,c.sender_key,{name:n,content:o,templateCode:a})).success)return e.json({success:!1,error:"Failed to register template"},500);const l=await r.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id,a,n,o,i||"basic").run();return e.json({success:!0,template_id:l.meta.last_row_id,message:"Template registered successfully. Approval pending (1-2 days)"})}catch(s){return console.error("[Seller Alimtalk Template Register] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/pricing",b(),async e=>{const{env:r}=e;try{const s=await r.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:s.results})}catch(s){return console.error("[Seller Alimtalk Pricing] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/charge",b(),async e=>{const{env:r}=e;try{const s=e.req.header("X-Session-Token"),t=await Z(r,s);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{amount:a,pricing_id:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await r.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await r.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();if(!i)return e.json({success:!1,error:"Pricing not found"},404);const c=a*i.unit_price,u=`alimtalk_${o.id}_${Date.now()}`,l=await r.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id,a,c,i.unit_price,u).run(),p=`https://api.tosspayments.com/v1/payment/${u}`;return e.json({success:!0,charge_id:l.meta.last_row_id,order_id:u,amount:a,price:c,unit_price:i.unit_price,payment_url:p})}catch(s){return console.error("[Seller Alimtalk Charge] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/charge/complete",b(),async e=>{const{env:r}=e;try{const{order_id:s,payment_id:t}=await e.req.json();if(!s)return e.json({success:!1,error:"Missing order_id"},400);const a=await r.DB.prepare(`
      SELECT * FROM alimtalk_charges WHERE order_id = ? AND payment_status = 'pending'
    `).bind(s).first();return a?(await r.DB.prepare(`
      UPDATE alimtalk_charges 
      SET payment_status = 'completed', 
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t||null,a.id).run(),await r.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a.amount,a.account_id).run(),e.json({success:!0,message:"Charge completed successfully",charged_amount:a.amount})):e.json({success:!1,error:"Charge not found or already completed"},404)}catch(s){return console.error("[Seller Alimtalk Charge Complete] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/send",b(),async e=>{const{env:r}=e;try{const s=e.req.header("X-Session-Token"),t=await Z(r,s);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_id:a,recipient_phone:n,variables:o,order_id:i}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const c=await r.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(t.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(c.balance<1)return e.json({success:!1,error:"Insufficient balance. Please charge first."},400);const u=await r.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a,c.id).first();if(!u)return e.json({success:!1,error:"Template not found or not approved"},404);const l=ft(u.template_content,o||{}),p=zs(n),_=await Js(r,{senderKey:c.sender_key,templateCode:u.template_code,to:p,message:l});if(!_.success)return await r.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id,a,i||null,p,l,_.error).run(),e.json({success:!1,error:_.error},500);const E=await r.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id,a,i||null,p,l,15,_.messageId).run();return await r.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(),e.json({success:!0,message_id:E.meta.last_row_id,aligo_message_id:_.messageId,status:"sent",remaining_balance:c.balance-1})}catch(s){return console.error("[Seller Alimtalk Send] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/messages",b(),async e=>{const{env:r}=e;try{const s=e.req.header("X-Session-Token"),t=await Z(r,s);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{page:a="1",limit:n="20",status:o}=e.req.query(),i=await r.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!i)return e.json({success:!1,error:"Alimtalk account not found"},404);const c=(parseInt(a)-1)*parseInt(n);let u=`
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;const l=[i.id];o&&(u+=" AND m.status = ?",l.push(o)),u+=" ORDER BY m.created_at DESC LIMIT ? OFFSET ?",l.push(parseInt(n),c);const p=await r.DB.prepare(u).bind(...l).all(),_=await r.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();return e.json({success:!0,messages:p.results,pagination:{total:_.total,page:parseInt(a),limit:parseInt(n)}})}catch(s){return console.error("[Seller Alimtalk Messages] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/statistics",b(),async e=>{const{env:r}=e;try{const s=e.req.header("X-Session-Token"),t=await Z(r,s);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{start_date:a,end_date:n}=e.req.query(),o=await r.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await r.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_cost
      FROM alimtalk_messages
      WHERE account_id = ?
        AND created_at >= ?
        AND created_at <= ?
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").first(),c=await r.DB.prepare(`
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
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").all(),u=i.total_sent>0?(i.total_success/i.total_sent*100).toFixed(2):0;return e.json({success:!0,statistics:{total_sent:i.total_sent,total_success:i.total_success,total_failed:i.total_failed,success_rate:u,total_cost:i.total_cost,by_template:c.results}})}catch(s){return console.error("[Seller Alimtalk Statistics] Error:",s),e.json({success:!1,error:s.message},500)}});const Ts=new Ws,Ct=Object.assign({"/src/index.tsx":d});let sr=!1;for(const[,e]of Object.entries(Ct))e&&(Ts.route("/",e),Ts.notFound(e.notFoundHandler),sr=!0);if(!sr)throw new Error("Can't import modules from ['/src/index.tsx']");async function rr(e){try{const{to:r,subject:s,htmlContent:t,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:r}]}],from:{email:"noreply@live.ur-team.com",name:"유어 라이브"},subject:s,content:[{type:"text/html",value:t},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",r),{success:!0}}catch(r){return console.error("[Email] Exception:",r),{success:!1,error:r.message}}}async function Lt(e){const{streamId:r,title:s,sellerName:t,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${r}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",u=`
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
        <span class="value"><strong>${s}</strong></span>
      </div>
      
      <div class="info-row">
        <span class="label">판매자</span>
        <span class="value">${t}</span>
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
        <span class="value">#${r}</span>
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
제목: ${s}
판매자: ${t}
플랫폼: ${a==="youtube"?"YouTube":"TikTok"}
${n?`예약 시간: ${new Date(n).toLocaleString("ko-KR")}`:""}
라이브 ID: #${r}

🔗 라이브 페이지: ${i}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `;return rr({to:"jiwon@ur-team.com",subject:`[유어 라이브] 🎉 새 라이브 스트림 생성: ${s}`,htmlContent:u,textContent:l})}const Mt=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:rr,sendLiveStreamCreatedEmail:Lt},Symbol.toStringTag,{value:"Module"}));export{Ts as default};
