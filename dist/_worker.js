var Ys=Object.defineProperty;var is=e=>{throw TypeError(e)};var Vs=(e,t,r)=>t in e?Ys(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var R=(e,t,r)=>Vs(e,typeof t!="symbol"?t+"":t,r),Xe=(e,t,r)=>t.has(e)||is("Cannot "+r);var m=(e,t,r)=>(Xe(e,t,"read from private field"),r?r.call(e):t.get(e)),I=(e,t,r)=>t.has(e)?is("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),T=(e,t,r,s)=>(Xe(e,t,"write to private field"),s?s.call(e,r):t.set(e,r),r),O=(e,t,r)=>(Xe(e,t,"access private method"),r);var cs=(e,t,r,s)=>({set _(a){T(e,t,a,r)},get _(){return m(e,t,s)}});var us=(e,t,r)=>(s,a)=>{let o=-1;return n(0);async function n(i){if(i<=o)throw new Error("next() called multiple times");o=i;let c,u=!1,l;if(e[i]?(l=e[i][0][0],s.req.routeIndex=i):l=i===e.length&&a||void 0,l)try{c=await l(s,()=>n(i+1))}catch(d){if(d instanceof Error&&t)s.error=d,c=await t(d,s),u=!0;else throw d}else s.finalized===!1&&r&&(c=await r(s));return c&&(s.finalized===!1||u)&&(s.res=c),s}},Js=Symbol(),zs=async(e,t=Object.create(null))=>{const{all:r=!1,dot:s=!1}=t,o=(e instanceof Ss?e.raw.headers:e.headers).get("Content-Type");return o!=null&&o.startsWith("multipart/form-data")||o!=null&&o.startsWith("application/x-www-form-urlencoded")?Gs(e,{all:r,dot:s}):{}};async function Gs(e,t){const r=await e.formData();return r?Xs(r,t):{}}function Xs(e,t){const r=Object.create(null);return e.forEach((s,a)=>{t.all||a.endsWith("[]")?Qs(r,a,s):r[a]=s}),t.dot&&Object.entries(r).forEach(([s,a])=>{s.includes(".")&&(Zs(r,s,a),delete r[s])}),r}var Qs=(e,t,r)=>{e[t]!==void 0?Array.isArray(e[t])?e[t].push(r):e[t]=[e[t],r]:t.endsWith("[]")?e[t]=[r]:e[t]=r},Zs=(e,t,r)=>{let s=e;const a=t.split(".");a.forEach((o,n)=>{n===a.length-1?s[o]=r:((!s[o]||typeof s[o]!="object"||Array.isArray(s[o])||s[o]instanceof File)&&(s[o]=Object.create(null)),s=s[o])})},bs=e=>{const t=e.split("/");return t[0]===""&&t.shift(),t},er=e=>{const{groups:t,path:r}=sr(e),s=bs(r);return rr(s,t)},sr=e=>{const t=[];return e=e.replace(/\{[^}]+\}/g,(r,s)=>{const a=`@${s}`;return t.push([a,r]),a}),{groups:t,path:e}},rr=(e,t)=>{for(let r=t.length-1;r>=0;r--){const[s]=t[r];for(let a=e.length-1;a>=0;a--)if(e[a].includes(s)){e[a]=e[a].replace(s,t[r][1]);break}}return e},We={},tr=(e,t)=>{if(e==="*")return"*";const r=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(r){const s=`${e}#${t}`;return We[s]||(r[2]?We[s]=t&&t[0]!==":"&&t[0]!=="*"?[s,r[1],new RegExp(`^${r[2]}(?=/${t})`)]:[e,r[1],new RegExp(`^${r[2]}$`)]:We[s]=[e,r[1],!0]),We[s]}return null},rs=(e,t)=>{try{return t(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,r=>{try{return t(r)}catch{return r}})}},ar=e=>rs(e,decodeURI),gs=e=>{const t=e.url,r=t.indexOf("/",t.indexOf(":")+4);let s=r;for(;s<t.length;s++){const a=t.charCodeAt(s);if(a===37){const o=t.indexOf("?",s),n=t.slice(r,o===-1?void 0:o);return ar(n.includes("%25")?n.replace(/%25/g,"%2525"):n)}else if(a===63)break}return t.slice(r,s)},or=e=>{const t=gs(e);return t.length>1&&t.at(-1)==="/"?t.slice(0,-1):t},be=(e,t,...r)=>(r.length&&(t=be(t,...r)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${t==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(t==null?void 0:t[0])==="/"?t.slice(1):t}`}`),ws=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const t=e.split("/"),r=[];let s="";return t.forEach(a=>{if(a!==""&&!/\:/.test(a))s+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){r.length===0&&s===""?r.push("/"):r.push(s);const o=a.replace("?","");s+="/"+o,r.push(s)}else s+="/"+a}),r.filter((a,o,n)=>n.indexOf(a)===o)},Qe=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?rs(e,Rs):e):e,Ts=(e,t,r)=>{let s;if(!r&&t&&!/[%+]/.test(t)){let n=e.indexOf("?",8);if(n===-1)return;for(e.startsWith(t,n+1)||(n=e.indexOf(`&${t}`,n+1));n!==-1;){const i=e.charCodeAt(n+t.length+1);if(i===61){const c=n+t.length+2,u=e.indexOf("&",c);return Qe(e.slice(c,u===-1?void 0:u))}else if(i==38||isNaN(i))return"";n=e.indexOf(`&${t}`,n+1)}if(s=/[%+]/.test(e),!s)return}const a={};s??(s=/[%+]/.test(e));let o=e.indexOf("?",8);for(;o!==-1;){const n=e.indexOf("&",o+1);let i=e.indexOf("=",o);i>n&&n!==-1&&(i=-1);let c=e.slice(o+1,i===-1?n===-1?void 0:n:i);if(s&&(c=Qe(c)),o=n,c==="")continue;let u;i===-1?u="":(u=e.slice(i+1,n===-1?void 0:n),s&&(u=Qe(u))),r?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(u)):a[c]??(a[c]=u)}return t?a[t]:a},nr=Ts,ir=(e,t)=>Ts(e,t,!0),Rs=decodeURIComponent,ls=e=>rs(e,Rs),Te,B,se,Is,vs,ss,re,ms,Ss=(ms=class{constructor(e,t="/",r=[[]]){I(this,se);R(this,"raw");I(this,Te);I(this,B);R(this,"routeIndex",0);R(this,"path");R(this,"bodyCache",{});I(this,re,e=>{const{bodyCache:t,raw:r}=this,s=t[e];if(s)return s;const a=Object.keys(t)[0];return a?t[a].then(o=>(a==="json"&&(o=JSON.stringify(o)),new Response(o)[e]())):t[e]=r[e]()});this.raw=e,this.path=t,T(this,B,r),T(this,Te,{})}param(e){return e?O(this,se,Is).call(this,e):O(this,se,vs).call(this)}query(e){return nr(this.url,e)}queries(e){return ir(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const t={};return this.raw.headers.forEach((r,s)=>{t[s]=r}),t}async parseBody(e){var t;return(t=this.bodyCache).parsedBody??(t.parsedBody=await zs(this,e))}json(){return m(this,re).call(this,"text").then(e=>JSON.parse(e))}text(){return m(this,re).call(this,"text")}arrayBuffer(){return m(this,re).call(this,"arrayBuffer")}blob(){return m(this,re).call(this,"blob")}formData(){return m(this,re).call(this,"formData")}addValidatedData(e,t){m(this,Te)[e]=t}valid(e){return m(this,Te)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[Js](){return m(this,B)}get matchedRoutes(){return m(this,B)[0].map(([[,e]])=>e)}get routePath(){return m(this,B)[0].map(([[,e]])=>e)[this.routeIndex].path}},Te=new WeakMap,B=new WeakMap,se=new WeakSet,Is=function(e){const t=m(this,B)[0][this.routeIndex][1][e],r=O(this,se,ss).call(this,t);return r&&/\%/.test(r)?ls(r):r},vs=function(){const e={},t=Object.keys(m(this,B)[0][this.routeIndex][1]);for(const r of t){const s=O(this,se,ss).call(this,m(this,B)[0][this.routeIndex][1][r]);s!==void 0&&(e[r]=/\%/.test(s)?ls(s):s)}return e},ss=function(e){return m(this,B)[1]?m(this,B)[1][e]:e},re=new WeakMap,ms),cr={Stringify:1},Os=async(e,t,r,s,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const o=e.callbacks;return o!=null&&o.length?(a?a[0]+=e:a=[e],Promise.all(o.map(i=>i({phase:t,buffer:a,context:s}))).then(i=>Promise.all(i.filter(Boolean).map(c=>Os(c,t,!1,s,a))).then(()=>a[0]))):Promise.resolve(e)},ur="text/plain; charset=UTF-8",Ze=(e,t)=>({"Content-Type":e,...t}),Le,Me,X,Re,Q,q,Pe,Se,Ie,de,He,Ue,te,ge,_s,lr=(_s=class{constructor(e,t){I(this,te);I(this,Le);I(this,Me);R(this,"env",{});I(this,X);R(this,"finalized",!1);R(this,"error");I(this,Re);I(this,Q);I(this,q);I(this,Pe);I(this,Se);I(this,Ie);I(this,de);I(this,He);I(this,Ue);R(this,"render",(...e)=>(m(this,Se)??T(this,Se,t=>this.html(t)),m(this,Se).call(this,...e)));R(this,"setLayout",e=>T(this,Pe,e));R(this,"getLayout",()=>m(this,Pe));R(this,"setRenderer",e=>{T(this,Se,e)});R(this,"header",(e,t,r)=>{this.finalized&&T(this,q,new Response(m(this,q).body,m(this,q)));const s=m(this,q)?m(this,q).headers:m(this,de)??T(this,de,new Headers);t===void 0?s.delete(e):r!=null&&r.append?s.append(e,t):s.set(e,t)});R(this,"status",e=>{T(this,Re,e)});R(this,"set",(e,t)=>{m(this,X)??T(this,X,new Map),m(this,X).set(e,t)});R(this,"get",e=>m(this,X)?m(this,X).get(e):void 0);R(this,"newResponse",(...e)=>O(this,te,ge).call(this,...e));R(this,"body",(e,t,r)=>O(this,te,ge).call(this,e,t,r));R(this,"text",(e,t,r)=>!m(this,de)&&!m(this,Re)&&!t&&!r&&!this.finalized?new Response(e):O(this,te,ge).call(this,e,t,Ze(ur,r)));R(this,"json",(e,t,r)=>O(this,te,ge).call(this,JSON.stringify(e),t,Ze("application/json",r)));R(this,"html",(e,t,r)=>{const s=a=>O(this,te,ge).call(this,a,t,Ze("text/html; charset=UTF-8",r));return typeof e=="object"?Os(e,cr.Stringify,!1,{}).then(s):s(e)});R(this,"redirect",(e,t)=>{const r=String(e);return this.header("Location",/[^\x00-\xFF]/.test(r)?encodeURI(r):r),this.newResponse(null,t??302)});R(this,"notFound",()=>(m(this,Ie)??T(this,Ie,()=>new Response),m(this,Ie).call(this,this)));T(this,Le,e),t&&(T(this,Q,t.executionCtx),this.env=t.env,T(this,Ie,t.notFoundHandler),T(this,Ue,t.path),T(this,He,t.matchResult))}get req(){return m(this,Me)??T(this,Me,new Ss(m(this,Le),m(this,Ue),m(this,He))),m(this,Me)}get event(){if(m(this,Q)&&"respondWith"in m(this,Q))return m(this,Q);throw Error("This context has no FetchEvent")}get executionCtx(){if(m(this,Q))return m(this,Q);throw Error("This context has no ExecutionContext")}get res(){return m(this,q)||T(this,q,new Response(null,{headers:m(this,de)??T(this,de,new Headers)}))}set res(e){if(m(this,q)&&e){e=new Response(e.body,e);for(const[t,r]of m(this,q).headers.entries())if(t!=="content-type")if(t==="set-cookie"){const s=m(this,q).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of s)e.headers.append("set-cookie",a)}else e.headers.set(t,r)}T(this,q,e),this.finalized=!0}get var(){return m(this,X)?Object.fromEntries(m(this,X)):{}}},Le=new WeakMap,Me=new WeakMap,X=new WeakMap,Re=new WeakMap,Q=new WeakMap,q=new WeakMap,Pe=new WeakMap,Se=new WeakMap,Ie=new WeakMap,de=new WeakMap,He=new WeakMap,Ue=new WeakMap,te=new WeakSet,ge=function(e,t,r){const s=m(this,q)?new Headers(m(this,q).headers):m(this,de)??new Headers;if(typeof t=="object"&&"headers"in t){const o=t.headers instanceof Headers?t.headers:new Headers(t.headers);for(const[n,i]of o)n.toLowerCase()==="set-cookie"?s.append(n,i):s.set(n,i)}if(r)for(const[o,n]of Object.entries(r))if(typeof n=="string")s.set(o,n);else{s.delete(o);for(const i of n)s.append(o,i)}const a=typeof t=="number"?t:(t==null?void 0:t.status)??m(this,Re);return new Response(e,{status:a,headers:s})},_s),M="ALL",dr="all",pr=["get","post","put","delete","options","patch"],js="Can not add a route since the matcher is already built.",Ds=class extends Error{},mr="__COMPOSED_HANDLER",_r=e=>e.text("404 Not Found",404),ds=(e,t)=>{if("getResponse"in e){const r=e.getResponse();return t.newResponse(r.body,r)}return console.error(e),t.text("Internal Server Error",500)},Y,P,Ns,V,ue,qe,Be,ve,fr=(ve=class{constructor(t={}){I(this,P);R(this,"get");R(this,"post");R(this,"put");R(this,"delete");R(this,"options");R(this,"patch");R(this,"all");R(this,"on");R(this,"use");R(this,"router");R(this,"getPath");R(this,"_basePath","/");I(this,Y,"/");R(this,"routes",[]);I(this,V,_r);R(this,"errorHandler",ds);R(this,"onError",t=>(this.errorHandler=t,this));R(this,"notFound",t=>(T(this,V,t),this));R(this,"fetch",(t,...r)=>O(this,P,Be).call(this,t,r[1],r[0],t.method));R(this,"request",(t,r,s,a)=>t instanceof Request?this.fetch(r?new Request(t,r):t,s,a):(t=t.toString(),this.fetch(new Request(/^https?:\/\//.test(t)?t:`http://localhost${be("/",t)}`,r),s,a)));R(this,"fire",()=>{addEventListener("fetch",t=>{t.respondWith(O(this,P,Be).call(this,t.request,t,void 0,t.request.method))})});[...pr,dr].forEach(o=>{this[o]=(n,...i)=>(typeof n=="string"?T(this,Y,n):O(this,P,ue).call(this,o,m(this,Y),n),i.forEach(c=>{O(this,P,ue).call(this,o,m(this,Y),c)}),this)}),this.on=(o,n,...i)=>{for(const c of[n].flat()){T(this,Y,c);for(const u of[o].flat())i.map(l=>{O(this,P,ue).call(this,u.toUpperCase(),m(this,Y),l)})}return this},this.use=(o,...n)=>(typeof o=="string"?T(this,Y,o):(T(this,Y,"*"),n.unshift(o)),n.forEach(i=>{O(this,P,ue).call(this,M,m(this,Y),i)}),this);const{strict:s,...a}=t;Object.assign(this,a),this.getPath=s??!0?t.getPath??gs:or}route(t,r){const s=this.basePath(t);return r.routes.map(a=>{var n;let o;r.errorHandler===ds?o=a.handler:(o=async(i,c)=>(await us([],r.errorHandler)(i,()=>a.handler(i,c))).res,o[mr]=a.handler),O(n=s,P,ue).call(n,a.method,a.path,o)}),this}basePath(t){const r=O(this,P,Ns).call(this);return r._basePath=be(this._basePath,t),r}mount(t,r,s){let a,o;s&&(typeof s=="function"?o=s:(o=s.optionHandler,s.replaceRequest===!1?a=c=>c:a=s.replaceRequest));const n=o?c=>{const u=o(c);return Array.isArray(u)?u:[u]}:c=>{let u;try{u=c.executionCtx}catch{}return[c.env,u]};a||(a=(()=>{const c=be(this._basePath,t),u=c==="/"?0:c.length;return l=>{const d=new URL(l.url);return d.pathname=d.pathname.slice(u)||"/",new Request(d,l)}})());const i=async(c,u)=>{const l=await r(a(c.req.raw),...n(c));if(l)return l;await u()};return O(this,P,ue).call(this,M,be(t,"*"),i),this}},Y=new WeakMap,P=new WeakSet,Ns=function(){const t=new ve({router:this.router,getPath:this.getPath});return t.errorHandler=this.errorHandler,T(t,V,m(this,V)),t.routes=this.routes,t},V=new WeakMap,ue=function(t,r,s){t=t.toUpperCase(),r=be(this._basePath,r);const a={basePath:this._basePath,path:r,method:t,handler:s};this.router.add(t,r,[s,a]),this.routes.push(a)},qe=function(t,r){if(t instanceof Error)return this.errorHandler(t,r);throw t},Be=function(t,r,s,a){if(a==="HEAD")return(async()=>new Response(null,await O(this,P,Be).call(this,t,r,s,"GET")))();const o=this.getPath(t,{env:s}),n=this.router.match(a,o),i=new lr(t,{path:o,matchResult:n,env:s,executionCtx:r,notFoundHandler:m(this,V)});if(n[0].length===1){let u;try{u=n[0][0][0][0](i,async()=>{i.res=await m(this,V).call(this,i)})}catch(l){return O(this,P,qe).call(this,l,i)}return u instanceof Promise?u.then(l=>l||(i.finalized?i.res:m(this,V).call(this,i))).catch(l=>O(this,P,qe).call(this,l,i)):u??m(this,V).call(this,i)}const c=us(n[0],this.errorHandler,m(this,V));return(async()=>{try{const u=await c(i);if(!u.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return u.res}catch(u){return O(this,P,qe).call(this,u,i)}})()},ve),As=[];function Er(e,t){const r=this.buildAllMatchers(),s=((a,o)=>{const n=r[a]||r[M],i=n[2][o];if(i)return i;const c=o.match(n[0]);if(!c)return[[],As];const u=c.indexOf("",1);return[n[1][u],c]});return this.match=s,s(e,t)}var Ye="[^/]+",ke=".*",Ce="(?:|/.*)",we=Symbol(),hr=new Set(".\\+*[^]$()");function yr(e,t){return e.length===1?t.length===1?e<t?-1:1:-1:t.length===1||e===ke||e===Ce?1:t===ke||t===Ce?-1:e===Ye?1:t===Ye?-1:e.length===t.length?e<t?-1:1:t.length-e.length}var pe,me,J,Ee,br=(Ee=class{constructor(){I(this,pe);I(this,me);I(this,J,Object.create(null))}insert(t,r,s,a,o){if(t.length===0){if(m(this,pe)!==void 0)throw we;if(o)return;T(this,pe,r);return}const[n,...i]=t,c=n==="*"?i.length===0?["","",ke]:["","",Ye]:n==="/*"?["","",Ce]:n.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let u;if(c){const l=c[1];let d=c[2]||Ye;if(l&&c[2]&&(d===".*"||(d=d.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(d))))throw we;if(u=m(this,J)[d],!u){if(Object.keys(m(this,J)).some(_=>_!==ke&&_!==Ce))throw we;if(o)return;u=m(this,J)[d]=new Ee,l!==""&&T(u,me,a.varIndex++)}!o&&l!==""&&s.push([l,m(u,me)])}else if(u=m(this,J)[n],!u){if(Object.keys(m(this,J)).some(l=>l.length>1&&l!==ke&&l!==Ce))throw we;if(o)return;u=m(this,J)[n]=new Ee}u.insert(i,r,s,a,o)}buildRegExpStr(){const r=Object.keys(m(this,J)).sort(yr).map(s=>{const a=m(this,J)[s];return(typeof m(a,me)=="number"?`(${s})@${m(a,me)}`:hr.has(s)?`\\${s}`:s)+a.buildRegExpStr()});return typeof m(this,pe)=="number"&&r.unshift(`#${m(this,pe)}`),r.length===0?"":r.length===1?r[0]:"(?:"+r.join("|")+")"}},pe=new WeakMap,me=new WeakMap,J=new WeakMap,Ee),Ve,xe,fs,gr=(fs=class{constructor(){I(this,Ve,{varIndex:0});I(this,xe,new br)}insert(e,t,r){const s=[],a=[];for(let n=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const u=`@\\${n}`;return a[n]=[u,c],n++,i=!0,u}),!i)break}const o=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let n=a.length-1;n>=0;n--){const[i]=a[n];for(let c=o.length-1;c>=0;c--)if(o[c].indexOf(i)!==-1){o[c]=o[c].replace(i,a[n][1]);break}}return m(this,xe).insert(o,t,s,m(this,Ve),r),s}buildRegExp(){let e=m(this,xe).buildRegExpStr();if(e==="")return[/^$/,[],[]];let t=0;const r=[],s=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,o,n)=>o!==void 0?(r[++t]=Number(o),"$()"):(n!==void 0&&(s[Number(n)]=++t),"")),[new RegExp(`^${e}`),r,s]}},Ve=new WeakMap,xe=new WeakMap,fs),wr=[/^$/,[],Object.create(null)],Ke=Object.create(null);function ks(e){return Ke[e]??(Ke[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(t,r)=>r?`\\${r}`:"(?:|/.*)")}$`))}function Tr(){Ke=Object.create(null)}function Rr(e){var u;const t=new gr,r=[];if(e.length===0)return wr;const s=e.map(l=>[!/\*|\/:/.test(l[0]),...l]).sort(([l,d],[_,f])=>l?1:_?-1:d.length-f.length),a=Object.create(null);for(let l=0,d=-1,_=s.length;l<_;l++){const[f,E,y]=s[l];f?a[E]=[y.map(([g])=>[g,Object.create(null)]),As]:d++;let h;try{h=t.insert(E,d,f)}catch(g){throw g===we?new Ds(E):g}f||(r[d]=y.map(([g,b])=>{const j=Object.create(null);for(b-=1;b>=0;b--){const[D,w]=h[b];j[D]=w}return[g,j]}))}const[o,n,i]=t.buildRegExp();for(let l=0,d=r.length;l<d;l++)for(let _=0,f=r[l].length;_<f;_++){const E=(u=r[l][_])==null?void 0:u[1];if(!E)continue;const y=Object.keys(E);for(let h=0,g=y.length;h<g;h++)E[y[h]]=i[E[y[h]]]}const c=[];for(const l in n)c[l]=r[n[l]];return[o,c,a]}function ye(e,t){if(e){for(const r of Object.keys(e).sort((s,a)=>a.length-s.length))if(ks(r).test(t))return[...e[r]]}}var ae,oe,Je,Cs,Es,Sr=(Es=class{constructor(){I(this,Je);R(this,"name","RegExpRouter");I(this,ae);I(this,oe);R(this,"match",Er);T(this,ae,{[M]:Object.create(null)}),T(this,oe,{[M]:Object.create(null)})}add(e,t,r){var i;const s=m(this,ae),a=m(this,oe);if(!s||!a)throw new Error(js);s[e]||[s,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[M]).forEach(u=>{c[e][u]=[...c[M][u]]})}),t==="/*"&&(t="*");const o=(t.match(/\/:/g)||[]).length;if(/\*$/.test(t)){const c=ks(t);e===M?Object.keys(s).forEach(u=>{var l;(l=s[u])[t]||(l[t]=ye(s[u],t)||ye(s[M],t)||[])}):(i=s[e])[t]||(i[t]=ye(s[e],t)||ye(s[M],t)||[]),Object.keys(s).forEach(u=>{(e===M||e===u)&&Object.keys(s[u]).forEach(l=>{c.test(l)&&s[u][l].push([r,o])})}),Object.keys(a).forEach(u=>{(e===M||e===u)&&Object.keys(a[u]).forEach(l=>c.test(l)&&a[u][l].push([r,o]))});return}const n=ws(t)||[t];for(let c=0,u=n.length;c<u;c++){const l=n[c];Object.keys(a).forEach(d=>{var _;(e===M||e===d)&&((_=a[d])[l]||(_[l]=[...ye(s[d],l)||ye(s[M],l)||[]]),a[d][l].push([r,o-u+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(m(this,oe)).concat(Object.keys(m(this,ae))).forEach(t=>{e[t]||(e[t]=O(this,Je,Cs).call(this,t))}),T(this,ae,T(this,oe,void 0)),Tr(),e}},ae=new WeakMap,oe=new WeakMap,Je=new WeakSet,Cs=function(e){const t=[];let r=e===M;return[m(this,ae),m(this,oe)].forEach(s=>{const a=s[e]?Object.keys(s[e]).map(o=>[o,s[e][o]]):[];a.length!==0?(r||(r=!0),t.push(...a)):e!==M&&t.push(...Object.keys(s[M]).map(o=>[o,s[M][o]]))}),r?Rr(t):null},Es),ne,Z,hs,Ir=(hs=class{constructor(e){R(this,"name","SmartRouter");I(this,ne,[]);I(this,Z,[]);T(this,ne,e.routers)}add(e,t,r){if(!m(this,Z))throw new Error(js);m(this,Z).push([e,t,r])}match(e,t){if(!m(this,Z))throw new Error("Fatal error");const r=m(this,ne),s=m(this,Z),a=r.length;let o=0,n;for(;o<a;o++){const i=r[o];try{for(let c=0,u=s.length;c<u;c++)i.add(...s[c]);n=i.match(e,t)}catch(c){if(c instanceof Ds)continue;throw c}this.match=i.match.bind(i),T(this,ne,[i]),T(this,Z,void 0);break}if(o===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,n}get activeRouter(){if(m(this,Z)||m(this,ne).length!==1)throw new Error("No active router has been determined yet.");return m(this,ne)[0]}},ne=new WeakMap,Z=new WeakMap,hs),Ne=Object.create(null),ie,$,_e,Oe,x,ee,le,je,vr=(je=class{constructor(t,r,s){I(this,ee);I(this,ie);I(this,$);I(this,_e);I(this,Oe,0);I(this,x,Ne);if(T(this,$,s||Object.create(null)),T(this,ie,[]),t&&r){const a=Object.create(null);a[t]={handler:r,possibleKeys:[],score:0},T(this,ie,[a])}T(this,_e,[])}insert(t,r,s){T(this,Oe,++cs(this,Oe)._);let a=this;const o=er(r),n=[];for(let i=0,c=o.length;i<c;i++){const u=o[i],l=o[i+1],d=tr(u,l),_=Array.isArray(d)?d[0]:u;if(_ in m(a,$)){a=m(a,$)[_],d&&n.push(d[1]);continue}m(a,$)[_]=new je,d&&(m(a,_e).push(d),n.push(d[1])),a=m(a,$)[_]}return m(a,ie).push({[t]:{handler:s,possibleKeys:n.filter((i,c,u)=>u.indexOf(i)===c),score:m(this,Oe)}}),a}search(t,r){var c;const s=[];T(this,x,Ne);let o=[this];const n=bs(r),i=[];for(let u=0,l=n.length;u<l;u++){const d=n[u],_=u===l-1,f=[];for(let E=0,y=o.length;E<y;E++){const h=o[E],g=m(h,$)[d];g&&(T(g,x,m(h,x)),_?(m(g,$)["*"]&&s.push(...O(this,ee,le).call(this,m(g,$)["*"],t,m(h,x))),s.push(...O(this,ee,le).call(this,g,t,m(h,x)))):f.push(g));for(let b=0,j=m(h,_e).length;b<j;b++){const D=m(h,_e)[b],w=m(h,x)===Ne?{}:{...m(h,x)};if(D==="*"){const H=m(h,$)["*"];H&&(s.push(...O(this,ee,le).call(this,H,t,m(h,x))),T(H,x,w),f.push(H));continue}const[N,L,S]=D;if(!d&&!(S instanceof RegExp))continue;const A=m(h,$)[N],U=n.slice(u).join("/");if(S instanceof RegExp){const H=S.exec(U);if(H){if(w[L]=H[0],s.push(...O(this,ee,le).call(this,A,t,m(h,x),w)),Object.keys(m(A,$)).length){T(A,x,w);const z=((c=H[0].match(/\//))==null?void 0:c.length)??0;(i[z]||(i[z]=[])).push(A)}continue}}(S===!0||S.test(d))&&(w[L]=d,_?(s.push(...O(this,ee,le).call(this,A,t,w,m(h,x))),m(A,$)["*"]&&s.push(...O(this,ee,le).call(this,m(A,$)["*"],t,w,m(h,x)))):(T(A,x,w),f.push(A)))}}o=f.concat(i.shift()??[])}return s.length>1&&s.sort((u,l)=>u.score-l.score),[s.map(({handler:u,params:l})=>[u,l])]}},ie=new WeakMap,$=new WeakMap,_e=new WeakMap,Oe=new WeakMap,x=new WeakMap,ee=new WeakSet,le=function(t,r,s,a){const o=[];for(let n=0,i=m(t,ie).length;n<i;n++){const c=m(t,ie)[n],u=c[r]||c[M],l={};if(u!==void 0&&(u.params=Object.create(null),o.push(u),s!==Ne||a&&a!==Ne))for(let d=0,_=u.possibleKeys.length;d<_;d++){const f=u.possibleKeys[d],E=l[u.score];u.params[f]=a!=null&&a[f]&&!E?a[f]:s[f]??(a==null?void 0:a[f]),l[u.score]=!0}}return o},je),fe,ys,Or=(ys=class{constructor(){R(this,"name","TrieRouter");I(this,fe);T(this,fe,new vr)}add(e,t,r){const s=ws(t);if(s){for(let a=0,o=s.length;a<o;a++)m(this,fe).insert(e,s[a],r);return}m(this,fe).insert(e,t,r)}match(e,t){return m(this,fe).search(e,t)}},fe=new WeakMap,ys),Ls=class extends fr{constructor(e={}){super(e),this.router=e.router??new Ir({routers:[new Sr,new Or]})}},k=e=>{const r={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},s=(o=>typeof o=="string"?o==="*"?()=>o:n=>o===n?n:null:typeof o=="function"?o:n=>o.includes(n)?n:null)(r.origin),a=(o=>typeof o=="function"?o:Array.isArray(o)?()=>o:()=>[])(r.allowMethods);return async function(n,i){var l;function c(d,_){n.res.headers.set(d,_)}const u=await s(n.req.header("origin")||"",n);if(u&&c("Access-Control-Allow-Origin",u),r.credentials&&c("Access-Control-Allow-Credentials","true"),(l=r.exposeHeaders)!=null&&l.length&&c("Access-Control-Expose-Headers",r.exposeHeaders.join(",")),n.req.method==="OPTIONS"){r.origin!=="*"&&c("Vary","Origin"),r.maxAge!=null&&c("Access-Control-Max-Age",r.maxAge.toString());const d=await a(n.req.header("origin")||"",n);d.length&&c("Access-Control-Allow-Methods",d.join(","));let _=r.allowHeaders;if(!(_!=null&&_.length)){const f=n.req.header("Access-Control-Request-Headers");f&&(_=f.split(/\s*,\s*/))}return _!=null&&_.length&&(c("Access-Control-Allow-Headers",_.join(",")),n.res.headers.append("Vary","Access-Control-Request-Headers")),n.res.headers.delete("Content-Length"),n.res.headers.delete("Content-Type"),new Response(null,{headers:n.res.headers,status:204,statusText:"No Content"})}await i(),r.origin!=="*"&&n.header("Vary","Origin",{append:!0})}};const es={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function jr(){const e=es.ENV==="production";return{baseUrl:es.TEST_BASE_URL,apiKey:es.TEST_API_KEY,isProduction:e}}async function Ms(e,t){const r=jr(),s=`${r.baseUrl}${e}`;try{const a=await fetch(s,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r.apiKey}`},body:JSON.stringify(t)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function Dr(e){try{const t={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((s,a)=>({SerialNum:a+1,ItemName:s.name,Qty:s.quantity,UnitPrice:s.unitPrice,SupplyCost:s.supplyPrice,Tax:s.taxAmount,Remark:s.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},r=await Ms("/eTaxInvoice/RegistAndIssue",t);if(r.code!==1)throw new Error(`바로빌 발행 실패: ${r.message}`);return{success:!0,ntsConfirmNumber:r.ntsconfirmNum,invoiceKey:r.invoiceKey,message:r.message}}catch(t){throw console.error("바로빌 세금계산서 발행 실패:",t),t}}async function Nr(e,t,r){try{const a=await Ms("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:t,Memo:r});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(s){throw console.error("바로빌 세금계산서 취소 실패:",s),s}}function Ae(){return!1}async function Ar(e){return await Dr(e)}function kr(e,t,r){const s=Number(t.total_amount),a=Math.floor(s/1.1),o=s-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:t.buyer_business_number,buyerBusinessName:t.buyer_business_name||t.user_name,buyerCEO:t.buyer_ceo_name,buyerAddress:t.shipping_address,buyerEmail:t.user_email,buyerTel:t.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:r.map(n=>{const i=Number(n.price)*Number(n.quantity),c=Math.floor(i/1.1),u=i-c;return{name:n.product_name,quantity:Number(n.quantity),unitPrice:Number(n.price),supplyPrice:c,taxAmount:u,description:n.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:o,totalAmount:s,memo:`주문번호: ${t.order_number}`,orderNo:t.order_number}}class K extends Error{constructor(t,r,s){super(t),this.statusCode=r,this.code=s,this.name="AuthError"}}function Cr(e){return`${crypto.randomUUID()}-${e}`}function Lr(e){var o,n,i,c,u,l,d;const t=e.id.toString(),r=((o=e.properties)==null?void 0:o.nickname)||((i=(n=e.kakao_account)==null?void 0:n.profile)==null?void 0:i.nickname)||"Kakao User",s=((c=e.kakao_account)==null?void 0:c.email)||null,a=((u=e.properties)==null?void 0:u.profile_image)||((d=(l=e.kakao_account)==null?void 0:l.profile)==null?void 0:d.profile_image_url)||null;return{kakaoId:t,nickname:r,email:s,profileImage:a}}async function Mr(e,t,r,s,a){try{await e.prepare(`
      INSERT OR IGNORE INTO users (
        kakao_id, name, email, profile_image, 
        created_at, last_login_at, updated_at
      )
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `).bind(t,r,s,a).run(),await e.prepare(`
      UPDATE users 
      SET name = ?, 
          email = ?, 
          profile_image = ?,
          last_login_at = datetime('now'),
          updated_at = datetime('now')
      WHERE kakao_id = ?
    `).bind(r,s,a,t).run();const o=await e.prepare(`
      SELECT id, kakao_id, name, email, profile_image
      FROM users
      WHERE kakao_id = ?
      LIMIT 1
    `).bind(t).first();if(!o)throw new K("Failed to retrieve user after upsert",500,"UPSERT_FAILED");return console.log("[Auth] User upserted successfully:",o.id),o}catch(o){throw o instanceof K?o:(console.error("[Auth] Database error during upsert:",o),new K("Database error",500,"DB_ERROR"))}}async function Pr(e){try{const t=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!t.ok){const s=await t.text();throw console.error("[Kakao API] Failed to get user info:",s),new K("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const r=await t.json();if(!r.id)throw new K("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return r}catch(t){throw t instanceof K?t:(console.error("[Kakao API] Network error:",t),new K("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function Hr(e,t,r){try{const s=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:r,redirect_uri:t,code:e}).toString()});if(!s.ok){const o=await s.json();throw console.error("[Kakao OAuth] Token exchange failed:",o),new K(`Failed to exchange code: ${o.error_description||o.error}`,401,o.error||"TOKEN_EXCHANGE_FAILED")}return(await s.json()).access_token}catch(s){throw s instanceof K?s:(console.error("[Kakao OAuth] Network error:",s),new K("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function Ps(e,t){const r=await Pr(t),{kakaoId:s,nickname:a,email:o,profileImage:n}=Lr(r);console.log("[Auth] Processing login for Kakao user:",s);const i=await Mr(e,s,a,o,n),c=Cr(i.id);return{user:i,sessionToken:c}}function Ur(e){const t=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:t,message:"API Request",context:e,duration:e.duration}))}function xr(e){return{name:"tosspayments",async confirmPayment(t){try{const r=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:t.paymentKey,orderId:t.orderId,amount:t.amount})}),s=await r.json();if(!r.ok)return{success:!1,orderId:t.orderId,paymentKey:t.paymentKey,method:"",totalAmount:t.amount,status:"FAILED",approvedAt:"",error:s.message||"결제 승인 실패",rawData:s};let a={};s.card&&(a={cardCompany:s.card.company,cardNumber:s.card.number,installmentMonths:s.card.installmentPlanMonths||0});let o={};return s.virtualAccount&&(o={virtualAccountBank:s.virtualAccount.bankCode,virtualAccountNumber:s.virtualAccount.accountNumber,virtualAccountHolder:s.virtualAccount.customerName,virtualAccountDueDate:s.virtualAccount.dueDate}),{success:!0,orderId:s.orderId,paymentKey:s.paymentKey,method:s.method,totalAmount:s.totalAmount,status:s.status,approvedAt:s.approvedAt,transactionId:s.transactionKey,...a,...o,rawData:s}}catch(r){return{success:!1,orderId:t.orderId,paymentKey:t.paymentKey,method:"",totalAmount:t.amount,status:"FAILED",approvedAt:"",error:r.message,rawData:null}}},async cancelPayment(t){try{const r={cancelReason:t.cancelReason};t.cancelAmount&&(r.cancelAmount=t.cancelAmount);const s=await fetch(`https://api.tosspayments.com/v1/payments/${t.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(r)}),a=await s.json();return s.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(r){return{success:!1,error:r.message}}},async getPayment(t){try{const r=await fetch(`https://api.tosspayments.com/v1/payments/${t}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),s=await r.json();if(!r.ok)throw new Error(s.message);return{success:!0,orderId:s.orderId,paymentKey:s.paymentKey,method:s.method,totalAmount:s.totalAmount,status:s.status,approvedAt:s.approvedAt,rawData:s}}catch(r){throw r}}}}function Fr(e,t){switch(e.toLowerCase()){case"tosspayments":return xr(t);default:throw new Error(`Unknown payment provider: ${e}`)}}const p=new Ls;async function $r(e,t){if(!t)return null;try{const r=await e.get(`session:${t}`);return r&&JSON.parse(r).user_id||null}catch(r){return console.error("[Auth] Session lookup error:",r),null}}async function he(e,t){var o;const{SESSION_KV:r}=e.env;let s=(o=e.req.header("Authorization"))==null?void 0:o.replace("Bearer ","");if(!s){const n=e.req.header("Cookie");if(n){const i=n.match(/session=([^;]+)/);s=i?i[1]:void 0}}const a=await $r(r,s);if(!a)return e.json({success:!1,error:"인증이 필요합니다. 로그인 해주세요."},401);e.set("userId",a),await t()}async function ts(e,t){try{const r=await e.get(t);return r?JSON.parse(r):null}catch(r){return console.error("[Cache] Read error:",r),null}}async function as(e,t,r,s=60){try{await e.put(t,JSON.stringify(r),{expirationTtl:s})}catch(a){console.error("[Cache] Write error:",a)}}async function os(e,...t){try{await Promise.all(t.map(r=>e.delete(r)))}catch(r){console.error("[Cache] Delete error:",r)}}async function Fe(e,t,r,s,a,o,n){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(t,r,s,a,o,n||null).run(),console.log(`[Notification] Created for ${r} ${t}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function Wr(e,t,r,s,a){await Fe(e,t,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${s}님의 주문 (${r}) - ${Br(a)}`,"/seller/orders")}async function Hs(e,t,r,s,a,o){let n="",i="";switch(s){case"preparing":n="📦 상품 준비 중",i=`주문번호 ${r}의 상품을 준비하고 있습니다`;break;case"shipping":n="🚚 배송이 시작되었습니다",i=`주문번호 ${r}가 배송 중입니다`,a&&o&&(i+=` (${a}: ${o})`);break;case"delivered":n="✅ 배송 완료",i=`주문번호 ${r}가 배송 완료되었습니다`;break;default:return}await Fe(e,t,"user","shipping_status",n,i,"/my-orders")}async function qr(e,t,r,s,a){await Fe(e,t,"seller","low_stock","⚠️ 재고 부족 알림",`${r}의 재고가 ${s}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function Br(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function Kr(e,t,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const s=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:t,description:r,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!s.ok){const d=await s.text();throw new Error(`YouTube Broadcast 생성 실패: ${d}`)}const o=(await s.json()).id,n=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${t} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!n.ok){const d=await n.text();throw new Error(`YouTube Stream 생성 실패: ${d}`)}const i=await n.json(),c=i.id,u=i.cdn.ingestionInfo.streamName,l=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${o}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:o,streamId:c,streamKey:u,streamUrl:l}}catch(s){throw console.error("[YouTube API] Live broadcast creation failed:",s),s}}async function Yr(e,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${t}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!r.ok){const s=await r.text();throw new Error(`YouTube 방송 종료 실패: ${s}`)}}catch(r){throw console.error("[YouTube API] Live broadcast end failed:",r),r}}async function Vr(e,t,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let s=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${t}&part=snippet,authorDetails`;r&&(s+=`&pageToken=${r}`);const a=await fetch(s,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const n=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${n}`)}const o=await a.json();return{messages:o.items||[],nextPageToken:o.nextPageToken,pollingIntervalMillis:o.pollingIntervalMillis||5e3}}catch(s){throw console.error("[YouTube API] Get chat messages failed:",s),s}}async function Jr(e,t){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const r=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},s=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}&key=${e.apiKey}`,a=await fetch(s,{headers:r});if(!a.ok){const u=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${u}`)}const o=await a.json();if(!o.items||o.items.length===0)throw new Error("Video not found");const n=o.items[0],i=n.statistics,c=n.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(r){throw console.error("[YouTube API] Get live stats failed:",r),r}}function Us(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const t=new URL(e);if(t.hostname.includes("youtube.com")){const r=t.searchParams.get("v");if(r)return r;const s=t.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(s)return s[2]}if(t.hostname==="youtu.be"){const r=t.pathname.slice(1).split("?")[0];if(r&&r.length===11)return r}return null}catch{return null}}function xs(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){const r=t.pathname.match(/\/video\/(\d+)/);if(r)return r[1];const s=t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(s)return s[1]}return t.hostname.includes("vm.tiktok.com")||t.hostname.includes("vt.tiktok.com")?t.pathname.slice(1):null}catch{return null}}function zr(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){if(t.pathname.includes("/live"))return"live";if(t.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Fs(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){const r=t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return t.hostname.includes("vm.tiktok.com")||t.hostname.includes("vt.tiktok.com")?t.pathname.slice(1):null}catch{return null}}p.use("*",async(e,t)=>{await t(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const r=new URL(e.req.url);r.hostname!=="localhost"&&r.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",k());p.use("/api/*",async(e,t)=>{const r=Date.now(),s=e.req.method,a=e.req.path;await t();const o=Date.now()-r,n=e.res.status,i={method:s,path:a,status:n,duration:o},c=e.get("userId");c&&(i.userId=c),Ur(i)});p.use("/static/*",async(e,t)=>{await t(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/images/*",async(e,t)=>{await t(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});async function $s(e,t,r,s){const a=`${r}_${t}_${Date.now()}_${Math.random().toString(36).substring(7)}`,o=Date.now()+1440*60*1e3,n={userId:t,userType:r,userData:s,expiresAt:o};return await e.put(`session:${a}`,JSON.stringify(n),{expirationTtl:86400}),a}async function De(e,t){const r=await e.get(`session:${t}`);if(!r)return null;const s=JSON.parse(r);return s.expiresAt&&Date.now()>s.expiresAt?(await e.delete(`session:${t}`),null):{session_token:t,[`${s.userType}_id`]:s.userId,user_type:s.userType,...s.userData}}p.post("/api/auth/user/register",k(),async e=>{const{DB:t}=e.env;try{const{email:r,password:s,name:a,phone:o}=await e.req.json();if(!r||!s||!a)return e.json({success:!1,error:"이메일, 비밀번호, 이름은 필수입니다"},400);if(await t.prepare("SELECT id FROM users WHERE email = ?").bind(r).first())return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);const i=`placeholder_hash_for_${s}`,u=(await t.prepare(`
      INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,i,a,o||null).run()).meta.last_row_id,l=`user_${u}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:l,user:{id:u,email:r,name:a,phone:o}}})}catch(r){return console.error("[User Register] Error:",r),e.json({success:!1,error:r.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/auth/user/login",k(),async e=>{const{DB:t}=e.env;try{const{email:r,password:s}=await e.req.json();if(!r||!s)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await t.prepare("SELECT * FROM users WHERE email = ?").bind(r).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${s}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await t.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(a.id).run();const n=`user_${a.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:n,user:{id:a.id,email:a.email,name:a.name,phone:a.phone,profile_image:a.profile_image}}})}catch(r){return console.error("[User Login] Error:",r),e.json({success:!1,error:r.message||"로그인 중 오류가 발생했습니다"},500)}});p.post("/api/auth/login",k(),async e=>{const{DB:t}=e.env;try{const{username:r,password:s,userType:a}=await e.req.json();if(!r||!s||!a)return e.json({success:!1,error:"아이디와 비밀번호를 입력해주세요"},400);let o,n=a==="admin"?"admins":"sellers";if(o=await t.prepare(`SELECT * FROM ${n} WHERE username = ? OR email = ?`).bind(r,r).first(),!o)return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);const i=a==="admin"&&(r==="admin"||r==="admin@example.com")&&s==="admin123",c=a==="seller"&&(r==="seller1"&&s==="seller123"||r==="seller2"&&s==="seller123"),u=o.password_hash&&o.password_hash.includes(`placeholder_hash_for_${s}`);if(!(i||c||u))return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);if(!o.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(a==="seller"&&o.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다"},403);const d=await $s(e.env.SESSION_KV,o.id,a,{username:o.username,name:o.name,email:o.email,businessName:o.business_name,role:o.role});return await t.prepare(`UPDATE ${n} SET last_login_at = datetime('now') WHERE id = ?`).bind(o.id).run(),e.json({success:!0,data:{sessionToken:d,user:{id:o.id,username:o.username,name:o.name,email:o.email,type:a,businessName:o.business_name,role:o.role}}})}catch(r){return console.error("Login error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/auth/logout",k(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token");return r&&await e.env.SESSION_KV.delete(`session:${r}`),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/register",k(),async e=>{const{DB:t}=e.env;try{const{email:r,password:s,name:a,phone:o,business_number:n,company_name:i}=await e.req.json();if(!r||!s||!a||!o)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(s.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);if(await t.prepare("SELECT id FROM sellers WHERE email = ?").bind(r).first())return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);const u=r.split("@")[0],l=`placeholder_hash_for_${s}`,d=await t.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, phone, 
        business_number, company_name, status, is_active, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
    `).bind(u,r,l,a,o,n||null,i||null).run();return e.json({success:!0,data:{sellerId:d.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(r){return console.error("Seller registration error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/login",k(),async e=>{const{DB:t}=e.env;try{const{email:r,password:s}=await e.req.json();if(!r||!s)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await t.prepare("SELECT * FROM admins WHERE email = ?").bind(r).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(r==="admin@example.com"&&s==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${s}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=await $s(e.env.SESSION_KV,a.id,"admin",{username:a.username,email:a.email,name:a.name,role:a.role});return await t.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),e.json({success:!0,data:{token:i,admin:{id:a.id,username:a.username,email:a.email,name:a.name,role:a.role}}})}catch(r){return console.error("Admin login error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/auth/verify",k(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const s=await De(e.env.SESSION_KV,r);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=s.user_type==="admin"?"admins":"sellers",o=s.user_type==="admin"?s.admin_id:s.seller_id,n=await t.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(o).first();return n?e.json({success:!0,data:{user:{id:n.id,type:s.user_type,username:n.username,name:n.name,email:n.email,businessName:n.business_name,role:n.role}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/auth/kakao/sync/callback",async e=>{var r,s,a,o,n,i,c,u,l,d,_,f,E;const{DB:t}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!t);const y=e.req.query("code"),h=e.req.query("state")||"/",g=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!y,state:h,error:g}),g)return console.error("[Kakao Sync] OAuth error:",g),e.redirect(`${h}?error=kakao_oauth_${g}`);if(!y)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${h}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const b=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",j=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",b.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",j),console.log("[Kakao Sync] Step 1: Fetching access token...");const D=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:b,redirect_uri:j,code:y})});if(console.log("[Kakao Sync] Token response status:",D.status),console.log("[Kakao Sync] Token request details:",{client_id:b,redirect_uri:j,code_length:y.length,code_prefix:y.substring(0,20)}),!D.ok){const W=await D.text();return console.error("[Kakao Sync] Token request failed:",W),e.redirect(`${h}?error=token_request_failed&detail=${encodeURIComponent(W)}`)}const w=await D.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!w.access_token,error:w.error,errorDescription:w.error_description}),!w.access_token)return console.error("[Kakao Sync] Token error:",w),e.redirect(`${h}?error=token_failed&detail=${encodeURIComponent(w.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const N=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${w.access_token}`}});console.log("[Kakao Sync] User response status:",N.status);const L=await N.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!L.id,id:L.id,hasNickname:!!((r=L.properties)!=null&&r.nickname||(a=(s=L.kakao_account)==null?void 0:s.profile)!=null&&a.nickname)}),!L.id)return console.error("[Kakao Sync] Failed to get user info:",L),e.redirect(`${h}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const S=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${w.access_token}`}});console.log("[Kakao Sync] Terms response status:",S.status);let A=null;if(S.ok?(A=await S.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((o=A.allowed_service_terms)==null?void 0:o.length)||0,tags:(n=A.allowed_service_terms)==null?void 0:n.map(W=>W.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!t)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${h}?error=db_not_available`);const U=L.id.toString(),H=((i=L.properties)==null?void 0:i.nickname)||((u=(c=L.kakao_account)==null?void 0:c.profile)==null?void 0:u.nickname)||"Kakao User",z=((l=L.kakao_account)==null?void 0:l.email)||"",$e=((d=L.properties)==null?void 0:d.profile_image)||((f=(_=L.kakao_account)==null?void 0:_.profile)==null?void 0:f.profile_image_url)||"",ze=w.access_token,F=((E=A==null?void 0:A.allowed_service_terms)==null?void 0:E.map(W=>W.tag))||[],ce=JSON.stringify(F);console.log("[Kakao Sync] User data:",{kakaoId:U,nickname:H,email:z?"exists":"none",serviceTerms:F});try{const W=await t.prepare("SELECT * FROM users WHERE kakao_id = ?").bind(U).first();console.log("[Kakao Sync] Existing user check:",!!W);let G;W?(G=W.id,await t.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(H,z,$e,G).run(),console.log("[Kakao Sync] Updated user:",G)):(G=(await t.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(U,H,z||null,$e||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",G)),console.log("[Kakao Sync] User saved successfully, userId:",G),console.log("[Kakao Sync] Step 4: Creating session...");const{SESSION_KV:Bs}=e.env,Ge=crypto.randomUUID(),Ks=Date.now()+1440*60*1e3;await Bs.put(`session:${Ge}`,JSON.stringify({user_id:G,user_type:"user",expires_at:Ks}),{expirationTtl:1440*60}),console.log("[Kakao Sync] Session created successfully in SESSION_KV"),console.log("[Kakao Sync] Step 5: Redirecting...");const ns=h.includes("?")?`${h}&login=success&session=${Ge}&userId=${G}&userName=${encodeURIComponent(H)}`:`${h}?login=success&session=${Ge}&userId=${G}&userName=${encodeURIComponent(H)}`;return console.log("[Kakao Sync] Redirect URL:",ns),e.redirect(ns)}catch(W){return console.error("[Kakao Sync] Database error:",W),console.error("[Kakao Sync] DB error details:",{message:W.message,name:W.name}),e.redirect(`${h}?error=database_error&detail=${encodeURIComponent(W.message)}`)}}catch(y){console.error("[Kakao Sync] Exception:",y),console.error("[Kakao Sync] Error details:",{message:y.message,stack:y.stack,name:y.name});const h=e.req.query("state")||"/",g=encodeURIComponent(y.message||"unknown");return e.redirect(`${h}?error=kakao_sync_failed&detail=${g}`)}});p.post("/api/auth/kakao/callback",k(),async e=>{const{DB:t}=e.env;try{const{code:r,redirect_uri:s}=await e.req.json();if(!r)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=s||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow");const o=await Hr(r,a,e.env.KAKAO_REST_API_KEY),{user:n,sessionToken:i}=await Ps(t,o);return e.json({success:!0,data:{session_token:i,user:{id:n.id,name:n.name,email:n.email,profile_image:n.profile_image}}})}catch(r){return console.error("[Kakao Callback] Error:",r),r instanceof K?e.json({success:!1,error:r.message,code:r.code},r.statusCode):e.json({success:!1,error:r.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/sync",k(),async e=>{const{DB:t}=e.env;try{const{accessToken:r}=await e.req.json();if(!r)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Sync] Verifying access token");const{user:s,sessionToken:a}=await Ps(t,r);return console.log("[Kakao Sync] Login successful"),e.json({success:!0,data:{session_token:a,user:{id:s.id,name:s.name,email:s.email,profile_image:s.profile_image}}})}catch(r){return console.error("[Kakao Sync] Error:",r),r instanceof K?e.json({success:!1,error:r.message,code:r.code},r.statusCode):e.json({success:!1,error:r instanceof Error?r.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/logout",k(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token")||"";return r&&(await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(r){return console.error("[Kakao Sync] Logout error:",r),e.json({success:!1,error:"Logout failed"},500)}});p.post("/api/auth/kakao/unlink",k(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await t.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(r).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await t.prepare(`
      SELECT * FROM users WHERE id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(r).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const o=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),n=await o.json();o.ok?console.log("[Kakao Unlink] Kakao unlink successful:",n.id):console.warn("[Kakao Unlink] Kakao unlink failed:",n)}catch(o){console.error("[Kakao Unlink] Kakao API error:",o)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(),console.log("[Kakao Unlink] Sessions deleted"),await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await t.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(r){return console.error("[Kakao Unlink] Error:",r),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});p.post("/webhooks/kakao/unlink",async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),{user_id:s,referrer_type:a}=r;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:s,referrer_type:a}),!s)return e.json({success:!1,error:"user_id is required"},400);const o=await t.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(s.toString()).first();return o?(console.log("[Kakao Webhook] Deleting user data for user:",o.id),await t.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(o.id).run(),await t.prepare("DELETE FROM users WHERE id = ?").bind(o.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",s),e.json({success:!0}))}catch(r){return console.error("[Kakao Webhook] Error:",r),e.json({success:!1,error:"Webhook processing failed"},500)}});p.get("/api/auth/user/verify",k(),async e=>{const{DB:t}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const s=await De(e.env.SESSION_KV,r);if(!s||s.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=parseInt(r.split("_")[1]),o=await t.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();return o?e.json({success:!0,data:{user:{id:o.id,name:o.name,email:o.email,profileImage:o.profile_image,phone:o.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/shipping-addresses",k(),he,async e=>{const{DB:t}=e.env,r=e.get("userId");try{const s=await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();return e.json({success:!0,data:s.results||[]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/shipping-addresses/:userId",k(),he,async e=>{const{DB:t}=e.env,r=e.get("userId"),s=parseInt(e.req.param("userId"));try{if(s!==r)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/shipping-addresses",k(),async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),s=r.user_id,a=r.recipient_name,o=r.phone,n=r.postal_code,i=r.address,c=r.address_detail,u=r.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(r)),!s||!a||!o||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:s,recipientName:a,phone:o,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);u&&await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(s).run();const l=await t.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s,a,o,n||"",i,c||"",u?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:l.meta.last_row_id}),e.json({success:!0,data:{id:l.meta.last_row_id}})}catch(r){return console.error("[POST /api/shipping-addresses] Error:",r),e.json({success:!1,error:r.message},500)}});p.put("/api/shipping-addresses/:id",k(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("id"),s=await e.req.json(),a=s.user_id,o=s.recipient_name,n=s.phone,i=s.postal_code,c=s.address,u=s.address_detail,l=s.is_default;return l&&await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await t.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(o,n,i||"",c,u||"",l?1:0,r,a).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/shipping-addresses/:id",k(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("id"),s=e.req.query("userId");return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r,s).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});async function C(e){const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await De(e.env.SESSION_KV,t);return!r||r.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:r.admin_id,userData:r}}async function v(e){const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await De(e.env.SESSION_KV,t);return!r||r.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:r.seller_id,userData:r}}p.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));p.get("/api/streams",async e=>{const{DB:t,CACHE_KV:r}=e.env;try{const s="streams:live",a=await r.get(s,"json");if(a)return e.json({success:!0,data:a,cached:!0});const o=await t.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();return await r.put(s,JSON.stringify(o.results),{expirationTtl:600}),e.json({success:!0,data:o.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/streams/:id",async e=>{const{DB:t}=e.env,r=e.req.param("id");try{const s=await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(r).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"Stream not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/live-streams",async e=>{const{DB:t}=e.env,{status:r,seller_id:s,limit:a="20",offset:o="0"}=e.req.query();try{let n=`
      SELECT ls.*, 
             s.display_name as seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE 1=1
    `;const i=[];r&&(n+=" AND ls.status = ?",i.push(r)),s&&(n+=" AND ls.seller_id = ?",i.push(s)),n+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',n+=" LIMIT ? OFFSET ?",i.push(parseInt(a),parseInt(o));const{results:c}=await t.prepare(n).bind(...i).all();return e.json({success:!0,data:c})}catch(n){return console.error("[API] Live streams list error:",n),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${n.message}`},500)}});p.get("/api/live-streams/:id",async e=>{const{DB:t}=e.env,r=e.req.param("id");try{const s=await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(r).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"Stream not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/products",async e=>{const{DB:t,CACHE_KV:r}=e.env;try{const s=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),o=parseInt(e.req.query("offset")||"0"),n=`products:list:${s||"all"}:${a}:${o}`,i=await ts(r,n);if(i)return e.json({success:!0,data:i,cached:!0});let c;s==="true"?c=`
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
      `;const l=(await t.prepare(c).bind(a,o).all()).results||[];return await as(r,n,l,300),e.json({success:!0,data:l,cached:!1})}catch(s){return console.error("Products list error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/products/popular",async e=>{const{DB:t,CACHE_KV:r}=e.env;try{const s=await ts(r,"products:popular");if(s)return e.json({success:!0,data:s,cached:!0});const o=(await t.prepare(`
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
    `).all()).results||[];return await as(r,"products:popular",o,600),e.json({success:!0,data:o,cached:!1})}catch(s){return console.error("Popular products error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/search/suggestions",async e=>{const{DB:t}=e.env;try{const r=e.req.query("q")||"";if(!r.trim()||r.length<2)return e.json({success:!0,data:{suggestions:[]}});const s=`%${r}%`,a=await t.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(s).all(),o=await t.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(s,s).all(),n=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(o.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:n}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/products/search",async e=>{const{DB:t}=e.env;try{const r=e.req.query("q")||"",s=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!r.trim())return e.json({success:!1,error:"Search query is required"},400);const o=`%${r}%`,n=await t.prepare(`
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
    `).bind(o,o,o,s,a).all(),i=await t.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
    `).bind(o,o,o).first();return e.json({success:!0,data:{products:n.results||[],total:(i==null?void 0:i.total)||0,query:r,limit:s,offset:a}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/products/:id",async e=>{const{DB:t}=e.env,r=e.req.param("id");try{const s=await t.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/cart",he,async e=>{const{DB:t}=e.env,r=e.get("userId");try{const s=await t.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:`장바구니 조회 실패: ${s.message}`},500)}});p.get("/api/cart/:userId",he,async e=>{const{DB:t}=e.env,r=e.get("userId"),s=e.req.param("userId");try{let a=await t.prepare("SELECT id FROM users WHERE id = ?").bind(r).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const o=a.id;if(s!==String(o))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const n=await t.prepare(`
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
    `).bind(o).all();return e.json({success:!0,data:n.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/users",async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),{kakaoId:s,name:a,email:o,phone:n}=r;if(!s||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(s).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await t.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(s,a,o||null,n||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(r){return console.error("Error creating user:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/cart",async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),{userId:s,kakaoId:a,productId:o,optionId:n,quantity:i,priceSnapshot:c,liveStreamId:u}=r,l=a||s;if(!l)return e.json({success:!1,error:"userId or kakaoId is required"},400);let d=await t.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();if(d||(d=await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()),!d)return e.json({success:!1,error:"User not found"},404);const _=d.id,f=await t.prepare("SELECT stock FROM products WHERE id = ?").bind(o).first();if(!f||f.stock<i)return e.json({success:!1,error:"Insufficient stock"},400);const E=await t.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(_,o,n||null,n||null).first();let y;if(E){const h=E.quantity+i;await t.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(h,c,E.id).run(),y=E.id}else y=(await t.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(_,o,n||null,i,c,u||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:y,isUpdate:!!E}})}catch(r){return console.error("[API /api/cart POST] Error:",r),console.error("[API /api/cart POST] Error message:",r.message),console.error("[API /api/cart POST] Error stack:",r.stack),e.json({success:!1,error:"Failed to add to cart: "+(r.message||"Unknown error")},500)}});p.delete("/api/cart/:cartItemId",async e=>{const{DB:t}=e.env,r=e.req.param("cartItemId");try{return await t.prepare("DELETE FROM cart_items WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/cart/clear/:userId",async e=>{const{DB:t}=e.env,r=e.req.param("userId");try{return await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(r).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/cart/:cartItemId",async e=>{const{DB:t}=e.env,r=e.req.param("cartItemId");try{const s=await e.req.json(),{quantity:a}=s;if(!a||a<1)return e.json({success:!1,error:"Invalid quantity"},400);const o=await t.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(r).first();return o?o.stock<a?e.json({success:!1,error:"Insufficient stock"},400):(await t.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,r).run(),e.json({success:!0})):e.json({success:!1,error:"Cart item not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders",async e=>{const{DB:t}=e.env;try{const r=await e.req.json(),{userId:s,cartItemIds:a,shippingInfo:o,items:n,shippingAddress:i,shippingAddressDetail:c,recipientName:u,recipientPhone:l,deliveryMemo:d,totalAmount:_,shippingFee:f,orderNumber:E,paymentKey:y,paymentMethod:h}=r;if(n&&n.length>0){const S=[];for(const F of n){const ce=await t.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind(F.productId).first();if(!ce)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${F.productId})`},400);if(ce.stock<F.quantity)return e.json({success:!1,error:`재고 부족: ${ce.name} (남은 재고: ${ce.stock}개)`},400);S.push({product_id:F.productId,option_id:F.optionId||null,quantity:F.quantity,price:F.price,product_name:ce.name,product_stock:ce.stock})}const A=Date.now(),U=Math.random().toString(36).substring(2,8).toUpperCase(),H=E||`ORDER_${A}_${U}`,z=c?`${i} ${c}`:i,ze=(await t.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(H,s||null,_||0,"pending","pending",z||null,u||null,l||null,d||null,y||null).run()).meta.last_row_id;for(const F of S)await t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(ze,F.product_id,F.option_id,F.quantity,F.price,F.product_name).run();return e.json({success:!0,data:{orderId:ze,orderNumber:H,totalAmount:_}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const g=a.map(()=>"?").join(","),b=await t.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${g})
    `).bind(...a).all();if(b.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const S of b.results)if(S.product_stock<S.quantity)return e.json({success:!1,error:`Insufficient stock for ${S.product_name}`},400);const j=b.results.reduce((S,A)=>S+A.price_snapshot*A.quantity,0),D=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,N=(await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(D,s,j,o.address,o.name,o.phone).run()).meta.last_row_id,L=[];for(const S of b.results){if((await t.prepare(`
        UPDATE products 
        SET stock = stock - ?, 
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ? 
          AND stock >= ?
          AND is_active = 1
      `).bind(S.quantity,S.product_id,S.quantity).run()).meta.changes===0){const U=await t.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(S.product_id).first();if(!U||U.stock<S.quantity)return e.json({success:!1,error:`재고 부족: ${S.product_name} (남은 재고: ${(U==null?void 0:U.stock)||0}개)`},400);if((await t.prepare(`
            UPDATE products 
            SET stock = stock - ?, 
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ? 
              AND stock >= ?
          `).bind(S.quantity,S.product_id,S.quantity).run()).meta.changes===0)return e.json({success:!1,error:"주문 처리 중 오류 발생. 다시 시도해주세요."},409)}L.push(t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(N,S.product_id,S.option_id,S.quantity,S.price_snapshot,S.product_name))}L.push(t.prepare(`DELETE FROM cart_items WHERE id IN (${g})`).bind(...a)),await t.batch(L);try{const S=new Set;for(const A of b.results){const U=await t.prepare("SELECT seller_id FROM products WHERE id = ?").bind(A.product_id).first();U&&U.seller_id&&S.add(U.seller_id)}for(const A of S)await Wr(t,A,D,buyerName||shippingName||"고객",j)}catch(S){console.error("[Order] Notification error:",S)}return e.json({success:!0,data:{orderId:N,orderNumber:D,totalAmount:j}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/current-product",async e=>{const{DB:t}=e.env,r=e.req.param("streamId");try{const s=await t.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();if(!s||!s.current_product_id)return e.json({success:!0,data:null});const a=await t.prepare("SELECT * FROM products WHERE id = ?").bind(s.current_product_id).first(),o=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s.current_product_id).all();return e.json({success:!0,data:{product:a,options:o.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/streams",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=r.sellerId,a=await t.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(s).all();return e.json({success:!0,data:a.results||[]})}catch(s){return console.error("Error loading seller streams:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/streams",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:s,description:a,youtube_video_id:o,youtube_url:n,thumbnail_url:i,scheduled_at:c,status:u,seller_instagram:l,seller_youtube:d,seller_facebook:_}=await e.req.json();let f=o,E="youtube",y=null,h=null,g=i;if(n&&!f&&(f=Us(n),!f))if(f=xs(n),y=Fs(n),h=zr(n),f)E="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!g&&f&&E==="youtube"&&(g=`https://img.youtube.com/vi/${f}/maxresdefault.jpg`),!s||!f)return e.json({success:!1,error:"Title and live stream URL are required"},400);const b=await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s,a||null,f,u||"scheduled",c||null,r.sellerId,l||null,d||null,_||null,E,y,h,g||null).run(),j=await t.prepare("SELECT * FROM live_streams WHERE id = ?").bind(b.meta.last_row_id).first(),D=await t.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(r.sellerId).first();try{const{sendLiveStreamCreatedEmail:w}=await Promise.resolve().then(()=>et);w({streamId:b.meta.last_row_id,title:s,sellerName:(D==null?void 0:D.display_name)||(D==null?void 0:D.username)||"알 수 없음",platform:E,scheduledAt:c,status:u||"scheduled"}).then(N=>{N.success?console.log(`[Email] Live stream notification sent for stream #${N.meta.last_row_id}`):console.error("[Email] Failed to send notification:",N.error)}).catch(N=>{console.error("[Email] Exception while sending notification:",N)})}catch(w){console.error("[Email] Failed to send live stream notification:",w)}return e.json({success:!0,data:j})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/streams/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:o,description:n,youtube_video_id:i,youtube_url:c,scheduled_at:u,status:l,seller_instagram:d,seller_youtube:_,seller_facebook:f}=await e.req.json(),E=[],y=[];if(o!==void 0&&(E.push("title = ?"),y.push(o)),n!==void 0&&(E.push("description = ?"),y.push(n)),c!==void 0||i!==void 0){let h=i,g="youtube",b=null;if(c&&(h=Us(c),!h))if(h=xs(c),b=Fs(c),h)g="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);h!==void 0&&(E.push("youtube_video_id = ?"),y.push(h),E.push("platform = ?"),y.push(g),g==="tiktok"&&b&&(E.push("tiktok_username = ?"),y.push(b)))}return l!==void 0&&(E.push("status = ?"),y.push(l)),u!==void 0&&(E.push("scheduled_at = ?"),y.push(u)),d!==void 0&&(E.push("seller_instagram = ?"),y.push(d)),_!==void 0&&(E.push("seller_youtube = ?"),y.push(_)),f!==void 0&&(E.push("seller_facebook = ?"),y.push(f)),E.length===0?e.json({success:!1,error:"No fields to update"},400):(E.push("updated_at = datetime('now')"),await t.prepare(`
      UPDATE live_streams SET ${E.join(", ")} WHERE id = ?
    `).bind(...y,s).run(),e.json({success:!0}))}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/streams/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");return await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first()?(await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/youtube/create-live",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:s,description:a,scheduled_at:o}=await e.req.json();if(!s)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await Kr({accessToken:n},s,a||""),u=(await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s,a||null,i.broadcastId,o||null,r.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await Fe(t,r.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${s} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${u}`),e.json({success:!0,data:{streamId:u,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(s){return console.error("[YouTube Live] Create broadcast error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("streamId"),a=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const n=a.youtube_broadcast_id||a.youtube_video_id;return n?(await Yr({accessToken:o},n),await t.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(),await Fe(t,r.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(s){return console.error("[YouTube Live] End broadcast error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("streamId"),a=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=a.youtube_video_id;if(!o)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const n=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!n&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await Jr({apiKey:n,accessToken:i},o);return e.json({success:!0,data:{streamId:s,videoId:o,stats:c}})}catch(s){return console.error("[YouTube Live] Get stats error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("streamId"),a=e.req.query("pageToken"),o=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first();if(!o)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=o.youtube_live_chat_id;if(!n)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await Vr({accessToken:i},n,a);return e.json({success:!0,data:c})}catch(s){return console.error("[YouTube Live] Get chat messages error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/streams",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:s,description:a,youtube_video_id:o,platform:n,tiktok_username:i,status:c}=await e.req.json();if(!s)return e.json({success:!1,error:"제목은 필수입니다"},400);const u=n||"youtube";if(u==="youtube"&&!o)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(u==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const l=await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(s,a||null,o||null,u,i||null,c||"scheduled",r.sellerId||null).run();return e.json({success:!0,data:{id:l.meta.last_row_id,title:s,description:a,youtube_video_id:o,platform:u,tiktok_username:i,status:c||"scheduled"}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/streams/:id",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{title:a,description:o,youtube_video_id:n,platform:i,tiktok_username:c,status:u}=await e.req.json();return await t.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,o,n||null,i||"youtube",c||null,u,s).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const n=await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1").bind(a,r.sellerId).first();if(!n)return e.json({success:!1,error:"Product not found or not active"},404);const i=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();return await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,s).run(),e.json({success:!0,data:{product:n,options:i.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/admin/streams/:id",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");return await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(s).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:t}=e.env,r=e.req.param("streamId");try{const{productId:s}=await e.req.json(),a=await t.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(s).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const o=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s).all();return await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(s,r).run(),e.json({success:!0,data:{product:a,options:o.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/shipping-addresses/:id",he,async e=>{const{DB:t}=e.env,r=e.req.param("id");e.get("userId");try{return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r,userId).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products",async e=>{const{DB:t,CACHE_KV:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const a=`seller:${s.sellerId}:products`,o=await r.get(a,"json");if(o)return e.json({success:!0,data:o,cached:!0});const n=await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(s.sellerId).all();return await r.put(a,JSON.stringify(n.results),{expirationTtl:300}),e.json({success:!0,data:n.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/seller/products",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{name:s,description:a,price:o,original_price:n,discount_rate:i,image_url:c,stock:u,category:l,live_stream_id:d,is_active:_}=await e.req.json();if(!s||!o)return e.json({success:!1,error:"Name and price are required"},400);if(d&&!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d,r.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const f=await t.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(s,a||null,o,n||null,i||0,c||null,u||0,l||null,d||null,r.sellerId,_!==void 0?_:1).run(),E=await t.prepare("SELECT * FROM products WHERE id = ?").bind(f.meta.last_row_id).first();return await os(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0,data:E})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),a=await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(s,r.sellerId).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/products/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:o,description:n,price:i,original_price:c,image_url:u,stock:l,category:d,is_active:_}=await e.req.json(),f=[],E=[];if(o!==void 0&&(f.push("name = ?"),E.push(o)),n!==void 0&&(f.push("description = ?"),E.push(n)),i!==void 0&&(f.push("price = ?"),E.push(i)),c!==void 0&&(f.push("original_price = ?"),E.push(c),i!==void 0&&c)){const h=Math.round((c-i)/c*100);f.push("discount_rate = ?"),E.push(h)}if(u!==void 0&&(f.push("image_url = ?"),E.push(u)),l!==void 0&&(f.push("stock = ?"),E.push(l)),d!==void 0&&(f.push("category = ?"),E.push(d)),_!==void 0&&(f.push("is_active = ?"),E.push(_?1:0)),f.push("updated_at = CURRENT_TIMESTAMP"),E.push(s,r.sellerId),f.length===1)return e.json({success:!1,error:"No fields to update"},400);await t.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...E).run();const y=await t.prepare("SELECT * FROM products WHERE id = ?").bind(s).first();return await os(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0,data:y})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/products/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const o=await t.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(s).first();return o&&o.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(s).run(),await t.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(s).run(),await t.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(s).run(),await t.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).run(),await os(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0}))}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const o=await t.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(s).all();return e.json({success:!0,data:o.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:o,option_value:n,price_adjustment:i,stock:c}=await e.req.json();if(!o||!n)return e.json({success:!1,error:"Option type and value are required"},400);const u=await t.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(s,o,n,i||0,c||0).run();return e.json({success:!0,data:{id:u.meta.last_row_id,product_id:s,option_type:o,option_value:n,price_adjustment:i||0,stock:c||0}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("productId"),a=e.req.param("optionId");return await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(s,r.sellerId).first()?(await t.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,s).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/stats",async e=>{const{DB:t,CACHE_KV:r}=e.env,s=await v(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const a=`seller:${s.sellerId}:stats`,o=await r.get(a,"json");if(o)return e.json({success:!0,data:o,cached:!0});const n=await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(s.sellerId).first(),i=await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(s.sellerId).first(),c=await t.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(s.sellerId).first(),u=await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(s.sellerId).first(),l=await t.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(s.sellerId).first(),_={totalProducts:n.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:u.count||0,totalRevenue:u.total||0,activeStreams:l.count||0,totalViewers:0};return await r.put(a,JSON.stringify(_),{expirationTtl:60}),e.json({success:!0,data:_})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/stats/sales",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.query("period")||"daily";let a,o,n;switch(s){case"weekly":a="%Y-W%W",o="week",n=28;break;case"monthly":a="%Y-%m",o="month",n=180;break;default:a="%Y-%m-%d",o="day",n=30}const i=await t.prepare(`
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
    `).bind(r.sellerId).all();return e.json({success:!0,data:{period:s,sales:i.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/stats/products",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),o=await t.prepare(`
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
    `).bind(r.sellerId,s).all();return e.json({success:!0,data:{products:o.results,period_days:a}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/business-info",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{business_number:s,business_name:a,ceo_name:o,business_type:n,business_category:i,postal_code:c,address:u,phone:l,email:d}=await e.req.json();if(!s||!a||!o)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const _=await t.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();let f;return _?f=await t.prepare(`
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
      `).bind(s,a,o,n,i,c,u,l,d,r.sellerId).run():f=await t.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(r.sellerId,s,a,o,n,i,c,u,l,d).run(),e.json({success:!0,data:{id:_?_.id:f.meta.last_row_id,seller_id:r.sellerId,business_number:s,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(s){return console.error("사업자 정보 등록 오류:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/business-info",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();return s?e.json({success:!0,data:s}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);const s=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(s).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(s).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(o){return e.json({success:!1,error:o.message},500)}});p.get("/api/admin/seller-business",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:s.results||[]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/orders",he,async e=>{const{DB:t}=e.env,r=e.get("userId");try{const s=await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(r).all(),a=await Promise.all(s.results.map(async o=>{const n=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(o.id).all();return{...o,items:n.results}}));return e.json({success:!0,data:a})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/orders/user/:userId",he,async e=>{const{DB:t}=e.env,r=e.get("userId"),s=parseInt(e.req.param("userId"));try{if(s!==r)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(r).all(),o=await Promise.all(a.results.map(async n=>{const i=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(n.id).all();return{...n,items:i.results}}));return e.json({success:!0,data:o})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/orders/:orderNumber",async e=>{const{DB:t}=e.env,r=e.req.param("orderNumber");try{const s=await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(r).first();if(!s)return e.json({success:!1,error:"Order not found"},404);const a=await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(s.id).all();return e.json({success:!0,data:{...s,items:a.results}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders/:orderId/cancel",async e=>{const{DB:t}=e.env,r=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",o=await t.prepare("SELECT * FROM orders WHERE id = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(o.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const n=await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(r).all();for(const i of n.results)await t.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.quantity,i.product_id).run();return await t.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,r).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:r,reason:a,itemsRestored:n.results.length}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:t}=e.env;try{const r=e.req.param("streamId"),s=await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();return s?e.json({success:!0,data:{viewer_count:s.viewer_count||0}}):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/streams/:streamId/viewer-count",async e=>{const{DB:t}=e.env,r=await C(e),s=r.success?{success:!1}:await v(e);if(!r.success&&!s.success)return e.json({success:!1,error:"Unauthorized"},401);try{const a=e.req.param("streamId"),{viewer_count:o}=await e.req.json();return typeof o!="number"||o<0?e.json({success:!1,error:"Invalid viewer count"},400):s.success&&!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a,s.sellerId).first()?e.json({success:!1,error:"Stream not found or unauthorized"},404):(await t.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(o,a).run(),e.json({success:!0,data:{viewer_count:o}}))}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/streams/:streamId/view",async e=>{const{DB:t}=e.env;try{const r=e.req.param("streamId");await t.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(r).run();const s=await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();return e.json({success:!0,data:{viewer_count:(s==null?void 0:s.viewer_count)||0}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/payments/confirm",async e=>{var s;const{DB:t}=e.env;let r=null;try{r=await e.req.json();const{paymentKey:a,orderId:o,amount:n}=r;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",o),console.log("  - paymentKey:",a),console.log("  - amount:",n),console.log("  - timestamp:",new Date().toISOString()),!a||!o||!n)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!o),console.error("[Payment] amount:",!!n),e.json({success:!1,error:"필수 파라미터가 누락되었습니다."},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=e.env.TOSS_SECRET_KEY;if(!i)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",i.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const c="Basic "+btoa(i+":");console.log("[Payment] Authorization 헤더 생성 완료");const u={orderId:o,amount:Number(n),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(u,null,2)),console.log("[Payment] 📊 amount 타입:",typeof u.amount),console.log("[Payment] 📊 amount 값:",u.amount);const l=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:c,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(u)}),d=await l.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",l.status),console.log("  - 응답 OK?:",l.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(d).substring(0,300)),!l.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",l.status),console.error("[Payment] 에러 코드:",d.code),console.error("[Payment] 에러 메시지:",d.message),console.error("[Payment] 전체 응답:",JSON.stringify(d,null,2)),e.json({success:!1,error:d.message||"결제 승인에 실패했습니다.",code:d.code},l.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",o);try{await t.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,o).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const _=await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(o).all();for(const f of _.results)(await t.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(f.quantity,f.product_id,f.quantity).run()).meta.changes===0&&console.error(`[Payment] ⚠️ 재고 부족: product_id=${f.product_id}`);console.log("[Payment] ✅ 재고 차감 완료")}catch(_){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",_)}return e.json({success:!0,data:d})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:r==null?void 0:r.orderId,error:a.message,stack:(s=a.stack)==null?void 0:s.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요."},500)}});p.post("/api/chat/:liveStreamId/messages",k(),async e=>{const{DB:t}=e.env,r=e.req.param("liveStreamId");try{const s=await e.req.json(),{userId:a,userName:o,userAvatar:n,message:i,isSeller:c,isAdmin:u}=s;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await t.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(r,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const l=["씨발","개새끼","병신","좆","시발"];let d=i;l.forEach(f=>{const E=new RegExp(f,"gi");d=d.replace(E,"*".repeat(f.length))});const _=await t.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,o,n||null,d,c?1:0,u?1:0).run();return e.json({success:!0,data:{id:_.meta.last_row_id,message:d}})}catch(s){return console.error("Error sending chat message:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/chat/:liveStreamId/messages",k(),async e=>{const{DB:t}=e.env,r=e.req.param("liveStreamId"),s=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let o=`
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
    `;const n=[r];s&&(o+=" AND id > ?",n.push(Number(s))),o+=" ORDER BY created_at DESC LIMIT ?",n.push(a);const c=(await t.prepare(o).bind(...n).all()).results.reverse();return e.json({success:!0,data:c})}catch(o){return console.error("Error fetching chat messages:",o),e.json({success:!1,error:o.message},500)}});p.delete("/api/chat/:liveStreamId/messages/:messageId",k(),async e=>{const{DB:t}=e.env,r=e.req.param("messageId");try{return await t.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(s){return console.error("Error deleting chat message:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/chat/:liveStreamId/ban",k(),async e=>{const{DB:t}=e.env,r=e.req.param("liveStreamId");try{const s=await e.req.json(),{userId:a,bannedBy:o,reason:n,duration:i}=s;if(!a||!o)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const u=new Date;u.setMinutes(u.getMinutes()+i),c=u.toISOString()}return await t.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(r,a,o,n||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(s){return console.error("Error banning user:",s),e.json({success:!1,error:s.message},500)}});p.delete("/api/chat/:liveStreamId/ban/:userId",k(),async e=>{const{DB:t}=e.env,r=e.req.param("liveStreamId"),s=e.req.param("userId");try{return await t.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(r,s).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});p.post("/api/payments/webhook",async e=>{const{DB:t}=e.env;try{const r=await e.req.json();switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:r.eventType,orderId:r.orderId,status:r.status,timestamp:new Date().toISOString()}),r.eventType){case"PAYMENT_STATUS_CHANGED":await Gr(t,r);break;case"VIRTUAL_ACCOUNT_ISSUED":await Xr(t,r);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",r.eventType)}return e.json({success:!0})}catch(r){return console.error("[Webhook] ❌ 웹훅 처리 실패:",r.message),e.json({success:!1,error:r.message},500)}});async function Gr(e,t){const{orderId:r,status:s,paymentKey:a}=t;console.log("[Webhook] 결제 상태 변경:",{orderId:r,status:s}),await e.prepare(`
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
    `).bind(r).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",r))}async function Xr(e,t){const{orderId:r,virtualAccount:s}=t;console.log("[Webhook] 가상계좌 발급:",{orderId:r,bank:s==null?void 0:s.bank,accountNumber:s==null?void 0:s.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(s==null?void 0:s.bank,s==null?void 0:s.accountNumber,s==null?void 0:s.customerName,s==null?void 0:s.dueDate,JSON.stringify(t),r).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",r)}p.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:t}=e.env;try{const r=e.req.param("paymentKey"),s=await e.req.json(),{cancelReason:a,cancelAmount:o}=s;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:r,cancelReason:a,cancelAmount:o}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const n=await t.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(r).first();if(!n)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(n.status==="CANCELED"||n.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=n.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const u=Fr(i,c),l=o&&o<n.amount,d=o||n.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:r,cancelAmount:d,isPartial:l});const _=await u.cancelPayment({paymentKey:r,cancelReason:a,cancelAmount:d});return _.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:r,cancelAmount:d,canceledAt:_.canceledAt}),await t.prepare(`
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
    `).bind(n.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${r}`),e.json({success:!0,data:{paymentKey:r,orderId:n.order_id,cancelAmount:d,canceledAt:_.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,_.error),e.json({success:!1,error:_.error||"결제 취소에 실패했습니다."},400))}catch(r){return console.error("[Payment] ❌ 결제 취소 처리 실패:",r.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});p.get("/api/payments/:paymentKey",async e=>{const{DB:t}=e.env;try{const r=e.req.param("paymentKey"),s=await t.prepare(`
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
    `).bind(r.sellerId).all(),a=await Promise.all(s.results.map(async o=>{const n=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ? AND oi.seller_id = ?
        `).bind(o.id,r.sellerId).all();return{...o,items:n.results}}));return e.json({success:!0,data:a})}catch(s){return e.json({success:!1,error:s.message},500)}});p.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const n=await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(s).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(n.id,r.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,s).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${s}, 자동 발행 시작...`);const c=await t.prepare(`
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
            `).bind(c.id).all(),d=Number(c.total_amount),_=Math.floor(d/1.1),f=d-_,E=new Date().toISOString().split("T")[0].replace(/-/g,""),y=Math.random().toString(36).substring(2,8).toUpperCase(),h=`${E}-${y}`,b=(await t.prepare(`
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
            `).bind(r.sellerId,s,h,u.business_number,u.business_name,u.ceo_name,u.address||"",u.business_type||"",u.business_category||"",u.email||"",u.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",_,f,d,`AUTO-${Date.now()}-${y}`).run()).meta.last_row_id;for(const j of l.results){const D=Math.floor(Number(j.price)*Number(j.quantity)/1.1),w=Number(j.price)*Number(j.quantity)-D;await t.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(b,j.product_name||"상품명 없음",j.quantity,j.price,D,w,j.option_name||"").run()}await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(s,r.sellerId,b).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${b}, invoice_number=${h}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${s}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await t.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(s,r.sellerId,c.message).run()}catch(u){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",u)}}try{const c=await t.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(s).first();if(c&&c.user_id){const l={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];l&&await Hs(t,c.user_id,s,l)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("orderNumber"),{courier:a,tracking_number:o}=await e.req.json();if(!a||!o)return e.json({success:!1,error:"Courier and tracking number are required"},400);const n=await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(s).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(n.id,r.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await t.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,o,s).run();try{const c=await t.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(s).first();c&&c.user_id&&await Hs(t,c.user_id,s,"shipping",a,o)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/orders/:orderNumber/refund",async e=>{const{DB:t}=e.env,r=e.req.param("orderNumber"),{reason:s}=await e.req.json();try{const a=await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(r).first();return a?["paid","preparing","shipped","delivered"].includes(a.status)?a.status==="refunded"||a.status==="cancelled"?e.json({success:!1,error:"이미 환불 또는 취소된 주문입니다."},400):(await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded",r).run(),e.json({success:!0,message:"환불 요청이 접수되었습니다. 고객센터(0507-0177-0432)에서 처리 예정입니다.",requiresManualProcessing:!0})):e.json({success:!1,error:"환불이 불가능한 주문 상태입니다."},400):e.json({success:!1,error:"Order not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/admin/orders",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
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
    `,{results:o}=await t.prepare(a).bind(parseInt(r),parseInt(s)).all();return e.json({success:!0,data:o})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});p.get("/api/admin/sellers",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:s.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/sellers",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{username:s,password:a,name:o,email:n,phone:i,business_name:c,business_number:u}=await e.req.json();if(!s||!a||!o||!n||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await t.prepare("SELECT id FROM sellers WHERE username = ?").bind(s).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await t.prepare("SELECT id FROM sellers WHERE email = ?").bind(n).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const _=`$2a$10$placeholder_hash_for_${a}`,f=await t.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(s,_,o,n,i||null,c,u||null,r.adminId).run();return e.json({success:!0,data:{id:f.meta.last_row_id,username:s,name:o,email:n,business_name:c}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.put("/api/admin/sellers/:id",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{name:a,email:o,phone:n,business_name:i,business_number:c,is_active:u,status:l}=await e.req.json();return await t.prepare("SELECT id FROM sellers WHERE id = ?").bind(s).first()?(await t.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,o,n||null,i,c||null,u,l,s).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.delete("/api/admin/sellers/:id",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),a=await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(s).first();return a?(await t.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(),await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(s).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const o=await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(s).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const n=`$2a$10$placeholder_hash_for_${a}`;return await t.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,s).run(),await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(s).run(),e.json({success:!0,message:`판매자 '${o.username}'의 비밀번호가 재설정되었습니다`})}catch(s){return e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const o=parseFloat(a);if(isNaN(o)||o<0||o>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const n=await t.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(s).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=n.commission_rate||10;return await t.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,s).run(),console.log(`수수료율 변경: 판매자 ${n.username} (ID: ${s}), ${i}% → ${o}%`),e.json({success:!0,message:`판매자 '${n.username}'의 수수료율이 ${i}%에서 ${o}%로 변경되었습니다`,data:{seller_id:s,seller_username:n.username,old_commission_rate:i,new_commission_rate:o}})}catch(s){return console.error("수수료율 변경 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),a=await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(s).first();return a?a.status==="approved"?e.json({success:!1,error:"이미 승인된 판매자입니다"},400):(await t.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(r.adminId,s).run(),console.log(`셀러 승인: ${a.username} (ID: ${s}) by Admin ID: ${r.adminId}`),e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:s,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 승인 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const o=await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(s).first();return o?o.status==="rejected"?e.json({success:!1,error:"이미 거부된 판매자입니다"},400):(await t.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,r.adminId,s).run(),console.log(`셀러 거부: ${o.username} (ID: ${s}), 사유: ${a}`),e.json({success:!0,message:`판매자 '${o.name}'님의 승인이 거부되었습니다`,data:{seller_id:s,seller_username:o.username,seller_name:o.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 거부 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/sellers/pending",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:s.results,count:s.results.length})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/public/seller/:sellerId",async e=>{const{DB:t,CACHE_KV:r}=e.env;try{const s=e.req.param("sellerId"),a=`public:seller:${s}`,o=await ts(r,a);if(o)return e.json({success:!0,data:o,cached:!0});const n=await t.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(s).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=await t.prepare(`
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
    `).bind(s).first(),d={profile:n,live_streams:i.results,scheduled_streams:c.results,products:u.results,stats:l};return await as(r,a,d,60),e.json({success:!0,data:d})}catch(s){return console.error("셀러 프로필 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/public/seller/username/:username",async e=>{const{DB:t}=e.env;try{const r=e.req.param("username"),s=await t.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();return s?e.json({success:!0,data:{seller_id:s.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/stats",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{period:s}=e.req.query();let a="";const o=new Date;switch(s){case"today":a=`AND DATE(o.created_at) = '${o.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(o.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(o.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const n=await t.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:n,sellers:i.results,period:s||"all"}})}catch(s){return console.error("정산 통계 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlement/records",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{seller_id:s,period:a,status:o}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const i=[];s&&(n.push("o.seller_id = ?"),i.push(s)),o&&(n.push("o.settlement_status = ?"),i.push(o));const c=new Date;switch(a){case"today":const d=c.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${d}'`);break;case"week":const _=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${_}'`);break;case"month":const f=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${f}'`);break}const u=n.length>0?`WHERE ${n.join(" AND ")}`:"",l=await t.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:l.results})}catch(s){return console.error("정산 내역 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const o=await t.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(s).first();return o?(await t.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,s).run(),console.log(`정산 상태 변경: 주문 ${o.order_number}, ${o.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:s,order_number:o.order_number,old_status:o.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(s){return console.error("정산 상태 변경 실패:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/settlement/batch-complete",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{order_ids:s}=await e.req.json();if(!Array.isArray(s)||s.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,o=0;for(const n of s)try{await t.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(n).run(),a++}catch(i){o++,console.error(`주문 ${n} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${o}건 실패`,data:{total:s.length,success:a,failed:o}})}catch(s){return console.error("일괄 정산 처리 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlement/export-csv",async e=>{const{DB:t}=e.env,r=await C(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{seller_id:s,period:a}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const n=[];s&&(o.push("o.seller_id = ?"),n.push(s));const i=new Date;switch(a){case"today":const E=i.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${E}'`);break;case"week":const y=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${y}'`);break;case"month":const h=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${h}'`);break}const c=o.length>0?`WHERE ${o.join(" AND ")}`:"",l=(await t.prepare(`
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
    `).bind(...n).all()).results;if(l.length===0)return e.json({success:!1,error:"데이터가 없습니다"},404);const d=Object.keys(l[0]);let _=d.join(",")+`
`;l.forEach(E=>{const y=d.map(h=>{const g=E[h];if(g==null)return"";const b=String(g);return b.includes(",")||b.includes('"')||b.includes(`
`)?`"${b.replace(/"/g,'""')}"`:b});_+=y.join(",")+`
`});const f="\uFEFF";return new Response(f+_,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(s){return console.error("CSV 내보내기 실패:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/orders/create",async e=>{const{DB:t}=e.env;try{const{userId:r,cartItems:s,totalAmount:a,shippingAddressId:o,sellerId:n,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:u,buyerCeoName:l}=await e.req.json();console.log("주문 생성 요청:",{userId:r,cartItems:s==null?void 0:s.length,totalAmount:a,shippingAddressId:o,sellerId:n,issueTaxInvoice:i});let d=10;if(n){const w=await t.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(n).first();w&&w.commission_rate!==null&&(d=w.commission_rate)}console.log("수수료율:",{sellerId:n,commissionRate:d});const _=Math.floor(a*(d/100)),f=a-_;let E=null;if(o){const w=await t.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(o,r).first();if(!w)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);E=w}if(!r)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const y=r,h=Date.now(),g=Math.random().toString(36).substring(2,8).toUpperCase(),b=`ORDER_${h}_${g}`;for(const w of s){const N=await t.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(w.product_id).first();if(!N)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${w.product_id})`},400);if(N.stock<w.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${w.product_id})`},400)}const D=(await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(b,y,a,"pending",n||null,d,_,f,o||null,(E==null?void 0:E.recipient_name)||null,(E==null?void 0:E.phone)||null,E!=null&&E.address?`${E.address} ${E.address_detail}`:null,(E==null?void 0:E.postal_code)||null,i?1:0,c||null,u||null,l||null).run()).meta.last_row_id;for(const w of s){await t.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(D,w.product_id,w.option_id||null,w.quantity,w.price_snapshot||w.price).run(),await t.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(w.quantity,w.product_id).run();try{const N=await t.prepare(`
          SELECT id, name, stock, stock_alert_threshold, seller_id 
          FROM products 
          WHERE id = ?
        `).bind(w.product_id).first();if(N){const L=N.stock_alert_threshold||5,S=N.stock;S<=L&&N.seller_id&&(await qr(t,N.seller_id,N.name,S,L),console.log(`[Low Stock Alert] ${N.name}: ${S} <= ${L}`))}}catch(N){console.error("[Low Stock Alert] Error:",N)}}return console.log("주문 생성 완료:",{orderId:D,orderNumber:b}),e.json({success:!0,orderId:D,orderNumber:b,totalAmount:a})}catch(r){return console.error("주문 생성 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/orders/:orderNumber/refund",k(),async e=>{const{DB:t}=e.env;try{const r=e.req.param("orderNumber"),{reason:s}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:r,reason:s});const a=await t.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(r).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다"},404);if(a.payment_status==="cancelled")return e.json({success:!1,error:"이미 취소된 주문입니다"},400);await t.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(s||"구매자 요청",r).run(),console.log("[Order Refund] 주문 상태 업데이트 완료:",r);const o=await t.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(a.id).all();for(const n of o.results)await t.prepare(`
        UPDATE products 
        SET stock = stock + ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(n.quantity,n.product_id).run(),console.log("[Order Refund] 재고 복구:",{productId:n.product_id,quantity:n.quantity});return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:r,reason:s}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:r,cancelDate:new Date().toISOString()}})}catch(r){return console.error("[Order Refund] Error:",r),e.json({success:!1,error:r.message||"주문 취소 중 오류가 발생했습니다"},500)}});p.get("/api/seller/sales",k(),async e=>{try{const{DB:t}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const s=await De(e.env.SESSION_KV,r);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(s.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=s.seller_id||s.user_id,{startDate:o,endDate:n}=e.req.query(),i=o||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=n||new Date().toISOString().split("T")[0],u=await t.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:u,stats:l,orders:(d==null?void 0:d.results)||[]}})}catch(t){return console.error("Seller sales query error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/settlement-csv",k(),async e=>{try{const{DB:t}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const s=await De(e.env.SESSION_KV,r);if(!s)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(s.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=s.seller_id||s.user_id,{startDate:o,endDate:n}=e.req.query(),i=o||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=n||new Date().toISOString().split("T")[0],u=await t.prepare(`
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
`;for(const d of(u==null?void 0:u.results)||[]){const _=d.status==="delivered"?"배송완료":d.status==="shipped"?"배송중":d.status==="preparing"?"상품준비중":d.status==="paid"?"결제완료":"대기중",f=d.buyer_business_name||"-",E=d.buyer_business_number||"-",y=d.invoice_number||"-",h=d.issue_date||"-",g=d.tax_invoice_status==="issued"?"발행완료":d.tax_invoice_status==="cancelled"?"취소":"-",b=d.nts_confirm_number||"-";l+=`${d.order_number},${d.created_at},${d.user_name||"익명"},${d.total_amount},${d.commission_amount},${d.seller_amount},${_},${f},${E},${y},${h},${g},${b}
`}return new Response(l,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(t){return console.error("CSV download error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/tax-invoices/issue",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{order_number:s}=await e.req.json();if(!s)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(s).first();if(!a)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!a.issue_tax_invoice)return e.json({success:!1,error:"세금계산서 발행이 요청되지 않은 주문입니다."},400);const o=await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(r.sellerId).first();if(!o)return e.json({success:!1,error:"승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요."},400);const n=await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),u=i-c,l=new Date().toISOString().split("T")[0],d=`${l}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,_=kr(o,a,n.results);let f,E,y;try{f=await Ar(_),E=f.ntsConfirmNumber,y=f.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:E,invoiceKey:y,mockMode:Ae()})}catch(b){console.error("바로빌 API 호출 실패:",b),E="FAILED",y=null}const g=(await t.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r.sellerId,s,"tax",d,l,o.business_number,o.business_name,o.ceo_name,o.address,o.business_type,o.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,u,i,E==="FAILED"?"failed":"issued",Ae()?"mock":"barobill",y,E).run()).meta.last_row_id;for(const b of n.results){const j=Math.floor(Number(b.price)*Number(b.quantity)/1.1),D=Number(b.price)*Number(b.quantity)-j;await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(g,b.id,b.product_name,b.quantity,b.price,j,D).run()}return e.json({success:!0,data:{invoice_id:g,invoice_number:d,issue_date:l,total_amount:i,supply_price:c,tax_amount:u,status:E==="FAILED"?"failed":"issued",nts_confirm_number:E,api_invoice_key:y,mock_mode:Ae(),message:E==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":Ae()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(s){return console.error("세금계산서 발행 오류:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/tax-invoices",async e=>{var s;const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{start_date:a,end_date:o,status:n}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[r.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),o&&(i+=" AND issue_date <= ?",c.push(o)),n&&(i+=" AND status = ?",c.push(n)),i+=" ORDER BY created_at DESC";const u=await t.prepare(i).bind(...c).all();return e.json({success:!0,data:u.results||[],total:((s=u.results)==null?void 0:s.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/tax-invoices/:id",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),a=await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(s,r.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=await t.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(s).all();return e.json({success:!0,data:{...a,items:o.results||[]}})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("id"),{reason:a}=await e.req.json(),o=await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(s,r.sellerId).first();if(!o)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=new Date(o.issue_date),i=new Date(n);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(o.api_invoice_key&&!Ae()){const u=await t.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(r.sellerId).first();u&&u.business_number&&await Nr(u.business_number,o.api_invoice_key,a||"판매자 요청")}}catch(u){console.error("바로빌 취소 API 호출 실패:",u)}return await t.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(s).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{status:s,limit:a=50}=e.req.query();let o=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const n=[r.sellerId];s&&(o+=" AND log.status = ?",n.push(s)),o+=" ORDER BY log.created_at DESC LIMIT ?",n.push(Number(a));const i=await t.prepare(o).bind(...n).all();return e.json({success:!0,data:i.results})}catch(s){return e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:t}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const s=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${s}`);const a=await t.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(s,r.sellerId).first();if(!a)return e.json({success:!1,error:"재시도할 실패 로그를 찾을 수 없습니다."},404);const o=Number(a.retry_count||0);if(o>=3)return e.json({success:!1,error:"최대 재시도 횟수(3회)를 초과했습니다."},400);const n=await t.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(s).first();if(!n)return e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(!n.buyer_business_number||!n.buyer_business_name)return e.json({success:!1,error:"주문에 사업자 정보가 없습니다."},400);const i=await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();if(!i)return e.json({success:!1,error:"판매자 사업자 정보가 승인되지 않았습니다."},400);const c=await t.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(n.id).all(),u=Number(n.total_amount),l=Math.floor(u/1.1),d=u-l,_=new Date().toISOString().split("T")[0].replace(/-/g,""),f=Math.random().toString(36).substring(2,8).toUpperCase(),E=`${_}-${f}`,h=(await t.prepare(`
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
    `).bind(r.sellerId,s,E,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",n.buyer_business_number,n.buyer_business_name,n.buyer_ceo_name||"",n.buyer_business_address||"",n.buyer_business_type||"",n.buyer_business_category||"",n.buyer_email||"",n.buyer_phone||"",l,d,u,`RETRY-${Date.now()}-${f}`).run()).meta.last_row_id;for(const g of c.results){const b=Math.floor(Number(g.price)*Number(g.quantity)/1.1),j=Number(g.price)*Number(g.quantity)-b;await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(h,g.product_name||"상품명 없음",g.quantity,g.price,b,j,g.option_name||"").run()}return await t.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(s,r.sellerId,h,o+1).run(),await t.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(o+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${h}, retry_count=${o+1}`),e.json({success:!0,data:{invoice_id:h,invoice_number:E,retry_count:o+1}})}catch(s){console.error("[TAX INVOICE RETRY] 재시도 실패:",s);try{const a=e.req.param("orderNumber"),o=await t.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,r.sellerId).first(),n=Number((o==null?void 0:o.retry_count)||0);await t.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,r.sellerId,s.message,n+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:s.message},500)}});p.get("/live/:id",async e=>{try{const t=new URL("/static/live.html",e.req.url);let s=await(await fetch(t.toString())).text();const o=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return s=s.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${o}`),console.log("[Live Page] Environment variables injected"),new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving live page:",t),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/cart",async e=>{try{const t=new URL("/static/cart.html",e.req.url);let s=await(await fetch(t.toString())).text();return s=s.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),s=s.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving cart page:",t),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/my-orders",async e=>{try{const t=new URL("/static/my-orders.html",e.req.url),s=await(await fetch(t.toString())).text();return new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving my orders page:",t),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/payment-result",async e=>{try{const t=new URL("/payment-result.html",e.req.url),s=await(await fetch(t.toString())).text();return new Response(s,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving payment result page:",t),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});p.get("/api/seller/profile",async e=>{const{DB:t}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const s=await t.prepare(`
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
    `).bind(r).first();if(!s||!s.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:o,sns_instagram:n,sns_youtube:i,sns_facebook:c,sns_twitter:u,website_url:l,kakao_chat_link:d}=await e.req.json(),_=[],f=[];if(a!==void 0&&(_.push("profile_image = ?"),f.push(a)),o!==void 0&&(_.push("bio = ?"),f.push(o)),n!==void 0&&(_.push("sns_instagram = ?"),f.push(n)),i!==void 0&&(_.push("sns_youtube = ?"),f.push(i)),c!==void 0&&(_.push("sns_facebook = ?"),f.push(c)),u!==void 0&&(_.push("sns_twitter = ?"),f.push(u)),l!==void 0&&(_.push("website_url = ?"),f.push(l)),d!==void 0&&(_.push("kakao_chat_link = ?"),f.push(d)),_.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);_.push("updated_at = datetime('now')"),f.push(s.seller_id),await t.prepare(`
      UPDATE sellers 
      SET ${_.join(", ")}
      WHERE id = ?
    `).bind(...f).run();const E=await t.prepare(`
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
    `).bind(s.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:E})}catch(s){return console.error("프로필 업데이트 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/public/:sellerId",async e=>{const{DB:t}=e.env,r=e.req.param("sellerId");try{const s=await t.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("상품 목록 조회 실패:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/notifications",async e=>{const{DB:t}=e.env;try{const r=e.req.header("Authorization");if(!r)return e.json({success:!1,error:"No authorization header"},401);const s=r.replace("Bearer ","");let a=await v(e),o="seller",n=a.sellerId;if(a.success||(a=await verifyUserSession(e),a.success&&(o="user",n=a.userId)),a.success||(a=await C(e),a.success&&(o="admin",n=a.adminId)),!a.success||!n)return e.json({success:!1,error:"Unauthorized"},401);const i=parseInt(e.req.query("limit")||"50"),c=e.req.query("unread_only")==="true";let u=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;c&&(u+=" AND is_read = 0"),u+=" ORDER BY created_at DESC LIMIT ?";const l=await t.prepare(u).bind(n,o,i).all();return e.json({success:!0,data:l.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/notifications/unread-count",async e=>{const{DB:t}=e.env;try{if(!e.req.header("Authorization"))return e.json({success:!1,error:"No authorization header"},401);let s=await v(e),a="seller",o=s.sellerId;if(s.success||(s=await verifyUserSession(e),s.success&&(a="user",o=s.userId)),s.success||(s=await C(e),s.success&&(a="admin",o=s.adminId)),!s.success||!o)return e.json({success:!1,error:"Unauthorized"},401);const n=await t.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(o,a).first();return e.json({success:!0,count:(n==null?void 0:n.count)||0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/notifications/:id/read",async e=>{const{DB:t}=e.env;try{const r=e.req.param("id");return e.req.header("Authorization")?await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ?").bind(r).first()?(await t.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404):e.json({success:!1,error:"No authorization header"},401)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/notifications/read-all",async e=>{const{DB:t}=e.env;try{if(!e.req.header("Authorization"))return e.json({success:!1,error:"No authorization header"},401);let s=await v(e),a="seller",o=s.sellerId;return s.success||(s=await verifyUserSession(e),s.success&&(a="user",o=s.userId)),s.success||(s=await C(e),s.success&&(a="admin",o=s.adminId)),!s.success||!o?e.json({success:!1,error:"Unauthorized"},401):(await t.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(o,a).run(),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/notifications/:id",async e=>{const{DB:t}=e.env;try{const r=e.req.param("id");return e.req.header("Authorization")?await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ?").bind(r).first()?(await t.prepare("DELETE FROM notifications WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404):e.json({success:!1,error:"No authorization header"},401)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/order-complete",e=>e.redirect("/order-complete.html",302));p.notFound(e=>{const t=e.req.path;return t.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${t} was not found.`},404):new Response(null,{status:404})});p.onError((e,t)=>{const r=t.req.path;if(console.error("[Global Error Handler]",{path:r,method:t.req.method,error:e.message,stack:e.stack}),r.startsWith("/api/")){let s=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(s=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(s=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(s=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(s=400,a="잘못된 요청입니다."),t.json({success:!1,error:e.message||a},s)}return t.html(`
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
  `,500)});const ps=new Ls,Qr=Object.assign({"/src/index.tsx":p});let Ws=!1;for(const[,e]of Object.entries(Qr))e&&(ps.route("/",e),ps.notFound(e.notFoundHandler),Ws=!0);if(!Ws)throw new Error("Can't import modules from ['/src/index.tsx']");async function qs(e){try{const{to:t,subject:r,htmlContent:s,textContent:a}=e,o=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:t}]}],from:{email:"noreply@live.ur-team.com",name:"유어 라이브"},subject:r,content:[{type:"text/html",value:s},...a?[{type:"text/plain",value:a}]:[]]})});if(!o.ok){const n=await o.text();return console.error("[Email] Failed to send:",o.status,n),{success:!1,error:`Email send failed: ${o.status}`}}return console.log("[Email] Successfully sent to:",t),{success:!0}}catch(t){return console.error("[Email] Exception:",t),{success:!1,error:t.message}}}async function Zr(e){const{streamId:t,title:r,sellerName:s,platform:a,scheduledAt:o,status:n}=e,i=`https://live.ur-team.com/live/${t}`,c=n==="live"?"🔴 라이브 중":n==="scheduled"?"📅 예약됨":"⏸️ 대기 중",u=`
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
      
      ${o?`
      <div class="info-row">
        <span class="label">예약 시간</span>
        <span class="value">${new Date(o).toLocaleString("ko-KR")}</span>
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
${o?`예약 시간: ${new Date(o).toLocaleString("ko-KR")}`:""}
라이브 ID: #${t}

🔗 라이브 페이지: ${i}

---
리스터코퍼레이션
부산광역시 금정구 놀이마당로26 1402
대표전화: 0507-0177-0432 | 이메일: jiwon@ur-team.com
  `;return qs({to:"jiwon@ur-team.com",subject:`[유어 라이브] 🎉 새 라이브 스트림 생성: ${r}`,htmlContent:u,textContent:l})}const et=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:qs,sendLiveStreamCreatedEmail:Zr},Symbol.toStringTag,{value:"Module"}));export{ps as default};
