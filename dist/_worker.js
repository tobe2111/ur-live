var tr=Object.defineProperty;var Es=e=>{throw TypeError(e)};var ar=(e,t,s)=>t in e?tr(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s;var R=(e,t,s)=>ar(e,typeof t!="symbol"?t+"":t,s),ts=(e,t,s)=>t.has(e)||Es("Cannot "+s);var m=(e,t,s)=>(ts(e,t,"read from private field"),s?s.call(e):t.get(e)),v=(e,t,s)=>t.has(e)?Es("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,s),S=(e,t,s,r)=>(ts(e,t,"write to private field"),r?r.call(e,s):t.set(e,s),s),D=(e,t,s)=>(ts(e,t,"access private method"),s);var hs=(e,t,s,r)=>({set _(a){S(e,t,a,s)},get _(){return m(e,t,r)}});var gs=(e,t,s)=>(r,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,u=!1,l;if(e[i]?(l=e[i][0][0],r.req.routeIndex=i):l=i===e.length&&a||void 0,l)try{c=await l(r,()=>o(i+1))}catch(p){if(p instanceof Error&&t)r.error=p,c=await t(p,r),u=!0;else throw p}else r.finalized===!1&&s&&(c=await s(r));return c&&(r.finalized===!1||u)&&(r.res=c),r}},nr=Symbol(),or=async(e,t=Object.create(null))=>{const{all:s=!1,dot:r=!1}=t,n=(e instanceof Cs?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?ir(e,{all:s,dot:r}):{}};async function ir(e,t){const s=await e.formData();return s?cr(s,t):{}}function cr(e,t){const s=Object.create(null);return e.forEach((r,a)=>{t.all||a.endsWith("[]")?ur(s,a,r):s[a]=r}),t.dot&&Object.entries(s).forEach(([r,a])=>{r.includes(".")&&(lr(s,r,a),delete s[r])}),s}var ur=(e,t,s)=>{e[t]!==void 0?Array.isArray(e[t])?e[t].push(s):e[t]=[e[t],s]:t.endsWith("[]")?e[t]=[s]:e[t]=s},lr=(e,t,s)=>{let r=e;const a=t.split(".");a.forEach((n,o)=>{o===a.length-1?r[n]=s:((!r[n]||typeof r[n]!="object"||Array.isArray(r[n])||r[n]instanceof File)&&(r[n]=Object.create(null)),r=r[n])})},Ds=e=>{const t=e.split("/");return t[0]===""&&t.shift(),t},dr=e=>{const{groups:t,path:s}=pr(e),r=Ds(s);return mr(r,t)},pr=e=>{const t=[];return e=e.replace(/\{[^}]+\}/g,(s,r)=>{const a=`@${r}`;return t.push([a,s]),a}),{groups:t,path:e}},mr=(e,t)=>{for(let s=t.length-1;s>=0;s--){const[r]=t[s];for(let a=e.length-1;a>=0;a--)if(e[a].includes(r)){e[a]=e[a].replace(r,t[s][1]);break}}return e},Ye={},_r=(e,t)=>{if(e==="*")return"*";const s=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(s){const r=`${e}#${t}`;return Ye[r]||(s[2]?Ye[r]=t&&t[0]!==":"&&t[0]!=="*"?[r,s[1],new RegExp(`^${s[2]}(?=/${t})`)]:[e,s[1],new RegExp(`^${s[2]}$`)]:Ye[r]=[e,s[1],!0]),Ye[r]}return null},us=(e,t)=>{try{return t(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,s=>{try{return t(s)}catch{return s}})}},fr=e=>us(e,decodeURI),js=e=>{const t=e.url,s=t.indexOf("/",t.indexOf(":")+4);let r=s;for(;r<t.length;r++){const a=t.charCodeAt(r);if(a===37){const n=t.indexOf("?",r),o=t.slice(s,n===-1?void 0:n);return fr(o.includes("%25")?o.replace(/%25/g,"%2525"):o)}else if(a===63)break}return t.slice(s,r)},Er=e=>{const t=js(e);return t.length>1&&t.at(-1)==="/"?t.slice(0,-1):t},Te=(e,t,...s)=>(s.length&&(t=Te(t,...s)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${t==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(t==null?void 0:t[0])==="/"?t.slice(1):t}`}`),ks=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const t=e.split("/"),s=[];let r="";return t.forEach(a=>{if(a!==""&&!/\:/.test(a))r+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){s.length===0&&r===""?s.push("/"):s.push(r);const n=a.replace("?","");r+="/"+n,s.push(r)}else r+="/"+a}),s.filter((a,n,o)=>o.indexOf(a)===n)},as=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?us(e,As):e):e,Ns=(e,t,s)=>{let r;if(!s&&t&&!/[%+]/.test(t)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(t,o+1)||(o=e.indexOf(`&${t}`,o+1));o!==-1;){const i=e.charCodeAt(o+t.length+1);if(i===61){const c=o+t.length+2,u=e.indexOf("&",c);return as(e.slice(c,u===-1?void 0:u))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${t}`,o+1)}if(r=/[%+]/.test(e),!r)return}const a={};r??(r=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(r&&(c=as(c)),n=o,c==="")continue;let u;i===-1?u="":(u=e.slice(i+1,o===-1?void 0:o),r&&(u=as(u))),s?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(u)):a[c]??(a[c]=u)}return t?a[t]:a},hr=Ns,gr=(e,t)=>Ns(e,t,!0),As=decodeURIComponent,ys=e=>us(e,As),Ie,V,ne,Ls,Ms,cs,oe,Ts,Cs=(Ts=class{constructor(e,t="/",s=[[]]){v(this,ne);R(this,"raw");v(this,Ie);v(this,V);R(this,"routeIndex",0);R(this,"path");R(this,"bodyCache",{});v(this,oe,e=>{const{bodyCache:t,raw:s}=this,r=t[e];if(r)return r;const a=Object.keys(t)[0];return a?t[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):t[e]=s[e]()});this.raw=e,this.path=t,S(this,V,s),S(this,Ie,{})}param(e){return e?D(this,ne,Ls).call(this,e):D(this,ne,Ms).call(this)}query(e){return hr(this.url,e)}queries(e){return gr(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const t={};return this.raw.headers.forEach((s,r)=>{t[r]=s}),t}async parseBody(e){var t;return(t=this.bodyCache).parsedBody??(t.parsedBody=await or(this,e))}json(){return m(this,oe).call(this,"text").then(e=>JSON.parse(e))}text(){return m(this,oe).call(this,"text")}arrayBuffer(){return m(this,oe).call(this,"arrayBuffer")}blob(){return m(this,oe).call(this,"blob")}formData(){return m(this,oe).call(this,"formData")}addValidatedData(e,t){m(this,Ie)[e]=t}valid(e){return m(this,Ie)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[nr](){return m(this,V)}get matchedRoutes(){return m(this,V)[0].map(([[,e]])=>e)}get routePath(){return m(this,V)[0].map(([[,e]])=>e)[this.routeIndex].path}},Ie=new WeakMap,V=new WeakMap,ne=new WeakSet,Ls=function(e){const t=m(this,V)[0][this.routeIndex][1][e],s=D(this,ne,cs).call(this,t);return s&&/\%/.test(s)?ys(s):s},Ms=function(){const e={},t=Object.keys(m(this,V)[0][this.routeIndex][1]);for(const s of t){const r=D(this,ne,cs).call(this,m(this,V)[0][this.routeIndex][1][s]);r!==void 0&&(e[s]=/\%/.test(r)?ys(r):r)}return e},cs=function(e){return m(this,V)[1]?m(this,V)[1][e]:e},oe=new WeakMap,Ts),yr={Stringify:1},Ps=async(e,t,s,r,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:t,buffer:a,context:r}))).then(i=>Promise.all(i.filter(Boolean).map(c=>Ps(c,t,!1,r,a))).then(()=>a[0]))):Promise.resolve(e)},wr="text/plain; charset=UTF-8",ns=(e,t)=>({"Content-Type":e,...t}),He,xe,se,ve,re,K,$e,Oe,De,fe,qe,Fe,ie,Se,Ss,br=(Ss=class{constructor(e,t){v(this,ie);v(this,He);v(this,xe);R(this,"env",{});v(this,se);R(this,"finalized",!1);R(this,"error");v(this,ve);v(this,re);v(this,K);v(this,$e);v(this,Oe);v(this,De);v(this,fe);v(this,qe);v(this,Fe);R(this,"render",(...e)=>(m(this,Oe)??S(this,Oe,t=>this.html(t)),m(this,Oe).call(this,...e)));R(this,"setLayout",e=>S(this,$e,e));R(this,"getLayout",()=>m(this,$e));R(this,"setRenderer",e=>{S(this,Oe,e)});R(this,"header",(e,t,s)=>{this.finalized&&S(this,K,new Response(m(this,K).body,m(this,K)));const r=m(this,K)?m(this,K).headers:m(this,fe)??S(this,fe,new Headers);t===void 0?r.delete(e):s!=null&&s.append?r.append(e,t):r.set(e,t)});R(this,"status",e=>{S(this,ve,e)});R(this,"set",(e,t)=>{m(this,se)??S(this,se,new Map),m(this,se).set(e,t)});R(this,"get",e=>m(this,se)?m(this,se).get(e):void 0);R(this,"newResponse",(...e)=>D(this,ie,Se).call(this,...e));R(this,"body",(e,t,s)=>D(this,ie,Se).call(this,e,t,s));R(this,"text",(e,t,s)=>!m(this,fe)&&!m(this,ve)&&!t&&!s&&!this.finalized?new Response(e):D(this,ie,Se).call(this,e,t,ns(wr,s)));R(this,"json",(e,t,s)=>D(this,ie,Se).call(this,JSON.stringify(e),t,ns("application/json",s)));R(this,"html",(e,t,s)=>{const r=a=>D(this,ie,Se).call(this,a,t,ns("text/html; charset=UTF-8",s));return typeof e=="object"?Ps(e,yr.Stringify,!1,{}).then(r):r(e)});R(this,"redirect",(e,t)=>{const s=String(e);return this.header("Location",/[^\x00-\xFF]/.test(s)?encodeURI(s):s),this.newResponse(null,t??302)});R(this,"notFound",()=>(m(this,De)??S(this,De,()=>new Response),m(this,De).call(this,this)));S(this,He,e),t&&(S(this,re,t.executionCtx),this.env=t.env,S(this,De,t.notFoundHandler),S(this,Fe,t.path),S(this,qe,t.matchResult))}get req(){return m(this,xe)??S(this,xe,new Cs(m(this,He),m(this,Fe),m(this,qe))),m(this,xe)}get event(){if(m(this,re)&&"respondWith"in m(this,re))return m(this,re);throw Error("This context has no FetchEvent")}get executionCtx(){if(m(this,re))return m(this,re);throw Error("This context has no ExecutionContext")}get res(){return m(this,K)||S(this,K,new Response(null,{headers:m(this,fe)??S(this,fe,new Headers)}))}set res(e){if(m(this,K)&&e){e=new Response(e.body,e);for(const[t,s]of m(this,K).headers.entries())if(t!=="content-type")if(t==="set-cookie"){const r=m(this,K).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of r)e.headers.append("set-cookie",a)}else e.headers.set(t,s)}S(this,K,e),this.finalized=!0}get var(){return m(this,se)?Object.fromEntries(m(this,se)):{}}},He=new WeakMap,xe=new WeakMap,se=new WeakMap,ve=new WeakMap,re=new WeakMap,K=new WeakMap,$e=new WeakMap,Oe=new WeakMap,De=new WeakMap,fe=new WeakMap,qe=new WeakMap,Fe=new WeakMap,ie=new WeakSet,Se=function(e,t,s){const r=m(this,K)?new Headers(m(this,K).headers):m(this,fe)??new Headers;if(typeof t=="object"&&"headers"in t){const n=t.headers instanceof Headers?t.headers:new Headers(t.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?r.append(o,i):r.set(o,i)}if(s)for(const[n,o]of Object.entries(s))if(typeof o=="string")r.set(n,o);else{r.delete(n);for(const i of o)r.append(n,i)}const a=typeof t=="number"?t:(t==null?void 0:t.status)??m(this,ve);return new Response(e,{status:a,headers:r})},Ss),U="ALL",Tr="all",Sr=["get","post","put","delete","options","patch"],Us="Can not add a route since the matcher is already built.",Hs=class extends Error{},Rr="__COMPOSED_HANDLER",Ir=e=>e.text("404 Not Found",404),ws=(e,t)=>{if("getResponse"in e){const s=e.getResponse();return t.newResponse(s.body,s)}return console.error(e),t.text("Internal Server Error",500)},J,H,xs,z,me,Je,ze,je,vr=(je=class{constructor(t={}){v(this,H);R(this,"get");R(this,"post");R(this,"put");R(this,"delete");R(this,"options");R(this,"patch");R(this,"all");R(this,"on");R(this,"use");R(this,"router");R(this,"getPath");R(this,"_basePath","/");v(this,J,"/");R(this,"routes",[]);v(this,z,Ir);R(this,"errorHandler",ws);R(this,"onError",t=>(this.errorHandler=t,this));R(this,"notFound",t=>(S(this,z,t),this));R(this,"fetch",(t,...s)=>D(this,H,ze).call(this,t,s[1],s[0],t.method));R(this,"request",(t,s,r,a)=>t instanceof Request?this.fetch(s?new Request(t,s):t,r,a):(t=t.toString(),this.fetch(new Request(/^https?:\/\//.test(t)?t:`http://localhost${Te("/",t)}`,s),r,a)));R(this,"fire",()=>{addEventListener("fetch",t=>{t.respondWith(D(this,H,ze).call(this,t.request,t,void 0,t.request.method))})});[...Sr,Tr].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?S(this,J,o):D(this,H,me).call(this,n,m(this,J),o),i.forEach(c=>{D(this,H,me).call(this,n,m(this,J),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){S(this,J,c);for(const u of[n].flat())i.map(l=>{D(this,H,me).call(this,u.toUpperCase(),m(this,J),l)})}return this},this.use=(n,...o)=>(typeof n=="string"?S(this,J,n):(S(this,J,"*"),o.unshift(n)),o.forEach(i=>{D(this,H,me).call(this,U,m(this,J),i)}),this);const{strict:r,...a}=t;Object.assign(this,a),this.getPath=r??!0?t.getPath??js:Er}route(t,s){const r=this.basePath(t);return s.routes.map(a=>{var o;let n;s.errorHandler===ws?n=a.handler:(n=async(i,c)=>(await gs([],s.errorHandler)(i,()=>a.handler(i,c))).res,n[Rr]=a.handler),D(o=r,H,me).call(o,a.method,a.path,n)}),this}basePath(t){const s=D(this,H,xs).call(this);return s._basePath=Te(this._basePath,t),s}mount(t,s,r){let a,n;r&&(typeof r=="function"?n=r:(n=r.optionHandler,r.replaceRequest===!1?a=c=>c:a=r.replaceRequest));const o=n?c=>{const u=n(c);return Array.isArray(u)?u:[u]}:c=>{let u;try{u=c.executionCtx}catch{}return[c.env,u]};a||(a=(()=>{const c=Te(this._basePath,t),u=c==="/"?0:c.length;return l=>{const p=new URL(l.url);return p.pathname=p.pathname.slice(u)||"/",new Request(p,l)}})());const i=async(c,u)=>{const l=await s(a(c.req.raw),...o(c));if(l)return l;await u()};return D(this,H,me).call(this,U,Te(t,"*"),i),this}},J=new WeakMap,H=new WeakSet,xs=function(){const t=new je({router:this.router,getPath:this.getPath});return t.errorHandler=this.errorHandler,S(t,z,m(this,z)),t.routes=this.routes,t},z=new WeakMap,me=function(t,s,r){t=t.toUpperCase(),s=Te(this._basePath,s);const a={basePath:this._basePath,path:s,method:t,handler:r};this.router.add(t,s,[r,a]),this.routes.push(a)},Je=function(t,s){if(t instanceof Error)return this.errorHandler(t,s);throw t},ze=function(t,s,r,a){if(a==="HEAD")return(async()=>new Response(null,await D(this,H,ze).call(this,t,s,r,"GET")))();const n=this.getPath(t,{env:r}),o=this.router.match(a,n),i=new br(t,{path:n,matchResult:o,env:r,executionCtx:s,notFoundHandler:m(this,z)});if(o[0].length===1){let u;try{u=o[0][0][0][0](i,async()=>{i.res=await m(this,z).call(this,i)})}catch(l){return D(this,H,Je).call(this,l,i)}return u instanceof Promise?u.then(l=>l||(i.finalized?i.res:m(this,z).call(this,i))).catch(l=>D(this,H,Je).call(this,l,i)):u??m(this,z).call(this,i)}const c=gs(o[0],this.errorHandler,m(this,z));return(async()=>{try{const u=await c(i);if(!u.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return u.res}catch(u){return D(this,H,Je).call(this,u,i)}})()},je),$s=[];function Or(e,t){const s=this.buildAllMatchers(),r=((a,n)=>{const o=s[a]||s[U],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],$s];const u=c.indexOf("",1);return[o[1][u],c]});return this.match=r,r(e,t)}var Xe="[^/]+",Pe=".*",Ue="(?:|/.*)",Re=Symbol(),Dr=new Set(".\\+*[^]$()");function jr(e,t){return e.length===1?t.length===1?e<t?-1:1:-1:t.length===1||e===Pe||e===Ue?1:t===Pe||t===Ue?-1:e===Xe?1:t===Xe?-1:e.length===t.length?e<t?-1:1:t.length-e.length}var Ee,he,G,we,kr=(we=class{constructor(){v(this,Ee);v(this,he);v(this,G,Object.create(null))}insert(t,s,r,a,n){if(t.length===0){if(m(this,Ee)!==void 0)throw Re;if(n)return;S(this,Ee,s);return}const[o,...i]=t,c=o==="*"?i.length===0?["","",Pe]:["","",Xe]:o==="/*"?["","",Ue]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let u;if(c){const l=c[1];let p=c[2]||Xe;if(l&&c[2]&&(p===".*"||(p=p.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(p))))throw Re;if(u=m(this,G)[p],!u){if(Object.keys(m(this,G)).some(_=>_!==Pe&&_!==Ue))throw Re;if(n)return;u=m(this,G)[p]=new we,l!==""&&S(u,he,a.varIndex++)}!n&&l!==""&&r.push([l,m(u,he)])}else if(u=m(this,G)[o],!u){if(Object.keys(m(this,G)).some(l=>l.length>1&&l!==Pe&&l!==Ue))throw Re;if(n)return;u=m(this,G)[o]=new we}u.insert(i,s,r,a,n)}buildRegExpStr(){const s=Object.keys(m(this,G)).sort(jr).map(r=>{const a=m(this,G)[r];return(typeof m(a,he)=="number"?`(${r})@${m(a,he)}`:Dr.has(r)?`\\${r}`:r)+a.buildRegExpStr()});return typeof m(this,Ee)=="number"&&s.unshift(`#${m(this,Ee)}`),s.length===0?"":s.length===1?s[0]:"(?:"+s.join("|")+")"}},Ee=new WeakMap,he=new WeakMap,G=new WeakMap,we),Ze,Be,Rs,Nr=(Rs=class{constructor(){v(this,Ze,{varIndex:0});v(this,Be,new kr)}insert(e,t,s){const r=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const u=`@\\${o}`;return a[o]=[u,c],o++,i=!0,u}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return m(this,Be).insert(n,t,r,m(this,Ze),s),r}buildRegExp(){let e=m(this,Be).buildRegExpStr();if(e==="")return[/^$/,[],[]];let t=0;const s=[],r=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(s[++t]=Number(n),"$()"):(o!==void 0&&(r[Number(o)]=++t),"")),[new RegExp(`^${e}`),s,r]}},Ze=new WeakMap,Be=new WeakMap,Rs),Ar=[/^$/,[],Object.create(null)],Ge=Object.create(null);function qs(e){return Ge[e]??(Ge[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(t,s)=>s?`\\${s}`:"(?:|/.*)")}$`))}function Cr(){Ge=Object.create(null)}function Lr(e){var u;const t=new Nr,s=[];if(e.length===0)return Ar;const r=e.map(l=>[!/\*|\/:/.test(l[0]),...l]).sort(([l,p],[_,f])=>l?1:_?-1:p.length-f.length),a=Object.create(null);for(let l=0,p=-1,_=r.length;l<_;l++){const[f,E,h]=r[l];f?a[E]=[h.map(([w])=>[w,Object.create(null)]),$s]:p++;let g;try{g=t.insert(E,p,f)}catch(w){throw w===Re?new Hs(E):w}f||(s[p]=h.map(([w,y])=>{const j=Object.create(null);for(y-=1;y>=0;y--){const[k,T]=g[y];j[k]=T}return[w,j]}))}const[n,o,i]=t.buildRegExp();for(let l=0,p=s.length;l<p;l++)for(let _=0,f=s[l].length;_<f;_++){const E=(u=s[l][_])==null?void 0:u[1];if(!E)continue;const h=Object.keys(E);for(let g=0,w=h.length;g<w;g++)E[h[g]]=i[E[h[g]]]}const c=[];for(const l in o)c[l]=s[o[l]];return[n,c,a]}function be(e,t){if(e){for(const s of Object.keys(e).sort((r,a)=>a.length-r.length))if(qs(s).test(t))return[...e[s]]}}var ce,ue,es,Fs,Is,Mr=(Is=class{constructor(){v(this,es);R(this,"name","RegExpRouter");v(this,ce);v(this,ue);R(this,"match",Or);S(this,ce,{[U]:Object.create(null)}),S(this,ue,{[U]:Object.create(null)})}add(e,t,s){var i;const r=m(this,ce),a=m(this,ue);if(!r||!a)throw new Error(Us);r[e]||[r,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[U]).forEach(u=>{c[e][u]=[...c[U][u]]})}),t==="/*"&&(t="*");const n=(t.match(/\/:/g)||[]).length;if(/\*$/.test(t)){const c=qs(t);e===U?Object.keys(r).forEach(u=>{var l;(l=r[u])[t]||(l[t]=be(r[u],t)||be(r[U],t)||[])}):(i=r[e])[t]||(i[t]=be(r[e],t)||be(r[U],t)||[]),Object.keys(r).forEach(u=>{(e===U||e===u)&&Object.keys(r[u]).forEach(l=>{c.test(l)&&r[u][l].push([s,n])})}),Object.keys(a).forEach(u=>{(e===U||e===u)&&Object.keys(a[u]).forEach(l=>c.test(l)&&a[u][l].push([s,n]))});return}const o=ks(t)||[t];for(let c=0,u=o.length;c<u;c++){const l=o[c];Object.keys(a).forEach(p=>{var _;(e===U||e===p)&&((_=a[p])[l]||(_[l]=[...be(r[p],l)||be(r[U],l)||[]]),a[p][l].push([s,n-u+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(m(this,ue)).concat(Object.keys(m(this,ce))).forEach(t=>{e[t]||(e[t]=D(this,es,Fs).call(this,t))}),S(this,ce,S(this,ue,void 0)),Cr(),e}},ce=new WeakMap,ue=new WeakMap,es=new WeakSet,Fs=function(e){const t=[];let s=e===U;return[m(this,ce),m(this,ue)].forEach(r=>{const a=r[e]?Object.keys(r[e]).map(n=>[n,r[e][n]]):[];a.length!==0?(s||(s=!0),t.push(...a)):e!==U&&t.push(...Object.keys(r[U]).map(n=>[n,r[U][n]]))}),s?Lr(t):null},Is),le,te,vs,Pr=(vs=class{constructor(e){R(this,"name","SmartRouter");v(this,le,[]);v(this,te,[]);S(this,le,e.routers)}add(e,t,s){if(!m(this,te))throw new Error(Us);m(this,te).push([e,t,s])}match(e,t){if(!m(this,te))throw new Error("Fatal error");const s=m(this,le),r=m(this,te),a=s.length;let n=0,o;for(;n<a;n++){const i=s[n];try{for(let c=0,u=r.length;c<u;c++)i.add(...r[c]);o=i.match(e,t)}catch(c){if(c instanceof Hs)continue;throw c}this.match=i.match.bind(i),S(this,le,[i]),S(this,te,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(m(this,te)||m(this,le).length!==1)throw new Error("No active router has been determined yet.");return m(this,le)[0]}},le=new WeakMap,te=new WeakMap,vs),Le=Object.create(null),de,F,ge,ke,x,ae,_e,Ne,Ur=(Ne=class{constructor(t,s,r){v(this,ae);v(this,de);v(this,F);v(this,ge);v(this,ke,0);v(this,x,Le);if(S(this,F,r||Object.create(null)),S(this,de,[]),t&&s){const a=Object.create(null);a[t]={handler:s,possibleKeys:[],score:0},S(this,de,[a])}S(this,ge,[])}insert(t,s,r){S(this,ke,++hs(this,ke)._);let a=this;const n=dr(s),o=[];for(let i=0,c=n.length;i<c;i++){const u=n[i],l=n[i+1],p=_r(u,l),_=Array.isArray(p)?p[0]:u;if(_ in m(a,F)){a=m(a,F)[_],p&&o.push(p[1]);continue}m(a,F)[_]=new Ne,p&&(m(a,ge).push(p),o.push(p[1])),a=m(a,F)[_]}return m(a,de).push({[t]:{handler:r,possibleKeys:o.filter((i,c,u)=>u.indexOf(i)===c),score:m(this,ke)}}),a}search(t,s){var c;const r=[];S(this,x,Le);let n=[this];const o=Ds(s),i=[];for(let u=0,l=o.length;u<l;u++){const p=o[u],_=u===l-1,f=[];for(let E=0,h=n.length;E<h;E++){const g=n[E],w=m(g,F)[p];w&&(S(w,x,m(g,x)),_?(m(w,F)["*"]&&r.push(...D(this,ae,_e).call(this,m(w,F)["*"],t,m(g,x))),r.push(...D(this,ae,_e).call(this,w,t,m(g,x)))):f.push(w));for(let y=0,j=m(g,ge).length;y<j;y++){const k=m(g,ge)[y],T=m(g,x)===Le?{}:{...m(g,x)};if(k==="*"){const L=m(g,F)["*"];L&&(r.push(...D(this,ae,_e).call(this,L,t,m(g,x))),S(L,x,T),f.push(L));continue}const[A,C,I]=k;if(!p&&!(I instanceof RegExp))continue;const N=m(g,F)[A],$=o.slice(u).join("/");if(I instanceof RegExp){const L=I.exec($);if(L){if(T[C]=L[0],r.push(...D(this,ae,_e).call(this,N,t,m(g,x),T)),Object.keys(m(N,F)).length){S(N,x,T);const X=((c=L[0].match(/\//))==null?void 0:c.length)??0;(i[X]||(i[X]=[])).push(N)}continue}}(I===!0||I.test(p))&&(T[C]=p,_?(r.push(...D(this,ae,_e).call(this,N,t,T,m(g,x))),m(N,F)["*"]&&r.push(...D(this,ae,_e).call(this,m(N,F)["*"],t,T,m(g,x)))):(S(N,x,T),f.push(N)))}}n=f.concat(i.shift()??[])}return r.length>1&&r.sort((u,l)=>u.score-l.score),[r.map(({handler:u,params:l})=>[u,l])]}},de=new WeakMap,F=new WeakMap,ge=new WeakMap,ke=new WeakMap,x=new WeakMap,ae=new WeakSet,_e=function(t,s,r,a){const n=[];for(let o=0,i=m(t,de).length;o<i;o++){const c=m(t,de)[o],u=c[s]||c[U],l={};if(u!==void 0&&(u.params=Object.create(null),n.push(u),r!==Le||a&&a!==Le))for(let p=0,_=u.possibleKeys.length;p<_;p++){const f=u.possibleKeys[p],E=l[u.score];u.params[f]=a!=null&&a[f]&&!E?a[f]:r[f]??(a==null?void 0:a[f]),l[u.score]=!0}}return n},Ne),ye,Os,Hr=(Os=class{constructor(){R(this,"name","TrieRouter");v(this,ye);S(this,ye,new Ur)}add(e,t,s){const r=ks(t);if(r){for(let a=0,n=r.length;a<n;a++)m(this,ye).insert(e,r[a],s);return}m(this,ye).insert(e,t,s)}match(e,t){return m(this,ye).search(e,t)}},ye=new WeakMap,Os),Bs=class extends vr{constructor(e={}){super(e),this.router=e.router??new Pr({routers:[new Mr,new Hr]})}},b=e=>{const s={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},r=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(s.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(s.allowMethods);return async function(o,i){var l;function c(p,_){o.res.headers.set(p,_)}const u=await r(o.req.header("origin")||"",o);if(u&&c("Access-Control-Allow-Origin",u),s.credentials&&c("Access-Control-Allow-Credentials","true"),(l=s.exposeHeaders)!=null&&l.length&&c("Access-Control-Expose-Headers",s.exposeHeaders.join(",")),o.req.method==="OPTIONS"){s.origin!=="*"&&c("Vary","Origin"),s.maxAge!=null&&c("Access-Control-Max-Age",s.maxAge.toString());const p=await a(o.req.header("origin")||"",o);p.length&&c("Access-Control-Allow-Methods",p.join(","));let _=s.allowHeaders;if(!(_!=null&&_.length)){const f=o.req.header("Access-Control-Request-Headers");f&&(_=f.split(/\s*,\s*/))}return _!=null&&_.length&&(c("Access-Control-Allow-Headers",_.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),s.origin!=="*"&&o.header("Vary","Origin",{append:!0})}};function xr(e){const t=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],s=[];for(const r of t)e[r]||s.push(r);if(s.length>0)throw new Error(`Missing required environment variables: ${s.join(", ")}

Please configure them:
`+s.map(r=>r==="TOSS_SECRET_KEY"||r==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${r} --project-name ur-live`:`  Check wrangler.jsonc for ${r} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function $r(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function qr(e){const t=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),t.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):t.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(s){t.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:s instanceof Error?s.message:String(s)})}try{if(!e.SESSION_KV)t.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const s="test:env:check";await e.SESSION_KV.put(s,"ok",{expirationTtl:60}),await e.SESSION_KV.get(s)==="ok"?t.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):t.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(s){t.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:s instanceof Error?s.message:String(s)})}try{if(!e.CACHE_KV)t.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const s="test:cache:check";await e.CACHE_KV.put(s,"ok",{expirationTtl:60}),await e.CACHE_KV.get(s)==="ok"?t.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):t.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(s){t.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:s instanceof Error?s.message:String(s)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?t.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):t.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):t.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?t.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):t.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):t.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),t}function Fr(e){const t=[];t.push(""),t.push("========================================"),t.push("환경 변수 테스트 결과"),t.push("========================================"),t.push("");let s=0,r=0,a=0;for(const n of e){const o=n.status==="pass"?"✅":n.status==="warn"?"⚠️":"❌";t.push(`${o} ${n.name}: ${n.message}`),n.details&&t.push(`   → ${n.details}`),n.status==="pass"&&s++,n.status==="warn"&&r++,n.status==="fail"&&a++}return t.push(""),t.push("========================================"),t.push(`총 ${e.length}개 테스트:`),t.push(`  ✅ 성공: ${s}`),r>0&&t.push(`  ⚠️  경고: ${r}`),a>0&&t.push(`  ❌ 실패: ${a}`),t.push("========================================"),t.push(""),a>0?(t.push("❌ 환경 변수 설정이 완료되지 않았습니다."),t.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):r>0?t.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):t.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),t.join(`
`)}async function Br(e){const t=await qr(e),s=t.filter(n=>n.status==="pass").length,r=t.filter(n=>n.status==="warn").length,a=t.filter(n=>n.status==="fail").length;return{success:a===0,summary:{total:t.length,pass:s,warn:r,fail:a},results:t,formatted:Fr(t)}}const os={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function Wr(){const e=os.ENV==="production";return{baseUrl:os.TEST_BASE_URL,apiKey:os.TEST_API_KEY,isProduction:e}}async function Ws(e,t){const s=Wr(),r=`${s.baseUrl}${e}`;try{const a=await fetch(r,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s.apiKey}`},body:JSON.stringify(t)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function Kr(e){try{const t={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((r,a)=>({SerialNum:a+1,ItemName:r.name,Qty:r.quantity,UnitPrice:r.unitPrice,SupplyCost:r.supplyPrice,Tax:r.taxAmount,Remark:r.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},s=await Ws("/eTaxInvoice/RegistAndIssue",t);if(s.code!==1)throw new Error(`바로빌 발행 실패: ${s.message}`);return{success:!0,ntsConfirmNumber:s.ntsconfirmNum,invoiceKey:s.invoiceKey,message:s.message}}catch(t){throw console.error("바로빌 세금계산서 발행 실패:",t),t}}async function Vr(e,t,s){try{const a=await Ws("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:t,Memo:s});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(r){throw console.error("바로빌 세금계산서 취소 실패:",r),r}}function Me(){return!1}async function Yr(e){return await Kr(e)}function Jr(e,t,s){const r=Number(t.total_amount),a=Math.floor(r/1.1),n=r-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:t.buyer_business_number,buyerBusinessName:t.buyer_business_name||t.user_name,buyerCEO:t.buyer_ceo_name,buyerAddress:t.shipping_address,buyerEmail:t.user_email,buyerTel:t.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:s.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),u=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:u,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:r,memo:`주문번호: ${t.order_number}`,orderNo:t.order_number}}class Y extends Error{constructor(t,s,r){super(t),this.statusCode=s,this.code=r,this.name="AuthError"}}function zr(e){return`${crypto.randomUUID()}-${e}`}function Gr(e){var n,o,i,c,u,l,p;const t=e.id.toString(),s=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",r=((c=e.kakao_account)==null?void 0:c.email)||null,a=((u=e.properties)==null?void 0:u.profile_image)||((p=(l=e.kakao_account)==null?void 0:l.profile)==null?void 0:p.profile_image_url)||null;return{kakaoId:t,nickname:s,email:r,profileImage:a}}async function Xr(e,t,s,r,a){try{const n=await e.prepare(`
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
    `).bind(t,s,r,a).first();if(!n)throw new Y("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",n.id),n}catch(n){throw n instanceof Y?n:(console.error("[Auth] Database error during upsert:",n),new Y("Database error",500,"DB_ERROR"))}}async function Qr(e){try{const t=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!t.ok){const r=await t.text();throw console.error("[Kakao API] Failed to get user info:",r),new Y("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const s=await t.json();if(!s.id)throw new Y("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return s}catch(t){throw t instanceof Y?t:(console.error("[Kakao API] Network error:",t),new Y("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function Zr(e,t,s){try{const r=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:s,redirect_uri:t,code:e}).toString()});if(!r.ok){const n=await r.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new Y(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await r.json()).access_token}catch(r){throw r instanceof Y?r:(console.error("[Kakao OAuth] Network error:",r),new Y("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function Ks(e,t){const s=await Qr(t),{kakaoId:r,nickname:a,email:n,profileImage:o}=Gr(s);console.log("[Auth] Processing login for Kakao user:",r);const i=await Xr(e,r,a,n,o),c=zr(i.id);return{user:i,sessionToken:c}}async function Vs(e,t,s=30){try{const r=await e.get(t,"json");if(!r)return console.log(`[Cache MISS] ${t}`),null;const a=Date.now()-r.timestamp;return a>s*1e3?(console.log(`[Cache EXPIRED] ${t} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${t} (age: ${Math.round(a/1e3)}s)`),r.data)}catch(r){return console.error(`[Cache] Get error for key "${t}":`,r),null}}async function Qe(e,t,s,r=30){try{const a={data:s,timestamp:Date.now()};await e.put(t,JSON.stringify(a),{expirationTtl:r}),console.log(`[Cache SET] ${t} (TTL: ${r}s)`)}catch(a){console.error(`[Cache] Set error for key "${t}":`,a)}}function et(e){const t=e.req.header("CF-Connecting-IP");if(t)return t;const s=e.req.header("X-Forwarded-For");if(s)return s.split(",")[0].trim();const r=e.req.header("X-Real-IP");return r||"unknown"}function st(e,t){return`ratelimit:${e}:${t}`}const is=new Map;async function rt(e,t,s){var _;const r=new URL(e.req.url).pathname,a=st(t,r),n=Date.now(),o=s.windowMs*1e3,c=e.get("user")&&s.authenticatedMultiplier?s.maxRequests*s.authenticatedMultiplier:s.maxRequests;try{const f=(_=e.env)==null?void 0:_.RATE_LIMIT_KV;if(f){const E=await f.get(a);let h;E?(h=JSON.parse(E),n>h.resetTime?h={count:1,resetTime:n+o}:h.count++):h={count:1,resetTime:n+o};const g=Math.ceil(o/1e3);await f.put(a,JSON.stringify(h),{expirationTtl:g});const w=h.count<=c,y=Math.max(0,c-h.count);return{allowed:w,remaining:y,resetTime:h.resetTime}}}catch(f){console.error("KV Rate Limit Error:",f)}let u=is.get(a);u&&n>u.resetTime&&(is.delete(a),u=void 0),u?u.count++:u={count:1,resetTime:n+o},is.set(a,u);const l=u.count<=c,p=Math.max(0,c-u.count);return{allowed:l,remaining:p,resetTime:u.resetTime}}function We(e){return async(t,s)=>{const r=et(t);if(e.skipIps&&e.skipIps.includes(r))return s();if(e.pathPattern){const n=new URL(t.req.url).pathname;if(!e.pathPattern.test(n))return s()}const a=await rt(t,r,e);if(t.header("X-RateLimit-Limit",e.maxRequests.toString()),t.header("X-RateLimit-Remaining",a.remaining.toString()),t.header("X-RateLimit-Reset",new Date(a.resetTime).toISOString()),!a.allowed){const n=Math.ceil((a.resetTime-Date.now())/1e3);return t.header("Retry-After",n.toString()),t.json({success:!1,error:e.message||"Too many requests. Please try again later.",retryAfter:n,resetTime:new Date(a.resetTime).toISOString()},429)}return s()}}const Ke={api:{windowMs:60,maxRequests:60,message:"API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",authenticatedMultiplier:2},auth:{windowMs:60,maxRequests:5,message:"로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",pathPattern:/^\/api\/auth\//},order:{windowMs:60,maxRequests:10,message:"주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/orders/,authenticatedMultiplier:2},alimtalk:{windowMs:60,maxRequests:10,message:"알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/seller\/alimtalk\/send/},upload:{windowMs:60,maxRequests:5,message:"파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/.*\/upload/}};class P extends Error{constructor(t,s,r="VALIDATION_ERROR"){super(s),this.field=t,this.code=r,this.name="ValidationError"}}function tt(e,t){const{field:s,required:r,type:a,min:n,max:o,pattern:i,enum:c,custom:u,message:l}=t;if(r&&(e==null||e===""))throw new P(s,l||`${s}은(는) 필수 항목입니다.`,"REQUIRED");if(!(e==null||e==="")){if(a)switch(a){case"string":if(typeof e!="string")throw new P(s,l||`${s}은(는) 문자열이어야 합니다.`,"INVALID_TYPE");break;case"number":const p=typeof e=="string"?Number(e):e;if(typeof p!="number"||isNaN(p))throw new P(s,l||`${s}은(는) 숫자여야 합니다.`,"INVALID_TYPE");break;case"boolean":if(typeof e!="boolean")throw new P(s,l||`${s}은(는) true/false 값이어야 합니다.`,"INVALID_TYPE");break;case"email":if(typeof e!="string"||!ot(e))throw new P(s,l||`${s}은(는) 유효한 이메일 주소여야 합니다.`,"INVALID_EMAIL");break;case"url":if(typeof e!="string"||!it(e))throw new P(s,l||`${s}은(는) 유효한 URL이어야 합니다.`,"INVALID_URL");break;case"phone":if(typeof e!="string"||!ct(e))throw new P(s,l||`${s}은(는) 유효한 전화번호여야 합니다.`,"INVALID_PHONE");break;case"date":if(!(e instanceof Date)&&!ut(e))throw new P(s,l||`${s}은(는) 유효한 날짜여야 합니다.`,"INVALID_DATE");break;case"array":if(!Array.isArray(e))throw new P(s,l||`${s}은(는) 배열이어야 합니다.`,"INVALID_TYPE");break;case"object":if(typeof e!="object"||e===null||Array.isArray(e))throw new P(s,l||`${s}은(는) 객체여야 합니다.`,"INVALID_TYPE");break}if(typeof e=="string"){if(n!==void 0&&e.length<n)throw new P(s,l||`${s}은(는) 최소 ${n}자 이상이어야 합니다.`,"TOO_SHORT");if(o!==void 0&&e.length>o)throw new P(s,l||`${s}은(는) 최대 ${o}자 이하여야 합니다.`,"TOO_LONG")}if(typeof e=="number"){if(n!==void 0&&e<n)throw new P(s,l||`${s}은(는) 최소 ${n} 이상이어야 합니다.`,"TOO_SMALL");if(o!==void 0&&e>o)throw new P(s,l||`${s}은(는) 최대 ${o} 이하여야 합니다.`,"TOO_LARGE")}if(Array.isArray(e)){if(n!==void 0&&e.length<n)throw new P(s,l||`${s}은(는) 최소 ${n}개 이상이어야 합니다.`,"TOO_FEW");if(o!==void 0&&e.length>o)throw new P(s,l||`${s}은(는) 최대 ${o}개 이하여야 합니다.`,"TOO_MANY")}if(i&&typeof e=="string"&&!i.test(e))throw new P(s,l||`${s}의 형식이 올바르지 않습니다.`,"INVALID_FORMAT");if(c&&!c.includes(e))throw new P(s,l||`${s}은(는) 다음 중 하나여야 합니다: ${c.join(", ")}`,"INVALID_ENUM");if(u&&u(e)===!1)throw new P(s,l||`${s}의 값이 유효하지 않습니다.`,"CUSTOM_VALIDATION_FAILED")}}function at(e,t){for(const s of t){const r=e[s.field];tt(r,s)}}function nt(e){return async(t,s)=>{try{let r={};const a=t.req.header("content-type")||"";a.includes("application/json")?r=await t.req.json().catch(()=>({})):(a.includes("application/x-www-form-urlencoded")||a.includes("multipart/form-data"))&&(r=await t.req.parseBody().catch(()=>({})));const n=new URL(t.req.url);for(const[o,i]of n.searchParams.entries())o in r||(r[o]=i);at(r,e),t.set("validatedData",r),await s()}catch(r){if(r instanceof P)return t.json({success:!1,error:r.message,field:r.field,code:r.code},400);throw r}}}function ot(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=255}function it(e){try{const t=new URL(e);return t.protocol==="http:"||t.protocol==="https:"}catch{return!1}}function ct(e){return/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e)}function ut(e){if(typeof e!="string")return!1;const t=new Date(e);return!isNaN(t.getTime())}const lt=[{field:"email",required:!0,type:"email",max:255,message:"유효한 이메일 주소를 입력해주세요."},{field:"password",required:!0,type:"string",min:8,max:100,pattern:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:"비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다."},{field:"name",required:!0,type:"string",min:2,max:50,message:"이름은 2-50자 사이여야 합니다."},{field:"phone",required:!1,type:"phone",message:"유효한 전화번호를 입력해주세요. (예: 010-1234-5678)"}];function ss(e){const t=new URLSearchParams;for(const[s,r]of Object.entries(e))r!=null&&t.append(s,String(r));return t}function ls(e,t){if(e.result_code!=="1")throw new Error(`[Aligo ${t}] ${e.message} (code: ${e.result_code})`)}async function ds(e){console.log("[Aligo] 토큰 생성 시작");const s=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:ss({apikey:e.ALIGO_API_KEY,userid:e.ALIGO_USER_ID})})).json();return ls(s,"Token Create"),console.log("[Aligo] ✅ 토큰 생성 성공:",s.token.substring(0,20)+"..."),{token:s.token,urtime:s.urtime}}async function dt(e,t){console.log("[Aligo] 카카오 채널 등록:",t.channelId);const{token:s}=await ds(e),a=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:ss({token:s,userid:e.ALIGO_USER_ID,plusid:t.channelId,phonenumber:t.phoneNumber})})).json();return ls(a,"Channel Register"),console.log("[Aligo] ✅ 카카오 채널 등록 성공, senderKey:",a.senderkey),{success:!0,senderKey:a.senderkey}}async function pt(e,t,s){console.log("[Aligo] 템플릿 등록:",s.templateCode);const{token:r}=await ds(e),n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:ss({token:r,userid:e.ALIGO_USER_ID,senderkey:t,tpl_name:s.name,tpl_content:s.content,tpl_code:s.templateCode})})).json();return ls(n,"Template Register"),console.log("[Aligo] ✅ 템플릿 등록 성공:",n.tpl_code),{success:!0,templateCode:n.tpl_code}}async function mt(e,t){console.log("[Aligo] 알림톡 발송:",t.to);try{const{token:s}=await ds(e),r=t.buttons?JSON.stringify({button:t.buttons}):void 0,n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:ss({token:s,userid:e.ALIGO_USER_ID,senderkey:t.senderKey,tpl_code:t.templateCode,receiver_1:t.to,subject_1:"알림톡",message_1:t.message,button_1:r})})).json();return n.result_code!=="1"?(console.error("[Aligo] ❌ 알림톡 발송 실패:",n.message),{success:!1,error:n.message}):(console.log("[Aligo] ✅ 알림톡 발송 성공, messageId:",n.msg_id),{success:!0,messageId:n.msg_id})}catch(s){return console.error("[Aligo] ❌ 알림톡 발송 에러:",s.message),{success:!1,error:s.message}}}function _t(e,t){let s=e;for(const[r,a]of Object.entries(t)){const n=new RegExp(`#{${r}}`,"g");s=s.replace(n,a)}return s}function Ys(e){let t=e.replace(/-/g,"");if(!t.startsWith("010"))throw new Error("Invalid phone number format. Must start with 010");if(t.length!==11)throw new Error("Invalid phone number length. Must be 11 digits");return t}function ft(e){const t=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:t,message:"API Request",context:e,duration:e.duration}))}function Et(e){return{name:"tosspayments",async confirmPayment(t){try{const s=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:t.paymentKey,orderId:t.orderId,amount:t.amount})}),r=await s.json();if(!s.ok)return{success:!1,orderId:t.orderId,paymentKey:t.paymentKey,method:"",totalAmount:t.amount,status:"FAILED",approvedAt:"",error:r.message||"결제 승인 실패",rawData:r};let a={};r.card&&(a={cardCompany:r.card.company,cardNumber:r.card.number,installmentMonths:r.card.installmentPlanMonths||0});let n={};return r.virtualAccount&&(n={virtualAccountBank:r.virtualAccount.bankCode,virtualAccountNumber:r.virtualAccount.accountNumber,virtualAccountHolder:r.virtualAccount.customerName,virtualAccountDueDate:r.virtualAccount.dueDate}),{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,transactionId:r.transactionKey,...a,...n,rawData:r}}catch(s){return{success:!1,orderId:t.orderId,paymentKey:t.paymentKey,method:"",totalAmount:t.amount,status:"FAILED",approvedAt:"",error:s.message,rawData:null}}},async cancelPayment(t){try{const s={cancelReason:t.cancelReason};t.cancelAmount&&(s.cancelAmount=t.cancelAmount);const r=await fetch(`https://api.tosspayments.com/v1/payments/${t.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(s)}),a=await r.json();return r.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(s){return{success:!1,error:s.message}}},async getPayment(t){try{const s=await fetch(`https://api.tosspayments.com/v1/payments/${t}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),r=await s.json();if(!s.ok)throw new Error(r.message);return{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,rawData:r}}catch(s){throw s}}}}function ht(e,t){switch(e.toLowerCase()){case"tosspayments":return Et(t);default:throw new Error(`Unknown payment provider: ${e}`)}}const d=new Bs;d.use("*",async(e,t)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{xr(e.env),$r(e.env)}catch(r){console.error("[ENV] Validation failed:",r)}await t()});async function Z(e,t){if(!t)return null;try{const s=await e.get(`session:${t}`);if(!s)return null;const r=JSON.parse(s);return r.expires_at&&Date.now()>r.expires_at?(await e.delete(`session:${t}`),null):{user_id:r.user_id,user_type:r.user_type||"user"}}catch(s){return console.error("[Auth] Session lookup error:",s),null}}async function B(e,t){var n;const{SESSION_KV:s}=e.env;let r=e.req.header("X-Session-Token");if(r||(r=(n=e.req.header("Authorization"))==null?void 0:n.replace("Bearer ","")),!r){const o=e.req.header("Cookie");if(o){const i=o.match(/session=([^;]+)/);r=i?i[1]:void 0}}const a=await Z(s,r);if(!a)return e.json({success:!1,error:"인증이 필요합니다. 로그인 해주세요."},401);try{if(r){const o=await s.get(`session:${r}`);if(o){const i=JSON.parse(o),c=i.expires_at-Date.now(),u=10080*60*1e3;if(c<u){const l=Date.now()+2592e6;await s.put(`session:${r}`,JSON.stringify({...i,expires_at:l}),{expirationTtl:720*60*60}),console.log("[Auth] ✅ Session auto-renewed for user:",a.user_id,"- New expiration:",new Date(l).toISOString())}}}}catch(o){console.error("[Auth] Session renewal error:",o)}e.set("userId",a.user_id),e.set("userType",a.user_type),await t()}async function ps(e,t){try{const s=await e.get(t);return s?JSON.parse(s):null}catch(s){return console.error("[Cache] Read error:",s),null}}async function ms(e,t,s,r=60){try{await e.put(t,JSON.stringify(s),{expirationTtl:r})}catch(a){console.error("[Cache] Write error:",a)}}async function _s(e,...t){try{await Promise.all(t.map(s=>e.delete(s)))}catch(s){console.error("[Cache] Delete error:",s)}}async function Ve(e,t,s,r,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(t,s,r,a,n,o||null).run(),console.log(`[Notification] Created for ${s} ${t}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function gt(e,t,s,r,a){await Ve(e,t,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${r}님의 주문 (${s}) - ${wt(a)}`,"/seller/orders")}async function Js(e,t,s,r,a,n){let o="",i="";switch(r){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${s}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${s}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${s}가 배송 완료되었습니다`;break;default:return}await Ve(e,t,"user","shipping_status",o,i,"/my-orders")}async function yt(e,t,s,r,a){await Ve(e,t,"seller","low_stock","⚠️ 재고 부족 알림",`${s}의 재고가 ${r}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function wt(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function bt(e,t,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:t,description:s,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!r.ok){const p=await r.text();throw new Error(`YouTube Broadcast 생성 실패: ${p}`)}const n=(await r.json()).id,o=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${t} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!o.ok){const p=await o.text();throw new Error(`YouTube Stream 생성 실패: ${p}`)}const i=await o.json(),c=i.id,u=i.cdn.ingestionInfo.streamName,l=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:n,streamId:c,streamKey:u,streamUrl:l}}catch(r){throw console.error("[YouTube API] Live broadcast creation failed:",r),r}}async function Tt(e,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const s=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${t}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!s.ok){const r=await s.text();throw new Error(`YouTube 방송 종료 실패: ${r}`)}}catch(s){throw console.error("[YouTube API] Live broadcast end failed:",s),s}}async function St(e,t,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let r=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${t}&part=snippet,authorDetails`;s&&(r+=`&pageToken=${s}`);const a=await fetch(r,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const o=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${o}`)}const n=await a.json();return{messages:n.items||[],nextPageToken:n.nextPageToken,pollingIntervalMillis:n.pollingIntervalMillis||5e3}}catch(r){throw console.error("[YouTube API] Get chat messages failed:",r),r}}async function Rt(e,t){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const s=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},r=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${t}&key=${e.apiKey}`,a=await fetch(r,{headers:s});if(!a.ok){const u=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${u}`)}const n=await a.json();if(!n.items||n.items.length===0)throw new Error("Video not found");const o=n.items[0],i=o.statistics,c=o.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(s){throw console.error("[YouTube API] Get live stats failed:",s),s}}function zs(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const t=new URL(e);if(t.hostname.includes("youtube.com")){const s=t.searchParams.get("v");if(s)return s;const r=t.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(r)return r[2]}if(t.hostname==="youtu.be"){const s=t.pathname.slice(1).split("?")[0];if(s&&s.length===11)return s}return null}catch{return null}}function Gs(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){const s=t.pathname.match(/\/video\/(\d+)/);if(s)return s[1];const r=t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return t.hostname.includes("vm.tiktok.com")||t.hostname.includes("vt.tiktok.com")?t.pathname.slice(1):null}catch{return null}}function It(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){if(t.pathname.includes("/live"))return"live";if(t.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Xs(e){try{const t=new URL(e);if(t.hostname.includes("tiktok.com")){const s=t.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(s)return s[1]}return t.hostname.includes("vm.tiktok.com")||t.hostname.includes("vt.tiktok.com")?t.pathname.slice(1):null}catch{return null}}d.use("*",async(e,t)=>{await t(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const s=new URL(e.req.url);s.hostname!=="localhost"&&s.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});d.use("/api/*",b());d.use(We(Ke.auth));d.use(We(Ke.alimtalk));d.use(We(Ke.order));d.use(We(Ke.upload));d.use("/api/*",We(Ke.api));d.use("/api/*",async(e,t)=>{const s=Date.now(),r=e.req.method,a=e.req.path;await t();const n=Date.now()-s,o=e.res.status,i={method:r,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),ft(i)});d.use("/static/*",async(e,t)=>{await t(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});d.use("/images/*",async(e,t)=>{await t(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});async function Qs(e,t,s,r){const a=crypto.randomUUID(),n=Date.now()+1440*60*1e3,o={user_id:t,user_type:s,userData:r,expires_at:n};return await e.put(`session:${a}`,JSON.stringify(o),{expirationTtl:86400}),console.log(`[createSession] ✅ Session created for ${s} user ${t}`),a}async function Ae(e,t){const s=await e.get(`session:${t}`);if(!s)return null;const r=JSON.parse(s);return r.expires_at&&Date.now()>r.expires_at?(await e.delete(`session:${t}`),null):{session_token:t,[`${r.user_type}_id`]:r.user_id,user_type:r.user_type,...r.userData}}d.post("/api/auth/user/register",b(),nt(lt),async e=>{const{DB:t}=e.env;try{const{email:s,password:r,name:a,phone:n}=e.get("validatedData"),o=`placeholder_hash_for_${r}`;try{const c=(await t.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(s,o,a,n||null).run()).meta.last_row_id,u=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:u,user:{id:c,email:s,name:a,phone:n}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(s){return console.error("[User Register] Error:",s),e.json({success:!1,error:s.message||"회원가입 중 오류가 발생했습니다"},500)}});d.post("/api/auth/user/login",b(),async e=>{const{DB:t,SESSION_KV:s}=e.env;try{const{email:r,password:a}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await t.prepare("SELECT * FROM users WHERE email = ?").bind(r).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${a}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await t.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();const i=crypto.randomUUID(),c=Date.now()+1440*60*1e3;return await s.put(`session:${i}`,JSON.stringify({user_id:n.id,user_type:"user",expires_at:c}),{expirationTtl:1440*60}),console.log("[User Login] Session created in SESSION_KV for user:",n.id),e.json({success:!0,data:{session_token:i,user:{id:n.id,email:n.email,name:n.name,phone:n.phone,profile_image:n.profile_image}}})}catch(r){return console.error("[User Login] Error:",r),e.json({success:!1,error:r.message||"로그인 중 오류가 발생했습니다"},500)}});d.post("/api/auth/login",b(),async e=>{const{DB:t}=e.env;try{const{username:s,password:r,userType:a}=await e.req.json();if(!s||!r||!a)return e.json({success:!1,error:"아이디와 비밀번호를 입력해주세요"},400);let n,o=a==="admin"?"admins":"sellers";if(n=await t.prepare(`SELECT * FROM ${o} WHERE username = ? OR email = ?`).bind(s,s).first(),!n)return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);const i=a==="admin"&&(s==="admin"||s==="admin@example.com")&&r==="admin123",c=a==="seller"&&(s==="seller1"&&r==="seller123"||s==="seller2"&&r==="seller123"),u=n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${r}`);if(!(i||c||u))return e.json({success:!1,error:"아이디 또는 비밀번호가 일치하지 않습니다"},401);if(!n.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);if(a==="seller"&&n.status!=="approved")return e.json({success:!1,error:"승인 대기 중인 계정입니다"},403);const p=await Qs(e.env.SESSION_KV,n.id,a,{username:n.username,name:n.name,email:n.email,businessName:n.business_name,role:n.role});return await t.prepare(`UPDATE ${o} SET last_login_at = datetime('now') WHERE id = ?`).bind(n.id).run(),e.json({success:!0,data:{sessionToken:p,user:{id:n.id,username:n.username,name:n.name,email:n.email,type:a,businessName:n.business_name,role:n.role}}})}catch(s){return console.error("Login error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/auth/logout",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token");return s&&await e.env.SESSION_KV.delete(`session:${s}`),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.post("/api/seller/register",b(),async e=>{const{DB:t}=e.env;try{const{email:s,password:r,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!s||!r||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(r.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=s.split("@")[0],u=`placeholder_hash_for_${r}`;try{const l=await t.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,s,u,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:l.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(l){const p=l.message||"";if(p.includes("UNIQUE")||p.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw l}}catch(s){return console.error("Seller registration error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/admin/login",b(),async e=>{const{DB:t}=e.env;try{const{email:s,password:r}=await e.req.json();if(!s||!r)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await t.prepare("SELECT * FROM admins WHERE email = ?").bind(s).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(s==="admin@example.com"&&r==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${r}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=await Qs(e.env.SESSION_KV,a.id,"admin",{username:a.username,email:a.email,name:a.name,role:a.role});return await t.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),e.json({success:!0,data:{token:i,admin:{id:a.id,username:a.username,email:a.email,name:a.name,role:a.role}}})}catch(s){return console.error("Admin login error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/auth/verify",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await Ae(e.env.SESSION_KV,s);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=r.user_type==="admin"?"admins":"sellers",n=r.user_type==="admin"?r.admin_id:r.seller_id,o=await t.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:r.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name,role:o.role}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/auth/kakao/sync/callback",async e=>{var s,r,a,n,o,i,c,u,l,p,_,f,E;const{DB:t}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!t);const h=e.req.query("code"),g=e.req.query("state")||"/",w=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!h,state:g,error:w}),w)return console.error("[Kakao Sync] OAuth error:",w),e.redirect(`${g}?error=kakao_oauth_${w}`);if(!h)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${g}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const y=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",j=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",y.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",j),console.log("[Kakao Sync] Step 1: Fetching access token...");const k=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:y,redirect_uri:j,code:h})});if(console.log("[Kakao Sync] Token response status:",k.status),console.log("[Kakao Sync] Token request details:",{client_id:y,redirect_uri:j,code_length:h.length,code_prefix:h.substring(0,20)}),!k.ok){const W=await k.text();return console.error("[Kakao Sync] Token request failed:",W),e.redirect(`${g}?error=token_request_failed&detail=${encodeURIComponent(W)}`)}const T=await k.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!T.access_token,error:T.error,errorDescription:T.error_description}),!T.access_token)return console.error("[Kakao Sync] Token error:",T),e.redirect(`${g}?error=token_failed&detail=${encodeURIComponent(T.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const A=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${T.access_token}`}});console.log("[Kakao Sync] User response status:",A.status);const C=await A.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!C.id,id:C.id,hasNickname:!!((s=C.properties)!=null&&s.nickname||(a=(r=C.kakao_account)==null?void 0:r.profile)!=null&&a.nickname)}),!C.id)return console.error("[Kakao Sync] Failed to get user info:",C),e.redirect(`${g}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const I=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${T.access_token}`}});console.log("[Kakao Sync] Terms response status:",I.status);let N=null;if(I.ok?(N=await I.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=N.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=N.allowed_service_terms)==null?void 0:o.map(W=>W.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!t)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${g}?error=db_not_available`);const $=C.id.toString(),L=((i=C.properties)==null?void 0:i.nickname)||((u=(c=C.kakao_account)==null?void 0:c.profile)==null?void 0:u.nickname)||"Kakao User",X=((l=C.kakao_account)==null?void 0:l.email)||"",Q=((p=C.properties)==null?void 0:p.profile_image)||((f=(_=C.kakao_account)==null?void 0:_.profile)==null?void 0:f.profile_image_url)||"",Ce=T.access_token,q=((E=N==null?void 0:N.allowed_service_terms)==null?void 0:E.map(W=>W.tag))||[],pe=JSON.stringify(q);console.log("[Kakao Sync] User data:",{kakaoId:$,nickname:L,email:X?"exists":"none",serviceTerms:q});try{const W=await t.prepare("SELECT * FROM users WHERE kakao_id = ?").bind($).first();console.log("[Kakao Sync] Existing user check:",!!W);let ee;W?(ee=W.id,await t.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L,X,Q,ee).run(),console.log("[Kakao Sync] Updated user:",ee)):(ee=(await t.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind($,L,X||null,Q||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",ee)),console.log("[Kakao Sync] User saved successfully, userId:",ee),console.log("[Kakao Sync] Step 4: Creating session...");const{SESSION_KV:sr}=e.env,rs=crypto.randomUUID(),rr=Date.now()+1440*60*1e3;await sr.put(`session:${rs}`,JSON.stringify({user_id:ee,user_type:"user",expires_at:rr}),{expirationTtl:1440*60}),console.log("[Kakao Sync] Session created successfully in SESSION_KV"),console.log("[Kakao Sync] Step 5: Redirecting...");const fs=g.includes("?")?`${g}&login=success&session=${rs}&userId=${ee}&userName=${encodeURIComponent(L)}`:`${g}?login=success&session=${rs}&userId=${ee}&userName=${encodeURIComponent(L)}`;return console.log("[Kakao Sync] Redirect URL:",fs),e.redirect(fs)}catch(W){return console.error("[Kakao Sync] Database error:",W),console.error("[Kakao Sync] DB error details:",{message:W.message,name:W.name}),e.redirect(`${g}?error=database_error&detail=${encodeURIComponent(W.message)}`)}}catch(h){console.error("[Kakao Sync] Exception:",h),console.error("[Kakao Sync] Error details:",{message:h.message,stack:h.stack,name:h.name});const g=e.req.query("state")||"/",w=encodeURIComponent(h.message||"unknown");return e.redirect(`${g}?error=kakao_sync_failed&detail=${w}`)}});d.post("/api/auth/kakao/callback",b(),async e=>{const{DB:t}=e.env;try{const{code:s,redirect_uri:r}=await e.req.json();if(!s)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=r||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow");const n=await Zr(s,a,e.env.KAKAO_REST_API_KEY),{user:o,sessionToken:i}=await Ks(t,n),c=Date.now()+720*60*60*1e3;return await e.env.SESSION_KV.put(`session:${i}`,JSON.stringify({user_id:o.id,user_type:"user",expires_at:c}),{expirationTtl:720*60*60}),console.log("[Kakao Callback] ✅ Session saved to SESSION_KV for user:",o.id,"- Expires:",new Date(c).toISOString()),e.json({success:!0,data:{session_token:i,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image}}})}catch(s){return console.error("[Kakao Callback] Error:",s),s instanceof Y?e.json({success:!1,error:s.message,code:s.code},s.statusCode):e.json({success:!1,error:s.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});d.post("/api/auth/kakao/sync",b(),async e=>{const{DB:t}=e.env;try{const{accessToken:s}=await e.req.json();if(!s)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Sync] Verifying access token");const r=Date.now(),{user:a,sessionToken:n}=await Ks(t,s);console.log("[Kakao Sync] ProcessKakaoLogin completed in",Date.now()-r,"ms");const o=Date.now()+720*60*60*1e3,i=Date.now();return await e.env.SESSION_KV.put(`session:${n}`,JSON.stringify({user_id:a.id,user_type:"user",expires_at:o}),{expirationTtl:720*60*60}),console.log("[Kakao Sync] ✅ Session saved to SESSION_KV in",Date.now()-i,"ms"),console.log("[Kakao Sync] Total login time:",Date.now()-r,"ms"),e.json({success:!0,data:{session_token:n,user:{id:a.id,name:a.name,email:a.email,profile_image:a.profile_image}}})}catch(s){return console.error("[Kakao Sync] Error:",s),s instanceof Y?e.json({success:!1,error:s.message,code:s.code},s.statusCode):e.json({success:!1,error:s instanceof Error?s.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});d.get("/api/auth/validate",b(),async e=>{var s;const{SESSION_KV:t}=e.env;try{const r=e.req.header("X-Session-Token")||((s=e.req.header("Authorization"))==null?void 0:s.replace("Bearer ",""))||"";if(!r)return e.json({success:!1,error:"No session token provided",code:"NO_TOKEN"},401);const a=await Z(t,r);return a?e.json({success:!0,data:{user_id:a.user_id,user_type:a.user_type,session_valid:!0}}):e.json({success:!1,error:"Session expired or invalid",code:"SESSION_EXPIRED"},401)}catch(r){return console.error("[Auth Validate] Error:",r),e.json({success:!1,error:"Validation failed",code:"VALIDATION_ERROR"},500)}});d.post("/api/auth/kakao/logout",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token")||"";return s&&(await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(s){return console.error("[Kakao Sync] Logout error:",s),e.json({success:!1,error:"Logout failed"},500)}});d.post("/api/auth/kakao/unlink",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await t.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(s).first())return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await t.prepare(`
      SELECT * FROM users WHERE id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(s).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404);if(console.log("[Kakao Unlink] User found:",a.id),a.access_token)try{console.log("[Kakao Unlink] Calling Kakao unlink API...");const n=await fetch("https://kapi.kakao.com/v1/user/unlink",{method:"POST",headers:{Authorization:`Bearer ${a.access_token}`,"Content-Type":"application/x-www-form-urlencoded"}}),o=await n.json();n.ok?console.log("[Kakao Unlink] Kakao unlink successful:",o.id):console.warn("[Kakao Unlink] Kakao unlink failed:",o)}catch(n){console.error("[Kakao Unlink] Kakao API error:",n)}else console.warn("[Kakao Unlink] No access token found, skipping Kakao API call");return console.log("[Kakao Unlink] Deleting user data from DB..."),await t.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(s).run(),console.log("[Kakao Unlink] Sessions deleted"),await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(a.id).run(),console.log("[Kakao Unlink] Cart items deleted"),await t.prepare("DELETE FROM users WHERE id = ?").bind(a.id).run(),console.log("[Kakao Unlink] User deleted"),console.log("[Kakao Unlink] Unlink process completed successfully"),e.json({success:!0,message:"회원 탈퇴가 완료되었습니다"})}catch(s){return console.error("[Kakao Unlink] Error:",s),e.json({success:!1,error:"회원 탈퇴 처리 중 오류가 발생했습니다"},500)}});d.post("/webhooks/kakao/unlink",async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),{user_id:r,referrer_type:a}=s;if(console.log("[Kakao Webhook] Unlink notification received:",{user_id:r,referrer_type:a}),!r)return e.json({success:!1,error:"user_id is required"},400);const n=await t.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(r.toString()).first();return n?(console.log("[Kakao Webhook] Deleting user data for user:",n.id),await t.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run(),await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await t.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",r),e.json({success:!0}))}catch(s){return console.error("[Kakao Webhook] Error:",s),e.json({success:!1,error:"Webhook processing failed"},500)}});d.get("/api/auth/user/verify",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await Ae(e.env.SESSION_KV,s);if(!r||r.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=parseInt(s.split("_")[1]),n=await t.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();return n?e.json({success:!0,data:{user:{id:n.id,name:n.name,email:n.email,profileImage:n.profile_image,phone:n.phone}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/shipping-addresses",b(),B,async e=>{const{DB:t}=e.env,s=e.get("userId");try{const r=await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(s).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/shipping-addresses/:userId",b(),B,async e=>{const{DB:t}=e.env,s=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==s)return e.json({success:!1,error:"본인의 배송지만 조회할 수 있습니다."},403);const a=await t.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(s).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/shipping-addresses",b(),async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),r=s.user_id,a=s.recipient_name,n=s.phone,o=s.postal_code,i=s.address,c=s.address_detail,u=s.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(s)),!r||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:r,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);u&&await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();const l=await t.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a,n,o||"",i,c||"",u?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:l.meta.last_row_id}),e.json({success:!0,data:{id:l.meta.last_row_id}})}catch(s){return console.error("[POST /api/shipping-addresses] Error:",s),e.json({success:!1,error:s.message},500)}});d.put("/api/shipping-addresses/:id",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=await e.req.json(),a=r.user_id,n=r.recipient_name,o=r.phone,i=r.postal_code,c=r.address,u=r.address_detail,l=r.is_default;return l&&await t.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await t.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,u||"",l?1:0,s,a).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.delete("/api/shipping-addresses/:id",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=e.req.query("userId");return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(s,r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});async function M(e){const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const s=await Ae(e.env.SESSION_KV,t);return!s||s.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:s.admin_id,userData:s}}async function O(e){const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const s=await Ae(e.env.SESSION_KV,t);return!s||s.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:s.seller_id,userData:s}}d.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));d.get("/api/test/env",async e=>{try{const t=await Br(e.env);return e.json(t)}catch(t){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:t instanceof Error?t.message:String(t)},500)}});d.get("/api/streams",async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const r="streams:live",a=await s.get(r,"json");if(a)return e.json({success:!0,data:a,cached:!0});const n=await t.prepare("SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC").bind("live").all();return await s.put(r,JSON.stringify(n.results),{expirationTtl:600}),e.json({success:!0,data:n.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/streams/:id",async e=>{const{DB:t}=e.env,s=e.req.param("id");try{const r=await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(s).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/live-streams",async e=>{const{DB:t}=e.env,{status:s,seller_id:r,limit:a="20",offset:n="0"}=e.req.query();try{let o=`
      SELECT ls.*, 
             s.display_name as seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE 1=1
    `;const i=[];s&&(o+=" AND ls.status = ?",i.push(s)),r&&(o+=" AND ls.seller_id = ?",i.push(r)),o+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',o+=" LIMIT ? OFFSET ?",i.push(parseInt(a),parseInt(n));const{results:c}=await t.prepare(o).bind(...i).all();return e.json({success:!0,data:c})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});d.get("/api/live-streams/:id",async e=>{const{DB:t}=e.env,s=e.req.param("id");try{const r=await t.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(s).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/products",async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const r=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${r||"all"}:${a}:${n}`,i=await ps(s,o);if(i)return e.json({success:!0,data:i,cached:!0});let c;r==="true"?c=`
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
      `;const l=(await t.prepare(c).bind(a,n).all()).results||[];return await ms(s,o,l,300),e.json({success:!0,data:l,cached:!1})}catch(r){return console.error("Products list error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/products/popular",async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const r=await ps(s,"products:popular");if(r)return e.json({success:!0,data:r,cached:!0});const n=(await t.prepare(`
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
    `).all()).results||[];return await ms(s,"products:popular",n,600),e.json({success:!0,data:n,cached:!1})}catch(r){return console.error("Popular products error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/search/suggestions",async e=>{const{DB:t}=e.env;try{const s=e.req.query("q")||"";if(!s.trim()||s.length<2)return e.json({success:!0,data:{suggestions:[]}});const r=`%${s}%`,a=await t.prepare(`
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
    `).bind(r,r).all(),o=[...(a.results||[]).map(i=>({type:"product",text:i.name})),...(n.results||[]).map(i=>({type:"seller",text:i.display_name}))];return e.json({success:!0,data:{suggestions:o}})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/products/search",async e=>{const{DB:t}=e.env;try{const s=e.req.query("q")||"",r=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0");if(!s.trim())return e.json({success:!1,error:"Search query is required"},400);const n=`%${s}%`,o=await t.prepare(`
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
    `).bind(n,n,n,r,a).all(),i=await t.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
    `).bind(n,n,n).first();return e.json({success:!0,data:{products:o.results||[],total:(i==null?void 0:i.total)||0,query:s,limit:r,offset:a}})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/products/:id",async e=>{const{DB:t}=e.env,s=e.req.param("id");try{const r=await t.prepare(`
      SELECT 
        p.*,
        COALESCE(s.name, s.username, 'UR Live') as seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ? AND p.is_active = 1
    `).bind(s).first();if(!r)return e.json({success:!1,error:"Product not found"},404);const a=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(s).all();return e.json({success:!0,data:{product:r,options:a.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/products/:id/stock",async e=>{const{DB:t}=e.env,s=e.req.param("id");try{const r=await t.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(s).first();return r?e.json({success:!0,data:{productId:r.id,productName:r.name,stock:r.stock,available:r.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/streams/:streamId/products",async e=>{const{DB:t}=e.env,s=e.req.param("streamId");try{const r=await t.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(s).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/cart",B,async e=>{const{DB:t}=e.env,s=e.get("userId");try{const r=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:`장바구니 조회 실패: ${r.message}`},500)}});d.get("/api/cart/:userId",B,async e=>{const{DB:t}=e.env,s=e.get("userId"),r=e.req.param("userId");try{let a=await t.prepare("SELECT id FROM users WHERE id = ?").bind(s).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(r!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await t.prepare(`
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
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/users",async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),{kakaoId:r,name:a,email:n,phone:o}=s;if(!r||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(r).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await t.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(r,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(s){return console.error("Error creating user:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/cart",async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),{userId:r,kakaoId:a,productId:n,optionId:o,quantity:i,priceSnapshot:c,liveStreamId:u}=s,l=a||r;if(!l)return e.json({success:!1,error:"userId or kakaoId is required"},400);let p=await t.prepare("SELECT id FROM users WHERE id = ?").bind(l).first();if(p||(p=await t.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(l).first()),!p)return e.json({success:!1,error:"User not found"},404);const _=p.id,f=await t.prepare("SELECT stock FROM products WHERE id = ?").bind(n).first();if(!f||f.stock<i)return e.json({success:!1,error:"Insufficient stock"},400);const E=await t.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(_,n,o||null,o||null).first();let h;if(E){const g=E.quantity+i;await t.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(g,c,E.id).run(),h=E.id}else h=(await t.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(_,n,o||null,i,c,u||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:h,isUpdate:!!E}})}catch(s){return console.error("[API /api/cart POST] Error:",s),console.error("[API /api/cart POST] Error message:",s.message),console.error("[API /api/cart POST] Error stack:",s.stack),e.json({success:!1,error:"Failed to add to cart: "+(s.message||"Unknown error")},500)}});d.delete("/api/cart/:cartItemId",async e=>{const{DB:t}=e.env,s=e.req.param("cartItemId");try{return await t.prepare("DELETE FROM cart_items WHERE id = ?").bind(s).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/cart/clear/:userId",async e=>{const{DB:t}=e.env,s=e.req.param("userId");try{return await t.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(s).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/cart/:cartItemId",async e=>{const{DB:t}=e.env,s=e.req.param("cartItemId");try{const r=await e.req.json(),{quantity:a}=r;if(!a||a<1)return e.json({success:!1,error:"Invalid quantity"},400);const n=await t.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(s).first();return n?n.stock<a?e.json({success:!1,error:"Insufficient stock"},400):(await t.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,s).run(),e.json({success:!0})):e.json({success:!1,error:"Cart item not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/orders",async e=>{const{DB:t}=e.env;try{const s=await e.req.json(),{userId:r,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:u,recipientPhone:l,deliveryMemo:p,totalAmount:_,shippingFee:f,orderNumber:E,paymentKey:h,paymentMethod:g}=s;if(o&&o.length>0){const I=[];for(const q of o){const pe=await t.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind(q.productId).first();if(!pe)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${q.productId})`},400);if(pe.stock<q.quantity)return e.json({success:!1,error:`재고 부족: ${pe.name} (남은 재고: ${pe.stock}개)`},400);I.push({product_id:q.productId,option_id:q.optionId||null,quantity:q.quantity,price:q.price,product_name:pe.name,product_stock:pe.stock})}const N=Date.now(),$=Math.random().toString(36).substring(2,8).toUpperCase(),L=E||`ORDER_${N}_${$}`,X=c?`${i} ${c}`:i,Ce=(await t.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(L,r||null,_||0,"pending","pending",X||null,u||null,l||null,p||null,h||null).run()).meta.last_row_id;for(const q of I)await t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(Ce,q.product_id,q.option_id,q.quantity,q.price,q.product_name).run();return e.json({success:!0,data:{orderId:Ce,orderNumber:L,totalAmount:_}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const w=a.map(()=>"?").join(","),y=await t.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${w})
    `).bind(...a).all();if(y.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const I of y.results)if(I.product_stock<I.quantity)return e.json({success:!1,error:`Insufficient stock for ${I.product_name}`},400);const j=y.results.reduce((I,N)=>I+N.price_snapshot*N.quantity,0),k=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,A=(await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(k,r,j,n.address,n.name,n.phone).run()).meta.last_row_id,C=[];for(const I of y.results){let N=!1,$="";for(let L=0;L<3;L++){if((await t.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND stock >= ?
            AND is_active = 1
        `).bind(I.quantity,I.product_id,I.quantity).run()).meta.changes>0){N=!0;break}const Q=await t.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(I.product_id).first();if(!Q||Q.stock<I.quantity){$=`재고 부족: ${I.product_name} (남은 재고: ${(Q==null?void 0:Q.stock)||0}개)`;break}L<2?await new Promise(Ce=>setTimeout(Ce,50*L)):$="주문 처리 중 오류 발생. 다시 시도해주세요. (동시성 충돌)"}if(!N)return e.json({success:!1,error:$||"주문 처리 중 오류가 발생했습니다."},$.includes("재고 부족")?400:409);C.push(t.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(A,I.product_id,I.option_id,I.quantity,I.price_snapshot,I.product_name))}C.push(t.prepare(`DELETE FROM cart_items WHERE id IN (${w})`).bind(...a)),await t.batch(C);try{const I=new Set;for(const N of y.results){const $=await t.prepare("SELECT seller_id FROM products WHERE id = ?").bind(N.product_id).first();$&&$.seller_id&&I.add($.seller_id)}for(const N of I)await gt(t,N,k,buyerName||shippingName||"고객",j)}catch(I){console.error("[Order] Notification error:",I)}return e.json({success:!0,data:{orderId:A,orderNumber:k,totalAmount:j}})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/streams/:streamId/current-product",async e=>{const{DB:t,LIVE_CACHE:s}=e.env,r=e.req.param("streamId");try{const a=`current-product:${r}`,n=await Vs(s,a,3);if(n)return e.json({success:!0,data:n});const o=await t.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();if(!o||!o.current_product_id)return await Qe(s,a,null,3),e.json({success:!0,data:null});const i=await t.prepare("SELECT * FROM products WHERE id = ?").bind(o.current_product_id).first(),c=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(),u={product:i,options:c.results};return await Qe(s,a,u,3),e.json({success:!0,data:u})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:t}=e.env,s=e.req.param("streamId"),r=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${s}`,n=`current-product:${s}`,o=25e3,i=Date.now();for(;Date.now()-i<o;){const c=await t.get(a)||"0";if(c!==r){const u=await Vs(t,n,30);return e.json({success:!0,timestamp:c,data:u,changed:!0})}await new Promise(u=>setTimeout(u,1e3))}return e.json({success:!0,timestamp:r,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/streams",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=s.sellerId,a=await t.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading seller streams:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/streams",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:r,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:u,seller_instagram:l,seller_youtube:p,seller_facebook:_}=await e.req.json();let f=n,E="youtube",h=null,g=null,w=i;if(o&&!f&&(f=zs(o),!f))if(f=Gs(o),h=Xs(o),g=It(o),f)E="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!w&&f&&E==="youtube"&&(w=`https://img.youtube.com/vi/${f}/maxresdefault.jpg`),!r||!f)return e.json({success:!1,error:"Title and live stream URL are required"},400);const y=await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,f,u||"scheduled",c||null,s.sellerId,l||null,p||null,_||null,E,h,g,w||null).run(),j=await t.prepare("SELECT * FROM live_streams WHERE id = ?").bind(y.meta.last_row_id).first(),k=await t.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(s.sellerId).first();try{const{sendLiveStreamCreatedEmail:T}=await Promise.resolve().then(()=>kt);T({streamId:y.meta.last_row_id,title:r,sellerName:(k==null?void 0:k.display_name)||(k==null?void 0:k.username)||"알 수 없음",platform:E,scheduledAt:c,status:u||"scheduled"}).then(A=>{A.success?console.log(`[Email] Live stream notification sent for stream #${A.meta.last_row_id}`):console.error("[Email] Failed to send notification:",A.error)}).catch(A=>{console.error("[Email] Exception while sending notification:",A)})}catch(T){console.error("[Email] Failed to send live stream notification:",T)}return e.json({success:!0,data:j})}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/seller/streams/:id",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:u,status:l,seller_instagram:p,seller_youtube:_,seller_facebook:f}=await e.req.json(),E=[],h=[];if(n!==void 0&&(E.push("title = ?"),h.push(n)),o!==void 0&&(E.push("description = ?"),h.push(o)),c!==void 0||i!==void 0){let g=i,w="youtube",y=null;if(c&&(g=zs(c),!g))if(g=Gs(c),y=Xs(c),g)w="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);g!==void 0&&(E.push("youtube_video_id = ?"),h.push(g),E.push("platform = ?"),h.push(w),w==="tiktok"&&y&&(E.push("tiktok_username = ?"),h.push(y)))}return l!==void 0&&(E.push("status = ?"),h.push(l)),u!==void 0&&(E.push("scheduled_at = ?"),h.push(u)),p!==void 0&&(E.push("seller_instagram = ?"),h.push(p)),_!==void 0&&(E.push("seller_youtube = ?"),h.push(_)),f!==void 0&&(E.push("seller_facebook = ?"),h.push(f)),E.length===0?e.json({success:!1,error:"No fields to update"},400):(E.push("updated_at = datetime('now')"),await t.prepare(`
      UPDATE live_streams SET ${E.join(", ")} WHERE id = ?
    `).bind(...h,r).run(),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/seller/streams/:id",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");return await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first()?(await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/seller/youtube/create-live",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:r,description:a,scheduled_at:n}=await e.req.json();if(!r)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await bt({accessToken:o},r,a||""),u=(await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,i.broadcastId,n||null,s.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await Ve(t,s.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${r} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${u}`),e.json({success:!0,data:{streamId:u,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(r){return console.error("[YouTube Live] Create broadcast error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("streamId"),a=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const o=a.youtube_broadcast_id||a.youtube_video_id;return o?(await Tt({accessToken:n},o),await t.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await Ve(t,s.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(r){return console.error("[YouTube Live] End broadcast error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("streamId"),a=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=a.youtube_video_id;if(!n)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const o=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!o&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await Rt({apiKey:o,accessToken:i},n);return e.json({success:!0,data:{streamId:r,videoId:n,stats:c}})}catch(r){return console.error("[YouTube Live] Get stats error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("streamId"),a=e.req.query("pageToken"),n=await t.prepare("SELECT * FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first();if(!n)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=n.youtube_live_chat_id;if(!o)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await St({accessToken:i},o,a);return e.json({success:!0,data:c})}catch(r){return console.error("[YouTube Live] Get chat messages error:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/admin/streams",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{title:r,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!r)return e.json({success:!1,error:"제목은 필수입니다"},400);const u=o||"youtube";if(u==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(u==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const l=await t.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r,a||null,n||null,u,i||null,c||"scheduled",s.sellerId||null).run();return e.json({success:!0,data:{id:l.meta.last_row_id,title:r,description:a,youtube_video_id:n,platform:u,tiktok_username:i,status:c||"scheduled"}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/admin/streams/:id",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:u}=await e.req.json();return await t.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,u,r).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1").bind(a,s.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(a).all();await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,r).run();const{LIVE_CACHE:c}=e.env,u=`product-timestamp:${r}`,l=`current-product:${r}`,p=Date.now().toString();return await c.put(u,p),await Qe(c,l,{product:o,options:i.results},30),e.json({success:!0,data:{product:o,options:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/admin/streams/:id",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");return await t.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:t}=e.env,s=e.req.param("streamId");try{const{productId:r}=await e.req.json(),a=await t.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await t.prepare("SELECT * FROM product_options WHERE product_id = ?").bind(r).all();await t.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r,s).run();const{LIVE_CACHE:o}=e.env,i=`product-timestamp:${s}`,c=`current-product:${s}`,u=Date.now().toString();return await o.put(i,u),await Qe(o,c,{product:a,options:n.results},30),e.json({success:!0,data:{product:a,options:n.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/wishlists",b(),async e=>{const{DB:t}=e.env;try{const{userId:s,productId:r}=await e.req.json();if(!s||!r)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await t.prepare("SELECT id FROM users WHERE id = ?").bind(s).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const n=await t.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!n)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s,r).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await t.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(s,r).run();return e.json({success:!0,data:{id:i.meta.last_row_id,userId:s,productId:r,productName:n.name}})}catch(s){return console.error("[Wishlist] Add error:",s),e.json({success:!1,error:s.message},500)}});d.delete("/api/wishlists/:id",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),{userId:r}=e.req.query();return r?await t.prepare("SELECT id FROM wishlists WHERE id = ? AND user_id = ?").bind(s,r).first()?(await t.prepare("DELETE FROM wishlists WHERE id = ? AND user_id = ?").bind(s,r).run(),e.json({success:!0,message:"찜 목록에서 삭제되었습니다."})):e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(s){return console.error("[Wishlist] Delete error:",s),e.json({success:!1,error:s.message},500)}});d.delete("/api/wishlists/product/:productId",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("productId"),{userId:r}=e.req.query();return r?(await t.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").bind(r,s).run()).meta.changes===0?e.json({success:!1,error:"찜 목록에서 찾을 수 없습니다."},404):e.json({success:!0,message:"찜 목록에서 삭제되었습니다."}):e.json({success:!1,error:"사용자 ID가 필요합니다."},400)}catch(s){return console.error("[Wishlist] Delete by product error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/wishlists/:userId",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("userId"),r=parseInt(e.req.query("limit")||"20"),a=parseInt(e.req.query("offset")||"0"),{results:n}=await t.prepare(`
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
    `).bind(s,r,a).all(),o=await t.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(s).first();return e.json({success:!0,data:{items:n,total:(o==null?void 0:o.count)||0,limit:r,offset:a}})}catch(s){return console.error("[Wishlist] Get error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/wishlists/check/:userId/:productId",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("userId"),r=e.req.param("productId"),a=await t.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(s,r).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(s){return console.error("[Wishlist] Check error:",s),e.json({success:!1,error:s.message},500)}});d.delete("/api/shipping-addresses/:id",B,async e=>{const{DB:t}=e.env,s=e.req.param("id");e.get("userId");try{return await t.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(s,userId).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/seller/products",async e=>{const{DB:t,CACHE_KV:s}=e.env,r=await O(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:products`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(r.sellerId).all();return await s.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/seller/upload-image",async e=>{var r;const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{image:a,filename:n}=await e.req.json();if(!a)return e.json({success:!1,error:"Image data is required"},400);const o=e.env.IMAGES;if(o){console.log("[Image Upload] Using R2 storage");const i=a.replace(/^data:image\/\w+;base64,/,""),c=Uint8Array.from(atob(i),_=>_.charCodeAt(0)),u=(n==null?void 0:n.split(".").pop())||"jpg",l=`products/${s.sellerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${u}`;await o.put(l,c,{httpMetadata:{contentType:((r=a.match(/^data:(image\/\w+);base64,/))==null?void 0:r[1])||"image/jpeg"}});const p=`/api/images/${l}`;return e.json({success:!0,url:p,storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),a.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:a,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(a){return console.error("[Image Upload] Error:",a),e.json({success:!1,error:a.message},500)}});d.get("/api/images/*",async e=>{var t;try{const s=e.env.IMAGES;if(!s)return e.json({success:!1,error:"R2 not configured"},503);const r=e.req.path.replace("/api/images/",""),a=await s.get(r);return a?new Response(a.body,{headers:{"Content-Type":((t=a.httpMetadata)==null?void 0:t.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"}}):e.notFound()}catch(s){return console.error("[Image Get] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/products",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{name:r,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:u,category:l,live_stream_id:p,is_active:_}=await e.req.json();if(!r||!n)return e.json({success:!1,error:"Name and price are required"},400);if(p&&!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(p,s.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const f=await t.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,n,o||null,i||0,c||null,u||0,l||null,p||null,s.sellerId,_!==void 0?_:1).run(),E=await t.prepare("SELECT * FROM products WHERE id = ?").bind(f.meta.last_row_id).first();return await _s(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0,data:E})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/seller/products/:id",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=await t.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(r,s.sellerId).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/seller/products/:id",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:u,stock:l,category:p,is_active:_}=await e.req.json(),f=[],E=[];if(n!==void 0&&(f.push("name = ?"),E.push(n)),o!==void 0&&(f.push("description = ?"),E.push(o)),i!==void 0&&(f.push("price = ?"),E.push(i)),c!==void 0&&(f.push("original_price = ?"),E.push(c),i!==void 0&&c)){const g=Math.round((c-i)/c*100);f.push("discount_rate = ?"),E.push(g)}if(u!==void 0&&(f.push("image_url = ?"),E.push(u)),l!==void 0&&(f.push("stock = ?"),E.push(l)),p!==void 0&&(f.push("category = ?"),E.push(p)),_!==void 0&&(f.push("is_active = ?"),E.push(_?1:0)),f.push("updated_at = CURRENT_TIMESTAMP"),E.push(r,s.sellerId),f.length===1)return e.json({success:!1,error:"No fields to update"},400);await t.prepare(`UPDATE products SET ${f.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...E).run();const h=await t.prepare("SELECT * FROM products WHERE id = ?").bind(r).first();return await _s(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0,data:h})}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/seller/products/:id",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await t.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await t.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(),await t.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(),await t.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(),await t.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).run(),await _s(e.env.CACHE_KV,`seller:${s.sellerId}:products`,`public:seller:${s.sellerId}`),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await t.prepare("SELECT * FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();return e.json({success:!0,data:n.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/seller/products/:id/options",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id");if(!await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const u=await t.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:u.meta.last_row_id,product_id:r,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("productId"),a=e.req.param("optionId");return await t.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(r,s.sellerId).first()?(await t.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,r).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/seller/stats",async e=>{const{DB:t,CACHE_KV:s}=e.env,r=await O(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:stats`,n=await s.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(),i=await t.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(),c=await t.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(),u=await t.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(r.sellerId).first(),l=await t.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(r.sellerId).first(),_={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:u.count||0,totalRevenue:u.total||0,activeStreams:l.count||0,totalViewers:0};return await s.put(a,JSON.stringify(_),{expirationTtl:60}),e.json({success:!0,data:_})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/stats/sales",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.query("period")||"daily";let a,n,o;switch(r){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await t.prepare(`
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
    `).bind(s.sellerId).all();return e.json({success:!0,data:{period:r,sales:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/seller/stats/products",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await t.prepare(`
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
    `).bind(s.sellerId,r).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/seller/business-info",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{business_number:r,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:u,phone:l,email:p}=await e.req.json();if(!r||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const _=await t.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();let f;return _?f=await t.prepare(`
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
      `).bind(r,a,n,o,i,c,u,l,p,s.sellerId).run():f=await t.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(s.sellerId,r,a,n,o,i,c,u,l,p).run(),e.json({success:!0,data:{id:_?_.id:f.meta.last_row_id,seller_id:s.sellerId,business_number:r,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(r){return console.error("사업자 정보 등록 오류:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/business-info",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(s.sellerId).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);const r=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await t.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});d.get("/api/admin/seller-business",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();return e.json({success:!0,data:r.results||[]})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/orders",B,async e=>{const{DB:t}=e.env,s=e.get("userId");try{const r=await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(s).all(),a=await Promise.all(r.results.map(async n=>{const o=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(n.id).all();return{...n,items:o.results}}));return e.json({success:!0,data:a})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/orders/user/:userId",B,async e=>{const{DB:t}=e.env,s=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==s)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await t.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(s).all(),n=await Promise.all(a.results.map(async o=>{const i=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(o.id).all();return{...o,items:i.results}}));return e.json({success:!0,data:n})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/orders/:orderNumber",async e=>{const{DB:t}=e.env,s=e.req.param("orderNumber");try{const r=await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(s).first();if(!r)return e.json({success:!1,error:"Order not found"},404);const a=await t.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(r.id).all();return e.json({success:!0,data:{...r,items:a.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/orders/:orderId/cancel",async e=>{const{DB:t}=e.env,s=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await t.prepare("SELECT * FROM orders WHERE id = ?").bind(s).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(s).all();for(const i of o.results)await t.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.quantity,i.product_id).run();return await t.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,s).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:s,reason:a,itemsRestored:o.results.length}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:t}=e.env;try{const s=e.req.param("streamId"),r=await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(s).first();return r?e.json({success:!0,data:{viewer_count:r.viewer_count||0}}):e.json({success:!1,error:"Stream not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.put("/api/streams/:streamId/viewer-count",async e=>{const{DB:t}=e.env,s=await M(e),r=s.success?{success:!1}:await O(e);if(!s.success&&!r.success)return e.json({success:!1,error:"Unauthorized"},401);try{const a=e.req.param("streamId"),{viewer_count:n}=await e.req.json();return typeof n!="number"||n<0?e.json({success:!1,error:"Invalid viewer count"},400):r.success&&!await t.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a,r.sellerId).first()?e.json({success:!1,error:"Stream not found or unauthorized"},404):(await t.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{viewer_count:n}}))}catch(a){return e.json({success:!1,error:a.message},500)}});d.post("/api/streams/:streamId/view",async e=>{const{DB:t}=e.env;try{const s=e.req.param("streamId");await t.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(s).run();const r=await t.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(s).first();return e.json({success:!0,data:{viewer_count:(r==null?void 0:r.viewer_count)||0}})}catch(s){return e.json({success:!1,error:s.message},500)}});d.post("/api/payments/confirm",async e=>{var r;const{DB:t}=e.env;let s=null;try{s=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=s;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!n,amount:!!o}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await t.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",n),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:n},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(o)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(o),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(o),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const u="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const l={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(l,null,2)),console.log("[Payment] 📊 amount 타입:",typeof l.amount),console.log("[Payment] 📊 amount 값:",l.amount);const p=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:u,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(l)}),_=await p.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",p.status),console.log("  - 응답 OK?:",p.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(_).substring(0,300)),!p.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",p.status),console.error("[Payment] 에러 코드:",_.code),console.error("[Payment] 에러 메시지:",_.message),console.error("[Payment] 전체 응답:",JSON.stringify(_,null,2)),e.json({success:!1,error:_.message||"결제 승인에 실패했습니다.",code:_.code,tossError:_},p.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await t.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const f=await t.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();for(const E of f.results)(await t.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(E.quantity,E.product_id,E.quantity).run()).meta.changes===0&&console.error(`[Payment] ⚠️ 재고 부족: product_id=${E.product_id}`);console.log("[Payment] ✅ 재고 차감 완료")}catch(f){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",f)}return e.json({success:!0,data:_})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:s==null?void 0:s.orderId,error:a.message,stack:(r=a.stack)==null?void 0:r.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});d.post("/api/chat/:liveStreamId/messages",b(),async e=>{const{DB:t}=e.env,s=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:u}=r;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await t.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(s,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const l=["씨발","개새끼","병신","좆","시발"];let p=i;l.forEach(f=>{const E=new RegExp(f,"gi");p=p.replace(E,"*".repeat(f.length))});const _=await t.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(s,a||null,n,o||null,p,c?1:0,u?1:0).run();return e.json({success:!0,data:{id:_.meta.last_row_id,message:p}})}catch(r){return console.error("Error sending chat message:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/chat/:liveStreamId/messages",b(),async e=>{const{DB:t}=e.env,s=e.req.param("liveStreamId"),r=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
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
    `;const o=[s];r&&(n+=" AND id > ?",o.push(Number(r))),n+=" ORDER BY created_at DESC LIMIT ?",o.push(a);const c=(await t.prepare(n).bind(...o).all()).results.reverse();return e.json({success:!0,data:c})}catch(n){return console.error("Error fetching chat messages:",n),e.json({success:!1,error:n.message},500)}});d.delete("/api/chat/:liveStreamId/messages/:messageId",b(),async e=>{const{DB:t}=e.env,s=e.req.param("messageId");try{return await t.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(s).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(r){return console.error("Error deleting chat message:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/chat/:liveStreamId/ban",b(),async e=>{const{DB:t}=e.env,s=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=r;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const u=new Date;u.setMinutes(u.getMinutes()+i),c=u.toISOString()}return await t.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(s,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(r){return console.error("Error banning user:",r),e.json({success:!1,error:r.message},500)}});d.delete("/api/chat/:liveStreamId/ban/:userId",b(),async e=>{const{DB:t}=e.env,s=e.req.param("liveStreamId"),r=e.req.param("userId");try{return await t.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(s,r).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});d.post("/api/payments/webhook",async e=>{const{DB:t}=e.env;try{const s=await e.req.json();switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:s.eventType,orderId:s.orderId,status:s.status,timestamp:new Date().toISOString()}),s.eventType){case"PAYMENT_STATUS_CHANGED":await vt(t,s);break;case"VIRTUAL_ACCOUNT_ISSUED":await Ot(t,s);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",s.eventType)}return e.json({success:!0})}catch(s){return console.error("[Webhook] ❌ 웹훅 처리 실패:",s.message),e.json({success:!1,error:s.message},500)}});async function vt(e,t){const{orderId:s,status:r,paymentKey:a}=t;console.log("[Webhook] 결제 상태 변경:",{orderId:s,status:r}),await e.prepare(`
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
    `).bind(s).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",s))}async function Ot(e,t){const{orderId:s,virtualAccount:r}=t;console.log("[Webhook] 가상계좌 발급:",{orderId:s,bank:r==null?void 0:r.bank,accountNumber:r==null?void 0:r.accountNumber}),await e.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(r==null?void 0:r.bank,r==null?void 0:r.accountNumber,r==null?void 0:r.customerName,r==null?void 0:r.dueDate,JSON.stringify(t),s).run(),console.log("[Webhook] ✅ 가상계좌 정보 저장 완료:",s)}d.post("/api/payments/:paymentKey/cancel",async e=>{const{DB:t}=e.env;try{const s=e.req.param("paymentKey"),r=await e.req.json(),{cancelReason:a,cancelAmount:n}=r;if(console.log("[Payment] 결제 취소 요청:",{paymentKey:s,cancelReason:a,cancelAmount:n}),!a)return e.json({success:!1,error:"취소 사유를 입력해주세요."},400);const o=await t.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(s).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const u=ht(i,c),l=n&&n<o.amount,p=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:s,cancelAmount:p,isPartial:l});const _=await u.cancelPayment({paymentKey:s,cancelReason:a,cancelAmount:p});return _.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:s,cancelAmount:p,canceledAt:_.canceledAt}),await t.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind("CANCELED",_.canceledAt||new Date().toISOString(),JSON.stringify(_),s).run(),await t.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${s}`),e.json({success:!0,data:{paymentKey:s,orderId:o.order_id,cancelAmount:p,canceledAt:_.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,_.error),e.json({success:!1,error:_.error||"결제 취소에 실패했습니다."},400))}catch(s){return console.error("[Payment] ❌ 결제 취소 처리 실패:",s.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});d.get("/api/payments/:paymentKey",async e=>{const{DB:t}=e.env;try{const s=e.req.param("paymentKey"),r=await t.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(s).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404)}catch(s){return console.error("[Payment] ❌ 결제 조회 실패:",s.message),e.json({success:!1,error:"결제 조회 중 오류가 발생했습니다."},500)}});d.get("/api/payments/order/:orderId",async e=>{const{DB:t}=e.env;try{const s=e.req.param("orderId"),r=await t.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(s).all();return e.json({success:!0,data:r.results||[]})}catch(s){return console.error("[Payment] ❌ 결제 목록 조회 실패:",s.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});d.get("/api/seller/orders",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT DISTINCT o.*, u.name as user_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC
    `).bind(s.sellerId).all(),a=await Promise.all(r.results.map(async n=>{const o=await t.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ? AND oi.seller_id = ?
        `).bind(n.id,s.sellerId).all();return{...n,items:o.results}}));return e.json({success:!0,data:a})}catch(r){return e.json({success:!1,error:r.message},500)}});d.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,s.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,r).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${r}, 자동 발행 시작...`);const c=await t.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(r).first();if(c!=null&&c.buyer_business_number&&(c!=null&&c.buyer_business_name)){console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${c.buyer_business_number}`);const u=await t.prepare("SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1").bind(s.sellerId).first();if(!u)console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${s.sellerId}`),await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(r,s.sellerId).run();else{console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${r}`);const l=await t.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(c.id).all(),p=Number(c.total_amount),_=Math.floor(p/1.1),f=p-_,E=new Date().toISOString().split("T")[0].replace(/-/g,""),h=Math.random().toString(36).substring(2,8).toUpperCase(),g=`${E}-${h}`,y=(await t.prepare(`
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
            `).bind(s.sellerId,r,g,u.business_number,u.business_name,u.ceo_name,u.address||"",u.business_type||"",u.business_category||"",u.email||"",u.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",_,f,p,`AUTO-${Date.now()}-${h}`).run()).meta.last_row_id;for(const j of l.results){const k=Math.floor(Number(j.price)*Number(j.quantity)/1.1),T=Number(j.price)*Number(j.quantity)-k;await t.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(y,j.product_name||"상품명 없음",j.quantity,j.price,k,T,j.option_name||"").run()}await t.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r,s.sellerId,y).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${y}, invoice_number=${g}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${r}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await t.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(r,s.sellerId,c.message).run()}catch(u){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",u)}}try{const c=await t.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(r).first();if(c&&c.user_id){const l={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];l&&await Js(t,c.user_id,r,l)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await t.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await t.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,s.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await t.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,r).run();try{const c=await t.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(r).first();c&&c.user_id&&await Js(t,c.user_id,r,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/orders/:orderNumber/refund",async e=>{const{DB:t}=e.env,s=e.req.param("orderNumber"),{reason:r}=await e.req.json();try{const a=await t.prepare("SELECT * FROM orders WHERE order_number = ?").bind(s).first();return a?["paid","preparing","shipped","delivered"].includes(a.status)?a.status==="refunded"||a.status==="cancelled"?e.json({success:!1,error:"이미 환불 또는 취소된 주문입니다."},400):(await t.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind("refunded",s).run(),e.json({success:!0,message:"환불 요청이 접수되었습니다. 고객센터(0507-0177-0432)에서 처리 예정입니다.",requiresManualProcessing:!0})):e.json({success:!1,error:"환불이 불가능한 주문 상태입니다."},400):e.json({success:!1,error:"Order not found"},404)}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/admin/orders",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/sellers",async e=>{const{DB:t}=e.env,{limit:s="20",offset:r="0"}=e.req.query();try{const a=`
      SELECT id, business_name, name as display_name, 
             commission_rate, created_at
      FROM sellers 
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,{results:n}=await t.prepare(a).bind(parseInt(s),parseInt(r)).all();return e.json({success:!0,data:n})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});d.get("/api/admin/sellers",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/admin/sellers",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{username:r,password:a,name:n,email:o,phone:i,business_name:c,business_number:u}=await e.req.json();if(!r||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await t.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await t.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const _=`$2a$10$placeholder_hash_for_${a}`,f=await t.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r,_,n,o,i||null,c,u||null,s.adminId).run();return e.json({success:!0,data:{id:f.meta.last_row_id,username:r,name:n,email:o,business_name:c}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.put("/api/admin/sellers/:id",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:u,status:l}=await e.req.json();return await t.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first()?(await t.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,u,l,r).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.delete("/api/admin/sellers/:id",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();return a?(await t.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await t.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await t.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,r).run(),await t.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(r){return e.json({success:!1,error:r.message},500)}});d.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await t.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(r).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await t.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,r).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${r}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:r,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(r){return console.error("수수료율 변경 실패:",r),e.json({success:!1,error:r.message},500)}});d.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();return a?a.status==="approved"?e.json({success:!1,error:"이미 승인된 판매자입니다"},400):(await t.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(s.adminId,r).run(),console.log(`셀러 승인: ${a.username} (ID: ${r}) by Admin ID: ${s.adminId}`),e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:r,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 승인 실패:",r),e.json({success:!1,error:r.message},500)}});d.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await t.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();return n?n.status==="rejected"?e.json({success:!1,error:"이미 거부된 판매자입니다"},400):(await t.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,s.adminId,r).run(),console.log(`셀러 거부: ${n.username} (ID: ${r}), 사유: ${a}`),e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:r,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 거부 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/admin/sellers/pending",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=await t.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:r.results,count:r.results.length})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/public/seller/:sellerId",async e=>{const{DB:t,CACHE_KV:s}=e.env;try{const r=e.req.param("sellerId"),a=`public:seller:${r}`,n=await ps(s,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await t.prepare(`
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
    `).bind(r).all(),u=await t.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(r).all(),l=await t.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(r).first(),p={profile:o,live_streams:i.results,scheduled_streams:c.results,products:u.results,stats:l};return await ms(s,a,p,60),e.json({success:!0,data:p})}catch(r){return console.error("셀러 프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/public/seller/username/:username",async e=>{const{DB:t}=e.env;try{const s=e.req.param("username"),r=await t.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(s).first();return r?e.json({success:!0,data:{seller_id:r.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(s){return console.error("셀러 조회 실패:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/admin/settlement/stats",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{period:r}=e.req.query();let a="";const n=new Date;switch(r){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await t.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:r||"all"}})}catch(r){return console.error("정산 통계 조회 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/admin/settlement/records",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{seller_id:r,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];r&&(o.push("o.seller_id = ?"),i.push(r)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const p=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${p}'`);break;case"week":const _=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${_}'`);break;case"month":const f=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${f}'`);break}const u=o.length>0?`WHERE ${o.join(" AND ")}`:"",l=await t.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:l.results})}catch(r){return console.error("정산 내역 조회 실패:",r),e.json({success:!1,error:r.message},500)}});d.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await t.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(r).first();return n?(await t.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,r).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:r,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(r){return console.error("정산 상태 변경 실패:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/admin/settlement/batch-complete",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{order_ids:r}=await e.req.json();if(!Array.isArray(r)||r.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of r)try{await t.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:r.length,success:a,failed:n}})}catch(r){return console.error("일괄 정산 처리 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/admin/settlement/export-csv",async e=>{const{DB:t}=e.env,s=await M(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{seller_id:r,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];r&&(n.push("o.seller_id = ?"),o.push(r));const i=new Date;switch(a){case"today":const E=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${E}'`);break;case"week":const h=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${h}'`);break;case"month":const g=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${g}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",l=(await t.prepare(`
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
`;l.forEach(E=>{const h=p.map(g=>{const w=E[g];if(w==null)return"";const y=String(w);return y.includes(",")||y.includes('"')||y.includes(`
`)?`"${y.replace(/"/g,'""')}"`:y});_+=h.join(",")+`
`});const f="\uFEFF";return new Response(f+_,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(r){return console.error("CSV 내보내기 실패:",r),e.json({success:!1,error:r.message},500)}});d.post("/api/orders/create",async e=>{const{DB:t}=e.env;try{const{userId:s,cartItems:r,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:u,buyerCeoName:l}=await e.req.json();console.log("주문 생성 요청:",{userId:s,cartItems:r==null?void 0:r.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let p=10;if(o){const T=await t.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();T&&T.commission_rate!==null&&(p=T.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:p});const _=Math.floor(a*(p/100)),f=a-_;let E=null;if(n){const T=await t.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(n,s).first();if(!T)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);E=T}if(!s)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const h=s,g=Date.now(),w=Math.random().toString(36).substring(2,8).toUpperCase(),y=`ORDER_${g}_${w}`;for(const T of r){const A=await t.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(T.product_id).first();if(!A)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${T.product_id})`},400);if(A.stock<T.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${T.product_id})`},400)}const k=(await t.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(y,h,a,"pending",o||null,p,_,f,n||null,(E==null?void 0:E.recipient_name)||null,(E==null?void 0:E.phone)||null,E!=null&&E.address?`${E.address} ${E.address_detail}`:null,(E==null?void 0:E.postal_code)||null,i?1:0,c||null,u||null,l||null).run()).meta.last_row_id;for(const T of r){await t.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(k,T.product_id,T.option_id||null,T.quantity,T.price_snapshot||T.price).run(),await t.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(T.quantity,T.product_id).run();try{const A=await t.prepare(`
          SELECT id, name, stock, stock_alert_threshold, seller_id 
          FROM products 
          WHERE id = ?
        `).bind(T.product_id).first();if(A){const C=A.stock_alert_threshold||5,I=A.stock;I<=C&&A.seller_id&&(await yt(t,A.seller_id,A.name,I,C),console.log(`[Low Stock Alert] ${A.name}: ${I} <= ${C}`))}}catch(A){console.error("[Low Stock Alert] Error:",A)}}return console.log("주문 생성 완료:",{orderId:k,orderNumber:y}),e.json({success:!0,orderId:k,orderNumber:y,totalAmount:a})}catch(s){return console.error("주문 생성 실패:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/orders/:orderNumber/refund",b(),async e=>{const{DB:t}=e.env;try{const s=e.req.param("orderNumber"),{reason:r}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:s,reason:r});const a=await t.prepare(`
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
    `).bind(a.id).all();for(const o of n.results)await t.prepare(`
        UPDATE products 
        SET stock = stock + ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(o.quantity,o.product_id).run(),console.log("[Order Refund] 재고 복구:",{productId:o.product_id,quantity:o.quantity});return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:s,reason:r}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:s,cancelDate:new Date().toISOString()}})}catch(s){return console.error("[Order Refund] Error:",s),e.json({success:!1,error:s.message||"주문 취소 중 오류가 발생했습니다"},500)}});d.get("/api/seller/sales",b(),async e=>{try{const{DB:t}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await Ae(e.env.SESSION_KV,s);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await t.prepare(`
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
    `).bind(a,i,c).first(),p=await t.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:u,stats:l,orders:(p==null?void 0:p.results)||[]}})}catch(t){return console.error("Seller sales query error:",t),e.json({success:!1,error:t.message},500)}});d.get("/api/seller/settlement-csv",b(),async e=>{try{const{DB:t}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await Ae(e.env.SESSION_KV,s);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],u=await t.prepare(`
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
`;for(const p of(u==null?void 0:u.results)||[]){const _=p.status==="delivered"?"배송완료":p.status==="shipped"?"배송중":p.status==="preparing"?"상품준비중":p.status==="paid"?"결제완료":"대기중",f=p.buyer_business_name||"-",E=p.buyer_business_number||"-",h=p.invoice_number||"-",g=p.issue_date||"-",w=p.tax_invoice_status==="issued"?"발행완료":p.tax_invoice_status==="cancelled"?"취소":"-",y=p.nts_confirm_number||"-";l+=`${p.order_number},${p.created_at},${p.user_name||"익명"},${p.total_amount},${p.commission_amount},${p.seller_amount},${_},${f},${E},${h},${g},${w},${y}
`}return new Response(l,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(t){return console.error("CSV download error:",t),e.json({success:!1,error:t.message},500)}});d.post("/api/seller/tax-invoices/issue",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{order_number:r}=await e.req.json();if(!r)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await t.prepare(`
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
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),u=i-c,l=new Date().toISOString().split("T")[0],p=`${l}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,_=Jr(n,a,o.results);let f,E,h;try{f=await Yr(_),E=f.ntsConfirmNumber,h=f.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:E,invoiceKey:h,mockMode:Me()})}catch(y){console.error("바로빌 API 호출 실패:",y),E="FAILED",h=null}const w=(await t.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(s.sellerId,r,"tax",p,l,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,u,i,E==="FAILED"?"failed":"issued",Me()?"mock":"barobill",h,E).run()).meta.last_row_id;for(const y of o.results){const j=Math.floor(Number(y.price)*Number(y.quantity)/1.1),k=Number(y.price)*Number(y.quantity)-j;await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(w,y.id,y.product_name,y.quantity,y.price,j,k).run()}return e.json({success:!0,data:{invoice_id:w,invoice_number:p,issue_date:l,total_amount:i,supply_price:c,tax_amount:u,status:E==="FAILED"?"failed":"issued",nts_confirm_number:E,api_invoice_key:h,mock_mode:Me(),message:E==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":Me()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(r){return console.error("세금계산서 발행 오류:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/tax-invoices",async e=>{var r;const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[s.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const u=await t.prepare(i).bind(...c).all();return e.json({success:!0,data:u.results||[],total:((r=u.results)==null?void 0:r.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});d.get("/api/seller/tax-invoices/:id",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),a=await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,s.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await t.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(r).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json(),n=await t.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,s.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!Me()){const u=await t.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(s.sellerId).first();u&&u.business_number&&await Vr(u.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(u){console.error("바로빌 취소 API 호출 실패:",u)}return await t.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});d.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const{status:r,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[s.sellerId];r&&(n+=" AND log.status = ?",o.push(r)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await t.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});d.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:t}=e.env,s=await O(e);if(!s.success)return e.json({success:!1,error:s.error},401);try{const r=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${r}`);const a=await t.prepare(`
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
    `).bind(o.id).all(),u=Number(o.total_amount),l=Math.floor(u/1.1),p=u-l,_=new Date().toISOString().split("T")[0].replace(/-/g,""),f=Math.random().toString(36).substring(2,8).toUpperCase(),E=`${_}-${f}`,g=(await t.prepare(`
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
    `).bind(s.sellerId,r,E,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",l,p,u,`RETRY-${Date.now()}-${f}`).run()).meta.last_row_id;for(const w of c.results){const y=Math.floor(Number(w.price)*Number(w.quantity)/1.1),j=Number(w.price)*Number(w.quantity)-y;await t.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(g,w.product_name||"상품명 없음",w.quantity,w.price,y,j,w.option_name||"").run()}return await t.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(r,s.sellerId,g,n+1).run(),await t.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(n+1,a.id).run(),console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${g}, retry_count=${n+1}`),e.json({success:!0,data:{invoice_id:g,invoice_number:E,retry_count:n+1}})}catch(r){console.error("[TAX INVOICE RETRY] 재시도 실패:",r);try{const a=e.req.param("orderNumber"),n=await t.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(a,s.sellerId).first(),o=Number((n==null?void 0:n.retry_count)||0);await t.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(a,s.sellerId,r.message,o+1).run()}catch(a){console.error("[TAX INVOICE RETRY] 로그 기록 실패:",a)}return e.json({success:!1,error:r.message},500)}});d.get("/live/:id",async e=>{try{const t=new URL("/static/live.html",e.req.url);let r=await(await fetch(t.toString())).text();const n=`<script>window.KAKAO_JS_KEY = '${e.env.KAKAO_JS_KEY||"975a2e7f97254b08f15dba4d177a2865"}';<\/script>`;return r=r.replace("<!-- Scripts -->",`<!-- Scripts -->
    ${n}`),console.log("[Live Page] Environment variables injected"),new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving live page:",t),new Response("<h1>Error loading live page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/cart",async e=>{try{const t=new URL("/static/cart.html",e.req.url);let r=await(await fetch(t.toString())).text();return r=r.replace("%%NICEPAY_CLIENT_ID%%",e.env.NICEPAY_CLIENT_ID||"S2_d5ec29558e9d46419bf01eb828ca0834"),r=r.replace("%%NICEPAY_MID%%",e.env.NICEPAY_MID||"nictest00m"),new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving cart page:",t),new Response("<h1>Error loading cart page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/my-orders",async e=>{try{const t=new URL("/static/my-orders.html",e.req.url),r=await(await fetch(t.toString())).text();return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving my orders page:",t),new Response("<h1>Error loading orders page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/payment-result",async e=>{try{const t=new URL("/payment-result.html",e.req.url),r=await(await fetch(t.toString())).text();return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}catch(t){return console.error("Error serving payment result page:",t),new Response("<h1>Error loading payment result page</h1>",{status:500,headers:{"Content-Type":"text/html; charset=utf-8"}})}});d.get("/api/seller/profile",async e=>{const{DB:t}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const r=await t.prepare(`
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
    `).bind(r.seller_id).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404)}catch(r){return console.error("프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});d.patch("/api/seller/profile",async e=>{const{DB:t}=e.env,s=e.req.header("X-Session-Token");if(!s)return e.json({success:!1,error:"로그인이 필요합니다"},401);try{const r=await t.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(s).first();if(!r||!r.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:u,website_url:l,kakao_chat_link:p}=await e.req.json(),_=[],f=[];if(a!==void 0&&(_.push("profile_image = ?"),f.push(a)),n!==void 0&&(_.push("bio = ?"),f.push(n)),o!==void 0&&(_.push("sns_instagram = ?"),f.push(o)),i!==void 0&&(_.push("sns_youtube = ?"),f.push(i)),c!==void 0&&(_.push("sns_facebook = ?"),f.push(c)),u!==void 0&&(_.push("sns_twitter = ?"),f.push(u)),l!==void 0&&(_.push("website_url = ?"),f.push(l)),p!==void 0&&(_.push("kakao_chat_link = ?"),f.push(p)),_.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);_.push("updated_at = datetime('now')"),f.push(r.seller_id),await t.prepare(`
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
    `).bind(r.seller_id).first();return e.json({success:!0,message:"프로필이 업데이트되었습니다",data:E})}catch(r){return console.error("프로필 업데이트 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/public/:sellerId",async e=>{const{DB:t}=e.env,s=e.req.param("sellerId");try{const r=await t.prepare(`
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
    `).bind(s).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return console.error("셀러 프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/:sellerId/streams",async e=>{const{DB:t}=e.env,s=e.req.param("sellerId");try{const r=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:r.results})}catch(r){return console.error("라이브 목록 조회 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/seller/:sellerId/products-public",async e=>{const{DB:t}=e.env,s=e.req.param("sellerId");try{const r=await t.prepare(`
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
    `).bind(s).all();return e.json({success:!0,data:r.results})}catch(r){return console.error("상품 목록 조회 실패:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/notifications",B,async e=>{const{DB:t}=e.env;try{const s=e.get("userId"),r=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),n=e.req.query("unread_only")==="true";let o=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;n&&(o+=" AND is_read = 0"),o+=" ORDER BY created_at DESC LIMIT ?";const i=await t.prepare(o).bind(s,r,a).all();return e.json({success:!0,data:i.results})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/notifications/unread-count",B,async e=>{const{DB:t}=e.env;try{const s=e.get("userId"),r=e.get("userType"),a=await t.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(s,r).first();return e.json({success:!0,count:(a==null?void 0:a.count)||0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.put("/api/notifications/:id/read",B,async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=e.get("userId"),a=e.get("userType");return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s,r,a).first()?(await t.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.put("/api/notifications/read-all",B,async e=>{const{DB:t}=e.env;try{const s=e.get("userId"),r=e.get("userType");return await t.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(s,r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.delete("/api/notifications/:id",B,async e=>{const{DB:t}=e.env;try{const s=e.req.param("id"),r=e.get("userId"),a=e.get("userType");return await t.prepare("SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?").bind(s,r,a).first()?(await t.prepare("DELETE FROM notifications WHERE id = ?").bind(s).run(),e.json({success:!0})):e.json({success:!1,error:"Notification not found"},404)}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/banners",async e=>{const{DB:t}=e.env;try{const s=new Date().toISOString(),r=await t.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(s,s).all();return e.json({success:!0,data:r.results})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/api/admin/banners",B,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=await t.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(s){return e.json({success:!1,error:s.message},500)}});d.post("/api/admin/banners",B,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:r,image_url:a,link_url:n,description:o,is_active:i,display_order:c,start_date:u,end_date:l}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const p=await t.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a,n||null,o||null,i!==!1?1:0,c||0,u||null,l||null).run();return e.json({success:!0,id:p.meta.last_row_id})}catch(s){return e.json({success:!1,error:s.message},500)}});d.put("/api/admin/banners/:id",B,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id"),{title:a,image_url:n,link_url:o,description:i,is_active:c,display_order:u,start_date:l,end_date:p}=await e.req.json();return await t.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,n,o||null,i||null,c?1:0,u||0,l||null,p||null,r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.delete("/api/admin/banners/:id",B,async e=>{const{DB:t}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id");return await t.prepare("DELETE FROM banners WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(s){return e.json({success:!1,error:s.message},500)}});d.get("/order-complete",e=>e.redirect("/order-complete.html",302));d.notFound(e=>{const t=e.req.path;return t.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${t} was not found.`},404):new Response(null,{status:404})});d.onError((e,t)=>{const s=t.req.path;if(console.error("[Global Error Handler]",{path:s,method:t.req.method,error:e.message,stack:e.stack}),s.startsWith("/api/")){let r=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(r=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(r=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(r=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(r=400,a="잘못된 요청입니다."),t.json({success:!1,error:e.message||a},r)}return t.html(`
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
  `,500)});d.get("/api/admin/alimtalk/pricing",b(),async e=>{const{env:t}=e;try{const s=await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:s.results})}catch(s){return console.error("[Admin Alimtalk Pricing] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/admin/alimtalk/pricing",b(),async e=>{const{env:t}=e;try{const{plan_name:s,min_quantity:r,max_quantity:a,unit_price:n}=await e.req.json();if(!s||!r||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await t.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(s,r,a||null,n).run();return e.json({success:!0,pricing_id:o.meta.last_row_id})}catch(s){return console.error("[Admin Alimtalk Pricing Create] Error:",s),e.json({success:!1,error:s.message},500)}});d.put("/api/admin/alimtalk/pricing/:id",b(),async e=>{const{env:t}=e,s=e.req.param("id");try{const{plan_name:r,min_quantity:a,max_quantity:n,unit_price:o,is_active:i}=await e.req.json();return(await t.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r,a,n||null,o,i?1:0,s).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing updated successfully"})}catch(r){return console.error("[Admin Alimtalk Pricing Update] Error:",r),e.json({success:!1,error:r.message},500)}});d.delete("/api/admin/alimtalk/pricing/:id",b(),async e=>{const{env:t}=e,s=e.req.param("id");try{return(await t.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(s).run()).meta.changes===0?e.json({success:!1,error:"Pricing not found"},404):e.json({success:!0,message:"Pricing deleted successfully"})}catch(r){return console.error("[Admin Alimtalk Pricing Delete] Error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/admin/alimtalk/accounts",b(),async e=>{const{env:t}=e;try{const s=await t.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();return e.json({success:!0,accounts:s.results})}catch(s){return console.error("[Admin Alimtalk Accounts] Error:",s),e.json({success:!1,error:s.message},500)}});d.patch("/api/admin/alimtalk/accounts/:id/status",b(),async e=>{const{env:t}=e,s=e.req.param("id");try{const{status:r}=await e.req.json();return["active","suspended","rejected"].includes(r)?(await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(r,s).run()).meta.changes===0?e.json({success:!1,error:"Account not found"},404):e.json({success:!0,message:`Account ${r} successfully`}):e.json({success:!1,error:"Invalid status"},400)}catch(r){return console.error("[Admin Alimtalk Account Status] Error:",r),e.json({success:!1,error:r.message},500)}});d.get("/api/admin/alimtalk/statistics",b(),async e=>{const{env:t}=e;try{const{start_date:s,end_date:r}=e.req.query(),a=await t.DB.prepare(`
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
    `).bind(s||"2000-01-01",r||"2100-01-01").all();return e.json({success:!0,statistics:{total:a,by_seller:n.results}})}catch(s){return console.error("[Admin Alimtalk Statistics] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/account",b(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await Z(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(r.user_id).first();return e.json({success:!0,account:a})}catch(s){return console.error("[Seller Alimtalk Account] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/register",b(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await Z(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{channel_id:a,phone_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=Ys(n),i=await dt(t,{channelId:a,phoneNumber:o});if(!i.success)return e.json({success:!1,error:"Failed to register Kakao channel"},500);const c=await t.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(r.user_id,a,a,i.senderKey,o).run();return e.json({success:!0,account_id:c.meta.last_row_id,sender_key:i.senderKey,message:"Kakao channel registered successfully"})}catch(s){return console.error("[Seller Alimtalk Register] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/templates",b(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await Z(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!a)return e.json({success:!1,error:"Alimtalk account not found"},404);const n=await t.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();return e.json({success:!0,templates:n.results})}catch(s){return console.error("[Seller Alimtalk Templates] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/templates",b(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await Z(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_code:a,template_name:n,template_content:o,template_type:i}=await e.req.json();if(!a||!n||!o)return e.json({success:!1,error:"Missing required fields"},400);const c=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(!(await pt(t,c.sender_key,{name:n,content:o,templateCode:a})).success)return e.json({success:!1,error:"Failed to register template"},500);const l=await t.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id,a,n,o,i||"basic").run();return e.json({success:!0,template_id:l.meta.last_row_id,message:"Template registered successfully. Approval pending (1-2 days)"})}catch(s){return console.error("[Seller Alimtalk Template Register] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/pricing",b(),async e=>{const{env:t}=e;try{const s=await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:s.results})}catch(s){return console.error("[Seller Alimtalk Pricing] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/charge",b(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await Z(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{amount:a,pricing_id:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await t.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();if(!i)return e.json({success:!1,error:"Pricing not found"},404);const c=a*i.unit_price,u=`alimtalk_${o.id}_${Date.now()}`,l=await t.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id,a,c,i.unit_price,u).run(),p=`https://api.tosspayments.com/v1/payment/${u}`;return e.json({success:!0,charge_id:l.meta.last_row_id,order_id:u,amount:a,price:c,unit_price:i.unit_price,payment_url:p})}catch(s){return console.error("[Seller Alimtalk Charge] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/charge/complete",b(),async e=>{const{env:t}=e;try{const{order_id:s,payment_id:r}=await e.req.json();if(!s)return e.json({success:!1,error:"Missing order_id"},400);const a=await t.DB.prepare(`
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
    `).bind(a.amount,a.account_id).run(),e.json({success:!0,message:"Charge completed successfully",charged_amount:a.amount})):e.json({success:!1,error:"Charge not found or already completed"},404)}catch(s){return console.error("[Seller Alimtalk Charge Complete] Error:",s),e.json({success:!1,error:s.message},500)}});d.post("/api/seller/alimtalk/send",b(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await Z(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_id:a,recipient_phone:n,variables:o,order_id:i}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const c=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(c.balance<1)return e.json({success:!1,error:"Insufficient balance. Please charge first."},400);const u=await t.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a,c.id).first();if(!u)return e.json({success:!1,error:"Template not found or not approved"},404);const l=_t(u.template_content,o||{}),p=Ys(n),_=await mt(t,{senderKey:c.sender_key,templateCode:u.template_code,to:p,message:l});if(!_.success)return await t.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id,a,i||null,p,l,_.error).run(),e.json({success:!1,error:_.error},500);const f=await t.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id,a,i||null,p,l,15,_.messageId).run();return await t.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(),e.json({success:!0,message_id:f.meta.last_row_id,aligo_message_id:_.messageId,status:"sent",remaining_balance:c.balance-1})}catch(s){return console.error("[Seller Alimtalk Send] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/messages",b(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await Z(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{page:a="1",limit:n="20",status:o}=e.req.query(),i=await t.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!i)return e.json({success:!1,error:"Alimtalk account not found"},404);const c=(parseInt(a)-1)*parseInt(n);let u=`
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;const l=[i.id];o&&(u+=" AND m.status = ?",l.push(o)),u+=" ORDER BY m.created_at DESC LIMIT ? OFFSET ?",l.push(parseInt(n),c);const p=await t.DB.prepare(u).bind(...l).all(),_=await t.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();return e.json({success:!0,messages:p.results,pagination:{total:_.total,page:parseInt(a),limit:parseInt(n)}})}catch(s){return console.error("[Seller Alimtalk Messages] Error:",s),e.json({success:!1,error:s.message},500)}});d.get("/api/seller/alimtalk/statistics",b(),async e=>{const{env:t}=e;try{const s=e.req.header("X-Session-Token"),r=await Z(t,s);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{start_date:a,end_date:n}=e.req.query(),o=await t.DB.prepare(`
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
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").all(),u=i.total_sent>0?(i.total_success/i.total_sent*100).toFixed(2):0;return e.json({success:!0,statistics:{total_sent:i.total_sent,total_success:i.total_success,total_failed:i.total_failed,success_rate:u,total_cost:i.total_cost,by_template:c.results}})}catch(s){return console.error("[Seller Alimtalk Statistics] Error:",s),e.json({success:!1,error:s.message},500)}});const bs=new Bs,Dt=Object.assign({"/src/index.tsx":d});let Zs=!1;for(const[,e]of Object.entries(Dt))e&&(bs.route("/",e),bs.notFound(e.notFoundHandler),Zs=!0);if(!Zs)throw new Error("Can't import modules from ['/src/index.tsx']");async function er(e){try{const{to:t,subject:s,htmlContent:r,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:t}]}],from:{email:"noreply@live.ur-team.com",name:"유어 라이브"},subject:s,content:[{type:"text/html",value:r},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",t),{success:!0}}catch(t){return console.error("[Email] Exception:",t),{success:!1,error:t.message}}}async function jt(e){const{streamId:t,title:s,sellerName:r,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${t}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",u=`
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
  `,l=`
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
  `;return er({to:"jiwon@ur-team.com",subject:`[유어 라이브] 🎉 새 라이브 스트림 생성: ${s}`,htmlContent:u,textContent:l})}const kt=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:er,sendLiveStreamCreatedEmail:jt},Symbol.toStringTag,{value:"Module"}));export{bs as default};
