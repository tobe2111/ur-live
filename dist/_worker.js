var Er=Object.defineProperty;var vs=e=>{throw TypeError(e)};var hr=(e,s,r)=>s in e?Er(e,s,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[s]=r;var T=(e,s,r)=>hr(e,typeof s!="symbol"?s+"":s,r),cs=(e,s,r)=>s.has(e)||vs("Cannot "+r);var _=(e,s,r)=>(cs(e,s,"read from private field"),r?r.call(e):s.get(e)),I=(e,s,r)=>s.has(e)?vs("Cannot add the same private member more than once"):s instanceof WeakSet?s.add(e):s.set(e,r),b=(e,s,r,t)=>(cs(e,s,"write to private field"),t?t.call(e,r):s.set(e,r),r),A=(e,s,r)=>(cs(e,s,"access private method"),r);var Os=(e,s,r,t)=>({set _(a){b(e,s,a,r)},get _(){return _(e,s,t)}});var Ds=(e,s,r)=>(t,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,u=!1,l;if(e[i]?(l=e[i][0][0],t.req.routeIndex=i):l=i===e.length&&a||void 0,l)try{c=await l(t,()=>o(i+1))}catch(p){if(p instanceof Error&&s)t.error=p,c=await s(p,t),u=!0;else throw p}else t.finalized===!1&&r&&(c=await r(t));return c&&(t.finalized===!1||u)&&(t.res=c),t}},gr=Symbol(),yr=async(e,s=Object.create(null))=>{const{all:r=!1,dot:t=!1}=s,n=(e instanceof Ys?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?wr(e,{all:r,dot:t}):{}};async function wr(e,s){const r=await e.formData();return r?Sr(r,s):{}}function Sr(e,s){const r=Object.create(null);return e.forEach((t,a)=>{s.all||a.endsWith("[]")?br(r,a,t):r[a]=t}),s.dot&&Object.entries(r).forEach(([t,a])=>{t.includes(".")&&(Tr(r,t,a),delete r[t])}),r}var br=(e,s,r)=>{e[s]!==void 0?Array.isArray(e[s])?e[s].push(r):e[s]=[e[s],r]:s.endsWith("[]")?e[s]=[r]:e[s]=r},Tr=(e,s,r)=>{let t=e;const a=s.split(".");a.forEach((n,o)=>{o===a.length-1?t[n]=r:((!t[n]||typeof t[n]!="object"||Array.isArray(t[n])||t[n]instanceof File)&&(t[n]=Object.create(null)),t=t[n])})},xs=e=>{const s=e.split("/");return s[0]===""&&s.shift(),s},Rr=e=>{const{groups:s,path:r}=Ir(e),t=xs(r);return vr(t,s)},Ir=e=>{const s=[];return e=e.replace(/\{[^}]+\}/g,(r,t)=>{const a=`@${t}`;return s.push([a,r]),a}),{groups:s,path:e}},vr=(e,s)=>{for(let r=s.length-1;r>=0;r--){const[t]=s[r];for(let a=e.length-1;a>=0;a--)if(e[a].includes(t)){e[a]=e[a].replace(t,s[r][1]);break}}return e},Qe={},Or=(e,s)=>{if(e==="*")return"*";const r=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(r){const t=`${e}#${s}`;return Qe[t]||(r[2]?Qe[t]=s&&s[0]!==":"&&s[0]!=="*"?[t,r[1],new RegExp(`^${r[2]}(?=/${s})`)]:[e,r[1],new RegExp(`^${r[2]}$`)]:Qe[t]=[e,r[1],!0]),Qe[t]}return null},Es=(e,s)=>{try{return s(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,r=>{try{return s(r)}catch{return r}})}},Dr=e=>Es(e,decodeURI),Bs=e=>{const s=e.url,r=s.indexOf("/",s.indexOf(":")+4);let t=r;for(;t<s.length;t++){const a=s.charCodeAt(t);if(a===37){const n=s.indexOf("?",t),o=s.indexOf("#",t),i=n===-1?o===-1?void 0:o:o===-1?n:Math.min(n,o),c=s.slice(r,i);return Dr(c.includes("%25")?c.replace(/%25/g,"%2525"):c)}else if(a===63||a===35)break}return s.slice(r,t)},Nr=e=>{const s=Bs(e);return s.length>1&&s.at(-1)==="/"?s.slice(0,-1):s},De=(e,s,...r)=>(r.length&&(s=De(s,...r)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${s==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(s==null?void 0:s[0])==="/"?s.slice(1):s}`}`),Ws=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const s=e.split("/"),r=[];let t="";return s.forEach(a=>{if(a!==""&&!/\:/.test(a))t+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){r.length===0&&t===""?r.push("/"):r.push(t);const n=a.replace("?","");t+="/"+n,r.push(t)}else t+="/"+a}),r.filter((a,n,o)=>o.indexOf(a)===n)},us=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?Es(e,Vs):e):e,Ks=(e,s,r)=>{let t;if(!r&&s&&!/[%+]/.test(s)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(s,o+1)||(o=e.indexOf(`&${s}`,o+1));o!==-1;){const i=e.charCodeAt(o+s.length+1);if(i===61){const c=o+s.length+2,u=e.indexOf("&",c);return us(e.slice(c,u===-1?void 0:u))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${s}`,o+1)}if(t=/[%+]/.test(e),!t)return}const a={};t??(t=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(t&&(c=us(c)),n=o,c==="")continue;let u;i===-1?u="":(u=e.slice(i+1,o===-1?void 0:o),t&&(u=us(u))),r?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(u)):a[c]??(a[c]=u)}return s?a[s]:a},Ar=Ks,kr=(e,s)=>Ks(e,s,!0),Vs=decodeURIComponent,Ns=e=>Es(e,Vs),ke,G,de,Js,zs,_s,pe,Us,Ys=(Us=class{constructor(e,s="/",r=[[]]){I(this,de);T(this,"raw");I(this,ke);I(this,G);T(this,"routeIndex",0);T(this,"path");T(this,"bodyCache",{});I(this,pe,e=>{const{bodyCache:s,raw:r}=this,t=s[e];if(t)return t;const a=Object.keys(s)[0];return a?s[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):s[e]=r[e]()});this.raw=e,this.path=s,b(this,G,r),b(this,ke,{})}param(e){return e?A(this,de,Js).call(this,e):A(this,de,zs).call(this)}query(e){return Ar(this.url,e)}queries(e){return kr(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const s={};return this.raw.headers.forEach((r,t)=>{s[t]=r}),s}async parseBody(e){var s;return(s=this.bodyCache).parsedBody??(s.parsedBody=await yr(this,e))}json(){return _(this,pe).call(this,"text").then(e=>JSON.parse(e))}text(){return _(this,pe).call(this,"text")}arrayBuffer(){return _(this,pe).call(this,"arrayBuffer")}blob(){return _(this,pe).call(this,"blob")}formData(){return _(this,pe).call(this,"formData")}addValidatedData(e,s){_(this,ke)[e]=s}valid(e){return _(this,ke)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[gr](){return _(this,G)}get matchedRoutes(){return _(this,G)[0].map(([[,e]])=>e)}get routePath(){return _(this,G)[0].map(([[,e]])=>e)[this.routeIndex].path}},ke=new WeakMap,G=new WeakMap,de=new WeakSet,Js=function(e){const s=_(this,G)[0][this.routeIndex][1][e],r=A(this,de,_s).call(this,s);return r&&/\%/.test(r)?Ns(r):r},zs=function(){const e={},s=Object.keys(_(this,G)[0][this.routeIndex][1]);for(const r of s){const t=A(this,de,_s).call(this,_(this,G)[0][this.routeIndex][1][r]);t!==void 0&&(e[r]=/\%/.test(t)?Ns(t):t)}return e},_s=function(e){return _(this,G)[1]?_(this,G)[1][e]:e},pe=new WeakMap,Us),jr={Stringify:1},Gs=async(e,s,r,t,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:s,buffer:a,context:t}))).then(i=>Promise.all(i.filter(Boolean).map(c=>Gs(c,s,!1,t,a))).then(()=>a[0]))):Promise.resolve(e)},Cr="text/plain; charset=UTF-8",ls=(e,s)=>({"Content-Type":e,...s}),ve=(e,s)=>new Response(e,s),Be,We,oe,je,ie,Y,Ke,Ce,Le,we,Ve,Ye,te,Ne,fs,$s,Lr=($s=class{constructor(e,s){I(this,te);I(this,Be);I(this,We);T(this,"env",{});I(this,oe);T(this,"finalized",!1);T(this,"error");I(this,je);I(this,ie);I(this,Y);I(this,Ke);I(this,Ce);I(this,Le);I(this,we);I(this,Ve);I(this,Ye);T(this,"render",(...e)=>(_(this,Ce)??b(this,Ce,s=>this.html(s)),_(this,Ce).call(this,...e)));T(this,"setLayout",e=>b(this,Ke,e));T(this,"getLayout",()=>_(this,Ke));T(this,"setRenderer",e=>{b(this,Ce,e)});T(this,"header",(e,s,r)=>{this.finalized&&b(this,Y,ve(_(this,Y).body,_(this,Y)));const t=_(this,Y)?_(this,Y).headers:_(this,we)??b(this,we,new Headers);s===void 0?t.delete(e):r!=null&&r.append?t.append(e,s):t.set(e,s)});T(this,"status",e=>{b(this,je,e)});T(this,"set",(e,s)=>{_(this,oe)??b(this,oe,new Map),_(this,oe).set(e,s)});T(this,"get",e=>_(this,oe)?_(this,oe).get(e):void 0);T(this,"newResponse",(...e)=>A(this,te,Ne).call(this,...e));T(this,"body",(e,s,r)=>A(this,te,Ne).call(this,e,s,r));T(this,"text",(e,s,r)=>A(this,te,fs).call(this)&&!s&&!r?ve(e):A(this,te,Ne).call(this,e,s,ls(Cr,r)));T(this,"json",(e,s,r)=>A(this,te,fs).call(this)&&!s&&!r?Response.json(e):A(this,te,Ne).call(this,JSON.stringify(e),s,ls("application/json",r)));T(this,"html",(e,s,r)=>{const t=a=>A(this,te,Ne).call(this,a,s,ls("text/html; charset=UTF-8",r));return typeof e=="object"?Gs(e,jr.Stringify,!1,{}).then(t):t(e)});T(this,"redirect",(e,s)=>{const r=String(e);return this.header("Location",/[^\x00-\xFF]/.test(r)?encodeURI(r):r),this.newResponse(null,s??302)});T(this,"notFound",()=>(_(this,Le)??b(this,Le,()=>ve()),_(this,Le).call(this,this)));b(this,Be,e),s&&(b(this,ie,s.executionCtx),this.env=s.env,b(this,Le,s.notFoundHandler),b(this,Ye,s.path),b(this,Ve,s.matchResult))}get req(){return _(this,We)??b(this,We,new Ys(_(this,Be),_(this,Ye),_(this,Ve))),_(this,We)}get event(){if(_(this,ie)&&"respondWith"in _(this,ie))return _(this,ie);throw Error("This context has no FetchEvent")}get executionCtx(){if(_(this,ie))return _(this,ie);throw Error("This context has no ExecutionContext")}get res(){return _(this,Y)||b(this,Y,ve(null,{headers:_(this,we)??b(this,we,new Headers)}))}set res(e){if(_(this,Y)&&e){e=ve(e.body,e);for(const[s,r]of _(this,Y).headers.entries())if(s!=="content-type")if(s==="set-cookie"){const t=_(this,Y).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of t)e.headers.append("set-cookie",a)}else e.headers.set(s,r)}b(this,Y,e),this.finalized=!0}get var(){return _(this,oe)?Object.fromEntries(_(this,oe)):{}}},Be=new WeakMap,We=new WeakMap,oe=new WeakMap,je=new WeakMap,ie=new WeakMap,Y=new WeakMap,Ke=new WeakMap,Ce=new WeakMap,Le=new WeakMap,we=new WeakMap,Ve=new WeakMap,Ye=new WeakMap,te=new WeakSet,Ne=function(e,s,r){const t=_(this,Y)?new Headers(_(this,Y).headers):_(this,we)??new Headers;if(typeof s=="object"&&"headers"in s){const n=s.headers instanceof Headers?s.headers:new Headers(s.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?t.append(o,i):t.set(o,i)}if(r)for(const[n,o]of Object.entries(r))if(typeof o=="string")t.set(n,o);else{t.delete(n);for(const i of o)t.append(n,i)}const a=typeof s=="number"?s:(s==null?void 0:s.status)??_(this,je);return ve(e,{status:a,headers:t})},fs=function(){return!_(this,we)&&!_(this,je)&&!this.finalized},$s),$="ALL",Mr="all",Ur=["get","post","put","delete","options","patch"],Xs="Can not add a route since the matcher is already built.",Qs=class extends Error{},$r="__COMPOSED_HANDLER",Pr=e=>e.text("404 Not Found",404),As=(e,s)=>{if("getResponse"in e){const r=e.getResponse();return s.newResponse(r.body,r)}return console.error(e),s.text("Internal Server Error",500)},ee,P,Zs,se,ge,Ze,es,Me,qr=(Me=class{constructor(s={}){I(this,P);T(this,"get");T(this,"post");T(this,"put");T(this,"delete");T(this,"options");T(this,"patch");T(this,"all");T(this,"on");T(this,"use");T(this,"router");T(this,"getPath");T(this,"_basePath","/");I(this,ee,"/");T(this,"routes",[]);I(this,se,Pr);T(this,"errorHandler",As);T(this,"onError",s=>(this.errorHandler=s,this));T(this,"notFound",s=>(b(this,se,s),this));T(this,"fetch",(s,...r)=>A(this,P,es).call(this,s,r[1],r[0],s.method));T(this,"request",(s,r,t,a)=>s instanceof Request?this.fetch(r?new Request(s,r):s,t,a):(s=s.toString(),this.fetch(new Request(/^https?:\/\//.test(s)?s:`http://localhost${De("/",s)}`,r),t,a)));T(this,"fire",()=>{addEventListener("fetch",s=>{s.respondWith(A(this,P,es).call(this,s.request,s,void 0,s.request.method))})});[...Ur,Mr].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?b(this,ee,o):A(this,P,ge).call(this,n,_(this,ee),o),i.forEach(c=>{A(this,P,ge).call(this,n,_(this,ee),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){b(this,ee,c);for(const u of[n].flat())i.map(l=>{A(this,P,ge).call(this,u.toUpperCase(),_(this,ee),l)})}return this},this.use=(n,...o)=>(typeof n=="string"?b(this,ee,n):(b(this,ee,"*"),o.unshift(n)),o.forEach(i=>{A(this,P,ge).call(this,$,_(this,ee),i)}),this);const{strict:t,...a}=s;Object.assign(this,a),this.getPath=t??!0?s.getPath??Bs:Nr}route(s,r){const t=this.basePath(s);return r.routes.map(a=>{var o;let n;r.errorHandler===As?n=a.handler:(n=async(i,c)=>(await Ds([],r.errorHandler)(i,()=>a.handler(i,c))).res,n[$r]=a.handler),A(o=t,P,ge).call(o,a.method,a.path,n)}),this}basePath(s){const r=A(this,P,Zs).call(this);return r._basePath=De(this._basePath,s),r}mount(s,r,t){let a,n;t&&(typeof t=="function"?n=t:(n=t.optionHandler,t.replaceRequest===!1?a=c=>c:a=t.replaceRequest));const o=n?c=>{const u=n(c);return Array.isArray(u)?u:[u]}:c=>{let u;try{u=c.executionCtx}catch{}return[c.env,u]};a||(a=(()=>{const c=De(this._basePath,s),u=c==="/"?0:c.length;return l=>{const p=new URL(l.url);return p.pathname=p.pathname.slice(u)||"/",new Request(p,l)}})());const i=async(c,u)=>{const l=await r(a(c.req.raw),...o(c));if(l)return l;await u()};return A(this,P,ge).call(this,$,De(s,"*"),i),this}},ee=new WeakMap,P=new WeakSet,Zs=function(){const s=new Me({router:this.router,getPath:this.getPath});return s.errorHandler=this.errorHandler,b(s,se,_(this,se)),s.routes=this.routes,s},se=new WeakMap,ge=function(s,r,t){s=s.toUpperCase(),r=De(this._basePath,r);const a={basePath:this._basePath,path:r,method:s,handler:t};this.router.add(s,r,[t,a]),this.routes.push(a)},Ze=function(s,r){if(s instanceof Error)return this.errorHandler(s,r);throw s},es=function(s,r,t,a){if(a==="HEAD")return(async()=>new Response(null,await A(this,P,es).call(this,s,r,t,"GET")))();const n=this.getPath(s,{env:t}),o=this.router.match(a,n),i=new Lr(s,{path:n,matchResult:o,env:t,executionCtx:r,notFoundHandler:_(this,se)});if(o[0].length===1){let u;try{u=o[0][0][0][0](i,async()=>{i.res=await _(this,se).call(this,i)})}catch(l){return A(this,P,Ze).call(this,l,i)}return u instanceof Promise?u.then(l=>l||(i.finalized?i.res:_(this,se).call(this,i))).catch(l=>A(this,P,Ze).call(this,l,i)):u??_(this,se).call(this,i)}const c=Ds(o[0],this.errorHandler,_(this,se));return(async()=>{try{const u=await c(i);if(!u.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return u.res}catch(u){return A(this,P,Ze).call(this,u,i)}})()},Me),er=[];function Fr(e,s){const r=this.buildAllMatchers(),t=((a,n)=>{const o=r[a]||r[$],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],er];const u=c.indexOf("",1);return[o[1][u],c]});return this.match=t,t(e,s)}var rs="[^/]+",He=".*",xe="(?:|/.*)",Ae=Symbol(),Hr=new Set(".\\+*[^]$()");function xr(e,s){return e.length===1?s.length===1?e<s?-1:1:-1:s.length===1||e===He||e===xe?1:s===He||s===xe?-1:e===rs?1:s===rs?-1:e.length===s.length?e<s?-1:1:s.length-e.length}var Se,be,re,Ie,Br=(Ie=class{constructor(){I(this,Se);I(this,be);I(this,re,Object.create(null))}insert(s,r,t,a,n){if(s.length===0){if(_(this,Se)!==void 0)throw Ae;if(n)return;b(this,Se,r);return}const[o,...i]=s,c=o==="*"?i.length===0?["","",He]:["","",rs]:o==="/*"?["","",xe]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let u;if(c){const l=c[1];let p=c[2]||rs;if(l&&c[2]&&(p===".*"||(p=p.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(p))))throw Ae;if(u=_(this,re)[p],!u){if(Object.keys(_(this,re)).some(m=>m!==He&&m!==xe))throw Ae;if(n)return;u=_(this,re)[p]=new Ie,l!==""&&b(u,be,a.varIndex++)}!n&&l!==""&&t.push([l,_(u,be)])}else if(u=_(this,re)[o],!u){if(Object.keys(_(this,re)).some(l=>l.length>1&&l!==He&&l!==xe))throw Ae;if(n)return;u=_(this,re)[o]=new Ie}u.insert(i,r,t,a,n)}buildRegExpStr(){const r=Object.keys(_(this,re)).sort(xr).map(t=>{const a=_(this,re)[t];return(typeof _(a,be)=="number"?`(${t})@${_(a,be)}`:Hr.has(t)?`\\${t}`:t)+a.buildRegExpStr()});return typeof _(this,Se)=="number"&&r.unshift(`#${_(this,Se)}`),r.length===0?"":r.length===1?r[0]:"(?:"+r.join("|")+")"}},Se=new WeakMap,be=new WeakMap,re=new WeakMap,Ie),as,Je,Ps,Wr=(Ps=class{constructor(){I(this,as,{varIndex:0});I(this,Je,new Br)}insert(e,s,r){const t=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const u=`@\\${o}`;return a[o]=[u,c],o++,i=!0,u}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return _(this,Je).insert(n,s,t,_(this,as),r),t}buildRegExp(){let e=_(this,Je).buildRegExpStr();if(e==="")return[/^$/,[],[]];let s=0;const r=[],t=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(r[++s]=Number(n),"$()"):(o!==void 0&&(t[Number(o)]=++s),"")),[new RegExp(`^${e}`),r,t]}},as=new WeakMap,Je=new WeakMap,Ps),Kr=[/^$/,[],Object.create(null)],ss=Object.create(null);function sr(e){return ss[e]??(ss[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(s,r)=>r?`\\${r}`:"(?:|/.*)")}$`))}function Vr(){ss=Object.create(null)}function Yr(e){var u;const s=new Wr,r=[];if(e.length===0)return Kr;const t=e.map(l=>[!/\*|\/:/.test(l[0]),...l]).sort(([l,p],[m,E])=>l?1:m?-1:p.length-E.length),a=Object.create(null);for(let l=0,p=-1,m=t.length;l<m;l++){const[E,f,h]=t[l];E?a[f]=[h.map(([w])=>[w,Object.create(null)]),er]:p++;let y;try{y=s.insert(f,p,E)}catch(w){throw w===Ae?new Qs(f):w}E||(r[p]=h.map(([w,g])=>{const O=Object.create(null);for(g-=1;g>=0;g--){const[k,L]=y[g];O[k]=L}return[w,O]}))}const[n,o,i]=s.buildRegExp();for(let l=0,p=r.length;l<p;l++)for(let m=0,E=r[l].length;m<E;m++){const f=(u=r[l][m])==null?void 0:u[1];if(!f)continue;const h=Object.keys(f);for(let y=0,w=h.length;y<w;y++)f[h[y]]=i[f[h[y]]]}const c=[];for(const l in o)c[l]=r[o[l]];return[n,c,a]}function Oe(e,s){if(e){for(const r of Object.keys(e).sort((t,a)=>a.length-t.length))if(sr(r).test(s))return[...e[r]]}}var me,_e,ns,rr,qs,Jr=(qs=class{constructor(){I(this,ns);T(this,"name","RegExpRouter");I(this,me);I(this,_e);T(this,"match",Fr);b(this,me,{[$]:Object.create(null)}),b(this,_e,{[$]:Object.create(null)})}add(e,s,r){var i;const t=_(this,me),a=_(this,_e);if(!t||!a)throw new Error(Xs);t[e]||[t,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[$]).forEach(u=>{c[e][u]=[...c[$][u]]})}),s==="/*"&&(s="*");const n=(s.match(/\/:/g)||[]).length;if(/\*$/.test(s)){const c=sr(s);e===$?Object.keys(t).forEach(u=>{var l;(l=t[u])[s]||(l[s]=Oe(t[u],s)||Oe(t[$],s)||[])}):(i=t[e])[s]||(i[s]=Oe(t[e],s)||Oe(t[$],s)||[]),Object.keys(t).forEach(u=>{(e===$||e===u)&&Object.keys(t[u]).forEach(l=>{c.test(l)&&t[u][l].push([r,n])})}),Object.keys(a).forEach(u=>{(e===$||e===u)&&Object.keys(a[u]).forEach(l=>c.test(l)&&a[u][l].push([r,n]))});return}const o=Ws(s)||[s];for(let c=0,u=o.length;c<u;c++){const l=o[c];Object.keys(a).forEach(p=>{var m;(e===$||e===p)&&((m=a[p])[l]||(m[l]=[...Oe(t[p],l)||Oe(t[$],l)||[]]),a[p][l].push([r,n-u+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(_(this,_e)).concat(Object.keys(_(this,me))).forEach(s=>{e[s]||(e[s]=A(this,ns,rr).call(this,s))}),b(this,me,b(this,_e,void 0)),Vr(),e}},me=new WeakMap,_e=new WeakMap,ns=new WeakSet,rr=function(e){const s=[];let r=e===$;return[_(this,me),_(this,_e)].forEach(t=>{const a=t[e]?Object.keys(t[e]).map(n=>[n,t[e][n]]):[];a.length!==0?(r||(r=!0),s.push(...a)):e!==$&&s.push(...Object.keys(t[$]).map(n=>[n,t[$][n]]))}),r?Yr(s):null},qs),fe,ce,Fs,zr=(Fs=class{constructor(e){T(this,"name","SmartRouter");I(this,fe,[]);I(this,ce,[]);b(this,fe,e.routers)}add(e,s,r){if(!_(this,ce))throw new Error(Xs);_(this,ce).push([e,s,r])}match(e,s){if(!_(this,ce))throw new Error("Fatal error");const r=_(this,fe),t=_(this,ce),a=r.length;let n=0,o;for(;n<a;n++){const i=r[n];try{for(let c=0,u=t.length;c<u;c++)i.add(...t[c]);o=i.match(e,s)}catch(c){if(c instanceof Qs)continue;throw c}this.match=i.match.bind(i),b(this,fe,[i]),b(this,ce,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(_(this,ce)||_(this,fe).length!==1)throw new Error("No active router has been determined yet.");return _(this,fe)[0]}},fe=new WeakMap,ce=new WeakMap,Fs),qe=Object.create(null),Gr=e=>{for(const s in e)return!0;return!1},Ee,W,Te,Ue,x,ue,ye,$e,Xr=($e=class{constructor(s,r,t){I(this,ue);I(this,Ee);I(this,W);I(this,Te);I(this,Ue,0);I(this,x,qe);if(b(this,W,t||Object.create(null)),b(this,Ee,[]),s&&r){const a=Object.create(null);a[s]={handler:r,possibleKeys:[],score:0},b(this,Ee,[a])}b(this,Te,[])}insert(s,r,t){b(this,Ue,++Os(this,Ue)._);let a=this;const n=Rr(r),o=[];for(let i=0,c=n.length;i<c;i++){const u=n[i],l=n[i+1],p=Or(u,l),m=Array.isArray(p)?p[0]:u;if(m in _(a,W)){a=_(a,W)[m],p&&o.push(p[1]);continue}_(a,W)[m]=new $e,p&&(_(a,Te).push(p),o.push(p[1])),a=_(a,W)[m]}return _(a,Ee).push({[s]:{handler:t,possibleKeys:o.filter((i,c,u)=>u.indexOf(i)===c),score:_(this,Ue)}}),a}search(s,r){var l;const t=[];b(this,x,qe);let n=[this];const o=xs(r),i=[],c=o.length;let u=null;for(let p=0;p<c;p++){const m=o[p],E=p===c-1,f=[];for(let y=0,w=n.length;y<w;y++){const g=n[y],O=_(g,W)[m];O&&(b(O,x,_(g,x)),E?(_(O,W)["*"]&&A(this,ue,ye).call(this,t,_(O,W)["*"],s,_(g,x)),A(this,ue,ye).call(this,t,O,s,_(g,x))):f.push(O));for(let k=0,L=_(g,Te).length;k<L;k++){const q=_(g,Te)[k],j=_(g,x)===qe?{}:{..._(g,x)};if(q==="*"){const H=_(g,W)["*"];H&&(A(this,ue,ye).call(this,t,H,s,_(g,x)),b(H,x,j),f.push(H));continue}const[D,R,N]=q;if(!m&&!(N instanceof RegExp))continue;const C=_(g,W)[D];if(N instanceof RegExp){if(u===null){u=new Array(c);let Q=r[0]==="/"?1:0;for(let Z=0;Z<c;Z++)u[Z]=Q,Q+=o[Z].length+1}const H=r.substring(u[p]),J=N.exec(H);if(J){if(j[R]=J[0],A(this,ue,ye).call(this,t,C,s,_(g,x),j),Gr(_(C,W))){b(C,x,j);const Q=((l=J[0].match(/\//))==null?void 0:l.length)??0;(i[Q]||(i[Q]=[])).push(C)}continue}}(N===!0||N.test(m))&&(j[R]=m,E?(A(this,ue,ye).call(this,t,C,s,j,_(g,x)),_(C,W)["*"]&&A(this,ue,ye).call(this,t,_(C,W)["*"],s,j,_(g,x))):(b(C,x,j),f.push(C)))}}const h=i.shift();n=h?f.concat(h):f}return t.length>1&&t.sort((p,m)=>p.score-m.score),[t.map(({handler:p,params:m})=>[p,m])]}},Ee=new WeakMap,W=new WeakMap,Te=new WeakMap,Ue=new WeakMap,x=new WeakMap,ue=new WeakSet,ye=function(s,r,t,a,n){for(let o=0,i=_(r,Ee).length;o<i;o++){const c=_(r,Ee)[o],u=c[t]||c[$],l={};if(u!==void 0&&(u.params=Object.create(null),s.push(u),a!==qe||n&&n!==qe))for(let p=0,m=u.possibleKeys.length;p<m;p++){const E=u.possibleKeys[p],f=l[u.score];u.params[E]=n!=null&&n[E]&&!f?n[E]:a[E]??(n==null?void 0:n[E]),l[u.score]=!0}}},$e),Re,Hs,Qr=(Hs=class{constructor(){T(this,"name","TrieRouter");I(this,Re);b(this,Re,new Xr)}add(e,s,r){const t=Ws(s);if(t){for(let a=0,n=t.length;a<n;a++)_(this,Re).insert(e,t[a],r);return}_(this,Re).insert(e,s,r)}match(e,s){return _(this,Re).search(e,s)}},Re=new WeakMap,Hs),tr=class extends qr{constructor(e={}){super(e),this.router=e.router??new zr({routers:[new Jr,new Qr]})}},S=e=>{const r={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},t=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(r.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(r.allowMethods);return async function(o,i){var l;function c(p,m){o.res.headers.set(p,m)}const u=await t(o.req.header("origin")||"",o);if(u&&c("Access-Control-Allow-Origin",u),r.credentials&&c("Access-Control-Allow-Credentials","true"),(l=r.exposeHeaders)!=null&&l.length&&c("Access-Control-Expose-Headers",r.exposeHeaders.join(",")),o.req.method==="OPTIONS"){r.origin!=="*"&&c("Vary","Origin"),r.maxAge!=null&&c("Access-Control-Max-Age",r.maxAge.toString());const p=await a(o.req.header("origin")||"",o);p.length&&c("Access-Control-Allow-Methods",p.join(","));let m=r.allowHeaders;if(!(m!=null&&m.length)){const E=o.req.header("Access-Control-Request-Headers");E&&(m=E.split(/\s*,\s*/))}return m!=null&&m.length&&(c("Access-Control-Allow-Headers",m.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),r.origin!=="*"&&o.header("Vary","Origin",{append:!0})}},Zr=/^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:javascript|json|xml|xml-dtd|ecmascript|dart|postscript|rtf|tar|toml|vnd\.dart|vnd\.ms-fontobject|vnd\.ms-opentype|wasm|x-httpd-php|x-javascript|x-ns-proxy-autoconfig|x-sh|x-tar|x-virtualbox-hdd|x-virtualbox-ova|x-virtualbox-ovf|x-virtualbox-vbox|x-virtualbox-vdi|x-virtualbox-vhd|x-virtualbox-vmdk|x-www-form-urlencoded)|font\/(?:otf|ttf)|image\/(?:bmp|vnd\.adobe\.photoshop|vnd\.microsoft\.icon|vnd\.ms-dds|x-icon|x-ms-bmp)|message\/rfc822|model\/gltf-binary|x-shader\/x-fragment|x-shader\/x-vertex|[^;\s]+?\+(?:json|text|xml|yaml))(?:[;\s]|$)/i,et=/(?:^|,)\s*?no-transform\s*?(?:,|$)/i,st=e=>{const s=e==null?void 0:e.threshold;return async function(t,a){await a();const n=t.res.headers.get("Content-Length");if(t.res.headers.has("Content-Encoding")||t.res.headers.has("Transfer-Encoding")||t.req.method==="HEAD"||n&&Number(n)<s||!rt(t.res)||!tt(t.res))return;t.req.header("Accept-Encoding");const o=e==null?void 0:e.encoding;if(!t.res.body)return;const i=new CompressionStream(o);t.res=new Response(t.res.body.pipeThrough(i),t.res),t.res.headers.delete("Content-Length"),t.res.headers.set("Content-Encoding",o)}},rt=e=>{const s=e.headers.get("Content-Type");return s&&Zr.test(s)},tt=e=>{const s=e.headers.get("Cache-Control");return!s||!et.test(s)};function at(e){const s=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],r=[];for(const t of s)e[t]||r.push(t);if(r.length>0)throw new Error(`Missing required environment variables: ${r.join(", ")}

Please configure them:
`+r.map(t=>t==="TOSS_SECRET_KEY"||t==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${t} --project-name ur-live`:`  Check wrangler.jsonc for ${t} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function nt(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function ot(e){const s=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),s.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):s.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(r){s.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:r instanceof Error?r.message:String(r)})}try{if(!e.SESSION_KV)s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const r="test:env:check";await e.SESSION_KV.put(r,"ok",{expirationTtl:60}),await e.SESSION_KV.get(r)==="ok"?s.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):s.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(r){s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:r instanceof Error?r.message:String(r)})}try{if(!e.CACHE_KV)s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const r="test:cache:check";await e.CACHE_KV.put(r,"ok",{expirationTtl:60}),await e.CACHE_KV.get(r)==="ok"?s.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):s.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(r){s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:r instanceof Error?r.message:String(r)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?s.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):s.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?s.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):s.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),s}function it(e){const s=[];s.push(""),s.push("========================================"),s.push("환경 변수 테스트 결과"),s.push("========================================"),s.push("");let r=0,t=0,a=0;for(const n of e){const o=n.status==="pass"?"✅":n.status==="warn"?"⚠️":"❌";s.push(`${o} ${n.name}: ${n.message}`),n.details&&s.push(`   → ${n.details}`),n.status==="pass"&&r++,n.status==="warn"&&t++,n.status==="fail"&&a++}return s.push(""),s.push("========================================"),s.push(`총 ${e.length}개 테스트:`),s.push(`  ✅ 성공: ${r}`),t>0&&s.push(`  ⚠️  경고: ${t}`),a>0&&s.push(`  ❌ 실패: ${a}`),s.push("========================================"),s.push(""),a>0?(s.push("❌ 환경 변수 설정이 완료되지 않았습니다."),s.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):t>0?s.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):s.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),s.join(`
`)}async function ct(e){const s=await ot(e),r=s.filter(n=>n.status==="pass").length,t=s.filter(n=>n.status==="warn").length,a=s.filter(n=>n.status==="fail").length;return{success:a===0,summary:{total:s.length,pass:r,warn:t,fail:a},results:s,formatted:it(s)}}const ds={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function ut(){const e=ds.ENV==="production";return{baseUrl:ds.TEST_BASE_URL,apiKey:ds.TEST_API_KEY,isProduction:e}}async function ar(e,s){const r=ut(),t=`${r.baseUrl}${e}`;try{const a=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r.apiKey}`},body:JSON.stringify(s)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function lt(e){try{const s={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((t,a)=>({SerialNum:a+1,ItemName:t.name,Qty:t.quantity,UnitPrice:t.unitPrice,SupplyCost:t.supplyPrice,Tax:t.taxAmount,Remark:t.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},r=await ar("/eTaxInvoice/RegistAndIssue",s);if(r.code!==1)throw new Error(`바로빌 발행 실패: ${r.message}`);return{success:!0,ntsConfirmNumber:r.ntsconfirmNum,invoiceKey:r.invoiceKey,message:r.message}}catch(s){throw console.error("바로빌 세금계산서 발행 실패:",s),s}}async function dt(e,s,r){try{const a=await ar("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:s,Memo:r});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(t){throw console.error("바로빌 세금계산서 취소 실패:",t),t}}function Fe(){return!1}async function pt(e){return await lt(e)}function mt(e,s,r){const t=Number(s.total_amount),a=Math.floor(t/1.1),n=t-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:s.buyer_business_number,buyerBusinessName:s.buyer_business_name||s.user_name,buyerCEO:s.buyer_ceo_name,buyerAddress:s.shipping_address,buyerEmail:s.user_email,buyerTel:s.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:r.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),u=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:u,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:t,memo:`주문번호: ${s.order_number}`,orderNo:s.order_number}}class X extends Error{constructor(s,r,t){super(s),this.statusCode=r,this.code=t,this.name="AuthError"}}function _t(e){return`${crypto.randomUUID()}-${e}`}function ft(e){var n,o,i,c,u,l,p;const s=e.id.toString(),r=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",t=((c=e.kakao_account)==null?void 0:c.email)||null,a=((u=e.properties)==null?void 0:u.profile_image)||((p=(l=e.kakao_account)==null?void 0:l.profile)==null?void 0:p.profile_image_url)||null;return{kakaoId:s,nickname:r,email:t,profileImage:a}}async function Et(e,s,r,t,a){try{const n=await e.prepare(`
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
    `).bind(s,r,t,a).first();if(!n)throw new X("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",n.id),n}catch(n){throw n instanceof X?n:(console.error("[Auth] Database error during upsert:",n),new X("Database error",500,"DB_ERROR"))}}async function ht(e){try{const s=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!s.ok){const t=await s.text();throw console.error("[Kakao API] Failed to get user info:",t),new X("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const r=await s.json();if(!r.id)throw new X("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return r}catch(s){throw s instanceof X?s:(console.error("[Kakao API] Network error:",s),new X("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function gt(e,s,r){try{const t=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:r,redirect_uri:s,code:e}).toString()});if(!t.ok){const n=await t.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new X(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await t.json()).access_token}catch(t){throw t instanceof X?t:(console.error("[Kakao OAuth] Network error:",t),new X("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function nr(e,s){const r=await ht(s),{kakaoId:t,nickname:a,email:n,profileImage:o}=ft(r);console.log("[Auth] Processing login for Kakao user:",t);const i=await Et(e,t,a,n,o),c=_t(i.id);return{user:i,sessionToken:c}}async function or(e,s,r=30){try{const t=await e.get(s,"json");if(!t)return console.log(`[Cache MISS] ${s}`),null;const a=Date.now()-t.timestamp;return a>r*1e3?(console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${s} (age: ${Math.round(a/1e3)}s)`),t.data)}catch(t){return console.error(`[Cache] Get error for key "${s}":`,t),null}}async function ts(e,s,r,t=30){try{const a={data:r,timestamp:Date.now()};await e.put(s,JSON.stringify(a),{expirationTtl:t}),console.log(`[Cache SET] ${s} (TTL: ${t}s)`)}catch(a){console.error(`[Cache] Set error for key "${s}":`,a)}}function yt(e){const s=e.req.header("CF-Connecting-IP");if(s)return s;const r=e.req.header("X-Forwarded-For");if(r)return r.split(",")[0].trim();const t=e.req.header("X-Real-IP");return t||"unknown"}function wt(e,s){return`ratelimit:${e}:${s}`}const ps=new Map;async function St(e,s,r){var m;const t=new URL(e.req.url).pathname,a=wt(s,t),n=Date.now(),o=r.windowMs*1e3,c=e.get("user")&&r.authenticatedMultiplier?r.maxRequests*r.authenticatedMultiplier:r.maxRequests;try{const E=(m=e.env)==null?void 0:m.RATE_LIMIT_KV;if(E){const f=await E.get(a);let h;f?(h=JSON.parse(f),n>h.resetTime?h={count:1,resetTime:n+o}:h.count++):h={count:1,resetTime:n+o};const y=Math.ceil(o/1e3);await E.put(a,JSON.stringify(h),{expirationTtl:y});const w=h.count<=c,g=Math.max(0,c-h.count);return{allowed:w,remaining:g,resetTime:h.resetTime}}}catch(E){console.error("KV Rate Limit Error:",E)}let u=ps.get(a);u&&n>u.resetTime&&(ps.delete(a),u=void 0),u?u.count++:u={count:1,resetTime:n+o},ps.set(a,u);const l=u.count<=c,p=Math.max(0,c-u.count);return{allowed:l,remaining:p,resetTime:u.resetTime}}function ze(e){return async(s,r)=>{const t=yt(s);if(e.skipIps&&e.skipIps.includes(t))return r();if(e.pathPattern){const n=new URL(s.req.url).pathname;if(!e.pathPattern.test(n))return r()}const a=await St(s,t,e);if(s.header("X-RateLimit-Limit",e.maxRequests.toString()),s.header("X-RateLimit-Remaining",a.remaining.toString()),s.header("X-RateLimit-Reset",new Date(a.resetTime).toISOString()),!a.allowed){const n=Math.ceil((a.resetTime-Date.now())/1e3);return s.header("Retry-After",n.toString()),s.json({success:!1,error:e.message||"Too many requests. Please try again later.",retryAfter:n,resetTime:new Date(a.resetTime).toISOString()},429)}return r()}}const Ge={api:{windowMs:60,maxRequests:60,message:"API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",authenticatedMultiplier:2},auth:{windowMs:60,maxRequests:5,message:"로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",pathPattern:/^\/api\/auth\//},order:{windowMs:60,maxRequests:10,message:"주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/orders/,authenticatedMultiplier:2},alimtalk:{windowMs:60,maxRequests:10,message:"알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/seller\/alimtalk\/send/},upload:{windowMs:60,maxRequests:5,message:"파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/.*\/upload/}};class U extends Error{constructor(s,r,t="VALIDATION_ERROR"){super(r),this.field=s,this.code=t,this.name="ValidationError"}}function bt(e,s){const{field:r,required:t,type:a,min:n,max:o,pattern:i,enum:c,custom:u,message:l}=s;if(t&&(e==null||e===""))throw new U(r,l||`${r}은(는) 필수 항목입니다.`,"REQUIRED");if(!(e==null||e==="")){if(a)switch(a){case"string":if(typeof e!="string")throw new U(r,l||`${r}은(는) 문자열이어야 합니다.`,"INVALID_TYPE");break;case"number":const p=typeof e=="string"?Number(e):e;if(typeof p!="number"||isNaN(p))throw new U(r,l||`${r}은(는) 숫자여야 합니다.`,"INVALID_TYPE");break;case"boolean":if(typeof e!="boolean")throw new U(r,l||`${r}은(는) true/false 값이어야 합니다.`,"INVALID_TYPE");break;case"email":if(typeof e!="string"||!It(e))throw new U(r,l||`${r}은(는) 유효한 이메일 주소여야 합니다.`,"INVALID_EMAIL");break;case"url":if(typeof e!="string"||!vt(e))throw new U(r,l||`${r}은(는) 유효한 URL이어야 합니다.`,"INVALID_URL");break;case"phone":if(typeof e!="string"||!Ot(e))throw new U(r,l||`${r}은(는) 유효한 전화번호여야 합니다.`,"INVALID_PHONE");break;case"date":if(!(e instanceof Date)&&!Dt(e))throw new U(r,l||`${r}은(는) 유효한 날짜여야 합니다.`,"INVALID_DATE");break;case"array":if(!Array.isArray(e))throw new U(r,l||`${r}은(는) 배열이어야 합니다.`,"INVALID_TYPE");break;case"object":if(typeof e!="object"||e===null||Array.isArray(e))throw new U(r,l||`${r}은(는) 객체여야 합니다.`,"INVALID_TYPE");break}if(typeof e=="string"){if(n!==void 0&&e.length<n)throw new U(r,l||`${r}은(는) 최소 ${n}자 이상이어야 합니다.`,"TOO_SHORT");if(o!==void 0&&e.length>o)throw new U(r,l||`${r}은(는) 최대 ${o}자 이하여야 합니다.`,"TOO_LONG")}if(typeof e=="number"){if(n!==void 0&&e<n)throw new U(r,l||`${r}은(는) 최소 ${n} 이상이어야 합니다.`,"TOO_SMALL");if(o!==void 0&&e>o)throw new U(r,l||`${r}은(는) 최대 ${o} 이하여야 합니다.`,"TOO_LARGE")}if(Array.isArray(e)){if(n!==void 0&&e.length<n)throw new U(r,l||`${r}은(는) 최소 ${n}개 이상이어야 합니다.`,"TOO_FEW");if(o!==void 0&&e.length>o)throw new U(r,l||`${r}은(는) 최대 ${o}개 이하여야 합니다.`,"TOO_MANY")}if(i&&typeof e=="string"&&!i.test(e))throw new U(r,l||`${r}의 형식이 올바르지 않습니다.`,"INVALID_FORMAT");if(c&&!c.includes(e))throw new U(r,l||`${r}은(는) 다음 중 하나여야 합니다: ${c.join(", ")}`,"INVALID_ENUM");if(u&&u(e)===!1)throw new U(r,l||`${r}의 값이 유효하지 않습니다.`,"CUSTOM_VALIDATION_FAILED")}}function Tt(e,s){for(const r of s){const t=e[r.field];bt(t,r)}}function Rt(e){return async(s,r)=>{try{let t={};const a=s.req.header("content-type")||"";a.includes("application/json")?t=await s.req.json().catch(()=>({})):(a.includes("application/x-www-form-urlencoded")||a.includes("multipart/form-data"))&&(t=await s.req.parseBody().catch(()=>({})));const n=new URL(s.req.url);for(const[o,i]of n.searchParams.entries())o in t||(t[o]=i);Tt(t,e),s.set("validatedData",t),await r()}catch(t){if(t instanceof U)return s.json({success:!1,error:t.message,field:t.field,code:t.code},400);throw t}}}function It(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=255}function vt(e){try{const s=new URL(e);return s.protocol==="http:"||s.protocol==="https:"}catch{return!1}}function Ot(e){return/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e)}function Dt(e){if(typeof e!="string")return!1;const s=new Date(e);return!isNaN(s.getTime())}const Nt=[{field:"email",required:!0,type:"email",max:255,message:"유효한 이메일 주소를 입력해주세요."},{field:"password",required:!0,type:"string",min:8,max:100,pattern:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:"비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다."},{field:"name",required:!0,type:"string",min:2,max:50,message:"이름은 2-50자 사이여야 합니다."},{field:"phone",required:!1,type:"phone",message:"유효한 전화번호를 입력해주세요. (예: 010-1234-5678)"}];function os(e){const s=new URLSearchParams;for(const[r,t]of Object.entries(e))t!=null&&s.append(r,String(t));return s}function hs(e,s){if(e.result_code!=="1")throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`)}async function gs(e){console.log("[Aligo] 토큰 생성 시작");const r=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:os({apikey:e.ALIGO_API_KEY,userid:e.ALIGO_USER_ID})})).json();return hs(r,"Token Create"),console.log("[Aligo] ✅ 토큰 생성 성공:",r.token.substring(0,20)+"..."),{token:r.token,urtime:r.urtime}}async function At(e,s){console.log("[Aligo] 카카오 채널 등록:",s.channelId);const{token:r}=await gs(e),a=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:os({token:r,userid:e.ALIGO_USER_ID,plusid:s.channelId,phonenumber:s.phoneNumber})})).json();return hs(a,"Channel Register"),console.log("[Aligo] ✅ 카카오 채널 등록 성공, senderKey:",a.senderkey),{success:!0,senderKey:a.senderkey}}async function kt(e,s,r){console.log("[Aligo] 템플릿 등록:",r.templateCode);const{token:t}=await gs(e),n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:os({token:t,userid:e.ALIGO_USER_ID,senderkey:s,tpl_name:r.name,tpl_content:r.content,tpl_code:r.templateCode})})).json();return hs(n,"Template Register"),console.log("[Aligo] ✅ 템플릿 등록 성공:",n.tpl_code),{success:!0,templateCode:n.tpl_code}}async function ys(e,s){console.log("[Aligo] 알림톡 발송:",s.to);try{const{token:r}=await gs(e),t=s.buttons?JSON.stringify({button:s.buttons}):void 0,n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:os({token:r,userid:e.ALIGO_USER_ID,senderkey:s.senderKey,tpl_code:s.templateCode,receiver_1:s.to,subject_1:"알림톡",message_1:s.message,button_1:t})})).json();return n.result_code!=="1"?(console.error("[Aligo] ❌ 알림톡 발송 실패:",n.message),{success:!1,error:n.message}):(console.log("[Aligo] ✅ 알림톡 발송 성공, messageId:",n.msg_id),{success:!0,messageId:n.msg_id})}catch(r){return console.error("[Aligo] ❌ 알림톡 발송 에러:",r.message),{success:!1,error:r.message}}}function jt(e,s){let r=e;for(const[t,a]of Object.entries(s)){const n=new RegExp(`#{${t}}`,"g");r=r.replace(n,a)}return r}function ir(e){let s=e.replace(/-/g,"");if(!s.startsWith("010"))throw new Error("Invalid phone number format. Must start with 010");if(s.length!==11)throw new Error("Invalid phone number length. Must be 11 digits");return s}async function Ct(e,s){const r=await e.prepare(`
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
  `).bind(s).all();return{order:r,products:t.results}}async function Lt(e,s){const r=await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(s).first();return r||(console.warn(`No active alimtalk account for seller ${s}`),null)}async function ks(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id,s.template_code,s.recipient_phone,s.message,s.cost,s.status,s.order_id||null).run()}async function Mt(e,s,r){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(r,s).run()}async function Ut(e,s){try{const{order:r,products:t}=await Ct(e.DB,s),a=await Lt(e.DB,r.seller_id);if(!a)return console.warn(`Skipping alimtalk for order ${s}: no active account`),{success:!1,reason:"no_account"};const n=15;if(a.balance<n)return console.warn(`Skipping alimtalk for order ${s}: insufficient balance`),{success:!1,reason:"insufficient_balance"};const o=t.map(u=>`${u.name} ${u.quantity}개 (${u.price.toLocaleString()}원)`).join(`
`),i=`[주문 확인]

주문번호: ${r.order_number}
주문일시: ${new Date(r.created_at).toLocaleString("ko-KR")}

주문 상품:
${o}

총 결제금액: ${r.total_amount.toLocaleString()}원

배송지: ${r.shipping_address}
수령인: ${r.shipping_name}
연락처: ${r.shipping_phone}

주문해 주셔서 감사합니다!`,c=await ys(e,{senderKey:a.sender_key,templateCode:"order_confirm",to:r.buyer_phone,message:i});return c.success?(await Mt(e.DB,r.seller_id,n),await ks(e.DB,{seller_id:r.seller_id,template_code:"order_confirm",recipient_phone:r.buyer_phone,message:i,cost:n,status:"sent",order_id:s}),console.log(`Order confirmation sent for order ${s}`),{success:!0}):(await ks(e.DB,{seller_id:r.seller_id,template_code:"order_confirm",recipient_phone:r.buyer_phone,message:i,cost:0,status:"failed",order_id:s}),console.error(`Failed to send order confirmation for order ${s}:`,c.error),{success:!1,error:c.error})}catch(r){return console.error(`Error sending order confirmation for order ${s}:`,r),{success:!1,error:r.message}}}function $t(e,s){let r=e;return Object.entries(s).forEach(([t,a])=>{const n=new RegExp(`#{${t}}`,"g");r=r.replace(n,a)}),r}function Pt(e,s){const t=Array.from(e.matchAll(/#{(\w+)}/g),a=>a[1]).filter(a=>!s[a]);return{valid:t.length===0,missingVars:t}}async function qt(e,s,r){const t=await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();if(!t)throw new Error(`Account not found: ${s}`);return{sufficient:t.balance>=r,currentBalance:t.balance}}async function Ft(e,s,r){const t=await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(r,s,r).run();if(!t.success||t.meta.changes===0)throw new Error("Insufficient balance or account not found")}async function js(e,s,r){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(r,s).run()}async function ms(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s.accountId,s.templateId,s.orderId||null,s.recipientPhone,s.messageContent,s.status,s.cost,s.aligoMessageId||null,s.failedReason||null).run()}async function Ht(e,s,r,t){await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(r,t,s).run()}async function xt(e,s,r,t,a,n,o,i,c){try{const u={...i,...o.variables},l=$t(t,u),p=await ys(e,{senderKey:a,templateCode:n,to:o.phone,message:l});return p.success?(await ms(e.DB,{accountId:s,templateId:r,recipientPhone:o.phone,messageContent:l,status:"sent",cost:c,aligoMessageId:p.messageId}),{phone:o.phone,status:"sent",messageId:p.messageId,cost:c}):(await ms(e.DB,{accountId:s,templateId:r,recipientPhone:o.phone,messageContent:l,status:"failed",cost:0,failedReason:p.error}),await js(e.DB,s,c),{phone:o.phone,status:"failed",error:p.error,cost:0})}catch(u){return console.error(`Failed to send alimtalk to ${o.phone}:`,u),await ms(e.DB,{accountId:s,templateId:r,recipientPhone:o.phone,messageContent:"",status:"failed",cost:0,failedReason:u.message}),await js(e.DB,s,c),{phone:o.phone,status:"failed",error:u.message,cost:0}}}async function ws(e,s){const{accountId:r,templateId:t,recipients:a,variables:n}=s;console.log(`[Alimtalk] Starting bulk send: ${a.length} recipients`);try{const o=await e.DB.prepare(`
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
    `).bind(t,r).first();if(!i)throw new Error("Template not found");if(i.status!=="approved")throw new Error("Template is not approved");const c=Pt(i.template_content,n);if(!c.valid)throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);const u=15,l=a.length*u,p=await qt(e.DB,r,l);if(!p.sufficient)throw new Error(`Insufficient balance. Required: ${l}, Current: ${p.currentBalance}`);await Ft(e.DB,r,l),console.log(`[Alimtalk] Deducted ${l} points from account ${r}`);const m=[];let E=0,f=0,h=0;for(const y of a){const w=await xt(e,r,t,i.template_content,o.sender_key,i.template_code,y,n,u);m.push(w),w.status==="sent"?E++:(f++,h+=u),m.length%10===0&&await new Promise(g=>setTimeout(g,1e3))}return await Ht(e.DB,r,E,f),console.log(`[Alimtalk] Completed: ${E} sent, ${f} failed, ${h} refunded`),{success:!0,totalRecipients:a.length,successCount:E,failedCount:f,refundedAmount:h,messages:m}}catch(o){return console.error("[Alimtalk] Bulk send failed:",o),{success:!1,totalRecipients:a.length,successCount:0,failedCount:a.length,refundedAmount:0,messages:[],error:o.message}}}async function Bt(e,s,r,t,a){const n=await e.DB.prepare(`
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
  `).bind(t).all()).results.map(l=>`${l.name} ${l.quantity}개 (${l.price.toLocaleString()}원)`).join(`
`),c={orderNumber:n.order_number,orderDate:new Date(n.created_at).toLocaleString("ko-KR"),productList:i,totalAmount:n.total_amount.toLocaleString(),shippingAddress:n.shipping_address,shippingName:n.shipping_name,shippingPhone:n.shipping_phone,buyerName:n.buyer_name,customMessage:a||"감사합니다!"},u=[{phone:n.buyer_phone,name:n.buyer_name}];return ws(e,{accountId:s,templateId:r,recipients:u,variables:c})}async function Wt(e,s,r,t,a={}){const n=t.map(o=>({phone:o.phone,name:o.name,variables:Object.entries(o).filter(([i])=>i!=="phone"&&i!=="name").reduce((i,[c,u])=>({...i,[c]:u}),{})}));return ws(e,{accountId:s,templateId:r,recipients:n,variables:a})}function Kt(e,s=.1){return Math.floor(e*s)}function Vt(){const e=new Date,s=new Date(e.getFullYear(),e.getMonth()-1,1),r=s.getFullYear(),t=String(s.getMonth()+1).padStart(2,"0"),a=new Date(r,s.getMonth()+1,0).getDate();return{startDate:`${r}-${t}-01`,endDate:`${r}-${t}-${a}`}}async function Yt(e,s,r){try{const t=await e.prepare(`
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
    `).bind(s,r.startDate,r.endDate).all();if(!a.results||a.results.length===0)return{seller_id:s,seller_name:t.business_name,total_sales:0,total_orders:0,platform_fee:0,shipping_fee:0,refund_amount:0,settlement_amount:0,orders:[]};const n=[];let o=0,i=0,c=0;for(const m of a.results){const E=m.total_amount-m.shipping_fee,f=Kt(E);n.push({order_id:m.id,order_number:m.order_number,order_date:m.created_at,product_name:m.product_names||"",quantity:m.total_quantity||1,price:E,shipping_fee:m.shipping_fee||0,platform_fee:f,status:m.status}),o+=E,i+=m.shipping_fee||0,c+=f}const u=await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(s,r.startDate,r.endDate).first(),l=(u==null?void 0:u.refund_amount)||0,p=o-c-l+i;return{seller_id:s,seller_name:t.business_name,total_sales:o,total_orders:n.length,platform_fee:c,shipping_fee:i,refund_amount:l,settlement_amount:p,orders:n}}catch(t){return console.error(`Failed to calculate settlement for seller ${s}:`,t),null}}async function Jt(e,s){console.log(`[Settlement] Generating report for ${s.startDate} ~ ${s.endDate}`);const r=await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(s.startDate,s.endDate).all(),t=[];let a=0,n=0,o=0;for(const c of r.results){const u=await Yt(e,c.id,s);u&&(t.push(u),a+=u.total_sales,n+=u.platform_fee,o+=u.settlement_amount)}const i={period:s,generated_at:new Date().toISOString(),total_sales:a,total_platform_fee:n,total_settlement:o,sellers:t};return console.log(`[Settlement] Report generated: ${t.length} sellers, ${a.toLocaleString()}원`),i}async function zt(e,s){const t=(await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(s.period.startDate,s.period.endDate,s.total_sales,s.total_platform_fee,s.total_settlement,s.generated_at).run()).meta.last_row_id;for(const a of s.sellers)await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a.seller_id,a.total_sales,a.total_orders,a.platform_fee,a.shipping_fee,a.refund_amount,a.settlement_amount).run();console.log(`[Settlement] Report saved: ID ${t}`)}async function Gt(e,s){const r=await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(s).first();if(!r)return null;const a=(await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(s).all()).results.map(n=>({seller_id:n.seller_id,seller_name:n.seller_name,total_sales:n.total_sales,total_orders:n.total_orders,platform_fee:n.platform_fee,shipping_fee:n.shipping_fee,refund_amount:n.refund_amount,settlement_amount:n.settlement_amount,orders:[]}));return{period:{startDate:r.period_start,endDate:r.period_end},generated_at:r.generated_at,total_sales:r.total_sales,total_platform_fee:r.total_platform_fee,total_settlement:r.total_settlement,sellers:a}}async function Xt(e,s){const r=new TextEncoder;let t;const a=new ReadableStream({async start(n){console.log(`[SSE] Client connected to stream ${e}`);try{const o=await s.DB.prepare(`
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

`))}catch(o){console.error("[SSE] Update failed:",o)}},3e4)},cancel(){console.log(`[SSE] Client disconnected from stream ${e}`),t&&clearInterval(t)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Qt(e,s){const r=new TextEncoder;let t=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Chat] Client connected to stream ${e}`);try{const i=await s.DB.prepare(`
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
        `).bind(e).all();if(i.results.length>0){t=i.results[0].id;const c={type:"chat",data:i.results.reverse(),timestamp:new Date().toISOString()},u=JSON.stringify(c);o.enqueue(r.encode(`data: ${u}

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
          `).bind(e,t).all();if(i.results.length>0){t=i.results[i.results.length-1].id;const c={type:"chat",data:i.results,timestamp:new Date().toISOString()},u=JSON.stringify(c);o.enqueue(r.encode(`data: ${u}

`))}else o.enqueue(r.encode(`: ping

`))}catch(i){console.error("[SSE Chat] Polling failed:",i)}},5e3)},cancel(){console.log(`[SSE Chat] Client disconnected from stream ${e}`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function Zt(e,s){const r=new TextEncoder;let t=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Orders] Seller ${e} connected`);try{const i=await s.DB.prepare(`
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
          `).bind(e,t).all();if(i.results.length>0){t=i.results[i.results.length-1].id;const c={type:"order",data:i.results,timestamp:new Date().toISOString()},u=JSON.stringify(c);o.enqueue(r.encode(`data: ${u}

`))}else o.enqueue(r.encode(`: ping

`))}catch(i){console.error("[SSE Orders] Polling failed:",i)}},1e4)},cancel(){console.log(`[SSE Orders] Seller ${e} disconnected`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function ea(e,s){const r=new TextEncoder;let t;const a=new ReadableStream({async start(n){console.log(`[SSE Stock] Seller ${e} connected`),t=setInterval(async()=>{try{const o=await s.DB.prepare(`
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

`))}catch(o){console.error("[SSE Stock] Polling failed:",o)}},6e4)},cancel(){console.log(`[SSE Stock] Seller ${e} disconnected`),t&&clearInterval(t)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function sa(e,s,r,t){await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s,r,t.endpoint,t.keys.p256dh,t.keys.auth).run(),console.log(`[Push] Subscription saved for ${r} ${s}`)}async function ra(e,s){await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(),console.log(`[Push] Subscription deleted: ${s}`)}const he=new Map;let F={hits:0,misses:0,writes:0,evictions:0};function is(e){const s=he.get(e);return s?s.expires<Date.now()?(he.delete(e),F.evictions++,F.misses++,null):(F.hits++,s.data):(F.misses++,null)}function le(e,s,r){const t=Date.now()+r*1e3;if(he.set(e,{data:s,expires:t}),F.writes++,he.size>1e3){const a=he.keys().next().value;a&&(he.delete(a),F.evictions++)}}function ta(e){const s=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:s,message:"API Request",context:e,duration:e.duration}))}function aa(e){return{name:"tosspayments",async confirmPayment(s){try{const r=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:s.paymentKey,orderId:s.orderId,amount:s.amount})}),t=await r.json();if(!r.ok)return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:t.message||"결제 승인 실패",rawData:t};let a={};t.card&&(a={cardCompany:t.card.company,cardNumber:t.card.number,installmentMonths:t.card.installmentPlanMonths||0});let n={};return t.virtualAccount&&(n={virtualAccountBank:t.virtualAccount.bankCode,virtualAccountNumber:t.virtualAccount.accountNumber,virtualAccountHolder:t.virtualAccount.customerName,virtualAccountDueDate:t.virtualAccount.dueDate}),{success:!0,orderId:t.orderId,paymentKey:t.paymentKey,method:t.method,totalAmount:t.totalAmount,status:t.status,approvedAt:t.approvedAt,transactionId:t.transactionKey,...a,...n,rawData:t}}catch(r){return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:r.message,rawData:null}}},async cancelPayment(s){try{const r={cancelReason:s.cancelReason};s.cancelAmount&&(r.cancelAmount=s.cancelAmount);const t=await fetch(`https://api.tosspayments.com/v1/payments/${s.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(r)}),a=await t.json();return t.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(r){return{success:!1,error:r.message}}},async getPayment(s){try{const r=await fetch(`https://api.tosspayments.com/v1/payments/${s}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),t=await r.json();if(!r.ok)throw new Error(t.message);return{success:!0,orderId:t.orderId,paymentKey:t.paymentKey,method:t.method,totalAmount:t.totalAmount,status:t.status,approvedAt:t.approvedAt,rawData:t}}catch(r){throw r}}}}function na(e,s){switch(e.toLowerCase()){case"tosspayments":return aa(s);default:throw new Error(`Unknown payment provider: ${e}`)}}const d=new tr;d.use("/api/*",st({encoding:"gzip",threshold:1024}));d.use("*",async(e,s)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{at(e.env),nt(e.env)}catch(t){console.error("[ENV] Validation failed:",t)}await s()});async function ne(e,s,r){if(!s)return null;const t=`session:${s}`;try{if(r){const c=r.get("user_session");if(c)return c}const a=is(t);if(a)return r&&r.set("user_session",a),a;const n=await e.get(t);if(!n)return null;const o=JSON.parse(n);if(o.expires_at&&Date.now()>o.expires_at)return r!=null&&r.executionCtx?r.executionCtx.waitUntil(e.delete(t)):await e.delete(t),null;const i={user_id:o.user_id,user_type:o.user_type||"user",created_at:o.created_at};return le(t,i,60),r&&r.set("user_session",i),i}catch(a){return console.error("[Auth] Session lookup error:",a),null}}async function K(e,s){var n;const{SESSION_KV:r}=e.env;let t=e.req.header("X-Session-Token");if(t||(t=(n=e.req.header("Authorization"))==null?void 0:n.replace("Bearer ","")),!t){const o=e.req.header("Cookie");if(o){const i=o.match(/session=([^;]+)/);t=i?i[1]:void 0}}const a=await ne(r,t,e);if(!a)return e.json({success:!1,error:"인증이 필요합니다. 로그인 해주세요."},401);try{if(t&&a.created_at){const o=Date.now()-a.created_at,i=552*60*60*1e3;if(o>i){const c=`session:${t}`,u=await r.get(c);if(u){const l=JSON.parse(u),p=Date.now()+720*60*60*1e3,m=Date.now();e.executionCtx?e.executionCtx.waitUntil(r.put(c,JSON.stringify({...l,expires_at:p,created_at:m}),{expirationTtl:720*60*60}).then(()=>{le(c,{user_id:l.user_id,user_type:l.user_type||"user",created_at:m},60),console.log("[Auth] ✅ Session auto-renewed (23+ days old) for user:",a.user_id)})):(await r.put(c,JSON.stringify({...l,expires_at:p,created_at:m}),{expirationTtl:720*60*60}),le(c,{user_id:l.user_id,user_type:l.user_type||"user",created_at:m},60))}}}}catch(o){console.error("[Auth] Session renewal error:",o)}e.set("userId",a.user_id),e.set("userType",a.user_type),await s()}async function Ss(e,s){try{const r=is(s);if(r!==null)return r;const t=await e.get(s);if(t){const a=JSON.parse(t);return le(s,a,300),a}return null}catch(r){return console.error("[Cache] Read error:",r),null}}async function bs(e,s,r,t=60){try{le(s,r,t),await e.put(s,JSON.stringify(r),{expirationTtl:t})}catch(a){console.error("[Cache] Write error:",a)}}async function Ts(e,...s){try{await Promise.all(s.map(r=>e.delete(r)))}catch(r){console.error("[Cache] Delete error:",r)}}async function Xe(e,s,r,t,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s,r,t,a,n,o||null).run(),console.log(`[Notification] Created for ${r} ${s}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function oa(e,s,r,t,a){await Xe(e,s,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${t}님의 주문 (${r}) - ${ca(a)}`,"/seller/orders")}async function cr(e,s,r,t,a,n){let o="",i="";switch(t){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${r}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${r}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${r}가 배송 완료되었습니다`;break;default:return}await Xe(e,s,"user","shipping_status",o,i,"/my-orders")}async function ia(e,s,r,t,a){await Xe(e,s,"seller","low_stock","⚠️ 재고 부족 알림",`${r}의 재고가 ${t}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function ca(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function ua(e,s,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const t=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:s,description:r,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!t.ok){const p=await t.text();throw new Error(`YouTube Broadcast 생성 실패: ${p}`)}const n=(await t.json()).id,o=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${s} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!o.ok){const p=await o.text();throw new Error(`YouTube Stream 생성 실패: ${p}`)}const i=await o.json(),c=i.id,u=i.cdn.ingestionInfo.streamName,l=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:n,streamId:c,streamKey:u,streamUrl:l}}catch(t){throw console.error("[YouTube API] Live broadcast creation failed:",t),t}}async function la(e,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${s}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!r.ok){const t=await r.text();throw new Error(`YouTube 방송 종료 실패: ${t}`)}}catch(r){throw console.error("[YouTube API] Live broadcast end failed:",r),r}}async function da(e,s,r){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let t=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${s}&part=snippet,authorDetails`;r&&(t+=`&pageToken=${r}`);const a=await fetch(t,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const o=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${o}`)}const n=await a.json();return{messages:n.items||[],nextPageToken:n.nextPageToken,pollingIntervalMillis:n.pollingIntervalMillis||5e3}}catch(t){throw console.error("[YouTube API] Get chat messages failed:",t),t}}async function pa(e,s){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const r=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},t=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}&key=${e.apiKey}`,a=await fetch(t,{headers:r});if(!a.ok){const u=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${u}`)}const n=await a.json();if(!n.items||n.items.length===0)throw new Error("Video not found");const o=n.items[0],i=o.statistics,c=o.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(r){throw console.error("[YouTube API] Get live stats failed:",r),r}}function ur(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const s=new URL(e);if(s.hostname.includes("youtube.com")){const r=s.searchParams.get("v");if(r)return r;const t=s.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(t)return t[2]}if(s.hostname==="youtu.be"){const r=s.pathname.slice(1).split("?")[0];if(r&&r.length===11)return r}return null}catch{return null}}function lr(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const r=s.pathname.match(/\/video\/(\d+)/);if(r)return r[1];const t=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(t)return t[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}function ma(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){if(s.pathname.includes("/live"))return"live";if(s.pathname.includes("/video/"))return"video"}return null}catch{return null}}function dr(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const r=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}d.use("*",async(e,s)=>{await s(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const r=new URL(e.req.url);r.hostname!=="localhost"&&r.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});d.use("/api/*",S());d.use(ze(Ge.auth));d.use(ze(Ge.alimtalk));d.use(ze(Ge.order));d.use(ze(Ge.upload));d.use("/api/*",ze(Ge.api));d.use("/api/*",async(e,s)=>{const r=Date.now(),t=e.req.method,a=e.req.path;await s();const n=Date.now()-r,o=e.res.status,i={method:t,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),ta(i)});d.use("/static/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});d.use("/images/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});async function pr(e,s,r,t){const a=crypto.randomUUID(),n=Date.now()+720*60*60*1e3,o={user_id:s,user_type:r,userData:t,expires_at:n,created_at:Date.now()};return await e.put(`session:${a}`,JSON.stringify(o),{expirationTtl:720*60*60}),console.log(`[createSession] ✅ Session created for ${r} user ${s}`),a}async function Pe(e,s){const r=await e.get(`session:${s}`);if(!r)return null;const t=JSON.parse(r);return t.expires_at&&Date.now()>t.expires_at?(await e.delete(`session:${s}`),null):{session_token:s,[`${t.user_type}_id`]:t.user_id,user_type:t.user_type,...t.userData}}d.post("/api/auth/user/register",S(),Rt(Nt),async e=>{const{DB:s}=e.env;try{const{email:r,password:t,name:a,phone:n}=e.get("validatedData"),o=`placeholder_hash_for_${t}`;try{const c=(await s.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(r,o,a,n||null).run()).meta.last_row_id,u=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:u,user:{id:c,email:r,name:a,phone:n}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(r){return console.error("[User Register] Error:",r),e.json({success:!1,error:r.message||"회원가입 중 오류가 발생했습니다"},500)}});d.post("/api/auth/user/login",S(),async e=>{const{DB:s,SESSION_KV:r}=e.env;try{const{email:t,password:a}=await e.req.json();if(!t||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await s.prepare("SELECT * FROM users WHERE email = ?").bind(t).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${a}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await s.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();const i=crypto.randomUUID(),c=Date.now()+720*60*60*1e3;return await r.put(`session:${i}`,JSON.stringify({user_id:n.id,user_type:"user",expires_at:c,created_at:Date.now()}),{expirationTtl:720*60*60}),console.log("[User Login] Session created in SESSION_KV for user:",n.id),e.json({success:!0,data:{session_token:i,user:{id:n.id,email:n.email,name:n.name,phone:n.phone,profile_image:n.profile_image}}})}catch(t){return console.error("[User Login] Error:",t),e.json({success:!1,error:t.message||"로그인 중 오류가 발생했습니다"},500)}});d.post("/api/auth/login",S(),async e=>{const{DB:s}=e.env;try{const{username:r,password:t,userType:a}=await e.req.json();if(!r||!t||!a)return e.json({success:!1,error:"아이디와 비밀번호를 입력해주세요"},400);let n,o=a==="admin"?"admins":"sellers";if(n=await s.prepare(`SELECT * FROM ${o} WHERE username = ? OR email = ?`).bind(r,r).first(),!n)return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);const i=a==="admin"&&(r==="admin"||r==="admin@example.com")&&t==="admin123",c=a==="seller"&&(r==="seller1"&&t==="seller123"||r==="seller2"&&t==="seller123"),u=n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${t}`);if(!(i||c||u))return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);if(!n.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(a==="seller"&&n.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다"},403);const p=await pr(e.env.SESSION_KV,n.id,a,{username:n.username,name:n.name,email:n.email,businessName:n.business_name,role:n.role});return await s.prepare(`UPDATE ${o} SET last_login_at = datetime('now') WHERE id = ?`).bind(n.id).run(),e.json({success:!0,data:{sessionToken:p,user:{id:n.id,username:n.username,name:n.name,email:n.email,type:a,businessName:n.business_name,role:n.role}}})}catch(r){return console.error("Login error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/auth/logout",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token");return r&&await e.env.SESSION_KV.delete(`session:${r}`),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/seller/register",S(),async e=>{const{DB:s}=e.env;try{const{email:r,password:t,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!r||!t||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(t.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=r.split("@")[0],u=`placeholder_hash_for_${t}`;try{const l=await s.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,r,u,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:l.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(l){const p=l.message||"";if(p.includes("UNIQUE")||p.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw l}}catch(r){return console.error("Seller registration error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/admin/login",S(),async e=>{const{DB:s}=e.env;try{const{email:r,password:t}=await e.req.json();if(!r||!t)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await s.prepare("SELECT * FROM admins WHERE email = ?").bind(r).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(r==="admin@example.com"&&t==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${t}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=await pr(e.env.SESSION_KV,a.id,"admin",{username:a.username,email:a.email,name:a.name,role:a.role});return await s.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),e.json({success:!0,data:{token:i,admin:{id:a.id,username:a.username,email:a.email,name:a.name,role:a.role}}})}catch(r){return console.error("Admin login error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/auth/verify",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const t=await Pe(e.env.SESSION_KV,r);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=t.user_type==="admin"?"admins":"sellers",n=t.user_type==="admin"?t.admin_id:t.seller_id,o=await s.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:t.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name,role:o.role}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/auth/kakao/sync/callback",async e=>{var r,t,a,n,o,i,c,u,l,p,m,E,f;const{DB:s}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!s);const h=e.req.query("code"),y=e.req.query("state")||"/",w=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!h,state:y,error:w}),w)return console.error("[Kakao Sync] OAuth error:",w),e.redirect(`${y}?error=kakao_oauth_${w}`);if(!h)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${y}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const g=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",O=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",g.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",O),console.log("[Kakao Sync] Step 1: Fetching access token...");const k=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:g,redirect_uri:O,code:h})});if(console.log("[Kakao Sync] Token response status:",k.status),console.log("[Kakao Sync] Token request details:",{client_id:g,redirect_uri:O,code_length:h.length,code_prefix:h.substring(0,20)}),!k.ok){const B=await k.text();return console.error("[Kakao Sync] Token request failed:",B),e.redirect(`${y}?error=token_request_failed&detail=${encodeURIComponent(B)}`)}const L=await k.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!L.access_token,error:L.error,errorDescription:L.error_description}),!L.access_token)return console.error("[Kakao Sync] Token error:",L),e.redirect(`${y}?error=token_failed&detail=${encodeURIComponent(L.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const q=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${L.access_token}`}});console.log("[Kakao Sync] User response status:",q.status);const j=await q.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!j.id,id:j.id,hasNickname:!!((r=j.properties)!=null&&r.nickname||(a=(t=j.kakao_account)==null?void 0:t.profile)!=null&&a.nickname)}),!j.id)return console.error("[Kakao Sync] Failed to get user info:",j),e.redirect(`${y}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const D=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${L.access_token}`}});console.log("[Kakao Sync] Terms response status:",D.status);let R=null;if(D.ok?(R=await D.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=R.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=R.allowed_service_terms)==null?void 0:o.map(B=>B.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!s)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${y}?error=db_not_available`);const N=j.id.toString(),C=((i=j.properties)==null?void 0:i.nickname)||((u=(c=j.kakao_account)==null?void 0:c.profile)==null?void 0:u.nickname)||"Kakao User",H=((l=j.kakao_account)==null?void 0:l.email)||"",J=((p=j.properties)==null?void 0:p.profile_image)||((E=(m=j.kakao_account)==null?void 0:m.profile)==null?void 0:E.profile_image_url)||"",Q=L.access_token,Z=((f=R==null?void 0:R.allowed_service_terms)==null?void 0:f.map(B=>B.tag))||[],Rs=JSON.stringify(Z);console.log("[Kakao Sync] User data:",{kakaoId:N,nickname:C,email:H?"exists":"none",serviceTerms:Z});try{const B=await s.prepare("SELECT * FROM users WHERE kakao_id = ?").bind(N).first();console.log("[Kakao Sync] Existing user check:",!!B);let z;B?(z=B.id,await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(C,H,J,z).run(),console.log("[Kakao Sync] Updated user:",z)):(z=(await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(N,C,H||null,J||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",z)),console.log("[Kakao Sync] User saved successfully, userId:",z),console.log("[Kakao Sync] Step 4: Creating session...");const{SESSION_KV:V}=e.env,ae=crypto.randomUUID(),fr=Date.now()+720*60*60*1e3;await V.put(`session:${ae}`,JSON.stringify({user_id:z,user_type:"user",expires_at:fr,created_at:Date.now()}),{expirationTtl:720*60*60}),console.log("[Kakao Sync] Session created successfully in SESSION_KV"),console.log("[Kakao Sync] Step 5: Redirecting...");const Is=y.includes("?")?`${y}&login=success&session=${ae}&userId=${z}&userName=${encodeURIComponent(C)}`:`${y}?login=success&session=${ae}&userId=${z}&userName=${encodeURIComponent(C)}`;return console.log("[Kakao Sync] Redirect URL:",Is),e.redirect(Is)}catch(B){return console.error("[Kakao Sync] Database error:",B),console.error("[Kakao Sync] DB error details:",{message:B.message,name:B.name}),e.redirect(`${y}?error=database_error&detail=${encodeURIComponent(B.message)}`)}}catch(h){console.error("[Kakao Sync] Exception:",h),console.error("[Kakao Sync] Error details:",{message:h.message,stack:h.stack,name:h.name});const y=e.req.query("state")||"/",w=encodeURIComponent(h.message||"unknown");return e.redirect(`${y}?error=kakao_sync_failed&detail=${w}`)}});d.post("/api/auth/kakao/callback",S(),async e=>{const{DB:s}=e.env;try{const{code:r,redirect_uri:t}=await e.req.json();if(!r)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=t||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow");const n=await gt(r,a,e.env.KAKAO_REST_API_KEY),{user:o,sessionToken:i}=await nr(s,n),c=Date.now()+720*60*60*1e3;return await e.env.SESSION_KV.put(`session:${i}`,JSON.stringify({user_id:o.id,user_type:"user",expires_at:c}),{expirationTtl:720*60*60}),console.log("[Kakao Callback] ✅ Session saved to SESSION_KV for user:",o.id,"- Expires:",new Date(c).toISOString()),e.json({success:!0,data:{session_token:i,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image}}})}catch(r){return console.error("[Kakao Callback] Error:",r),r instanceof X?e.json({success:!1,error:r.message,code:r.code},r.statusCode):e.json({success:!1,error:r.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});d.post("/api/auth/kakao/sync",S(),async e=>{const{DB:s}=e.env;try{const{accessToken:r}=await e.req.json();if(!r)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Sync] Verifying access token");const t=Date.now(),{user:a,sessionToken:n}=await nr(s,r);console.log("[Kakao Sync] ProcessKakaoLogin completed in",Date.now()-t,"ms");const o=Date.now()+720*60*60*1e3,i=Date.now();return await e.env.SESSION_KV.put(`session:${n}`,JSON.stringify({user_id:a.id,user_type:"user",expires_at:o}),{expirationTtl:720*60*60}),console.log("[Kakao Sync] ✅ Session saved to SESSION_KV in",Date.now()-i,"ms"),console.log("[Kakao Sync] Total login time:",Date.now()-t,"ms"),e.json({success:!0,data:{session_token:n,user:{id:a.id,name:a.name,email:a.email,profile_image:a.profile_image}}})}catch(r){return console.error("[Kakao Sync] Error:",r),r instanceof X?e.json({success:!1,error:r.message,code:r.code},r.statusCode):e.json({success:!1,error:r instanceof Error?r.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});d.get("/api/auth/validate",S(),async e=>{var r;const{SESSION_KV:s}=e.env;try{const t=e.req.header("X-Session-Token")||((r=e.req.header("Authorization"))==null?void 0:r.replace("Bearer ",""))||"";if(!t)return e.json({success:!1,error:"No session token provided",code:"NO_TOKEN"},401);const a=await ne(s,t);return a?e.json({success:!0,data:{user_id:a.user_id,user_type:a.user_type,session_valid:!0}}):e.json({success:!1,error:"Session expired or invalid",code:"SESSION_EXPIRED"},401)}catch(t){return console.error("[Auth Validate] Error:",t),e.json({success:!1,error:"Validation failed",code:"VALIDATION_ERROR"},500)}});d.post("/api/auth/kakao/logout",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token")||"";return r&&(await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(r){return console.error("[Kakao Sync] Logout error:",r),e.json({success:!1,error:"Logout failed"},500)}});d.post("/api/auth/kakao/unlink",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await s.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(r).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
      SELECT * FROM users WHERE id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(r).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const n=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),o=await n.json();n.ok?console.log("[Kakao Unlink] Kakao unlink successful:",o.id):console.warn("[Kakao Unlink] Kakao unlink failed:",o)}catch(n){console.error("[Kakao Unlink] Kakao API error:",n)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(r).run(),console.log("[Kakao Unlink] Sessions deleted"),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await s.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(r){return console.error("[Kakao Unlink] Error:",r),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});d.post("/webhooks/kakao/unlink",async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),{user_id:t,referrer_type:a}=r;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:t,referrer_type:a}),!t)return e.json({success:!1,error:"user_id is required"},400);const n=await s.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(t.toString()).first();return n?(console.log("[Kakao Webhook] Deleting user data for user:",n.id),await s.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await s.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",t),e.json({success:!0}))}catch(r){return console.error("[Kakao Webhook] Error:",r),e.json({success:!1,error:"Webhook processing failed"},500)}});d.get("/api/auth/user/verify",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const t=await Pe(e.env.SESSION_KV,r);if(!t||t.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=parseInt(r.split("_")[1]),n=await s.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();return n?e.json({success:!0,data:{user:{id:n.id,name:n.name,email:n.email,profileImage:n.profile_image,phone:n.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/shipping-addresses",S(),K,async e=>{const{DB:s}=e.env,r=e.get("userId");try{const t=await s.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();return e.json({success:!0,data:t.results||[]})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/shipping-addresses/:userId",S(),K,async e=>{const{DB:s}=e.env,r=e.get("userId"),t=parseInt(e.req.param("userId"));try{if(t!==r)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await s.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/shipping-addresses",S(),async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),t=r.user_id,a=r.recipient_name,n=r.phone,o=r.postal_code,i=r.address,c=r.address_detail,u=r.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(r)),!t||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:t,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);u&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(t).run();const l=await s.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a,n,o||"",i,c||"",u?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:l.meta.last_row_id}),e.json({success:!0,data:{id:l.meta.last_row_id}})}catch(r){return console.error("[POST /api/shipping-addresses] Error:",r),e.json({success:!1,error:r.message},500)}});d.put("/api/shipping-addresses/:id",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=await e.req.json(),a=t.user_id,n=t.recipient_name,o=t.phone,i=t.postal_code,c=t.address,u=t.address_detail,l=t.is_default;return l&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await s.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,u||"",l?1:0,r,a).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/shipping-addresses/:id",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=e.req.query("userId");return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r,t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});async function M(e){const s=e.req.header("X-Session-Token");if(!s)return{success:!1,error:"인증 토큰이 없습니다"};const r=await Pe(e.env.SESSION_KV,s);return!r||r.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:r.admin_id,userData:r}}async function v(e){const s=e.req.header("X-Session-Token");if(!s)return{success:!1,error:"인증 토큰이 없습니다"};const r=await Pe(e.env.SESSION_KV,s);return!r||r.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:r.seller_id,userData:r}}d.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));d.get("/api/test/env",async e=>{try{const s=await ct(e.env);return e.json(s)}catch(s){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:s instanceof Error?s.message:String(s)},500)}});d.get("/api/streams",async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const t="streams:live",a=await r.get(t,"json");if(a)return e.json({success:!0,data:a,cached:!0});const n=await s.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();return await r.put(t,JSON.stringify(n.results),{expirationTtl:600}),e.json({success:!0,data:n.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/streams/:id",async e=>{const{DB:s}=e.env,r=e.req.param("id");try{const t=await s.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(r).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"Stream not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/live-streams",async e=>{const{DB:s}=e.env,{status:r,seller_id:t,limit:a="20",offset:n="0"}=e.req.query();try{const o=`live_streams:${r||"all"}:${t||"all"}:${a}:${n}`,i=60,c=is(o);if(c)return console.log("[LiveStreams] ⚡ 메모리 캐시 히트:",o),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStreams] 🔄 백그라운드 갱신 시작:",o);const l=await Cs(s,r,t,a,n);le(o,l,i),console.log("[LiveStreams] ✅ 백그라운드 갱신 완료:",o)}catch(l){console.error("[LiveStreams] ❌ 백그라운드 갱신 실패:",l)}})()),e.json({success:!0,data:c});console.log("[LiveStreams] 💾 DB 조회:",o);const u=await Cs(s,r,t,a,n);return le(o,u,i),e.json({success:!0,data:u})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});async function Cs(e,s,r,t,a){let n=`
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;const o=[];s&&(n+=" AND ls.status = ?",o.push(s)),r&&(n+=" AND ls.seller_id = ?",o.push(r)),n+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',n+=" LIMIT ? OFFSET ?",o.push(parseInt(t),parseInt(a));const{results:i}=await e.prepare(n).bind(...o).all();return i}d.get("/api/live-streams/:id",async e=>{const{DB:s}=e.env,r=e.req.param("id");try{const t=`live_stream:${r}`,a=30,n=is(t);if(n)return console.log("[LiveStream] ⚡ 메모리 캐시 히트:",t),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStream] 🔄 백그라운드 갱신 시작:",t);const i=await Ls(s,r);i&&(le(t,i,a),console.log("[LiveStream] ✅ 백그라운드 갱신 완료:",t))}catch(i){console.error("[LiveStream] ❌ 백그라운드 갱신 실패:",i)}})()),e.json({success:!0,data:n});console.log("[LiveStream] 💾 DB 조회:",t);const o=await Ls(s,r);return o?(le(t,o,a),e.json({success:!0,data:o})):e.json({success:!1,error:"Stream not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});async function Ls(e,s){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first()}d.get("/api/products",async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const t=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${t||"all"}:${a}:${n}`,i=await Ss(r,o);if(i)return e.json({success:!0,data:i,cached:!0});let c;t==="true"?c=`
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
      `;const l=(await s.prepare(c).bind(a,n).all()).results||[];return await bs(r,o,l,300),e.json({success:!0,data:l,cached:!1})}catch(t){return console.error("Products list error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/products/popular",async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const t=await Ss(r,"products:popular");if(t)return e.json({success:!0,data:t,cached:!0});const n=(await s.prepare(`
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
    `).all()).results||[];return await bs(r,"products:popular",n,600),e.json({success:!0,data:n,cached:!1})}catch(t){return console.error("Popular products error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/search/suggestions",async e=>{const{DB:s}=e.env;try{const r=e.req.query("q")||"";if(!r.trim()||r.length<2)return e.json({success:!0,data:{suggestions:[]}});const t=`%${r}%`,a=await s.prepare(`
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
    `).bind(t,t).all(),o=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(n.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:o}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/products/search",async e=>{const{DB:s}=e.env;try{const r=e.req.query("q")||"",t=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!r.trim())return e.json({success:!1,error:"Search query is required"},400);const n=r.trim(),o=`${n}*`;try{if(await s.prepare(`
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
        `).bind(o,t,a).all(),u=await s.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(o).first();return e.json({success:!0,data:{products:c.results||[],total:(u==null?void 0:u.total)||0,query:r,limit:t,offset:a,searchMethod:"fts5"}})}else throw console.log("[Search] ⚠️ FTS5 미사용 - LIKE 검색 fallback"),new Error("FTS5 not available")}catch(i){console.log("[Search] 💾 LIKE 검색 fallback:",i.message);const c=`%${n}%`,u=await s.prepare(`
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
      `).bind(c,c,c,c,c,t,a).all(),l=await s.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(c,c,c,c,c).first();return e.json({success:!0,data:{products:u.results||[],total:(l==null?void 0:l.total)||0,query:r,limit:t,offset:a,searchMethod:"like"}})}}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/products/:id",async e=>{const{DB:s}=e.env,r=e.req.param("id");try{const t=await s.prepare(`
      SELECT 
        p.*,
        COALESCE(s.name, s.username, 'UR Live') as seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ? AND p.is_active = 1
    `).bind(r).first();if(!t)return e.json({success:!1,error:"Product not found"},404);const a=await s.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(r).all();return e.json({success:!0,data:{product:t,options:a.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/products/:id/stock",async e=>{const{DB:s}=e.env,r=e.req.param("id");try{const t=await s.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(r).first();return t?e.json({success:!0,data:{productId:t.id,productName:t.name,stock:t.stock,available:t.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/streams/:streamId/products",async e=>{const{DB:s}=e.env,r=e.req.param("streamId");try{const t=await s.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(r).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/cart",K,async e=>{const{DB:s}=e.env,r=e.get("userId");try{const t=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:`장바구니 조회 실패: ${t.message}`},500)}});d.get("/api/cart/:userId",K,async e=>{const{DB:s}=e.env,r=e.get("userId"),t=e.req.param("userId");try{let a=await s.prepare("SELECT id FROM users WHERE id = ?").bind(r).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(t!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await s.prepare(`
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
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/users",async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),{kakaoId:t,name:a,email:n,phone:o}=r;if(!t||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(t).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await s.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(t,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(r){return console.error("Error creating user:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/cart",async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),{userId:t,kakaoId:a,productId:n,optionId:o,quantity:i,priceSnapshot:c,liveStreamId:u}=r,l=a||t;if(!l)return e.json({success:!1,error:"userId or kakaoId is required"},400);let p=await s.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();if(p||(p=await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()),!p)return e.json({success:!1,error:"User not found"},404);const m=p.id,E=await s.prepare("SELECT stock FROM products WHERE id = ?").bind(n).first();if(!E||E.stock<i)return e.json({success:!1,error:"Insufficient stock"},400);const f=await s.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(m,n,o||null,o||null).first();let h;if(f){const y=f.quantity+i;await s.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(y,c,f.id).run(),h=f.id}else h=(await s.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(m,n,o||null,i,c,u||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:h,isUpdate:!!f}})}catch(r){return console.error("[API /api/cart POST] Error:",r),console.error("[API /api/cart POST] Error message:",r.message),console.error("[API /api/cart POST] Error stack:",r.stack),e.json({success:!1,error:"Failed to add to cart: "+(r.message||"Unknown error")},500)}});d.delete("/api/cart/:cartItemId",async e=>{const{DB:s}=e.env,r=e.req.param("cartItemId");try{return await s.prepare("DELETE FROM cart_items WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/cart/clear/:userId",async e=>{const{DB:s}=e.env,r=e.req.param("userId");try{return await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(r).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/cart/:cartItemId",async e=>{const{DB:s}=e.env,r=e.req.param("cartItemId");try{const t=await e.req.json(),{quantity:a}=t;if(!a||a<1)return e.json({success:!1,error:"Invalid quantity"},400);const n=await s.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(r).first();return n?n.stock<a?e.json({success:!1,error:"Insufficient stock"},400):(await s.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,r).run(),e.json({success:!0})):e.json({success:!1,error:"Cart item not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/orders",async e=>{const{DB:s}=e.env;try{const r=await e.req.json(),{userId:t,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:u,recipientPhone:l,deliveryMemo:p,totalAmount:m,shippingFee:E,orderNumber:f,paymentKey:h,paymentMethod:y}=r;if(o&&o.length>0){const D=[];for(const V of o){const ae=await s.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind(V.productId).first();if(!ae)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${V.productId})`},400);if(ae.stock<V.quantity)return e.json({success:!1,error:`재고 부족: ${ae.name} (남은 재고: ${ae.stock}개)`},400);D.push({product_id:V.productId,option_id:V.optionId||null,quantity:V.quantity,price:V.price,product_name:ae.name,product_stock:ae.stock})}const R=new Date,N=R.getFullYear().toString().slice(-2),C=(R.getMonth()+1).toString().padStart(2,"0"),H=R.getDate().toString().padStart(2,"0"),J=`${N}${C}${H}`,Q=Math.random().toString(36).substring(2,7).toUpperCase(),Z=f||`ORD-${J}-${Q}`,Rs=c?`${i} ${c}`:i,z=(await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(Z,t||null,m||0,"pending","pending",Rs||null,u||null,l||null,p||null,h||null).run()).meta.last_row_id;for(const V of D)await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(z,V.product_id,V.option_id,V.quantity,V.price,V.product_name).run();return e.json({success:!0,data:{orderId:z,orderNumber:Z,totalAmount:m}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const w=a.map(()=>"?").join(","),g=await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${w})
    `).bind(...a).all();if(g.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const D of g.results)if(D.product_stock<D.quantity)return e.json({success:!1,error:`Insufficient stock for ${D.product_name}`},400);const O=g.results.reduce((D,R)=>D+R.price_snapshot*R.quantity,0),k=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,q=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(k,t,O,n.address,n.name,n.phone).run()).meta.last_row_id,j=[];for(const D of g.results){let R=!1,N="";for(let C=0;C<3;C++){if((await s.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND stock >= ?
            AND is_active = 1
        `).bind(D.quantity,D.product_id,D.quantity).run()).meta.changes>0){R=!0;break}const J=await s.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(D.product_id).first();if(!J||J.stock<D.quantity){N=`재고 부족: ${D.product_name} (남은 재고: ${(J==null?void 0:J.stock)||0}개)`;break}C<2?await new Promise(Q=>setTimeout(Q,50*C)):N="주문 처리 중 오류 발생. 다시 시도해주세요. (동시성 충돌)"}if(!R)return e.json({success:!1,error:N||"주문 처리 중 오류가 발생했습니다."},N.includes("재고 부족")?400:409);j.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(q,D.product_id,D.option_id,D.quantity,D.price_snapshot,D.product_name))}j.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${w})`).bind(...a)),await s.batch(j);try{const D=new Set;for(const R of g.results){const N=await s.prepare("SELECT seller_id FROM products WHERE id = ?").bind(R.product_id).first();N&&N.seller_id&&D.add(N.seller_id)}for(const R of D)await oa(s,R,k,buyerName||shippingName||"고객",O)}catch(D){console.error("[Order] Notification error:",D)}return e.json({success:!0,data:{orderId:q,orderNumber:k,totalAmount:O}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/streams/:streamId/current-product",async e=>{const{DB:s,LIVE_CACHE:r}=e.env,t=e.req.param("streamId");try{const a=`current-product:${t}`,n=await or(r,a,3);if(n)return e.json({success:!0,data:n});const o=await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(t).first();if(!o||!o.current_product_id)return await ts(r,a,null,3),e.json({success:!0,data:null});const i=await s.prepare("SELECT * FROM products WHERE id = ?").bind(o.current_product_id).first(),c=await s.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(),u={product:i,options:c.results};return await ts(r,a,u,3),e.json({success:!0,data:u})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:s}=e.env,r=e.req.param("streamId"),t=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${r}`,n=`current-product:${r}`,o=25e3,i=Date.now();for(;Date.now()-i<o;){const c=await s.get(a)||"0";if(c!==t){const u=await or(s,n,30);return e.json({success:!0,timestamp:c,data:u,changed:!0})}await new Promise(u=>setTimeout(u,1e3))}return e.json({success:!0,timestamp:t,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/dashboard/stats",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=r.sellerId,a=e.req.query("period")||"7d";let n=7;a==="30d"?n=30:a==="90d"&&(n=90);const o=await s.prepare(`
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
    `).bind(t,`-${n} days`).all();return e.json({success:!0,data:{period:a,daily:o.results||[],summary:i||{},topProducts:c.results||[]}})}catch(t){return console.error("Error loading seller dashboard stats:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/analytics/products",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=r.sellerId,a=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(t){return console.error("Error loading product analytics:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/streams",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=r.sellerId,a=await s.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(t){return console.error("Error loading seller streams:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/seller/streams",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:t,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:u,seller_instagram:l,seller_youtube:p,seller_facebook:m}=await e.req.json();let E=n,f="youtube",h=null,y=null,w=i;if(o&&!E&&(E=ur(o),!E))if(E=lr(o),h=dr(o),y=ma(o),E)f="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!w&&E&&f==="youtube"&&(w=`https://img.youtube.com/vi/${E}/maxresdefault.jpg`),!t||!E)return e.json({success:!1,error:"Title and live stream URL are required"},400);const g=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a||null,E,u||"scheduled",c||null,r.sellerId,l||null,p||null,m||null,f,h,y,w||null).run(),O=await s.prepare("SELECT * FROM live_streams WHERE id = ?").bind(g.meta.last_row_id).first(),k=await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(r.sellerId).first();try{const{sendLiveStreamCreatedEmail:L}=await Promise.resolve().then(()=>ga);L({streamId:g.meta.last_row_id,title:t,sellerName:(k==null?void 0:k.display_name)||(k==null?void 0:k.username)||"알 수 없음",platform:f,scheduledAt:c,status:u||"scheduled"}).then(q=>{q.success?console.log(`[Email] Live stream notification sent for stream #${q.meta.last_row_id}`):console.error("[Email] Failed to send notification:",q.error)}).catch(q=>{console.error("[Email] Exception while sending notification:",q)})}catch(L){console.error("[Email] Failed to send live stream notification:",L)}return e.json({success:!0,data:O})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:u,status:l,seller_instagram:p,seller_youtube:m,seller_facebook:E}=await e.req.json(),f=[],h=[];if(n!==void 0&&(f.push("title = ?"),h.push(n)),o!==void 0&&(f.push("description = ?"),h.push(o)),c!==void 0||i!==void 0){let y=i,w="youtube",g=null;if(c&&(y=ur(c),!y))if(y=lr(c),g=dr(c),y)w="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);y!==void 0&&(f.push("youtube_video_id = ?"),h.push(y),f.push("platform = ?"),h.push(w),w==="tiktok"&&g&&(f.push("tiktok_username = ?"),h.push(g)))}return l!==void 0&&(f.push("status = ?"),h.push(l)),u!==void 0&&(f.push("scheduled_at = ?"),h.push(u)),p!==void 0&&(f.push("seller_instagram = ?"),h.push(p)),m!==void 0&&(f.push("seller_youtube = ?"),h.push(m)),E!==void 0&&(f.push("seller_facebook = ?"),h.push(E)),f.length===0?e.json({success:!1,error:"No fields to update"},400):(f.push("updated_at = datetime('now')"),await s.prepare(`
      UPDATE live_streams SET ${f.join(", ")} WHERE id = ?
    `).bind(...h,t).run(),e.json({success:!0}))}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first()?(await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(t).run(),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/youtube/create-live",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:t,description:a,scheduled_at:n}=await e.req.json();if(!t)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await ua({accessToken:o},t,a||""),u=(await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t,a||null,i.broadcastId,n||null,r.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await Xe(s,r.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${t} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${u}`),e.json({success:!0,data:{streamId:u,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(t){return console.error("[YouTube Live] Create broadcast error:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("streamId"),a=await s.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const o=a.youtube_broadcast_id||a.youtube_video_id;return o?(await la({accessToken:n},o),await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),await Xe(s,r.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(t){return console.error("[YouTube Live] End broadcast error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("streamId"),a=await s.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=a.youtube_video_id;if(!n)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const o=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!o&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await pa({apiKey:o,accessToken:i},n);return e.json({success:!0,data:{streamId:t,videoId:n,stats:c}})}catch(t){return console.error("[YouTube Live] Get stats error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("streamId"),a=e.req.query("pageToken"),n=await s.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first();if(!n)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=n.youtube_live_chat_id;if(!o)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await da({accessToken:i},o,a);return e.json({success:!0,data:c})}catch(t){return console.error("[YouTube Live] Get chat messages error:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/admin/streams",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{title:t,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!t)return e.json({success:!1,error:"제목은 필수입니다"},400);const u=o||"youtube";if(u==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(u==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const l=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(t,a||null,n||null,u,i||null,c||"scheduled",r.sellerId||null).run();return e.json({success:!0,data:{id:l.meta.last_row_id,title:t,description:a,youtube_video_id:n,platform:u,tiktok_username:i,status:c||"scheduled"}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:u}=await e.req.json();return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,u,t).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1").bind(a,r.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await s.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,t).run();const{LIVE_CACHE:c}=e.env,u=`product-timestamp:${t}`,l=`current-product:${t}`,p=Date.now().toString();return await c.put(u,p),await ts(c,l,{product:o,options:i.results},30),e.json({success:!0,data:{product:o,options:i.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,r=e.req.param("streamId");try{const{productId:t}=await e.req.json(),a=await s.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(t).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await s.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(t).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(t,r).run();const{LIVE_CACHE:o}=e.env,i=`product-timestamp:${r}`,c=`current-product:${r}`,u=Date.now().toString();return await o.put(i,u),await ts(o,c,{product:a,options:n.results},30),e.json({success:!0,data:{product:a,options:n.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/wishlists",S(),async e=>{const{DB:s}=e.env;try{const{userId:r,productId:t}=await e.req.json();if(!r||!t)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await s.prepare("SELECT id FROM users WHERE id = ?").bind(r).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const n=await s.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(t).first();if(!n)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,t).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await s.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(r,t).run();return e.json({success:!0,data:{id:i.meta.last_row_id,userId:r,productId:t,productName:n.name}})}catch(r){return console.error("[Wishlist] Add error:",r),e.json({success:!1,error:r.message},500)}});d.delete("/api/wishlists/:id",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),{userId:t}=e.req.query();return t?await s.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(r,t).first()?(await s.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(r,t).run(),e.json({success:!0,message:"찜 목록에서 삭제되었습니다."})):e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(r){return console.error("[Wishlist] Delete error:",r),e.json({success:!1,error:r.message},500)}});d.delete("/api/wishlists/product/:productId",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("productId"),{userId:t}=e.req.query();return t?(await s.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,r).run()).meta.changes===0?e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!0,message:"찜 목록에서 삭제되었습니다."}):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(r){return console.error("[Wishlist] Delete by product error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/wishlists/:userId",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("userId"),t=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0"),{results:n}=await s.prepare(`
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
    `).bind(r,t,a).all(),o=await s.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(r).first();return e.json({success:!0,data:{items:n,total:(o==null?void 0:o.count)||0,limit:t,offset:a}})}catch(r){return console.error("[Wishlist] Get error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/wishlists/check/:userId/:productId",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("userId"),t=e.req.param("productId"),a=await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,t).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(r){return console.error("[Wishlist] Check error:",r),e.json({success:!1,error:r.message},500)}});d.delete("/api/shipping-addresses/:id",K,async e=>{const{DB:s}=e.env,r=e.req.param("id");e.get("userId");try{return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(r,userId).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/products",async e=>{const{DB:s,CACHE_KV:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const a=`seller:${t.sellerId}:products`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(t.sellerId).all();return await r.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/seller/upload-image",async e=>{var t;const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{image:a,filename:n}=await e.req.json();if(!a)return e.json({success:!1,error:"Image data is required"},400);const o=e.env.IMAGES;if(o){console.log("[Image Upload] Using R2 storage");const i=a.replace(/^data:image\/\w+;base64,/,""),c=Uint8Array.from(atob(i),m=>m.charCodeAt(0)),u=(n==null?void 0:n.split(".").pop())||"jpg",l=`products/${r.sellerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${u}`;await o.put(l,c,{httpMetadata:{contentType:((t=a.match(/^data:(image\/\w+);base64,/))==null?void 0:t[1])||"image/jpeg"}});const p=`/api/images/${l}`;return e.json({success:!0,url:p,storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),a.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:a,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(a){return console.error("[Image Upload] Error:",a),e.json({success:!1,error:a.message},500)}});d.get("/api/images/*",async e=>{var s;try{const r=e.env.IMAGES;if(!r)return e.json({success:!1,error:"R2 not configured"},503);const t=e.req.path.replace("/api/images/",""),a=await r.get(t);return a?new Response(a.body,{headers:{"Content-Type":((s=a.httpMetadata)==null?void 0:s.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"}}):e.notFound()}catch(r){return console.error("[Image Get] Error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/products",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{name:t,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:u,category:l,live_stream_id:p,is_active:m}=await e.req.json();if(!t||!n)return e.json({success:!1,error:"Name and price are required"},400);if(p&&!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(p,r.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const E=await s.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a||null,n,o||null,i||0,c||null,u||0,l||null,p||null,r.sellerId,m!==void 0?m:1).run(),f=await s.prepare("SELECT * FROM products WHERE id = ?").bind(E.meta.last_row_id).first();return await Ts(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0,data:f})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/products/:id",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(t,r.sellerId).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/seller/products/:id",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:u,stock:l,category:p,is_active:m}=await e.req.json(),E=[],f=[];if(n!==void 0&&(E.push("name = ?"),f.push(n)),o!==void 0&&(E.push("description = ?"),f.push(o)),i!==void 0&&(E.push("price = ?"),f.push(i)),c!==void 0&&(E.push("original_price = ?"),f.push(c),i!==void 0&&c)){const y=Math.round((c-i)/c*100);E.push("discount_rate = ?"),f.push(y)}if(u!==void 0&&(E.push("image_url = ?"),f.push(u)),l!==void 0&&(E.push("stock = ?"),f.push(l)),p!==void 0&&(E.push("category = ?"),f.push(p)),m!==void 0&&(E.push("is_active = ?"),f.push(m?1:0)),E.push("updated_at = CURRENT_TIMESTAMP"),f.push(t,r.sellerId),E.length===1)return e.json({success:!1,error:"No fields to update"},400);await s.prepare(`UPDATE products SET ${E.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...f).run();const h=await s.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();return await Ts(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0,data:h})}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/seller/products/:id",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(t).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(t).run(),await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(t).run(),await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(t).run(),await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).run(),await Ts(e.env.CACHE_KV,`seller:${r.sellerId}:products`,`public:seller:${r.sellerId}`),e.json({success:!0}))}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(t).all();return e.json({success:!0,data:n.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id");if(!await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const u=await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(t,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:u.meta.last_row_id,product_id:t,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("productId"),a=e.req.param("optionId");return await s.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(t,r.sellerId).first()?(await s.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,t).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/stats",async e=>{const{DB:s,CACHE_KV:r}=e.env,t=await v(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const a=`seller:${t.sellerId}:stats`,n=await r.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(t.sellerId).first(),i=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(t.sellerId).first(),c=await s.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(t.sellerId).first(),u=await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(t.sellerId).first(),l=await s.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(t.sellerId).first(),m={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:u.count||0,totalRevenue:u.total||0,activeStreams:l.count||0,totalViewers:0};return await r.put(a,JSON.stringify(m),{expirationTtl:60}),e.json({success:!0,data:m})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/stats/sales",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.query("period")||"daily";let a,n,o;switch(t){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await s.prepare(`
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
    `).bind(r.sellerId).all();return e.json({success:!0,data:{period:t,sales:i.results}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/stats/products",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await s.prepare(`
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
    `).bind(r.sellerId,t).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/business-info",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{business_number:t,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:u,phone:l,email:p}=await e.req.json();if(!t||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const m=await s.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();let E;return m?E=await s.prepare(`
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
      `).bind(t,a,n,o,i,c,u,l,p,r.sellerId).run():E=await s.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(r.sellerId,t,a,n,o,i,c,u,l,p).run(),e.json({success:!0,data:{id:m?m.id:E.meta.last_row_id,seller_id:r.sellerId,business_number:t,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(t){return console.error("사업자 정보 등록 오류:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/business-info",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(r.sellerId).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);const t=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(t).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(t).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});d.get("/api/admin/seller-business",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:t.results||[]})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/orders",K,async e=>{const{DB:s}=e.env,r=e.get("userId");try{const t=await s.prepare(`
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
    `).bind(r).all(),a=new Map;for(const o of t.results){const i=o.id;a.has(i)||a.set(i,{id:o.id,user_id:o.user_id,order_number:o.order_number,status:o.status,total_amount:o.total_amount,shipping_fee:o.shipping_fee,payment_method:o.payment_method,payment_key:o.payment_key,shipping_address:o.shipping_address,shipping_name:o.shipping_name,shipping_phone:o.shipping_phone,delivery_request:o.delivery_request,created_at:o.created_at,updated_at:o.updated_at,items:[]}),o.item_id&&a.get(i).items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value})}const n=Array.from(a.values());return e.json({success:!0,data:n})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/orders/user/:userId",K,async e=>{const{DB:s}=e.env,r=e.get("userId"),t=parseInt(e.req.param("userId"));try{if(t!==r)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await s.prepare(`
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
    `).bind(r).all(),n=new Map;for(const i of a.results){const c=i.id;n.has(c)||n.set(c,{id:i.id,user_id:i.user_id,order_number:i.order_number,status:i.status,total_amount:i.total_amount,shipping_fee:i.shipping_fee,payment_method:i.payment_method,payment_key:i.payment_key,shipping_address:i.shipping_address,shipping_name:i.shipping_name,shipping_phone:i.shipping_phone,delivery_request:i.delivery_request,created_at:i.created_at,updated_at:i.updated_at,items:[]}),i.item_id&&n.get(c).items.push({id:i.item_id,product_id:i.product_id,option_id:i.option_id,quantity:i.quantity,price:i.item_price,product_name:i.product_name,image_url:i.image_url,option_value:i.option_value})}const o=Array.from(n.values());return e.json({success:!0,data:o})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/orders/:orderNumber",async e=>{const{DB:s}=e.env,r=e.req.param("orderNumber");try{const t=await s.prepare(`
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
    `).bind(r).all();if(t.results.length===0)return e.json({success:!1,error:"Order not found"},404);const a=t.results[0],n={id:a.id,user_id:a.user_id,order_number:a.order_number,status:a.status,total_amount:a.total_amount,shipping_fee:a.shipping_fee,payment_method:a.payment_method,payment_key:a.payment_key,shipping_address:a.shipping_address,shipping_name:a.shipping_name,shipping_phone:a.shipping_phone,delivery_request:a.delivery_request,created_at:a.created_at,updated_at:a.updated_at,items:[]};for(const o of t.results)o.item_id&&n.items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value});return e.json({success:!0,data:n})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/orders/:orderId/cancel",async e=>{const{DB:s}=e.env,r=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await s.prepare("SELECT * FROM orders WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(r).all();for(const i of o.results)await s.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.quantity,i.product_id).run();return await s.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,r).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:r,reason:a,itemsRestored:o.results.length}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:s}=e.env;try{const r=e.req.param("streamId"),t=await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();return t?e.json({success:!0,data:{viewer_count:t.viewer_count||0}}):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/streams/:streamId/viewer-count",async e=>{const{DB:s}=e.env,r=await M(e),t=r.success?{success:!1}:await v(e);if(!r.success&&!t.success)return e.json({success:!1,error:"Unauthorized"},401);try{const a=e.req.param("streamId"),{viewer_count:n}=await e.req.json();return typeof n!="number"||n<0?e.json({success:!1,error:"Invalid viewer count"},400):t.success&&!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a,t.sellerId).first()?e.json({success:!1,error:"Stream not found or unauthorized"},404):(await s.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{viewer_count:n}}))}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/streams/:streamId/view",async e=>{const{DB:s}=e.env;try{const r=e.req.param("streamId");await s.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(r).run();const t=await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(r).first();return e.json({success:!0,data:{viewer_count:(t==null?void 0:t.viewer_count)||0}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/payments/confirm",async e=>{var t;const{DB:s}=e.env;let r=null;try{r=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=r;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!n,amount:!!o}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await s.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",n),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:n},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(o)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(o),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(o),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const u="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const l={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(l,null,2)),console.log("[Payment] 📊 amount 타입:",typeof l.amount),console.log("[Payment] 📊 amount 값:",l.amount);const p=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:u,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(l)}),m=await p.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",p.status),console.log("  - 응답 OK?:",p.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(m).substring(0,300)),!p.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",p.status),console.error("[Payment] 에러 코드:",m.code),console.error("[Payment] 에러 메시지:",m.message),console.error("[Payment] 전체 응답:",JSON.stringify(m,null,2)),e.json({success:!1,error:m.message||"결제 승인에 실패했습니다.",code:m.code,tossError:m},p.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await s.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const E=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();for(const f of E.results)(await s.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(f.quantity,f.product_id,f.quantity).run()).meta.changes===0&&console.error(`[Payment] ⚠️ 재고 부족: product_id=${f.product_id}`);console.log("[Payment] ✅ 재고 차감 완료");try{const f=i.id,h=await Ut(e.env,f);h.success?console.log(`[Payment] ✅ 알림톡 발송 성공 (주문 ${f})`):console.warn(`[Payment] ⚠️ 알림톡 발송 실패 (주문 ${f}):`,h.reason||h.error)}catch(f){console.error("[Payment] ⚠️ 알림톡 발송 중 오류:",f)}}catch(E){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",E)}return e.json({success:!0,data:m})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:r==null?void 0:r.orderId,error:a.message,stack:(t=a.stack)==null?void 0:t.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});d.post("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,r=e.req.param("liveStreamId");try{const t=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:u}=t;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await s.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(r,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const l=["씨발","개새끼","병신","좆","시발"];let p=i;l.forEach(E=>{const f=new RegExp(E,"gi");p=p.replace(f,"*".repeat(E.length))});const m=await s.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,n,o||null,p,c?1:0,u?1:0).run();return e.json({success:!0,data:{id:m.meta.last_row_id,message:p}})}catch(t){return console.error("Error sending chat message:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,r=e.req.param("liveStreamId"),t=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
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
    `;const o=[r];t&&(n+=" AND id > ?",o.push(Number(t))),n+=" ORDER BY created_at DESC LIMIT ?",o.push(a);const c=(await s.prepare(n).bind(...o).all()).results.reverse();return e.json({success:!0,data:c})}catch(n){return console.error("Error fetching chat messages:",n),e.json({success:!1,error:n.message},500)}});d.delete("/api/chat/:liveStreamId/messages/:messageId",S(),async e=>{const{DB:s}=e.env,r=e.req.param("messageId");try{return await s.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(t){return console.error("Error deleting chat message:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/chat/:liveStreamId/ban",S(),async e=>{const{DB:s}=e.env,r=e.req.param("liveStreamId");try{const t=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=t;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const u=new Date;u.setMinutes(u.getMinutes()+i),c=u.toISOString()}return await s.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(r,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(t){return console.error("Error banning user:",t),e.json({success:!1,error:t.message},500)}});d.delete("/api/chat/:liveStreamId/ban/:userId",S(),async e=>{const{DB:s}=e.env,r=e.req.param("liveStreamId"),t=e.req.param("userId");try{return await s.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(r,t).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});d.post("/api/payments/webhook",async e=>{const{DB:s}=e.env;try{const r=await e.req.json();switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:r.eventType,orderId:r.orderId,status:r.status,timestamp:new Date().toISOString()}),r.eventType){case"PAYMENT_STATUS_CHANGED":await _a(s,r);break;case"VIRTUAL_ACCOUNT_ISSUED":await fa(s,r);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",r.eventType)}return e.json({success:!0})}catch(r){return console.error("[Webhook] ❌ 웹훅 처리 실패:",r.message),e.json({success:!1,error:r.message},500)}});async function _a(e,s){const{orderId:r,status:t,paymentKey:a}=s;console.log("[Webhook] 결제 상태 변경:",{orderId:r,status:t}),await e.prepare(`
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
    `).bind(r).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",r))}async function fa(e,s){const{orderId:r,virtualAccount:t}=s;console.log("[Webhook] 가상계좌 발급:",{orderId:r,bank:t==null?void 0:t.bank,accountNumber:t==null?void 0:t.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(t==null?void 0:t.bank,t==null?void 0:t.accountNumber,t==null?void 0:t.customerName,t==null?void 0:t.dueDate,JSON.stringify(s),r).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",r)}d.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:s}=e.env;try{const r=e.req.param("paymentKey"),t=await e.req.json(),{cancelReason:a,cancelAmount:n}=t;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:r,cancelReason:a,cancelAmount:n}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const o=await s.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(r).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const u=na(i,c),l=n&&n<o.amount,p=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:r,cancelAmount:p,isPartial:l});const m=await u.cancelPayment({paymentKey:r,cancelReason:a,cancelAmount:p});return m.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:r,cancelAmount:p,canceledAt:m.canceledAt}),await s.prepare(`
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
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${r}`),e.json({success:!0,data:{paymentKey:r,orderId:o.order_id,cancelAmount:p,canceledAt:m.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,m.error),e.json({success:!1,error:m.error||"결제 취소에 실패했습니다."},400))}catch(r){return console.error("[Payment] ❌ 결제 취소 처리 실패:",r.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});d.get("/api/payments/:paymentKey",async e=>{const{DB:s}=e.env;try{const r=e.req.param("paymentKey"),t=await s.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(r).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404)}catch(r){return console.error("[Payment] ❌ 결제 조회 실패:",r.message),e.json({success:!1,error:"결제 조회 중 오류가 발생했습니다."},500)}});d.get("/api/payments/order/:orderId",async e=>{const{DB:s}=e.env;try{const r=e.req.param("orderId"),t=await s.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(r).all();return e.json({success:!0,data:t.results||[]})}catch(r){return console.error("[Payment] ❌ 결제 목록 조회 실패:",r.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});d.get("/api/seller/orders",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
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
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(r.sellerId).all(),a=new Map;for(const o of t.results){const i=o.id;a.has(i)||a.set(i,{id:o.id,user_id:o.user_id,user_name:o.user_name,order_number:o.order_number,status:o.status,total_amount:o.total_amount,shipping_fee:o.shipping_fee,payment_method:o.payment_method,payment_key:o.payment_key,shipping_address:o.shipping_address,shipping_name:o.shipping_name,shipping_phone:o.shipping_phone,delivery_request:o.delivery_request,created_at:o.created_at,updated_at:o.updated_at,items:[]}),o.item_id&&a.get(i).items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,seller_id:o.seller_id,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value})}const n=Array.from(a.values());return e.json({success:!0,data:n})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/orders/export",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.query("format")||"csv",a=e.req.query("start_date"),n=e.req.query("end_date");let o=`
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
    `;const i=[r.sellerId];a&&(o+=" AND date(o.created_at) >= ?",i.push(a)),n&&(o+=" AND date(o.created_at) <= ?",i.push(n)),o+=" GROUP BY o.id ORDER BY o.created_at DESC";const c=await s.prepare(o).bind(...i).all();if(t==="csv"){const u=["주문번호","주문일시","주문상태","결제상태","주문금액","배송지","수령인","연락처","택배사","운송장번호","구매자명","구매자이메일","구매자연락처"],l=c.results.map(h=>[h.order_number||"",h.created_at?new Date(h.created_at).toLocaleString("ko-KR"):"",h.status||"",h.payment_status||"",h.total_amount||0,h.shipping_address||"",h.shipping_name||"",h.shipping_phone||"",h.carrier||"",h.tracking_number||"",h.buyer_name||"",h.buyer_email||"",h.buyer_phone||""]),m="\uFEFF"+[u.join(","),...l.map(h=>h.map(y=>{const w=String(y);return w.includes(",")||w.includes(`
`)||w.includes('"')?`"${w.replace(/"/g,'""')}"`:w}).join(","))].join(`
`),E=new Date,f=`orders_${E.toISOString().split("T")[0]}_${E.getTime()}.csv`;return new Response(m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${encodeURIComponent(f)}"`,"Cache-Control":"no-cache"}})}else return e.json({success:!1,error:"Unsupported format"},400)}catch(t){return console.error("Export error:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(t).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,r.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,t).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${t}, 자동 발행 시작...`);const c=await s.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(t).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const u=await s.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(r.sellerId).first();if(!u)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${r.sellerId}`),await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(t,r.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${t}`);const l=await s.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),p=Number(c.total_amount),m=Math.floor(p/1.1),E=p-m,f=new Date().toISOString().split("T")[0].replace(/-/g,""),h=Math.random().toString(36).substring(2,8).toUpperCase(),y=`${f}-${h}`,g=(await s.prepare(`
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
            `).bind(r.sellerId,t,y,u.business_number,u.business_name,u.ceo_name,u.address||"",u.business_type||"",u.business_category||"",u.email||"",u.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",m,E,p,`AUTO-${Date.now()}-${h}`).run()).meta.last_row_id;for(const O of l.results){const k=Math.floor(Number(O.price)*Number(O.quantity)/1.1),L=Number(O.price)*Number(O.quantity)-k;await s.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(g,O.product_name||"상품명 없음",O.quantity,O.price,k,L,O.option_name||"").run()}await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(t,r.sellerId,g).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${g}, invoice_number=${y}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${t}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await s.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(t,r.sellerId,c.message).run()}catch(u){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",u)}}try{const c=await s.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(t).first();if(c&&c.user_id){const l={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];l&&await cr(s,c.user_id,t,l)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(t).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,r.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await s.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,t).run();try{const c=await s.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(t).first();c&&c.user_id&&await cr(s,c.user_id,t,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/orders/:orderNumber/refund",async e=>{const{DB:s}=e.env,r=e.req.param("orderNumber"),{reason:t}=await e.req.json();try{const a=await s.prepare("SELECT * FROM orders WHERE order_number = ?").bind(r).first();return a?["paid","preparing","shipped","delivered"].includes(a.status)?a.status==="refunded"||a.status==="cancelled"?e.json({success:!1,error:"이미 환불 또는 취소된 주문입니다."},400):(await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded",r).run(),e.json({success:!0,message:"환불 요청이 접수되었습니다. 고객센터(0507-0177-0432)에서 처리 예정입니다.",requiresManualProcessing:!0})):e.json({success:!1,error:"환불이 불가능한 주문 상태입니다."},400):e.json({success:!1,error:"Order not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/admin/orders",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/sellers",async e=>{const{DB:s}=e.env,{limit:r="20",offset:t="0"}=e.req.query();try{const a=`
      SELECT id, business_name, name as display_name, 
             commission_rate, created_at
      FROM sellers 
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,{results:n}=await s.prepare(a).bind(parseInt(r),parseInt(t)).all();return e.json({success:!0,data:n})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});d.get("/api/admin/sellers",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/admin/sellers",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{username:t,password:a,name:n,email:o,phone:i,business_name:c,business_number:u}=await e.req.json();if(!t||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await s.prepare("SELECT id FROM sellers WHERE username = ?").bind(t).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await s.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const m=`$2a$10$placeholder_hash_for_${a}`,E=await s.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(t,m,n,o,i||null,c,u||null,r.adminId).run();return e.json({success:!0,data:{id:E.meta.last_row_id,username:t,name:n,email:o,business_name:c}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.put("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:u,status:l}=await e.req.json();return await s.prepare("SELECT id FROM sellers WHERE id = ?").bind(t).first()?(await s.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,u,l,t).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.delete("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(t).first();return a?(await s.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(t).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(t).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await s.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,t).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(t).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(t){return e.json({success:!1,error:t.message},500)}});d.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await s.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(t).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await s.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,t).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${t}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:t,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(t){return console.error("수수료율 변경 실패:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(t).first();return a?a.status==="approved"?e.json({success:!1,error:"이미 승인된 판매자입니다"},400):(await s.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(r.adminId,t).run(),console.log(`셀러 승인: ${a.username} (ID: ${t}) by Admin ID: ${r.adminId}`),e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:t,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 승인 실패:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(t).first();return n?n.status==="rejected"?e.json({success:!1,error:"이미 거부된 판매자입니다"},400):(await s.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,r.adminId,t).run(),console.log(`셀러 거부: ${n.username} (ID: ${t}), 사유: ${a}`),e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:t,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 거부 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/sellers/pending",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:t.results,count:t.results.length})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/public/seller/:sellerId",async e=>{const{DB:s,CACHE_KV:r}=e.env;try{const t=e.req.param("sellerId"),a=`public:seller:${t}`,n=await Ss(r,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare(`
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
    `).bind(t).all(),u=await s.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(t).all(),l=await s.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(t).first(),p={profile:o,live_streams:i.results,scheduled_streams:c.results,products:u.results,stats:l};return await bs(r,a,p,60),e.json({success:!0,data:p})}catch(t){return console.error("셀러 프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/public/seller/username/:username",async e=>{const{DB:s}=e.env;try{const r=e.req.param("username"),t=await s.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(r).first();return t?e.json({success:!0,data:{seller_id:t.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 조회 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/admin/settlement/stats",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{period:t}=e.req.query();let a="";const n=new Date;switch(t){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await s.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:t||"all"}})}catch(t){return console.error("정산 통계 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/settlement/records",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{seller_id:t,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];t&&(o.push("o.seller_id = ?"),i.push(t)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const p=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${p}'`);break;case"week":const m=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${m}'`);break;case"month":const E=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${E}'`);break}const u=o.length>0?`WHERE ${o.join(" AND ")}`:"",l=await s.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:l.results})}catch(t){return console.error("정산 내역 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await s.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(t).first();return n?(await s.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,t).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:t,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(t){return console.error("정산 상태 변경 실패:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/admin/settlement/batch-complete",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{order_ids:t}=await e.req.json();if(!Array.isArray(t)||t.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of t)try{await s.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:t.length,success:a,failed:n}})}catch(t){return console.error("일괄 정산 처리 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/settlement/export-csv",async e=>{const{DB:s}=e.env,r=await M(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{seller_id:t,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];t&&(n.push("o.seller_id = ?"),o.push(t));const i=new Date;switch(a){case"today":const f=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${f}'`);break;case"week":const h=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${h}'`);break;case"month":const y=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${y}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",l=(await s.prepare(`
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
    `).bind(...o).all()).results;if(l.length===0)return e.json({success:!1,error:"데이터가 없습니다"},404);const p=Object.keys(l[0]);let m=p.join(",")+`
`;l.forEach(f=>{const h=p.map(y=>{const w=f[y];if(w==null)return"";const g=String(w);return g.includes(",")||g.includes('"')||g.includes(`
`)?`"${g.replace(/"/g,'""')}"`:g});m+=h.join(",")+`
`});const E="\uFEFF";return new Response(E+m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(t){return console.error("CSV 내보내기 실패:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/orders/create",async e=>{const{DB:s}=e.env;try{const{userId:r,cartItems:t,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:u,buyerCeoName:l}=await e.req.json();console.log("주문 생성 요청:",{userId:r,cartItems:t==null?void 0:t.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let p=10;if(o){const R=await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();R&&R.commission_rate!==null&&(p=R.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:p});const m=Math.floor(a*(p/100)),E=a-m;let f=null;if(n){const R=await s.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(n,r).first();if(!R)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);f=R}if(!r)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const h=r,y=new Date,w=y.getFullYear().toString().slice(-2),g=(y.getMonth()+1).toString().padStart(2,"0"),O=y.getDate().toString().padStart(2,"0"),k=`${w}${g}${O}`,L=Math.random().toString(36).substring(2,7).toUpperCase(),q=`ORD-${k}-${L}`;for(const R of t){const N=await s.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(R.product_id).first();if(!N)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${R.product_id})`},400);if(N.stock<R.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${R.product_id})`},400)}const D=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(q,h,a,"pending",o||null,p,m,E,n||null,(f==null?void 0:f.recipient_name)||null,(f==null?void 0:f.phone)||null,f!=null&&f.address?`${f.address} ${f.address_detail}`:null,(f==null?void 0:f.postal_code)||null,i?1:0,c||null,u||null,l||null).run()).meta.last_row_id;for(const R of t){await s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(D,R.product_id,R.option_id||null,R.quantity,R.price_snapshot||R.price).run(),await s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(R.quantity,R.product_id).run();try{const N=await s.prepare(`
          SELECT id, name, stock, stock_alert_threshold, seller_id 
          FROM products 
          WHERE id = ?
        `).bind(R.product_id).first();if(N){const C=N.stock_alert_threshold||5,H=N.stock;H<=C&&N.seller_id&&(await ia(s,N.seller_id,N.name,H,C),console.log(`[Low Stock Alert] ${N.name}: ${H} <= ${C}`))}}catch(N){console.error("[Low Stock Alert] Error:",N)}}return console.log("주문 생성 완료:",{orderId:D,orderNumber:q}),e.json({success:!0,orderId:D,orderNumber:q,totalAmount:a})}catch(r){return console.error("주문 생성 실패:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/orders/:orderNumber/refund",S(),async e=>{const{DB:s}=e.env;try{const r=e.req.param("orderNumber"),{reason:t}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:r,reason:t});const a=await s.prepare(`
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
    `).bind(a.id).all();for(const o of n.results)await s.prepare(`
        UPDATE products 
        SET stock = stock + ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(o.quantity,o.product_id).run(),console.log("[Order Refund] 재고 복구:",{productId:o.product_id,quantity:o.quantity});return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:r,reason:t}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:r,cancelDate:new Date().toISOString()}})}catch(r){return console.error("[Order Refund] Error:",r),e.json({success:!1,error:r.message||"주문 취소 중 오류가 발생했습니다"},500)}});d.get("/api/seller/sales",S(),async e=>{try{const{DB:s}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const t=await Pe(e.env.SESSION_KV,r);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(t.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=t.seller_id||t.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await s.prepare(`
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
    `).bind(a,i,c).first(),p=await s.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:u,stats:l,orders:(p==null?void 0:p.results)||[]}})}catch(s){return console.error("Seller sales query error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/settlement-csv",S(),async e=>{try{const{DB:s}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const t=await Pe(e.env.SESSION_KV,r);if(!t)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(t.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=t.seller_id||t.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await s.prepare(`
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
`;for(const p of(u==null?void 0:u.results)||[]){const m=p.status==="delivered"?"배송완료":p.status==="shipped"?"배송중":p.status==="preparing"?"상품준비중":p.status==="paid"?"결제완료":"대기중",E=p.buyer_business_name||"-",f=p.buyer_business_number||"-",h=p.invoice_number||"-",y=p.issue_date||"-",w=p.tax_invoice_status==="issued"?"발행완료":p.tax_invoice_status==="cancelled"?"취소":"-",g=p.nts_confirm_number||"-";l+=`${p.order_number},${p.created_at},${p.user_name||"익명"},${p.total_amount},${p.commission_amount},${p.seller_amount},${m},${E},${f},${h},${y},${w},${g}
`}return new Response(l,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(s){return console.error("CSV download error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/tax-invoices/issue",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{order_number:t}=await e.req.json();if(!t)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await s.prepare(`
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
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),u=i-c,l=new Date().toISOString().split("T")[0],p=`${l}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,m=mt(n,a,o.results);let E,f,h;try{E=await pt(m),f=E.ntsConfirmNumber,h=E.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:f,invoiceKey:h,mockMode:Fe()})}catch(g){console.error("바로빌 API 호출 실패:",g),f="FAILED",h=null}const w=(await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r.sellerId,t,"tax",p,l,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,u,i,f==="FAILED"?"failed":"issued",Fe()?"mock":"barobill",h,f).run()).meta.last_row_id;for(const g of o.results){const O=Math.floor(Number(g.price)*Number(g.quantity)/1.1),k=Number(g.price)*Number(g.quantity)-O;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(w,g.id,g.product_name,g.quantity,g.price,O,k).run()}return e.json({success:!0,data:{invoice_id:w,invoice_number:p,issue_date:l,total_amount:i,supply_price:c,tax_amount:u,status:f==="FAILED"?"failed":"issued",nts_confirm_number:f,api_invoice_key:h,mock_mode:Fe(),message:f==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":Fe()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(t){return console.error("세금계산서 발행 오류:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/tax-invoices",async e=>{var t;const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[r.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const u=await s.prepare(i).bind(...c).all();return e.json({success:!0,data:u.results||[],total:((t=u.results)==null?void 0:t.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/tax-invoices/:id",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),a=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(t,r.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await s.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(t).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("id"),{reason:a}=await e.req.json(),n=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(t,r.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!Fe()){const u=await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(r.sellerId).first();u&&u.business_number&&await dt(u.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(u){console.error("바로빌 취소 API 호출 실패:",u)}return await s.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(t).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(t){return e.json({success:!1,error:t.message},500)}});d.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const{status:t,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[r.sellerId];t&&(n+=" AND log.status = ?",o.push(t)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await s.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(t){return e.json({success:!1,error:t.message},500)}});d.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:s}=e.env,r=await v(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const t=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${t}`);const a=await s.prepare(`
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
    `).bind(o.id).all(),u=Number(o.total_amount),l=Math.floor(u/1.1),p=u-l,m=new Date().toISOString().split("T")[0].replace(/-/g,""),E=Math.random().toString(36).substring(2,8).toUpperCase(),f=`${m}-${E}`,y=(await s.prepare(`
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
    `).bind(r.sellerId,t,f,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",l,p,u,`RETRY-${Date.now()}-${E}`).run()).meta.last_row_id;for(const w of c.results){const g=Math.floor(Number(w.price)*Number(w.quantity)/1.1),O=Number(w.price)*Number(w.quantity)-g;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(y,w.product_name||"상품명 없음",w.quantity,w.price,g,O,w.option_name||"").run()}return await s.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(t,r.sellerId,y,n+1).run(),await s.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${y}, retry_count=${n+1}`),e.json({success:!0,data:{invoice_id:y,invoice_number:f,retry_count:n+1}})}catch(t){console.error("[TAX INVOICE RETRY] 재시도 실패:",t);try{const a=e.req.param("orderNumber"),n=await s.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,r.sellerId).first(),o=Number((n==null?void 0:n.retry_count)||0);await s.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,r.sellerId,t.message,o+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:t.message},500)}});d.get("/live/:id",async e=>{try{const s=new URL("/static/live.html",e.req.url);let t=await(await fetch(s.toString())).text();const n=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return t=t.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${n}`),console.log("[Live Page] Environment variables injected"),new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving live page:",s),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/cart",async e=>{try{const s=new URL("/static/cart.html",e.req.url);let t=await(await fetch(s.toString())).text();return t=t.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),t=t.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving cart page:",s),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/my-orders",async e=>{try{const s=new URL("/static/my-orders.html",e.req.url),t=await(await fetch(s.toString())).text();return new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving my orders page:",s),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/payment-result",async e=>{try{const s=new URL("/payment-result.html",e.req.url),t=await(await fetch(s.toString())).text();return new Response(t,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(s){return console.error("Error serving payment result page:",s),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/api/seller/profile",async e=>{const{DB:s}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const t=await s.prepare(`
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
    `).bind(t.seller_id).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404)}catch(t){return console.error("프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.patch("/api/seller/profile",async e=>{const{DB:s}=e.env,r=e.req.header("X-Session-Token");if(!r)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const t=await s.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(r).first();if(!t||!t.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:u,website_url:l,kakao_chat_link:p}=await e.req.json(),m=[],E=[];if(a!==void 0&&(m.push("profile_image = ?"),E.push(a)),n!==void 0&&(m.push("bio = ?"),E.push(n)),o!==void 0&&(m.push("sns_instagram = ?"),E.push(o)),i!==void 0&&(m.push("sns_youtube = ?"),E.push(i)),c!==void 0&&(m.push("sns_facebook = ?"),E.push(c)),u!==void 0&&(m.push("sns_twitter = ?"),E.push(u)),l!==void 0&&(m.push("website_url = ?"),E.push(l)),p!==void 0&&(m.push("kakao_chat_link = ?"),E.push(p)),m.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);m.push("updated_at = datetime('now')"),E.push(t.seller_id),await s.prepare(`
      UPDATE sellers 
      SET ${m.join(", ")}
      WHERE id = ?
    `).bind(...E).run();const f=await s.prepare(`
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
    `).bind(t.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:f})}catch(t){return console.error("프로필 업데이트 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/public/:sellerId",async e=>{const{DB:s}=e.env,r=e.req.param("sellerId");try{const t=await s.prepare(`
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
    `).bind(r).first();return t?e.json({success:!0,data:t}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 프로필 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/:sellerId/streams",async e=>{const{DB:s}=e.env,r=e.req.param("sellerId");try{const t=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:t.results})}catch(t){return console.error("라이브 목록 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/:sellerId/products-public",async e=>{const{DB:s}=e.env,r=e.req.param("sellerId");try{const t=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:t.results})}catch(t){return console.error("상품 목록 조회 실패:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/notifications",K,async e=>{const{DB:s}=e.env;try{const r=e.get("userId"),t=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),n=e.req.query("unread_only")==="true";let o=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;n&&(o+=" AND is_read = 0"),o+=" ORDER BY created_at DESC LIMIT ?";const i=await s.prepare(o).bind(r,t,a).all();return e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/notifications/unread-count",K,async e=>{const{DB:s}=e.env;try{const r=e.get("userId"),t=e.get("userType"),a=await s.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r,t).first();return e.json({success:!0,count:(a==null?void 0:a.count)||0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/notifications/:id/read",K,async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=e.get("userId"),a=e.get("userType");return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r,t,a).first()?(await s.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/notifications/read-all",K,async e=>{const{DB:s}=e.env;try{const r=e.get("userId"),t=e.get("userType");return await s.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(r,t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/notifications/:id",K,async e=>{const{DB:s}=e.env;try{const r=e.req.param("id"),t=e.get("userId"),a=e.get("userType");return await s.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(r,t,a).first()?(await s.prepare("DELETE FROM notifications WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/banners",async e=>{const{DB:s}=e.env;try{const r=new Date().toISOString(),t=await s.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(r,r).all();return e.json({success:!0,data:t.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/admin/banners",K,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=await s.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();return e.json({success:!0,data:t.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/admin/banners",K,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:t,image_url:a,link_url:n,description:o,is_active:i,display_order:c,start_date:u,end_date:l}=await e.req.json();if(!t||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const p=await s.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a,n||null,o||null,i!==!1?1:0,c||0,u||null,l||null).run();return e.json({success:!0,id:p.meta.last_row_id})}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/admin/banners/:id",K,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=e.req.param("id"),{title:a,image_url:n,link_url:o,description:i,is_active:c,display_order:u,start_date:l,end_date:p}=await e.req.json();return await s.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,n,o||null,i||null,c?1:0,u||0,l||null,p||null,t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/admin/banners/:id",K,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const t=e.req.param("id");return await s.prepare("DELETE FROM banners WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/order-complete",e=>e.redirect("/order-complete.html",302));d.notFound(e=>{const s=e.req.path;return s.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${s} was not found.`},404):new Response(null,{status:404})});d.onError((e,s)=>{const r=s.req.path;if(console.error("[Global Error Handler]",{path:r,method:s.req.method,error:e.message,stack:e.stack}),r.startsWith("/api/")){let t=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(t=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(t=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(t=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(t=400,a="잘못된 요청입니다."),s.json({success:!1,error:e.message||a},t)}return s.html(`
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
  `,500)});d.get("/api/admin/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const r=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:r.results})}catch(r){return console.error("[Admin Alimtalk Pricing] Error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/admin/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const{plan_name:r,min_quantity:t,max_quantity:a,unit_price:n}=await e.req.json();if(!r||!t||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await s.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(r,t,a||null,n).run();return e.json({success:!0,pricing_id:o.meta.last_row_id})}catch(r){return console.error("[Admin Alimtalk Pricing Create] Error:",r),e.json({success:!1,error:r.message},500)}});d.put("/api/admin/alimtalk/pricing/:id",S(),async e=>{const{env:s}=e,r=e.req.param("id");try{const{plan_name:t,min_quantity:a,max_quantity:n,unit_price:o,is_active:i}=await e.req.json();return(await s.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t,a,n||null,o,i?1:0,r).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing updated successfully"})}catch(t){return console.error("[Admin Alimtalk Pricing Update] Error:",t),e.json({success:!1,error:t.message},500)}});d.delete("/api/admin/alimtalk/pricing/:id",S(),async e=>{const{env:s}=e,r=e.req.param("id");try{return(await s.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(r).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing deleted successfully"})}catch(t){return console.error("[Admin Alimtalk Pricing Delete] Error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/alimtalk/accounts",S(),async e=>{const{env:s}=e;try{const r=await s.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();return e.json({success:!0,accounts:r.results})}catch(r){return console.error("[Admin Alimtalk Accounts] Error:",r),e.json({success:!1,error:r.message},500)}});d.patch("/api/admin/alimtalk/accounts/:id/status",S(),async e=>{const{env:s}=e,r=e.req.param("id");try{const{status:t}=await e.req.json();return["active","suspended","rejected"].includes(t)?(await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(t,r).run()).meta.changes===0?e.json({success:!1,error:"Account not found"},404):e.json({success:!0,message:`Account ${t} successfully`}):e.json({success:!1,error:"Invalid status"},400)}catch(t){return console.error("[Admin Alimtalk Account Status] Error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/admin/alimtalk/statistics",S(),async e=>{const{env:s}=e;try{const{start_date:r,end_date:t}=e.req.query(),a=await s.DB.prepare(`
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
    `).bind(r||"2000-01-01",t||"2100-01-01").all();return e.json({success:!0,statistics:{total:a,by_seller:n.results}})}catch(r){return console.error("[Admin Alimtalk Statistics] Error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/alimtalk/account",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await ne(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(t.user_id).first();return e.json({success:!0,account:a})}catch(r){return console.error("[Seller Alimtalk Account] Error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/alimtalk/register",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await ne(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{channel_id:a,phone_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=ir(n),i=await At(s,{channelId:a,phoneNumber:o});if(!i.success)return e.json({success:!1,error:"Failed to register Kakao channel"},500);const c=await s.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(t.user_id,a,a,i.senderKey,o).run();return e.json({success:!0,account_id:c.meta.last_row_id,sender_key:i.senderKey,message:"Kakao channel registered successfully"})}catch(r){return console.error("[Seller Alimtalk Register] Error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await ne(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!a)return e.json({success:!1,error:"Alimtalk account not found"},404);const n=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();return e.json({success:!0,templates:n.results})}catch(r){return console.error("[Seller Alimtalk Templates] Error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await ne(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_code:a,template_name:n,template_content:o,template_type:i}=await e.req.json();if(!a||!n||!o)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(t.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(!(await kt(s,c.sender_key,{name:n,content:o,templateCode:a})).success)return e.json({success:!1,error:"Failed to register template"},500);const l=await s.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id,a,n,o,i||"basic").run();return e.json({success:!0,template_id:l.meta.last_row_id,message:"Template registered successfully. Approval pending (1-2 days)"})}catch(r){return console.error("[Seller Alimtalk Template Register] Error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const r=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:r.results})}catch(r){return console.error("[Seller Alimtalk Pricing] Error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/alimtalk/charge",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await ne(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{amount:a,pricing_id:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();if(!i)return e.json({success:!1,error:"Pricing not found"},404);const c=a*i.unit_price,u=`alimtalk_${o.id}_${Date.now()}`,l=await s.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id,a,c,i.unit_price,u).run(),p=`https://api.tosspayments.com/v1/payment/${u}`;return e.json({success:!0,charge_id:l.meta.last_row_id,order_id:u,amount:a,price:c,unit_price:i.unit_price,payment_url:p})}catch(r){return console.error("[Seller Alimtalk Charge] Error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/alimtalk/charge/complete",S(),async e=>{const{env:s}=e;try{const{order_id:r,payment_id:t}=await e.req.json();if(!r)return e.json({success:!1,error:"Missing order_id"},400);const a=await s.DB.prepare(`
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
    `).bind(a.amount,a.account_id).run(),e.json({success:!0,message:"Charge completed successfully",charged_amount:a.amount})):e.json({success:!1,error:"Charge not found or already completed"},404)}catch(r){return console.error("[Seller Alimtalk Charge Complete] Error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/alimtalk/send",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await ne(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_id:a,recipient_phone:n,variables:o,order_id:i}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(t.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(c.balance<1)return e.json({success:!1,error:"Insufficient balance. Please charge first."},400);const u=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a,c.id).first();if(!u)return e.json({success:!1,error:"Template not found or not approved"},404);const l=jt(u.template_content,o||{}),p=ir(n),m=await ys(s,{senderKey:c.sender_key,templateCode:u.template_code,to:p,message:l});if(!m.success)return await s.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id,a,i||null,p,l,m.error).run(),e.json({success:!1,error:m.error},500);const E=await s.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id,a,i||null,p,l,15,m.messageId).run();return await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(),e.json({success:!0,message_id:E.meta.last_row_id,aligo_message_id:m.messageId,status:"sent",remaining_balance:c.balance-1})}catch(r){return console.error("[Seller Alimtalk Send] Error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/alimtalk/messages",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await ne(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{page:a="1",limit:n="20",status:o}=e.req.query(),i=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(t.user_id).first();if(!i)return e.json({success:!1,error:"Alimtalk account not found"},404);const c=(parseInt(a)-1)*parseInt(n);let u=`
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;const l=[i.id];o&&(u+=" AND m.status = ?",l.push(o)),u+=" ORDER BY m.created_at DESC LIMIT ? OFFSET ?",l.push(parseInt(n),c);const p=await s.DB.prepare(u).bind(...l).all(),m=await s.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();return e.json({success:!0,messages:p.results,pagination:{total:m.total,page:parseInt(a),limit:parseInt(n)}})}catch(r){return console.error("[Seller Alimtalk Messages] Error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/alimtalk/statistics",S(),async e=>{const{env:s}=e;try{const r=e.req.header("X-Session-Token"),t=await ne(s,r);if(!t||t.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{start_date:a,end_date:n}=e.req.query(),o=await s.DB.prepare(`
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
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").all(),u=i.total_sent>0?(i.total_success/i.total_sent*100).toFixed(2):0;return e.json({success:!0,statistics:{total_sent:i.total_sent,total_success:i.total_success,total_failed:i.total_failed,success_rate:u,total_cost:i.total_cost,by_template:c.results}})}catch(r){return console.error("[Seller Alimtalk Statistics] Error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/alimtalk/send",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json(),{templateId:t,recipients:a,variables:n}=r;if(!t||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and recipients are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await ws(e.env,{accountId:o.id,templateId:parseInt(t),recipients:a.map(c=>({phone:c.phone,name:c.name,variables:c.variables||{}})),variables:n||{}});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/send/order",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json(),{templateId:t,orderId:a,customMessage:n}=r;if(!t||!a)return e.json({success:!1,error:"templateId and orderId are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);if(!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a),parseInt(s)).first())return e.json({success:!1,error:"Order not found or unauthorized"},404);const c=await Bt(e.env,o.id,parseInt(t),parseInt(a),n);return e.json({success:c.success,data:{total:c.totalRecipients,sent:c.successCount,failed:c.failedCount,refunded:c.refundedAmount},messages:c.messages})}catch(s){return console.error("[Alimtalk Send Order] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/send/bulk",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json(),{templateId:t,rows:a,variables:n}=r;if(!t||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and rows are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await Wt(e.env,o.id,parseInt(t),a,n||{});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send Bulk] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/templates/:id/preview",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=e.req.param("id"),t=await e.req.json(),{variables:a}=t,n=await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(r),parseInt(s)).first();if(!n)return e.json({success:!1,error:"Template not found"},404);let o=n.template_content;return a&&Object.entries(a).forEach(([i,c])=>{const u=new RegExp(`#{${i}}`,"g");o=o.replace(u,c)}),e.json({success:!0,data:{template_name:n.template_name,original:n.template_content,preview:o,required_variables:Array.from(n.template_content.matchAll(/#{(\w+)}/g),i=>i[1])}})}catch(s){return console.error("[Alimtalk Preview] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/admin/settlements",S(),async e=>{try{const s=await e.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("[Admin Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/admin/settlements/:id",S(),async e=>{try{const s=parseInt(e.req.param("id")),r=await Gt(e.env.DB,s);return r?e.json({success:!0,data:r}):e.json({success:!1,error:"Settlement not found"},404)}catch(s){return console.error("[Admin Settlement Detail] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/admin/settlements/generate",S(),async e=>{try{const s=await e.req.json(),{startDate:r,endDate:t}=s,a=r&&t?{startDate:r,endDate:t}:Vt(),n=await Jt(e.env.DB,a);return await zt(e.env.DB,n),e.json({success:!0,data:n})}catch(s){return console.error("[Admin Generate Settlement] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.env.DB.prepare(`
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
    `).bind(parseInt(s)).all();return e.json({success:!0,data:r.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/live/:streamId/sse",async e=>{const s=e.req.param("streamId");return Xt(s,e.env)});d.get("/api/live/:streamId/chat/sse",async e=>{const s=e.req.param("streamId");return Qt(s,e.env)});d.get("/api/seller/orders/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?Zt(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});d.get("/api/seller/stock/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?ea(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});d.post("/api/push/subscribe",S(),async e=>{try{const s=e.req.header("X-User-ID"),r=e.req.header("X-User-Type");if(!s||!r)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json();return await sa(e.env.DB,parseInt(s),r,t),e.json({success:!0})}catch(s){return console.error("[Push Subscribe] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/push/unsubscribe",S(),async e=>{try{const{endpoint:s}=await e.req.json();return s?(await ra(e.env.DB,s),e.json({success:!0})):e.json({success:!1,error:"Endpoint required"},400)}catch(s){return console.error("[Push Unsubscribe] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/push/vapid-public-key",S(),async e=>{try{const s=e.env.VAPID_PUBLIC_KEY||"";return e.json({success:!0,publicKey:s})}catch(s){return console.error("[Push VAPID Key] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/cache/stats",async e=>{const s=e.req.query("token"),r=e.env.STATS_SECRET_TOKEN||"your-secret-token-here";if(s!==r)return e.json({success:!1,error:"접근 권한이 없습니다. 올바른 token을 제공해주세요."},403);const t=F.hits+F.misses>0?(F.hits/(F.hits+F.misses)*100).toFixed(2):"0.00";return e.json({success:!0,data:{cache:{...F,hitRate:`${t}%`,cacheSize:he.size,maxSize:1e3,memoryUsage:`${(he.size/1e3*100).toFixed(1)}%`},description:{hits:"Memory cache로 처리된 요청 (KV 읽기 0회)",misses:"Memory cache 미스로 KV 조회한 요청",writes:"Memory cache에 저장된 항목 수",evictions:"Memory cache에서 삭제된 항목 수 (만료 또는 크기 제한)",hitRate:"Cache hit 비율 (높을수록 KV 사용량 감소)",cacheSize:"현재 Memory cache에 저장된 항목 수",maxSize:"Memory cache 최대 크기",memoryUsage:"Memory cache 사용률 (cacheSize / maxSize)"},kvUsageGuide:{currentHitRate:`${t}%`,recommendation:parseFloat(t)>=90?"✅ 캐시가 매우 효과적으로 작동하고 있습니다.":parseFloat(t)>=70?"⚠️ 캐시 히트율이 낮습니다. TTL 조정을 고려하세요.":"❌ 캐시 히트율이 매우 낮습니다. 캐시 설정을 확인하세요.",kvDailyReadsLimit:"100,000 reads/day (free tier)",kvDailyWritesLimit:"1,000 writes/day (free tier)",estimatedDailyReads:Math.round(F.misses/(F.hits+F.misses||1)*1e4),estimatedDailyWrites:Math.round(F.writes/(F.hits+F.misses||1)*1e3)}}})});const Ms=new tr,Ea=Object.assign({"/src/index.tsx":d});let mr=!1;for(const[,e]of Object.entries(Ea))e&&(Ms.route("/",e),Ms.notFound(e.notFoundHandler),mr=!0);if(!mr)throw new Error("Can't import modules from ['/src/index.tsx']");async function _r(e){try{const{to:s,subject:r,htmlContent:t,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:s}]}],from:{email:"noreply@live.ur-team.com",name:"유어 라이브"},subject:r,content:[{type:"text/html",value:t},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",s),{success:!0}}catch(s){return console.error("[Email] Exception:",s),{success:!1,error:s.message}}}async function ha(e){const{streamId:s,title:r,sellerName:t,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${s}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",u=`
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
  `,l=`
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
  `;return _r({to:"jiwon@ur-team.com",subject:`[유어 라이브] 🎉 새 라이브 스트림 생성: ${r}`,htmlContent:u,textContent:l})}const ga=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:_r,sendLiveStreamCreatedEmail:ha},Symbol.toStringTag,{value:"Module"}));export{Ms as default};
