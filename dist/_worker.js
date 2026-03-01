var Mt=Object.defineProperty;var Ms=e=>{throw TypeError(e)};var $t=(e,s,t)=>s in e?Mt(e,s,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[s]=t;var D=(e,s,t)=>$t(e,typeof s!="symbol"?s+"":s,t),gs=(e,s,t)=>s.has(e)||Ms("Cannot "+t);var E=(e,s,t)=>(gs(e,s,"read from private field"),t?t.call(e):s.get(e)),k=(e,s,t)=>s.has(e)?Ms("Cannot add the same private member more than once"):s instanceof WeakSet?s.add(e):s.set(e,t),I=(e,s,t,r)=>(gs(e,s,"write to private field"),r?r.call(e,t):s.set(e,t),t),C=(e,s,t)=>(gs(e,s,"access private method"),t);var $s=(e,s,t,r)=>({set _(a){I(e,s,a,t)},get _(){return E(e,s,r)}});var Fs=(e,s,t)=>(r,a)=>{let o=-1;return n(0);async function n(i){if(i<=o)throw new Error("next() called multiple times");o=i;let c,l=!1,u;if(e[i]?(u=e[i][0][0],r.req.routeIndex=i):u=i===e.length&&a||void 0,u)try{c=await u(r,()=>n(i+1))}catch(d){if(d instanceof Error&&s)r.error=d,c=await s(d,r),l=!0;else throw d}else r.finalized===!1&&t&&(c=await t(r));return c&&(r.finalized===!1||l)&&(r.res=c),r}},Ft=Symbol(),Ut=async(e,s=Object.create(null))=>{const{all:t=!1,dot:r=!1}=s,o=(e instanceof ct?e.raw.headers:e.headers).get("Content-Type");return o!=null&&o.startsWith("multipart/form-data")||o!=null&&o.startsWith("application/x-www-form-urlencoded")?qt(e,{all:t,dot:r}):{}};async function qt(e,s){const t=await e.formData();return t?Pt(t,s):{}}function Pt(e,s){const t=Object.create(null);return e.forEach((r,a)=>{s.all||a.endsWith("[]")?xt(t,a,r):t[a]=r}),s.dot&&Object.entries(t).forEach(([r,a])=>{r.includes(".")&&(Ht(t,r,a),delete t[r])}),t}var xt=(e,s,t)=>{e[s]!==void 0?Array.isArray(e[s])?e[s].push(t):e[s]=[e[s],t]:s.endsWith("[]")?e[s]=[t]:e[s]=t},Ht=(e,s,t)=>{let r=e;const a=s.split(".");a.forEach((o,n)=>{n===a.length-1?r[o]=t:((!r[o]||typeof r[o]!="object"||Array.isArray(r[o])||r[o]instanceof File)&&(r[o]=Object.create(null)),r=r[o])})},rt=e=>{const s=e.split("/");return s[0]===""&&s.shift(),s},Wt=e=>{const{groups:s,path:t}=Bt(e),r=rt(t);return Kt(r,s)},Bt=e=>{const s=[];return e=e.replace(/\{[^}]+\}/g,(t,r)=>{const a=`@${r}`;return s.push([a,t]),a}),{groups:s,path:e}},Kt=(e,s)=>{for(let t=s.length-1;t>=0;t--){const[r]=s[t];for(let a=e.length-1;a>=0;a--)if(e[a].includes(r)){e[a]=e[a].replace(r,s[t][1]);break}}return e},ls={},Vt=(e,s)=>{if(e==="*")return"*";const t=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(t){const r=`${e}#${s}`;return ls[r]||(t[2]?ls[r]=s&&s[0]!==":"&&s[0]!=="*"?[r,t[1],new RegExp(`^${t[2]}(?=/${s})`)]:[e,t[1],new RegExp(`^${t[2]}$`)]:ls[r]=[e,t[1],!0]),ls[r]}return null},vs=(e,s)=>{try{return s(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,t=>{try{return s(t)}catch{return t}})}},Yt=e=>vs(e,decodeURI),at=e=>{const s=e.url,t=s.indexOf("/",s.indexOf(":")+4);let r=t;for(;r<s.length;r++){const a=s.charCodeAt(r);if(a===37){const o=s.indexOf("?",r),n=s.indexOf("#",r),i=o===-1?n===-1?void 0:n:n===-1?o:Math.min(o,n),c=s.slice(t,i);return Yt(c.includes("%25")?c.replace(/%25/g,"%2525"):c)}else if(a===63||a===35)break}return s.slice(t,r)},Jt=e=>{const s=at(e);return s.length>1&&s.at(-1)==="/"?s.slice(0,-1):s},Le=(e,s,...t)=>(t.length&&(s=Le(s,...t)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${s==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(s==null?void 0:s[0])==="/"?s.slice(1):s}`}`),ot=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const s=e.split("/"),t=[];let r="";return s.forEach(a=>{if(a!==""&&!/\:/.test(a))r+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){t.length===0&&r===""?t.push("/"):t.push(r);const o=a.replace("?","");r+="/"+o,t.push(r)}else r+="/"+a}),t.filter((a,o,n)=>n.indexOf(a)===o)},ys=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?vs(e,it):e):e,nt=(e,s,t)=>{let r;if(!t&&s&&!/[%+]/.test(s)){let n=e.indexOf("?",8);if(n===-1)return;for(e.startsWith(s,n+1)||(n=e.indexOf(`&${s}`,n+1));n!==-1;){const i=e.charCodeAt(n+s.length+1);if(i===61){const c=n+s.length+2,l=e.indexOf("&",c);return ys(e.slice(c,l===-1?void 0:l))}else if(i==38||isNaN(i))return"";n=e.indexOf(`&${s}`,n+1)}if(r=/[%+]/.test(e),!r)return}const a={};r??(r=/[%+]/.test(e));let o=e.indexOf("?",8);for(;o!==-1;){const n=e.indexOf("&",o+1);let i=e.indexOf("=",o);i>n&&n!==-1&&(i=-1);let c=e.slice(o+1,i===-1?n===-1?void 0:n:i);if(r&&(c=ys(c)),o=n,c==="")continue;let l;i===-1?l="":(l=e.slice(i+1,n===-1?void 0:n),r&&(l=ys(l))),t?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(l)):a[c]??(a[c]=l)}return s?a[s]:a},zt=nt,Gt=(e,s)=>nt(e,s,!0),it=decodeURIComponent,Us=e=>vs(e,it),Fe,se,_e,lt,ut,Rs,fe,Xs,ct=(Xs=class{constructor(e,s="/",t=[[]]){k(this,_e);D(this,"raw");k(this,Fe);k(this,se);D(this,"routeIndex",0);D(this,"path");D(this,"bodyCache",{});k(this,fe,e=>{const{bodyCache:s,raw:t}=this,r=s[e];if(r)return r;const a=Object.keys(s)[0];return a?s[a].then(o=>(a==="json"&&(o=JSON.stringify(o)),new Response(o)[e]())):s[e]=t[e]()});this.raw=e,this.path=s,I(this,se,t),I(this,Fe,{})}param(e){return e?C(this,_e,lt).call(this,e):C(this,_e,ut).call(this)}query(e){return zt(this.url,e)}queries(e){return Gt(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const s={};return this.raw.headers.forEach((t,r)=>{s[r]=t}),s}async parseBody(e){var s;return(s=this.bodyCache).parsedBody??(s.parsedBody=await Ut(this,e))}json(){return E(this,fe).call(this,"text").then(e=>JSON.parse(e))}text(){return E(this,fe).call(this,"text")}arrayBuffer(){return E(this,fe).call(this,"arrayBuffer")}blob(){return E(this,fe).call(this,"blob")}formData(){return E(this,fe).call(this,"formData")}addValidatedData(e,s){E(this,Fe)[e]=s}valid(e){return E(this,Fe)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[Ft](){return E(this,se)}get matchedRoutes(){return E(this,se)[0].map(([[,e]])=>e)}get routePath(){return E(this,se)[0].map(([[,e]])=>e)[this.routeIndex].path}},Fe=new WeakMap,se=new WeakMap,_e=new WeakSet,lt=function(e){const s=E(this,se)[0][this.routeIndex][1][e],t=C(this,_e,Rs).call(this,s);return t&&/\%/.test(t)?Us(t):t},ut=function(){const e={},s=Object.keys(E(this,se)[0][this.routeIndex][1]);for(const t of s){const r=C(this,_e,Rs).call(this,E(this,se)[0][this.routeIndex][1][t]);r!==void 0&&(e[t]=/\%/.test(r)?Us(r):r)}return e},Rs=function(e){return E(this,se)[1]?E(this,se)[1][e]:e},fe=new WeakMap,Xs),Xt={Stringify:1},dt=async(e,s,t,r,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const o=e.callbacks;return o!=null&&o.length?(a?a[0]+=e:a=[e],Promise.all(o.map(i=>i({phase:s,buffer:a,context:r}))).then(i=>Promise.all(i.filter(Boolean).map(c=>dt(c,s,!1,r,a))).then(()=>a[0]))):Promise.resolve(e)},Qt="text/plain; charset=UTF-8",ws=(e,s)=>({"Content-Type":e,...s}),Ce=(e,s)=>new Response(e,s),es,ss,ue,Ue,de,Q,ts,qe,Pe,Te,rs,as,ie,Me,Is,Qs,Zt=(Qs=class{constructor(e,s){k(this,ie);k(this,es);k(this,ss);D(this,"env",{});k(this,ue);D(this,"finalized",!1);D(this,"error");k(this,Ue);k(this,de);k(this,Q);k(this,ts);k(this,qe);k(this,Pe);k(this,Te);k(this,rs);k(this,as);D(this,"render",(...e)=>(E(this,qe)??I(this,qe,s=>this.html(s)),E(this,qe).call(this,...e)));D(this,"setLayout",e=>I(this,ts,e));D(this,"getLayout",()=>E(this,ts));D(this,"setRenderer",e=>{I(this,qe,e)});D(this,"header",(e,s,t)=>{this.finalized&&I(this,Q,Ce(E(this,Q).body,E(this,Q)));const r=E(this,Q)?E(this,Q).headers:E(this,Te)??I(this,Te,new Headers);s===void 0?r.delete(e):t!=null&&t.append?r.append(e,s):r.set(e,s)});D(this,"status",e=>{I(this,Ue,e)});D(this,"set",(e,s)=>{E(this,ue)??I(this,ue,new Map),E(this,ue).set(e,s)});D(this,"get",e=>E(this,ue)?E(this,ue).get(e):void 0);D(this,"newResponse",(...e)=>C(this,ie,Me).call(this,...e));D(this,"body",(e,s,t)=>C(this,ie,Me).call(this,e,s,t));D(this,"text",(e,s,t)=>C(this,ie,Is).call(this)&&!s&&!t?Ce(e):C(this,ie,Me).call(this,e,s,ws(Qt,t)));D(this,"json",(e,s,t)=>C(this,ie,Is).call(this)&&!s&&!t?Response.json(e):C(this,ie,Me).call(this,JSON.stringify(e),s,ws("application/json",t)));D(this,"html",(e,s,t)=>{const r=a=>C(this,ie,Me).call(this,a,s,ws("text/html; charset=UTF-8",t));return typeof e=="object"?dt(e,Xt.Stringify,!1,{}).then(r):r(e)});D(this,"redirect",(e,s)=>{const t=String(e);return this.header("Location",/[^\x00-\xFF]/.test(t)?encodeURI(t):t),this.newResponse(null,s??302)});D(this,"notFound",()=>(E(this,Pe)??I(this,Pe,()=>Ce()),E(this,Pe).call(this,this)));I(this,es,e),s&&(I(this,de,s.executionCtx),this.env=s.env,I(this,Pe,s.notFoundHandler),I(this,as,s.path),I(this,rs,s.matchResult))}get req(){return E(this,ss)??I(this,ss,new ct(E(this,es),E(this,as),E(this,rs))),E(this,ss)}get event(){if(E(this,de)&&"respondWith"in E(this,de))return E(this,de);throw Error("This context has no FetchEvent")}get executionCtx(){if(E(this,de))return E(this,de);throw Error("This context has no ExecutionContext")}get res(){return E(this,Q)||I(this,Q,Ce(null,{headers:E(this,Te)??I(this,Te,new Headers)}))}set res(e){if(E(this,Q)&&e){e=Ce(e.body,e);for(const[s,t]of E(this,Q).headers.entries())if(s!=="content-type")if(s==="set-cookie"){const r=E(this,Q).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of r)e.headers.append("set-cookie",a)}else e.headers.set(s,t)}I(this,Q,e),this.finalized=!0}get var(){return E(this,ue)?Object.fromEntries(E(this,ue)):{}}},es=new WeakMap,ss=new WeakMap,ue=new WeakMap,Ue=new WeakMap,de=new WeakMap,Q=new WeakMap,ts=new WeakMap,qe=new WeakMap,Pe=new WeakMap,Te=new WeakMap,rs=new WeakMap,as=new WeakMap,ie=new WeakSet,Me=function(e,s,t){const r=E(this,Q)?new Headers(E(this,Q).headers):E(this,Te)??new Headers;if(typeof s=="object"&&"headers"in s){const o=s.headers instanceof Headers?s.headers:new Headers(s.headers);for(const[n,i]of o)n.toLowerCase()==="set-cookie"?r.append(n,i):r.set(n,i)}if(t)for(const[o,n]of Object.entries(t))if(typeof n=="string")r.set(o,n);else{r.delete(o);for(const i of n)r.append(o,i)}const a=typeof s=="number"?s:(s==null?void 0:s.status)??E(this,Ue);return Ce(e,{status:a,headers:r})},Is=function(){return!E(this,Te)&&!E(this,Ue)&&!this.finalized},Qs),B="ALL",er="all",sr=["get","post","put","delete","options","patch"],pt="Can not add a route since the matcher is already built.",mt=class extends Error{},tr="__COMPOSED_HANDLER",rr=e=>e.text("404 Not Found",404),qs=(e,s)=>{if("getResponse"in e){const t=e.getResponse();return s.newResponse(t.body,t)}return console.error(e),s.text("Internal Server Error",500)},ae,K,_t,oe,be,us,ds,xe,ar=(xe=class{constructor(s={}){k(this,K);D(this,"get");D(this,"post");D(this,"put");D(this,"delete");D(this,"options");D(this,"patch");D(this,"all");D(this,"on");D(this,"use");D(this,"router");D(this,"getPath");D(this,"_basePath","/");k(this,ae,"/");D(this,"routes",[]);k(this,oe,rr);D(this,"errorHandler",qs);D(this,"onError",s=>(this.errorHandler=s,this));D(this,"notFound",s=>(I(this,oe,s),this));D(this,"fetch",(s,...t)=>C(this,K,ds).call(this,s,t[1],t[0],s.method));D(this,"request",(s,t,r,a)=>s instanceof Request?this.fetch(t?new Request(s,t):s,r,a):(s=s.toString(),this.fetch(new Request(/^https?:\/\//.test(s)?s:`http://localhost${Le("/",s)}`,t),r,a)));D(this,"fire",()=>{addEventListener("fetch",s=>{s.respondWith(C(this,K,ds).call(this,s.request,s,void 0,s.request.method))})});[...sr,er].forEach(o=>{this[o]=(n,...i)=>(typeof n=="string"?I(this,ae,n):C(this,K,be).call(this,o,E(this,ae),n),i.forEach(c=>{C(this,K,be).call(this,o,E(this,ae),c)}),this)}),this.on=(o,n,...i)=>{for(const c of[n].flat()){I(this,ae,c);for(const l of[o].flat())i.map(u=>{C(this,K,be).call(this,l.toUpperCase(),E(this,ae),u)})}return this},this.use=(o,...n)=>(typeof o=="string"?I(this,ae,o):(I(this,ae,"*"),n.unshift(o)),n.forEach(i=>{C(this,K,be).call(this,B,E(this,ae),i)}),this);const{strict:r,...a}=s;Object.assign(this,a),this.getPath=r??!0?s.getPath??at:Jt}route(s,t){const r=this.basePath(s);return t.routes.map(a=>{var n;let o;t.errorHandler===qs?o=a.handler:(o=async(i,c)=>(await Fs([],t.errorHandler)(i,()=>a.handler(i,c))).res,o[tr]=a.handler),C(n=r,K,be).call(n,a.method,a.path,o)}),this}basePath(s){const t=C(this,K,_t).call(this);return t._basePath=Le(this._basePath,s),t}mount(s,t,r){let a,o;r&&(typeof r=="function"?o=r:(o=r.optionHandler,r.replaceRequest===!1?a=c=>c:a=r.replaceRequest));const n=o?c=>{const l=o(c);return Array.isArray(l)?l:[l]}:c=>{let l;try{l=c.executionCtx}catch{}return[c.env,l]};a||(a=(()=>{const c=Le(this._basePath,s),l=c==="/"?0:c.length;return u=>{const d=new URL(u.url);return d.pathname=d.pathname.slice(l)||"/",new Request(d,u)}})());const i=async(c,l)=>{const u=await t(a(c.req.raw),...n(c));if(u)return u;await l()};return C(this,K,be).call(this,B,Le(s,"*"),i),this}},ae=new WeakMap,K=new WeakSet,_t=function(){const s=new xe({router:this.router,getPath:this.getPath});return s.errorHandler=this.errorHandler,I(s,oe,E(this,oe)),s.routes=this.routes,s},oe=new WeakMap,be=function(s,t,r){s=s.toUpperCase(),t=Le(this._basePath,t);const a={basePath:this._basePath,path:t,method:s,handler:r};this.router.add(s,t,[r,a]),this.routes.push(a)},us=function(s,t){if(s instanceof Error)return this.errorHandler(s,t);throw s},ds=function(s,t,r,a){if(a==="HEAD")return(async()=>new Response(null,await C(this,K,ds).call(this,s,t,r,"GET")))();const o=this.getPath(s,{env:r}),n=this.router.match(a,o),i=new Zt(s,{path:o,matchResult:n,env:r,executionCtx:t,notFoundHandler:E(this,oe)});if(n[0].length===1){let l;try{l=n[0][0][0][0](i,async()=>{i.res=await E(this,oe).call(this,i)})}catch(u){return C(this,K,us).call(this,u,i)}return l instanceof Promise?l.then(u=>u||(i.finalized?i.res:E(this,oe).call(this,i))).catch(u=>C(this,K,us).call(this,u,i)):l??E(this,oe).call(this,i)}const c=Fs(n[0],this.errorHandler,E(this,oe));return(async()=>{try{const l=await c(i);if(!l.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return l.res}catch(l){return C(this,K,us).call(this,l,i)}})()},xe),ft=[];function or(e,s){const t=this.buildAllMatchers(),r=((a,o)=>{const n=t[a]||t[B],i=n[2][o];if(i)return i;const c=o.match(n[0]);if(!c)return[[],ft];const l=c.indexOf("",1);return[n[1][l],c]});return this.match=r,r(e,s)}var ms="[^/]+",Xe=".*",Qe="(?:|/.*)",$e=Symbol(),nr=new Set(".\\+*[^]$()");function ir(e,s){return e.length===1?s.length===1?e<s?-1:1:-1:s.length===1||e===Xe||e===Qe?1:s===Xe||s===Qe?-1:e===ms?1:s===ms?-1:e.length===s.length?e<s?-1:1:s.length-e.length}var Re,Ie,ne,Oe,cr=(Oe=class{constructor(){k(this,Re);k(this,Ie);k(this,ne,Object.create(null))}insert(s,t,r,a,o){if(s.length===0){if(E(this,Re)!==void 0)throw $e;if(o)return;I(this,Re,t);return}const[n,...i]=s,c=n==="*"?i.length===0?["","",Xe]:["","",ms]:n==="/*"?["","",Qe]:n.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let l;if(c){const u=c[1];let d=c[2]||ms;if(u&&c[2]&&(d===".*"||(d=d.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(d))))throw $e;if(l=E(this,ne)[d],!l){if(Object.keys(E(this,ne)).some(m=>m!==Xe&&m!==Qe))throw $e;if(o)return;l=E(this,ne)[d]=new Oe,u!==""&&I(l,Ie,a.varIndex++)}!o&&u!==""&&r.push([u,E(l,Ie)])}else if(l=E(this,ne)[n],!l){if(Object.keys(E(this,ne)).some(u=>u.length>1&&u!==Xe&&u!==Qe))throw $e;if(o)return;l=E(this,ne)[n]=new Oe}l.insert(i,t,r,a,o)}buildRegExpStr(){const t=Object.keys(E(this,ne)).sort(ir).map(r=>{const a=E(this,ne)[r];return(typeof E(a,Ie)=="number"?`(${r})@${E(a,Ie)}`:nr.has(r)?`\\${r}`:r)+a.buildRegExpStr()});return typeof E(this,Re)=="number"&&t.unshift(`#${E(this,Re)}`),t.length===0?"":t.length===1?t[0]:"(?:"+t.join("|")+")"}},Re=new WeakMap,Ie=new WeakMap,ne=new WeakMap,Oe),fs,os,Zs,lr=(Zs=class{constructor(){k(this,fs,{varIndex:0});k(this,os,new cr)}insert(e,s,t){const r=[],a=[];for(let n=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const l=`@\\${n}`;return a[n]=[l,c],n++,i=!0,l}),!i)break}const o=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let n=a.length-1;n>=0;n--){const[i]=a[n];for(let c=o.length-1;c>=0;c--)if(o[c].indexOf(i)!==-1){o[c]=o[c].replace(i,a[n][1]);break}}return E(this,os).insert(o,s,r,E(this,fs),t),r}buildRegExp(){let e=E(this,os).buildRegExpStr();if(e==="")return[/^$/,[],[]];let s=0;const t=[],r=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,o,n)=>o!==void 0?(t[++s]=Number(o),"$()"):(n!==void 0&&(r[Number(n)]=++s),"")),[new RegExp(`^${e}`),t,r]}},fs=new WeakMap,os=new WeakMap,Zs),ur=[/^$/,[],Object.create(null)],ps=Object.create(null);function Et(e){return ps[e]??(ps[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(s,t)=>t?`\\${t}`:"(?:|/.*)")}$`))}function dr(){ps=Object.create(null)}function pr(e){var l;const s=new lr,t=[];if(e.length===0)return ur;const r=e.map(u=>[!/\*|\/:/.test(u[0]),...u]).sort(([u,d],[m,_])=>u?1:m?-1:d.length-_.length),a=Object.create(null);for(let u=0,d=-1,m=r.length;u<m;u++){const[_,f,g]=r[u];_?a[f]=[g.map(([w])=>[w,Object.create(null)]),ft]:d++;let b;try{b=s.insert(f,d,_)}catch(w){throw w===$e?new mt(f):w}_||(t[d]=g.map(([w,h])=>{const T=Object.create(null);for(h-=1;h>=0;h--){const[y,R]=b[h];T[y]=R}return[w,T]}))}const[o,n,i]=s.buildRegExp();for(let u=0,d=t.length;u<d;u++)for(let m=0,_=t[u].length;m<_;m++){const f=(l=t[u][m])==null?void 0:l[1];if(!f)continue;const g=Object.keys(f);for(let b=0,w=g.length;b<w;b++)f[g[b]]=i[f[g[b]]]}const c=[];for(const u in n)c[u]=t[n[u]];return[o,c,a]}function je(e,s){if(e){for(const t of Object.keys(e).sort((r,a)=>a.length-r.length))if(Et(t).test(s))return[...e[t]]}}var Ee,he,Es,ht,et,mr=(et=class{constructor(){k(this,Es);D(this,"name","RegExpRouter");k(this,Ee);k(this,he);D(this,"match",or);I(this,Ee,{[B]:Object.create(null)}),I(this,he,{[B]:Object.create(null)})}add(e,s,t){var i;const r=E(this,Ee),a=E(this,he);if(!r||!a)throw new Error(pt);r[e]||[r,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[B]).forEach(l=>{c[e][l]=[...c[B][l]]})}),s==="/*"&&(s="*");const o=(s.match(/\/:/g)||[]).length;if(/\*$/.test(s)){const c=Et(s);e===B?Object.keys(r).forEach(l=>{var u;(u=r[l])[s]||(u[s]=je(r[l],s)||je(r[B],s)||[])}):(i=r[e])[s]||(i[s]=je(r[e],s)||je(r[B],s)||[]),Object.keys(r).forEach(l=>{(e===B||e===l)&&Object.keys(r[l]).forEach(u=>{c.test(u)&&r[l][u].push([t,o])})}),Object.keys(a).forEach(l=>{(e===B||e===l)&&Object.keys(a[l]).forEach(u=>c.test(u)&&a[l][u].push([t,o]))});return}const n=ot(s)||[s];for(let c=0,l=n.length;c<l;c++){const u=n[c];Object.keys(a).forEach(d=>{var m;(e===B||e===d)&&((m=a[d])[u]||(m[u]=[...je(r[d],u)||je(r[B],u)||[]]),a[d][u].push([t,o-l+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(E(this,he)).concat(Object.keys(E(this,Ee))).forEach(s=>{e[s]||(e[s]=C(this,Es,ht).call(this,s))}),I(this,Ee,I(this,he,void 0)),dr(),e}},Ee=new WeakMap,he=new WeakMap,Es=new WeakSet,ht=function(e){const s=[];let t=e===B;return[E(this,Ee),E(this,he)].forEach(r=>{const a=r[e]?Object.keys(r[e]).map(o=>[o,r[e][o]]):[];a.length!==0?(t||(t=!0),s.push(...a)):e!==B&&s.push(...Object.keys(r[B]).map(o=>[o,r[B][o]]))}),t?pr(s):null},et),ge,pe,st,_r=(st=class{constructor(e){D(this,"name","SmartRouter");k(this,ge,[]);k(this,pe,[]);I(this,ge,e.routers)}add(e,s,t){if(!E(this,pe))throw new Error(pt);E(this,pe).push([e,s,t])}match(e,s){if(!E(this,pe))throw new Error("Fatal error");const t=E(this,ge),r=E(this,pe),a=t.length;let o=0,n;for(;o<a;o++){const i=t[o];try{for(let c=0,l=r.length;c<l;c++)i.add(...r[c]);n=i.match(e,s)}catch(c){if(c instanceof mt)continue;throw c}this.match=i.match.bind(i),I(this,ge,[i]),I(this,pe,void 0);break}if(o===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,n}get activeRouter(){if(E(this,pe)||E(this,ge).length!==1)throw new Error("No active router has been determined yet.");return E(this,ge)[0]}},ge=new WeakMap,pe=new WeakMap,st),Je=Object.create(null),fr=e=>{for(const s in e)return!0;return!1},ye,X,ve,He,z,me,Se,We,Er=(We=class{constructor(s,t,r){k(this,me);k(this,ye);k(this,X);k(this,ve);k(this,He,0);k(this,z,Je);if(I(this,X,r||Object.create(null)),I(this,ye,[]),s&&t){const a=Object.create(null);a[s]={handler:t,possibleKeys:[],score:0},I(this,ye,[a])}I(this,ve,[])}insert(s,t,r){I(this,He,++$s(this,He)._);let a=this;const o=Wt(t),n=[];for(let i=0,c=o.length;i<c;i++){const l=o[i],u=o[i+1],d=Vt(l,u),m=Array.isArray(d)?d[0]:l;if(m in E(a,X)){a=E(a,X)[m],d&&n.push(d[1]);continue}E(a,X)[m]=new We,d&&(E(a,ve).push(d),n.push(d[1])),a=E(a,X)[m]}return E(a,ye).push({[s]:{handler:r,possibleKeys:n.filter((i,c,l)=>l.indexOf(i)===c),score:E(this,He)}}),a}search(s,t){var u;const r=[];I(this,z,Je);let o=[this];const n=rt(t),i=[],c=n.length;let l=null;for(let d=0;d<c;d++){const m=n[d],_=d===c-1,f=[];for(let b=0,w=o.length;b<w;b++){const h=o[b],T=E(h,X)[m];T&&(I(T,z,E(h,z)),_?(E(T,X)["*"]&&C(this,me,Se).call(this,r,E(T,X)["*"],s,E(h,z)),C(this,me,Se).call(this,r,T,s,E(h,z))):f.push(T));for(let y=0,R=E(h,ve).length;y<R;y++){const $=E(h,ve)[y],A=E(h,z)===Je?{}:{...E(h,z)};if($==="*"){const F=E(h,X)["*"];F&&(C(this,me,Se).call(this,r,F,s,E(h,z)),I(F,z,A),f.push(F));continue}const[O,x,U]=$;if(!m&&!(U instanceof RegExp))continue;const L=E(h,X)[O];if(U instanceof RegExp){if(l===null){l=new Array(c);let Y=t[0]==="/"?1:0;for(let v=0;v<c;v++)l[v]=Y,Y+=n[v].length+1}const F=t.substring(l[d]),G=U.exec(F);if(G){if(A[x]=G[0],C(this,me,Se).call(this,r,L,s,E(h,z),A),fr(E(L,X))){I(L,z,A);const Y=((u=G[0].match(/\//))==null?void 0:u.length)??0;(i[Y]||(i[Y]=[])).push(L)}continue}}(U===!0||U.test(m))&&(A[x]=m,_?(C(this,me,Se).call(this,r,L,s,A,E(h,z)),E(L,X)["*"]&&C(this,me,Se).call(this,r,E(L,X)["*"],s,A,E(h,z))):(I(L,z,A),f.push(L)))}}const g=i.shift();o=g?f.concat(g):f}return r.length>1&&r.sort((d,m)=>d.score-m.score),[r.map(({handler:d,params:m})=>[d,m])]}},ye=new WeakMap,X=new WeakMap,ve=new WeakMap,He=new WeakMap,z=new WeakMap,me=new WeakSet,Se=function(s,t,r,a,o){for(let n=0,i=E(t,ye).length;n<i;n++){const c=E(t,ye)[n],l=c[r]||c[B],u={};if(l!==void 0&&(l.params=Object.create(null),s.push(l),a!==Je||o&&o!==Je))for(let d=0,m=l.possibleKeys.length;d<m;d++){const _=l.possibleKeys[d],f=u[l.score];l.params[_]=o!=null&&o[_]&&!f?o[_]:a[_]??(o==null?void 0:o[_]),u[l.score]=!0}}},We),De,tt,hr=(tt=class{constructor(){D(this,"name","TrieRouter");k(this,De);I(this,De,new Er)}add(e,s,t){const r=ot(s);if(r){for(let a=0,o=r.length;a<o;a++)E(this,De).insert(e,r[a],t);return}E(this,De).insert(e,s,t)}match(e,s){return E(this,De).search(e,s)}},De=new WeakMap,tt),gt=class extends ar{constructor(e={}){super(e),this.router=e.router??new _r({routers:[new mr,new hr]})}},S=e=>{const t={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},r=(o=>typeof o=="string"?o==="*"?()=>o:n=>o===n?n:null:typeof o=="function"?o:n=>o.includes(n)?n:null)(t.origin),a=(o=>typeof o=="function"?o:Array.isArray(o)?()=>o:()=>[])(t.allowMethods);return async function(n,i){var u;function c(d,m){n.res.headers.set(d,m)}const l=await r(n.req.header("origin")||"",n);if(l&&c("Access-Control-Allow-Origin",l),t.credentials&&c("Access-Control-Allow-Credentials","true"),(u=t.exposeHeaders)!=null&&u.length&&c("Access-Control-Expose-Headers",t.exposeHeaders.join(",")),n.req.method==="OPTIONS"){t.origin!=="*"&&c("Vary","Origin"),t.maxAge!=null&&c("Access-Control-Max-Age",t.maxAge.toString());const d=await a(n.req.header("origin")||"",n);d.length&&c("Access-Control-Allow-Methods",d.join(","));let m=t.allowHeaders;if(!(m!=null&&m.length)){const _=n.req.header("Access-Control-Request-Headers");_&&(m=_.split(/\s*,\s*/))}return m!=null&&m.length&&(c("Access-Control-Allow-Headers",m.join(",")),n.res.headers.append("Vary","Access-Control-Request-Headers")),n.res.headers.delete("Content-Length"),n.res.headers.delete("Content-Type"),new Response(null,{headers:n.res.headers,status:204,statusText:"No Content"})}await i(),t.origin!=="*"&&n.header("Vary","Origin",{append:!0})}};function gr(e){var a;const s=((a=e.split(".").pop())==null?void 0:a.toLowerCase())||"jpg",t=Date.now(),r=crypto.randomUUID().substring(0,8);return`upload_${t}_${r}.${s}`}async function yr(e){const s=new Uint8Array(e);return s[0]===255&&s[1]===216&&s[2]===255?{valid:!0,detectedType:"image/jpeg"}:s[0]===137&&s[1]===80&&s[2]===78&&s[3]===71?{valid:!0,detectedType:"image/png"}:s[0]===71&&s[1]===73&&s[2]===70&&s[3]===56?{valid:!0,detectedType:"image/gif"}:s[0]===82&&s[1]===73&&s[2]===70&&s[3]===70&&s[8]===87&&s[9]===69&&s[10]===66&&s[11]===80?{valid:!0,detectedType:"image/webp"}:{valid:!1}}function wr(e){const s=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],t=[];for(const r of s)e[r]||t.push(r);if(t.length>0)throw new Error(`Missing required environment variables: ${t.join(", ")}

Please configure them:
`+t.map(r=>r==="TOSS_SECRET_KEY"||r==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${r} --project-name ur-live`:`  Check wrangler.jsonc for ${r} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function br(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function Sr(e){const s=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),s.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):s.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(t){s.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:t instanceof Error?t.message:String(t)})}try{if(!e.SESSION_KV)s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const t="test:env:check";await e.SESSION_KV.put(t,"ok",{expirationTtl:60}),await e.SESSION_KV.get(t)==="ok"?s.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):s.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(t){s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:t instanceof Error?t.message:String(t)})}try{if(!e.CACHE_KV)s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const t="test:cache:check";await e.CACHE_KV.put(t,"ok",{expirationTtl:60}),await e.CACHE_KV.get(t)==="ok"?s.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):s.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(t){s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:t instanceof Error?t.message:String(t)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?s.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):s.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?s.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):s.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),s}function Tr(e){const s=[];s.push(""),s.push("========================================"),s.push("환경 변수 테스트 결과"),s.push("========================================"),s.push("");let t=0,r=0,a=0;for(const o of e){const n=o.status==="pass"?"✅":o.status==="warn"?"⚠️":"❌";s.push(`${n} ${o.name}: ${o.message}`),o.details&&s.push(`   → ${o.details}`),o.status==="pass"&&t++,o.status==="warn"&&r++,o.status==="fail"&&a++}return s.push(""),s.push("========================================"),s.push(`총 ${e.length}개 테스트:`),s.push(`  ✅ 성공: ${t}`),r>0&&s.push(`  ⚠️  경고: ${r}`),a>0&&s.push(`  ❌ 실패: ${a}`),s.push("========================================"),s.push(""),a>0?(s.push("❌ 환경 변수 설정이 완료되지 않았습니다."),s.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):r>0?s.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):s.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),s.join(`
`)}async function Rr(e){const s=await Sr(e),t=s.filter(o=>o.status==="pass").length,r=s.filter(o=>o.status==="warn").length,a=s.filter(o=>o.status==="fail").length;return{success:a===0,summary:{total:s.length,pass:t,warn:r,fail:a},results:s,formatted:Tr(s)}}const bs={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function Ir(){const e=bs.ENV==="production";return{baseUrl:bs.TEST_BASE_URL,apiKey:bs.TEST_API_KEY,isProduction:e}}async function yt(e,s){const t=Ir(),r=`${t.baseUrl}${e}`;try{const a=await fetch(r,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t.apiKey}`},body:JSON.stringify(s)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function vr(e){try{const s={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((r,a)=>({SerialNum:a+1,ItemName:r.name,Qty:r.quantity,UnitPrice:r.unitPrice,SupplyCost:r.supplyPrice,Tax:r.taxAmount,Remark:r.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},t=await yt("/eTaxInvoice/RegistAndIssue",s);if(t.code!==1)throw new Error(`바로빌 발행 실패: ${t.message}`);return{success:!0,ntsConfirmNumber:t.ntsconfirmNum,invoiceKey:t.invoiceKey,message:t.message}}catch(s){throw console.error("바로빌 세금계산서 발행 실패:",s),s}}async function Dr(e,s,t){try{const a=await yt("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:s,Memo:t});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(r){throw console.error("바로빌 세금계산서 취소 실패:",r),r}}function Ge(){return!1}async function Or(e){return await vr(e)}function kr(e,s,t){const r=Number(s.total_amount),a=Math.floor(r/1.1),o=r-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:s.buyer_business_number,buyerBusinessName:s.buyer_business_name||s.user_name,buyerCEO:s.buyer_ceo_name,buyerAddress:s.shipping_address,buyerEmail:s.user_email,buyerTel:s.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:t.map(n=>{const i=Number(n.price)*Number(n.quantity),c=Math.floor(i/1.1),l=i-c;return{name:n.product_name,quantity:Number(n.quantity),unitPrice:Number(n.price),supplyPrice:c,taxAmount:l,description:n.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:o,totalAmount:r,memo:`주문번호: ${s.order_number}`,orderNo:s.order_number}}class te extends Error{constructor(s,t,r){super(s),this.statusCode=t,this.code=r,this.name="AuthError"}}function Ar(e){return`${crypto.randomUUID()}-${e}`}function Nr(e){var o,n,i,c,l,u,d;const s=e.id.toString(),t=((o=e.properties)==null?void 0:o.nickname)||((i=(n=e.kakao_account)==null?void 0:n.profile)==null?void 0:i.nickname)||"Kakao User",r=((c=e.kakao_account)==null?void 0:c.email)||null,a=((l=e.properties)==null?void 0:l.profile_image)||((d=(u=e.kakao_account)==null?void 0:u.profile)==null?void 0:d.profile_image_url)||null;return{kakaoId:s,nickname:t,email:r,profileImage:a}}async function Cr(e,s,t,r,a){try{const o=await e.prepare(`
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
    `).bind(s,t,r,a).first();if(!o)throw new te("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",o.id),o}catch(o){throw o instanceof te?o:(console.error("[Auth] Database error during upsert:",o),new te("Database error",500,"DB_ERROR"))}}async function jr(e){try{const s=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!s.ok){const r=await s.text();throw console.error("[Kakao API] Failed to get user info:",r),new te("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const t=await s.json();if(!t.id)throw new te("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return t}catch(s){throw s instanceof te?s:(console.error("[Kakao API] Network error:",s),new te("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function Lr(e,s,t){try{const r=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:t,redirect_uri:s,code:e}).toString()});if(!r.ok){const o=await r.json();throw console.error("[Kakao OAuth] Token exchange failed:",o),new te(`Failed to exchange code: ${o.error_description||o.error}`,401,o.error||"TOKEN_EXCHANGE_FAILED")}return(await r.json()).access_token}catch(r){throw r instanceof te?r:(console.error("[Kakao OAuth] Network error:",r),new te("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function wt(e,s){const t=await jr(s),{kakaoId:r,nickname:a,email:o,profileImage:n}=Nr(t);console.log("[Auth] Processing login for Kakao user:",r);const i=await Cr(e,r,a,o,n),c=Ar(i.id);return{user:i,sessionToken:c}}async function bt(e,s,t=30){try{const r=await e.get(s,"json");if(!r)return console.log(`[Cache MISS] ${s}`),null;const a=Date.now()-r.timestamp;return a>t*1e3?(console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${s} (age: ${Math.round(a/1e3)}s)`),r.data)}catch(r){return console.error(`[Cache] Get error for key "${s}":`,r),null}}async function _s(e,s,t,r=30){try{const a={data:t,timestamp:Date.now()};await e.put(s,JSON.stringify(a),{expirationTtl:r}),console.log(`[Cache SET] ${s} (TTL: ${r}s)`)}catch(a){console.error(`[Cache] Set error for key "${s}":`,a)}}function Mr(e){const s=e.req.header("CF-Connecting-IP");if(s)return s;const t=e.req.header("X-Forwarded-For");if(t)return t.split(",")[0].trim();const r=e.req.header("X-Real-IP");return r||"unknown"}function $r(e,s){return`ratelimit:${e}:${s}`}const Ss=new Map;async function Fr(e,s,t){var m;const r=new URL(e.req.url).pathname,a=$r(s,r),o=Date.now(),n=t.windowMs*1e3,c=e.get("user")&&t.authenticatedMultiplier?t.maxRequests*t.authenticatedMultiplier:t.maxRequests;try{const _=(m=e.env)==null?void 0:m.RATE_LIMIT_KV;if(_){const f=await _.get(a);let g;f?(g=JSON.parse(f),o>g.resetTime?g={count:1,resetTime:o+n}:g.count++):g={count:1,resetTime:o+n};const b=Math.ceil(n/1e3);await _.put(a,JSON.stringify(g),{expirationTtl:b});const w=g.count<=c,h=Math.max(0,c-g.count);return{allowed:w,remaining:h,resetTime:g.resetTime}}}catch(_){console.error("KV Rate Limit Error:",_)}let l=Ss.get(a);l&&o>l.resetTime&&(Ss.delete(a),l=void 0),l?l.count++:l={count:1,resetTime:o+n},Ss.set(a,l);const u=l.count<=c,d=Math.max(0,c-l.count);return{allowed:u,remaining:d,resetTime:l.resetTime}}function ke(e){return async(s,t)=>{const r=Mr(s);if(e.skipIps&&e.skipIps.includes(r))return t();if(e.pathPattern){const o=new URL(s.req.url).pathname;if(!e.pathPattern.test(o))return t()}const a=await Fr(s,r,e);if(s.header("X-RateLimit-Limit",e.maxRequests.toString()),s.header("X-RateLimit-Remaining",a.remaining.toString()),s.header("X-RateLimit-Reset",new Date(a.resetTime).toISOString()),!a.allowed){const o=Math.ceil((a.resetTime-Date.now())/1e3);return s.header("Retry-After",o.toString()),s.json({success:!1,error:e.message||"Too many requests. Please try again later.",retryAfter:o,resetTime:new Date(a.resetTime).toISOString()},429)}return t()}}const Ae={api:{windowMs:60,maxRequests:60,message:"API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",authenticatedMultiplier:2},auth:{windowMs:60,maxRequests:5,message:"로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",pathPattern:/^\/api\/auth\//},order:{windowMs:60,maxRequests:10,message:"주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/orders/,authenticatedMultiplier:2},cart:{windowMs:60,maxRequests:20,message:"장바구니 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/cart/,authenticatedMultiplier:2},refund:{windowMs:3600,maxRequests:3,message:"환불 요청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.",pathPattern:/^\/api\/orders\/.*\/refund/},alimtalk:{windowMs:60,maxRequests:10,message:"알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/seller\/alimtalk\/send/},upload:{windowMs:60,maxRequests:5,message:"파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/.*\/upload/}};class W extends Error{constructor(s,t,r="VALIDATION_ERROR"){super(t),this.field=s,this.code=r,this.name="ValidationError"}}function Ur(e,s){const{field:t,required:r,type:a,min:o,max:n,pattern:i,enum:c,custom:l,message:u}=s;if(r&&(e==null||e===""))throw new W(t,u||`${t}은(는) 필수 항목입니다.`,"REQUIRED");if(!(e==null||e==="")){if(a)switch(a){case"string":if(typeof e!="string")throw new W(t,u||`${t}은(는) 문자열이어야 합니다.`,"INVALID_TYPE");break;case"number":const d=typeof e=="string"?Number(e):e;if(typeof d!="number"||isNaN(d))throw new W(t,u||`${t}은(는) 숫자여야 합니다.`,"INVALID_TYPE");break;case"boolean":if(typeof e!="boolean")throw new W(t,u||`${t}은(는) true/false 값이어야 합니다.`,"INVALID_TYPE");break;case"email":if(typeof e!="string"||!xr(e))throw new W(t,u||`${t}은(는) 유효한 이메일 주소여야 합니다.`,"INVALID_EMAIL");break;case"url":if(typeof e!="string"||!Hr(e))throw new W(t,u||`${t}은(는) 유효한 URL이어야 합니다.`,"INVALID_URL");break;case"phone":if(typeof e!="string"||!Wr(e))throw new W(t,u||`${t}은(는) 유효한 전화번호여야 합니다.`,"INVALID_PHONE");break;case"date":if(!(e instanceof Date)&&!Br(e))throw new W(t,u||`${t}은(는) 유효한 날짜여야 합니다.`,"INVALID_DATE");break;case"array":if(!Array.isArray(e))throw new W(t,u||`${t}은(는) 배열이어야 합니다.`,"INVALID_TYPE");break;case"object":if(typeof e!="object"||e===null||Array.isArray(e))throw new W(t,u||`${t}은(는) 객체여야 합니다.`,"INVALID_TYPE");break}if(typeof e=="string"){if(o!==void 0&&e.length<o)throw new W(t,u||`${t}은(는) 최소 ${o}자 이상이어야 합니다.`,"TOO_SHORT");if(n!==void 0&&e.length>n)throw new W(t,u||`${t}은(는) 최대 ${n}자 이하여야 합니다.`,"TOO_LONG")}if(typeof e=="number"){if(o!==void 0&&e<o)throw new W(t,u||`${t}은(는) 최소 ${o} 이상이어야 합니다.`,"TOO_SMALL");if(n!==void 0&&e>n)throw new W(t,u||`${t}은(는) 최대 ${n} 이하여야 합니다.`,"TOO_LARGE")}if(Array.isArray(e)){if(o!==void 0&&e.length<o)throw new W(t,u||`${t}은(는) 최소 ${o}개 이상이어야 합니다.`,"TOO_FEW");if(n!==void 0&&e.length>n)throw new W(t,u||`${t}은(는) 최대 ${n}개 이하여야 합니다.`,"TOO_MANY")}if(i&&typeof e=="string"&&!i.test(e))throw new W(t,u||`${t}의 형식이 올바르지 않습니다.`,"INVALID_FORMAT");if(c&&!c.includes(e))throw new W(t,u||`${t}은(는) 다음 중 하나여야 합니다: ${c.join(", ")}`,"INVALID_ENUM");if(l&&l(e)===!1)throw new W(t,u||`${t}의 값이 유효하지 않습니다.`,"CUSTOM_VALIDATION_FAILED")}}function qr(e,s){for(const t of s){const r=e[t.field];Ur(r,t)}}function Pr(e){return async(s,t)=>{try{let r={};const a=s.req.header("content-type")||"";a.includes("application/json")?r=await s.req.json().catch(()=>({})):(a.includes("application/x-www-form-urlencoded")||a.includes("multipart/form-data"))&&(r=await s.req.parseBody().catch(()=>({})));const o=new URL(s.req.url);for(const[n,i]of o.searchParams.entries())n in r||(r[n]=i);qr(r,e),s.set("validatedData",r),await t()}catch(r){if(r instanceof W)return s.json({success:!1,error:r.message,field:r.field,code:r.code},400);throw r}}}function xr(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=255}function Hr(e){try{const s=new URL(e);return s.protocol==="http:"||s.protocol==="https:"}catch{return!1}}function Wr(e){return/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e)}function Br(e){if(typeof e!="string")return!1;const s=new Date(e);return!isNaN(s.getTime())}const Kr=[{field:"email",required:!0,type:"email",max:255,message:"유효한 이메일 주소를 입력해주세요."},{field:"password",required:!0,type:"string",min:8,max:100,pattern:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:"비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다."},{field:"name",required:!0,type:"string",min:2,max:50,message:"이름은 2-50자 사이여야 합니다."},{field:"phone",required:!1,type:"phone",message:"유효한 전화번호를 입력해주세요. (예: 010-1234-5678)"}];function hs(e){const s=new URLSearchParams;for(const[t,r]of Object.entries(e))r!=null&&s.append(t,String(r));return s}function Ds(e,s){if(e.result_code!=="1")throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`)}async function Os(e){console.log("[Aligo] 토큰 생성 시작");const t=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:hs({apikey:e.ALIGO_API_KEY,userid:e.ALIGO_USER_ID})})).json();return Ds(t,"Token Create"),console.log("[Aligo] ✅ 토큰 생성 성공:",t.token.substring(0,20)+"..."),{token:t.token,urtime:t.urtime}}async function Vr(e,s){console.log("[Aligo] 카카오 채널 등록:",s.channelId);const{token:t}=await Os(e),a=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:hs({token:t,userid:e.ALIGO_USER_ID,plusid:s.channelId,phonenumber:s.phoneNumber})})).json();return Ds(a,"Channel Register"),console.log("[Aligo] ✅ 카카오 채널 등록 성공, senderKey:",a.senderkey),{success:!0,senderKey:a.senderkey}}async function Yr(e,s,t){console.log("[Aligo] 템플릿 등록:",t.templateCode);const{token:r}=await Os(e),o=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:hs({token:r,userid:e.ALIGO_USER_ID,senderkey:s,tpl_name:t.name,tpl_content:t.content,tpl_code:t.templateCode})})).json();return Ds(o,"Template Register"),console.log("[Aligo] ✅ 템플릿 등록 성공:",o.tpl_code),{success:!0,templateCode:o.tpl_code}}async function ks(e,s){console.log("[Aligo] 알림톡 발송:",s.to);try{const{token:t}=await Os(e),r=s.buttons?JSON.stringify({button:s.buttons}):void 0,o=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:hs({token:t,userid:e.ALIGO_USER_ID,senderkey:s.senderKey,tpl_code:s.templateCode,receiver_1:s.to,subject_1:"알림톡",message_1:s.message,button_1:r})})).json();return o.result_code!=="1"?(console.error("[Aligo] ❌ 알림톡 발송 실패:",o.message),{success:!1,error:o.message}):(console.log("[Aligo] ✅ 알림톡 발송 성공, messageId:",o.msg_id),{success:!0,messageId:o.msg_id})}catch(t){return console.error("[Aligo] ❌ 알림톡 발송 에러:",t.message),{success:!1,error:t.message}}}function Jr(e,s){let t=e;for(const[r,a]of Object.entries(s)){const o=new RegExp(`#{${r}}`,"g");t=t.replace(o,a)}return t}function St(e){let s=e.replace(/-/g,"");if(!s.startsWith("010"))throw new Error("Invalid phone number format. Must start with 010");if(s.length!==11)throw new Error("Invalid phone number length. Must be 11 digits");return s}async function zr(e,s){const t=await e.prepare(`
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
  `).bind(s).all();return{order:t,products:r.results}}async function Gr(e,s){const t=await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(s).first();return t||(console.warn(`No active alimtalk account for seller ${s}`),null)}async function Ps(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id,s.template_code,s.recipient_phone,s.message,s.cost,s.status,s.order_id||null).run()}async function Xr(e,s,t){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(t,s).run()}async function Qr(e,s){try{const{order:t,products:r}=await zr(e.DB,s),a=await Gr(e.DB,t.seller_id);if(!a)return console.warn(`Skipping alimtalk for order ${s}: no active account`),{success:!1,reason:"no_account"};const o=15;if(a.balance<o)return console.warn(`Skipping alimtalk for order ${s}: insufficient balance`),{success:!1,reason:"insufficient_balance"};const n=r.map(l=>`${l.name} ${l.quantity}개 (${l.price.toLocaleString()}원)`).join(`
`),i=`[주문 확인]

주문번호: ${t.order_number}
주문일시: ${new Date(t.created_at).toLocaleString("ko-KR")}

주문 상품:
${n}

총 결제금액: ${t.total_amount.toLocaleString()}원

배송지: ${t.shipping_address}
수령인: ${t.shipping_name}
연락처: ${t.shipping_phone}

주문해 주셔서 감사합니다!`,c=await ks(e,{senderKey:a.sender_key,templateCode:"order_confirm",to:t.buyer_phone,message:i});return c.success?(await Xr(e.DB,t.seller_id,o),await Ps(e.DB,{seller_id:t.seller_id,template_code:"order_confirm",recipient_phone:t.buyer_phone,message:i,cost:o,status:"sent",order_id:s}),console.log(`Order confirmation sent for order ${s}`),{success:!0}):(await Ps(e.DB,{seller_id:t.seller_id,template_code:"order_confirm",recipient_phone:t.buyer_phone,message:i,cost:0,status:"failed",order_id:s}),console.error(`Failed to send order confirmation for order ${s}:`,c.error),{success:!1,error:c.error})}catch(t){return console.error(`Error sending order confirmation for order ${s}:`,t),{success:!1,error:t.message}}}function Zr(e,s){let t=e;return Object.entries(s).forEach(([r,a])=>{const o=new RegExp(`#{${r}}`,"g");t=t.replace(o,a)}),t}function ea(e,s){const r=Array.from(e.matchAll(/#{(\w+)}/g),a=>a[1]).filter(a=>!s[a]);return{valid:r.length===0,missingVars:r}}async function sa(e,s,t){const r=await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();if(!r)throw new Error(`Account not found: ${s}`);return{sufficient:r.balance>=t,currentBalance:r.balance}}async function ta(e,s,t){const r=await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(t,s,t).run();if(!r.success||r.meta.changes===0)throw new Error("Insufficient balance or account not found")}async function xs(e,s,t){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t,s).run()}async function Ts(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s.accountId,s.templateId,s.orderId||null,s.recipientPhone,s.messageContent,s.status,s.cost,s.aligoMessageId||null,s.failedReason||null).run()}async function ra(e,s,t,r){await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t,r,s).run()}async function aa(e,s,t,r,a,o,n,i,c){try{const l={...i,...n.variables},u=Zr(r,l),d=await ks(e,{senderKey:a,templateCode:o,to:n.phone,message:u});return d.success?(await Ts(e.DB,{accountId:s,templateId:t,recipientPhone:n.phone,messageContent:u,status:"sent",cost:c,aligoMessageId:d.messageId}),{phone:n.phone,status:"sent",messageId:d.messageId,cost:c}):(await Ts(e.DB,{accountId:s,templateId:t,recipientPhone:n.phone,messageContent:u,status:"failed",cost:0,failedReason:d.error}),await xs(e.DB,s,c),{phone:n.phone,status:"failed",error:d.error,cost:0})}catch(l){return console.error(`Failed to send alimtalk to ${n.phone}:`,l),await Ts(e.DB,{accountId:s,templateId:t,recipientPhone:n.phone,messageContent:"",status:"failed",cost:0,failedReason:l.message}),await xs(e.DB,s,c),{phone:n.phone,status:"failed",error:l.message,cost:0}}}async function As(e,s){const{accountId:t,templateId:r,recipients:a,variables:o}=s;console.log(`[Alimtalk] Starting bulk send: ${a.length} recipients`);try{const n=await e.DB.prepare(`
      SELECT 
        id,
        sender_key,
        balance,
        status
      FROM alimtalk_accounts
      WHERE id = ?
    `).bind(t).first();if(!n)throw new Error("Account not found");if(n.status!=="active")throw new Error("Account is not active");const i=await e.DB.prepare(`
      SELECT 
        id,
        template_code,
        template_content,
        status
      FROM alimtalk_templates
      WHERE id = ? AND account_id = ?
    `).bind(r,t).first();if(!i)throw new Error("Template not found");if(i.status!=="approved")throw new Error("Template is not approved");const c=ea(i.template_content,o);if(!c.valid)throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);const l=15,u=a.length*l,d=await sa(e.DB,t,u);if(!d.sufficient)throw new Error(`Insufficient balance. Required: ${u}, Current: ${d.currentBalance}`);await ta(e.DB,t,u),console.log(`[Alimtalk] Deducted ${u} points from account ${t}`);const m=[];let _=0,f=0,g=0;for(const b of a){const w=await aa(e,t,r,i.template_content,n.sender_key,i.template_code,b,o,l);m.push(w),w.status==="sent"?_++:(f++,g+=l),m.length%10===0&&await new Promise(h=>setTimeout(h,1e3))}return await ra(e.DB,t,_,f),console.log(`[Alimtalk] Completed: ${_} sent, ${f} failed, ${g} refunded`),{success:!0,totalRecipients:a.length,successCount:_,failedCount:f,refundedAmount:g,messages:m}}catch(n){return console.error("[Alimtalk] Bulk send failed:",n),{success:!1,totalRecipients:a.length,successCount:0,failedCount:a.length,refundedAmount:0,messages:[],error:n.message}}}async function oa(e,s,t,r,a){const o=await e.DB.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(r).first();if(!o)throw new Error(`Order not found: ${r}`);const i=(await e.DB.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(r).all()).results.map(u=>`${u.name} ${u.quantity}개 (${u.price.toLocaleString()}원)`).join(`
`),c={orderNumber:o.order_number,orderDate:new Date(o.created_at).toLocaleString("ko-KR"),productList:i,totalAmount:o.total_amount.toLocaleString(),shippingAddress:o.shipping_address,shippingName:o.shipping_name,shippingPhone:o.shipping_phone,buyerName:o.buyer_name,customMessage:a||"감사합니다!"},l=[{phone:o.buyer_phone,name:o.buyer_name}];return As(e,{accountId:s,templateId:t,recipients:l,variables:c})}async function na(e,s,t,r,a={}){const o=r.map(n=>({phone:n.phone,name:n.name,variables:Object.entries(n).filter(([i])=>i!=="phone"&&i!=="name").reduce((i,[c,l])=>({...i,[c]:l}),{})}));return As(e,{accountId:s,templateId:t,recipients:o,variables:a})}function ia(e,s=.1){return Math.floor(e*s)}function ca(){const e=new Date,s=new Date(e.getFullYear(),e.getMonth()-1,1),t=s.getFullYear(),r=String(s.getMonth()+1).padStart(2,"0"),a=new Date(t,s.getMonth()+1,0).getDate();return{startDate:`${t}-${r}-01`,endDate:`${t}-${r}-${a}`}}async function la(e,s,t){try{const r=await e.prepare(`
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
    `).bind(s,t.startDate,t.endDate).all();if(!a.results||a.results.length===0)return{seller_id:s,seller_name:r.business_name,total_sales:0,total_orders:0,platform_fee:0,shipping_fee:0,refund_amount:0,settlement_amount:0,orders:[]};const o=[];let n=0,i=0,c=0;for(const m of a.results){const _=m.total_amount-m.shipping_fee,f=ia(_);o.push({order_id:m.id,order_number:m.order_number,order_date:m.created_at,product_name:m.product_names||"",quantity:m.total_quantity||1,price:_,shipping_fee:m.shipping_fee||0,platform_fee:f,status:m.status}),n+=_,i+=m.shipping_fee||0,c+=f}const l=await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(s,t.startDate,t.endDate).first(),u=(l==null?void 0:l.refund_amount)||0,d=n-c-u+i;return{seller_id:s,seller_name:r.business_name,total_sales:n,total_orders:o.length,platform_fee:c,shipping_fee:i,refund_amount:u,settlement_amount:d,orders:o}}catch(r){return console.error(`Failed to calculate settlement for seller ${s}:`,r),null}}async function ua(e,s){console.log(`[Settlement] Generating report for ${s.startDate} ~ ${s.endDate}`);const t=await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(s.startDate,s.endDate).all(),r=[];let a=0,o=0,n=0;for(const c of t.results){const l=await la(e,c.id,s);l&&(r.push(l),a+=l.total_sales,o+=l.platform_fee,n+=l.settlement_amount)}const i={period:s,generated_at:new Date().toISOString(),total_sales:a,total_platform_fee:o,total_settlement:n,sellers:r};return console.log(`[Settlement] Report generated: ${r.length} sellers, ${a.toLocaleString()}원`),i}async function da(e,s){const r=(await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(s.period.startDate,s.period.endDate,s.total_sales,s.total_platform_fee,s.total_settlement,s.generated_at).run()).meta.last_row_id;for(const a of s.sellers)await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a.seller_id,a.total_sales,a.total_orders,a.platform_fee,a.shipping_fee,a.refund_amount,a.settlement_amount).run();console.log(`[Settlement] Report saved: ID ${r}`)}async function pa(e,s){const t=await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(s).first();if(!t)return null;const a=(await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(s).all()).results.map(o=>({seller_id:o.seller_id,seller_name:o.seller_name,total_sales:o.total_sales,total_orders:o.total_orders,platform_fee:o.platform_fee,shipping_fee:o.shipping_fee,refund_amount:o.refund_amount,settlement_amount:o.settlement_amount,orders:[]}));return{period:{startDate:t.period_start,endDate:t.period_end},generated_at:t.generated_at,total_sales:t.total_sales,total_platform_fee:t.total_platform_fee,total_settlement:t.total_settlement,sellers:a}}async function ma(e,s){const t=new TextEncoder;let r;const a=new ReadableStream({async start(o){console.log(`[SSE] Client connected to stream ${e}`);try{const n=await s.DB.prepare(`
          SELECT 
            id,
            title,
            status,
            viewer_count,
            like_count
          FROM live_streams
          WHERE id = ?
        `).bind(e).first();if(n){const i={type:"status",data:n,timestamp:new Date().toISOString()},c=JSON.stringify(i);o.enqueue(t.encode(`data: ${c}

`))}}catch(n){console.error("[SSE] Failed to fetch initial data:",n)}r=setInterval(async()=>{try{const n=await s.DB.prepare(`
            SELECT 
              viewer_count,
              like_count,
              comment_count
            FROM live_streams
            WHERE id = ?
          `).bind(e).first();if(n){const i={type:"viewer_count",data:n,timestamp:new Date().toISOString()},c=JSON.stringify(i);o.enqueue(t.encode(`data: ${c}

`))}o.enqueue(t.encode(`: ping

`))}catch(n){console.error("[SSE] Update failed:",n)}},3e4)},cancel(){console.log(`[SSE] Client disconnected from stream ${e}`),r&&clearInterval(r)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function _a(e,s){const t=new TextEncoder;let r=0,a;const o=new ReadableStream({async start(n){console.log(`[SSE Chat] Client connected to stream ${e}`);try{const i=await s.DB.prepare(`
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
        `).bind(e).all();if(i.results.length>0){r=i.results[0].id;const c={type:"chat",data:i.results.reverse(),timestamp:new Date().toISOString()},l=JSON.stringify(c);n.enqueue(t.encode(`data: ${l}

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
          `).bind(e,r).all();if(i.results.length>0){r=i.results[i.results.length-1].id;const c={type:"chat",data:i.results,timestamp:new Date().toISOString()},l=JSON.stringify(c);n.enqueue(t.encode(`data: ${l}

`))}else n.enqueue(t.encode(`: ping

`))}catch(i){console.error("[SSE Chat] Polling failed:",i)}},5e3)},cancel(){console.log(`[SSE Chat] Client disconnected from stream ${e}`),a&&clearInterval(a)}});return new Response(o,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function fa(e,s){const t=new TextEncoder;let r=0,a;const o=new ReadableStream({async start(n){console.log(`[SSE Orders] Seller ${e} connected`);try{const i=await s.DB.prepare(`
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
          `).bind(e,r).all();if(i.results.length>0){r=i.results[i.results.length-1].id;const c={type:"order",data:i.results,timestamp:new Date().toISOString()},l=JSON.stringify(c);n.enqueue(t.encode(`data: ${l}

`))}else n.enqueue(t.encode(`: ping

`))}catch(i){console.error("[SSE Orders] Polling failed:",i)}},1e4)},cancel(){console.log(`[SSE Orders] Seller ${e} disconnected`),a&&clearInterval(a)}});return new Response(o,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Ea(e,s){const t=new TextEncoder;let r;const a=new ReadableStream({async start(o){console.log(`[SSE Stock] Seller ${e} connected`),r=setInterval(async()=>{try{const n=await s.DB.prepare(`
            SELECT 
              id,
              name,
              stock,
              low_stock_threshold
            FROM products
            WHERE seller_id = ?
              AND stock <= low_stock_threshold
              AND stock > 0
          `).bind(e).all();if(n.results.length>0){const i={type:"stock",data:n.results,timestamp:new Date().toISOString()},c=JSON.stringify(i);o.enqueue(t.encode(`data: ${c}

`))}else o.enqueue(t.encode(`: ping

`))}catch(n){console.error("[SSE Stock] Polling failed:",n)}},6e4)},cancel(){console.log(`[SSE Stock] Seller ${e} disconnected`),r&&clearInterval(r)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function ha(e,s,t,r){await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s,t,r.endpoint,r.keys.p256dh,r.keys.auth).run(),console.log(`[Push] Subscription saved for ${t} ${s}`)}async function ga(e,s){await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(),console.log(`[Push] Subscription deleted: ${s}`)}function ya(e){if(e.req.method!=="GET")return!1;const s=e.req.header("Authorization"),t=e.req.header("X-Session-Token");if(s||t)return!1;const a=new URL(e.req.url).pathname;return!(a.includes("/api/products/")&&a.includes("/stock")||a.includes("/api/streams/")&&a.includes("/status")||a.includes("/current-product")||a.includes("/api/chat")||a.includes("/api/sse")||a.includes("/api/orders")||a.includes("/api/payment"))}function wa(e,s){return s||new URL(e.req.url).toString()}function ba(e){const s=[];return s.push("public"),s.push(`max-age=${e.ttl}`),e.sMaxAge!==void 0?s.push(`s-maxage=${e.sMaxAge}`):s.push(`s-maxage=${e.ttl}`),e.staleWhileRevalidate&&s.push(`stale-while-revalidate=${e.staleWhileRevalidate}`),s.join(", ")}function Ns(e){return async(s,t)=>{var i;if(e.skipCache||!ya(s))return t();const r=wa(s,e.cacheKey),a=caches.default;let o=await a.match(r);if(o){console.log(`[Cache HIT] ${r}`);const c=new Headers(o.headers);return c.set("X-Cache","HIT"),c.set("X-Cache-Key",r),new Response(o.body,{status:o.status,statusText:o.statusText,headers:c})}console.log(`[Cache MISS] ${r}`),await t();const n=s.res;if(n.status>=200&&n.status<300){const c=ba(e);n.headers.set("Cache-Control",c),n.headers.set("X-Cache","MISS"),n.headers.set("X-Cache-Key",r);const l=e.varyBy||["Accept-Encoding"];n.headers.set("Vary",l.join(", "));const u=n.clone();(i=s.executionCtx)==null||i.waitUntil(a.put(r,u))}}}const Cs={products:{ttl:10,sMaxAge:60,staleWhileRevalidate:120},liveStreams:{ttl:5,sMaxAge:10,staleWhileRevalidate:30},microCache:{ttl:10,sMaxAge:10,staleWhileRevalidate:30}};class Sa extends Error{constructor(s,t,r,a){super(r),this.statusCode=s,this.code=t,this.details=a,this.name="AppError",Error.captureStackTrace(this,this.constructor)}}async function Ta(e,s,t,r){if(e)try{const a={title:`✅ ${s}`,description:t,color:3066993,fields:[],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Monitor"}};if(r)for(const[o,n]of Object.entries(r))a.fields.push({name:o,value:String(n),inline:!0});await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[a]})})}catch(a){console.error("[Discord] Failed to send success alert:",a)}}async function Ra(e,s,t){if(e)try{const r=["📊 **KV 사용량 경고**","","현재 사용량:",`• 읽기: ${s.toFixed(1)}%`,`• 쓰기: ${t.toFixed(1)}%`,"","50% 이상 사용 중입니다. 유료 플랜 업그레이드를 고려하세요.","https://dash.cloudflare.com"].join(`
`);await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:r})})}catch(r){console.error("[Discord] Failed to send KV warning:",r)}}class Ia{constructor(s){this.accessToken=null,this.tokenExpiry=0,this.databaseURL=s.FIREBASE_DATABASE_URL,this.projectId=s.FIREBASE_PROJECT_ID,this.privateKey=s.FIREBASE_PRIVATE_KEY,this.clientEmail=s.FIREBASE_CLIENT_EMAIL,(!this.databaseURL||!this.projectId||!this.privateKey||!this.clientEmail)&&console.warn("⚠️ Firebase Admin credentials not configured, using unauthenticated mode")}async set(s,t){const r=`${this.databaseURL}/${s}.json`,a=await fetch(r,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!a.ok){const o=await a.text();throw console.error(`❌ Firebase set failed for ${s}:`,o),new Error(`Firebase set failed: ${a.statusText}`)}console.log(`✅ Firebase: Set data at ${s}`)}async update(s,t){const r=`${this.databaseURL}/${s}.json`,a=await fetch(r,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!a.ok){const o=await a.text();throw console.error(`❌ Firebase update failed for ${s}:`,o),new Error(`Firebase update failed: ${a.statusText}`)}console.log(`✅ Firebase: Updated data at ${s}`)}async get(s){const t=`${this.databaseURL}/${s}.json`,r=await fetch(t,{method:"GET"});if(!r.ok)throw new Error(`Firebase get failed: ${r.statusText}`);return await r.json()}async delete(s){const t=`${this.databaseURL}/${s}.json`,r=await fetch(t,{method:"DELETE"});if(!r.ok)throw new Error(`Firebase delete failed: ${r.statusText}`);console.log(`✅ Firebase: Deleted data at ${s}`)}async updateStreamStatus(s,t){try{await this.update(`streams/stream${s}`,{...t,updated_at:Date.now()}),console.log(`✅ Firebase: Stream ${s} updated`,t)}catch(r){console.error(`❌ Firebase: Failed to update stream ${s}`,r)}}async updateProductStock(s,t,r){try{await this.update(`products/product${s}`,{id:s,stock:t,...r,updated_at:Date.now()}),console.log(`✅ Firebase: Product ${s} stock updated to ${t}`)}catch(a){console.error(`❌ Firebase: Failed to update product ${s}`,a)}}async changeCurrentProduct(s,t){try{await this.updateStreamStatus(s,{current_product_id:t}),console.log(`✅ Firebase: Stream ${s} current product changed to ${t}`)}catch(r){console.error(`❌ Firebase: Failed to change product for stream ${s}`,r)}}async sendLowStockAlert(s,t,r){try{const a=`chats/stream${s}`,o=Date.now();await this.set(`${a}/alert_${o}`,{username:"시스템",text:`⚠️ ${t}의 재고가 ${r}개 남았습니다!`,timestamp:o,isSystem:!0}),console.log(`✅ Firebase: Low stock alert sent for stream ${s}`)}catch(a){console.error("❌ Firebase: Failed to send low stock alert",a)}}async sendSoldOutAlert(s,t){try{const r=`chats/stream${s}`,a=Date.now();await this.set(`${r}/soldout_${a}`,{username:"시스템",text:`🔴 ${t}이(가) 품절되었습니다!`,timestamp:a,isSystem:!0}),console.log(`✅ Firebase: Sold out alert sent for stream ${s}`)}catch(r){console.error("❌ Firebase: Failed to send sold out alert",r)}}async createCustomToken(s,t){try{if(console.log(`[Firebase Custom Token] Creating for UID: ${s}`),!this.privateKey||!this.clientEmail||!this.projectId)throw new Error("Firebase credentials not configured");const r={alg:"RS256",typ:"JWT"},a=Math.floor(Date.now()/1e3),o={iss:this.clientEmail,sub:this.clientEmail,aud:"https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",iat:a,exp:a+3600,uid:s,claims:t||{}},n=w=>{const h=JSON.stringify(w);return btoa(h).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")},i=n(r),c=n(o),l=`${i}.${c}`,u=this.privateKey.replace(/\\n/g,`
`),d=await this.pemToDer(u),m=await crypto.subtle.importKey("pkcs8",d,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},!1,["sign"]),_=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",m,new TextEncoder().encode(l)),g=btoa(String.fromCharCode(...new Uint8Array(_))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,""),b=`${l}.${g}`;return console.log("[Firebase Custom Token] ✅ Token created successfully"),b}catch(r){throw console.error("[Firebase Custom Token] ❌ Failed to create token:",r),new Error("Failed to create Firebase custom token")}}async pemToDer(s){const a=s.substring("-----BEGIN PRIVATE KEY-----".length,s.length-"-----END PRIVATE KEY-----".length-1).trim(),o=atob(a),n=new Uint8Array(o.length);for(let i=0;i<o.length;i++)n[i]=o.charCodeAt(i);return n.buffer}}function ns(e){return new Ia(e)}const le=new Map;let V={hits:0,misses:0,writes:0,evictions:0};function we(e){const s=le.get(e);return s?s.expires<Date.now()?(le.delete(e),V.evictions++,V.misses++,null):(V.hits++,s.data):(V.misses++,null)}function Z(e,s,t){const r=Date.now()+t*1e3;if(le.set(e,{data:s,expires:r}),V.writes++,le.size>1e3){const a=le.keys().next().value;a&&(le.delete(a),V.evictions++)}}function va(e){let s=0;for(const t of le.keys())t.includes(e)&&(le.delete(t),s++);return s}async function Be(e,s){const t=Array.isArray(s)?s:[s];for(const r of t){const a=va(r);a>0&&console.log(`[Cache] 🧹 메모리 캐시 삭제: ${r} (${a}개)`);try{await e.CACHE_KV.delete(r),console.log(`[Cache] 🧹 KV 캐시 삭제: ${r}`)}catch(o){console.error(`[Cache] ❌ KV 캐시 삭제 실패: ${r}`,o)}}}const Ke={LIVE_STREAMS:["streams:live","streams:all","streams:scheduled","live_streams:live:all:20:0","live_streams:"],PRODUCTS:["products:","featured_products"],CART:e=>[`cart:${e}`],ORDERS:e=>[`orders:${e}`],ALL:["streams:","live_streams:","products:","cart:","orders:"]};function Da(e){const s=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:s,message:"API Request",context:e,duration:e.duration}))}function Oa(e){return{name:"tosspayments",async confirmPayment(s){try{const t=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:s.paymentKey,orderId:s.orderId,amount:s.amount})}),r=await t.json();if(!t.ok)return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:r.message||"결제 승인 실패",rawData:r};let a={};r.card&&(a={cardCompany:r.card.company,cardNumber:r.card.number,installmentMonths:r.card.installmentPlanMonths||0});let o={};return r.virtualAccount&&(o={virtualAccountBank:r.virtualAccount.bankCode,virtualAccountNumber:r.virtualAccount.accountNumber,virtualAccountHolder:r.virtualAccount.customerName,virtualAccountDueDate:r.virtualAccount.dueDate}),{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,transactionId:r.transactionKey,...a,...o,rawData:r}}catch(t){return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:t.message,rawData:null}}},async cancelPayment(s){try{const t={cancelReason:s.cancelReason};s.cancelAmount&&(t.cancelAmount=s.cancelAmount);const r=await fetch(`https://api.tosspayments.com/v1/payments/${s.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(t)}),a=await r.json();return r.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(t){return{success:!1,error:t.message}}},async getPayment(s){try{const t=await fetch(`https://api.tosspayments.com/v1/payments/${s}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),r=await t.json();if(!t.ok)throw new Error(r.message);return{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,rawData:r}}catch(t){throw t}}}}function ka(e,s){switch(e.toLowerCase()){case"tosspayments":return Oa(s);default:throw new Error(`Unknown payment provider: ${e}`)}}const p=new gt;p.use("*",async(e,s)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{wr(e.env),br(e.env)}catch(r){console.error("[ENV] Validation failed:",r)}await s()});async function Aa(e){try{const s=e.req.header("Authorization"),t=(s==null?void 0:s.replace("Bearer ",""))||"";if(!t)return console.warn("[Firebase Auth] No token provided"),null;try{const{verifyFirebaseIdToken:r}=await Promise.resolve().then(()=>za),a=await r(t,e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284");console.log("[Firebase Auth] ✅ Firebase token verified:",a.uid);const o=await e.env.DB.prepare(`
        SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?
      `).bind(a.uid).first();if(!o)return console.warn("[Firebase Auth] User not found for UID:",a.uid),null;const n=a.role||o.user_type||"user";return console.log("[Firebase Auth] ✅ User authenticated:",{userId:o.id,userType:n,email:o.email,firebaseUID:a.uid}),{userId:o.id,userType:n,email:o.email,firebaseUID:a.uid}}catch(r){return console.error("[Firebase Auth] Token verification failed:",r),null}}catch(s){return console.error("[Firebase Auth Error]",s),null}}async function Ne(e,s,t){if(!s)return null;const r=`session:${s}`;try{const a=we(r);if(a)return a;const o=await e.get(r);if(!o)return null;const n=JSON.parse(o);if(n.expires_at&&Date.now()>n.expires_at)return t!=null&&t.executionCtx||await e.delete(r),null;const i={user_id:n.user_id,user_type:n.user_type||"user",created_at:n.created_at};return Z(r,i,900),i}catch(a){return console.error("[Auth] Session lookup error:",a),null}}async function j(e,s){const t=await Aa(e);if(!t)return e.json({success:!1,error:"Authentication required - Firebase ID Token 필요",code:"AUTH_REQUIRED"},401);e.set("user",{userId:t.userId,userType:t.userType,email:t.email,firebaseUID:t.firebaseUID}),e.set("userId",t.userId),e.set("userType",t.userType),e.set("email",t.email),e.set("firebaseUID",t.firebaseUID),await s()}async function Na(e,s){const t=e.get("userType"),r=e.get("userId");if(t!=="admin")return console.warn("[Security] Unauthorized admin access attempt:",{userId:r,userType:t}),e.json({success:!1,error:"관리자 권한이 필요합니다."},403);await s()}async function Ca(e,s){const t=e.get("userType"),r=e.get("userId");if(t!=="seller")return console.warn("[Security] Unauthorized seller access attempt:",{userId:r,userType:t}),e.json({success:!1,error:"판매자 권한이 필요합니다."},403);await s()}async function ja(e){return async(s,t)=>{const r=s.get("userId");if(s.get("userType")==="admin"){await t();return}const o=s.req.param("userId");if(o&&o!==String(r))return console.warn("[Security] Unauthorized resource access attempt:",{resourceType:e,requestedUserId:o,actualUserId:r}),s.json({success:!1,error:"본인의 정보만 조회할 수 있습니다."},403);await t()}}async function La(e,s){try{const t=we(s);if(t!==null)return t;const r=await e.get(s);if(r){const a=JSON.parse(r);return Z(s,a,300),a}return null}catch(t){return console.error("[Cache] Read error:",t),null}}async function Ze(e,s,t,r=60,a=!1){try{Z(s,t,r),a?(await e.put(s,JSON.stringify(t),{expirationTtl:r}),console.log(`[Cache] ✅ Saved to both Memory + KV: ${s}`)):console.log(`[Cache] ✅ Saved to Memory only (KV Write skipped): ${s}`)}catch(o){console.error("[Cache] Write error:",o)}}async function js(e,...s){try{await Promise.all(s.map(t=>e.delete(t)))}catch(t){console.error("[Cache] Delete error:",t)}}async function is(e,s,t,r,a,o,n){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s,t,r,a,o,n||null).run(),console.log(`[Notification] Created for ${t} ${s}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function Ma(e,s,t,r,a){await is(e,s,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${r}님의 주문 (${t}) - ${$a(a)}`,"/seller/orders")}async function Tt(e,s,t,r,a,o){let n="",i="";switch(r){case"preparing":n="📦 상품 준비 중",i=`주문번호 ${t}의 상품을 준비하고 있습니다`;break;case"shipping":n="🚚 배송이 시작되었습니다",i=`주문번호 ${t}가 배송 중입니다`,a&&o&&(i+=` (${a}: ${o})`);break;case"delivered":n="✅ 배송 완료",i=`주문번호 ${t}가 배송 완료되었습니다`;break;default:return}await is(e,s,"user","shipping_status",n,i,"/my-orders")}async function Rt(e,s,t,r,a){await is(e,s,"seller","low_stock","⚠️ 재고 부족 알림",`${t}의 재고가 ${r}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function $a(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function Fa(e,s,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:s,description:t,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!r.ok){const d=await r.text();throw new Error(`YouTube Broadcast 생성 실패: ${d}`)}const o=(await r.json()).id,n=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${s} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!n.ok){const d=await n.text();throw new Error(`YouTube Stream 생성 실패: ${d}`)}const i=await n.json(),c=i.id,l=i.cdn.ingestionInfo.streamName,u=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${o}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:o,streamId:c,streamKey:l,streamUrl:u}}catch(r){throw console.error("[YouTube API] Live broadcast creation failed:",r),r}}async function Ua(e,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const t=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${s}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!t.ok){const r=await t.text();throw new Error(`YouTube 방송 종료 실패: ${r}`)}}catch(t){throw console.error("[YouTube API] Live broadcast end failed:",t),t}}async function qa(e,s,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let r=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${s}&part=snippet,authorDetails`;t&&(r+=`&pageToken=${t}`);const a=await fetch(r,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const n=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${n}`)}const o=await a.json();return{messages:o.items||[],nextPageToken:o.nextPageToken,pollingIntervalMillis:o.pollingIntervalMillis||5e3}}catch(r){throw console.error("[YouTube API] Get chat messages failed:",r),r}}async function Pa(e,s){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const t=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},r=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}&key=${e.apiKey}`,a=await fetch(r,{headers:t});if(!a.ok){const l=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${l}`)}const o=await a.json();if(!o.items||o.items.length===0)throw new Error("Video not found");const n=o.items[0],i=n.statistics,c=n.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(t){throw console.error("[YouTube API] Get live stats failed:",t),t}}function It(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const s=new URL(e);if(s.hostname.includes("youtube.com")){const t=s.searchParams.get("v");if(t)return t;const r=s.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(r)return r[2]}if(s.hostname==="youtu.be"){const t=s.pathname.slice(1).split("?")[0];if(t&&t.length===11)return t}return null}catch{return null}}function vt(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const t=s.pathname.match(/\/video\/(\d+)/);if(t)return t[1];const r=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}function xa(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){if(s.pathname.includes("/live"))return"live";if(s.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Dt(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const t=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(t)return t[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}p.use("*",async(e,s)=>{await s(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const t=new URL(e.req.url);t.hostname!=="localhost"&&t.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",S());p.use(ke(Ae.auth));p.use(ke(Ae.alimtalk));p.use(ke(Ae.order));p.use(ke(Ae.refund));p.use(ke(Ae.cart));p.use(ke(Ae.upload));p.use("/api/*",ke(Ae.api));p.use("*",async(e,s)=>{await s(),e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"),e.header("X-Frame-Options","DENY"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",async(e,s)=>{const t=Date.now(),r=e.req.method,a=e.req.path;await s();const o=Date.now()-t,n=e.res.status,i={method:r,path:a,status:n,duration:o},c=e.get("userId");c&&(i.userId=c),Da(i)});p.use("/static/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/images/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/api/admin*",async(e,s)=>{if(e.req.path==="/api/admin/login")return s();const t=await j(e,()=>Promise.resolve());if(t)return t;const r=await Na(e,()=>Promise.resolve());return r||s()});p.use("/api/seller*",async(e,s)=>{if(e.req.path==="/api/seller/register")return s();const t=await j(e,()=>Promise.resolve());if(t)return t;const r=await Ca(e,()=>Promise.resolve());return r||s()});async function Ve(e,s){const t=await e.get(`session:${s}`);if(!t)return null;const r=JSON.parse(t);return r.expires_at&&Date.now()>r.expires_at?(await e.delete(`session:${s}`),null):{session_token:s,[`${r.user_type}_id`]:r.user_id,user_type:r.user_type,...r.userData}}p.post("/api/auth/user/register",S(),Pr(Kr),async e=>{const{DB:s}=e.env;try{const{email:t,password:r,name:a,phone:o}=e.get("validatedData"),n=`placeholder_hash_for_${r}`;try{const c=(await s.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(t,n,a,o||null).run()).meta.last_row_id,l=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:l,user:{id:c,email:t,name:a,phone:o}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(t){return console.error("[User Register] Error:",t),e.json({success:!1,error:t.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/auth/user/login",S(),async e=>{const{DB:s,SESSION_KV:t}=e.env;try{const{email:r,password:a}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const o=await s.prepare(`
      SELECT id, email, name, kakao_id, password_hash, password, created_at
      FROM users 
      WHERE email = ?
    `).bind(r).first();if(!o)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(o.password_hash&&o.password_hash.includes(`placeholder_hash_for_${a}`)||o.password&&o.password===a))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await s.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(o.id).run();const i=crypto.randomUUID(),c=Date.now()+720*60*60*1e3;return await t.put(`session:${i}`,JSON.stringify({user_id:o.id,user_type:"user",expires_at:c,created_at:Date.now()}),{expirationTtl:720*60*60}),console.log("[User Login] Session created in SESSION_KV for user:",o.id),e.json({success:!0,data:{session_token:i,user:{id:o.id,email:o.email,name:o.name,phone:o.phone,profile_image:o.profile_image}}})}catch(r){return console.error("[User Login] Error:",r),e.json({success:!1,error:r.message||"로그인 중 오류가 발생했습니다"},500)}});p.post("/api/auth/login",S(),async e=>e.json({success:!1,error:"This endpoint is deprecated. Please use Firebase Authentication.",message:"Admin/Seller login should use /api/admin/login or /api/seller/login with Firebase Auth",code:"DEPRECATED_ENDPOINT"},410));p.post("/api/auth/logout",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");return t&&await e.env.SESSION_KV.delete(`session:${t}`),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/register",S(),async e=>{const{DB:s}=e.env;try{const{email:t,password:r,name:a,phone:o,business_number:n,company_name:i}=await e.req.json();if(!t||!r||!a||!o)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(r.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=t.split("@")[0],l=`placeholder_hash_for_${r}`;try{const u=await s.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,t,l,a,o,n||null,i||null).run();return e.json({success:!0,data:{sellerId:u.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(u){const d=u.message||"";if(d.includes("UNIQUE")||d.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw u}}catch(t){return console.error("Seller registration error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/admin/login",S(),async e=>{const{DB:s}=e.env;try{const{email:t,password:r}=await e.req.json();if(!t||!r)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await s.prepare(`
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
    `).bind(t).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(t==="admin@example.com"&&r==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${r}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=ns(e.env),c=`admin_${a.id}`;try{await i.auth.getUser(c).catch(async()=>{await i.auth.createUser({uid:c,email:a.email,displayName:a.name})}),await i.auth.setCustomUserClaims(c,{role:"admin",userId:a.id,email:a.email});const l=await i.createCustomToken(c,{role:"admin",userId:a.id,email:a.email});return await s.prepare(`
        UPDATE admins SET firebase_uid = ? WHERE id = ?
      `).bind(c,a.id).run(),await s.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),console.log(`[Firebase Login] ✅ Admin ${a.email} logged in with Firebase (KV Write: 0)`),e.json({success:!0,data:{customToken:l,admin:{id:a.id,username:a.username,email:a.email,name:a.name,firebaseUID:c}}})}catch(l){return console.error("[Firebase] Admin login error:",l),e.json({success:!1,error:"Firebase authentication failed"},500)}}catch(t){return console.error("Admin login error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/auth/verify",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await Ve(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=r.user_type==="admin"?"admins":"sellers",o=r.user_type==="admin"?r.admin_id:r.seller_id,n=await s.prepare(`
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
    `).bind(o).first();return n?e.json({success:!0,data:{user:{id:n.id,type:r.user_type,username:n.username,name:n.name,email:n.email,businessName:n.business_name}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/auth/kakao/sync/callback",async e=>{var t,r,a,o,n,i,c,l,u,d,m,_,f;const{DB:s}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!s);const g=e.req.query("code"),b=e.req.query("state")||"/",w=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!g,state:b,error:w}),w)return console.error("[Kakao Sync] OAuth error:",w),e.redirect(`${b}?error=kakao_oauth_${w}`);if(!g)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${b}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const h=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",T=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",h.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",T),console.log("[Kakao Sync] Step 1: Fetching access token...");const y=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:h,redirect_uri:T,code:g})});if(console.log("[Kakao Sync] Token response status:",y.status),console.log("[Kakao Sync] Token request details:",{client_id:h,redirect_uri:T,code_length:g.length,code_prefix:g.substring(0,20)}),!y.ok){const H=await y.text();return console.error("[Kakao Sync] Token request failed:",H),e.redirect(`${b}?error=token_request_failed&detail=${encodeURIComponent(H)}`)}const R=await y.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!R.access_token,error:R.error,errorDescription:R.error_description}),!R.access_token)return console.error("[Kakao Sync] Token error:",R),e.redirect(`${b}?error=token_failed&detail=${encodeURIComponent(R.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const $=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${R.access_token}`}});console.log("[Kakao Sync] User response status:",$.status);const A=await $.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!A.id,id:A.id,hasNickname:!!((t=A.properties)!=null&&t.nickname||(a=(r=A.kakao_account)==null?void 0:r.profile)!=null&&a.nickname)}),!A.id)return console.error("[Kakao Sync] Failed to get user info:",A),e.redirect(`${b}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const O=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${R.access_token}`}});console.log("[Kakao Sync] Terms response status:",O.status);let x=null;if(O.ok?(x=await O.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((o=x.allowed_service_terms)==null?void 0:o.length)||0,tags:(n=x.allowed_service_terms)==null?void 0:n.map(H=>H.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!s)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${b}?error=db_not_available`);const U=A.id.toString(),L=((i=A.properties)==null?void 0:i.nickname)||((l=(c=A.kakao_account)==null?void 0:c.profile)==null?void 0:l.nickname)||"Kakao User",F=((u=A.kakao_account)==null?void 0:u.email)||"",G=((d=A.properties)==null?void 0:d.profile_image)||((_=(m=A.kakao_account)==null?void 0:m.profile)==null?void 0:_.profile_image_url)||"",Y=R.access_token,v=((f=x==null?void 0:x.allowed_service_terms)==null?void 0:f.map(H=>H.tag))||[],ee=JSON.stringify(v);console.log("[Kakao Sync] User data:",{kakaoId:U,nickname:L,email:F?"exists":"none",serviceTerms:v});try{const H=await s.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(U).first();console.log("[Kakao Sync] Existing user check:",!!H);let q;H?(q=H.id,await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L,F,G,q).run(),console.log("[Kakao Sync] Updated user:",q)):(q=(await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(U,L,F||null,G||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",q)),console.log("[Kakao Sync] User saved successfully, userId:",q),console.log("[Kakao Sync] Step 4: Generating Firebase Custom Token...");const J=ns(e.env),ce=`kakao_${U}`,cs=await J.createCustomToken(ce,{role:"user",userId:q,email:F||void 0,kakaoId:U});await s.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(ce,q).run(),console.log("[Kakao Sync] ✅ Firebase Custom Token 발급 완료 for user:",q),console.log("[Kakao Sync] Step 5: Redirecting with Firebase Custom Token...");const Ye=b.includes("?")?`${b}&firebase_token=${encodeURIComponent(cs)}&userName=${encodeURIComponent(L)}`:`${b}?firebase_token=${encodeURIComponent(cs)}&userName=${encodeURIComponent(L)}`;return console.log("[Kakao Sync] Redirect URL (Firebase):",Ye.substring(0,100)+"..."),e.redirect(Ye)}catch(H){return console.error("[Kakao Sync] Database error:",H),console.error("[Kakao Sync] DB error details:",{message:H.message,name:H.name}),e.redirect(`${b}?error=database_error&detail=${encodeURIComponent(H.message)}`)}}catch(g){console.error("[Kakao Sync] Exception:",g),console.error("[Kakao Sync] Error details:",{message:g.message,stack:g.stack,name:g.name});const b=e.req.query("state")||"/",w=encodeURIComponent(g.message||"unknown");return e.redirect(`${b}?error=kakao_sync_failed&detail=${w}`)}});p.post("/api/auth/kakao/callback",S(),async e=>{const{DB:s}=e.env;try{const{code:t,redirect_uri:r}=await e.req.json();if(!t)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=r||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow with Firebase Custom Token");const o=await Lr(t,a,e.env.KAKAO_REST_API_KEY),{user:n}=await wt(s,o),i=ns(e.env),c=`kakao_${n.kakao_id}`,l=await i.createCustomToken(c,{userId:n.id,userType:"user",email:n.email||void 0,kakaoId:n.kakao_id});return console.log("[Kakao Callback] ✅ Firebase Custom Token 발급 완료 for user:",n.id),await s.prepare(`
      UPDATE users SET firebase_uid = ? WHERE id = ?
    `).bind(c,n.id).run(),e.json({success:!0,data:{customToken:l,user:{id:n.id,name:n.name,email:n.email,profile_image:n.profile_image,firebaseUID:c}}})}catch(t){return console.error("[Kakao Callback] Error:",t),t instanceof te?e.json({success:!1,error:t.message,code:t.code},t.statusCode):e.json({success:!1,error:t.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/firebase",S(),async e=>{const{DB:s}=e.env;try{const{accessToken:t}=await e.req.json();if(!t)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Firebase] Processing Kakao OAuth login");const r=Date.now(),{user:a}=await wt(s,t);console.log("[Kakao Firebase] ProcessKakaoLogin completed in",Date.now()-r,"ms");const o=await generateFirebaseCustomToken(a.id.toString(),{role:"user",email:a.email,name:a.name});return console.log("[Kakao Firebase] ✅ Firebase Custom Token 생성 완료 for user:",a.id),console.log("[Kakao Firebase] Total login time:",Date.now()-r,"ms"),e.json({success:!0,customToken:o,user:{id:a.id,name:a.name,email:a.email,profile_image:a.profile_image}})}catch(t){return console.error("[Kakao Firebase] Error:",t),t instanceof te?e.json({success:!1,error:t.message,code:t.code},t.statusCode):e.json({success:!1,error:t instanceof Error?t.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/firebase/sync",S(),async e=>{const{DB:s}=e.env;try{const{idToken:t,firebaseUid:r,email:a,displayName:o}=await e.req.json();if(!t||!r)return e.json({success:!1,error:"idToken and firebaseUid are required"},400);console.log("[Firebase Sync] Syncing user to D1:",{firebaseUid:r,email:a});const n=await verifyFirebaseToken(t,e.env);if(!n||n.uid!==r)return e.json({success:!1,error:"Invalid Firebase token"},401);const i=await s.prepare("SELECT id, email, name FROM users WHERE firebase_uid = ?").bind(r).first();if(i)return await s.prepare(`
        UPDATE users 
        SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE firebase_uid = ?
      `).bind(a||i.email,o||i.name,r).run(),console.log("[Firebase Sync] ✅ 기존 사용자 업데이트 완료:",i.id),e.json({success:!0,user:{id:i.id,email:a||i.email,name:o||i.name}});if(a){const c=await s.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(a).first();if(c)return await s.prepare(`
            UPDATE users 
            SET firebase_uid = ?, name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
          `).bind(r,o||c.name,a).run(),console.log("[Firebase Sync] ✅ 기존 이메일 사용자에 firebase_uid 연결:",c.id),e.json({success:!0,user:{id:c.id,email:c.email,name:o||c.name}})}return e.json({success:!1,error:"User not found. Please register first."},404)}catch(t){return console.error("[Firebase Sync] Error:",t),e.json({success:!1,error:t instanceof Error?t.message:"Sync failed"},500)}});p.post("/api/auth/firebase/register",S(),async e=>{const{DB:s}=e.env;try{const{idToken:t,firebaseUid:r,email:a,name:o,userType:n}=await e.req.json();if(!t||!r||!a||!o)return e.json({success:!1,error:"idToken, firebaseUid, email, and name are required"},400);console.log("[Firebase Register] Registering new user:",{firebaseUid:r,email:a,userType:n});const i=await verifyFirebaseToken(t,e.env);if(!i||i.uid!==r)return e.json({success:!1,error:"Invalid Firebase token"},401);const c=await s.prepare(`
      INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(r,a,o).run();return console.log("[Firebase Register] ✅ 새 사용자 생성 완료:",c.meta.last_row_id),e.json({success:!0,user:{id:c.meta.last_row_id,email:a,name:o,firebaseUid:r}})}catch(t){return console.error("[Firebase Register] Error:",t),t instanceof Error&&t.message.includes("UNIQUE")?e.json({success:!1,error:"Email already exists",code:"EMAIL_EXISTS"},409):e.json({success:!1,error:t instanceof Error?t.message:"Registration failed"},500)}});p.get("/api/auth/validate",S(),async e=>{try{const s=e.req.header("Authorization"),t=(s==null?void 0:s.replace("Bearer ",""))||"";if(!t)return e.json({success:!1,valid:!1,error:"No JWT token provided",code:"NO_TOKEN"},401);const r=getJwtSecret(e.env);console.log("[JWT Validate] Secret (first 20 chars):",r.substring(0,20)),console.log("[JWT Validate] Token (first 50 chars):",t.substring(0,50));const a=await verifyCachedToken(t,r);return console.log("[JWT Validate] Payload:",a?"Valid":"Invalid/Expired"),a?e.json({success:!0,valid:!0,data:{user_id:a.userId,user_type:a.userType,email:a.email,session_valid:!0},user:{userId:a.userId,userType:a.userType,email:a.email}}):e.json({success:!1,valid:!1,error:"JWT token expired or invalid",code:"TOKEN_EXPIRED"},401)}catch(s){return console.error("[JWT Validate Error]",s),e.json({success:!1,valid:!1,error:"Internal server error",code:"INTERNAL_ERROR"},500)}});p.post("/api/auth/refresh",S(),async e=>{try{const s=await e.req.json(),{refreshToken:t}=s;if(!t)return e.json({success:!1,error:"No refresh token provided",code:"NO_REFRESH_TOKEN"},400);const r=getJwtSecret(e.env),a=await refreshAccessToken(t,r);return a?e.json({success:!0,data:{accessToken:a}}):e.json({success:!1,error:"Refresh token expired or invalid",code:"REFRESH_TOKEN_EXPIRED"},401)}catch(s){return console.error("[JWT Refresh Error]",s),e.json({success:!1,error:"Internal server error",code:"INTERNAL_ERROR"},500)}});p.post("/api/auth/kakao/logout",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token")||"";return t&&(await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(t){return console.error("[Kakao Sync] Logout error:",t),e.json({success:!1,error:"Logout failed"},500)}});p.post("/api/auth/kakao/unlink",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await s.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(t).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
      SELECT u.id, u.email, u.name, u.kakao_id, u.profile_image, u.created_at
      FROM users u
      WHERE u.id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(t).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const o=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),n=await o.json();o.ok?console.log("[Kakao Unlink] Kakao unlink successful:",n.id):console.warn("[Kakao Unlink] Kakao unlink failed:",n)}catch(o){console.error("[Kakao Unlink] Kakao API error:",o)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(),console.log("[Kakao Unlink] Sessions deleted"),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await s.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(t){return console.error("[Kakao Unlink] Error:",t),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});p.post("/webhooks/kakao/unlink",async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),{user_id:r,referrer_type:a}=t;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:r,referrer_type:a}),!r)return e.json({success:!1,error:"user_id is required"},400);const o=await s.prepare(`
      SELECT id, kakao_id, email, name, created_at
      FROM users 
      WHERE kakao_id = ?
    `).bind(r.toString()).first();return o?(console.log("[Kakao Webhook] Deleting user data for user:",o.id),await s.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(o.id).run(),await s.prepare("DELETE FROM users WHERE id = ?").bind(o.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",r),e.json({success:!0}))}catch(t){return console.error("[Kakao Webhook] Error:",t),e.json({success:!1,error:"Webhook processing failed"},500)}});p.get("/api/auth/user/verify",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await Ve(e.env.SESSION_KV,t);if(!r||r.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
      SELECT id, email, name, kakao_id, profile_image, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();return a?e.json({success:!0,data:{user:{id:a.id,name:a.name,email:a.email,profileImage:a.profile_image,phone:a.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/shipping-addresses",S(),j,async e=>{const{DB:s}=e.env,t=e.get("userId");try{const r=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/shipping-addresses/:userId",S(),j,async e=>{const{DB:s}=e.env,t=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==t)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/shipping-addresses",S(),j,async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),r=t.user_id,a=t.recipient_name,o=t.phone,n=t.postal_code,i=t.address,c=t.address_detail,l=t.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(t)),!r||!a||!o||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:r,recipientName:a,phone:o,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);l&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();const u=await s.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a,o,n||"",i,c||"",l?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:u.meta.last_row_id}),e.json({success:!0,data:{id:u.meta.last_row_id}})}catch(t){return console.error("[POST /api/shipping-addresses] Error:",t),e.json({success:!1,error:t.message},500)}});p.put("/api/shipping-addresses/:id",S(),j,async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=await e.req.json(),a=r.user_id,o=r.recipient_name,n=r.phone,i=r.postal_code,c=r.address,l=r.address_detail,u=r.is_default;return u&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await s.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(o,n,i||"",c,l||"",u?1:0,t,a).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/shipping-addresses/:id",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=e.req.query("userId");return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t,r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});async function P(e){const s=e.req.header("Authorization");if(s!=null&&s.startsWith("Bearer ")){const a=s.substring(7);try{const o=await verifyJWT(a,e.env.JWT_SECRET);return o.userType!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:o.userId,userData:o}}catch(o){console.error("[verifyAdminSession] JWT verification failed:",o)}}const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await Ve(e.env.SESSION_KV,t);return!r||r.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:r.admin_id,userData:r}}async function N(e){const s=e.req.header("Authorization");if(s!=null&&s.startsWith("Bearer ")){const a=s.substring(7);try{const o=await verifyJWT(a,e.env.JWT_SECRET);return o.userType!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:o.userId,userData:o}}catch(o){console.error("[verifySellerSession] JWT verification failed:",o)}}const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await Ve(e.env.SESSION_KV,t);return!r||r.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:r.seller_id,userData:r}}p.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));p.get("/api/cleanup/expired-reservations",async e=>{const{DB:s}=e.env;try{console.log("========================================"),console.log("[Cleanup] ⏰ 만료된 재고 예약 정리 시작"),console.log("========================================");const t=new Date().toISOString();console.log("[Cleanup] 현재 시간:",t);const r=await s.prepare(`
      SELECT id, order_number, reservation_expires_at
      FROM orders
      WHERE status = 'pending'
        AND reservation_expires_at IS NOT NULL
        AND reservation_expires_at < ?
      LIMIT 100
    `).bind(t).all();if(r.results.length===0)return console.log("[Cleanup] ✅ 만료된 예약 없음"),e.json({success:!0,message:"만료된 예약이 없습니다.",cleaned:0});console.log(`[Cleanup] 📦 만료된 주문 ${r.results.length}개 발견`);let a=0;for(const o of r.results)try{const n=await s.prepare(`
          SELECT product_id, quantity
          FROM order_items
          WHERE order_id = ?
        `).bind(o.id).all();if(n.results.length===0){console.warn(`[Cleanup] ⚠️ 주문 ${o.order_number}: 아이템 없음`);continue}const i=n.results.map(c=>s.prepare(`
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
        `).bind(o.id).run(),console.log(`[Cleanup] ✅ ${o.order_number}: ${n.results.length}개 상품 예약 해제`),a++}catch(n){console.error(`[Cleanup] ❌ ${o.order_number} 처리 실패:`,n)}return console.log(`[Cleanup] ✅ 정리 완료: ${a}/${r.results.length}개`),e.json({success:!0,message:`${a}개의 만료된 예약을 정리했습니다.`,cleaned:a,total:r.results.length})}catch(t){return console.error("[Cleanup] ❌ 정리 실패:",t),e.json({success:!1,error:"만료된 예약 정리 중 오류가 발생했습니다.",details:t.message},500)}});p.get("/api/test/env",async e=>{try{const s=await Rr(e.env);return e.json(s)}catch(s){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:s instanceof Error?s.message:String(s)},500)}});p.get("/api/streams",Ns(Cs.liveStreams),async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.query("status")||"all",a=`streams:${r}`,o=await t.get(a,"json");if(o)return e.json({success:!0,data:o,cached:!0});let n=`
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
    `;r==="live"?n+=" WHERE ls.status = 'live'":r==="scheduled"?n+=" WHERE ls.status = 'scheduled'":r==="ended"?n+=" WHERE ls.status = 'ended'":n+=" WHERE ls.status IN ('live', 'scheduled')",n+=` ORDER BY 
      CASE ls.status 
        WHEN 'live' THEN 1 
        WHEN 'scheduled' THEN 2 
        ELSE 3 
      END,
      ls.created_at DESC`;const i=await s.prepare(n).all();return await t.put(a,JSON.stringify(i.results),{expirationTtl:600}),e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:id",async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=await s.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(t).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/live-streams",async e=>{const{DB:s}=e.env,{status:t,seller_id:r,limit:a="20",offset:o="0"}=e.req.query();try{const n=`live_streams:${t||"all"}:${r||"all"}:${a}:${o}`,i=60,c=we(n);if(c)return console.log("[LiveStreams] ⚡ 메모리 캐시 히트:",n),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStreams] 🔄 백그라운드 갱신 시작:",n);const u=await Hs(s,t,r,a,o);Z(n,u,i),console.log("[LiveStreams] ✅ 백그라운드 갱신 완료:",n)}catch(u){console.error("[LiveStreams] ❌ 백그라운드 갱신 실패:",u)}})()),e.json({success:!0,data:c});console.log("[LiveStreams] 💾 DB 조회:",n);const l=await Hs(s,t,r,a,o);return Z(n,l,i),e.json({success:!0,data:l})}catch(n){return console.error("[API] Live streams list error:",n),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${n.message}`},500)}});async function Hs(e,s,t,r,a){let o=`
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;const n=[];s&&(o+=" AND ls.status = ?",n.push(s)),t&&(o+=" AND ls.seller_id = ?",n.push(t)),o+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',o+=" LIMIT ? OFFSET ?",n.push(parseInt(r),parseInt(a));const{results:i}=await e.prepare(o).bind(...n).all();return i}p.get("/api/live-streams/:id",async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=`live_stream:${t}`,a=30,o=we(r);if(o)return console.log("[LiveStream] ⚡ 메모리 캐시 히트:",r),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStream] 🔄 백그라운드 갱신 시작:",r);const i=await Ws(s,t);i&&(Z(r,i,a),console.log("[LiveStream] ✅ 백그라운드 갱신 완료:",r))}catch(i){console.error("[LiveStream] ❌ 백그라운드 갱신 실패:",i)}})()),e.json({success:!0,data:o});console.log("[LiveStream] 💾 DB 조회:",r);const n=await Ws(s,t);return n?(Z(r,n,a),e.json({success:!0,data:n})):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});async function Ws(e,s){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first()}p.get("/api/products",Ns(Cs.products),async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),o=parseInt(e.req.query("offset")||"0"),n=`products:list:${r||"all"}:${a}:${o}`,i=we(n);if(i)return e.executionCtx.waitUntil((async()=>{try{const l=await Bs(s,r,a,o);Z(n,l,3600),await Ze(t,n,l,300,!1)}catch(l){console.error("[Cache Revalidate] Products error:",l)}})()),e.json({success:!0,data:i,cached:!0});const c=await Bs(s,r,a,o);return Z(n,c,3600),await Ze(t,n,c,300,!1),e.json({success:!0,data:c,cached:!1})}catch(r){return console.error("Products list error:",r),e.json({success:!1,error:r.message},500)}});async function Bs(e,s,t,r){let a;return s==="true"?a=`
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
    `,(await e.prepare(a).bind(t,r).all()).results||[]}p.get("/api/products/popular",async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r="products:popular",a=we(r);if(a)return e.executionCtx.waitUntil((async()=>{try{const n=await Ks(s);Z(r,n,3600),await Ze(t,r,n,600,!1)}catch(n){console.error("[Cache Revalidate] Popular products error:",n)}})()),e.json({success:!0,data:a,cached:!0});const o=await Ks(s);return Z(r,o,3600),await Ze(t,r,o,600,!1),e.json({success:!0,data:o,cached:!1})}catch(r){return console.error("Popular products error:",r),e.json({success:!1,error:r.message},500)}});async function Ks(e){return(await e.prepare(`
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
    `).bind(r).all(),o=await s.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(r,r).all(),n=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(o.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:n}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/products/search",async e=>{const{DB:s}=e.env;try{const t=e.req.query("q")||"",r=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!t.trim())return e.json({success:!1,error:"Search query is required"},400);const o=t.trim(),n=`${o}*`;try{if(await s.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='products_fts'
      `).first()){console.log("[Search] ⚡ FTS5 검색 사용:",n);const c=await s.prepare(`
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
        `).bind(n,r,a).all(),l=await s.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(n).first();return e.json({success:!0,data:{products:c.results||[],total:(l==null?void 0:l.total)||0,query:t,limit:r,offset:a,searchMethod:"fts5"}})}else throw console.log("[Search] ⚠️ FTS5 미사용 - LIKE 검색 fallback"),new Error("FTS5 not available")}catch(i){console.log("[Search] 💾 LIKE 검색 fallback:",i.message);const c=`%${o}%`,l=await s.prepare(`
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
      `).bind(c,c,c,c,c,r,a).all(),u=await s.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(c,c,c,c,c).first();return e.json({success:!0,data:{products:l.results||[],total:(u==null?void 0:u.total)||0,query:t,limit:r,offset:a,searchMethod:"like"}})}}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/products/:id",async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=`product:detail:${t}`,a=we(r);if(a)return e.executionCtx.waitUntil((async()=>{try{const n=await Vs(s,t);Z(r,n,1800)}catch(n){console.error("[Cache Revalidate] Product detail error:",n)}})()),e.json({success:!0,data:a,cached:!0});const o=await Vs(s,t);return o?(Z(r,o,1800),e.json({success:!0,data:o,cached:!1})):e.json({success:!1,error:"Product not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});async function Vs(e,s){const t=await e.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, '리스터코퍼레이션') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(s).first();if(!t)return null;const r=await e.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(s).all();return{product:t,options:r.results}}p.get("/api/products/:id/stock",Ns(Cs.microCache),async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=await s.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(t).first();return r?e.json({success:!0,data:{productId:r.id,productName:r.name,stock:r.stock,available:r.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/products",async e=>{const{DB:s}=e.env,t=e.req.param("streamId");try{const r=await s.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/cart",j,async e=>{const{DB:s}=e.env,t=e.get("userId");try{const r=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:`장바구니 조회 실패: ${r.message}`},500)}});p.get("/api/cart/:userId",j,async e=>{const{DB:s}=e.env,t=e.get("userId"),r=e.req.param("userId");try{let a=await s.prepare("SELECT id FROM users WHERE id = ?").bind(t).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const o=a.id;if(r!==String(o))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const n=await s.prepare(`
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
    `).bind(o).all();return e.json({success:!0,data:n.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/users",async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),{kakaoId:r,name:a,email:o,phone:n}=t;if(!r||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(r).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await s.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(r,a,o||null,n||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(t){return console.error("Error creating user:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/cart",S(),j,async e=>{const{DB:s}=e.env;try{const t=e.get("userId");if(!t)return e.json({success:!1,error:"Authentication required"},401);const r=await e.req.json(),{productId:a,optionId:o,quantity:n,priceSnapshot:i,liveStreamId:c}=r,l=t,u=await s.prepare("SELECT stock FROM products WHERE id = ?").bind(a).first();if(!u||u.stock<n)return e.json({success:!1,error:"Insufficient stock"},400);const d=await s.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(l,a,o||null,o||null).first();let m;if(d){const _=d.quantity+n;await s.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(_,i,d.id).run(),m=d.id}else m=(await s.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(l,a,o||null,n,i,c||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:m,isUpdate:!!d}})}catch(t){return console.error("[API /api/cart POST] Error:",t),console.error("[API /api/cart POST] Error message:",t.message),console.error("[API /api/cart POST] Error stack:",t.stack),e.json({success:!1,error:"Failed to add to cart: "+(t.message||"Unknown error")},500)}});p.delete("/api/cart/:cartItemId",j,async e=>{const{DB:s}=e.env,t=e.req.param("cartItemId");try{return await s.prepare("DELETE FROM cart_items WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/cart/clear/:userId",j,ja("cart"),async e=>{const{DB:s}=e.env,t=e.req.param("userId");try{return await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(t).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/cart/:cartItemId",j,async e=>{const{DB:s}=e.env,t=e.req.param("cartItemId");try{const r=await e.req.json(),{quantity:a}=r;if(!a||a<1)return e.json({success:!1,error:"Invalid quantity"},400);const o=await s.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(t).first();return o?o.stock<a?e.json({success:!1,error:"Insufficient stock"},400):(await s.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,t).run(),e.json({success:!0})):e.json({success:!1,error:"Cart item not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/orders",j,async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),{userId:r,cartItemIds:a,shippingInfo:o,items:n,shippingAddress:i,shippingAddressDetail:c,recipientName:l,recipientPhone:u,deliveryMemo:d,totalAmount:m,shippingFee:_,orderNumber:f,paymentKey:g,paymentMethod:b}=t;if(n&&n.length>0){const O=n.map(M=>M.productId),x=O.map(()=>"?").join(","),U=await s.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${x})
      `).bind(...O).all(),L=new Map(U.results.map(M=>[M.id,M])),F=[],G=[];try{for(const M of n){const re=L.get(M.productId);if(!re)throw new Error(`상품을 찾을 수 없습니다 (ID: ${M.productId})`);if(re.stock-(re.reserved_stock||0)<M.quantity)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${re.name})`);if((await s.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind(M.quantity,M.productId,M.quantity).run()).meta.changes===0)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${re.name})`);console.log(`[Stock] ✅ 재고 예약 성공: ${re.name} (${M.quantity}개)`),G.push({product_id:M.productId,quantity:M.quantity}),F.push({product_id:M.productId,option_id:M.optionId||null,quantity:M.quantity,price:M.price,product_name:re.name,product_stock:re.stock})}}catch(M){if(console.error("[Stock] ❌ 재고 예약 실패:",M.message),G.length>0){console.log(`[Stock] 🔄 ${G.length}개 상품 예약 롤백 시작...`);for(const re of G)await s.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(re.quantity,re.product_id).run();console.log("[Stock] ✅ 예약 롤백 완료")}return e.json({success:!1,error:M.message},400)}const Y=new Date,v=Y.getFullYear().toString().slice(-2),ee=(Y.getMonth()+1).toString().padStart(2,"0"),H=Y.getDate().toString().padStart(2,"0"),q=`${v}${ee}${H}`,J=Math.random().toString(36).substring(2,7).toUpperCase(),ce=f||`ORD-${q}-${J}`,cs=c?`${i} ${c}`:i,Ye=new Date(Date.now()+600*1e3).toISOString(),Ls=(await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(ce,r||null,m||0,"pending","pending",cs||null,l||null,u||null,d||null,g||null,Ye).run()).meta.last_row_id;for(const M of F)await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ls,M.product_id,M.option_id,M.quantity,M.price,M.product_name).run();return console.log(`[Order] ✅ 주문 생성 완료: ${ce} (예약 만료: ${Ye})`),e.json({success:!0,data:{orderId:Ls,orderNumber:ce,totalAmount:m}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const w=a.map(()=>"?").join(","),h=await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${w})
    `).bind(...a).all();if(h.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const O of h.results)if(O.product_stock<O.quantity)return e.json({success:!1,error:`Insufficient stock for ${O.product_name}`},400);const T=h.results.reduce((O,x)=>O+x.price_snapshot*x.quantity,0),y=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,$=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(y,r,T,o.address,o.name,o.phone).run()).meta.last_row_id,A=[];for(const O of h.results){let x=!1,U="";for(let L=0;L<3;L++){const F=await s.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(O.product_id).first();if(!F){U=`상품을 찾을 수 없습니다: ${O.product_name}`;break}const G=F.stock,Y=F.version;if(G<O.quantity){U=`재고 부족: ${O.product_name} (남은 재고: ${G}개)`;break}if((await s.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND version = ?
            AND stock >= ?
            AND is_active = 1
        `).bind(O.quantity,O.product_id,Y,O.quantity).run()).meta.changes>0){x=!0,console.log(`[재고] ✅ 재고 차감 성공: ${O.product_name} (수량: ${O.quantity}, 버전: ${Y} → ${Y+1})`);break}console.warn(`[재고] ⚠️ 버전 충돌 감지 (시도 ${L+1}/3): ${O.product_name}`),L<2?await new Promise(ee=>setTimeout(ee,50*(L+1))):U="주문 처리 중 오류 발생. 잠시 후 다시 시도해주세요. (동시 주문 처리 중)"}if(!x)return e.json({success:!1,error:U||"주문 처리 중 오류가 발생했습니다."},U.includes("재고 부족")?400:409);A.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind($,O.product_id,O.option_id,O.quantity,O.price_snapshot,O.product_name))}A.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${w})`).bind(...a)),await s.batch(A);try{const O=h.results.map(L=>L.product_id),x=O.map(()=>"?").join(","),U=await s.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${x}) AND seller_id IS NOT NULL
      `).bind(...O).all();for(const L of U.results){const F=L.seller_id;await Ma(s,F,y,buyerName||shippingName||"고객",T)}}catch(O){console.error("[Order] Notification error:",O)}return e.json({success:!0,data:{orderId:$,orderNumber:y,totalAmount:T}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/streams/:streamId/current-product",async e=>{const{DB:s,LIVE_CACHE:t}=e.env,r=e.req.param("streamId");try{const a=`current-product:${r}`,o=await bt(t,a,3);if(o)return e.json({success:!0,data:o});const n=await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();if(!n||!n.current_product_id)return await _s(t,a,null,3),e.json({success:!0,data:null});const i=await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(n.current_product_id).first(),c=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(n.current_product_id).all(),l={product:i,options:c.results};return await _s(t,a,l,3),e.json({success:!0,data:l})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:s}=e.env,t=e.req.param("streamId"),r=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${t}`,o=`current-product:${t}`,n=25e3,i=Date.now();for(;Date.now()-i<n;){const c=await s.get(a)||"0";if(c!==r){const l=await bt(s,o,30);return e.json({success:!0,timestamp:c,data:l,changed:!0})}await new Promise(l=>setTimeout(l,1e3))}return e.json({success:!0,timestamp:r,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/dashboard/stats",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=e.req.query("period")||"7d";let o=7;a==="30d"?o=30:a==="90d"&&(o=90);const n=await s.prepare(`
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
    `).bind(r,`-${o} days`).all(),i=await s.prepare(`
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
    `).bind(r,`-${o} days`).first(),c=await s.prepare(`
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
    `).bind(r,`-${o} days`).all();return e.json({success:!0,data:{period:a,daily:n.results||[],summary:i||{},topProducts:c.results||[]}})}catch(r){return console.error("Error loading seller dashboard stats:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/analytics/products",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading product analytics:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/streams",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading seller streams:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/streams",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,youtube_video_id:o,youtube_url:n,thumbnail_url:i,scheduled_at:c,status:l,seller_instagram:u,seller_youtube:d,seller_facebook:m}=await e.req.json();let _=o,f="youtube",g=null,b=null,w=i;if(n&&!_&&(_=It(n),!_))if(_=vt(n),g=Dt(n),b=xa(n),_)f="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!w&&_&&f==="youtube"&&(w=`https://img.youtube.com/vi/${_}/maxresdefault.jpg`),!r||!_)return e.json({success:!1,error:"Title and live stream URL are required"},400);const h=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,_,l||"scheduled",c||null,t.sellerId,u||null,d||null,m||null,f,g,b,w||null).run(),T=await s.prepare(`
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
    `).bind(h.meta.last_row_id).first(),y=await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(t.sellerId).first();try{const{sendLiveStreamCreatedEmail:R}=await Promise.resolve().then(()=>Xa);R({streamId:h.meta.last_row_id,title:r,sellerName:(y==null?void 0:y.display_name)||(y==null?void 0:y.username)||"알 수 없음",platform:f,scheduledAt:c,status:l||"scheduled"}).then($=>{$.success?console.log(`[Email] Live stream notification sent for stream #${$.meta.last_row_id}`):console.error("[Email] Failed to send notification:",$.error)}).catch($=>{console.error("[Email] Exception while sending notification:",$)})}catch(R){console.error("[Email] Failed to send live stream notification:",R)}return await Be(e.env,Ke.LIVE_STREAMS),e.json({success:!0,data:T})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:o,description:n,youtube_video_id:i,youtube_url:c,scheduled_at:l,status:u,seller_instagram:d,seller_youtube:m,seller_facebook:_}=await e.req.json(),f=[],g=[];if(o!==void 0&&(f.push("title = ?"),g.push(o)),n!==void 0&&(f.push("description = ?"),g.push(n)),c!==void 0||i!==void 0){let b=i,w="youtube",h=null;if(c&&(b=It(c),!b))if(b=vt(c),h=Dt(c),b)w="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);b!==void 0&&(f.push("youtube_video_id = ?"),g.push(b),f.push("platform = ?"),g.push(w),w==="tiktok"&&h&&(f.push("tiktok_username = ?"),g.push(h)))}return u!==void 0&&(f.push("status = ?"),g.push(u)),l!==void 0&&(f.push("scheduled_at = ?"),g.push(l)),d!==void 0&&(f.push("seller_instagram = ?"),g.push(d)),m!==void 0&&(f.push("seller_youtube = ?"),g.push(m)),_!==void 0&&(f.push("seller_facebook = ?"),g.push(_)),f.length===0?e.json({success:!1,error:"No fields to update"},400):(f.push("updated_at = datetime('now')"),await s.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...g,r).run(),await Be(e.env,Ke.LIVE_STREAMS),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first()?(await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),await Be(e.env,Ke.LIVE_STREAMS),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/youtube/create-live",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,scheduled_at:o}=await e.req.json();if(!r)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await Fa({accessToken:n},r,a||""),l=(await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,i.broadcastId,o||null,t.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await is(s,t.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${r} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${l}`),e.json({success:!0,data:{streamId:l,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(r){return console.error("[YouTube Live] Create broadcast error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const n=a.youtube_broadcast_id||a.youtube_video_id;return n?(await Ua({accessToken:o},n),await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await is(s,t.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(r){return console.error("[YouTube Live] End broadcast error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=a.youtube_video_id;if(!o)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const n=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!n&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await Pa({apiKey:n,accessToken:i},o);return e.json({success:!0,data:{streamId:r,videoId:o,stats:c}})}catch(r){return console.error("[YouTube Live] Get stats error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=e.req.query("pageToken"),o=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!o)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=o.youtube_live_chat_id;if(!n)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await qa({accessToken:i},n,a);return e.json({success:!0,data:c})}catch(r){return console.error("[YouTube Live] Get chat messages error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/streams",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,youtube_video_id:o,platform:n,tiktok_username:i,status:c}=await e.req.json();if(!r)return e.json({success:!1,error:"제목은 필수입니다"},400);const l=n||"youtube";if(l==="youtube"&&!o)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(l==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const u=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r,a||null,o||null,l,i||null,c||"scheduled",t.sellerId||null).run();return await Be(e.env,Ke.LIVE_STREAMS),e.json({success:!0,data:{id:u.meta.last_row_id,title:r,description:a,youtube_video_id:o,platform:l,tiktok_username:i,status:c||"scheduled"}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{title:a,description:o,youtube_video_id:n,platform:i,tiktok_username:c,status:l}=await e.req.json();return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,o,n||null,i||"youtube",c||null,l,r).run(),await Be(e.env,Ke.LIVE_STREAMS),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const n=await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a,t.sellerId).first();if(!n)return e.json({success:!1,error:"Product not found or not active"},404);const i=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(a).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,r).run();const{LIVE_CACHE:c}=e.env,l=`product-timestamp:${r}`,u=`current-product:${r}`,d=Date.now().toString();await c.put(l,d),await _s(c,u,{product:n,options:i.results},30);try{await ns(e.env).changeCurrentProduct(parseInt(r),a),console.log(`🔥 Firebase: Product changed for stream ${r} to ${a}`)}catch(m){console.error("⚠️ Firebase sync failed (non-blocking):",m)}return e.json({success:!0,data:{product:n,options:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),await Be(e.env,Ke.LIVE_STREAMS),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,t=e.req.param("streamId");try{const{productId:r}=await e.req.json(),a=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const o=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r,t).run();const{LIVE_CACHE:n}=e.env,i=`product-timestamp:${t}`,c=`current-product:${t}`,l=Date.now().toString();return await n.put(i,l),await _s(n,c,{product:a,options:o.results},30),e.json({success:!0,data:{product:a,options:o.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/wishlists",S(),async e=>{const{DB:s}=e.env;try{const{userId:t,productId:r}=await e.req.json();if(!t||!r)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await s.prepare("SELECT id FROM users WHERE id = ?").bind(t).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const o=await s.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!o)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,r).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await s.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(t,r).run();return e.json({success:!0,data:{id:i.meta.last_row_id,userId:t,productId:r,productName:o.name}})}catch(t){return console.error("[Wishlist] Add error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/wishlists/:id",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),{userId:r}=e.req.query();return r?await s.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(t,r).first()?(await s.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(t,r).run(),e.json({success:!0,message:"찜 목록에서 삭제되었습니다."})):e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(t){return console.error("[Wishlist] Delete error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/wishlists/product/:productId",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("productId"),{userId:r}=e.req.query();return r?(await s.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,t).run()).meta.changes===0?e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!0,message:"찜 목록에서 삭제되었습니다."}):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(t){return console.error("[Wishlist] Delete by product error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/wishlists/:userId",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("userId"),r=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0"),{results:o}=await s.prepare(`
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
    `).bind(t,r,a).all(),n=await s.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(t).first();return e.json({success:!0,data:{items:o,total:(n==null?void 0:n.count)||0,limit:r,offset:a}})}catch(t){return console.error("[Wishlist] Get error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/wishlists/check/:userId/:productId",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("userId"),r=e.req.param("productId"),a=await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,r).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(t){return console.error("[Wishlist] Check error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/shipping-addresses/:id",j,async e=>{const{DB:s}=e.env,t=e.req.param("id");e.get("userId");try{return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t,userId).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products",async e=>{const{DB:s,CACHE_KV:t}=e.env,r=await N(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:products`,o=await t.get(a,"json");if(o)return e.json({success:!0,data:o,cached:!0});const n=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(r.sellerId).all();return await t.put(a,JSON.stringify(n.results),{expirationTtl:300}),e.json({success:!0,data:n.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/seller/upload-image",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{image:r,filename:a}=await e.req.json();if(!r)return e.json({success:!1,error:"Image data is required"},400);const o=r.match(/^data:(image\/[\w+]+);base64,/);if(!o)return e.json({success:!1,error:"잘못된 이미지 형식입니다."},400);const n=o[1],i=r.replace(/^data:image\/\w+;base64,/,"");let c;try{c=Uint8Array.from(atob(i),m=>m.charCodeAt(0))}catch{return e.json({success:!1,error:"이미지 디코딩 실패"},400)}const l=10*1024*1024;if(c.length>l)return e.json({success:!1,error:`파일 크기가 너무 큽니다. 최대 ${l/1024/1024}MB까지 허용됩니다.`},400);const u=await yr(c.buffer);if(!u.valid)return e.json({success:!1,error:"유효하지 않은 이미지 파일입니다."},400);const d=e.env.IMAGES;if(d){console.log("[Image Upload] Using R2 storage");const m=gr(a||"upload.jpg"),_=`products/${t.sellerId}/${m}`;await d.put(_,c,{httpMetadata:{contentType:u.detectedType||n}});const f=`/api/images/${_}`;return e.json({success:!0,url:f,variants:{thumbnail:`${f}?width=200&format=webp`,medium:`${f}?width=800&format=webp`,large:`${f}?width=1600&format=webp`,original:f},storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),r.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:r,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(r){return console.error("[Image Upload] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/images/*",async e=>{var s;try{const t=e.env.IMAGES;if(!t)return e.json({success:!1,error:"R2 not configured"},503);const r=e.req.path.replace("/api/images/",""),a=e.req.query("width"),o=e.req.query("format"),n=e.req.query("quality")||"85",i=await t.get(r);if(!i)return e.notFound();const c={"Content-Type":((s=i.httpMetadata)==null?void 0:s.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"};if(a||o){const l=[];a&&l.push(`width=${a}`),o&&l.push(`format=${o}`),n&&l.push(`quality=${n}`),c["cf-resize"]=l.join(",")}return new Response(i.body,{headers:c})}catch(t){return console.error("[Image Get] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/products",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{name:r,description:a,price:o,original_price:n,discount_rate:i,image_url:c,stock:l,category:u,live_stream_id:d,is_active:m}=await e.req.json();if(!r||!o)return e.json({success:!1,error:"Name and price are required"},400);if(d&&!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d,t.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const _=await s.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,o,n||null,i||0,c||null,l||0,u||null,d||null,t.sellerId,m!==void 0?m:1).run(),f=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(_.meta.last_row_id).first();return await js(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0,data:f})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(r,t.sellerId).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:o,description:n,price:i,original_price:c,image_url:l,stock:u,category:d,is_active:m,live_stream_id:_}=await e.req.json(),f=[],g=[];if(o!==void 0&&(f.push("name = ?"),g.push(o)),n!==void 0&&(f.push("description = ?"),g.push(n)),i!==void 0&&(f.push("price = ?"),g.push(i)),c!==void 0&&(f.push("original_price = ?"),g.push(c),i!==void 0&&c)){const w=Math.round((c-i)/c*100);f.push("discount_rate = ?"),g.push(w)}if(l!==void 0&&(f.push("image_url = ?"),g.push(l)),u!==void 0&&(f.push("stock = ?"),g.push(u)),d!==void 0&&(f.push("category = ?"),g.push(d)),m!==void 0&&(f.push("is_active = ?"),g.push(m?1:0)),_!==void 0&&(f.push("live_stream_id = ?"),g.push(_||null)),f.push("updated_at = CURRENT_TIMESTAMP"),g.push(r,t.sellerId),f.length===1)return e.json({success:!1,error:"No fields to update"},400);await s.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...g).run();const b=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(r).first();return await js(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0,data:b})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const o=await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();return o&&o.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(),await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(),await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(),await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).run(),await js(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const o=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();return e.json({success:!0,data:o.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:o,option_value:n,price_adjustment:i,stock:c}=await e.req.json();if(!o||!n)return e.json({success:!1,error:"Option type and value are required"},400);const l=await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r,o,n,i||0,c||0).run();return e.json({success:!0,data:{id:l.meta.last_row_id,product_id:r,option_type:o,option_value:n,price_adjustment:i||0,stock:c||0}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("productId"),a=e.req.param("optionId");return await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first()?(await s.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,r).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/stats",async e=>{const{DB:s,CACHE_KV:t}=e.env,r=await N(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:stats`,o=await t.get(a,"json");if(o)return e.json({success:!0,data:o,cached:!0});const n=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(),i=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(),c=await s.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(),l=await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(r.sellerId).first(),u=await s.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(),d=await s.prepare(`
      SELECT SUM(viewer_count) as total
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(),m=(d==null?void 0:d.total)||0,_={totalProducts:n.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:l.count||0,totalRevenue:l.total||0,activeStreams:u.count||0,totalViewers:m};return await t.put(a,JSON.stringify(_),{expirationTtl:60}),e.json({success:!0,data:_})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/stats/sales",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("period")||"daily";let a,o,n;switch(r){case"weekly":a="%Y-W%W",o="week",n=28;break;case"monthly":a="%Y-%m",o="month",n=180;break;default:a="%Y-%m-%d",o="day",n=30}const i=await s.prepare(`
      SELECT 
        strftime('${a}', o.created_at) as period,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.price * oi.quantity) as total_sales,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
        AND o.created_at >= datetime('now', '-${n} days')
        AND o.status != 'cancelled'
      GROUP BY period
      ORDER BY period ASC
    `).bind(t.sellerId).all();return e.json({success:!0,data:{period:r,sales:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/stats/products",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),o=await s.prepare(`
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
    `).bind(t.sellerId,r).all();return e.json({success:!0,data:{products:o.results,period_days:a}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/business-info",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{business_number:r,business_name:a,ceo_name:o,business_type:n,business_category:i,postal_code:c,address:l,phone:u,email:d}=await e.req.json();if(!r||!a||!o)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const m=await s.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();let _;return m?_=await s.prepare(`
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
      `).bind(r,a,o,n,i,c,l,u,d,t.sellerId).run():_=await s.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(t.sellerId,r,a,o,n,i,c,l,u,d).run(),e.json({success:!0,data:{id:m?m.id:_.meta.last_row_id,seller_id:t.sellerId,business_number:r,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(r){return console.error("사업자 정보 등록 오류:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/business-info",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);const r=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(o){return e.json({success:!1,error:o.message},500)}});p.get("/api/admin/seller-business",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/orders",j,async e=>{const{DB:s}=e.env,t=e.get("userId");try{const r=await s.prepare(`
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
    `).bind(t).all(),a=new Map;for(const n of r.results){const i=n.id;a.has(i)||a.set(i,{id:n.id,user_id:n.user_id,order_number:n.order_number,status:n.status,total_amount:n.total_amount,shipping_fee:n.shipping_fee,payment_method:n.payment_method,payment_key:n.payment_key,shipping_address:n.shipping_address,shipping_name:n.shipping_name,shipping_phone:n.shipping_phone,delivery_request:n.delivery_request,created_at:n.created_at,updated_at:n.updated_at,items:[]}),n.item_id&&a.get(i).items.push({id:n.item_id,product_id:n.product_id,option_id:n.option_id,quantity:n.quantity,price:n.item_price,product_name:n.product_name,image_url:n.image_url,option_value:n.option_value})}const o=Array.from(a.values());return e.json({success:!0,data:o})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/orders/user/:userId",j,async e=>{const{DB:s}=e.env,t=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==t)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await s.prepare(`
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
    `).bind(t).all(),o=new Map;for(const i of a.results){const c=i.id;o.has(c)||o.set(c,{id:i.id,user_id:i.user_id,order_number:i.order_number,status:i.status,total_amount:i.total_amount,shipping_fee:i.shipping_fee,payment_method:i.payment_method,payment_key:i.payment_key,shipping_address:i.shipping_address,shipping_name:i.shipping_name,shipping_phone:i.shipping_phone,delivery_request:i.delivery_request,created_at:i.created_at,updated_at:i.updated_at,items:[]}),i.item_id&&o.get(c).items.push({id:i.item_id,product_id:i.product_id,option_id:i.option_id,quantity:i.quantity,price:i.item_price,product_name:i.product_name,image_url:i.image_url,option_value:i.option_value})}const n=Array.from(o.values());return e.json({success:!0,data:n})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/orders/:orderNumber",j,async e=>{const{DB:s}=e.env,t=e.req.param("orderNumber");try{const r=await s.prepare(`
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
    `).bind(t).all();if(r.results.length===0)return e.json({success:!1,error:"Order not found"},404);const a=r.results[0],o={id:a.id,user_id:a.user_id,order_number:a.order_number,status:a.status,total_amount:a.total_amount,shipping_fee:a.shipping_fee,payment_method:a.payment_method,payment_key:a.payment_key,shipping_address:a.shipping_address,shipping_name:a.shipping_name,shipping_phone:a.shipping_phone,delivery_request:a.delivery_request,created_at:a.created_at,updated_at:a.updated_at,items:[]};for(const n of r.results)n.item_id&&o.items.push({id:n.item_id,product_id:n.product_id,option_id:n.option_id,quantity:n.quantity,price:n.item_price,product_name:n.product_name,image_url:n.image_url,option_value:n.option_value});return e.json({success:!0,data:o})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/orders/:orderId/cancel",j,async e=>{const{DB:s}=e.env,t=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",o=await s.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(t).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(o.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const n=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(t).all();if(n.results.length>0){const i=n.results.map(c=>s.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity,c.product_id));await s.batch(i)}return await s.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,t).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:t,reason:a,itemsRestored:n.results.length}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:s}=e.env;try{const t=e.req.param("streamId"),r=await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(t).first();return r?e.json({success:!0,data:{viewer_count:r.viewer_count||0}}):e.json({success:!1,error:"Stream not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/streams/:streamId/viewer-count",async e=>{const{DB:s}=e.env,t=await P(e),r=t.success?{success:!1}:await N(e);if(!t.success&&!r.success)return e.json({success:!1,error:"Unauthorized"},401);try{const a=e.req.param("streamId"),{viewer_count:o}=await e.req.json();return typeof o!="number"||o<0?e.json({success:!1,error:"Invalid viewer count"},400):r.success&&!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a,r.sellerId).first()?e.json({success:!1,error:"Stream not found or unauthorized"},404):(await s.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(o,a).run(),e.json({success:!0,data:{viewer_count:o}}))}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/streams/:streamId/view",async e=>{const{DB:s}=e.env;try{const t=e.req.param("streamId");await s.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(t).run();const r=await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(t).first();return e.json({success:!0,data:{viewer_count:(r==null?void 0:r.viewer_count)||0}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/payments/confirm",async e=>{var r;const{DB:s}=e.env;let t=null;try{t=await e.req.json();const{paymentKey:a,orderId:o,amount:n}=t;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",o),console.log("  - paymentKey:",a),console.log("  - amount:",n),console.log("  - timestamp:",new Date().toISOString()),!a||!o||!n)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!o),console.error("[Payment] amount:",!!n),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!o,amount:!!n}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await s.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(o).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",o),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:o},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(n)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(n),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(n),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const l="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const u={orderId:o,amount:Number(n),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(u,null,2)),console.log("[Payment] 📊 amount 타입:",typeof u.amount),console.log("[Payment] 📊 amount 값:",u.amount);const d=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:l,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(u)}),m=await d.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",d.status),console.log("  - 응답 OK?:",d.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(m).substring(0,300)),!d.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",d.status),console.error("[Payment] 에러 코드:",m.code),console.error("[Payment] 에러 메시지:",m.message),console.error("[Payment] 전체 응답:",JSON.stringify(m,null,2)),e.json({success:!1,error:m.message||"결제 승인에 실패했습니다.",code:m.code,tossError:m},d.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",o);try{await s.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            reservation_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,o).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const _=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(o).all();if(_.results.length>0){console.log(`[Stock] 🔒 재고 확정 시작: ${_.results.length}개 상품`);const f=_.results.map(w=>s.prepare(`
            UPDATE products 
            SET stock = stock - ?,
                reserved_stock = reserved_stock - ?
            WHERE id = ?
          `).bind(w.quantity,w.quantity,w.product_id)),g=await s.batch(f);let b=0;for(let w=0;w<g.length;w++)if(g[w].meta.changes>0){b++;const h=_.results[w];console.log(`[Stock] ✅ 재고 확정: product_id=${h.product_id}, quantity=${h.quantity}`)}else{const h=_.results[w];console.error(`[Stock] ⚠️ 재고 확정 실패: product_id=${h.product_id}`)}console.log(`[Stock] ✅ 재고 확정 완료: ${b}/${_.results.length}개 성공`);try{const w=_.results.map(y=>y.product_id),h=w.map(()=>"?").join(","),T=await s.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${h})
          `).bind(...w).all();for(const y of T.results){const R=y.stock_alert_threshold||10,$=y.stock||0,A=y.reserved_stock||0,O=$-A;O<=R&&y.seller_id&&(await Rt(s,y.seller_id,y.name,O,R),console.log(`[Low Stock Alert] 📢 ${y.name}: 가용재고 ${O}개 (임계값 ${R}개)`))}}catch(w){console.error("[Low Stock Alert] ⚠️ 알림 전송 실패:",w)}}try{const f=i.id,g=await Qr(e.env,f);g.success?console.log(`[Payment] ✅ 알림톡 발송 성공 (주문 ${f})`):console.warn(`[Payment] ⚠️ 알림톡 발송 실패 (주문 ${f}):`,g.reason||g.error)}catch(f){console.error("[Payment] ⚠️ 알림톡 발송 중 오류:",f)}}catch(_){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",_)}if(e.env.DISCORD_WEBHOOK_URL)try{await Ta(e.env.DISCORD_WEBHOOK_URL,"결제 성공",`주문번호 ${o} 결제 완료`,{주문번호:o,결제금액:`₩${Number(n).toLocaleString()}`,결제키:a.substring(0,20)+"...",사용자ID:i.user_id})}catch(_){console.error("[Discord] 결제 성공 알림 실패:",_)}return e.json({success:!0,data:m})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:t==null?void 0:t.orderId,error:a.message,stack:(r=a.stack)==null?void 0:r.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});p.post("/api/payments/rollback",async e=>{var t;const{DB:s}=e.env;try{const{orderId:r,reason:a}=await e.req.json();if(console.log("========================================"),console.log("[Rollback] 🔄 재고 예약 해제 시작"),console.log("========================================"),console.log("[Rollback] 주문 번호:",r),console.log("[Rollback] 사유:",a||"결제 실패"),!r)return e.json({success:!1,error:"주문 번호가 필요합니다."},400);const o=await s.prepare("SELECT id, order_number, status FROM orders WHERE order_number = ?").bind(r).first();if(!o)return console.warn("[Rollback] ⚠️ 주문을 찾을 수 없음:",r),e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(o.status==="paid")return console.warn("[Rollback] ⚠️ 이미 결제 완료된 주문:",r),e.json({success:!1,error:"이미 결제가 완료된 주문입니다."},400);console.log("[Rollback] ✅ 주문 확인됨:",o.order_number);const n=await s.prepare(`
      SELECT product_id, quantity 
      FROM order_items 
      WHERE order_id = ?
    `).bind(o.id).all();if(n.results.length===0)return console.warn("[Rollback] ⚠️ 주문 아이템 없음"),e.json({success:!1,error:"주문 아이템을 찾을 수 없습니다."},404);console.log(`[Rollback] 📦 ${n.results.length}개 상품 예약 해제 시작...`);const i=n.results.map(u=>s.prepare(`
        UPDATE products 
        SET reserved_stock = CASE 
          WHEN reserved_stock >= ? THEN reserved_stock - ?
          ELSE 0
        END
        WHERE id = ?
      `).bind(u.quantity,u.quantity,u.product_id)),c=await s.batch(i);let l=0;for(let u=0;u<c.length;u++)if(c[u].meta.changes>0){l++;const d=n.results[u];console.log(`[Rollback] ✅ 예약 해제: product_id=${d.product_id}, quantity=${d.quantity}`)}return console.log(`[Rollback] ✅ 예약 해제 완료: ${l}/${n.results.length}개 성공`),await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'failed',
          reservation_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r).run(),console.log("[Rollback] ✅ 주문 취소 완료:",r),e.json({success:!0,message:"재고 예약이 해제되었습니다.",data:{orderId:r,releasedItems:l}})}catch(r){return console.error("[Rollback] ❌ 예약 해제 실패:",{error:r.message,stack:(t=r.stack)==null?void 0:t.substring(0,500)}),e.json({success:!1,error:"재고 예약 해제 중 오류가 발생했습니다.",details:r.message},500)}});p.post("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,userName:o,userAvatar:n,message:i,isSeller:c,isAdmin:l}=r;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await s.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(t,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const u=["씨발","개새끼","병신","좆","시발"];let d=i;u.forEach(_=>{const f=new RegExp(_,"gi");d=d.replace(f,"*".repeat(_.length))});const m=await s.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a||null,o,n||null,d,c?1:0,l?1:0).run();return e.json({success:!0,data:{id:m.meta.last_row_id,message:d}})}catch(r){return console.error("Error sending chat message:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId"),r=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let o=`
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
    `;const n=[t];r&&(o+=" AND id > ?",n.push(Number(r))),o+=" ORDER BY created_at DESC LIMIT ?",n.push(a);const c=(await s.prepare(o).bind(...n).all()).results.reverse();return e.json({success:!0,data:c})}catch(o){return console.error("Error fetching chat messages:",o),e.json({success:!1,error:o.message},500)}});p.delete("/api/chat/:liveStreamId/messages/:messageId",S(),async e=>{const{DB:s}=e.env,t=e.req.param("messageId");try{return await s.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(t).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(r){return console.error("Error deleting chat message:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/chat/:liveStreamId/ban",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,bannedBy:o,reason:n,duration:i}=r;if(!a||!o)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const l=new Date;l.setMinutes(l.getMinutes()+i),c=l.toISOString()}return await s.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(t,a,o,n||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(r){return console.error("Error banning user:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/chat/:liveStreamId/ban/:userId",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId"),r=e.req.param("userId");try{return await s.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(t,r).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});async function Ha(e,s,t){try{const r=new TextEncoder,a=r.encode(t),o=r.encode(e),n=await crypto.subtle.importKey("raw",a,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),i=await crypto.subtle.sign("HMAC",n,o),c=Array.from(new Uint8Array(i)),l=btoa(String.fromCharCode(...c));return s===l}catch(r){return console.error("[Webhook] 서명 검증 오류:",r),!1}}p.post("/api/payments/webhook",async e=>{const{DB:s}=e.env;try{const t=e.req.header("toss-signature"),r=await e.req.text();if(t&&e.env.TOSS_SECRET_KEY){if(!await Ha(r,t,e.env.TOSS_SECRET_KEY))return console.error("[Webhook] ❌ 서명 검증 실패 - 위조된 웹훅 요청"),e.json({success:!1,error:"Invalid signature"},401);console.log("[Webhook] ✅ 서명 검증 성공")}else console.warn("[Webhook] ⚠️ 서명 검증 건너뜀 (개발 환경 또는 서명 없음)");const a=JSON.parse(r);switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:a.eventType,orderId:a.orderId,status:a.status,timestamp:new Date().toISOString()}),a.eventType){case"PAYMENT_STATUS_CHANGED":await Wa(s,a);break;case"VIRTUAL_ACCOUNT_ISSUED":await Ba(s,a);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",a.eventType)}return e.json({success:!0})}catch(t){return console.error("[Webhook] ❌ 웹훅 처리 실패:",t.message),e.json({success:!1,error:t.message},500)}});async function Wa(e,s){const{orderId:t,status:r,paymentKey:a}=s;console.log("[Webhook] 결제 상태 변경:",{orderId:t,status:r}),await e.prepare(`
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
    `).bind(t).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",t))}async function Ba(e,s){const{orderId:t,virtualAccount:r}=s;console.log("[Webhook] 가상계좌 발급:",{orderId:t,bank:r==null?void 0:r.bank,accountNumber:r==null?void 0:r.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(r==null?void 0:r.bank,r==null?void 0:r.accountNumber,r==null?void 0:r.customerName,r==null?void 0:r.dueDate,JSON.stringify(s),t).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",t)}p.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:s}=e.env;try{const t=e.req.param("paymentKey"),r=await e.req.json(),{cancelReason:a,cancelAmount:o}=r;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:t,cancelReason:a,cancelAmount:o}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const n=await s.prepare(`
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
    `).bind(t).first();if(!n)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(n.status==="CANCELED"||n.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=n.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const l=ka(i,c),u=o&&o<n.amount,d=o||n.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:t,cancelAmount:d,isPartial:u});const m=await l.cancelPayment({paymentKey:t,cancelReason:a,cancelAmount:d});return m.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:t,cancelAmount:d,canceledAt:m.canceledAt}),await s.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED",m.canceledAt||new Date().toISOString(),JSON.stringify(m),t).run(),await s.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(n.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${t}`),e.json({success:!0,data:{paymentKey:t,orderId:n.order_id,cancelAmount:d,canceledAt:m.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,m.error),e.json({success:!1,error:m.error||"결제 취소에 실패했습니다."},400))}catch(t){return console.error("[Payment] ❌ 결제 취소 처리 실패:",t.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});p.get("/api/payments/:paymentKey",async e=>{const{DB:s}=e.env;try{const t=e.req.param("paymentKey"),r=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:r.results||[]})}catch(t){return console.error("[Payment] ❌ 결제 목록 조회 실패:",t.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});p.get("/api/seller/orders",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("status"),a=e.req.query("start_date"),o=e.req.query("end_date"),n=e.req.query("min_amount"),i=e.req.query("max_amount"),c=parseInt(e.req.query("page")||"1"),l=parseInt(e.req.query("limit")||"50"),u=(c-1)*l,d=["oi.seller_id = ?"],m=[t.sellerId];r&&(d.push("o.status = ?"),m.push(r)),a&&(d.push("DATE(o.created_at) >= ?"),m.push(a)),o&&(d.push("DATE(o.created_at) <= ?"),m.push(o)),n&&(d.push("o.total_amount >= ?"),m.push(parseInt(n))),i&&(d.push("o.total_amount <= ?"),m.push(parseInt(i)));const _=d.join(" AND "),f=await s.prepare(`
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
    `).bind(...m,l,u).all(),g=await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${_}
    `).bind(...m).first(),b=(g==null?void 0:g.total)||0,w=Math.ceil(b/l),h=new Map;for(const y of f.results){const R=y.id;h.has(R)||h.set(R,{id:y.id,user_id:y.user_id,user_name:y.user_name,order_number:y.order_number,status:y.status,total_amount:y.total_amount,shipping_fee:y.shipping_fee,payment_method:y.payment_method,payment_key:y.payment_key,shipping_address:y.shipping_address,shipping_name:y.shipping_name,shipping_phone:y.shipping_phone,delivery_request:y.delivery_request,created_at:y.created_at,updated_at:y.updated_at,items:[]}),y.item_id&&h.get(R).items.push({id:y.item_id,product_id:y.product_id,option_id:y.option_id,quantity:y.quantity,price:y.item_price,seller_id:y.seller_id,product_name:y.product_name,image_url:y.image_url,option_value:y.option_value})}const T=Array.from(h.values());return e.json({success:!0,data:T,pagination:{page:c,limit:l,total:b,totalPages:w},filters:{status:r||null,startDate:a||null,endDate:o||null,minAmount:n?parseInt(n):null,maxAmount:i?parseInt(i):null}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/orders/export",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("format")||"csv",a=e.req.query("start_date"),o=e.req.query("end_date");let n=`
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
    `;const i=[t.sellerId];a&&(n+=" AND date(o.created_at) >= ?",i.push(a)),o&&(n+=" AND date(o.created_at) <= ?",i.push(o)),n+=" GROUP BY o.id ORDER BY o.created_at DESC";const c=await s.prepare(n).bind(...i).all();if(r==="csv"){const l=["주문번호","주문일시","주문상태","결제상태","주문금액","배송지","수령인","연락처","택배사","운송장번호","구매자명","구매자이메일","구매자연락처"],u=c.results.map(g=>[g.order_number||"",g.created_at?new Date(g.created_at).toLocaleString("ko-KR"):"",g.status||"",g.payment_status||"",g.total_amount||0,g.shipping_address||"",g.shipping_name||"",g.shipping_phone||"",g.carrier||"",g.tracking_number||"",g.buyer_name||"",g.buyer_email||"",g.buyer_phone||""]),m="\uFEFF"+[l.join(","),...u.map(g=>g.map(b=>{const w=String(b);return w.includes(",")||w.includes(`
`)||w.includes('"')?`"${w.replace(/"/g,'""')}"`:w}).join(","))].join(`
`),_=new Date,f=`orders_${_.toISOString().split("T")[0]}_${_.getTime()}.csv`;return new Response(m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${encodeURIComponent(f)}"`,"Cache-Control":"no-cache"}})}else return e.json({success:!1,error:"Unsupported format"},400)}catch(r){return console.error("Export error:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const n=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(n.id,t.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,r).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${r}, 자동 발행 시작...`);const c=await s.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(r).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const l=await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();if(!l)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${t.sellerId}`),await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(r,t.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${r}`);const u=await s.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),d=Number(c.total_amount),m=Math.floor(d/1.1),_=d-m,f=new Date().toISOString().split("T")[0].replace(/-/g,""),g=Math.random().toString(36).substring(2,8).toUpperCase(),b=`${f}-${g}`,h=(await s.prepare(`
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
            `).bind(t.sellerId,r,b,l.business_number,l.business_name,l.ceo_name,l.address||"",l.business_type||"",l.business_category||"",l.email||"",l.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",m,_,d,`AUTO-${Date.now()}-${g}`).run()).meta.last_row_id;if(u.results.length>0){const T=u.results.map(y=>{const R=Math.floor(Number(y.price)*Number(y.quantity)/1.1),$=Number(y.price)*Number(y.quantity)-R;return s.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(h,y.product_name||"상품명 없음",y.quantity,y.price,R,$,y.option_name||"")});await s.batch(T)}await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r,t.sellerId,h).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${h}, invoice_number=${b}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${r}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await s.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(r,t.sellerId,c.message).run()}catch(l){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",l)}}try{const c=await s.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(r).first();if(c&&c.user_id){const u={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];u&&await Tt(s,c.user_id,r,u)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber"),{courier:a,tracking_number:o}=await e.req.json();if(!a||!o)return e.json({success:!1,error:"Courier and tracking number are required"},400);const n=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(n.id,t.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await s.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,o,r).run();try{const c=await s.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(r).first();c&&c.user_id&&await Tt(s,c.user_id,r,"shipping",a,o)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/admin/orders",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/sellers",async e=>{const{DB:s}=e.env,{limit:t="20",offset:r="0"}=e.req.query();try{const a=`sellers:list:${t}:${r}`,o=we(a);if(o)return e.executionCtx.waitUntil((async()=>{try{const i=await Ys(s,parseInt(t),parseInt(r));Z(a,i,3600)}catch(i){console.error("[Cache Revalidate] Sellers error:",i)}})()),e.json({success:!0,data:o,cached:!0});const n=await Ys(s,parseInt(t),parseInt(r));return Z(a,n,3600),e.json({success:!0,data:n,cached:!1})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});async function Ys(e,s,t){const r=`
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
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/sellers",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{username:r,password:a,name:o,email:n,phone:i,business_name:c,business_number:l}=await e.req.json();if(!r||!a||!o||!n||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await s.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await s.prepare("SELECT id FROM sellers WHERE email = ?").bind(n).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const m=`$2a$10$placeholder_hash_for_${a}`,_=await s.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r,m,o,n,i||null,c,l||null,t.adminId).run();return e.json({success:!0,data:{id:_.meta.last_row_id,username:r,name:o,email:n,business_name:c}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{name:a,email:o,phone:n,business_name:i,business_number:c,is_active:l,status:u}=await e.req.json();return await s.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first()?(await s.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,o,n||null,i,c||null,l,u,r).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();return a?(await s.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const o=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const n=`$2a$10$placeholder_hash_for_${a}`;return await s.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,r).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${o.username}'의 비밀번호가 재설정되었습니다`})}catch(r){return e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const o=parseFloat(a);if(isNaN(o)||o<0||o>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const n=await s.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=n.commission_rate||10;return await s.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,r).run(),console.log(`수수료율 변경: 판매자 ${n.username} (ID: ${r}), ${i}% → ${o}%`),e.json({success:!0,message:`판매자 '${n.username}'의 수수료율이 ${i}%에서 ${o}%로 변경되었습니다`,data:{seller_id:r,seller_username:n.username,old_commission_rate:i,new_commission_rate:o}})}catch(r){return console.error("수수료율 변경 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();if(!a)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(a.status==="approved")return e.json({success:!1,error:"이미 승인된 판매자입니다"},400);if(await s.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(t.adminId,r).run(),console.log(`셀러 승인: ${a.username} (ID: ${r}) by Admin ID: ${t.adminId}`),a.email)try{const{sendEmail:o,getSellerApprovalEmailHTML:n}=await Promise.resolve().then(()=>Ct),i=e.env.RESEND_API_KEY||"",c=n(a.name,a.username),l=await o({to:a.email,subject:"🎉 리스터코퍼레이션 판매자 승인 완료",html:c},i,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");l.success?console.log(`[셀러 승인] 이메일 발송 성공: ${a.email}`):console.warn(`[셀러 승인] 이메일 발송 실패: ${l.error}`)}catch(o){console.error("[셀러 승인] 이메일 발송 오류:",o)}try{const{createNotification:o,NotificationTemplates:n}=await Promise.resolve().then(()=>jt),i=n.seller_approved(a.name);await o(s,{userId:parseInt(r),type:"seller_approved",title:i.title,message:i.message,linkUrl:i.linkUrl})}catch(o){console.error("[셀러 승인] 알림 생성 오류:",o)}return e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:r,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})}catch(r){return console.error("셀러 승인 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const o=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(o.status==="rejected")return e.json({success:!1,error:"이미 거부된 판매자입니다"},400);if(await s.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,t.adminId,r).run(),console.log(`셀러 거부: ${o.username} (ID: ${r}), 사유: ${a}`),o.email)try{const{sendEmail:n,getSellerRejectionEmailHTML:i}=await Promise.resolve().then(()=>Ct),c=e.env.RESEND_API_KEY||"",l=i(o.name,a),u=await n({to:o.email,subject:"리스터코퍼레이션 판매자 승인 결과 안내",html:l},c,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");u.success?console.log(`[셀러 거부] 이메일 발송 성공: ${o.email}`):console.warn(`[셀러 거부] 이메일 발송 실패: ${u.error}`)}catch(n){console.error("[셀러 거부] 이메일 발송 오류:",n)}try{const{createNotification:n,NotificationTemplates:i}=await Promise.resolve().then(()=>jt),c=i.seller_rejected(a);await n(s,{userId:parseInt(r),type:"seller_rejected",title:c.title,message:c.message,linkUrl:c.linkUrl})}catch(n){console.error("[셀러 거부] 알림 생성 오류:",n)}return e.json({success:!0,message:`판매자 '${o.name}'님의 승인이 거부되었습니다`,data:{seller_id:r,seller_username:o.username,seller_name:o.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})}catch(r){return console.error("셀러 거부 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/sellers/pending",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:r.results,count:r.results.length})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/admin/dashboard/stats",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=new Date;r.setHours(0,0,0,0);const a=r.toISOString(),o=await s.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as sales
      FROM orders
      WHERE payment_status = 'approved'
      AND status = 'paid'
      AND created_at >= ?
    `).bind(a).first(),n=(o==null?void 0:o.sales)||0,i=await s.prepare(`
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
    `).first(),_=(m==null?void 0:m.count)||0;return e.json({success:!0,stats:{todaySales:n,todayOrders:c,currentVisitors:d,liveStreams:_},timestamp:new Date().toISOString()})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/public/seller/:sellerId",async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.param("sellerId"),a=`public:seller:${r}`,o=await La(t,a);if(o)return e.json({success:!0,data:o,cached:!0});const n=await s.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=await s.prepare(`
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
    `).bind(r).all(),l=await s.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(r).all(),u=await s.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(r).first(),d={profile:n,live_streams:i.results,scheduled_streams:c.results,products:l.results,stats:u};return await Ze(t,a,d,60,!1),e.json({success:!0,data:d})}catch(r){return console.error("셀러 프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/public/seller/username/:username",async e=>{const{DB:s}=e.env;try{const t=e.req.param("username"),r=await s.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(t).first();return r?e.json({success:!0,data:{seller_id:r.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/settlement/stats",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{period:r}=e.req.query();let a="";const o=new Date;switch(r){case"today":a=`AND DATE(o.created_at) = '${o.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(o.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(o.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const n=await s.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:n,sellers:i.results,period:r||"all"}})}catch(r){return console.error("정산 통계 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/records",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{seller_id:r,period:a,status:o}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const i=[];r&&(n.push("o.seller_id = ?"),i.push(r)),o&&(n.push("o.settlement_status = ?"),i.push(o));const c=new Date;switch(a){case"today":const d=c.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${d}'`);break;case"week":const m=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${m}'`);break;case"month":const _=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${_}'`);break}const l=n.length>0?`WHERE ${n.join(" AND ")}`:"",u=await s.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:u.results})}catch(r){return console.error("정산 내역 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const o=await s.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(r).first();return o?(await s.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,r).run(),console.log(`정산 상태 변경: 주문 ${o.order_number}, ${o.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:r,order_number:o.order_number,old_status:o.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(r){return console.error("정산 상태 변경 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/settlement/batch-complete",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{order_ids:r}=await e.req.json();if(!Array.isArray(r)||r.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,o=0;for(const n of r)try{await s.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(n).run(),a++}catch(i){o++,console.error(`주문 ${n} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${o}건 실패`,data:{total:r.length,success:a,failed:o}})}catch(r){return console.error("일괄 정산 처리 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/export-csv",async e=>{const{DB:s}=e.env,t=await P(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{seller_id:r,period:a}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const n=[];r&&(o.push("o.seller_id = ?"),n.push(r));const i=new Date;switch(a){case"today":const f=i.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${f}'`);break;case"week":const g=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${g}'`);break;case"month":const b=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${b}'`);break}const c=o.length>0?`WHERE ${o.join(" AND ")}`:"",u=(await s.prepare(`
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
    `).bind(...n).all()).results;if(u.length===0)return e.json({success:!1,error:"데이터가 없습니다"},404);const d=Object.keys(u[0]);let m=d.join(",")+`
`;u.forEach(f=>{const g=d.map(b=>{const w=f[b];if(w==null)return"";const h=String(w);return h.includes(",")||h.includes('"')||h.includes(`
`)?`"${h.replace(/"/g,'""')}"`:h});m+=g.join(",")+`
`});const _="\uFEFF";return new Response(_+m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(r){return console.error("CSV 내보내기 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/orders/create",j,async e=>{const{DB:s}=e.env;try{const{userId:t,cartItems:r,totalAmount:a,shippingAddressId:o,sellerId:n,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:l,buyerCeoName:u}=await e.req.json();console.log("[DEPRECATED /api/orders/create] 주문 생성 요청:",{userId:t,cartItems:r==null?void 0:r.length,totalAmount:a,shippingAddressId:o,sellerId:n,issueTaxInvoice:i});let d=10;if(n){const v=await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(n).first();v&&v.commission_rate!==null&&(d=v.commission_rate)}console.log("수수료율:",{sellerId:n,commissionRate:d});const m=Math.floor(a*(d/100)),_=a-m;let f=null;if(o){const v=await s.prepare(`
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
      `).bind(o,t).first();if(!v)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);f=v}if(!t)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const g=t,b=new Date,w=b.getFullYear().toString().slice(-2),h=(b.getMonth()+1).toString().padStart(2,"0"),T=b.getDate().toString().padStart(2,"0"),y=`${w}${h}${T}`,R=Math.random().toString(36).substring(2,7).toUpperCase(),$=`ORD-${y}-${R}`,A=r.map(v=>v.product_id),O=A.map(()=>"?").join(","),x=await s.prepare(`
      SELECT id, stock FROM products WHERE id IN (${O})
    `).bind(...A).all(),U=new Map(x.results.map(v=>[v.id,v.stock]));for(const v of r){const ee=U.get(v.product_id);if(ee===void 0)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${v.product_id})`},400);if(ee<v.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${v.product_id})`},400)}const F=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind($,g,a,"pending",n||null,d,m,_,o||null,(f==null?void 0:f.recipient_name)||null,(f==null?void 0:f.phone)||null,f!=null&&f.address?`${f.address} ${f.address_detail}`:null,(f==null?void 0:f.postal_code)||null,i?1:0,c||null,l||null,u||null).run()).meta.last_row_id,G=r.map(v=>s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(F,v.product_id,v.option_id||null,v.quantity,v.price_snapshot||v.price)),Y=r.map(v=>s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(v.quantity,v.product_id));await s.batch([...G,...Y]);try{const v=ns(e.env),ee=r.map(J=>J.product_id),H=ee.map(()=>"?").join(","),q=await s.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${H})
      `).bind(...ee).all();await Promise.all(q.results.map(J=>v.updateProductStock(J.id,J.stock,{name:J.name,price:J.price,original_price:J.original_price,discount_rate:J.discount_rate,image_url:J.image_url}))),console.log(`🔥 Firebase: Stock updated for ${q.results.length} products`)}catch(v){console.error("⚠️ Firebase stock sync failed (non-blocking):",v)}try{const v=r.map(q=>q.product_id),ee=v.map(()=>"?").join(","),H=await s.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${ee})
      `).bind(...v).all();for(const q of H.results){const J=q.stock_alert_threshold||5,ce=q.stock;ce<=J&&q.seller_id&&(await Rt(s,q.seller_id,q.name,ce,J),console.log(`[Low Stock Alert] ${q.name}: ${ce} <= ${J}`))}}catch(v){console.error("[Low Stock Alert] Error:",v)}return console.log("주문 생성 완료:",{orderId:F,orderNumber:$}),e.json({success:!0,orderId:F,orderNumber:$,totalAmount:a})}catch(t){return console.error("주문 생성 실패:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/orders/:orderNumber/refund",S(),j,async e=>{const{DB:s}=e.env;try{const t=e.req.param("orderNumber"),{reason:r}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:t,reason:r});const a=await s.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(t).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다"},404);if(a.payment_status==="cancelled")return e.json({success:!1,error:"이미 취소된 주문입니다"},400);await s.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(r||"구매자 요청",t).run(),console.log("[Order Refund] 주문 상태 업데이트 완료:",t);const o=await s.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();if(o.results.length>0){const n=o.results.map(i=>s.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(i.quantity,i.product_id));await s.batch(n),console.log("[Order Refund] 재고 복구 완료:",{items:o.results.length})}return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:t,reason:r}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:t,cancelDate:new Date().toISOString()}})}catch(t){return console.error("[Order Refund] Error:",t),e.json({success:!1,error:t.message||"주문 취소 중 오류가 발생했습니다"},500)}});p.use("/api/seller/*",j);p.get("/api/seller/sales",S(),async e=>{try{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await Ve(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:o,endDate:n}=e.req.query(),i=o||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=n||new Date().toISOString().split("T")[0],l=await s.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:l,stats:u,orders:(d==null?void 0:d.results)||[]}})}catch(s){return console.error("Seller sales query error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/settlement-csv",S(),async e=>{try{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await Ve(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:o,endDate:n}=e.req.query(),i=o||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=n||new Date().toISOString().split("T")[0],l=await s.prepare(`
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
`;for(const d of(l==null?void 0:l.results)||[]){const m=d.status==="delivered"?"배송완료":d.status==="shipped"?"배송중":d.status==="preparing"?"상품준비중":d.status==="paid"?"결제완료":"대기중",_=d.buyer_business_name||"-",f=d.buyer_business_number||"-",g=d.invoice_number||"-",b=d.issue_date||"-",w=d.tax_invoice_status==="issued"?"발행완료":d.tax_invoice_status==="cancelled"?"취소":"-",h=d.nts_confirm_number||"-";u+=`${d.order_number},${d.created_at},${d.user_name||"익명"},${d.total_amount},${d.commission_amount},${d.seller_amount},${m},${_},${f},${g},${b},${w},${h}
`}return new Response(u,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(s){return console.error("CSV download error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/issue",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{order_number:r}=await e.req.json();if(!r)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(r).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!a.issue_tax_invoice)return e.json({success:!1,error:"세금계산서 발행이 요청되지 않은 주문입니다."},400);const o=await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(t.sellerId).first();if(!o)return e.json({success:!1,error:"승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요."},400);const n=await s.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),l=i-c,u=new Date().toISOString().split("T")[0],d=`${u}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,m=kr(o,a,n.results);let _,f,g;try{_=await Or(m),f=_.ntsConfirmNumber,g=_.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:f,invoiceKey:g,mockMode:Ge()})}catch(h){console.error("바로빌 API 호출 실패:",h),f="FAILED",g=null}const w=(await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t.sellerId,r,"tax",d,u,o.business_number,o.business_name,o.ceo_name,o.address,o.business_type,o.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,l,i,f==="FAILED"?"failed":"issued",Ge()?"mock":"barobill",g,f).run()).meta.last_row_id;for(const h of n.results){const T=Math.floor(Number(h.price)*Number(h.quantity)/1.1),y=Number(h.price)*Number(h.quantity)-T;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(w,h.id,h.product_name,h.quantity,h.price,T,y).run()}return e.json({success:!0,data:{invoice_id:w,invoice_number:d,issue_date:u,total_amount:i,supply_price:c,tax_amount:l,status:f==="FAILED"?"failed":"issued",nts_confirm_number:f,api_invoice_key:g,mock_mode:Ge(),message:f==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":Ge()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(r){return console.error("세금계산서 발행 오류:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/tax-invoices",async e=>{var r;const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{start_date:a,end_date:o,status:n}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[t.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),o&&(i+=" AND issue_date <= ?",c.push(o)),n&&(i+=" AND status = ?",c.push(n)),i+=" ORDER BY created_at DESC";const l=await s.prepare(i).bind(...c).all();return e.json({success:!0,data:l.results||[],total:((r=l.results)==null?void 0:r.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/tax-invoices/:id",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=await s.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(r).all();return e.json({success:!0,data:{...a,items:o.results||[]}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json(),o=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,t.sellerId).first();if(!o)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=new Date(o.issue_date),i=new Date(n);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(o.api_invoice_key&&!Ge()){const l=await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(t.sellerId).first();l&&l.business_number&&await Dr(l.business_number,o.api_invoice_key,a||"판매자 요청")}}catch(l){console.error("바로빌 취소 API 호출 실패:",l)}return await s.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{status:r,limit:a=50}=e.req.query();let o=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const n=[t.sellerId];r&&(o+=" AND log.status = ?",n.push(r)),o+=" ORDER BY log.created_at DESC LIMIT ?",n.push(Number(a));const i=await s.prepare(o).bind(...n).all();return e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${r}`);const a=await s.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"재시도할 실패 로그를 찾을 수 없습니다."},404);const o=Number(a.retry_count||0);if(o>=3)return e.json({success:!1,error:"최대 재시도 횟수(3회)를 초과했습니다."},400);const n=await s.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(r).first();if(!n)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!n.buyer_business_number||!n.buyer_business_name)return e.json({success:!1,error:"주문에 사업자 정보가 없습니다."},400);const i=await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();if(!i)return e.json({success:!1,error:"판매자 사업자 정보가 승인되지 않았습니다."},400);const c=await s.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(n.id).all(),l=Number(n.total_amount),u=Math.floor(l/1.1),d=l-u,m=new Date().toISOString().split("T")[0].replace(/-/g,""),_=Math.random().toString(36).substring(2,8).toUpperCase(),f=`${m}-${_}`,b=(await s.prepare(`
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
    `).bind(t.sellerId,r,f,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",n.buyer_business_number,n.buyer_business_name,n.buyer_ceo_name||"",n.buyer_business_address||"",n.buyer_business_type||"",n.buyer_business_category||"",n.buyer_email||"",n.buyer_phone||"",u,d,l,`RETRY-${Date.now()}-${_}`).run()).meta.last_row_id;for(const w of c.results){const h=Math.floor(Number(w.price)*Number(w.quantity)/1.1),T=Number(w.price)*Number(w.quantity)-h;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(b,w.product_name||"상품명 없음",w.quantity,w.price,h,T,w.option_name||"").run()}return await s.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r,t.sellerId,b,o+1).run(),await s.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(o+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${b}, retry_count=${o+1}`),e.json({success:!0,data:{invoice_id:b,invoice_number:f,retry_count:o+1}})}catch(r){console.error("[TAX INVOICE RETRY] 재시도 실패:",r);try{const a=e.req.param("orderNumber"),o=await s.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,t.sellerId).first(),n=Number((o==null?void 0:o.retry_count)||0);await s.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,t.sellerId,r.message,n+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:r.message},500)}});p.get("/live/:id",async e=>{try{const s=new URL("/static/live.html",e.req.url);let r=await(await fetch(s.toString())).text();const o=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return r=r.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${o}`),console.log("[Live Page] Environment variables injected"),new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving live page:",s),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/cart",async e=>{try{const s=new URL("/static/cart.html",e.req.url);let r=await(await fetch(s.toString())).text();return r=r.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),r=r.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving cart page:",s),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/my-orders",async e=>{try{const s=new URL("/static/my-orders.html",e.req.url),r=await(await fetch(s.toString())).text();return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving my orders page:",s),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/payment-result",async e=>{try{const s=new URL("/payment-result.html",e.req.url),r=await(await fetch(s.toString())).text();return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving payment result page:",s),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/api/seller/profile",async e=>{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const r=await s.prepare(`
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
    `).bind(t).first();if(!r||!r.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:o,sns_instagram:n,sns_youtube:i,sns_facebook:c,sns_twitter:l,website_url:u,kakao_chat_link:d}=await e.req.json(),m=[],_=[];if(a!==void 0&&(m.push("profile_image = ?"),_.push(a)),o!==void 0&&(m.push("bio = ?"),_.push(o)),n!==void 0&&(m.push("sns_instagram = ?"),_.push(n)),i!==void 0&&(m.push("sns_youtube = ?"),_.push(i)),c!==void 0&&(m.push("sns_facebook = ?"),_.push(c)),l!==void 0&&(m.push("sns_twitter = ?"),_.push(l)),u!==void 0&&(m.push("website_url = ?"),_.push(u)),d!==void 0&&(m.push("kakao_chat_link = ?"),_.push(d)),m.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);m.push("updated_at = datetime('now')"),_.push(r.seller_id),await s.prepare(`
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
    `).bind(r.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:f})}catch(r){return console.error("프로필 업데이트 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/public/:sellerId",async e=>{const{DB:s}=e.env,t=e.req.param("sellerId");try{const r=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return console.error("상품 목록 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/notifications",j,async e=>{const{DB:s}=e.env;try{const t=e.get("userId"),r=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),o=e.req.query("unread_only")==="true";let n=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;o&&(n+=" AND is_read = 0"),n+=" ORDER BY created_at DESC LIMIT ?";const i=await s.prepare(n).bind(t,r,a).all();return e.json({success:!0,data:i.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/notifications/unread-count",j,async e=>{const{DB:s}=e.env;try{const t=e.get("userId"),r=e.get("userType"),a=await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(t,r).first();return e.json({success:!0,count:(a==null?void 0:a.count)||0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/notifications/:id/read",j,async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=e.get("userId"),a=e.get("userType");return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(t,r,a).first()?(await s.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(t).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/notifications/read-all",j,async e=>{const{DB:s}=e.env;try{const t=e.get("userId"),r=e.get("userType");return await s.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(t,r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/notifications/:id",j,async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=e.get("userId"),a=e.get("userType");return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(t,r,a).first()?(await s.prepare("DELETE FROM notifications WHERE id = ?").bind(t).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/banners",async e=>{const{DB:s}=e.env;try{const t=new Date().toISOString(),r=await s.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(t,t).all();return e.json({success:!0,data:r.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/admin/banners",j,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=await s.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/admin/banners",j,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:r,image_url:a,link_url:o,description:n,is_active:i,display_order:c,start_date:l,end_date:u}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const d=await s.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a,o||null,n||null,i!==!1?1:0,c||0,l||null,u||null).run();return e.json({success:!0,id:d.meta.last_row_id})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/admin/banners/:id",j,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id"),{title:a,image_url:o,link_url:n,description:i,is_active:c,display_order:l,start_date:u,end_date:d}=await e.req.json();return await s.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,o,n||null,i||null,c?1:0,l||0,u||null,d||null,r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/admin/banners/:id",j,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id");return await s.prepare("DELETE FROM banners WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/order-complete",e=>e.redirect("/order-complete.html",302));p.notFound(e=>{const s=e.req.path;return s.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${s} was not found.`},404):new Response(null,{status:404})});p.onError((e,s)=>{const t=s.req.path;if(e instanceof Sa)return console.error("[AppError]",{path:t,method:s.req.method,code:e.code,message:e.message,statusCode:e.statusCode}),s.json({success:!1,error:{code:e.code,message:e.message,...e.details&&{details:e.details}}},e.statusCode);if(console.error("[Global Error Handler]",{path:t,method:s.req.method,error:e.message,stack:e.stack}),t.startsWith("/api/")){let r=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(r=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(r=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(r=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(r=400,a="잘못된 요청입니다."),s.json({success:!1,error:e.message||a},r)}return s.html(`
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
    `).all();return e.json({success:!0,pricing:t.results})}catch(t){return console.error("[Admin Alimtalk Pricing] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/admin/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const{plan_name:t,min_quantity:r,max_quantity:a,unit_price:o}=await e.req.json();if(!t||!r||!o)return e.json({success:!1,error:"Missing required fields"},400);const n=await s.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(t,r,a||null,o).run();return e.json({success:!0,pricing_id:n.meta.last_row_id})}catch(t){return console.error("[Admin Alimtalk Pricing Create] Error:",t),e.json({success:!1,error:t.message},500)}});p.put("/api/admin/alimtalk/pricing/:id",S(),async e=>{const{env:s}=e,t=e.req.param("id");try{const{plan_name:r,min_quantity:a,max_quantity:o,unit_price:n,is_active:i}=await e.req.json();return(await s.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r,a,o||null,n,i?1:0,t).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing updated successfully"})}catch(r){return console.error("[Admin Alimtalk Pricing Update] Error:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/alimtalk/pricing/:id",S(),async e=>{const{env:s}=e,t=e.req.param("id");try{return(await s.DB.prepare(`
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
    `).bind(t||"2000-01-01",r||"2100-01-01").first(),o=await s.DB.prepare(`
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
    `).bind(t||"2000-01-01",r||"2100-01-01").all();return e.json({success:!0,statistics:{total:a,by_seller:o.results}})}catch(t){return console.error("[Admin Alimtalk Statistics] Error:",t),e.json({success:!1,error:t.message},500)}});p.use("/api/seller/alimtalk/*",j);p.get("/api/seller/alimtalk/account",S(),async e=>{const{env:s}=e;try{const t=e.get("user");if(!t||t.userType!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const r=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(t.userId).first();return e.json({success:!0,account:r})}catch(t){return console.error("[Seller Alimtalk Account] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/register",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Ne(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{channel_id:a,phone_number:o}=await e.req.json();if(!a||!o)return e.json({success:!1,error:"Missing required fields"},400);const n=St(o),i=await Vr(s,{channelId:a,phoneNumber:n});if(!i.success)return e.json({success:!1,error:"Failed to register Kakao channel"},500);const c=await s.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(r.user_id,a,a,i.senderKey,n).run();return e.json({success:!0,account_id:c.meta.last_row_id,sender_key:i.senderKey,message:"Kakao channel registered successfully"})}catch(t){return console.error("[Seller Alimtalk Register] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Ne(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!a)return e.json({success:!1,error:"Alimtalk account not found"},404);const o=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();return e.json({success:!0,templates:o.results})}catch(t){return console.error("[Seller Alimtalk Templates] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Ne(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_code:a,template_name:o,template_content:n,template_type:i}=await e.req.json();if(!a||!o||!n)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(!(await Yr(s,c.sender_key,{name:o,content:n,templateCode:a})).success)return e.json({success:!1,error:"Failed to register template"},500);const u=await s.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id,a,o,n,i||"basic").run();return e.json({success:!0,template_id:u.meta.last_row_id,message:"Template registered successfully. Approval pending (1-2 days)"})}catch(t){return console.error("[Seller Alimtalk Template Register] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const t=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:t.results})}catch(t){return console.error("[Seller Alimtalk Pricing] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/charge",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Ne(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{amount:a,pricing_id:o}=await e.req.json();if(!a||!o)return e.json({success:!1,error:"Missing required fields"},400);const n=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!n)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(o).first();if(!i)return e.json({success:!1,error:"Pricing not found"},404);const c=a*i.unit_price,l=`alimtalk_${n.id}_${Date.now()}`,u=await s.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(n.id,a,c,i.unit_price,l).run(),d=`https://api.tosspayments.com/v1/payment/${l}`;return e.json({success:!0,charge_id:u.meta.last_row_id,order_id:l,amount:a,price:c,unit_price:i.unit_price,payment_url:d})}catch(t){return console.error("[Seller Alimtalk Charge] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/charge/complete",S(),async e=>{const{env:s}=e;try{const{order_id:t,payment_id:r}=await e.req.json();if(!t)return e.json({success:!1,error:"Missing order_id"},400);const a=await s.DB.prepare(`
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
    `).bind(a.amount,a.account_id).run(),e.json({success:!0,message:"Charge completed successfully",charged_amount:a.amount})):e.json({success:!1,error:"Charge not found or already completed"},404)}catch(t){return console.error("[Seller Alimtalk Charge Complete] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/send",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Ne(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_id:a,recipient_phone:o,variables:n,order_id:i}=await e.req.json();if(!a||!o)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(c.balance<1)return e.json({success:!1,error:"Insufficient balance. Please charge first."},400);const l=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a,c.id).first();if(!l)return e.json({success:!1,error:"Template not found or not approved"},404);const u=Jr(l.template_content,n||{}),d=St(o),m=await ks(s,{senderKey:c.sender_key,templateCode:l.template_code,to:d,message:u});if(!m.success)return await s.DB.prepare(`
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
    `).bind(c.id).run(),e.json({success:!0,message_id:_.meta.last_row_id,aligo_message_id:m.messageId,status:"sent",remaining_balance:c.balance-1})}catch(t){return console.error("[Seller Alimtalk Send] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/messages",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Ne(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{page:a="1",limit:o="20",status:n}=e.req.query(),i=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!i)return e.json({success:!1,error:"Alimtalk account not found"},404);const c=(parseInt(a)-1)*parseInt(o);let l=`
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;const u=[i.id];n&&(l+=" AND m.status = ?",u.push(n)),l+=" ORDER BY m.created_at DESC LIMIT ? OFFSET ?",u.push(parseInt(o),c);const d=await s.DB.prepare(l).bind(...u).all(),m=await s.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();return e.json({success:!0,messages:d.results,pagination:{total:m.total,page:parseInt(a),limit:parseInt(o)}})}catch(t){return console.error("[Seller Alimtalk Messages] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/statistics",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Ne(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{start_date:a,end_date:o}=e.req.query(),n=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!n)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await s.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_cost
      FROM alimtalk_messages
      WHERE account_id = ?
        AND created_at >= ?
        AND created_at <= ?
    `).bind(n.id,a||"2000-01-01",o||"2100-01-01").first(),c=await s.DB.prepare(`
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
    `).bind(n.id,a||"2000-01-01",o||"2100-01-01").all(),l=i.total_sent>0?(i.total_success/i.total_sent*100).toFixed(2):0;return e.json({success:!0,statistics:{total_sent:i.total_sent,total_success:i.total_success,total_failed:i.total_failed,success_rate:l,total_cost:i.total_cost,by_template:c.results}})}catch(t){return console.error("[Seller Alimtalk Statistics] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/send",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,recipients:a,variables:o}=t;if(!r||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and recipients are required"},400);const n=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!n)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await As(e.env,{accountId:n.id,templateId:parseInt(r),recipients:a.map(c=>({phone:c.phone,name:c.name,variables:c.variables||{}})),variables:o||{}});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/send/order",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,orderId:a,customMessage:o}=t;if(!r||!a)return e.json({success:!1,error:"templateId and orderId are required"},400);const n=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!n)return e.json({success:!1,error:"No active alimtalk account found"},404);if(!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a),parseInt(s)).first())return e.json({success:!1,error:"Order not found or unauthorized"},404);const c=await oa(e.env,n.id,parseInt(r),parseInt(a),o);return e.json({success:c.success,data:{total:c.totalRecipients,sent:c.successCount,failed:c.failedCount,refunded:c.refundedAmount},messages:c.messages})}catch(s){return console.error("[Alimtalk Send Order] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/send/bulk",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,rows:a,variables:o}=t;if(!r||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and rows are required"},400);const n=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!n)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await na(e.env,n.id,parseInt(r),a,o||{});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send Bulk] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/templates/:id/preview",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=e.req.param("id"),r=await e.req.json(),{variables:a}=r,o=await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(t),parseInt(s)).first();if(!o)return e.json({success:!1,error:"Template not found"},404);let n=o.template_content;return a&&Object.entries(a).forEach(([i,c])=>{const l=new RegExp(`#{${i}}`,"g");n=n.replace(l,c)}),e.json({success:!0,data:{template_name:o.template_name,original:o.template_content,preview:n,required_variables:Array.from(o.template_content.matchAll(/#{(\w+)}/g),i=>i[1])}})}catch(s){return console.error("[Alimtalk Preview] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements",S(),async e=>{try{const s=await e.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("[Admin Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements/:id",S(),async e=>{try{const s=parseInt(e.req.param("id")),t=await pa(e.env.DB,s);return t?e.json({success:!0,data:t}):e.json({success:!1,error:"Settlement not found"},404)}catch(s){return console.error("[Admin Settlement Detail] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/settlements/generate",S(),async e=>{try{const s=await e.req.json(),{startDate:t,endDate:r}=s,a=t&&r?{startDate:t,endDate:r}:ca(),o=await ua(e.env.DB,a);return await da(e.env.DB,o),e.json({success:!0,data:o})}catch(s){return console.error("[Admin Generate Settlement] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.env.DB.prepare(`
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
    `).bind(parseInt(s)).all();return e.json({success:!0,data:t.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements/calculate",S(),async e=>{const{DB:s}=e.env;if(!(await P(e)).success)return e.json({success:!1,error:"관리자 권한이 필요합니다"},401);try{const r=e.req.query("seller_id"),a=e.req.query("period")||"monthly",o=e.req.query("format")||"json";let n=e.req.query("start_date"),i=e.req.query("end_date");if(!r)return e.json({success:!1,error:"seller_id가 필요합니다"},400);const c=new Date;if(a==="weekly"){const h=new Date(c);h.setDate(c.getDate()-c.getDay()-6),h.setHours(0,0,0,0);const T=new Date(h);T.setDate(h.getDate()+6),T.setHours(23,59,59,999),n=h.toISOString().split("T")[0],i=T.toISOString().split("T")[0]}else if(a==="monthly"){const h=new Date(c.getFullYear(),c.getMonth()-1,1),T=new Date(c.getFullYear(),c.getMonth(),0);n=h.toISOString().split("T")[0],i=T.toISOString().split("T")[0]}else if(a==="custom"&&(!n||!i))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const l=await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(r).first();if(!l)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const d=(await s.prepare(`
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
    `).bind(r,n,i).all()).results,m=d.length,_=d.reduce((h,T)=>h+(T.total_amount||0),0),f=d.reduce((h,T)=>h+(T.commission_amount||0),0),g=_-f,b=m>0?d.reduce((h,T)=>h+(T.commission_rate||0),0)/m:0,w={sellerId:parseInt(r),sellerName:l.seller_name||"Unknown",businessName:l.business_name||null,period:{type:a,startDate:n,endDate:i},summary:{totalOrders:m,totalSales:_,totalCommission:f,netAmount:g,commissionRate:Math.round(b*100)/100},orders:d.map(h=>({orderNumber:h.order_number,createdAt:h.created_at,status:h.status,totalAmount:h.total_amount||0,commissionAmount:h.commission_amount||0,sellerAmount:h.seller_amount||0}))};if(o==="csv"){const h=[];h.push("셀러 정산서"),h.push(`셀러명,${w.sellerName}`),h.push(`사업자명,${w.businessName||"N/A"}`),h.push(`정산 기간,${w.period.startDate} ~ ${w.period.endDate}`),h.push(""),h.push("구분,금액"),h.push(`총 주문 건수,${w.summary.totalOrders}건`),h.push(`총 매출,${w.summary.totalSales.toLocaleString()}원`),h.push(`플랫폼 수수료 (${w.summary.commissionRate}%),${w.summary.totalCommission.toLocaleString()}원`),h.push(`정산 금액,${w.summary.netAmount.toLocaleString()}원`),h.push(""),h.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const R of w.orders)h.push(`${R.orderNumber},${R.createdAt},${R.status},${R.totalAmount},${R.commissionAmount},${R.sellerAmount}`);const T=h.join(`
`),y=`settlement_${r}_${n}_${i}.csv`;return e.text(T,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${y}"`})}return e.json({success:!0,data:w})}catch(r){return console.error("[Settlement] Calculation error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/settlements/my",S(),async e=>{const{DB:s}=e.env,t=await N(e);if(!t.success)return e.json({success:!1,error:"셀러 권한이 필요합니다"},401);const r=new URL(e.req.url);r.searchParams.set("seller_id",String(t.sellerId));const a=new Request(r.toString(),e.req.raw);({...e,req:new Proxy(a,{get(o,n){return n==="query"?i=>i==="seller_id"?String(t.sellerId):r.searchParams.get(i):o[n]}})});try{const o=t.sellerId,n=e.req.query("period")||"monthly",i=e.req.query("format")||"json";let c=e.req.query("start_date"),l=e.req.query("end_date");const u=new Date;if(n==="weekly"){const y=new Date(u);y.setDate(u.getDate()-u.getDay()-6),y.setHours(0,0,0,0);const R=new Date(y);R.setDate(y.getDate()+6),R.setHours(23,59,59,999),c=y.toISOString().split("T")[0],l=R.toISOString().split("T")[0]}else if(n==="monthly"){const y=new Date(u.getFullYear(),u.getMonth()-1,1),R=new Date(u.getFullYear(),u.getMonth(),0);c=y.toISOString().split("T")[0],l=R.toISOString().split("T")[0]}else if(n==="custom"&&(!c||!l))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const d=await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(o).first();if(!d)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const _=(await s.prepare(`
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
    `).bind(o,c,l).all()).results,f=_.length,g=_.reduce((y,R)=>y+(R.total_amount||0),0),b=_.reduce((y,R)=>y+(R.commission_amount||0),0),w=g-b,h=f>0?_.reduce((y,R)=>y+(R.commission_rate||0),0)/f:0,T={sellerId:o,sellerName:d.seller_name||"Unknown",businessName:d.business_name||null,period:{type:n,startDate:c,endDate:l},summary:{totalOrders:f,totalSales:g,totalCommission:b,netAmount:w,commissionRate:Math.round(h*100)/100},orders:_.map(y=>({orderNumber:y.order_number,createdAt:y.created_at,status:y.status,totalAmount:y.total_amount||0,commissionAmount:y.commission_amount||0,sellerAmount:y.seller_amount||0}))};if(i==="csv"){const y=[];y.push("셀러 정산서"),y.push(`셀러명,${T.sellerName}`),y.push(`사업자명,${T.businessName||"N/A"}`),y.push(`정산 기간,${T.period.startDate} ~ ${T.period.endDate}`),y.push(""),y.push("구분,금액"),y.push(`총 주문 건수,${T.summary.totalOrders}건`),y.push(`총 매출,${T.summary.totalSales.toLocaleString()}원`),y.push(`플랫폼 수수료 (${T.summary.commissionRate}%),${T.summary.totalCommission.toLocaleString()}원`),y.push(`정산 금액,${T.summary.netAmount.toLocaleString()}원`),y.push(""),y.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const A of T.orders)y.push(`${A.orderNumber},${A.createdAt},${A.status},${A.totalAmount},${A.commissionAmount},${A.sellerAmount}`);const R=y.join(`
`),$=`my_settlement_${c}_${l}.csv`;return e.text(R,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${$}"`})}return e.json({success:!0,data:T})}catch(o){return console.error("[My Settlement] Error:",o),e.json({success:!1,error:o.message},500)}});p.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.env.DB.prepare(`
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
    `).bind(parseInt(s)).all();return e.json({success:!0,data:t.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/live/:streamId/sse",async e=>{const s=e.req.param("streamId");return ma(s,e.env)});p.get("/api/live/:streamId/chat/sse",async e=>{const s=e.req.param("streamId");return _a(s,e.env)});p.get("/api/seller/orders/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?fa(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});p.get("/api/seller/stock/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?Ea(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});p.post("/api/push/subscribe",S(),async e=>{try{const s=e.req.header("X-User-ID"),t=e.req.header("X-User-Type");if(!s||!t)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json();return await ha(e.env.DB,parseInt(s),t,r),e.json({success:!0})}catch(s){return console.error("[Push Subscribe] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/push/unsubscribe",S(),async e=>{try{const{endpoint:s}=await e.req.json();return s?(await ga(e.env.DB,s),e.json({success:!0})):e.json({success:!1,error:"Endpoint required"},400)}catch(s){return console.error("[Push Unsubscribe] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/push/vapid-public-key",S(),async e=>{try{const s=e.env.VAPID_PUBLIC_KEY||"";return e.json({success:!0,publicKey:s})}catch(s){return console.error("[Push VAPID Key] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/cache/stats",async e=>{const s=e.req.query("token"),t=e.env.STATS_SECRET_TOKEN||"your-secret-token-here";if(s!==t)return e.json({success:!1,error:"접근 권한이 없습니다. 올바른 token을 제공해주세요."},403);const r=V.hits+V.misses>0?(V.hits/(V.hits+V.misses)*100).toFixed(2):"0.00";return e.json({success:!0,data:{cache:{...V,hitRate:`${r}%`,cacheSize:le.size,maxSize:1e3,memoryUsage:`${(le.size/1e3*100).toFixed(1)}%`},description:{hits:"Memory cache로 처리된 요청 (KV 읽기 0회)",misses:"Memory cache 미스로 KV 조회한 요청",writes:"Memory cache에 저장된 항목 수",evictions:"Memory cache에서 삭제된 항목 수 (만료 또는 크기 제한)",hitRate:"Cache hit 비율 (높을수록 KV 사용량 감소)",cacheSize:"현재 Memory cache에 저장된 항목 수",maxSize:"Memory cache 최대 크기",memoryUsage:"Memory cache 사용률 (cacheSize / maxSize)"},kvUsageGuide:{currentHitRate:`${r}%`,recommendation:parseFloat(r)>=90?"✅ 캐시가 매우 효과적으로 작동하고 있습니다.":parseFloat(r)>=70?"⚠️ 캐시 히트율이 낮습니다. TTL 조정을 고려하세요.":"❌ 캐시 히트율이 매우 낮습니다. 캐시 설정을 확인하세요.",kvDailyReadsLimit:"100,000 reads/day (free tier)",kvDailyWritesLimit:"1,000 writes/day (free tier)",estimatedDailyReads:Math.round(V.misses/(V.hits+V.misses||1)*1e4),estimatedDailyWrites:Math.round(V.writes/(V.hits+V.misses||1)*1e3)}}})});let Js={},zs={};p.get("/api/debug/kv-usage",S(),async e=>{try{const s=Object.entries(Js).sort((i,c)=>c[1]-i[1]).slice(0,20),t=Object.entries(zs).sort((i,c)=>c[1]-i[1]).slice(0,20),r=Object.values(Js).reduce((i,c)=>i+c,0),a=Object.values(zs).reduce((i,c)=>i+c,0),o=r/1e3*100,n=a/1e5*100;if((o>=50||n>=50)&&e.env.DISCORD_WEBHOOK_URL)try{await Ra(e.env.DISCORD_WEBHOOK_URL,n,o)}catch(i){console.error("[Discord] KV 경고 전송 실패:",i)}return e.json({success:!0,stats:{total_writes:r,total_reads:a,daily_write_limit:1e3,daily_read_limit:1e5,write_usage_percent:o.toFixed(2)+"%",read_usage_percent:n.toFixed(2)+"%",top_writes:s,top_reads:t},recommendations:r>500?["⚠️ KV Write 사용량이 높습니다!","1. 세션 갱신 주기를 늘리세요 (현재 29일)","2. 캐시를 메모리에만 저장하세요 (forceKvWrite: false)","3. JWT 인증으로 전환하세요 (KV 사용량 90% 감소)"]:["✅ KV 사용량이 정상 범위입니다."]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/notifications",S(),async e=>{var t;const{DB:s}=e.env;try{const r=e.req.query("userId"),a=parseInt(e.req.query("limit")||"20"),o=parseInt(e.req.query("offset")||"0");if(!r)return e.json({success:!1,error:"userId is required"},400);const n=await s.prepare(`
      SELECT id, type, title, message, link_url, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(r,a,o).all(),i=await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).bind(r).first();return e.json({success:!0,data:{notifications:n.results||[],unread_count:(i==null?void 0:i.count)||0,total:((t=n.results)==null?void 0:t.length)||0}})}catch(r){return console.error("[Notifications] Get error:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/notifications/:id/read",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),{userId:r}=await e.req.json();return r?(await s.prepare(`
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
    `).bind(t,r).run()).meta.changes===0?e.json({success:!1,error:"Notification not found"},404):e.json({success:!0,message:"Notification deleted"}):e.json({success:!1,error:"userId is required"},400)}catch(t){return console.error("[Notifications] Delete error:",t),e.json({success:!1,error:t.message},500)}});async function Ka(e,s,t){var a,o;const r={embeds:[{title:"🚨 서버 에러 발생",color:16711680,fields:[{name:"에러 메시지",value:s.message||"Unknown error",inline:!1},{name:"발생 시각",value:new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}),inline:!0},{name:"HTTP 메소드",value:t.method||"N/A",inline:!0},{name:"API 경로",value:t.path||"N/A",inline:!1},{name:"사용자 ID",value:((a=t.userId)==null?void 0:a.toString())||"비로그인",inline:!0},{name:"사용자 타입",value:t.userType||"N/A",inline:!0},{name:"에러 스택",value:"```\n"+(((o=s.stack)==null?void 0:o.substring(0,800))||"N/A")+"\n```",inline:!1}],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Error Monitoring"}}]};try{await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)}),console.log("[Discord] Error alert sent successfully")}catch(n){console.error("[Discord Webhook] Failed to send alert:",n)}}p.onError(async(e,s)=>{if(console.error("[Error]",e),s.env.DISCORD_WEBHOOK_URL)try{await Ka(s.env.DISCORD_WEBHOOK_URL,e,{method:s.req.method,path:s.req.path,userId:s.get("userId"),userType:s.get("userType")})}catch(t){console.error("[Discord] Webhook failed, but continuing:",t)}return s.json({success:!1,error:{code:e.code||"INTERNAL_ERROR",message:e.message||"서버 오류가 발생했습니다."}},e.status||500)});const Gs=new gt,Va=Object.assign({"/src/index.tsx":p});let Ot=!1;for(const[,e]of Object.entries(Va))e&&(Gs.route("/",e),Gs.notFound(e.notFoundHandler),Ot=!0);if(!Ot)throw new Error("Can't import modules from ['/src/index.tsx']");let ze=null;async function kt(e,s){try{const t=e.split(".");if(t.length!==3)throw new Error("Invalid token structure");const r=JSON.parse(atob(t[0].replace(/-/g,"+").replace(/_/g,"/"))),a=JSON.parse(atob(t[1].replace(/-/g,"+").replace(/_/g,"/")));if(console.log("[Firebase JWT] Token header:",r),console.log("[Firebase JWT] Token payload (aud, iss, exp):",{aud:a.aud,iss:a.iss,exp:a.exp}),a.aud!==s)throw new Error(`Invalid audience. Expected ${s}, got ${a.aud}`);if(!a.iss||!a.iss.includes(s))throw new Error("Invalid issuer");if(a.exp<Math.floor(Date.now()/1e3))throw new Error("Token expired");return await Ya(e,r.kid),console.log("[Firebase JWT] ✅ Token verified successfully"),a}catch(t){throw console.error("[Firebase JWT] ❌ Verification failed:",t),t}}async function At(){const e=Date.now();if(ze&&ze.expires>e)return ze.keys;const s=await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");if(!s.ok)throw new Error("Failed to fetch public keys");const t=await s.json(),a=(s.headers.get("cache-control")||"").match(/max-age=(\d+)/),o=a?parseInt(a[1]):3600;return ze={keys:Object.entries(t).map(([n,i])=>({kid:n,cert:i})),expires:e+o*1e3},ze.keys}async function Ya(e,s){if(!(await At()).find(a=>a.kid===s))throw new Error(`Public key not found for kid: ${s}`);console.log("[Firebase JWT] Public key found for kid:",s)}const Ja={verifyFirebaseIdToken:kt,getPublicKeys:At},za=Object.freeze(Object.defineProperty({__proto__:null,default:Ja,verifyFirebaseIdToken:kt},Symbol.toStringTag,{value:"Module"}));async function Nt(e){try{const{to:s,subject:t,htmlContent:r,textContent:a}=e,o=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:s}]}],from:{email:"noreply@live.ur-team.com",name:"리스터코퍼레이션"},subject:t,content:[{type:"text/html",value:r},...a?[{type:"text/plain",value:a}]:[]]})});if(!o.ok){const n=await o.text();return console.error("[Email] Failed to send:",o.status,n),{success:!1,error:`Email send failed: ${o.status}`}}return console.log("[Email] Successfully sent to:",s),{success:!0}}catch(s){return console.error("[Email] Exception:",s),{success:!1,error:s.message}}}async function Ga(e){const{streamId:s,title:t,sellerName:r,platform:a,scheduledAt:o,status:n}=e,i=`https://live.ur-team.com/live/${s}`,c=n==="live"?"🔴 라이브 중":n==="scheduled"?"📅 예약됨":"⏸️ 대기 중",l=`
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
          <span class="badge ${n==="live"?"badge-live":"badge-scheduled"}">${c}</span>
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
      
      ${o?`
      <div class="info-row">
        <span class="label">예약 시간</span>
        <span class="value">${new Date(o).toLocaleString("ko-KR")}</span>
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
제목: ${t}
판매자: ${r}
플랫폼: ${a==="youtube"?"YouTube":"TikTok"}
${o?`예약 시간: ${new Date(o).toLocaleString("ko-KR")}`:""}
라이브 ID: #${s}

🔗 라이브 페이지: ${i}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `;return Nt({to:"jiwon@ur-team.com",subject:`[리스터코퍼레이션] 🎉 새 라이브 스트림 생성: ${t}`,htmlContent:l,textContent:u})}const Xa=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:Nt,sendLiveStreamCreatedEmail:Ga},Symbol.toStringTag,{value:"Module"}));async function Qa(e,s,t){const r=e.from||t||"리스터코퍼레이션 <onboarding@resend.dev>",{to:a,subject:o,html:n}=e;if(!s)return console.warn("[Email] RESEND_API_KEY not configured, skipping email"),{success:!1,error:"API key not configured"};try{console.log("[Email] Sending email:",{to:a,subject:o,from:r});const i=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${s}`,"Content-Type":"application/json"},body:JSON.stringify({from:r,to:a,subject:o,html:n})}),c=await i.json();return i.ok?(console.log("[Email] Sent successfully:",{to:a,subject:o,id:c.id}),{success:!0}):(console.error("[Email] Failed to send:",c),{success:!1,error:c.message||"Failed to send email"})}catch(i){return console.error("[Email] Error:",i),{success:!1,error:i.message}}}function Za(e,s){return`
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
  `}function eo(e,s){return`
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
  `}const Ct=Object.freeze(Object.defineProperty({__proto__:null,getSellerApprovalEmailHTML:Za,getSellerRejectionEmailHTML:eo,sendEmail:Qa},Symbol.toStringTag,{value:"Module"}));async function so(e,s){const{userId:t,type:r,title:a,message:o,linkUrl:n}=s;try{const i=await e.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(t,r,a,o,n||null).run();return console.log(`[Notification] Created for user ${t}: ${r} - ${a}`),{success:!0,id:i.meta.last_row_id}}catch(i){return console.error("[Notification] Failed to create:",i),{success:!1,error:i.message}}}const to={seller_approved:e=>({title:"🎉 판매자 승인 완료",message:`${e}님, 축하합니다! 리스터코퍼레이션 판매자로 승인되었습니다.`,linkUrl:"/seller"}),seller_rejected:e=>({title:"판매자 승인 거부",message:`죄송합니다. 판매자 승인이 거부되었습니다. 사유: ${e}`,linkUrl:"/seller/register"}),order_complete:e=>({title:"주문 완료",message:`주문번호 ${e}의 주문이 접수되었습니다.`,linkUrl:`/orders/${e}`}),order_shipped:e=>({title:"배송 시작",message:`주문번호 ${e}의 상품이 배송 시작되었습니다.`,linkUrl:`/orders/${e}`}),order_delivered:e=>({title:"배송 완료",message:`주문번호 ${e}의 상품이 배송 완료되었습니다.`,linkUrl:`/orders/${e}`}),refund_requested:e=>({title:"환불 요청 접수",message:`주문번호 ${e}의 환불이 접수되었습니다.`,linkUrl:`/orders/${e}`}),refund_complete:(e,s)=>({title:"환불 완료",message:`주문번호 ${e}의 환불(₩${s.toLocaleString()})이 완료되었습니다.`,linkUrl:`/orders/${e}`}),product_low_stock:(e,s)=>({title:"⚠️ 재고 부족 알림",message:`${e}의 재고가 ${s}개 남았습니다.`,linkUrl:"/seller/products"}),product_sold_out:e=>({title:"❌ 품절 알림",message:`${e}이(가) 품절되었습니다.`,linkUrl:"/seller/products"})},jt=Object.freeze(Object.defineProperty({__proto__:null,NotificationTemplates:to,createNotification:so},Symbol.toStringTag,{value:"Module"}));export{Gs as default};
