var jt=Object.defineProperty;var lr=e=>{throw TypeError(e)};var Lt=(e,s,r)=>s in e?jt(e,s,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[s]=r;var A=(e,s,r)=>Lt(e,typeof s!="symbol"?s+"":s,r),qs=(e,s,r)=>s.has(e)||lr("Cannot "+r);var E=(e,s,r)=>(qs(e,s,"read from private field"),r?r.call(e):s.get(e)),O=(e,s,r)=>s.has(e)?lr("Cannot add the same private member more than once"):s instanceof WeakSet?s.add(e):s.set(e,r),I=(e,s,r,t)=>(qs(e,s,"write to private field"),t?t.call(e,r):s.set(e,r),r),j=(e,s,r)=>(qs(e,s,"access private method"),r);var ur=(e,s,r,t)=>({set _(a){I(e,s,a,r)},get _(){return E(e,s,t)}});var dr=(e,s,r)=>(t,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,l=!1,u;if(e[i]?(u=e[i][0][0],t.req.routeIndex=i):u=i===e.length&&a||void 0,u)try{c=await u(t,()=>o(i+1))}catch(d){if(d instanceof Error&&s)t.error=d,c=await s(d,t),l=!0;else throw d}else t.finalized===!1&&r&&(c=await r(t));return c&&(t.finalized===!1||l)&&(t.res=c),t}},Mt=Symbol(),Ft=async(e,s=Object.create(null))=>{const{all:r=!1,dot:t=!1}=s,n=(e instanceof Kr?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?$t(e,{all:r,dot:t}):{}};async function $t(e,s){const r=await e.formData();return r?Ut(r,s):{}}function Ut(e,s){const r=Object.create(null);return e.forEach((t,a)=>{s.all||a.endsWith("[]")?Pt(r,a,t):r[a]=t}),s.dot&&Object.entries(r).forEach(([t,a])=>{t.includes(".")&&(xt(r,t,a),delete r[t])}),r}var Pt=(e,s,r)=>{e[s]!==void 0?Array.isArray(e[s])?e[s].push(r):e[s]=[e[s],r]:s.endsWith("[]")?e[s]=[r]:e[s]=r},xt=(e,s,r)=>{let t=e;const a=s.split(".");a.forEach((n,o)=>{o===a.length-1?t[n]=r:((!t[n]||typeof t[n]!="object"||Array.isArray(t[n])||t[n]instanceof File)&&(t[n]=Object.create(null)),t=t[n])})},Pr=e=>{const s=e.split("/");return s[0]===""&&s.shift(),s},Wt=e=>{const{groups:s,path:r}=qt(e),t=Pr(r);return Ht(t,s)},qt=e=>{const s=[];return e=e.replace(/\{[^}]+\}/g,(r,t)=>{const a=`@${t}`;return s.push([a,r]),a}),{groups:s,path:e}},Ht=(e,s)=>{for(let r=s.length-1;r>=0;r--){const[t]=s[r];for(let a=e.length-1;a>=0;a--)if(e[a].includes(t)){e[a]=e[a].replace(t,s[r][1]);break}}return e},Ts={},Kt=(e,s)=>{if(e==="*")return"*";const r=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(r){const t=`${e}#${s}`;return Ts[t]||(r[2]?Ts[t]=s&&s[0]!==":"&&s[0]!=="*"?[t,r[1],new RegExp(`^${r[2]}(?=/${s})`)]:[e,r[1],new RegExp(`^${r[2]}$`)]:Ts[t]=[e,r[1],!0]),Ts[t]}return null},er=(e,s)=>{try{return s(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,r=>{try{return s(r)}catch{return r}})}},Bt=e=>er(e,decodeURI),xr=e=>{const s=e.url,r=s.indexOf("/",s.indexOf(":")+4);let t=r;for(;t<s.length;t++){const a=s.charCodeAt(t);if(a===37){const n=s.indexOf("?",t),o=s.indexOf("#",t),i=n===-1?o===-1?void 0:o:o===-1?n:Math.min(n,o),c=s.slice(r,i);return Bt(c.includes("%25")?c.replace(/%25/g,"%2525"):c)}else if(a===63||a===35)break}return s.slice(r,t)},Jt=e=>{const s=xr(e);return s.length>1&&s.at(-1)==="/"?s.slice(0,-1):s},Be=(e,s,...r)=>(r.length&&(s=Be(s,...r)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${s==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(s==null?void 0:s[0])==="/"?s.slice(1):s}`}`),Wr=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const s=e.split("/"),r=[];let t="";return s.forEach(a=>{if(a!==""&&!/\:/.test(a))t+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){r.length===0&&t===""?r.push("/"):r.push(t);const n=a.replace("?","");t+="/"+n,r.push(t)}else t+="/"+a}),r.filter((a,n,o)=>o.indexOf(a)===n)},Hs=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?er(e,Hr):e):e,qr=(e,s,r)=>{let t;if(!r&&s&&!/[%+]/.test(s)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(s,o+1)||(o=e.indexOf(`&${s}`,o+1));o!==-1;){const i=e.charCodeAt(o+s.length+1);if(i===61){const c=o+s.length+2,l=e.indexOf("&",c);return Hs(e.slice(c,l===-1?void 0:l))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${s}`,o+1)}if(t=/[%+]/.test(e),!t)return}const a={};t??(t=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(t&&(c=Hs(c)),n=o,c==="")continue;let l;i===-1?l="":(l=e.slice(i+1,o===-1?void 0:o),t&&(l=Hs(l))),r?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(l)):a[c]??(a[c]=l)}return s?a[s]:a},Vt=qr,Yt=(e,s)=>qr(e,s,!0),Hr=decodeURIComponent,pr=e=>er(e,Hr),ze,ae,ye,Br,Jr,Gs,we,Nr,Kr=(Nr=class{constructor(e,s="/",r=[[]]){O(this,ye);A(this,"raw");O(this,ze);O(this,ae);A(this,"routeIndex",0);A(this,"path");A(this,"bodyCache",{});O(this,we,e=>{const{bodyCache:s,raw:r}=this,t=s[e];if(t)return t;const a=Object.keys(s)[0];return a?s[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):s[e]=r[e]()});this.raw=e,this.path=s,I(this,ae,r),I(this,ze,{})}param(e){return e?j(this,ye,Br).call(this,e):j(this,ye,Jr).call(this)}query(e){return Vt(this.url,e)}queries(e){return Yt(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const s={};return this.raw.headers.forEach((r,t)=>{s[t]=r}),s}async parseBody(e){var s;return(s=this.bodyCache).parsedBody??(s.parsedBody=await Ft(this,e))}json(){return E(this,we).call(this,"text").then(e=>JSON.parse(e))}text(){return E(this,we).call(this,"text")}arrayBuffer(){return E(this,we).call(this,"arrayBuffer")}blob(){return E(this,we).call(this,"blob")}formData(){return E(this,we).call(this,"formData")}addValidatedData(e,s){E(this,ze)[e]=s}valid(e){return E(this,ze)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[Mt](){return E(this,ae)}get matchedRoutes(){return E(this,ae)[0].map(([[,e]])=>e)}get routePath(){return E(this,ae)[0].map(([[,e]])=>e)[this.routeIndex].path}},ze=new WeakMap,ae=new WeakMap,ye=new WeakSet,Br=function(e){const s=E(this,ae)[0][this.routeIndex][1][e],r=j(this,ye,Gs).call(this,s);return r&&/\%/.test(r)?pr(r):r},Jr=function(){const e={},s=Object.keys(E(this,ae)[0][this.routeIndex][1]);for(const r of s){const t=j(this,ye,Gs).call(this,E(this,ae)[0][this.routeIndex][1][r]);t!==void 0&&(e[r]=/\%/.test(t)?pr(t):t)}return e},Gs=function(e){return E(this,ae)[1]?E(this,ae)[1][e]:e},we=new WeakMap,Nr),zt={Stringify:1},Vr=async(e,s,r,t,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:s,buffer:a,context:t}))).then(i=>Promise.all(i.filter(Boolean).map(c=>Vr(c,s,!1,t,a))).then(()=>a[0]))):Promise.resolve(e)},Gt="text/plain; charset=UTF-8",Ks=(e,s)=>({"Content-Type":e,...s}),We=(e,s)=>new Response(e,s),ms,_s,fe,Ge,Ee,se,fs,Xe,Qe,Ce,Es,hs,de,Je,Xs,jr,Xt=(jr=class{constructor(e,s){O(this,de);O(this,ms);O(this,_s);A(this,"env",{});O(this,fe);A(this,"finalized",!1);A(this,"error");O(this,Ge);O(this,Ee);O(this,se);O(this,fs);O(this,Xe);O(this,Qe);O(this,Ce);O(this,Es);O(this,hs);A(this,"render",(...e)=>(E(this,Xe)??I(this,Xe,s=>this.html(s)),E(this,Xe).call(this,...e)));A(this,"setLayout",e=>I(this,fs,e));A(this,"getLayout",()=>E(this,fs));A(this,"setRenderer",e=>{I(this,Xe,e)});A(this,"header",(e,s,r)=>{this.finalized&&I(this,se,We(E(this,se).body,E(this,se)));const t=E(this,se)?E(this,se).headers:E(this,Ce)??I(this,Ce,new Headers);s===void 0?t.delete(e):r!=null&&r.append?t.append(e,s):t.set(e,s)});A(this,"status",e=>{I(this,Ge,e)});A(this,"set",(e,s)=>{E(this,fe)??I(this,fe,new Map),E(this,fe).set(e,s)});A(this,"get",e=>E(this,fe)?E(this,fe).get(e):void 0);A(this,"newResponse",(...e)=>j(this,de,Je).call(this,...e));A(this,"body",(e,s,r)=>j(this,de,Je).call(this,e,s,r));A(this,"text",(e,s,r)=>j(this,de,Xs).call(this)&&!s&&!r?We(e):j(this,de,Je).call(this,e,s,Ks(Gt,r)));A(this,"json",(e,s,r)=>j(this,de,Xs).call(this)&&!s&&!r?Response.json(e):j(this,de,Je).call(this,JSON.stringify(e),s,Ks("application/json",r)));A(this,"html",(e,s,r)=>{const t=a=>j(this,de,Je).call(this,a,s,Ks("text/html; charset=UTF-8",r));return typeof e=="object"?Vr(e,zt.Stringify,!1,{}).then(t):t(e)});A(this,"redirect",(e,s)=>{const r=String(e);return this.header("Location",/[^\x00-\xFF]/.test(r)?encodeURI(r):r),this.newResponse(null,s??302)});A(this,"notFound",()=>(E(this,Qe)??I(this,Qe,()=>We()),E(this,Qe).call(this,this)));I(this,ms,e),s&&(I(this,Ee,s.executionCtx),this.env=s.env,I(this,Qe,s.notFoundHandler),I(this,hs,s.path),I(this,Es,s.matchResult))}get req(){return E(this,_s)??I(this,_s,new Kr(E(this,ms),E(this,hs),E(this,Es))),E(this,_s)}get event(){if(E(this,Ee)&&"respondWith"in E(this,Ee))return E(this,Ee);throw Error("This context has no FetchEvent")}get executionCtx(){if(E(this,Ee))return E(this,Ee);throw Error("This context has no ExecutionContext")}get res(){return E(this,se)||I(this,se,We(null,{headers:E(this,Ce)??I(this,Ce,new Headers)}))}set res(e){if(E(this,se)&&e){e=We(e.body,e);for(const[s,r]of E(this,se).headers.entries())if(s!=="content-type")if(s==="set-cookie"){const t=E(this,se).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of t)e.headers.append("set-cookie",a)}else e.headers.set(s,r)}I(this,se,e),this.finalized=!0}get var(){return E(this,fe)?Object.fromEntries(E(this,fe)):{}}},ms=new WeakMap,_s=new WeakMap,fe=new WeakMap,Ge=new WeakMap,Ee=new WeakMap,se=new WeakMap,fs=new WeakMap,Xe=new WeakMap,Qe=new WeakMap,Ce=new WeakMap,Es=new WeakMap,hs=new WeakMap,de=new WeakSet,Je=function(e,s,r){const t=E(this,se)?new Headers(E(this,se).headers):E(this,Ce)??new Headers;if(typeof s=="object"&&"headers"in s){const n=s.headers instanceof Headers?s.headers:new Headers(s.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?t.append(o,i):t.set(o,i)}if(r)for(const[n,o]of Object.entries(r))if(typeof o=="string")t.set(n,o);else{t.delete(n);for(const i of o)t.append(n,i)}const a=typeof s=="number"?s:(s==null?void 0:s.status)??E(this,Ge);return We(e,{status:a,headers:t})},Xs=function(){return!E(this,Ce)&&!E(this,Ge)&&!this.finalized},jr),B="ALL",Qt="all",Zt=["get","post","put","delete","options","patch"],Yr="Can not add a route since the matcher is already built.",zr=class extends Error{},ea="__COMPOSED_HANDLER",sa=e=>e.text("404 Not Found",404),mr=(e,s)=>{if("getResponse"in e){const r=e.getResponse();return s.newResponse(r.body,r)}return console.error(e),s.text("Internal Server Error",500)},ce,J,Gr,le,Oe,vs,As,Ze,ra=(Ze=class{constructor(s={}){O(this,J);A(this,"get");A(this,"post");A(this,"put");A(this,"delete");A(this,"options");A(this,"patch");A(this,"all");A(this,"on");A(this,"use");A(this,"router");A(this,"getPath");A(this,"_basePath","/");O(this,ce,"/");A(this,"routes",[]);O(this,le,sa);A(this,"errorHandler",mr);A(this,"onError",s=>(this.errorHandler=s,this));A(this,"notFound",s=>(I(this,le,s),this));A(this,"fetch",(s,...r)=>j(this,J,As).call(this,s,r[1],r[0],s.method));A(this,"request",(s,r,t,a)=>s instanceof Request?this.fetch(r?new Request(s,r):s,t,a):(s=s.toString(),this.fetch(new Request(/^https?:\/\//.test(s)?s:`http://localhost${Be("/",s)}`,r),t,a)));A(this,"fire",()=>{addEventListener("fetch",s=>{s.respondWith(j(this,J,As).call(this,s.request,s,void 0,s.request.method))})});[...Zt,Qt].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?I(this,ce,o):j(this,J,Oe).call(this,n,E(this,ce),o),i.forEach(c=>{j(this,J,Oe).call(this,n,E(this,ce),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){I(this,ce,c);for(const l of[n].flat())i.map(u=>{j(this,J,Oe).call(this,l.toUpperCase(),E(this,ce),u)})}return this},this.use=(n,...o)=>(typeof n=="string"?I(this,ce,n):(I(this,ce,"*"),o.unshift(n)),o.forEach(i=>{j(this,J,Oe).call(this,B,E(this,ce),i)}),this);const{strict:t,...a}=s;Object.assign(this,a),this.getPath=t??!0?s.getPath??xr:Jt}route(s,r){const t=this.basePath(s);return r.routes.map(a=>{var o;let n;r.errorHandler===mr?n=a.handler:(n=async(i,c)=>(await dr([],r.errorHandler)(i,()=>a.handler(i,c))).res,n[ea]=a.handler),j(o=t,J,Oe).call(o,a.method,a.path,n)}),this}basePath(s){const r=j(this,J,Gr).call(this);return r._basePath=Be(this._basePath,s),r}mount(s,r,t){let a,n;t&&(typeof t=="function"?n=t:(n=t.optionHandler,t.replaceRequest===!1?a=c=>c:a=t.replaceRequest));const o=n?c=>{const l=n(c);return Array.isArray(l)?l:[l]}:c=>{let l;try{l=c.executionCtx}catch{}return[c.env,l]};a||(a=(()=>{const c=Be(this._basePath,s),l=c==="/"?0:c.length;return u=>{const d=new URL(u.url);return d.pathname=d.pathname.slice(l)||"/",new Request(d,u)}})());const i=async(c,l)=>{const u=await r(a(c.req.raw),...o(c));if(u)return u;await l()};return j(this,J,Oe).call(this,B,Be(s,"*"),i),this}},ce=new WeakMap,J=new WeakSet,Gr=function(){const s=new Ze({router:this.router,getPath:this.getPath});return s.errorHandler=this.errorHandler,I(s,le,E(this,le)),s.routes=this.routes,s},le=new WeakMap,Oe=function(s,r,t){s=s.toUpperCase(),r=Be(this._basePath,r);const a={basePath:this._basePath,path:r,method:s,handler:t};this.router.add(s,r,[t,a]),this.routes.push(a)},vs=function(s,r){if(s instanceof Error)return this.errorHandler(s,r);throw s},As=function(s,r,t,a){if(a==="HEAD")return(async()=>new Response(null,await j(this,J,As).call(this,s,r,t,"GET")))();const n=this.getPath(s,{env:t}),o=this.router.match(a,n),i=new Xt(s,{path:n,matchResult:o,env:t,executionCtx:r,notFoundHandler:E(this,le)});if(o[0].length===1){let l;try{l=o[0][0][0][0](i,async()=>{i.res=await E(this,le).call(this,i)})}catch(u){return j(this,J,vs).call(this,u,i)}return l instanceof Promise?l.then(u=>u||(i.finalized?i.res:E(this,le).call(this,i))).catch(u=>j(this,J,vs).call(this,u,i)):l??E(this,le).call(this,i)}const c=dr(o[0],this.errorHandler,E(this,le));return(async()=>{try{const l=await c(i);if(!l.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return l.res}catch(l){return j(this,J,vs).call(this,l,i)}})()},Ze),Xr=[];function ta(e,s){const r=this.buildAllMatchers(),t=((a,n)=>{const o=r[a]||r[B],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],Xr];const l=c.indexOf("",1);return[o[1][l],c]});return this.match=t,t(e,s)}var ks="[^/]+",ls=".*",us="(?:|/.*)",Ve=Symbol(),aa=new Set(".\\+*[^]$()");function na(e,s){return e.length===1?s.length===1?e<s?-1:1:-1:s.length===1||e===ls||e===us?1:s===ls||s===us?-1:e===ks?1:s===ks?-1:e.length===s.length?e<s?-1:1:s.length-e.length}var Ne,je,ue,$e,oa=($e=class{constructor(){O(this,Ne);O(this,je);O(this,ue,Object.create(null))}insert(s,r,t,a,n){if(s.length===0){if(E(this,Ne)!==void 0)throw Ve;if(n)return;I(this,Ne,r);return}const[o,...i]=s,c=o==="*"?i.length===0?["","",ls]:["","",ks]:o==="/*"?["","",us]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let l;if(c){const u=c[1];let d=c[2]||ks;if(u&&c[2]&&(d===".*"||(d=d.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(d))))throw Ve;if(l=E(this,ue)[d],!l){if(Object.keys(E(this,ue)).some(m=>m!==ls&&m!==us))throw Ve;if(n)return;l=E(this,ue)[d]=new $e,u!==""&&I(l,je,a.varIndex++)}!n&&u!==""&&t.push([u,E(l,je)])}else if(l=E(this,ue)[o],!l){if(Object.keys(E(this,ue)).some(u=>u.length>1&&u!==ls&&u!==us))throw Ve;if(n)return;l=E(this,ue)[o]=new $e}l.insert(i,r,t,a,n)}buildRegExpStr(){const r=Object.keys(E(this,ue)).sort(na).map(t=>{const a=E(this,ue)[t];return(typeof E(a,je)=="number"?`(${t})@${E(a,je)}`:aa.has(t)?`\\${t}`:t)+a.buildRegExpStr()});return typeof E(this,Ne)=="number"&&r.unshift(`#${E(this,Ne)}`),r.length===0?"":r.length===1?r[0]:"(?:"+r.join("|")+")"}},Ne=new WeakMap,je=new WeakMap,ue=new WeakMap,$e),Ls,gs,Lr,ia=(Lr=class{constructor(){O(this,Ls,{varIndex:0});O(this,gs,new oa)}insert(e,s,r){const t=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const l=`@\\${o}`;return a[o]=[l,c],o++,i=!0,l}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return E(this,gs).insert(n,s,t,E(this,Ls),r),t}buildRegExp(){let e=E(this,gs).buildRegExpStr();if(e==="")return[/^$/,[],[]];let s=0;const r=[],t=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(r[++s]=Number(n),"$()"):(o!==void 0&&(t[Number(o)]=++s),"")),[new RegExp(`^${e}`),r,t]}},Ls=new WeakMap,gs=new WeakMap,Lr),ca=[/^$/,[],Object.create(null)],Ds=Object.create(null);function Qr(e){return Ds[e]??(Ds[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(s,r)=>r?`\\${r}`:"(?:|/.*)")}$`))}function la(){Ds=Object.create(null)}function ua(e){var l;const s=new ia,r=[];if(e.length===0)return ca;const t=e.map(u=>[!/\*|\/:/.test(u[0]),...u]).sort(([u,d],[m,_])=>u?1:m?-1:d.length-_.length),a=Object.create(null);for(let u=0,d=-1,m=t.length;u<m;u++){const[_,f,h]=t[u];_?a[f]=[h.map(([b])=>[b,Object.create(null)]),Xr]:d++;let w;try{w=s.insert(f,d,_)}catch(b){throw b===Ve?new zr(f):b}_||(r[d]=h.map(([b,g])=>{const T=Object.create(null);for(g-=1;g>=0;g--){const[y,R]=w[g];T[y]=R}return[b,T]}))}const[n,o,i]=s.buildRegExp();for(let u=0,d=r.length;u<d;u++)for(let m=0,_=r[u].length;m<_;m++){const f=(l=r[u][m])==null?void 0:l[1];if(!f)continue;const h=Object.keys(f);for(let w=0,b=h.length;w<b;w++)f[h[w]]=i[f[h[w]]]}const c=[];for(const u in o)c[u]=r[o[u]];return[n,c,a]}function qe(e,s){if(e){for(const r of Object.keys(e).sort((t,a)=>a.length-t.length))if(Qr(r).test(s))return[...e[r]]}}var Se,Te,Ms,Zr,Mr,da=(Mr=class{constructor(){O(this,Ms);A(this,"name","RegExpRouter");O(this,Se);O(this,Te);A(this,"match",ta);I(this,Se,{[B]:Object.create(null)}),I(this,Te,{[B]:Object.create(null)})}add(e,s,r){var i;const t=E(this,Se),a=E(this,Te);if(!t||!a)throw new Error(Yr);t[e]||[t,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[B]).forEach(l=>{c[e][l]=[...c[B][l]]})}),s==="/*"&&(s="*");const n=(s.match(/\/:/g)||[]).length;if(/\*$/.test(s)){const c=Qr(s);e===B?Object.keys(t).forEach(l=>{var u;(u=t[l])[s]||(u[s]=qe(t[l],s)||qe(t[B],s)||[])}):(i=t[e])[s]||(i[s]=qe(t[e],s)||qe(t[B],s)||[]),Object.keys(t).forEach(l=>{(e===B||e===l)&&Object.keys(t[l]).forEach(u=>{c.test(u)&&t[l][u].push([r,n])})}),Object.keys(a).forEach(l=>{(e===B||e===l)&&Object.keys(a[l]).forEach(u=>c.test(u)&&a[l][u].push([r,n]))});return}const o=Wr(s)||[s];for(let c=0,l=o.length;c<l;c++){const u=o[c];Object.keys(a).forEach(d=>{var m;(e===B||e===d)&&((m=a[d])[u]||(m[u]=[...qe(t[d],u)||qe(t[B],u)||[]]),a[d][u].push([r,n-l+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(E(this,Te)).concat(Object.keys(E(this,Se))).forEach(s=>{e[s]||(e[s]=j(this,Ms,Zr).call(this,s))}),I(this,Se,I(this,Te,void 0)),la(),e}},Se=new WeakMap,Te=new WeakMap,Ms=new WeakSet,Zr=function(e){const s=[];let r=e===B;return[E(this,Se),E(this,Te)].forEach(t=>{const a=t[e]?Object.keys(t[e]).map(n=>[n,t[e][n]]):[];a.length!==0?(r||(r=!0),s.push(...a)):e!==B&&s.push(...Object.keys(t[B]).map(n=>[n,t[B][n]]))}),r?ua(s):null},Mr),Re,he,Fr,pa=(Fr=class{constructor(e){A(this,"name","SmartRouter");O(this,Re,[]);O(this,he,[]);I(this,Re,e.routers)}add(e,s,r){if(!E(this,he))throw new Error(Yr);E(this,he).push([e,s,r])}match(e,s){if(!E(this,he))throw new Error("Fatal error");const r=E(this,Re),t=E(this,he),a=r.length;let n=0,o;for(;n<a;n++){const i=r[n];try{for(let c=0,l=t.length;c<l;c++)i.add(...t[c]);o=i.match(e,s)}catch(c){if(c instanceof zr)continue;throw c}this.match=i.match.bind(i),I(this,Re,[i]),I(this,he,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(E(this,he)||E(this,Re).length!==1)throw new Error("No active router has been determined yet.");return E(this,Re)[0]}},Re=new WeakMap,he=new WeakMap,Fr),os=Object.create(null),ma=e=>{for(const s in e)return!0;return!1},Ie,ee,Le,es,G,ge,ke,ss,_a=(ss=class{constructor(s,r,t){O(this,ge);O(this,Ie);O(this,ee);O(this,Le);O(this,es,0);O(this,G,os);if(I(this,ee,t||Object.create(null)),I(this,Ie,[]),s&&r){const a=Object.create(null);a[s]={handler:r,possibleKeys:[],score:0},I(this,Ie,[a])}I(this,Le,[])}insert(s,r,t){I(this,es,++ur(this,es)._);let a=this;const n=Wt(r),o=[];for(let i=0,c=n.length;i<c;i++){const l=n[i],u=n[i+1],d=Kt(l,u),m=Array.isArray(d)?d[0]:l;if(m in E(a,ee)){a=E(a,ee)[m],d&&o.push(d[1]);continue}E(a,ee)[m]=new ss,d&&(E(a,Le).push(d),o.push(d[1])),a=E(a,ee)[m]}return E(a,Ie).push({[s]:{handler:t,possibleKeys:o.filter((i,c,l)=>l.indexOf(i)===c),score:E(this,es)}}),a}search(s,r){var u;const t=[];I(this,G,os);let n=[this];const o=Pr(r),i=[],c=o.length;let l=null;for(let d=0;d<c;d++){const m=o[d],_=d===c-1,f=[];for(let w=0,b=n.length;w<b;w++){const g=n[w],T=E(g,ee)[m];T&&(I(T,G,E(g,G)),_?(E(T,ee)["*"]&&j(this,ge,ke).call(this,t,E(T,ee)["*"],s,E(g,G)),j(this,ge,ke).call(this,t,T,s,E(g,G))):f.push(T));for(let y=0,R=E(g,Le).length;y<R;y++){const L=E(g,Le)[y],C=E(g,G)===os?{}:{...E(g,G)};if(L==="*"){const $=E(g,ee)["*"];$&&(j(this,ge,ke).call(this,t,$,s,E(g,G)),I($,G,C),f.push($));continue}const[D,W,U]=L;if(!m&&!(U instanceof RegExp))continue;const M=E(g,ee)[D];if(U instanceof RegExp){if(l===null){l=new Array(c);let z=r[0]==="/"?1:0;for(let v=0;v<c;v++)l[v]=z,z+=o[v].length+1}const $=r.substring(l[d]),Z=U.exec($);if(Z){if(C[W]=Z[0],j(this,ge,ke).call(this,t,M,s,E(g,G),C),ma(E(M,ee))){I(M,G,C);const z=((u=Z[0].match(/\//))==null?void 0:u.length)??0;(i[z]||(i[z]=[])).push(M)}continue}}(U===!0||U.test(m))&&(C[W]=m,_?(j(this,ge,ke).call(this,t,M,s,C,E(g,G)),E(M,ee)["*"]&&j(this,ge,ke).call(this,t,E(M,ee)["*"],s,C,E(g,G))):(I(M,G,C),f.push(M)))}}const h=i.shift();n=h?f.concat(h):f}return t.length>1&&t.sort((d,m)=>d.score-m.score),[t.map(({handler:d,params:m})=>[d,m])]}},Ie=new WeakMap,ee=new WeakMap,Le=new WeakMap,es=new WeakMap,G=new WeakMap,ge=new WeakSet,ke=function(s,r,t,a,n){for(let o=0,i=E(r,Ie).length;o<i;o++){const c=E(r,Ie)[o],l=c[t]||c[B],u={};if(l!==void 0&&(l.params=Object.create(null),s.push(l),a!==os||n&&n!==os))for(let d=0,m=l.possibleKeys.length;d<m;d++){const _=l.possibleKeys[d],f=u[l.score];l.params[_]=n!=null&&n[_]&&!f?n[_]:a[_]??(n==null?void 0:n[_]),u[l.score]=!0}}},ss),Me,$r,fa=($r=class{constructor(){A(this,"name","TrieRouter");O(this,Me);I(this,Me,new _a)}add(e,s,r){const t=Wr(s);if(t){for(let a=0,n=t.length;a<n;a++)E(this,Me).insert(e,t[a],r);return}E(this,Me).insert(e,s,r)}match(e,s){return E(this,Me).search(e,s)}},Me=new WeakMap,$r),et=class extends ra{constructor(e={}){super(e),this.router=e.router??new pa({routers:[new da,new fa]})}},S=e=>{const r={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},t=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(r.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(r.allowMethods);return async function(o,i){var u;function c(d,m){o.res.headers.set(d,m)}const l=await t(o.req.header("origin")||"",o);if(l&&c("Access-Control-Allow-Origin",l),r.credentials&&c("Access-Control-Allow-Credentials","true"),(u=r.exposeHeaders)!=null&&u.length&&c("Access-Control-Expose-Headers",r.exposeHeaders.join(",")),o.req.method==="OPTIONS"){r.origin!=="*"&&c("Vary","Origin"),r.maxAge!=null&&c("Access-Control-Max-Age",r.maxAge.toString());const d=await a(o.req.header("origin")||"",o);d.length&&c("Access-Control-Allow-Methods",d.join(","));let m=r.allowHeaders;if(!(m!=null&&m.length)){const _=o.req.header("Access-Control-Request-Headers");_&&(m=_.split(/\s*,\s*/))}return m!=null&&m.length&&(c("Access-Control-Allow-Headers",m.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),r.origin!=="*"&&o.header("Vary","Origin",{append:!0})}};function Ea(e){var a;const s=((a=e.split(".").pop())==null?void 0:a.toLowerCase())||"jpg",r=Date.now(),t=crypto.randomUUID().substring(0,8);return`upload_${r}_${t}.${s}`}async function ha(e){const s=new Uint8Array(e);return s[0]===255&&s[1]===216&&s[2]===255?{valid:!0,detectedType:"image/jpeg"}:s[0]===137&&s[1]===80&&s[2]===78&&s[3]===71?{valid:!0,detectedType:"image/png"}:s[0]===71&&s[1]===73&&s[2]===70&&s[3]===56?{valid:!0,detectedType:"image/gif"}:s[0]===82&&s[1]===73&&s[2]===70&&s[3]===70&&s[8]===87&&s[9]===69&&s[10]===66&&s[11]===80?{valid:!0,detectedType:"image/webp"}:{valid:!1}}function ga(e){const s=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],r=[];for(const t of s)e[t]||r.push(t);if(r.length>0)throw new Error(`Missing required environment variables: ${r.join(", ")}

Please configure them:
`+r.map(t=>t==="TOSS_SECRET_KEY"||t==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${t} --project-name ur-live`:`  Check wrangler.jsonc for ${t} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function ya(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function ba(e){const s=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),s.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):s.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(r){s.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:r instanceof Error?r.message:String(r)})}try{if(!e.SESSION_KV)s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const r="test:env:check";await e.SESSION_KV.put(r,"ok",{expirationTtl:60}),await e.SESSION_KV.get(r)==="ok"?s.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):s.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(r){s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:r instanceof Error?r.message:String(r)})}try{if(!e.CACHE_KV)s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const r="test:cache:check";await e.CACHE_KV.put(r,"ok",{expirationTtl:60}),await e.CACHE_KV.get(r)==="ok"?s.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):s.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(r){s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:r instanceof Error?r.message:String(r)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?s.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):s.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?s.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):s.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),e.FIREBASE_PRIVATE_KEY?e.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")?s.push({name:"FIREBASE_PRIVATE_KEY",status:"pass",message:`FIREBASE_PRIVATE_KEY configured (${e.FIREBASE_PRIVATE_KEY.length} chars)`}):s.push({name:"FIREBASE_PRIVATE_KEY",status:"warn",message:"FIREBASE_PRIVATE_KEY format may be invalid",details:"Expected format: -----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}):s.push({name:"FIREBASE_PRIVATE_KEY",status:"fail",message:"FIREBASE_PRIVATE_KEY not configured",details:"Add FIREBASE_PRIVATE_KEY in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_CLIENT_EMAIL?!e.FIREBASE_CLIENT_EMAIL.includes("@")||!e.FIREBASE_CLIENT_EMAIL.includes("iam.gserviceaccount.com")?s.push({name:"FIREBASE_CLIENT_EMAIL",status:"warn",message:"FIREBASE_CLIENT_EMAIL format may be invalid",details:"Expected format: *@*.iam.gserviceaccount.com"}):s.push({name:"FIREBASE_CLIENT_EMAIL",status:"pass",message:`FIREBASE_CLIENT_EMAIL configured: ${e.FIREBASE_CLIENT_EMAIL}`}):s.push({name:"FIREBASE_CLIENT_EMAIL",status:"fail",message:"FIREBASE_CLIENT_EMAIL not configured",details:"Add FIREBASE_CLIENT_EMAIL in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_PROJECT_ID?s.push({name:"FIREBASE_PROJECT_ID",status:"pass",message:`FIREBASE_PROJECT_ID configured: ${e.FIREBASE_PROJECT_ID}`}):s.push({name:"FIREBASE_PROJECT_ID",status:"fail",message:"FIREBASE_PROJECT_ID not configured",details:"Add FIREBASE_PROJECT_ID in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_DATABASE_URL?!e.FIREBASE_DATABASE_URL.startsWith("https://")||!e.FIREBASE_DATABASE_URL.includes("firebaseio.com")?s.push({name:"FIREBASE_DATABASE_URL",status:"warn",message:"FIREBASE_DATABASE_URL format may be invalid",details:"Expected format: https://*.firebaseio.com"}):s.push({name:"FIREBASE_DATABASE_URL",status:"pass",message:`FIREBASE_DATABASE_URL configured: ${e.FIREBASE_DATABASE_URL}`}):s.push({name:"FIREBASE_DATABASE_URL",status:"fail",message:"FIREBASE_DATABASE_URL not configured",details:"Add FIREBASE_DATABASE_URL in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),s}function wa(e){const s=[];s.push(""),s.push("========================================"),s.push("환경 변수 테스트 결과"),s.push("========================================"),s.push("");let r=0,t=0,a=0;for(const n of e){const o=n.status==="pass"?"✅":n.status==="warn"?"⚠️":"❌";s.push(`${o} ${n.name}: ${n.message}`),n.details&&s.push(`   → ${n.details}`),n.status==="pass"&&r++,n.status==="warn"&&t++,n.status==="fail"&&a++}return s.push(""),s.push("========================================"),s.push(`총 ${e.length}개 테스트:`),s.push(`  ✅ 성공: ${r}`),t>0&&s.push(`  ⚠️  경고: ${t}`),a>0&&s.push(`  ❌ 실패: ${a}`),s.push("========================================"),s.push(""),a>0?(s.push("❌ 환경 변수 설정이 완료되지 않았습니다."),s.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):t>0?s.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):s.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),s.join(`
`)}async function Sa(e){const s=await ba(e),r=s.filter(n=>n.status==="pass").length,t=s.filter(n=>n.status==="warn").length,a=s.filter(n=>n.status==="fail").length;return{success:a===0,summary:{total:s.length,pass:r,warn:t,fail:a},results:s,formatted:wa(s)}}const Bs={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function Ta(){const e=Bs.ENV==="production";return{baseUrl:Bs.TEST_BASE_URL,apiKey:Bs.TEST_API_KEY,isProduction:e}}async function st(e,s){const r=Ta(),t=`${r.baseUrl}${e}`;try{const a=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r.apiKey}`},body:JSON.stringify(s)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function Ra(e){try{const s={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((t,a)=>({SerialNum:a+1,ItemName:t.name,Qty:t.quantity,UnitPrice:t.unitPrice,SupplyCost:t.supplyPrice,Tax:t.taxAmount,Remark:t.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},r=await st("/eTaxInvoice/RegistAndIssue",s);if(r.code!==1)throw new Error(`바로빌 발행 실패: ${r.message}`);return{success:!0,ntsConfirmNumber:r.ntsconfirmNum,invoiceKey:r.invoiceKey,message:r.message}}catch(s){throw console.error("바로빌 세금계산서 발행 실패:",s),s}}async function Ia(e,s,r){try{const a=await st("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:s,Memo:r});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(t){throw console.error("바로빌 세금계산서 취소 실패:",t),t}}function cs(){return!1}async function va(e){return await Ra(e)}function Aa(e,s,r){const t=Number(s.total_amount),a=Math.floor(t/1.1),n=t-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:s.buyer_business_number,buyerBusinessName:s.buyer_business_name||s.user_name,buyerCEO:s.buyer_ceo_name,buyerAddress:s.shipping_address,buyerEmail:s.user_email,buyerTel:s.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:r.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),l=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:l,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:t,memo:`주문번호: ${s.order_number}`,orderNo:s.order_number}}class ne extends Error{constructor(s,r,t){super(s),this.statusCode=r,this.code=t,this.name="AuthError"}}function Da(e){return`${crypto.randomUUID()}-${e}`}function Oa(e){var n,o,i,c,l,u,d;const s=e.id.toString(),r=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",t=((c=e.kakao_account)==null?void 0:c.email)||null,a=((l=e.properties)==null?void 0:l.profile_image)||((d=(u=e.kakao_account)==null?void 0:u.profile)==null?void 0:d.profile_image_url)||null;return{kakaoId:s,nickname:r,email:t,profileImage:a}}async function ka(e,s,r,t,a){try{const n=await e.prepare(`
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
    `).bind(s,r,t,a).first();if(!n)throw new ne("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",n.id),n}catch(n){throw n instanceof ne?n:(console.error("[Auth] Database error during upsert:",n),new ne("Database error",500,"DB_ERROR"))}}async function Ca(e){try{const s=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!s.ok){const t=await s.text();throw console.error("[Kakao API] Failed to get user info:",t),new ne("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const r=await s.json();if(!r.id)throw new ne("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return r}catch(s){throw s instanceof ne?s:(console.error("[Kakao API] Network error:",s),new ne("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function Na(e,s,r){try{const t=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:r,redirect_uri:s,code:e}).toString()});if(!t.ok){const n=await t.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new ne(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await t.json()).access_token}catch(t){throw t instanceof ne?t:(console.error("[Kakao OAuth] Network error:",t),new ne("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function rt(e,s){const r=await Ca(s),{kakaoId:t,nickname:a,email:n,profileImage:o}=Oa(r);console.log("[Auth] Processing login for Kakao user:",t);const i=await ka(e,t,a,n,o),c=Da(i.id);return{user:i,sessionToken:c}}async function tt(e,s,r=30){try{const t=await e.get(s,"json");if(!t)return console.log(`[Cache MISS] ${s}`),null;const a=Date.now()-t.timestamp;return a>r*1e3?(console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${s} (age: ${Math.round(a/1e3)}s)`),t.data)}catch(t){return console.error(`[Cache] Get error for key "${s}":`,t),null}}async function Cs(e,s,r,t=30){try{const a={data:r,timestamp:Date.now()};await e.put(s,JSON.stringify(a),{expirationTtl:t}),console.log(`[Cache SET] ${s} (TTL: ${t}s)`)}catch(a){console.error(`[Cache] Set error for key "${s}":`,a)}}function ja(e){const s=e.req.header("CF-Connecting-IP");if(s)return s;const r=e.req.header("X-Forwarded-For");if(r)return r.split(",")[0].trim();const t=e.req.header("X-Real-IP");return t||"unknown"}function La(e,s){return`ratelimit:${e}:${s}`}const Js=new Map;async function Ma(e,s,r){var m;const t=new URL(e.req.url).pathname,a=La(s,t),n=Date.now(),o=r.windowMs*1e3,c=e.get("user")&&r.authenticatedMultiplier?r.maxRequests*r.authenticatedMultiplier:r.maxRequests;try{const _=(m=e.env)==null?void 0:m.RATE_LIMIT_KV;if(_){const f=await _.get(a);let h;f?(h=JSON.parse(f),n>h.resetTime?h={count:1,resetTime:n+o}:h.count++):h={count:1,resetTime:n+o};const w=Math.ceil(o/1e3);await _.put(a,JSON.stringify(h),{expirationTtl:w});const b=h.count<=c,g=Math.max(0,c-h.count);return{allowed:b,remaining:g,resetTime:h.resetTime}}}catch(_){console.error("KV Rate Limit Error:",_)}let l=Js.get(a);l&&n>l.resetTime&&(Js.delete(a),l=void 0),l?l.count++:l={count:1,resetTime:n+o},Js.set(a,l);const u=l.count<=c,d=Math.max(0,c-l.count);return{allowed:u,remaining:d,resetTime:l.resetTime}}function Ue(e){return async(s,r)=>{const t=ja(s);if(e.skipIps&&e.skipIps.includes(t))return r();if(e.pathPattern){const n=new URL(s.req.url).pathname;if(!e.pathPattern.test(n))return r()}const a=await Ma(s,t,e);if(s.header("X-RateLimit-Limit",e.maxRequests.toString()),s.header("X-RateLimit-Remaining",a.remaining.toString()),s.header("X-RateLimit-Reset",new Date(a.resetTime).toISOString()),!a.allowed){const n=Math.ceil((a.resetTime-Date.now())/1e3);return s.header("Retry-After",n.toString()),s.json({success:!1,error:e.message||"Too many requests. Please try again later.",retryAfter:n,resetTime:new Date(a.resetTime).toISOString()},429)}return r()}}const Pe={api:{windowMs:60,maxRequests:60,message:"API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",authenticatedMultiplier:2},auth:{windowMs:60,maxRequests:5,message:"로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",pathPattern:/^\/api\/auth\//},order:{windowMs:60,maxRequests:10,message:"주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/orders/,authenticatedMultiplier:2},cart:{windowMs:60,maxRequests:20,message:"장바구니 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/cart/,authenticatedMultiplier:2},refund:{windowMs:3600,maxRequests:3,message:"환불 요청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.",pathPattern:/^\/api\/orders\/.*\/refund/},alimtalk:{windowMs:60,maxRequests:10,message:"알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/seller\/alimtalk\/send/},upload:{windowMs:60,maxRequests:5,message:"파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/.*\/upload/}};class K extends Error{constructor(s,r,t="VALIDATION_ERROR"){super(r),this.field=s,this.code=t,this.name="ValidationError"}}function Fa(e,s){const{field:r,required:t,type:a,min:n,max:o,pattern:i,enum:c,custom:l,message:u}=s;if(t&&(e==null||e===""))throw new K(r,u||`${r}은(는) 필수 항목입니다.`,"REQUIRED");if(!(e==null||e==="")){if(a)switch(a){case"string":if(typeof e!="string")throw new K(r,u||`${r}은(는) 문자열이어야 합니다.`,"INVALID_TYPE");break;case"number":const d=typeof e=="string"?Number(e):e;if(typeof d!="number"||isNaN(d))throw new K(r,u||`${r}은(는) 숫자여야 합니다.`,"INVALID_TYPE");break;case"boolean":if(typeof e!="boolean")throw new K(r,u||`${r}은(는) true/false 값이어야 합니다.`,"INVALID_TYPE");break;case"email":if(typeof e!="string"||!Pa(e))throw new K(r,u||`${r}은(는) 유효한 이메일 주소여야 합니다.`,"INVALID_EMAIL");break;case"url":if(typeof e!="string"||!xa(e))throw new K(r,u||`${r}은(는) 유효한 URL이어야 합니다.`,"INVALID_URL");break;case"phone":if(typeof e!="string"||!Wa(e))throw new K(r,u||`${r}은(는) 유효한 전화번호여야 합니다.`,"INVALID_PHONE");break;case"date":if(!(e instanceof Date)&&!qa(e))throw new K(r,u||`${r}은(는) 유효한 날짜여야 합니다.`,"INVALID_DATE");break;case"array":if(!Array.isArray(e))throw new K(r,u||`${r}은(는) 배열이어야 합니다.`,"INVALID_TYPE");break;case"object":if(typeof e!="object"||e===null||Array.isArray(e))throw new K(r,u||`${r}은(는) 객체여야 합니다.`,"INVALID_TYPE");break}if(typeof e=="string"){if(n!==void 0&&e.length<n)throw new K(r,u||`${r}은(는) 최소 ${n}자 이상이어야 합니다.`,"TOO_SHORT");if(o!==void 0&&e.length>o)throw new K(r,u||`${r}은(는) 최대 ${o}자 이하여야 합니다.`,"TOO_LONG")}if(typeof e=="number"){if(n!==void 0&&e<n)throw new K(r,u||`${r}은(는) 최소 ${n} 이상이어야 합니다.`,"TOO_SMALL");if(o!==void 0&&e>o)throw new K(r,u||`${r}은(는) 최대 ${o} 이하여야 합니다.`,"TOO_LARGE")}if(Array.isArray(e)){if(n!==void 0&&e.length<n)throw new K(r,u||`${r}은(는) 최소 ${n}개 이상이어야 합니다.`,"TOO_FEW");if(o!==void 0&&e.length>o)throw new K(r,u||`${r}은(는) 최대 ${o}개 이하여야 합니다.`,"TOO_MANY")}if(i&&typeof e=="string"&&!i.test(e))throw new K(r,u||`${r}의 형식이 올바르지 않습니다.`,"INVALID_FORMAT");if(c&&!c.includes(e))throw new K(r,u||`${r}은(는) 다음 중 하나여야 합니다: ${c.join(", ")}`,"INVALID_ENUM");if(l&&l(e)===!1)throw new K(r,u||`${r}의 값이 유효하지 않습니다.`,"CUSTOM_VALIDATION_FAILED")}}function $a(e,s){for(const r of s){const t=e[r.field];Fa(t,r)}}function Ua(e){return async(s,r)=>{try{let t={};const a=s.req.header("content-type")||"";a.includes("application/json")?t=await s.req.json().catch(()=>({})):(a.includes("application/x-www-form-urlencoded")||a.includes("multipart/form-data"))&&(t=await s.req.parseBody().catch(()=>({})));const n=new URL(s.req.url);for(const[o,i]of n.searchParams.entries())o in t||(t[o]=i);$a(t,e),s.set("validatedData",t),await r()}catch(t){if(t instanceof K)return s.json({success:!1,error:t.message,field:t.field,code:t.code},400);throw t}}}function Pa(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=255}function xa(e){try{const s=new URL(e);return s.protocol==="http:"||s.protocol==="https:"}catch{return!1}}function Wa(e){return/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e)}function qa(e){if(typeof e!="string")return!1;const s=new Date(e);return!isNaN(s.getTime())}const Ha=[{field:"email",required:!0,type:"email",max:255,message:"유효한 이메일 주소를 입력해주세요."},{field:"password",required:!0,type:"string",min:8,max:100,pattern:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:"비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다."},{field:"name",required:!0,type:"string",min:2,max:50,message:"이름은 2-50자 사이여야 합니다."},{field:"phone",required:!1,type:"phone",message:"유효한 전화번호를 입력해주세요. (예: 010-1234-5678)"}];function Fs(e){const s=new URLSearchParams;for(const[r,t]of Object.entries(e))t!=null&&s.append(r,String(t));return s}function sr(e,s){if(e.result_code!=="1")throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`)}async function rr(e){console.log("[Aligo] 토큰 생성 시작");const r=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:Fs({apikey:e.ALIGO_API_KEY,userid:e.ALIGO_USER_ID})})).json();return sr(r,"Token Create"),console.log("[Aligo] ✅ 토큰 생성 성공:",r.token.substring(0,20)+"..."),{token:r.token,urtime:r.urtime}}async function Ka(e,s){console.log("[Aligo] 카카오 채널 등록:",s.channelId);const{token:r}=await rr(e),a=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:Fs({token:r,userid:e.ALIGO_USER_ID,plusid:s.channelId,phonenumber:s.phoneNumber})})).json();return sr(a,"Channel Register"),console.log("[Aligo] ✅ 카카오 채널 등록 성공, senderKey:",a.senderkey),{success:!0,senderKey:a.senderkey}}async function Ba(e,s,r){console.log("[Aligo] 템플릿 등록:",r.templateCode);const{token:t}=await rr(e),n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:Fs({token:t,userid:e.ALIGO_USER_ID,senderkey:s,tpl_name:r.name,tpl_content:r.content,tpl_code:r.templateCode})})).json();return sr(n,"Template Register"),console.log("[Aligo] ✅ 템플릿 등록 성공:",n.tpl_code),{success:!0,templateCode:n.tpl_code}}async function tr(e,s){console.log("[Aligo] 알림톡 발송:",s.to);try{const{token:r}=await rr(e),t=s.buttons?JSON.stringify({button:s.buttons}):void 0,n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:Fs({token:r,userid:e.ALIGO_USER_ID,senderkey:s.senderKey,tpl_code:s.templateCode,receiver_1:s.to,subject_1:"알림톡",message_1:s.message,button_1:t})})).json();return n.result_code!=="1"?(console.error("[Aligo] ❌ 알림톡 발송 실패:",n.message),{success:!1,error:n.message}):(console.log("[Aligo] ✅ 알림톡 발송 성공, messageId:",n.msg_id),{success:!0,messageId:n.msg_id})}catch(r){return console.error("[Aligo] ❌ 알림톡 발송 에러:",r.message),{success:!1,error:r.message}}}function Ja(e,s){let r=e;for(const[t,a]of Object.entries(s)){const n=new RegExp(`#{${t}}`,"g");r=r.replace(n,a)}return r}function at(e){let s=e.replace(/-/g,"");if(!s.startsWith("010"))throw new Error("Invalid phone number format. Must start with 010");if(s.length!==11)throw new Error("Invalid phone number length. Must be 11 digits");return s}async function Va(e,s){const r=await e.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(s).first();if(!r)throw new Error(`Order not found: ${s}`);const t=await e.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(s).all();return{order:r,products:t.results}}async function Ya(e,s){const r=await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(s).first();return r||(console.warn(`No active alimtalk account for seller ${s}`),null)}async function _r(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id,s.template_code,s.recipient_phone,s.message,s.cost,s.status,s.order_id||null).run()}async function za(e,s,r){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(r,s).run()}async function Ga(e,s){try{const{order:r,products:t}=await Va(e.DB,s),a=await Ya(e.DB,r.seller_id);if(!a)return console.warn(`Skipping alimtalk for order ${s}: no active account`),{success:!1,reason:"no_account"};const n=15;if(a.balance<n)return console.warn(`Skipping alimtalk for order ${s}: insufficient balance`),{success:!1,reason:"insufficient_balance"};const o=t.map(l=>`${l.name} ${l.quantity}개 (${l.price.toLocaleString()}원)`).join(`
`),i=`[주문 확인]

주문번호: ${r.order_number}
주문일시: ${new Date(r.created_at).toLocaleString("ko-KR")}

주문 상품:
${o}

총 결제금액: ${r.total_amount.toLocaleString()}원

배송지: ${r.shipping_address}
수령인: ${r.shipping_name}
연락처: ${r.shipping_phone}

주문해 주셔서 감사합니다!`,c=await tr(e,{senderKey:a.sender_key,templateCode:"order_confirm",to:r.buyer_phone,message:i});return c.success?(await za(e.DB,r.seller_id,n),await _r(e.DB,{seller_id:r.seller_id,template_code:"order_confirm",recipient_phone:r.buyer_phone,message:i,cost:n,status:"sent",order_id:s}),console.log(`Order confirmation sent for order ${s}`),{success:!0}):(await _r(e.DB,{seller_id:r.seller_id,template_code:"order_confirm",recipient_phone:r.buyer_phone,message:i,cost:0,status:"failed",order_id:s}),console.error(`Failed to send order confirmation for order ${s}:`,c.error),{success:!1,error:c.error})}catch(r){return console.error(`Error sending order confirmation for order ${s}:`,r),{success:!1,error:r.message}}}function Xa(e,s){let r=e;return Object.entries(s).forEach(([t,a])=>{const n=new RegExp(`#{${t}}`,"g");r=r.replace(n,a)}),r}function Qa(e,s){const t=Array.from(e.matchAll(/#{(\w+)}/g),a=>a[1]).filter(a=>!s[a]);return{valid:t.length===0,missingVars:t}}async function Za(e,s,r){const t=await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();if(!t)throw new Error(`Account not found: ${s}`);return{sufficient:t.balance>=r,currentBalance:t.balance}}async function en(e,s,r){const t=await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(r,s,r).run();if(!t.success||t.meta.changes===0)throw new Error("Insufficient balance or account not found")}async function fr(e,s,r){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(r,s).run()}async function Vs(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s.accountId,s.templateId,s.orderId||null,s.recipientPhone,s.messageContent,s.status,s.cost,s.aligoMessageId||null,s.failedReason||null).run()}async function sn(e,s,r,t){await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(r,t,s).run()}async function rn(e,s,r,t,a,n,o,i,c){try{const l={...i,...o.variables},u=Xa(t,l),d=await tr(e,{senderKey:a,templateCode:n,to:o.phone,message:u});return d.success?(await Vs(e.DB,{accountId:s,templateId:r,recipientPhone:o.phone,messageContent:u,status:"sent",cost:c,aligoMessageId:d.messageId}),{phone:o.phone,status:"sent",messageId:d.messageId,cost:c}):(await Vs(e.DB,{accountId:s,templateId:r,recipientPhone:o.phone,messageContent:u,status:"failed",cost:0,failedReason:d.error}),await fr(e.DB,s,c),{phone:o.phone,status:"failed",error:d.error,cost:0})}catch(l){return console.error(`Failed to send alimtalk to ${o.phone}:`,l),await Vs(e.DB,{accountId:s,templateId:r,recipientPhone:o.phone,messageContent:"",status:"failed",cost:0,failedReason:l.message}),await fr(e.DB,s,c),{phone:o.phone,status:"failed",error:l.message,cost:0}}}async function ar(e,s){const{accountId:r,templateId:t,recipients:a,variables:n}=s;console.log(`[Alimtalk] Starting bulk send: ${a.length} recipients`);try{const o=await e.DB.prepare(`
      SELECT 
        id,
        sender_key,
        balance,
        status
      FROM alimtalk_accounts
      WHERE id = ?
    `).bind(r).first();if(!o)throw new Error("Account not found");if(o.status!=="active")throw new Error("Account is not active");const i=await e.DB.prepare(`
      SELECT 
        id,
        template_code,
        template_content,
        status
      FROM alimtalk_templates
      WHERE id = ? AND account_id = ?
    `).bind(t,r).first();if(!i)throw new Error("Template not found");if(i.status!=="approved")throw new Error("Template is not approved");const c=Qa(i.template_content,n);if(!c.valid)throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);const l=15,u=a.length*l,d=await Za(e.DB,r,u);if(!d.sufficient)throw new Error(`Insufficient balance. Required: ${u}, Current: ${d.currentBalance}`);await en(e.DB,r,u),console.log(`[Alimtalk] Deducted ${u} points from account ${r}`);const m=[];let _=0,f=0,h=0;for(const w of a){const b=await rn(e,r,t,i.template_content,o.sender_key,i.template_code,w,n,l);m.push(b),b.status==="sent"?_++:(f++,h+=l),m.length%10===0&&await new Promise(g=>setTimeout(g,1e3))}return await sn(e.DB,r,_,f),console.log(`[Alimtalk] Completed: ${_} sent, ${f} failed, ${h} refunded`),{success:!0,totalRecipients:a.length,successCount:_,failedCount:f,refundedAmount:h,messages:m}}catch(o){return console.error("[Alimtalk] Bulk send failed:",o),{success:!1,totalRecipients:a.length,successCount:0,failedCount:a.length,refundedAmount:0,messages:[],error:o.message}}}async function tn(e,s,r,t,a){const n=await e.DB.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(t).first();if(!n)throw new Error(`Order not found: ${t}`);const i=(await e.DB.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(t).all()).results.map(u=>`${u.name} ${u.quantity}개 (${u.price.toLocaleString()}원)`).join(`
`),c={orderNumber:n.order_number,orderDate:new Date(n.created_at).toLocaleString("ko-KR"),productList:i,totalAmount:n.total_amount.toLocaleString(),shippingAddress:n.shipping_address,shippingName:n.shipping_name,shippingPhone:n.shipping_phone,buyerName:n.buyer_name,customMessage:a||"감사합니다!"},l=[{phone:n.buyer_phone,name:n.buyer_name}];return ar(e,{accountId:s,templateId:r,recipients:l,variables:c})}async function an(e,s,r,t,a={}){const n=t.map(o=>({phone:o.phone,name:o.name,variables:Object.entries(o).filter(([i])=>i!=="phone"&&i!=="name").reduce((i,[c,l])=>({...i,[c]:l}),{})}));return ar(e,{accountId:s,templateId:r,recipients:n,variables:a})}function nn(e,s=.1){return Math.floor(e*s)}function on(){const e=new Date,s=new Date(e.getFullYear(),e.getMonth()-1,1),r=s.getFullYear(),t=String(s.getMonth()+1).padStart(2,"0"),a=new Date(r,s.getMonth()+1,0).getDate();return{startDate:`${r}-${t}-01`,endDate:`${r}-${t}-${a}`}}async function cn(e,s,r){try{const t=await e.prepare(`
      SELECT id, business_name FROM sellers WHERE id = ?
    `).bind(s).first();if(!t)return null;const a=await e.prepare(`
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
    `).bind(s,r.startDate,r.endDate).all();if(!a.results||a.results.length===0)return{seller_id:s,seller_name:t.business_name,total_sales:0,total_orders:0,platform_fee:0,shipping_fee:0,refund_amount:0,settlement_amount:0,orders:[]};const n=[];let o=0,i=0,c=0;for(const m of a.results){const _=m.total_amount-m.shipping_fee,f=nn(_);n.push({order_id:m.id,order_number:m.order_number,order_date:m.created_at,product_name:m.product_names||"",quantity:m.total_quantity||1,price:_,shipping_fee:m.shipping_fee||0,platform_fee:f,status:m.status}),o+=_,i+=m.shipping_fee||0,c+=f}const l=await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(s,r.startDate,r.endDate).first(),u=(l==null?void 0:l.refund_amount)||0,d=o-c-u+i;return{seller_id:s,seller_name:t.business_name,total_sales:o,total_orders:n.length,platform_fee:c,shipping_fee:i,refund_amount:u,settlement_amount:d,orders:n}}catch(t){return console.error(`Failed to calculate settlement for seller ${s}:`,t),null}}async function ln(e,s){console.log(`[Settlement] Generating report for ${s.startDate} ~ ${s.endDate}`);const r=await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(s.startDate,s.endDate).all(),t=[];let a=0,n=0,o=0;for(const c of r.results){const l=await cn(e,c.id,s);l&&(t.push(l),a+=l.total_sales,n+=l.platform_fee,o+=l.settlement_amount)}const i={period:s,generated_at:new Date().toISOString(),total_sales:a,total_platform_fee:n,total_settlement:o,sellers:t};return console.log(`[Settlement] Report generated: ${t.length} sellers, ${a.toLocaleString()}원`),i}async function un(e,s){const t=(await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(s.period.startDate,s.period.endDate,s.total_sales,s.total_platform_fee,s.total_settlement,s.generated_at).run()).meta.last_row_id;for(const a of s.sellers)await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a.seller_id,a.total_sales,a.total_orders,a.platform_fee,a.shipping_fee,a.refund_amount,a.settlement_amount).run();console.log(`[Settlement] Report saved: ID ${t}`)}async function dn(e,s){const r=await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(s).first();if(!r)return null;const a=(await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(s).all()).results.map(n=>({seller_id:n.seller_id,seller_name:n.seller_name,total_sales:n.total_sales,total_orders:n.total_orders,platform_fee:n.platform_fee,shipping_fee:n.shipping_fee,refund_amount:n.refund_amount,settlement_amount:n.settlement_amount,orders:[]}));return{period:{startDate:r.period_start,endDate:r.period_end},generated_at:r.generated_at,total_sales:r.total_sales,total_platform_fee:r.total_platform_fee,total_settlement:r.total_settlement,sellers:a}}async function pn(e,s){const r=new TextEncoder;let t;const a=new ReadableStream({async start(n){console.log(`[SSE] Client connected to stream ${e}`);try{const o=await s.DB.prepare(`
          SELECT 
            id,
            title,
            status,
            viewer_count,
            like_count
          FROM live_streams
          WHERE id = ?
        `).bind(e).first();if(o){const i={type:"status",data:o,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(r.encode(`data: ${c}

`))}}catch(o){console.error("[SSE] Failed to fetch initial data:",o)}t=setInterval(async()=>{try{const o=await s.DB.prepare(`
            SELECT 
              viewer_count,
              like_count,
              comment_count
            FROM live_streams
            WHERE id = ?
          `).bind(e).first();if(o){const i={type:"viewer_count",data:o,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(r.encode(`data: ${c}

`))}n.enqueue(r.encode(`: ping

`))}catch(o){console.error("[SSE] Update failed:",o)}},3e4)},cancel(){console.log(`[SSE] Client disconnected from stream ${e}`),t&&clearInterval(t)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function mn(e,s){const r=new TextEncoder;let t=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Chat] Client connected to stream ${e}`);try{const i=await s.DB.prepare(`
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
        `).bind(e).all();if(i.results.length>0){t=i.results[0].id;const c={type:"chat",data:i.results.reverse(),timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(r.encode(`data: ${l}

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
          `).bind(e,t).all();if(i.results.length>0){t=i.results[i.results.length-1].id;const c={type:"chat",data:i.results,timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(r.encode(`data: ${l}

`))}else o.enqueue(r.encode(`: ping

`))}catch(i){console.error("[SSE Chat] Polling failed:",i)}},5e3)},cancel(){console.log(`[SSE Chat] Client disconnected from stream ${e}`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function _n(e,s){const r=new TextEncoder;let t=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Orders] Seller ${e} connected`);try{const i=await s.DB.prepare(`
          SELECT id FROM orders
          WHERE seller_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).bind(e).first();i&&(t=i.id)}catch(i){console.error("[SSE Orders] Failed to fetch last order:",i)}a=setInterval(async()=>{try{const i=await s.DB.prepare(`
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
          `).bind(e,t).all();if(i.results.length>0){t=i.results[i.results.length-1].id;const c={type:"order",data:i.results,timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(r.encode(`data: ${l}

`))}else o.enqueue(r.encode(`: ping

`))}catch(i){console.error("[SSE Orders] Polling failed:",i)}},1e4)},cancel(){console.log(`[SSE Orders] Seller ${e} disconnected`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function fn(e,s){const r=new TextEncoder;let t;const a=new ReadableStream({async start(n){console.log(`[SSE Stock] Seller ${e} connected`),t=setInterval(async()=>{try{const o=await s.DB.prepare(`
            SELECT 
              id,
              name,
              stock,
              low_stock_threshold
            FROM products
            WHERE seller_id = ?
              AND stock <= low_stock_threshold
              AND stock > 0
          `).bind(e).all();if(o.results.length>0){const i={type:"stock",data:o.results,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(r.encode(`data: ${c}

`))}else n.enqueue(r.encode(`: ping

`))}catch(o){console.error("[SSE Stock] Polling failed:",o)}},6e4)},cancel(){console.log(`[SSE Stock] Seller ${e} disconnected`),t&&clearInterval(t)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function En(e,s,r,t){await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s,r,t.endpoint,t.keys.p256dh,t.keys.auth).run(),console.log(`[Push] Subscription saved for ${r} ${s}`)}async function hn(e,s){await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(),console.log(`[Push] Subscription deleted: ${s}`)}function gn(e){if(e.req.method!=="GET")return!1;const s=e.req.header("Authorization"),r=e.req.header("X-Session-Token");if(s||r)return!1;const a=new URL(e.req.url).pathname;return!(a.includes("/api/products/")&&a.includes("/stock")||a.includes("/api/streams/")&&a.includes("/status")||a.includes("/current-product")||a.includes("/api/chat")||a.includes("/api/sse")||a.includes("/api/orders")||a.includes("/api/payment"))}function yn(e,s){return s||new URL(e.req.url).toString()}function bn(e){const s=[];return s.push("public"),s.push(`max-age=${e.ttl}`),e.sMaxAge!==void 0?s.push(`s-maxage=${e.sMaxAge}`):s.push(`s-maxage=${e.ttl}`),e.staleWhileRevalidate&&s.push(`stale-while-revalidate=${e.staleWhileRevalidate}`),s.join(", ")}function $s(e){return async(s,r)=>{var i;if(e.skipCache||!gn(s))return r();const t=yn(s,e.cacheKey),a=caches.default;let n=await a.match(t);if(n){console.log(`[Cache HIT] ${t}`);const c=new Headers(n.headers);return c.set("X-Cache","HIT"),c.set("X-Cache-Key",t),new Response(n.body,{status:n.status,statusText:n.statusText,headers:c})}console.log(`[Cache MISS] ${t}`),await r();const o=s.res;if(o.status>=200&&o.status<300){const c=bn(e);o.headers.set("Cache-Control",c),o.headers.set("X-Cache","MISS"),o.headers.set("X-Cache-Key",t);const l=e.varyBy||["Accept-Encoding"];o.headers.set("Vary",l.join(", "));const u=o.clone();(i=s.executionCtx)==null||i.waitUntil(a.put(t,u))}}}const Us={products:{ttl:10,sMaxAge:60,staleWhileRevalidate:120},liveStreams:{ttl:5,sMaxAge:10,staleWhileRevalidate:30},microCache:{ttl:10,sMaxAge:10,staleWhileRevalidate:30}};class wn extends Error{constructor(s,r,t,a){super(t),this.statusCode=s,this.code=r,this.details=a,this.name="AppError",Error.captureStackTrace(this,this.constructor)}}async function Sn(e,s,r,t){if(e)try{const a={title:`✅ ${s}`,description:r,color:3066993,fields:[],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Monitor"}};if(t)for(const[n,o]of Object.entries(t))a.fields.push({name:n,value:String(o),inline:!0});await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[a]})})}catch(a){console.error("[Discord] Failed to send success alert:",a)}}async function Tn(e,s,r){if(e)try{const t=["📊 **KV 사용량 경고**","","현재 사용량:",`• 읽기: ${s.toFixed(1)}%`,`• 쓰기: ${r.toFixed(1)}%`,"","50% 이상 사용 중입니다. 유료 플랜 업그레이드를 고려하세요.","https://dash.cloudflare.com"].join(`
`);await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:t})})}catch(t){console.error("[Discord] Failed to send KV warning:",t)}}class nt{constructor(s){this.accessToken=null,this.tokenExpiry=0,this.databaseURL=s.FIREBASE_DATABASE_URL,this.projectId=s.FIREBASE_PROJECT_ID,this.privateKey=s.FIREBASE_PRIVATE_KEY,this.clientEmail=s.FIREBASE_CLIENT_EMAIL,(!this.databaseURL||!this.projectId||!this.privateKey||!this.clientEmail)&&console.warn("⚠️ Firebase Admin credentials not configured, using unauthenticated mode")}async set(s,r){const t=`${this.databaseURL}/${s}.json`,a=await fetch(t,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)});if(!a.ok){const n=await a.text();throw console.error(`❌ Firebase set failed for ${s}:`,n),new Error(`Firebase set failed: ${a.statusText}`)}console.log(`✅ Firebase: Set data at ${s}`)}async update(s,r){const t=`${this.databaseURL}/${s}.json`,a=await fetch(t,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)});if(!a.ok){const n=await a.text();throw console.error(`❌ Firebase update failed for ${s}:`,n),new Error(`Firebase update failed: ${a.statusText}`)}console.log(`✅ Firebase: Updated data at ${s}`)}async get(s){const r=`${this.databaseURL}/${s}.json`,t=await fetch(r,{method:"GET"});if(!t.ok)throw new Error(`Firebase get failed: ${t.statusText}`);return await t.json()}async delete(s){const r=`${this.databaseURL}/${s}.json`,t=await fetch(r,{method:"DELETE"});if(!t.ok)throw new Error(`Firebase delete failed: ${t.statusText}`);console.log(`✅ Firebase: Deleted data at ${s}`)}async updateStreamStatus(s,r){try{await this.update(`streams/stream${s}`,{...r,updated_at:Date.now()}),console.log(`✅ Firebase: Stream ${s} updated`,r)}catch(t){console.error(`❌ Firebase: Failed to update stream ${s}`,t)}}async updateProductStock(s,r,t){try{await this.update(`products/product${s}`,{id:s,stock:r,...t,updated_at:Date.now()}),console.log(`✅ Firebase: Product ${s} stock updated to ${r}`)}catch(a){console.error(`❌ Firebase: Failed to update product ${s}`,a)}}async changeCurrentProduct(s,r){try{await this.updateStreamStatus(s,{current_product_id:r}),console.log(`✅ Firebase: Stream ${s} current product changed to ${r}`)}catch(t){console.error(`❌ Firebase: Failed to change product for stream ${s}`,t)}}async sendLowStockAlert(s,r,t){try{const a=`chats/stream${s}`,n=Date.now();await this.set(`${a}/alert_${n}`,{username:"시스템",text:`⚠️ ${r}의 재고가 ${t}개 남았습니다!`,timestamp:n,isSystem:!0}),console.log(`✅ Firebase: Low stock alert sent for stream ${s}`)}catch(a){console.error("❌ Firebase: Failed to send low stock alert",a)}}async sendSoldOutAlert(s,r){try{const t=`chats/stream${s}`,a=Date.now();await this.set(`${t}/soldout_${a}`,{username:"시스템",text:`🔴 ${r}이(가) 품절되었습니다!`,timestamp:a,isSystem:!0}),console.log(`✅ Firebase: Sold out alert sent for stream ${s}`)}catch(t){console.error("❌ Firebase: Failed to send sold out alert",t)}}async createCustomToken(s,r){try{if(console.log(`[Firebase Custom Token] Creating for UID: ${s}`),console.log("[Firebase Custom Token] Claims:",JSON.stringify(r)),!this.privateKey||!this.clientEmail||!this.projectId){const b=[];throw this.privateKey||b.push("FIREBASE_PRIVATE_KEY"),this.clientEmail||b.push("FIREBASE_CLIENT_EMAIL"),this.projectId||b.push("FIREBASE_PROJECT_ID"),new Error(`Firebase credentials not configured: missing ${b.join(", ")}`)}console.log(`[Firebase Custom Token] Using project: ${this.projectId}`),console.log(`[Firebase Custom Token] Using service account: ${this.clientEmail}`);const t={alg:"RS256",typ:"JWT"},a=Math.floor(Date.now()/1e3),n={iss:this.clientEmail,sub:this.clientEmail,aud:"https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",iat:a,exp:a+3600,uid:s,claims:r||{}},o=b=>{const g=JSON.stringify(b),T=new TextEncoder().encode(g);let y="";for(let L=0;L<T.length;L++)y+=String.fromCharCode(T[L]);return btoa(y).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")};console.log("[Firebase Custom Token] Encoding header and payload...");const i=o(t),c=o(n),l=`${i}.${c}`;console.log("[Firebase Custom Token] Parsing private key...");const u=this.privateKey.replace(/\\n/g,`
`);if(!u.includes("-----BEGIN PRIVATE KEY-----"))throw new Error("Invalid private key format: missing PEM header");if(!u.includes("-----END PRIVATE KEY-----"))throw new Error("Invalid private key format: missing PEM footer");console.log("[Firebase Custom Token] Converting PEM to DER...");const d=await this.pemToDer(u);console.log("[Firebase Custom Token] Importing crypto key...");const m=await crypto.subtle.importKey("pkcs8",d,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},!1,["sign"]);console.log("[Firebase Custom Token] Signing token...");const _=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",m,new TextEncoder().encode(l)),h=btoa(String.fromCharCode(...new Uint8Array(_))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,""),w=`${l}.${h}`;return console.log("[Firebase Custom Token] ✅ Token created successfully"),w}catch(t){throw console.error("[Firebase Custom Token] ❌ Failed to create token:",t),console.error("[Firebase Custom Token] Error name:",t.name),console.error("[Firebase Custom Token] Error message:",t.message),console.error("[Firebase Custom Token] Error stack:",t.stack),new Error(`Failed to create Firebase custom token: ${t.message}`)}}async pemToDer(s){const a=s.substring("-----BEGIN PRIVATE KEY-----".length,s.length-"-----END PRIVATE KEY-----".length-1).trim(),n=atob(a),o=new Uint8Array(n.length);for(let i=0;i<n.length;i++)o[i]=n.charCodeAt(i);return o.buffer}}function Ae(e){return new nt(e)}async function Rn(e,s,r){try{s==="stream"?await e.updateStreamStatus(r.id,{id:r.id,title:r.title,status:r.status,current_product_id:r.current_product_id,viewer_count:r.viewer_count||0,seller_id:r.seller_id,youtube_video_id:r.youtube_video_id}):s==="product"&&await e.updateProductStock(r.id,r.stock,{name:r.name,price:r.price,original_price:r.original_price,discount_rate:r.discount_rate,image_url:r.image_url})}catch(t){console.error(`❌ Firebase sync failed for ${s}:`,t)}}const In=Object.freeze(Object.defineProperty({__proto__:null,FirebaseAdmin:nt,initFirebaseAdmin:Ae,syncD1ToFirebase:Rn},Symbol.toStringTag,{value:"Module"})),nr=crypto,ot=e=>e instanceof CryptoKey,Rs=new TextEncoder,Ps=new TextDecoder;function vn(...e){const s=e.reduce((a,{length:n})=>a+n,0),r=new Uint8Array(s);let t=0;for(const a of e)r.set(a,t),t+=a.length;return r}const An=e=>{const s=atob(e),r=new Uint8Array(s.length);for(let t=0;t<s.length;t++)r[t]=s.charCodeAt(t);return r},Fe=e=>{let s=e;s instanceof Uint8Array&&(s=Ps.decode(s)),s=s.replace(/-/g,"+").replace(/_/g,"/").replace(/\s/g,"");try{return An(s)}catch{throw new TypeError("The input to be decoded is not correctly encoded.")}};class X extends Error{constructor(s,r){var t;super(s,r),this.code="ERR_JOSE_GENERIC",this.name=this.constructor.name,(t=Error.captureStackTrace)==null||t.call(Error,this,this.constructor)}}X.code="ERR_JOSE_GENERIC";class ie extends X{constructor(s,r,t="unspecified",a="unspecified"){super(s,{cause:{claim:t,reason:a,payload:r}}),this.code="ERR_JWT_CLAIM_VALIDATION_FAILED",this.claim=t,this.reason=a,this.payload=r}}ie.code="ERR_JWT_CLAIM_VALIDATION_FAILED";class ds extends X{constructor(s,r,t="unspecified",a="unspecified"){super(s,{cause:{claim:t,reason:a,payload:r}}),this.code="ERR_JWT_EXPIRED",this.claim=t,this.reason=a,this.payload=r}}ds.code="ERR_JWT_EXPIRED";class it extends X{constructor(){super(...arguments),this.code="ERR_JOSE_ALG_NOT_ALLOWED"}}it.code="ERR_JOSE_ALG_NOT_ALLOWED";class me extends X{constructor(){super(...arguments),this.code="ERR_JOSE_NOT_SUPPORTED"}}me.code="ERR_JOSE_NOT_SUPPORTED";class Dn extends X{constructor(s="decryption operation failed",r){super(s,r),this.code="ERR_JWE_DECRYPTION_FAILED"}}Dn.code="ERR_JWE_DECRYPTION_FAILED";class On extends X{constructor(){super(...arguments),this.code="ERR_JWE_INVALID"}}On.code="ERR_JWE_INVALID";class V extends X{constructor(){super(...arguments),this.code="ERR_JWS_INVALID"}}V.code="ERR_JWS_INVALID";class ys extends X{constructor(){super(...arguments),this.code="ERR_JWT_INVALID"}}ys.code="ERR_JWT_INVALID";class kn extends X{constructor(){super(...arguments),this.code="ERR_JWK_INVALID"}}kn.code="ERR_JWK_INVALID";class or extends X{constructor(){super(...arguments),this.code="ERR_JWKS_INVALID"}}or.code="ERR_JWKS_INVALID";class ir extends X{constructor(s="no applicable key found in the JSON Web Key Set",r){super(s,r),this.code="ERR_JWKS_NO_MATCHING_KEY"}}ir.code="ERR_JWKS_NO_MATCHING_KEY";class ct extends X{constructor(s="multiple matching keys found in the JSON Web Key Set",r){super(s,r),this.code="ERR_JWKS_MULTIPLE_MATCHING_KEYS"}}ct.code="ERR_JWKS_MULTIPLE_MATCHING_KEYS";class lt extends X{constructor(s="request timed out",r){super(s,r),this.code="ERR_JWKS_TIMEOUT"}}lt.code="ERR_JWKS_TIMEOUT";class ut extends X{constructor(s="signature verification failed",r){super(s,r),this.code="ERR_JWS_SIGNATURE_VERIFICATION_FAILED"}}ut.code="ERR_JWS_SIGNATURE_VERIFICATION_FAILED";function pe(e,s="algorithm.name"){return new TypeError(`CryptoKey does not support this operation, its ${s} must be ${e}`)}function is(e,s){return e.name===s}function Ys(e){return parseInt(e.name.slice(4),10)}function Cn(e){switch(e){case"ES256":return"P-256";case"ES384":return"P-384";case"ES512":return"P-521";default:throw new Error("unreachable")}}function Nn(e,s){if(s.length&&!s.some(r=>e.usages.includes(r))){let r="CryptoKey does not support this operation, its usages must include ";if(s.length>2){const t=s.pop();r+=`one of ${s.join(", ")}, or ${t}.`}else s.length===2?r+=`one of ${s[0]} or ${s[1]}.`:r+=`${s[0]}.`;throw new TypeError(r)}}function jn(e,s,...r){switch(s){case"HS256":case"HS384":case"HS512":{if(!is(e.algorithm,"HMAC"))throw pe("HMAC");const t=parseInt(s.slice(2),10);if(Ys(e.algorithm.hash)!==t)throw pe(`SHA-${t}`,"algorithm.hash");break}case"RS256":case"RS384":case"RS512":{if(!is(e.algorithm,"RSASSA-PKCS1-v1_5"))throw pe("RSASSA-PKCS1-v1_5");const t=parseInt(s.slice(2),10);if(Ys(e.algorithm.hash)!==t)throw pe(`SHA-${t}`,"algorithm.hash");break}case"PS256":case"PS384":case"PS512":{if(!is(e.algorithm,"RSA-PSS"))throw pe("RSA-PSS");const t=parseInt(s.slice(2),10);if(Ys(e.algorithm.hash)!==t)throw pe(`SHA-${t}`,"algorithm.hash");break}case"EdDSA":{if(e.algorithm.name!=="Ed25519"&&e.algorithm.name!=="Ed448")throw pe("Ed25519 or Ed448");break}case"Ed25519":{if(!is(e.algorithm,"Ed25519"))throw pe("Ed25519");break}case"ES256":case"ES384":case"ES512":{if(!is(e.algorithm,"ECDSA"))throw pe("ECDSA");const t=Cn(s);if(e.algorithm.namedCurve!==t)throw pe(t,"algorithm.namedCurve");break}default:throw new TypeError("CryptoKey does not support this operation")}Nn(e,r)}function dt(e,s,...r){var t;if(r=r.filter(Boolean),r.length>2){const a=r.pop();e+=`one of type ${r.join(", ")}, or ${a}.`}else r.length===2?e+=`one of type ${r[0]} or ${r[1]}.`:e+=`of type ${r[0]}.`;return s==null?e+=` Received ${s}`:typeof s=="function"&&s.name?e+=` Received function ${s.name}`:typeof s=="object"&&s!=null&&(t=s.constructor)!=null&&t.name&&(e+=` Received an instance of ${s.constructor.name}`),e}const Er=(e,...s)=>dt("Key must be ",e,...s);function pt(e,s,...r){return dt(`Key for the ${e} algorithm must be `,s,...r)}const mt=e=>ot(e)?!0:(e==null?void 0:e[Symbol.toStringTag])==="KeyObject",Ns=["CryptoKey"],Ln=(...e)=>{const s=e.filter(Boolean);if(s.length===0||s.length===1)return!0;let r;for(const t of s){const a=Object.keys(t);if(!r||r.size===0){r=new Set(a);continue}for(const n of a){if(r.has(n))return!1;r.add(n)}}return!0};function Mn(e){return typeof e=="object"&&e!==null}function ve(e){if(!Mn(e)||Object.prototype.toString.call(e)!=="[object Object]")return!1;if(Object.getPrototypeOf(e)===null)return!0;let s=e;for(;Object.getPrototypeOf(s)!==null;)s=Object.getPrototypeOf(s);return Object.getPrototypeOf(e)===s}const Fn=(e,s)=>{if(e.startsWith("RS")||e.startsWith("PS")){const{modulusLength:r}=s.algorithm;if(typeof r!="number"||r<2048)throw new TypeError(`${e} requires key modulusLength to be 2048 bits or larger`)}};function rs(e){return ve(e)&&typeof e.kty=="string"}function $n(e){return e.kty!=="oct"&&typeof e.d=="string"}function Un(e){return e.kty!=="oct"&&typeof e.d>"u"}function Pn(e){return rs(e)&&e.kty==="oct"&&typeof e.k=="string"}function xn(e){let s,r;switch(e.kty){case"RSA":{switch(e.alg){case"PS256":case"PS384":case"PS512":s={name:"RSA-PSS",hash:`SHA-${e.alg.slice(-3)}`},r=e.d?["sign"]:["verify"];break;case"RS256":case"RS384":case"RS512":s={name:"RSASSA-PKCS1-v1_5",hash:`SHA-${e.alg.slice(-3)}`},r=e.d?["sign"]:["verify"];break;case"RSA-OAEP":case"RSA-OAEP-256":case"RSA-OAEP-384":case"RSA-OAEP-512":s={name:"RSA-OAEP",hash:`SHA-${parseInt(e.alg.slice(-3),10)||1}`},r=e.d?["decrypt","unwrapKey"]:["encrypt","wrapKey"];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}case"EC":{switch(e.alg){case"ES256":s={name:"ECDSA",namedCurve:"P-256"},r=e.d?["sign"]:["verify"];break;case"ES384":s={name:"ECDSA",namedCurve:"P-384"},r=e.d?["sign"]:["verify"];break;case"ES512":s={name:"ECDSA",namedCurve:"P-521"},r=e.d?["sign"]:["verify"];break;case"ECDH-ES":case"ECDH-ES+A128KW":case"ECDH-ES+A192KW":case"ECDH-ES+A256KW":s={name:"ECDH",namedCurve:e.crv},r=e.d?["deriveBits"]:[];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}case"OKP":{switch(e.alg){case"Ed25519":s={name:"Ed25519"},r=e.d?["sign"]:["verify"];break;case"EdDSA":s={name:e.crv},r=e.d?["sign"]:["verify"];break;case"ECDH-ES":case"ECDH-ES+A128KW":case"ECDH-ES+A192KW":case"ECDH-ES+A256KW":s={name:e.crv},r=e.d?["deriveBits"]:[];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}default:throw new me('Invalid or unsupported JWK "kty" (Key Type) Parameter value')}return{algorithm:s,keyUsages:r}}const _t=async e=>{if(!e.alg)throw new TypeError('"alg" argument is required when "jwk.alg" is not present');const{algorithm:s,keyUsages:r}=xn(e),t=[s,e.ext??!1,e.key_ops??r],a={...e};return delete a.alg,delete a.use,nr.subtle.importKey("jwk",a,...t)},ft=e=>Fe(e);let He,Ke;const Et=e=>(e==null?void 0:e[Symbol.toStringTag])==="KeyObject",js=async(e,s,r,t,a=!1)=>{let n=e.get(s);if(n!=null&&n[t])return n[t];const o=await _t({...r,alg:t});return a&&Object.freeze(s),n?n[t]=o:e.set(s,{[t]:o}),o},Wn=(e,s)=>{if(Et(e)){let r=e.export({format:"jwk"});return delete r.d,delete r.dp,delete r.dq,delete r.p,delete r.q,delete r.qi,r.k?ft(r.k):(Ke||(Ke=new WeakMap),js(Ke,e,r,s))}return rs(e)?e.k?Fe(e.k):(Ke||(Ke=new WeakMap),js(Ke,e,e,s,!0)):e},qn=(e,s)=>{if(Et(e)){let r=e.export({format:"jwk"});return r.k?ft(r.k):(He||(He=new WeakMap),js(He,e,r,s))}return rs(e)?e.k?Fe(e.k):(He||(He=new WeakMap),js(He,e,e,s,!0)):e},Hn={normalizePublicKey:Wn,normalizePrivateKey:qn};async function ht(e,s){if(!ve(e))throw new TypeError("JWK must be an object");switch(s||(s=e.alg),e.kty){case"oct":if(typeof e.k!="string"||!e.k)throw new TypeError('missing "k" (Key Value) Parameter value');return Fe(e.k);case"RSA":if("oth"in e&&e.oth!==void 0)throw new me('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');case"EC":case"OKP":return _t({...e,alg:s});default:throw new me('Unsupported "kty" (Key Type) Parameter value')}}const Ye=e=>e==null?void 0:e[Symbol.toStringTag],Qs=(e,s,r)=>{var t,a;if(s.use!==void 0&&s.use!=="sig")throw new TypeError("Invalid key for this operation, when present its use must be sig");if(s.key_ops!==void 0&&((a=(t=s.key_ops).includes)==null?void 0:a.call(t,r))!==!0)throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${r}`);if(s.alg!==void 0&&s.alg!==e)throw new TypeError(`Invalid key for this operation, when present its alg must be ${e}`);return!0},Kn=(e,s,r,t)=>{if(!(s instanceof Uint8Array)){if(t&&rs(s)){if(Pn(s)&&Qs(e,s,r))return;throw new TypeError('JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present')}if(!mt(s))throw new TypeError(pt(e,s,...Ns,"Uint8Array",t?"JSON Web Key":null));if(s.type!=="secret")throw new TypeError(`${Ye(s)} instances for symmetric algorithms must be of type "secret"`)}},Bn=(e,s,r,t)=>{if(t&&rs(s))switch(r){case"sign":if($n(s)&&Qs(e,s,r))return;throw new TypeError("JSON Web Key for this operation be a private JWK");case"verify":if(Un(s)&&Qs(e,s,r))return;throw new TypeError("JSON Web Key for this operation be a public JWK")}if(!mt(s))throw new TypeError(pt(e,s,...Ns,t?"JSON Web Key":null));if(s.type==="secret")throw new TypeError(`${Ye(s)} instances for asymmetric algorithms must not be of type "secret"`);if(r==="sign"&&s.type==="public")throw new TypeError(`${Ye(s)} instances for asymmetric algorithm signing must be of type "private"`);if(r==="decrypt"&&s.type==="public")throw new TypeError(`${Ye(s)} instances for asymmetric algorithm decryption must be of type "private"`);if(s.algorithm&&r==="verify"&&s.type==="private")throw new TypeError(`${Ye(s)} instances for asymmetric algorithm verifying must be of type "public"`);if(s.algorithm&&r==="encrypt"&&s.type==="private")throw new TypeError(`${Ye(s)} instances for asymmetric algorithm encryption must be of type "public"`)};function gt(e,s,r,t){s.startsWith("HS")||s==="dir"||s.startsWith("PBES2")||/^A\d{3}(?:GCM)?KW$/.test(s)?Kn(s,r,t,e):Bn(s,r,t,e)}gt.bind(void 0,!1);const hr=gt.bind(void 0,!0);function Jn(e,s,r,t,a){if(a.crit!==void 0&&(t==null?void 0:t.crit)===void 0)throw new e('"crit" (Critical) Header Parameter MUST be integrity protected');if(!t||t.crit===void 0)return new Set;if(!Array.isArray(t.crit)||t.crit.length===0||t.crit.some(o=>typeof o!="string"||o.length===0))throw new e('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');let n;r!==void 0?n=new Map([...Object.entries(r),...s.entries()]):n=s;for(const o of t.crit){if(!n.has(o))throw new me(`Extension Header Parameter "${o}" is not recognized`);if(a[o]===void 0)throw new e(`Extension Header Parameter "${o}" is missing`);if(n.get(o)&&t[o]===void 0)throw new e(`Extension Header Parameter "${o}" MUST be integrity protected`)}return new Set(t.crit)}const Vn=(e,s)=>{if(s!==void 0&&(!Array.isArray(s)||s.some(r=>typeof r!="string")))throw new TypeError(`"${e}" option must be an array of strings`);if(s)return new Set(s)};function Yn(e,s){const r=`SHA-${e.slice(-3)}`;switch(e){case"HS256":case"HS384":case"HS512":return{hash:r,name:"HMAC"};case"PS256":case"PS384":case"PS512":return{hash:r,name:"RSA-PSS",saltLength:e.slice(-3)>>3};case"RS256":case"RS384":case"RS512":return{hash:r,name:"RSASSA-PKCS1-v1_5"};case"ES256":case"ES384":case"ES512":return{hash:r,name:"ECDSA",namedCurve:s.namedCurve};case"Ed25519":return{name:"Ed25519"};case"EdDSA":return{name:s.name};default:throw new me(`alg ${e} is not supported either by JOSE or your javascript runtime`)}}async function zn(e,s,r){if(s=await Hn.normalizePublicKey(s,e),ot(s))return jn(s,e,r),s;if(s instanceof Uint8Array){if(!e.startsWith("HS"))throw new TypeError(Er(s,...Ns));return nr.subtle.importKey("raw",s,{hash:`SHA-${e.slice(-3)}`,name:"HMAC"},!1,[r])}throw new TypeError(Er(s,...Ns,"Uint8Array","JSON Web Key"))}const Gn=async(e,s,r,t)=>{const a=await zn(e,s,"verify");Fn(e,a);const n=Yn(e,a.algorithm);try{return await nr.subtle.verify(n,a,r,t)}catch{return!1}};async function Xn(e,s,r){if(!ve(e))throw new V("Flattened JWS must be an object");if(e.protected===void 0&&e.header===void 0)throw new V('Flattened JWS must have either of the "protected" or "header" members');if(e.protected!==void 0&&typeof e.protected!="string")throw new V("JWS Protected Header incorrect type");if(e.payload===void 0)throw new V("JWS Payload missing");if(typeof e.signature!="string")throw new V("JWS Signature missing or incorrect type");if(e.header!==void 0&&!ve(e.header))throw new V("JWS Unprotected Header incorrect type");let t={};if(e.protected)try{const h=Fe(e.protected);t=JSON.parse(Ps.decode(h))}catch{throw new V("JWS Protected Header is invalid")}if(!Ln(t,e.header))throw new V("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");const a={...t,...e.header},n=Jn(V,new Map([["b64",!0]]),r==null?void 0:r.crit,t,a);let o=!0;if(n.has("b64")&&(o=t.b64,typeof o!="boolean"))throw new V('The "b64" (base64url-encode payload) Header Parameter must be a boolean');const{alg:i}=a;if(typeof i!="string"||!i)throw new V('JWS "alg" (Algorithm) Header Parameter missing or invalid');const c=r&&Vn("algorithms",r.algorithms);if(c&&!c.has(i))throw new it('"alg" (Algorithm) Header Parameter value not allowed');if(o){if(typeof e.payload!="string")throw new V("JWS Payload must be a string")}else if(typeof e.payload!="string"&&!(e.payload instanceof Uint8Array))throw new V("JWS Payload must be a string or an Uint8Array instance");let l=!1;typeof s=="function"?(s=await s(t,e),l=!0,hr(i,s,"verify"),rs(s)&&(s=await ht(s,i))):hr(i,s,"verify");const u=vn(Rs.encode(e.protected??""),Rs.encode("."),typeof e.payload=="string"?Rs.encode(e.payload):e.payload);let d;try{d=Fe(e.signature)}catch{throw new V("Failed to base64url decode the signature")}if(!await Gn(i,s,d,u))throw new ut;let _;if(o)try{_=Fe(e.payload)}catch{throw new V("Failed to base64url decode the payload")}else typeof e.payload=="string"?_=Rs.encode(e.payload):_=e.payload;const f={payload:_};return e.protected!==void 0&&(f.protectedHeader=t),e.header!==void 0&&(f.unprotectedHeader=e.header),l?{...f,key:s}:f}async function Qn(e,s,r){if(e instanceof Uint8Array&&(e=Ps.decode(e)),typeof e!="string")throw new V("Compact JWS must be a string or Uint8Array");const{0:t,1:a,2:n,length:o}=e.split(".");if(o!==3)throw new V("Invalid Compact JWS");const i=await Xn({payload:a,protected:t,signature:n},s,r),c={payload:i.payload,protectedHeader:i.protectedHeader};return typeof s=="function"?{...c,key:i.key}:c}const Zn=e=>Math.floor(e.getTime()/1e3),yt=60,bt=yt*60,cr=bt*24,eo=cr*7,so=cr*365.25,ro=/^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i,gr=e=>{const s=ro.exec(e);if(!s||s[4]&&s[1])throw new TypeError("Invalid time period format");const r=parseFloat(s[2]),t=s[3].toLowerCase();let a;switch(t){case"sec":case"secs":case"second":case"seconds":case"s":a=Math.round(r);break;case"minute":case"minutes":case"min":case"mins":case"m":a=Math.round(r*yt);break;case"hour":case"hours":case"hr":case"hrs":case"h":a=Math.round(r*bt);break;case"day":case"days":case"d":a=Math.round(r*cr);break;case"week":case"weeks":case"w":a=Math.round(r*eo);break;default:a=Math.round(r*so);break}return s[1]==="-"||s[4]==="ago"?-a:a},yr=e=>e.toLowerCase().replace(/^application\//,""),to=(e,s)=>typeof e=="string"?s.includes(e):Array.isArray(e)?s.some(Set.prototype.has.bind(new Set(e))):!1,ao=(e,s,r={})=>{let t;try{t=JSON.parse(Ps.decode(s))}catch{}if(!ve(t))throw new ys("JWT Claims Set must be a top-level JSON object");const{typ:a}=r;if(a&&(typeof e.typ!="string"||yr(e.typ)!==yr(a)))throw new ie('unexpected "typ" JWT header value',t,"typ","check_failed");const{requiredClaims:n=[],issuer:o,subject:i,audience:c,maxTokenAge:l}=r,u=[...n];l!==void 0&&u.push("iat"),c!==void 0&&u.push("aud"),i!==void 0&&u.push("sub"),o!==void 0&&u.push("iss");for(const f of new Set(u.reverse()))if(!(f in t))throw new ie(`missing required "${f}" claim`,t,f,"missing");if(o&&!(Array.isArray(o)?o:[o]).includes(t.iss))throw new ie('unexpected "iss" claim value',t,"iss","check_failed");if(i&&t.sub!==i)throw new ie('unexpected "sub" claim value',t,"sub","check_failed");if(c&&!to(t.aud,typeof c=="string"?[c]:c))throw new ie('unexpected "aud" claim value',t,"aud","check_failed");let d;switch(typeof r.clockTolerance){case"string":d=gr(r.clockTolerance);break;case"number":d=r.clockTolerance;break;case"undefined":d=0;break;default:throw new TypeError("Invalid clockTolerance option type")}const{currentDate:m}=r,_=Zn(m||new Date);if((t.iat!==void 0||l)&&typeof t.iat!="number")throw new ie('"iat" claim must be a number',t,"iat","invalid");if(t.nbf!==void 0){if(typeof t.nbf!="number")throw new ie('"nbf" claim must be a number',t,"nbf","invalid");if(t.nbf>_+d)throw new ie('"nbf" claim timestamp check failed',t,"nbf","check_failed")}if(t.exp!==void 0){if(typeof t.exp!="number")throw new ie('"exp" claim must be a number',t,"exp","invalid");if(t.exp<=_-d)throw new ds('"exp" claim timestamp check failed',t,"exp","check_failed")}if(l){const f=_-t.iat,h=typeof l=="number"?l:gr(l);if(f-d>h)throw new ds('"iat" claim timestamp check failed (too far in the past)',t,"iat","check_failed");if(f<0-d)throw new ie('"iat" claim timestamp check failed (it should be in the past)',t,"iat","check_failed")}return t};async function no(e,s,r){var o;const t=await Qn(e,s,r);if((o=t.protectedHeader.crit)!=null&&o.includes("b64")&&t.protectedHeader.b64===!1)throw new ys("JWTs MUST NOT use unencoded payload");const n={payload:ao(t.protectedHeader,t.payload,r),protectedHeader:t.protectedHeader};return typeof s=="function"?{...n,key:t.key}:n}function oo(e){switch(typeof e=="string"&&e.slice(0,2)){case"RS":case"PS":return"RSA";case"ES":return"EC";case"Ed":return"OKP";default:throw new me('Unsupported "alg" value for a JSON Web Key Set')}}function io(e){return e&&typeof e=="object"&&Array.isArray(e.keys)&&e.keys.every(co)}function co(e){return ve(e)}function wt(e){return typeof structuredClone=="function"?structuredClone(e):JSON.parse(JSON.stringify(e))}class lo{constructor(s){if(this._cached=new WeakMap,!io(s))throw new or("JSON Web Key Set malformed");this._jwks=wt(s)}async getKey(s,r){const{alg:t,kid:a}={...s,...r==null?void 0:r.header},n=oo(t),o=this._jwks.keys.filter(l=>{let u=n===l.kty;if(u&&typeof a=="string"&&(u=a===l.kid),u&&typeof l.alg=="string"&&(u=t===l.alg),u&&typeof l.use=="string"&&(u=l.use==="sig"),u&&Array.isArray(l.key_ops)&&(u=l.key_ops.includes("verify")),u)switch(t){case"ES256":u=l.crv==="P-256";break;case"ES256K":u=l.crv==="secp256k1";break;case"ES384":u=l.crv==="P-384";break;case"ES512":u=l.crv==="P-521";break;case"Ed25519":u=l.crv==="Ed25519";break;case"EdDSA":u=l.crv==="Ed25519"||l.crv==="Ed448";break}return u}),{0:i,length:c}=o;if(c===0)throw new ir;if(c!==1){const l=new ct,{_cached:u}=this;throw l[Symbol.asyncIterator]=async function*(){for(const d of o)try{yield await br(u,d,t)}catch{}},l}return br(this._cached,i,t)}}async function br(e,s,r){const t=e.get(s)||e.set(s,{}).get(s);if(t[r]===void 0){const a=await ht({...s,ext:!0},r);if(a instanceof Uint8Array||a.type!=="public")throw new or("JSON Web Key Set members must be public keys");t[r]=a}return t[r]}function wr(e){const s=new lo(e),r=async(t,a)=>s.getKey(t,a);return Object.defineProperties(r,{jwks:{value:()=>wt(s._jwks),enumerable:!0,configurable:!1,writable:!1}}),r}const uo=async(e,s,r)=>{let t,a,n=!1;typeof AbortController=="function"&&(t=new AbortController,a=setTimeout(()=>{n=!0,t.abort()},s));const o=await fetch(e.href,{signal:t?t.signal:void 0,redirect:"manual",headers:r.headers}).catch(i=>{throw n?new lt:i});if(a!==void 0&&clearTimeout(a),o.status!==200)throw new X("Expected 200 OK from the JSON Web Key Set HTTP response");try{return await o.json()}catch{throw new X("Failed to parse the JSON Web Key Set HTTP response as JSON")}};function po(){return typeof WebSocketPair<"u"||typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"||typeof EdgeRuntime<"u"&&EdgeRuntime==="vercel"}let Zs;var Is,Ur;(typeof navigator>"u"||!((Ur=(Is=navigator.userAgent)==null?void 0:Is.startsWith)!=null&&Ur.call(Is,"Mozilla/5.0 ")))&&(Zs="jose/v5.10.0");const zs=Symbol();function mo(e,s){return!(typeof e!="object"||e===null||!("uat"in e)||typeof e.uat!="number"||Date.now()-e.uat>=s||!("jwks"in e)||!ve(e.jwks)||!Array.isArray(e.jwks.keys)||!Array.prototype.every.call(e.jwks.keys,ve))}class _o{constructor(s,r){if(!(s instanceof URL))throw new TypeError("url must be an instance of URL");this._url=new URL(s.href),this._options={agent:r==null?void 0:r.agent,headers:r==null?void 0:r.headers},this._timeoutDuration=typeof(r==null?void 0:r.timeoutDuration)=="number"?r==null?void 0:r.timeoutDuration:5e3,this._cooldownDuration=typeof(r==null?void 0:r.cooldownDuration)=="number"?r==null?void 0:r.cooldownDuration:3e4,this._cacheMaxAge=typeof(r==null?void 0:r.cacheMaxAge)=="number"?r==null?void 0:r.cacheMaxAge:6e5,(r==null?void 0:r[zs])!==void 0&&(this._cache=r==null?void 0:r[zs],mo(r==null?void 0:r[zs],this._cacheMaxAge)&&(this._jwksTimestamp=this._cache.uat,this._local=wr(this._cache.jwks)))}coolingDown(){return typeof this._jwksTimestamp=="number"?Date.now()<this._jwksTimestamp+this._cooldownDuration:!1}fresh(){return typeof this._jwksTimestamp=="number"?Date.now()<this._jwksTimestamp+this._cacheMaxAge:!1}async getKey(s,r){(!this._local||!this.fresh())&&await this.reload();try{return await this._local(s,r)}catch(t){if(t instanceof ir&&this.coolingDown()===!1)return await this.reload(),this._local(s,r);throw t}}async reload(){this._pendingFetch&&po()&&(this._pendingFetch=void 0);const s=new Headers(this._options.headers);Zs&&!s.has("User-Agent")&&(s.set("User-Agent",Zs),this._options.headers=Object.fromEntries(s.entries())),this._pendingFetch||(this._pendingFetch=uo(this._url,this._timeoutDuration,this._options).then(r=>{this._local=wr(r),this._cache&&(this._cache.uat=Date.now(),this._cache.jwks=r),this._jwksTimestamp=Date.now(),this._pendingFetch=void 0}).catch(r=>{throw this._pendingFetch=void 0,r})),await this._pendingFetch}}function fo(e,s){const r=new _o(e,s),t=async(a,n)=>r.getKey(a,n);return Object.defineProperties(t,{coolingDown:{get:()=>r.coolingDown(),enumerable:!0,configurable:!1},fresh:{get:()=>r.fresh(),enumerable:!0,configurable:!1},reload:{value:()=>r.reload(),enumerable:!0,configurable:!1,writable:!1},reloading:{get:()=>!!r._pendingFetch,enumerable:!0,configurable:!1},jwks:{value:()=>{var a;return(a=r._local)==null?void 0:a.jwks()},enumerable:!0,configurable:!1,writable:!1}}),t}const Eo="https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";let Os=null;function ho(){return Os||(Os=fo(new URL(Eo)),console.log("[Firebase Token] ✅ JWKS cache initialized")),Os}function go(){Os=null,console.warn("[Firebase Token] 🔄 JWKS cache invalidated")}async function St(e,s){try{console.log("[Firebase Token] 🔍 Starting verification"),console.log("[Firebase Token] 📊 Token length:",e.length),console.log("[Firebase Token] 🏢 Project ID:",s);const r=ho(),{payload:t}=await no(e,r,{issuer:`https://securetoken.google.com/${s}`,audience:s,algorithms:["RS256"]});if(console.log("[Firebase Token] ✅ JWT signature verified"),!t.sub)throw new Error("Token missing subject (uid)");const a=Math.floor(Date.now()/1e3);if(t.exp&&t.exp<a)throw console.error("[Firebase Token] ❌ Token expired:",{exp:t.exp,now:a,expiredBy:a-t.exp}),new ds("Token has expired");if(t.iat&&t.iat>a+300)throw console.error("[Firebase Token] ❌ Token issued in future:",{iat:t.iat,now:a,diff:t.iat-a}),new Error("Token not yet valid (issued in future)");console.log("[Firebase Token] ✅ Time validation passed:",{iat:t.iat,exp:t.exp,now:a});const n=t.sub,o=typeof t.role=="string"?t.role:void 0,i=typeof t.userId=="number"?t.userId:void 0,c=typeof t.userName=="string"?t.userName:void 0,l=typeof t.email=="string"?t.email:void 0;return console.log("[Firebase Token] ✅ Token verified successfully"),console.log("[Firebase Token] 👤 User:",{uid:n,role:o,userId:i,userName:c,email:l?"exists":"none"}),{...t,uid:n,role:o,userId:i,userName:c,email:l}}catch(r){throw console.error("[Firebase Token] ❌ Verification failed:",{error:r instanceof Error?r.message:"Unknown",name:r instanceof Error?r.name:void 0,tokenPreview:e.substring(0,30)+"..."}),r instanceof ys&&r.message.includes("kid")&&(go(),console.warn("[Firebase Token] 🔄 JWKS cache invalidated → retry possible")),r}}function Tt(e){if(e instanceof ds)return{code:"TOKEN_EXPIRED",message:"Token has expired. Please login again."};if(e instanceof ys){if(e.message.includes("issuer"))return{code:"INVALID_ISSUER",message:"Token issuer mismatch"};if(e.message.includes("audience"))return{code:"INVALID_AUDIENCE",message:"Token audience mismatch"};if(e.message.includes("signature"))return{code:"INVALID_SIGNATURE",message:"Invalid token signature"};if(e.message.includes("kid"))return{code:"INVALID_KID",message:"Public key not found for token"}}return e instanceof Error&&e.message.includes("not yet valid")?{code:"TOKEN_NOT_YET_VALID",message:"Token issued in the future"}:{code:"VERIFICATION_FAILED",message:e instanceof Error?e.message:"Token verification failed"}}const _e=new Map;let Y={hits:0,misses:0,writes:0,evictions:0};function be(e){const s=_e.get(e);return s?s.expires<Date.now()?(_e.delete(e),Y.evictions++,Y.misses++,null):(Y.hits++,s.data):(Y.misses++,null)}function Q(e,s,r){const t=Date.now()+r*1e3;if(_e.set(e,{data:s,expires:t}),Y.writes++,_e.size>1e3){const a=_e.keys().next().value;a&&(_e.delete(a),Y.evictions++)}}function yo(e){let s=0;for(const r of _e.keys())r.includes(e)&&(_e.delete(r),s++);return s}async function ts(e,s){const r=Array.isArray(s)?s:[s];for(const t of r){const a=yo(t);a>0&&console.log(`[Cache] 🧹 메모리 캐시 삭제: ${t} (${a}개)`);try{await e.CACHE_KV.delete(t),console.log(`[Cache] 🧹 KV 캐시 삭제: ${t}`)}catch(n){console.error(`[Cache] ❌ KV 캐시 삭제 실패: ${t}`,n)}}}const as={LIVE_STREAMS:["streams:live","streams:all","streams:scheduled","live_streams:live:all:20:0","live_streams:"],PRODUCTS:["products:","featured_products"],CART:e=>[`cart:${e}`],ORDERS:e=>[`orders:${e}`],ALL:["streams:","live_streams:","products:","cart:","orders:"]};function bo(e){const s=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:s,message:"API Request",context:e,duration:e.duration}))}function wo(e){return{name:"tosspayments",async confirmPayment(s){try{const r=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:s.paymentKey,orderId:s.orderId,amount:s.amount})}),t=await r.json();if(!r.ok)return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:t.message||"결제 승인 실패",rawData:t};let a={};t.card&&(a={cardCompany:t.card.company,cardNumber:t.card.number,installmentMonths:t.card.installmentPlanMonths||0});let n={};return t.virtualAccount&&(n={virtualAccountBank:t.virtualAccount.bankCode,virtualAccountNumber:t.virtualAccount.accountNumber,virtualAccountHolder:t.virtualAccount.customerName,virtualAccountDueDate:t.virtualAccount.dueDate}),{success:!0,orderId:t.orderId,paymentKey:t.paymentKey,method:t.method,totalAmount:t.totalAmount,status:t.status,approvedAt:t.approvedAt,transactionId:t.transactionKey,...a,...n,rawData:t}}catch(r){return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:r.message,rawData:null}}},async cancelPayment(s){try{const r={cancelReason:s.cancelReason};s.cancelAmount&&(r.cancelAmount=s.cancelAmount);const t=await fetch(`https://api.tosspayments.com/v1/payments/${s.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(r)}),a=await t.json();return t.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(r){return{success:!1,error:r.message}}},async getPayment(s){try{const r=await fetch(`https://api.tosspayments.com/v1/payments/${s}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),t=await r.json();if(!r.ok)throw new Error(t.message);return{success:!0,orderId:t.orderId,paymentKey:t.paymentKey,method:t.method,totalAmount:t.totalAmount,status:t.status,approvedAt:t.approvedAt,rawData:t}}catch(r){throw r}}}}function So(e,s){switch(e.toLowerCase()){case"tosspayments":return wo(s);default:throw new Error(`Unknown payment provider: ${e}`)}}const p=new et;p.use("*",async(e,s)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{ga(e.env),ya(e.env)}catch(t){console.error("[ENV] Validation failed:",t)}await s()});async function To(e){try{const s=e.req.header("Authorization");console.log("[Firebase Auth] 🔍 Authorization header:",s?`Bearer ${s.substring(7,50)}...`:"MISSING");const r=(s==null?void 0:s.replace("Bearer ",""))||"";if(!r)return console.warn("[Firebase Auth] ❌ No token provided"),null;console.log("[Firebase Auth] 🔑 Token length:",r.length),console.log("[Firebase Auth] 🔑 Token preview:",r.substring(0,50)+"...");try{const t=r.split(".");if(t.length===3){const a=t[1],n=atob(a.replace(/-/g,"+").replace(/_/g,"/")),o=JSON.parse(n);if(console.log("[Firebase Auth] 🔍 Token Payload (BEFORE verification):",{iss:o.iss,aud:o.aud,sub:o.sub,exp:o.exp,iat:o.iat}),o.iss&&o.iss.includes("iam.gserviceaccount.com"))return console.error("[Firebase Auth] 🚨🚨🚨 CUSTOM TOKEN DETECTED! 🚨🚨🚨"),console.error("[Firebase Auth] ❌ This is a Custom Token, not an ID Token!"),console.error("[Firebase Auth] ❌ Custom Token should be exchanged for ID Token on client!"),{userId:0,userType:"",errorDetails:{code:"CUSTOM_TOKEN_DETECTED",message:"Custom Token should be exchanged for ID Token on client",tokenInfo:{iss:o.iss,aud:o.aud,sub:o.sub}}}}}catch(t){console.warn("[Firebase Auth] ⚠️ Could not decode token payload (might be corrupted):",t)}try{console.log("[Firebase Auth] 🔐 Verifying token with project:",e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284");const t=await St(r,e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284");if(console.log("[Firebase Auth] ✅ Firebase token verified!"),console.log("[Firebase Auth] 📋 Token payload:",{uid:t.uid,iss:t.iss,aud:t.aud,exp:t.exp,iat:t.iat}),t.userId){console.log("[Firebase Auth] 🎯 Using userId from Custom Claims:",t.userId);const o=await e.env.DB.prepare(`
          SELECT id, email, name, firebase_uid FROM users WHERE id = ?
        `).bind(t.userId).first();if(o){if(!o.firebase_uid)try{await e.env.DB.prepare(`
                UPDATE users SET firebase_uid = ? WHERE id = ?
              `).bind(t.uid,o.id).run(),console.log("[Firebase Auth] ✅ firebase_uid updated via Custom Claims:",o.id)}catch(c){console.warn("[Firebase Auth] ⚠️ firebase_uid update failed:",c)}const i=t.role||"user";return console.log("[Firebase Auth] ✅ User authenticated via Custom Claims"),{userId:o.id,userType:i,email:o.email,firebaseUID:t.uid}}}let a=await e.env.DB.prepare(`
        SELECT id, email, name, firebase_uid FROM users WHERE firebase_uid = ?
      `).bind(t.uid).first();if(!a&&t.uid.startsWith("kakao_")){const o=t.uid.replace("kakao_","");if(console.warn("[Firebase Auth] firebase_uid not found, trying kakao_id fallback:",o),a=await e.env.DB.prepare(`
          SELECT id, email, name, firebase_uid FROM users 
          WHERE kakao_id = ? AND firebase_uid IS NULL
        `).bind(o).first(),a){console.log("[Firebase Auth] ✅ Found user via kakao_id fallback:",a.id);try{await e.env.DB.prepare(`
              UPDATE users SET firebase_uid = ? WHERE id = ?
            `).bind(t.uid,a.id).run(),console.log("[Firebase Auth] ✅ firebase_uid updated for existing user:",a.id)}catch(i){console.error("[Firebase Auth] ❌ firebase_uid update failed:",i)}}}if(!a)return console.warn("[Firebase Auth] User not found for UID:",t.uid),{userId:0,userType:"",errorDetails:{code:"USER_NOT_FOUND",message:"User not found in database",tokenInfo:{uid:t.uid}}};const n=t.role||"user";return console.log("[Firebase Auth] ✅ User authenticated:",{userId:a.id,userType:n,email:a.email,firebaseUID:t.uid}),{userId:a.id,userType:n,email:a.email,firebaseUID:t.uid}}catch(t){console.error("[Firebase Auth] Token verification failed:",t);const a=Tt(t);return{userId:0,userType:"",errorDetails:{code:a.code,message:a.message,tokenInfo:{length:r.length,preview:r.substring(0,30)+"..."}}}}}catch(s){return console.error("[Firebase Auth Error]",s),null}}async function xe(e,s,r){if(!s)return null;const t=`session:${s}`;try{const a=be(t);if(a)return a;const n=await e.get(t);if(!n)return null;const o=JSON.parse(n);if(o.expires_at&&Date.now()>o.expires_at)return r!=null&&r.executionCtx||await e.delete(t),null;const i={user_id:o.user_id,user_type:o.user_type||"user",created_at:o.created_at};return Q(t,i,900),i}catch(a){return console.error("[Auth] Session lookup error:",a),null}}async function N(e,s){const r=e.req.header("Authorization");if(console.log("[requireAuth] 🔍 Header check:",r?"EXISTS":"MISSING"),!r)return e.json({success:!1,error:"Missing Authorization header - Firebase ID Token required",code:"NO_AUTH_HEADER",debug:{headers:Object.fromEntries(e.req.raw.headers.entries())}},401);const t=await To(e);if(!t||t.userId===0){const a=(t==null?void 0:t.errorDetails)||{code:"AUTH_FAILED",message:"Token verification failed - unknown reason"};return e.json({success:!1,error:a.message,code:a.code,debug:{tokenProvided:!!r,tokenLength:(r==null?void 0:r.replace("Bearer ","").length)||0,...a.tokenInfo}},401)}e.set("user",{userId:t.userId,userType:t.userType,email:t.email,firebaseUID:t.firebaseUID}),e.set("userId",t.userId),e.set("userType",t.userType),e.set("email",t.email),e.set("firebaseUID",t.firebaseUID),await s()}async function Ro(e,s){const r=e.get("userType"),t=e.get("userId");if(r!=="admin")return console.warn("[Security] Unauthorized admin access attempt:",{userId:t,userType:r}),e.json({success:!1,error:"관리자 권한이 필요합니다."},403);await s()}async function Io(e,s){const r=e.get("userType"),t=e.get("userId");if(r!=="seller")return console.warn("[Security] Unauthorized seller access attempt:",{userId:t,userType:r}),e.json({success:!1,error:"판매자 권한이 필요합니다."},403);await s()}async function vo(e){return async(s,r)=>{const t=s.get("userId");if(s.get("userType")==="admin"){await r();return}const n=s.req.param("userId");if(n&&n!==String(t))return console.warn("[Security] Unauthorized resource access attempt:",{resourceType:e,requestedUserId:n,actualUserId:t}),s.json({success:!1,error:"본인의 정보만 조회할 수 있습니다."},403);await r()}}async function Ao(e,s){try{const r=be(s);if(r!==null)return r;const t=await e.get(s);if(t){const a=JSON.parse(t);return Q(s,a,300),a}return null}catch(r){return console.error("[Cache] Read error:",r),null}}async function ps(e,s,r,t=60,a=!1){try{Q(s,r,t),a?(await e.put(s,JSON.stringify(r),{expirationTtl:t}),console.log(`[Cache] ✅ Saved to both Memory + KV: ${s}`)):console.log(`[Cache] ✅ Saved to Memory only (KV Write skipped): ${s}`)}catch(n){console.error("[Cache] Write error:",n)}}async function bs(e,...s){try{await Promise.all(s.map(r=>e.delete(r)))}catch(r){console.error("[Cache] Delete error:",r)}}async function ws(e,s,r,t,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s,r,t,a,n,o||null).run(),console.log(`[Notification] Created for ${r} ${s}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function Do(e,s,r,t,a){await ws(e,s,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${t}님의 주문 (${r}) - ${Oo(a)}`,"/seller/orders")}async function Rt(e,s,r,t,a,n){let o="",i="";switch(t){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${r}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${r}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${r}가 배송 완료되었습니다`;break;default:return}await ws(e,s,"user","shipping_status",o,i,"/my-orders")}async function It(e,s,r,t,a){await ws(e,s,"seller","low_stock","⚠️ 재고 부족 알림",`${r}의 재고가 ${t}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function Oo(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function ko(e,s,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const t=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:s,description:r,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!t.ok){const d=await t.text();throw new Error(`YouTube Broadcast 생성 실패: ${d}`)}const n=(await t.json()).id,o=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${s} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!o.ok){const d=await o.text();throw new Error(`YouTube Stream 생성 실패: ${d}`)}const i=await o.json(),c=i.id,l=i.cdn.ingestionInfo.streamName,u=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:n,streamId:c,streamKey:l,streamUrl:u}}catch(t){throw console.error("[YouTube API] Live broadcast creation failed:",t),t}}async function Co(e,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${s}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!r.ok){const t=await r.text();throw new Error(`YouTube 방송 종료 실패: ${t}`)}}catch(r){throw console.error("[YouTube API] Live broadcast end failed:",r),r}}async function No(e,s,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let t=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${s}&part=snippet,authorDetails`;r&&(t+=`&pageToken=${r}`);const a=await fetch(t,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const o=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${o}`)}const n=await a.json();return{messages:n.items||[],nextPageToken:n.nextPageToken,pollingIntervalMillis:n.pollingIntervalMillis||5e3}}catch(t){throw console.error("[YouTube API] Get chat messages failed:",t),t}}async function jo(e,s){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const r=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},t=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}&key=${e.apiKey}`,a=await fetch(t,{headers:r});if(!a.ok){const l=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${l}`)}const n=await a.json();if(!n.items||n.items.length===0)throw new Error("Video not found");const o=n.items[0],i=o.statistics,c=o.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(r){throw console.error("[YouTube API] Get live stats failed:",r),r}}function vt(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const s=new URL(e);if(s.hostname.includes("youtube.com")){const r=s.searchParams.get("v");if(r)return r;const t=s.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(t)return t[2]}if(s.hostname==="youtu.be"){const r=s.pathname.slice(1).split("?")[0];if(r&&r.length===11)return r}return null}catch{return null}}function At(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const r=s.pathname.match(/\/video\/(\d+)/);if(r)return r[1];const t=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(t)return t[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}function Lo(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){if(s.pathname.includes("/live"))return"live";if(s.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Dt(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const r=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}p.use("*",async(e,s)=>{await s(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const r=new URL(e.req.url);r.hostname!=="localhost"&&r.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",S());p.use(Ue(Pe.auth));p.use(Ue(Pe.alimtalk));p.use(Ue(Pe.order));p.use(Ue(Pe.refund));p.use(Ue(Pe.cart));p.use(Ue(Pe.upload));p.use("/api/*",Ue(Pe.api));p.use("*",async(e,s)=>{await s(),e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"),e.header("X-Frame-Options","DENY"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",async(e,s)=>{const r=Date.now(),t=e.req.method,a=e.req.path;await s();const n=Date.now()-r,o=e.res.status,i={method:t,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),bo(i)});p.use("/static/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/images/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/api/admin*",async(e,s)=>{if(e.req.path==="/api/admin/login")return s();const r=await N(e,()=>Promise.resolve());if(r)return r;const t=await Ro(e,()=>Promise.resolve());return t||s()});p.use("/api/seller*",async(e,s)=>{if(e.req.path==="/api/seller/register")return s();const r=await N(e,()=>Promise.resolve());if(r)return r;const t=await Io(e,()=>Promise.resolve());return t||s()});async function ns(e,s){const r=await e.get(`session:${s}`);if(!r)return null;const t=JSON.parse(r);return t.expires_at&&Date.now()>t.expires_at?(await e.delete(`session:${s}`),null):{session_token:s,[`${t.user_type}_id`]:t.user_id,user_type:t.user_type,...t.userData}}p.post("/api/auth/user/register",S(),Ua(Ha),async e=>{const{DB:s}=e.env;try{const{email:r,password:t,name:a,phone:n}=e.get("validatedData"),o=`placeholder_hash_for_${t}`;try{const c=(await s.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(r,o,a,n||null).run()).meta.last_row_id,l=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:l,user:{id:c,email:r,name:a,phone:n}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(r){return console.error("[User Register] Error:",r),e.json({success:!1,error:r.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/auth/user/login",S(),async e=>{const{DB:s,SESSION_KV:r}=e.env;try{const{email:t,password:a}=await e.req.json();if(!t||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await s.prepare(`
      SELECT id, email, name, kakao_id, password_hash, password, created_at
      FROM users 
      WHERE email = ?
    `).bind(t).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${a}`)||n.password&&n.password===a))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await s.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();const i=crypto.randomUUID(),c=Date.now()+720*60*60*1e3;return await r.put(`session:${i}`,JSON.stringify({user_id:n.id,user_type:"user",expires_at:c,created_at:Date.now()}),{expirationTtl:720*60*60}),console.log("[User Login] Session created in SESSION_KV for user:",n.id),e.json({success:!0,data:{session_token:i,user:{id:n.id,email:n.email,name:n.name,phone:n.phone,profile_image:n.profile_image}}})}catch(t){return console.error("[User Login] Error:",t),e.json({success:!1,error:t.message||"로그인 중 오류가 발생했습니다"},500)}});p.post("/api/auth/login",S(),async e=>e.json({success:!1,error:"This endpoint is deprecated. Please use Firebase Authentication.",message:"Admin/Seller login should use /api/admin/login or /api/seller/login with Firebase Auth",code:"DEPRECATED_ENDPOINT"},410));p.post("/api/auth/logout",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token");return r&&await e.env.SESSION_KV.delete(`session:${r}`),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/auth/me",S(),N,async e=>{const{DB:s}=e.env,{userId:r,email:t,firebaseUID:a}=e.get("user");try{return console.log("[GET /api/auth/me] User info:",{userId:r,email:t,firebaseUID:a}),e.json({success:!0,user:{id:r,email:t,firebaseUID:a}})}catch(n){return console.error("[GET /api/auth/me] Error:",n),e.json({success:!1,error:n.message},500)}});p.post("/api/auth/email/register",S(),async e=>{var r,t,a;const{DB:s}=e.env;try{const{email:n,password:o,name:i}=await e.req.json();if(!n||!o||!i)return e.json({success:!1,error:"Email, password, and name are required"},400);console.log("[Email Register] Registering new user:",n);const l=`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${e.env.FIREBASE_API_KEY||"AIzaSyBGfSLTtA6KTeTgOqfH3VCPmCHjHZvCc3U"}`,u=await fetch(l,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:n,password:o,returnSecureToken:!0})}),d=await u.json();if(!u.ok){console.error("[Email Register] Firebase signup failed:",d);let w="회원가입에 실패했습니다";return((r=d.error)==null?void 0:r.message)==="EMAIL_EXISTS"?w="이미 가입된 이메일입니다":((t=d.error)==null?void 0:t.message)==="WEAK_PASSWORD"?w="비밀번호가 너무 약합니다 (최소 6자)":(a=d.error)!=null&&a.message&&(w=d.error.message),e.json({success:!1,error:w},400)}const m=d.localId,_=d.idToken;console.log("[Email Register] ✅ Firebase user created:",m);try{await s.prepare(`
        INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(m,n,i).run(),console.log("[Email Register] ✅ User saved to D1")}catch(w){console.error("[Email Register] D1 insert failed:",w)}const h=await Ae(e.env).createCustomToken(m,{role:"user",email:n,userName:i});return console.log("[Email Register] ✅ Custom token created"),e.json({success:!0,customToken:h,idToken:_,user:{uid:m,email:n,name:i}})}catch(n){return console.error("[Email Register] Error:",n),e.json({success:!1,error:n.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/seller/register",S(),async e=>{const{DB:s}=e.env;try{const{email:r,password:t,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!r||!t||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(t.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=r.split("@")[0],l=`placeholder_hash_for_${t}`;try{const u=await s.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,r,l,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:u.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(u){const d=u.message||"";if(d.includes("UNIQUE")||d.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw u}}catch(r){return console.error("Seller registration error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/login",S(),async e=>{const{DB:s}=e.env;try{const{email:r,password:t}=await e.req.json();if(!r||!t)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await s.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        password_hash, 
        name, 
        is_active, 
        last_login_at
      FROM admins 
      WHERE email = ?
    `).bind(r).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(r==="admin@example.com"&&t==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${t}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=Ae(e.env),c=`admin_${a.id}`;try{await i.auth.getUser(c).catch(async()=>{await i.auth.createUser({uid:c,email:a.email,displayName:a.name})}),await i.auth.setCustomUserClaims(c,{role:"admin",userId:a.id,userName:a.name||a.email,email:a.email});const l=await i.createCustomToken(c,{role:"admin",userId:a.id,userName:a.name||a.email,email:a.email});return await s.prepare(`
        UPDATE admins SET firebase_uid = ? WHERE id = ?
      `).bind(c,a.id).run(),await s.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),console.log(`[Firebase Login] ✅ Admin ${a.email} logged in with Firebase (KV Write: 0)`),e.json({success:!0,data:{customToken:l,admin:{id:a.id,username:a.username,email:a.email,name:a.name,firebaseUID:c}}})}catch(l){return console.error("[Firebase] Admin login error:",l),e.json({success:!1,error:"Firebase authentication failed"},500)}}catch(r){return console.error("Admin login error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/login",S(),async e=>{const{DB:s}=e.env;try{const{email:r,password:t}=await e.req.json();if(!r||!t)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await s.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        password_hash, 
        name, 
        status,
        is_active, 
        last_login_at
      FROM sellers 
      WHERE email = ?
    `).bind(r).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(r==="seller1@example.com"&&t==="seller123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${t}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(a.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다. 관리자 승인 후 로그인할 수 있습니다."},403);const i=Ae(e.env),c=`seller_${a.id}`;try{await i.auth.getUser(c).catch(async()=>{await i.auth.createUser({uid:c,email:a.email,displayName:a.name})}),await i.auth.setCustomUserClaims(c,{role:"seller",userId:a.id,userName:a.name||a.email,email:a.email});const l=await i.createCustomToken(c,{role:"seller",userId:a.id,userName:a.name||a.email,email:a.email});try{await s.prepare(`
          UPDATE sellers SET firebase_uid = ? WHERE id = ?
        `).bind(c,a.id).run()}catch(u){console.warn("[Seller Login] firebase_uid update failed:",u)}return await s.prepare('UPDATE sellers SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),console.log(`[Firebase Login] ✅ Seller ${a.email} logged in with Firebase`),e.json({success:!0,data:{customToken:l,seller:{id:a.id,username:a.username,email:a.email,name:a.name,status:a.status,firebaseUID:c}}})}catch(l){return console.error("[Firebase] Seller login error:",l),e.json({success:!1,error:"Firebase authentication failed"},500)}}catch(r){return console.error("Seller login error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/auth/verify",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const t=await ns(e.env.SESSION_KV,r);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=t.user_type==="admin"?"admins":"sellers",n=t.user_type==="admin"?t.admin_id:t.seller_id,o=await s.prepare(`
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
    `).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:t.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/auth/kakao/sync/callback",async e=>{var r,t,a,n,o,i,c,l,u,d,m,_,f;const{DB:s}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!s);const h=e.req.query("code"),w=e.req.query("state")||"/",b=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!h,state:w,error:b}),b)return console.error("[Kakao Sync] OAuth error:",b),e.redirect(`${w}?error=kakao_oauth_${b}`);if(!h)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${w}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const g=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",T=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",g.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",T),console.log("[Kakao Sync] Step 1: Fetching access token...");const y=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:g,redirect_uri:T,code:h})});if(console.log("[Kakao Sync] Token response status:",y.status),console.log("[Kakao Sync] Token request details:",{client_id:g,redirect_uri:T,code_length:h.length,code_prefix:h.substring(0,20)}),!y.ok){const q=await y.text();return console.error("[Kakao Sync] Token request failed:",q),e.redirect(`${w}?error=token_request_failed&detail=${encodeURIComponent(q)}`)}const R=await y.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!R.access_token,error:R.error,errorDescription:R.error_description}),!R.access_token)return console.error("[Kakao Sync] Token error:",R),e.redirect(`${w}?error=token_failed&detail=${encodeURIComponent(R.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const L=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${R.access_token}`}});console.log("[Kakao Sync] User response status:",L.status);const C=await L.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!C.id,id:C.id,hasNickname:!!((r=C.properties)!=null&&r.nickname||(a=(t=C.kakao_account)==null?void 0:t.profile)!=null&&a.nickname)}),!C.id)return console.error("[Kakao Sync] Failed to get user info:",C),e.redirect(`${w}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const D=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${R.access_token}`}});console.log("[Kakao Sync] Terms response status:",D.status);let W=null;if(D.ok?(W=await D.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=W.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=W.allowed_service_terms)==null?void 0:o.map(q=>q.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!s)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${w}?error=db_not_available`);const U=C.id.toString(),M=((i=C.properties)==null?void 0:i.nickname)||((l=(c=C.kakao_account)==null?void 0:c.profile)==null?void 0:l.nickname)||"Kakao User",$=((u=C.kakao_account)==null?void 0:u.email)||"",Z=((d=C.properties)==null?void 0:d.profile_image)||((_=(m=C.kakao_account)==null?void 0:m.profile)==null?void 0:_.profile_image_url)||"",z=R.access_token,v=((f=W==null?void 0:W.allowed_service_terms)==null?void 0:f.map(q=>q.tag))||[],re=JSON.stringify(v);console.log("[Kakao Sync] User data:",{kakaoId:U,nickname:M,email:$?"exists":"none",serviceTerms:v});try{const q=await s.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(U).first();console.log("[Kakao Sync] Existing user check:",!!q);let P;q?(P=q.id,await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(M,$,Z,P).run(),console.log("[Kakao Sync] Updated user:",P)):(P=(await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(U,M,$||null,Z||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",P)),console.log("[Kakao Sync] User saved successfully, userId:",P),console.log("[Kakao Sync] Step 4: Generating Firebase Custom Token...");try{const H=Ae(e.env),te=`kakao_${U}`,xs=await H.createCustomToken(te,{role:"user",userId:P,userName:M,email:$||void 0,kakaoId:U});try{await s.prepare(`
            UPDATE users SET firebase_uid = ? WHERE id = ?
          `).bind(te,P).run()}catch(Ss){console.warn("[Kakao Sync] firebase_uid column not found, skipping update:",Ss)}console.log("[Kakao Sync] ✅ Firebase Custom Token 발급 완료 for user:",P),console.log("[Kakao Sync] Step 5: Redirecting with Firebase Custom Token...");const De=new URL(w,"https://dummy.com");De.searchParams.set("firebase_token",xs),De.searchParams.set("userName",M);const Ws=De.pathname+De.search;return console.log("[Kakao Sync] Redirect URL (Firebase):",Ws.substring(0,100)+"..."),e.redirect(Ws)}catch(H){console.error("[Kakao Sync] 🔴 Firebase Custom Token 생성 실패:",H),console.error("[Kakao Sync] Firebase 환경변수 체크 필요:",{hasProjectId:!!e.env.FIREBASE_PROJECT_ID,hasPrivateKey:!!e.env.FIREBASE_PRIVATE_KEY,hasClientEmail:!!e.env.FIREBASE_CLIENT_EMAIL,hasDatabaseURL:!!e.env.FIREBASE_DATABASE_URL});const te=H.message||"Unknown error";return e.redirect(`${w}?error=firebase_config_error&detail=${encodeURIComponent("Firebase 인증 설정 오류. 관리자에게 문의하세요. ("+te+")")}`)}}catch(q){return console.error("[Kakao Sync] Database error:",q),console.error("[Kakao Sync] DB error details:",{message:q.message,name:q.name}),e.redirect(`${w}?error=database_error&detail=${encodeURIComponent(q.message)}`)}}catch(h){console.error("[Kakao Sync] Exception:",h),console.error("[Kakao Sync] Error details:",{message:h.message,stack:h.stack,name:h.name});const w=e.req.query("state")||"/",b=encodeURIComponent(h.message||"unknown");return e.redirect(`${w}?error=kakao_sync_failed&detail=${b}`)}});p.post("/api/auth/kakao/callback",S(),async e=>{const{DB:s}=e.env;try{const{code:r,redirect_uri:t}=await e.req.json();if(!r)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=t||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow with Firebase Custom Token");const n=await Na(r,a,e.env.KAKAO_REST_API_KEY),{user:o}=await rt(s,n),i=Ae(e.env),c=`kakao_${o.kakao_id}`,l=await i.createCustomToken(c,{userId:o.id,userName:o.name,role:o.type||"user",email:o.email||void 0,kakaoId:o.kakao_id});console.log("[Kakao Callback] ✅ Firebase Custom Token 발급 완료 for user:",o.id);try{await s.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(c,o.id).run()}catch(u){console.warn("[Kakao Callback] firebase_uid column not found, skipping update:",u)}return e.json({success:!0,data:{customToken:l,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image,firebaseUID:c}}})}catch(r){return console.error("[Kakao Callback] Error:",r),r instanceof ne?e.json({success:!1,error:r.message,code:r.code},r.statusCode):e.json({success:!1,error:r.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/firebase",S(),async e=>{const{DB:s}=e.env;try{const{accessToken:r}=await e.req.json();if(!r)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Firebase] Processing Kakao OAuth login");const t=Date.now(),{user:a}=await rt(s,r);console.log("[Kakao Firebase] ProcessKakaoLogin completed in",Date.now()-t,"ms");const n=await generateFirebaseCustomToken(a.id.toString(),{role:"user",email:a.email,name:a.name});return console.log("[Kakao Firebase] ✅ Firebase Custom Token 생성 완료 for user:",a.id),console.log("[Kakao Firebase] Total login time:",Date.now()-t,"ms"),e.json({success:!0,customToken:n,user:{id:a.id,name:a.name,email:a.email,profile_image:a.profile_image}})}catch(r){return console.error("[Kakao Firebase] Error:",r),r instanceof ne?e.json({success:!1,error:r.message,code:r.code},r.statusCode):e.json({success:!1,error:r instanceof Error?r.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/firebase/sync",S(),async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const{idToken:t,firebaseUid:a,email:n,displayName:o}=await e.req.json();if(!t||!a)return e.json({success:!1,error:"idToken and firebaseUid are required"},400);const i=`sync_limit:${a}`,c=await r.get(i),l=6e5;if(c){const m=Date.now()-parseInt(c);if(m<l){const _=Math.ceil((l-m)/1e3);return console.log(`[Firebase Sync] ⏳ Rate limited (${_}s remaining):`,a),e.json({success:!1,error:"Rate limited",retryAfter:_},429)}}console.log("[Firebase Sync] 🔄 Starting sync:",{firebaseUid:a,email:n?"exists":"none"});let u;try{u=await St(t,e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284")}catch(m){const _=Tt(m);return console.error("[Firebase Sync] ❌ Token verification failed:",_),e.json({success:!1,..._},401)}if(u.uid!==a)return console.error("[Firebase Sync] ❌ UID mismatch:",{expected:a,actual:u.uid}),e.json({success:!1,code:"UID_MISMATCH",message:"Token UID does not match provided firebaseUid"},401);console.log("[Firebase Sync] ✅ Token verified:",{uid:u.uid,role:u.role,email:u.email});const d=await s.prepare("SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?").bind(a).first();if(d)return await s.prepare(`
        UPDATE users 
        SET email = ?, 
            name = ?, 
            last_login_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE firebase_uid = ?
      `).bind(n||d.email,o||d.name,a).run(),await r.put(i,Date.now().toString(),{expirationTtl:600}),console.log("[Firebase Sync] ✅ User updated:",d.id),e.json({success:!0,user:{id:d.id,email:n||d.email,name:o||d.name,user_type:d.user_type}});if(n){const m=await s.prepare("SELECT id, email, name, user_type FROM users WHERE email = ?").bind(n).first();if(m)return await s.prepare(`
          UPDATE users 
          SET firebase_uid = ?, 
              name = ?, 
              last_login_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE email = ?
        `).bind(a,o||m.name,n).run(),await r.put(i,Date.now().toString(),{expirationTtl:600}),console.log("[Firebase Sync] ✅ Linked firebase_uid to existing email user:",m.id),e.json({success:!0,user:{id:m.id,email:m.email,name:o||m.name,user_type:m.user_type}})}return console.warn("[Firebase Sync] ⚠️ User not found:",a),e.json({success:!1,error:"User not found. Please register first.",code:"USER_NOT_FOUND"},404)}catch(t){console.error("[Firebase Sync] 🔴 Error:",t);const a=t instanceof Error?t.message:"Unknown error";return a.includes("no such column: firebase_uid")?(console.warn("[Firebase Sync] ⚠️ firebase_uid column not found - migration needed"),e.json({success:!0,warning:"Database migration pending",requiresMigration:!0})):((a.includes("D1_ERROR")||a.includes("SQLITE_ERROR"))&&console.error("[Firebase Sync] 🔴 D1 Database Error:",a),e.json({success:!1,error:a,code:"INTERNAL_ERROR"},500))}});p.get("/api/auth/firebase/user-id/:firebaseUid",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("firebaseUid");if(!r)return e.json({success:!1,error:"firebaseUid is required"},400);const t=await s.prepare("SELECT id, name, email FROM users WHERE firebase_uid = ?").bind(r).first();return t?e.json({success:!0,userId:t.id,userName:t.name,userEmail:t.email}):e.json({success:!1,error:"User not found"},404)}catch(r){console.error("[Firebase User ID Lookup] Error:",r);const t=r instanceof Error?r.message:"Unknown error";return t.includes("no such column: firebase_uid")?e.json({success:!1,error:"Database migration needed",requiresMigration:!0},503):e.json({success:!1,error:t},500)}});p.post("/api/auth/firebase/register",S(),async e=>{const{DB:s}=e.env;try{const{idToken:r,firebaseUid:t,email:a,name:n,userType:o}=await e.req.json();if(!r||!t||!a||!n)return e.json({success:!1,error:"idToken, firebaseUid, email, and name are required"},400);console.log("[Firebase Register] Registering new user:",{firebaseUid:t,email:a,userType:o});const i=await verifyFirebaseToken(r,e.env);if(!i||i.uid!==t)return e.json({success:!1,error:"Invalid Firebase token"},401);const c=await s.prepare(`
      INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(t,a,n).run();return console.log("[Firebase Register] ✅ 새 사용자 생성 완료:",c.meta.last_row_id),e.json({success:!0,user:{id:c.meta.last_row_id,email:a,name:n,firebaseUid:t}})}catch(r){return console.error("[Firebase Register] Error:",r),r instanceof Error&&r.message.includes("UNIQUE")?e.json({success:!1,error:"Email already exists",code:"EMAIL_EXISTS"},409):e.json({success:!1,error:r instanceof Error?r.message:"Registration failed"},500)}});p.post("/api/auth/kakao/logout",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token")||"";return r&&(await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(r){return console.error("[Kakao Sync] Logout error:",r),e.json({success:!1,error:"Logout failed"},500)}});p.post("/api/auth/kakao/unlink",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await s.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(r).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
      SELECT u.id, u.email, u.name, u.kakao_id, u.profile_image, u.created_at
      FROM users u
      WHERE u.id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(r).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const n=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),o=await n.json();n.ok?console.log("[Kakao Unlink] Kakao unlink successful:",o.id):console.warn("[Kakao Unlink] Kakao unlink failed:",o)}catch(n){console.error("[Kakao Unlink] Kakao API error:",n)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(),console.log("[Kakao Unlink] Sessions deleted"),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await s.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(r){return console.error("[Kakao Unlink] Error:",r),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});p.post("/webhooks/kakao/unlink",async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),{user_id:t,referrer_type:a}=r;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:t,referrer_type:a}),!t)return e.json({success:!1,error:"user_id is required"},400);const n=await s.prepare(`
      SELECT id, kakao_id, email, name, created_at
      FROM users 
      WHERE kakao_id = ?
    `).bind(t.toString()).first();return n?(console.log("[Kakao Webhook] Deleting user data for user:",n.id),await s.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await s.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",t),e.json({success:!0}))}catch(r){return console.error("[Kakao Webhook] Error:",r),e.json({success:!1,error:"Webhook processing failed"},500)}});p.get("/api/auth/user/verify",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const t=await ns(e.env.SESSION_KV,r);if(!t||t.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
      SELECT id, email, name, kakao_id, profile_image, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();return a?e.json({success:!0,data:{user:{id:a.id,name:a.name,email:a.email,profileImage:a.profile_image,phone:a.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/shipping-addresses",S(),N,async e=>{const{DB:s}=e.env,r=e.get("userId");try{const t=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:t.results||[]})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/shipping-addresses/:userId",S(),N,async e=>{const{DB:s}=e.env,r=e.get("userId"),t=parseInt(e.req.param("userId"));try{if(t!==r)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/shipping-addresses",S(),N,async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),t=r.user_id,a=r.recipient_name,n=r.phone,o=r.postal_code,i=r.address,c=r.address_detail;let l=r.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(r)),!t||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:t,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);const u=await s.prepare(`
      SELECT COUNT(*) as count FROM shipping_addresses WHERE user_id = ?
    `).bind(t).first();u&&u.count===0&&(l=!0,console.log("[POST /api/shipping-addresses] 첫 번째 배송지 → 자동으로 기본 배송지 설정")),l&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(t).run();const d=await s.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a,n,o||"",i,c||"",l?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:d.meta.last_row_id}),e.json({success:!0,data:{id:d.meta.last_row_id}})}catch(r){return console.error("[POST /api/shipping-addresses] Error:",r),e.json({success:!1,error:r.message},500)}});p.put("/api/shipping-addresses/:id",S(),N,async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=await e.req.json(),a=t.user_id,n=t.recipient_name,o=t.phone,i=t.postal_code,c=t.address,l=t.address_detail,u=t.is_default;return u&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await s.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,l||"",u?1:0,r,a).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/shipping-addresses/:id",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=e.req.query("userId");return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r,t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});async function x(e){const s=e.req.header("Authorization");if(s!=null&&s.startsWith("Bearer ")){const a=s.substring(7);try{const n=await verifyJWT(a,e.env.JWT_SECRET);return n.userType!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:n.userId,userData:n}}catch(n){console.error("[verifyAdminSession] JWT verification failed:",n)}}const r=e.req.header("X-Session-Token");if(!r)return{success:!1,error:"인증 토큰이 없습니다"};const t=await ns(e.env.SESSION_KV,r);return!t||t.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:t.admin_id,userData:t}}async function k(e){const s=e.req.header("Authorization");if(s!=null&&s.startsWith("Bearer ")){const a=s.substring(7);try{const n=await verifyJWT(a,e.env.JWT_SECRET);return n.userType!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:n.userId,userData:n}}catch(n){console.error("[verifySellerSession] JWT verification failed:",n)}}const r=e.req.header("X-Session-Token");if(!r)return{success:!1,error:"인증 토큰이 없습니다"};const t=await ns(e.env.SESSION_KV,r);return!t||t.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:t.seller_id,userData:t}}p.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));p.get("/api/cleanup/expired-reservations",async e=>{const{DB:s}=e.env;try{console.log("========================================"),console.log("[Cleanup] ⏰ 만료된 재고 예약 정리 시작"),console.log("========================================");const r=new Date().toISOString();console.log("[Cleanup] 현재 시간:",r);const t=await s.prepare(`
      SELECT id, order_number, reservation_expires_at
      FROM orders
      WHERE status = 'pending'
        AND reservation_expires_at IS NOT NULL
        AND reservation_expires_at < ?
      LIMIT 100
    `).bind(r).all();if(t.results.length===0)return console.log("[Cleanup] ✅ 만료된 예약 없음"),e.json({success:!0,message:"만료된 예약이 없습니다.",cleaned:0});console.log(`[Cleanup] 📦 만료된 주문 ${t.results.length}개 발견`);let a=0;for(const n of t.results)try{const o=await s.prepare(`
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
        `).bind(n.id).run(),console.log(`[Cleanup] ✅ ${n.order_number}: ${o.results.length}개 상품 예약 해제`),a++}catch(o){console.error(`[Cleanup] ❌ ${n.order_number} 처리 실패:`,o)}return console.log(`[Cleanup] ✅ 정리 완료: ${a}/${t.results.length}개`),e.json({success:!0,message:`${a}개의 만료된 예약을 정리했습니다.`,cleaned:a,total:t.results.length})}catch(r){return console.error("[Cleanup] ❌ 정리 실패:",r),e.json({success:!1,error:"만료된 예약 정리 중 오류가 발생했습니다.",details:r.message},500)}});p.get("/api/test/env",async e=>{try{const s=await Sa(e.env);return e.json(s)}catch(s){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:s instanceof Error?s.message:String(s)},500)}});p.get("/api/streams",$s(Us.liveStreams),async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const t=e.req.query("status")||"all",a=`streams:${t}`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});let o=`
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
    `;t==="live"?o+=" WHERE ls.status = 'live'":t==="scheduled"?o+=" WHERE ls.status = 'scheduled'":t==="ended"?o+=" WHERE ls.status = 'ended'":o+=" WHERE ls.status IN ('live', 'scheduled')",o+=` ORDER BY 
      CASE ls.status 
        WHEN 'live' THEN 1 
        WHEN 'scheduled' THEN 2 
        ELSE 3 
      END,
      ls.created_at DESC`;const i=await s.prepare(o).all();return await r.put(a,JSON.stringify(i.results),{expirationTtl:600}),e.json({success:!0,data:i.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/streams/:id",async e=>{const{DB:s,CACHE_KV:r}=e.env,t=e.req.param("id");try{const a=`stream:detail:${t}`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0,cacheSource:"kv"});const o=be(a);if(o)return e.executionCtx.waitUntil((async()=>{try{const c=await Sr(s,t);Q(a,c,300),await r.put(a,JSON.stringify(c),{expirationTtl:600})}catch(c){console.error("[Cache Revalidate] Stream detail error:",c)}})()),e.json({success:!0,data:o,cached:!0,cacheSource:"memory"});const i=await Sr(s,t);return i?(Q(a,i,300),await r.put(a,JSON.stringify(i),{expirationTtl:600}),e.json({success:!0,data:i,cached:!1})):e.json({success:!1,error:"Stream not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});async function Sr(e,s){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first()}p.get("/api/live-streams",async e=>{const{DB:s}=e.env,{status:r,seller_id:t,limit:a="20",offset:n="0"}=e.req.query();try{const o=`live_streams:${r||"all"}:${t||"all"}:${a}:${n}`,i=60,c=be(o);if(c)return console.log("[LiveStreams] ⚡ 메모리 캐시 히트:",o),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStreams] 🔄 백그라운드 갱신 시작:",o);const u=await Tr(s,r,t,a,n);Q(o,u,i),console.log("[LiveStreams] ✅ 백그라운드 갱신 완료:",o)}catch(u){console.error("[LiveStreams] ❌ 백그라운드 갱신 실패:",u)}})()),e.json({success:!0,data:c});console.log("[LiveStreams] 💾 DB 조회:",o);const l=await Tr(s,r,t,a,n);return Q(o,l,i),e.json({success:!0,data:l})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});async function Tr(e,s,r,t,a){let n=`
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;const o=[];s&&(n+=" AND ls.status = ?",o.push(s)),r&&(n+=" AND ls.seller_id = ?",o.push(r)),n+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',n+=" LIMIT ? OFFSET ?",o.push(parseInt(t),parseInt(a));const{results:i}=await e.prepare(n).bind(...o).all();return i}p.get("/api/live-streams/:id",async e=>{const{DB:s}=e.env,r=e.req.param("id");try{const t=`live_stream:${r}`,a=30,n=be(t);if(n)return console.log("[LiveStream] ⚡ 메모리 캐시 히트:",t),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStream] 🔄 백그라운드 갱신 시작:",t);const i=await Rr(s,r);i&&(Q(t,i,a),console.log("[LiveStream] ✅ 백그라운드 갱신 완료:",t))}catch(i){console.error("[LiveStream] ❌ 백그라운드 갱신 실패:",i)}})()),e.json({success:!0,data:n});console.log("[LiveStream] 💾 DB 조회:",t);const o=await Rr(s,r);return o?(Q(t,o,a),e.json({success:!0,data:o})):e.json({success:!1,error:"Stream not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});async function Rr(e,s){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first()}p.get("/api/products",$s(Us.products),async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const t=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${t||"all"}:${a}:${n}`,i=be(o);if(i)return e.executionCtx.waitUntil((async()=>{try{const l=await Ir(s,t,a,n);Q(o,l,3600),await ps(r,o,l,300,!1)}catch(l){console.error("[Cache Revalidate] Products error:",l)}})()),e.json({success:!0,data:i,cached:!0});const c=await Ir(s,t,a,n);return Q(o,c,3600),await ps(r,o,c,300,!1),e.json({success:!0,data:c,cached:!1})}catch(t){return console.error("Products list error:",t),e.json({success:!1,error:t.message},500)}});async function Ir(e,s,r,t){let a;return s==="true"?a=`
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
    `,(await e.prepare(a).bind(r,t).all()).results||[]}p.get("/api/products/popular",async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const t="products:popular",a=be(t);if(a)return e.executionCtx.waitUntil((async()=>{try{const o=await vr(s);Q(t,o,3600),await ps(r,t,o,600,!1)}catch(o){console.error("[Cache Revalidate] Popular products error:",o)}})()),e.json({success:!0,data:a,cached:!0});const n=await vr(s);return Q(t,n,3600),await ps(r,t,n,600,!1),e.json({success:!0,data:n,cached:!1})}catch(t){return console.error("Popular products error:",t),e.json({success:!1,error:t.message},500)}});async function vr(e){return(await e.prepare(`
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
  `).all()).results||[]}p.get("/api/search/suggestions",async e=>{const{DB:s}=e.env;try{const r=e.req.query("q")||"";if(!r.trim()||r.length<2)return e.json({success:!0,data:{suggestions:[]}});const t=`%${r}%`,a=await s.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(t).all(),n=await s.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(t,t).all(),o=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(n.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:o}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/products/search",async e=>{const{DB:s}=e.env;try{const r=e.req.query("q")||"",t=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!r.trim())return e.json({success:!1,error:"Search query is required"},400);const n=r.trim(),o=`${n}*`;try{if(await s.prepare(`
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
        `).bind(o,t,a).all(),l=await s.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(o).first();return e.json({success:!0,data:{products:c.results||[],total:(l==null?void 0:l.total)||0,query:r,limit:t,offset:a,searchMethod:"fts5"}})}else throw console.log("[Search] ⚠️ FTS5 미사용 - LIKE 검색 fallback"),new Error("FTS5 not available")}catch(i){console.log("[Search] 💾 LIKE 검색 fallback:",i.message);const c=`%${n}%`,l=await s.prepare(`
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
      `).bind(c,c,c,c,c,t,a).all(),u=await s.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(c,c,c,c,c).first();return e.json({success:!0,data:{products:l.results||[],total:(u==null?void 0:u.total)||0,query:r,limit:t,offset:a,searchMethod:"like"}})}}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/products/:id",async e=>{const{DB:s,CACHE_KV:r}=e.env,t=e.req.param("id");try{const a=`product:detail:${t}`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0,cacheSource:"kv"});const o=be(a);if(o)return e.executionCtx.waitUntil((async()=>{try{const c=await Ar(s,t);Q(a,c,1800),await r.put(a,JSON.stringify(c),{expirationTtl:3600})}catch(c){console.error("[Cache Revalidate] Product detail error:",c)}})()),e.json({success:!0,data:o,cached:!0,cacheSource:"memory"});const i=await Ar(s,t);return i?(Q(a,i,1800),await r.put(a,JSON.stringify(i),{expirationTtl:3600}),e.json({success:!0,data:i,cached:!1})):e.json({success:!1,error:"Product not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});async function Ar(e,s){const r=await e.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, '리스터코퍼레이션') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(s).first();if(!r)return null;const t=await e.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(s).all();return{product:r,options:t.results}}p.get("/api/products/:id/options",$s(Us.microCache),async e=>{const{DB:s}=e.env,r=e.req.param("id");try{const t=await s.prepare(`
      SELECT id, product_id, option_type, option_value, price_adjustment, stock
      FROM product_options
      WHERE product_id = ? AND stock > 0
      ORDER BY option_type, option_value
    `).bind(r).all();return e.json({success:!0,data:t.results||[]})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/products/:id/stock",$s(Us.microCache),async e=>{const{DB:s}=e.env,r=e.req.param("id");try{const t=await s.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(r).first();return t?e.json({success:!0,data:{productId:t.id,productName:t.name,stock:t.stock,available:t.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/streams/:streamId/products",async e=>{const{DB:s}=e.env,r=e.req.param("streamId");try{const t=await s.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(r).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/cart",N,async e=>{const{DB:s}=e.env,r=e.get("userId");try{const t=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:`장바구니 조회 실패: ${t.message}`},500)}});p.get("/api/cart/:userId",N,async e=>{const{DB:s}=e.env,r=e.get("userId"),t=e.req.param("userId");try{let a=await s.prepare("SELECT id FROM users WHERE id = ?").bind(r).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(t!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await s.prepare(`
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
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/users",async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),{kakaoId:t,name:a,email:n,phone:o}=r;if(!t||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(t).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await s.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(t,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(r){return console.error("Error creating user:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/cart",S(),N,async e=>{const{DB:s}=e.env;try{const r=e.get("userId");if(!r)return e.json({success:!1,error:"Authentication required"},401);const t=await e.req.json(),{productId:a,optionId:n,quantity:o,priceSnapshot:i,liveStreamId:c}=t,l=r,u=await s.prepare("SELECT stock FROM products WHERE id = ?").bind(a).first();if(!u||u.stock<o)return e.json({success:!1,error:"Insufficient stock"},400);const d=await s.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(l,a,n||null,n||null).first();let m;if(d){const _=d.quantity+o;await s.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(_,i,d.id).run(),m=d.id}else m=(await s.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(l,a,n||null,o,i,c||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:m,isUpdate:!!d}})}catch(r){return console.error("[API /api/cart POST] Error:",r),console.error("[API /api/cart POST] Error message:",r.message),console.error("[API /api/cart POST] Error stack:",r.stack),e.json({success:!1,error:"Failed to add to cart: "+(r.message||"Unknown error")},500)}});p.delete("/api/cart/:cartItemId",N,async e=>{const{DB:s}=e.env,r=e.req.param("cartItemId");try{return await s.prepare("DELETE FROM cart_items WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/cart/clear/:userId",N,vo("cart"),async e=>{const{DB:s}=e.env,r=e.req.param("userId");try{return await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(r).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/cart/:cartItemId",N,async e=>{const{DB:s}=e.env,r=e.req.param("cartItemId");try{const t=await e.req.json(),{quantity:a,option_id:n}=t;if(a!==void 0){if(a<1)return e.json({success:!1,error:"Invalid quantity"},400);const o=await s.prepare(`
        SELECT ci.product_id, ci.option_id, p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.id = ?
      `).bind(r).first();if(!o)return e.json({success:!1,error:"Cart item not found"},404);let i=o.stock;if(o.option_id){const c=await s.prepare("SELECT stock FROM product_options WHERE id = ?").bind(o.option_id).first();c&&(i=c.stock)}if(i<a)return e.json({success:!1,error:"Insufficient stock"},400);await s.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,r).run()}if(n!==void 0){const o=await s.prepare("SELECT stock, price_adjustment FROM product_options WHERE id = ?").bind(n).first();if(!o)return e.json({success:!1,error:"Option not found"},404);const i=await s.prepare("SELECT quantity FROM cart_items WHERE id = ?").bind(r).first();if(!i)return e.json({success:!1,error:"Cart item not found"},404);if(o.stock<i.quantity)return e.json({success:!1,error:"Insufficient stock for selected option"},400);await s.prepare("UPDATE cart_items SET option_id = ? WHERE id = ?").bind(n,r).run()}return e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/orders",N,async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),{userId:t,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:l,recipientPhone:u,deliveryMemo:d,totalAmount:m,shippingFee:_,orderNumber:f,paymentKey:h,paymentMethod:w}=r;if(o&&o.length>0){const D=o.map(F=>F.productId),W=D.map(()=>"?").join(","),U=await s.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${W})
      `).bind(...D).all(),M=new Map(U.results.map(F=>[F.id,F])),$=[],Z=[];try{for(const F of o){const oe=M.get(F.productId);if(!oe)throw new Error(`상품을 찾을 수 없습니다 (ID: ${F.productId})`);if(oe.stock-(oe.reserved_stock||0)<F.quantity)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${oe.name})`);if((await s.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind(F.quantity,F.productId,F.quantity).run()).meta.changes===0)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${oe.name})`);console.log(`[Stock] ✅ 재고 예약 성공: ${oe.name} (${F.quantity}개)`),Z.push({product_id:F.productId,quantity:F.quantity}),$.push({product_id:F.productId,option_id:F.optionId||null,quantity:F.quantity,price:F.price,product_name:oe.name,product_stock:oe.stock})}}catch(F){if(console.error("[Stock] ❌ 재고 예약 실패:",F.message),Z.length>0){console.log(`[Stock] 🔄 ${Z.length}개 상품 예약 롤백 시작...`);for(const oe of Z)await s.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(oe.quantity,oe.product_id).run();console.log("[Stock] ✅ 예약 롤백 완료")}return e.json({success:!1,error:F.message},400)}const z=new Date,v=z.getFullYear().toString().slice(-2),re=(z.getMonth()+1).toString().padStart(2,"0"),q=z.getDate().toString().padStart(2,"0"),P=`${v}${re}${q}`,H=Math.random().toString(36).substring(2,7).toUpperCase(),te=f||`ORD-${P}-${H}`,xs=c?`${i} ${c}`:i,De=new Date(Date.now()+600*1e3).toISOString(),Ss=(await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(te,t||null,m||0,"pending","pending",xs||null,l||null,u||null,d||null,h||null,De).run()).meta.last_row_id;for(const F of $)await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ss,F.product_id,F.option_id,F.quantity,F.price,F.product_name).run();return console.log(`[Order] ✅ 주문 생성 완료: ${te} (예약 만료: ${De})`),e.json({success:!0,data:{orderId:Ss,orderNumber:te,totalAmount:m}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const b=a.map(()=>"?").join(","),g=await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${b})
    `).bind(...a).all();if(g.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const D of g.results)if(D.product_stock<D.quantity)return e.json({success:!1,error:`Insufficient stock for ${D.product_name}`},400);const T=g.results.reduce((D,W)=>D+W.price_snapshot*W.quantity,0),y=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,L=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(y,t,T,n.address,n.name,n.phone).run()).meta.last_row_id,C=[];for(const D of g.results){let W=!1,U="";for(let M=0;M<3;M++){const $=await s.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(D.product_id).first();if(!$){U=`상품을 찾을 수 없습니다: ${D.product_name}`;break}const Z=$.stock,z=$.version;if(Z<D.quantity){U=`재고 부족: ${D.product_name} (남은 재고: ${Z}개)`;break}if((await s.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND version = ?
            AND stock >= ?
            AND is_active = 1
        `).bind(D.quantity,D.product_id,z,D.quantity).run()).meta.changes>0){W=!0,console.log(`[재고] ✅ 재고 차감 성공: ${D.product_name} (수량: ${D.quantity}, 버전: ${z} → ${z+1})`);break}console.warn(`[재고] ⚠️ 버전 충돌 감지 (시도 ${M+1}/3): ${D.product_name}`),M<2?await new Promise(re=>setTimeout(re,50*(M+1))):U="주문 처리 중 오류 발생. 잠시 후 다시 시도해주세요. (동시 주문 처리 중)"}if(!W)return e.json({success:!1,error:U||"주문 처리 중 오류가 발생했습니다."},U.includes("재고 부족")?400:409);C.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(L,D.product_id,D.option_id,D.quantity,D.price_snapshot,D.product_name))}C.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${b})`).bind(...a)),await s.batch(C);try{const D=g.results.map(M=>M.product_id),W=D.map(()=>"?").join(","),U=await s.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${W}) AND seller_id IS NOT NULL
      `).bind(...D).all();for(const M of U.results){const $=M.seller_id;await Do(s,$,y,buyerName||shippingName||"고객",T)}}catch(D){console.error("[Order] Notification error:",D)}return e.json({success:!0,data:{orderId:L,orderNumber:y,totalAmount:T}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/current-product",async e=>{const{DB:s,LIVE_CACHE:r}=e.env,t=e.req.param("streamId");try{const a=`current-product:${t}`,n=await tt(r,a,3);if(n)return e.json({success:!0,data:n});const o=await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(t).first();if(!o||!o.current_product_id)return await Cs(r,a,null,3),e.json({success:!0,data:null});const i=await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(o.current_product_id).first(),c=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(),l={product:i,options:c.results};return await Cs(r,a,l,3),e.json({success:!0,data:l})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:s}=e.env,r=e.req.param("streamId"),t=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${r}`,n=`current-product:${r}`,o=25e3,i=Date.now();for(;Date.now()-i<o;){const c=await s.get(a)||"0";if(c!==t){const l=await tt(s,n,30);return e.json({success:!0,timestamp:c,data:l,changed:!0})}await new Promise(l=>setTimeout(l,1e3))}return e.json({success:!0,timestamp:t,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/dashboard/stats",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=r.sellerId,a=e.req.query("period")||"7d";let n=7;a==="30d"?n=30:a==="90d"&&(n=90);const o=await s.prepare(`
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
    `).bind(t,`-${n} days`).all(),i=await s.prepare(`
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
    `).bind(t,`-${n} days`).first(),c=await s.prepare(`
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
    `).bind(t,`-${n} days`).all();return e.json({success:!0,data:{period:a,daily:o.results||[],summary:i||{},topProducts:c.results||[]}})}catch(t){return console.error("Error loading seller dashboard stats:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/analytics/products",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=r.sellerId,a=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(t){return console.error("Error loading product analytics:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/streams",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=r.sellerId,a=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(t){return console.error("Error loading seller streams:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/streams",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:t,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:l,seller_instagram:u,seller_youtube:d,seller_facebook:m}=await e.req.json();let _=n,f="youtube",h=null,w=null,b=i;if(o&&!_&&(_=vt(o),!_))if(_=At(o),h=Dt(o),w=Lo(o),_)f="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!b&&_&&f==="youtube"&&(b=`https://img.youtube.com/vi/${_}/maxresdefault.jpg`),!t||!_)return e.json({success:!1,error:"Title and live stream URL are required"},400);const g=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a||null,_,l||"scheduled",c||null,r.sellerId,u||null,d||null,m||null,f,h,w,b||null).run(),T=await s.prepare(`
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
    `).bind(g.meta.last_row_id).first(),y=await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(r.sellerId).first();try{const{sendLiveStreamCreatedEmail:R}=await Promise.resolve().then(()=>Wo);R({streamId:g.meta.last_row_id,title:t,sellerName:(y==null?void 0:y.display_name)||(y==null?void 0:y.username)||"알 수 없음",platform:f,scheduledAt:c,status:l||"scheduled"}).then(L=>{L.success?console.log(`[Email] Live stream notification sent for stream #${L.meta.last_row_id}`):console.error("[Email] Failed to send notification:",L.error)}).catch(L=>{console.error("[Email] Exception while sending notification:",L)})}catch(R){console.error("[Email] Failed to send live stream notification:",R)}return await ts(e.env,as.LIVE_STREAMS),e.json({success:!0,data:T})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:l,status:u,seller_instagram:d,seller_youtube:m,seller_facebook:_}=await e.req.json(),f=[],h=[];if(n!==void 0&&(f.push("title = ?"),h.push(n)),o!==void 0&&(f.push("description = ?"),h.push(o)),c!==void 0||i!==void 0){let w=i,b="youtube",g=null;if(c&&(w=vt(c),!w))if(w=At(c),g=Dt(c),w)b="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);w!==void 0&&(f.push("youtube_video_id = ?"),h.push(w),f.push("platform = ?"),h.push(b),b==="tiktok"&&g&&(f.push("tiktok_username = ?"),h.push(g)))}return u!==void 0&&(f.push("status = ?"),h.push(u)),l!==void 0&&(f.push("scheduled_at = ?"),h.push(l)),d!==void 0&&(f.push("seller_instagram = ?"),h.push(d)),m!==void 0&&(f.push("seller_youtube = ?"),h.push(m)),_!==void 0&&(f.push("seller_facebook = ?"),h.push(_)),f.length===0?e.json({success:!1,error:"No fields to update"},400):(f.push("updated_at = datetime('now')"),await s.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...h,t).run(),await ts(e.env,as.LIVE_STREAMS),e.json({success:!0}))}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first()?(await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(t).run(),await ts(e.env,as.LIVE_STREAMS),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/youtube/create-live",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:t,description:a,scheduled_at:n}=await e.req.json();if(!t)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await ko({accessToken:o},t,a||""),l=(await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a||null,i.broadcastId,n||null,r.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await ws(s,r.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${t} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${l}`),e.json({success:!0,data:{streamId:l,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(t){return console.error("[YouTube Live] Create broadcast error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("streamId"),a=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const o=a.youtube_broadcast_id||a.youtube_video_id;return o?(await Co({accessToken:n},o),await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),await ws(s,r.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(t){return console.error("[YouTube Live] End broadcast error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("streamId"),a=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=a.youtube_video_id;if(!n)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const o=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!o&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await jo({apiKey:o,accessToken:i},n);return e.json({success:!0,data:{streamId:t,videoId:n,stats:c}})}catch(t){return console.error("[YouTube Live] Get stats error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("streamId"),a=e.req.query("pageToken"),n=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first();if(!n)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=n.youtube_live_chat_id;if(!o)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await No({accessToken:i},o,a);return e.json({success:!0,data:c})}catch(t){return console.error("[YouTube Live] Get chat messages error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/admin/streams",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:t,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!t)return e.json({success:!1,error:"제목은 필수입니다"},400);const l=o||"youtube";if(l==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(l==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const u=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(t,a||null,n||null,l,i||null,c||"scheduled",r.sellerId||null).run();return await ts(e.env,as.LIVE_STREAMS),e.json({success:!0,data:{id:u.meta.last_row_id,title:t,description:a,youtube_video_id:n,platform:l,tiktok_username:i,status:c||"scheduled"}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:l}=await e.req.json();return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,l,t).run(),await ts(e.env,as.LIVE_STREAMS),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a,r.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(a).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,t).run();const{LIVE_CACHE:c}=e.env,l=`product-timestamp:${t}`,u=`current-product:${t}`,d=Date.now().toString();await c.put(l,d),await Cs(c,u,{product:o,options:i.results},30);try{await Ae(e.env).changeCurrentProduct(parseInt(t),a),console.log(`🔥 Firebase: Product changed for stream ${t} to ${a}`)}catch(m){console.error("⚠️ Firebase sync failed (non-blocking):",m)}return e.json({success:!0,data:{product:o,options:i.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(t).run(),await ts(e.env,as.LIVE_STREAMS),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,r=e.req.param("streamId");try{const{productId:t}=await e.req.json(),a=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id FROM products WHERE id = ? AND is_active = 1").bind(t).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(t).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(t,r).run();const{LIVE_CACHE:o}=e.env,i=`product-timestamp:${r}`,c=`current-product:${r}`,l=Date.now().toString();return await o.put(i,l),await Cs(o,c,{product:a,options:n.results},30),e.json({success:!0,data:{product:a,options:n.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/wishlists",S(),async e=>{const{DB:s}=e.env;try{const{userId:r,productId:t}=await e.req.json();if(!r||!t)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await s.prepare("SELECT id FROM users WHERE id = ?").bind(r).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const n=await s.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(t).first();if(!n)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,t).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await s.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(r,t).run();return e.json({success:!0,data:{id:i.meta.last_row_id,userId:r,productId:t,productName:n.name}})}catch(r){return console.error("[Wishlist] Add error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/wishlists/:id",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),{userId:t}=e.req.query();return t?await s.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(r,t).first()?(await s.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(r,t).run(),e.json({success:!0,message:"찜 목록에서 삭제되었습니다."})):e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(r){return console.error("[Wishlist] Delete error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/wishlists/product/:productId",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("productId"),{userId:t}=e.req.query();return t?(await s.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,r).run()).meta.changes===0?e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!0,message:"찜 목록에서 삭제되었습니다."}):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(r){return console.error("[Wishlist] Delete by product error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/wishlists/:userId",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("userId"),t=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0"),{results:n}=await s.prepare(`
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
    `).bind(r,t,a).all(),o=await s.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(r).first();return e.json({success:!0,data:{items:n,total:(o==null?void 0:o.count)||0,limit:t,offset:a}})}catch(r){return console.error("[Wishlist] Get error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/wishlists/check/:userId/:productId",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("userId"),t=e.req.param("productId"),a=await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,t).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(r){return console.error("[Wishlist] Check error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/shipping-addresses/:id",N,async e=>{const{DB:s}=e.env,r=e.req.param("id");e.get("userId");try{return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r,userId).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/seller/products",async e=>{const{DB:s,CACHE_KV:r}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const a=`seller:${t.sellerId}:products`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(t.sellerId).all();return await r.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/seller/upload-image",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{image:t,filename:a}=await e.req.json();if(!t)return e.json({success:!1,error:"Image data is required"},400);const n=t.match(/^data:(image\/[\w+]+);base64,/);if(!n)return e.json({success:!1,error:"잘못된 이미지 형식입니다."},400);const o=n[1],i=t.replace(/^data:image\/\w+;base64,/,"");let c;try{c=Uint8Array.from(atob(i),m=>m.charCodeAt(0))}catch{return e.json({success:!1,error:"이미지 디코딩 실패"},400)}const l=10*1024*1024;if(c.length>l)return e.json({success:!1,error:`파일 크기가 너무 큽니다. 최대 ${l/1024/1024}MB까지 허용됩니다.`},400);const u=await ha(c.buffer);if(!u.valid)return e.json({success:!1,error:"유효하지 않은 이미지 파일입니다."},400);const d=e.env.IMAGES;if(d){console.log("[Image Upload] Using R2 storage");const m=Ea(a||"upload.jpg"),_=`products/${r.sellerId}/${m}`;await d.put(_,c,{httpMetadata:{contentType:u.detectedType||o}});const f=`/api/images/${_}`;return e.json({success:!0,url:f,variants:{thumbnail:`${f}?width=200&format=webp`,medium:`${f}?width=800&format=webp`,large:`${f}?width=1600&format=webp`,original:f},storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),t.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:t,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(t){return console.error("[Image Upload] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/images/*",async e=>{var s;try{const r=e.env.IMAGES;if(!r)return e.json({success:!1,error:"R2 not configured"},503);const t=e.req.path.replace("/api/images/",""),a=e.req.query("width"),n=e.req.query("format"),o=e.req.query("quality")||"85",i=await r.get(t);if(!i)return e.notFound();const c={"Content-Type":((s=i.httpMetadata)==null?void 0:s.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"};if(a||n){const l=[];a&&l.push(`width=${a}`),n&&l.push(`format=${n}`),o&&l.push(`quality=${o}`),c["cf-resize"]=l.join(",")}return new Response(i.body,{headers:c})}catch(r){return console.error("[Image Get] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/products",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{name:t,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:l,category:u,live_stream_id:d,is_active:m}=await e.req.json();if(!t||!n)return e.json({success:!1,error:"Name and price are required"},400);if(d&&!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d,r.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const _=await s.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a||null,n,o||null,i||0,c||null,l||0,u||null,d||null,r.sellerId,m!==void 0?m:1).run(),f=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(_.meta.last_row_id).first();return await bs(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0,data:f})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{options:a}=await e.req.json();if(!await s.prepare("SELECT id FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);if(!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"Options array is required"},400);await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(t).run();for(const i of a){const{option_type:c,option_value:l,price_adjustment:u,stock:d}=i;!c||!l||await s.prepare(`
        INSERT INTO product_options (
          product_id, option_type, option_value, price_adjustment, stock
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(t,c,l,u||0,d||0).run()}const o=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(t).all();return await bs(e.env.CACHE_KV,`product:detail:${t}`,`product:options:${t}`),e.json({success:!0,data:o.results,message:`${o.results.length} options saved successfully`})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/seller/products/:id/options/:optionId",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=e.req.param("optionId");return await s.prepare(`
      SELECT po.id 
      FROM product_options po
      JOIN products p ON po.product_id = p.id
      WHERE po.id = ? AND po.product_id = ? AND p.seller_id = ?
    `).bind(a,t,r.sellerId).first()?(await s.prepare("DELETE FROM product_options WHERE id = ?").bind(a).run(),await bs(e.env.CACHE_KV,`product:detail:${t}`,`product:options:${t}`),e.json({success:!0,message:"Option deleted successfully"})):e.json({success:!1,error:"Option not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/seller/products/:id",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(t,r.sellerId).first();if(!a)return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(t).all();return e.json({success:!0,data:{...a,options:n.results||[]}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/seller/products/:id",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:l,stock:u,category:d,is_active:m,live_stream_id:_}=await e.req.json(),f=[],h=[];if(n!==void 0&&(f.push("name = ?"),h.push(n)),o!==void 0&&(f.push("description = ?"),h.push(o)),i!==void 0&&(f.push("price = ?"),h.push(i)),c!==void 0&&(f.push("original_price = ?"),h.push(c),i!==void 0&&c)){const b=Math.round((c-i)/c*100);f.push("discount_rate = ?"),h.push(b)}if(l!==void 0&&(f.push("image_url = ?"),h.push(l)),u!==void 0&&(f.push("stock = ?"),h.push(u)),d!==void 0&&(f.push("category = ?"),h.push(d)),m!==void 0&&(f.push("is_active = ?"),h.push(m?1:0)),_!==void 0&&(f.push("live_stream_id = ?"),h.push(_||null)),f.push("updated_at = CURRENT_TIMESTAMP"),h.push(t,r.sellerId),f.length===1)return e.json({success:!1,error:"No fields to update"},400);await s.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...h).run();const w=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(t).first();return await bs(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0,data:w})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/seller/products/:id",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(t).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(t).run(),await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(t).run(),await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(t).run(),await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).run(),await bs(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0}))}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(t).all();return e.json({success:!0,data:n.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const l=await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(t,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:l.meta.last_row_id,product_id:t,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("productId"),a=e.req.param("optionId");return await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first()?(await s.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,t).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/seller/stats",async e=>{const{DB:s,CACHE_KV:r}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const a=`seller:${t.sellerId}:stats`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(t.sellerId).first(),i=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(t.sellerId).first(),c=await s.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(t.sellerId).first(),l=await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(t.sellerId).first(),u=await s.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(t.sellerId).first(),d=await s.prepare(`
      SELECT SUM(viewer_count) as total
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(t.sellerId).first(),m=(d==null?void 0:d.total)||0,_={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:l.count||0,totalRevenue:l.total||0,activeStreams:u.count||0,totalViewers:m};return await r.put(a,JSON.stringify(_),{expirationTtl:60}),e.json({success:!0,data:_})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/stats/sales",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.query("period")||"daily";let a,n,o;switch(t){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await s.prepare(`
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
    `).bind(r.sellerId).all();return e.json({success:!0,data:{period:t,sales:i.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/seller/stats/products",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await s.prepare(`
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
    `).bind(r.sellerId,t).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/business-info",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{business_number:t,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:l,phone:u,email:d}=await e.req.json();if(!t||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const m=await s.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();let _;return m?_=await s.prepare(`
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
      `).bind(t,a,n,o,i,c,l,u,d,r.sellerId).run():_=await s.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(r.sellerId,t,a,n,o,i,c,l,u,d).run(),e.json({success:!0,data:{id:m?m.id:_.meta.last_row_id,seller_id:r.sellerId,business_number:t,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(t){return console.error("사업자 정보 등록 오류:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/business-info",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);const t=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(t).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(t).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});p.get("/api/admin/seller-business",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:t.results||[]})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/orders",N,async e=>{const{DB:s}=e.env,r=e.get("userId");try{const t=await s.prepare(`
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
    `).bind(r).all(),a=new Map;for(const o of t.results){const i=o.id;a.has(i)||a.set(i,{id:o.id,user_id:o.user_id,order_number:o.order_number,status:o.status,total_amount:o.total_amount,shipping_fee:o.shipping_fee,payment_method:o.payment_method,payment_key:o.payment_key,shipping_address:o.shipping_address,shipping_name:o.shipping_name,shipping_phone:o.shipping_phone,delivery_request:o.delivery_request,created_at:o.created_at,updated_at:o.updated_at,items:[]}),o.item_id&&a.get(i).items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value})}const n=Array.from(a.values());return e.json({success:!0,data:n})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/orders/user/:userId",N,async e=>{const{DB:s}=e.env,r=e.get("userId"),t=parseInt(e.req.param("userId"));try{if(t!==r)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await s.prepare(`
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
    `).bind(r).all(),n=new Map;for(const i of a.results){const c=i.id;n.has(c)||n.set(c,{id:i.id,user_id:i.user_id,order_number:i.order_number,status:i.status,total_amount:i.total_amount,shipping_fee:i.shipping_fee,payment_method:i.payment_method,payment_key:i.payment_key,shipping_address:i.shipping_address,shipping_name:i.shipping_name,shipping_phone:i.shipping_phone,delivery_request:i.delivery_request,created_at:i.created_at,updated_at:i.updated_at,items:[]}),i.item_id&&n.get(c).items.push({id:i.item_id,product_id:i.product_id,option_id:i.option_id,quantity:i.quantity,price:i.item_price,product_name:i.product_name,image_url:i.image_url,option_value:i.option_value})}const o=Array.from(n.values());return e.json({success:!0,data:o})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/orders/:orderNumber",N,async e=>{const{DB:s}=e.env,r=e.req.param("orderNumber");try{const t=await s.prepare(`
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
    `).bind(r).all();if(t.results.length===0)return e.json({success:!1,error:"Order not found"},404);const a=t.results[0],n={id:a.id,user_id:a.user_id,order_number:a.order_number,status:a.status,total_amount:a.total_amount,shipping_fee:a.shipping_fee,payment_method:a.payment_method,payment_key:a.payment_key,shipping_address:a.shipping_address,shipping_name:a.shipping_name,shipping_phone:a.shipping_phone,delivery_request:a.delivery_request,created_at:a.created_at,updated_at:a.updated_at,items:[]};for(const o of t.results)o.item_id&&n.items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value});return e.json({success:!0,data:n})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/orders/:orderId/cancel",N,async e=>{const{DB:s}=e.env,r=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await s.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(r).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(r).all();if(o.results.length>0){const i=o.results.map(c=>s.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity,c.product_id));await s.batch(i)}return await s.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,r).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:r,reason:a,itemsRestored:o.results.length}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/streams/:streamId/viewer/join",async e=>{const{SESSION_KV:s}=e.env;try{const r=e.req.param("streamId"),t=e.req.header("X-Session-ID")||crypto.randomUUID(),a=`stream:${r}:viewer:${t}`;return await s.put(a,Date.now().toString(),{expirationTtl:60}),e.json({success:!0,sessionId:t,message:"Viewer session updated"})}catch(r){return console.error("[Viewer Join] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:s,SESSION_KV:r}=e.env;try{const t=e.req.param("streamId");let a=null,n=null;try{a=await s.prepare("SELECT id, manual_viewer_count FROM live_streams WHERE id = ?").bind(t).first(),a&&(n=a.manual_viewer_count)}catch{console.warn("[Viewer Count] manual_viewer_count column not found, using fallback query"),a=await s.prepare("SELECT id FROM live_streams WHERE id = ?").bind(t).first()}if(!a)return e.json({success:!1,error:"Stream not found"},404);if(n!=null)return e.json({success:!0,data:{viewer_count:n,is_manual:!0}});const o=`stream:${t}:viewer:`,c=(await r.list({prefix:o})).keys.length;return e.json({success:!0,data:{viewer_count:c,is_manual:!1}})}catch(t){return console.error("[Viewer Count] Error:",t),e.json({success:!1,error:t.message},500)}});p.put("/api/streams/:streamId/viewer-count",N,async e=>{const{DB:s}=e.env,{userId:r,userType:t}=e.get("user");try{const a=e.req.param("streamId"),{manual_count:n}=await e.req.json();if(t!=="seller")return e.json({success:!1,error:"Only sellers can manipulate viewer count"},403);const o=await s.prepare(`
      SELECT ls.id, s.can_manipulate_stats
      FROM live_streams ls
      JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.id = ? AND ls.seller_id = ?
    `).bind(a,r).first();return o?o.can_manipulate_stats?(await s.prepare("UPDATE live_streams SET manual_viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{manual_count:n,message:n===null?"Reverted to actual viewer count":"Manual viewer count updated"}})):e.json({success:!1,error:"You do not have permission to manipulate stats. Please contact admin for approval."},403):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(a){return console.error("[Update Viewer Count] Error:",a),e.json({success:!1,error:a.message},500)}});p.post("/api/streams/:streamId/fake-cart-notification",N,async e=>{const{DB:s}=e.env,{userId:r,userType:t}=e.get("user");try{const a=e.req.param("streamId"),{product_name:n,quantity:o=1}=await e.req.json();if(t!=="seller")return e.json({success:!1,error:"Only sellers can send fake notifications"},403);const i=await s.prepare(`
      SELECT ls.id, s.can_manipulate_stats, s.display_name
      FROM live_streams ls
      JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.id = ? AND ls.seller_id = ?
    `).bind(a,r).first();if(!i)return e.json({success:!1,error:"Stream not found or unauthorized"},404);if(!i.can_manipulate_stats)return e.json({success:!1,error:"You do not have permission to send fake notifications. Please contact admin for approval."},403);const c=`🎉 ${n} ${o}개가 장바구니에 추가되었습니다!`;try{await(await Promise.resolve().then(()=>In)).getDatabase().ref(`chats/stream${a}`).push({userId:0,userName:"System",userType:"system",message:c,timestamp:Date.now(),isSeller:!1,isAdmin:!1}),console.log(`[Fake Cart Notification] ✅ Message sent to Firebase: ${c}`)}catch(l){console.error("[Fake Cart Notification] Firebase error:",l)}return e.json({success:!0,data:{message:c,note:"Fake notification sent to chat"}})}catch(a){return console.error("[Fake Cart Notification] Error:",a),e.json({success:!1,error:a.message},500)}});p.post("/api/payments/confirm",async e=>{var t;const{DB:s}=e.env;let r=null;try{r=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=r;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!n,amount:!!o}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await s.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",n),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:n},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(o)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(o),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(o),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const l="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const u={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(u,null,2)),console.log("[Payment] 📊 amount 타입:",typeof u.amount),console.log("[Payment] 📊 amount 값:",u.amount);const d=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:l,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(u)}),m=await d.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",d.status),console.log("  - 응답 OK?:",d.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(m).substring(0,300)),!d.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",d.status),console.error("[Payment] 에러 코드:",m.code),console.error("[Payment] 에러 메시지:",m.message),console.error("[Payment] 전체 응답:",JSON.stringify(m,null,2)),e.json({success:!1,error:m.message||"결제 승인에 실패했습니다.",code:m.code,tossError:m},d.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await s.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            reservation_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const _=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();if(_.results.length>0){console.log(`[Stock] 🔒 재고 확정 시작: ${_.results.length}개 상품`);const f=_.results.map(b=>s.prepare(`
            UPDATE products 
            SET stock = stock - ?,
                reserved_stock = reserved_stock - ?
            WHERE id = ?
          `).bind(b.quantity,b.quantity,b.product_id)),h=await s.batch(f);let w=0;for(let b=0;b<h.length;b++)if(h[b].meta.changes>0){w++;const g=_.results[b];console.log(`[Stock] ✅ 재고 확정: product_id=${g.product_id}, quantity=${g.quantity}`)}else{const g=_.results[b];console.error(`[Stock] ⚠️ 재고 확정 실패: product_id=${g.product_id}`)}console.log(`[Stock] ✅ 재고 확정 완료: ${w}/${_.results.length}개 성공`);try{const b=_.results.map(y=>y.product_id),g=b.map(()=>"?").join(","),T=await s.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${g})
          `).bind(...b).all();for(const y of T.results){const R=y.stock_alert_threshold||10,L=y.stock||0,C=y.reserved_stock||0,D=L-C;D<=R&&y.seller_id&&(await It(s,y.seller_id,y.name,D,R),console.log(`[Low Stock Alert] 📢 ${y.name}: 가용재고 ${D}개 (임계값 ${R}개)`))}}catch(b){console.error("[Low Stock Alert] ⚠️ 알림 전송 실패:",b)}}try{const f=i.id,h=await Ga(e.env,f);h.success?console.log(`[Payment] ✅ 알림톡 발송 성공 (주문 ${f})`):console.warn(`[Payment] ⚠️ 알림톡 발송 실패 (주문 ${f}):`,h.reason||h.error)}catch(f){console.error("[Payment] ⚠️ 알림톡 발송 중 오류:",f)}}catch(_){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",_)}if(e.env.DISCORD_WEBHOOK_URL)try{await Sn(e.env.DISCORD_WEBHOOK_URL,"결제 성공",`주문번호 ${n} 결제 완료`,{주문번호:n,결제금액:`₩${Number(o).toLocaleString()}`,결제키:a.substring(0,20)+"...",사용자ID:i.user_id})}catch(_){console.error("[Discord] 결제 성공 알림 실패:",_)}return e.json({success:!0,data:m})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:r==null?void 0:r.orderId,error:a.message,stack:(t=a.stack)==null?void 0:t.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});p.post("/api/payments/rollback",async e=>{var r;const{DB:s}=e.env;try{const{orderId:t,reason:a}=await e.req.json();if(console.log("========================================"),console.log("[Rollback] 🔄 재고 예약 해제 시작"),console.log("========================================"),console.log("[Rollback] 주문 번호:",t),console.log("[Rollback] 사유:",a||"결제 실패"),!t)return e.json({success:!1,error:"주문 번호가 필요합니다."},400);const n=await s.prepare("SELECT id, order_number, status FROM orders WHERE order_number = ?").bind(t).first();if(!n)return console.warn("[Rollback] ⚠️ 주문을 찾을 수 없음:",t),e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(n.status==="paid")return console.warn("[Rollback] ⚠️ 이미 결제 완료된 주문:",t),e.json({success:!1,error:"이미 결제가 완료된 주문입니다."},400);console.log("[Rollback] ✅ 주문 확인됨:",n.order_number);const o=await s.prepare(`
      SELECT product_id, quantity 
      FROM order_items 
      WHERE order_id = ?
    `).bind(n.id).all();if(o.results.length===0)return console.warn("[Rollback] ⚠️ 주문 아이템 없음"),e.json({success:!1,error:"주문 아이템을 찾을 수 없습니다."},404);console.log(`[Rollback] 📦 ${o.results.length}개 상품 예약 해제 시작...`);const i=o.results.map(u=>s.prepare(`
        UPDATE products 
        SET reserved_stock = CASE 
          WHEN reserved_stock >= ? THEN reserved_stock - ?
          ELSE 0
        END
        WHERE id = ?
      `).bind(u.quantity,u.quantity,u.product_id)),c=await s.batch(i);let l=0;for(let u=0;u<c.length;u++)if(c[u].meta.changes>0){l++;const d=o.results[u];console.log(`[Rollback] ✅ 예약 해제: product_id=${d.product_id}, quantity=${d.quantity}`)}return console.log(`[Rollback] ✅ 예약 해제 완료: ${l}/${o.results.length}개 성공`),await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'failed',
          reservation_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(t).run(),console.log("[Rollback] ✅ 주문 취소 완료:",t),e.json({success:!0,message:"재고 예약이 해제되었습니다.",data:{orderId:t,releasedItems:l}})}catch(t){return console.error("[Rollback] ❌ 예약 해제 실패:",{error:t.message,stack:(r=t.stack)==null?void 0:r.substring(0,500)}),e.json({success:!1,error:"재고 예약 해제 중 오류가 발생했습니다.",details:t.message},500)}});p.post("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,r=e.req.param("liveStreamId");try{const t=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:l}=t;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await s.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(r,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const u=["씨발","개새끼","병신","좆","시발"];let d=i;u.forEach(_=>{const f=new RegExp(_,"gi");d=d.replace(f,"*".repeat(_.length))});const m=await s.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,n,o||null,d,c?1:0,l?1:0).run();return e.json({success:!0,data:{id:m.meta.last_row_id,message:d}})}catch(t){return console.error("Error sending chat message:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,r=e.req.param("liveStreamId"),t=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
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
    `;const o=[r];t&&(n+=" AND id > ?",o.push(Number(t))),n+=" ORDER BY created_at DESC LIMIT ?",o.push(a);const c=(await s.prepare(n).bind(...o).all()).results.reverse();return e.json({success:!0,data:c})}catch(n){return console.error("Error fetching chat messages:",n),e.json({success:!1,error:n.message},500)}});p.delete("/api/chat/:liveStreamId/messages/:messageId",S(),async e=>{const{DB:s}=e.env,r=e.req.param("messageId");try{return await s.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(t){return console.error("Error deleting chat message:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/chat/:liveStreamId/ban",S(),async e=>{const{DB:s}=e.env,r=e.req.param("liveStreamId");try{const t=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=t;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const l=new Date;l.setMinutes(l.getMinutes()+i),c=l.toISOString()}return await s.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(r,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(t){return console.error("Error banning user:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/chat/:liveStreamId/ban/:userId",S(),async e=>{const{DB:s}=e.env,r=e.req.param("liveStreamId"),t=e.req.param("userId");try{return await s.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(r,t).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});async function Mo(e,s,r){try{const t=new TextEncoder,a=t.encode(r),n=t.encode(e),o=await crypto.subtle.importKey("raw",a,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),i=await crypto.subtle.sign("HMAC",o,n),c=Array.from(new Uint8Array(i)),l=btoa(String.fromCharCode(...c));return s===l}catch(t){return console.error("[Webhook] 서명 검증 오류:",t),!1}}p.post("/api/payments/webhook",async e=>{const{DB:s}=e.env;try{const r=e.req.header("toss-signature"),t=await e.req.text();if(r&&e.env.TOSS_SECRET_KEY){if(!await Mo(t,r,e.env.TOSS_SECRET_KEY))return console.error("[Webhook] ❌ 서명 검증 실패 - 위조된 웹훅 요청"),e.json({success:!1,error:"Invalid signature"},401);console.log("[Webhook] ✅ 서명 검증 성공")}else console.warn("[Webhook] ⚠️ 서명 검증 건너뜀 (개발 환경 또는 서명 없음)");const a=JSON.parse(t);switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:a.eventType,orderId:a.orderId,status:a.status,timestamp:new Date().toISOString()}),a.eventType){case"PAYMENT_STATUS_CHANGED":await Fo(s,a);break;case"VIRTUAL_ACCOUNT_ISSUED":await $o(s,a);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",a.eventType)}return e.json({success:!0})}catch(r){return console.error("[Webhook] ❌ 웹훅 처리 실패:",r.message),e.json({success:!1,error:r.message},500)}});async function Fo(e,s){const{orderId:r,status:t,paymentKey:a}=s;console.log("[Webhook] 결제 상태 변경:",{orderId:r,status:t}),await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(t,JSON.stringify(s),a).run(),(t==="DONE"||t==="completed")&&(await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",r))}async function $o(e,s){const{orderId:r,virtualAccount:t}=s;console.log("[Webhook] 가상계좌 발급:",{orderId:r,bank:t==null?void 0:t.bank,accountNumber:t==null?void 0:t.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(t==null?void 0:t.bank,t==null?void 0:t.accountNumber,t==null?void 0:t.customerName,t==null?void 0:t.dueDate,JSON.stringify(s),r).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",r)}p.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:s}=e.env;try{const r=e.req.param("paymentKey"),t=await e.req.json(),{cancelReason:a,cancelAmount:n}=t;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:r,cancelReason:a,cancelAmount:n}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const o=await s.prepare(`
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
    `).bind(r).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const l=So(i,c),u=n&&n<o.amount,d=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:r,cancelAmount:d,isPartial:u});const m=await l.cancelPayment({paymentKey:r,cancelReason:a,cancelAmount:d});return m.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:r,cancelAmount:d,canceledAt:m.canceledAt}),await s.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED",m.canceledAt||new Date().toISOString(),JSON.stringify(m),r).run(),await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${r}`),e.json({success:!0,data:{paymentKey:r,orderId:o.order_id,cancelAmount:d,canceledAt:m.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,m.error),e.json({success:!1,error:m.error||"결제 취소에 실패했습니다."},400))}catch(r){return console.error("[Payment] ❌ 결제 취소 처리 실패:",r.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});p.get("/api/payments/:paymentKey",async e=>{const{DB:s}=e.env;try{const r=e.req.param("paymentKey"),t=await s.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(r).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404)}catch(r){return console.error("[Payment] ❌ 결제 조회 실패:",r.message),e.json({success:!1,error:"결제 조회 중 오류가 발생했습니다."},500)}});p.get("/api/payments/order/:orderId",async e=>{const{DB:s}=e.env;try{const r=e.req.param("orderId"),t=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:t.results||[]})}catch(r){return console.error("[Payment] ❌ 결제 목록 조회 실패:",r.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});p.get("/api/seller/orders",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.query("status"),a=e.req.query("start_date"),n=e.req.query("end_date"),o=e.req.query("min_amount"),i=e.req.query("max_amount"),c=parseInt(e.req.query("page")||"1"),l=parseInt(e.req.query("limit")||"50"),u=(c-1)*l,d=["oi.seller_id = ?"],m=[r.sellerId];t&&(d.push("o.status = ?"),m.push(t)),a&&(d.push("DATE(o.created_at) >= ?"),m.push(a)),n&&(d.push("DATE(o.created_at) <= ?"),m.push(n)),o&&(d.push("o.total_amount >= ?"),m.push(parseInt(o))),i&&(d.push("o.total_amount <= ?"),m.push(parseInt(i)));const _=d.join(" AND "),f=await s.prepare(`
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
      WHERE ${_}
      ORDER BY o.created_at DESC, oi.id ASC
      LIMIT ? OFFSET ?
    `).bind(...m,l,u).all(),h=await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${_}
    `).bind(...m).first(),w=(h==null?void 0:h.total)||0,b=Math.ceil(w/l),g=new Map;for(const y of f.results){const R=y.id;g.has(R)||g.set(R,{id:y.id,user_id:y.user_id,user_name:y.user_name,order_number:y.order_number,status:y.status,total_amount:y.total_amount,shipping_fee:y.shipping_fee,payment_method:y.payment_method,payment_key:y.payment_key,shipping_address:y.shipping_address,shipping_name:y.shipping_name,shipping_phone:y.shipping_phone,delivery_request:y.delivery_request,created_at:y.created_at,updated_at:y.updated_at,items:[]}),y.item_id&&g.get(R).items.push({id:y.item_id,product_id:y.product_id,option_id:y.option_id,quantity:y.quantity,price:y.item_price,seller_id:y.seller_id,product_name:y.product_name,image_url:y.image_url,option_value:y.option_value})}const T=Array.from(g.values());return e.json({success:!0,data:T,pagination:{page:c,limit:l,total:w,totalPages:b},filters:{status:t||null,startDate:a||null,endDate:n||null,minAmount:o?parseInt(o):null,maxAmount:i?parseInt(i):null}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/seller/orders/export",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.query("format")||"csv",a=e.req.query("start_date"),n=e.req.query("end_date");let o=`
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
    `;const i=[r.sellerId];a&&(o+=" AND date(o.created_at) >= ?",i.push(a)),n&&(o+=" AND date(o.created_at) <= ?",i.push(n)),o+=" GROUP BY o.id ORDER BY o.created_at DESC";const c=await s.prepare(o).bind(...i).all();if(t==="csv"){const l=["주문번호","주문일시","주문상태","결제상태","주문금액","배송지","수령인","연락처","택배사","운송장번호","구매자명","구매자이메일","구매자연락처"],u=c.results.map(h=>[h.order_number||"",h.created_at?new Date(h.created_at).toLocaleString("ko-KR"):"",h.status||"",h.payment_status||"",h.total_amount||0,h.shipping_address||"",h.shipping_name||"",h.shipping_phone||"",h.carrier||"",h.tracking_number||"",h.buyer_name||"",h.buyer_email||"",h.buyer_phone||""]),m="\uFEFF"+[l.join(","),...u.map(h=>h.map(w=>{const b=String(w);return b.includes(",")||b.includes(`
`)||b.includes('"')?`"${b.replace(/"/g,'""')}"`:b}).join(","))].join(`
`),_=new Date,f=`orders_${_.toISOString().split("T")[0]}_${_.getTime()}.csv`;return new Response(m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${encodeURIComponent(f)}"`,"Cache-Control":"no-cache"}})}else return e.json({success:!1,error:"Unsupported format"},400)}catch(t){return console.error("Export error:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(t).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,r.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,t).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${t}, 자동 발행 시작...`);const c=await s.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(t).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const l=await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();if(!l)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${r.sellerId}`),await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(t,r.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${t}`);const u=await s.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),d=Number(c.total_amount),m=Math.floor(d/1.1),_=d-m,f=new Date().toISOString().split("T")[0].replace(/-/g,""),h=Math.random().toString(36).substring(2,8).toUpperCase(),w=`${f}-${h}`,g=(await s.prepare(`
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
            `).bind(r.sellerId,t,w,l.business_number,l.business_name,l.ceo_name,l.address||"",l.business_type||"",l.business_category||"",l.email||"",l.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",m,_,d,`AUTO-${Date.now()}-${h}`).run()).meta.last_row_id;if(u.results.length>0){const T=u.results.map(y=>{const R=Math.floor(Number(y.price)*Number(y.quantity)/1.1),L=Number(y.price)*Number(y.quantity)-R;return s.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(g,y.product_name||"상품명 없음",y.quantity,y.price,R,L,y.option_name||"")});await s.batch(T)}await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(t,r.sellerId,g).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${g}, invoice_number=${w}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${t}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await s.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(t,r.sellerId,c.message).run()}catch(l){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",l)}}try{const c=await s.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(t).first();if(c&&c.user_id){const u={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];u&&await Rt(s,c.user_id,t,u)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(t).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,r.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await s.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,t).run();try{const c=await s.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(t).first();c&&c.user_id&&await Rt(s,c.user_id,t,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/admin/orders",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/sellers",async e=>{const{DB:s}=e.env,{limit:r="20",offset:t="0"}=e.req.query();try{const a=`sellers:list:${r}:${t}`,n=be(a);if(n)return e.executionCtx.waitUntil((async()=>{try{const i=await Dr(s,parseInt(r),parseInt(t));Q(a,i,3600)}catch(i){console.error("[Cache Revalidate] Sellers error:",i)}})()),e.json({success:!0,data:n,cached:!0});const o=await Dr(s,parseInt(r),parseInt(t));return Q(a,o,3600),e.json({success:!0,data:o,cached:!1})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});async function Dr(e,s,r){const t=`
    SELECT id, business_name, name as display_name, 
           commission_rate, created_at
    FROM sellers 
    WHERE is_active = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `,{results:a}=await e.prepare(t).bind(s,r).all();return a}p.get("/api/admin/sellers",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/admin/sellers",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{username:t,password:a,name:n,email:o,phone:i,business_name:c,business_number:l}=await e.req.json();if(!t||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await s.prepare("SELECT id FROM sellers WHERE username = ?").bind(t).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await s.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const m=`$2a$10$placeholder_hash_for_${a}`,_=await s.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(t,m,n,o,i||null,c,l||null,r.adminId).run();return e.json({success:!0,data:{id:_.meta.last_row_id,username:t,name:n,email:o,business_name:c}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:l,status:u}=await e.req.json();return await s.prepare("SELECT id FROM sellers WHERE id = ?").bind(t).first()?(await s.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,l,u,t).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(t).first();return a?(await s.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(t).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(t).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await s.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,t).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(t).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(t){return e.json({success:!1,error:t.message},500)}});p.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await s.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(t).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await s.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,t).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${t}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:t,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(t){return console.error("수수료율 변경 실패:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/admin/sellers/:id/permissions",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{can_manipulate_stats:a}=await e.req.json();if(a!==0&&a!==1)return e.json({success:!1,error:"권한 값은 0 또는 1이어야 합니다"},400);const n=await s.prepare("SELECT id, username, name FROM sellers WHERE id = ?").bind(t).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);await s.prepare(`
      UPDATE sellers 
      SET can_manipulate_stats = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,t).run();const o=a?"승인":"해제";return console.log(`시청자 수 조작 권한 ${o}: 판매자 ${n.username} (ID: ${t})`),e.json({success:!0,message:`판매자 '${n.username||n.name}'의 특수 권한이 ${o}되었습니다`,data:{seller_id:t,seller_username:n.username,can_manipulate_stats:a}})}catch(t){return console.error("권한 변경 실패:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(t).first();if(!a)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(a.status==="approved")return e.json({success:!1,error:"이미 승인된 판매자입니다"},400);if(await s.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(r.adminId,t).run(),console.log(`셀러 승인: ${a.username} (ID: ${t}) by Admin ID: ${r.adminId}`),a.email)try{const{sendEmail:n,getSellerApprovalEmailHTML:o}=await Promise.resolve().then(()=>Ct),i=e.env.RESEND_API_KEY||"",c=o(a.name,a.username),l=await n({to:a.email,subject:"🎉 리스터코퍼레이션 판매자 승인 완료",html:c},i,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");l.success?console.log(`[셀러 승인] 이메일 발송 성공: ${a.email}`):console.warn(`[셀러 승인] 이메일 발송 실패: ${l.error}`)}catch(n){console.error("[셀러 승인] 이메일 발송 오류:",n)}try{const{createNotification:n,NotificationTemplates:o}=await Promise.resolve().then(()=>Nt),i=o.seller_approved(a.name);await n(s,{userId:parseInt(t),type:"seller_approved",title:i.title,message:i.message,linkUrl:i.linkUrl})}catch(n){console.error("[셀러 승인] 알림 생성 오류:",n)}return e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:t,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})}catch(t){return console.error("셀러 승인 실패:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(t).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(n.status==="rejected")return e.json({success:!1,error:"이미 거부된 판매자입니다"},400);if(await s.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,r.adminId,t).run(),console.log(`셀러 거부: ${n.username} (ID: ${t}), 사유: ${a}`),n.email)try{const{sendEmail:o,getSellerRejectionEmailHTML:i}=await Promise.resolve().then(()=>Ct),c=e.env.RESEND_API_KEY||"",l=i(n.name,a),u=await o({to:n.email,subject:"리스터코퍼레이션 판매자 승인 결과 안내",html:l},c,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");u.success?console.log(`[셀러 거부] 이메일 발송 성공: ${n.email}`):console.warn(`[셀러 거부] 이메일 발송 실패: ${u.error}`)}catch(o){console.error("[셀러 거부] 이메일 발송 오류:",o)}try{const{createNotification:o,NotificationTemplates:i}=await Promise.resolve().then(()=>Nt),c=i.seller_rejected(a);await o(s,{userId:parseInt(t),type:"seller_rejected",title:c.title,message:c.message,linkUrl:c.linkUrl})}catch(o){console.error("[셀러 거부] 알림 생성 오류:",o)}return e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:t,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})}catch(t){return console.error("셀러 거부 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/sellers/pending",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:t.results,count:t.results.length})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/admin/dashboard/stats",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=new Date;t.setHours(0,0,0,0);const a=t.toISOString(),n=await s.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM orders
      WHERE payment_status = 'approved'
      AND status = 'paid'
      AND created_at >= ?
    `).bind(a).first(),o=(n==null?void 0:n.sales)||0,i=await s.prepare(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(a).first(),c=(i==null?void 0:i.count)||0,l=new Date(Date.now()-300*1e3).toISOString(),u=await s.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(l).first(),d=(u==null?void 0:u.count)||0,m=await s.prepare(`
      SELECT COUNT(*) as count
      FROM live_streams
      WHERE status = 'live'
    `).first(),_=(m==null?void 0:m.count)||0;return e.json({success:!0,stats:{todaySales:o,todayOrders:c,currentVisitors:d,liveStreams:_},timestamp:new Date().toISOString()})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/public/seller/:sellerId",async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const t=e.req.param("sellerId"),a=`public:seller:${t}`,n=await Ao(r,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(t).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=await s.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(t).all(),c=await s.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(t).all(),l=await s.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(t).all(),u=await s.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(t).first(),d={profile:o,live_streams:i.results,scheduled_streams:c.results,products:l.results,stats:u};return await ps(r,a,d,60,!1),e.json({success:!0,data:d})}catch(t){return console.error("셀러 프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/public/seller/username/:username",async e=>{const{DB:s}=e.env;try{const r=e.req.param("username"),t=await s.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();return t?e.json({success:!0,data:{seller_id:t.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/stats",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{period:t}=e.req.query();let a="";const n=new Date;switch(t){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await s.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:t||"all"}})}catch(t){return console.error("정산 통계 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/settlement/records",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{seller_id:t,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];t&&(o.push("o.seller_id = ?"),i.push(t)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const d=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${d}'`);break;case"week":const m=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${m}'`);break;case"month":const _=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${_}'`);break}const l=o.length>0?`WHERE ${o.join(" AND ")}`:"",u=await s.prepare(`
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
      ${l}
      ORDER BY o.created_at DESC
      LIMIT 100
    `).bind(...i).all();return e.json({success:!0,data:u.results})}catch(t){return console.error("정산 내역 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await s.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(t).first();return n?(await s.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,t).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:t,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(t){return console.error("정산 상태 변경 실패:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/admin/settlement/batch-complete",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{order_ids:t}=await e.req.json();if(!Array.isArray(t)||t.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of t)try{await s.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:t.length,success:a,failed:n}})}catch(t){return console.error("일괄 정산 처리 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/settlement/export-csv",async e=>{const{DB:s}=e.env,r=await x(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{seller_id:t,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];t&&(n.push("o.seller_id = ?"),o.push(t));const i=new Date;switch(a){case"today":const f=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${f}'`);break;case"week":const h=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${h}'`);break;case"month":const w=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${w}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",u=(await s.prepare(`
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
    `).bind(...o).all()).results;if(u.length===0)return e.json({success:!1,error:"데이터가 없습니다"},404);const d=Object.keys(u[0]);let m=d.join(",")+`
`;u.forEach(f=>{const h=d.map(w=>{const b=f[w];if(b==null)return"";const g=String(b);return g.includes(",")||g.includes('"')||g.includes(`
`)?`"${g.replace(/"/g,'""')}"`:g});m+=h.join(",")+`
`});const _="\uFEFF";return new Response(_+m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(t){return console.error("CSV 내보내기 실패:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/orders/create",N,async e=>{const{DB:s}=e.env;try{const{userId:r,cartItems:t,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:l,buyerCeoName:u}=await e.req.json();console.log("[DEPRECATED /api/orders/create] 주문 생성 요청:",{userId:r,cartItems:t==null?void 0:t.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let d=10;if(o){const v=await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();v&&v.commission_rate!==null&&(d=v.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:d});const m=Math.floor(a*(d/100)),_=a-m;let f=null;if(n){const v=await s.prepare(`
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
      `).bind(n,r).first();if(!v)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);f=v}if(!r)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const h=r,w=new Date,b=w.getFullYear().toString().slice(-2),g=(w.getMonth()+1).toString().padStart(2,"0"),T=w.getDate().toString().padStart(2,"0"),y=`${b}${g}${T}`,R=Math.random().toString(36).substring(2,7).toUpperCase(),L=`ORD-${y}-${R}`,C=t.map(v=>v.product_id),D=C.map(()=>"?").join(","),W=await s.prepare(`
      SELECT id, stock FROM products WHERE id IN (${D})
    `).bind(...C).all(),U=new Map(W.results.map(v=>[v.id,v.stock]));for(const v of t){const re=U.get(v.product_id);if(re===void 0)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${v.product_id})`},400);if(re<v.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${v.product_id})`},400)}const $=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(L,h,a,"pending",o||null,d,m,_,n||null,(f==null?void 0:f.recipient_name)||null,(f==null?void 0:f.phone)||null,f!=null&&f.address?`${f.address} ${f.address_detail}`:null,(f==null?void 0:f.postal_code)||null,i?1:0,c||null,l||null,u||null).run()).meta.last_row_id,Z=t.map(v=>s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind($,v.product_id,v.option_id||null,v.quantity,v.price_snapshot||v.price)),z=t.map(v=>s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(v.quantity,v.product_id));await s.batch([...Z,...z]);try{const v=Ae(e.env),re=t.map(H=>H.product_id),q=re.map(()=>"?").join(","),P=await s.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${q})
      `).bind(...re).all();await Promise.all(P.results.map(H=>v.updateProductStock(H.id,H.stock,{name:H.name,price:H.price,original_price:H.original_price,discount_rate:H.discount_rate,image_url:H.image_url}))),console.log(`🔥 Firebase: Stock updated for ${P.results.length} products`)}catch(v){console.error("⚠️ Firebase stock sync failed (non-blocking):",v)}try{const v=t.map(P=>P.product_id),re=v.map(()=>"?").join(","),q=await s.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${re})
      `).bind(...v).all();for(const P of q.results){const H=P.stock_alert_threshold||5,te=P.stock;te<=H&&P.seller_id&&(await It(s,P.seller_id,P.name,te,H),console.log(`[Low Stock Alert] ${P.name}: ${te} <= ${H}`))}}catch(v){console.error("[Low Stock Alert] Error:",v)}return console.log("주문 생성 완료:",{orderId:$,orderNumber:L}),e.json({success:!0,orderId:$,orderNumber:L,totalAmount:a})}catch(r){return console.error("주문 생성 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/orders/:orderNumber/refund",S(),N,async e=>{const{DB:s}=e.env;try{const r=e.req.param("orderNumber"),{reason:t}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:r,reason:t});const a=await s.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(r).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다"},404);if(a.payment_status==="cancelled")return e.json({success:!1,error:"이미 취소된 주문입니다"},400);await s.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(t||"구매자 요청",r).run(),console.log("[Order Refund] 주문 상태 업데이트 완료:",r);const n=await s.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();if(n.results.length>0){const o=n.results.map(i=>s.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(i.quantity,i.product_id));await s.batch(o),console.log("[Order Refund] 재고 복구 완료:",{items:n.results.length})}return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:r,reason:t}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:r,cancelDate:new Date().toISOString()}})}catch(r){return console.error("[Order Refund] Error:",r),e.json({success:!1,error:r.message||"주문 취소 중 오류가 발생했습니다"},500)}});p.use("/api/seller/*",N);p.get("/api/seller/sales",S(),async e=>{try{const{DB:s}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const t=await ns(e.env.SESSION_KV,r);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(t.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=t.seller_id||t.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],l=await s.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();if(!l)return e.json({success:!1,error:"셀러를 찾을 수 없습니다."},404);const u=await s.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:l,stats:u,orders:(d==null?void 0:d.results)||[]}})}catch(s){return console.error("Seller sales query error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/settlement-csv",S(),async e=>{try{const{DB:s}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const t=await ns(e.env.SESSION_KV,r);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(t.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=t.seller_id||t.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],l=await s.prepare(`
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
    `).bind(a,i,c).all();let u=`주문번호,주문일시,주문자,총금액,수수료(10%),정산금액(90%),주문상태,사업자명,사업자번호,세금계산서번호,발행일자,계산서상태,국세청승인번호
`;for(const d of(l==null?void 0:l.results)||[]){const m=d.status==="delivered"?"배송완료":d.status==="shipped"?"배송중":d.status==="preparing"?"상품준비중":d.status==="paid"?"결제완료":"대기중",_=d.buyer_business_name||"-",f=d.buyer_business_number||"-",h=d.invoice_number||"-",w=d.issue_date||"-",b=d.tax_invoice_status==="issued"?"발행완료":d.tax_invoice_status==="cancelled"?"취소":"-",g=d.nts_confirm_number||"-";u+=`${d.order_number},${d.created_at},${d.user_name||"익명"},${d.total_amount},${d.commission_amount},${d.seller_amount},${m},${_},${f},${h},${w},${b},${g}
`}return new Response(u,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(s){return console.error("CSV download error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/issue",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{order_number:t}=await e.req.json();if(!t)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(t).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!a.issue_tax_invoice)return e.json({success:!1,error:"세금계산서 발행이 요청되지 않은 주문입니다."},400);const n=await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(r.sellerId).first();if(!n)return e.json({success:!1,error:"승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요."},400);const o=await s.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),l=i-c,u=new Date().toISOString().split("T")[0],d=`${u}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,m=Aa(n,a,o.results);let _,f,h;try{_=await va(m),f=_.ntsConfirmNumber,h=_.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:f,invoiceKey:h,mockMode:cs()})}catch(g){console.error("바로빌 API 호출 실패:",g),f="FAILED",h=null}const b=(await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r.sellerId,t,"tax",d,u,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,l,i,f==="FAILED"?"failed":"issued",cs()?"mock":"barobill",h,f).run()).meta.last_row_id;for(const g of o.results){const T=Math.floor(Number(g.price)*Number(g.quantity)/1.1),y=Number(g.price)*Number(g.quantity)-T;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(b,g.id,g.product_name,g.quantity,g.price,T,y).run()}return e.json({success:!0,data:{invoice_id:b,invoice_number:d,issue_date:u,total_amount:i,supply_price:c,tax_amount:l,status:f==="FAILED"?"failed":"issued",nts_confirm_number:f,api_invoice_key:h,mock_mode:cs(),message:f==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":cs()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(t){return console.error("세금계산서 발행 오류:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/tax-invoices",async e=>{var t;const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[r.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const l=await s.prepare(i).bind(...c).all();return e.json({success:!0,data:l.results||[],total:((t=l.results)==null?void 0:t.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/tax-invoices/:id",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(t,r.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await s.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(t).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{reason:a}=await e.req.json(),n=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(t,r.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!cs()){const l=await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(r.sellerId).first();l&&l.business_number&&await Ia(l.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(l){console.error("바로빌 취소 API 호출 실패:",l)}return await s.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{status:t,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[r.sellerId];t&&(n+=" AND log.status = ?",o.push(t)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await s.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${t}`);const a=await s.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(t,r.sellerId).first();if(!a)return e.json({success:!1,error:"재시도할 실패 로그를 찾을 수 없습니다."},404);const n=Number(a.retry_count||0);if(n>=3)return e.json({success:!1,error:"최대 재시도 횟수(3회)를 초과했습니다."},400);const o=await s.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(t).first();if(!o)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!o.buyer_business_number||!o.buyer_business_name)return e.json({success:!1,error:"주문에 사업자 정보가 없습니다."},400);const i=await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();if(!i)return e.json({success:!1,error:"판매자 사업자 정보가 승인되지 않았습니다."},400);const c=await s.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(),l=Number(o.total_amount),u=Math.floor(l/1.1),d=l-u,m=new Date().toISOString().split("T")[0].replace(/-/g,""),_=Math.random().toString(36).substring(2,8).toUpperCase(),f=`${m}-${_}`,w=(await s.prepare(`
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
    `).bind(r.sellerId,t,f,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",u,d,l,`RETRY-${Date.now()}-${_}`).run()).meta.last_row_id;for(const b of c.results){const g=Math.floor(Number(b.price)*Number(b.quantity)/1.1),T=Number(b.price)*Number(b.quantity)-g;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(w,b.product_name||"상품명 없음",b.quantity,b.price,g,T,b.option_name||"").run()}return await s.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(t,r.sellerId,w,n+1).run(),await s.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${w}, retry_count=${n+1}`),e.json({success:!0,data:{invoice_id:w,invoice_number:f,retry_count:n+1}})}catch(t){console.error("[TAX INVOICE RETRY] 재시도 실패:",t);try{const a=e.req.param("orderNumber"),n=await s.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,r.sellerId).first(),o=Number((n==null?void 0:n.retry_count)||0);await s.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,r.sellerId,t.message,o+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:t.message},500)}});p.get("/live/:id",async e=>{try{const s=new URL("/static/live.html",e.req.url);let t=await(await fetch(s.toString())).text();const n=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return t=t.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${n}`),console.log("[Live Page] Environment variables injected"),new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving live page:",s),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/cart",async e=>{try{const s=new URL("/static/cart.html",e.req.url);let t=await(await fetch(s.toString())).text();return t=t.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),t=t.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving cart page:",s),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/my-orders",async e=>{try{const s=new URL("/static/my-orders.html",e.req.url),t=await(await fetch(s.toString())).text();return new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving my orders page:",s),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/payment-result",async e=>{try{const s=new URL("/payment-result.html",e.req.url),t=await(await fetch(s.toString())).text();return new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving payment result page:",s),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/api/seller/profile",async e=>{const{DB:s}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const t=await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();if(!t||!t.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
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
    `).bind(t.seller_id).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404)}catch(t){return console.error("프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/seller/profile",async e=>{const{DB:s}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const t=await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();if(!t||!t.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:l,website_url:u,kakao_chat_link:d}=await e.req.json(),m=[],_=[];if(a!==void 0&&(m.push("profile_image = ?"),_.push(a)),n!==void 0&&(m.push("bio = ?"),_.push(n)),o!==void 0&&(m.push("sns_instagram = ?"),_.push(o)),i!==void 0&&(m.push("sns_youtube = ?"),_.push(i)),c!==void 0&&(m.push("sns_facebook = ?"),_.push(c)),l!==void 0&&(m.push("sns_twitter = ?"),_.push(l)),u!==void 0&&(m.push("website_url = ?"),_.push(u)),d!==void 0&&(m.push("kakao_chat_link = ?"),_.push(d)),m.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);m.push("updated_at = datetime('now')"),_.push(t.seller_id),await s.prepare(`
      UPDATE sellers 
      SET ${m.join(", ")}
      WHERE id = ?
    `).bind(..._).run();const f=await s.prepare(`
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
    `).bind(t.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:f})}catch(t){return console.error("프로필 업데이트 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/public/:sellerId",async e=>{const{DB:s}=e.env,r=e.req.param("sellerId");try{const t=await s.prepare(`
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
    `).bind(r).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/:sellerId/streams",async e=>{const{DB:s}=e.env,r=e.req.param("sellerId");try{const t=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:t.results})}catch(t){return console.error("라이브 목록 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/:sellerId/products-public",async e=>{const{DB:s}=e.env,r=e.req.param("sellerId");try{const t=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:t.results})}catch(t){return console.error("상품 목록 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/notifications",N,async e=>{const{DB:s}=e.env;try{const r=e.get("userId"),t=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),n=e.req.query("unread_only")==="true";let o=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;n&&(o+=" AND is_read = 0"),o+=" ORDER BY created_at DESC LIMIT ?";const i=await s.prepare(o).bind(r,t,a).all();return e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/notifications/unread-count",N,async e=>{const{DB:s}=e.env;try{const r=e.get("userId"),t=e.get("userType"),a=await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r,t).first();return e.json({success:!0,count:(a==null?void 0:a.count)||0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/notifications/:id/read",N,async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=e.get("userId"),a=e.get("userType");return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r,t,a).first()?(await s.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/notifications/read-all",N,async e=>{const{DB:s}=e.env;try{const r=e.get("userId"),t=e.get("userType");return await s.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r,t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/notifications/:id",N,async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=e.get("userId"),a=e.get("userType");return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r,t,a).first()?(await s.prepare("DELETE FROM notifications WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/banners",async e=>{const{DB:s}=e.env;try{const r=new Date().toISOString(),t=await s.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(r,r).all();return e.json({success:!0,data:t.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/admin/banners",N,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=await s.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/banners",N,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:t,image_url:a,link_url:n,description:o,is_active:i,display_order:c,start_date:l,end_date:u}=await e.req.json();if(!t||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const d=await s.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a,n||null,o||null,i!==!1?1:0,c||0,l||null,u||null).run();return e.json({success:!0,id:d.meta.last_row_id})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/banners/:id",N,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=e.req.param("id"),{title:a,image_url:n,link_url:o,description:i,is_active:c,display_order:l,start_date:u,end_date:d}=await e.req.json();return await s.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,n,o||null,i||null,c?1:0,l||0,u||null,d||null,t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/banners/:id",N,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=e.req.param("id");return await s.prepare("DELETE FROM banners WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/order-complete",e=>e.redirect("/order-complete.html",302));p.notFound(e=>{const s=e.req.path;return s.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${s} was not found.`},404):new Response(null,{status:404})});p.onError((e,s)=>{const r=s.req.path;if(e instanceof wn)return console.error("[AppError]",{path:r,method:s.req.method,code:e.code,message:e.message,statusCode:e.statusCode}),s.json({success:!1,error:{code:e.code,message:e.message,...e.details&&{details:e.details}}},e.statusCode);if(console.error("[Global Error Handler]",{path:r,method:s.req.method,error:e.message,stack:e.stack}),r.startsWith("/api/")){let t=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(t=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(t=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(t=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(t=400,a="잘못된 요청입니다."),s.json({success:!1,error:e.message||a},t)}return s.html(`
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
  `,500)});p.get("/api/admin/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const r=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:r.results})}catch(r){return console.error("[Admin Alimtalk Pricing] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const{plan_name:r,min_quantity:t,max_quantity:a,unit_price:n}=await e.req.json();if(!r||!t||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await s.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(r,t,a||null,n).run();return e.json({success:!0,pricing_id:o.meta.last_row_id})}catch(r){return console.error("[Admin Alimtalk Pricing Create] Error:",r),e.json({success:!1,error:r.message},500)}});p.put("/api/admin/alimtalk/pricing/:id",S(),async e=>{const{env:s}=e,r=e.req.param("id");try{const{plan_name:t,min_quantity:a,max_quantity:n,unit_price:o,is_active:i}=await e.req.json();return(await s.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t,a,n||null,o,i?1:0,r).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing updated successfully"})}catch(t){return console.error("[Admin Alimtalk Pricing Update] Error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/admin/alimtalk/pricing/:id",S(),async e=>{const{env:s}=e,r=e.req.param("id");try{return(await s.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(r).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing deleted successfully"})}catch(t){return console.error("[Admin Alimtalk Pricing Delete] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/alimtalk/accounts",S(),async e=>{const{env:s}=e;try{const r=await s.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();return e.json({success:!0,accounts:r.results})}catch(r){return console.error("[Admin Alimtalk Accounts] Error:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/alimtalk/accounts/:id/status",S(),async e=>{const{env:s}=e,r=e.req.param("id");try{const{status:t}=await e.req.json();return["active","suspended","rejected"].includes(t)?(await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t,r).run()).meta.changes===0?e.json({success:!1,error:"Account not found"},404):e.json({success:!0,message:`Account ${t} successfully`}):e.json({success:!1,error:"Invalid status"},400)}catch(t){return console.error("[Admin Alimtalk Account Status] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/alimtalk/statistics",S(),async e=>{const{env:s}=e;try{const{start_date:r,end_date:t}=e.req.query(),a=await s.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_revenue
      FROM alimtalk_messages
      WHERE created_at >= ? AND created_at <= ?
    `).bind(r||"2000-01-01",t||"2100-01-01").first(),n=await s.DB.prepare(`
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
    `).bind(r||"2000-01-01",t||"2100-01-01").all();return e.json({success:!0,statistics:{total:a,by_seller:n.results}})}catch(r){return console.error("[Admin Alimtalk Statistics] Error:",r),e.json({success:!1,error:r.message},500)}});p.use("/api/seller/alimtalk/*",N);p.get("/api/seller/alimtalk/account",S(),async e=>{const{env:s}=e;try{const r=e.get("user");if(!r||r.userType!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const t=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(r.userId).first();return e.json({success:!0,account:t})}catch(r){return console.error("[Seller Alimtalk Account] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/alimtalk/register",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await xe(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{channel_id:a,phone_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=at(n),i=await Ka(s,{channelId:a,phoneNumber:o});if(!i.success)return e.json({success:!1,error:"Failed to register Kakao channel"},500);const c=await s.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(t.user_id,a,a,i.senderKey,o).run();return e.json({success:!0,account_id:c.meta.last_row_id,sender_key:i.senderKey,message:"Kakao channel registered successfully"})}catch(r){return console.error("[Seller Alimtalk Register] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await xe(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!a)return e.json({success:!1,error:"Alimtalk account not found"},404);const n=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();return e.json({success:!0,templates:n.results})}catch(r){return console.error("[Seller Alimtalk Templates] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await xe(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_code:a,template_name:n,template_content:o,template_type:i}=await e.req.json();if(!a||!n||!o)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(t.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(!(await Ba(s,c.sender_key,{name:n,content:o,templateCode:a})).success)return e.json({success:!1,error:"Failed to register template"},500);const u=await s.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id,a,n,o,i||"basic").run();return e.json({success:!0,template_id:u.meta.last_row_id,message:"Template registered successfully. Approval pending (1-2 days)"})}catch(r){return console.error("[Seller Alimtalk Template Register] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const r=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:r.results})}catch(r){return console.error("[Seller Alimtalk Pricing] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/alimtalk/charge",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await xe(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{amount:a,pricing_id:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();if(!i)return e.json({success:!1,error:"Pricing not found"},404);const c=a*i.unit_price,l=`alimtalk_${o.id}_${Date.now()}`,u=await s.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id,a,c,i.unit_price,l).run(),d=`https://api.tosspayments.com/v1/payment/${l}`;return e.json({success:!0,charge_id:u.meta.last_row_id,order_id:l,amount:a,price:c,unit_price:i.unit_price,payment_url:d})}catch(r){return console.error("[Seller Alimtalk Charge] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/alimtalk/charge/complete",S(),async e=>{const{env:s}=e;try{const{order_id:r,payment_id:t}=await e.req.json();if(!r)return e.json({success:!1,error:"Missing order_id"},400);const a=await s.DB.prepare(`
      SELECT * FROM alimtalk_charges WHERE order_id = ? AND payment_status = 'pending'
    `).bind(r).first();return a?(await s.DB.prepare(`
      UPDATE alimtalk_charges 
      SET payment_status = 'completed', 
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t||null,a.id).run(),await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a.amount,a.account_id).run(),e.json({success:!0,message:"Charge completed successfully",charged_amount:a.amount})):e.json({success:!1,error:"Charge not found or already completed"},404)}catch(r){return console.error("[Seller Alimtalk Charge Complete] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/alimtalk/send",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await xe(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_id:a,recipient_phone:n,variables:o,order_id:i}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(t.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(c.balance<1)return e.json({success:!1,error:"Insufficient balance. Please charge first."},400);const l=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a,c.id).first();if(!l)return e.json({success:!1,error:"Template not found or not approved"},404);const u=Ja(l.template_content,o||{}),d=at(n),m=await tr(s,{senderKey:c.sender_key,templateCode:l.template_code,to:d,message:u});if(!m.success)return await s.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id,a,i||null,d,u,m.error).run(),e.json({success:!1,error:m.error},500);const _=await s.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id,a,i||null,d,u,15,m.messageId).run();return await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(),e.json({success:!0,message_id:_.meta.last_row_id,aligo_message_id:m.messageId,status:"sent",remaining_balance:c.balance-1})}catch(r){return console.error("[Seller Alimtalk Send] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/alimtalk/messages",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await xe(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{page:a="1",limit:n="20",status:o}=e.req.query(),i=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!i)return e.json({success:!1,error:"Alimtalk account not found"},404);const c=(parseInt(a)-1)*parseInt(n);let l=`
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;const u=[i.id];o&&(l+=" AND m.status = ?",u.push(o)),l+=" ORDER BY m.created_at DESC LIMIT ? OFFSET ?",u.push(parseInt(n),c);const d=await s.DB.prepare(l).bind(...u).all(),m=await s.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();return e.json({success:!0,messages:d.results,pagination:{total:m.total,page:parseInt(a),limit:parseInt(n)}})}catch(r){return console.error("[Seller Alimtalk Messages] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/alimtalk/statistics",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await xe(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{start_date:a,end_date:n}=e.req.query(),o=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await s.DB.prepare(`
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
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").all(),l=i.total_sent>0?(i.total_success/i.total_sent*100).toFixed(2):0;return e.json({success:!0,statistics:{total_sent:i.total_sent,total_success:i.total_success,total_failed:i.total_failed,success_rate:l,total_cost:i.total_cost,by_template:c.results}})}catch(r){return console.error("[Seller Alimtalk Statistics] Error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/alimtalk/send",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json(),{templateId:t,recipients:a,variables:n}=r;if(!t||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and recipients are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await ar(e.env,{accountId:o.id,templateId:parseInt(t),recipients:a.map(c=>({phone:c.phone,name:c.name,variables:c.variables||{}})),variables:n||{}});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/send/order",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json(),{templateId:t,orderId:a,customMessage:n}=r;if(!t||!a)return e.json({success:!1,error:"templateId and orderId are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);if(!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a),parseInt(s)).first())return e.json({success:!1,error:"Order not found or unauthorized"},404);const c=await tn(e.env,o.id,parseInt(t),parseInt(a),n);return e.json({success:c.success,data:{total:c.totalRecipients,sent:c.successCount,failed:c.failedCount,refunded:c.refundedAmount},messages:c.messages})}catch(s){return console.error("[Alimtalk Send Order] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/send/bulk",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json(),{templateId:t,rows:a,variables:n}=r;if(!t||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and rows are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await an(e.env,o.id,parseInt(t),a,n||{});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send Bulk] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/templates/:id/preview",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=e.req.param("id"),t=await e.req.json(),{variables:a}=t,n=await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(r),parseInt(s)).first();if(!n)return e.json({success:!1,error:"Template not found"},404);let o=n.template_content;return a&&Object.entries(a).forEach(([i,c])=>{const l=new RegExp(`#{${i}}`,"g");o=o.replace(l,c)}),e.json({success:!0,data:{template_name:n.template_name,original:n.template_content,preview:o,required_variables:Array.from(n.template_content.matchAll(/#{(\w+)}/g),i=>i[1])}})}catch(s){return console.error("[Alimtalk Preview] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements",S(),async e=>{try{const s=await e.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("[Admin Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements/:id",S(),async e=>{try{const s=parseInt(e.req.param("id")),r=await dn(e.env.DB,s);return r?e.json({success:!0,data:r}):e.json({success:!1,error:"Settlement not found"},404)}catch(s){return console.error("[Admin Settlement Detail] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/settlements/generate",S(),async e=>{try{const s=await e.req.json(),{startDate:r,endDate:t}=s,a=r&&t?{startDate:r,endDate:t}:on(),n=await ln(e.env.DB,a);return await un(e.env.DB,n),e.json({success:!0,data:n})}catch(s){return console.error("[Admin Generate Settlement] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.env.DB.prepare(`
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
    `).bind(parseInt(s)).all();return e.json({success:!0,data:r.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements/calculate",S(),async e=>{const{DB:s}=e.env;if(!(await x(e)).success)return e.json({success:!1,error:"관리자 권한이 필요합니다"},401);try{const t=e.req.query("seller_id"),a=e.req.query("period")||"monthly",n=e.req.query("format")||"json";let o=e.req.query("start_date"),i=e.req.query("end_date");if(!t)return e.json({success:!1,error:"seller_id가 필요합니다"},400);const c=new Date;if(a==="weekly"){const g=new Date(c);g.setDate(c.getDate()-c.getDay()-6),g.setHours(0,0,0,0);const T=new Date(g);T.setDate(g.getDate()+6),T.setHours(23,59,59,999),o=g.toISOString().split("T")[0],i=T.toISOString().split("T")[0]}else if(a==="monthly"){const g=new Date(c.getFullYear(),c.getMonth()-1,1),T=new Date(c.getFullYear(),c.getMonth(),0);o=g.toISOString().split("T")[0],i=T.toISOString().split("T")[0]}else if(a==="custom"&&(!o||!i))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const l=await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(t).first();if(!l)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const d=(await s.prepare(`
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
    `).bind(t,o,i).all()).results,m=d.length,_=d.reduce((g,T)=>g+(T.total_amount||0),0),f=d.reduce((g,T)=>g+(T.commission_amount||0),0),h=_-f,w=m>0?d.reduce((g,T)=>g+(T.commission_rate||0),0)/m:0,b={sellerId:parseInt(t),sellerName:l.seller_name||"Unknown",businessName:l.business_name||null,period:{type:a,startDate:o,endDate:i},summary:{totalOrders:m,totalSales:_,totalCommission:f,netAmount:h,commissionRate:Math.round(w*100)/100},orders:d.map(g=>({orderNumber:g.order_number,createdAt:g.created_at,status:g.status,totalAmount:g.total_amount||0,commissionAmount:g.commission_amount||0,sellerAmount:g.seller_amount||0}))};if(n==="csv"){const g=[];g.push("셀러 정산서"),g.push(`셀러명,${b.sellerName}`),g.push(`사업자명,${b.businessName||"N/A"}`),g.push(`정산 기간,${b.period.startDate} ~ ${b.period.endDate}`),g.push(""),g.push("구분,금액"),g.push(`총 주문 건수,${b.summary.totalOrders}건`),g.push(`총 매출,${b.summary.totalSales.toLocaleString()}원`),g.push(`플랫폼 수수료 (${b.summary.commissionRate}%),${b.summary.totalCommission.toLocaleString()}원`),g.push(`정산 금액,${b.summary.netAmount.toLocaleString()}원`),g.push(""),g.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const R of b.orders)g.push(`${R.orderNumber},${R.createdAt},${R.status},${R.totalAmount},${R.commissionAmount},${R.sellerAmount}`);const T=g.join(`
`),y=`settlement_${t}_${o}_${i}.csv`;return e.text(T,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${y}"`})}return e.json({success:!0,data:b})}catch(t){return console.error("[Settlement] Calculation error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/settlements/my",S(),async e=>{const{DB:s}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:"셀러 권한이 필요합니다"},401);const t=new URL(e.req.url);t.searchParams.set("seller_id",String(r.sellerId));const a=new Request(t.toString(),e.req.raw);({...e,req:new Proxy(a,{get(n,o){return o==="query"?i=>i==="seller_id"?String(r.sellerId):t.searchParams.get(i):n[o]}})});try{const n=r.sellerId,o=e.req.query("period")||"monthly",i=e.req.query("format")||"json";let c=e.req.query("start_date"),l=e.req.query("end_date");const u=new Date;if(o==="weekly"){const y=new Date(u);y.setDate(u.getDate()-u.getDay()-6),y.setHours(0,0,0,0);const R=new Date(y);R.setDate(y.getDate()+6),R.setHours(23,59,59,999),c=y.toISOString().split("T")[0],l=R.toISOString().split("T")[0]}else if(o==="monthly"){const y=new Date(u.getFullYear(),u.getMonth()-1,1),R=new Date(u.getFullYear(),u.getMonth(),0);c=y.toISOString().split("T")[0],l=R.toISOString().split("T")[0]}else if(o==="custom"&&(!c||!l))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const d=await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(n).first();if(!d)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const _=(await s.prepare(`
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
    `).bind(n,c,l).all()).results,f=_.length,h=_.reduce((y,R)=>y+(R.total_amount||0),0),w=_.reduce((y,R)=>y+(R.commission_amount||0),0),b=h-w,g=f>0?_.reduce((y,R)=>y+(R.commission_rate||0),0)/f:0,T={sellerId:n,sellerName:d.seller_name||"Unknown",businessName:d.business_name||null,period:{type:o,startDate:c,endDate:l},summary:{totalOrders:f,totalSales:h,totalCommission:w,netAmount:b,commissionRate:Math.round(g*100)/100},orders:_.map(y=>({orderNumber:y.order_number,createdAt:y.created_at,status:y.status,totalAmount:y.total_amount||0,commissionAmount:y.commission_amount||0,sellerAmount:y.seller_amount||0}))};if(i==="csv"){const y=[];y.push("셀러 정산서"),y.push(`셀러명,${T.sellerName}`),y.push(`사업자명,${T.businessName||"N/A"}`),y.push(`정산 기간,${T.period.startDate} ~ ${T.period.endDate}`),y.push(""),y.push("구분,금액"),y.push(`총 주문 건수,${T.summary.totalOrders}건`),y.push(`총 매출,${T.summary.totalSales.toLocaleString()}원`),y.push(`플랫폼 수수료 (${T.summary.commissionRate}%),${T.summary.totalCommission.toLocaleString()}원`),y.push(`정산 금액,${T.summary.netAmount.toLocaleString()}원`),y.push(""),y.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const C of T.orders)y.push(`${C.orderNumber},${C.createdAt},${C.status},${C.totalAmount},${C.commissionAmount},${C.sellerAmount}`);const R=y.join(`
`),L=`my_settlement_${c}_${l}.csv`;return e.text(R,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${L}"`})}return e.json({success:!0,data:T})}catch(n){return console.error("[My Settlement] Error:",n),e.json({success:!1,error:n.message},500)}});p.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.env.DB.prepare(`
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
    `).bind(parseInt(s)).all();return e.json({success:!0,data:r.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/live/:streamId/sse",async e=>{const s=e.req.param("streamId");return pn(s,e.env)});p.get("/api/live/:streamId/chat/sse",async e=>{const s=e.req.param("streamId");return mn(s,e.env)});p.get("/api/seller/orders/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?_n(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});p.get("/api/seller/stock/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?fn(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});p.post("/api/push/subscribe",S(),async e=>{try{const s=e.req.header("X-User-ID"),r=e.req.header("X-User-Type");if(!s||!r)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json();return await En(e.env.DB,parseInt(s),r,t),e.json({success:!0})}catch(s){return console.error("[Push Subscribe] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/push/unsubscribe",S(),async e=>{try{const{endpoint:s}=await e.req.json();return s?(await hn(e.env.DB,s),e.json({success:!0})):e.json({success:!1,error:"Endpoint required"},400)}catch(s){return console.error("[Push Unsubscribe] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/push/vapid-public-key",S(),async e=>{try{const s=e.env.VAPID_PUBLIC_KEY||"";return e.json({success:!0,publicKey:s})}catch(s){return console.error("[Push VAPID Key] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/cache/stats",async e=>{const s=e.req.query("token"),r=e.env.STATS_SECRET_TOKEN||"your-secret-token-here";if(s!==r)return e.json({success:!1,error:"접근 권한이 없습니다. 올바른 token을 제공해주세요."},403);const t=Y.hits+Y.misses>0?(Y.hits/(Y.hits+Y.misses)*100).toFixed(2):"0.00";return e.json({success:!0,data:{cache:{...Y,hitRate:`${t}%`,cacheSize:_e.size,maxSize:1e3,memoryUsage:`${(_e.size/1e3*100).toFixed(1)}%`},description:{hits:"Memory cache로 처리된 요청 (KV 읽기 0회)",misses:"Memory cache 미스로 KV 조회한 요청",writes:"Memory cache에 저장된 항목 수",evictions:"Memory cache에서 삭제된 항목 수 (만료 또는 크기 제한)",hitRate:"Cache hit 비율 (높을수록 KV 사용량 감소)",cacheSize:"현재 Memory cache에 저장된 항목 수",maxSize:"Memory cache 최대 크기",memoryUsage:"Memory cache 사용률 (cacheSize / maxSize)"},kvUsageGuide:{currentHitRate:`${t}%`,recommendation:parseFloat(t)>=90?"✅ 캐시가 매우 효과적으로 작동하고 있습니다.":parseFloat(t)>=70?"⚠️ 캐시 히트율이 낮습니다. TTL 조정을 고려하세요.":"❌ 캐시 히트율이 매우 낮습니다. 캐시 설정을 확인하세요.",kvDailyReadsLimit:"100,000 reads/day (free tier)",kvDailyWritesLimit:"1,000 writes/day (free tier)",estimatedDailyReads:Math.round(Y.misses/(Y.hits+Y.misses||1)*1e4),estimatedDailyWrites:Math.round(Y.writes/(Y.hits+Y.misses||1)*1e3)}}})});let Or={},kr={};p.get("/api/debug/kv-usage",S(),async e=>{try{const s=Object.entries(Or).sort((i,c)=>c[1]-i[1]).slice(0,20),r=Object.entries(kr).sort((i,c)=>c[1]-i[1]).slice(0,20),t=Object.values(Or).reduce((i,c)=>i+c,0),a=Object.values(kr).reduce((i,c)=>i+c,0),n=t/1e3*100,o=a/1e5*100;if((n>=50||o>=50)&&e.env.DISCORD_WEBHOOK_URL)try{await Tn(e.env.DISCORD_WEBHOOK_URL,o,n)}catch(i){console.error("[Discord] KV 경고 전송 실패:",i)}return e.json({success:!0,stats:{total_writes:t,total_reads:a,daily_write_limit:1e3,daily_read_limit:1e5,write_usage_percent:n.toFixed(2)+"%",read_usage_percent:o.toFixed(2)+"%",top_writes:s,top_reads:r},recommendations:t>500?["⚠️ KV Write 사용량이 높습니다!","1. 세션 갱신 주기를 늘리세요 (현재 29일)","2. 캐시를 메모리에만 저장하세요 (forceKvWrite: false)","3. JWT 인증으로 전환하세요 (KV 사용량 90% 감소)"]:["✅ KV 사용량이 정상 범위입니다."]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/debug/user/:email",S(),async e=>{const{DB:s}=e.env,r=e.req.param("email");try{const t=await s.prepare(`
      SELECT id, firebase_uid, email, name, created_at 
      FROM users 
      WHERE email = ?
    `).bind(r).first();return t?e.json({success:!0,user:{id:t.id,firebase_uid:t.firebase_uid,email:t.email,name:t.name,created_at:t.created_at}}):e.json({success:!1,error:"User not found"},404)}catch(t){return console.error("[Debug] Error fetching user:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/debug/user/:email/firebase-uid",S(),async e=>{const{DB:s}=e.env,r=e.req.param("email");try{const{firebase_uid:t}=await e.req.json();if(!t)return e.json({success:!1,error:"firebase_uid is required"},400);const a=await s.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(r).first();return a?(await s.prepare(`
      UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?
    `).bind(t,r).run(),console.log(`[Debug] Updated Firebase UID for ${r}: ${t}`),e.json({success:!0,message:"Firebase UID updated successfully",user:{id:a.id,email:r,firebase_uid:t}})):e.json({success:!1,error:"User not found"},404)}catch(t){return console.error("[Debug] Error updating Firebase UID:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/notifications",S(),async e=>{var r;const{DB:s}=e.env;try{const t=e.req.query("userId"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0");if(!t)return e.json({success:!1,error:"userId is required"},400);const o=await s.prepare(`
      SELECT id, type, title, message, link_url, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(t,a,n).all(),i=await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).bind(t).first();return e.json({success:!0,data:{notifications:o.results||[],unread_count:(i==null?void 0:i.count)||0,total:((r=o.results)==null?void 0:r.length)||0}})}catch(t){return console.error("[Notifications] Get error:",t),e.json({success:!1,error:t.message},500)}});p.patch("/api/notifications/:id/read",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),{userId:t}=await e.req.json();return t?(await s.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).bind(r,t).run()).meta.changes===0?e.json({success:!1,error:"Notification not found"},404):e.json({success:!0,message:"Notification marked as read"}):e.json({success:!1,error:"userId is required"},400)}catch(r){return console.error("[Notifications] Mark read error:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/notifications/read-all",S(),async e=>{const{DB:s}=e.env;try{const{userId:r}=await e.req.json();return r?(await s.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `).bind(r).run(),e.json({success:!0,message:"All notifications marked as read"})):e.json({success:!1,error:"userId is required"},400)}catch(r){return console.error("[Notifications] Mark all read error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/notifications/:id",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=e.req.query("userId");return t?(await s.prepare(`
      DELETE FROM notifications
      WHERE id = ? AND user_id = ?
    `).bind(r,t).run()).meta.changes===0?e.json({success:!1,error:"Notification not found"},404):e.json({success:!0,message:"Notification deleted"}):e.json({success:!1,error:"userId is required"},400)}catch(r){return console.error("[Notifications] Delete error:",r),e.json({success:!1,error:r.message},500)}});async function Uo(e,s,r){var a,n;const t={embeds:[{title:"🚨 서버 에러 발생",color:16711680,fields:[{name:"에러 메시지",value:s.message||"Unknown error",inline:!1},{name:"발생 시각",value:new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}),inline:!0},{name:"HTTP 메소드",value:r.method||"N/A",inline:!0},{name:"API 경로",value:r.path||"N/A",inline:!1},{name:"사용자 ID",value:((a=r.userId)==null?void 0:a.toString())||"비로그인",inline:!0},{name:"사용자 타입",value:r.userType||"N/A",inline:!0},{name:"에러 스택",value:"```\n"+(((n=s.stack)==null?void 0:n.substring(0,800))||"N/A")+"\n```",inline:!1}],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Error Monitoring"}}]};try{await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}),console.log("[Discord] Error alert sent successfully")}catch(o){console.error("[Discord Webhook] Failed to send alert:",o)}}p.onError(async(e,s)=>{if(console.error("[Error]",e),s.env.DISCORD_WEBHOOK_URL)try{await Uo(s.env.DISCORD_WEBHOOK_URL,e,{method:s.req.method,path:s.req.path,userId:s.get("userId"),userType:s.get("userType")})}catch(r){console.error("[Discord] Webhook failed, but continuing:",r)}return s.json({success:!1,error:{code:e.code||"INTERNAL_ERROR",message:e.message||"서버 오류가 발생했습니다."}},e.status||500)});const Cr=new et,Po=Object.assign({"/src/index.tsx":p});let Ot=!1;for(const[,e]of Object.entries(Po))e&&(Cr.route("/",e),Cr.notFound(e.notFoundHandler),Ot=!0);if(!Ot)throw new Error("Can't import modules from ['/src/index.tsx']");async function kt(e){try{const{to:s,subject:r,htmlContent:t,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:s}]}],from:{email:"noreply@live.ur-team.com",name:"리스터코퍼레이션"},subject:r,content:[{type:"text/html",value:t},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",s),{success:!0}}catch(s){return console.error("[Email] Exception:",s),{success:!1,error:s.message}}}async function xo(e){const{streamId:s,title:r,sellerName:t,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${s}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",l=`
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
  `,u=`
🎉 새 라이브 스트림 생성!

상태: ${c}
제목: ${r}
판매자: ${t}
플랫폼: ${a==="youtube"?"YouTube":"TikTok"}
${n?`예약 시간: ${new Date(n).toLocaleString("ko-KR")}`:""}
라이브 ID: #${s}

🔗 라이브 페이지: ${i}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `;return kt({to:"jiwon@ur-team.com",subject:`[리스터코퍼레이션] 🎉 새 라이브 스트림 생성: ${r}`,htmlContent:l,textContent:u})}const Wo=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:kt,sendLiveStreamCreatedEmail:xo},Symbol.toStringTag,{value:"Module"}));async function qo(e,s,r){const t=e.from||r||"리스터코퍼레이션 <onboarding@resend.dev>",{to:a,subject:n,html:o}=e;if(!s)return console.warn("[Email] RESEND_API_KEY not configured, skipping email"),{success:!1,error:"API key not configured"};try{console.log("[Email] Sending email:",{to:a,subject:n,from:t});const i=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${s}`,"Content-Type":"application/json"},body:JSON.stringify({from:t,to:a,subject:n,html:o})}),c=await i.json();return i.ok?(console.log("[Email] Sent successfully:",{to:a,subject:n,id:c.id}),{success:!0}):(console.error("[Email] Failed to send:",c),{success:!1,error:c.message||"Failed to send email"})}catch(i){return console.error("[Email] Error:",i),{success:!1,error:i.message}}}function Ho(e,s){return`
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
  `}function Ko(e,s){return`
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
  `}const Ct=Object.freeze(Object.defineProperty({__proto__:null,getSellerApprovalEmailHTML:Ho,getSellerRejectionEmailHTML:Ko,sendEmail:qo},Symbol.toStringTag,{value:"Module"}));async function Bo(e,s){const{userId:r,type:t,title:a,message:n,linkUrl:o}=s;try{const i=await e.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(r,t,a,n,o||null).run();return console.log(`[Notification] Created for user ${r}: ${t} - ${a}`),{success:!0,id:i.meta.last_row_id}}catch(i){return console.error("[Notification] Failed to create:",i),{success:!1,error:i.message}}}const Jo={seller_approved:e=>({title:"🎉 판매자 승인 완료",message:`${e}님, 축하합니다! 리스터코퍼레이션 판매자로 승인되었습니다.`,linkUrl:"/seller"}),seller_rejected:e=>({title:"판매자 승인 거부",message:`죄송합니다. 판매자 승인이 거부되었습니다. 사유: ${e}`,linkUrl:"/seller/register"}),order_complete:e=>({title:"주문 완료",message:`주문번호 ${e}의 주문이 접수되었습니다.`,linkUrl:`/orders/${e}`}),order_shipped:e=>({title:"배송 시작",message:`주문번호 ${e}의 상품이 배송 시작되었습니다.`,linkUrl:`/orders/${e}`}),order_delivered:e=>({title:"배송 완료",message:`주문번호 ${e}의 상품이 배송 완료되었습니다.`,linkUrl:`/orders/${e}`}),refund_requested:e=>({title:"환불 요청 접수",message:`주문번호 ${e}의 환불이 접수되었습니다.`,linkUrl:`/orders/${e}`}),refund_complete:(e,s)=>({title:"환불 완료",message:`주문번호 ${e}의 환불(₩${s.toLocaleString()})이 완료되었습니다.`,linkUrl:`/orders/${e}`}),product_low_stock:(e,s)=>({title:"⚠️ 재고 부족 알림",message:`${e}의 재고가 ${s}개 남았습니다.`,linkUrl:"/seller/products"}),product_sold_out:e=>({title:"❌ 품절 알림",message:`${e}이(가) 품절되었습니다.`,linkUrl:"/seller/products"})},Nt=Object.freeze(Object.defineProperty({__proto__:null,NotificationTemplates:Jo,createNotification:Bo},Symbol.toStringTag,{value:"Module"}));export{Cr as default};
