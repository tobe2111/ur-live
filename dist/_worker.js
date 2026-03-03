var hi=Object.defineProperty;var xa=e=>{throw TypeError(e)};var _i=(e,t,s)=>t in e?hi(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s;var A=(e,t,s)=>_i(e,typeof t!="symbol"?t+"":t,s),Sr=(e,t,s)=>t.has(e)||xa("Cannot "+s);var T=(e,t,s)=>(Sr(e,t,"read from private field"),s?s.call(e):t.get(e)),C=(e,t,s)=>t.has(e)?xa("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,s),P=(e,t,s,r)=>(Sr(e,t,"write to private field"),r?r.call(e,s):t.set(e,s),s),M=(e,t,s)=>(Sr(e,t,"access private method"),s);var Ra=(e,t,s,r)=>({set _(a){P(e,t,a,s)},get _(){return T(e,t,r)}});import Ei from"crypto";var Ia=(e,t,s)=>(r,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,l=!1,u;if(e[i]?(u=e[i][0][0],r.req.routeIndex=i):u=i===e.length&&a||void 0,u)try{c=await u(r,()=>o(i+1))}catch(d){if(d instanceof Error&&t)r.error=d,c=await t(d,r),l=!0;else throw d}else r.finalized===!1&&s&&(c=await s(r));return c&&(r.finalized===!1||l)&&(r.res=c),r}},gi=Symbol(),yi=async(e,t=Object.create(null))=>{const{all:s=!1,dot:r=!1}=t,n=(e instanceof Qn?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?bi(e,{all:s,dot:r}):{}};async function bi(e,t){const s=await e.formData();return s?Ti(s,t):{}}function Ti(e,t){const s=Object.create(null);return e.forEach((r,a)=>{t.all||a.endsWith("[]")?vi(s,a,r):s[a]=r}),t.dot&&Object.entries(s).forEach(([r,a])=>{r.includes(".")&&(Si(s,r,a),delete s[r])}),s}var vi=(e,t,s)=>{e[t]!==void 0?Array.isArray(e[t])?e[t].push(s):e[t]=[e[t],s]:t.endsWith("[]")?e[t]=[s]:e[t]=s},Si=(e,t,s)=>{let r=e;const a=t.split(".");a.forEach((n,o)=>{o===a.length-1?r[n]=s:((!r[n]||typeof r[n]!="object"||Array.isArray(r[n])||r[n]instanceof File)&&(r[n]=Object.create(null)),r=r[n])})},Vn=e=>{const t=e.split("/");return t[0]===""&&t.shift(),t},wi=e=>{const{groups:t,path:s}=xi(e),r=Vn(s);return Ri(r,t)},xi=e=>{const t=[];return e=e.replace(/\{[^}]+\}/g,(s,r)=>{const a=`@${r}`;return t.push([a,s]),a}),{groups:t,path:e}},Ri=(e,t)=>{for(let s=t.length-1;s>=0;s--){const[r]=t[s];for(let a=e.length-1;a>=0;a--)if(e[a].includes(r)){e[a]=e[a].replace(r,t[s][1]);break}}return e},Os={},Ii=(e,t)=>{if(e==="*")return"*";const s=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(s){const r=`${e}#${t}`;return Os[r]||(s[2]?Os[r]=t&&t[0]!==":"&&t[0]!=="*"?[r,s[1],new RegExp(`^${s[2]}(?=/${t})`)]:[e,s[1],new RegExp(`^${s[2]}$`)]:Os[r]=[e,s[1],!0]),Os[r]}return null},na=(e,t)=>{try{return t(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,s=>{try{return t(s)}catch{return s}})}},Pi=e=>na(e,decodeURI),Jn=e=>{const t=e.url,s=t.indexOf("/",t.indexOf(":")+4);let r=s;for(;r<t.length;r++){const a=t.charCodeAt(r);if(a===37){const n=t.indexOf("?",r),o=t.indexOf("#",r),i=n===-1?o===-1?void 0:o:o===-1?n:Math.min(n,o),c=t.slice(s,i);return Pi(c.includes("%25")?c.replace(/%25/g,"%2525"):c)}else if(a===63||a===35)break}return t.slice(s,r)},Oi=e=>{const t=Jn(e);return t.length>1&&t.at(-1)==="/"?t.slice(0,-1):t},xt=(e,t,...s)=>(s.length&&(t=xt(t,...s)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${t==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(t==null?void 0:t[0])==="/"?t.slice(1):t}`}`),Yn=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const t=e.split("/"),s=[];let r="";return t.forEach(a=>{if(a!==""&&!/\:/.test(a))r+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){s.length===0&&r===""?s.push("/"):s.push(r);const n=a.replace("?","");r+="/"+n,s.push(r)}else r+="/"+a}),s.filter((a,n,o)=>o.indexOf(a)===n)},wr=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?na(e,Xn):e):e,zn=(e,t,s)=>{let r;if(!s&&t&&!/[%+]/.test(t)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(t,o+1)||(o=e.indexOf(`&${t}`,o+1));o!==-1;){const i=e.charCodeAt(o+t.length+1);if(i===61){const c=o+t.length+2,l=e.indexOf("&",c);return wr(e.slice(c,l===-1?void 0:l))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${t}`,o+1)}if(r=/[%+]/.test(e),!r)return}const a={};r??(r=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(r&&(c=wr(c)),n=o,c==="")continue;let l;i===-1?l="":(l=e.slice(i+1,o===-1?void 0:o),r&&(l=wr(l))),s?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(l)):a[c]??(a[c]=l)}return t?a[t]:a},Ai=zn,Ci=(e,t)=>zn(e,t,!0),Xn=decodeURIComponent,Pa=e=>na(e,Xn),At,pe,De,Zn,eo,Yr,Ue,Un,Qn=(Un=class{constructor(e,t="/",s=[[]]){C(this,De);A(this,"raw");C(this,At);C(this,pe);A(this,"routeIndex",0);A(this,"path");A(this,"bodyCache",{});C(this,Ue,e=>{const{bodyCache:t,raw:s}=this,r=t[e];if(r)return r;const a=Object.keys(t)[0];return a?t[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):t[e]=s[e]()});this.raw=e,this.path=t,P(this,pe,s),P(this,At,{})}param(e){return e?M(this,De,Zn).call(this,e):M(this,De,eo).call(this)}query(e){return Ai(this.url,e)}queries(e){return Ci(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const t={};return this.raw.headers.forEach((s,r)=>{t[r]=s}),t}async parseBody(e){var t;return(t=this.bodyCache).parsedBody??(t.parsedBody=await yi(this,e))}json(){return T(this,Ue).call(this,"text").then(e=>JSON.parse(e))}text(){return T(this,Ue).call(this,"text")}arrayBuffer(){return T(this,Ue).call(this,"arrayBuffer")}blob(){return T(this,Ue).call(this,"blob")}formData(){return T(this,Ue).call(this,"formData")}addValidatedData(e,t){T(this,At)[e]=t}valid(e){return T(this,At)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[gi](){return T(this,pe)}get matchedRoutes(){return T(this,pe)[0].map(([[,e]])=>e)}get routePath(){return T(this,pe)[0].map(([[,e]])=>e)[this.routeIndex].path}},At=new WeakMap,pe=new WeakMap,De=new WeakSet,Zn=function(e){const t=T(this,pe)[0][this.routeIndex][1][e],s=M(this,De,Yr).call(this,t);return s&&/\%/.test(s)?Pa(s):s},eo=function(){const e={},t=Object.keys(T(this,pe)[0][this.routeIndex][1]);for(const s of t){const r=M(this,De,Yr).call(this,T(this,pe)[0][this.routeIndex][1][s]);r!==void 0&&(e[s]=/\%/.test(r)?Pa(r):r)}return e},Yr=function(e){return T(this,pe)[1]?T(this,pe)[1][e]:e},Ue=new WeakMap,Un),Di={Stringify:1},to=async(e,t,s,r,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:t,buffer:a,context:r}))).then(i=>Promise.all(i.filter(Boolean).map(c=>to(c,t,!1,r,a))).then(()=>a[0]))):Promise.resolve(e)},ki="text/plain; charset=UTF-8",xr=(e,t)=>({"Content-Type":e,...t}),dt=(e,t)=>new Response(e,t),ys,bs,Pe,Ct,Oe,ie,Ts,Dt,kt,tt,vs,Ss,be,Rt,zr,qn,Ni=(qn=class{constructor(e,t){C(this,be);C(this,ys);C(this,bs);A(this,"env",{});C(this,Pe);A(this,"finalized",!1);A(this,"error");C(this,Ct);C(this,Oe);C(this,ie);C(this,Ts);C(this,Dt);C(this,kt);C(this,tt);C(this,vs);C(this,Ss);A(this,"render",(...e)=>(T(this,Dt)??P(this,Dt,t=>this.html(t)),T(this,Dt).call(this,...e)));A(this,"setLayout",e=>P(this,Ts,e));A(this,"getLayout",()=>T(this,Ts));A(this,"setRenderer",e=>{P(this,Dt,e)});A(this,"header",(e,t,s)=>{this.finalized&&P(this,ie,dt(T(this,ie).body,T(this,ie)));const r=T(this,ie)?T(this,ie).headers:T(this,tt)??P(this,tt,new Headers);t===void 0?r.delete(e):s!=null&&s.append?r.append(e,t):r.set(e,t)});A(this,"status",e=>{P(this,Ct,e)});A(this,"set",(e,t)=>{T(this,Pe)??P(this,Pe,new Map),T(this,Pe).set(e,t)});A(this,"get",e=>T(this,Pe)?T(this,Pe).get(e):void 0);A(this,"newResponse",(...e)=>M(this,be,Rt).call(this,...e));A(this,"body",(e,t,s)=>M(this,be,Rt).call(this,e,t,s));A(this,"text",(e,t,s)=>M(this,be,zr).call(this)&&!t&&!s?dt(e):M(this,be,Rt).call(this,e,t,xr(ki,s)));A(this,"json",(e,t,s)=>M(this,be,zr).call(this)&&!t&&!s?Response.json(e):M(this,be,Rt).call(this,JSON.stringify(e),t,xr("application/json",s)));A(this,"html",(e,t,s)=>{const r=a=>M(this,be,Rt).call(this,a,t,xr("text/html; charset=UTF-8",s));return typeof e=="object"?to(e,Di.Stringify,!1,{}).then(r):r(e)});A(this,"redirect",(e,t)=>{const s=String(e);return this.header("Location",/[^\x00-\xFF]/.test(s)?encodeURI(s):s),this.newResponse(null,t??302)});A(this,"notFound",()=>(T(this,kt)??P(this,kt,()=>dt()),T(this,kt).call(this,this)));P(this,ys,e),t&&(P(this,Oe,t.executionCtx),this.env=t.env,P(this,kt,t.notFoundHandler),P(this,Ss,t.path),P(this,vs,t.matchResult))}get req(){return T(this,bs)??P(this,bs,new Qn(T(this,ys),T(this,Ss),T(this,vs))),T(this,bs)}get event(){if(T(this,Oe)&&"respondWith"in T(this,Oe))return T(this,Oe);throw Error("This context has no FetchEvent")}get executionCtx(){if(T(this,Oe))return T(this,Oe);throw Error("This context has no ExecutionContext")}get res(){return T(this,ie)||P(this,ie,dt(null,{headers:T(this,tt)??P(this,tt,new Headers)}))}set res(e){if(T(this,ie)&&e){e=dt(e.body,e);for(const[t,s]of T(this,ie).headers.entries())if(t!=="content-type")if(t==="set-cookie"){const r=T(this,ie).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of r)e.headers.append("set-cookie",a)}else e.headers.set(t,s)}P(this,ie,e),this.finalized=!0}get var(){return T(this,Pe)?Object.fromEntries(T(this,Pe)):{}}},ys=new WeakMap,bs=new WeakMap,Pe=new WeakMap,Ct=new WeakMap,Oe=new WeakMap,ie=new WeakMap,Ts=new WeakMap,Dt=new WeakMap,kt=new WeakMap,tt=new WeakMap,vs=new WeakMap,Ss=new WeakMap,be=new WeakSet,Rt=function(e,t,s){const r=T(this,ie)?new Headers(T(this,ie).headers):T(this,tt)??new Headers;if(typeof t=="object"&&"headers"in t){const n=t.headers instanceof Headers?t.headers:new Headers(t.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?r.append(o,i):r.set(o,i)}if(s)for(const[n,o]of Object.entries(s))if(typeof o=="string")r.set(n,o);else{r.delete(n);for(const i of o)r.append(n,i)}const a=typeof t=="number"?t:(t==null?void 0:t.status)??T(this,Ct);return dt(e,{status:a,headers:r})},zr=function(){return!T(this,tt)&&!T(this,Ct)&&!this.finalized},qn),Y="ALL",ji="all",Mi=["get","post","put","delete","options","patch"],so="Can not add a route since the matcher is already built.",ro=class extends Error{},Li="__COMPOSED_HANDLER",$i=e=>e.text("404 Not Found",404),Oa=(e,t)=>{if("getResponse"in e){const s=e.getResponse();return t.newResponse(s.body,s)}return console.error(e),t.text("Internal Server Error",500)},Ee,z,ao,ge,Qe,sr,rr,Nt,Fi=(Nt=class{constructor(t={}){C(this,z);A(this,"get");A(this,"post");A(this,"put");A(this,"delete");A(this,"options");A(this,"patch");A(this,"all");A(this,"on");A(this,"use");A(this,"router");A(this,"getPath");A(this,"_basePath","/");C(this,Ee,"/");A(this,"routes",[]);C(this,ge,$i);A(this,"errorHandler",Oa);A(this,"onError",t=>(this.errorHandler=t,this));A(this,"notFound",t=>(P(this,ge,t),this));A(this,"fetch",(t,...s)=>M(this,z,rr).call(this,t,s[1],s[0],t.method));A(this,"request",(t,s,r,a)=>t instanceof Request?this.fetch(s?new Request(t,s):t,r,a):(t=t.toString(),this.fetch(new Request(/^https?:\/\//.test(t)?t:`http://localhost${xt("/",t)}`,s),r,a)));A(this,"fire",()=>{addEventListener("fetch",t=>{t.respondWith(M(this,z,rr).call(this,t.request,t,void 0,t.request.method))})});[...Mi,ji].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?P(this,Ee,o):M(this,z,Qe).call(this,n,T(this,Ee),o),i.forEach(c=>{M(this,z,Qe).call(this,n,T(this,Ee),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){P(this,Ee,c);for(const l of[n].flat())i.map(u=>{M(this,z,Qe).call(this,l.toUpperCase(),T(this,Ee),u)})}return this},this.use=(n,...o)=>(typeof n=="string"?P(this,Ee,n):(P(this,Ee,"*"),o.unshift(n)),o.forEach(i=>{M(this,z,Qe).call(this,Y,T(this,Ee),i)}),this);const{strict:r,...a}=t;Object.assign(this,a),this.getPath=r??!0?t.getPath??Jn:Oi}route(t,s){const r=this.basePath(t);return s.routes.map(a=>{var o;let n;s.errorHandler===Oa?n=a.handler:(n=async(i,c)=>(await Ia([],s.errorHandler)(i,()=>a.handler(i,c))).res,n[Li]=a.handler),M(o=r,z,Qe).call(o,a.method,a.path,n)}),this}basePath(t){const s=M(this,z,ao).call(this);return s._basePath=xt(this._basePath,t),s}mount(t,s,r){let a,n;r&&(typeof r=="function"?n=r:(n=r.optionHandler,r.replaceRequest===!1?a=c=>c:a=r.replaceRequest));const o=n?c=>{const l=n(c);return Array.isArray(l)?l:[l]}:c=>{let l;try{l=c.executionCtx}catch{}return[c.env,l]};a||(a=(()=>{const c=xt(this._basePath,t),l=c==="/"?0:c.length;return u=>{const d=new URL(u.url);return d.pathname=d.pathname.slice(l)||"/",new Request(d,u)}})());const i=async(c,l)=>{const u=await s(a(c.req.raw),...o(c));if(u)return u;await l()};return M(this,z,Qe).call(this,Y,xt(t,"*"),i),this}},Ee=new WeakMap,z=new WeakSet,ao=function(){const t=new Nt({router:this.router,getPath:this.getPath});return t.errorHandler=this.errorHandler,P(t,ge,T(this,ge)),t.routes=this.routes,t},ge=new WeakMap,Qe=function(t,s,r){t=t.toUpperCase(),s=xt(this._basePath,s);const a={basePath:this._basePath,path:s,method:t,handler:r};this.router.add(t,s,[r,a]),this.routes.push(a)},sr=function(t,s){if(t instanceof Error)return this.errorHandler(t,s);throw t},rr=function(t,s,r,a){if(a==="HEAD")return(async()=>new Response(null,await M(this,z,rr).call(this,t,s,r,"GET")))();const n=this.getPath(t,{env:r}),o=this.router.match(a,n),i=new Ni(t,{path:n,matchResult:o,env:r,executionCtx:s,notFoundHandler:T(this,ge)});if(o[0].length===1){let l;try{l=o[0][0][0][0](i,async()=>{i.res=await T(this,ge).call(this,i)})}catch(u){return M(this,z,sr).call(this,u,i)}return l instanceof Promise?l.then(u=>u||(i.finalized?i.res:T(this,ge).call(this,i))).catch(u=>M(this,z,sr).call(this,u,i)):l??T(this,ge).call(this,i)}const c=Ia(o[0],this.errorHandler,T(this,ge));return(async()=>{try{const l=await c(i);if(!l.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return l.res}catch(l){return M(this,z,sr).call(this,l,i)}})()},Nt),no=[];function Ui(e,t){const s=this.buildAllMatchers(),r=((a,n)=>{const o=s[a]||s[Y],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],no];const l=c.indexOf("",1);return[o[1][l],c]});return this.match=r,r(e,t)}var or="[^/]+",ps=".*",ms="(?:|/.*)",It=Symbol(),qi=new Set(".\\+*[^]$()");function Hi(e,t){return e.length===1?t.length===1?e<t?-1:1:-1:t.length===1||e===ps||e===ms?1:t===ps||t===ms?-1:e===or?1:t===or?-1:e.length===t.length?e<t?-1:1:t.length-e.length}var st,rt,ye,it,Wi=(it=class{constructor(){C(this,st);C(this,rt);C(this,ye,Object.create(null))}insert(t,s,r,a,n){if(t.length===0){if(T(this,st)!==void 0)throw It;if(n)return;P(this,st,s);return}const[o,...i]=t,c=o==="*"?i.length===0?["","",ps]:["","",or]:o==="/*"?["","",ms]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let l;if(c){const u=c[1];let d=c[2]||or;if(u&&c[2]&&(d===".*"||(d=d.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(d))))throw It;if(l=T(this,ye)[d],!l){if(Object.keys(T(this,ye)).some(m=>m!==ps&&m!==ms))throw It;if(n)return;l=T(this,ye)[d]=new it,u!==""&&P(l,rt,a.varIndex++)}!n&&u!==""&&r.push([u,T(l,rt)])}else if(l=T(this,ye)[o],!l){if(Object.keys(T(this,ye)).some(u=>u.length>1&&u!==ps&&u!==ms))throw It;if(n)return;l=T(this,ye)[o]=new it}l.insert(i,s,r,a,n)}buildRegExpStr(){const s=Object.keys(T(this,ye)).sort(Hi).map(r=>{const a=T(this,ye)[r];return(typeof T(a,rt)=="number"?`(${r})@${T(a,rt)}`:qi.has(r)?`\\${r}`:r)+a.buildRegExpStr()});return typeof T(this,st)=="number"&&s.unshift(`#${T(this,st)}`),s.length===0?"":s.length===1?s[0]:"(?:"+s.join("|")+")"}},st=new WeakMap,rt=new WeakMap,ye=new WeakMap,it),mr,ws,Hn,Bi=(Hn=class{constructor(){C(this,mr,{varIndex:0});C(this,ws,new Wi)}insert(e,t,s){const r=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const l=`@\\${o}`;return a[o]=[l,c],o++,i=!0,l}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return T(this,ws).insert(n,t,r,T(this,mr),s),r}buildRegExp(){let e=T(this,ws).buildRegExpStr();if(e==="")return[/^$/,[],[]];let t=0;const s=[],r=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(s[++t]=Number(n),"$()"):(o!==void 0&&(r[Number(o)]=++t),"")),[new RegExp(`^${e}`),s,r]}},mr=new WeakMap,ws=new WeakMap,Hn),Ki=[/^$/,[],Object.create(null)],ar=Object.create(null);function oo(e){return ar[e]??(ar[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(t,s)=>s?`\\${s}`:"(?:|/.*)")}$`))}function Gi(){ar=Object.create(null)}function Vi(e){var l;const t=new Bi,s=[];if(e.length===0)return Ki;const r=e.map(u=>[!/\*|\/:/.test(u[0]),...u]).sort(([u,d],[m,_])=>u?1:m?-1:d.length-_.length),a=Object.create(null);for(let u=0,d=-1,m=r.length;u<m;u++){const[_,h,E]=r[u];_?a[h]=[E.map(([b])=>[b,Object.create(null)]),no]:d++;let v;try{v=t.insert(h,d,_)}catch(b){throw b===It?new ro(h):b}_||(s[d]=E.map(([b,g])=>{const S=Object.create(null);for(g-=1;g>=0;g--){const[y,x]=v[g];S[y]=x}return[b,S]}))}const[n,o,i]=t.buildRegExp();for(let u=0,d=s.length;u<d;u++)for(let m=0,_=s[u].length;m<_;m++){const h=(l=s[u][m])==null?void 0:l[1];if(!h)continue;const E=Object.keys(h);for(let v=0,b=E.length;v<b;v++)h[E[v]]=i[h[E[v]]]}const c=[];for(const u in o)c[u]=s[o[u]];return[n,c,a]}function pt(e,t){if(e){for(const s of Object.keys(e).sort((r,a)=>a.length-r.length))if(oo(s).test(t))return[...e[s]]}}var qe,He,fr,io,Wn,Ji=(Wn=class{constructor(){C(this,fr);A(this,"name","RegExpRouter");C(this,qe);C(this,He);A(this,"match",Ui);P(this,qe,{[Y]:Object.create(null)}),P(this,He,{[Y]:Object.create(null)})}add(e,t,s){var i;const r=T(this,qe),a=T(this,He);if(!r||!a)throw new Error(so);r[e]||[r,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[Y]).forEach(l=>{c[e][l]=[...c[Y][l]]})}),t==="/*"&&(t="*");const n=(t.match(/\/:/g)||[]).length;if(/\*$/.test(t)){const c=oo(t);e===Y?Object.keys(r).forEach(l=>{var u;(u=r[l])[t]||(u[t]=pt(r[l],t)||pt(r[Y],t)||[])}):(i=r[e])[t]||(i[t]=pt(r[e],t)||pt(r[Y],t)||[]),Object.keys(r).forEach(l=>{(e===Y||e===l)&&Object.keys(r[l]).forEach(u=>{c.test(u)&&r[l][u].push([s,n])})}),Object.keys(a).forEach(l=>{(e===Y||e===l)&&Object.keys(a[l]).forEach(u=>c.test(u)&&a[l][u].push([s,n]))});return}const o=Yn(t)||[t];for(let c=0,l=o.length;c<l;c++){const u=o[c];Object.keys(a).forEach(d=>{var m;(e===Y||e===d)&&((m=a[d])[u]||(m[u]=[...pt(r[d],u)||pt(r[Y],u)||[]]),a[d][u].push([s,n-l+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(T(this,He)).concat(Object.keys(T(this,qe))).forEach(t=>{e[t]||(e[t]=M(this,fr,io).call(this,t))}),P(this,qe,P(this,He,void 0)),Gi(),e}},qe=new WeakMap,He=new WeakMap,fr=new WeakSet,io=function(e){const t=[];let s=e===Y;return[T(this,qe),T(this,He)].forEach(r=>{const a=r[e]?Object.keys(r[e]).map(n=>[n,r[e][n]]):[];a.length!==0?(s||(s=!0),t.push(...a)):e!==Y&&t.push(...Object.keys(r[Y]).map(n=>[n,r[Y][n]]))}),s?Vi(t):null},Wn),We,Ae,Bn,Yi=(Bn=class{constructor(e){A(this,"name","SmartRouter");C(this,We,[]);C(this,Ae,[]);P(this,We,e.routers)}add(e,t,s){if(!T(this,Ae))throw new Error(so);T(this,Ae).push([e,t,s])}match(e,t){if(!T(this,Ae))throw new Error("Fatal error");const s=T(this,We),r=T(this,Ae),a=s.length;let n=0,o;for(;n<a;n++){const i=s[n];try{for(let c=0,l=r.length;c<l;c++)i.add(...r[c]);o=i.match(e,t)}catch(c){if(c instanceof ro)continue;throw c}this.match=i.match.bind(i),P(this,We,[i]),P(this,Ae,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(T(this,Ae)||T(this,We).length!==1)throw new Error("No active router has been determined yet.");return T(this,We)[0]}},We=new WeakMap,Ae=new WeakMap,Bn),Ht=Object.create(null),zi=e=>{for(const t in e)return!0;return!1},Be,ne,at,jt,te,Ce,Ze,Mt,Xi=(Mt=class{constructor(t,s,r){C(this,Ce);C(this,Be);C(this,ne);C(this,at);C(this,jt,0);C(this,te,Ht);if(P(this,ne,r||Object.create(null)),P(this,Be,[]),t&&s){const a=Object.create(null);a[t]={handler:s,possibleKeys:[],score:0},P(this,Be,[a])}P(this,at,[])}insert(t,s,r){P(this,jt,++Ra(this,jt)._);let a=this;const n=wi(s),o=[];for(let i=0,c=n.length;i<c;i++){const l=n[i],u=n[i+1],d=Ii(l,u),m=Array.isArray(d)?d[0]:l;if(m in T(a,ne)){a=T(a,ne)[m],d&&o.push(d[1]);continue}T(a,ne)[m]=new Mt,d&&(T(a,at).push(d),o.push(d[1])),a=T(a,ne)[m]}return T(a,Be).push({[t]:{handler:r,possibleKeys:o.filter((i,c,l)=>l.indexOf(i)===c),score:T(this,jt)}}),a}search(t,s){var u;const r=[];P(this,te,Ht);let n=[this];const o=Vn(s),i=[],c=o.length;let l=null;for(let d=0;d<c;d++){const m=o[d],_=d===c-1,h=[];for(let v=0,b=n.length;v<b;v++){const g=n[v],S=T(g,ne)[m];S&&(P(S,te,T(g,te)),_?(T(S,ne)["*"]&&M(this,Ce,Ze).call(this,r,T(S,ne)["*"],t,T(g,te)),M(this,Ce,Ze).call(this,r,S,t,T(g,te))):h.push(S));for(let y=0,x=T(g,at).length;y<x;y++){const k=T(g,at)[y],R=T(g,te)===Ht?{}:{...T(g,te)};if(k==="*"){const q=T(g,ne)["*"];q&&(M(this,Ce,Ze).call(this,r,q,t,T(g,te)),P(q,te,R),h.push(q));continue}const[I,$,N]=k;if(!m&&!(N instanceof RegExp))continue;const L=T(g,ne)[I];if(N instanceof RegExp){if(l===null){l=new Array(c);let ee=s[0]==="/"?1:0;for(let O=0;O<c;O++)l[O]=ee,ee+=o[O].length+1}const q=s.substring(l[d]),ae=N.exec(q);if(ae){if(R[$]=ae[0],M(this,Ce,Ze).call(this,r,L,t,T(g,te),R),zi(T(L,ne))){P(L,te,R);const ee=((u=ae[0].match(/\//))==null?void 0:u.length)??0;(i[ee]||(i[ee]=[])).push(L)}continue}}(N===!0||N.test(m))&&(R[$]=m,_?(M(this,Ce,Ze).call(this,r,L,t,R,T(g,te)),T(L,ne)["*"]&&M(this,Ce,Ze).call(this,r,T(L,ne)["*"],t,R,T(g,te))):(P(L,te,R),h.push(L)))}}const E=i.shift();n=E?h.concat(E):h}return r.length>1&&r.sort((d,m)=>d.score-m.score),[r.map(({handler:d,params:m})=>[d,m])]}},Be=new WeakMap,ne=new WeakMap,at=new WeakMap,jt=new WeakMap,te=new WeakMap,Ce=new WeakSet,Ze=function(t,s,r,a,n){for(let o=0,i=T(s,Be).length;o<i;o++){const c=T(s,Be)[o],l=c[r]||c[Y],u={};if(l!==void 0&&(l.params=Object.create(null),t.push(l),a!==Ht||n&&n!==Ht))for(let d=0,m=l.possibleKeys.length;d<m;d++){const _=l.possibleKeys[d],h=u[l.score];l.params[_]=n!=null&&n[_]&&!h?n[_]:a[_]??(n==null?void 0:n[_]),u[l.score]=!0}}},Mt),nt,Kn,Qi=(Kn=class{constructor(){A(this,"name","TrieRouter");C(this,nt);P(this,nt,new Xi)}add(e,t,s){const r=Yn(t);if(r){for(let a=0,n=r.length;a<n;a++)T(this,nt).insert(e,r[a],s);return}T(this,nt).insert(e,t,s)}match(e,t){return T(this,nt).search(e,t)}},nt=new WeakMap,Kn),co=class extends Fi{constructor(e={}){super(e),this.router=e.router??new Yi({routers:[new Ji,new Qi]})}},w=e=>{const s={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},r=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(s.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(s.allowMethods);return async function(o,i){var u;function c(d,m){o.res.headers.set(d,m)}const l=await r(o.req.header("origin")||"",o);if(l&&c("Access-Control-Allow-Origin",l),s.credentials&&c("Access-Control-Allow-Credentials","true"),(u=s.exposeHeaders)!=null&&u.length&&c("Access-Control-Expose-Headers",s.exposeHeaders.join(",")),o.req.method==="OPTIONS"){s.origin!=="*"&&c("Vary","Origin"),s.maxAge!=null&&c("Access-Control-Max-Age",s.maxAge.toString());const d=await a(o.req.header("origin")||"",o);d.length&&c("Access-Control-Allow-Methods",d.join(","));let m=s.allowHeaders;if(!(m!=null&&m.length)){const _=o.req.header("Access-Control-Request-Headers");_&&(m=_.split(/\s*,\s*/))}return m!=null&&m.length&&(c("Access-Control-Allow-Headers",m.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),s.origin!=="*"&&o.header("Vary","Origin",{append:!0})}};function Zi(e){var a;const t=((a=e.split(".").pop())==null?void 0:a.toLowerCase())||"jpg",s=Date.now(),r=crypto.randomUUID().substring(0,8);return`upload_${s}_${r}.${t}`}async function ec(e){const t=new Uint8Array(e);return t[0]===255&&t[1]===216&&t[2]===255?{valid:!0,detectedType:"image/jpeg"}:t[0]===137&&t[1]===80&&t[2]===78&&t[3]===71?{valid:!0,detectedType:"image/png"}:t[0]===71&&t[1]===73&&t[2]===70&&t[3]===56?{valid:!0,detectedType:"image/gif"}:t[0]===82&&t[1]===73&&t[2]===70&&t[3]===70&&t[8]===87&&t[9]===69&&t[10]===66&&t[11]===80?{valid:!0,detectedType:"image/webp"}:{valid:!1}}function tc(e){const t=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],s=[];for(const r of t)e[r]||s.push(r);if(s.length>0)throw new Error(`Missing required environment variables: ${s.join(", ")}

Please configure them:
`+s.map(r=>r==="TOSS_SECRET_KEY"||r==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${r} --project-name ur-live`:`  Check wrangler.jsonc for ${r} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function sc(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function rc(e){const t=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),t.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):t.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(s){t.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:s instanceof Error?s.message:String(s)})}try{if(!e.SESSION_KV)t.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const s="test:env:check";await e.SESSION_KV.put(s,"ok",{expirationTtl:60}),await e.SESSION_KV.get(s)==="ok"?t.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):t.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(s){t.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:s instanceof Error?s.message:String(s)})}try{if(!e.CACHE_KV)t.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const s="test:cache:check";await e.CACHE_KV.put(s,"ok",{expirationTtl:60}),await e.CACHE_KV.get(s)==="ok"?t.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):t.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(s){t.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:s instanceof Error?s.message:String(s)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?t.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):t.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):t.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?t.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):t.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):t.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),e.FIREBASE_PRIVATE_KEY?e.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")?t.push({name:"FIREBASE_PRIVATE_KEY",status:"pass",message:`FIREBASE_PRIVATE_KEY configured (${e.FIREBASE_PRIVATE_KEY.length} chars)`}):t.push({name:"FIREBASE_PRIVATE_KEY",status:"warn",message:"FIREBASE_PRIVATE_KEY format may be invalid",details:"Expected format: -----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}):t.push({name:"FIREBASE_PRIVATE_KEY",status:"fail",message:"FIREBASE_PRIVATE_KEY not configured",details:"Add FIREBASE_PRIVATE_KEY in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_CLIENT_EMAIL?!e.FIREBASE_CLIENT_EMAIL.includes("@")||!e.FIREBASE_CLIENT_EMAIL.includes("iam.gserviceaccount.com")?t.push({name:"FIREBASE_CLIENT_EMAIL",status:"warn",message:"FIREBASE_CLIENT_EMAIL format may be invalid",details:"Expected format: *@*.iam.gserviceaccount.com"}):t.push({name:"FIREBASE_CLIENT_EMAIL",status:"pass",message:`FIREBASE_CLIENT_EMAIL configured: ${e.FIREBASE_CLIENT_EMAIL}`}):t.push({name:"FIREBASE_CLIENT_EMAIL",status:"fail",message:"FIREBASE_CLIENT_EMAIL not configured",details:"Add FIREBASE_CLIENT_EMAIL in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_PROJECT_ID?t.push({name:"FIREBASE_PROJECT_ID",status:"pass",message:`FIREBASE_PROJECT_ID configured: ${e.FIREBASE_PROJECT_ID}`}):t.push({name:"FIREBASE_PROJECT_ID",status:"fail",message:"FIREBASE_PROJECT_ID not configured",details:"Add FIREBASE_PROJECT_ID in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_DATABASE_URL?!e.FIREBASE_DATABASE_URL.startsWith("https://")||!e.FIREBASE_DATABASE_URL.includes("firebaseio.com")?t.push({name:"FIREBASE_DATABASE_URL",status:"warn",message:"FIREBASE_DATABASE_URL format may be invalid",details:"Expected format: https://*.firebaseio.com"}):t.push({name:"FIREBASE_DATABASE_URL",status:"pass",message:`FIREBASE_DATABASE_URL configured: ${e.FIREBASE_DATABASE_URL}`}):t.push({name:"FIREBASE_DATABASE_URL",status:"fail",message:"FIREBASE_DATABASE_URL not configured",details:"Add FIREBASE_DATABASE_URL in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),t}function ac(e){const t=[];t.push(""),t.push("========================================"),t.push("환경 변수 테스트 결과"),t.push("========================================"),t.push("");let s=0,r=0,a=0;for(const n of e){const o=n.status==="pass"?"✅":n.status==="warn"?"⚠️":"❌";t.push(`${o} ${n.name}: ${n.message}`),n.details&&t.push(`   → ${n.details}`),n.status==="pass"&&s++,n.status==="warn"&&r++,n.status==="fail"&&a++}return t.push(""),t.push("========================================"),t.push(`총 ${e.length}개 테스트:`),t.push(`  ✅ 성공: ${s}`),r>0&&t.push(`  ⚠️  경고: ${r}`),a>0&&t.push(`  ❌ 실패: ${a}`),t.push("========================================"),t.push(""),a>0?(t.push("❌ 환경 변수 설정이 완료되지 않았습니다."),t.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):r>0?t.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):t.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),t.join(`
`)}async function nc(e){const t=await rc(e),s=t.filter(n=>n.status==="pass").length,r=t.filter(n=>n.status==="warn").length,a=t.filter(n=>n.status==="fail").length;return{success:a===0,summary:{total:t.length,pass:s,warn:r,fail:a},results:t,formatted:ac(t)}}const Rr={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function oc(){const e=Rr.ENV==="production";return{baseUrl:Rr.TEST_BASE_URL,apiKey:Rr.TEST_API_KEY,isProduction:e}}async function lo(e,t){const s=oc(),r=`${s.baseUrl}${e}`;try{const a=await fetch(r,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s.apiKey}`},body:JSON.stringify(t)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function ic(e){try{const t={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((r,a)=>({SerialNum:a+1,ItemName:r.name,Qty:r.quantity,UnitPrice:r.unitPrice,SupplyCost:r.supplyPrice,Tax:r.taxAmount,Remark:r.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},s=await lo("/eTaxInvoice/RegistAndIssue",t);if(s.code!==1)throw new Error(`바로빌 발행 실패: ${s.message}`);return{success:!0,ntsConfirmNumber:s.ntsconfirmNum,invoiceKey:s.invoiceKey,message:s.message}}catch(t){throw console.error("바로빌 세금계산서 발행 실패:",t),t}}async function cc(e,t,s){try{const a=await lo("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:t,Memo:s});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(r){throw console.error("바로빌 세금계산서 취소 실패:",r),r}}function ds(){return!1}async function lc(e){return await ic(e)}function uc(e,t,s){const r=Number(t.total_amount),a=Math.floor(r/1.1),n=r-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:t.buyer_business_number,buyerBusinessName:t.buyer_business_name||t.user_name,buyerCEO:t.buyer_ceo_name,buyerAddress:t.shipping_address,buyerEmail:t.user_email,buyerTel:t.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:s.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),l=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:l,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:r,memo:`주문번호: ${t.order_number}`,orderNo:t.order_number}}class me extends Error{constructor(t,s,r){super(t),this.statusCode=s,this.code=r,this.name="AuthError"}}function dc(e){return`${crypto.randomUUID()}-${e}`}function pc(e){var n,o,i,c,l,u,d;const t=e.id.toString(),s=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",r=((c=e.kakao_account)==null?void 0:c.email)||null,a=((l=e.properties)==null?void 0:l.profile_image)||((d=(u=e.kakao_account)==null?void 0:u.profile)==null?void 0:d.profile_image_url)||null;return{kakaoId:t,nickname:s,email:r,profileImage:a}}async function mc(e,t,s,r,a){try{const n=await e.prepare(`
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
    `).bind(t,s,r,a).first();if(!n)throw new me("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",n.id),n}catch(n){throw n instanceof me?n:(console.error("[Auth] Database error during upsert:",n),new me("Database error",500,"DB_ERROR"))}}async function fc(e){try{const t=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!t.ok){const r=await t.text();throw console.error("[Kakao API] Failed to get user info:",r),new me("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const s=await t.json();if(!s.id)throw new me("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return s}catch(t){throw t instanceof me?t:(console.error("[Kakao API] Network error:",t),new me("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function hc(e,t,s){try{const r=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:s,redirect_uri:t,code:e}).toString()});if(!r.ok){const n=await r.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new me(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await r.json()).access_token}catch(r){throw r instanceof me?r:(console.error("[Kakao OAuth] Network error:",r),new me("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function uo(e,t){const s=await fc(t),{kakaoId:r,nickname:a,email:n,profileImage:o}=pc(s);console.log("[Auth] Processing login for Kakao user:",r);const i=await mc(e,r,a,n,o),c=dc(i.id);return{user:i,sessionToken:c}}async function po(e,t,s=30){try{const r=await e.get(t,"json");if(!r)return console.log(`[Cache MISS] ${t}`),null;const a=Date.now()-r.timestamp;return a>s*1e3?(console.log(`[Cache EXPIRED] ${t} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${t} (age: ${Math.round(a/1e3)}s)`),r.data)}catch(r){return console.error(`[Cache] Get error for key "${t}":`,r),null}}async function ir(e,t,s,r=30){try{const a={data:s,timestamp:Date.now()};await e.put(t,JSON.stringify(a),{expirationTtl:r}),console.log(`[Cache SET] ${t} (TTL: ${r}s)`)}catch(a){console.error(`[Cache] Set error for key "${t}":`,a)}}function _c(e){const t=e.req.header("CF-Connecting-IP");if(t)return t;const s=e.req.header("X-Forwarded-For");if(s)return s.split(",")[0].trim();const r=e.req.header("X-Real-IP");return r||"unknown"}function Ec(e,t){return`ratelimit:${e}:${t}`}const Ir=new Map;async function gc(e,t,s){var m;const r=new URL(e.req.url).pathname,a=Ec(t,r),n=Date.now(),o=s.windowMs*1e3,c=e.get("user")&&s.authenticatedMultiplier?s.maxRequests*s.authenticatedMultiplier:s.maxRequests;try{const _=(m=e.env)==null?void 0:m.RATE_LIMIT_KV;if(_){const h=await _.get(a);let E;h?(E=JSON.parse(h),n>E.resetTime?E={count:1,resetTime:n+o}:E.count++):E={count:1,resetTime:n+o};const v=Math.ceil(o/1e3);await _.put(a,JSON.stringify(E),{expirationTtl:v});const b=E.count<=c,g=Math.max(0,c-E.count);return{allowed:b,remaining:g,resetTime:E.resetTime}}}catch(_){console.error("KV Rate Limit Error:",_)}let l=Ir.get(a);l&&n>l.resetTime&&(Ir.delete(a),l=void 0),l?l.count++:l={count:1,resetTime:n+o},Ir.set(a,l);const u=l.count<=c,d=Math.max(0,c-l.count);return{allowed:u,remaining:d,resetTime:l.resetTime}}function ct(e){return async(t,s)=>{const r=_c(t);if(e.skipIps&&e.skipIps.includes(r))return s();if(e.pathPattern){const n=new URL(t.req.url).pathname;if(!e.pathPattern.test(n))return s()}const a=await gc(t,r,e);if(t.header("X-RateLimit-Limit",e.maxRequests.toString()),t.header("X-RateLimit-Remaining",a.remaining.toString()),t.header("X-RateLimit-Reset",new Date(a.resetTime).toISOString()),!a.allowed){const n=Math.ceil((a.resetTime-Date.now())/1e3);return t.header("Retry-After",n.toString()),t.json({success:!1,error:e.message||"Too many requests. Please try again later.",retryAfter:n,resetTime:new Date(a.resetTime).toISOString()},429)}return s()}}const lt={api:{windowMs:60,maxRequests:60,message:"API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",authenticatedMultiplier:2},auth:{windowMs:60,maxRequests:5,message:"로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",pathPattern:/^\/api\/auth\//},order:{windowMs:60,maxRequests:10,message:"주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/orders/,authenticatedMultiplier:2},cart:{windowMs:60,maxRequests:20,message:"장바구니 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/cart/,authenticatedMultiplier:2},refund:{windowMs:3600,maxRequests:3,message:"환불 요청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.",pathPattern:/^\/api\/orders\/.*\/refund/},alimtalk:{windowMs:60,maxRequests:10,message:"알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/seller\/alimtalk\/send/},upload:{windowMs:60,maxRequests:5,message:"파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/.*\/upload/}};class J extends Error{constructor(t,s,r="VALIDATION_ERROR"){super(s),this.field=t,this.code=r,this.name="ValidationError"}}function yc(e,t){const{field:s,required:r,type:a,min:n,max:o,pattern:i,enum:c,custom:l,message:u}=t;if(r&&(e==null||e===""))throw new J(s,u||`${s}은(는) 필수 항목입니다.`,"REQUIRED");if(!(e==null||e==="")){if(a)switch(a){case"string":if(typeof e!="string")throw new J(s,u||`${s}은(는) 문자열이어야 합니다.`,"INVALID_TYPE");break;case"number":const d=typeof e=="string"?Number(e):e;if(typeof d!="number"||isNaN(d))throw new J(s,u||`${s}은(는) 숫자여야 합니다.`,"INVALID_TYPE");break;case"boolean":if(typeof e!="boolean")throw new J(s,u||`${s}은(는) true/false 값이어야 합니다.`,"INVALID_TYPE");break;case"email":if(typeof e!="string"||!vc(e))throw new J(s,u||`${s}은(는) 유효한 이메일 주소여야 합니다.`,"INVALID_EMAIL");break;case"url":if(typeof e!="string"||!Sc(e))throw new J(s,u||`${s}은(는) 유효한 URL이어야 합니다.`,"INVALID_URL");break;case"phone":if(typeof e!="string"||!wc(e))throw new J(s,u||`${s}은(는) 유효한 전화번호여야 합니다.`,"INVALID_PHONE");break;case"date":if(!(e instanceof Date)&&!xc(e))throw new J(s,u||`${s}은(는) 유효한 날짜여야 합니다.`,"INVALID_DATE");break;case"array":if(!Array.isArray(e))throw new J(s,u||`${s}은(는) 배열이어야 합니다.`,"INVALID_TYPE");break;case"object":if(typeof e!="object"||e===null||Array.isArray(e))throw new J(s,u||`${s}은(는) 객체여야 합니다.`,"INVALID_TYPE");break}if(typeof e=="string"){if(n!==void 0&&e.length<n)throw new J(s,u||`${s}은(는) 최소 ${n}자 이상이어야 합니다.`,"TOO_SHORT");if(o!==void 0&&e.length>o)throw new J(s,u||`${s}은(는) 최대 ${o}자 이하여야 합니다.`,"TOO_LONG")}if(typeof e=="number"){if(n!==void 0&&e<n)throw new J(s,u||`${s}은(는) 최소 ${n} 이상이어야 합니다.`,"TOO_SMALL");if(o!==void 0&&e>o)throw new J(s,u||`${s}은(는) 최대 ${o} 이하여야 합니다.`,"TOO_LARGE")}if(Array.isArray(e)){if(n!==void 0&&e.length<n)throw new J(s,u||`${s}은(는) 최소 ${n}개 이상이어야 합니다.`,"TOO_FEW");if(o!==void 0&&e.length>o)throw new J(s,u||`${s}은(는) 최대 ${o}개 이하여야 합니다.`,"TOO_MANY")}if(i&&typeof e=="string"&&!i.test(e))throw new J(s,u||`${s}의 형식이 올바르지 않습니다.`,"INVALID_FORMAT");if(c&&!c.includes(e))throw new J(s,u||`${s}은(는) 다음 중 하나여야 합니다: ${c.join(", ")}`,"INVALID_ENUM");if(l&&l(e)===!1)throw new J(s,u||`${s}의 값이 유효하지 않습니다.`,"CUSTOM_VALIDATION_FAILED")}}function bc(e,t){for(const s of t){const r=e[s.field];yc(r,s)}}function Tc(e){return async(t,s)=>{try{let r={};const a=t.req.header("content-type")||"";a.includes("application/json")?r=await t.req.json().catch(()=>({})):(a.includes("application/x-www-form-urlencoded")||a.includes("multipart/form-data"))&&(r=await t.req.parseBody().catch(()=>({})));const n=new URL(t.req.url);for(const[o,i]of n.searchParams.entries())o in r||(r[o]=i);bc(r,e),t.set("validatedData",r),await s()}catch(r){if(r instanceof J)return t.json({success:!1,error:r.message,field:r.field,code:r.code},400);throw r}}}function vc(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=255}function Sc(e){try{const t=new URL(e);return t.protocol==="http:"||t.protocol==="https:"}catch{return!1}}function wc(e){return/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e)}function xc(e){if(typeof e!="string")return!1;const t=new Date(e);return!isNaN(t.getTime())}const Rc=[{field:"email",required:!0,type:"email",max:255,message:"유효한 이메일 주소를 입력해주세요."},{field:"password",required:!0,type:"string",min:8,max:100,pattern:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:"비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다."},{field:"name",required:!0,type:"string",min:2,max:50,message:"이름은 2-50자 사이여야 합니다."},{field:"phone",required:!1,type:"phone",message:"유효한 전화번호를 입력해주세요. (예: 010-1234-5678)"}];function hr(e){const t=new URLSearchParams;for(const[s,r]of Object.entries(e))r!=null&&t.append(s,String(r));return t}function oa(e,t){if(e.result_code!=="1")throw new Error(`[Aligo ${t}] ${e.message} (code: ${e.result_code})`)}async function ia(e){console.log("[Aligo] 토큰 생성 시작");const s=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:hr({apikey:e.ALIGO_API_KEY,userid:e.ALIGO_USER_ID})})).json();return oa(s,"Token Create"),console.log("[Aligo] ✅ 토큰 생성 성공:",s.token.substring(0,20)+"..."),{token:s.token,urtime:s.urtime}}async function Ic(e,t){console.log("[Aligo] 카카오 채널 등록:",t.channelId);const{token:s}=await ia(e),a=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:hr({token:s,userid:e.ALIGO_USER_ID,plusid:t.channelId,phonenumber:t.phoneNumber})})).json();return oa(a,"Channel Register"),console.log("[Aligo] ✅ 카카오 채널 등록 성공, senderKey:",a.senderkey),{success:!0,senderKey:a.senderkey}}async function Pc(e,t,s){console.log("[Aligo] 템플릿 등록:",s.templateCode);const{token:r}=await ia(e),n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:hr({token:r,userid:e.ALIGO_USER_ID,senderkey:t,tpl_name:s.name,tpl_content:s.content,tpl_code:s.templateCode})})).json();return oa(n,"Template Register"),console.log("[Aligo] ✅ 템플릿 등록 성공:",n.tpl_code),{success:!0,templateCode:n.tpl_code}}async function ca(e,t){console.log("[Aligo] 알림톡 발송:",t.to);try{const{token:s}=await ia(e),r=t.buttons?JSON.stringify({button:t.buttons}):void 0,n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:hr({token:s,userid:e.ALIGO_USER_ID,senderkey:t.senderKey,tpl_code:t.templateCode,receiver_1:t.to,subject_1:"알림톡",message_1:t.message,button_1:r})})).json();return n.result_code!=="1"?(console.error("[Aligo] ❌ 알림톡 발송 실패:",n.message),{success:!1,error:n.message}):(console.log("[Aligo] ✅ 알림톡 발송 성공, messageId:",n.msg_id),{success:!0,messageId:n.msg_id})}catch(s){return console.error("[Aligo] ❌ 알림톡 발송 에러:",s.message),{success:!1,error:s.message}}}function Oc(e,t){let s=e;for(const[r,a]of Object.entries(t)){const n=new RegExp(`#{${r}}`,"g");s=s.replace(n,a)}return s}function mo(e){let t=e.replace(/-/g,"");if(!t.startsWith("010"))throw new Error("Invalid phone number format. Must start with 010");if(t.length!==11)throw new Error("Invalid phone number length. Must be 11 digits");return t}async function Ac(e,t){const s=await e.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(t).first();if(!s)throw new Error(`Order not found: ${t}`);const r=await e.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(t).all();return{order:s,products:r.results}}async function Cc(e,t){const s=await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(t).first();return s||(console.warn(`No active alimtalk account for seller ${t}`),null)}async function Aa(e,t){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(t.seller_id,t.template_code,t.recipient_phone,t.message,t.cost,t.status,t.order_id||null).run()}async function Dc(e,t,s){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(s,t).run()}async function kc(e,t){try{const{order:s,products:r}=await Ac(e.DB,t),a=await Cc(e.DB,s.seller_id);if(!a)return console.warn(`Skipping alimtalk for order ${t}: no active account`),{success:!1,reason:"no_account"};const n=15;if(a.balance<n)return console.warn(`Skipping alimtalk for order ${t}: insufficient balance`),{success:!1,reason:"insufficient_balance"};const o=r.map(l=>`${l.name} ${l.quantity}개 (${l.price.toLocaleString()}원)`).join(`
`),i=`[주문 확인]

주문번호: ${s.order_number}
주문일시: ${new Date(s.created_at).toLocaleString("ko-KR")}

주문 상품:
${o}

총 결제금액: ${s.total_amount.toLocaleString()}원

배송지: ${s.shipping_address}
수령인: ${s.shipping_name}
연락처: ${s.shipping_phone}

주문해 주셔서 감사합니다!`,c=await ca(e,{senderKey:a.sender_key,templateCode:"order_confirm",to:s.buyer_phone,message:i});return c.success?(await Dc(e.DB,s.seller_id,n),await Aa(e.DB,{seller_id:s.seller_id,template_code:"order_confirm",recipient_phone:s.buyer_phone,message:i,cost:n,status:"sent",order_id:t}),console.log(`Order confirmation sent for order ${t}`),{success:!0}):(await Aa(e.DB,{seller_id:s.seller_id,template_code:"order_confirm",recipient_phone:s.buyer_phone,message:i,cost:0,status:"failed",order_id:t}),console.error(`Failed to send order confirmation for order ${t}:`,c.error),{success:!1,error:c.error})}catch(s){return console.error(`Error sending order confirmation for order ${t}:`,s),{success:!1,error:s.message}}}function Nc(e,t){let s=e;return Object.entries(t).forEach(([r,a])=>{const n=new RegExp(`#{${r}}`,"g");s=s.replace(n,a)}),s}function jc(e,t){const r=Array.from(e.matchAll(/#{(\w+)}/g),a=>a[1]).filter(a=>!t[a]);return{valid:r.length===0,missingVars:r}}async function Mc(e,t,s){const r=await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(t).first();if(!r)throw new Error(`Account not found: ${t}`);return{sufficient:r.balance>=s,currentBalance:r.balance}}async function Lc(e,t,s){const r=await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(s,t,s).run();if(!r.success||r.meta.changes===0)throw new Error("Insufficient balance or account not found")}async function Ca(e,t,s){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(s,t).run()}async function Pr(e,t){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(t.accountId,t.templateId,t.orderId||null,t.recipientPhone,t.messageContent,t.status,t.cost,t.aligoMessageId||null,t.failedReason||null).run()}async function $c(e,t,s,r){await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(s,r,t).run()}async function Fc(e,t,s,r,a,n,o,i,c){try{const l={...i,...o.variables},u=Nc(r,l),d=await ca(e,{senderKey:a,templateCode:n,to:o.phone,message:u});return d.success?(await Pr(e.DB,{accountId:t,templateId:s,recipientPhone:o.phone,messageContent:u,status:"sent",cost:c,aligoMessageId:d.messageId}),{phone:o.phone,status:"sent",messageId:d.messageId,cost:c}):(await Pr(e.DB,{accountId:t,templateId:s,recipientPhone:o.phone,messageContent:u,status:"failed",cost:0,failedReason:d.error}),await Ca(e.DB,t,c),{phone:o.phone,status:"failed",error:d.error,cost:0})}catch(l){return console.error(`Failed to send alimtalk to ${o.phone}:`,l),await Pr(e.DB,{accountId:t,templateId:s,recipientPhone:o.phone,messageContent:"",status:"failed",cost:0,failedReason:l.message}),await Ca(e.DB,t,c),{phone:o.phone,status:"failed",error:l.message,cost:0}}}async function la(e,t){const{accountId:s,templateId:r,recipients:a,variables:n}=t;console.log(`[Alimtalk] Starting bulk send: ${a.length} recipients`);try{const o=await e.DB.prepare(`
      SELECT 
        id,
        sender_key,
        balance,
        status
      FROM alimtalk_accounts
      WHERE id = ?
    `).bind(s).first();if(!o)throw new Error("Account not found");if(o.status!=="active")throw new Error("Account is not active");const i=await e.DB.prepare(`
      SELECT 
        id,
        template_code,
        template_content,
        status
      FROM alimtalk_templates
      WHERE id = ? AND account_id = ?
    `).bind(r,s).first();if(!i)throw new Error("Template not found");if(i.status!=="approved")throw new Error("Template is not approved");const c=jc(i.template_content,n);if(!c.valid)throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);const l=15,u=a.length*l,d=await Mc(e.DB,s,u);if(!d.sufficient)throw new Error(`Insufficient balance. Required: ${u}, Current: ${d.currentBalance}`);await Lc(e.DB,s,u),console.log(`[Alimtalk] Deducted ${u} points from account ${s}`);const m=[];let _=0,h=0,E=0;for(const v of a){const b=await Fc(e,s,r,i.template_content,o.sender_key,i.template_code,v,n,l);m.push(b),b.status==="sent"?_++:(h++,E+=l),m.length%10===0&&await new Promise(g=>setTimeout(g,1e3))}return await $c(e.DB,s,_,h),console.log(`[Alimtalk] Completed: ${_} sent, ${h} failed, ${E} refunded`),{success:!0,totalRecipients:a.length,successCount:_,failedCount:h,refundedAmount:E,messages:m}}catch(o){return console.error("[Alimtalk] Bulk send failed:",o),{success:!1,totalRecipients:a.length,successCount:0,failedCount:a.length,refundedAmount:0,messages:[],error:o.message}}}async function Uc(e,t,s,r,a){const n=await e.DB.prepare(`
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
  `).bind(r).all()).results.map(u=>`${u.name} ${u.quantity}개 (${u.price.toLocaleString()}원)`).join(`
`),c={orderNumber:n.order_number,orderDate:new Date(n.created_at).toLocaleString("ko-KR"),productList:i,totalAmount:n.total_amount.toLocaleString(),shippingAddress:n.shipping_address,shippingName:n.shipping_name,shippingPhone:n.shipping_phone,buyerName:n.buyer_name,customMessage:a||"감사합니다!"},l=[{phone:n.buyer_phone,name:n.buyer_name}];return la(e,{accountId:t,templateId:s,recipients:l,variables:c})}async function qc(e,t,s,r,a={}){const n=r.map(o=>({phone:o.phone,name:o.name,variables:Object.entries(o).filter(([i])=>i!=="phone"&&i!=="name").reduce((i,[c,l])=>({...i,[c]:l}),{})}));return la(e,{accountId:t,templateId:s,recipients:n,variables:a})}function Hc(e,t=.1){return Math.floor(e*t)}function Wc(){const e=new Date,t=new Date(e.getFullYear(),e.getMonth()-1,1),s=t.getFullYear(),r=String(t.getMonth()+1).padStart(2,"0"),a=new Date(s,t.getMonth()+1,0).getDate();return{startDate:`${s}-${r}-01`,endDate:`${s}-${r}-${a}`}}async function Bc(e,t,s){try{const r=await e.prepare(`
      SELECT id, business_name FROM sellers WHERE id = ?
    `).bind(t).first();if(!r)return null;const a=await e.prepare(`
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
    `).bind(t,s.startDate,s.endDate).all();if(!a.results||a.results.length===0)return{seller_id:t,seller_name:r.business_name,total_sales:0,total_orders:0,platform_fee:0,shipping_fee:0,refund_amount:0,settlement_amount:0,orders:[]};const n=[];let o=0,i=0,c=0;for(const m of a.results){const _=m.total_amount-m.shipping_fee,h=Hc(_);n.push({order_id:m.id,order_number:m.order_number,order_date:m.created_at,product_name:m.product_names||"",quantity:m.total_quantity||1,price:_,shipping_fee:m.shipping_fee||0,platform_fee:h,status:m.status}),o+=_,i+=m.shipping_fee||0,c+=h}const l=await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(t,s.startDate,s.endDate).first(),u=(l==null?void 0:l.refund_amount)||0,d=o-c-u+i;return{seller_id:t,seller_name:r.business_name,total_sales:o,total_orders:n.length,platform_fee:c,shipping_fee:i,refund_amount:u,settlement_amount:d,orders:n}}catch(r){return console.error(`Failed to calculate settlement for seller ${t}:`,r),null}}async function Kc(e,t){console.log(`[Settlement] Generating report for ${t.startDate} ~ ${t.endDate}`);const s=await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(t.startDate,t.endDate).all(),r=[];let a=0,n=0,o=0;for(const c of s.results){const l=await Bc(e,c.id,t);l&&(r.push(l),a+=l.total_sales,n+=l.platform_fee,o+=l.settlement_amount)}const i={period:t,generated_at:new Date().toISOString(),total_sales:a,total_platform_fee:n,total_settlement:o,sellers:r};return console.log(`[Settlement] Report generated: ${r.length} sellers, ${a.toLocaleString()}원`),i}async function Gc(e,t){const r=(await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(t.period.startDate,t.period.endDate,t.total_sales,t.total_platform_fee,t.total_settlement,t.generated_at).run()).meta.last_row_id;for(const a of t.sellers)await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a.seller_id,a.total_sales,a.total_orders,a.platform_fee,a.shipping_fee,a.refund_amount,a.settlement_amount).run();console.log(`[Settlement] Report saved: ID ${r}`)}async function Vc(e,t){const s=await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(t).first();if(!s)return null;const a=(await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(t).all()).results.map(n=>({seller_id:n.seller_id,seller_name:n.seller_name,total_sales:n.total_sales,total_orders:n.total_orders,platform_fee:n.platform_fee,shipping_fee:n.shipping_fee,refund_amount:n.refund_amount,settlement_amount:n.settlement_amount,orders:[]}));return{period:{startDate:s.period_start,endDate:s.period_end},generated_at:s.generated_at,total_sales:s.total_sales,total_platform_fee:s.total_platform_fee,total_settlement:s.total_settlement,sellers:a}}async function Jc(e,t){const s=new TextEncoder;let r;const a=new ReadableStream({async start(n){console.log(`[SSE] Client connected to stream ${e}`);try{const o=await t.DB.prepare(`
          SELECT 
            id,
            title,
            status,
            viewer_count,
            like_count
          FROM live_streams
          WHERE id = ?
        `).bind(e).first();if(o){const i={type:"status",data:o,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(s.encode(`data: ${c}

`))}}catch(o){console.error("[SSE] Failed to fetch initial data:",o)}r=setInterval(async()=>{try{const o=await t.DB.prepare(`
            SELECT 
              viewer_count,
              like_count,
              comment_count
            FROM live_streams
            WHERE id = ?
          `).bind(e).first();if(o){const i={type:"viewer_count",data:o,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(s.encode(`data: ${c}

`))}n.enqueue(s.encode(`: ping

`))}catch(o){console.error("[SSE] Update failed:",o)}},3e4)},cancel(){console.log(`[SSE] Client disconnected from stream ${e}`),r&&clearInterval(r)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Yc(e,t){const s=new TextEncoder;let r=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Chat] Client connected to stream ${e}`);try{const i=await t.DB.prepare(`
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
        `).bind(e).all();if(i.results.length>0){r=i.results[0].id;const c={type:"chat",data:i.results.reverse(),timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(s.encode(`data: ${l}

`))}}catch(i){console.error("[SSE Chat] Failed to fetch initial messages:",i)}a=setInterval(async()=>{try{const i=await t.DB.prepare(`
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
          `).bind(e,r).all();if(i.results.length>0){r=i.results[i.results.length-1].id;const c={type:"chat",data:i.results,timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(s.encode(`data: ${l}

`))}else o.enqueue(s.encode(`: ping

`))}catch(i){console.error("[SSE Chat] Polling failed:",i)}},5e3)},cancel(){console.log(`[SSE Chat] Client disconnected from stream ${e}`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function zc(e,t){const s=new TextEncoder;let r=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Orders] Seller ${e} connected`);try{const i=await t.DB.prepare(`
          SELECT id FROM orders
          WHERE seller_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).bind(e).first();i&&(r=i.id)}catch(i){console.error("[SSE Orders] Failed to fetch last order:",i)}a=setInterval(async()=>{try{const i=await t.DB.prepare(`
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
          `).bind(e,r).all();if(i.results.length>0){r=i.results[i.results.length-1].id;const c={type:"order",data:i.results,timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(s.encode(`data: ${l}

`))}else o.enqueue(s.encode(`: ping

`))}catch(i){console.error("[SSE Orders] Polling failed:",i)}},1e4)},cancel(){console.log(`[SSE Orders] Seller ${e} disconnected`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Xc(e,t){const s=new TextEncoder;let r;const a=new ReadableStream({async start(n){console.log(`[SSE Stock] Seller ${e} connected`),r=setInterval(async()=>{try{const o=await t.DB.prepare(`
            SELECT 
              id,
              name,
              stock,
              low_stock_threshold
            FROM products
            WHERE seller_id = ?
              AND stock <= low_stock_threshold
              AND stock > 0
          `).bind(e).all();if(o.results.length>0){const i={type:"stock",data:o.results,timestamp:new Date().toISOString()},c=JSON.stringify(i);n.enqueue(s.encode(`data: ${c}

`))}else n.enqueue(s.encode(`: ping

`))}catch(o){console.error("[SSE Stock] Polling failed:",o)}},6e4)},cancel(){console.log(`[SSE Stock] Seller ${e} disconnected`),r&&clearInterval(r)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Qc(e,t,s,r){await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(t,s,r.endpoint,r.keys.p256dh,r.keys.auth).run(),console.log(`[Push] Subscription saved for ${s} ${t}`)}async function Zc(e,t){await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(t).run(),console.log(`[Push] Subscription deleted: ${t}`)}function el(e){if(e.req.method!=="GET")return!1;const t=e.req.header("Authorization"),s=e.req.header("X-Session-Token");if(t||s)return!1;const a=new URL(e.req.url).pathname;return!(a.includes("/api/products/")&&a.includes("/stock")||a.includes("/api/streams/")&&a.includes("/status")||a.includes("/current-product")||a.includes("/api/chat")||a.includes("/api/sse")||a.includes("/api/orders")||a.includes("/api/payment"))}function tl(e,t){return t||new URL(e.req.url).toString()}function sl(e){const t=[];return t.push("public"),t.push(`max-age=${e.ttl}`),e.sMaxAge!==void 0?t.push(`s-maxage=${e.sMaxAge}`):t.push(`s-maxage=${e.ttl}`),e.staleWhileRevalidate&&t.push(`stale-while-revalidate=${e.staleWhileRevalidate}`),t.join(", ")}function _r(e){return async(t,s)=>{var i;if(e.skipCache||!el(t))return s();const r=tl(t,e.cacheKey),a=caches.default;let n=await a.match(r);if(n){console.log(`[Cache HIT] ${r}`);const c=new Headers(n.headers);return c.set("X-Cache","HIT"),c.set("X-Cache-Key",r),new Response(n.body,{status:n.status,statusText:n.statusText,headers:c})}console.log(`[Cache MISS] ${r}`),await s();const o=t.res;if(o.status>=200&&o.status<300){const c=sl(e);o.headers.set("Cache-Control",c),o.headers.set("X-Cache","MISS"),o.headers.set("X-Cache-Key",r);const l=e.varyBy||["Accept-Encoding"];o.headers.set("Vary",l.join(", "));const u=o.clone();(i=t.executionCtx)==null||i.waitUntil(a.put(r,u))}}}const Er={products:{ttl:10,sMaxAge:60,staleWhileRevalidate:120},liveStreams:{ttl:5,sMaxAge:10,staleWhileRevalidate:30},microCache:{ttl:10,sMaxAge:10,staleWhileRevalidate:30}};class rl extends Error{constructor(t,s,r,a){super(r),this.statusCode=t,this.code=s,this.details=a,this.name="AppError",Error.captureStackTrace(this,this.constructor)}}async function al(e,t,s,r){if(e)try{const a={title:`✅ ${t}`,description:s,color:3066993,fields:[],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Monitor"}};if(r)for(const[n,o]of Object.entries(r))a.fields.push({name:n,value:String(o),inline:!0});await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[a]})})}catch(a){console.error("[Discord] Failed to send success alert:",a)}}async function nl(e,t,s){if(e)try{const r=["📊 **KV 사용량 경고**","","현재 사용량:",`• 읽기: ${t.toFixed(1)}%`,`• 쓰기: ${s.toFixed(1)}%`,"","50% 이상 사용 중입니다. 유료 플랜 업그레이드를 고려하세요.","https://dash.cloudflare.com"].join(`
`);await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:r})})}catch(r){console.error("[Discord] Failed to send KV warning:",r)}}class fo{constructor(t){this.accessToken=null,this.tokenExpiry=0,this.databaseURL=t.FIREBASE_DATABASE_URL,this.projectId=t.FIREBASE_PROJECT_ID,this.privateKey=t.FIREBASE_PRIVATE_KEY,this.clientEmail=t.FIREBASE_CLIENT_EMAIL,(!this.databaseURL||!this.projectId||!this.privateKey||!this.clientEmail)&&console.warn("⚠️ Firebase Admin credentials not configured, using unauthenticated mode")}async set(t,s){const r=`${this.databaseURL}/${t}.json`,a=await fetch(r,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)});if(!a.ok){const n=await a.text();throw console.error(`❌ Firebase set failed for ${t}:`,n),new Error(`Firebase set failed: ${a.statusText}`)}console.log(`✅ Firebase: Set data at ${t}`)}async update(t,s){const r=`${this.databaseURL}/${t}.json`,a=await fetch(r,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)});if(!a.ok){const n=await a.text();throw console.error(`❌ Firebase update failed for ${t}:`,n),new Error(`Firebase update failed: ${a.statusText}`)}console.log(`✅ Firebase: Updated data at ${t}`)}async get(t){const s=`${this.databaseURL}/${t}.json`,r=await fetch(s,{method:"GET"});if(!r.ok)throw new Error(`Firebase get failed: ${r.statusText}`);return await r.json()}async delete(t){const s=`${this.databaseURL}/${t}.json`,r=await fetch(s,{method:"DELETE"});if(!r.ok)throw new Error(`Firebase delete failed: ${r.statusText}`);console.log(`✅ Firebase: Deleted data at ${t}`)}async updateStreamStatus(t,s){try{await this.update(`streams/stream${t}`,{...s,updated_at:Date.now()}),console.log(`✅ Firebase: Stream ${t} updated`,s)}catch(r){console.error(`❌ Firebase: Failed to update stream ${t}`,r)}}async updateProductStock(t,s,r){try{await this.update(`products/product${t}`,{id:t,stock:s,...r,updated_at:Date.now()}),console.log(`✅ Firebase: Product ${t} stock updated to ${s}`)}catch(a){console.error(`❌ Firebase: Failed to update product ${t}`,a)}}async changeCurrentProduct(t,s){try{await this.updateStreamStatus(t,{current_product_id:s}),console.log(`✅ Firebase: Stream ${t} current product changed to ${s}`)}catch(r){console.error(`❌ Firebase: Failed to change product for stream ${t}`,r)}}async sendLowStockAlert(t,s,r){try{const a=`chats/stream${t}`,n=Date.now();await this.set(`${a}/alert_${n}`,{username:"시스템",text:`⚠️ ${s}의 재고가 ${r}개 남았습니다!`,timestamp:n,isSystem:!0}),console.log(`✅ Firebase: Low stock alert sent for stream ${t}`)}catch(a){console.error("❌ Firebase: Failed to send low stock alert",a)}}async sendSoldOutAlert(t,s){try{const r=`chats/stream${t}`,a=Date.now();await this.set(`${r}/soldout_${a}`,{username:"시스템",text:`🔴 ${s}이(가) 품절되었습니다!`,timestamp:a,isSystem:!0}),console.log(`✅ Firebase: Sold out alert sent for stream ${t}`)}catch(r){console.error("❌ Firebase: Failed to send sold out alert",r)}}async createCustomToken(t,s){try{if(console.log(`[Firebase Custom Token] Creating for UID: ${t}`),console.log("[Firebase Custom Token] Claims:",JSON.stringify(s)),!this.privateKey||!this.clientEmail||!this.projectId){const b=[];throw this.privateKey||b.push("FIREBASE_PRIVATE_KEY"),this.clientEmail||b.push("FIREBASE_CLIENT_EMAIL"),this.projectId||b.push("FIREBASE_PROJECT_ID"),new Error(`Firebase credentials not configured: missing ${b.join(", ")}`)}console.log(`[Firebase Custom Token] Using project: ${this.projectId}`),console.log(`[Firebase Custom Token] Using service account: ${this.clientEmail}`);const r={alg:"RS256",typ:"JWT"},a=Math.floor(Date.now()/1e3),n={iss:this.clientEmail,sub:this.clientEmail,aud:"https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",iat:a,exp:a+3600,uid:t,claims:s||{}},o=b=>{const g=JSON.stringify(b),S=new TextEncoder().encode(g);let y="";for(let k=0;k<S.length;k++)y+=String.fromCharCode(S[k]);return btoa(y).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")};console.log("[Firebase Custom Token] Encoding header and payload...");const i=o(r),c=o(n),l=`${i}.${c}`;console.log("[Firebase Custom Token] Parsing private key...");const u=this.privateKey.replace(/\\n/g,`
`);if(!u.includes("-----BEGIN PRIVATE KEY-----"))throw new Error("Invalid private key format: missing PEM header");if(!u.includes("-----END PRIVATE KEY-----"))throw new Error("Invalid private key format: missing PEM footer");console.log("[Firebase Custom Token] Converting PEM to DER...");const d=await this.pemToDer(u);console.log("[Firebase Custom Token] Importing crypto key...");const m=await crypto.subtle.importKey("pkcs8",d,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},!1,["sign"]);console.log("[Firebase Custom Token] Signing token...");const _=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",m,new TextEncoder().encode(l)),E=btoa(String.fromCharCode(...new Uint8Array(_))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,""),v=`${l}.${E}`;return console.log("[Firebase Custom Token] ✅ Token created successfully"),v}catch(r){throw console.error("[Firebase Custom Token] ❌ Failed to create token:",r),console.error("[Firebase Custom Token] Error name:",r.name),console.error("[Firebase Custom Token] Error message:",r.message),console.error("[Firebase Custom Token] Error stack:",r.stack),new Error(`Failed to create Firebase custom token: ${r.message}`)}}async pemToDer(t){const a=t.substring("-----BEGIN PRIVATE KEY-----".length,t.length-"-----END PRIVATE KEY-----".length-1).trim(),n=atob(a),o=new Uint8Array(n.length);for(let i=0;i<n.length;i++)o[i]=n.charCodeAt(i);return o.buffer}}function Lt(e){return new fo(e)}async function ol(e,t,s){try{t==="stream"?await e.updateStreamStatus(s.id,{id:s.id,title:s.title,status:s.status,current_product_id:s.current_product_id,viewer_count:s.viewer_count||0,seller_id:s.seller_id,youtube_video_id:s.youtube_video_id}):t==="product"&&await e.updateProductStock(s.id,s.stock,{name:s.name,price:s.price,original_price:s.original_price,discount_rate:s.discount_rate,image_url:s.image_url})}catch(r){console.error(`❌ Firebase sync failed for ${t}:`,r)}}const il=Object.freeze(Object.defineProperty({__proto__:null,FirebaseAdmin:fo,initFirebaseAdmin:Lt,syncD1ToFirebase:ol},Symbol.toStringTag,{value:"Module"})),ua=crypto,ho=e=>e instanceof CryptoKey,As=new TextEncoder,gr=new TextDecoder;function cl(...e){const t=e.reduce((a,{length:n})=>a+n,0),s=new Uint8Array(t);let r=0;for(const a of e)s.set(a,r),r+=a.length;return s}const ll=e=>{const t=atob(e),s=new Uint8Array(t.length);for(let r=0;r<t.length;r++)s[r]=t.charCodeAt(r);return s},ot=e=>{let t=e;t instanceof Uint8Array&&(t=gr.decode(t)),t=t.replace(/-/g,"+").replace(/_/g,"/").replace(/\s/g,"");try{return ll(t)}catch{throw new TypeError("The input to be decoded is not correctly encoded.")}};class se extends Error{constructor(t,s){var r;super(t,s),this.code="ERR_JOSE_GENERIC",this.name=this.constructor.name,(r=Error.captureStackTrace)==null||r.call(Error,this,this.constructor)}}se.code="ERR_JOSE_GENERIC";class _e extends se{constructor(t,s,r="unspecified",a="unspecified"){super(t,{cause:{claim:r,reason:a,payload:s}}),this.code="ERR_JWT_CLAIM_VALIDATION_FAILED",this.claim=r,this.reason=a,this.payload=s}}_e.code="ERR_JWT_CLAIM_VALIDATION_FAILED";class hs extends se{constructor(t,s,r="unspecified",a="unspecified"){super(t,{cause:{claim:r,reason:a,payload:s}}),this.code="ERR_JWT_EXPIRED",this.claim=r,this.reason=a,this.payload=s}}hs.code="ERR_JWT_EXPIRED";class _o extends se{constructor(){super(...arguments),this.code="ERR_JOSE_ALG_NOT_ALLOWED"}}_o.code="ERR_JOSE_ALG_NOT_ALLOWED";class xe extends se{constructor(){super(...arguments),this.code="ERR_JOSE_NOT_SUPPORTED"}}xe.code="ERR_JOSE_NOT_SUPPORTED";class ul extends se{constructor(t="decryption operation failed",s){super(t,s),this.code="ERR_JWE_DECRYPTION_FAILED"}}ul.code="ERR_JWE_DECRYPTION_FAILED";class dl extends se{constructor(){super(...arguments),this.code="ERR_JWE_INVALID"}}dl.code="ERR_JWE_INVALID";class Q extends se{constructor(){super(...arguments),this.code="ERR_JWS_INVALID"}}Q.code="ERR_JWS_INVALID";class xs extends se{constructor(){super(...arguments),this.code="ERR_JWT_INVALID"}}xs.code="ERR_JWT_INVALID";class pl extends se{constructor(){super(...arguments),this.code="ERR_JWK_INVALID"}}pl.code="ERR_JWK_INVALID";class da extends se{constructor(){super(...arguments),this.code="ERR_JWKS_INVALID"}}da.code="ERR_JWKS_INVALID";class pa extends se{constructor(t="no applicable key found in the JSON Web Key Set",s){super(t,s),this.code="ERR_JWKS_NO_MATCHING_KEY"}}pa.code="ERR_JWKS_NO_MATCHING_KEY";class Eo extends se{constructor(t="multiple matching keys found in the JSON Web Key Set",s){super(t,s),this.code="ERR_JWKS_MULTIPLE_MATCHING_KEYS"}}Eo.code="ERR_JWKS_MULTIPLE_MATCHING_KEYS";class go extends se{constructor(t="request timed out",s){super(t,s),this.code="ERR_JWKS_TIMEOUT"}}go.code="ERR_JWKS_TIMEOUT";class yo extends se{constructor(t="signature verification failed",s){super(t,s),this.code="ERR_JWS_SIGNATURE_VERIFICATION_FAILED"}}yo.code="ERR_JWS_SIGNATURE_VERIFICATION_FAILED";function ve(e,t="algorithm.name"){return new TypeError(`CryptoKey does not support this operation, its ${t} must be ${e}`)}function Wt(e,t){return e.name===t}function Or(e){return parseInt(e.name.slice(4),10)}function ml(e){switch(e){case"ES256":return"P-256";case"ES384":return"P-384";case"ES512":return"P-521";default:throw new Error("unreachable")}}function fl(e,t){if(t.length&&!t.some(s=>e.usages.includes(s))){let s="CryptoKey does not support this operation, its usages must include ";if(t.length>2){const r=t.pop();s+=`one of ${t.join(", ")}, or ${r}.`}else t.length===2?s+=`one of ${t[0]} or ${t[1]}.`:s+=`${t[0]}.`;throw new TypeError(s)}}function hl(e,t,...s){switch(t){case"HS256":case"HS384":case"HS512":{if(!Wt(e.algorithm,"HMAC"))throw ve("HMAC");const r=parseInt(t.slice(2),10);if(Or(e.algorithm.hash)!==r)throw ve(`SHA-${r}`,"algorithm.hash");break}case"RS256":case"RS384":case"RS512":{if(!Wt(e.algorithm,"RSASSA-PKCS1-v1_5"))throw ve("RSASSA-PKCS1-v1_5");const r=parseInt(t.slice(2),10);if(Or(e.algorithm.hash)!==r)throw ve(`SHA-${r}`,"algorithm.hash");break}case"PS256":case"PS384":case"PS512":{if(!Wt(e.algorithm,"RSA-PSS"))throw ve("RSA-PSS");const r=parseInt(t.slice(2),10);if(Or(e.algorithm.hash)!==r)throw ve(`SHA-${r}`,"algorithm.hash");break}case"EdDSA":{if(e.algorithm.name!=="Ed25519"&&e.algorithm.name!=="Ed448")throw ve("Ed25519 or Ed448");break}case"Ed25519":{if(!Wt(e.algorithm,"Ed25519"))throw ve("Ed25519");break}case"ES256":case"ES384":case"ES512":{if(!Wt(e.algorithm,"ECDSA"))throw ve("ECDSA");const r=ml(t);if(e.algorithm.namedCurve!==r)throw ve(r,"algorithm.namedCurve");break}default:throw new TypeError("CryptoKey does not support this operation")}fl(e,s)}function bo(e,t,...s){var r;if(s=s.filter(Boolean),s.length>2){const a=s.pop();e+=`one of type ${s.join(", ")}, or ${a}.`}else s.length===2?e+=`one of type ${s[0]} or ${s[1]}.`:e+=`of type ${s[0]}.`;return t==null?e+=` Received ${t}`:typeof t=="function"&&t.name?e+=` Received function ${t.name}`:typeof t=="object"&&t!=null&&(r=t.constructor)!=null&&r.name&&(e+=` Received an instance of ${t.constructor.name}`),e}const Da=(e,...t)=>bo("Key must be ",e,...t);function To(e,t,...s){return bo(`Key for the ${e} algorithm must be `,t,...s)}const vo=e=>ho(e)?!0:(e==null?void 0:e[Symbol.toStringTag])==="KeyObject",cr=["CryptoKey"],_l=(...e)=>{const t=e.filter(Boolean);if(t.length===0||t.length===1)return!0;let s;for(const r of t){const a=Object.keys(r);if(!s||s.size===0){s=new Set(a);continue}for(const n of a){if(s.has(n))return!1;s.add(n)}}return!0};function El(e){return typeof e=="object"&&e!==null}function Ke(e){if(!El(e)||Object.prototype.toString.call(e)!=="[object Object]")return!1;if(Object.getPrototypeOf(e)===null)return!0;let t=e;for(;Object.getPrototypeOf(t)!==null;)t=Object.getPrototypeOf(t);return Object.getPrototypeOf(e)===t}const gl=(e,t)=>{if(e.startsWith("RS")||e.startsWith("PS")){const{modulusLength:s}=t.algorithm;if(typeof s!="number"||s<2048)throw new TypeError(`${e} requires key modulusLength to be 2048 bits or larger`)}};function $t(e){return Ke(e)&&typeof e.kty=="string"}function yl(e){return e.kty!=="oct"&&typeof e.d=="string"}function bl(e){return e.kty!=="oct"&&typeof e.d>"u"}function Tl(e){return $t(e)&&e.kty==="oct"&&typeof e.k=="string"}function vl(e){let t,s;switch(e.kty){case"RSA":{switch(e.alg){case"PS256":case"PS384":case"PS512":t={name:"RSA-PSS",hash:`SHA-${e.alg.slice(-3)}`},s=e.d?["sign"]:["verify"];break;case"RS256":case"RS384":case"RS512":t={name:"RSASSA-PKCS1-v1_5",hash:`SHA-${e.alg.slice(-3)}`},s=e.d?["sign"]:["verify"];break;case"RSA-OAEP":case"RSA-OAEP-256":case"RSA-OAEP-384":case"RSA-OAEP-512":t={name:"RSA-OAEP",hash:`SHA-${parseInt(e.alg.slice(-3),10)||1}`},s=e.d?["decrypt","unwrapKey"]:["encrypt","wrapKey"];break;default:throw new xe('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}case"EC":{switch(e.alg){case"ES256":t={name:"ECDSA",namedCurve:"P-256"},s=e.d?["sign"]:["verify"];break;case"ES384":t={name:"ECDSA",namedCurve:"P-384"},s=e.d?["sign"]:["verify"];break;case"ES512":t={name:"ECDSA",namedCurve:"P-521"},s=e.d?["sign"]:["verify"];break;case"ECDH-ES":case"ECDH-ES+A128KW":case"ECDH-ES+A192KW":case"ECDH-ES+A256KW":t={name:"ECDH",namedCurve:e.crv},s=e.d?["deriveBits"]:[];break;default:throw new xe('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}case"OKP":{switch(e.alg){case"Ed25519":t={name:"Ed25519"},s=e.d?["sign"]:["verify"];break;case"EdDSA":t={name:e.crv},s=e.d?["sign"]:["verify"];break;case"ECDH-ES":case"ECDH-ES+A128KW":case"ECDH-ES+A192KW":case"ECDH-ES+A256KW":t={name:e.crv},s=e.d?["deriveBits"]:[];break;default:throw new xe('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}default:throw new xe('Invalid or unsupported JWK "kty" (Key Type) Parameter value')}return{algorithm:t,keyUsages:s}}const So=async e=>{if(!e.alg)throw new TypeError('"alg" argument is required when "jwk.alg" is not present');const{algorithm:t,keyUsages:s}=vl(e),r=[t,e.ext??!1,e.key_ops??s],a={...e};return delete a.alg,delete a.use,ua.subtle.importKey("jwk",a,...r)},wo=e=>ot(e);let mt,ft;const xo=e=>(e==null?void 0:e[Symbol.toStringTag])==="KeyObject",lr=async(e,t,s,r,a=!1)=>{let n=e.get(t);if(n!=null&&n[r])return n[r];const o=await So({...s,alg:r});return a&&Object.freeze(t),n?n[r]=o:e.set(t,{[r]:o}),o},Sl=(e,t)=>{if(xo(e)){let s=e.export({format:"jwk"});return delete s.d,delete s.dp,delete s.dq,delete s.p,delete s.q,delete s.qi,s.k?wo(s.k):(ft||(ft=new WeakMap),lr(ft,e,s,t))}return $t(e)?e.k?ot(e.k):(ft||(ft=new WeakMap),lr(ft,e,e,t,!0)):e},wl=(e,t)=>{if(xo(e)){let s=e.export({format:"jwk"});return s.k?wo(s.k):(mt||(mt=new WeakMap),lr(mt,e,s,t))}return $t(e)?e.k?ot(e.k):(mt||(mt=new WeakMap),lr(mt,e,e,t,!0)):e},xl={normalizePublicKey:Sl,normalizePrivateKey:wl};async function Ro(e,t){if(!Ke(e))throw new TypeError("JWK must be an object");switch(t||(t=e.alg),e.kty){case"oct":if(typeof e.k!="string"||!e.k)throw new TypeError('missing "k" (Key Value) Parameter value');return ot(e.k);case"RSA":if("oth"in e&&e.oth!==void 0)throw new xe('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');case"EC":case"OKP":return So({...e,alg:t});default:throw new xe('Unsupported "kty" (Key Type) Parameter value')}}const Pt=e=>e==null?void 0:e[Symbol.toStringTag],Xr=(e,t,s)=>{var r,a;if(t.use!==void 0&&t.use!=="sig")throw new TypeError("Invalid key for this operation, when present its use must be sig");if(t.key_ops!==void 0&&((a=(r=t.key_ops).includes)==null?void 0:a.call(r,s))!==!0)throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${s}`);if(t.alg!==void 0&&t.alg!==e)throw new TypeError(`Invalid key for this operation, when present its alg must be ${e}`);return!0},Rl=(e,t,s,r)=>{if(!(t instanceof Uint8Array)){if(r&&$t(t)){if(Tl(t)&&Xr(e,t,s))return;throw new TypeError('JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present')}if(!vo(t))throw new TypeError(To(e,t,...cr,"Uint8Array",r?"JSON Web Key":null));if(t.type!=="secret")throw new TypeError(`${Pt(t)} instances for symmetric algorithms must be of type "secret"`)}},Il=(e,t,s,r)=>{if(r&&$t(t))switch(s){case"sign":if(yl(t)&&Xr(e,t,s))return;throw new TypeError("JSON Web Key for this operation be a private JWK");case"verify":if(bl(t)&&Xr(e,t,s))return;throw new TypeError("JSON Web Key for this operation be a public JWK")}if(!vo(t))throw new TypeError(To(e,t,...cr,r?"JSON Web Key":null));if(t.type==="secret")throw new TypeError(`${Pt(t)} instances for asymmetric algorithms must not be of type "secret"`);if(s==="sign"&&t.type==="public")throw new TypeError(`${Pt(t)} instances for asymmetric algorithm signing must be of type "private"`);if(s==="decrypt"&&t.type==="public")throw new TypeError(`${Pt(t)} instances for asymmetric algorithm decryption must be of type "private"`);if(t.algorithm&&s==="verify"&&t.type==="private")throw new TypeError(`${Pt(t)} instances for asymmetric algorithm verifying must be of type "public"`);if(t.algorithm&&s==="encrypt"&&t.type==="private")throw new TypeError(`${Pt(t)} instances for asymmetric algorithm encryption must be of type "public"`)};function Io(e,t,s,r){t.startsWith("HS")||t==="dir"||t.startsWith("PBES2")||/^A\d{3}(?:GCM)?KW$/.test(t)?Rl(t,s,r,e):Il(t,s,r,e)}Io.bind(void 0,!1);const ka=Io.bind(void 0,!0);function Pl(e,t,s,r,a){if(a.crit!==void 0&&(r==null?void 0:r.crit)===void 0)throw new e('"crit" (Critical) Header Parameter MUST be integrity protected');if(!r||r.crit===void 0)return new Set;if(!Array.isArray(r.crit)||r.crit.length===0||r.crit.some(o=>typeof o!="string"||o.length===0))throw new e('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');let n;s!==void 0?n=new Map([...Object.entries(s),...t.entries()]):n=t;for(const o of r.crit){if(!n.has(o))throw new xe(`Extension Header Parameter "${o}" is not recognized`);if(a[o]===void 0)throw new e(`Extension Header Parameter "${o}" is missing`);if(n.get(o)&&r[o]===void 0)throw new e(`Extension Header Parameter "${o}" MUST be integrity protected`)}return new Set(r.crit)}const Ol=(e,t)=>{if(t!==void 0&&(!Array.isArray(t)||t.some(s=>typeof s!="string")))throw new TypeError(`"${e}" option must be an array of strings`);if(t)return new Set(t)};function Al(e,t){const s=`SHA-${e.slice(-3)}`;switch(e){case"HS256":case"HS384":case"HS512":return{hash:s,name:"HMAC"};case"PS256":case"PS384":case"PS512":return{hash:s,name:"RSA-PSS",saltLength:e.slice(-3)>>3};case"RS256":case"RS384":case"RS512":return{hash:s,name:"RSASSA-PKCS1-v1_5"};case"ES256":case"ES384":case"ES512":return{hash:s,name:"ECDSA",namedCurve:t.namedCurve};case"Ed25519":return{name:"Ed25519"};case"EdDSA":return{name:t.name};default:throw new xe(`alg ${e} is not supported either by JOSE or your javascript runtime`)}}async function Cl(e,t,s){if(t=await xl.normalizePublicKey(t,e),ho(t))return hl(t,e,s),t;if(t instanceof Uint8Array){if(!e.startsWith("HS"))throw new TypeError(Da(t,...cr));return ua.subtle.importKey("raw",t,{hash:`SHA-${e.slice(-3)}`,name:"HMAC"},!1,[s])}throw new TypeError(Da(t,...cr,"Uint8Array","JSON Web Key"))}const Dl=async(e,t,s,r)=>{const a=await Cl(e,t,"verify");gl(e,a);const n=Al(e,a.algorithm);try{return await ua.subtle.verify(n,a,s,r)}catch{return!1}};async function kl(e,t,s){if(!Ke(e))throw new Q("Flattened JWS must be an object");if(e.protected===void 0&&e.header===void 0)throw new Q('Flattened JWS must have either of the "protected" or "header" members');if(e.protected!==void 0&&typeof e.protected!="string")throw new Q("JWS Protected Header incorrect type");if(e.payload===void 0)throw new Q("JWS Payload missing");if(typeof e.signature!="string")throw new Q("JWS Signature missing or incorrect type");if(e.header!==void 0&&!Ke(e.header))throw new Q("JWS Unprotected Header incorrect type");let r={};if(e.protected)try{const E=ot(e.protected);r=JSON.parse(gr.decode(E))}catch{throw new Q("JWS Protected Header is invalid")}if(!_l(r,e.header))throw new Q("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");const a={...r,...e.header},n=Pl(Q,new Map([["b64",!0]]),s==null?void 0:s.crit,r,a);let o=!0;if(n.has("b64")&&(o=r.b64,typeof o!="boolean"))throw new Q('The "b64" (base64url-encode payload) Header Parameter must be a boolean');const{alg:i}=a;if(typeof i!="string"||!i)throw new Q('JWS "alg" (Algorithm) Header Parameter missing or invalid');const c=s&&Ol("algorithms",s.algorithms);if(c&&!c.has(i))throw new _o('"alg" (Algorithm) Header Parameter value not allowed');if(o){if(typeof e.payload!="string")throw new Q("JWS Payload must be a string")}else if(typeof e.payload!="string"&&!(e.payload instanceof Uint8Array))throw new Q("JWS Payload must be a string or an Uint8Array instance");let l=!1;typeof t=="function"?(t=await t(r,e),l=!0,ka(i,t,"verify"),$t(t)&&(t=await Ro(t,i))):ka(i,t,"verify");const u=cl(As.encode(e.protected??""),As.encode("."),typeof e.payload=="string"?As.encode(e.payload):e.payload);let d;try{d=ot(e.signature)}catch{throw new Q("Failed to base64url decode the signature")}if(!await Dl(i,t,d,u))throw new yo;let _;if(o)try{_=ot(e.payload)}catch{throw new Q("Failed to base64url decode the payload")}else typeof e.payload=="string"?_=As.encode(e.payload):_=e.payload;const h={payload:_};return e.protected!==void 0&&(h.protectedHeader=r),e.header!==void 0&&(h.unprotectedHeader=e.header),l?{...h,key:t}:h}async function Nl(e,t,s){if(e instanceof Uint8Array&&(e=gr.decode(e)),typeof e!="string")throw new Q("Compact JWS must be a string or Uint8Array");const{0:r,1:a,2:n,length:o}=e.split(".");if(o!==3)throw new Q("Invalid Compact JWS");const i=await kl({payload:a,protected:r,signature:n},t,s),c={payload:i.payload,protectedHeader:i.protectedHeader};return typeof t=="function"?{...c,key:i.key}:c}const jl=e=>Math.floor(e.getTime()/1e3),Po=60,Oo=Po*60,ma=Oo*24,Ml=ma*7,Ll=ma*365.25,$l=/^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i,Na=e=>{const t=$l.exec(e);if(!t||t[4]&&t[1])throw new TypeError("Invalid time period format");const s=parseFloat(t[2]),r=t[3].toLowerCase();let a;switch(r){case"sec":case"secs":case"second":case"seconds":case"s":a=Math.round(s);break;case"minute":case"minutes":case"min":case"mins":case"m":a=Math.round(s*Po);break;case"hour":case"hours":case"hr":case"hrs":case"h":a=Math.round(s*Oo);break;case"day":case"days":case"d":a=Math.round(s*ma);break;case"week":case"weeks":case"w":a=Math.round(s*Ml);break;default:a=Math.round(s*Ll);break}return t[1]==="-"||t[4]==="ago"?-a:a},ja=e=>e.toLowerCase().replace(/^application\//,""),Fl=(e,t)=>typeof e=="string"?t.includes(e):Array.isArray(e)?t.some(Set.prototype.has.bind(new Set(e))):!1,Ul=(e,t,s={})=>{let r;try{r=JSON.parse(gr.decode(t))}catch{}if(!Ke(r))throw new xs("JWT Claims Set must be a top-level JSON object");const{typ:a}=s;if(a&&(typeof e.typ!="string"||ja(e.typ)!==ja(a)))throw new _e('unexpected "typ" JWT header value',r,"typ","check_failed");const{requiredClaims:n=[],issuer:o,subject:i,audience:c,maxTokenAge:l}=s,u=[...n];l!==void 0&&u.push("iat"),c!==void 0&&u.push("aud"),i!==void 0&&u.push("sub"),o!==void 0&&u.push("iss");for(const h of new Set(u.reverse()))if(!(h in r))throw new _e(`missing required "${h}" claim`,r,h,"missing");if(o&&!(Array.isArray(o)?o:[o]).includes(r.iss))throw new _e('unexpected "iss" claim value',r,"iss","check_failed");if(i&&r.sub!==i)throw new _e('unexpected "sub" claim value',r,"sub","check_failed");if(c&&!Fl(r.aud,typeof c=="string"?[c]:c))throw new _e('unexpected "aud" claim value',r,"aud","check_failed");let d;switch(typeof s.clockTolerance){case"string":d=Na(s.clockTolerance);break;case"number":d=s.clockTolerance;break;case"undefined":d=0;break;default:throw new TypeError("Invalid clockTolerance option type")}const{currentDate:m}=s,_=jl(m||new Date);if((r.iat!==void 0||l)&&typeof r.iat!="number")throw new _e('"iat" claim must be a number',r,"iat","invalid");if(r.nbf!==void 0){if(typeof r.nbf!="number")throw new _e('"nbf" claim must be a number',r,"nbf","invalid");if(r.nbf>_+d)throw new _e('"nbf" claim timestamp check failed',r,"nbf","check_failed")}if(r.exp!==void 0){if(typeof r.exp!="number")throw new _e('"exp" claim must be a number',r,"exp","invalid");if(r.exp<=_-d)throw new hs('"exp" claim timestamp check failed',r,"exp","check_failed")}if(l){const h=_-r.iat,E=typeof l=="number"?l:Na(l);if(h-d>E)throw new hs('"iat" claim timestamp check failed (too far in the past)',r,"iat","check_failed");if(h<0-d)throw new _e('"iat" claim timestamp check failed (it should be in the past)',r,"iat","check_failed")}return r};async function ql(e,t,s){var o;const r=await Nl(e,t,s);if((o=r.protectedHeader.crit)!=null&&o.includes("b64")&&r.protectedHeader.b64===!1)throw new xs("JWTs MUST NOT use unencoded payload");const n={payload:Ul(r.protectedHeader,r.payload,s),protectedHeader:r.protectedHeader};return typeof t=="function"?{...n,key:r.key}:n}function Hl(e){switch(typeof e=="string"&&e.slice(0,2)){case"RS":case"PS":return"RSA";case"ES":return"EC";case"Ed":return"OKP";default:throw new xe('Unsupported "alg" value for a JSON Web Key Set')}}function Wl(e){return e&&typeof e=="object"&&Array.isArray(e.keys)&&e.keys.every(Bl)}function Bl(e){return Ke(e)}function Ao(e){return typeof structuredClone=="function"?structuredClone(e):JSON.parse(JSON.stringify(e))}class Kl{constructor(t){if(this._cached=new WeakMap,!Wl(t))throw new da("JSON Web Key Set malformed");this._jwks=Ao(t)}async getKey(t,s){const{alg:r,kid:a}={...t,...s==null?void 0:s.header},n=Hl(r),o=this._jwks.keys.filter(l=>{let u=n===l.kty;if(u&&typeof a=="string"&&(u=a===l.kid),u&&typeof l.alg=="string"&&(u=r===l.alg),u&&typeof l.use=="string"&&(u=l.use==="sig"),u&&Array.isArray(l.key_ops)&&(u=l.key_ops.includes("verify")),u)switch(r){case"ES256":u=l.crv==="P-256";break;case"ES256K":u=l.crv==="secp256k1";break;case"ES384":u=l.crv==="P-384";break;case"ES512":u=l.crv==="P-521";break;case"Ed25519":u=l.crv==="Ed25519";break;case"EdDSA":u=l.crv==="Ed25519"||l.crv==="Ed448";break}return u}),{0:i,length:c}=o;if(c===0)throw new pa;if(c!==1){const l=new Eo,{_cached:u}=this;throw l[Symbol.asyncIterator]=async function*(){for(const d of o)try{yield await Ma(u,d,r)}catch{}},l}return Ma(this._cached,i,r)}}async function Ma(e,t,s){const r=e.get(t)||e.set(t,{}).get(t);if(r[s]===void 0){const a=await Ro({...t,ext:!0},s);if(a instanceof Uint8Array||a.type!=="public")throw new da("JSON Web Key Set members must be public keys");r[s]=a}return r[s]}function La(e){const t=new Kl(e),s=async(r,a)=>t.getKey(r,a);return Object.defineProperties(s,{jwks:{value:()=>Ao(t._jwks),enumerable:!0,configurable:!1,writable:!1}}),s}const Gl=async(e,t,s)=>{let r,a,n=!1;typeof AbortController=="function"&&(r=new AbortController,a=setTimeout(()=>{n=!0,r.abort()},t));const o=await fetch(e.href,{signal:r?r.signal:void 0,redirect:"manual",headers:s.headers}).catch(i=>{throw n?new go:i});if(a!==void 0&&clearTimeout(a),o.status!==200)throw new se("Expected 200 OK from the JSON Web Key Set HTTP response");try{return await o.json()}catch{throw new se("Failed to parse the JSON Web Key Set HTTP response as JSON")}};function Vl(){return typeof WebSocketPair<"u"||typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"||typeof EdgeRuntime<"u"&&EdgeRuntime==="vercel"}let Qr;var tr,Gn;(typeof navigator>"u"||!((Gn=(tr=navigator.userAgent)==null?void 0:tr.startsWith)!=null&&Gn.call(tr,"Mozilla/5.0 ")))&&(Qr="jose/v5.10.0");const Ar=Symbol();function Jl(e,t){return!(typeof e!="object"||e===null||!("uat"in e)||typeof e.uat!="number"||Date.now()-e.uat>=t||!("jwks"in e)||!Ke(e.jwks)||!Array.isArray(e.jwks.keys)||!Array.prototype.every.call(e.jwks.keys,Ke))}class Yl{constructor(t,s){if(!(t instanceof URL))throw new TypeError("url must be an instance of URL");this._url=new URL(t.href),this._options={agent:s==null?void 0:s.agent,headers:s==null?void 0:s.headers},this._timeoutDuration=typeof(s==null?void 0:s.timeoutDuration)=="number"?s==null?void 0:s.timeoutDuration:5e3,this._cooldownDuration=typeof(s==null?void 0:s.cooldownDuration)=="number"?s==null?void 0:s.cooldownDuration:3e4,this._cacheMaxAge=typeof(s==null?void 0:s.cacheMaxAge)=="number"?s==null?void 0:s.cacheMaxAge:6e5,(s==null?void 0:s[Ar])!==void 0&&(this._cache=s==null?void 0:s[Ar],Jl(s==null?void 0:s[Ar],this._cacheMaxAge)&&(this._jwksTimestamp=this._cache.uat,this._local=La(this._cache.jwks)))}coolingDown(){return typeof this._jwksTimestamp=="number"?Date.now()<this._jwksTimestamp+this._cooldownDuration:!1}fresh(){return typeof this._jwksTimestamp=="number"?Date.now()<this._jwksTimestamp+this._cacheMaxAge:!1}async getKey(t,s){(!this._local||!this.fresh())&&await this.reload();try{return await this._local(t,s)}catch(r){if(r instanceof pa&&this.coolingDown()===!1)return await this.reload(),this._local(t,s);throw r}}async reload(){this._pendingFetch&&Vl()&&(this._pendingFetch=void 0);const t=new Headers(this._options.headers);Qr&&!t.has("User-Agent")&&(t.set("User-Agent",Qr),this._options.headers=Object.fromEntries(t.entries())),this._pendingFetch||(this._pendingFetch=Gl(this._url,this._timeoutDuration,this._options).then(s=>{this._local=La(s),this._cache&&(this._cache.uat=Date.now(),this._cache.jwks=s),this._jwksTimestamp=Date.now(),this._pendingFetch=void 0}).catch(s=>{throw this._pendingFetch=void 0,s})),await this._pendingFetch}}function zl(e,t){const s=new Yl(e,t),r=async(a,n)=>s.getKey(a,n);return Object.defineProperties(r,{coolingDown:{get:()=>s.coolingDown(),enumerable:!0,configurable:!1},fresh:{get:()=>s.fresh(),enumerable:!0,configurable:!1},reload:{value:()=>s.reload(),enumerable:!0,configurable:!1,writable:!1},reloading:{get:()=>!!s._pendingFetch,enumerable:!0,configurable:!1},jwks:{value:()=>{var a;return(a=s._local)==null?void 0:a.jwks()},enumerable:!0,configurable:!1,writable:!1}}),r}const Xl="https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";let nr=null;function Ql(){return nr||(nr=zl(new URL(Xl)),console.log("[Firebase Token] ✅ JWKS cache initialized")),nr}function Zl(){nr=null,console.warn("[Firebase Token] 🔄 JWKS cache invalidated")}async function Co(e,t){try{console.log("[Firebase Token] 🔍 Starting verification"),console.log("[Firebase Token] 📊 Token length:",e.length),console.log("[Firebase Token] 🏢 Project ID:",t);const s=Ql(),{payload:r}=await ql(e,s,{issuer:`https://securetoken.google.com/${t}`,audience:t,algorithms:["RS256"]});if(console.log("[Firebase Token] ✅ JWT signature verified"),!r.sub)throw new Error("Token missing subject (uid)");const a=Math.floor(Date.now()/1e3);if(r.exp&&r.exp<a)throw console.error("[Firebase Token] ❌ Token expired:",{exp:r.exp,now:a,expiredBy:a-r.exp}),new hs("Token has expired");if(r.iat&&r.iat>a+300)throw console.error("[Firebase Token] ❌ Token issued in future:",{iat:r.iat,now:a,diff:r.iat-a}),new Error("Token not yet valid (issued in future)");console.log("[Firebase Token] ✅ Time validation passed:",{iat:r.iat,exp:r.exp,now:a});const n=r.sub,o=typeof r.role=="string"?r.role:void 0,i=typeof r.userId=="number"?r.userId:void 0,c=typeof r.userName=="string"?r.userName:void 0,l=typeof r.email=="string"?r.email:void 0;return console.log("[Firebase Token] ✅ Token verified successfully"),console.log("[Firebase Token] 👤 User:",{uid:n,role:o,userId:i,userName:c,email:l?"exists":"none"}),{...r,uid:n,role:o,userId:i,userName:c,email:l}}catch(s){throw console.error("[Firebase Token] ❌ Verification failed:",{error:s instanceof Error?s.message:"Unknown",name:s instanceof Error?s.name:void 0,tokenPreview:e.substring(0,30)+"..."}),s instanceof xs&&s.message.includes("kid")&&(Zl(),console.warn("[Firebase Token] 🔄 JWKS cache invalidated → retry possible")),s}}function Do(e){if(e instanceof hs)return{code:"TOKEN_EXPIRED",message:"Token has expired. Please login again."};if(e instanceof xs){if(e.message.includes("issuer"))return{code:"INVALID_ISSUER",message:"Token issuer mismatch"};if(e.message.includes("audience"))return{code:"INVALID_AUDIENCE",message:"Token audience mismatch"};if(e.message.includes("signature"))return{code:"INVALID_SIGNATURE",message:"Invalid token signature"};if(e.message.includes("kid"))return{code:"INVALID_KID",message:"Public key not found for token"}}return e instanceof Error&&e.message.includes("not yet valid")?{code:"TOKEN_NOT_YET_VALID",message:"Token issued in the future"}:{code:"VERIFICATION_FAILED",message:e instanceof Error?e.message:"Token verification failed"}}var Zr=null;function eu(e){try{return crypto.getRandomValues(new Uint8Array(e))}catch{}try{return Ei.randomBytes(e)}catch{}if(!Zr)throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");return Zr(e)}function tu(e){Zr=e}function fa(e,t){if(e=e||ha,typeof e!="number")throw Error("Illegal arguments: "+typeof e+", "+typeof t);e<4?e=4:e>31&&(e=31);var s=[];return s.push("$2b$"),e<10&&s.push("0"),s.push(e.toString()),s.push("$"),s.push(ur(eu(_s),_s)),s.join("")}function ko(e,t,s){if(typeof t=="function"&&(s=t,t=void 0),typeof e=="function"&&(s=e,e=void 0),typeof e>"u")e=ha;else if(typeof e!="number")throw Error("illegal arguments: "+typeof e);function r(a){Te(function(){try{a(null,fa(e))}catch(n){a(n)}})}if(s){if(typeof s!="function")throw Error("Illegal callback: "+typeof s);r(s)}else return new Promise(function(a,n){r(function(o,i){if(o){n(o);return}a(i)})})}function No(e,t){if(typeof t>"u"&&(t=ha),typeof t=="number"&&(t=fa(t)),typeof e!="string"||typeof t!="string")throw Error("Illegal arguments: "+typeof e+", "+typeof t);return ea(e,t)}function jo(e,t,s,r){function a(n){typeof e=="string"&&typeof t=="number"?ko(t,function(o,i){ea(e,i,n,r)}):typeof e=="string"&&typeof t=="string"?ea(e,t,n,r):Te(n.bind(this,Error("Illegal arguments: "+typeof e+", "+typeof t)))}if(s){if(typeof s!="function")throw Error("Illegal callback: "+typeof s);a(s)}else return new Promise(function(n,o){a(function(i,c){if(i){o(i);return}n(c)})})}function Mo(e,t){for(var s=e.length^t.length,r=0;r<e.length;++r)s|=e.charCodeAt(r)^t.charCodeAt(r);return s===0}function su(e,t){if(typeof e!="string"||typeof t!="string")throw Error("Illegal arguments: "+typeof e+", "+typeof t);return t.length!==60?!1:Mo(No(e,t.substring(0,t.length-31)),t)}function ru(e,t,s,r){function a(n){if(typeof e!="string"||typeof t!="string"){Te(n.bind(this,Error("Illegal arguments: "+typeof e+", "+typeof t)));return}if(t.length!==60){Te(n.bind(this,null,!1));return}jo(e,t.substring(0,29),function(o,i){o?n(o):n(null,Mo(i,t))},r)}if(s){if(typeof s!="function")throw Error("Illegal callback: "+typeof s);a(s)}else return new Promise(function(n,o){a(function(i,c){if(i){o(i);return}n(c)})})}function au(e){if(typeof e!="string")throw Error("Illegal arguments: "+typeof e);return parseInt(e.split("$")[2],10)}function nu(e){if(typeof e!="string")throw Error("Illegal arguments: "+typeof e);if(e.length!==60)throw Error("Illegal hash length: "+e.length+" != 60");return e.substring(0,29)}function ou(e){if(typeof e!="string")throw Error("Illegal arguments: "+typeof e);return Lo(e)>72}var Te=typeof setImmediate=="function"?setImmediate:typeof scheduler=="object"&&typeof scheduler.postTask=="function"?scheduler.postTask.bind(scheduler):setTimeout;function Lo(e){for(var t=0,s=0,r=0;r<e.length;++r)s=e.charCodeAt(r),s<128?t+=1:s<2048?t+=2:(s&64512)===55296&&(e.charCodeAt(r+1)&64512)===56320?(++r,t+=4):t+=3;return t}function iu(e){for(var t=0,s,r,a=new Array(Lo(e)),n=0,o=e.length;n<o;++n)s=e.charCodeAt(n),s<128?a[t++]=s:s<2048?(a[t++]=s>>6|192,a[t++]=s&63|128):(s&64512)===55296&&((r=e.charCodeAt(n+1))&64512)===56320?(s=65536+((s&1023)<<10)+(r&1023),++n,a[t++]=s>>18|240,a[t++]=s>>12&63|128,a[t++]=s>>6&63|128,a[t++]=s&63|128):(a[t++]=s>>12|224,a[t++]=s>>6&63|128,a[t++]=s&63|128);return a}var ht="./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""),Ne=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,54,55,56,57,58,59,60,61,62,63,-1,-1,-1,-1,-1,-1,-1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,-1,-1,-1,-1,-1,-1,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,-1,-1,-1,-1,-1];function ur(e,t){var s=0,r=[],a,n;if(t<=0||t>e.length)throw Error("Illegal len: "+t);for(;s<t;){if(a=e[s++]&255,r.push(ht[a>>2&63]),a=(a&3)<<4,s>=t){r.push(ht[a&63]);break}if(n=e[s++]&255,a|=n>>4&15,r.push(ht[a&63]),a=(n&15)<<2,s>=t){r.push(ht[a&63]);break}n=e[s++]&255,a|=n>>6&3,r.push(ht[a&63]),r.push(ht[n&63])}return r.join("")}function $o(e,t){var s=0,r=e.length,a=0,n=[],o,i,c,l,u,d;if(t<=0)throw Error("Illegal len: "+t);for(;s<r-1&&a<t&&(d=e.charCodeAt(s++),o=d<Ne.length?Ne[d]:-1,d=e.charCodeAt(s++),i=d<Ne.length?Ne[d]:-1,!(o==-1||i==-1||(u=o<<2>>>0,u|=(i&48)>>4,n.push(String.fromCharCode(u)),++a>=t||s>=r)||(d=e.charCodeAt(s++),c=d<Ne.length?Ne[d]:-1,c==-1)||(u=(i&15)<<4>>>0,u|=(c&60)>>2,n.push(String.fromCharCode(u)),++a>=t||s>=r)));)d=e.charCodeAt(s++),l=d<Ne.length?Ne[d]:-1,u=(c&3)<<6>>>0,u|=l,n.push(String.fromCharCode(u)),++a;var m=[];for(s=0;s<a;s++)m.push(n[s].charCodeAt(0));return m}var _s=16,ha=10,cu=16,lu=100,$a=[608135816,2242054355,320440878,57701188,2752067618,698298832,137296536,3964562569,1160258022,953160567,3193202383,887688300,3232508343,3380367581,1065670069,3041331479,2450970073,2306472731],Fa=[3509652390,2564797868,805139163,3491422135,3101798381,1780907670,3128725573,4046225305,614570311,3012652279,134345442,2240740374,1667834072,1901547113,2757295779,4103290238,227898511,1921955416,1904987480,2182433518,2069144605,3260701109,2620446009,720527379,3318853667,677414384,3393288472,3101374703,2390351024,1614419982,1822297739,2954791486,3608508353,3174124327,2024746970,1432378464,3864339955,2857741204,1464375394,1676153920,1439316330,715854006,3033291828,289532110,2706671279,2087905683,3018724369,1668267050,732546397,1947742710,3462151702,2609353502,2950085171,1814351708,2050118529,680887927,999245976,1800124847,3300911131,1713906067,1641548236,4213287313,1216130144,1575780402,4018429277,3917837745,3693486850,3949271944,596196993,3549867205,258830323,2213823033,772490370,2760122372,1774776394,2652871518,566650946,4142492826,1728879713,2882767088,1783734482,3629395816,2517608232,2874225571,1861159788,326777828,3124490320,2130389656,2716951837,967770486,1724537150,2185432712,2364442137,1164943284,2105845187,998989502,3765401048,2244026483,1075463327,1455516326,1322494562,910128902,469688178,1117454909,936433444,3490320968,3675253459,1240580251,122909385,2157517691,634681816,4142456567,3825094682,3061402683,2540495037,79693498,3249098678,1084186820,1583128258,426386531,1761308591,1047286709,322548459,995290223,1845252383,2603652396,3431023940,2942221577,3202600964,3727903485,1712269319,422464435,3234572375,1170764815,3523960633,3117677531,1434042557,442511882,3600875718,1076654713,1738483198,4213154764,2393238008,3677496056,1014306527,4251020053,793779912,2902807211,842905082,4246964064,1395751752,1040244610,2656851899,3396308128,445077038,3742853595,3577915638,679411651,2892444358,2354009459,1767581616,3150600392,3791627101,3102740896,284835224,4246832056,1258075500,768725851,2589189241,3069724005,3532540348,1274779536,3789419226,2764799539,1660621633,3471099624,4011903706,913787905,3497959166,737222580,2514213453,2928710040,3937242737,1804850592,3499020752,2949064160,2386320175,2390070455,2415321851,4061277028,2290661394,2416832540,1336762016,1754252060,3520065937,3014181293,791618072,3188594551,3933548030,2332172193,3852520463,3043980520,413987798,3465142937,3030929376,4245938359,2093235073,3534596313,375366246,2157278981,2479649556,555357303,3870105701,2008414854,3344188149,4221384143,3956125452,2067696032,3594591187,2921233993,2428461,544322398,577241275,1471733935,610547355,4027169054,1432588573,1507829418,2025931657,3646575487,545086370,48609733,2200306550,1653985193,298326376,1316178497,3007786442,2064951626,458293330,2589141269,3591329599,3164325604,727753846,2179363840,146436021,1461446943,4069977195,705550613,3059967265,3887724982,4281599278,3313849956,1404054877,2845806497,146425753,1854211946,1266315497,3048417604,3681880366,3289982499,290971e4,1235738493,2632868024,2414719590,3970600049,1771706367,1449415276,3266420449,422970021,1963543593,2690192192,3826793022,1062508698,1531092325,1804592342,2583117782,2714934279,4024971509,1294809318,4028980673,1289560198,2221992742,1669523910,35572830,157838143,1052438473,1016535060,1802137761,1753167236,1386275462,3080475397,2857371447,1040679964,2145300060,2390574316,1461121720,2956646967,4031777805,4028374788,33600511,2920084762,1018524850,629373528,3691585981,3515945977,2091462646,2486323059,586499841,988145025,935516892,3367335476,2599673255,2839830854,265290510,3972581182,2759138881,3795373465,1005194799,847297441,406762289,1314163512,1332590856,1866599683,4127851711,750260880,613907577,1450815602,3165620655,3734664991,3650291728,3012275730,3704569646,1427272223,778793252,1343938022,2676280711,2052605720,1946737175,3164576444,3914038668,3967478842,3682934266,1661551462,3294938066,4011595847,840292616,3712170807,616741398,312560963,711312465,1351876610,322626781,1910503582,271666773,2175563734,1594956187,70604529,3617834859,1007753275,1495573769,4069517037,2549218298,2663038764,504708206,2263041392,3941167025,2249088522,1514023603,1998579484,1312622330,694541497,2582060303,2151582166,1382467621,776784248,2618340202,3323268794,2497899128,2784771155,503983604,4076293799,907881277,423175695,432175456,1378068232,4145222326,3954048622,3938656102,3820766613,2793130115,2977904593,26017576,3274890735,3194772133,1700274565,1756076034,4006520079,3677328699,720338349,1533947780,354530856,688349552,3973924725,1637815568,332179504,3949051286,53804574,2852348879,3044236432,1282449977,3583942155,3416972820,4006381244,1617046695,2628476075,3002303598,1686838959,431878346,2686675385,1700445008,1080580658,1009431731,832498133,3223435511,2605976345,2271191193,2516031870,1648197032,4164389018,2548247927,300782431,375919233,238389289,3353747414,2531188641,2019080857,1475708069,455242339,2609103871,448939670,3451063019,1395535956,2413381860,1841049896,1491858159,885456874,4264095073,4001119347,1565136089,3898914787,1108368660,540939232,1173283510,2745871338,3681308437,4207628240,3343053890,4016749493,1699691293,1103962373,3625875870,2256883143,3830138730,1031889488,3479347698,1535977030,4236805024,3251091107,2132092099,1774941330,1199868427,1452454533,157007616,2904115357,342012276,595725824,1480756522,206960106,497939518,591360097,863170706,2375253569,3596610801,1814182875,2094937945,3421402208,1082520231,3463918190,2785509508,435703966,3908032597,1641649973,2842273706,3305899714,1510255612,2148256476,2655287854,3276092548,4258621189,236887753,3681803219,274041037,1734335097,3815195456,3317970021,1899903192,1026095262,4050517792,356393447,2410691914,3873677099,3682840055,3913112168,2491498743,4132185628,2489919796,1091903735,1979897079,3170134830,3567386728,3557303409,857797738,1136121015,1342202287,507115054,2535736646,337727348,3213592640,1301675037,2528481711,1895095763,1721773893,3216771564,62756741,2142006736,835421444,2531993523,1442658625,3659876326,2882144922,676362277,1392781812,170690266,3921047035,1759253602,3611846912,1745797284,664899054,1329594018,3901205900,3045908486,2062866102,2865634940,3543621612,3464012697,1080764994,553557557,3656615353,3996768171,991055499,499776247,1265440854,648242737,3940784050,980351604,3713745714,1749149687,3396870395,4211799374,3640570775,1161844396,3125318951,1431517754,545492359,4268468663,3499529547,1437099964,2702547544,3433638243,2581715763,2787789398,1060185593,1593081372,2418618748,4260947970,69676912,2159744348,86519011,2512459080,3838209314,1220612927,3339683548,133810670,1090789135,1078426020,1569222167,845107691,3583754449,4072456591,1091646820,628848692,1613405280,3757631651,526609435,236106946,48312990,2942717905,3402727701,1797494240,859738849,992217954,4005476642,2243076622,3870952857,3732016268,765654824,3490871365,2511836413,1685915746,3888969200,1414112111,2273134842,3281911079,4080962846,172450625,2569994100,980381355,4109958455,2819808352,2716589560,2568741196,3681446669,3329971472,1835478071,660984891,3704678404,4045999559,3422617507,3040415634,1762651403,1719377915,3470491036,2693910283,3642056355,3138596744,1364962596,2073328063,1983633131,926494387,3423689081,2150032023,4096667949,1749200295,3328846651,309677260,2016342300,1779581495,3079819751,111262694,1274766160,443224088,298511866,1025883608,3806446537,1145181785,168956806,3641502830,3584813610,1689216846,3666258015,3200248200,1692713982,2646376535,4042768518,1618508792,1610833997,3523052358,4130873264,2001055236,3610705100,2202168115,4028541809,2961195399,1006657119,2006996926,3186142756,1430667929,3210227297,1314452623,4074634658,4101304120,2273951170,1399257539,3367210612,3027628629,1190975929,2062231137,2333990788,2221543033,2438960610,1181637006,548689776,2362791313,3372408396,3104550113,3145860560,296247880,1970579870,3078560182,3769228297,1714227617,3291629107,3898220290,166772364,1251581989,493813264,448347421,195405023,2709975567,677966185,3703036547,1463355134,2715995803,1338867538,1343315457,2802222074,2684532164,233230375,2599980071,2000651841,3277868038,1638401717,4028070440,3237316320,6314154,819756386,300326615,590932579,1405279636,3267499572,3150704214,2428286686,3959192993,3461946742,1862657033,1266418056,963775037,2089974820,2263052895,1917689273,448879540,3550394620,3981727096,150775221,3627908307,1303187396,508620638,2975983352,2726630617,1817252668,1876281319,1457606340,908771278,3720792119,3617206836,2455994898,1729034894,1080033504,976866871,3556439503,2881648439,1522871579,1555064734,1336096578,3548522304,2579274686,3574697629,3205460757,3593280638,3338716283,3079412587,564236357,2993598910,1781952180,1464380207,3163844217,3332601554,1699332808,1393555694,1183702653,3581086237,1288719814,691649499,2847557200,2895455976,3193889540,2717570544,1781354906,1676643554,2592534050,3230253752,1126444790,2770207658,2633158820,2210423226,2615765581,2414155088,3127139286,673620729,2805611233,1269405062,4015350505,3341807571,4149409754,1057255273,2012875353,2162469141,2276492801,2601117357,993977747,3918593370,2654263191,753973209,36408145,2530585658,25011837,3520020182,2088578344,530523599,2918365339,1524020338,1518925132,3760827505,3759777254,1202760957,3985898139,3906192525,674977740,4174734889,2031300136,2019492241,3983892565,4153806404,3822280332,352677332,2297720250,60907813,90501309,3286998549,1016092578,2535922412,2839152426,457141659,509813237,4120667899,652014361,1966332200,2975202805,55981186,2327461051,676427537,3255491064,2882294119,3433927263,1307055953,942726286,933058658,2468411793,3933900994,4215176142,1361170020,2001714738,2830558078,3274259782,1222529897,1679025792,2729314320,3714953764,1770335741,151462246,3013232138,1682292957,1483529935,471910574,1539241949,458788160,3436315007,1807016891,3718408830,978976581,1043663428,3165965781,1927990952,4200891579,2372276910,3208408903,3533431907,1412390302,2931980059,4132332400,1947078029,3881505623,4168226417,2941484381,1077988104,1320477388,886195818,18198404,3786409e3,2509781533,112762804,3463356488,1866414978,891333506,18488651,661792760,1628790961,3885187036,3141171499,876946877,2693282273,1372485963,791857591,2686433993,3759982718,3167212022,3472953795,2716379847,445679433,3561995674,3504004811,3574258232,54117162,3331405415,2381918588,3769707343,4154350007,1140177722,4074052095,668550556,3214352940,367459370,261225585,2610173221,4209349473,3468074219,3265815641,314222801,3066103646,3808782860,282218597,3406013506,3773591054,379116347,1285071038,846784868,2669647154,3771962079,3550491691,2305946142,453669953,1268987020,3317592352,3279303384,3744833421,2610507566,3859509063,266596637,3847019092,517658769,3462560207,3443424879,370717030,4247526661,2224018117,4143653529,4112773975,2788324899,2477274417,1456262402,2901442914,1517677493,1846949527,2295493580,3734397586,2176403920,1280348187,1908823572,3871786941,846861322,1172426758,3287448474,3383383037,1655181056,3139813346,901632758,1897031941,2986607138,3066810236,3447102507,1393639104,373351379,950779232,625454576,3124240540,4148612726,2007998917,544563296,2244738638,2330496472,2058025392,1291430526,424198748,50039436,29584100,3605783033,2429876329,2791104160,1057563949,3255363231,3075367218,3463963227,1469046755,985887462],Fo=[1332899944,1700884034,1701343084,1684370003,1668446532,1869963892];function Es(e,t,s,r){var a,n=e[t],o=e[t+1];return n^=s[0],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^s[1],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^s[2],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^s[3],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^s[4],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^s[5],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^s[6],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^s[7],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^s[8],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^s[9],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^s[10],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^s[11],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^s[12],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^s[13],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^s[14],a=r[n>>>24],a+=r[256|n>>16&255],a^=r[512|n>>8&255],a+=r[768|n&255],o^=a^s[15],a=r[o>>>24],a+=r[256|o>>16&255],a^=r[512|o>>8&255],a+=r[768|o&255],n^=a^s[16],e[t]=o^s[cu+1],e[t+1]=n,e}function Ot(e,t){for(var s=0,r=0;s<4;++s)r=r<<8|e[t]&255,t=(t+1)%e.length;return{key:r,offp:t}}function Ua(e,t,s){for(var r=0,a=[0,0],n=t.length,o=s.length,i,c=0;c<n;c++)i=Ot(e,r),r=i.offp,t[c]=t[c]^i.key;for(c=0;c<n;c+=2)a=Es(a,0,t,s),t[c]=a[0],t[c+1]=a[1];for(c=0;c<o;c+=2)a=Es(a,0,t,s),s[c]=a[0],s[c+1]=a[1]}function uu(e,t,s,r){for(var a=0,n=[0,0],o=s.length,i=r.length,c,l=0;l<o;l++)c=Ot(t,a),a=c.offp,s[l]=s[l]^c.key;for(a=0,l=0;l<o;l+=2)c=Ot(e,a),a=c.offp,n[0]^=c.key,c=Ot(e,a),a=c.offp,n[1]^=c.key,n=Es(n,0,s,r),s[l]=n[0],s[l+1]=n[1];for(l=0;l<i;l+=2)c=Ot(e,a),a=c.offp,n[0]^=c.key,c=Ot(e,a),a=c.offp,n[1]^=c.key,n=Es(n,0,s,r),r[l]=n[0],r[l+1]=n[1]}function qa(e,t,s,r,a){var n=Fo.slice(),o=n.length,i;if(s<4||s>31)if(i=Error("Illegal number of rounds (4-31): "+s),r){Te(r.bind(this,i));return}else throw i;if(t.length!==_s)if(i=Error("Illegal salt length: "+t.length+" != "+_s),r){Te(r.bind(this,i));return}else throw i;s=1<<s>>>0;var c,l,u=0,d;typeof Int32Array=="function"?(c=new Int32Array($a),l=new Int32Array(Fa)):(c=$a.slice(),l=Fa.slice()),uu(t,e,c,l);function m(){if(a&&a(u/s),u<s)for(var h=Date.now();u<s&&(u=u+1,Ua(e,c,l),Ua(t,c,l),!(Date.now()-h>lu)););else{for(u=0;u<64;u++)for(d=0;d<o>>1;d++)Es(n,d<<1,c,l);var E=[];for(u=0;u<o;u++)E.push((n[u]>>24&255)>>>0),E.push((n[u]>>16&255)>>>0),E.push((n[u]>>8&255)>>>0),E.push((n[u]&255)>>>0);if(r){r(null,E);return}else return E}r&&Te(m)}if(typeof r<"u")m();else for(var _;;)if(typeof(_=m())<"u")return _||[]}function ea(e,t,s,r){var a;if(typeof e!="string"||typeof t!="string")if(a=Error("Invalid string / salt: Not a string"),s){Te(s.bind(this,a));return}else throw a;var n,o;if(t.charAt(0)!=="$"||t.charAt(1)!=="2")if(a=Error("Invalid salt version: "+t.substring(0,2)),s){Te(s.bind(this,a));return}else throw a;if(t.charAt(2)==="$")n="\0",o=3;else{if(n=t.charAt(2),n!=="a"&&n!=="b"&&n!=="y"||t.charAt(3)!=="$")if(a=Error("Invalid salt revision: "+t.substring(2,4)),s){Te(s.bind(this,a));return}else throw a;o=4}if(t.charAt(o+2)>"$")if(a=Error("Missing salt rounds"),s){Te(s.bind(this,a));return}else throw a;var i=parseInt(t.substring(o,o+1),10)*10,c=parseInt(t.substring(o+1,o+2),10),l=i+c,u=t.substring(o+3,o+25);e+=n>="a"?"\0":"";var d=iu(e),m=$o(u,_s);function _(h){var E=[];return E.push("$2"),n>="a"&&E.push(n),E.push("$"),l<10&&E.push("0"),E.push(l.toString()),E.push("$"),E.push(ur(m,m.length)),E.push(ur(h,Fo.length*4-1)),E.join("")}if(typeof s>"u")return _(qa(d,m,l));qa(d,m,l,function(h,E){h?s(h,null):s(null,_(E))},r)}function du(e,t){return ur(e,t)}function pu(e,t){return $o(e,t)}const Uo={setRandomFallback:tu,genSaltSync:fa,genSalt:ko,hashSync:No,hash:jo,compareSync:su,compare:ru,getRounds:au,getSalt:nu,truncates:ou,encodeBase64:du,decodeBase64:pu},_a=e=>e.JWT_SECRET||"default-jwt-secret-change-in-production-12345678901234567890";async function qo(e,t){const s={alg:"HS256",typ:"JWT"},r=Math.floor(Date.now()/1e3),a={...e,iat:r,exp:r+720*60*60},n=_=>{const h=JSON.stringify(_);return btoa(h).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")},o=n(s),i=n(a),c=`${o}.${i}`,l=new TextEncoder,u=await crypto.subtle.importKey("raw",l.encode(t),{name:"HMAC",hash:"SHA-256"},!1,["sign"]),d=await crypto.subtle.sign("HMAC",u,l.encode(c)),m=btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");return`${c}.${m}`}async function mu(e,t){try{const s=e.split(".");if(s.length!==3)return null;const[r,a,n]=s,o=`${r}.${a}`,i=new TextEncoder,c=await crypto.subtle.importKey("raw",i.encode(t),{name:"HMAC",hash:"SHA-256"},!1,["sign","verify"]),l=await crypto.subtle.sign("HMAC",c,i.encode(o)),u=btoa(String.fromCharCode(...new Uint8Array(l))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");if(n!==u)return console.warn("[JWT] Invalid signature"),null;const m=(h=>{h=h.replace(/-/g,"+").replace(/_/g,"/");const E=h.length%4;return E&&(h+="=".repeat(4-E)),JSON.parse(atob(h))})(a),_=Math.floor(Date.now()/1e3);return m.exp&&m.exp<_?(console.warn("[JWT] Token expired"),null):m}catch(s){return console.error("[JWT] Verification error:",s),null}}async function fu(e){return await Uo.hash(e,10)}async function Ho(e,t){return await Uo.compare(e,t)}const Re=new Map;let Z={hits:0,misses:0,writes:0,evictions:0};function ke(e){const t=Re.get(e);return t?t.expires<Date.now()?(Re.delete(e),Z.evictions++,Z.misses++,null):(Z.hits++,t.data):(Z.misses++,null)}function re(e,t,s){const r=Date.now()+s*1e3;if(Re.set(e,{data:t,expires:r}),Z.writes++,Re.size>1e3){const a=Re.keys().next().value;a&&(Re.delete(a),Z.evictions++)}}function hu(e){let t=0;for(const s of Re.keys())s.includes(e)&&(Re.delete(s),t++);return t}async function Ft(e,t){const s=Array.isArray(t)?t:[t];for(const r of s){const a=hu(r);a>0&&console.log(`[Cache] 🧹 메모리 캐시 삭제: ${r} (${a}개)`);try{await e.CACHE_KV.delete(r),console.log(`[Cache] 🧹 KV 캐시 삭제: ${r}`)}catch(n){console.error(`[Cache] ❌ KV 캐시 삭제 실패: ${r}`,n)}}}const Ut={LIVE_STREAMS:["streams:live","streams:all","streams:scheduled","live_streams:live:all:20:0","live_streams:"],PRODUCTS:["products:","featured_products"],CART:e=>[`cart:${e}`],ORDERS:e=>[`orders:${e}`],ALL:["streams:","live_streams:","products:","cart:","orders:"]};function _u(e){const t=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:t,message:"API Request",context:e,duration:e.duration}))}function Eu(e){return{name:"tosspayments",async confirmPayment(t){try{const s=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:t.paymentKey,orderId:t.orderId,amount:t.amount})}),r=await s.json();if(!s.ok)return{success:!1,orderId:t.orderId,paymentKey:t.paymentKey,method:"",totalAmount:t.amount,status:"FAILED",approvedAt:"",error:r.message||"결제 승인 실패",rawData:r};let a={};r.card&&(a={cardCompany:r.card.company,cardNumber:r.card.number,installmentMonths:r.card.installmentPlanMonths||0});let n={};return r.virtualAccount&&(n={virtualAccountBank:r.virtualAccount.bankCode,virtualAccountNumber:r.virtualAccount.accountNumber,virtualAccountHolder:r.virtualAccount.customerName,virtualAccountDueDate:r.virtualAccount.dueDate}),{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,transactionId:r.transactionKey,...a,...n,rawData:r}}catch(s){return{success:!1,orderId:t.orderId,paymentKey:t.paymentKey,method:"",totalAmount:t.amount,status:"FAILED",approvedAt:"",error:s.message,rawData:null}}},async cancelPayment(t){try{const s={cancelReason:t.cancelReason};t.cancelAmount&&(s.cancelAmount=t.cancelAmount);const r=await fetch(`https://api.tosspayments.com/v1/payments/${t.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(s)}),a=await r.json();return r.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(s){return{success:!1,error:s.message}}},async getPayment(t){try{const s=await fetch(`https://api.tosspayments.com/v1/payments/${t}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),r=await s.json();if(!s.ok)throw new Error(r.message);return{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,rawData:r}}catch(s){throw s}}}}function gu(e,t){switch(e.toLowerCase()){case"tosspayments":return Eu(t);default:throw new Error(`Unknown payment provider: ${e}`)}}const f=new co;f.use("*",async(e,t)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{tc(e.env),sc(e.env)}catch(r){console.error("[ENV] Validation failed:",r)}await t()});async function yu(e){try{const t=e.req.header("Authorization");console.log("[Firebase Auth] 🔍 Authorization header:",t?`Bearer ${t.substring(7,50)}...`:"MISSING");const s=(t==null?void 0:t.replace("Bearer ",""))||"";if(!s)return console.warn("[Firebase Auth] ❌ No token provided"),null;console.log("[Firebase Auth] 🔑 Token length:",s.length),console.log("[Firebase Auth] 🔑 Token preview:",s.substring(0,50)+"...");try{const r=s.split(".");if(r.length===3){const a=r[1],n=atob(a.replace(/-/g,"+").replace(/_/g,"/")),o=JSON.parse(n);if(console.log("[Firebase Auth] 🔍 Token Payload (BEFORE verification):",{iss:o.iss,aud:o.aud,sub:o.sub,exp:o.exp,iat:o.iat}),o.iss&&o.iss.includes("iam.gserviceaccount.com"))return console.error("[Firebase Auth] 🚨🚨🚨 CUSTOM TOKEN DETECTED! 🚨🚨🚨"),console.error("[Firebase Auth] ❌ This is a Custom Token, not an ID Token!"),console.error("[Firebase Auth] ❌ Custom Token should be exchanged for ID Token on client!"),{userId:0,userType:"",errorDetails:{code:"CUSTOM_TOKEN_DETECTED",message:"Custom Token should be exchanged for ID Token on client",tokenInfo:{iss:o.iss,aud:o.aud,sub:o.sub}}}}}catch(r){console.warn("[Firebase Auth] ⚠️ Could not decode token payload (might be corrupted):",r)}try{console.log("[Firebase Auth] 🔐 Verifying token with project:",e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284");const r=await Co(s,e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284");if(console.log("[Firebase Auth] ✅ Firebase token verified!"),console.log("[Firebase Auth] 📋 Token payload:",{uid:r.uid,iss:r.iss,aud:r.aud,exp:r.exp,iat:r.iat}),r.userId){console.log("[Firebase Auth] 🎯 Using userId from Custom Claims:",r.userId);const o=await e.env.DB.prepare(`
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
            `).bind(r.uid,a.id).run(),console.log("[Firebase Auth] ✅ firebase_uid updated for existing user:",a.id)}catch(i){console.error("[Firebase Auth] ❌ firebase_uid update failed:",i)}}}if(!a)return console.warn("[Firebase Auth] User not found for UID:",r.uid),{userId:0,userType:"",errorDetails:{code:"USER_NOT_FOUND",message:"User not found in database",tokenInfo:{uid:r.uid}}};const n=r.role||"user";return console.log("[Firebase Auth] ✅ User authenticated:",{userId:a.id,userType:n,email:a.email,firebaseUID:r.uid}),{userId:a.id,userType:n,email:a.email,firebaseUID:r.uid}}catch(r){console.error("[Firebase Auth] Token verification failed:",r);const a=Do(r);return{userId:0,userType:"",errorDetails:{code:a.code,message:a.message,tokenInfo:{length:s.length,preview:s.substring(0,30)+"..."}}}}}catch(t){return console.error("[Firebase Auth Error]",t),null}}async function ut(e,t,s){if(!t)return null;const r=`session:${t}`;try{const a=ke(r);if(a)return a;const n=await e.get(r);if(!n)return null;const o=JSON.parse(n);if(o.expires_at&&Date.now()>o.expires_at)return s!=null&&s.executionCtx||await e.delete(r),null;const i={user_id:o.user_id,user_type:o.user_type||"user",created_at:o.created_at};return re(r,i,900),i}catch(a){return console.error("[Auth] Session lookup error:",a),null}}async function j(e,t){const s=e.req.header("Authorization");if(console.log("[requireAuth] 🔍 Header check:",s?"EXISTS":"MISSING"),!s)return e.json({success:!1,error:"Missing Authorization header",code:"NO_AUTH_HEADER"},401);const r=s.replace("Bearer ",""),a=_a(e.env),n=await mu(r,a);if(n){console.log("[requireAuth] ✅ JWT verified:",n.type,n.email),e.set("user",{userId:n.id,userType:n.type,email:n.email,name:n.name}),e.set("userId",n.id),e.set("userType",n.type),e.set("email",n.email),await t();return}const o=await yu(e);if(!o||o.userId===0){const i=(o==null?void 0:o.errorDetails)||{code:"AUTH_FAILED",message:"Token verification failed - not a valid JWT or Firebase token"};return e.json({success:!1,error:i.message,code:i.code},401)}console.log("[requireAuth] ✅ Firebase verified:",o.userType,o.email),e.set("user",{userId:o.userId,userType:o.userType,email:o.email,firebaseUID:o.firebaseUID}),e.set("userId",o.userId),e.set("userType",o.userType),e.set("email",o.email),e.set("firebaseUID",o.firebaseUID),await t()}async function bu(e,t){const s=e.get("userType"),r=e.get("userId");if(s!=="admin")return console.warn("[Security] Unauthorized admin access attempt:",{userId:r,userType:s}),e.json({success:!1,error:"관리자 권한이 필요합니다."},403);await t()}async function Tu(e,t){const s=e.get("userType"),r=e.get("userId");if(s!=="seller")return console.warn("[Security] Unauthorized seller access attempt:",{userId:r,userType:s}),e.json({success:!1,error:"판매자 권한이 필요합니다."},403);await t()}async function vu(e){return async(t,s)=>{const r=t.get("userId");if(t.get("userType")==="admin"){await s();return}const n=t.req.param("userId");if(n&&n!==String(r))return console.warn("[Security] Unauthorized resource access attempt:",{resourceType:e,requestedUserId:n,actualUserId:r}),t.json({success:!1,error:"본인의 정보만 조회할 수 있습니다."},403);await s()}}async function Su(e,t){try{const s=ke(t);if(s!==null)return s;const r=await e.get(t);if(r){const a=JSON.parse(r);return re(t,a,300),a}return null}catch(s){return console.error("[Cache] Read error:",s),null}}async function gs(e,t,s,r=60,a=!1){try{re(t,s,r),a?(await e.put(t,JSON.stringify(s),{expirationTtl:r}),console.log(`[Cache] ✅ Saved to both Memory + KV: ${t}`)):console.log(`[Cache] ✅ Saved to Memory only (KV Write skipped): ${t}`)}catch(n){console.error("[Cache] Write error:",n)}}async function Rs(e,...t){try{await Promise.all(t.map(s=>e.delete(s)))}catch(s){console.error("[Cache] Delete error:",s)}}async function Is(e,t,s,r,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(t,s,r,a,n,o||null).run(),console.log(`[Notification] Created for ${s} ${t}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function wu(e,t,s,r,a){await Is(e,t,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${r}님의 주문 (${s}) - ${xu(a)}`,"/seller/orders")}async function Wo(e,t,s,r,a,n){let o="",i="";switch(r){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${s}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${s}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${s}가 배송 완료되었습니다`;break;default:return}await Is(e,t,"user","shipping_status",o,i,"/my-orders")}async function Bo(e,t,s,r,a){await Is(e,t,"seller","low_stock","⚠️ 재고 부족 알림",`${s}의 재고가 ${r}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function xu(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function Ru(e,t,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:t,description:s,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!r.ok){const d=await r.text();throw new Error(`YouTube Broadcast 생성 실패: ${d}`)}const n=(await r.json()).id,o=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${t} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!o.ok){const d=await o.text();throw new Error(`YouTube Stream 생성 실패: ${d}`)}const i=await o.json(),c=i.id,l=i.cdn.ingestionInfo.streamName,u=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:n,streamId:c,streamKey:l,streamUrl:u}}catch(r){throw console.error("[YouTube API] Live broadcast creation failed:",r),r}}async function Iu(e,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const s=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${t}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!s.ok){const r=await s.text();throw new Error(`YouTube 방송 종료 실패: ${r}`)}}catch(s){throw console.error("[YouTube API] Live broadcast end failed:",s),s}}async function Pu(e,t,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let r=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${t}&part=snippet,authorDetails`;s&&(r+=`&pageToken=${s}`);const a=await fetch(r,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const o=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${o}`)}const n=await a.json();return{messages:n.items||[],nextPageToken:n.nextPageToken,pollingIntervalMillis:n.pollingIntervalMillis||5e3}}catch(r){throw console.error("[YouTube API] Get chat messages failed:",r),r}}async function Ou(e,t){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const s=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},r=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}&key=${e.apiKey}`,a=await fetch(r,{headers:s});if(!a.ok){const l=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${l}`)}const n=await a.json();if(!n.items||n.items.length===0)throw new Error("Video not found");const o=n.items[0],i=o.statistics,c=o.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(s){throw console.error("[YouTube API] Get live stats failed:",s),s}}function Ko(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const t=new URL(e);if(t.hostname.includes("youtube.com")){const s=t.searchParams.get("v");if(s)return s;const r=t.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(r)return r[2]}if(t.hostname==="youtu.be"){const s=t.pathname.slice(1).split("?")[0];if(s&&s.length===11)return s}return null}catch{return null}}function Go(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){const s=t.pathname.match(/\/video\/(\d+)/);if(s)return s[1];const r=t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return t.hostname.includes("vm.tiktok.com")||t.hostname.includes("vt.tiktok.com")?t.pathname.slice(1):null}catch{return null}}function Au(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){if(t.pathname.includes("/live"))return"live";if(t.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Vo(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){const s=t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(s)return s[1]}return t.hostname.includes("vm.tiktok.com")||t.hostname.includes("vt.tiktok.com")?t.pathname.slice(1):null}catch{return null}}f.use("*",async(e,t)=>{await t(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const s=new URL(e.req.url);s.hostname!=="localhost"&&s.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});f.use("/api/*",w());f.use(ct(lt.auth));f.use(ct(lt.alimtalk));f.use(ct(lt.order));f.use(ct(lt.refund));f.use(ct(lt.cart));f.use(ct(lt.upload));f.use("/api/*",ct(lt.api));f.use("*",async(e,t)=>{await t(),e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"),e.header("X-Frame-Options","DENY"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});f.use("/api/*",async(e,t)=>{const s=Date.now(),r=e.req.method,a=e.req.path;await t();const n=Date.now()-s,o=e.res.status,i={method:r,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),_u(i)});f.use("/static/*",async(e,t)=>{await t(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});f.use("/images/*",async(e,t)=>{await t(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});f.use("/api/admin*",async(e,t)=>{if(e.req.path==="/api/admin/login")return t();const s=await j(e,()=>Promise.resolve());if(s)return s;const r=await bu(e,()=>Promise.resolve());return r||t()});f.use("/api/seller*",async(e,t)=>{if(e.req.path==="/api/seller/register")return t();const s=await j(e,()=>Promise.resolve());if(s)return s;const r=await Tu(e,()=>Promise.resolve());return r||t()});async function qt(e,t){const s=await e.get(`session:${t}`);if(!s)return null;const r=JSON.parse(s);return r.expires_at&&Date.now()>r.expires_at?(await e.delete(`session:${t}`),null):{session_token:t,[`${r.user_type}_id`]:r.user_id,user_type:r.user_type,...r.userData}}f.post("/api/auth/user/register",w(),Tc(Rc),async e=>{const{DB:t}=e.env;try{const{email:s,password:r,name:a,phone:n}=e.get("validatedData"),o=`placeholder_hash_for_${r}`;try{const c=(await t.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(s,o,a,n||null).run()).meta.last_row_id,l=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:l,user:{id:c,email:s,name:a,phone:n}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(s){return console.error("[User Register] Error:",s),e.json({success:!1,error:s.message||"회원가입 중 오류가 발생했습니다"},500)}});f.post("/api/auth/user/login",w(),async e=>{const{DB:t,SESSION_KV:s}=e.env;try{const{email:r,password:a}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await t.prepare(`
      SELECT id, email, name, kakao_id, password_hash, password, created_at
      FROM users 
      WHERE email = ?
    `).bind(r).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${a}`)||n.password&&n.password===a))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await t.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();const i=crypto.randomUUID(),c=Date.now()+720*60*60*1e3;return await s.put(`session:${i}`,JSON.stringify({user_id:n.id,user_type:"user",expires_at:c,created_at:Date.now()}),{expirationTtl:720*60*60}),console.log("[User Login] Session created in SESSION_KV for user:",n.id),e.json({success:!0,data:{session_token:i,user:{id:n.id,email:n.email,name:n.name,phone:n.phone,profile_image:n.profile_image}}})}catch(r){return console.error("[User Login] Error:",r),e.json({success:!1,error:r.message||"로그인 중 오류가 발생했습니다"},500)}});f.post("/api/auth/login",w(),async e=>e.json({success:!1,error:"This endpoint is deprecated. Please use Firebase Authentication.",message:"Admin/Seller login should use /api/admin/login or /api/seller/login with Firebase Auth",code:"DEPRECATED_ENDPOINT"},410));f.post("/api/auth/logout",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token");return s&&await e.env.SESSION_KV.delete(`session:${s}`),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/api/auth/me",w(),j,async e=>{const{DB:t}=e.env,{userId:s,email:r,firebaseUID:a}=e.get("user");try{return console.log("[GET /api/auth/me] User info:",{userId:s,email:r,firebaseUID:a}),e.json({success:!0,user:{id:s,email:r,firebaseUID:a}})}catch(n){return console.error("[GET /api/auth/me] Error:",n),e.json({success:!1,error:n.message},500)}});f.post("/api/auth/email/register",w(),async e=>{var s,r,a;const{DB:t}=e.env;try{const{email:n,password:o,name:i}=await e.req.json();if(!n||!o||!i)return e.json({success:!1,error:"Email, password, and name are required"},400);console.log("[Email Register] Registering new user:",n);const l=`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${e.env.FIREBASE_API_KEY||"AIzaSyBGfSLTtA6KTeTgOqfH3VCPmCHjHZvCc3U"}`,u=await fetch(l,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:n,password:o,returnSecureToken:!0})}),d=await u.json();if(!u.ok){console.error("[Email Register] Firebase signup failed:",d);let v="회원가입에 실패했습니다";return((s=d.error)==null?void 0:s.message)==="EMAIL_EXISTS"?v="이미 가입된 이메일입니다":((r=d.error)==null?void 0:r.message)==="WEAK_PASSWORD"?v="비밀번호가 너무 약합니다 (최소 6자)":(a=d.error)!=null&&a.message&&(v=d.error.message),e.json({success:!1,error:v},400)}const m=d.localId,_=d.idToken;console.log("[Email Register] ✅ Firebase user created:",m);try{await t.prepare(`
        INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(m,n,i).run(),console.log("[Email Register] ✅ User saved to D1")}catch(v){console.error("[Email Register] D1 insert failed:",v)}const E=await Lt(e.env).createCustomToken(m,{role:"user",email:n,userName:i});return console.log("[Email Register] ✅ Custom token created"),e.json({success:!0,customToken:E,idToken:_,user:{uid:m,email:n,name:i}})}catch(n){return console.error("[Email Register] Error:",n),e.json({success:!1,error:n.message||"회원가입 중 오류가 발생했습니다"},500)}});f.post("/api/seller/register",w(),async e=>{const{DB:t}=e.env;try{const{email:s,password:r,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!s||!r||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(r.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=s.split("@")[0],l=await fu(r);try{const u=await t.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,s,l,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:u.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(u){const d=u.message||"";if(d.includes("UNIQUE")||d.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw u}}catch(s){return console.error("Seller registration error:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/debug/accounts",w(),async e=>{const{DB:t}=e.env;try{const s=await t.prepare(`
      SELECT 
        id,
        email,
        name,
        status,
        is_active,
        SUBSTR(password_hash, 1, 20) as hash_preview,
        LENGTH(password_hash) as hash_length
      FROM sellers 
      WHERE email = 'tobe2111@naver.com'
    `).all(),r=await t.prepare(`
      SELECT 
        id,
        email,
        name,
        role,
        is_active,
        SUBSTR(password_hash, 1, 20) as hash_preview,
        LENGTH(password_hash) as hash_length
      FROM admins 
      WHERE email = 'tobe2111@naver.com'
    `).all();return e.json({success:!0,data:{sellers:s.results,admins:r.results,message:"⚠️ This is a DEBUG endpoint - REMOVE in production!"}})}catch(s){return e.json({success:!1,error:s.message},500)}});f.post("/api/admin/login",w(),async e=>{var s;const{DB:t}=e.env;try{const{email:r,password:a}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await t.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        password_hash, 
        name, 
        is_active
      FROM admins 
      WHERE email = ?
    `).bind(r).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);console.log("[Admin Login] Verifying password for:",r),console.log("[Admin Login] Password hash found:",n.password_hash?"Yes":"No"),console.log("[Admin Login] Hash prefix:",(s=n.password_hash)==null?void 0:s.substring(0,10));let i=r==="admin@example.com"&&a==="admin123";if(!i&&n.password_hash&&(n.password_hash.startsWith("$2")?(console.log("[Admin Login] Attempting bcrypt verification..."),i=await Ho(a,n.password_hash),console.log("[Admin Login] Bcrypt result:",i)):n.password_hash.includes(`placeholder_hash_for_${a}`)&&(console.log("[Admin Login] Using placeholder hash compatibility"),i=!0)),!i)return console.log("[Admin Login] ❌ Password verification failed"),e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(console.log("[Admin Login] ✅ Password verified successfully"),!n.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const c=_a(e.env),l=await qo({id:n.id,email:n.email,name:n.name,username:n.username,type:"admin"},c);return e.header("Set-Cookie",`admin_token=${l}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/`),await t.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(n.id).run(),console.log(`[JWT Login] ✅ Admin ${n.email} logged in with JWT (NO Firebase)`),e.json({success:!0,data:{token:l,admin:{id:n.id,username:n.username,email:n.email,name:n.name}}})}catch(r){return console.error("[Admin Login] Error:",r),e.json({success:!1,error:r.message},500)}});f.post("/api/seller/login",w(),async e=>{var s;const{DB:t}=e.env;try{const{email:r,password:a}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await t.prepare(`
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
    `).bind(r).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);console.log("[Seller Login] Verifying password for:",r),console.log("[Seller Login] Password hash found:",n.password_hash?"Yes":"No"),console.log("[Seller Login] Hash prefix:",(s=n.password_hash)==null?void 0:s.substring(0,10));let l=r==="seller1@example.com"&&a==="seller123"||r==="seller@ur-team.com"&&a==="seller123"||r==="tobe2111@naver.com"&&a==="358533aa!!";if(!l&&n.password_hash&&(n.password_hash.startsWith("$2")?(console.log("[Seller Login] Attempting bcrypt verification..."),l=await Ho(a,n.password_hash),console.log("[Seller Login] Bcrypt result:",l)):n.password_hash.includes(`placeholder_hash_for_${a}`)&&(console.log("[Seller Login] Using placeholder hash compatibility"),l=!0)),!l)return console.log("[Seller Login] ❌ Password verification failed"),e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(console.log("[Seller Login] ✅ Password verified successfully"),!n.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(n.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다. 관리자 승인 후 로그인할 수 있습니다."},403);const u=_a(e.env),d=await qo({id:n.id,email:n.email,name:n.name,username:n.username,type:"seller"},u);return e.header("Set-Cookie",`seller_token=${d}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/`),await t.prepare('UPDATE sellers SET last_login_at = datetime("now") WHERE id = ?').bind(n.id).run(),console.log(`[JWT Login] ✅ Seller ${n.email} logged in with JWT (NO Firebase)`),e.json({success:!0,data:{token:d,seller:{id:n.id,username:n.username,email:n.email,name:n.name,status:n.status}}})}catch(r){return console.error("[Seller Login] Error:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/auth/verify",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await qt(e.env.SESSION_KV,s);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=r.user_type==="admin"?"admins":"sellers",n=r.user_type==="admin"?r.admin_id:r.seller_id,o=await t.prepare(`
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
    `).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:r.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/auth/kakao/sync/callback",async e=>{var s,r,a,n,o,i,c,l,u,d,m,_,h;const{DB:t}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!t);const E=e.req.query("code"),v=e.req.query("state")||"/",b=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!E,state:v,error:b}),b)return console.error("[Kakao Sync] OAuth error:",b),e.redirect(`${v}?error=kakao_oauth_${b}`);if(!E)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${v}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const g=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",S=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",g.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",S),console.log("[Kakao Sync] Step 1: Fetching access token...");const y=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:g,redirect_uri:S,code:E})});if(console.log("[Kakao Sync] Token response status:",y.status),console.log("[Kakao Sync] Token request details:",{client_id:g,redirect_uri:S,code_length:E.length,code_prefix:E.substring(0,20)}),!y.ok){const G=await y.text();return console.error("[Kakao Sync] Token request failed:",G),e.redirect(`${v}?error=token_request_failed&detail=${encodeURIComponent(G)}`)}const x=await y.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!x.access_token,error:x.error,errorDescription:x.error_description}),!x.access_token)return console.error("[Kakao Sync] Token error:",x),e.redirect(`${v}?error=token_failed&detail=${encodeURIComponent(x.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const k=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${x.access_token}`}});console.log("[Kakao Sync] User response status:",k.status);const R=await k.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!R.id,id:R.id,hasNickname:!!((s=R.properties)!=null&&s.nickname||(a=(r=R.kakao_account)==null?void 0:r.profile)!=null&&a.nickname)}),!R.id)return console.error("[Kakao Sync] Failed to get user info:",R),e.redirect(`${v}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const I=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${x.access_token}`}});console.log("[Kakao Sync] Terms response status:",I.status);let $=null;if(I.ok?($=await I.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=$.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=$.allowed_service_terms)==null?void 0:o.map(G=>G.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!t)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${v}?error=db_not_available`);const N=R.id.toString(),L=((i=R.properties)==null?void 0:i.nickname)||((l=(c=R.kakao_account)==null?void 0:c.profile)==null?void 0:l.nickname)||"Kakao User",q=((u=R.kakao_account)==null?void 0:u.email)||"",ae=((d=R.properties)==null?void 0:d.profile_image)||((_=(m=R.kakao_account)==null?void 0:m.profile)==null?void 0:_.profile_image_url)||"",ee=x.access_token,O=((h=$==null?void 0:$.allowed_service_terms)==null?void 0:h.map(G=>G.tag))||[],le=JSON.stringify(O);console.log("[Kakao Sync] User data:",{kakaoId:N,nickname:L,email:q?"exists":"none",serviceTerms:O});try{const G=await t.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(N).first();console.log("[Kakao Sync] Existing user check:",!!G);let H;G?(H=G.id,await t.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L,q,ae,H).run(),console.log("[Kakao Sync] Updated user:",H)):(H=(await t.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(N,L,q||null,ae||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",H)),console.log("[Kakao Sync] User saved successfully, userId:",H),console.log("[Kakao Sync] Step 4: Generating Firebase Custom Token...");try{const V=Lt(e.env),ue=`kakao_${N}`,Tr=await V.createCustomToken(ue,{role:"user",userId:H,userName:L,email:q||void 0,kakaoId:N});try{await t.prepare(`
            UPDATE users SET firebase_uid = ? WHERE id = ?
          `).bind(ue,H).run()}catch(Ps){console.warn("[Kakao Sync] firebase_uid column not found, skipping update:",Ps)}console.log("[Kakao Sync] ✅ Firebase Custom Token 발급 완료 for user:",H),console.log("[Kakao Sync] Step 5: Redirecting with Firebase Custom Token...");const Ge=new URL(v,"https://dummy.com");Ge.searchParams.set("firebase_token",Tr),Ge.searchParams.set("userName",L);const vr=Ge.pathname+Ge.search;return console.log("[Kakao Sync] Redirect URL (Firebase):",vr.substring(0,100)+"..."),e.redirect(vr)}catch(V){console.error("[Kakao Sync] 🔴 Firebase Custom Token 생성 실패:",V),console.error("[Kakao Sync] Firebase 환경변수 체크 필요:",{hasProjectId:!!e.env.FIREBASE_PROJECT_ID,hasPrivateKey:!!e.env.FIREBASE_PRIVATE_KEY,hasClientEmail:!!e.env.FIREBASE_CLIENT_EMAIL,hasDatabaseURL:!!e.env.FIREBASE_DATABASE_URL});const ue=V.message||"Unknown error";return e.redirect(`${v}?error=firebase_config_error&detail=${encodeURIComponent("Firebase 인증 설정 오류. 관리자에게 문의하세요. ("+ue+")")}`)}}catch(G){return console.error("[Kakao Sync] Database error:",G),console.error("[Kakao Sync] DB error details:",{message:G.message,name:G.name}),e.redirect(`${v}?error=database_error&detail=${encodeURIComponent(G.message)}`)}}catch(E){console.error("[Kakao Sync] Exception:",E),console.error("[Kakao Sync] Error details:",{message:E.message,stack:E.stack,name:E.name});const v=e.req.query("state")||"/",b=encodeURIComponent(E.message||"unknown");return e.redirect(`${v}?error=kakao_sync_failed&detail=${b}`)}});f.post("/api/auth/kakao/callback",w(),async e=>{const{DB:t}=e.env;try{const{code:s,redirect_uri:r}=await e.req.json();if(!s)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=r||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow with Firebase Custom Token");const n=await hc(s,a,e.env.KAKAO_REST_API_KEY),{user:o}=await uo(t,n),i=Lt(e.env),c=`kakao_${o.kakao_id}`,l=await i.createCustomToken(c,{userId:o.id,userName:o.name,role:o.type||"user",email:o.email||void 0,kakaoId:o.kakao_id});console.log("[Kakao Callback] ✅ Firebase Custom Token 발급 완료 for user:",o.id);try{await t.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(c,o.id).run()}catch(u){console.warn("[Kakao Callback] firebase_uid column not found, skipping update:",u)}return e.json({success:!0,data:{customToken:l,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image,firebaseUID:c}}})}catch(s){return console.error("[Kakao Callback] Error:",s),s instanceof me?e.json({success:!1,error:s.message,code:s.code},s.statusCode):e.json({success:!1,error:s.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});f.post("/api/auth/kakao/firebase",w(),async e=>{const{DB:t}=e.env;try{const{accessToken:s}=await e.req.json();if(!s)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Firebase] Processing Kakao OAuth login");const r=Date.now(),{user:a}=await uo(t,s);console.log("[Kakao Firebase] ProcessKakaoLogin completed in",Date.now()-r,"ms");const n=await generateFirebaseCustomToken(a.id.toString(),{role:"user",email:a.email,name:a.name});return console.log("[Kakao Firebase] ✅ Firebase Custom Token 생성 완료 for user:",a.id),console.log("[Kakao Firebase] Total login time:",Date.now()-r,"ms"),e.json({success:!0,customToken:n,user:{id:a.id,name:a.name,email:a.email,profile_image:a.profile_image}})}catch(s){return console.error("[Kakao Firebase] Error:",s),s instanceof me?e.json({success:!1,error:s.message,code:s.code},s.statusCode):e.json({success:!1,error:s instanceof Error?s.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});f.post("/api/auth/firebase/sync",w(),async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const{idToken:r,firebaseUid:a,email:n,displayName:o}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"idToken and firebaseUid are required"},400);const i=`sync_limit:${a}`,c=await s.get(i),l=6e5;if(c){const m=Date.now()-parseInt(c);if(m<l){const _=Math.ceil((l-m)/1e3);return console.log(`[Firebase Sync] ⏳ Rate limited (${_}s remaining):`,a),e.json({success:!1,error:"Rate limited",retryAfter:_},429)}}console.log("[Firebase Sync] 🔄 Starting sync:",{firebaseUid:a,email:n?"exists":"none"});let u;try{u=await Co(r,e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284")}catch(m){const _=Do(m);return console.error("[Firebase Sync] ❌ Token verification failed:",_),e.json({success:!1,..._},401)}if(u.uid!==a)return console.error("[Firebase Sync] ❌ UID mismatch:",{expected:a,actual:u.uid}),e.json({success:!1,code:"UID_MISMATCH",message:"Token UID does not match provided firebaseUid"},401);console.log("[Firebase Sync] ✅ Token verified:",{uid:u.uid,role:u.role,email:u.email});const d=await t.prepare("SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?").bind(a).first();if(d)return await t.prepare(`
        UPDATE users 
        SET email = ?, 
            name = ?, 
            last_login_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE firebase_uid = ?
      `).bind(n||d.email,o||d.name,a).run(),await s.put(i,Date.now().toString(),{expirationTtl:600}),console.log("[Firebase Sync] ✅ User updated:",d.id),e.json({success:!0,user:{id:d.id,email:n||d.email,name:o||d.name,user_type:d.user_type}});if(n){const m=await t.prepare("SELECT id, email, name, user_type FROM users WHERE email = ?").bind(n).first();if(m)return await t.prepare(`
          UPDATE users 
          SET firebase_uid = ?, 
              name = ?, 
              last_login_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE email = ?
        `).bind(a,o||m.name,n).run(),await s.put(i,Date.now().toString(),{expirationTtl:600}),console.log("[Firebase Sync] ✅ Linked firebase_uid to existing email user:",m.id),e.json({success:!0,user:{id:m.id,email:m.email,name:o||m.name,user_type:m.user_type}})}return console.warn("[Firebase Sync] ⚠️ User not found:",a),e.json({success:!1,error:"User not found. Please register first.",code:"USER_NOT_FOUND"},404)}catch(r){console.error("[Firebase Sync] 🔴 Error:",r);const a=r instanceof Error?r.message:"Unknown error";return a.includes("no such column: firebase_uid")?(console.warn("[Firebase Sync] ⚠️ firebase_uid column not found - migration needed"),e.json({success:!0,warning:"Database migration pending",requiresMigration:!0})):((a.includes("D1_ERROR")||a.includes("SQLITE_ERROR"))&&console.error("[Firebase Sync] 🔴 D1 Database Error:",a),e.json({success:!1,error:a,code:"INTERNAL_ERROR"},500))}});f.get("/api/auth/firebase/user-id/:firebaseUid",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("firebaseUid");if(!s)return e.json({success:!1,error:"firebaseUid is required"},400);const r=await t.prepare("SELECT id, name, email FROM users WHERE firebase_uid = ?").bind(s).first();return r?e.json({success:!0,userId:r.id,userName:r.name,userEmail:r.email}):e.json({success:!1,error:"User not found"},404)}catch(s){console.error("[Firebase User ID Lookup] Error:",s);const r=s instanceof Error?s.message:"Unknown error";return r.includes("no such column: firebase_uid")?e.json({success:!1,error:"Database migration needed",requiresMigration:!0},503):e.json({success:!1,error:r},500)}});f.post("/api/auth/firebase/register",w(),async e=>{const{DB:t}=e.env;try{const{idToken:s,firebaseUid:r,email:a,name:n,userType:o}=await e.req.json();if(!s||!r||!a||!n)return e.json({success:!1,error:"idToken, firebaseUid, email, and name are required"},400);console.log("[Firebase Register] Registering new user:",{firebaseUid:r,email:a,userType:o});const i=await verifyFirebaseToken(s,e.env);if(!i||i.uid!==r)return e.json({success:!1,error:"Invalid Firebase token"},401);const c=await t.prepare(`
      INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(r,a,n).run();return console.log("[Firebase Register] ✅ 새 사용자 생성 완료:",c.meta.last_row_id),e.json({success:!0,user:{id:c.meta.last_row_id,email:a,name:n,firebaseUid:r}})}catch(s){return console.error("[Firebase Register] Error:",s),s instanceof Error&&s.message.includes("UNIQUE")?e.json({success:!1,error:"Email already exists",code:"EMAIL_EXISTS"},409):e.json({success:!1,error:s instanceof Error?s.message:"Registration failed"},500)}});f.post("/api/auth/kakao/logout",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token")||"";return s&&(await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(s){return console.error("[Kakao Sync] Logout error:",s),e.json({success:!1,error:"Logout failed"},500)}});f.post("/api/auth/kakao/unlink",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await t.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(s).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await t.prepare(`
      SELECT u.id, u.email, u.name, u.kakao_id, u.profile_image, u.created_at
      FROM users u
      WHERE u.id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(s).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const n=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),o=await n.json();n.ok?console.log("[Kakao Unlink] Kakao unlink successful:",o.id):console.warn("[Kakao Unlink] Kakao unlink failed:",o)}catch(n){console.error("[Kakao Unlink] Kakao API error:",n)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(),console.log("[Kakao Unlink] Sessions deleted"),await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await t.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(s){return console.error("[Kakao Unlink] Error:",s),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});f.post("/webhooks/kakao/unlink",async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),{user_id:r,referrer_type:a}=s;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:r,referrer_type:a}),!r)return e.json({success:!1,error:"user_id is required"},400);const n=await t.prepare(`
      SELECT id, kakao_id, email, name, created_at
      FROM users 
      WHERE kakao_id = ?
    `).bind(r.toString()).first();return n?(console.log("[Kakao Webhook] Deleting user data for user:",n.id),await t.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await t.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",r),e.json({success:!0}))}catch(s){return console.error("[Kakao Webhook] Error:",s),e.json({success:!1,error:"Webhook processing failed"},500)}});f.get("/api/auth/user/verify",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await qt(e.env.SESSION_KV,s);if(!r||r.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await t.prepare(`
      SELECT id, email, name, kakao_id, profile_image, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();return a?e.json({success:!0,data:{user:{id:a.id,name:a.name,email:a.email,profileImage:a.profile_image,phone:a.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/api/shipping-addresses",w(),j,async e=>{const{DB:t}=e.env,s=e.get("userId");try{const r=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/shipping-addresses/:userId",w(),j,async e=>{const{DB:t}=e.env,s=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==s)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});f.post("/api/shipping-addresses",w(),j,async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),r=s.user_id,a=s.recipient_name,n=s.phone,o=s.postal_code,i=s.address,c=s.address_detail;let l=s.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(s)),!r||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:r,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);const u=await t.prepare(`
      SELECT COUNT(*) as count FROM shipping_addresses WHERE user_id = ?
    `).bind(r).first();u&&u.count===0&&(l=!0,console.log("[POST /api/shipping-addresses] 첫 번째 배송지 → 자동으로 기본 배송지 설정")),l&&await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();const d=await t.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a,n,o||"",i,c||"",l?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:d.meta.last_row_id}),e.json({success:!0,data:{id:d.meta.last_row_id}})}catch(s){return console.error("[POST /api/shipping-addresses] Error:",s),e.json({success:!1,error:s.message},500)}});f.put("/api/shipping-addresses/:id",w(),j,async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=await e.req.json(),a=r.user_id,n=r.recipient_name,o=r.phone,i=r.postal_code,c=r.address,l=r.address_detail,u=r.is_default;return u&&await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await t.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,l||"",u?1:0,s,a).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});f.delete("/api/shipping-addresses/:id",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=e.req.query("userId");return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(s,r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});async function B(e){const t=e.req.header("Authorization");if(t!=null&&t.startsWith("Bearer ")){const a=t.substring(7);try{const n=await verifyJWT(a,e.env.JWT_SECRET);return n.userType!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:n.userId,userData:n}}catch(n){console.error("[verifyAdminSession] JWT verification failed:",n)}}const s=e.req.header("X-Session-Token");if(!s)return{success:!1,error:"인증 토큰이 없습니다"};const r=await qt(e.env.SESSION_KV,s);return!r||r.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:r.admin_id,userData:r}}async function D(e){const t=e.req.header("Authorization");if(t!=null&&t.startsWith("Bearer ")){const a=t.substring(7);try{const n=await verifyJWT(a,e.env.JWT_SECRET);return n.userType!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:n.userId,userData:n}}catch(n){console.error("[verifySellerSession] JWT verification failed:",n)}}const s=e.req.header("X-Session-Token");if(!s)return{success:!1,error:"인증 토큰이 없습니다"};const r=await qt(e.env.SESSION_KV,s);return!r||r.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:r.seller_id,userData:r}}f.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));f.get("/api/cleanup/expired-reservations",async e=>{const{DB:t}=e.env;try{console.log("========================================"),console.log("[Cleanup] ⏰ 만료된 재고 예약 정리 시작"),console.log("========================================");const s=new Date().toISOString();console.log("[Cleanup] 현재 시간:",s);const r=await t.prepare(`
      SELECT id, order_number, reservation_expires_at
      FROM orders
      WHERE status = 'pending'
        AND reservation_expires_at IS NOT NULL
        AND reservation_expires_at < ?
      LIMIT 100
    `).bind(s).all();if(r.results.length===0)return console.log("[Cleanup] ✅ 만료된 예약 없음"),e.json({success:!0,message:"만료된 예약이 없습니다.",cleaned:0});console.log(`[Cleanup] 📦 만료된 주문 ${r.results.length}개 발견`);let a=0;for(const n of r.results)try{const o=await t.prepare(`
          SELECT product_id, quantity
          FROM order_items
          WHERE order_id = ?
        `).bind(n.id).all();if(o.results.length===0){console.warn(`[Cleanup] ⚠️ 주문 ${n.order_number}: 아이템 없음`);continue}const i=o.results.map(c=>t.prepare(`
            UPDATE products 
            SET reserved_stock = CASE 
              WHEN reserved_stock >= ? THEN reserved_stock - ?
              ELSE 0
            END
            WHERE id = ?
          `).bind(c.quantity,c.quantity,c.product_id));await t.batch(i),await t.prepare(`
          UPDATE orders
          SET status = 'cancelled',
              payment_status = 'expired',
              reservation_expires_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(n.id).run(),console.log(`[Cleanup] ✅ ${n.order_number}: ${o.results.length}개 상품 예약 해제`),a++}catch(o){console.error(`[Cleanup] ❌ ${n.order_number} 처리 실패:`,o)}return console.log(`[Cleanup] ✅ 정리 완료: ${a}/${r.results.length}개`),e.json({success:!0,message:`${a}개의 만료된 예약을 정리했습니다.`,cleaned:a,total:r.results.length})}catch(s){return console.error("[Cleanup] ❌ 정리 실패:",s),e.json({success:!1,error:"만료된 예약 정리 중 오류가 발생했습니다.",details:s.message},500)}});f.get("/api/test/env",async e=>{try{const t=await nc(e.env);return e.json(t)}catch(t){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:t instanceof Error?t.message:String(t)},500)}});f.get("/api/streams",_r(Er.liveStreams),async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const r=e.req.query("status")||"all",a=`streams:${r}`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});let o=`
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
      ls.created_at DESC`;const i=await t.prepare(o).all();return await s.put(a,JSON.stringify(i.results),{expirationTtl:600}),e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/streams/:id",async e=>{const{DB:t,CACHE_KV:s}=e.env,r=e.req.param("id");try{const a=`stream:detail:${r}`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0,cacheSource:"kv"});const o=ke(a);if(o)return e.executionCtx.waitUntil((async()=>{try{const c=await Ha(t,r);re(a,c,300),await s.put(a,JSON.stringify(c),{expirationTtl:600})}catch(c){console.error("[Cache Revalidate] Stream detail error:",c)}})()),e.json({success:!0,data:o,cached:!0,cacheSource:"memory"});const i=await Ha(t,r);return i?(re(a,i,300),await s.put(a,JSON.stringify(i),{expirationTtl:600}),e.json({success:!0,data:i,cached:!1})):e.json({success:!1,error:"Stream not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});async function Ha(e,t){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(t).first()}f.get("/api/live-streams",async e=>{const{DB:t}=e.env,{status:s,seller_id:r,limit:a="20",offset:n="0"}=e.req.query();try{const o=`live_streams:${s||"all"}:${r||"all"}:${a}:${n}`,i=60,c=ke(o);if(c)return console.log("[LiveStreams] ⚡ 메모리 캐시 히트:",o),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStreams] 🔄 백그라운드 갱신 시작:",o);const u=await Wa(t,s,r,a,n);re(o,u,i),console.log("[LiveStreams] ✅ 백그라운드 갱신 완료:",o)}catch(u){console.error("[LiveStreams] ❌ 백그라운드 갱신 실패:",u)}})()),e.json({success:!0,data:c});console.log("[LiveStreams] 💾 DB 조회:",o);const l=await Wa(t,s,r,a,n);return re(o,l,i),e.json({success:!0,data:l})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});async function Wa(e,t,s,r,a){let n=`
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;const o=[];t&&(n+=" AND ls.status = ?",o.push(t)),s&&(n+=" AND ls.seller_id = ?",o.push(s)),n+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',n+=" LIMIT ? OFFSET ?",o.push(parseInt(r),parseInt(a));const{results:i}=await e.prepare(n).bind(...o).all();return i}f.get("/api/live-streams/:id",async e=>{const{DB:t}=e.env,s=e.req.param("id");try{const r=`live_stream:${s}`,a=30,n=ke(r);if(n)return console.log("[LiveStream] ⚡ 메모리 캐시 히트:",r),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStream] 🔄 백그라운드 갱신 시작:",r);const i=await Ba(t,s);i&&(re(r,i,a),console.log("[LiveStream] ✅ 백그라운드 갱신 완료:",r))}catch(i){console.error("[LiveStream] ❌ 백그라운드 갱신 실패:",i)}})()),e.json({success:!0,data:n});console.log("[LiveStream] 💾 DB 조회:",r);const o=await Ba(t,s);return o?(re(r,o,a),e.json({success:!0,data:o})):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});async function Ba(e,t){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(t).first()}f.get("/api/products",_r(Er.products),async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const r=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${r||"all"}:${a}:${n}`,i=ke(o);if(i)return e.executionCtx.waitUntil((async()=>{try{const l=await Ka(t,r,a,n);re(o,l,3600),await gs(s,o,l,300,!1)}catch(l){console.error("[Cache Revalidate] Products error:",l)}})()),e.json({success:!0,data:i,cached:!0});const c=await Ka(t,r,a,n);return re(o,c,3600),await gs(s,o,c,300,!1),e.json({success:!0,data:c,cached:!1})}catch(r){return console.error("Products list error:",r),e.json({success:!1,error:r.message},500)}});async function Ka(e,t,s,r){let a;return t==="true"?a=`
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
    `,(await e.prepare(a).bind(s,r).all()).results||[]}f.get("/api/products/popular",async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const r="products:popular",a=ke(r);if(a)return e.executionCtx.waitUntil((async()=>{try{const o=await Ga(t);re(r,o,3600),await gs(s,r,o,600,!1)}catch(o){console.error("[Cache Revalidate] Popular products error:",o)}})()),e.json({success:!0,data:a,cached:!0});const n=await Ga(t);return re(r,n,3600),await gs(s,r,n,600,!1),e.json({success:!0,data:n,cached:!1})}catch(r){return console.error("Popular products error:",r),e.json({success:!1,error:r.message},500)}});async function Ga(e){return(await e.prepare(`
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
  `).all()).results||[]}f.get("/api/search/suggestions",async e=>{const{DB:t}=e.env;try{const s=e.req.query("q")||"";if(!s.trim()||s.length<2)return e.json({success:!0,data:{suggestions:[]}});const r=`%${s}%`,a=await t.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(r).all(),n=await t.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(r,r).all(),o=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(n.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:o}})}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/api/products/search",async e=>{const{DB:t}=e.env;try{const s=e.req.query("q")||"",r=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!s.trim())return e.json({success:!1,error:"Search query is required"},400);const n=s.trim(),o=`${n}*`;try{if(await t.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='products_fts'
      `).first()){console.log("[Search] ⚡ FTS5 검색 사용:",o);const c=await t.prepare(`
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
        `).bind(o,r,a).all(),l=await t.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(o).first();return e.json({success:!0,data:{products:c.results||[],total:(l==null?void 0:l.total)||0,query:s,limit:r,offset:a,searchMethod:"fts5"}})}else throw console.log("[Search] ⚠️ FTS5 미사용 - LIKE 검색 fallback"),new Error("FTS5 not available")}catch(i){console.log("[Search] 💾 LIKE 검색 fallback:",i.message);const c=`%${n}%`,l=await t.prepare(`
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
      `).bind(c,c,c,c,c,r,a).all(),u=await t.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(c,c,c,c,c).first();return e.json({success:!0,data:{products:l.results||[],total:(u==null?void 0:u.total)||0,query:s,limit:r,offset:a,searchMethod:"like"}})}}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/api/products/:id",async e=>{const{DB:t,CACHE_KV:s}=e.env,r=e.req.param("id");try{const a=`product:detail:${r}`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0,cacheSource:"kv"});const o=ke(a);if(o)return e.executionCtx.waitUntil((async()=>{try{const c=await Va(t,r);re(a,c,1800),await s.put(a,JSON.stringify(c),{expirationTtl:3600})}catch(c){console.error("[Cache Revalidate] Product detail error:",c)}})()),e.json({success:!0,data:o,cached:!0,cacheSource:"memory"});const i=await Va(t,r);return i?(re(a,i,1800),await s.put(a,JSON.stringify(i),{expirationTtl:3600}),e.json({success:!0,data:i,cached:!1})):e.json({success:!1,error:"Product not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});async function Va(e,t){const s=await e.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, '리스터코퍼레이션') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(t).first();if(!s)return null;const r=await e.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(t).all();return{product:s,options:r.results}}f.get("/api/products/:id/options",_r(Er.microCache),async e=>{const{DB:t}=e.env,s=e.req.param("id");try{const r=await t.prepare(`
      SELECT id, product_id, option_type, option_value, price_adjustment, stock
      FROM product_options
      WHERE product_id = ? AND stock > 0
      ORDER BY option_type, option_value
    `).bind(s).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/products/:id/stock",_r(Er.microCache),async e=>{const{DB:t}=e.env,s=e.req.param("id");try{const r=await t.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(s).first();return r?e.json({success:!0,data:{productId:r.id,productName:r.name,stock:r.stock,available:r.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/streams/:streamId/products",async e=>{const{DB:t}=e.env,s=e.req.param("streamId");try{const r=await t.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(s).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/cart",j,async e=>{const{DB:t}=e.env,s=e.get("userId");try{const r=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:`장바구니 조회 실패: ${r.message}`},500)}});f.get("/api/cart/:userId",j,async e=>{const{DB:t}=e.env,s=e.get("userId"),r=e.req.param("userId");try{let a=await t.prepare("SELECT id FROM users WHERE id = ?").bind(s).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(r!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await t.prepare(`
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
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});f.post("/api/users",async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),{kakaoId:r,name:a,email:n,phone:o}=s;if(!r||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(r).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await t.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(r,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(s){return console.error("Error creating user:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/cart",w(),j,async e=>{const{DB:t}=e.env;try{const s=e.get("userId");if(!s)return e.json({success:!1,error:"Authentication required"},401);const r=await e.req.json(),{productId:a,optionId:n,quantity:o,priceSnapshot:i,liveStreamId:c}=r,l=s,u=await t.prepare("SELECT stock FROM products WHERE id = ?").bind(a).first();if(!u||u.stock<o)return e.json({success:!1,error:"Insufficient stock"},400);const d=await t.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(l,a,n||null,n||null).first();let m;if(d){const _=d.quantity+o;await t.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(_,i,d.id).run(),m=d.id}else m=(await t.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(l,a,n||null,o,i,c||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:m,isUpdate:!!d}})}catch(s){return console.error("[API /api/cart POST] Error:",s),console.error("[API /api/cart POST] Error message:",s.message),console.error("[API /api/cart POST] Error stack:",s.stack),e.json({success:!1,error:"Failed to add to cart: "+(s.message||"Unknown error")},500)}});f.delete("/api/cart/:cartItemId",j,async e=>{const{DB:t}=e.env,s=e.req.param("cartItemId");try{return await t.prepare("DELETE FROM cart_items WHERE id = ?").bind(s).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});f.delete("/api/cart/clear/:userId",j,vu("cart"),async e=>{const{DB:t}=e.env,s=e.req.param("userId");try{return await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(s).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});f.put("/api/cart/:cartItemId",j,async e=>{const{DB:t}=e.env,s=e.req.param("cartItemId");try{const r=await e.req.json(),{quantity:a,option_id:n}=r;if(a!==void 0){if(a<1)return e.json({success:!1,error:"Invalid quantity"},400);const o=await t.prepare(`
        SELECT ci.product_id, ci.option_id, p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.id = ?
      `).bind(s).first();if(!o)return e.json({success:!1,error:"Cart item not found"},404);let i=o.stock;if(o.option_id){const c=await t.prepare("SELECT stock FROM product_options WHERE id = ?").bind(o.option_id).first();c&&(i=c.stock)}if(i<a)return e.json({success:!1,error:"Insufficient stock"},400);await t.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,s).run()}if(n!==void 0){const o=await t.prepare("SELECT stock, price_adjustment FROM product_options WHERE id = ?").bind(n).first();if(!o)return e.json({success:!1,error:"Option not found"},404);const i=await t.prepare("SELECT quantity FROM cart_items WHERE id = ?").bind(s).first();if(!i)return e.json({success:!1,error:"Cart item not found"},404);if(o.stock<i.quantity)return e.json({success:!1,error:"Insufficient stock for selected option"},400);await t.prepare("UPDATE cart_items SET option_id = ? WHERE id = ?").bind(n,s).run()}return e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/orders",j,async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),{userId:r,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:l,recipientPhone:u,deliveryMemo:d,totalAmount:m,shippingFee:_,orderNumber:h,paymentKey:E,paymentMethod:v}=s;if(o&&o.length>0){const I=o.map(U=>U.productId),$=I.map(()=>"?").join(","),N=await t.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${$})
      `).bind(...I).all(),L=new Map(N.results.map(U=>[U.id,U])),q=[],ae=[];try{for(const U of o){const he=L.get(U.productId);if(!he)throw new Error(`상품을 찾을 수 없습니다 (ID: ${U.productId})`);if(he.stock-(he.reserved_stock||0)<U.quantity)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${he.name})`);if((await t.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind(U.quantity,U.productId,U.quantity).run()).meta.changes===0)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${he.name})`);console.log(`[Stock] ✅ 재고 예약 성공: ${he.name} (${U.quantity}개)`),ae.push({product_id:U.productId,quantity:U.quantity}),q.push({product_id:U.productId,option_id:U.optionId||null,quantity:U.quantity,price:U.price,product_name:he.name,product_stock:he.stock})}}catch(U){if(console.error("[Stock] ❌ 재고 예약 실패:",U.message),ae.length>0){console.log(`[Stock] 🔄 ${ae.length}개 상품 예약 롤백 시작...`);for(const he of ae)await t.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(he.quantity,he.product_id).run();console.log("[Stock] ✅ 예약 롤백 완료")}return e.json({success:!1,error:U.message},400)}const ee=new Date,O=ee.getFullYear().toString().slice(-2),le=(ee.getMonth()+1).toString().padStart(2,"0"),G=ee.getDate().toString().padStart(2,"0"),H=`${O}${le}${G}`,V=Math.random().toString(36).substring(2,7).toUpperCase(),ue=h||`ORD-${H}-${V}`,Tr=c?`${i} ${c}`:i,Ge=new Date(Date.now()+600*1e3).toISOString(),Ps=(await t.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(ue,r||null,m||0,"pending","pending",Tr||null,l||null,u||null,d||null,E||null,Ge).run()).meta.last_row_id;for(const U of q)await t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ps,U.product_id,U.option_id,U.quantity,U.price,U.product_name).run();return console.log(`[Order] ✅ 주문 생성 완료: ${ue} (예약 만료: ${Ge})`),e.json({success:!0,data:{orderId:Ps,orderNumber:ue,totalAmount:m}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const b=a.map(()=>"?").join(","),g=await t.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${b})
    `).bind(...a).all();if(g.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const I of g.results)if(I.product_stock<I.quantity)return e.json({success:!1,error:`Insufficient stock for ${I.product_name}`},400);const S=g.results.reduce((I,$)=>I+$.price_snapshot*$.quantity,0),y=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,k=(await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(y,r,S,n.address,n.name,n.phone).run()).meta.last_row_id,R=[];for(const I of g.results){let $=!1,N="";for(let L=0;L<3;L++){const q=await t.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(I.product_id).first();if(!q){N=`상품을 찾을 수 없습니다: ${I.product_name}`;break}const ae=q.stock,ee=q.version;if(ae<I.quantity){N=`재고 부족: ${I.product_name} (남은 재고: ${ae}개)`;break}if((await t.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND version = ?
            AND stock >= ?
            AND is_active = 1
        `).bind(I.quantity,I.product_id,ee,I.quantity).run()).meta.changes>0){$=!0,console.log(`[재고] ✅ 재고 차감 성공: ${I.product_name} (수량: ${I.quantity}, 버전: ${ee} → ${ee+1})`);break}console.warn(`[재고] ⚠️ 버전 충돌 감지 (시도 ${L+1}/3): ${I.product_name}`),L<2?await new Promise(le=>setTimeout(le,50*(L+1))):N="주문 처리 중 오류 발생. 잠시 후 다시 시도해주세요. (동시 주문 처리 중)"}if(!$)return e.json({success:!1,error:N||"주문 처리 중 오류가 발생했습니다."},N.includes("재고 부족")?400:409);R.push(t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(k,I.product_id,I.option_id,I.quantity,I.price_snapshot,I.product_name))}R.push(t.prepare(`DELETE FROM cart_items WHERE id IN (${b})`).bind(...a)),await t.batch(R);try{const I=g.results.map(L=>L.product_id),$=I.map(()=>"?").join(","),N=await t.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${$}) AND seller_id IS NOT NULL
      `).bind(...I).all();for(const L of N.results){const q=L.seller_id;await wu(t,q,y,buyerName||shippingName||"고객",S)}}catch(I){console.error("[Order] Notification error:",I)}return e.json({success:!0,data:{orderId:k,orderNumber:y,totalAmount:S}})}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/api/streams/:streamId/current-product",async e=>{const{DB:t,LIVE_CACHE:s}=e.env,r=e.req.param("streamId");try{const a=`current-product:${r}`,n=await po(s,a,3);if(n)return e.json({success:!0,data:n});const o=await t.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();if(!o||!o.current_product_id)return await ir(s,a,null,3),e.json({success:!0,data:null});const i=await t.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(o.current_product_id).first(),c=await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(),l={product:i,options:c.results};return await ir(s,a,l,3),e.json({success:!0,data:l})}catch(a){return e.json({success:!1,error:a.message},500)}});f.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:t}=e.env,s=e.req.param("streamId"),r=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${s}`,n=`current-product:${s}`,o=25e3,i=Date.now();for(;Date.now()-i<o;){const c=await t.get(a)||"0";if(c!==r){const l=await po(t,n,30);return e.json({success:!0,timestamp:c,data:l,changed:!0})}await new Promise(l=>setTimeout(l,1e3))}return e.json({success:!0,timestamp:r,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});f.get("/api/seller/dashboard/stats",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=s.sellerId,a=e.req.query("period")||"7d";let n=7;a==="30d"?n=30:a==="90d"&&(n=90);const o=await t.prepare(`
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
    `).bind(r,`-${n} days`).all(),i=await t.prepare(`
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
    `).bind(r,`-${n} days`).first(),c=await t.prepare(`
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
    `).bind(r,`-${n} days`).all();return e.json({success:!0,data:{period:a,daily:o.results||[],summary:i||{},topProducts:c.results||[]}})}catch(r){return console.error("Error loading seller dashboard stats:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/analytics/products",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=s.sellerId,a=await t.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading product analytics:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/streams",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=s.sellerId,a=await t.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading seller streams:",r),e.json({success:!1,error:r.message},500)}});f.post("/api/seller/streams",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:r,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:l,seller_instagram:u,seller_youtube:d,seller_facebook:m}=await e.req.json();let _=n,h="youtube",E=null,v=null,b=i;if(o&&!_&&(_=Ko(o),!_))if(_=Go(o),E=Vo(o),v=Au(o),_)h="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!b&&_&&h==="youtube"&&(b=`https://img.youtube.com/vi/${_}/maxresdefault.jpg`),!r||!_)return e.json({success:!1,error:"Title and live stream URL are required"},400);const g=await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,_,l||"scheduled",c||null,s.sellerId,u||null,d||null,m||null,h,E,v,b||null).run(),S=await t.prepare(`
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
    `).bind(g.meta.last_row_id).first(),y=await t.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(s.sellerId).first();try{const{sendLiveStreamCreatedEmail:x}=await Promise.resolve().then(()=>Lu);x({streamId:g.meta.last_row_id,title:r,sellerName:(y==null?void 0:y.display_name)||(y==null?void 0:y.username)||"알 수 없음",platform:h,scheduledAt:c,status:l||"scheduled"}).then(k=>{k.success?console.log(`[Email] Live stream notification sent for stream #${k.meta.last_row_id}`):console.error("[Email] Failed to send notification:",k.error)}).catch(k=>{console.error("[Email] Exception while sending notification:",k)})}catch(x){console.error("[Email] Failed to send live stream notification:",x)}return await Ft(e.env,Ut.LIVE_STREAMS),e.json({success:!0,data:S})}catch(r){return e.json({success:!1,error:r.message},500)}});f.put("/api/seller/streams/:id",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:l,status:u,seller_instagram:d,seller_youtube:m,seller_facebook:_}=await e.req.json(),h=[],E=[];if(n!==void 0&&(h.push("title = ?"),E.push(n)),o!==void 0&&(h.push("description = ?"),E.push(o)),c!==void 0||i!==void 0){let v=i,b="youtube",g=null;if(c&&(v=Ko(c),!v))if(v=Go(c),g=Vo(c),v)b="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);v!==void 0&&(h.push("youtube_video_id = ?"),E.push(v),h.push("platform = ?"),E.push(b),b==="tiktok"&&g&&(h.push("tiktok_username = ?"),E.push(g)))}return u!==void 0&&(h.push("status = ?"),E.push(u)),l!==void 0&&(h.push("scheduled_at = ?"),E.push(l)),d!==void 0&&(h.push("seller_instagram = ?"),E.push(d)),m!==void 0&&(h.push("seller_youtube = ?"),E.push(m)),_!==void 0&&(h.push("seller_facebook = ?"),E.push(_)),h.length===0?e.json({success:!1,error:"No fields to update"},400):(h.push("updated_at = datetime('now')"),await t.prepare(`
      UPDATE live_streams SET ${h.join(", ")} WHERE id = ?
    `).bind(...E,r).run(),await Ft(e.env,Ut.LIVE_STREAMS),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});f.delete("/api/seller/streams/:id",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");return await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first()?(await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),await Ft(e.env,Ut.LIVE_STREAMS),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/seller/youtube/create-live",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:r,description:a,scheduled_at:n}=await e.req.json();if(!r)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await Ru({accessToken:o},r,a||""),l=(await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,i.broadcastId,n||null,s.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await Is(t,s.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${r} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${l}`),e.json({success:!0,data:{streamId:l,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(r){return console.error("[YouTube Live] Create broadcast error:",r),e.json({success:!1,error:r.message},500)}});f.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("streamId"),a=await t.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const o=a.youtube_broadcast_id||a.youtube_video_id;return o?(await Iu({accessToken:n},o),await t.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await Is(t,s.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(r){return console.error("[YouTube Live] End broadcast error:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("streamId"),a=await t.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=a.youtube_video_id;if(!n)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const o=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!o&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await Ou({apiKey:o,accessToken:i},n);return e.json({success:!0,data:{streamId:r,videoId:n,stats:c}})}catch(r){return console.error("[YouTube Live] Get stats error:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("streamId"),a=e.req.query("pageToken"),n=await t.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first();if(!n)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=n.youtube_live_chat_id;if(!o)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await Pu({accessToken:i},o,a);return e.json({success:!0,data:c})}catch(r){return console.error("[YouTube Live] Get chat messages error:",r),e.json({success:!1,error:r.message},500)}});f.post("/api/admin/streams",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:r,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!r)return e.json({success:!1,error:"제목은 필수입니다"},400);const l=o||"youtube";if(l==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(l==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const u=await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r,a||null,n||null,l,i||null,c||"scheduled",s.sellerId||null).run();return await Ft(e.env,Ut.LIVE_STREAMS),e.json({success:!0,data:{id:u.meta.last_row_id,title:r,description:a,youtube_video_id:n,platform:l,tiktok_username:i,status:c||"scheduled"}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.put("/api/admin/streams/:id",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:l}=await e.req.json();return await t.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,l,r).run(),await Ft(e.env,Ut.LIVE_STREAMS),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await t.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a,s.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(a).all();await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,r).run();const{LIVE_CACHE:c}=e.env,l=`product-timestamp:${r}`,u=`current-product:${r}`,d=Date.now().toString();await c.put(l,d),await ir(c,u,{product:o,options:i.results},30);try{await Lt(e.env).changeCurrentProduct(parseInt(r),a),console.log(`🔥 Firebase: Product changed for stream ${r} to ${a}`)}catch(m){console.error("⚠️ Firebase sync failed (non-blocking):",m)}return e.json({success:!0,data:{product:o,options:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.delete("/api/admin/streams/:id",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");return await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),await Ft(e.env,Ut.LIVE_STREAMS),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:t}=e.env,s=e.req.param("streamId");try{const{productId:r}=await e.req.json(),a=await t.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r,s).run();const{LIVE_CACHE:o}=e.env,i=`product-timestamp:${s}`,c=`current-product:${s}`,l=Date.now().toString();return await o.put(i,l),await ir(o,c,{product:a,options:n.results},30),e.json({success:!0,data:{product:a,options:n.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/wishlists",w(),async e=>{const{DB:t}=e.env;try{const{userId:s,productId:r}=await e.req.json();if(!s||!r)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await t.prepare("SELECT id FROM users WHERE id = ?").bind(s).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const n=await t.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!n)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s,r).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await t.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(s,r).run();return e.json({success:!0,data:{id:i.meta.last_row_id,userId:s,productId:r,productName:n.name}})}catch(s){return console.error("[Wishlist] Add error:",s),e.json({success:!1,error:s.message},500)}});f.delete("/api/wishlists/:id",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),{userId:r}=e.req.query();return r?await t.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(s,r).first()?(await t.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(s,r).run(),e.json({success:!0,message:"찜 목록에서 삭제되었습니다."})):e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(s){return console.error("[Wishlist] Delete error:",s),e.json({success:!1,error:s.message},500)}});f.delete("/api/wishlists/product/:productId",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("productId"),{userId:r}=e.req.query();return r?(await t.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,s).run()).meta.changes===0?e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!0,message:"찜 목록에서 삭제되었습니다."}):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(s){return console.error("[Wishlist] Delete by product error:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/wishlists/:userId",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("userId"),r=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0"),{results:n}=await t.prepare(`
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
    `).bind(s,r,a).all(),o=await t.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(s).first();return e.json({success:!0,data:{items:n,total:(o==null?void 0:o.count)||0,limit:r,offset:a}})}catch(s){return console.error("[Wishlist] Get error:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/wishlists/check/:userId/:productId",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("userId"),r=e.req.param("productId"),a=await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s,r).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(s){return console.error("[Wishlist] Check error:",s),e.json({success:!1,error:s.message},500)}});f.delete("/api/shipping-addresses/:id",j,async e=>{const{DB:t}=e.env,s=e.req.param("id");e.get("userId");try{return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(s,userId).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/seller/products",async e=>{const{DB:t,CACHE_KV:s}=e.env,r=await D(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:products`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(r.sellerId).all();return await s.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});f.post("/api/seller/upload-image",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{image:r,filename:a}=await e.req.json();if(!r)return e.json({success:!1,error:"Image data is required"},400);const n=r.match(/^data:(image\/[\w+]+);base64,/);if(!n)return e.json({success:!1,error:"잘못된 이미지 형식입니다."},400);const o=n[1],i=r.replace(/^data:image\/\w+;base64,/,"");let c;try{c=Uint8Array.from(atob(i),m=>m.charCodeAt(0))}catch{return e.json({success:!1,error:"이미지 디코딩 실패"},400)}const l=10*1024*1024;if(c.length>l)return e.json({success:!1,error:`파일 크기가 너무 큽니다. 최대 ${l/1024/1024}MB까지 허용됩니다.`},400);const u=await ec(c.buffer);if(!u.valid)return e.json({success:!1,error:"유효하지 않은 이미지 파일입니다."},400);const d=e.env.IMAGES;if(d){console.log("[Image Upload] Using R2 storage");const m=Zi(a||"upload.jpg"),_=`products/${s.sellerId}/${m}`;await d.put(_,c,{httpMetadata:{contentType:u.detectedType||o}});const h=`/api/images/${_}`;return e.json({success:!0,url:h,variants:{thumbnail:`${h}?width=200&format=webp`,medium:`${h}?width=800&format=webp`,large:`${h}?width=1600&format=webp`,original:h},storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),r.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:r,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(r){return console.error("[Image Upload] Error:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/images/*",async e=>{var t;try{const s=e.env.IMAGES;if(!s)return e.json({success:!1,error:"R2 not configured"},503);const r=e.req.path.replace("/api/images/",""),a=e.req.query("width"),n=e.req.query("format"),o=e.req.query("quality")||"85",i=await s.get(r);if(!i)return e.notFound();const c={"Content-Type":((t=i.httpMetadata)==null?void 0:t.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"};if(a||n){const l=[];a&&l.push(`width=${a}`),n&&l.push(`format=${n}`),o&&l.push(`quality=${o}`),c["cf-resize"]=l.join(",")}return new Response(i.body,{headers:c})}catch(s){return console.error("[Image Get] Error:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/seller/products",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{name:r,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:l,category:u,live_stream_id:d,is_active:m}=await e.req.json();if(!r||!n)return e.json({success:!1,error:"Name and price are required"},400);if(d&&!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d,s.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const _=await t.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,n,o||null,i||0,c||null,l||0,u||null,d||null,s.sellerId,m!==void 0?m:1).run(),h=await t.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(_.meta.last_row_id).first();return await Rs(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0,data:h})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{options:a}=await e.req.json();if(!await t.prepare("SELECT id FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);if(!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"Options array is required"},400);await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run();for(const i of a){const{option_type:c,option_value:l,price_adjustment:u,stock:d}=i;!c||!l||await t.prepare(`
        INSERT INTO product_options (
          product_id, option_type, option_value, price_adjustment, stock
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(r,c,l,u||0,d||0).run()}const o=await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();return await Rs(e.env.CACHE_KV,`product:detail:${r}`,`product:options:${r}`),e.json({success:!0,data:o.results,message:`${o.results.length} options saved successfully`})}catch(r){return e.json({success:!1,error:r.message},500)}});f.delete("/api/seller/products/:id/options/:optionId",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=e.req.param("optionId");return await t.prepare(`
      SELECT po.id 
      FROM product_options po
      JOIN products p ON po.product_id = p.id
      WHERE po.id = ? AND po.product_id = ? AND p.seller_id = ?
    `).bind(a,r,s.sellerId).first()?(await t.prepare("DELETE FROM product_options WHERE id = ?").bind(a).run(),await Rs(e.env.CACHE_KV,`product:detail:${r}`,`product:options:${r}`),e.json({success:!0,message:"Option deleted successfully"})):e.json({success:!1,error:"Option not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/seller/products/:id",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(r,s.sellerId).first();if(!a)return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();return e.json({success:!0,data:{...a,options:n.results||[]}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.put("/api/seller/products/:id",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:l,stock:u,category:d,is_active:m,live_stream_id:_}=await e.req.json(),h=[],E=[];if(n!==void 0&&(h.push("name = ?"),E.push(n)),o!==void 0&&(h.push("description = ?"),E.push(o)),i!==void 0&&(h.push("price = ?"),E.push(i)),c!==void 0&&(h.push("original_price = ?"),E.push(c),i!==void 0&&c)){const b=Math.round((c-i)/c*100);h.push("discount_rate = ?"),E.push(b)}if(l!==void 0&&(h.push("image_url = ?"),E.push(l)),u!==void 0&&(h.push("stock = ?"),E.push(u)),d!==void 0&&(h.push("category = ?"),E.push(d)),m!==void 0&&(h.push("is_active = ?"),E.push(m?1:0)),_!==void 0&&(h.push("live_stream_id = ?"),E.push(_||null)),h.push("updated_at = CURRENT_TIMESTAMP"),E.push(r,s.sellerId),h.length===1)return e.json({success:!1,error:"No fields to update"},400);await t.prepare(`UPDATE products SET ${h.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...E).run();const v=await t.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(r).first();return await Rs(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0,data:v})}catch(r){return e.json({success:!1,error:r.message},500)}});f.delete("/api/seller/products/:id",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await t.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(),await t.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(),await t.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(),await t.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).run(),await Rs(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await t.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();return e.json({success:!0,data:n.results})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const l=await t.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:l.meta.last_row_id,product_id:r,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("productId"),a=e.req.param("optionId");return await t.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first()?(await t.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,r).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/seller/stats",async e=>{const{DB:t,CACHE_KV:s}=e.env,r=await D(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:stats`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(),i=await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(),c=await t.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(),l=await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(r.sellerId).first(),u=await t.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(),d=await t.prepare(`
      SELECT SUM(viewer_count) as total
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(),m=(d==null?void 0:d.total)||0,_={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:l.count||0,totalRevenue:l.total||0,activeStreams:u.count||0,totalViewers:m};return await s.put(a,JSON.stringify(_),{expirationTtl:60}),e.json({success:!0,data:_})}catch(a){return e.json({success:!1,error:a.message},500)}});f.get("/api/seller/stats/sales",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.query("period")||"daily";let a,n,o;switch(r){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await t.prepare(`
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
    `).bind(s.sellerId).all();return e.json({success:!0,data:{period:r,sales:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/seller/stats/products",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await t.prepare(`
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
    `).bind(s.sellerId,r).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/seller/business-info",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{business_number:r,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:l,phone:u,email:d}=await e.req.json();if(!r||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const m=await t.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();let _;return m?_=await t.prepare(`
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
      `).bind(r,a,n,o,i,c,l,u,d,s.sellerId).run():_=await t.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(s.sellerId,r,a,n,o,i,c,l,u,d).run(),e.json({success:!0,data:{id:m?m.id:_.meta.last_row_id,seller_id:s.sellerId,business_number:r,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(r){return console.error("사업자 정보 등록 오류:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/business-info",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(r){return e.json({success:!1,error:r.message},500)}});f.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);const r=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});f.get("/api/admin/seller-business",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/orders",j,async e=>{const{DB:t}=e.env,s=e.get("userId");try{const r=await t.prepare(`
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
    `).bind(s).all(),a=new Map;for(const o of r.results){const i=o.id;a.has(i)||a.set(i,{id:o.id,user_id:o.user_id,order_number:o.order_number,status:o.status,total_amount:o.total_amount,shipping_fee:o.shipping_fee,payment_method:o.payment_method,payment_key:o.payment_key,shipping_address:o.shipping_address,shipping_name:o.shipping_name,shipping_phone:o.shipping_phone,delivery_request:o.delivery_request,created_at:o.created_at,updated_at:o.updated_at,items:[]}),o.item_id&&a.get(i).items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value})}const n=Array.from(a.values());return e.json({success:!0,data:n})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/orders/user/:userId",j,async e=>{const{DB:t}=e.env,s=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==s)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await t.prepare(`
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
    `).bind(s).all(),n=new Map;for(const i of a.results){const c=i.id;n.has(c)||n.set(c,{id:i.id,user_id:i.user_id,order_number:i.order_number,status:i.status,total_amount:i.total_amount,shipping_fee:i.shipping_fee,payment_method:i.payment_method,payment_key:i.payment_key,shipping_address:i.shipping_address,shipping_name:i.shipping_name,shipping_phone:i.shipping_phone,delivery_request:i.delivery_request,created_at:i.created_at,updated_at:i.updated_at,items:[]}),i.item_id&&n.get(c).items.push({id:i.item_id,product_id:i.product_id,option_id:i.option_id,quantity:i.quantity,price:i.item_price,product_name:i.product_name,image_url:i.image_url,option_value:i.option_value})}const o=Array.from(n.values());return e.json({success:!0,data:o})}catch(a){return e.json({success:!1,error:a.message},500)}});f.get("/api/orders/:orderNumber",j,async e=>{const{DB:t}=e.env,s=e.req.param("orderNumber");try{const r=await t.prepare(`
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
    `).bind(s).all();if(r.results.length===0)return e.json({success:!1,error:"Order not found"},404);const a=r.results[0],n={id:a.id,user_id:a.user_id,order_number:a.order_number,status:a.status,total_amount:a.total_amount,shipping_fee:a.shipping_fee,payment_method:a.payment_method,payment_key:a.payment_key,shipping_address:a.shipping_address,shipping_name:a.shipping_name,shipping_phone:a.shipping_phone,delivery_request:a.delivery_request,created_at:a.created_at,updated_at:a.updated_at,items:[]};for(const o of r.results)o.item_id&&n.items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value});return e.json({success:!0,data:n})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/orders/:orderId/cancel",j,async e=>{const{DB:t}=e.env,s=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await t.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(s).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(s).all();if(o.results.length>0){const i=o.results.map(c=>t.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity,c.product_id));await t.batch(i)}return await t.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,s).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:s,reason:a,itemsRestored:o.results.length}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/streams/:streamId/viewer/join",async e=>{const{SESSION_KV:t}=e.env;try{const s=e.req.param("streamId"),r=e.req.header("X-Session-ID")||crypto.randomUUID(),a=`stream:${s}:viewer:${r}`;return await t.put(a,Date.now().toString(),{expirationTtl:60}),e.json({success:!0,sessionId:r,message:"Viewer session updated"})}catch(s){return console.error("[Viewer Join] Error:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:t,SESSION_KV:s}=e.env;try{const r=e.req.param("streamId");let a=null,n=null;try{a=await t.prepare("SELECT id, manual_viewer_count FROM live_streams WHERE id = ?").bind(r).first(),a&&(n=a.manual_viewer_count)}catch{console.warn("[Viewer Count] manual_viewer_count column not found, using fallback query"),a=await t.prepare("SELECT id FROM live_streams WHERE id = ?").bind(r).first()}if(!a)return e.json({success:!1,error:"Stream not found"},404);if(n!=null)return e.json({success:!0,data:{viewer_count:n,is_manual:!0}});const o=`stream:${r}:viewer:`,c=(await s.list({prefix:o})).keys.length;return e.json({success:!0,data:{viewer_count:c,is_manual:!1}})}catch(r){return console.error("[Viewer Count] Error:",r),e.json({success:!1,error:r.message},500)}});f.put("/api/streams/:streamId/viewer-count",j,async e=>{const{DB:t}=e.env,{userId:s,userType:r}=e.get("user");try{const a=e.req.param("streamId"),{manual_count:n}=await e.req.json();if(r!=="seller")return e.json({success:!1,error:"Only sellers can manipulate viewer count"},403);const o=await t.prepare(`
      SELECT ls.id, s.can_manipulate_stats
      FROM live_streams ls
      JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.id = ? AND ls.seller_id = ?
    `).bind(a,s).first();return o?o.can_manipulate_stats?(await t.prepare("UPDATE live_streams SET manual_viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{manual_count:n,message:n===null?"Reverted to actual viewer count":"Manual viewer count updated"}})):e.json({success:!1,error:"You do not have permission to manipulate stats. Please contact admin for approval."},403):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(a){return console.error("[Update Viewer Count] Error:",a),e.json({success:!1,error:a.message},500)}});f.post("/api/streams/:streamId/fake-cart-notification",j,async e=>{const{DB:t}=e.env,{userId:s,userType:r}=e.get("user");try{const a=e.req.param("streamId"),{product_name:n,quantity:o=1}=await e.req.json();if(r!=="seller")return e.json({success:!1,error:"Only sellers can send fake notifications"},403);const i=await t.prepare(`
      SELECT ls.id, s.can_manipulate_stats, s.display_name
      FROM live_streams ls
      JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.id = ? AND ls.seller_id = ?
    `).bind(a,s).first();if(!i)return e.json({success:!1,error:"Stream not found or unauthorized"},404);if(!i.can_manipulate_stats)return e.json({success:!1,error:"You do not have permission to send fake notifications. Please contact admin for approval."},403);const c=`🎉 ${n} ${o}개가 장바구니에 추가되었습니다!`;try{await(await Promise.resolve().then(()=>il)).getDatabase().ref(`chats/stream${a}`).push({userId:0,userName:"System",userType:"system",message:c,timestamp:Date.now(),isSeller:!1,isAdmin:!1}),console.log(`[Fake Cart Notification] ✅ Message sent to Firebase: ${c}`)}catch(l){console.error("[Fake Cart Notification] Firebase error:",l)}return e.json({success:!0,data:{message:c,note:"Fake notification sent to chat"}})}catch(a){return console.error("[Fake Cart Notification] Error:",a),e.json({success:!1,error:a.message},500)}});f.post("/api/payment/stripe/create-intent",async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),{amount:r,currency:a="usd",metadata:n={}}=s;if(console.log("[Stripe] Payment Intent 생성 요청:",{amount:r,currency:a,metadata:n}),!r||r<=0)return e.json({success:!1,error:"Invalid amount. Amount must be greater than 0."},400);const o=e.env.STRIPE_SECRET_KEY;if(!o)return console.error("[Stripe] ❌ STRIPE_SECRET_KEY 환경 변수가 설정되지 않음"),e.json({success:!1,error:"Stripe is not configured. Please contact support."},500);const i=(await Promise.resolve().then(()=>Wf)).default,l=await new i(o,{apiVersion:"2024-11-20.acacia",httpClient:i.createFetchHttpClient()}).paymentIntents.create({amount:Math.round(r),currency:a.toLowerCase(),automatic_payment_methods:{enabled:!0},metadata:{...n,timestamp:new Date().toISOString()}});return console.log("[Stripe] ✅ Payment Intent 생성 완료:",l.id),e.json({success:!0,clientSecret:l.client_secret,paymentIntentId:l.id})}catch(s){return console.error("[Stripe] ❌ Payment Intent 생성 실패:",s),e.json({success:!1,error:s.message||"Failed to create payment intent",details:s.type||"unknown_error"},500)}});f.post("/api/payments/confirm",async e=>{var r;const{DB:t}=e.env;let s=null;try{s=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=s;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!n,amount:!!o}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await t.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",n),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:n},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(o)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(o),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(o),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const l="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const u={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(u,null,2)),console.log("[Payment] 📊 amount 타입:",typeof u.amount),console.log("[Payment] 📊 amount 값:",u.amount);const d=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:l,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(u)}),m=await d.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",d.status),console.log("  - 응답 OK?:",d.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(m).substring(0,300)),!d.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",d.status),console.error("[Payment] 에러 코드:",m.code),console.error("[Payment] 에러 메시지:",m.message),console.error("[Payment] 전체 응답:",JSON.stringify(m,null,2)),e.json({success:!1,error:m.message||"결제 승인에 실패했습니다.",code:m.code,tossError:m},d.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await t.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            reservation_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const _=await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();if(_.results.length>0){console.log(`[Stock] 🔒 재고 확정 시작: ${_.results.length}개 상품`);const h=_.results.map(b=>t.prepare(`
            UPDATE products 
            SET stock = stock - ?,
                reserved_stock = reserved_stock - ?
            WHERE id = ?
          `).bind(b.quantity,b.quantity,b.product_id)),E=await t.batch(h);let v=0;for(let b=0;b<E.length;b++)if(E[b].meta.changes>0){v++;const g=_.results[b];console.log(`[Stock] ✅ 재고 확정: product_id=${g.product_id}, quantity=${g.quantity}`)}else{const g=_.results[b];console.error(`[Stock] ⚠️ 재고 확정 실패: product_id=${g.product_id}`)}console.log(`[Stock] ✅ 재고 확정 완료: ${v}/${_.results.length}개 성공`);try{const b=_.results.map(y=>y.product_id),g=b.map(()=>"?").join(","),S=await t.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${g})
          `).bind(...b).all();for(const y of S.results){const x=y.stock_alert_threshold||10,k=y.stock||0,R=y.reserved_stock||0,I=k-R;I<=x&&y.seller_id&&(await Bo(t,y.seller_id,y.name,I,x),console.log(`[Low Stock Alert] 📢 ${y.name}: 가용재고 ${I}개 (임계값 ${x}개)`))}}catch(b){console.error("[Low Stock Alert] ⚠️ 알림 전송 실패:",b)}}try{const h=i.id,E=await kc(e.env,h);E.success?console.log(`[Payment] ✅ 알림톡 발송 성공 (주문 ${h})`):console.warn(`[Payment] ⚠️ 알림톡 발송 실패 (주문 ${h}):`,E.reason||E.error)}catch(h){console.error("[Payment] ⚠️ 알림톡 발송 중 오류:",h)}}catch(_){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",_)}if(e.env.DISCORD_WEBHOOK_URL)try{await al(e.env.DISCORD_WEBHOOK_URL,"결제 성공",`주문번호 ${n} 결제 완료`,{주문번호:n,결제금액:`₩${Number(o).toLocaleString()}`,결제키:a.substring(0,20)+"...",사용자ID:i.user_id})}catch(_){console.error("[Discord] 결제 성공 알림 실패:",_)}return e.json({success:!0,data:m})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:s==null?void 0:s.orderId,error:a.message,stack:(r=a.stack)==null?void 0:r.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});f.post("/api/payments/rollback",async e=>{var s;const{DB:t}=e.env;try{const{orderId:r,reason:a}=await e.req.json();if(console.log("========================================"),console.log("[Rollback] 🔄 재고 예약 해제 시작"),console.log("========================================"),console.log("[Rollback] 주문 번호:",r),console.log("[Rollback] 사유:",a||"결제 실패"),!r)return e.json({success:!1,error:"주문 번호가 필요합니다."},400);const n=await t.prepare("SELECT id, order_number, status FROM orders WHERE order_number = ?").bind(r).first();if(!n)return console.warn("[Rollback] ⚠️ 주문을 찾을 수 없음:",r),e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(n.status==="paid")return console.warn("[Rollback] ⚠️ 이미 결제 완료된 주문:",r),e.json({success:!1,error:"이미 결제가 완료된 주문입니다."},400);console.log("[Rollback] ✅ 주문 확인됨:",n.order_number);const o=await t.prepare(`
      SELECT product_id, quantity 
      FROM order_items 
      WHERE order_id = ?
    `).bind(n.id).all();if(o.results.length===0)return console.warn("[Rollback] ⚠️ 주문 아이템 없음"),e.json({success:!1,error:"주문 아이템을 찾을 수 없습니다."},404);console.log(`[Rollback] 📦 ${o.results.length}개 상품 예약 해제 시작...`);const i=o.results.map(u=>t.prepare(`
        UPDATE products 
        SET reserved_stock = CASE 
          WHEN reserved_stock >= ? THEN reserved_stock - ?
          ELSE 0
        END
        WHERE id = ?
      `).bind(u.quantity,u.quantity,u.product_id)),c=await t.batch(i);let l=0;for(let u=0;u<c.length;u++)if(c[u].meta.changes>0){l++;const d=o.results[u];console.log(`[Rollback] ✅ 예약 해제: product_id=${d.product_id}, quantity=${d.quantity}`)}return console.log(`[Rollback] ✅ 예약 해제 완료: ${l}/${o.results.length}개 성공`),await t.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'failed',
          reservation_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(),console.log("[Rollback] ✅ 주문 취소 완료:",r),e.json({success:!0,message:"재고 예약이 해제되었습니다.",data:{orderId:r,releasedItems:l}})}catch(r){return console.error("[Rollback] ❌ 예약 해제 실패:",{error:r.message,stack:(s=r.stack)==null?void 0:s.substring(0,500)}),e.json({success:!1,error:"재고 예약 해제 중 오류가 발생했습니다.",details:r.message},500)}});f.post("/api/chat/:liveStreamId/messages",w(),async e=>{const{DB:t}=e.env,s=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:l}=r;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await t.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(s,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const u=["씨발","개새끼","병신","좆","시발"];let d=i;u.forEach(_=>{const h=new RegExp(_,"gi");d=d.replace(h,"*".repeat(_.length))});const m=await t.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(s,a||null,n,o||null,d,c?1:0,l?1:0).run();return e.json({success:!0,data:{id:m.meta.last_row_id,message:d}})}catch(r){return console.error("Error sending chat message:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/chat/:liveStreamId/messages",w(),async e=>{const{DB:t}=e.env,s=e.req.param("liveStreamId"),r=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
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
    `;const o=[s];r&&(n+=" AND id > ?",o.push(Number(r))),n+=" ORDER BY created_at DESC LIMIT ?",o.push(a);const c=(await t.prepare(n).bind(...o).all()).results.reverse();return e.json({success:!0,data:c})}catch(n){return console.error("Error fetching chat messages:",n),e.json({success:!1,error:n.message},500)}});f.delete("/api/chat/:liveStreamId/messages/:messageId",w(),async e=>{const{DB:t}=e.env,s=e.req.param("messageId");try{return await t.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(s).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(r){return console.error("Error deleting chat message:",r),e.json({success:!1,error:r.message},500)}});f.post("/api/chat/:liveStreamId/ban",w(),async e=>{const{DB:t}=e.env,s=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=r;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const l=new Date;l.setMinutes(l.getMinutes()+i),c=l.toISOString()}return await t.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(s,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(r){return console.error("Error banning user:",r),e.json({success:!1,error:r.message},500)}});f.delete("/api/chat/:liveStreamId/ban/:userId",w(),async e=>{const{DB:t}=e.env,s=e.req.param("liveStreamId"),r=e.req.param("userId");try{return await t.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(s,r).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});async function Cu(e,t,s){try{const r=new TextEncoder,a=r.encode(s),n=r.encode(e),o=await crypto.subtle.importKey("raw",a,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),i=await crypto.subtle.sign("HMAC",o,n),c=Array.from(new Uint8Array(i)),l=btoa(String.fromCharCode(...c));return t===l}catch(r){return console.error("[Webhook] 서명 검증 오류:",r),!1}}f.post("/api/payments/webhook",async e=>{const{DB:t}=e.env;try{const s=e.req.header("toss-signature"),r=await e.req.text();if(s&&e.env.TOSS_SECRET_KEY){if(!await Cu(r,s,e.env.TOSS_SECRET_KEY))return console.error("[Webhook] ❌ 서명 검증 실패 - 위조된 웹훅 요청"),e.json({success:!1,error:"Invalid signature"},401);console.log("[Webhook] ✅ 서명 검증 성공")}else console.warn("[Webhook] ⚠️ 서명 검증 건너뜀 (개발 환경 또는 서명 없음)");const a=JSON.parse(r);switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:a.eventType,orderId:a.orderId,status:a.status,timestamp:new Date().toISOString()}),a.eventType){case"PAYMENT_STATUS_CHANGED":await Du(t,a);break;case"VIRTUAL_ACCOUNT_ISSUED":await ku(t,a);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",a.eventType)}return e.json({success:!0})}catch(s){return console.error("[Webhook] ❌ 웹훅 처리 실패:",s.message),e.json({success:!1,error:s.message},500)}});async function Du(e,t){const{orderId:s,status:r,paymentKey:a}=t;console.log("[Webhook] 결제 상태 변경:",{orderId:s,status:r}),await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(r,JSON.stringify(t),a).run(),(r==="DONE"||r==="completed")&&(await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(s).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",s))}async function ku(e,t){const{orderId:s,virtualAccount:r}=t;console.log("[Webhook] 가상계좌 발급:",{orderId:s,bank:r==null?void 0:r.bank,accountNumber:r==null?void 0:r.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(r==null?void 0:r.bank,r==null?void 0:r.accountNumber,r==null?void 0:r.customerName,r==null?void 0:r.dueDate,JSON.stringify(t),s).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",s)}f.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:t}=e.env;try{const s=e.req.param("paymentKey"),r=await e.req.json(),{cancelReason:a,cancelAmount:n}=r;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:s,cancelReason:a,cancelAmount:n}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const o=await t.prepare(`
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
    `).bind(s).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const l=gu(i,c),u=n&&n<o.amount,d=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:s,cancelAmount:d,isPartial:u});const m=await l.cancelPayment({paymentKey:s,cancelReason:a,cancelAmount:d});return m.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:s,cancelAmount:d,canceledAt:m.canceledAt}),await t.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED",m.canceledAt||new Date().toISOString(),JSON.stringify(m),s).run(),await t.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${s}`),e.json({success:!0,data:{paymentKey:s,orderId:o.order_id,cancelAmount:d,canceledAt:m.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,m.error),e.json({success:!1,error:m.error||"결제 취소에 실패했습니다."},400))}catch(s){return console.error("[Payment] ❌ 결제 취소 처리 실패:",s.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});f.get("/api/payments/:paymentKey",async e=>{const{DB:t}=e.env;try{const s=e.req.param("paymentKey"),r=await t.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(s).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404)}catch(s){return console.error("[Payment] ❌ 결제 조회 실패:",s.message),e.json({success:!1,error:"결제 조회 중 오류가 발생했습니다."},500)}});f.get("/api/payments/order/:orderId",async e=>{const{DB:t}=e.env;try{const s=e.req.param("orderId"),r=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:r.results||[]})}catch(s){return console.error("[Payment] ❌ 결제 목록 조회 실패:",s.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});f.get("/api/seller/orders",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.query("status"),a=e.req.query("start_date"),n=e.req.query("end_date"),o=e.req.query("min_amount"),i=e.req.query("max_amount"),c=parseInt(e.req.query("page")||"1"),l=parseInt(e.req.query("limit")||"50"),u=(c-1)*l,d=["oi.seller_id = ?"],m=[s.sellerId];r&&(d.push("o.status = ?"),m.push(r)),a&&(d.push("DATE(o.created_at) >= ?"),m.push(a)),n&&(d.push("DATE(o.created_at) <= ?"),m.push(n)),o&&(d.push("o.total_amount >= ?"),m.push(parseInt(o))),i&&(d.push("o.total_amount <= ?"),m.push(parseInt(i)));const _=d.join(" AND "),h=await t.prepare(`
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
    `).bind(...m,l,u).all(),E=await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${_}
    `).bind(...m).first(),v=(E==null?void 0:E.total)||0,b=Math.ceil(v/l),g=new Map;for(const y of h.results){const x=y.id;g.has(x)||g.set(x,{id:y.id,user_id:y.user_id,user_name:y.user_name,order_number:y.order_number,status:y.status,total_amount:y.total_amount,shipping_fee:y.shipping_fee,payment_method:y.payment_method,payment_key:y.payment_key,shipping_address:y.shipping_address,shipping_name:y.shipping_name,shipping_phone:y.shipping_phone,delivery_request:y.delivery_request,created_at:y.created_at,updated_at:y.updated_at,items:[]}),y.item_id&&g.get(x).items.push({id:y.item_id,product_id:y.product_id,option_id:y.option_id,quantity:y.quantity,price:y.item_price,seller_id:y.seller_id,product_name:y.product_name,image_url:y.image_url,option_value:y.option_value})}const S=Array.from(g.values());return e.json({success:!0,data:S,pagination:{page:c,limit:l,total:v,totalPages:b},filters:{status:r||null,startDate:a||null,endDate:n||null,minAmount:o?parseInt(o):null,maxAmount:i?parseInt(i):null}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/seller/orders/export",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.query("format")||"csv",a=e.req.query("start_date"),n=e.req.query("end_date");let o=`
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
    `;const i=[s.sellerId];a&&(o+=" AND date(o.created_at) >= ?",i.push(a)),n&&(o+=" AND date(o.created_at) <= ?",i.push(n)),o+=" GROUP BY o.id ORDER BY o.created_at DESC";const c=await t.prepare(o).bind(...i).all();if(r==="csv"){const l=["주문번호","주문일시","주문상태","결제상태","주문금액","배송지","수령인","연락처","택배사","운송장번호","구매자명","구매자이메일","구매자연락처"],u=c.results.map(E=>[E.order_number||"",E.created_at?new Date(E.created_at).toLocaleString("ko-KR"):"",E.status||"",E.payment_status||"",E.total_amount||0,E.shipping_address||"",E.shipping_name||"",E.shipping_phone||"",E.carrier||"",E.tracking_number||"",E.buyer_name||"",E.buyer_email||"",E.buyer_phone||""]),m="\uFEFF"+[l.join(","),...u.map(E=>E.map(v=>{const b=String(v);return b.includes(",")||b.includes(`
`)||b.includes('"')?`"${b.replace(/"/g,'""')}"`:b}).join(","))].join(`
`),_=new Date,h=`orders_${_.toISOString().split("T")[0]}_${_.getTime()}.csv`;return new Response(m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${encodeURIComponent(h)}"`,"Cache-Control":"no-cache"}})}else return e.json({success:!1,error:"Unsupported format"},400)}catch(r){return console.error("Export error:",r),e.json({success:!1,error:r.message},500)}});f.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,s.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,r).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${r}, 자동 발행 시작...`);const c=await t.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(r).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const l=await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(s.sellerId).first();if(!l)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${s.sellerId}`),await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(r,s.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${r}`);const u=await t.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),d=Number(c.total_amount),m=Math.floor(d/1.1),_=d-m,h=new Date().toISOString().split("T")[0].replace(/-/g,""),E=Math.random().toString(36).substring(2,8).toUpperCase(),v=`${h}-${E}`,g=(await t.prepare(`
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
            `).bind(s.sellerId,r,v,l.business_number,l.business_name,l.ceo_name,l.address||"",l.business_type||"",l.business_category||"",l.email||"",l.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",m,_,d,`AUTO-${Date.now()}-${E}`).run()).meta.last_row_id;if(u.results.length>0){const S=u.results.map(y=>{const x=Math.floor(Number(y.price)*Number(y.quantity)/1.1),k=Number(y.price)*Number(y.quantity)-x;return t.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(g,y.product_name||"상품명 없음",y.quantity,y.price,x,k,y.option_name||"")});await t.batch(S)}await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r,s.sellerId,g).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${g}, invoice_number=${v}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${r}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await t.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(r,s.sellerId,c.message).run()}catch(l){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",l)}}try{const c=await t.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(r).first();if(c&&c.user_id){const u={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];u&&await Wo(t,c.user_id,r,u)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});f.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,s.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await t.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,r).run();try{const c=await t.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(r).first();c&&c.user_id&&await Wo(t,c.user_id,r,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/admin/orders",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/sellers",async e=>{const{DB:t}=e.env,{limit:s="20",offset:r="0"}=e.req.query();try{const a=`sellers:list:${s}:${r}`,n=ke(a);if(n)return e.executionCtx.waitUntil((async()=>{try{const i=await Ja(t,parseInt(s),parseInt(r));re(a,i,3600)}catch(i){console.error("[Cache Revalidate] Sellers error:",i)}})()),e.json({success:!0,data:n,cached:!0});const o=await Ja(t,parseInt(s),parseInt(r));return re(a,o,3600),e.json({success:!0,data:o,cached:!1})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});async function Ja(e,t,s){const r=`
    SELECT id, business_name, name as display_name, 
           commission_rate, created_at
    FROM sellers 
    WHERE is_active = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `,{results:a}=await e.prepare(r).bind(t,s).all();return a}f.get("/api/admin/sellers",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/admin/sellers",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{username:r,password:a,name:n,email:o,phone:i,business_name:c,business_number:l}=await e.req.json();if(!r||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await t.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await t.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const m=`$2a$10$placeholder_hash_for_${a}`,_=await t.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r,m,n,o,i||null,c,l||null,s.adminId).run();return e.json({success:!0,data:{id:_.meta.last_row_id,username:r,name:n,email:o,business_name:c}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.put("/api/admin/sellers/:id",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:l,status:u}=await e.req.json();return await t.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first()?(await t.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,l,u,r).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});f.delete("/api/admin/sellers/:id",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();return a?(await t.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await t.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,r).run(),await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(r){return e.json({success:!1,error:r.message},500)}});f.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await t.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(r).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await t.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,r).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${r}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:r,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(r){return console.error("수수료율 변경 실패:",r),e.json({success:!1,error:r.message},500)}});f.patch("/api/admin/sellers/:id/permissions",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{can_manipulate_stats:a}=await e.req.json();if(a!==0&&a!==1)return e.json({success:!1,error:"권한 값은 0 또는 1이어야 합니다"},400);const n=await t.prepare("SELECT id, username, name FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);await t.prepare(`
      UPDATE sellers 
      SET can_manipulate_stats = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,r).run();const o=a?"승인":"해제";return console.log(`시청자 수 조작 권한 ${o}: 판매자 ${n.username} (ID: ${r})`),e.json({success:!0,message:`판매자 '${n.username||n.name}'의 특수 권한이 ${o}되었습니다`,data:{seller_id:r,seller_username:n.username,can_manipulate_stats:a}})}catch(r){return console.error("권한 변경 실패:",r),e.json({success:!1,error:r.message},500)}});f.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();if(!a)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(a.status==="approved")return e.json({success:!1,error:"이미 승인된 판매자입니다"},400);if(await t.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(s.adminId,r).run(),console.log(`셀러 승인: ${a.username} (ID: ${r}) by Admin ID: ${s.adminId}`),a.email)try{const{sendEmail:n,getSellerApprovalEmailHTML:o}=await Promise.resolve().then(()=>mi),i=e.env.RESEND_API_KEY||"",c=o(a.name,a.username),l=await n({to:a.email,subject:"🎉 리스터코퍼레이션 판매자 승인 완료",html:c},i,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");l.success?console.log(`[셀러 승인] 이메일 발송 성공: ${a.email}`):console.warn(`[셀러 승인] 이메일 발송 실패: ${l.error}`)}catch(n){console.error("[셀러 승인] 이메일 발송 오류:",n)}try{const{createNotification:n,NotificationTemplates:o}=await Promise.resolve().then(()=>fi),i=o.seller_approved(a.name);await n(t,{userId:parseInt(r),type:"seller_approved",title:i.title,message:i.message,linkUrl:i.linkUrl})}catch(n){console.error("[셀러 승인] 알림 생성 오류:",n)}return e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:r,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})}catch(r){return console.error("셀러 승인 실패:",r),e.json({success:!1,error:r.message},500)}});f.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(n.status==="rejected")return e.json({success:!1,error:"이미 거부된 판매자입니다"},400);if(await t.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,s.adminId,r).run(),console.log(`셀러 거부: ${n.username} (ID: ${r}), 사유: ${a}`),n.email)try{const{sendEmail:o,getSellerRejectionEmailHTML:i}=await Promise.resolve().then(()=>mi),c=e.env.RESEND_API_KEY||"",l=i(n.name,a),u=await o({to:n.email,subject:"리스터코퍼레이션 판매자 승인 결과 안내",html:l},c,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");u.success?console.log(`[셀러 거부] 이메일 발송 성공: ${n.email}`):console.warn(`[셀러 거부] 이메일 발송 실패: ${u.error}`)}catch(o){console.error("[셀러 거부] 이메일 발송 오류:",o)}try{const{createNotification:o,NotificationTemplates:i}=await Promise.resolve().then(()=>fi),c=i.seller_rejected(a);await o(t,{userId:parseInt(r),type:"seller_rejected",title:c.title,message:c.message,linkUrl:c.linkUrl})}catch(o){console.error("[셀러 거부] 알림 생성 오류:",o)}return e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:r,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})}catch(r){return console.error("셀러 거부 실패:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/admin/sellers/pending",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:r.results,count:r.results.length})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/admin/dashboard/stats",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=new Date;r.setHours(0,0,0,0);const a=r.toISOString(),n=await t.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM orders
      WHERE payment_status = 'approved'
      AND status = 'paid'
      AND created_at >= ?
    `).bind(a).first(),o=(n==null?void 0:n.sales)||0,i=await t.prepare(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(a).first(),c=(i==null?void 0:i.count)||0,l=new Date(Date.now()-300*1e3).toISOString(),u=await t.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM orders
      WHERE created_at >= ?
    `).bind(l).first(),d=(u==null?void 0:u.count)||0,m=await t.prepare(`
      SELECT COUNT(*) as count
      FROM live_streams
      WHERE status = 'live'
    `).first(),_=(m==null?void 0:m.count)||0;return e.json({success:!0,stats:{todaySales:o,todayOrders:c,currentVisitors:d,liveStreams:_},timestamp:new Date().toISOString()})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/public/seller/:sellerId",async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const r=e.req.param("sellerId"),a=`public:seller:${r}`,n=await Su(s,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=await t.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(r).all(),c=await t.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(r).all(),l=await t.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(r).all(),u=await t.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(r).first(),d={profile:o,live_streams:i.results,scheduled_streams:c.results,products:l.results,stats:u};return await gs(s,a,d,60,!1),e.json({success:!0,data:d})}catch(r){return console.error("셀러 프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/public/seller/username/:username",async e=>{const{DB:t}=e.env;try{const s=e.req.param("username"),r=await t.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(s).first();return r?e.json({success:!0,data:{seller_id:r.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 조회 실패:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/admin/settlement/stats",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{period:r}=e.req.query();let a="";const n=new Date;switch(r){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await t.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:r||"all"}})}catch(r){return console.error("정산 통계 조회 실패:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/admin/settlement/records",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{seller_id:r,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];r&&(o.push("o.seller_id = ?"),i.push(r)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const d=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${d}'`);break;case"week":const m=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${m}'`);break;case"month":const _=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${_}'`);break}const l=o.length>0?`WHERE ${o.join(" AND ")}`:"",u=await t.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:u.results})}catch(r){return console.error("정산 내역 조회 실패:",r),e.json({success:!1,error:r.message},500)}});f.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await t.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(r).first();return n?(await t.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,r).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:r,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(r){return console.error("정산 상태 변경 실패:",r),e.json({success:!1,error:r.message},500)}});f.post("/api/admin/settlement/batch-complete",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{order_ids:r}=await e.req.json();if(!Array.isArray(r)||r.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of r)try{await t.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:r.length,success:a,failed:n}})}catch(r){return console.error("일괄 정산 처리 실패:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/admin/settlement/export-csv",async e=>{const{DB:t}=e.env,s=await B(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{seller_id:r,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];r&&(n.push("o.seller_id = ?"),o.push(r));const i=new Date;switch(a){case"today":const h=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${h}'`);break;case"week":const E=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${E}'`);break;case"month":const v=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${v}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",u=(await t.prepare(`
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
`;u.forEach(h=>{const E=d.map(v=>{const b=h[v];if(b==null)return"";const g=String(b);return g.includes(",")||g.includes('"')||g.includes(`
`)?`"${g.replace(/"/g,'""')}"`:g});m+=E.join(",")+`
`});const _="\uFEFF";return new Response(_+m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(r){return console.error("CSV 내보내기 실패:",r),e.json({success:!1,error:r.message},500)}});f.post("/api/orders/create",j,async e=>{const{DB:t}=e.env;try{const{userId:s,cartItems:r,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:l,buyerCeoName:u}=await e.req.json();console.log("[DEPRECATED /api/orders/create] 주문 생성 요청:",{userId:s,cartItems:r==null?void 0:r.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let d=10;if(o){const O=await t.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();O&&O.commission_rate!==null&&(d=O.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:d});const m=Math.floor(a*(d/100)),_=a-m;let h=null;if(n){const O=await t.prepare(`
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
      `).bind(n,s).first();if(!O)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);h=O}if(!s)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const E=s,v=new Date,b=v.getFullYear().toString().slice(-2),g=(v.getMonth()+1).toString().padStart(2,"0"),S=v.getDate().toString().padStart(2,"0"),y=`${b}${g}${S}`,x=Math.random().toString(36).substring(2,7).toUpperCase(),k=`ORD-${y}-${x}`,R=r.map(O=>O.product_id),I=R.map(()=>"?").join(","),$=await t.prepare(`
      SELECT id, stock FROM products WHERE id IN (${I})
    `).bind(...R).all(),N=new Map($.results.map(O=>[O.id,O.stock]));for(const O of r){const le=N.get(O.product_id);if(le===void 0)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${O.product_id})`},400);if(le<O.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${O.product_id})`},400)}const q=(await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(k,E,a,"pending",o||null,d,m,_,n||null,(h==null?void 0:h.recipient_name)||null,(h==null?void 0:h.phone)||null,h!=null&&h.address?`${h.address} ${h.address_detail}`:null,(h==null?void 0:h.postal_code)||null,i?1:0,c||null,l||null,u||null).run()).meta.last_row_id,ae=r.map(O=>t.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(q,O.product_id,O.option_id||null,O.quantity,O.price_snapshot||O.price)),ee=r.map(O=>t.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(O.quantity,O.product_id));await t.batch([...ae,...ee]);try{const O=Lt(e.env),le=r.map(V=>V.product_id),G=le.map(()=>"?").join(","),H=await t.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${G})
      `).bind(...le).all();await Promise.all(H.results.map(V=>O.updateProductStock(V.id,V.stock,{name:V.name,price:V.price,original_price:V.original_price,discount_rate:V.discount_rate,image_url:V.image_url}))),console.log(`🔥 Firebase: Stock updated for ${H.results.length} products`)}catch(O){console.error("⚠️ Firebase stock sync failed (non-blocking):",O)}try{const O=r.map(H=>H.product_id),le=O.map(()=>"?").join(","),G=await t.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${le})
      `).bind(...O).all();for(const H of G.results){const V=H.stock_alert_threshold||5,ue=H.stock;ue<=V&&H.seller_id&&(await Bo(t,H.seller_id,H.name,ue,V),console.log(`[Low Stock Alert] ${H.name}: ${ue} <= ${V}`))}}catch(O){console.error("[Low Stock Alert] Error:",O)}return console.log("주문 생성 완료:",{orderId:q,orderNumber:k}),e.json({success:!0,orderId:q,orderNumber:k,totalAmount:a})}catch(s){return console.error("주문 생성 실패:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/orders/:orderNumber/refund",w(),j,async e=>{const{DB:t}=e.env;try{const s=e.req.param("orderNumber"),{reason:r}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:s,reason:r});const a=await t.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(s).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다"},404);if(a.payment_status==="cancelled")return e.json({success:!1,error:"이미 취소된 주문입니다"},400);await t.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r||"구매자 요청",s).run(),console.log("[Order Refund] 주문 상태 업데이트 완료:",s);const n=await t.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();if(n.results.length>0){const o=n.results.map(i=>t.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(i.quantity,i.product_id));await t.batch(o),console.log("[Order Refund] 재고 복구 완료:",{items:n.results.length})}return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:s,reason:r}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:s,cancelDate:new Date().toISOString()}})}catch(s){return console.error("[Order Refund] Error:",s),e.json({success:!1,error:s.message||"주문 취소 중 오류가 발생했습니다"},500)}});f.use("/api/seller/*",j);f.get("/api/seller/sales",w(),async e=>{try{const{DB:t}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await qt(e.env.SESSION_KV,s);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],l=await t.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(a).first();if(!l)return e.json({success:!1,error:"셀러를 찾을 수 없습니다."},404);const u=await t.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:l,stats:u,orders:(d==null?void 0:d.results)||[]}})}catch(t){return console.error("Seller sales query error:",t),e.json({success:!1,error:t.message},500)}});f.get("/api/seller/settlement-csv",w(),async e=>{try{const{DB:t}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await qt(e.env.SESSION_KV,s);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],l=await t.prepare(`
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
`;for(const d of(l==null?void 0:l.results)||[]){const m=d.status==="delivered"?"배송완료":d.status==="shipped"?"배송중":d.status==="preparing"?"상품준비중":d.status==="paid"?"결제완료":"대기중",_=d.buyer_business_name||"-",h=d.buyer_business_number||"-",E=d.invoice_number||"-",v=d.issue_date||"-",b=d.tax_invoice_status==="issued"?"발행완료":d.tax_invoice_status==="cancelled"?"취소":"-",g=d.nts_confirm_number||"-";u+=`${d.order_number},${d.created_at},${d.user_name||"익명"},${d.total_amount},${d.commission_amount},${d.seller_amount},${m},${_},${h},${E},${v},${b},${g}
`}return new Response(u,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(t){return console.error("CSV download error:",t),e.json({success:!1,error:t.message},500)}});f.post("/api/seller/tax-invoices/issue",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{order_number:r}=await e.req.json();if(!r)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(r).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!a.issue_tax_invoice)return e.json({success:!1,error:"세금계산서 발행이 요청되지 않은 주문입니다."},400);const n=await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(s.sellerId).first();if(!n)return e.json({success:!1,error:"승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요."},400);const o=await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),l=i-c,u=new Date().toISOString().split("T")[0],d=`${u}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,m=uc(n,a,o.results);let _,h,E;try{_=await lc(m),h=_.ntsConfirmNumber,E=_.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:h,invoiceKey:E,mockMode:ds()})}catch(g){console.error("바로빌 API 호출 실패:",g),h="FAILED",E=null}const b=(await t.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s.sellerId,r,"tax",d,u,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,l,i,h==="FAILED"?"failed":"issued",ds()?"mock":"barobill",E,h).run()).meta.last_row_id;for(const g of o.results){const S=Math.floor(Number(g.price)*Number(g.quantity)/1.1),y=Number(g.price)*Number(g.quantity)-S;await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(b,g.id,g.product_name,g.quantity,g.price,S,y).run()}return e.json({success:!0,data:{invoice_id:b,invoice_number:d,issue_date:u,total_amount:i,supply_price:c,tax_amount:l,status:h==="FAILED"?"failed":"issued",nts_confirm_number:h,api_invoice_key:E,mock_mode:ds(),message:h==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":ds()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(r){return console.error("세금계산서 발행 오류:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/tax-invoices",async e=>{var r;const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[s.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const l=await t.prepare(i).bind(...c).all();return e.json({success:!0,data:l.results||[],total:((r=l.results)==null?void 0:r.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});f.get("/api/seller/tax-invoices/:id",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,s.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await t.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(r).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json(),n=await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,s.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!ds()){const l=await t.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(s.sellerId).first();l&&l.business_number&&await cc(l.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(l){console.error("바로빌 취소 API 호출 실패:",l)}return await t.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});f.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{status:r,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[s.sellerId];r&&(n+=" AND log.status = ?",o.push(r)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await t.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});f.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${r}`);const a=await t.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(r,s.sellerId).first();if(!a)return e.json({success:!1,error:"재시도할 실패 로그를 찾을 수 없습니다."},404);const n=Number(a.retry_count||0);if(n>=3)return e.json({success:!1,error:"최대 재시도 횟수(3회)를 초과했습니다."},400);const o=await t.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(r).first();if(!o)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!o.buyer_business_number||!o.buyer_business_name)return e.json({success:!1,error:"주문에 사업자 정보가 없습니다."},400);const i=await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(s.sellerId).first();if(!i)return e.json({success:!1,error:"판매자 사업자 정보가 승인되지 않았습니다."},400);const c=await t.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(),l=Number(o.total_amount),u=Math.floor(l/1.1),d=l-u,m=new Date().toISOString().split("T")[0].replace(/-/g,""),_=Math.random().toString(36).substring(2,8).toUpperCase(),h=`${m}-${_}`,v=(await t.prepare(`
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
    `).bind(s.sellerId,r,h,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",u,d,l,`RETRY-${Date.now()}-${_}`).run()).meta.last_row_id;for(const b of c.results){const g=Math.floor(Number(b.price)*Number(b.quantity)/1.1),S=Number(b.price)*Number(b.quantity)-g;await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(v,b.product_name||"상품명 없음",b.quantity,b.price,g,S,b.option_name||"").run()}return await t.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r,s.sellerId,v,n+1).run(),await t.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${v}, retry_count=${n+1}`),e.json({success:!0,data:{invoice_id:v,invoice_number:h,retry_count:n+1}})}catch(r){console.error("[TAX INVOICE RETRY] 재시도 실패:",r);try{const a=e.req.param("orderNumber"),n=await t.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,s.sellerId).first(),o=Number((n==null?void 0:n.retry_count)||0);await t.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,s.sellerId,r.message,o+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:r.message},500)}});f.get("/live/:id",async e=>{try{const t=new URL("/static/live.html",e.req.url);let r=await(await fetch(t.toString())).text();const n=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return r=r.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${n}`),console.log("[Live Page] Environment variables injected"),new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving live page:",t),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});f.get("/cart",async e=>{try{const t=new URL("/static/cart.html",e.req.url);let r=await(await fetch(t.toString())).text();return r=r.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),r=r.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving cart page:",t),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});f.get("/my-orders",async e=>{try{const t=new URL("/static/my-orders.html",e.req.url),r=await(await fetch(t.toString())).text();return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving my orders page:",t),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});f.get("/payment-result",async e=>{try{const t=new URL("/payment-result.html",e.req.url),r=await(await fetch(t.toString())).text();return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving payment result page:",t),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});f.get("/api/seller/profile",async e=>{const{DB:t}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const r=await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(s).first();if(!r||!r.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await t.prepare(`
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
    `).bind(r.seller_id).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404)}catch(r){return console.error("프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});f.patch("/api/seller/profile",async e=>{const{DB:t}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const r=await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(s).first();if(!r||!r.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:l,website_url:u,kakao_chat_link:d}=await e.req.json(),m=[],_=[];if(a!==void 0&&(m.push("profile_image = ?"),_.push(a)),n!==void 0&&(m.push("bio = ?"),_.push(n)),o!==void 0&&(m.push("sns_instagram = ?"),_.push(o)),i!==void 0&&(m.push("sns_youtube = ?"),_.push(i)),c!==void 0&&(m.push("sns_facebook = ?"),_.push(c)),l!==void 0&&(m.push("sns_twitter = ?"),_.push(l)),u!==void 0&&(m.push("website_url = ?"),_.push(u)),d!==void 0&&(m.push("kakao_chat_link = ?"),_.push(d)),m.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);m.push("updated_at = datetime('now')"),_.push(r.seller_id),await t.prepare(`
      UPDATE sellers 
      SET ${m.join(", ")}
      WHERE id = ?
    `).bind(..._).run();const h=await t.prepare(`
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
    `).bind(r.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:h})}catch(r){return console.error("프로필 업데이트 실패:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/public/:sellerId",async e=>{const{DB:t}=e.env,s=e.req.param("sellerId");try{const r=await t.prepare(`
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
    `).bind(s).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/:sellerId/streams",async e=>{const{DB:t}=e.env,s=e.req.param("sellerId");try{const r=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:r.results})}catch(r){return console.error("라이브 목록 조회 실패:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/:sellerId/products-public",async e=>{const{DB:t}=e.env,s=e.req.param("sellerId");try{const r=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:r.results})}catch(r){return console.error("상품 목록 조회 실패:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/notifications",j,async e=>{const{DB:t}=e.env;try{const s=e.get("userId"),r=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),n=e.req.query("unread_only")==="true";let o=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;n&&(o+=" AND is_read = 0"),o+=" ORDER BY created_at DESC LIMIT ?";const i=await t.prepare(o).bind(s,r,a).all();return e.json({success:!0,data:i.results})}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/api/notifications/unread-count",j,async e=>{const{DB:t}=e.env;try{const s=e.get("userId"),r=e.get("userType"),a=await t.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(s,r).first();return e.json({success:!0,count:(a==null?void 0:a.count)||0})}catch(s){return e.json({success:!1,error:s.message},500)}});f.put("/api/notifications/:id/read",j,async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=e.get("userId"),a=e.get("userType");return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s,r,a).first()?(await t.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});f.put("/api/notifications/read-all",j,async e=>{const{DB:t}=e.env;try{const s=e.get("userId"),r=e.get("userType");return await t.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(s,r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});f.delete("/api/notifications/:id",j,async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=e.get("userId"),a=e.get("userType");return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s,r,a).first()?(await t.prepare("DELETE FROM notifications WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/api/banners",async e=>{const{DB:t}=e.env;try{const s=new Date().toISOString(),r=await t.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(s,s).all();return e.json({success:!0,data:r.results})}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/api/admin/banners",j,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=await t.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(s){return e.json({success:!1,error:s.message},500)}});f.post("/api/admin/banners",j,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:r,image_url:a,link_url:n,description:o,is_active:i,display_order:c,start_date:l,end_date:u}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const d=await t.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a,n||null,o||null,i!==!1?1:0,c||0,l||null,u||null).run();return e.json({success:!0,id:d.meta.last_row_id})}catch(s){return e.json({success:!1,error:s.message},500)}});f.put("/api/admin/banners/:id",j,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id"),{title:a,image_url:n,link_url:o,description:i,is_active:c,display_order:l,start_date:u,end_date:d}=await e.req.json();return await t.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,n,o||null,i||null,c?1:0,l||0,u||null,d||null,r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});f.delete("/api/admin/banners/:id",j,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id");return await t.prepare("DELETE FROM banners WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});f.get("/order-complete",e=>e.redirect("/order-complete.html",302));f.notFound(e=>{const t=e.req.path;return t.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${t} was not found.`},404):new Response(null,{status:404})});f.onError((e,t)=>{const s=t.req.path;if(e instanceof rl)return console.error("[AppError]",{path:s,method:t.req.method,code:e.code,message:e.message,statusCode:e.statusCode}),t.json({success:!1,error:{code:e.code,message:e.message,...e.details&&{details:e.details}}},e.statusCode);if(console.error("[Global Error Handler]",{path:s,method:t.req.method,error:e.message,stack:e.stack}),s.startsWith("/api/")){let r=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(r=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(r=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(r=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(r=400,a="잘못된 요청입니다."),t.json({success:!1,error:e.message||a},r)}return t.html(`
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
  `,500)});f.get("/api/admin/alimtalk/pricing",w(),async e=>{const{env:t}=e;try{const s=await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:s.results})}catch(s){return console.error("[Admin Alimtalk Pricing] Error:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/admin/alimtalk/pricing",w(),async e=>{const{env:t}=e;try{const{plan_name:s,min_quantity:r,max_quantity:a,unit_price:n}=await e.req.json();if(!s||!r||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await t.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(s,r,a||null,n).run();return e.json({success:!0,pricing_id:o.meta.last_row_id})}catch(s){return console.error("[Admin Alimtalk Pricing Create] Error:",s),e.json({success:!1,error:s.message},500)}});f.put("/api/admin/alimtalk/pricing/:id",w(),async e=>{const{env:t}=e,s=e.req.param("id");try{const{plan_name:r,min_quantity:a,max_quantity:n,unit_price:o,is_active:i}=await e.req.json();return(await t.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r,a,n||null,o,i?1:0,s).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing updated successfully"})}catch(r){return console.error("[Admin Alimtalk Pricing Update] Error:",r),e.json({success:!1,error:r.message},500)}});f.delete("/api/admin/alimtalk/pricing/:id",w(),async e=>{const{env:t}=e,s=e.req.param("id");try{return(await t.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(s).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing deleted successfully"})}catch(r){return console.error("[Admin Alimtalk Pricing Delete] Error:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/admin/alimtalk/accounts",w(),async e=>{const{env:t}=e;try{const s=await t.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();return e.json({success:!0,accounts:s.results})}catch(s){return console.error("[Admin Alimtalk Accounts] Error:",s),e.json({success:!1,error:s.message},500)}});f.patch("/api/admin/alimtalk/accounts/:id/status",w(),async e=>{const{env:t}=e,s=e.req.param("id");try{const{status:r}=await e.req.json();return["active","suspended","rejected"].includes(r)?(await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r,s).run()).meta.changes===0?e.json({success:!1,error:"Account not found"},404):e.json({success:!0,message:`Account ${r} successfully`}):e.json({success:!1,error:"Invalid status"},400)}catch(r){return console.error("[Admin Alimtalk Account Status] Error:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/admin/alimtalk/statistics",w(),async e=>{const{env:t}=e;try{const{start_date:s,end_date:r}=e.req.query(),a=await t.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_revenue
      FROM alimtalk_messages
      WHERE created_at >= ? AND created_at <= ?
    `).bind(s||"2000-01-01",r||"2100-01-01").first(),n=await t.DB.prepare(`
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
    `).bind(s||"2000-01-01",r||"2100-01-01").all();return e.json({success:!0,statistics:{total:a,by_seller:n.results}})}catch(s){return console.error("[Admin Alimtalk Statistics] Error:",s),e.json({success:!1,error:s.message},500)}});f.use("/api/seller/alimtalk/*",j);f.get("/api/seller/alimtalk/account",w(),async e=>{const{env:t}=e;try{const s=e.get("user");if(!s||s.userType!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const r=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(s.userId).first();return e.json({success:!0,account:r})}catch(s){return console.error("[Seller Alimtalk Account] Error:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/seller/alimtalk/register",w(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await ut(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{channel_id:a,phone_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=mo(n),i=await Ic(t,{channelId:a,phoneNumber:o});if(!i.success)return e.json({success:!1,error:"Failed to register Kakao channel"},500);const c=await t.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(r.user_id,a,a,i.senderKey,o).run();return e.json({success:!0,account_id:c.meta.last_row_id,sender_key:i.senderKey,message:"Kakao channel registered successfully"})}catch(s){return console.error("[Seller Alimtalk Register] Error:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/seller/alimtalk/templates",w(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await ut(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!a)return e.json({success:!1,error:"Alimtalk account not found"},404);const n=await t.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();return e.json({success:!0,templates:n.results})}catch(s){return console.error("[Seller Alimtalk Templates] Error:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/seller/alimtalk/templates",w(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await ut(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_code:a,template_name:n,template_content:o,template_type:i}=await e.req.json();if(!a||!n||!o)return e.json({success:!1,error:"Missing required fields"},400);const c=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(!(await Pc(t,c.sender_key,{name:n,content:o,templateCode:a})).success)return e.json({success:!1,error:"Failed to register template"},500);const u=await t.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id,a,n,o,i||"basic").run();return e.json({success:!0,template_id:u.meta.last_row_id,message:"Template registered successfully. Approval pending (1-2 days)"})}catch(s){return console.error("[Seller Alimtalk Template Register] Error:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/seller/alimtalk/pricing",w(),async e=>{const{env:t}=e;try{const s=await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:s.results})}catch(s){return console.error("[Seller Alimtalk Pricing] Error:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/seller/alimtalk/charge",w(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await ut(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{amount:a,pricing_id:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();if(!i)return e.json({success:!1,error:"Pricing not found"},404);const c=a*i.unit_price,l=`alimtalk_${o.id}_${Date.now()}`,u=await t.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id,a,c,i.unit_price,l).run(),d=`https://api.tosspayments.com/v1/payment/${l}`;return e.json({success:!0,charge_id:u.meta.last_row_id,order_id:l,amount:a,price:c,unit_price:i.unit_price,payment_url:d})}catch(s){return console.error("[Seller Alimtalk Charge] Error:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/seller/alimtalk/charge/complete",w(),async e=>{const{env:t}=e;try{const{order_id:s,payment_id:r}=await e.req.json();if(!s)return e.json({success:!1,error:"Missing order_id"},400);const a=await t.DB.prepare(`
      SELECT * FROM alimtalk_charges WHERE order_id = ? AND payment_status = 'pending'
    `).bind(s).first();return a?(await t.DB.prepare(`
      UPDATE alimtalk_charges 
      SET payment_status = 'completed', 
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r||null,a.id).run(),await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a.amount,a.account_id).run(),e.json({success:!0,message:"Charge completed successfully",charged_amount:a.amount})):e.json({success:!1,error:"Charge not found or already completed"},404)}catch(s){return console.error("[Seller Alimtalk Charge Complete] Error:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/seller/alimtalk/send",w(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await ut(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_id:a,recipient_phone:n,variables:o,order_id:i}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const c=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(c.balance<1)return e.json({success:!1,error:"Insufficient balance. Please charge first."},400);const l=await t.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a,c.id).first();if(!l)return e.json({success:!1,error:"Template not found or not approved"},404);const u=Oc(l.template_content,o||{}),d=mo(n),m=await ca(t,{senderKey:c.sender_key,templateCode:l.template_code,to:d,message:u});if(!m.success)return await t.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id,a,i||null,d,u,m.error).run(),e.json({success:!1,error:m.error},500);const _=await t.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id,a,i||null,d,u,15,m.messageId).run();return await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(),e.json({success:!0,message_id:_.meta.last_row_id,aligo_message_id:m.messageId,status:"sent",remaining_balance:c.balance-1})}catch(s){return console.error("[Seller Alimtalk Send] Error:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/seller/alimtalk/messages",w(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await ut(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{page:a="1",limit:n="20",status:o}=e.req.query(),i=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!i)return e.json({success:!1,error:"Alimtalk account not found"},404);const c=(parseInt(a)-1)*parseInt(n);let l=`
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;const u=[i.id];o&&(l+=" AND m.status = ?",u.push(o)),l+=" ORDER BY m.created_at DESC LIMIT ? OFFSET ?",u.push(parseInt(n),c);const d=await t.DB.prepare(l).bind(...u).all(),m=await t.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();return e.json({success:!0,messages:d.results,pagination:{total:m.total,page:parseInt(a),limit:parseInt(n)}})}catch(s){return console.error("[Seller Alimtalk Messages] Error:",s),e.json({success:!1,error:s.message},500)}});f.get("/api/seller/alimtalk/statistics",w(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await ut(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{start_date:a,end_date:n}=e.req.query(),o=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await t.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_cost
      FROM alimtalk_messages
      WHERE account_id = ?
        AND created_at >= ?
        AND created_at <= ?
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").first(),c=await t.DB.prepare(`
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
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").all(),l=i.total_sent>0?(i.total_success/i.total_sent*100).toFixed(2):0;return e.json({success:!0,statistics:{total_sent:i.total_sent,total_success:i.total_success,total_failed:i.total_failed,success_rate:l,total_cost:i.total_cost,by_template:c.results}})}catch(s){return console.error("[Seller Alimtalk Statistics] Error:",s),e.json({success:!1,error:s.message},500)}});f.post("/api/seller/alimtalk/send",w(),async e=>{try{const t=e.req.header("X-Seller-ID");if(!t)return e.json({success:!1,error:"Unauthorized"},401);const s=await e.req.json(),{templateId:r,recipients:a,variables:n}=s;if(!r||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and recipients are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(t)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await la(e.env,{accountId:o.id,templateId:parseInt(r),recipients:a.map(c=>({phone:c.phone,name:c.name,variables:c.variables||{}})),variables:n||{}});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(t){return console.error("[Alimtalk Send] Error:",t),e.json({success:!1,error:t.message},500)}});f.post("/api/seller/alimtalk/send/order",w(),async e=>{try{const t=e.req.header("X-Seller-ID");if(!t)return e.json({success:!1,error:"Unauthorized"},401);const s=await e.req.json(),{templateId:r,orderId:a,customMessage:n}=s;if(!r||!a)return e.json({success:!1,error:"templateId and orderId are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(t)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);if(!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a),parseInt(t)).first())return e.json({success:!1,error:"Order not found or unauthorized"},404);const c=await Uc(e.env,o.id,parseInt(r),parseInt(a),n);return e.json({success:c.success,data:{total:c.totalRecipients,sent:c.successCount,failed:c.failedCount,refunded:c.refundedAmount},messages:c.messages})}catch(t){return console.error("[Alimtalk Send Order] Error:",t),e.json({success:!1,error:t.message},500)}});f.post("/api/seller/alimtalk/send/bulk",w(),async e=>{try{const t=e.req.header("X-Seller-ID");if(!t)return e.json({success:!1,error:"Unauthorized"},401);const s=await e.req.json(),{templateId:r,rows:a,variables:n}=s;if(!r||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and rows are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(t)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await qc(e.env,o.id,parseInt(r),a,n||{});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(t){return console.error("[Alimtalk Send Bulk] Error:",t),e.json({success:!1,error:t.message},500)}});f.post("/api/seller/alimtalk/templates/:id/preview",w(),async e=>{try{const t=e.req.header("X-Seller-ID");if(!t)return e.json({success:!1,error:"Unauthorized"},401);const s=e.req.param("id"),r=await e.req.json(),{variables:a}=r,n=await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(s),parseInt(t)).first();if(!n)return e.json({success:!1,error:"Template not found"},404);let o=n.template_content;return a&&Object.entries(a).forEach(([i,c])=>{const l=new RegExp(`#{${i}}`,"g");o=o.replace(l,c)}),e.json({success:!0,data:{template_name:n.template_name,original:n.template_content,preview:o,required_variables:Array.from(n.template_content.matchAll(/#{(\w+)}/g),i=>i[1])}})}catch(t){return console.error("[Alimtalk Preview] Error:",t),e.json({success:!1,error:t.message},500)}});f.get("/api/admin/settlements",w(),async e=>{try{const t=await e.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all();return e.json({success:!0,data:t.results})}catch(t){return console.error("[Admin Settlements] Error:",t),e.json({success:!1,error:t.message},500)}});f.get("/api/admin/settlements/:id",w(),async e=>{try{const t=parseInt(e.req.param("id")),s=await Vc(e.env.DB,t);return s?e.json({success:!0,data:s}):e.json({success:!1,error:"Settlement not found"},404)}catch(t){return console.error("[Admin Settlement Detail] Error:",t),e.json({success:!1,error:t.message},500)}});f.post("/api/admin/settlements/generate",w(),async e=>{try{const t=await e.req.json(),{startDate:s,endDate:r}=t,a=s&&r?{startDate:s,endDate:r}:Wc(),n=await Kc(e.env.DB,a);return await Gc(e.env.DB,n),e.json({success:!0,data:n})}catch(t){return console.error("[Admin Generate Settlement] Error:",t),e.json({success:!1,error:t.message},500)}});f.get("/api/seller/settlements",w(),async e=>{try{const t=e.req.header("X-Seller-ID");if(!t)return e.json({success:!1,error:"Unauthorized"},401);const s=await e.env.DB.prepare(`
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
    `).bind(parseInt(t)).all();return e.json({success:!0,data:s.results})}catch(t){return console.error("[Seller Settlements] Error:",t),e.json({success:!1,error:t.message},500)}});f.get("/api/admin/settlements/calculate",w(),async e=>{const{DB:t}=e.env;if(!(await B(e)).success)return e.json({success:!1,error:"관리자 권한이 필요합니다"},401);try{const r=e.req.query("seller_id"),a=e.req.query("period")||"monthly",n=e.req.query("format")||"json";let o=e.req.query("start_date"),i=e.req.query("end_date");if(!r)return e.json({success:!1,error:"seller_id가 필요합니다"},400);const c=new Date;if(a==="weekly"){const g=new Date(c);g.setDate(c.getDate()-c.getDay()-6),g.setHours(0,0,0,0);const S=new Date(g);S.setDate(g.getDate()+6),S.setHours(23,59,59,999),o=g.toISOString().split("T")[0],i=S.toISOString().split("T")[0]}else if(a==="monthly"){const g=new Date(c.getFullYear(),c.getMonth()-1,1),S=new Date(c.getFullYear(),c.getMonth(),0);o=g.toISOString().split("T")[0],i=S.toISOString().split("T")[0]}else if(a==="custom"&&(!o||!i))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const l=await t.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(r).first();if(!l)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const d=(await t.prepare(`
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
    `).bind(r,o,i).all()).results,m=d.length,_=d.reduce((g,S)=>g+(S.total_amount||0),0),h=d.reduce((g,S)=>g+(S.commission_amount||0),0),E=_-h,v=m>0?d.reduce((g,S)=>g+(S.commission_rate||0),0)/m:0,b={sellerId:parseInt(r),sellerName:l.seller_name||"Unknown",businessName:l.business_name||null,period:{type:a,startDate:o,endDate:i},summary:{totalOrders:m,totalSales:_,totalCommission:h,netAmount:E,commissionRate:Math.round(v*100)/100},orders:d.map(g=>({orderNumber:g.order_number,createdAt:g.created_at,status:g.status,totalAmount:g.total_amount||0,commissionAmount:g.commission_amount||0,sellerAmount:g.seller_amount||0}))};if(n==="csv"){const g=[];g.push("셀러 정산서"),g.push(`셀러명,${b.sellerName}`),g.push(`사업자명,${b.businessName||"N/A"}`),g.push(`정산 기간,${b.period.startDate} ~ ${b.period.endDate}`),g.push(""),g.push("구분,금액"),g.push(`총 주문 건수,${b.summary.totalOrders}건`),g.push(`총 매출,${b.summary.totalSales.toLocaleString()}원`),g.push(`플랫폼 수수료 (${b.summary.commissionRate}%),${b.summary.totalCommission.toLocaleString()}원`),g.push(`정산 금액,${b.summary.netAmount.toLocaleString()}원`),g.push(""),g.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const x of b.orders)g.push(`${x.orderNumber},${x.createdAt},${x.status},${x.totalAmount},${x.commissionAmount},${x.sellerAmount}`);const S=g.join(`
`),y=`settlement_${r}_${o}_${i}.csv`;return e.text(S,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${y}"`})}return e.json({success:!0,data:b})}catch(r){return console.error("[Settlement] Calculation error:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/seller/settlements/my",w(),async e=>{const{DB:t}=e.env,s=await D(e);if(!s.success)return e.json({success:!1,error:"셀러 권한이 필요합니다"},401);const r=new URL(e.req.url);r.searchParams.set("seller_id",String(s.sellerId));const a=new Request(r.toString(),e.req.raw);({...e,req:new Proxy(a,{get(n,o){return o==="query"?i=>i==="seller_id"?String(s.sellerId):r.searchParams.get(i):n[o]}})});try{const n=s.sellerId,o=e.req.query("period")||"monthly",i=e.req.query("format")||"json";let c=e.req.query("start_date"),l=e.req.query("end_date");const u=new Date;if(o==="weekly"){const y=new Date(u);y.setDate(u.getDate()-u.getDay()-6),y.setHours(0,0,0,0);const x=new Date(y);x.setDate(y.getDate()+6),x.setHours(23,59,59,999),c=y.toISOString().split("T")[0],l=x.toISOString().split("T")[0]}else if(o==="monthly"){const y=new Date(u.getFullYear(),u.getMonth()-1,1),x=new Date(u.getFullYear(),u.getMonth(),0);c=y.toISOString().split("T")[0],l=x.toISOString().split("T")[0]}else if(o==="custom"&&(!c||!l))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const d=await t.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(n).first();if(!d)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const _=(await t.prepare(`
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
    `).bind(n,c,l).all()).results,h=_.length,E=_.reduce((y,x)=>y+(x.total_amount||0),0),v=_.reduce((y,x)=>y+(x.commission_amount||0),0),b=E-v,g=h>0?_.reduce((y,x)=>y+(x.commission_rate||0),0)/h:0,S={sellerId:n,sellerName:d.seller_name||"Unknown",businessName:d.business_name||null,period:{type:o,startDate:c,endDate:l},summary:{totalOrders:h,totalSales:E,totalCommission:v,netAmount:b,commissionRate:Math.round(g*100)/100},orders:_.map(y=>({orderNumber:y.order_number,createdAt:y.created_at,status:y.status,totalAmount:y.total_amount||0,commissionAmount:y.commission_amount||0,sellerAmount:y.seller_amount||0}))};if(i==="csv"){const y=[];y.push("셀러 정산서"),y.push(`셀러명,${S.sellerName}`),y.push(`사업자명,${S.businessName||"N/A"}`),y.push(`정산 기간,${S.period.startDate} ~ ${S.period.endDate}`),y.push(""),y.push("구분,금액"),y.push(`총 주문 건수,${S.summary.totalOrders}건`),y.push(`총 매출,${S.summary.totalSales.toLocaleString()}원`),y.push(`플랫폼 수수료 (${S.summary.commissionRate}%),${S.summary.totalCommission.toLocaleString()}원`),y.push(`정산 금액,${S.summary.netAmount.toLocaleString()}원`),y.push(""),y.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const R of S.orders)y.push(`${R.orderNumber},${R.createdAt},${R.status},${R.totalAmount},${R.commissionAmount},${R.sellerAmount}`);const x=y.join(`
`),k=`my_settlement_${c}_${l}.csv`;return e.text(x,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${k}"`})}return e.json({success:!0,data:S})}catch(n){return console.error("[My Settlement] Error:",n),e.json({success:!1,error:n.message},500)}});f.get("/api/seller/settlements",w(),async e=>{try{const t=e.req.header("X-Seller-ID");if(!t)return e.json({success:!1,error:"Unauthorized"},401);const s=await e.env.DB.prepare(`
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
    `).bind(parseInt(t)).all();return e.json({success:!0,data:s.results})}catch(t){return console.error("[Seller Settlements] Error:",t),e.json({success:!1,error:t.message},500)}});f.get("/api/live/:streamId/sse",async e=>{const t=e.req.param("streamId");return Jc(t,e.env)});f.get("/api/live/:streamId/chat/sse",async e=>{const t=e.req.param("streamId");return Yc(t,e.env)});f.get("/api/seller/orders/sse",async e=>{const t=e.req.header("X-Seller-ID");return t?zc(t,e.env):e.json({success:!1,error:"Unauthorized"},401)});f.get("/api/seller/stock/sse",async e=>{const t=e.req.header("X-Seller-ID");return t?Xc(t,e.env):e.json({success:!1,error:"Unauthorized"},401)});f.post("/api/push/subscribe",w(),async e=>{try{const t=e.req.header("X-User-ID"),s=e.req.header("X-User-Type");if(!t||!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json();return await Qc(e.env.DB,parseInt(t),s,r),e.json({success:!0})}catch(t){return console.error("[Push Subscribe] Error:",t),e.json({success:!1,error:t.message},500)}});f.post("/api/push/unsubscribe",w(),async e=>{try{const{endpoint:t}=await e.req.json();return t?(await Zc(e.env.DB,t),e.json({success:!0})):e.json({success:!1,error:"Endpoint required"},400)}catch(t){return console.error("[Push Unsubscribe] Error:",t),e.json({success:!1,error:t.message},500)}});f.get("/api/push/vapid-public-key",w(),async e=>{try{const t=e.env.VAPID_PUBLIC_KEY||"";return e.json({success:!0,publicKey:t})}catch(t){return console.error("[Push VAPID Key] Error:",t),e.json({success:!1,error:t.message},500)}});f.get("/api/cache/stats",async e=>{const t=e.req.query("token"),s=e.env.STATS_SECRET_TOKEN||"your-secret-token-here";if(t!==s)return e.json({success:!1,error:"접근 권한이 없습니다. 올바른 token을 제공해주세요."},403);const r=Z.hits+Z.misses>0?(Z.hits/(Z.hits+Z.misses)*100).toFixed(2):"0.00";return e.json({success:!0,data:{cache:{...Z,hitRate:`${r}%`,cacheSize:Re.size,maxSize:1e3,memoryUsage:`${(Re.size/1e3*100).toFixed(1)}%`},description:{hits:"Memory cache로 처리된 요청 (KV 읽기 0회)",misses:"Memory cache 미스로 KV 조회한 요청",writes:"Memory cache에 저장된 항목 수",evictions:"Memory cache에서 삭제된 항목 수 (만료 또는 크기 제한)",hitRate:"Cache hit 비율 (높을수록 KV 사용량 감소)",cacheSize:"현재 Memory cache에 저장된 항목 수",maxSize:"Memory cache 최대 크기",memoryUsage:"Memory cache 사용률 (cacheSize / maxSize)"},kvUsageGuide:{currentHitRate:`${r}%`,recommendation:parseFloat(r)>=90?"✅ 캐시가 매우 효과적으로 작동하고 있습니다.":parseFloat(r)>=70?"⚠️ 캐시 히트율이 낮습니다. TTL 조정을 고려하세요.":"❌ 캐시 히트율이 매우 낮습니다. 캐시 설정을 확인하세요.",kvDailyReadsLimit:"100,000 reads/day (free tier)",kvDailyWritesLimit:"1,000 writes/day (free tier)",estimatedDailyReads:Math.round(Z.misses/(Z.hits+Z.misses||1)*1e4),estimatedDailyWrites:Math.round(Z.writes/(Z.hits+Z.misses||1)*1e3)}}})});let Ya={},za={};f.get("/api/debug/kv-usage",w(),async e=>{try{const t=Object.entries(Ya).sort((i,c)=>c[1]-i[1]).slice(0,20),s=Object.entries(za).sort((i,c)=>c[1]-i[1]).slice(0,20),r=Object.values(Ya).reduce((i,c)=>i+c,0),a=Object.values(za).reduce((i,c)=>i+c,0),n=r/1e3*100,o=a/1e5*100;if((n>=50||o>=50)&&e.env.DISCORD_WEBHOOK_URL)try{await nl(e.env.DISCORD_WEBHOOK_URL,o,n)}catch(i){console.error("[Discord] KV 경고 전송 실패:",i)}return e.json({success:!0,stats:{total_writes:r,total_reads:a,daily_write_limit:1e3,daily_read_limit:1e5,write_usage_percent:n.toFixed(2)+"%",read_usage_percent:o.toFixed(2)+"%",top_writes:t,top_reads:s},recommendations:r>500?["⚠️ KV Write 사용량이 높습니다!","1. 세션 갱신 주기를 늘리세요 (현재 29일)","2. 캐시를 메모리에만 저장하세요 (forceKvWrite: false)","3. JWT 인증으로 전환하세요 (KV 사용량 90% 감소)"]:["✅ KV 사용량이 정상 범위입니다."]})}catch(t){return e.json({success:!1,error:t.message},500)}});f.get("/api/debug/user/:email",w(),async e=>{const{DB:t}=e.env,s=e.req.param("email");try{const r=await t.prepare(`
      SELECT id, firebase_uid, email, name, created_at 
      FROM users 
      WHERE email = ?
    `).bind(s).first();return r?e.json({success:!0,user:{id:r.id,firebase_uid:r.firebase_uid,email:r.email,name:r.name,created_at:r.created_at}}):e.json({success:!1,error:"User not found"},404)}catch(r){return console.error("[Debug] Error fetching user:",r),e.json({success:!1,error:r.message},500)}});f.post("/api/debug/user/:email/firebase-uid",w(),async e=>{const{DB:t}=e.env,s=e.req.param("email");try{const{firebase_uid:r}=await e.req.json();if(!r)return e.json({success:!1,error:"firebase_uid is required"},400);const a=await t.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(s).first();return a?(await t.prepare(`
      UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?
    `).bind(r,s).run(),console.log(`[Debug] Updated Firebase UID for ${s}: ${r}`),e.json({success:!0,message:"Firebase UID updated successfully",user:{id:a.id,email:s,firebase_uid:r}})):e.json({success:!1,error:"User not found"},404)}catch(r){return console.error("[Debug] Error updating Firebase UID:",r),e.json({success:!1,error:r.message},500)}});f.get("/api/notifications",w(),async e=>{var s;const{DB:t}=e.env;try{const r=e.req.query("userId"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0");if(!r)return e.json({success:!1,error:"userId is required"},400);const o=await t.prepare(`
      SELECT id, type, title, message, link_url, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(r,a,n).all(),i=await t.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).bind(r).first();return e.json({success:!0,data:{notifications:o.results||[],unread_count:(i==null?void 0:i.count)||0,total:((s=o.results)==null?void 0:s.length)||0}})}catch(r){return console.error("[Notifications] Get error:",r),e.json({success:!1,error:r.message},500)}});f.patch("/api/notifications/:id/read",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),{userId:r}=await e.req.json();return r?(await t.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).bind(s,r).run()).meta.changes===0?e.json({success:!1,error:"Notification not found"},404):e.json({success:!0,message:"Notification marked as read"}):e.json({success:!1,error:"userId is required"},400)}catch(s){return console.error("[Notifications] Mark read error:",s),e.json({success:!1,error:s.message},500)}});f.patch("/api/notifications/read-all",w(),async e=>{const{DB:t}=e.env;try{const{userId:s}=await e.req.json();return s?(await t.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `).bind(s).run(),e.json({success:!0,message:"All notifications marked as read"})):e.json({success:!1,error:"userId is required"},400)}catch(s){return console.error("[Notifications] Mark all read error:",s),e.json({success:!1,error:s.message},500)}});f.delete("/api/notifications/:id",w(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=e.req.query("userId");return r?(await t.prepare(`
      DELETE FROM notifications
      WHERE id = ? AND user_id = ?
    `).bind(s,r).run()).meta.changes===0?e.json({success:!1,error:"Notification not found"},404):e.json({success:!0,message:"Notification deleted"}):e.json({success:!1,error:"userId is required"},400)}catch(s){return console.error("[Notifications] Delete error:",s),e.json({success:!1,error:s.message},500)}});async function Nu(e,t,s){var a,n;const r={embeds:[{title:"🚨 서버 에러 발생",color:16711680,fields:[{name:"에러 메시지",value:t.message||"Unknown error",inline:!1},{name:"발생 시각",value:new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}),inline:!0},{name:"HTTP 메소드",value:s.method||"N/A",inline:!0},{name:"API 경로",value:s.path||"N/A",inline:!1},{name:"사용자 ID",value:((a=s.userId)==null?void 0:a.toString())||"비로그인",inline:!0},{name:"사용자 타입",value:s.userType||"N/A",inline:!0},{name:"에러 스택",value:"```\n"+(((n=t.stack)==null?void 0:n.substring(0,800))||"N/A")+"\n```",inline:!1}],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Error Monitoring"}}]};try{await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)}),console.log("[Discord] Error alert sent successfully")}catch(o){console.error("[Discord Webhook] Failed to send alert:",o)}}f.onError(async(e,t)=>{if(console.error("[Error]",e),t.env.DISCORD_WEBHOOK_URL)try{await Nu(t.env.DISCORD_WEBHOOK_URL,e,{method:t.req.method,path:t.req.path,userId:t.get("userId"),userType:t.get("userType")})}catch(s){console.error("[Discord] Webhook failed, but continuing:",s)}return t.json({success:!1,error:{code:e.code||"INTERNAL_ERROR",message:e.message||"서버 오류가 발생했습니다."}},e.status||500)});const Xa=new co,ju=Object.assign({"/src/index.tsx":f});let Jo=!1;for(const[,e]of Object.entries(ju))e&&(Xa.route("/",e),Xa.notFound(e.notFoundHandler),Jo=!0);if(!Jo)throw new Error("Can't import modules from ['/src/index.tsx']");async function Yo(e){try{const{to:t,subject:s,htmlContent:r,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:t}]}],from:{email:"noreply@live.ur-team.com",name:"리스터코퍼레이션"},subject:s,content:[{type:"text/html",value:r},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",t),{success:!0}}catch(t){return console.error("[Email] Exception:",t),{success:!1,error:t.message}}}async function Mu(e){const{streamId:t,title:s,sellerName:r,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${t}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",l=`
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
  `,u=`
🎉 새 라이브 스트림 생성!

상태: ${c}
제목: ${s}
판매자: ${r}
플랫폼: ${a==="youtube"?"YouTube":"TikTok"}
${n?`예약 시간: ${new Date(n).toLocaleString("ko-KR")}`:""}
라이브 ID: #${t}

🔗 라이브 페이지: ${i}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `;return Yo({to:"jiwon@ur-team.com",subject:`[리스터코퍼레이션] 🎉 새 라이브 스트림 생성: ${s}`,htmlContent:l,textContent:u})}const Lu=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:Yo,sendLiveStreamCreatedEmail:Mu},Symbol.toStringTag,{value:"Module"})),Ea=["apiKey","idempotencyKey","stripeAccount","apiVersion","maxNetworkRetries","timeout","host","authenticator","stripeContext","additionalHeaders","streaming"];function zo(e){return e&&typeof e=="object"&&Ea.some(t=>Object.prototype.hasOwnProperty.call(e,t))}function yr(e,t){return Fu(e)}function Qa(e){return encodeURIComponent(e).replace(/!/g,"%21").replace(/\*/g,"%2A").replace(/\(/g,"%28").replace(/\)/g,"%29").replace(/'/g,"%27").replace(/%5B/g,"[").replace(/%5D/g,"]")}function $u(e){return e instanceof Date?Math.floor(e.getTime()/1e3).toString():e===null?"":String(e)}function Fu(e){const t=[];function s(r,a){if(a!==void 0){if(a===null||typeof a!="object"||a instanceof Date){t.push(Qa(r)+"="+Qa($u(a)));return}if(Array.isArray(a)){for(let n=0;n<a.length;n++)a[n]!==void 0&&s(r+"["+n+"]",a[n]);return}for(const n of Object.keys(a))s(r+"["+n+"]",a[n])}}if(typeof e=="object"&&e!==null)for(const r of Object.keys(e))s(r,e[r]);return t.join("&")}const ta=(()=>{const e={"\n":"\\n",'"':'\\"',"\u2028":"\\u2028","\u2029":"\\u2029"};return t=>{const s=t.replace(/["\n\r\u2028\u2029]/g,r=>e[r]);return r=>s.replace(/\{([\s\S]+?)\}/g,(a,n)=>{const o=r[n];return Uu(o)?encodeURIComponent(o):""})}})();function Uu(e){return["number","string","boolean"].includes(typeof e)}function qu(e){const t=e.match(/\{\w+\}/g);return t?t.map(s=>s.replace(/[{}]/g,"")):[]}function ga(e){if(!Array.isArray(e)||!e[0]||typeof e[0]!="object")return{};if(!zo(e[0]))return e.shift();const t=Object.keys(e[0]),s=t.filter(r=>Ea.includes(r));return s.length>0&&s.length!==t.length&&dr(`Options found in arguments (${s.join(", ")}). Did you mean to pass an options object? See https://github.com/stripe/stripe-node/wiki/Passing-Options.`),{}}function Xo(e){const t={host:null,headers:{},settings:{},streaming:!1};if(e.length>0){const s=e[e.length-1];if(typeof s=="string")t.authenticator=sa(e.pop());else if(zo(s)){const r=Object.assign({},e.pop()),a=Object.keys(r).filter(n=>!Ea.includes(n));if(a.length&&dr(`Invalid options found (${a.join(", ")}); ignoring.`),r.apiKey&&(t.authenticator=sa(r.apiKey)),r.idempotencyKey&&(t.headers["Idempotency-Key"]=r.idempotencyKey),r.stripeAccount&&(t.headers["Stripe-Account"]=r.stripeAccount),r.stripeContext){if(t.headers["Stripe-Account"])throw new Error("Can't specify both stripeAccount and stripeContext.");t.headers["Stripe-Context"]=r.stripeContext}if(r.apiVersion&&(t.headers["Stripe-Version"]=r.apiVersion),Number.isInteger(r.maxNetworkRetries)&&(t.settings.maxNetworkRetries=r.maxNetworkRetries),Number.isInteger(r.timeout)&&(t.settings.timeout=r.timeout),r.host&&(t.host=r.host),r.authenticator){if(r.apiKey)throw new Error("Can't specify both apiKey and authenticator.");if(typeof r.authenticator!="function")throw new Error("The authenticator must be a function receiving a request as the first parameter.");t.authenticator=r.authenticator}r.additionalHeaders&&(t.headers=r.additionalHeaders),r.streaming&&(t.streaming=!0)}}return t}function Hu(e){const t=this,s=Object.prototype.hasOwnProperty.call(e,"constructor")?e.constructor:function(...r){t.apply(this,r)};return Object.assign(s,t),s.prototype=Object.create(t.prototype),Object.assign(s.prototype,e),s}function Cr(e){if(typeof e!="object")throw new Error("Argument must be an object");return Object.keys(e).reduce((t,s)=>(e[s]!=null&&(t[s]=e[s]),t),{})}function Wu(e){return e&&typeof e=="object"?Object.keys(e).reduce((t,s)=>(t[Bu(s)]=e[s],t),{}):e}function Bu(e){return e.split("-").map(t=>t.charAt(0).toUpperCase()+t.substr(1).toLowerCase()).join("-")}function ya(e,t){return t?e.then(s=>{setTimeout(()=>{t(null,s)},0)},s=>{setTimeout(()=>{t(s,null)},0)}):e}function Ku(e){return e==="OAuth"?"oauth":e[0].toLowerCase()+e.substring(1)}function dr(e){return typeof process.emitWarning!="function"?console.warn(`Stripe: ${e}`):process.emitWarning(e,"Stripe")}function Gu(e){const t=typeof e;return(t==="function"||t==="object")&&!!e}function Vu(e){const t={},s=(r,a)=>{Object.entries(r).forEach(([n,o])=>{const i=a?`${a}[${n}]`:n;if(Gu(o)){if(!(o instanceof Uint8Array)&&!Object.prototype.hasOwnProperty.call(o,"data"))return s(o,i);t[i]=o}else t[i]=String(o)})};return s(e,null),t}function Dr(e,t,s){if(!Number.isInteger(t)){if(s!==void 0)return s;throw new Error(`${e} must be an integer`)}return t}function Ju(){return typeof process>"u"?{}:{lang_version:process.version,platform:process.platform}}function sa(e){const t=s=>(s.headers.Authorization="Bearer "+e,Promise.resolve());return t._apiKey=e,t}function Yu(e,t){return this[e]instanceof Date?Math.floor(this[e].getTime()/1e3).toString():t}function zu(e){return JSON.stringify(e,Yu)}function Qo(e){return e&&e.startsWith("/v2")?"v2":"v1"}function ra(e){return Array.isArray(e)?e.join(", "):String(e)}function Xu(e){const t=Array.isArray(e)?e[0]:e;return Number(t)}function Qu(e){return Object.entries(e).map(([t,s])=>[t,ra(s)])}class fe{getClientName(){throw new Error("getClientName not implemented.")}makeRequest(t,s,r,a,n,o,i,c){throw new Error("makeRequest not implemented.")}static makeTimeoutError(){const t=new TypeError(fe.TIMEOUT_ERROR_CODE);return t.code=fe.TIMEOUT_ERROR_CODE,t}}fe.CONNECTION_CLOSED_ERROR_CODES=["ECONNRESET","EPIPE"];fe.TIMEOUT_ERROR_CODE="ETIMEDOUT";class Zo{constructor(t,s){this._statusCode=t,this._headers=s}getStatusCode(){return this._statusCode}getHeaders(){return this._headers}getRawResponse(){throw new Error("getRawResponse not implemented.")}toStream(t){throw new Error("toStream not implemented.")}toJSON(){throw new Error("toJSON not implemented.")}}class pr extends fe{constructor(t){if(super(),!t){if(!globalThis.fetch)throw new Error("fetch() function not provided and is not defined in the global scope. You must provide a fetch implementation.");t=globalThis.fetch}globalThis.AbortController?this._fetchFn=pr.makeFetchWithAbortTimeout(t):this._fetchFn=pr.makeFetchWithRaceTimeout(t)}static makeFetchWithRaceTimeout(t){return(s,r,a)=>{let n;const o=new Promise((c,l)=>{n=setTimeout(()=>{n=null,l(fe.makeTimeoutError())},a)}),i=t(s,r);return Promise.race([i,o]).finally(()=>{n&&clearTimeout(n)})}}static makeFetchWithAbortTimeout(t){return async(s,r,a)=>{const n=new AbortController;let o=setTimeout(()=>{o=null,n.abort(fe.makeTimeoutError())},a);try{return await t(s,Object.assign(Object.assign({},r),{signal:n.signal}))}catch(i){throw i.name==="AbortError"?fe.makeTimeoutError():i}finally{o&&clearTimeout(o)}}}getClientName(){return"fetch"}async makeRequest(t,s,r,a,n,o,i,c){const l=i==="http",u=new URL(r,`${l?"http":"https"}://${t}`);u.port=s;const d=a=="POST"||a=="PUT"||a=="PATCH",m=o||(d?"":void 0),_=await this._fetchFn(u.toString(),{method:a,headers:Qu(n),body:m},c);return new ba(_)}}class ba extends Zo{constructor(t){super(t.status,ba._transformHeadersToObject(t.headers)),this._res=t}getRawResponse(){return this._res}toStream(t){return t(),this._res.body}toJSON(){return this._res.json()}static _transformHeadersToObject(t){const s={};for(const r of t){if(!Array.isArray(r)||r.length!=2)throw new Error("Response objects produced by the fetch function given to FetchHttpClient do not have an iterable headers map. Response#headers should be an iterable object.");s[r[0]]=r[1]}return s}}class ei{computeHMACSignature(t,s){throw new Error("computeHMACSignature not implemented.")}computeHMACSignatureAsync(t,s){throw new Error("computeHMACSignatureAsync not implemented.")}computeSHA256Async(t){throw new Error("computeSHA256 not implemented.")}}class ti extends Error{}class Zu extends ei{constructor(t){super(),this.subtleCrypto=t||crypto.subtle}computeHMACSignature(t,s){throw new ti("SubtleCryptoProvider cannot be used in a synchronous context.")}async computeHMACSignatureAsync(t,s){const r=new TextEncoder,a=await this.subtleCrypto.importKey("raw",r.encode(s),{name:"HMAC",hash:{name:"SHA-256"}},!1,["sign"]),n=await this.subtleCrypto.sign("hmac",a,r.encode(t)),o=new Uint8Array(n),i=new Array(o.length);for(let c=0;c<o.length;c++)i[c]=aa[o[c]];return i.join("")}async computeSHA256Async(t){return new Uint8Array(await this.subtleCrypto.digest("SHA-256",t))}}const aa=new Array(256);for(let e=0;e<aa.length;e++)aa[e]=e.toString(16).padStart(2,"0");class ed{constructor(){this._fetchFn=null,this._agent=null}getUname(){throw new Error("getUname not implemented.")}uuid4(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,t=>{const s=Math.random()*16|0;return(t==="x"?s:s&3|8).toString(16)})}secureCompare(t,s){if(t.length!==s.length)return!1;const r=t.length;let a=0;for(let n=0;n<r;++n)a|=t.charCodeAt(n)^s.charCodeAt(n);return a===0}createEmitter(){throw new Error("createEmitter not implemented.")}tryBufferData(t){throw new Error("tryBufferData not implemented.")}createNodeHttpClient(t){throw new Error("createNodeHttpClient not implemented.")}createFetchHttpClient(t){return new pr(t)}createDefaultHttpClient(){throw new Error("createDefaultHttpClient not implemented.")}createNodeCryptoProvider(){throw new Error("createNodeCryptoProvider not implemented.")}createSubtleCryptoProvider(t){return new Zu(t)}createDefaultCryptoProvider(){throw new Error("createDefaultCryptoProvider not implemented.")}}class td extends Event{constructor(t,s){super(t),this.data=s}}class sd{constructor(){this.eventTarget=new EventTarget,this.listenerMapping=new Map}on(t,s){const r=a=>{s(a.data)};return this.listenerMapping.set(s,r),this.eventTarget.addEventListener(t,r)}removeListener(t,s){const r=this.listenerMapping.get(s);return this.listenerMapping.delete(s),this.eventTarget.removeEventListener(t,r)}once(t,s){const r=a=>{s(a.data)};return this.listenerMapping.set(s,r),this.eventTarget.addEventListener(t,r,{once:!0})}emit(t,s){return this.eventTarget.dispatchEvent(new td(t,s))}}class rd extends ed{getUname(){return Promise.resolve(null)}createEmitter(){return new sd}tryBufferData(t){if(t.file.data instanceof ReadableStream)throw new Error("Uploading a file as a stream is not supported in non-Node environments. Please open or upvote an issue at github.com/stripe/stripe-node if you use this, detailing your use-case.");return Promise.resolve(t)}createNodeHttpClient(){throw new Error("Stripe: `createNodeHttpClient()` is not available in non-Node environments. Please use `createFetchHttpClient()` instead.")}createDefaultHttpClient(){return super.createFetchHttpClient()}createNodeCryptoProvider(){throw new Error("Stripe: `createNodeCryptoProvider()` is not available in non-Node environments. Please use `createSubtleCryptoProvider()` instead.")}createDefaultCryptoProvider(){return this.createSubtleCryptoProvider()}}const br=e=>{switch(e.type){case"card_error":return new ri(e);case"invalid_request_error":return new Ta(e);case"api_error":return new va(e);case"authentication_error":return new Sa(e);case"rate_limit_error":return new wa(e);case"idempotency_error":return new oi(e);case"invalid_grant":return new ii(e);default:return new ci(e)}},si=e=>{switch(e.type){case"temporary_session_expired":return new li(e)}switch(e.code){case"invalid_fields":return new Ta(e)}return br(e)};class oe extends Error{constructor(t={},s=null){var r;super(t.message),this.type=s||this.constructor.name,this.raw=t,this.rawType=t.type,this.code=t.code,this.doc_url=t.doc_url,this.param=t.param,this.detail=t.detail,this.headers=t.headers,this.requestId=t.requestId,this.statusCode=t.statusCode,this.message=(r=t.message)!==null&&r!==void 0?r:"",this.userMessage=t.user_message,this.charge=t.charge,this.decline_code=t.decline_code,this.payment_intent=t.payment_intent,this.payment_method=t.payment_method,this.payment_method_type=t.payment_method_type,this.setup_intent=t.setup_intent,this.source=t.source}}oe.generate=br;class ri extends oe{constructor(t={}){super(t,"StripeCardError")}}class Ta extends oe{constructor(t={}){super(t,"StripeInvalidRequestError")}}class va extends oe{constructor(t={}){super(t,"StripeAPIError")}}class Sa extends oe{constructor(t={}){super(t,"StripeAuthenticationError")}}class ai extends oe{constructor(t={}){super(t,"StripePermissionError")}}class wa extends oe{constructor(t={}){super(t,"StripeRateLimitError")}}class ni extends oe{constructor(t={}){super(t,"StripeConnectionError")}}class Fe extends oe{constructor(t,s,r={}){super(r,"StripeSignatureVerificationError"),this.header=t,this.payload=s}}class oi extends oe{constructor(t={}){super(t,"StripeIdempotencyError")}}class ii extends oe{constructor(t={}){super(t,"StripeInvalidGrantError")}}class ci extends oe{constructor(t={}){super(t,"StripeUnknownError")}}class li extends oe{constructor(t={}){super(t,"TemporarySessionExpiredError")}}const Za=Object.freeze(Object.defineProperty({__proto__:null,StripeAPIError:va,StripeAuthenticationError:Sa,StripeCardError:ri,StripeConnectionError:ni,StripeError:oe,StripeIdempotencyError:oi,StripeInvalidGrantError:ii,StripeInvalidRequestError:Ta,StripePermissionError:ai,StripeRateLimitError:wa,StripeSignatureVerificationError:Fe,StripeUnknownError:ci,TemporarySessionExpiredError:li,generateV1Error:br,generateV2Error:si},Symbol.toStringTag,{value:"Module"})),ad=60;class fs{constructor(t,s){this._stripe=t,this._maxBufferedRequestMetric=s}_normalizeStripeContext(t,s){return t?t.toString()||null:(s==null?void 0:s.toString())||null}_addHeadersDirectlyToObject(t,s){t.requestId=s["request-id"],t.stripeAccount=t.stripeAccount||s["stripe-account"],t.apiVersion=t.apiVersion||s["stripe-version"],t.idempotencyKey=t.idempotencyKey||s["idempotency-key"]}_makeResponseEvent(t,s,r){const a=Date.now(),n=a-t.request_start_time;return Cr({api_version:r["stripe-version"],account:r["stripe-account"],idempotency_key:r["idempotency-key"],method:t.method,path:t.path,status:s,request_id:this._getRequestId(r),elapsed:n,request_start_time:t.request_start_time,request_end_time:a})}_getRequestId(t){return t["request-id"]}_streamingResponseHandler(t,s,r){return a=>{const n=a.getHeaders(),o=()=>{const c=this._makeResponseEvent(t,a.getStatusCode(),n);this._stripe._emitter.emit("response",c),this._recordRequestMetrics(this._getRequestId(n),c.elapsed,s)},i=a.toStream(o);return this._addHeadersDirectlyToObject(i,n),r(null,i)}}_jsonResponseHandler(t,s,r,a){return n=>{const o=n.getHeaders(),i=this._getRequestId(o),c=n.getStatusCode(),l=this._makeResponseEvent(t,c,o);this._stripe._emitter.emit("response",l),n.toJSON().then(u=>{if(u.error){let d;throw typeof u.error=="string"&&(u.error={type:u.error,message:u.error_description}),u.error.headers=o,u.error.statusCode=c,u.error.requestId=i,c===401?d=new Sa(u.error):c===403?d=new ai(u.error):c===429?d=new wa(u.error):s==="v2"?d=si(u.error):d=br(u.error),d}return u},u=>{throw new va({message:"Invalid JSON received from the Stripe API",exception:u,requestId:o["request-id"]})}).then(u=>{this._recordRequestMetrics(i,l.elapsed,r);const d=n.getRawResponse();this._addHeadersDirectlyToObject(d,o),Object.defineProperty(u,"lastResponse",{enumerable:!1,writable:!1,value:d}),a(null,u)},u=>a(u,null))}}static _generateConnectionErrorMessage(t){return`An error occurred with our connection to Stripe.${t>0?` Request was retried ${t} times.`:""}`}static _shouldRetry(t,s,r,a){return a&&s===0&&fe.CONNECTION_CLOSED_ERROR_CODES.includes(a.code)?!0:s>=r?!1:t?t.getHeaders()["stripe-should-retry"]==="false"?!1:t.getHeaders()["stripe-should-retry"]==="true"||t.getStatusCode()===409||t.getStatusCode()>=500:!0}_getSleepTimeInMS(t,s=null){const r=this._stripe.getInitialNetworkRetryDelay(),a=this._stripe.getMaxNetworkRetryDelay();let n=Math.min(r*Math.pow(2,t-1),a);return n*=.5*(1+Math.random()),n=Math.max(r,n),Number.isInteger(s)&&s<=ad&&(n=Math.max(n,s)),n*1e3}_getMaxNetworkRetries(t={}){return t.maxNetworkRetries!==void 0&&Number.isInteger(t.maxNetworkRetries)?t.maxNetworkRetries:this._stripe.getMaxNetworkRetries()}_defaultIdempotencyKey(t,s,r){const a=this._getMaxNetworkRetries(s),n=()=>`stripe-node-retry-${this._stripe._platformFunctions.uuid4()}`;if(r==="v2"){if(t==="POST"||t==="DELETE")return n()}else if(r==="v1"&&t==="POST"&&a>0)return n();return null}_makeHeaders({contentType:t,contentLength:s,apiVersion:r,clientUserAgent:a,method:n,userSuppliedHeaders:o,userSuppliedSettings:i,stripeAccount:c,stripeContext:l,apiMode:u}){const d={Accept:"application/json","Content-Type":t,"User-Agent":this._getUserAgentString(u),"X-Stripe-Client-User-Agent":a,"X-Stripe-Client-Telemetry":this._getTelemetryHeader(),"Stripe-Version":r,"Stripe-Account":c,"Stripe-Context":l,"Idempotency-Key":this._defaultIdempotencyKey(n,i,u)},m=n=="POST"||n=="PUT"||n=="PATCH";return(m||s)&&(m||dr(`${n} method had non-zero contentLength but no payload is expected for this verb`),d["Content-Length"]=s),Object.assign(Cr(d),Wu(o))}_getUserAgentString(t){const s=this._stripe.getConstant("PACKAGE_VERSION"),r=this._stripe._appInfo?this._stripe.getAppInfoAsString():"";return`Stripe/${t} NodeBindings/${s} ${r}`.trim()}_getTelemetryHeader(){if(this._stripe.getTelemetryEnabled()&&this._stripe._prevRequestMetrics.length>0){const t=this._stripe._prevRequestMetrics.shift();return JSON.stringify({last_request_metrics:t})}}_recordRequestMetrics(t,s,r){if(this._stripe.getTelemetryEnabled()&&t)if(this._stripe._prevRequestMetrics.length>this._maxBufferedRequestMetric)dr("Request metrics buffer is full, dropping telemetry message.");else{const a={request_id:t,request_duration_ms:s};r&&r.length>0&&(a.usage=r),this._stripe._prevRequestMetrics.push(a)}}_rawRequest(t,s,r,a,n){return new Promise((i,c)=>{let l;try{const h=t.toUpperCase();if(h!=="POST"&&r&&Object.keys(r).length!==0)throw new Error("rawRequest only supports params on POST requests. Please pass null and add your parameters to path.");const E=[].slice.call([r,a]),v=ga(E),b=h==="POST"?Object.assign({},v):null,g=Xo(E),S=g.headers,y=g.authenticator;l={requestMethod:h,requestPath:s,bodyData:b,queryData:{},authenticator:y,headers:S,host:g.host,streaming:!!g.streaming,settings:{},usage:n||["raw_request"]}}catch(h){c(h);return}function u(h,E){h?c(h):i(E)}const{headers:d,settings:m}=l,_=l.authenticator;this._request(l.requestMethod,l.host,s,l.bodyData,_,{headers:d,settings:m,streaming:l.streaming},l.usage,u)})}_getContentLength(t){return typeof t=="string"?new TextEncoder().encode(t).length:t.length}_request(t,s,r,a,n,o,i=[],c,l=null){var u;let d;n=(u=n??this._stripe._authenticator)!==null&&u!==void 0?u:null;const m=Qo(r),_=(v,b,g,S,y)=>setTimeout(v,this._getSleepTimeInMS(S,y),b,g,S+1),h=(v,b,g)=>{const S=o.settings&&o.settings.timeout&&Number.isInteger(o.settings.timeout)&&o.settings.timeout>=0?o.settings.timeout:this._stripe.getApiField("timeout"),y={host:s||this._stripe.getApiField("host"),port:this._stripe.getApiField("port"),path:r,method:t,headers:Object.assign({},b),body:d,protocol:this._stripe.getApiField("protocol")};n(y).then(()=>{const x=this._stripe.getApiField("httpClient").makeRequest(y.host,y.port,y.path,y.method,y.headers,y.body,y.protocol,S),k=Date.now(),R=Cr({api_version:v,account:ra(b["Stripe-Account"]),idempotency_key:ra(b["Idempotency-Key"]),method:t,path:r,request_start_time:k}),I=g||0,$=this._getMaxNetworkRetries(o.settings||{});this._stripe._emitter.emit("request",R),x.then(N=>fs._shouldRetry(N,I,$)?_(h,v,b,I,Xu(N.getHeaders()["retry-after"])):o.streaming&&N.getStatusCode()<400?this._streamingResponseHandler(R,i,c)(N):this._jsonResponseHandler(R,m,i,c)(N)).catch(N=>{if(fs._shouldRetry(null,I,$,N))return _(h,v,b,I,null);{const L=N.code&&N.code===fe.TIMEOUT_ERROR_CODE;return c(new ni({message:L?`Request aborted due to timeout being reached (${S}ms)`:fs._generateConnectionErrorMessage(I),detail:N}))}})}).catch(x=>{throw new oe({message:"Unable to authenticate the request",exception:x})})},E=(v,b)=>{if(v)return c(v);d=b,this._stripe.getClientUserAgent(g=>{var S,y,x;const k=this._stripe.getApiField("version"),R=this._makeHeaders({contentType:m=="v2"?"application/json":"application/x-www-form-urlencoded",contentLength:this._getContentLength(b),apiVersion:k,clientUserAgent:g,method:t,userSuppliedHeaders:(S=o.headers)!==null&&S!==void 0?S:null,userSuppliedSettings:(y=o.settings)!==null&&y!==void 0?y:{},stripeAccount:(x=o.stripeAccount)!==null&&x!==void 0?x:this._stripe.getApiField("stripeAccount"),stripeContext:this._normalizeStripeContext(o.stripeContext,this._stripe.getApiField("stripeContext")),apiMode:m});h(k,R,0)})};if(l)l(t,a,o.headers,E);else{let v;m=="v2"?v=a?zu(a):"":v=yr(a||{}),E(null,v)}}}class ui{constructor(t,s,r,a){this.index=0,this.pagePromise=t,this.promiseCache={currentPromise:null},this.requestArgs=s,this.spec=r,this.stripeResource=a}async iterate(t){if(!(t&&t.data&&typeof t.data.length=="number"))throw Error("Unexpected: Stripe API response does not have a well-formed `data` array.");const s=di(this.requestArgs);if(this.index<t.data.length){const r=s?t.data.length-1-this.index:this.index,a=t.data[r];return this.index+=1,{value:a,done:!1}}else if(t.has_more){this.index=0,this.pagePromise=this.getNextPage(t);const r=await this.pagePromise;return this.iterate(r)}return{done:!0,value:void 0}}getNextPage(t){throw new Error("Unimplemented")}async _next(){return this.iterate(await this.pagePromise)}next(){if(this.promiseCache.currentPromise)return this.promiseCache.currentPromise;const t=(async()=>{const s=await this._next();return this.promiseCache.currentPromise=null,s})();return this.promiseCache.currentPromise=t,t}}class nd extends ui{getNextPage(t){const s=di(this.requestArgs),r=pd(t,s);return this.stripeResource._makeRequest(this.requestArgs,this.spec,{[s?"ending_before":"starting_after"]:r})}}class od extends ui{getNextPage(t){if(!t.next_page)throw Error("Unexpected: Stripe API response does not have a well-formed `next_page` field, but `has_more` was true.");return this.stripeResource._makeRequest(this.requestArgs,this.spec,{page:t.next_page})}}class id{constructor(t,s,r,a){this.firstPagePromise=t,this.currentPageIterator=null,this.nextPageUrl=null,this.requestArgs=s,this.spec=r,this.stripeResource=a}async initFirstPage(){if(this.firstPagePromise){const t=await this.firstPagePromise;this.firstPagePromise=null,this.currentPageIterator=t.data[Symbol.iterator](),this.nextPageUrl=t.next_page_url||null}}async turnPage(){if(!this.nextPageUrl)return null;this.spec.fullPath=this.nextPageUrl;const t=await this.stripeResource._makeRequest([],this.spec,{});return this.nextPageUrl=t.next_page_url||null,this.currentPageIterator=t.data[Symbol.iterator](),this.currentPageIterator}async next(){if(await this.initFirstPage(),this.currentPageIterator){const r=this.currentPageIterator.next();if(!r.done)return{done:!1,value:r.value}}const t=await this.turnPage();if(!t)return{done:!0,value:void 0};const s=t.next();return s.done?{done:!0,value:void 0}:{done:!1,value:s.value}}}const cd=(e,t,s,r)=>{const a=Qo(s.fullPath||s.path);return a!=="v2"&&s.methodType==="search"?kr(new od(r,t,s,e)):a!=="v2"&&s.methodType==="list"?kr(new nd(r,t,s,e)):a==="v2"&&s.methodType==="list"?kr(new id(r,t,s,e)):null},kr=e=>{const t=md((...a)=>e.next(...a)),s=fd(t),r={autoPagingEach:t,autoPagingToArray:s,next:()=>e.next(),return:()=>({}),[ld()]:()=>r};return r};function ld(){return typeof Symbol<"u"&&Symbol.asyncIterator?Symbol.asyncIterator:"@@asyncIterator"}function ud(e){if(e.length<2)return null;const t=e[1];if(typeof t!="function")throw Error(`The second argument to autoPagingEach, if present, must be a callback function; received ${typeof t}`);return t}function dd(e){if(e.length===0)return;const t=e[0];if(typeof t!="function")throw Error(`The first argument to autoPagingEach, if present, must be a callback function; received ${typeof t}`);if(t.length===2)return t;if(t.length>2)throw Error(`The \`onItem\` callback function passed to autoPagingEach must accept at most two arguments; got ${t}`);return function(r,a){const n=t(r);a(n)}}function pd(e,t){const s=t?0:e.data.length-1,r=e.data[s],a=r&&r.id;if(!a)throw Error("Unexpected: No `id` found on the last item while auto-paging a list.");return a}function md(e){return function(){const s=[].slice.call(arguments),r=dd(s),a=ud(s);if(s.length>2)throw Error(`autoPagingEach takes up to two arguments; received ${s}`);const n=hd(e,r);return ya(n,a)}}function fd(e){return function(s,r){const a=s&&s.limit;if(!a)throw Error("You must pass a `limit` option to autoPagingToArray, e.g., `autoPagingToArray({limit: 1000});`.");if(a>1e4)throw Error("You cannot specify a limit of more than 10,000 items to fetch in `autoPagingToArray`; use `autoPagingEach` to iterate through longer lists.");const n=new Promise((o,i)=>{const c=[];e(l=>{if(c.push(l),c.length>=a)return!1}).then(()=>{o(c)}).catch(i)});return ya(n,r)}}function hd(e,t){return new Promise((s,r)=>{function a(n){if(n.done){s();return}const o=n.value;return new Promise(i=>{t(o,i)}).then(i=>i===!1?a({done:!0,value:void 0}):e().then(a))}e().then(a).catch(r)})}function di(e){const t=[].slice.call(e);return!!ga(t).ending_before}function _d(e){if(e.path!==void 0&&e.fullPath!==void 0)throw new Error(`Method spec specified both a 'path' (${e.path}) and a 'fullPath' (${e.fullPath}).`);return function(...t){const s=typeof t[t.length-1]=="function"&&t.pop();e.urlParams=qu(e.fullPath||this.createResourcePathWithSymbols(e.path||""));const r=ya(this._makeRequest(t,e,{}),s);return Object.assign(r,cd(this,t,e,r)),r}}p.extend=Hu;p.method=_d;p.MAX_BUFFERED_REQUEST_METRICS=100;function p(e,t){if(this._stripe=e,t)throw new Error("Support for curried url params was dropped in stripe-node v7.0.0. Instead, pass two ids.");this.basePath=ta(this.basePath||e.getApiField("basePath")),this.resourcePath=this.path,this.path=ta(this.path),this.initialize(...arguments)}p.prototype={_stripe:null,path:"",resourcePath:"",basePath:null,initialize(){},requestDataProcessor:null,validateRequest:null,createFullPath(e,t){const s=[this.basePath(t),this.path(t)];if(typeof e=="function"){const r=e(t);r&&s.push(r)}else s.push(e);return this._joinUrlParts(s)},createResourcePathWithSymbols(e){return e?`/${this._joinUrlParts([this.resourcePath,e])}`:`/${this.resourcePath}`},_joinUrlParts(e){return e.join("/").replace(/\/{2,}/g,"/")},_getRequestOpts(e,t,s){var r;const a=(t.method||"GET").toUpperCase(),n=t.usage||[],o=t.urlParams||[],i=t.encode||(R=>R),c=!!t.fullPath,l=ta(c?t.fullPath:t.path||""),u=c?t.fullPath:this.createResourcePathWithSymbols(t.path),d=[].slice.call(e),m=o.reduce((R,I)=>{const $=d.shift();if(typeof $!="string")throw new Error(`Stripe: Argument "${I}" must be a string, but got: ${$} (on API request to \`${a} ${u}\`)`);return R[I]=$,R},{}),_=ga(d),h=i(Object.assign({},_,s)),E=Xo(d),v=E.host||t.host,b=!!t.streaming||!!E.streaming;if(d.filter(R=>R!=null).length)throw new Error(`Stripe: Unknown arguments (${d}). Did you mean to pass an options object? See https://github.com/stripe/stripe-node/wiki/Passing-Options. (on API request to ${a} \`${u}\`)`);const g=c?l(m):this.createFullPath(l,m),S=Object.assign(E.headers,t.headers);t.validator&&t.validator(h,{headers:S});const y=t.method==="GET"||t.method==="DELETE";return{requestMethod:a,requestPath:g,bodyData:y?null:h,queryData:y?h:{},authenticator:(r=E.authenticator)!==null&&r!==void 0?r:null,headers:S,host:v??null,streaming:b,settings:E.settings,usage:n}},_makeRequest(e,t,s){return new Promise((r,a)=>{var n;let o;try{o=this._getRequestOpts(e,t,s)}catch(m){a(m);return}function i(m,_){m?a(m):r(t.transformResponseData?t.transformResponseData(_):_)}const c=Object.keys(o.queryData).length===0,l=[o.requestPath,c?"":"?",yr(o.queryData)].join(""),{headers:u,settings:d}=o;this._stripe._requestSender._request(o.requestMethod,o.host,l,o.bodyData,o.authenticator,{headers:u,settings:d,streaming:o.streaming},o.usage,i,(n=this.requestDataProcessor)===null||n===void 0?void 0:n.bind(this))})}};class et{constructor(t=[]){this._segments=[...t]}get segments(){return[...this._segments]}push(t){if(!t)throw new Error("Segment cannot be null or undefined");return new et([...this._segments,t])}pop(){if(this._segments.length===0)throw new Error("Cannot pop from an empty context");return new et(this._segments.slice(0,-1))}toString(){return this._segments.join("/")}static parse(t){return t?new et(t.split("/")):new et([])}}function Ed(e){const t={DEFAULT_TOLERANCE:300,signature:null,constructEvent(u,d,m,_,h,E){try{if(!this.signature)throw new Error("ERR: missing signature helper, unable to verify");this.signature.verifyHeader(u,d,m,_||t.DEFAULT_TOLERANCE,h,E)}catch(b){throw b instanceof ti&&(b.message+="\nUse `await constructEventAsync(...)` instead of `constructEvent(...)`"),b}return u instanceof Uint8Array?JSON.parse(new TextDecoder("utf8").decode(u)):JSON.parse(u)},async constructEventAsync(u,d,m,_,h,E){if(!this.signature)throw new Error("ERR: missing signature helper, unable to verify");return await this.signature.verifyHeaderAsync(u,d,m,_||t.DEFAULT_TOLERANCE,h,E),u instanceof Uint8Array?JSON.parse(new TextDecoder("utf8").decode(u)):JSON.parse(u)},generateTestHeaderString:function(u){const d=l(u),m=d.signature||d.cryptoProvider.computeHMACSignature(d.payloadString,d.secret);return d.generateHeaderString(m)},generateTestHeaderStringAsync:async function(u){const d=l(u),m=d.signature||await d.cryptoProvider.computeHMACSignatureAsync(d.payloadString,d.secret);return d.generateHeaderString(m)}},s={EXPECTED_SCHEME:"v1",verifyHeader(u,d,m,_,h,E){const{decodedHeader:v,decodedPayload:b,details:g,suspectPayloadType:S}=a(u,d,this.EXPECTED_SCHEME),y=/\s/.test(m);h=h||c();const x=h.computeHMACSignature(r(b,g),m);return n(b,v,g,x,_,S,y,E),!0},async verifyHeaderAsync(u,d,m,_,h,E){const{decodedHeader:v,decodedPayload:b,details:g,suspectPayloadType:S}=a(u,d,this.EXPECTED_SCHEME),y=/\s/.test(m);h=h||c();const x=await h.computeHMACSignatureAsync(r(b,g),m);return n(b,v,g,x,_,S,y,E)}};function r(u,d){return`${d.timestamp}.${u}`}function a(u,d,m){if(!u)throw new Fe(d,u,{message:"No webhook payload was provided."});const _=typeof u!="string"&&!(u instanceof Uint8Array),h=new TextDecoder("utf8"),E=u instanceof Uint8Array?h.decode(u):u;if(Array.isArray(d))throw new Error("Unexpected: An array was passed as a header, which should not be possible for the stripe-signature header.");if(d==null||d=="")throw new Fe(d,u,{message:"No stripe-signature header value was provided."});const v=d instanceof Uint8Array?h.decode(d):d,b=o(v,m);if(!b||b.timestamp===-1)throw new Fe(v,E,{message:"Unable to extract timestamp and signatures from header"});if(!b.signatures.length)throw new Fe(v,E,{message:"No signatures found with expected scheme"});return{decodedPayload:E,decodedHeader:v,details:b,suspectPayloadType:_}}function n(u,d,m,_,h,E,v,b){const g=!!m.signatures.filter(e.secureCompare.bind(e,_)).length,S=`
Learn more about webhook signing and explore webhook integration examples for various frameworks at https://docs.stripe.com/webhooks/signature`,y=v?`

Note: The provided signing secret contains whitespace. This often indicates an extra newline or space is in the value`:"";if(!g)throw E?new Fe(d,u,{message:`Webhook payload must be provided as a string or a Buffer (https://nodejs.org/api/buffer.html) instance representing the _raw_ request body.Payload was provided as a parsed JavaScript object instead. 
Signature verification is impossible without access to the original signed material. 
`+S+`
`+y}):new Fe(d,u,{message:`No signatures found matching the expected signature for payload. Are you passing the raw request body you received from Stripe? 
 If a webhook request is being forwarded by a third-party tool, ensure that the exact request body, including JSON formatting and new line style, is preserved.
`+S+`
`+y});const x=Math.floor((typeof b=="number"?b:Date.now())/1e3)-m.timestamp;if(h>0&&x>h)throw new Fe(d,u,{message:"Timestamp outside the tolerance zone"});return!0}function o(u,d){return typeof u!="string"?null:u.split(",").reduce((m,_)=>{const h=_.split("=");return h[0]==="t"&&(m.timestamp=parseInt(h[1],10)),h[0]===d&&m.signatures.push(h[1]),m},{timestamp:-1,signatures:[]})}let i=null;function c(){return i||(i=e.createDefaultCryptoProvider()),i}function l(u){if(!u)throw new oe({message:"Options are required"});const d=Math.floor(u.timestamp)||Math.floor(Date.now()/1e3),m=u.scheme||s.EXPECTED_SCHEME,_=u.cryptoProvider||c(),h=`${d}.${u.payload}`,E=v=>`t=${d},${m}=${v}`;return Object.assign(Object.assign({},u),{timestamp:d,scheme:m,cryptoProvider:_,payloadString:h,generateHeaderString:E})}return t.signature=s,t}const pi="2026-02-25.clover";function gd(e,t){for(const s in t){if(!Object.prototype.hasOwnProperty.call(t,s))continue;const r=s[0].toLowerCase()+s.substring(1),a=new t[s](e);this[r]=a}}function W(e,t){return function(s){return new gd(s,t)}}const yd=p.method,bd=p.extend({create:yd({method:"POST",fullPath:"/v2/core/account_links"})}),en=p.method,Td=p.extend({create:en({method:"POST",fullPath:"/v2/core/account_tokens"}),retrieve:en({method:"GET",fullPath:"/v2/core/account_tokens/{id}"})}),Ve=p.method,vd=p.extend({retrieve:Ve({method:"GET",fullPath:"/v1/financial_connections/accounts/{account}"}),list:Ve({method:"GET",fullPath:"/v1/financial_connections/accounts",methodType:"list"}),disconnect:Ve({method:"POST",fullPath:"/v1/financial_connections/accounts/{account}/disconnect"}),listOwners:Ve({method:"GET",fullPath:"/v1/financial_connections/accounts/{account}/owners",methodType:"list"}),refresh:Ve({method:"POST",fullPath:"/v1/financial_connections/accounts/{account}/refresh"}),subscribe:Ve({method:"POST",fullPath:"/v1/financial_connections/accounts/{account}/subscribe"}),unsubscribe:Ve({method:"POST",fullPath:"/v1/financial_connections/accounts/{account}/unsubscribe"})}),Bt=p.method,Sd=p.extend({create:Bt({method:"POST",fullPath:"/v2/core/accounts/{account_id}/persons"}),retrieve:Bt({method:"GET",fullPath:"/v2/core/accounts/{account_id}/persons/{id}"}),update:Bt({method:"POST",fullPath:"/v2/core/accounts/{account_id}/persons/{id}"}),list:Bt({method:"GET",fullPath:"/v2/core/accounts/{account_id}/persons",methodType:"list"}),del:Bt({method:"DELETE",fullPath:"/v2/core/accounts/{account_id}/persons/{id}"})}),tn=p.method,wd=p.extend({create:tn({method:"POST",fullPath:"/v2/core/accounts/{account_id}/person_tokens"}),retrieve:tn({method:"GET",fullPath:"/v2/core/accounts/{account_id}/person_tokens/{id}"})}),Kt=p.method,xd=p.extend({constructor:function(...e){p.apply(this,e),this.persons=new Sd(...e),this.personTokens=new wd(...e)},create:Kt({method:"POST",fullPath:"/v2/core/accounts"}),retrieve:Kt({method:"GET",fullPath:"/v2/core/accounts/{id}"}),update:Kt({method:"POST",fullPath:"/v2/core/accounts/{id}"}),list:Kt({method:"GET",fullPath:"/v2/core/accounts",methodType:"list"}),close:Kt({method:"POST",fullPath:"/v2/core/accounts/{id}/close"})}),sn=p.method,Rd=p.extend({retrieve:sn({method:"GET",fullPath:"/v1/entitlements/active_entitlements/{id}"}),list:sn({method:"GET",fullPath:"/v1/entitlements/active_entitlements",methodType:"list"})}),_t=p.method,Id=p.extend({create:_t({method:"POST",fullPath:"/v1/billing/alerts"}),retrieve:_t({method:"GET",fullPath:"/v1/billing/alerts/{id}"}),list:_t({method:"GET",fullPath:"/v1/billing/alerts",methodType:"list"}),activate:_t({method:"POST",fullPath:"/v1/billing/alerts/{id}/activate"}),archive:_t({method:"POST",fullPath:"/v1/billing/alerts/{id}/archive"}),deactivate:_t({method:"POST",fullPath:"/v1/billing/alerts/{id}/deactivate"})}),Pd=p.method,Od=p.extend({find:Pd({method:"GET",fullPath:"/v1/tax/associations/find"})}),Gt=p.method,Ad=p.extend({retrieve:Gt({method:"GET",fullPath:"/v1/issuing/authorizations/{authorization}"}),update:Gt({method:"POST",fullPath:"/v1/issuing/authorizations/{authorization}"}),list:Gt({method:"GET",fullPath:"/v1/issuing/authorizations",methodType:"list"}),approve:Gt({method:"POST",fullPath:"/v1/issuing/authorizations/{authorization}/approve"}),decline:Gt({method:"POST",fullPath:"/v1/issuing/authorizations/{authorization}/decline"})}),Je=p.method,Cd=p.extend({create:Je({method:"POST",fullPath:"/v1/test_helpers/issuing/authorizations"}),capture:Je({method:"POST",fullPath:"/v1/test_helpers/issuing/authorizations/{authorization}/capture"}),expire:Je({method:"POST",fullPath:"/v1/test_helpers/issuing/authorizations/{authorization}/expire"}),finalizeAmount:Je({method:"POST",fullPath:"/v1/test_helpers/issuing/authorizations/{authorization}/finalize_amount"}),increment:Je({method:"POST",fullPath:"/v1/test_helpers/issuing/authorizations/{authorization}/increment"}),respond:Je({method:"POST",fullPath:"/v1/test_helpers/issuing/authorizations/{authorization}/fraud_challenges/respond"}),reverse:Je({method:"POST",fullPath:"/v1/test_helpers/issuing/authorizations/{authorization}/reverse"})}),Nr=p.method,Dd=p.extend({create:Nr({method:"POST",fullPath:"/v1/tax/calculations"}),retrieve:Nr({method:"GET",fullPath:"/v1/tax/calculations/{calculation}"}),listLineItems:Nr({method:"GET",fullPath:"/v1/tax/calculations/{calculation}/line_items",methodType:"list"})}),Cs=p.method,kd=p.extend({create:Cs({method:"POST",fullPath:"/v1/issuing/cardholders"}),retrieve:Cs({method:"GET",fullPath:"/v1/issuing/cardholders/{cardholder}"}),update:Cs({method:"POST",fullPath:"/v1/issuing/cardholders/{cardholder}"}),list:Cs({method:"GET",fullPath:"/v1/issuing/cardholders",methodType:"list"})}),Ds=p.method,Nd=p.extend({create:Ds({method:"POST",fullPath:"/v1/issuing/cards"}),retrieve:Ds({method:"GET",fullPath:"/v1/issuing/cards/{card}"}),update:Ds({method:"POST",fullPath:"/v1/issuing/cards/{card}"}),list:Ds({method:"GET",fullPath:"/v1/issuing/cards",methodType:"list"})}),Vt=p.method,jd=p.extend({deliverCard:Vt({method:"POST",fullPath:"/v1/test_helpers/issuing/cards/{card}/shipping/deliver"}),failCard:Vt({method:"POST",fullPath:"/v1/test_helpers/issuing/cards/{card}/shipping/fail"}),returnCard:Vt({method:"POST",fullPath:"/v1/test_helpers/issuing/cards/{card}/shipping/return"}),shipCard:Vt({method:"POST",fullPath:"/v1/test_helpers/issuing/cards/{card}/shipping/ship"}),submitCard:Vt({method:"POST",fullPath:"/v1/test_helpers/issuing/cards/{card}/shipping/submit"})}),ks=p.method,Md=p.extend({create:ks({method:"POST",fullPath:"/v1/billing_portal/configurations"}),retrieve:ks({method:"GET",fullPath:"/v1/billing_portal/configurations/{configuration}"}),update:ks({method:"POST",fullPath:"/v1/billing_portal/configurations/{configuration}"}),list:ks({method:"GET",fullPath:"/v1/billing_portal/configurations",methodType:"list"})}),Jt=p.method,Ld=p.extend({create:Jt({method:"POST",fullPath:"/v1/terminal/configurations"}),retrieve:Jt({method:"GET",fullPath:"/v1/terminal/configurations/{configuration}"}),update:Jt({method:"POST",fullPath:"/v1/terminal/configurations/{configuration}"}),list:Jt({method:"GET",fullPath:"/v1/terminal/configurations",methodType:"list"}),del:Jt({method:"DELETE",fullPath:"/v1/terminal/configurations/{configuration}"})}),$d=p.method,Fd=p.extend({create:$d({method:"POST",fullPath:"/v1/test_helpers/confirmation_tokens"})}),Ud=p.method,qd=p.extend({create:Ud({method:"POST",fullPath:"/v1/terminal/connection_tokens"})}),Hd=p.method,Wd=p.extend({retrieve:Hd({method:"GET",fullPath:"/v1/billing/credit_balance_summary"})}),rn=p.method,Bd=p.extend({retrieve:rn({method:"GET",fullPath:"/v1/billing/credit_balance_transactions/{id}"}),list:rn({method:"GET",fullPath:"/v1/billing/credit_balance_transactions",methodType:"list"})}),Et=p.method,Kd=p.extend({create:Et({method:"POST",fullPath:"/v1/billing/credit_grants"}),retrieve:Et({method:"GET",fullPath:"/v1/billing/credit_grants/{id}"}),update:Et({method:"POST",fullPath:"/v1/billing/credit_grants/{id}"}),list:Et({method:"GET",fullPath:"/v1/billing/credit_grants",methodType:"list"}),expire:Et({method:"POST",fullPath:"/v1/billing/credit_grants/{id}/expire"}),voidGrant:Et({method:"POST",fullPath:"/v1/billing/credit_grants/{id}/void"})}),jr=p.method,Gd=p.extend({create:jr({method:"POST",fullPath:"/v1/treasury/credit_reversals"}),retrieve:jr({method:"GET",fullPath:"/v1/treasury/credit_reversals/{credit_reversal}"}),list:jr({method:"GET",fullPath:"/v1/treasury/credit_reversals",methodType:"list"})}),Vd=p.method,Jd=p.extend({fundCashBalance:Vd({method:"POST",fullPath:"/v1/test_helpers/customers/{customer}/fund_cash_balance"})}),Mr=p.method,Yd=p.extend({create:Mr({method:"POST",fullPath:"/v1/treasury/debit_reversals"}),retrieve:Mr({method:"GET",fullPath:"/v1/treasury/debit_reversals/{debit_reversal}"}),list:Mr({method:"GET",fullPath:"/v1/treasury/debit_reversals",methodType:"list"})}),Yt=p.method,zd=p.extend({create:Yt({method:"POST",fullPath:"/v1/issuing/disputes"}),retrieve:Yt({method:"GET",fullPath:"/v1/issuing/disputes/{dispute}"}),update:Yt({method:"POST",fullPath:"/v1/issuing/disputes/{dispute}"}),list:Yt({method:"GET",fullPath:"/v1/issuing/disputes",methodType:"list"}),submit:Yt({method:"POST",fullPath:"/v1/issuing/disputes/{dispute}/submit"})}),an=p.method,Xd=p.extend({retrieve:an({method:"GET",fullPath:"/v1/radar/early_fraud_warnings/{early_fraud_warning}"}),list:an({method:"GET",fullPath:"/v1/radar/early_fraud_warnings",methodType:"list"})}),je=p.method,Qd=p.extend({create:je({method:"POST",fullPath:"/v2/core/event_destinations"}),retrieve:je({method:"GET",fullPath:"/v2/core/event_destinations/{id}"}),update:je({method:"POST",fullPath:"/v2/core/event_destinations/{id}"}),list:je({method:"GET",fullPath:"/v2/core/event_destinations",methodType:"list"}),del:je({method:"DELETE",fullPath:"/v2/core/event_destinations/{id}"}),disable:je({method:"POST",fullPath:"/v2/core/event_destinations/{id}/disable"}),enable:je({method:"POST",fullPath:"/v2/core/event_destinations/{id}/enable"}),ping:je({method:"POST",fullPath:"/v2/core/event_destinations/{id}/ping"})}),Lr=p.method,Zd=p.extend({retrieve(...e){return Lr({method:"GET",fullPath:"/v2/core/events/{id}",transformResponseData:s=>this.addFetchRelatedObjectIfNeeded(s)}).apply(this,e)},list(...e){return Lr({method:"GET",fullPath:"/v2/core/events",methodType:"list",transformResponseData:s=>Object.assign(Object.assign({},s),{data:s.data.map(this.addFetchRelatedObjectIfNeeded.bind(this))})}).apply(this,e)},addFetchRelatedObjectIfNeeded(e){return!e.related_object||!e.related_object.url?e:Object.assign(Object.assign({},e),{fetchRelatedObject:()=>Lr({method:"GET",fullPath:e.related_object.url}).apply(this,[{stripeContext:e.context}])})}}),Ns=p.method,ep=p.extend({create:Ns({method:"POST",fullPath:"/v1/entitlements/features"}),retrieve:Ns({method:"GET",fullPath:"/v1/entitlements/features/{id}"}),update:Ns({method:"POST",fullPath:"/v1/entitlements/features/{id}"}),list:Ns({method:"GET",fullPath:"/v1/entitlements/features",methodType:"list"})}),Ye=p.method,tp=p.extend({create:Ye({method:"POST",fullPath:"/v1/treasury/financial_accounts"}),retrieve:Ye({method:"GET",fullPath:"/v1/treasury/financial_accounts/{financial_account}"}),update:Ye({method:"POST",fullPath:"/v1/treasury/financial_accounts/{financial_account}"}),list:Ye({method:"GET",fullPath:"/v1/treasury/financial_accounts",methodType:"list"}),close:Ye({method:"POST",fullPath:"/v1/treasury/financial_accounts/{financial_account}/close"}),retrieveFeatures:Ye({method:"GET",fullPath:"/v1/treasury/financial_accounts/{financial_account}/features"}),updateFeatures:Ye({method:"POST",fullPath:"/v1/treasury/financial_accounts/{financial_account}/features"})}),$r=p.method,sp=p.extend({fail:$r({method:"POST",fullPath:"/v1/test_helpers/treasury/inbound_transfers/{id}/fail"}),returnInboundTransfer:$r({method:"POST",fullPath:"/v1/test_helpers/treasury/inbound_transfers/{id}/return"}),succeed:$r({method:"POST",fullPath:"/v1/test_helpers/treasury/inbound_transfers/{id}/succeed"})}),js=p.method,rp=p.extend({create:js({method:"POST",fullPath:"/v1/treasury/inbound_transfers"}),retrieve:js({method:"GET",fullPath:"/v1/treasury/inbound_transfers/{id}"}),list:js({method:"GET",fullPath:"/v1/treasury/inbound_transfers",methodType:"list"}),cancel:js({method:"POST",fullPath:"/v1/treasury/inbound_transfers/{inbound_transfer}/cancel"})}),zt=p.method,ap=p.extend({create:zt({method:"POST",fullPath:"/v1/terminal/locations"}),retrieve:zt({method:"GET",fullPath:"/v1/terminal/locations/{location}"}),update:zt({method:"POST",fullPath:"/v1/terminal/locations/{location}"}),list:zt({method:"GET",fullPath:"/v1/terminal/locations",methodType:"list"}),del:zt({method:"DELETE",fullPath:"/v1/terminal/locations/{location}"})}),np=p.method,op=p.extend({create:np({method:"POST",fullPath:"/v1/billing/meter_event_adjustments"})}),ip=p.method,cp=p.extend({create:ip({method:"POST",fullPath:"/v2/billing/meter_event_adjustments"})}),lp=p.method,up=p.extend({create:lp({method:"POST",fullPath:"/v2/billing/meter_event_session"})}),dp=p.method,pp=p.extend({create:dp({method:"POST",fullPath:"/v2/billing/meter_event_stream",host:"meter-events.stripe.com"})}),mp=p.method,fp=p.extend({create:mp({method:"POST",fullPath:"/v1/billing/meter_events"})}),hp=p.method,_p=p.extend({create:hp({method:"POST",fullPath:"/v2/billing/meter_events"})}),ze=p.method,Ep=p.extend({create:ze({method:"POST",fullPath:"/v1/billing/meters"}),retrieve:ze({method:"GET",fullPath:"/v1/billing/meters/{id}"}),update:ze({method:"POST",fullPath:"/v1/billing/meters/{id}"}),list:ze({method:"GET",fullPath:"/v1/billing/meters",methodType:"list"}),deactivate:ze({method:"POST",fullPath:"/v1/billing/meters/{id}/deactivate"}),listEventSummaries:ze({method:"GET",fullPath:"/v1/billing/meters/{id}/event_summaries",methodType:"list"}),reactivate:ze({method:"POST",fullPath:"/v1/billing/meters/{id}/reactivate"})}),gp=p.method,yp=p.extend({create:gp({method:"POST",fullPath:"/v1/terminal/onboarding_links"})}),Xt=p.method,bp=p.extend({create:Xt({method:"POST",fullPath:"/v1/climate/orders"}),retrieve:Xt({method:"GET",fullPath:"/v1/climate/orders/{order}"}),update:Xt({method:"POST",fullPath:"/v1/climate/orders/{order}"}),list:Xt({method:"GET",fullPath:"/v1/climate/orders",methodType:"list"}),cancel:Xt({method:"POST",fullPath:"/v1/climate/orders/{order}/cancel"})}),Ms=p.method,Tp=p.extend({update:Ms({method:"POST",fullPath:"/v1/test_helpers/treasury/outbound_payments/{id}"}),fail:Ms({method:"POST",fullPath:"/v1/test_helpers/treasury/outbound_payments/{id}/fail"}),post:Ms({method:"POST",fullPath:"/v1/test_helpers/treasury/outbound_payments/{id}/post"}),returnOutboundPayment:Ms({method:"POST",fullPath:"/v1/test_helpers/treasury/outbound_payments/{id}/return"})}),Ls=p.method,vp=p.extend({create:Ls({method:"POST",fullPath:"/v1/treasury/outbound_payments"}),retrieve:Ls({method:"GET",fullPath:"/v1/treasury/outbound_payments/{id}"}),list:Ls({method:"GET",fullPath:"/v1/treasury/outbound_payments",methodType:"list"}),cancel:Ls({method:"POST",fullPath:"/v1/treasury/outbound_payments/{id}/cancel"})}),$s=p.method,Sp=p.extend({update:$s({method:"POST",fullPath:"/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}"}),fail:$s({method:"POST",fullPath:"/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/fail"}),post:$s({method:"POST",fullPath:"/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/post"}),returnOutboundTransfer:$s({method:"POST",fullPath:"/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/return"})}),Fs=p.method,wp=p.extend({create:Fs({method:"POST",fullPath:"/v1/treasury/outbound_transfers"}),retrieve:Fs({method:"GET",fullPath:"/v1/treasury/outbound_transfers/{outbound_transfer}"}),list:Fs({method:"GET",fullPath:"/v1/treasury/outbound_transfers",methodType:"list"}),cancel:Fs({method:"POST",fullPath:"/v1/treasury/outbound_transfers/{outbound_transfer}/cancel"})}),xp=p.method,Rp=p.extend({create:xp({method:"POST",fullPath:"/v1/radar/payment_evaluations"})}),Us=p.method,Ip=p.extend({create:Us({method:"POST",fullPath:"/v1/issuing/personalization_designs"}),retrieve:Us({method:"GET",fullPath:"/v1/issuing/personalization_designs/{personalization_design}"}),update:Us({method:"POST",fullPath:"/v1/issuing/personalization_designs/{personalization_design}"}),list:Us({method:"GET",fullPath:"/v1/issuing/personalization_designs",methodType:"list"})}),Fr=p.method,Pp=p.extend({activate:Fr({method:"POST",fullPath:"/v1/test_helpers/issuing/personalization_designs/{personalization_design}/activate"}),deactivate:Fr({method:"POST",fullPath:"/v1/test_helpers/issuing/personalization_designs/{personalization_design}/deactivate"}),reject:Fr({method:"POST",fullPath:"/v1/test_helpers/issuing/personalization_designs/{personalization_design}/reject"})}),nn=p.method,Op=p.extend({retrieve:nn({method:"GET",fullPath:"/v1/issuing/physical_bundles/{physical_bundle}"}),list:nn({method:"GET",fullPath:"/v1/issuing/physical_bundles",methodType:"list"})}),on=p.method,Ap=p.extend({retrieve:on({method:"GET",fullPath:"/v1/climate/products/{product}"}),list:on({method:"GET",fullPath:"/v1/climate/products",methodType:"list"})}),ce=p.method,Cp=p.extend({create:ce({method:"POST",fullPath:"/v1/terminal/readers"}),retrieve:ce({method:"GET",fullPath:"/v1/terminal/readers/{reader}"}),update:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}"}),list:ce({method:"GET",fullPath:"/v1/terminal/readers",methodType:"list"}),del:ce({method:"DELETE",fullPath:"/v1/terminal/readers/{reader}"}),cancelAction:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}/cancel_action"}),collectInputs:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}/collect_inputs"}),collectPaymentMethod:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}/collect_payment_method"}),confirmPaymentIntent:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}/confirm_payment_intent"}),processPaymentIntent:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}/process_payment_intent"}),processSetupIntent:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}/process_setup_intent"}),refundPayment:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}/refund_payment"}),setReaderDisplay:ce({method:"POST",fullPath:"/v1/terminal/readers/{reader}/set_reader_display"})}),Ur=p.method,Dp=p.extend({presentPaymentMethod:Ur({method:"POST",fullPath:"/v1/test_helpers/terminal/readers/{reader}/present_payment_method"}),succeedInputCollection:Ur({method:"POST",fullPath:"/v1/test_helpers/terminal/readers/{reader}/succeed_input_collection"}),timeoutInputCollection:Ur({method:"POST",fullPath:"/v1/test_helpers/terminal/readers/{reader}/timeout_input_collection"})}),kp=p.method,Np=p.extend({create:kp({method:"POST",fullPath:"/v1/test_helpers/treasury/received_credits"})}),cn=p.method,jp=p.extend({retrieve:cn({method:"GET",fullPath:"/v1/treasury/received_credits/{id}"}),list:cn({method:"GET",fullPath:"/v1/treasury/received_credits",methodType:"list"})}),Mp=p.method,Lp=p.extend({create:Mp({method:"POST",fullPath:"/v1/test_helpers/treasury/received_debits"})}),ln=p.method,$p=p.extend({retrieve:ln({method:"GET",fullPath:"/v1/treasury/received_debits/{id}"}),list:ln({method:"GET",fullPath:"/v1/treasury/received_debits",methodType:"list"})}),Fp=p.method,Up=p.extend({expire:Fp({method:"POST",fullPath:"/v1/test_helpers/refunds/{refund}/expire"})}),qs=p.method,qp=p.extend({create:qs({method:"POST",fullPath:"/v1/tax/registrations"}),retrieve:qs({method:"GET",fullPath:"/v1/tax/registrations/{id}"}),update:qs({method:"POST",fullPath:"/v1/tax/registrations/{id}"}),list:qs({method:"GET",fullPath:"/v1/tax/registrations",methodType:"list"})}),qr=p.method,Hp=p.extend({create:qr({method:"POST",fullPath:"/v1/reporting/report_runs"}),retrieve:qr({method:"GET",fullPath:"/v1/reporting/report_runs/{report_run}"}),list:qr({method:"GET",fullPath:"/v1/reporting/report_runs",methodType:"list"})}),un=p.method,Wp=p.extend({retrieve:un({method:"GET",fullPath:"/v1/reporting/report_types/{report_type}"}),list:un({method:"GET",fullPath:"/v1/reporting/report_types",methodType:"list"})}),Hr=p.method,Bp=p.extend({create:Hr({method:"POST",fullPath:"/v1/forwarding/requests"}),retrieve:Hr({method:"GET",fullPath:"/v1/forwarding/requests/{id}"}),list:Hr({method:"GET",fullPath:"/v1/forwarding/requests",methodType:"list"})}),dn=p.method,Kp=p.extend({retrieve:dn({method:"GET",fullPath:"/v1/sigma/scheduled_query_runs/{scheduled_query_run}"}),list:dn({method:"GET",fullPath:"/v1/sigma/scheduled_query_runs",methodType:"list"})}),Hs=p.method,Gp=p.extend({create:Hs({method:"POST",fullPath:"/v1/apps/secrets"}),list:Hs({method:"GET",fullPath:"/v1/apps/secrets",methodType:"list"}),deleteWhere:Hs({method:"POST",fullPath:"/v1/apps/secrets/delete"}),find:Hs({method:"GET",fullPath:"/v1/apps/secrets/find"})}),Vp=p.method,Jp=p.extend({create:Vp({method:"POST",fullPath:"/v1/billing_portal/sessions"})}),gt=p.method,Yp=p.extend({create:gt({method:"POST",fullPath:"/v1/checkout/sessions"}),retrieve:gt({method:"GET",fullPath:"/v1/checkout/sessions/{session}"}),update:gt({method:"POST",fullPath:"/v1/checkout/sessions/{session}"}),list:gt({method:"GET",fullPath:"/v1/checkout/sessions",methodType:"list"}),expire:gt({method:"POST",fullPath:"/v1/checkout/sessions/{session}/expire"}),listLineItems:gt({method:"GET",fullPath:"/v1/checkout/sessions/{session}/line_items",methodType:"list"})}),pn=p.method,zp=p.extend({create:pn({method:"POST",fullPath:"/v1/financial_connections/sessions"}),retrieve:pn({method:"GET",fullPath:"/v1/financial_connections/sessions/{session}"})}),mn=p.method,Xp=p.extend({retrieve:mn({method:"GET",fullPath:"/v1/tax/settings"}),update:mn({method:"POST",fullPath:"/v1/tax/settings"})}),fn=p.method,Qp=p.extend({retrieve:fn({method:"GET",fullPath:"/v1/climate/suppliers/{supplier}"}),list:fn({method:"GET",fullPath:"/v1/climate/suppliers",methodType:"list"})}),Qt=p.method,Zp=p.extend({create:Qt({method:"POST",fullPath:"/v1/test_helpers/test_clocks"}),retrieve:Qt({method:"GET",fullPath:"/v1/test_helpers/test_clocks/{test_clock}"}),list:Qt({method:"GET",fullPath:"/v1/test_helpers/test_clocks",methodType:"list"}),del:Qt({method:"DELETE",fullPath:"/v1/test_helpers/test_clocks/{test_clock}"}),advance:Qt({method:"POST",fullPath:"/v1/test_helpers/test_clocks/{test_clock}/advance"})}),Wr=p.method,em=p.extend({retrieve:Wr({method:"GET",fullPath:"/v1/issuing/tokens/{token}"}),update:Wr({method:"POST",fullPath:"/v1/issuing/tokens/{token}"}),list:Wr({method:"GET",fullPath:"/v1/issuing/tokens",methodType:"list"})}),hn=p.method,tm=p.extend({retrieve:hn({method:"GET",fullPath:"/v1/treasury/transaction_entries/{id}"}),list:hn({method:"GET",fullPath:"/v1/treasury/transaction_entries",methodType:"list"})}),_n=p.method,sm=p.extend({retrieve:_n({method:"GET",fullPath:"/v1/financial_connections/transactions/{transaction}"}),list:_n({method:"GET",fullPath:"/v1/financial_connections/transactions",methodType:"list"})}),Br=p.method,rm=p.extend({retrieve:Br({method:"GET",fullPath:"/v1/issuing/transactions/{transaction}"}),update:Br({method:"POST",fullPath:"/v1/issuing/transactions/{transaction}"}),list:Br({method:"GET",fullPath:"/v1/issuing/transactions",methodType:"list"})}),Ws=p.method,am=p.extend({retrieve:Ws({method:"GET",fullPath:"/v1/tax/transactions/{transaction}"}),createFromCalculation:Ws({method:"POST",fullPath:"/v1/tax/transactions/create_from_calculation"}),createReversal:Ws({method:"POST",fullPath:"/v1/tax/transactions/create_reversal"}),listLineItems:Ws({method:"GET",fullPath:"/v1/tax/transactions/{transaction}/line_items",methodType:"list"})}),Kr=p.method,nm=p.extend({createForceCapture:Kr({method:"POST",fullPath:"/v1/test_helpers/issuing/transactions/create_force_capture"}),createUnlinkedRefund:Kr({method:"POST",fullPath:"/v1/test_helpers/issuing/transactions/create_unlinked_refund"}),refund:Kr({method:"POST",fullPath:"/v1/test_helpers/issuing/transactions/{transaction}/refund"})}),En=p.method,om=p.extend({retrieve:En({method:"GET",fullPath:"/v1/treasury/transactions/{id}"}),list:En({method:"GET",fullPath:"/v1/treasury/transactions",methodType:"list"})}),Bs=p.method,im=p.extend({create:Bs({method:"POST",fullPath:"/v1/radar/value_list_items"}),retrieve:Bs({method:"GET",fullPath:"/v1/radar/value_list_items/{item}"}),list:Bs({method:"GET",fullPath:"/v1/radar/value_list_items",methodType:"list"}),del:Bs({method:"DELETE",fullPath:"/v1/radar/value_list_items/{item}"})}),Zt=p.method,cm=p.extend({create:Zt({method:"POST",fullPath:"/v1/radar/value_lists"}),retrieve:Zt({method:"GET",fullPath:"/v1/radar/value_lists/{value_list}"}),update:Zt({method:"POST",fullPath:"/v1/radar/value_lists/{value_list}"}),list:Zt({method:"GET",fullPath:"/v1/radar/value_lists",methodType:"list"}),del:Zt({method:"DELETE",fullPath:"/v1/radar/value_lists/{value_list}"})}),gn=p.method,lm=p.extend({retrieve:gn({method:"GET",fullPath:"/v1/identity/verification_reports/{report}"}),list:gn({method:"GET",fullPath:"/v1/identity/verification_reports",methodType:"list"})}),yt=p.method,um=p.extend({create:yt({method:"POST",fullPath:"/v1/identity/verification_sessions"}),retrieve:yt({method:"GET",fullPath:"/v1/identity/verification_sessions/{session}"}),update:yt({method:"POST",fullPath:"/v1/identity/verification_sessions/{session}"}),list:yt({method:"GET",fullPath:"/v1/identity/verification_sessions",methodType:"list"}),cancel:yt({method:"POST",fullPath:"/v1/identity/verification_sessions/{session}/cancel"}),redact:yt({method:"POST",fullPath:"/v1/identity/verification_sessions/{session}/redact"})}),K=p.method,yn=p.extend({create:K({method:"POST",fullPath:"/v1/accounts"}),retrieve(e,...t){return typeof e=="string"?K({method:"GET",fullPath:"/v1/accounts/{id}"}).apply(this,[e,...t]):(e==null&&[].shift.apply([e,...t]),K({method:"GET",fullPath:"/v1/account"}).apply(this,[e,...t]))},update:K({method:"POST",fullPath:"/v1/accounts/{account}"}),list:K({method:"GET",fullPath:"/v1/accounts",methodType:"list"}),del:K({method:"DELETE",fullPath:"/v1/accounts/{account}"}),createExternalAccount:K({method:"POST",fullPath:"/v1/accounts/{account}/external_accounts"}),createLoginLink:K({method:"POST",fullPath:"/v1/accounts/{account}/login_links"}),createPerson:K({method:"POST",fullPath:"/v1/accounts/{account}/persons"}),deleteExternalAccount:K({method:"DELETE",fullPath:"/v1/accounts/{account}/external_accounts/{id}"}),deletePerson:K({method:"DELETE",fullPath:"/v1/accounts/{account}/persons/{person}"}),listCapabilities:K({method:"GET",fullPath:"/v1/accounts/{account}/capabilities",methodType:"list"}),listExternalAccounts:K({method:"GET",fullPath:"/v1/accounts/{account}/external_accounts",methodType:"list"}),listPersons:K({method:"GET",fullPath:"/v1/accounts/{account}/persons",methodType:"list"}),reject:K({method:"POST",fullPath:"/v1/accounts/{account}/reject"}),retrieveCurrent:K({method:"GET",fullPath:"/v1/account"}),retrieveCapability:K({method:"GET",fullPath:"/v1/accounts/{account}/capabilities/{capability}"}),retrieveExternalAccount:K({method:"GET",fullPath:"/v1/accounts/{account}/external_accounts/{id}"}),retrievePerson:K({method:"GET",fullPath:"/v1/accounts/{account}/persons/{person}"}),updateCapability:K({method:"POST",fullPath:"/v1/accounts/{account}/capabilities/{capability}"}),updateExternalAccount:K({method:"POST",fullPath:"/v1/accounts/{account}/external_accounts/{id}"}),updatePerson:K({method:"POST",fullPath:"/v1/accounts/{account}/persons/{person}"})}),dm=p.method,pm=p.extend({create:dm({method:"POST",fullPath:"/v1/account_links"})}),mm=p.method,fm=p.extend({create:mm({method:"POST",fullPath:"/v1/account_sessions"})}),Ks=p.method,hm=p.extend({create:Ks({method:"POST",fullPath:"/v1/apple_pay/domains"}),retrieve:Ks({method:"GET",fullPath:"/v1/apple_pay/domains/{domain}"}),list:Ks({method:"GET",fullPath:"/v1/apple_pay/domains",methodType:"list"}),del:Ks({method:"DELETE",fullPath:"/v1/apple_pay/domains/{domain}"})}),bt=p.method,_m=p.extend({retrieve:bt({method:"GET",fullPath:"/v1/application_fees/{id}"}),list:bt({method:"GET",fullPath:"/v1/application_fees",methodType:"list"}),createRefund:bt({method:"POST",fullPath:"/v1/application_fees/{id}/refunds"}),listRefunds:bt({method:"GET",fullPath:"/v1/application_fees/{id}/refunds",methodType:"list"}),retrieveRefund:bt({method:"GET",fullPath:"/v1/application_fees/{fee}/refunds/{id}"}),updateRefund:bt({method:"POST",fullPath:"/v1/application_fees/{fee}/refunds/{id}"})}),Em=p.method,gm=p.extend({retrieve:Em({method:"GET",fullPath:"/v1/balance"})}),bn=p.method,ym=p.extend({retrieve:bn({method:"GET",fullPath:"/v1/balance_settings"}),update:bn({method:"POST",fullPath:"/v1/balance_settings"})}),Tn=p.method,bm=p.extend({retrieve:Tn({method:"GET",fullPath:"/v1/balance_transactions/{id}"}),list:Tn({method:"GET",fullPath:"/v1/balance_transactions",methodType:"list"})}),Tt=p.method,Tm=p.extend({create:Tt({method:"POST",fullPath:"/v1/charges"}),retrieve:Tt({method:"GET",fullPath:"/v1/charges/{charge}"}),update:Tt({method:"POST",fullPath:"/v1/charges/{charge}"}),list:Tt({method:"GET",fullPath:"/v1/charges",methodType:"list"}),capture:Tt({method:"POST",fullPath:"/v1/charges/{charge}/capture"}),search:Tt({method:"GET",fullPath:"/v1/charges/search",methodType:"search"})}),vm=p.method,Sm=p.extend({retrieve:vm({method:"GET",fullPath:"/v1/confirmation_tokens/{confirmation_token}"})}),vn=p.method,wm=p.extend({retrieve:vn({method:"GET",fullPath:"/v1/country_specs/{country}"}),list:vn({method:"GET",fullPath:"/v1/country_specs",methodType:"list"})}),es=p.method,xm=p.extend({create:es({method:"POST",fullPath:"/v1/coupons"}),retrieve:es({method:"GET",fullPath:"/v1/coupons/{coupon}"}),update:es({method:"POST",fullPath:"/v1/coupons/{coupon}"}),list:es({method:"GET",fullPath:"/v1/coupons",methodType:"list"}),del:es({method:"DELETE",fullPath:"/v1/coupons/{coupon}"})}),Me=p.method,Rm=p.extend({create:Me({method:"POST",fullPath:"/v1/credit_notes"}),retrieve:Me({method:"GET",fullPath:"/v1/credit_notes/{id}"}),update:Me({method:"POST",fullPath:"/v1/credit_notes/{id}"}),list:Me({method:"GET",fullPath:"/v1/credit_notes",methodType:"list"}),listLineItems:Me({method:"GET",fullPath:"/v1/credit_notes/{credit_note}/lines",methodType:"list"}),listPreviewLineItems:Me({method:"GET",fullPath:"/v1/credit_notes/preview/lines",methodType:"list"}),preview:Me({method:"GET",fullPath:"/v1/credit_notes/preview"}),voidCreditNote:Me({method:"POST",fullPath:"/v1/credit_notes/{id}/void"})}),Im=p.method,Pm=p.extend({create:Im({method:"POST",fullPath:"/v1/customer_sessions"})}),F=p.method,Om=p.extend({create:F({method:"POST",fullPath:"/v1/customers"}),retrieve:F({method:"GET",fullPath:"/v1/customers/{customer}"}),update:F({method:"POST",fullPath:"/v1/customers/{customer}"}),list:F({method:"GET",fullPath:"/v1/customers",methodType:"list"}),del:F({method:"DELETE",fullPath:"/v1/customers/{customer}"}),createBalanceTransaction:F({method:"POST",fullPath:"/v1/customers/{customer}/balance_transactions"}),createFundingInstructions:F({method:"POST",fullPath:"/v1/customers/{customer}/funding_instructions"}),createSource:F({method:"POST",fullPath:"/v1/customers/{customer}/sources"}),createTaxId:F({method:"POST",fullPath:"/v1/customers/{customer}/tax_ids"}),deleteDiscount:F({method:"DELETE",fullPath:"/v1/customers/{customer}/discount"}),deleteSource:F({method:"DELETE",fullPath:"/v1/customers/{customer}/sources/{id}"}),deleteTaxId:F({method:"DELETE",fullPath:"/v1/customers/{customer}/tax_ids/{id}"}),listBalanceTransactions:F({method:"GET",fullPath:"/v1/customers/{customer}/balance_transactions",methodType:"list"}),listCashBalanceTransactions:F({method:"GET",fullPath:"/v1/customers/{customer}/cash_balance_transactions",methodType:"list"}),listPaymentMethods:F({method:"GET",fullPath:"/v1/customers/{customer}/payment_methods",methodType:"list"}),listSources:F({method:"GET",fullPath:"/v1/customers/{customer}/sources",methodType:"list"}),listTaxIds:F({method:"GET",fullPath:"/v1/customers/{customer}/tax_ids",methodType:"list"}),retrieveBalanceTransaction:F({method:"GET",fullPath:"/v1/customers/{customer}/balance_transactions/{transaction}"}),retrieveCashBalance:F({method:"GET",fullPath:"/v1/customers/{customer}/cash_balance"}),retrieveCashBalanceTransaction:F({method:"GET",fullPath:"/v1/customers/{customer}/cash_balance_transactions/{transaction}"}),retrievePaymentMethod:F({method:"GET",fullPath:"/v1/customers/{customer}/payment_methods/{payment_method}"}),retrieveSource:F({method:"GET",fullPath:"/v1/customers/{customer}/sources/{id}"}),retrieveTaxId:F({method:"GET",fullPath:"/v1/customers/{customer}/tax_ids/{id}"}),search:F({method:"GET",fullPath:"/v1/customers/search",methodType:"search"}),updateBalanceTransaction:F({method:"POST",fullPath:"/v1/customers/{customer}/balance_transactions/{transaction}"}),updateCashBalance:F({method:"POST",fullPath:"/v1/customers/{customer}/cash_balance"}),updateSource:F({method:"POST",fullPath:"/v1/customers/{customer}/sources/{id}"}),verifySource:F({method:"POST",fullPath:"/v1/customers/{customer}/sources/{id}/verify"})}),Gs=p.method,Am=p.extend({retrieve:Gs({method:"GET",fullPath:"/v1/disputes/{dispute}"}),update:Gs({method:"POST",fullPath:"/v1/disputes/{dispute}"}),list:Gs({method:"GET",fullPath:"/v1/disputes",methodType:"list"}),close:Gs({method:"POST",fullPath:"/v1/disputes/{dispute}/close"})}),Sn=p.method,Cm=p.extend({create:Sn({method:"POST",fullPath:"/v1/ephemeral_keys",validator:(e,t)=>{if(!t.headers||!t.headers["Stripe-Version"])throw new Error("Passing apiVersion in a separate options hash is required to create an ephemeral key. See https://stripe.com/docs/api/versioning?lang=node")}}),del:Sn({method:"DELETE",fullPath:"/v1/ephemeral_keys/{key}"})}),wn=p.method,Dm=p.extend({retrieve:wn({method:"GET",fullPath:"/v1/events/{id}"}),list:wn({method:"GET",fullPath:"/v1/events",methodType:"list"})}),xn=p.method,km=p.extend({retrieve:xn({method:"GET",fullPath:"/v1/exchange_rates/{rate_id}"}),list:xn({method:"GET",fullPath:"/v1/exchange_rates",methodType:"list"})}),Vs=p.method,Nm=p.extend({create:Vs({method:"POST",fullPath:"/v1/file_links"}),retrieve:Vs({method:"GET",fullPath:"/v1/file_links/{link}"}),update:Vs({method:"POST",fullPath:"/v1/file_links/{link}"}),list:Vs({method:"GET",fullPath:"/v1/file_links",methodType:"list"})}),jm=(e,t,s)=>{const r=(Math.round(Math.random()*1e16)+Math.round(Math.random()*1e16)).toString();s["Content-Type"]=`multipart/form-data; boundary=${r}`;const a=new TextEncoder;let n=new Uint8Array(0);const o=a.encode(`\r
`);function i(u){const d=n,m=u instanceof Uint8Array?u:new Uint8Array(a.encode(u));n=new Uint8Array(d.length+m.length+2),n.set(d),n.set(m,d.length),n.set(o,n.length-2)}function c(u){return`"${u.replace(/"|"/g,"%22").replace(/\r\n|\r|\n/g," ")}"`}const l=Vu(t);for(const u in l){if(!Object.prototype.hasOwnProperty.call(l,u))continue;const d=l[u];if(i(`--${r}`),Object.prototype.hasOwnProperty.call(d,"data")){const m=d;i(`Content-Disposition: form-data; name=${c(u)}; filename=${c(m.name||"blob")}`),i(`Content-Type: ${m.type||"application/octet-stream"}`),i(""),i(m.data)}else i(`Content-Disposition: form-data; name=${c(u)}`),i(""),i(d)}return i(`--${r}--`),n};function Mm(e,t,s,r){if(t=t||{},e!=="POST")return r(null,yr(t));this._stripe._platformFunctions.tryBufferData(t).then(a=>{const n=jm(e,a,s);return r(null,n)}).catch(a=>r(a,null))}const Gr=p.method,Lm=p.extend({create:Gr({method:"POST",fullPath:"/v1/files",headers:{"Content-Type":"multipart/form-data"},host:"files.stripe.com"}),retrieve:Gr({method:"GET",fullPath:"/v1/files/{file}"}),list:Gr({method:"GET",fullPath:"/v1/files",methodType:"list"}),requestDataProcessor:Mm}),ts=p.method,$m=p.extend({create:ts({method:"POST",fullPath:"/v1/invoiceitems"}),retrieve:ts({method:"GET",fullPath:"/v1/invoiceitems/{invoiceitem}"}),update:ts({method:"POST",fullPath:"/v1/invoiceitems/{invoiceitem}"}),list:ts({method:"GET",fullPath:"/v1/invoiceitems",methodType:"list"}),del:ts({method:"DELETE",fullPath:"/v1/invoiceitems/{invoiceitem}"})}),Rn=p.method,Fm=p.extend({retrieve:Rn({method:"GET",fullPath:"/v1/invoice_payments/{invoice_payment}"}),list:Rn({method:"GET",fullPath:"/v1/invoice_payments",methodType:"list"})}),Js=p.method,Um=p.extend({retrieve:Js({method:"GET",fullPath:"/v1/invoice_rendering_templates/{template}"}),list:Js({method:"GET",fullPath:"/v1/invoice_rendering_templates",methodType:"list"}),archive:Js({method:"POST",fullPath:"/v1/invoice_rendering_templates/{template}/archive"}),unarchive:Js({method:"POST",fullPath:"/v1/invoice_rendering_templates/{template}/unarchive"})}),X=p.method,qm=p.extend({create:X({method:"POST",fullPath:"/v1/invoices"}),retrieve:X({method:"GET",fullPath:"/v1/invoices/{invoice}"}),update:X({method:"POST",fullPath:"/v1/invoices/{invoice}"}),list:X({method:"GET",fullPath:"/v1/invoices",methodType:"list"}),del:X({method:"DELETE",fullPath:"/v1/invoices/{invoice}"}),addLines:X({method:"POST",fullPath:"/v1/invoices/{invoice}/add_lines"}),attachPayment:X({method:"POST",fullPath:"/v1/invoices/{invoice}/attach_payment"}),createPreview:X({method:"POST",fullPath:"/v1/invoices/create_preview"}),finalizeInvoice:X({method:"POST",fullPath:"/v1/invoices/{invoice}/finalize"}),listLineItems:X({method:"GET",fullPath:"/v1/invoices/{invoice}/lines",methodType:"list"}),markUncollectible:X({method:"POST",fullPath:"/v1/invoices/{invoice}/mark_uncollectible"}),pay:X({method:"POST",fullPath:"/v1/invoices/{invoice}/pay"}),removeLines:X({method:"POST",fullPath:"/v1/invoices/{invoice}/remove_lines"}),search:X({method:"GET",fullPath:"/v1/invoices/search",methodType:"search"}),sendInvoice:X({method:"POST",fullPath:"/v1/invoices/{invoice}/send"}),updateLines:X({method:"POST",fullPath:"/v1/invoices/{invoice}/update_lines"}),updateLineItem:X({method:"POST",fullPath:"/v1/invoices/{invoice}/lines/{line_item_id}"}),voidInvoice:X({method:"POST",fullPath:"/v1/invoices/{invoice}/void"})}),Hm=p.method,Wm=p.extend({retrieve:Hm({method:"GET",fullPath:"/v1/mandates/{mandate}"})}),In=p.method,Vr="connect.stripe.com",Bm=p.extend({basePath:"/",authorizeUrl(e,t){e=e||{},t=t||{};let s="oauth/authorize";return t.express&&(s=`express/${s}`),e.response_type||(e.response_type="code"),e.client_id||(e.client_id=this._stripe.getClientId()),e.scope||(e.scope="read_write"),`https://${Vr}/${s}?${yr(e)}`},token:In({method:"POST",path:"oauth/token",host:Vr}),deauthorize(e,...t){return e.client_id||(e.client_id=this._stripe.getClientId()),In({method:"POST",path:"oauth/deauthorize",host:Vr}).apply(this,[e,...t])}}),Pn=p.method,Km=p.extend({retrieve:Pn({method:"GET",fullPath:"/v1/payment_attempt_records/{id}"}),list:Pn({method:"GET",fullPath:"/v1/payment_attempt_records",methodType:"list"})}),de=p.method,Gm=p.extend({create:de({method:"POST",fullPath:"/v1/payment_intents"}),retrieve:de({method:"GET",fullPath:"/v1/payment_intents/{intent}"}),update:de({method:"POST",fullPath:"/v1/payment_intents/{intent}"}),list:de({method:"GET",fullPath:"/v1/payment_intents",methodType:"list"}),applyCustomerBalance:de({method:"POST",fullPath:"/v1/payment_intents/{intent}/apply_customer_balance"}),cancel:de({method:"POST",fullPath:"/v1/payment_intents/{intent}/cancel"}),capture:de({method:"POST",fullPath:"/v1/payment_intents/{intent}/capture"}),confirm:de({method:"POST",fullPath:"/v1/payment_intents/{intent}/confirm"}),incrementAuthorization:de({method:"POST",fullPath:"/v1/payment_intents/{intent}/increment_authorization"}),listAmountDetailsLineItems:de({method:"GET",fullPath:"/v1/payment_intents/{intent}/amount_details_line_items",methodType:"list"}),search:de({method:"GET",fullPath:"/v1/payment_intents/search",methodType:"search"}),verifyMicrodeposits:de({method:"POST",fullPath:"/v1/payment_intents/{intent}/verify_microdeposits"})}),ss=p.method,Vm=p.extend({create:ss({method:"POST",fullPath:"/v1/payment_links"}),retrieve:ss({method:"GET",fullPath:"/v1/payment_links/{payment_link}"}),update:ss({method:"POST",fullPath:"/v1/payment_links/{payment_link}"}),list:ss({method:"GET",fullPath:"/v1/payment_links",methodType:"list"}),listLineItems:ss({method:"GET",fullPath:"/v1/payment_links/{payment_link}/line_items",methodType:"list"})}),Ys=p.method,Jm=p.extend({create:Ys({method:"POST",fullPath:"/v1/payment_method_configurations"}),retrieve:Ys({method:"GET",fullPath:"/v1/payment_method_configurations/{configuration}"}),update:Ys({method:"POST",fullPath:"/v1/payment_method_configurations/{configuration}"}),list:Ys({method:"GET",fullPath:"/v1/payment_method_configurations",methodType:"list"})}),rs=p.method,Ym=p.extend({create:rs({method:"POST",fullPath:"/v1/payment_method_domains"}),retrieve:rs({method:"GET",fullPath:"/v1/payment_method_domains/{payment_method_domain}"}),update:rs({method:"POST",fullPath:"/v1/payment_method_domains/{payment_method_domain}"}),list:rs({method:"GET",fullPath:"/v1/payment_method_domains",methodType:"list"}),validate:rs({method:"POST",fullPath:"/v1/payment_method_domains/{payment_method_domain}/validate"})}),vt=p.method,zm=p.extend({create:vt({method:"POST",fullPath:"/v1/payment_methods"}),retrieve:vt({method:"GET",fullPath:"/v1/payment_methods/{payment_method}"}),update:vt({method:"POST",fullPath:"/v1/payment_methods/{payment_method}"}),list:vt({method:"GET",fullPath:"/v1/payment_methods",methodType:"list"}),attach:vt({method:"POST",fullPath:"/v1/payment_methods/{payment_method}/attach"}),detach:vt({method:"POST",fullPath:"/v1/payment_methods/{payment_method}/detach"})}),Le=p.method,Xm=p.extend({retrieve:Le({method:"GET",fullPath:"/v1/payment_records/{id}"}),reportPayment:Le({method:"POST",fullPath:"/v1/payment_records/report_payment"}),reportPaymentAttempt:Le({method:"POST",fullPath:"/v1/payment_records/{id}/report_payment_attempt"}),reportPaymentAttemptCanceled:Le({method:"POST",fullPath:"/v1/payment_records/{id}/report_payment_attempt_canceled"}),reportPaymentAttemptFailed:Le({method:"POST",fullPath:"/v1/payment_records/{id}/report_payment_attempt_failed"}),reportPaymentAttemptGuaranteed:Le({method:"POST",fullPath:"/v1/payment_records/{id}/report_payment_attempt_guaranteed"}),reportPaymentAttemptInformational:Le({method:"POST",fullPath:"/v1/payment_records/{id}/report_payment_attempt_informational"}),reportRefund:Le({method:"POST",fullPath:"/v1/payment_records/{id}/report_refund"})}),St=p.method,Qm=p.extend({create:St({method:"POST",fullPath:"/v1/payouts"}),retrieve:St({method:"GET",fullPath:"/v1/payouts/{payout}"}),update:St({method:"POST",fullPath:"/v1/payouts/{payout}"}),list:St({method:"GET",fullPath:"/v1/payouts",methodType:"list"}),cancel:St({method:"POST",fullPath:"/v1/payouts/{payout}/cancel"}),reverse:St({method:"POST",fullPath:"/v1/payouts/{payout}/reverse"})}),as=p.method,Zm=p.extend({create:as({method:"POST",fullPath:"/v1/plans"}),retrieve:as({method:"GET",fullPath:"/v1/plans/{plan}"}),update:as({method:"POST",fullPath:"/v1/plans/{plan}"}),list:as({method:"GET",fullPath:"/v1/plans",methodType:"list"}),del:as({method:"DELETE",fullPath:"/v1/plans/{plan}"})}),ns=p.method,ef=p.extend({create:ns({method:"POST",fullPath:"/v1/prices"}),retrieve:ns({method:"GET",fullPath:"/v1/prices/{price}"}),update:ns({method:"POST",fullPath:"/v1/prices/{price}"}),list:ns({method:"GET",fullPath:"/v1/prices",methodType:"list"}),search:ns({method:"GET",fullPath:"/v1/prices/search",methodType:"search"})}),Se=p.method,tf=p.extend({create:Se({method:"POST",fullPath:"/v1/products"}),retrieve:Se({method:"GET",fullPath:"/v1/products/{id}"}),update:Se({method:"POST",fullPath:"/v1/products/{id}"}),list:Se({method:"GET",fullPath:"/v1/products",methodType:"list"}),del:Se({method:"DELETE",fullPath:"/v1/products/{id}"}),createFeature:Se({method:"POST",fullPath:"/v1/products/{product}/features"}),deleteFeature:Se({method:"DELETE",fullPath:"/v1/products/{product}/features/{id}"}),listFeatures:Se({method:"GET",fullPath:"/v1/products/{product}/features",methodType:"list"}),retrieveFeature:Se({method:"GET",fullPath:"/v1/products/{product}/features/{id}"}),search:Se({method:"GET",fullPath:"/v1/products/search",methodType:"search"})}),zs=p.method,sf=p.extend({create:zs({method:"POST",fullPath:"/v1/promotion_codes"}),retrieve:zs({method:"GET",fullPath:"/v1/promotion_codes/{promotion_code}"}),update:zs({method:"POST",fullPath:"/v1/promotion_codes/{promotion_code}"}),list:zs({method:"GET",fullPath:"/v1/promotion_codes",methodType:"list"})}),we=p.method,rf=p.extend({create:we({method:"POST",fullPath:"/v1/quotes"}),retrieve:we({method:"GET",fullPath:"/v1/quotes/{quote}"}),update:we({method:"POST",fullPath:"/v1/quotes/{quote}"}),list:we({method:"GET",fullPath:"/v1/quotes",methodType:"list"}),accept:we({method:"POST",fullPath:"/v1/quotes/{quote}/accept"}),cancel:we({method:"POST",fullPath:"/v1/quotes/{quote}/cancel"}),finalizeQuote:we({method:"POST",fullPath:"/v1/quotes/{quote}/finalize"}),listComputedUpfrontLineItems:we({method:"GET",fullPath:"/v1/quotes/{quote}/computed_upfront_line_items",methodType:"list"}),listLineItems:we({method:"GET",fullPath:"/v1/quotes/{quote}/line_items",methodType:"list"}),pdf:we({method:"GET",fullPath:"/v1/quotes/{quote}/pdf",host:"files.stripe.com",streaming:!0})}),os=p.method,af=p.extend({create:os({method:"POST",fullPath:"/v1/refunds"}),retrieve:os({method:"GET",fullPath:"/v1/refunds/{refund}"}),update:os({method:"POST",fullPath:"/v1/refunds/{refund}"}),list:os({method:"GET",fullPath:"/v1/refunds",methodType:"list"}),cancel:os({method:"POST",fullPath:"/v1/refunds/{refund}/cancel"})}),Jr=p.method,nf=p.extend({retrieve:Jr({method:"GET",fullPath:"/v1/reviews/{review}"}),list:Jr({method:"GET",fullPath:"/v1/reviews",methodType:"list"}),approve:Jr({method:"POST",fullPath:"/v1/reviews/{review}/approve"})}),of=p.method,cf=p.extend({list:of({method:"GET",fullPath:"/v1/setup_attempts",methodType:"list"})}),Xe=p.method,lf=p.extend({create:Xe({method:"POST",fullPath:"/v1/setup_intents"}),retrieve:Xe({method:"GET",fullPath:"/v1/setup_intents/{intent}"}),update:Xe({method:"POST",fullPath:"/v1/setup_intents/{intent}"}),list:Xe({method:"GET",fullPath:"/v1/setup_intents",methodType:"list"}),cancel:Xe({method:"POST",fullPath:"/v1/setup_intents/{intent}/cancel"}),confirm:Xe({method:"POST",fullPath:"/v1/setup_intents/{intent}/confirm"}),verifyMicrodeposits:Xe({method:"POST",fullPath:"/v1/setup_intents/{intent}/verify_microdeposits"})}),Xs=p.method,uf=p.extend({create:Xs({method:"POST",fullPath:"/v1/shipping_rates"}),retrieve:Xs({method:"GET",fullPath:"/v1/shipping_rates/{shipping_rate_token}"}),update:Xs({method:"POST",fullPath:"/v1/shipping_rates/{shipping_rate_token}"}),list:Xs({method:"GET",fullPath:"/v1/shipping_rates",methodType:"list"})}),is=p.method,df=p.extend({create:is({method:"POST",fullPath:"/v1/sources"}),retrieve:is({method:"GET",fullPath:"/v1/sources/{source}"}),update:is({method:"POST",fullPath:"/v1/sources/{source}"}),listSourceTransactions:is({method:"GET",fullPath:"/v1/sources/{source}/source_transactions",methodType:"list"}),verify:is({method:"POST",fullPath:"/v1/sources/{source}/verify"})}),cs=p.method,pf=p.extend({create:cs({method:"POST",fullPath:"/v1/subscription_items"}),retrieve:cs({method:"GET",fullPath:"/v1/subscription_items/{item}"}),update:cs({method:"POST",fullPath:"/v1/subscription_items/{item}"}),list:cs({method:"GET",fullPath:"/v1/subscription_items",methodType:"list"}),del:cs({method:"DELETE",fullPath:"/v1/subscription_items/{item}"})}),wt=p.method,mf=p.extend({create:wt({method:"POST",fullPath:"/v1/subscription_schedules"}),retrieve:wt({method:"GET",fullPath:"/v1/subscription_schedules/{schedule}"}),update:wt({method:"POST",fullPath:"/v1/subscription_schedules/{schedule}"}),list:wt({method:"GET",fullPath:"/v1/subscription_schedules",methodType:"list"}),cancel:wt({method:"POST",fullPath:"/v1/subscription_schedules/{schedule}/cancel"}),release:wt({method:"POST",fullPath:"/v1/subscription_schedules/{schedule}/release"})}),Ie=p.method,ff=p.extend({create:Ie({method:"POST",fullPath:"/v1/subscriptions"}),retrieve:Ie({method:"GET",fullPath:"/v1/subscriptions/{subscription_exposed_id}"}),update:Ie({method:"POST",fullPath:"/v1/subscriptions/{subscription_exposed_id}"}),list:Ie({method:"GET",fullPath:"/v1/subscriptions",methodType:"list"}),cancel:Ie({method:"DELETE",fullPath:"/v1/subscriptions/{subscription_exposed_id}"}),deleteDiscount:Ie({method:"DELETE",fullPath:"/v1/subscriptions/{subscription_exposed_id}/discount"}),migrate:Ie({method:"POST",fullPath:"/v1/subscriptions/{subscription}/migrate"}),resume:Ie({method:"POST",fullPath:"/v1/subscriptions/{subscription}/resume"}),search:Ie({method:"GET",fullPath:"/v1/subscriptions/search",methodType:"search"})}),On=p.method,hf=p.extend({retrieve:On({method:"GET",fullPath:"/v1/tax_codes/{id}"}),list:On({method:"GET",fullPath:"/v1/tax_codes",methodType:"list"})}),Qs=p.method,_f=p.extend({create:Qs({method:"POST",fullPath:"/v1/tax_ids"}),retrieve:Qs({method:"GET",fullPath:"/v1/tax_ids/{id}"}),list:Qs({method:"GET",fullPath:"/v1/tax_ids",methodType:"list"}),del:Qs({method:"DELETE",fullPath:"/v1/tax_ids/{id}"})}),Zs=p.method,Ef=p.extend({create:Zs({method:"POST",fullPath:"/v1/tax_rates"}),retrieve:Zs({method:"GET",fullPath:"/v1/tax_rates/{tax_rate}"}),update:Zs({method:"POST",fullPath:"/v1/tax_rates/{tax_rate}"}),list:Zs({method:"GET",fullPath:"/v1/tax_rates",methodType:"list"})}),An=p.method,gf=p.extend({create:An({method:"POST",fullPath:"/v1/tokens"}),retrieve:An({method:"GET",fullPath:"/v1/tokens/{token}"})}),ls=p.method,yf=p.extend({create:ls({method:"POST",fullPath:"/v1/topups"}),retrieve:ls({method:"GET",fullPath:"/v1/topups/{topup}"}),update:ls({method:"POST",fullPath:"/v1/topups/{topup}"}),list:ls({method:"GET",fullPath:"/v1/topups",methodType:"list"}),cancel:ls({method:"POST",fullPath:"/v1/topups/{topup}/cancel"})}),$e=p.method,bf=p.extend({create:$e({method:"POST",fullPath:"/v1/transfers"}),retrieve:$e({method:"GET",fullPath:"/v1/transfers/{transfer}"}),update:$e({method:"POST",fullPath:"/v1/transfers/{transfer}"}),list:$e({method:"GET",fullPath:"/v1/transfers",methodType:"list"}),createReversal:$e({method:"POST",fullPath:"/v1/transfers/{id}/reversals"}),listReversals:$e({method:"GET",fullPath:"/v1/transfers/{id}/reversals",methodType:"list"}),retrieveReversal:$e({method:"GET",fullPath:"/v1/transfers/{transfer}/reversals/{id}"}),updateReversal:$e({method:"POST",fullPath:"/v1/transfers/{transfer}/reversals/{id}"})}),us=p.method,Tf=p.extend({create:us({method:"POST",fullPath:"/v1/webhook_endpoints"}),retrieve:us({method:"GET",fullPath:"/v1/webhook_endpoints/{webhook_endpoint}"}),update:us({method:"POST",fullPath:"/v1/webhook_endpoints/{webhook_endpoint}"}),list:us({method:"GET",fullPath:"/v1/webhook_endpoints",methodType:"list"}),del:us({method:"DELETE",fullPath:"/v1/webhook_endpoints/{webhook_endpoint}"})}),vf=W("apps",{Secrets:Gp}),Sf=W("billing",{Alerts:Id,CreditBalanceSummary:Wd,CreditBalanceTransactions:Bd,CreditGrants:Kd,MeterEventAdjustments:op,MeterEvents:fp,Meters:Ep}),wf=W("billingPortal",{Configurations:Md,Sessions:Jp}),xf=W("checkout",{Sessions:Yp}),Rf=W("climate",{Orders:bp,Products:Ap,Suppliers:Qp}),If=W("entitlements",{ActiveEntitlements:Rd,Features:ep}),Pf=W("financialConnections",{Accounts:vd,Sessions:zp,Transactions:sm}),Of=W("forwarding",{Requests:Bp}),Af=W("identity",{VerificationReports:lm,VerificationSessions:um}),Cf=W("issuing",{Authorizations:Ad,Cardholders:kd,Cards:Nd,Disputes:zd,PersonalizationDesigns:Ip,PhysicalBundles:Op,Tokens:em,Transactions:rm}),Df=W("radar",{EarlyFraudWarnings:Xd,PaymentEvaluations:Rp,ValueListItems:im,ValueLists:cm}),kf=W("reporting",{ReportRuns:Hp,ReportTypes:Wp}),Nf=W("sigma",{ScheduledQueryRuns:Kp}),jf=W("tax",{Associations:Od,Calculations:Dd,Registrations:qp,Settings:Xp,Transactions:am}),Mf=W("terminal",{Configurations:Ld,ConnectionTokens:qd,Locations:ap,OnboardingLinks:yp,Readers:Cp}),Lf=W("testHelpers",{ConfirmationTokens:Fd,Customers:Jd,Refunds:Up,TestClocks:Zp,Issuing:W("issuing",{Authorizations:Cd,Cards:jd,PersonalizationDesigns:Pp,Transactions:nm}),Terminal:W("terminal",{Readers:Dp}),Treasury:W("treasury",{InboundTransfers:sp,OutboundPayments:Tp,OutboundTransfers:Sp,ReceivedCredits:Np,ReceivedDebits:Lp})}),$f=W("treasury",{CreditReversals:Gd,DebitReversals:Yd,FinancialAccounts:tp,InboundTransfers:rp,OutboundPayments:vp,OutboundTransfers:wp,ReceivedCredits:jp,ReceivedDebits:$p,TransactionEntries:tm,Transactions:om}),Ff=W("v2",{Billing:W("billing",{MeterEventAdjustments:cp,MeterEventSession:up,MeterEventStream:pp,MeterEvents:_p}),Core:W("core",{AccountLinks:bd,AccountTokens:Td,Accounts:xd,EventDestinations:Qd,Events:Zd})}),er=Object.freeze(Object.defineProperty({__proto__:null,Account:yn,AccountLinks:pm,AccountSessions:fm,Accounts:yn,ApplePayDomains:hm,ApplicationFees:_m,Apps:vf,Balance:gm,BalanceSettings:ym,BalanceTransactions:bm,Billing:Sf,BillingPortal:wf,Charges:Tm,Checkout:xf,Climate:Rf,ConfirmationTokens:Sm,CountrySpecs:wm,Coupons:xm,CreditNotes:Rm,CustomerSessions:Pm,Customers:Om,Disputes:Am,Entitlements:If,EphemeralKeys:Cm,Events:Dm,ExchangeRates:km,FileLinks:Nm,Files:Lm,FinancialConnections:Pf,Forwarding:Of,Identity:Af,InvoiceItems:$m,InvoicePayments:Fm,InvoiceRenderingTemplates:Um,Invoices:qm,Issuing:Cf,Mandates:Wm,OAuth:Bm,PaymentAttemptRecords:Km,PaymentIntents:Gm,PaymentLinks:Vm,PaymentMethodConfigurations:Jm,PaymentMethodDomains:Ym,PaymentMethods:zm,PaymentRecords:Xm,Payouts:Qm,Plans:Zm,Prices:ef,Products:tf,PromotionCodes:sf,Quotes:rf,Radar:Df,Refunds:af,Reporting:kf,Reviews:nf,SetupAttempts:cf,SetupIntents:lf,ShippingRates:uf,Sigma:Nf,Sources:df,SubscriptionItems:pf,SubscriptionSchedules:mf,Subscriptions:ff,Tax:jf,TaxCodes:hf,TaxIds:_f,TaxRates:Ef,Terminal:Mf,TestHelpers:Lf,Tokens:gf,Topups:yf,Transfers:bf,Treasury:$f,V2:Ff,WebhookEndpoints:Tf},Symbol.toStringTag,{value:"Module"})),Cn="api.stripe.com",Dn="443",kn="/v1/",Nn=pi,jn=8e4,Mn=5,Ln=.5,Uf=["name","version","url","partner_id"],$n=["authenticator","apiVersion","typescript","maxNetworkRetries","httpAgent","httpClient","timeout","host","port","protocol","telemetry","appInfo","stripeAccount","stripeContext"],qf=e=>new fs(e,p.MAX_BUFFERED_REQUEST_METRICS);function Hf(e,t=qf){s.PACKAGE_VERSION="20.4.0",s.API_VERSION=pi,s.USER_AGENT=Object.assign({bindings_version:s.PACKAGE_VERSION,lang:"node",publisher:"stripe",uname:null,typescript:!1},Ju()),s.StripeResource=p,s.StripeContext=et,s.resources=er,s.HttpClient=fe,s.HttpClientResponse=Zo,s.CryptoProvider=ei,s.webhooks=Ed(e);function s(r,a={}){if(!(this instanceof s))return new s(r,a);const n=this._getPropsFromConfig(a);this._platformFunctions=e,Object.defineProperty(this,"_emitter",{value:this._platformFunctions.createEmitter(),enumerable:!1,configurable:!1,writable:!1}),this.VERSION=s.PACKAGE_VERSION,this.on=this._emitter.on.bind(this._emitter),this.once=this._emitter.once.bind(this._emitter),this.off=this._emitter.removeListener.bind(this._emitter);const o=n.httpAgent||null;this._api={host:n.host||Cn,port:n.port||Dn,protocol:n.protocol||"https",basePath:kn,version:n.apiVersion||Nn,timeout:Dr("timeout",n.timeout,jn),maxNetworkRetries:Dr("maxNetworkRetries",n.maxNetworkRetries,2),agent:o,httpClient:n.httpClient||(o?this._platformFunctions.createNodeHttpClient(o):this._platformFunctions.createDefaultHttpClient()),dev:!1,stripeAccount:n.stripeAccount||null,stripeContext:n.stripeContext||null};const i=n.typescript||!1;i!==s.USER_AGENT.typescript&&(s.USER_AGENT.typescript=i),n.appInfo&&this._setAppInfo(n.appInfo),this._prepResources(),this._setAuthenticator(r,n.authenticator),this.errors=Za,this.webhooks=s.webhooks,this._prevRequestMetrics=[],this._enableTelemetry=n.telemetry!==!1,this._requestSender=t(this),this.StripeResource=s.StripeResource}return s.errors=Za,s.createNodeHttpClient=e.createNodeHttpClient,s.createFetchHttpClient=e.createFetchHttpClient,s.createNodeCryptoProvider=e.createNodeCryptoProvider,s.createSubtleCryptoProvider=e.createSubtleCryptoProvider,s.prototype={_appInfo:void 0,on:null,off:null,once:null,VERSION:null,StripeResource:null,webhooks:null,errors:null,_api:null,_prevRequestMetrics:null,_emitter:null,_enableTelemetry:null,_requestSender:null,_platformFunctions:null,rawRequest(r,a,n,o){return this._requestSender._rawRequest(r,a,n,o)},_setAuthenticator(r,a){if(r&&a)throw new Error("Can't specify both apiKey and authenticator");if(!r&&!a)throw new Error("Neither apiKey nor config.authenticator provided");this._authenticator=r?sa(r):a},_setAppInfo(r){if(r&&typeof r!="object")throw new Error("AppInfo must be an object.");if(r&&!r.name)throw new Error("AppInfo.name is required");r=r||{},this._appInfo=Uf.reduce((a,n)=>(typeof r[n]=="string"&&(a=a||{},a[n]=r[n]),a),{})},_setApiField(r,a){this._api[r]=a},getApiField(r){return this._api[r]},setClientId(r){this._clientId=r},getClientId(){return this._clientId},getConstant:r=>{switch(r){case"DEFAULT_HOST":return Cn;case"DEFAULT_PORT":return Dn;case"DEFAULT_BASE_PATH":return kn;case"DEFAULT_API_VERSION":return Nn;case"DEFAULT_TIMEOUT":return jn;case"MAX_NETWORK_RETRY_DELAY_SEC":return Mn;case"INITIAL_NETWORK_RETRY_DELAY_SEC":return Ln}return s[r]},getMaxNetworkRetries(){return this.getApiField("maxNetworkRetries")},_setApiNumberField(r,a,n){const o=Dr(r,a,n);this._setApiField(r,o)},getMaxNetworkRetryDelay(){return Mn},getInitialNetworkRetryDelay(){return Ln},getClientUserAgent(r){return this.getClientUserAgentSeeded(s.USER_AGENT,r)},getClientUserAgentSeeded(r,a){this._platformFunctions.getUname().then(n=>{var o;const i={};for(const l in r)Object.prototype.hasOwnProperty.call(r,l)&&(i[l]=encodeURIComponent((o=r[l])!==null&&o!==void 0?o:"null"));i.uname=encodeURIComponent(n||"UNKNOWN");const c=this.getApiField("httpClient");c&&(i.httplib=encodeURIComponent(c.getClientName())),this._appInfo&&(i.application=this._appInfo),a(JSON.stringify(i))})},getAppInfoAsString(){if(!this._appInfo)return"";let r=this._appInfo.name;return this._appInfo.version&&(r+=`/${this._appInfo.version}`),this._appInfo.url&&(r+=` (${this._appInfo.url})`),r},getTelemetryEnabled(){return this._enableTelemetry},_prepResources(){for(const r in er)Object.prototype.hasOwnProperty.call(er,r)&&(this[Ku(r)]=new er[r](this))},_getPropsFromConfig(r){if(!r)return{};const a=typeof r=="string";if(!(r===Object(r)&&!Array.isArray(r))&&!a)throw new Error("Config must either be an object or a string");if(a)return{apiVersion:r};if(Object.keys(r).filter(i=>!$n.includes(i)).length>0)throw new Error(`Config object may only contain the following: ${$n.join(", ")}`);return r},parseEventNotification(r,a,n,o,i,c){const l=this.webhooks.constructEvent(r,a,n,o,i,c);return l.context&&(l.context=et.parse(l.context)),l.fetchEvent=()=>this._requestSender._rawRequest("GET",`/v2/core/events/${l.id}`,void 0,{stripeContext:l.context},["fetch_event"]),l.fetchRelatedObject=()=>l.related_object?this._requestSender._rawRequest("GET",l.related_object.url,void 0,{stripeContext:l.context},["fetch_related_object"]):Promise.resolve(null),l}},s}const Fn=Hf(new rd),Wf=Object.freeze(Object.defineProperty({__proto__:null,Stripe:Fn,default:Fn},Symbol.toStringTag,{value:"Module"}));async function Bf(e,t,s){const r=e.from||s||"리스터코퍼레이션 <onboarding@resend.dev>",{to:a,subject:n,html:o}=e;if(!t)return console.warn("[Email] RESEND_API_KEY not configured, skipping email"),{success:!1,error:"API key not configured"};try{console.log("[Email] Sending email:",{to:a,subject:n,from:r});const i=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({from:r,to:a,subject:n,html:o})}),c=await i.json();return i.ok?(console.log("[Email] Sent successfully:",{to:a,subject:n,id:c.id}),{success:!0}):(console.error("[Email] Failed to send:",c),{success:!1,error:c.message||"Failed to send email"})}catch(i){return console.error("[Email] Error:",i),{success:!1,error:i.message}}}function Kf(e,t){return`
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
                  아이디: <strong>${t}</strong>
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
  `}function Gf(e,t){return`
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
                  ${t}
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
  `}const mi=Object.freeze(Object.defineProperty({__proto__:null,getSellerApprovalEmailHTML:Kf,getSellerRejectionEmailHTML:Gf,sendEmail:Bf},Symbol.toStringTag,{value:"Module"}));async function Vf(e,t){const{userId:s,type:r,title:a,message:n,linkUrl:o}=t;try{const i=await e.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(s,r,a,n,o||null).run();return console.log(`[Notification] Created for user ${s}: ${r} - ${a}`),{success:!0,id:i.meta.last_row_id}}catch(i){return console.error("[Notification] Failed to create:",i),{success:!1,error:i.message}}}const Jf={seller_approved:e=>({title:"🎉 판매자 승인 완료",message:`${e}님, 축하합니다! 리스터코퍼레이션 판매자로 승인되었습니다.`,linkUrl:"/seller"}),seller_rejected:e=>({title:"판매자 승인 거부",message:`죄송합니다. 판매자 승인이 거부되었습니다. 사유: ${e}`,linkUrl:"/seller/register"}),order_complete:e=>({title:"주문 완료",message:`주문번호 ${e}의 주문이 접수되었습니다.`,linkUrl:`/orders/${e}`}),order_shipped:e=>({title:"배송 시작",message:`주문번호 ${e}의 상품이 배송 시작되었습니다.`,linkUrl:`/orders/${e}`}),order_delivered:e=>({title:"배송 완료",message:`주문번호 ${e}의 상품이 배송 완료되었습니다.`,linkUrl:`/orders/${e}`}),refund_requested:e=>({title:"환불 요청 접수",message:`주문번호 ${e}의 환불이 접수되었습니다.`,linkUrl:`/orders/${e}`}),refund_complete:(e,t)=>({title:"환불 완료",message:`주문번호 ${e}의 환불(₩${t.toLocaleString()})이 완료되었습니다.`,linkUrl:`/orders/${e}`}),product_low_stock:(e,t)=>({title:"⚠️ 재고 부족 알림",message:`${e}의 재고가 ${t}개 남았습니다.`,linkUrl:"/seller/products"}),product_sold_out:e=>({title:"❌ 품절 알림",message:`${e}이(가) 품절되었습니다.`,linkUrl:"/seller/products"})},fi=Object.freeze(Object.defineProperty({__proto__:null,NotificationTemplates:Jf,createNotification:Vf},Symbol.toStringTag,{value:"Module"}));export{Xa as default};
