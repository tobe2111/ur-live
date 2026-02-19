var Vs=Object.defineProperty;var is=e=>{throw TypeError(e)};var Ys=(e,r,t)=>r in e?Vs(e,r,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[r]=t;var R=(e,r,t)=>Ys(e,typeof r!="symbol"?r+"":r,t),Ge=(e,r,t)=>r.has(e)||is("Cannot "+t);var m=(e,r,t)=>(Ge(e,r,"read from private field"),t?t.call(e):r.get(e)),I=(e,r,t)=>r.has(e)?is("Cannot add the same private member more than once"):r instanceof WeakSet?r.add(e):r.set(e,t),T=(e,r,t,s)=>(Ge(e,r,"write to private field"),s?s.call(e,t):r.set(e,t),t),O=(e,r,t)=>(Ge(e,r,"access private method"),t);var cs=(e,r,t,s)=>({set _(a){T(e,r,a,t)},get _(){return m(e,r,s)}});var us=(e,r,t)=>(s,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,u=!1,l;if(e[i]?(l=e[i][0][0],s.req.routeIndex=i):l=i===e.length&&a||void 0,l)try{c=await l(s,()=>o(i+1))}catch(d){if(d instanceof Error&&r)s.error=d,c=await r(d,s),u=!0;else throw d}else s.finalized===!1&&t&&(c=await t(s));return c&&(s.finalized===!1||u)&&(s.res=c),s}},Js=Symbol(),zs=async(e,r=Object.create(null))=>{const{all:t=!1,dot:s=!1}=r,n=(e instanceof Ss?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?Gs(e,{all:t,dot:s}):{}};async function Gs(e,r){const t=await e.formData();return t?Xs(t,r):{}}function Xs(e,r){const t=Object.create(null);return e.forEach((s,a)=>{r.all||a.endsWith("[]")?Qs(t,a,s):t[a]=s}),r.dot&&Object.entries(t).forEach(([s,a])=>{s.includes(".")&&(Zs(t,s,a),delete t[s])}),t}var Qs=(e,r,t)=>{e[r]!==void 0?Array.isArray(e[r])?e[r].push(t):e[r]=[e[r],t]:r.endsWith("[]")?e[r]=[t]:e[r]=t},Zs=(e,r,t)=>{let s=e;const a=r.split(".");a.forEach((n,o)=>{o===a.length-1?s[n]=t:((!s[n]||typeof s[n]!="object"||Array.isArray(s[n])||s[n]instanceof File)&&(s[n]=Object.create(null)),s=s[n])})},gs=e=>{const r=e.split("/");return r[0]===""&&r.shift(),r},er=e=>{const{groups:r,path:t}=sr(e),s=gs(t);return rr(s,r)},sr=e=>{const r=[];return e=e.replace(/\{[^}]+\}/g,(t,s)=>{const a=`@${s}`;return r.push([a,t]),a}),{groups:r,path:e}},rr=(e,r)=>{for(let t=r.length-1;t>=0;t--){const[s]=r[t];for(let a=e.length-1;a>=0;a--)if(e[a].includes(s)){e[a]=e[a].replace(s,r[t][1]);break}}return e},We={},tr=(e,r)=>{if(e==="*")return"*";const t=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(t){const s=`${e}#${r}`;return We[s]||(t[2]?We[s]=r&&r[0]!==":"&&r[0]!=="*"?[s,t[1],new RegExp(`^${t[2]}(?=/${r})`)]:[e,t[1],new RegExp(`^${t[2]}$`)]:We[s]=[e,t[1],!0]),We[s]}return null},ss=(e,r)=>{try{return r(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,t=>{try{return r(t)}catch{return t}})}},ar=e=>ss(e,decodeURI),bs=e=>{const r=e.url,t=r.indexOf("/",r.indexOf(":")+4);let s=t;for(;s<r.length;s++){const a=r.charCodeAt(s);if(a===37){const n=r.indexOf("?",s),o=r.slice(t,n===-1?void 0:n);return ar(o.includes("%25")?o.replace(/%25/g,"%2525"):o)}else if(a===63)break}return r.slice(t,s)},nr=e=>{const r=bs(e);return r.length>1&&r.at(-1)==="/"?r.slice(0,-1):r},ge=(e,r,...t)=>(t.length&&(r=ge(r,...t)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${r==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(r==null?void 0:r[0])==="/"?r.slice(1):r}`}`),ws=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const r=e.split("/"),t=[];let s="";return r.forEach(a=>{if(a!==""&&!/\:/.test(a))s+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){t.length===0&&s===""?t.push("/"):t.push(s);const n=a.replace("?","");s+="/"+n,t.push(s)}else s+="/"+a}),t.filter((a,n,o)=>o.indexOf(a)===n)},Xe=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?ss(e,Rs):e):e,Ts=(e,r,t)=>{let s;if(!t&&r&&!/[%+]/.test(r)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(r,o+1)||(o=e.indexOf(`&${r}`,o+1));o!==-1;){const i=e.charCodeAt(o+r.length+1);if(i===61){const c=o+r.length+2,u=e.indexOf("&",c);return Xe(e.slice(c,u===-1?void 0:u))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${r}`,o+1)}if(s=/[%+]/.test(e),!s)return}const a={};s??(s=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(s&&(c=Xe(c)),n=o,c==="")continue;let u;i===-1?u="":(u=e.slice(i+1,o===-1?void 0:o),s&&(u=Xe(u))),t?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(u)):a[c]??(a[c]=u)}return r?a[r]:a},or=Ts,ir=(e,r)=>Ts(e,r,!0),Rs=decodeURIComponent,ls=e=>ss(e,Rs),Te,B,se,Is,vs,es,re,ms,Ss=(ms=class{constructor(e,r="/",t=[[]]){I(this,se);R(this,"raw");I(this,Te);I(this,B);R(this,"routeIndex",0);R(this,"path");R(this,"bodyCache",{});I(this,re,e=>{const{bodyCache:r,raw:t}=this,s=r[e];if(s)return s;const a=Object.keys(r)[0];return a?r[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):r[e]=t[e]()});this.raw=e,this.path=r,T(this,B,t),T(this,Te,{})}param(e){return e?O(this,se,Is).call(this,e):O(this,se,vs).call(this)}query(e){return or(this.url,e)}queries(e){return ir(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const r={};return this.raw.headers.forEach((t,s)=>{r[s]=t}),r}async parseBody(e){var r;return(r=this.bodyCache).parsedBody??(r.parsedBody=await zs(this,e))}json(){return m(this,re).call(this,"text").then(e=>JSON.parse(e))}text(){return m(this,re).call(this,"text")}arrayBuffer(){return m(this,re).call(this,"arrayBuffer")}blob(){return m(this,re).call(this,"blob")}formData(){return m(this,re).call(this,"formData")}addValidatedData(e,r){m(this,Te)[e]=r}valid(e){return m(this,Te)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[Js](){return m(this,B)}get matchedRoutes(){return m(this,B)[0].map(([[,e]])=>e)}get routePath(){return m(this,B)[0].map(([[,e]])=>e)[this.routeIndex].path}},Te=new WeakMap,B=new WeakMap,se=new WeakSet,Is=function(e){const r=m(this,B)[0][this.routeIndex][1][e],t=O(this,se,es).call(this,r);return t&&/\%/.test(t)?ls(t):t},vs=function(){const e={},r=Object.keys(m(this,B)[0][this.routeIndex][1]);for(const t of r){const s=O(this,se,es).call(this,m(this,B)[0][this.routeIndex][1][t]);s!==void 0&&(e[t]=/\%/.test(s)?ls(s):s)}return e},es=function(e){return m(this,B)[1]?m(this,B)[1][e]:e},re=new WeakMap,ms),cr={Stringify:1},Os=async(e,r,t,s,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:r,buffer:a,context:s}))).then(i=>Promise.all(i.filter(Boolean).map(c=>Os(c,r,!1,s,a))).then(()=>a[0]))):Promise.resolve(e)},ur="text/plain; charset=UTF-8",Qe=(e,r)=>({"Content-Type":e,...r}),Le,Me,X,Re,Q,q,Pe,Se,Ie,de,He,Ue,te,be,_s,lr=(_s=class{constructor(e,r){I(this,te);I(this,Le);I(this,Me);R(this,"env",{});I(this,X);R(this,"finalized",!1);R(this,"error");I(this,Re);I(this,Q);I(this,q);I(this,Pe);I(this,Se);I(this,Ie);I(this,de);I(this,He);I(this,Ue);R(this,"render",(...e)=>(m(this,Se)??T(this,Se,r=>this.html(r)),m(this,Se).call(this,...e)));R(this,"setLayout",e=>T(this,Pe,e));R(this,"getLayout",()=>m(this,Pe));R(this,"setRenderer",e=>{T(this,Se,e)});R(this,"header",(e,r,t)=>{this.finalized&&T(this,q,new Response(m(this,q).body,m(this,q)));const s=m(this,q)?m(this,q).headers:m(this,de)??T(this,de,new Headers);r===void 0?s.delete(e):t!=null&&t.append?s.append(e,r):s.set(e,r)});R(this,"status",e=>{T(this,Re,e)});R(this,"set",(e,r)=>{m(this,X)??T(this,X,new Map),m(this,X).set(e,r)});R(this,"get",e=>m(this,X)?m(this,X).get(e):void 0);R(this,"newResponse",(...e)=>O(this,te,be).call(this,...e));R(this,"body",(e,r,t)=>O(this,te,be).call(this,e,r,t));R(this,"text",(e,r,t)=>!m(this,de)&&!m(this,Re)&&!r&&!t&&!this.finalized?new Response(e):O(this,te,be).call(this,e,r,Qe(ur,t)));R(this,"json",(e,r,t)=>O(this,te,be).call(this,JSON.stringify(e),r,Qe("application/json",t)));R(this,"html",(e,r,t)=>{const s=a=>O(this,te,be).call(this,a,r,Qe("text/html; charset=UTF-8",t));return typeof e=="object"?Os(e,cr.Stringify,!1,{}).then(s):s(e)});R(this,"redirect",(e,r)=>{const t=String(e);return this.header("Location",/[^\x00-\xFF]/.test(t)?encodeURI(t):t),this.newResponse(null,r??302)});R(this,"notFound",()=>(m(this,Ie)??T(this,Ie,()=>new Response),m(this,Ie).call(this,this)));T(this,Le,e),r&&(T(this,Q,r.executionCtx),this.env=r.env,T(this,Ie,r.notFoundHandler),T(this,Ue,r.path),T(this,He,r.matchResult))}get req(){return m(this,Me)??T(this,Me,new Ss(m(this,Le),m(this,Ue),m(this,He))),m(this,Me)}get event(){if(m(this,Q)&&"respondWith"in m(this,Q))return m(this,Q);throw Error("This context has no FetchEvent")}get executionCtx(){if(m(this,Q))return m(this,Q);throw Error("This context has no ExecutionContext")}get res(){return m(this,q)||T(this,q,new Response(null,{headers:m(this,de)??T(this,de,new Headers)}))}set res(e){if(m(this,q)&&e){e=new Response(e.body,e);for(const[r,t]of m(this,q).headers.entries())if(r!=="content-type")if(r==="set-cookie"){const s=m(this,q).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of s)e.headers.append("set-cookie",a)}else e.headers.set(r,t)}T(this,q,e),this.finalized=!0}get var(){return m(this,X)?Object.fromEntries(m(this,X)):{}}},Le=new WeakMap,Me=new WeakMap,X=new WeakMap,Re=new WeakMap,Q=new WeakMap,q=new WeakMap,Pe=new WeakMap,Se=new WeakMap,Ie=new WeakMap,de=new WeakMap,He=new WeakMap,Ue=new WeakMap,te=new WeakSet,be=function(e,r,t){const s=m(this,q)?new Headers(m(this,q).headers):m(this,de)??new Headers;if(typeof r=="object"&&"headers"in r){const n=r.headers instanceof Headers?r.headers:new Headers(r.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?s.append(o,i):s.set(o,i)}if(t)for(const[n,o]of Object.entries(t))if(typeof o=="string")s.set(n,o);else{s.delete(n);for(const i of o)s.append(n,i)}const a=typeof r=="number"?r:(r==null?void 0:r.status)??m(this,Re);return new Response(e,{status:a,headers:s})},_s),M="ALL",dr="all",pr=["get","post","put","delete","options","patch"],js="Can not add a route since the matcher is already built.",Ns=class extends Error{},mr="__COMPOSED_HANDLER",_r=e=>e.text("404 Not Found",404),ds=(e,r)=>{if("getResponse"in e){const t=e.getResponse();return r.newResponse(t.body,t)}return console.error(e),r.text("Internal Server Error",500)},V,P,Ds,Y,ue,$e,qe,ve,fr=(ve=class{constructor(r={}){I(this,P);R(this,"get");R(this,"post");R(this,"put");R(this,"delete");R(this,"options");R(this,"patch");R(this,"all");R(this,"on");R(this,"use");R(this,"router");R(this,"getPath");R(this,"_basePath","/");I(this,V,"/");R(this,"routes",[]);I(this,Y,_r);R(this,"errorHandler",ds);R(this,"onError",r=>(this.errorHandler=r,this));R(this,"notFound",r=>(T(this,Y,r),this));R(this,"fetch",(r,...t)=>O(this,P,qe).call(this,r,t[1],t[0],r.method));R(this,"request",(r,t,s,a)=>r instanceof Request?this.fetch(t?new Request(r,t):r,s,a):(r=r.toString(),this.fetch(new Request(/^https?:\/\//.test(r)?r:`http://localhost${ge("/",r)}`,t),s,a)));R(this,"fire",()=>{addEventListener("fetch",r=>{r.respondWith(O(this,P,qe).call(this,r.request,r,void 0,r.request.method))})});[...pr,dr].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?T(this,V,o):O(this,P,ue).call(this,n,m(this,V),o),i.forEach(c=>{O(this,P,ue).call(this,n,m(this,V),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){T(this,V,c);for(const u of[n].flat())i.map(l=>{O(this,P,ue).call(this,u.toUpperCase(),m(this,V),l)})}return this},this.use=(n,...o)=>(typeof n=="string"?T(this,V,n):(T(this,V,"*"),o.unshift(n)),o.forEach(i=>{O(this,P,ue).call(this,M,m(this,V),i)}),this);const{strict:s,...a}=r;Object.assign(this,a),this.getPath=s??!0?r.getPath??bs:nr}route(r,t){const s=this.basePath(r);return t.routes.map(a=>{var o;let n;t.errorHandler===ds?n=a.handler:(n=async(i,c)=>(await us([],t.errorHandler)(i,()=>a.handler(i,c))).res,n[mr]=a.handler),O(o=s,P,ue).call(o,a.method,a.path,n)}),this}basePath(r){const t=O(this,P,Ds).call(this);return t._basePath=ge(this._basePath,r),t}mount(r,t,s){let a,n;s&&(typeof s=="function"?n=s:(n=s.optionHandler,s.replaceRequest===!1?a=c=>c:a=s.replaceRequest));const o=n?c=>{const u=n(c);return Array.isArray(u)?u:[u]}:c=>{let u;try{u=c.executionCtx}catch{}return[c.env,u]};a||(a=(()=>{const c=ge(this._basePath,r),u=c==="/"?0:c.length;return l=>{const d=new URL(l.url);return d.pathname=d.pathname.slice(u)||"/",new Request(d,l)}})());const i=async(c,u)=>{const l=await t(a(c.req.raw),...o(c));if(l)return l;await u()};return O(this,P,ue).call(this,M,ge(r,"*"),i),this}},V=new WeakMap,P=new WeakSet,Ds=function(){const r=new ve({router:this.router,getPath:this.getPath});return r.errorHandler=this.errorHandler,T(r,Y,m(this,Y)),r.routes=this.routes,r},Y=new WeakMap,ue=function(r,t,s){r=r.toUpperCase(),t=ge(this._basePath,t);const a={basePath:this._basePath,path:t,method:r,handler:s};this.router.add(r,t,[s,a]),this.routes.push(a)},$e=function(r,t){if(r instanceof Error)return this.errorHandler(r,t);throw r},qe=function(r,t,s,a){if(a==="HEAD")return(async()=>new Response(null,await O(this,P,qe).call(this,r,t,s,"GET")))();const n=this.getPath(r,{env:s}),o=this.router.match(a,n),i=new lr(r,{path:n,matchResult:o,env:s,executionCtx:t,notFoundHandler:m(this,Y)});if(o[0].length===1){let u;try{u=o[0][0][0][0](i,async()=>{i.res=await m(this,Y).call(this,i)})}catch(l){return O(this,P,$e).call(this,l,i)}return u instanceof Promise?u.then(l=>l||(i.finalized?i.res:m(this,Y).call(this,i))).catch(l=>O(this,P,$e).call(this,l,i)):u??m(this,Y).call(this,i)}const c=us(o[0],this.errorHandler,m(this,Y));return(async()=>{try{const u=await c(i);if(!u.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return u.res}catch(u){return O(this,P,$e).call(this,u,i)}})()},ve),As=[];function Er(e,r){const t=this.buildAllMatchers(),s=((a,n)=>{const o=t[a]||t[M],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],As];const u=c.indexOf("",1);return[o[1][u],c]});return this.match=s,s(e,r)}var Ke="[^/]+",ke=".*",Ce="(?:|/.*)",we=Symbol(),hr=new Set(".\\+*[^]$()");function yr(e,r){return e.length===1?r.length===1?e<r?-1:1:-1:r.length===1||e===ke||e===Ce?1:r===ke||r===Ce?-1:e===Ke?1:r===Ke?-1:e.length===r.length?e<r?-1:1:r.length-e.length}var pe,me,J,Ee,gr=(Ee=class{constructor(){I(this,pe);I(this,me);I(this,J,Object.create(null))}insert(r,t,s,a,n){if(r.length===0){if(m(this,pe)!==void 0)throw we;if(n)return;T(this,pe,t);return}const[o,...i]=r,c=o==="*"?i.length===0?["","",ke]:["","",Ke]:o==="/*"?["","",Ce]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let u;if(c){const l=c[1];let d=c[2]||Ke;if(l&&c[2]&&(d===".*"||(d=d.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(d))))throw we;if(u=m(this,J)[d],!u){if(Object.keys(m(this,J)).some(_=>_!==ke&&_!==Ce))throw we;if(n)return;u=m(this,J)[d]=new Ee,l!==""&&T(u,me,a.varIndex++)}!n&&l!==""&&s.push([l,m(u,me)])}else if(u=m(this,J)[o],!u){if(Object.keys(m(this,J)).some(l=>l.length>1&&l!==ke&&l!==Ce))throw we;if(n)return;u=m(this,J)[o]=new Ee}u.insert(i,t,s,a,n)}buildRegExpStr(){const t=Object.keys(m(this,J)).sort(yr).map(s=>{const a=m(this,J)[s];return(typeof m(a,me)=="number"?`(${s})@${m(a,me)}`:hr.has(s)?`\\${s}`:s)+a.buildRegExpStr()});return typeof m(this,pe)=="number"&&t.unshift(`#${m(this,pe)}`),t.length===0?"":t.length===1?t[0]:"(?:"+t.join("|")+")"}},pe=new WeakMap,me=new WeakMap,J=new WeakMap,Ee),Ve,xe,fs,br=(fs=class{constructor(){I(this,Ve,{varIndex:0});I(this,xe,new gr)}insert(e,r,t){const s=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const u=`@\\${o}`;return a[o]=[u,c],o++,i=!0,u}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return m(this,xe).insert(n,r,s,m(this,Ve),t),s}buildRegExp(){let e=m(this,xe).buildRegExpStr();if(e==="")return[/^$/,[],[]];let r=0;const t=[],s=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(t[++r]=Number(n),"$()"):(o!==void 0&&(s[Number(o)]=++r),"")),[new RegExp(`^${e}`),t,s]}},Ve=new WeakMap,xe=new WeakMap,fs),wr=[/^$/,[],Object.create(null)],Be=Object.create(null);function ks(e){return Be[e]??(Be[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(r,t)=>t?`\\${t}`:"(?:|/.*)")}$`))}function Tr(){Be=Object.create(null)}function Rr(e){var u;const r=new br,t=[];if(e.length===0)return wr;const s=e.map(l=>[!/\*|\/:/.test(l[0]),...l]).sort(([l,d],[_,f])=>l?1:_?-1:d.length-f.length),a=Object.create(null);for(let l=0,d=-1,_=s.length;l<_;l++){const[f,E,y]=s[l];f?a[E]=[y.map(([b])=>[b,Object.create(null)]),As]:d++;let h;try{h=r.insert(E,d,f)}catch(b){throw b===we?new Ns(E):b}f||(t[d]=y.map(([b,g])=>{const j=Object.create(null);for(g-=1;g>=0;g--){const[N,w]=h[g];j[N]=w}return[b,j]}))}const[n,o,i]=r.buildRegExp();for(let l=0,d=t.length;l<d;l++)for(let _=0,f=t[l].length;_<f;_++){const E=(u=t[l][_])==null?void 0:u[1];if(!E)continue;const y=Object.keys(E);for(let h=0,b=y.length;h<b;h++)E[y[h]]=i[E[y[h]]]}const c=[];for(const l in o)c[l]=t[o[l]];return[n,c,a]}function ye(e,r){if(e){for(const t of Object.keys(e).sort((s,a)=>a.length-s.length))if(ks(t).test(r))return[...e[t]]}}var ae,ne,Ye,Cs,Es,Sr=(Es=class{constructor(){I(this,Ye);R(this,"name","RegExpRouter");I(this,ae);I(this,ne);R(this,"match",Er);T(this,ae,{[M]:Object.create(null)}),T(this,ne,{[M]:Object.create(null)})}add(e,r,t){var i;const s=m(this,ae),a=m(this,ne);if(!s||!a)throw new Error(js);s[e]||[s,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[M]).forEach(u=>{c[e][u]=[...c[M][u]]})}),r==="/*"&&(r="*");const n=(r.match(/\/:/g)||[]).length;if(/\*$/.test(r)){const c=ks(r);e===M?Object.keys(s).forEach(u=>{var l;(l=s[u])[r]||(l[r]=ye(s[u],r)||ye(s[M],r)||[])}):(i=s[e])[r]||(i[r]=ye(s[e],r)||ye(s[M],r)||[]),Object.keys(s).forEach(u=>{(e===M||e===u)&&Object.keys(s[u]).forEach(l=>{c.test(l)&&s[u][l].push([t,n])})}),Object.keys(a).forEach(u=>{(e===M||e===u)&&Object.keys(a[u]).forEach(l=>c.test(l)&&a[u][l].push([t,n]))});return}const o=ws(r)||[r];for(let c=0,u=o.length;c<u;c++){const l=o[c];Object.keys(a).forEach(d=>{var _;(e===M||e===d)&&((_=a[d])[l]||(_[l]=[...ye(s[d],l)||ye(s[M],l)||[]]),a[d][l].push([t,n-u+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(m(this,ne)).concat(Object.keys(m(this,ae))).forEach(r=>{e[r]||(e[r]=O(this,Ye,Cs).call(this,r))}),T(this,ae,T(this,ne,void 0)),Tr(),e}},ae=new WeakMap,ne=new WeakMap,Ye=new WeakSet,Cs=function(e){const r=[];let t=e===M;return[m(this,ae),m(this,ne)].forEach(s=>{const a=s[e]?Object.keys(s[e]).map(n=>[n,s[e][n]]):[];a.length!==0?(t||(t=!0),r.push(...a)):e!==M&&r.push(...Object.keys(s[M]).map(n=>[n,s[M][n]]))}),t?Rr(r):null},Es),oe,Z,hs,Ir=(hs=class{constructor(e){R(this,"name","SmartRouter");I(this,oe,[]);I(this,Z,[]);T(this,oe,e.routers)}add(e,r,t){if(!m(this,Z))throw new Error(js);m(this,Z).push([e,r,t])}match(e,r){if(!m(this,Z))throw new Error("Fatal error");const t=m(this,oe),s=m(this,Z),a=t.length;let n=0,o;for(;n<a;n++){const i=t[n];try{for(let c=0,u=s.length;c<u;c++)i.add(...s[c]);o=i.match(e,r)}catch(c){if(c instanceof Ns)continue;throw c}this.match=i.match.bind(i),T(this,oe,[i]),T(this,Z,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(m(this,Z)||m(this,oe).length!==1)throw new Error("No active router has been determined yet.");return m(this,oe)[0]}},oe=new WeakMap,Z=new WeakMap,hs),De=Object.create(null),ie,W,_e,Oe,x,ee,le,je,vr=(je=class{constructor(r,t,s){I(this,ee);I(this,ie);I(this,W);I(this,_e);I(this,Oe,0);I(this,x,De);if(T(this,W,s||Object.create(null)),T(this,ie,[]),r&&t){const a=Object.create(null);a[r]={handler:t,possibleKeys:[],score:0},T(this,ie,[a])}T(this,_e,[])}insert(r,t,s){T(this,Oe,++cs(this,Oe)._);let a=this;const n=er(t),o=[];for(let i=0,c=n.length;i<c;i++){const u=n[i],l=n[i+1],d=tr(u,l),_=Array.isArray(d)?d[0]:u;if(_ in m(a,W)){a=m(a,W)[_],d&&o.push(d[1]);continue}m(a,W)[_]=new je,d&&(m(a,_e).push(d),o.push(d[1])),a=m(a,W)[_]}return m(a,ie).push({[r]:{handler:s,possibleKeys:o.filter((i,c,u)=>u.indexOf(i)===c),score:m(this,Oe)}}),a}search(r,t){var c;const s=[];T(this,x,De);let n=[this];const o=gs(t),i=[];for(let u=0,l=o.length;u<l;u++){const d=o[u],_=u===l-1,f=[];for(let E=0,y=n.length;E<y;E++){const h=n[E],b=m(h,W)[d];b&&(T(b,x,m(h,x)),_?(m(b,W)["*"]&&s.push(...O(this,ee,le).call(this,m(b,W)["*"],r,m(h,x))),s.push(...O(this,ee,le).call(this,b,r,m(h,x)))):f.push(b));for(let g=0,j=m(h,_e).length;g<j;g++){const N=m(h,_e)[g],w=m(h,x)===De?{}:{...m(h,x)};if(N==="*"){const H=m(h,W)["*"];H&&(s.push(...O(this,ee,le).call(this,H,r,m(h,x))),T(H,x,w),f.push(H));continue}const[D,L,S]=N;if(!d&&!(S instanceof RegExp))continue;const A=m(h,W)[D],U=o.slice(u).join("/");if(S instanceof RegExp){const H=S.exec(U);if(H){if(w[L]=H[0],s.push(...O(this,ee,le).call(this,A,r,m(h,x),w)),Object.keys(m(A,W)).length){T(A,x,w);const z=((c=H[0].match(/\//))==null?void 0:c.length)??0;(i[z]||(i[z]=[])).push(A)}continue}}(S===!0||S.test(d))&&(w[L]=d,_?(s.push(...O(this,ee,le).call(this,A,r,w,m(h,x))),m(A,W)["*"]&&s.push(...O(this,ee,le).call(this,m(A,W)["*"],r,w,m(h,x)))):(T(A,x,w),f.push(A)))}}n=f.concat(i.shift()??[])}return s.length>1&&s.sort((u,l)=>u.score-l.score),[s.map(({handler:u,params:l})=>[u,l])]}},ie=new WeakMap,W=new WeakMap,_e=new WeakMap,Oe=new WeakMap,x=new WeakMap,ee=new WeakSet,le=function(r,t,s,a){const n=[];for(let o=0,i=m(r,ie).length;o<i;o++){const c=m(r,ie)[o],u=c[t]||c[M],l={};if(u!==void 0&&(u.params=Object.create(null),n.push(u),s!==De||a&&a!==De))for(let d=0,_=u.possibleKeys.length;d<_;d++){const f=u.possibleKeys[d],E=l[u.score];u.params[f]=a!=null&&a[f]&&!E?a[f]:s[f]??(a==null?void 0:a[f]),l[u.score]=!0}}return n},je),fe,ys,Or=(ys=class{constructor(){R(this,"name","TrieRouter");I(this,fe);T(this,fe,new vr)}add(e,r,t){const s=ws(r);if(s){for(let a=0,n=s.length;a<n;a++)m(this,fe).insert(e,s[a],t);return}m(this,fe).insert(e,r,t)}match(e,r){return m(this,fe).search(e,r)}},fe=new WeakMap,ys),Ls=class extends fr{constructor(e={}){super(e),this.router=e.router??new Ir({routers:[new Sr,new Or]})}},k=e=>{const t={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},s=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(t.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(t.allowMethods);return async function(o,i){var l;function c(d,_){o.res.headers.set(d,_)}const u=await s(o.req.header("origin")||"",o);if(u&&c("Access-Control-Allow-Origin",u),t.credentials&&c("Access-Control-Allow-Credentials","true"),(l=t.exposeHeaders)!=null&&l.length&&c("Access-Control-Expose-Headers",t.exposeHeaders.join(",")),o.req.method==="OPTIONS"){t.origin!=="*"&&c("Vary","Origin"),t.maxAge!=null&&c("Access-Control-Max-Age",t.maxAge.toString());const d=await a(o.req.header("origin")||"",o);d.length&&c("Access-Control-Allow-Methods",d.join(","));let _=t.allowHeaders;if(!(_!=null&&_.length)){const f=o.req.header("Access-Control-Request-Headers");f&&(_=f.split(/\s*,\s*/))}return _!=null&&_.length&&(c("Access-Control-Allow-Headers",_.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),t.origin!=="*"&&o.header("Vary","Origin",{append:!0})}};const Ze={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function jr(){const e=Ze.ENV==="production";return{baseUrl:Ze.TEST_BASE_URL,apiKey:Ze.TEST_API_KEY,isProduction:e}}async function Ms(e,r){const t=jr(),s=`${t.baseUrl}${e}`;try{const a=await fetch(s,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t.apiKey}`},body:JSON.stringify(r)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function Nr(e){try{const r={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((s,a)=>({SerialNum:a+1,ItemName:s.name,Qty:s.quantity,UnitPrice:s.unitPrice,SupplyCost:s.supplyPrice,Tax:s.taxAmount,Remark:s.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},t=await Ms("/eTaxInvoice/RegistAndIssue",r);if(t.code!==1)throw new Error(`바로빌 발행 실패: ${t.message}`);return{success:!0,ntsConfirmNumber:t.ntsconfirmNum,invoiceKey:t.invoiceKey,message:t.message}}catch(r){throw console.error("바로빌 세금계산서 발행 실패:",r),r}}async function Dr(e,r,t){try{const a=await Ms("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:r,Memo:t});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(s){throw console.error("바로빌 세금계산서 취소 실패:",s),s}}function Ae(){return!1}async function Ar(e){return await Nr(e)}function kr(e,r,t){const s=Number(r.total_amount),a=Math.floor(s/1.1),n=s-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:r.buyer_business_number,buyerBusinessName:r.buyer_business_name||r.user_name,buyerCEO:r.buyer_ceo_name,buyerAddress:r.shipping_address,buyerEmail:r.user_email,buyerTel:r.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:t.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),u=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:u,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:s,memo:`주문번호: ${r.order_number}`,orderNo:r.order_number}}class K extends Error{constructor(r,t,s){super(r),this.statusCode=t,this.code=s,this.name="AuthError"}}function Cr(e){return`${crypto.randomUUID()}-${e}`}function Lr(e){var n,o,i,c,u,l,d;const r=e.id.toString(),t=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",s=((c=e.kakao_account)==null?void 0:c.email)||null,a=((u=e.properties)==null?void 0:u.profile_image)||((d=(l=e.kakao_account)==null?void 0:l.profile)==null?void 0:d.profile_image_url)||null;return{kakaoId:r,nickname:t,email:s,profileImage:a}}async function Mr(e,r,t,s,a){try{await e.prepare(`
      INSERT OR IGNORE INTO users (
        kakao_id, name, email, profile_image, 
        created_at, last_login_at, updated_at
      )
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `).bind(r,t,s,a).run(),await e.prepare(`
      UPDATE users 
      SET name = ?, 
          email = ?, 
          profile_image = ?,
          last_login_at = datetime('now'),
          updated_at = datetime('now')
      WHERE kakao_id = ?
    `).bind(t,s,a,r).run();const n=await e.prepare(`
      SELECT id, kakao_id, name, email, profile_image
      FROM users
      WHERE kakao_id = ?
      LIMIT 1
    `).bind(r).first();if(!n)throw new K("Failed to retrieve user after upsert",500,"UPSERT_FAILED");return console.log("[Auth] User upserted successfully:",n.id),n}catch(n){throw n instanceof K?n:(console.error("[Auth] Database error during upsert:",n),new K("Database error",500,"DB_ERROR"))}}async function Pr(e){try{const r=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!r.ok){const s=await r.text();throw console.error("[Kakao API] Failed to get user info:",s),new K("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const t=await r.json();if(!t.id)throw new K("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return t}catch(r){throw r instanceof K?r:(console.error("[Kakao API] Network error:",r),new K("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function Hr(e,r,t){try{const s=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:t,redirect_uri:r,code:e}).toString()});if(!s.ok){const n=await s.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new K(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await s.json()).access_token}catch(s){throw s instanceof K?s:(console.error("[Kakao OAuth] Network error:",s),new K("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function Ps(e,r){const t=await Pr(r),{kakaoId:s,nickname:a,email:n,profileImage:o}=Lr(t);console.log("[Auth] Processing login for Kakao user:",s);const i=await Mr(e,s,a,n,o),c=Cr(i.id);return{user:i,sessionToken:c}}function Ur(e){const r=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:r,message:"API Request",context:e,duration:e.duration}))}function xr(e){return{name:"tosspayments",async confirmPayment(r){try{const t=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:r.paymentKey,orderId:r.orderId,amount:r.amount})}),s=await t.json();if(!t.ok)return{success:!1,orderId:r.orderId,paymentKey:r.paymentKey,method:"",totalAmount:r.amount,status:"FAILED",approvedAt:"",error:s.message||"결제 승인 실패",rawData:s};let a={};s.card&&(a={cardCompany:s.card.company,cardNumber:s.card.number,installmentMonths:s.card.installmentPlanMonths||0});let n={};return s.virtualAccount&&(n={virtualAccountBank:s.virtualAccount.bankCode,virtualAccountNumber:s.virtualAccount.accountNumber,virtualAccountHolder:s.virtualAccount.customerName,virtualAccountDueDate:s.virtualAccount.dueDate}),{success:!0,orderId:s.orderId,paymentKey:s.paymentKey,method:s.method,totalAmount:s.totalAmount,status:s.status,approvedAt:s.approvedAt,transactionId:s.transactionKey,...a,...n,rawData:s}}catch(t){return{success:!1,orderId:r.orderId,paymentKey:r.paymentKey,method:"",totalAmount:r.amount,status:"FAILED",approvedAt:"",error:t.message,rawData:null}}},async cancelPayment(r){try{const t={cancelReason:r.cancelReason};r.cancelAmount&&(t.cancelAmount=r.cancelAmount);const s=await fetch(`https://api.tosspayments.com/v1/payments/${r.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(t)}),a=await s.json();return s.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(t){return{success:!1,error:t.message}}},async getPayment(r){try{const t=await fetch(`https://api.tosspayments.com/v1/payments/${r}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),s=await t.json();if(!t.ok)throw new Error(s.message);return{success:!0,orderId:s.orderId,paymentKey:s.paymentKey,method:s.method,totalAmount:s.totalAmount,status:s.status,approvedAt:s.approvedAt,rawData:s}}catch(t){throw t}}}}function Fr(e,r){switch(e.toLowerCase()){case"tosspayments":return xr(r);default:throw new Error(`Unknown payment provider: ${e}`)}}const p=new Ls;async function Wr(e,r){if(!r)return null;try{const t=await e.get(`session:${r}`);return t&&JSON.parse(t).user_id||null}catch(t){return console.error("[Auth] Session lookup error:",t),null}}async function he(e,r){var n;const{SESSION_KV:t}=e.env;let s=(n=e.req.header("Authorization"))==null?void 0:n.replace("Bearer ","");if(!s){const o=e.req.header("Cookie");if(o){const i=o.match(/session=([^;]+)/);s=i?i[1]:void 0}}const a=await Wr(t,s);if(!a)return e.json({success:!1,error:"인증이 필요합니다. 로그인 해주세요."},401);e.set("userId",a),await r()}async function rs(e,r){try{const t=await e.get(r);return t?JSON.parse(t):null}catch(t){return console.error("[Cache] Read error:",t),null}}async function ts(e,r,t,s=60){try{await e.put(r,JSON.stringify(t),{expirationTtl:s})}catch(a){console.error("[Cache] Write error:",a)}}async function as(e,...r){try{await Promise.all(r.map(t=>e.delete(t)))}catch(t){console.error("[Cache] Delete error:",t)}}async function ns(e,r,t,s,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(r,t,s,a,n,o||null).run(),console.log(`[Notification] Created for ${t} ${r}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function $r(e,r,t,s,a){await ns(e,r,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${s}님의 주문 (${t}) - ${Br(a)}`,"/seller/orders")}async function Hs(e,r,t,s,a,n){let o="",i="";switch(s){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${t}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${t}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${t}가 배송 완료되었습니다`;break;default:return}await ns(e,r,"user","shipping_status",o,i,"/my-orders")}async function qr(e,r,t,s,a){await ns(e,r,"seller","low_stock","⚠️ 재고 부족 알림",`${t}의 재고가 ${s}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function Br(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}function Us(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const r=new URL(e);if(r.hostname.includes("youtube.com")){const t=r.searchParams.get("v");if(t)return t;const s=r.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(s)return s[2]}if(r.hostname==="youtu.be"){const t=r.pathname.slice(1).split("?")[0];if(t&&t.length===11)return t}return null}catch{return null}}function xs(e){try{const r=new URL(e);if(r.hostname.includes("tiktok.com")){const t=r.pathname.match(/\/video\/(\d+)/);if(t)return t[1];const s=r.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(s)return s[1]}return r.hostname.includes("vm.tiktok.com")||r.hostname.includes("vt.tiktok.com")?r.pathname.slice(1):null}catch{return null}}function Kr(e){try{const r=new URL(e);if(r.hostname.includes("tiktok.com")){if(r.pathname.includes("/live"))return"live";if(r.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Fs(e){try{const r=new URL(e);if(r.hostname.includes("tiktok.com")){const t=r.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(t)return t[1]}return r.hostname.includes("vm.tiktok.com")||r.hostname.includes("vt.tiktok.com")?r.pathname.slice(1):null}catch{return null}}p.use("*",async(e,r)=>{await r(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const t=new URL(e.req.url);t.hostname!=="localhost"&&t.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",k());p.use("/api/*",async(e,r)=>{const t=Date.now(),s=e.req.method,a=e.req.path;await r();const n=Date.now()-t,o=e.res.status,i={method:s,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),Ur(i)});p.use("/static/*",async(e,r)=>{await r(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/images/*",async(e,r)=>{await r(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});async function Ws(e,r,t,s){const a=`${t}_${r}_${Date.now()}_${Math.random().toString(36).substring(7)}`,n=Date.now()+1440*60*1e3,o={userId:r,userType:t,userData:s,expiresAt:n};return await e.put(`session:${a}`,JSON.stringify(o),{expirationTtl:86400}),a}async function Ne(e,r){const t=await e.get(`session:${r}`);if(!t)return null;const s=JSON.parse(t);return s.expiresAt&&Date.now()>s.expiresAt?(await e.delete(`session:${r}`),null):{session_token:r,[`${s.userType}_id`]:s.userId,user_type:s.userType,...s.userData}}p.post("/api/auth/user/register",k(),async e=>{const{DB:r}=e.env;try{const{email:t,password:s,name:a,phone:n}=await e.req.json();if(!t||!s||!a)return e.json({success:!1,error:"이메일, 비밀번호, 이름은 필수입니다"},400);if(await r.prepare("SELECT id FROM users WHERE email = ?").bind(t).first())return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);const i=`placeholder_hash_for_${s}`,u=(await r.prepare(`
      INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,i,a,n||null).run()).meta.last_row_id,l=`user_${u}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:l,user:{id:u,email:t,name:a,phone:n}}})}catch(t){return console.error("[User Register] Error:",t),e.json({success:!1,error:t.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/auth/user/login",k(),async e=>{const{DB:r}=e.env;try{const{email:t,password:s}=await e.req.json();if(!t||!s)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await r.prepare("SELECT * FROM users WHERE email = ?").bind(t).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${s}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await r.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(a.id).run();const o=`user_${a.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:o,user:{id:a.id,email:a.email,name:a.name,phone:a.phone,profile_image:a.profile_image}}})}catch(t){return console.error("[User Login] Error:",t),e.json({success:!1,error:t.message||"로그인 중 오류가 발생했습니다"},500)}});p.post("/api/auth/login",k(),async e=>{const{DB:r}=e.env;try{const{username:t,password:s,userType:a}=await e.req.json();if(!t||!s||!a)return e.json({success:!1,error:"아이디와 비밀번호를 입력해주세요"},400);let n,o=a==="admin"?"admins":"sellers";if(n=await r.prepare(`SELECT * FROM ${o} WHERE username = ? OR email = ?`).bind(t,t).first(),!n)return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);const i=a==="admin"&&(t==="admin"||t==="admin@example.com")&&s==="admin123",c=a==="seller"&&(t==="seller1"&&s==="seller123"||t==="seller2"&&s==="seller123"),u=n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${s}`);if(!(i||c||u))return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);if(!n.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(a==="seller"&&n.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다"},403);const d=await Ws(e.env.SESSION_KV,n.id,a,{username:n.username,name:n.name,email:n.email,businessName:n.business_name,role:n.role});return await r.prepare(`UPDATE ${o} SET last_login_at = datetime('now') WHERE id = ?`).bind(n.id).run(),e.json({success:!0,data:{sessionToken:d,user:{id:n.id,username:n.username,name:n.name,email:n.email,type:a,businessName:n.business_name,role:n.role}}})}catch(t){return console.error("Login error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/auth/logout",k(),async e=>{const{DB:r}=e.env;try{const t=e.req.header("X-Session-Token");return t&&await e.env.SESSION_KV.delete(`session:${t}`),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/register",k(),async e=>{const{DB:r}=e.env;try{const{email:t,password:s,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!t||!s||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(s.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);if(await r.prepare("SELECT id FROM sellers WHERE email = ?").bind(t).first())return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);const u=t.split("@")[0],l=`placeholder_hash_for_${s}`,d=await r.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, phone, 
        business_number, company_name, status, is_active, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
    `).bind(u,t,l,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:d.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(t){return console.error("Seller registration error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/admin/login",k(),async e=>{const{DB:r}=e.env;try{const{email:t,password:s}=await e.req.json();if(!t||!s)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await r.prepare("SELECT * FROM admins WHERE email = ?").bind(t).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(t==="admin@example.com"&&s==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${s}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=await Ws(e.env.SESSION_KV,a.id,"admin",{username:a.username,email:a.email,name:a.name,role:a.role});return await r.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),e.json({success:!0,data:{token:i,admin:{id:a.id,username:a.username,email:a.email,name:a.name,role:a.role}}})}catch(t){return console.error("Admin login error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/auth/verify",k(),async e=>{const{DB:r}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const s=await Ne(e.env.SESSION_KV,t);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=s.user_type==="admin"?"admins":"sellers",n=s.user_type==="admin"?s.admin_id:s.seller_id,o=await r.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:s.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name,role:o.role}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/auth/kakao/sync/callback",async e=>{var t,s,a,n,o,i,c,u,l,d,_,f,E;const{DB:r}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!r);const y=e.req.query("code"),h=e.req.query("state")||"/",b=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!y,state:h,error:b}),b)return console.error("[Kakao Sync] OAuth error:",b),e.redirect(`${h}?error=kakao_oauth_${b}`);if(!y)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${h}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const g=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",j=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",g.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",j),console.log("[Kakao Sync] Step 1: Fetching access token...");const N=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:g,redirect_uri:j,code:y})});if(console.log("[Kakao Sync] Token response status:",N.status),console.log("[Kakao Sync] Token request details:",{client_id:g,redirect_uri:j,code_length:y.length,code_prefix:y.substring(0,20)}),!N.ok){const $=await N.text();return console.error("[Kakao Sync] Token request failed:",$),e.redirect(`${h}?error=token_request_failed&detail=${encodeURIComponent($)}`)}const w=await N.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!w.access_token,error:w.error,errorDescription:w.error_description}),!w.access_token)return console.error("[Kakao Sync] Token error:",w),e.redirect(`${h}?error=token_failed&detail=${encodeURIComponent(w.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const D=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${w.access_token}`}});console.log("[Kakao Sync] User response status:",D.status);const L=await D.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!L.id,id:L.id,hasNickname:!!((t=L.properties)!=null&&t.nickname||(a=(s=L.kakao_account)==null?void 0:s.profile)!=null&&a.nickname)}),!L.id)return console.error("[Kakao Sync] Failed to get user info:",L),e.redirect(`${h}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const S=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${w.access_token}`}});console.log("[Kakao Sync] Terms response status:",S.status);let A=null;if(S.ok?(A=await S.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=A.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=A.allowed_service_terms)==null?void 0:o.map($=>$.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!r)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${h}?error=db_not_available`);const U=L.id.toString(),H=((i=L.properties)==null?void 0:i.nickname)||((u=(c=L.kakao_account)==null?void 0:c.profile)==null?void 0:u.nickname)||"Kakao User",z=((l=L.kakao_account)==null?void 0:l.email)||"",Fe=((d=L.properties)==null?void 0:d.profile_image)||((f=(_=L.kakao_account)==null?void 0:_.profile)==null?void 0:f.profile_image_url)||"",Je=w.access_token,F=((E=A==null?void 0:A.allowed_service_terms)==null?void 0:E.map($=>$.tag))||[],ce=JSON.stringify(F);console.log("[Kakao Sync] User data:",{kakaoId:U,nickname:H,email:z?"exists":"none",serviceTerms:F});try{const $=await r.prepare("SELECT * FROM users WHERE kakao_id = ?").bind(U).first();console.log("[Kakao Sync] Existing user check:",!!$);let G;$?(G=$.id,await r.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(H,z,Fe,G).run(),console.log("[Kakao Sync] Updated user:",G)):(G=(await r.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(U,H,z||null,Fe||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",G)),console.log("[Kakao Sync] User saved successfully, userId:",G),console.log("[Kakao Sync] Step 4: Creating session...");const{SESSION_KV:Bs}=e.env,ze=crypto.randomUUID(),Ks=Date.now()+1440*60*1e3;await Bs.put(`session:${ze}`,JSON.stringify({user_id:G,user_type:"user",expires_at:Ks}),{expirationTtl:1440*60}),console.log("[Kakao Sync] Session created successfully in SESSION_KV"),console.log("[Kakao Sync] Step 5: Redirecting...");const os=h.includes("?")?`${h}&login=success&session=${ze}&userId=${G}&userName=${encodeURIComponent(H)}`:`${h}?login=success&session=${ze}&userId=${G}&userName=${encodeURIComponent(H)}`;return console.log("[Kakao Sync] Redirect URL:",os),e.redirect(os)}catch($){return console.error("[Kakao Sync] Database error:",$),console.error("[Kakao Sync] DB error details:",{message:$.message,name:$.name}),e.redirect(`${h}?error=database_error&detail=${encodeURIComponent($.message)}`)}}catch(y){console.error("[Kakao Sync] Exception:",y),console.error("[Kakao Sync] Error details:",{message:y.message,stack:y.stack,name:y.name});const h=e.req.query("state")||"/",b=encodeURIComponent(y.message||"unknown");return e.redirect(`${h}?error=kakao_sync_failed&detail=${b}`)}});p.post("/api/auth/kakao/callback",k(),async e=>{const{DB:r}=e.env;try{const{code:t,redirect_uri:s}=await e.req.json();if(!t)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=s||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow");const n=await Hr(t,a,e.env.KAKAO_REST_API_KEY),{user:o,sessionToken:i}=await Ps(r,n);return e.json({success:!0,data:{session_token:i,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image}}})}catch(t){return console.error("[Kakao Callback] Error:",t),t instanceof K?e.json({success:!1,error:t.message,code:t.code},t.statusCode):e.json({success:!1,error:t.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/sync",k(),async e=>{const{DB:r}=e.env;try{const{accessToken:t}=await e.req.json();if(!t)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Sync] Verifying access token");const{user:s,sessionToken:a}=await Ps(r,t);return console.log("[Kakao Sync] Login successful"),e.json({success:!0,data:{session_token:a,user:{id:s.id,name:s.name,email:s.email,profile_image:s.profile_image}}})}catch(t){return console.error("[Kakao Sync] Error:",t),t instanceof K?e.json({success:!1,error:t.message,code:t.code},t.statusCode):e.json({success:!1,error:t instanceof Error?t.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/logout",k(),async e=>{const{DB:r}=e.env;try{const t=e.req.header("X-Session-Token")||"";return t&&(await r.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(t){return console.error("[Kakao Sync] Logout error:",t),e.json({success:!1,error:"Logout failed"},500)}});p.post("/api/auth/kakao/unlink",k(),async e=>{const{DB:r}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await r.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(t).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await r.prepare(`
      SELECT * FROM users WHERE id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(t).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const n=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),o=await n.json();n.ok?console.log("[Kakao Unlink] Kakao unlink successful:",o.id):console.warn("[Kakao Unlink] Kakao unlink failed:",o)}catch(n){console.error("[Kakao Unlink] Kakao API error:",n)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await r.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(),console.log("[Kakao Unlink] Sessions deleted"),await r.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await r.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(t){return console.error("[Kakao Unlink] Error:",t),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});p.post("/webhooks/kakao/unlink",async e=>{const{DB:r}=e.env;try{const t=await e.req.json(),{user_id:s,referrer_type:a}=t;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:s,referrer_type:a}),!s)return e.json({success:!1,error:"user_id is required"},400);const n=await r.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(s.toString()).first();return n?(console.log("[Kakao Webhook] Deleting user data for user:",n.id),await r.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await r.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await r.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",s),e.json({success:!0}))}catch(t){return console.error("[Kakao Webhook] Error:",t),e.json({success:!1,error:"Webhook processing failed"},500)}});p.get("/api/auth/user/verify",k(),async e=>{const{DB:r}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const s=await Ne(e.env.SESSION_KV,t);if(!s||s.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=parseInt(t.split("_")[1]),n=await r.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();return n?e.json({success:!0,data:{user:{id:n.id,name:n.name,email:n.email,profileImage:n.profile_image,phone:n.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/shipping-addresses",k(),he,async e=>{const{DB:r}=e.env,t=e.get("userId");try{const s=await r.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(t).all();return e.json({success:!0,data:s.results||[]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/shipping-addresses/:userId",k(),he,async e=>{const{DB:r}=e.env,t=e.get("userId"),s=parseInt(e.req.param("userId"));try{if(s!==t)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await r.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/shipping-addresses",k(),async e=>{const{DB:r}=e.env;try{const t=await e.req.json(),s=t.user_id,a=t.recipient_name,n=t.phone,o=t.postal_code,i=t.address,c=t.address_detail,u=t.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(t)),!s||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:s,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);u&&await r.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(s).run();const l=await r.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s,a,n,o||"",i,c||"",u?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:l.meta.last_row_id}),e.json({success:!0,data:{id:l.meta.last_row_id}})}catch(t){return console.error("[POST /api/shipping-addresses] Error:",t),e.json({success:!1,error:t.message},500)}});p.put("/api/shipping-addresses/:id",k(),async e=>{const{DB:r}=e.env;try{const t=e.req.param("id"),s=await e.req.json(),a=s.user_id,n=s.recipient_name,o=s.phone,i=s.postal_code,c=s.address,u=s.address_detail,l=s.is_default;return l&&await r.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await r.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,u||"",l?1:0,t,a).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/shipping-addresses/:id",k(),async e=>{const{DB:r}=e.env;try{const t=e.req.param("id"),s=e.req.query("userId");return await r.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t,s).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});async function C(e){const r=e.req.header("X-Session-Token");if(!r)return{success:!1,error:"인증 토큰이 없습니다"};const t=await Ne(e.env.SESSION_KV,r);return!t||t.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:t.admin_id,userData:t}}async function v(e){const r=e.req.header("X-Session-Token");if(!r)return{success:!1,error:"인증 토큰이 없습니다"};const t=await Ne(e.env.SESSION_KV,r);return!t||t.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:t.seller_id,userData:t}}p.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));p.get("/api/streams",async e=>{const{DB:r,CACHE_KV:t}=e.env;try{const s="streams:live",a=await t.get(s,"json");if(a)return e.json({success:!0,data:a,cached:!0});const n=await r.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();return await t.put(s,JSON.stringify(n.results),{expirationTtl:600}),e.json({success:!0,data:n.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/streams/:id",async e=>{const{DB:r}=e.env,t=e.req.param("id");try{const s=await r.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(t).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"Stream not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/live-streams",async e=>{const{DB:r}=e.env,{status:t,seller_id:s,limit:a="20",offset:n="0"}=e.req.query();try{let o=`
      SELECT ls.*, 
             s.display_name as seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE 1=1
    `;const i=[];t&&(o+=" AND ls.status = ?",i.push(t)),s&&(o+=" AND ls.seller_id = ?",i.push(s)),o+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',o+=" LIMIT ? OFFSET ?",i.push(parseInt(a),parseInt(n));const{results:c}=await r.prepare(o).bind(...i).all();return e.json({success:!0,data:c})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});p.get("/api/live-streams/:id",async e=>{const{DB:r}=e.env,t=e.req.param("id");try{const s=await r.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(t).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"Stream not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/products",async e=>{const{DB:r,CACHE_KV:t}=e.env;try{const s=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${s||"all"}:${a}:${n}`,i=await rs(t,o);if(i)return e.json({success:!0,data:i,cached:!0});let c;s==="true"?c=`
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
      `;const l=(await r.prepare(c).bind(a,n).all()).results||[];return await ts(t,o,l,300),e.json({success:!0,data:l,cached:!1})}catch(s){return console.error("Products list error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/products/popular",async e=>{const{DB:r,CACHE_KV:t}=e.env;try{const s=await rs(t,"products:popular");if(s)return e.json({success:!0,data:s,cached:!0});const n=(await r.prepare(`
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
    `).all()).results||[];return await ts(t,"products:popular",n,600),e.json({success:!0,data:n,cached:!1})}catch(s){return console.error("Popular products error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/search/suggestions",async e=>{const{DB:r}=e.env;try{const t=e.req.query("q")||"";if(!t.trim()||t.length<2)return e.json({success:!0,data:{suggestions:[]}});const s=`%${t}%`,a=await r.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(s).all(),n=await r.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(s,s).all(),o=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(n.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:o}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/products/search",async e=>{const{DB:r}=e.env;try{const t=e.req.query("q")||"",s=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!t.trim())return e.json({success:!1,error:"Search query is required"},400);const n=`%${t}%`,o=await r.prepare(`
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
    `).bind(n,n,n,s,a).all(),i=await r.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
    `).bind(n,n,n).first();return e.json({success:!0,data:{products:o.results||[],total:(i==null?void 0:i.total)||0,query:t,limit:s,offset:a}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/products/:id",async e=>{const{DB:r}=e.env,t=e.req.param("id");try{const s=await r.prepare(`
      SELECT 
        p.*,
        COALESCE(s.name, s.username, 'UR Live') as seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ? AND p.is_active = 1
    `).bind(t).first();if(!s)return e.json({success:!1,error:"Product not found"},404);const a=await r.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(t).all();return e.json({success:!0,data:{product:s,options:a.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/products/:id/stock",async e=>{const{DB:r}=e.env,t=e.req.param("id");try{const s=await r.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(t).first();return s?e.json({success:!0,data:{productId:s.id,productName:s.name,stock:s.stock,available:s.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/streams/:streamId/products",async e=>{const{DB:r}=e.env,t=e.req.param("streamId");try{const s=await r.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(t).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/cart",he,async e=>{const{DB:r}=e.env,t=e.get("userId");try{const s=await r.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:`장바구니 조회 실패: ${s.message}`},500)}});p.get("/api/cart/:userId",he,async e=>{const{DB:r}=e.env,t=e.get("userId"),s=e.req.param("userId");try{let a=await r.prepare("SELECT id FROM users WHERE id = ?").bind(t).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(s!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await r.prepare(`
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
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/users",async e=>{const{DB:r}=e.env;try{const t=await e.req.json(),{kakaoId:s,name:a,email:n,phone:o}=t;if(!s||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await r.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(s).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await r.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(s,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(t){return console.error("Error creating user:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/cart",async e=>{const{DB:r}=e.env;try{const t=await e.req.json(),{userId:s,kakaoId:a,productId:n,optionId:o,quantity:i,priceSnapshot:c,liveStreamId:u}=t,l=a||s;if(!l)return e.json({success:!1,error:"userId or kakaoId is required"},400);let d=await r.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();if(d||(d=await r.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()),!d)return e.json({success:!1,error:"User not found"},404);const _=d.id,f=await r.prepare("SELECT stock FROM products WHERE id = ?").bind(n).first();if(!f||f.stock<i)return e.json({success:!1,error:"Insufficient stock"},400);const E=await r.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(_,n,o||null,o||null).first();let y;if(E){const h=E.quantity+i;await r.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(h,c,E.id).run(),y=E.id}else y=(await r.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(_,n,o||null,i,c,u||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:y,isUpdate:!!E}})}catch(t){return console.error("[API /api/cart POST] Error:",t),console.error("[API /api/cart POST] Error message:",t.message),console.error("[API /api/cart POST] Error stack:",t.stack),e.json({success:!1,error:"Failed to add to cart: "+(t.message||"Unknown error")},500)}});p.delete("/api/cart/:cartItemId",async e=>{const{DB:r}=e.env,t=e.req.param("cartItemId");try{return await r.prepare("DELETE FROM cart_items WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/cart/clear/:userId",async e=>{const{DB:r}=e.env,t=e.req.param("userId");try{return await r.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(t).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/cart/:cartItemId",async e=>{const{DB:r}=e.env,t=e.req.param("cartItemId");try{const s=await e.req.json(),{quantity:a}=s;if(!a||a<1)return e.json({success:!1,error:"Invalid quantity"},400);const n=await r.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(t).first();return n?n.stock<a?e.json({success:!1,error:"Insufficient stock"},400):(await r.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,t).run(),e.json({success:!0})):e.json({success:!1,error:"Cart item not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders",async e=>{const{DB:r}=e.env;try{const t=await e.req.json(),{userId:s,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:u,recipientPhone:l,deliveryMemo:d,totalAmount:_,shippingFee:f,orderNumber:E,paymentKey:y,paymentMethod:h}=t;if(o&&o.length>0){const S=[];for(const F of o){const ce=await r.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind(F.productId).first();if(!ce)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${F.productId})`},400);if(ce.stock<F.quantity)return e.json({success:!1,error:`재고 부족: ${ce.name} (남은 재고: ${ce.stock}개)`},400);S.push({product_id:F.productId,option_id:F.optionId||null,quantity:F.quantity,price:F.price,product_name:ce.name,product_stock:ce.stock})}const A=Date.now(),U=Math.random().toString(36).substring(2,8).toUpperCase(),H=E||`ORDER_${A}_${U}`,z=c?`${i} ${c}`:i,Je=(await r.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(H,s||null,_||0,"pending","pending",z||null,u||null,l||null,d||null,y||null).run()).meta.last_row_id;for(const F of S)await r.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Je,F.product_id,F.option_id,F.quantity,F.price,F.product_name).run();return e.json({success:!0,data:{orderId:Je,orderNumber:H,totalAmount:_}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const b=a.map(()=>"?").join(","),g=await r.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${b})
    `).bind(...a).all();if(g.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const S of g.results)if(S.product_stock<S.quantity)return e.json({success:!1,error:`Insufficient stock for ${S.product_name}`},400);const j=g.results.reduce((S,A)=>S+A.price_snapshot*A.quantity,0),N=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,D=(await r.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(N,s,j,n.address,n.name,n.phone).run()).meta.last_row_id,L=[];for(const S of g.results){if((await r.prepare(`
        UPDATE products 
        SET stock = stock - ?, 
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ? 
          AND stock >= ?
          AND is_active = 1
      `).bind(S.quantity,S.product_id,S.quantity).run()).meta.changes===0){const U=await r.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(S.product_id).first();if(!U||U.stock<S.quantity)return e.json({success:!1,error:`재고 부족: ${S.product_name} (남은 재고: ${(U==null?void 0:U.stock)||0}개)`},400);if((await r.prepare(`
            UPDATE products 
            SET stock = stock - ?, 
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ? 
              AND stock >= ?
          `).bind(S.quantity,S.product_id,S.quantity).run()).meta.changes===0)return e.json({success:!1,error:"주문 처리 중 오류 발생. 다시 시도해주세요."},409)}L.push(r.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(D,S.product_id,S.option_id,S.quantity,S.price_snapshot,S.product_name))}L.push(r.prepare(`DELETE FROM cart_items WHERE id IN (${b})`).bind(...a)),await r.batch(L);try{const S=new Set;for(const A of g.results){const U=await r.prepare("SELECT seller_id FROM products WHERE id = ?").bind(A.product_id).first();U&&U.seller_id&&S.add(U.seller_id)}for(const A of S)await $r(r,A,N,buyerName||shippingName||"고객",j)}catch(S){console.error("[Order] Notification error:",S)}return e.json({success:!0,data:{orderId:D,orderNumber:N,totalAmount:j}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/streams/:streamId/current-product",async e=>{const{DB:r}=e.env,t=e.req.param("streamId");try{const s=await r.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(t).first();if(!s||!s.current_product_id)return e.json({success:!0,data:null});const a=await r.prepare("SELECT * FROM products WHERE id = ?").bind(s.current_product_id).first(),n=await r.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s.current_product_id).all();return e.json({success:!0,data:{product:a,options:n.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/streams",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=t.sellerId,a=await r.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(s).all();return e.json({success:!0,data:a.results||[]})}catch(s){return console.error("Error loading seller streams:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/streams",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:s,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:u,seller_instagram:l,seller_youtube:d,seller_facebook:_}=await e.req.json();let f=n,E="youtube",y=null,h=null,b=i;if(o&&!f&&(f=Us(o),!f))if(f=xs(o),y=Fs(o),h=Kr(o),f)E="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!b&&f&&E==="youtube"&&(b=`https://img.youtube.com/vi/${f}/maxresdefault.jpg`),!s||!f)return e.json({success:!1,error:"Title and live stream URL are required"},400);const g=await r.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s,a||null,f,u||"scheduled",c||null,t.sellerId,l||null,d||null,_||null,E,y,h,b||null).run(),j=await r.prepare("SELECT * FROM live_streams WHERE id = ?").bind(g.meta.last_row_id).first(),N=await r.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(t.sellerId).first();try{const{sendLiveStreamCreatedEmail:w}=await Promise.resolve().then(()=>Gr);w({streamId:g.meta.last_row_id,title:s,sellerName:(N==null?void 0:N.display_name)||(N==null?void 0:N.username)||"알 수 없음",platform:E,scheduledAt:c,status:u||"scheduled"}).then(D=>{D.success?console.log(`[Email] Live stream notification sent for stream #${D.meta.last_row_id}`):console.error("[Email] Failed to send notification:",D.error)}).catch(D=>{console.error("[Email] Exception while sending notification:",D)})}catch(w){console.error("[Email] Failed to send live stream notification:",w)}return e.json({success:!0,data:j})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/streams/:id",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id");if(!await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:u,status:l,seller_instagram:d,seller_youtube:_,seller_facebook:f}=await e.req.json(),E=[],y=[];if(n!==void 0&&(E.push("title = ?"),y.push(n)),o!==void 0&&(E.push("description = ?"),y.push(o)),c!==void 0||i!==void 0){let h=i,b="youtube",g=null;if(c&&(h=Us(c),!h))if(h=xs(c),g=Fs(c),h)b="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);h!==void 0&&(E.push("youtube_video_id = ?"),y.push(h),E.push("platform = ?"),y.push(b),b==="tiktok"&&g&&(E.push("tiktok_username = ?"),y.push(g)))}return l!==void 0&&(E.push("status = ?"),y.push(l)),u!==void 0&&(E.push("scheduled_at = ?"),y.push(u)),d!==void 0&&(E.push("seller_instagram = ?"),y.push(d)),_!==void 0&&(E.push("seller_youtube = ?"),y.push(_)),f!==void 0&&(E.push("seller_facebook = ?"),y.push(f)),E.length===0?e.json({success:!1,error:"No fields to update"},400):(E.push("updated_at = datetime('now')"),await r.prepare(`
      UPDATE live_streams SET ${E.join(", ")} WHERE id = ?
    `).bind(...y,s).run(),e.json({success:!0}))}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/streams/:id",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id");return await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).first()?(await r.prepare("DELETE FROM live_streams WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/streams",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:s,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!s)return e.json({success:!1,error:"제목은 필수입니다"},400);const u=o||"youtube";if(u==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(u==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const l=await r.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(s,a||null,n||null,u,i||null,c||"scheduled",t.sellerId||null).run();return e.json({success:!0,data:{id:l.meta.last_row_id,title:s,description:a,youtube_video_id:n,platform:u,tiktok_username:i,status:c||"scheduled"}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/streams/:id",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:u}=await e.req.json();return await r.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,u,s).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1").bind(a,t.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await r.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();return await r.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,s).run(),e.json({success:!0,data:{product:o,options:i.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/admin/streams/:id",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id");return await r.prepare("DELETE FROM live_streams WHERE id = ?").bind(s).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:r}=e.env,t=e.req.param("streamId");try{const{productId:s}=await e.req.json(),a=await r.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(s).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await r.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s).all();return await r.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(s,t).run(),e.json({success:!0,data:{product:a,options:n.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/shipping-addresses/:id",he,async e=>{const{DB:r}=e.env,t=e.req.param("id");e.get("userId");try{return await r.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t,userId).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products",async e=>{const{DB:r,CACHE_KV:t}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const a=`seller:${s.sellerId}:products`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await r.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(s.sellerId).all();return await t.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/seller/products",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{name:s,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:u,category:l,live_stream_id:d,is_active:_}=await e.req.json();if(!s||!n)return e.json({success:!1,error:"Name and price are required"},400);if(d&&!await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d,t.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const f=await r.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(s,a||null,n,o||null,i||0,c||null,u||0,l||null,d||null,t.sellerId,_!==void 0?_:1).run(),E=await r.prepare("SELECT * FROM products WHERE id = ?").bind(f.meta.last_row_id).first();return await as(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0,data:E})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products/:id",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),a=await r.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(s,t.sellerId).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/products/:id",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id");if(!await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:u,stock:l,category:d,is_active:_}=await e.req.json(),f=[],E=[];if(n!==void 0&&(f.push("name = ?"),E.push(n)),o!==void 0&&(f.push("description = ?"),E.push(o)),i!==void 0&&(f.push("price = ?"),E.push(i)),c!==void 0&&(f.push("original_price = ?"),E.push(c),i!==void 0&&c)){const h=Math.round((c-i)/c*100);f.push("discount_rate = ?"),E.push(h)}if(u!==void 0&&(f.push("image_url = ?"),E.push(u)),l!==void 0&&(f.push("stock = ?"),E.push(l)),d!==void 0&&(f.push("category = ?"),E.push(d)),_!==void 0&&(f.push("is_active = ?"),E.push(_?1:0)),f.push("updated_at = CURRENT_TIMESTAMP"),E.push(s,t.sellerId),f.length===1)return e.json({success:!1,error:"No fields to update"},400);await r.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...E).run();const y=await r.prepare("SELECT * FROM products WHERE id = ?").bind(s).first();return await as(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0,data:y})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/products/:id",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id");if(!await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await r.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(s).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await r.prepare("DELETE FROM product_options WHERE product_id = ?").bind(s).run(),await r.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(s).run(),await r.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(s).run(),await r.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).run(),await as(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0}))}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products/:id/options",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id");if(!await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await r.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(s).all();return e.json({success:!0,data:n.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id");if(!await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const u=await r.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(s,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:u.meta.last_row_id,product_id:s,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("productId"),a=e.req.param("optionId");return await r.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,t.sellerId).first()?(await r.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,s).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/stats",async e=>{const{DB:r,CACHE_KV:t}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const a=`seller:${s.sellerId}:stats`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await r.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(s.sellerId).first(),i=await r.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(s.sellerId).first(),c=await r.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(s.sellerId).first(),u=await r.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(s.sellerId).first(),l=await r.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(s.sellerId).first(),_={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:u.count||0,totalRevenue:u.total||0,activeStreams:l.count||0,totalViewers:0};return await t.put(a,JSON.stringify(_),{expirationTtl:60}),e.json({success:!0,data:_})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/stats/sales",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.query("period")||"daily";let a,n,o;switch(s){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await r.prepare(`
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
    `).bind(t.sellerId).all();return e.json({success:!0,data:{period:s,sales:i.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/stats/products",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await r.prepare(`
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
    `).bind(t.sellerId,s).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/business-info",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{business_number:s,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:u,phone:l,email:d}=await e.req.json();if(!s||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const _=await r.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();let f;return _?f=await r.prepare(`
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
      `).bind(s,a,n,o,i,c,u,l,d,t.sellerId).run():f=await r.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(t.sellerId,s,a,n,o,i,c,u,l,d).run(),e.json({success:!0,data:{id:_?_.id:f.meta.last_row_id,seller_id:t.sellerId,business_number:s,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(s){return console.error("사업자 정보 등록 오류:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/business-info",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=await r.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);const s=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await r.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(s).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await r.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(s).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});p.get("/api/admin/seller-business",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=await r.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:s.results||[]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/orders",he,async e=>{const{DB:r}=e.env,t=e.get("userId");try{const s=await r.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(t).all(),a=await Promise.all(s.results.map(async n=>{const o=await r.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(n.id).all();return{...n,items:o.results}}));return e.json({success:!0,data:a})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/orders/user/:userId",he,async e=>{const{DB:r}=e.env,t=e.get("userId"),s=parseInt(e.req.param("userId"));try{if(s!==t)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await r.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(t).all(),n=await Promise.all(a.results.map(async o=>{const i=await r.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(o.id).all();return{...o,items:i.results}}));return e.json({success:!0,data:n})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/orders/:orderNumber",async e=>{const{DB:r}=e.env,t=e.req.param("orderNumber");try{const s=await r.prepare("SELECT * FROM orders WHERE order_number = ?").bind(t).first();if(!s)return e.json({success:!1,error:"Order not found"},404);const a=await r.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(s.id).all();return e.json({success:!0,data:{...s,items:a.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders/:orderId/cancel",async e=>{const{DB:r}=e.env,t=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await r.prepare("SELECT * FROM orders WHERE id = ?").bind(t).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await r.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(t).all();for(const i of o.results)await r.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.quantity,i.product_id).run();return await r.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,t).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:t,reason:a,itemsRestored:o.results.length}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:r}=e.env;try{const t=e.req.param("streamId"),s=await r.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(t).first();return s?e.json({success:!0,data:{viewer_count:s.viewer_count||0}}):e.json({success:!1,error:"Stream not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/streams/:streamId/viewer-count",async e=>{const{DB:r}=e.env,t=await C(e),s=t.success?{success:!1}:await v(e);if(!t.success&&!s.success)return e.json({success:!1,error:"Unauthorized"},401);try{const a=e.req.param("streamId"),{viewer_count:n}=await e.req.json();return typeof n!="number"||n<0?e.json({success:!1,error:"Invalid viewer count"},400):s.success&&!await r.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a,s.sellerId).first()?e.json({success:!1,error:"Stream not found or unauthorized"},404):(await r.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{viewer_count:n}}))}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/streams/:streamId/view",async e=>{const{DB:r}=e.env;try{const t=e.req.param("streamId");await r.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(t).run();const s=await r.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(t).first();return e.json({success:!0,data:{viewer_count:(s==null?void 0:s.viewer_count)||0}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/payments/confirm",async e=>{var s;const{DB:r}=e.env;let t=null;try{t=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=t;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다."},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=e.env.TOSS_SECRET_KEY;if(!i)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",i.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const c="Basic "+btoa(i+":");console.log("[Payment] Authorization 헤더 생성 완료");const u={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(u,null,2)),console.log("[Payment] 📊 amount 타입:",typeof u.amount),console.log("[Payment] 📊 amount 값:",u.amount);const l=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:c,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(u)}),d=await l.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",l.status),console.log("  - 응답 OK?:",l.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(d).substring(0,300)),!l.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",l.status),console.error("[Payment] 에러 코드:",d.code),console.error("[Payment] 에러 메시지:",d.message),console.error("[Payment] 전체 응답:",JSON.stringify(d,null,2)),e.json({success:!1,error:d.message||"결제 승인에 실패했습니다.",code:d.code},l.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await r.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const _=await r.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();for(const f of _.results)(await r.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(f.quantity,f.product_id,f.quantity).run()).meta.changes===0&&console.error(`[Payment] ⚠️ 재고 부족: product_id=${f.product_id}`);console.log("[Payment] ✅ 재고 차감 완료")}catch(_){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",_)}return e.json({success:!0,data:d})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:t==null?void 0:t.orderId,error:a.message,stack:(s=a.stack)==null?void 0:s.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요."},500)}});p.post("/api/chat/:liveStreamId/messages",k(),async e=>{const{DB:r}=e.env,t=e.req.param("liveStreamId");try{const s=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:u}=s;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await r.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(t,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const l=["씨발","개새끼","병신","좆","시발"];let d=i;l.forEach(f=>{const E=new RegExp(f,"gi");d=d.replace(E,"*".repeat(f.length))});const _=await r.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a||null,n,o||null,d,c?1:0,u?1:0).run();return e.json({success:!0,data:{id:_.meta.last_row_id,message:d}})}catch(s){return console.error("Error sending chat message:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/chat/:liveStreamId/messages",k(),async e=>{const{DB:r}=e.env,t=e.req.param("liveStreamId"),s=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
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
    `;const o=[t];s&&(n+=" AND id > ?",o.push(Number(s))),n+=" ORDER BY created_at DESC LIMIT ?",o.push(a);const c=(await r.prepare(n).bind(...o).all()).results.reverse();return e.json({success:!0,data:c})}catch(n){return console.error("Error fetching chat messages:",n),e.json({success:!1,error:n.message},500)}});p.delete("/api/chat/:liveStreamId/messages/:messageId",k(),async e=>{const{DB:r}=e.env,t=e.req.param("messageId");try{return await r.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(t).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(s){return console.error("Error deleting chat message:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/chat/:liveStreamId/ban",k(),async e=>{const{DB:r}=e.env,t=e.req.param("liveStreamId");try{const s=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=s;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const u=new Date;u.setMinutes(u.getMinutes()+i),c=u.toISOString()}return await r.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(t,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(s){return console.error("Error banning user:",s),e.json({success:!1,error:s.message},500)}});p.delete("/api/chat/:liveStreamId/ban/:userId",k(),async e=>{const{DB:r}=e.env,t=e.req.param("liveStreamId"),s=e.req.param("userId");try{return await r.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(t,s).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});p.post("/api/payments/webhook",async e=>{const{DB:r}=e.env;try{const t=await e.req.json();switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:t.eventType,orderId:t.orderId,status:t.status,timestamp:new Date().toISOString()}),t.eventType){case"PAYMENT_STATUS_CHANGED":await Vr(r,t);break;case"VIRTUAL_ACCOUNT_ISSUED":await Yr(r,t);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",t.eventType)}return e.json({success:!0})}catch(t){return console.error("[Webhook] ❌ 웹훅 처리 실패:",t.message),e.json({success:!1,error:t.message},500)}});async function Vr(e,r){const{orderId:t,status:s,paymentKey:a}=r;console.log("[Webhook] 결제 상태 변경:",{orderId:t,status:s}),await e.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(s,JSON.stringify(r),a).run(),(s==="DONE"||s==="completed")&&(await e.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(t).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",t))}async function Yr(e,r){const{orderId:t,virtualAccount:s}=r;console.log("[Webhook] 가상계좌 발급:",{orderId:t,bank:s==null?void 0:s.bank,accountNumber:s==null?void 0:s.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(s==null?void 0:s.bank,s==null?void 0:s.accountNumber,s==null?void 0:s.customerName,s==null?void 0:s.dueDate,JSON.stringify(r),t).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",t)}p.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:r}=e.env;try{const t=e.req.param("paymentKey"),s=await e.req.json(),{cancelReason:a,cancelAmount:n}=s;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:t,cancelReason:a,cancelAmount:n}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const o=await r.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(t).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const u=Fr(i,c),l=n&&n<o.amount,d=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:t,cancelAmount:d,isPartial:l});const _=await u.cancelPayment({paymentKey:t,cancelReason:a,cancelAmount:d});return _.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:t,cancelAmount:d,canceledAt:_.canceledAt}),await r.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED",_.canceledAt||new Date().toISOString(),JSON.stringify(_),t).run(),await r.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${t}`),e.json({success:!0,data:{paymentKey:t,orderId:o.order_id,cancelAmount:d,canceledAt:_.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,_.error),e.json({success:!1,error:_.error||"결제 취소에 실패했습니다."},400))}catch(t){return console.error("[Payment] ❌ 결제 취소 처리 실패:",t.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});p.get("/api/payments/:paymentKey",async e=>{const{DB:r}=e.env;try{const t=e.req.param("paymentKey"),s=await r.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(t).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404)}catch(t){return console.error("[Payment] ❌ 결제 조회 실패:",t.message),e.json({success:!1,error:"결제 조회 중 오류가 발생했습니다."},500)}});p.get("/api/payments/order/:orderId",async e=>{const{DB:r}=e.env;try{const t=e.req.param("orderId"),s=await r.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(t).all();return e.json({success:!0,data:s.results||[]})}catch(t){return console.error("[Payment] ❌ 결제 목록 조회 실패:",t.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});p.get("/api/seller/orders",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=await r.prepare(`
      SELECT DISTINCT o.*, u.name as user_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC
    `).bind(t.sellerId).all(),a=await Promise.all(s.results.map(async n=>{const o=await r.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ? AND oi.seller_id = ?
        `).bind(n.id,t.sellerId).all();return{...n,items:o.results}}));return e.json({success:!0,data:a})}catch(s){return e.json({success:!1,error:s.message},500)}});p.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await r.prepare("SELECT id FROM orders WHERE order_number = ?").bind(s).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await r.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,t.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await r.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,s).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${s}, 자동 발행 시작...`);const c=await r.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(s).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const u=await r.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();if(!u)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${t.sellerId}`),await r.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(s,t.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${s}`);const l=await r.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),d=Number(c.total_amount),_=Math.floor(d/1.1),f=d-_,E=new Date().toISOString().split("T")[0].replace(/-/g,""),y=Math.random().toString(36).substring(2,8).toUpperCase(),h=`${E}-${y}`,g=(await r.prepare(`
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
            `).bind(t.sellerId,s,h,u.business_number,u.business_name,u.ceo_name,u.address||"",u.business_type||"",u.business_category||"",u.email||"",u.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",_,f,d,`AUTO-${Date.now()}-${y}`).run()).meta.last_row_id;for(const j of l.results){const N=Math.floor(Number(j.price)*Number(j.quantity)/1.1),w=Number(j.price)*Number(j.quantity)-N;await r.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(g,j.product_name||"상품명 없음",j.quantity,j.price,N,w,j.option_name||"").run()}await r.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(s,t.sellerId,g).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${g}, invoice_number=${h}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${s}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await r.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(s,t.sellerId,c.message).run()}catch(u){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",u)}}try{const c=await r.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(s).first();if(c&&c.user_id){const l={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];l&&await Hs(r,c.user_id,s,l)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await r.prepare("SELECT id FROM orders WHERE order_number = ?").bind(s).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await r.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,t.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await r.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,s).run();try{const c=await r.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(s).first();c&&c.user_id&&await Hs(r,c.user_id,s,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders/:orderNumber/refund",async e=>{const{DB:r}=e.env,t=e.req.param("orderNumber"),{reason:s}=await e.req.json();try{const a=await r.prepare("SELECT * FROM orders WHERE order_number = ?").bind(t).first();return a?["paid","preparing","shipped","delivered"].includes(a.status)?a.status==="refunded"||a.status==="cancelled"?e.json({success:!1,error:"이미 환불 또는 취소된 주문입니다."},400):(await r.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded",t).run(),e.json({success:!0,message:"환불 요청이 접수되었습니다. 고객센터(0507-0177-0432)에서 처리 예정입니다.",requiresManualProcessing:!0})):e.json({success:!1,error:"환불이 불가능한 주문 상태입니다."},400):e.json({success:!1,error:"Order not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/admin/orders",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=await r.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/sellers",async e=>{const{DB:r}=e.env,{limit:t="20",offset:s="0"}=e.req.query();try{const a=`
      SELECT id, business_name, name as display_name, 
             commission_rate, created_at
      FROM sellers 
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,{results:n}=await r.prepare(a).bind(parseInt(t),parseInt(s)).all();return e.json({success:!0,data:n})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});p.get("/api/admin/sellers",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=await r.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/sellers",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{username:s,password:a,name:n,email:o,phone:i,business_name:c,business_number:u}=await e.req.json();if(!s||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await r.prepare("SELECT id FROM sellers WHERE username = ?").bind(s).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await r.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const _=`$2a$10$placeholder_hash_for_${a}`,f=await r.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(s,_,n,o,i||null,c,u||null,t.adminId).run();return e.json({success:!0,data:{id:f.meta.last_row_id,username:s,name:n,email:o,business_name:c}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/sellers/:id",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:u,status:l}=await e.req.json();return await r.prepare("SELECT id FROM sellers WHERE id = ?").bind(s).first()?(await r.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,u,l,s).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/admin/sellers/:id",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),a=await r.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(s).first();return a?(await r.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(),await r.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(s).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await r.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(s).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await r.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,s).run(),await r.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(s).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(s){return e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await r.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(s).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await r.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,s).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${s}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:s,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(s){return console.error("수수료율 변경 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),a=await r.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(s).first();return a?a.status==="approved"?e.json({success:!1,error:"이미 승인된 판매자입니다"},400):(await r.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(t.adminId,s).run(),console.log(`셀러 승인: ${a.username} (ID: ${s}) by Admin ID: ${t.adminId}`),e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:s,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 승인 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await r.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(s).first();return n?n.status==="rejected"?e.json({success:!1,error:"이미 거부된 판매자입니다"},400):(await r.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,t.adminId,s).run(),console.log(`셀러 거부: ${n.username} (ID: ${s}), 사유: ${a}`),e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:s,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 거부 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/sellers/pending",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=await r.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:s.results,count:s.results.length})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/public/seller/:sellerId",async e=>{const{DB:r,CACHE_KV:t}=e.env;try{const s=e.req.param("sellerId"),a=`public:seller:${s}`,n=await rs(t,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await r.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(s).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=await r.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(s).all(),c=await r.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(s).all(),u=await r.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(s).all(),l=await r.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(s).first(),d={profile:o,live_streams:i.results,scheduled_streams:c.results,products:u.results,stats:l};return await ts(t,a,d,60),e.json({success:!0,data:d})}catch(s){return console.error("셀러 프로필 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/public/seller/username/:username",async e=>{const{DB:r}=e.env;try{const t=e.req.param("username"),s=await r.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(t).first();return s?e.json({success:!0,data:{seller_id:s.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/settlement/stats",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{period:s}=e.req.query();let a="";const n=new Date;switch(s){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await r.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:s||"all"}})}catch(s){return console.error("정산 통계 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlement/records",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{seller_id:s,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];s&&(o.push("o.seller_id = ?"),i.push(s)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const d=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${d}'`);break;case"week":const _=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${_}'`);break;case"month":const f=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${f}'`);break}const u=o.length>0?`WHERE ${o.join(" AND ")}`:"",l=await r.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:l.results})}catch(s){return console.error("정산 내역 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await r.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(s).first();return n?(await r.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,s).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:s,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(s){return console.error("정산 상태 변경 실패:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/settlement/batch-complete",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{order_ids:s}=await e.req.json();if(!Array.isArray(s)||s.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of s)try{await r.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:s.length,success:a,failed:n}})}catch(s){return console.error("일괄 정산 처리 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlement/export-csv",async e=>{const{DB:r}=e.env,t=await C(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{seller_id:s,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];s&&(n.push("o.seller_id = ?"),o.push(s));const i=new Date;switch(a){case"today":const E=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${E}'`);break;case"week":const y=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${y}'`);break;case"month":const h=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${h}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",l=(await r.prepare(`
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
`;l.forEach(E=>{const y=d.map(h=>{const b=E[h];if(b==null)return"";const g=String(b);return g.includes(",")||g.includes('"')||g.includes(`
`)?`"${g.replace(/"/g,'""')}"`:g});_+=y.join(",")+`
`});const f="\uFEFF";return new Response(f+_,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(s){return console.error("CSV 내보내기 실패:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/orders/create",async e=>{const{DB:r}=e.env;try{const{userId:t,cartItems:s,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:u,buyerCeoName:l}=await e.req.json();console.log("주문 생성 요청:",{userId:t,cartItems:s==null?void 0:s.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let d=10;if(o){const w=await r.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();w&&w.commission_rate!==null&&(d=w.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:d});const _=Math.floor(a*(d/100)),f=a-_;let E=null;if(n){const w=await r.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(n,t).first();if(!w)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);E=w}if(!t)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const y=t,h=Date.now(),b=Math.random().toString(36).substring(2,8).toUpperCase(),g=`ORDER_${h}_${b}`;for(const w of s){const D=await r.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(w.product_id).first();if(!D)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${w.product_id})`},400);if(D.stock<w.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${w.product_id})`},400)}const N=(await r.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(g,y,a,"pending",o||null,d,_,f,n||null,(E==null?void 0:E.recipient_name)||null,(E==null?void 0:E.phone)||null,E!=null&&E.address?`${E.address} ${E.address_detail}`:null,(E==null?void 0:E.postal_code)||null,i?1:0,c||null,u||null,l||null).run()).meta.last_row_id;for(const w of s){await r.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(N,w.product_id,w.option_id||null,w.quantity,w.price_snapshot||w.price).run(),await r.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(w.quantity,w.product_id).run();try{const D=await r.prepare(`
          SELECT id, name, stock, stock_alert_threshold, seller_id 
          FROM products 
          WHERE id = ?
        `).bind(w.product_id).first();if(D){const L=D.stock_alert_threshold||5,S=D.stock;S<=L&&D.seller_id&&(await qr(r,D.seller_id,D.name,S,L),console.log(`[Low Stock Alert] ${D.name}: ${S} <= ${L}`))}}catch(D){console.error("[Low Stock Alert] Error:",D)}}return console.log("주문 생성 완료:",{orderId:N,orderNumber:g}),e.json({success:!0,orderId:N,orderNumber:g,totalAmount:a})}catch(t){return console.error("주문 생성 실패:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/orders/:orderNumber/refund",k(),async e=>{const{DB:r}=e.env;try{const t=e.req.param("orderNumber"),{reason:s}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:t,reason:s});const a=await r.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(t).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다"},404);if(a.payment_status==="cancelled")return e.json({success:!1,error:"이미 취소된 주문입니다"},400);await r.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(s||"구매자 요청",t).run(),console.log("[Order Refund] 주문 상태 업데이트 완료:",t);const n=await r.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();for(const o of n.results)await r.prepare(`
        UPDATE products 
        SET stock = stock + ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(o.quantity,o.product_id).run(),console.log("[Order Refund] 재고 복구:",{productId:o.product_id,quantity:o.quantity});return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:t,reason:s}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:t,cancelDate:new Date().toISOString()}})}catch(t){return console.error("[Order Refund] Error:",t),e.json({success:!1,error:t.message||"주문 취소 중 오류가 발생했습니다"},500)}});p.get("/api/seller/sales",k(),async e=>{try{const{DB:r}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const s=await Ne(e.env.SESSION_KV,t);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(s.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=s.seller_id||s.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await r.prepare(`
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
    `).bind(a,i,c).first(),d=await r.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:u,stats:l,orders:(d==null?void 0:d.results)||[]}})}catch(r){return console.error("Seller sales query error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/settlement-csv",k(),async e=>{try{const{DB:r}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const s=await Ne(e.env.SESSION_KV,t);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(s.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=s.seller_id||s.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await r.prepare(`
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
`;for(const d of(u==null?void 0:u.results)||[]){const _=d.status==="delivered"?"배송완료":d.status==="shipped"?"배송중":d.status==="preparing"?"상품준비중":d.status==="paid"?"결제완료":"대기중",f=d.buyer_business_name||"-",E=d.buyer_business_number||"-",y=d.invoice_number||"-",h=d.issue_date||"-",b=d.tax_invoice_status==="issued"?"발행완료":d.tax_invoice_status==="cancelled"?"취소":"-",g=d.nts_confirm_number||"-";l+=`${d.order_number},${d.created_at},${d.user_name||"익명"},${d.total_amount},${d.commission_amount},${d.seller_amount},${_},${f},${E},${y},${h},${b},${g}
`}return new Response(l,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(r){return console.error("CSV download error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/tax-invoices/issue",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{order_number:s}=await e.req.json();if(!s)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await r.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(s).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!a.issue_tax_invoice)return e.json({success:!1,error:"세금계산서 발행이 요청되지 않은 주문입니다."},400);const n=await r.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(t.sellerId).first();if(!n)return e.json({success:!1,error:"승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요."},400);const o=await r.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),u=i-c,l=new Date().toISOString().split("T")[0],d=`${l}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,_=kr(n,a,o.results);let f,E,y;try{f=await Ar(_),E=f.ntsConfirmNumber,y=f.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:E,invoiceKey:y,mockMode:Ae()})}catch(g){console.error("바로빌 API 호출 실패:",g),E="FAILED",y=null}const b=(await r.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t.sellerId,s,"tax",d,l,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,u,i,E==="FAILED"?"failed":"issued",Ae()?"mock":"barobill",y,E).run()).meta.last_row_id;for(const g of o.results){const j=Math.floor(Number(g.price)*Number(g.quantity)/1.1),N=Number(g.price)*Number(g.quantity)-j;await r.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(b,g.id,g.product_name,g.quantity,g.price,j,N).run()}return e.json({success:!0,data:{invoice_id:b,invoice_number:d,issue_date:l,total_amount:i,supply_price:c,tax_amount:u,status:E==="FAILED"?"failed":"issued",nts_confirm_number:E,api_invoice_key:y,mock_mode:Ae(),message:E==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":Ae()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(s){return console.error("세금계산서 발행 오류:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/tax-invoices",async e=>{var s;const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[t.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const u=await r.prepare(i).bind(...c).all();return e.json({success:!0,data:u.results||[],total:((s=u.results)==null?void 0:s.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/tax-invoices/:id",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),a=await r.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(s,t.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await r.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(s).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("id"),{reason:a}=await e.req.json(),n=await r.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(s,t.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!Ae()){const u=await r.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(t.sellerId).first();u&&u.business_number&&await Dr(u.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(u){console.error("바로빌 취소 API 호출 실패:",u)}return await r.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{status:s,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[t.sellerId];s&&(n+=" AND log.status = ?",o.push(s)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await r.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const s=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${s}`);const a=await r.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(s,t.sellerId).first();if(!a)return e.json({success:!1,error:"재시도할 실패 로그를 찾을 수 없습니다."},404);const n=Number(a.retry_count||0);if(n>=3)return e.json({success:!1,error:"최대 재시도 횟수(3회)를 초과했습니다."},400);const o=await r.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(s).first();if(!o)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!o.buyer_business_number||!o.buyer_business_name)return e.json({success:!1,error:"주문에 사업자 정보가 없습니다."},400);const i=await r.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(t.sellerId).first();if(!i)return e.json({success:!1,error:"판매자 사업자 정보가 승인되지 않았습니다."},400);const c=await r.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(o.id).all(),u=Number(o.total_amount),l=Math.floor(u/1.1),d=u-l,_=new Date().toISOString().split("T")[0].replace(/-/g,""),f=Math.random().toString(36).substring(2,8).toUpperCase(),E=`${_}-${f}`,h=(await r.prepare(`
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
    `).bind(t.sellerId,s,E,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",l,d,u,`RETRY-${Date.now()}-${f}`).run()).meta.last_row_id;for(const b of c.results){const g=Math.floor(Number(b.price)*Number(b.quantity)/1.1),j=Number(b.price)*Number(b.quantity)-g;await r.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(h,b.product_name||"상품명 없음",b.quantity,b.price,g,j,b.option_name||"").run()}return await r.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(s,t.sellerId,h,n+1).run(),await r.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${h}, retry_count=${n+1}`),e.json({success:!0,data:{invoice_id:h,invoice_number:E,retry_count:n+1}})}catch(s){console.error("[TAX INVOICE RETRY] 재시도 실패:",s);try{const a=e.req.param("orderNumber"),n=await r.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,t.sellerId).first(),o=Number((n==null?void 0:n.retry_count)||0);await r.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,t.sellerId,s.message,o+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:s.message},500)}});p.get("/live/:id",async e=>{try{const r=new URL("/static/live.html",e.req.url);let s=await(await fetch(r.toString())).text();const n=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return s=s.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${n}`),console.log("[Live Page] Environment variables injected"),new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(r){return console.error("Error serving live page:",r),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/cart",async e=>{try{const r=new URL("/static/cart.html",e.req.url);let s=await(await fetch(r.toString())).text();return s=s.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),s=s.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(r){return console.error("Error serving cart page:",r),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/my-orders",async e=>{try{const r=new URL("/static/my-orders.html",e.req.url),s=await(await fetch(r.toString())).text();return new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(r){return console.error("Error serving my orders page:",r),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/payment-result",async e=>{try{const r=new URL("/payment-result.html",e.req.url),s=await(await fetch(r.toString())).text();return new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(r){return console.error("Error serving payment result page:",r),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/api/seller/profile",async e=>{const{DB:r}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const s=await r.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(t).first();if(!s||!s.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await r.prepare(`
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
    `).bind(s.seller_id).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404)}catch(s){return console.error("프로필 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/seller/profile",async e=>{const{DB:r}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const s=await r.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(t).first();if(!s||!s.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:u,website_url:l,kakao_chat_link:d}=await e.req.json(),_=[],f=[];if(a!==void 0&&(_.push("profile_image = ?"),f.push(a)),n!==void 0&&(_.push("bio = ?"),f.push(n)),o!==void 0&&(_.push("sns_instagram = ?"),f.push(o)),i!==void 0&&(_.push("sns_youtube = ?"),f.push(i)),c!==void 0&&(_.push("sns_facebook = ?"),f.push(c)),u!==void 0&&(_.push("sns_twitter = ?"),f.push(u)),l!==void 0&&(_.push("website_url = ?"),f.push(l)),d!==void 0&&(_.push("kakao_chat_link = ?"),f.push(d)),_.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);_.push("updated_at = datetime('now')"),f.push(s.seller_id),await r.prepare(`
      UPDATE sellers 
      SET ${_.join(", ")}
      WHERE id = ?
    `).bind(...f).run();const E=await r.prepare(`
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
    `).bind(s.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:E})}catch(s){return console.error("프로필 업데이트 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/public/:sellerId",async e=>{const{DB:r}=e.env,t=e.req.param("sellerId");try{const s=await r.prepare(`
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
    `).bind(t).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 프로필 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/:sellerId/streams",async e=>{const{DB:r}=e.env,t=e.req.param("sellerId");try{const s=await r.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("라이브 목록 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/:sellerId/products-public",async e=>{const{DB:r}=e.env,t=e.req.param("sellerId");try{const s=await r.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("상품 목록 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/notifications",async e=>{const{DB:r}=e.env;try{const t=e.req.header("Authorization");if(!t)return e.json({success:!1,error:"No authorization header"},401);const s=t.replace("Bearer ","");let a=await v(e),n="seller",o=a.sellerId;if(a.success||(a=await verifyUserSession(e),a.success&&(n="user",o=a.userId)),a.success||(a=await C(e),a.success&&(n="admin",o=a.adminId)),!a.success||!o)return e.json({success:!1,error:"Unauthorized"},401);const i=parseInt(e.req.query("limit")||"50"),c=e.req.query("unread_only")==="true";let u=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;c&&(u+=" AND is_read = 0"),u+=" ORDER BY created_at DESC LIMIT ?";const l=await r.prepare(u).bind(o,n,i).all();return e.json({success:!0,data:l.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/notifications/unread-count",async e=>{const{DB:r}=e.env;try{if(!e.req.header("Authorization"))return e.json({success:!1,error:"No authorization header"},401);let s=await v(e),a="seller",n=s.sellerId;if(s.success||(s=await verifyUserSession(e),s.success&&(a="user",n=s.userId)),s.success||(s=await C(e),s.success&&(a="admin",n=s.adminId)),!s.success||!n)return e.json({success:!1,error:"Unauthorized"},401);const o=await r.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(n,a).first();return e.json({success:!0,count:(o==null?void 0:o.count)||0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/notifications/:id/read",async e=>{const{DB:r}=e.env;try{const t=e.req.param("id");return e.req.header("Authorization")?await r.prepare("SELECT user_id, user_type FROM notifications WHERE id = ?").bind(t).first()?(await r.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(t).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404):e.json({success:!1,error:"No authorization header"},401)}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/notifications/read-all",async e=>{const{DB:r}=e.env;try{if(!e.req.header("Authorization"))return e.json({success:!1,error:"No authorization header"},401);let s=await v(e),a="seller",n=s.sellerId;return s.success||(s=await verifyUserSession(e),s.success&&(a="user",n=s.userId)),s.success||(s=await C(e),s.success&&(a="admin",n=s.adminId)),!s.success||!n?e.json({success:!1,error:"Unauthorized"},401):(await r.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(n,a).run(),e.json({success:!0}))}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/notifications/:id",async e=>{const{DB:r}=e.env;try{const t=e.req.param("id");return e.req.header("Authorization")?await r.prepare("SELECT user_id, user_type FROM notifications WHERE id = ?").bind(t).first()?(await r.prepare("DELETE FROM notifications WHERE id = ?").bind(t).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404):e.json({success:!1,error:"No authorization header"},401)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/order-complete",e=>e.redirect("/order-complete.html",302));p.notFound(e=>{const r=e.req.path;return r.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${r} was not found.`},404):new Response(null,{status:404})});p.onError((e,r)=>{const t=r.req.path;if(console.error("[Global Error Handler]",{path:t,method:r.req.method,error:e.message,stack:e.stack}),t.startsWith("/api/")){let s=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(s=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(s=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(s=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(s=400,a="잘못된 요청입니다."),r.json({success:!1,error:e.message||a},s)}return r.html(`
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
  `,500)});const ps=new Ls,Jr=Object.assign({"/src/index.tsx":p});let $s=!1;for(const[,e]of Object.entries(Jr))e&&(ps.route("/",e),ps.notFound(e.notFoundHandler),$s=!0);if(!$s)throw new Error("Can't import modules from ['/src/index.tsx']");async function qs(e){try{const{to:r,subject:t,htmlContent:s,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:r}]}],from:{email:"noreply@live.ur-team.com",name:"유어 라이브"},subject:t,content:[{type:"text/html",value:s},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",r),{success:!0}}catch(r){return console.error("[Email] Exception:",r),{success:!1,error:r.message}}}async function zr(e){const{streamId:r,title:t,sellerName:s,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${r}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",u=`
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
제목: ${t}
판매자: ${s}
플랫폼: ${a==="youtube"?"YouTube":"TikTok"}
${n?`예약 시간: ${new Date(n).toLocaleString("ko-KR")}`:""}
라이브 ID: #${r}

🔗 라이브 페이지: ${i}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `;return qs({to:"jiwon@ur-team.com",subject:`[유어 라이브] 🎉 새 라이브 스트림 생성: ${t}`,htmlContent:u,textContent:l})}const Gr=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:qs,sendLiveStreamCreatedEmail:zr},Symbol.toStringTag,{value:"Module"}));export{ps as default};
