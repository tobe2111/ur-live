var Nr=Object.defineProperty;var ut=e=>{throw TypeError(e)};var jr=(e,s,t)=>s in e?Nr(e,s,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[s]=t;var A=(e,s,t)=>jr(e,typeof s!="symbol"?s+"":s,t),Ms=(e,s,t)=>s.has(e)||ut("Cannot "+t);var E=(e,s,t)=>(Ms(e,s,"read from private field"),t?t.call(e):s.get(e)),O=(e,s,t)=>s.has(e)?ut("Cannot add the same private member more than once"):s instanceof WeakSet?s.add(e):s.set(e,t),I=(e,s,t,r)=>(Ms(e,s,"write to private field"),r?r.call(e,t):s.set(e,t),t),N=(e,s,t)=>(Ms(e,s,"access private method"),t);var dt=(e,s,t,r)=>({set _(a){I(e,s,a,t)},get _(){return E(e,s,r)}});var pt=(e,s,t)=>(r,a)=>{let n=-1;return o(0);async function o(i){if(i<=n)throw new Error("next() called multiple times");n=i;let c,l=!1,u;if(e[i]?(u=e[i][0][0],r.req.routeIndex=i):u=i===e.length&&a||void 0,u)try{c=await u(r,()=>o(i+1))}catch(d){if(d instanceof Error&&s)r.error=d,c=await s(d,r),l=!0;else throw d}else r.finalized===!1&&t&&(c=await t(r));return c&&(r.finalized===!1||l)&&(r.res=c),r}},Lr=Symbol(),Mr=async(e,s=Object.create(null))=>{const{all:t=!1,dot:r=!1}=s,n=(e instanceof Kt?e.raw.headers:e.headers).get("Content-Type");return n!=null&&n.startsWith("multipart/form-data")||n!=null&&n.startsWith("application/x-www-form-urlencoded")?Fr(e,{all:t,dot:r}):{}};async function Fr(e,s){const t=await e.formData();return t?$r(t,s):{}}function $r(e,s){const t=Object.create(null);return e.forEach((r,a)=>{s.all||a.endsWith("[]")?Pr(t,a,r):t[a]=r}),s.dot&&Object.entries(t).forEach(([r,a])=>{r.includes(".")&&(Ur(t,r,a),delete t[r])}),t}var Pr=(e,s,t)=>{e[s]!==void 0?Array.isArray(e[s])?e[s].push(t):e[s]=[e[s],t]:s.endsWith("[]")?e[s]=[t]:e[s]=t},Ur=(e,s,t)=>{let r=e;const a=s.split(".");a.forEach((n,o)=>{o===a.length-1?r[n]=t:((!r[n]||typeof r[n]!="object"||Array.isArray(r[n])||r[n]instanceof File)&&(r[n]=Object.create(null)),r=r[n])})},Ut=e=>{const s=e.split("/");return s[0]===""&&s.shift(),s},xr=e=>{const{groups:s,path:t}=Wr(e),r=Ut(t);return qr(r,s)},Wr=e=>{const s=[];return e=e.replace(/\{[^}]+\}/g,(t,r)=>{const a=`@${r}`;return s.push([a,t]),a}),{groups:s,path:e}},qr=(e,s)=>{for(let t=s.length-1;t>=0;t--){const[r]=s[t];for(let a=e.length-1;a>=0;a--)if(e[a].includes(r)){e[a]=e[a].replace(r,s[t][1]);break}}return e},ws={},Hr=(e,s)=>{if(e==="*")return"*";const t=e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);if(t){const r=`${e}#${s}`;return ws[r]||(t[2]?ws[r]=s&&s[0]!==":"&&s[0]!=="*"?[r,t[1],new RegExp(`^${t[2]}(?=/${s})`)]:[e,t[1],new RegExp(`^${t[2]}$`)]:ws[r]=[e,t[1],!0]),ws[r]}return null},zs=(e,s)=>{try{return s(e)}catch{return e.replace(/(?:%[0-9A-Fa-f]{2})+/g,t=>{try{return s(t)}catch{return t}})}},Kr=e=>zs(e,decodeURI),xt=e=>{const s=e.url,t=s.indexOf("/",s.indexOf(":")+4);let r=t;for(;r<s.length;r++){const a=s.charCodeAt(r);if(a===37){const n=s.indexOf("?",r),o=s.indexOf("#",r),i=n===-1?o===-1?void 0:o:o===-1?n:Math.min(n,o),c=s.slice(t,i);return Kr(c.includes("%25")?c.replace(/%25/g,"%2525"):c)}else if(a===63||a===35)break}return s.slice(t,r)},Br=e=>{const s=xt(e);return s.length>1&&s.at(-1)==="/"?s.slice(0,-1):s},He=(e,s,...t)=>(t.length&&(s=He(s,...t)),`${(e==null?void 0:e[0])==="/"?"":"/"}${e}${s==="/"?"":`${(e==null?void 0:e.at(-1))==="/"?"":"/"}${(s==null?void 0:s[0])==="/"?s.slice(1):s}`}`),Wt=e=>{if(e.charCodeAt(e.length-1)!==63||!e.includes(":"))return null;const s=e.split("/"),t=[];let r="";return s.forEach(a=>{if(a!==""&&!/\:/.test(a))r+="/"+a;else if(/\:/.test(a))if(/\?/.test(a)){t.length===0&&r===""?t.push("/"):t.push(r);const n=a.replace("?","");r+="/"+n,t.push(r)}else r+="/"+a}),t.filter((a,n,o)=>o.indexOf(a)===n)},Fs=e=>/[%+]/.test(e)?(e.indexOf("+")!==-1&&(e=e.replace(/\+/g," ")),e.indexOf("%")!==-1?zs(e,Ht):e):e,qt=(e,s,t)=>{let r;if(!t&&s&&!/[%+]/.test(s)){let o=e.indexOf("?",8);if(o===-1)return;for(e.startsWith(s,o+1)||(o=e.indexOf(`&${s}`,o+1));o!==-1;){const i=e.charCodeAt(o+s.length+1);if(i===61){const c=o+s.length+2,l=e.indexOf("&",c);return Fs(e.slice(c,l===-1?void 0:l))}else if(i==38||isNaN(i))return"";o=e.indexOf(`&${s}`,o+1)}if(r=/[%+]/.test(e),!r)return}const a={};r??(r=/[%+]/.test(e));let n=e.indexOf("?",8);for(;n!==-1;){const o=e.indexOf("&",n+1);let i=e.indexOf("=",n);i>o&&o!==-1&&(i=-1);let c=e.slice(n+1,i===-1?o===-1?void 0:o:i);if(r&&(c=Fs(c)),n=o,c==="")continue;let l;i===-1?l="":(l=e.slice(i+1,o===-1?void 0:o),r&&(l=Fs(l))),t?(a[c]&&Array.isArray(a[c])||(a[c]=[]),a[c].push(l)):a[c]??(a[c]=l)}return s?a[s]:a},Jr=qt,Vr=(e,s)=>qt(e,s,!0),Ht=decodeURIComponent,mt=e=>zs(e,Ht),Ve,ae,ye,Bt,Jt,Ks,be,Nt,Kt=(Nt=class{constructor(e,s="/",t=[[]]){O(this,ye);A(this,"raw");O(this,Ve);O(this,ae);A(this,"routeIndex",0);A(this,"path");A(this,"bodyCache",{});O(this,be,e=>{const{bodyCache:s,raw:t}=this,r=s[e];if(r)return r;const a=Object.keys(s)[0];return a?s[a].then(n=>(a==="json"&&(n=JSON.stringify(n)),new Response(n)[e]())):s[e]=t[e]()});this.raw=e,this.path=s,I(this,ae,t),I(this,Ve,{})}param(e){return e?N(this,ye,Bt).call(this,e):N(this,ye,Jt).call(this)}query(e){return Jr(this.url,e)}queries(e){return Vr(this.url,e)}header(e){if(e)return this.raw.headers.get(e)??void 0;const s={};return this.raw.headers.forEach((t,r)=>{s[r]=t}),s}async parseBody(e){var s;return(s=this.bodyCache).parsedBody??(s.parsedBody=await Mr(this,e))}json(){return E(this,be).call(this,"text").then(e=>JSON.parse(e))}text(){return E(this,be).call(this,"text")}arrayBuffer(){return E(this,be).call(this,"arrayBuffer")}blob(){return E(this,be).call(this,"blob")}formData(){return E(this,be).call(this,"formData")}addValidatedData(e,s){E(this,Ve)[e]=s}valid(e){return E(this,Ve)[e]}get url(){return this.raw.url}get method(){return this.raw.method}get[Lr](){return E(this,ae)}get matchedRoutes(){return E(this,ae)[0].map(([[,e]])=>e)}get routePath(){return E(this,ae)[0].map(([[,e]])=>e)[this.routeIndex].path}},Ve=new WeakMap,ae=new WeakMap,ye=new WeakSet,Bt=function(e){const s=E(this,ae)[0][this.routeIndex][1][e],t=N(this,ye,Ks).call(this,s);return t&&/\%/.test(t)?mt(t):t},Jt=function(){const e={},s=Object.keys(E(this,ae)[0][this.routeIndex][1]);for(const t of s){const r=N(this,ye,Ks).call(this,E(this,ae)[0][this.routeIndex][1][t]);r!==void 0&&(e[t]=/\%/.test(r)?mt(r):r)}return e},Ks=function(e){return E(this,ae)[1]?E(this,ae)[1][e]:e},be=new WeakMap,Nt),Yr={Stringify:1},Vt=async(e,s,t,r,a)=>{typeof e=="object"&&!(e instanceof String)&&(e instanceof Promise||(e=e.toString()),e instanceof Promise&&(e=await e));const n=e.callbacks;return n!=null&&n.length?(a?a[0]+=e:a=[e],Promise.all(n.map(i=>i({phase:s,buffer:a,context:r}))).then(i=>Promise.all(i.filter(Boolean).map(c=>Vt(c,s,!1,r,a))).then(()=>a[0]))):Promise.resolve(e)},zr="text/plain; charset=UTF-8",$s=(e,s)=>({"Content-Type":e,...s}),Ue=(e,s)=>new Response(e,s),ps,ms,fe,Ye,Ee,ee,_s,ze,Ge,Oe,fs,Es,de,Ke,Bs,jt,Gr=(jt=class{constructor(e,s){O(this,de);O(this,ps);O(this,ms);A(this,"env",{});O(this,fe);A(this,"finalized",!1);A(this,"error");O(this,Ye);O(this,Ee);O(this,ee);O(this,_s);O(this,ze);O(this,Ge);O(this,Oe);O(this,fs);O(this,Es);A(this,"render",(...e)=>(E(this,ze)??I(this,ze,s=>this.html(s)),E(this,ze).call(this,...e)));A(this,"setLayout",e=>I(this,_s,e));A(this,"getLayout",()=>E(this,_s));A(this,"setRenderer",e=>{I(this,ze,e)});A(this,"header",(e,s,t)=>{this.finalized&&I(this,ee,Ue(E(this,ee).body,E(this,ee)));const r=E(this,ee)?E(this,ee).headers:E(this,Oe)??I(this,Oe,new Headers);s===void 0?r.delete(e):t!=null&&t.append?r.append(e,s):r.set(e,s)});A(this,"status",e=>{I(this,Ye,e)});A(this,"set",(e,s)=>{E(this,fe)??I(this,fe,new Map),E(this,fe).set(e,s)});A(this,"get",e=>E(this,fe)?E(this,fe).get(e):void 0);A(this,"newResponse",(...e)=>N(this,de,Ke).call(this,...e));A(this,"body",(e,s,t)=>N(this,de,Ke).call(this,e,s,t));A(this,"text",(e,s,t)=>N(this,de,Bs).call(this)&&!s&&!t?Ue(e):N(this,de,Ke).call(this,e,s,$s(zr,t)));A(this,"json",(e,s,t)=>N(this,de,Bs).call(this)&&!s&&!t?Response.json(e):N(this,de,Ke).call(this,JSON.stringify(e),s,$s("application/json",t)));A(this,"html",(e,s,t)=>{const r=a=>N(this,de,Ke).call(this,a,s,$s("text/html; charset=UTF-8",t));return typeof e=="object"?Vt(e,Yr.Stringify,!1,{}).then(r):r(e)});A(this,"redirect",(e,s)=>{const t=String(e);return this.header("Location",/[^\x00-\xFF]/.test(t)?encodeURI(t):t),this.newResponse(null,s??302)});A(this,"notFound",()=>(E(this,Ge)??I(this,Ge,()=>Ue()),E(this,Ge).call(this,this)));I(this,ps,e),s&&(I(this,Ee,s.executionCtx),this.env=s.env,I(this,Ge,s.notFoundHandler),I(this,Es,s.path),I(this,fs,s.matchResult))}get req(){return E(this,ms)??I(this,ms,new Kt(E(this,ps),E(this,Es),E(this,fs))),E(this,ms)}get event(){if(E(this,Ee)&&"respondWith"in E(this,Ee))return E(this,Ee);throw Error("This context has no FetchEvent")}get executionCtx(){if(E(this,Ee))return E(this,Ee);throw Error("This context has no ExecutionContext")}get res(){return E(this,ee)||I(this,ee,Ue(null,{headers:E(this,Oe)??I(this,Oe,new Headers)}))}set res(e){if(E(this,ee)&&e){e=Ue(e.body,e);for(const[s,t]of E(this,ee).headers.entries())if(s!=="content-type")if(s==="set-cookie"){const r=E(this,ee).headers.getSetCookie();e.headers.delete("set-cookie");for(const a of r)e.headers.append("set-cookie",a)}else e.headers.set(s,t)}I(this,ee,e),this.finalized=!0}get var(){return E(this,fe)?Object.fromEntries(E(this,fe)):{}}},ps=new WeakMap,ms=new WeakMap,fe=new WeakMap,Ye=new WeakMap,Ee=new WeakMap,ee=new WeakMap,_s=new WeakMap,ze=new WeakMap,Ge=new WeakMap,Oe=new WeakMap,fs=new WeakMap,Es=new WeakMap,de=new WeakSet,Ke=function(e,s,t){const r=E(this,ee)?new Headers(E(this,ee).headers):E(this,Oe)??new Headers;if(typeof s=="object"&&"headers"in s){const n=s.headers instanceof Headers?s.headers:new Headers(s.headers);for(const[o,i]of n)o.toLowerCase()==="set-cookie"?r.append(o,i):r.set(o,i)}if(t)for(const[n,o]of Object.entries(t))if(typeof o=="string")r.set(n,o);else{r.delete(n);for(const i of o)r.append(n,i)}const a=typeof s=="number"?s:(s==null?void 0:s.status)??E(this,Ye);return Ue(e,{status:a,headers:r})},Bs=function(){return!E(this,Oe)&&!E(this,Ye)&&!this.finalized},jt),B="ALL",Xr="all",Qr=["get","post","put","delete","options","patch"],Yt="Can not add a route since the matcher is already built.",zt=class extends Error{},Zr="__COMPOSED_HANDLER",ea=e=>e.text("404 Not Found",404),_t=(e,s)=>{if("getResponse"in e){const t=e.getResponse();return s.newResponse(t.body,t)}return console.error(e),s.text("Internal Server Error",500)},ce,J,Gt,le,Ae,Rs,Is,Xe,sa=(Xe=class{constructor(s={}){O(this,J);A(this,"get");A(this,"post");A(this,"put");A(this,"delete");A(this,"options");A(this,"patch");A(this,"all");A(this,"on");A(this,"use");A(this,"router");A(this,"getPath");A(this,"_basePath","/");O(this,ce,"/");A(this,"routes",[]);O(this,le,ea);A(this,"errorHandler",_t);A(this,"onError",s=>(this.errorHandler=s,this));A(this,"notFound",s=>(I(this,le,s),this));A(this,"fetch",(s,...t)=>N(this,J,Is).call(this,s,t[1],t[0],s.method));A(this,"request",(s,t,r,a)=>s instanceof Request?this.fetch(t?new Request(s,t):s,r,a):(s=s.toString(),this.fetch(new Request(/^https?:\/\//.test(s)?s:`http://localhost${He("/",s)}`,t),r,a)));A(this,"fire",()=>{addEventListener("fetch",s=>{s.respondWith(N(this,J,Is).call(this,s.request,s,void 0,s.request.method))})});[...Qr,Xr].forEach(n=>{this[n]=(o,...i)=>(typeof o=="string"?I(this,ce,o):N(this,J,Ae).call(this,n,E(this,ce),o),i.forEach(c=>{N(this,J,Ae).call(this,n,E(this,ce),c)}),this)}),this.on=(n,o,...i)=>{for(const c of[o].flat()){I(this,ce,c);for(const l of[n].flat())i.map(u=>{N(this,J,Ae).call(this,l.toUpperCase(),E(this,ce),u)})}return this},this.use=(n,...o)=>(typeof n=="string"?I(this,ce,n):(I(this,ce,"*"),o.unshift(n)),o.forEach(i=>{N(this,J,Ae).call(this,B,E(this,ce),i)}),this);const{strict:r,...a}=s;Object.assign(this,a),this.getPath=r??!0?s.getPath??xt:Br}route(s,t){const r=this.basePath(s);return t.routes.map(a=>{var o;let n;t.errorHandler===_t?n=a.handler:(n=async(i,c)=>(await pt([],t.errorHandler)(i,()=>a.handler(i,c))).res,n[Zr]=a.handler),N(o=r,J,Ae).call(o,a.method,a.path,n)}),this}basePath(s){const t=N(this,J,Gt).call(this);return t._basePath=He(this._basePath,s),t}mount(s,t,r){let a,n;r&&(typeof r=="function"?n=r:(n=r.optionHandler,r.replaceRequest===!1?a=c=>c:a=r.replaceRequest));const o=n?c=>{const l=n(c);return Array.isArray(l)?l:[l]}:c=>{let l;try{l=c.executionCtx}catch{}return[c.env,l]};a||(a=(()=>{const c=He(this._basePath,s),l=c==="/"?0:c.length;return u=>{const d=new URL(u.url);return d.pathname=d.pathname.slice(l)||"/",new Request(d,u)}})());const i=async(c,l)=>{const u=await t(a(c.req.raw),...o(c));if(u)return u;await l()};return N(this,J,Ae).call(this,B,He(s,"*"),i),this}},ce=new WeakMap,J=new WeakSet,Gt=function(){const s=new Xe({router:this.router,getPath:this.getPath});return s.errorHandler=this.errorHandler,I(s,le,E(this,le)),s.routes=this.routes,s},le=new WeakMap,Ae=function(s,t,r){s=s.toUpperCase(),t=He(this._basePath,t);const a={basePath:this._basePath,path:t,method:s,handler:r};this.router.add(s,t,[r,a]),this.routes.push(a)},Rs=function(s,t){if(s instanceof Error)return this.errorHandler(s,t);throw s},Is=function(s,t,r,a){if(a==="HEAD")return(async()=>new Response(null,await N(this,J,Is).call(this,s,t,r,"GET")))();const n=this.getPath(s,{env:r}),o=this.router.match(a,n),i=new Gr(s,{path:n,matchResult:o,env:r,executionCtx:t,notFoundHandler:E(this,le)});if(o[0].length===1){let l;try{l=o[0][0][0][0](i,async()=>{i.res=await E(this,le).call(this,i)})}catch(u){return N(this,J,Rs).call(this,u,i)}return l instanceof Promise?l.then(u=>u||(i.finalized?i.res:E(this,le).call(this,i))).catch(u=>N(this,J,Rs).call(this,u,i)):l??E(this,le).call(this,i)}const c=pt(o[0],this.errorHandler,E(this,le));return(async()=>{try{const l=await c(i);if(!l.finalized)throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");return l.res}catch(l){return N(this,J,Rs).call(this,l,i)}})()},Xe),Xt=[];function ta(e,s){const t=this.buildAllMatchers(),r=((a,n)=>{const o=t[a]||t[B],i=o[2][n];if(i)return i;const c=n.match(o[0]);if(!c)return[[],Xt];const l=c.indexOf("",1);return[o[1][l],c]});return this.match=r,r(e,s)}var As="[^/]+",ls=".*",us="(?:|/.*)",Be=Symbol(),ra=new Set(".\\+*[^]$()");function aa(e,s){return e.length===1?s.length===1?e<s?-1:1:-1:s.length===1||e===ls||e===us?1:s===ls||s===us?-1:e===As?1:s===As?-1:e.length===s.length?e<s?-1:1:s.length-e.length}var Ce,ke,ue,Me,na=(Me=class{constructor(){O(this,Ce);O(this,ke);O(this,ue,Object.create(null))}insert(s,t,r,a,n){if(s.length===0){if(E(this,Ce)!==void 0)throw Be;if(n)return;I(this,Ce,t);return}const[o,...i]=s,c=o==="*"?i.length===0?["","",ls]:["","",As]:o==="/*"?["","",us]:o.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);let l;if(c){const u=c[1];let d=c[2]||As;if(u&&c[2]&&(d===".*"||(d=d.replace(/^\((?!\?:)(?=[^)]+\)$)/,"(?:"),/\((?!\?:)/.test(d))))throw Be;if(l=E(this,ue)[d],!l){if(Object.keys(E(this,ue)).some(m=>m!==ls&&m!==us))throw Be;if(n)return;l=E(this,ue)[d]=new Me,u!==""&&I(l,ke,a.varIndex++)}!n&&u!==""&&r.push([u,E(l,ke)])}else if(l=E(this,ue)[o],!l){if(Object.keys(E(this,ue)).some(u=>u.length>1&&u!==ls&&u!==us))throw Be;if(n)return;l=E(this,ue)[o]=new Me}l.insert(i,t,r,a,n)}buildRegExpStr(){const t=Object.keys(E(this,ue)).sort(aa).map(r=>{const a=E(this,ue)[r];return(typeof E(a,ke)=="number"?`(${r})@${E(a,ke)}`:ra.has(r)?`\\${r}`:r)+a.buildRegExpStr()});return typeof E(this,Ce)=="number"&&t.unshift(`#${E(this,Ce)}`),t.length===0?"":t.length===1?t[0]:"(?:"+t.join("|")+")"}},Ce=new WeakMap,ke=new WeakMap,ue=new WeakMap,Me),ks,hs,Lt,oa=(Lt=class{constructor(){O(this,ks,{varIndex:0});O(this,hs,new na)}insert(e,s,t){const r=[],a=[];for(let o=0;;){let i=!1;if(e=e.replace(/\{[^}]+\}/g,c=>{const l=`@\\${o}`;return a[o]=[l,c],o++,i=!0,l}),!i)break}const n=e.match(/(?::[^\/]+)|(?:\/\*$)|./g)||[];for(let o=a.length-1;o>=0;o--){const[i]=a[o];for(let c=n.length-1;c>=0;c--)if(n[c].indexOf(i)!==-1){n[c]=n[c].replace(i,a[o][1]);break}}return E(this,hs).insert(n,s,r,E(this,ks),t),r}buildRegExp(){let e=E(this,hs).buildRegExpStr();if(e==="")return[/^$/,[],[]];let s=0;const t=[],r=[];return e=e.replace(/#(\d+)|@(\d+)|\.\*\$/g,(a,n,o)=>n!==void 0?(t[++s]=Number(n),"$()"):(o!==void 0&&(r[Number(o)]=++s),"")),[new RegExp(`^${e}`),t,r]}},ks=new WeakMap,hs=new WeakMap,Lt),ia=[/^$/,[],Object.create(null)],vs=Object.create(null);function Qt(e){return vs[e]??(vs[e]=new RegExp(e==="*"?"":`^${e.replace(/\/\*$|([.\\+*[^\]$()])/g,(s,t)=>t?`\\${t}`:"(?:|/.*)")}$`))}function ca(){vs=Object.create(null)}function la(e){var l;const s=new oa,t=[];if(e.length===0)return ia;const r=e.map(u=>[!/\*|\/:/.test(u[0]),...u]).sort(([u,d],[m,f])=>u?1:m?-1:d.length-f.length),a=Object.create(null);for(let u=0,d=-1,m=r.length;u<m;u++){const[f,_,h]=r[u];f?a[_]=[h.map(([b])=>[b,Object.create(null)]),Xt]:d++;let w;try{w=s.insert(_,d,f)}catch(b){throw b===Be?new zt(_):b}f||(t[d]=h.map(([b,g])=>{const T=Object.create(null);for(g-=1;g>=0;g--){const[y,R]=w[g];T[y]=R}return[b,T]}))}const[n,o,i]=s.buildRegExp();for(let u=0,d=t.length;u<d;u++)for(let m=0,f=t[u].length;m<f;m++){const _=(l=t[u][m])==null?void 0:l[1];if(!_)continue;const h=Object.keys(_);for(let w=0,b=h.length;w<b;w++)_[h[w]]=i[_[h[w]]]}const c=[];for(const u in o)c[u]=t[o[u]];return[n,c,a]}function xe(e,s){if(e){for(const t of Object.keys(e).sort((r,a)=>a.length-r.length))if(Qt(t).test(s))return[...e[t]]}}var we,Se,Ns,Zt,Mt,ua=(Mt=class{constructor(){O(this,Ns);A(this,"name","RegExpRouter");O(this,we);O(this,Se);A(this,"match",ta);I(this,we,{[B]:Object.create(null)}),I(this,Se,{[B]:Object.create(null)})}add(e,s,t){var i;const r=E(this,we),a=E(this,Se);if(!r||!a)throw new Error(Yt);r[e]||[r,a].forEach(c=>{c[e]=Object.create(null),Object.keys(c[B]).forEach(l=>{c[e][l]=[...c[B][l]]})}),s==="/*"&&(s="*");const n=(s.match(/\/:/g)||[]).length;if(/\*$/.test(s)){const c=Qt(s);e===B?Object.keys(r).forEach(l=>{var u;(u=r[l])[s]||(u[s]=xe(r[l],s)||xe(r[B],s)||[])}):(i=r[e])[s]||(i[s]=xe(r[e],s)||xe(r[B],s)||[]),Object.keys(r).forEach(l=>{(e===B||e===l)&&Object.keys(r[l]).forEach(u=>{c.test(u)&&r[l][u].push([t,n])})}),Object.keys(a).forEach(l=>{(e===B||e===l)&&Object.keys(a[l]).forEach(u=>c.test(u)&&a[l][u].push([t,n]))});return}const o=Wt(s)||[s];for(let c=0,l=o.length;c<l;c++){const u=o[c];Object.keys(a).forEach(d=>{var m;(e===B||e===d)&&((m=a[d])[u]||(m[u]=[...xe(r[d],u)||xe(r[B],u)||[]]),a[d][u].push([t,n-l+c+1]))})}}buildAllMatchers(){const e=Object.create(null);return Object.keys(E(this,Se)).concat(Object.keys(E(this,we))).forEach(s=>{e[s]||(e[s]=N(this,Ns,Zt).call(this,s))}),I(this,we,I(this,Se,void 0)),ca(),e}},we=new WeakMap,Se=new WeakMap,Ns=new WeakSet,Zt=function(e){const s=[];let t=e===B;return[E(this,we),E(this,Se)].forEach(r=>{const a=r[e]?Object.keys(r[e]).map(n=>[n,r[e][n]]):[];a.length!==0?(t||(t=!0),s.push(...a)):e!==B&&s.push(...Object.keys(r[B]).map(n=>[n,r[B][n]]))}),t?la(s):null},Mt),Te,he,Ft,da=(Ft=class{constructor(e){A(this,"name","SmartRouter");O(this,Te,[]);O(this,he,[]);I(this,Te,e.routers)}add(e,s,t){if(!E(this,he))throw new Error(Yt);E(this,he).push([e,s,t])}match(e,s){if(!E(this,he))throw new Error("Fatal error");const t=E(this,Te),r=E(this,he),a=t.length;let n=0,o;for(;n<a;n++){const i=t[n];try{for(let c=0,l=r.length;c<l;c++)i.add(...r[c]);o=i.match(e,s)}catch(c){if(c instanceof zt)continue;throw c}this.match=i.match.bind(i),I(this,Te,[i]),I(this,he,void 0);break}if(n===a)throw new Error("Fatal error");return this.name=`SmartRouter + ${this.activeRouter.name}`,o}get activeRouter(){if(E(this,he)||E(this,Te).length!==1)throw new Error("No active router has been determined yet.");return E(this,Te)[0]}},Te=new WeakMap,he=new WeakMap,Ft),ns=Object.create(null),pa=e=>{for(const s in e)return!0;return!1},Re,Z,Ne,Qe,G,ge,De,Ze,ma=(Ze=class{constructor(s,t,r){O(this,ge);O(this,Re);O(this,Z);O(this,Ne);O(this,Qe,0);O(this,G,ns);if(I(this,Z,r||Object.create(null)),I(this,Re,[]),s&&t){const a=Object.create(null);a[s]={handler:t,possibleKeys:[],score:0},I(this,Re,[a])}I(this,Ne,[])}insert(s,t,r){I(this,Qe,++dt(this,Qe)._);let a=this;const n=xr(t),o=[];for(let i=0,c=n.length;i<c;i++){const l=n[i],u=n[i+1],d=Hr(l,u),m=Array.isArray(d)?d[0]:l;if(m in E(a,Z)){a=E(a,Z)[m],d&&o.push(d[1]);continue}E(a,Z)[m]=new Ze,d&&(E(a,Ne).push(d),o.push(d[1])),a=E(a,Z)[m]}return E(a,Re).push({[s]:{handler:r,possibleKeys:o.filter((i,c,l)=>l.indexOf(i)===c),score:E(this,Qe)}}),a}search(s,t){var u;const r=[];I(this,G,ns);let n=[this];const o=Ut(t),i=[],c=o.length;let l=null;for(let d=0;d<c;d++){const m=o[d],f=d===c-1,_=[];for(let w=0,b=n.length;w<b;w++){const g=n[w],T=E(g,Z)[m];T&&(I(T,G,E(g,G)),f?(E(T,Z)["*"]&&N(this,ge,De).call(this,r,E(T,Z)["*"],s,E(g,G)),N(this,ge,De).call(this,r,T,s,E(g,G))):_.push(T));for(let y=0,R=E(g,Ne).length;y<R;y++){const F=E(g,Ne)[y],C=E(g,G)===ns?{}:{...E(g,G)};if(F==="*"){const $=E(g,Z)["*"];$&&(N(this,ge,De).call(this,r,$,s,E(g,G)),I($,G,C),_.push($));continue}const[D,W,P]=F;if(!m&&!(P instanceof RegExp))continue;const L=E(g,Z)[D];if(P instanceof RegExp){if(l===null){l=new Array(c);let z=t[0]==="/"?1:0;for(let v=0;v<c;v++)l[v]=z,z+=o[v].length+1}const $=t.substring(l[d]),Q=P.exec($);if(Q){if(C[W]=Q[0],N(this,ge,De).call(this,r,L,s,E(g,G),C),pa(E(L,Z))){I(L,G,C);const z=((u=Q[0].match(/\//))==null?void 0:u.length)??0;(i[z]||(i[z]=[])).push(L)}continue}}(P===!0||P.test(m))&&(C[W]=m,f?(N(this,ge,De).call(this,r,L,s,C,E(g,G)),E(L,Z)["*"]&&N(this,ge,De).call(this,r,E(L,Z)["*"],s,C,E(g,G))):(I(L,G,C),_.push(L)))}}const h=i.shift();n=h?_.concat(h):_}return r.length>1&&r.sort((d,m)=>d.score-m.score),[r.map(({handler:d,params:m})=>[d,m])]}},Re=new WeakMap,Z=new WeakMap,Ne=new WeakMap,Qe=new WeakMap,G=new WeakMap,ge=new WeakSet,De=function(s,t,r,a,n){for(let o=0,i=E(t,Re).length;o<i;o++){const c=E(t,Re)[o],l=c[r]||c[B],u={};if(l!==void 0&&(l.params=Object.create(null),s.push(l),a!==ns||n&&n!==ns))for(let d=0,m=l.possibleKeys.length;d<m;d++){const f=l.possibleKeys[d],_=u[l.score];l.params[f]=n!=null&&n[f]&&!_?n[f]:a[f]??(n==null?void 0:n[f]),u[l.score]=!0}}},Ze),je,$t,_a=($t=class{constructor(){A(this,"name","TrieRouter");O(this,je);I(this,je,new ma)}add(e,s,t){const r=Wt(s);if(r){for(let a=0,n=r.length;a<n;a++)E(this,je).insert(e,r[a],t);return}E(this,je).insert(e,s,t)}match(e,s){return E(this,je).search(e,s)}},je=new WeakMap,$t),er=class extends sa{constructor(e={}){super(e),this.router=e.router??new da({routers:[new ua,new _a]})}},S=e=>{const t={...{origin:"*",allowMethods:["GET","HEAD","PUT","POST","DELETE","PATCH"],allowHeaders:[],exposeHeaders:[]},...e},r=(n=>typeof n=="string"?n==="*"?()=>n:o=>n===o?o:null:typeof n=="function"?n:o=>n.includes(o)?o:null)(t.origin),a=(n=>typeof n=="function"?n:Array.isArray(n)?()=>n:()=>[])(t.allowMethods);return async function(o,i){var u;function c(d,m){o.res.headers.set(d,m)}const l=await r(o.req.header("origin")||"",o);if(l&&c("Access-Control-Allow-Origin",l),t.credentials&&c("Access-Control-Allow-Credentials","true"),(u=t.exposeHeaders)!=null&&u.length&&c("Access-Control-Expose-Headers",t.exposeHeaders.join(",")),o.req.method==="OPTIONS"){t.origin!=="*"&&c("Vary","Origin"),t.maxAge!=null&&c("Access-Control-Max-Age",t.maxAge.toString());const d=await a(o.req.header("origin")||"",o);d.length&&c("Access-Control-Allow-Methods",d.join(","));let m=t.allowHeaders;if(!(m!=null&&m.length)){const f=o.req.header("Access-Control-Request-Headers");f&&(m=f.split(/\s*,\s*/))}return m!=null&&m.length&&(c("Access-Control-Allow-Headers",m.join(",")),o.res.headers.append("Vary","Access-Control-Request-Headers")),o.res.headers.delete("Content-Length"),o.res.headers.delete("Content-Type"),new Response(null,{headers:o.res.headers,status:204,statusText:"No Content"})}await i(),t.origin!=="*"&&o.header("Vary","Origin",{append:!0})}};function fa(e){var a;const s=((a=e.split(".").pop())==null?void 0:a.toLowerCase())||"jpg",t=Date.now(),r=crypto.randomUUID().substring(0,8);return`upload_${t}_${r}.${s}`}async function Ea(e){const s=new Uint8Array(e);return s[0]===255&&s[1]===216&&s[2]===255?{valid:!0,detectedType:"image/jpeg"}:s[0]===137&&s[1]===80&&s[2]===78&&s[3]===71?{valid:!0,detectedType:"image/png"}:s[0]===71&&s[1]===73&&s[2]===70&&s[3]===56?{valid:!0,detectedType:"image/gif"}:s[0]===82&&s[1]===73&&s[2]===70&&s[3]===70&&s[8]===87&&s[9]===69&&s[10]===66&&s[11]===80?{valid:!0,detectedType:"image/webp"}:{valid:!1}}function ha(e){const s=["DB","SESSION_KV","CACHE_KV","TOSS_SECRET_KEY","TOSS_CLIENT_KEY"],t=[];for(const r of s)e[r]||t.push(r);if(t.length>0)throw new Error(`Missing required environment variables: ${t.join(", ")}

Please configure them:
`+t.map(r=>r==="TOSS_SECRET_KEY"||r==="TOSS_CLIENT_KEY"?`  npx wrangler pages secret put ${r} --project-name ur-live`:`  Check wrangler.jsonc for ${r} binding`).join(`
`)+`

For more details, see ENV_SETUP_GUIDE.md`)}function ga(e){console.log("[ENV] Environment check:"),console.log("  DB:",e.DB?"✅ Connected":"❌ Missing"),console.log("  SESSION_KV:",e.SESSION_KV?"✅ Connected":"❌ Missing"),console.log("  CACHE_KV:",e.CACHE_KV?"✅ Connected":"❌ Missing"),console.log("  TOSS_SECRET_KEY:",e.TOSS_SECRET_KEY?"✅ Set":"❌ Missing"),console.log("  TOSS_CLIENT_KEY:",e.TOSS_CLIENT_KEY?"✅ Set":"❌ Missing")}async function ya(e){const s=[];try{e.DB?(await e.DB.prepare("SELECT 1").first(),s.push({name:"D1 Database Binding",status:"pass",message:"DB connected successfully"})):s.push({name:"D1 Database Binding",status:"fail",message:"DB binding not found",details:"Check wrangler.jsonc d1_databases configuration"})}catch(t){s.push({name:"D1 Database Binding",status:"fail",message:"DB query failed",details:t instanceof Error?t.message:String(t)})}try{if(!e.SESSION_KV)s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const t="test:env:check";await e.SESSION_KV.put(t,"ok",{expirationTtl:60}),await e.SESSION_KV.get(t)==="ok"?s.push({name:"SESSION_KV Binding",status:"pass",message:"SESSION_KV read/write successful"}):s.push({name:"SESSION_KV Binding",status:"warn",message:"SESSION_KV write succeeded but read failed"})}}catch(t){s.push({name:"SESSION_KV Binding",status:"fail",message:"SESSION_KV operation failed",details:t instanceof Error?t.message:String(t)})}try{if(!e.CACHE_KV)s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV binding not found",details:"Check wrangler.jsonc kv_namespaces configuration"});else{const t="test:cache:check";await e.CACHE_KV.put(t,"ok",{expirationTtl:60}),await e.CACHE_KV.get(t)==="ok"?s.push({name:"CACHE_KV Binding",status:"pass",message:"CACHE_KV read/write successful"}):s.push({name:"CACHE_KV Binding",status:"warn",message:"CACHE_KV write succeeded but read failed"})}}catch(t){s.push({name:"CACHE_KV Binding",status:"fail",message:"CACHE_KV operation failed",details:t instanceof Error?t.message:String(t)})}return e.TOSS_SECRET_KEY?!e.TOSS_SECRET_KEY.startsWith("test_gsk_")&&!e.TOSS_SECRET_KEY.startsWith("live_gsk_")?s.push({name:"TOSS_SECRET_KEY",status:"warn",message:"TOSS_SECRET_KEY format may be invalid",details:"Expected format: test_gsk_* or live_gsk_*"}):s.push({name:"TOSS_SECRET_KEY",status:"pass",message:`TOSS_SECRET_KEY configured (${e.TOSS_SECRET_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_SECRET_KEY",status:"fail",message:"TOSS_SECRET_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"}),e.TOSS_CLIENT_KEY?!e.TOSS_CLIENT_KEY.startsWith("test_gck_")&&!e.TOSS_CLIENT_KEY.startsWith("live_gck_")?s.push({name:"TOSS_CLIENT_KEY",status:"warn",message:"TOSS_CLIENT_KEY format may be invalid",details:"Expected format: test_gck_* or live_gck_*"}):s.push({name:"TOSS_CLIENT_KEY",status:"pass",message:`TOSS_CLIENT_KEY configured (${e.TOSS_CLIENT_KEY.substring(0,12)}...)`}):s.push({name:"TOSS_CLIENT_KEY",status:"fail",message:"TOSS_CLIENT_KEY not configured",details:"Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live"}),e.FIREBASE_PRIVATE_KEY?e.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")?s.push({name:"FIREBASE_PRIVATE_KEY",status:"pass",message:`FIREBASE_PRIVATE_KEY configured (${e.FIREBASE_PRIVATE_KEY.length} chars)`}):s.push({name:"FIREBASE_PRIVATE_KEY",status:"warn",message:"FIREBASE_PRIVATE_KEY format may be invalid",details:"Expected format: -----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}):s.push({name:"FIREBASE_PRIVATE_KEY",status:"fail",message:"FIREBASE_PRIVATE_KEY not configured",details:"Add FIREBASE_PRIVATE_KEY in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_CLIENT_EMAIL?!e.FIREBASE_CLIENT_EMAIL.includes("@")||!e.FIREBASE_CLIENT_EMAIL.includes("iam.gserviceaccount.com")?s.push({name:"FIREBASE_CLIENT_EMAIL",status:"warn",message:"FIREBASE_CLIENT_EMAIL format may be invalid",details:"Expected format: *@*.iam.gserviceaccount.com"}):s.push({name:"FIREBASE_CLIENT_EMAIL",status:"pass",message:`FIREBASE_CLIENT_EMAIL configured: ${e.FIREBASE_CLIENT_EMAIL}`}):s.push({name:"FIREBASE_CLIENT_EMAIL",status:"fail",message:"FIREBASE_CLIENT_EMAIL not configured",details:"Add FIREBASE_CLIENT_EMAIL in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_PROJECT_ID?s.push({name:"FIREBASE_PROJECT_ID",status:"pass",message:`FIREBASE_PROJECT_ID configured: ${e.FIREBASE_PROJECT_ID}`}):s.push({name:"FIREBASE_PROJECT_ID",status:"fail",message:"FIREBASE_PROJECT_ID not configured",details:"Add FIREBASE_PROJECT_ID in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),e.FIREBASE_DATABASE_URL?!e.FIREBASE_DATABASE_URL.startsWith("https://")||!e.FIREBASE_DATABASE_URL.includes("firebaseio.com")?s.push({name:"FIREBASE_DATABASE_URL",status:"warn",message:"FIREBASE_DATABASE_URL format may be invalid",details:"Expected format: https://*.firebaseio.com"}):s.push({name:"FIREBASE_DATABASE_URL",status:"pass",message:`FIREBASE_DATABASE_URL configured: ${e.FIREBASE_DATABASE_URL}`}):s.push({name:"FIREBASE_DATABASE_URL",status:"fail",message:"FIREBASE_DATABASE_URL not configured",details:"Add FIREBASE_DATABASE_URL in Cloudflare Dashboard → ur-live → Settings → Environment variables"}),s}function ba(e){const s=[];s.push(""),s.push("========================================"),s.push("환경 변수 테스트 결과"),s.push("========================================"),s.push("");let t=0,r=0,a=0;for(const n of e){const o=n.status==="pass"?"✅":n.status==="warn"?"⚠️":"❌";s.push(`${o} ${n.name}: ${n.message}`),n.details&&s.push(`   → ${n.details}`),n.status==="pass"&&t++,n.status==="warn"&&r++,n.status==="fail"&&a++}return s.push(""),s.push("========================================"),s.push(`총 ${e.length}개 테스트:`),s.push(`  ✅ 성공: ${t}`),r>0&&s.push(`  ⚠️  경고: ${r}`),a>0&&s.push(`  ❌ 실패: ${a}`),s.push("========================================"),s.push(""),a>0?(s.push("❌ 환경 변수 설정이 완료되지 않았습니다."),s.push("자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.")):r>0?s.push("⚠️  일부 경고가 있지만 배포는 가능합니다."):s.push("✅ 모든 환경 변수가 올바르게 설정되었습니다!"),s.join(`
`)}async function wa(e){const s=await ya(e),t=s.filter(n=>n.status==="pass").length,r=s.filter(n=>n.status==="warn").length,a=s.filter(n=>n.status==="fail").length;return{success:a===0,summary:{total:s.length,pass:t,warn:r,fail:a},results:s,formatted:ba(s)}}const Ps={ENV:"test",TEST_API_KEY:"03148F80-9525-4A00-83B4-1AE55DFFA2DF",TEST_BASE_URL:"https://testapi.barobill.co.kr"};function Sa(){const e=Ps.ENV==="production";return{baseUrl:Ps.TEST_BASE_URL,apiKey:Ps.TEST_API_KEY,isProduction:e}}async function sr(e,s){const t=Sa(),r=`${t.baseUrl}${e}`;try{const a=await fetch(r,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t.apiKey}`},body:JSON.stringify(s)});if(!a.ok)throw new Error(`바로빌 API 오류: ${a.status} ${a.statusText}`);return await a.json()}catch(a){throw console.error("바로빌 API 호출 실패:",a),a}}async function Ta(e){try{const s={CorpNum:e.supplierBusinessNumber,InvoicerCorpNum:e.supplierBusinessNumber,InvoicerCorpName:e.supplierBusinessName,InvoicerCEOName:e.supplierCEO,InvoicerAddr:e.supplierAddress,InvoicerBizType:e.supplierBusinessType,InvoicerBizClass:e.supplierBusinessCategory,InvoicerContactName:e.supplierCEO,InvoicerEmail:e.supplierEmail,InvoicerTEL:e.supplierTel,InvoiceeType:e.buyerBusinessNumber?"사업자":"개인",InvoiceeCorpNum:e.buyerBusinessNumber,InvoiceeCorpName:e.buyerBusinessName,InvoiceeCEOName:e.buyerCEO,InvoiceeAddr:e.buyerAddress,InvoiceeEmail:e.buyerEmail,InvoiceeTEL:e.buyerTel,WriteDate:e.writeDate,PurposeType:e.purposeType,TaxType:e.taxType,DetailList:e.items.map((r,a)=>({SerialNum:a+1,ItemName:r.name,Qty:r.quantity,UnitPrice:r.unitPrice,SupplyCost:r.supplyPrice,Tax:r.taxAmount,Remark:r.description||""})),SupplyCostTotal:e.totalSupplyPrice.toString(),TaxTotal:e.totalTaxAmount.toString(),TotalAmount:e.totalAmount.toString(),Remark1:e.memo||"",Remark2:e.orderNo||"",SendSMS:!1,AutoAccept:!1},t=await sr("/eTaxInvoice/RegistAndIssue",s);if(t.code!==1)throw new Error(`바로빌 발행 실패: ${t.message}`);return{success:!0,ntsConfirmNumber:t.ntsconfirmNum,invoiceKey:t.invoiceKey,message:t.message}}catch(s){throw console.error("바로빌 세금계산서 발행 실패:",s),s}}async function Ra(e,s,t){try{const a=await sr("/eTaxInvoice/Delete",{CorpNum:e,InvoiceKey:s,Memo:t});if(a.code!==1)throw new Error(`바로빌 취소 실패: ${a.message}`);return{success:!0,message:a.message}}catch(r){throw console.error("바로빌 세금계산서 취소 실패:",r),r}}function cs(){return!1}async function Ia(e){return await Ta(e)}function va(e,s,t){const r=Number(s.total_amount),a=Math.floor(r/1.1),n=r-a;return{supplierBusinessNumber:e.business_number,supplierBusinessName:e.business_name,supplierCEO:e.ceo_name,supplierAddress:e.address,supplierBusinessType:e.business_type,supplierBusinessCategory:e.business_category,supplierEmail:e.email,supplierTel:e.phone,buyerBusinessNumber:s.buyer_business_number,buyerBusinessName:s.buyer_business_name||s.user_name,buyerCEO:s.buyer_ceo_name,buyerAddress:s.shipping_address,buyerEmail:s.user_email,buyerTel:s.shipping_phone,writeDate:new Date().toISOString().split("T")[0],purposeType:"01",taxType:"01",items:t.map(o=>{const i=Number(o.price)*Number(o.quantity),c=Math.floor(i/1.1),l=i-c;return{name:o.product_name,quantity:Number(o.quantity),unitPrice:Number(o.price),supplyPrice:c,taxAmount:l,description:o.option_name||""}}),totalSupplyPrice:a,totalTaxAmount:n,totalAmount:r,memo:`주문번호: ${s.order_number}`,orderNo:s.order_number}}class ne extends Error{constructor(s,t,r){super(s),this.statusCode=t,this.code=r,this.name="AuthError"}}function Aa(e){return`${crypto.randomUUID()}-${e}`}function Da(e){var n,o,i,c,l,u,d;const s=e.id.toString(),t=((n=e.properties)==null?void 0:n.nickname)||((i=(o=e.kakao_account)==null?void 0:o.profile)==null?void 0:i.nickname)||"Kakao User",r=((c=e.kakao_account)==null?void 0:c.email)||null,a=((l=e.properties)==null?void 0:l.profile_image)||((d=(u=e.kakao_account)==null?void 0:u.profile)==null?void 0:d.profile_image_url)||null;return{kakaoId:s,nickname:t,email:r,profileImage:a}}async function Oa(e,s,t,r,a){try{const n=await e.prepare(`
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
    `).bind(s,t,r,a).first();if(!n)throw new ne("Failed to upsert user",500,"UPSERT_FAILED");return console.log("[Auth] ⚡ User upserted successfully (optimized):",n.id),n}catch(n){throw n instanceof ne?n:(console.error("[Auth] Database error during upsert:",n),new ne("Database error",500,"DB_ERROR"))}}async function Ca(e){try{const s=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"}});if(!s.ok){const r=await s.text();throw console.error("[Kakao API] Failed to get user info:",r),new ne("Failed to get user info from Kakao",401,"KAKAO_USER_INFO_FAILED")}const t=await s.json();if(!t.id)throw new ne("Invalid user data from Kakao",500,"INVALID_KAKAO_DATA");return t}catch(s){throw s instanceof ne?s:(console.error("[Kakao API] Network error:",s),new ne("Failed to communicate with Kakao API",503,"KAKAO_API_ERROR"))}}async function ka(e,s,t){try{const r=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams({grant_type:"authorization_code",client_id:t,redirect_uri:s,code:e}).toString()});if(!r.ok){const n=await r.json();throw console.error("[Kakao OAuth] Token exchange failed:",n),new ne(`Failed to exchange code: ${n.error_description||n.error}`,401,n.error||"TOKEN_EXCHANGE_FAILED")}return(await r.json()).access_token}catch(r){throw r instanceof ne?r:(console.error("[Kakao OAuth] Network error:",r),new ne("Failed to communicate with Kakao OAuth server",503,"OAUTH_NETWORK_ERROR"))}}async function tr(e,s){const t=await Ca(s),{kakaoId:r,nickname:a,email:n,profileImage:o}=Da(t);console.log("[Auth] Processing login for Kakao user:",r);const i=await Oa(e,r,a,n,o),c=Aa(i.id);return{user:i,sessionToken:c}}async function rr(e,s,t=30){try{const r=await e.get(s,"json");if(!r)return console.log(`[Cache MISS] ${s}`),null;const a=Date.now()-r.timestamp;return a>t*1e3?(console.log(`[Cache EXPIRED] ${s} (age: ${Math.round(a/1e3)}s)`),null):(console.log(`[Cache HIT] ${s} (age: ${Math.round(a/1e3)}s)`),r.data)}catch(r){return console.error(`[Cache] Get error for key "${s}":`,r),null}}async function Ds(e,s,t,r=30){try{const a={data:t,timestamp:Date.now()};await e.put(s,JSON.stringify(a),{expirationTtl:r}),console.log(`[Cache SET] ${s} (TTL: ${r}s)`)}catch(a){console.error(`[Cache] Set error for key "${s}":`,a)}}function Na(e){const s=e.req.header("CF-Connecting-IP");if(s)return s;const t=e.req.header("X-Forwarded-For");if(t)return t.split(",")[0].trim();const r=e.req.header("X-Real-IP");return r||"unknown"}function ja(e,s){return`ratelimit:${e}:${s}`}const Us=new Map;async function La(e,s,t){var m;const r=new URL(e.req.url).pathname,a=ja(s,r),n=Date.now(),o=t.windowMs*1e3,c=e.get("user")&&t.authenticatedMultiplier?t.maxRequests*t.authenticatedMultiplier:t.maxRequests;try{const f=(m=e.env)==null?void 0:m.RATE_LIMIT_KV;if(f){const _=await f.get(a);let h;_?(h=JSON.parse(_),n>h.resetTime?h={count:1,resetTime:n+o}:h.count++):h={count:1,resetTime:n+o};const w=Math.ceil(o/1e3);await f.put(a,JSON.stringify(h),{expirationTtl:w});const b=h.count<=c,g=Math.max(0,c-h.count);return{allowed:b,remaining:g,resetTime:h.resetTime}}}catch(f){console.error("KV Rate Limit Error:",f)}let l=Us.get(a);l&&n>l.resetTime&&(Us.delete(a),l=void 0),l?l.count++:l={count:1,resetTime:n+o},Us.set(a,l);const u=l.count<=c,d=Math.max(0,c-l.count);return{allowed:u,remaining:d,resetTime:l.resetTime}}function Fe(e){return async(s,t)=>{const r=Na(s);if(e.skipIps&&e.skipIps.includes(r))return t();if(e.pathPattern){const n=new URL(s.req.url).pathname;if(!e.pathPattern.test(n))return t()}const a=await La(s,r,e);if(s.header("X-RateLimit-Limit",e.maxRequests.toString()),s.header("X-RateLimit-Remaining",a.remaining.toString()),s.header("X-RateLimit-Reset",new Date(a.resetTime).toISOString()),!a.allowed){const n=Math.ceil((a.resetTime-Date.now())/1e3);return s.header("Retry-After",n.toString()),s.json({success:!1,error:e.message||"Too many requests. Please try again later.",retryAfter:n,resetTime:new Date(a.resetTime).toISOString()},429)}return t()}}const $e={api:{windowMs:60,maxRequests:60,message:"API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",authenticatedMultiplier:2},auth:{windowMs:60,maxRequests:5,message:"로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",pathPattern:/^\/api\/auth\//},order:{windowMs:60,maxRequests:10,message:"주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/orders/,authenticatedMultiplier:2},cart:{windowMs:60,maxRequests:20,message:"장바구니 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/cart/,authenticatedMultiplier:2},refund:{windowMs:3600,maxRequests:3,message:"환불 요청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.",pathPattern:/^\/api\/orders\/.*\/refund/},alimtalk:{windowMs:60,maxRequests:10,message:"알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/seller\/alimtalk\/send/},upload:{windowMs:60,maxRequests:5,message:"파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.",pathPattern:/^\/api\/.*\/upload/}};class K extends Error{constructor(s,t,r="VALIDATION_ERROR"){super(t),this.field=s,this.code=r,this.name="ValidationError"}}function Ma(e,s){const{field:t,required:r,type:a,min:n,max:o,pattern:i,enum:c,custom:l,message:u}=s;if(r&&(e==null||e===""))throw new K(t,u||`${t}은(는) 필수 항목입니다.`,"REQUIRED");if(!(e==null||e==="")){if(a)switch(a){case"string":if(typeof e!="string")throw new K(t,u||`${t}은(는) 문자열이어야 합니다.`,"INVALID_TYPE");break;case"number":const d=typeof e=="string"?Number(e):e;if(typeof d!="number"||isNaN(d))throw new K(t,u||`${t}은(는) 숫자여야 합니다.`,"INVALID_TYPE");break;case"boolean":if(typeof e!="boolean")throw new K(t,u||`${t}은(는) true/false 값이어야 합니다.`,"INVALID_TYPE");break;case"email":if(typeof e!="string"||!Pa(e))throw new K(t,u||`${t}은(는) 유효한 이메일 주소여야 합니다.`,"INVALID_EMAIL");break;case"url":if(typeof e!="string"||!Ua(e))throw new K(t,u||`${t}은(는) 유효한 URL이어야 합니다.`,"INVALID_URL");break;case"phone":if(typeof e!="string"||!xa(e))throw new K(t,u||`${t}은(는) 유효한 전화번호여야 합니다.`,"INVALID_PHONE");break;case"date":if(!(e instanceof Date)&&!Wa(e))throw new K(t,u||`${t}은(는) 유효한 날짜여야 합니다.`,"INVALID_DATE");break;case"array":if(!Array.isArray(e))throw new K(t,u||`${t}은(는) 배열이어야 합니다.`,"INVALID_TYPE");break;case"object":if(typeof e!="object"||e===null||Array.isArray(e))throw new K(t,u||`${t}은(는) 객체여야 합니다.`,"INVALID_TYPE");break}if(typeof e=="string"){if(n!==void 0&&e.length<n)throw new K(t,u||`${t}은(는) 최소 ${n}자 이상이어야 합니다.`,"TOO_SHORT");if(o!==void 0&&e.length>o)throw new K(t,u||`${t}은(는) 최대 ${o}자 이하여야 합니다.`,"TOO_LONG")}if(typeof e=="number"){if(n!==void 0&&e<n)throw new K(t,u||`${t}은(는) 최소 ${n} 이상이어야 합니다.`,"TOO_SMALL");if(o!==void 0&&e>o)throw new K(t,u||`${t}은(는) 최대 ${o} 이하여야 합니다.`,"TOO_LARGE")}if(Array.isArray(e)){if(n!==void 0&&e.length<n)throw new K(t,u||`${t}은(는) 최소 ${n}개 이상이어야 합니다.`,"TOO_FEW");if(o!==void 0&&e.length>o)throw new K(t,u||`${t}은(는) 최대 ${o}개 이하여야 합니다.`,"TOO_MANY")}if(i&&typeof e=="string"&&!i.test(e))throw new K(t,u||`${t}의 형식이 올바르지 않습니다.`,"INVALID_FORMAT");if(c&&!c.includes(e))throw new K(t,u||`${t}은(는) 다음 중 하나여야 합니다: ${c.join(", ")}`,"INVALID_ENUM");if(l&&l(e)===!1)throw new K(t,u||`${t}의 값이 유효하지 않습니다.`,"CUSTOM_VALIDATION_FAILED")}}function Fa(e,s){for(const t of s){const r=e[t.field];Ma(r,t)}}function $a(e){return async(s,t)=>{try{let r={};const a=s.req.header("content-type")||"";a.includes("application/json")?r=await s.req.json().catch(()=>({})):(a.includes("application/x-www-form-urlencoded")||a.includes("multipart/form-data"))&&(r=await s.req.parseBody().catch(()=>({})));const n=new URL(s.req.url);for(const[o,i]of n.searchParams.entries())o in r||(r[o]=i);Fa(r,e),s.set("validatedData",r),await t()}catch(r){if(r instanceof K)return s.json({success:!1,error:r.message,field:r.field,code:r.code},400);throw r}}}function Pa(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=255}function Ua(e){try{const s=new URL(e);return s.protocol==="http:"||s.protocol==="https:"}catch{return!1}}function xa(e){return/^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(e)}function Wa(e){if(typeof e!="string")return!1;const s=new Date(e);return!isNaN(s.getTime())}const qa=[{field:"email",required:!0,type:"email",max:255,message:"유효한 이메일 주소를 입력해주세요."},{field:"password",required:!0,type:"string",min:8,max:100,pattern:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:"비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다."},{field:"name",required:!0,type:"string",min:2,max:50,message:"이름은 2-50자 사이여야 합니다."},{field:"phone",required:!1,type:"phone",message:"유효한 전화번호를 입력해주세요. (예: 010-1234-5678)"}];function js(e){const s=new URLSearchParams;for(const[t,r]of Object.entries(e))r!=null&&s.append(t,String(r));return s}function Gs(e,s){if(e.result_code!=="1")throw new Error(`[Aligo ${s}] ${e.message} (code: ${e.result_code})`)}async function Xs(e){console.log("[Aligo] 토큰 생성 시작");const t=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:js({apikey:e.ALIGO_API_KEY,userid:e.ALIGO_USER_ID})})).json();return Gs(t,"Token Create"),console.log("[Aligo] ✅ 토큰 생성 성공:",t.token.substring(0,20)+"..."),{token:t.token,urtime:t.urtime}}async function Ha(e,s){console.log("[Aligo] 카카오 채널 등록:",s.channelId);const{token:t}=await Xs(e),a=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/plus/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:js({token:t,userid:e.ALIGO_USER_ID,plusid:s.channelId,phonenumber:s.phoneNumber})})).json();return Gs(a,"Channel Register"),console.log("[Aligo] ✅ 카카오 채널 등록 성공, senderKey:",a.senderkey),{success:!0,senderKey:a.senderkey}}async function Ka(e,s,t){console.log("[Aligo] 템플릿 등록:",t.templateCode);const{token:r}=await Xs(e),n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/template/add/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:js({token:r,userid:e.ALIGO_USER_ID,senderkey:s,tpl_name:t.name,tpl_content:t.content,tpl_code:t.templateCode})})).json();return Gs(n,"Template Register"),console.log("[Aligo] ✅ 템플릿 등록 성공:",n.tpl_code),{success:!0,templateCode:n.tpl_code}}async function Qs(e,s){console.log("[Aligo] 알림톡 발송:",s.to);try{const{token:t}=await Xs(e),r=s.buttons?JSON.stringify({button:s.buttons}):void 0,n=await(await fetch("https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:js({token:t,userid:e.ALIGO_USER_ID,senderkey:s.senderKey,tpl_code:s.templateCode,receiver_1:s.to,subject_1:"알림톡",message_1:s.message,button_1:r})})).json();return n.result_code!=="1"?(console.error("[Aligo] ❌ 알림톡 발송 실패:",n.message),{success:!1,error:n.message}):(console.log("[Aligo] ✅ 알림톡 발송 성공, messageId:",n.msg_id),{success:!0,messageId:n.msg_id})}catch(t){return console.error("[Aligo] ❌ 알림톡 발송 에러:",t.message),{success:!1,error:t.message}}}function Ba(e,s){let t=e;for(const[r,a]of Object.entries(s)){const n=new RegExp(`#{${r}}`,"g");t=t.replace(n,a)}return t}function ar(e){let s=e.replace(/-/g,"");if(!s.startsWith("010"))throw new Error("Invalid phone number format. Must start with 010");if(s.length!==11)throw new Error("Invalid phone number length. Must be 11 digits");return s}async function Ja(e,s){const t=await e.prepare(`
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
  `).bind(s).all();return{order:t,products:r.results}}async function Va(e,s){const t=await e.prepare(`
    SELECT 
      kakao_channel_id as sender_key,
      sender_phone,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(s).first();return t||(console.warn(`No active alimtalk account for seller ${s}`),null)}async function ft(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (seller_id, template_code, recipient_phone, message, cost, status, order_id, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(s.seller_id,s.template_code,s.recipient_phone,s.message,s.cost,s.status,s.order_id||null).run()}async function Ya(e,s,t){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?
    WHERE seller_id = ?
  `).bind(t,s).run()}async function za(e,s){try{const{order:t,products:r}=await Ja(e.DB,s),a=await Va(e.DB,t.seller_id);if(!a)return console.warn(`Skipping alimtalk for order ${s}: no active account`),{success:!1,reason:"no_account"};const n=15;if(a.balance<n)return console.warn(`Skipping alimtalk for order ${s}: insufficient balance`),{success:!1,reason:"insufficient_balance"};const o=r.map(l=>`${l.name} ${l.quantity}개 (${l.price.toLocaleString()}원)`).join(`
`),i=`[주문 확인]

주문번호: ${t.order_number}
주문일시: ${new Date(t.created_at).toLocaleString("ko-KR")}

주문 상품:
${o}

총 결제금액: ${t.total_amount.toLocaleString()}원

배송지: ${t.shipping_address}
수령인: ${t.shipping_name}
연락처: ${t.shipping_phone}

주문해 주셔서 감사합니다!`,c=await Qs(e,{senderKey:a.sender_key,templateCode:"order_confirm",to:t.buyer_phone,message:i});return c.success?(await Ya(e.DB,t.seller_id,n),await ft(e.DB,{seller_id:t.seller_id,template_code:"order_confirm",recipient_phone:t.buyer_phone,message:i,cost:n,status:"sent",order_id:s}),console.log(`Order confirmation sent for order ${s}`),{success:!0}):(await ft(e.DB,{seller_id:t.seller_id,template_code:"order_confirm",recipient_phone:t.buyer_phone,message:i,cost:0,status:"failed",order_id:s}),console.error(`Failed to send order confirmation for order ${s}:`,c.error),{success:!1,error:c.error})}catch(t){return console.error(`Error sending order confirmation for order ${s}:`,t),{success:!1,error:t.message}}}function Ga(e,s){let t=e;return Object.entries(s).forEach(([r,a])=>{const n=new RegExp(`#{${r}}`,"g");t=t.replace(n,a)}),t}function Xa(e,s){const r=Array.from(e.matchAll(/#{(\w+)}/g),a=>a[1]).filter(a=>!s[a]);return{valid:r.length===0,missingVars:r}}async function Qa(e,s,t){const r=await e.prepare(`
    SELECT balance FROM alimtalk_accounts WHERE id = ?
  `).bind(s).first();if(!r)throw new Error(`Account not found: ${s}`);return{sufficient:r.balance>=t,currentBalance:r.balance}}async function Za(e,s,t){const r=await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?,
        updated_at = datetime('now')
    WHERE id = ? AND balance >= ?
  `).bind(t,s,t).run();if(!r.success||r.meta.changes===0)throw new Error("Insufficient balance or account not found")}async function Et(e,s,t){await e.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t,s).run()}async function xs(e,s){await e.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, 
     status, cost, aligo_message_id, failed_reason, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s.accountId,s.templateId,s.orderId||null,s.recipientPhone,s.messageContent,s.status,s.cost,s.aligoMessageId||null,s.failedReason||null).run()}async function en(e,s,t,r){await e.prepare(`
    UPDATE alimtalk_accounts
    SET total_sent = total_sent + ?,
        total_failed = total_failed + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(t,r,s).run()}async function sn(e,s,t,r,a,n,o,i,c){try{const l={...i,...o.variables},u=Ga(r,l),d=await Qs(e,{senderKey:a,templateCode:n,to:o.phone,message:u});return d.success?(await xs(e.DB,{accountId:s,templateId:t,recipientPhone:o.phone,messageContent:u,status:"sent",cost:c,aligoMessageId:d.messageId}),{phone:o.phone,status:"sent",messageId:d.messageId,cost:c}):(await xs(e.DB,{accountId:s,templateId:t,recipientPhone:o.phone,messageContent:u,status:"failed",cost:0,failedReason:d.error}),await Et(e.DB,s,c),{phone:o.phone,status:"failed",error:d.error,cost:0})}catch(l){return console.error(`Failed to send alimtalk to ${o.phone}:`,l),await xs(e.DB,{accountId:s,templateId:t,recipientPhone:o.phone,messageContent:"",status:"failed",cost:0,failedReason:l.message}),await Et(e.DB,s,c),{phone:o.phone,status:"failed",error:l.message,cost:0}}}async function Zs(e,s){const{accountId:t,templateId:r,recipients:a,variables:n}=s;console.log(`[Alimtalk] Starting bulk send: ${a.length} recipients`);try{const o=await e.DB.prepare(`
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
    `).bind(r,t).first();if(!i)throw new Error("Template not found");if(i.status!=="approved")throw new Error("Template is not approved");const c=Xa(i.template_content,n);if(!c.valid)throw new Error(`Missing variables: ${c.missingVars.join(", ")}`);const l=15,u=a.length*l,d=await Qa(e.DB,t,u);if(!d.sufficient)throw new Error(`Insufficient balance. Required: ${u}, Current: ${d.currentBalance}`);await Za(e.DB,t,u),console.log(`[Alimtalk] Deducted ${u} points from account ${t}`);const m=[];let f=0,_=0,h=0;for(const w of a){const b=await sn(e,t,r,i.template_content,o.sender_key,i.template_code,w,n,l);m.push(b),b.status==="sent"?f++:(_++,h+=l),m.length%10===0&&await new Promise(g=>setTimeout(g,1e3))}return await en(e.DB,t,f,_),console.log(`[Alimtalk] Completed: ${f} sent, ${_} failed, ${h} refunded`),{success:!0,totalRecipients:a.length,successCount:f,failedCount:_,refundedAmount:h,messages:m}}catch(o){return console.error("[Alimtalk] Bulk send failed:",o),{success:!1,totalRecipients:a.length,successCount:0,failedCount:a.length,refundedAmount:0,messages:[],error:o.message}}}async function tn(e,s,t,r,a){const n=await e.DB.prepare(`
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
`),c={orderNumber:n.order_number,orderDate:new Date(n.created_at).toLocaleString("ko-KR"),productList:i,totalAmount:n.total_amount.toLocaleString(),shippingAddress:n.shipping_address,shippingName:n.shipping_name,shippingPhone:n.shipping_phone,buyerName:n.buyer_name,customMessage:a||"감사합니다!"},l=[{phone:n.buyer_phone,name:n.buyer_name}];return Zs(e,{accountId:s,templateId:t,recipients:l,variables:c})}async function rn(e,s,t,r,a={}){const n=r.map(o=>({phone:o.phone,name:o.name,variables:Object.entries(o).filter(([i])=>i!=="phone"&&i!=="name").reduce((i,[c,l])=>({...i,[c]:l}),{})}));return Zs(e,{accountId:s,templateId:t,recipients:n,variables:a})}function an(e,s=.1){return Math.floor(e*s)}function nn(){const e=new Date,s=new Date(e.getFullYear(),e.getMonth()-1,1),t=s.getFullYear(),r=String(s.getMonth()+1).padStart(2,"0"),a=new Date(t,s.getMonth()+1,0).getDate();return{startDate:`${t}-${r}-01`,endDate:`${t}-${r}-${a}`}}async function on(e,s,t){try{const r=await e.prepare(`
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
    `).bind(s,t.startDate,t.endDate).all();if(!a.results||a.results.length===0)return{seller_id:s,seller_name:r.business_name,total_sales:0,total_orders:0,platform_fee:0,shipping_fee:0,refund_amount:0,settlement_amount:0,orders:[]};const n=[];let o=0,i=0,c=0;for(const m of a.results){const f=m.total_amount-m.shipping_fee,_=an(f);n.push({order_id:m.id,order_number:m.order_number,order_date:m.created_at,product_name:m.product_names||"",quantity:m.total_quantity||1,price:f,shipping_fee:m.shipping_fee||0,platform_fee:_,status:m.status}),o+=f,i+=m.shipping_fee||0,c+=_}const l=await e.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(s,t.startDate,t.endDate).first(),u=(l==null?void 0:l.refund_amount)||0,d=o-c-u+i;return{seller_id:s,seller_name:r.business_name,total_sales:o,total_orders:n.length,platform_fee:c,shipping_fee:i,refund_amount:u,settlement_amount:d,orders:n}}catch(r){return console.error(`Failed to calculate settlement for seller ${s}:`,r),null}}async function cn(e,s){console.log(`[Settlement] Generating report for ${s.startDate} ~ ${s.endDate}`);const t=await e.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(s.startDate,s.endDate).all(),r=[];let a=0,n=0,o=0;for(const c of t.results){const l=await on(e,c.id,s);l&&(r.push(l),a+=l.total_sales,n+=l.platform_fee,o+=l.settlement_amount)}const i={period:s,generated_at:new Date().toISOString(),total_sales:a,total_platform_fee:n,total_settlement:o,sellers:r};return console.log(`[Settlement] Report generated: ${r.length} sellers, ${a.toLocaleString()}원`),i}async function ln(e,s){const r=(await e.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(s.period.startDate,s.period.endDate,s.total_sales,s.total_platform_fee,s.total_settlement,s.generated_at).run()).meta.last_row_id;for(const a of s.sellers)await e.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a.seller_id,a.total_sales,a.total_orders,a.platform_fee,a.shipping_fee,a.refund_amount,a.settlement_amount).run();console.log(`[Settlement] Report saved: ID ${r}`)}async function un(e,s){const t=await e.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(s).first();if(!t)return null;const a=(await e.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(s).all()).results.map(n=>({seller_id:n.seller_id,seller_name:n.seller_name,total_sales:n.total_sales,total_orders:n.total_orders,platform_fee:n.platform_fee,shipping_fee:n.shipping_fee,refund_amount:n.refund_amount,settlement_amount:n.settlement_amount,orders:[]}));return{period:{startDate:t.period_start,endDate:t.period_end},generated_at:t.generated_at,total_sales:t.total_sales,total_platform_fee:t.total_platform_fee,total_settlement:t.total_settlement,sellers:a}}async function dn(e,s){const t=new TextEncoder;let r;const a=new ReadableStream({async start(n){console.log(`[SSE] Client connected to stream ${e}`);try{const o=await s.DB.prepare(`
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

`))}catch(o){console.error("[SSE] Update failed:",o)}},3e4)},cancel(){console.log(`[SSE] Client disconnected from stream ${e}`),r&&clearInterval(r)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function pn(e,s){const t=new TextEncoder;let r=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Chat] Client connected to stream ${e}`);try{const i=await s.DB.prepare(`
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
        `).bind(e).all();if(i.results.length>0){r=i.results[0].id;const c={type:"chat",data:i.results.reverse(),timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(t.encode(`data: ${l}

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
          `).bind(e,r).all();if(i.results.length>0){r=i.results[i.results.length-1].id;const c={type:"chat",data:i.results,timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(t.encode(`data: ${l}

`))}else o.enqueue(t.encode(`: ping

`))}catch(i){console.error("[SSE Chat] Polling failed:",i)}},5e3)},cancel(){console.log(`[SSE Chat] Client disconnected from stream ${e}`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function mn(e,s){const t=new TextEncoder;let r=0,a;const n=new ReadableStream({async start(o){console.log(`[SSE Orders] Seller ${e} connected`);try{const i=await s.DB.prepare(`
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
          `).bind(e,r).all();if(i.results.length>0){r=i.results[i.results.length-1].id;const c={type:"order",data:i.results,timestamp:new Date().toISOString()},l=JSON.stringify(c);o.enqueue(t.encode(`data: ${l}

`))}else o.enqueue(t.encode(`: ping

`))}catch(i){console.error("[SSE Orders] Polling failed:",i)}},1e4)},cancel(){console.log(`[SSE Orders] Seller ${e} disconnected`),a&&clearInterval(a)}});return new Response(n,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function _n(e,s){const t=new TextEncoder;let r;const a=new ReadableStream({async start(n){console.log(`[SSE Stock] Seller ${e} connected`),r=setInterval(async()=>{try{const o=await s.DB.prepare(`
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

`))}catch(o){console.error("[SSE Stock] Polling failed:",o)}},6e4)},cancel(){console.log(`[SSE Stock] Seller ${e} disconnected`),r&&clearInterval(r)}});return new Response(a,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}async function fn(e,s,t,r){await e.prepare(`
    INSERT OR REPLACE INTO push_subscriptions 
    (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(s,t,r.endpoint,r.keys.p256dh,r.keys.auth).run(),console.log(`[Push] Subscription saved for ${t} ${s}`)}async function En(e,s){await e.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(s).run(),console.log(`[Push] Subscription deleted: ${s}`)}function hn(e){if(e.req.method!=="GET")return!1;const s=e.req.header("Authorization"),t=e.req.header("X-Session-Token");if(s||t)return!1;const a=new URL(e.req.url).pathname;return!(a.includes("/api/products/")&&a.includes("/stock")||a.includes("/api/streams/")&&a.includes("/status")||a.includes("/current-product")||a.includes("/api/chat")||a.includes("/api/sse")||a.includes("/api/orders")||a.includes("/api/payment"))}function gn(e,s){return s||new URL(e.req.url).toString()}function yn(e){const s=[];return s.push("public"),s.push(`max-age=${e.ttl}`),e.sMaxAge!==void 0?s.push(`s-maxage=${e.sMaxAge}`):s.push(`s-maxage=${e.ttl}`),e.staleWhileRevalidate&&s.push(`stale-while-revalidate=${e.staleWhileRevalidate}`),s.join(", ")}function et(e){return async(s,t)=>{var i;if(e.skipCache||!hn(s))return t();const r=gn(s,e.cacheKey),a=caches.default;let n=await a.match(r);if(n){console.log(`[Cache HIT] ${r}`);const c=new Headers(n.headers);return c.set("X-Cache","HIT"),c.set("X-Cache-Key",r),new Response(n.body,{status:n.status,statusText:n.statusText,headers:c})}console.log(`[Cache MISS] ${r}`),await t();const o=s.res;if(o.status>=200&&o.status<300){const c=yn(e);o.headers.set("Cache-Control",c),o.headers.set("X-Cache","MISS"),o.headers.set("X-Cache-Key",r);const l=e.varyBy||["Accept-Encoding"];o.headers.set("Vary",l.join(", "));const u=o.clone();(i=s.executionCtx)==null||i.waitUntil(a.put(r,u))}}}const st={products:{ttl:10,sMaxAge:60,staleWhileRevalidate:120},liveStreams:{ttl:5,sMaxAge:10,staleWhileRevalidate:30},microCache:{ttl:10,sMaxAge:10,staleWhileRevalidate:30}};class bn extends Error{constructor(s,t,r,a){super(r),this.statusCode=s,this.code=t,this.details=a,this.name="AppError",Error.captureStackTrace(this,this.constructor)}}async function wn(e,s,t,r){if(e)try{const a={title:`✅ ${s}`,description:t,color:3066993,fields:[],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Monitor"}};if(r)for(const[n,o]of Object.entries(r))a.fields.push({name:n,value:String(o),inline:!0});await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[a]})})}catch(a){console.error("[Discord] Failed to send success alert:",a)}}async function Sn(e,s,t){if(e)try{const r=["📊 **KV 사용량 경고**","","현재 사용량:",`• 읽기: ${s.toFixed(1)}%`,`• 쓰기: ${t.toFixed(1)}%`,"","50% 이상 사용 중입니다. 유료 플랜 업그레이드를 고려하세요.","https://dash.cloudflare.com"].join(`
`);await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:r})})}catch(r){console.error("[Discord] Failed to send KV warning:",r)}}class Tn{constructor(s){this.accessToken=null,this.tokenExpiry=0,this.databaseURL=s.FIREBASE_DATABASE_URL,this.projectId=s.FIREBASE_PROJECT_ID,this.privateKey=s.FIREBASE_PRIVATE_KEY,this.clientEmail=s.FIREBASE_CLIENT_EMAIL,(!this.databaseURL||!this.projectId||!this.privateKey||!this.clientEmail)&&console.warn("⚠️ Firebase Admin credentials not configured, using unauthenticated mode")}async set(s,t){const r=`${this.databaseURL}/${s}.json`,a=await fetch(r,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!a.ok){const n=await a.text();throw console.error(`❌ Firebase set failed for ${s}:`,n),new Error(`Firebase set failed: ${a.statusText}`)}console.log(`✅ Firebase: Set data at ${s}`)}async update(s,t){const r=`${this.databaseURL}/${s}.json`,a=await fetch(r,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!a.ok){const n=await a.text();throw console.error(`❌ Firebase update failed for ${s}:`,n),new Error(`Firebase update failed: ${a.statusText}`)}console.log(`✅ Firebase: Updated data at ${s}`)}async get(s){const t=`${this.databaseURL}/${s}.json`,r=await fetch(t,{method:"GET"});if(!r.ok)throw new Error(`Firebase get failed: ${r.statusText}`);return await r.json()}async delete(s){const t=`${this.databaseURL}/${s}.json`,r=await fetch(t,{method:"DELETE"});if(!r.ok)throw new Error(`Firebase delete failed: ${r.statusText}`);console.log(`✅ Firebase: Deleted data at ${s}`)}async updateStreamStatus(s,t){try{await this.update(`streams/stream${s}`,{...t,updated_at:Date.now()}),console.log(`✅ Firebase: Stream ${s} updated`,t)}catch(r){console.error(`❌ Firebase: Failed to update stream ${s}`,r)}}async updateProductStock(s,t,r){try{await this.update(`products/product${s}`,{id:s,stock:t,...r,updated_at:Date.now()}),console.log(`✅ Firebase: Product ${s} stock updated to ${t}`)}catch(a){console.error(`❌ Firebase: Failed to update product ${s}`,a)}}async changeCurrentProduct(s,t){try{await this.updateStreamStatus(s,{current_product_id:t}),console.log(`✅ Firebase: Stream ${s} current product changed to ${t}`)}catch(r){console.error(`❌ Firebase: Failed to change product for stream ${s}`,r)}}async sendLowStockAlert(s,t,r){try{const a=`chats/stream${s}`,n=Date.now();await this.set(`${a}/alert_${n}`,{username:"시스템",text:`⚠️ ${t}의 재고가 ${r}개 남았습니다!`,timestamp:n,isSystem:!0}),console.log(`✅ Firebase: Low stock alert sent for stream ${s}`)}catch(a){console.error("❌ Firebase: Failed to send low stock alert",a)}}async sendSoldOutAlert(s,t){try{const r=`chats/stream${s}`,a=Date.now();await this.set(`${r}/soldout_${a}`,{username:"시스템",text:`🔴 ${t}이(가) 품절되었습니다!`,timestamp:a,isSystem:!0}),console.log(`✅ Firebase: Sold out alert sent for stream ${s}`)}catch(r){console.error("❌ Firebase: Failed to send sold out alert",r)}}async createCustomToken(s,t){try{if(console.log(`[Firebase Custom Token] Creating for UID: ${s}`),console.log("[Firebase Custom Token] Claims:",JSON.stringify(t)),!this.privateKey||!this.clientEmail||!this.projectId){const b=[];throw this.privateKey||b.push("FIREBASE_PRIVATE_KEY"),this.clientEmail||b.push("FIREBASE_CLIENT_EMAIL"),this.projectId||b.push("FIREBASE_PROJECT_ID"),new Error(`Firebase credentials not configured: missing ${b.join(", ")}`)}console.log(`[Firebase Custom Token] Using project: ${this.projectId}`),console.log(`[Firebase Custom Token] Using service account: ${this.clientEmail}`);const r={alg:"RS256",typ:"JWT"},a=Math.floor(Date.now()/1e3),n={iss:this.clientEmail,sub:this.clientEmail,aud:"https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",iat:a,exp:a+3600,uid:s,claims:t||{}},o=b=>{const g=JSON.stringify(b);return btoa(g).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")},i=o(r),c=o(n),l=`${i}.${c}`;console.log("[Firebase Custom Token] Parsing private key...");const u=this.privateKey.replace(/\\n/g,`
`);if(!u.includes("-----BEGIN PRIVATE KEY-----"))throw new Error("Invalid private key format: missing PEM header");if(!u.includes("-----END PRIVATE KEY-----"))throw new Error("Invalid private key format: missing PEM footer");console.log("[Firebase Custom Token] Converting PEM to DER...");const d=await this.pemToDer(u);console.log("[Firebase Custom Token] Importing crypto key...");const m=await crypto.subtle.importKey("pkcs8",d,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},!1,["sign"]);console.log("[Firebase Custom Token] Signing token...");const f=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",m,new TextEncoder().encode(l)),h=btoa(String.fromCharCode(...new Uint8Array(f))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,""),w=`${l}.${h}`;return console.log("[Firebase Custom Token] ✅ Token created successfully"),w}catch(r){throw console.error("[Firebase Custom Token] ❌ Failed to create token:",r),console.error("[Firebase Custom Token] Error name:",r.name),console.error("[Firebase Custom Token] Error message:",r.message),console.error("[Firebase Custom Token] Error stack:",r.stack),new Error(`Failed to create Firebase custom token: ${r.message}`)}}async pemToDer(s){const a=s.substring("-----BEGIN PRIVATE KEY-----".length,s.length-"-----END PRIVATE KEY-----".length-1).trim(),n=atob(a),o=new Uint8Array(n.length);for(let i=0;i<n.length;i++)o[i]=n.charCodeAt(i);return o.buffer}}function gs(e){return new Tn(e)}const tt=crypto,nr=e=>e instanceof CryptoKey,Ss=new TextEncoder,Ls=new TextDecoder;function Rn(...e){const s=e.reduce((a,{length:n})=>a+n,0),t=new Uint8Array(s);let r=0;for(const a of e)t.set(a,r),r+=a.length;return t}const In=e=>{const s=atob(e),t=new Uint8Array(s.length);for(let r=0;r<s.length;r++)t[r]=s.charCodeAt(r);return t},Le=e=>{let s=e;s instanceof Uint8Array&&(s=Ls.decode(s)),s=s.replace(/-/g,"+").replace(/_/g,"/").replace(/\s/g,"");try{return In(s)}catch{throw new TypeError("The input to be decoded is not correctly encoded.")}};class X extends Error{constructor(s,t){var r;super(s,t),this.code="ERR_JOSE_GENERIC",this.name=this.constructor.name,(r=Error.captureStackTrace)==null||r.call(Error,this,this.constructor)}}X.code="ERR_JOSE_GENERIC";class ie extends X{constructor(s,t,r="unspecified",a="unspecified"){super(s,{cause:{claim:r,reason:a,payload:t}}),this.code="ERR_JWT_CLAIM_VALIDATION_FAILED",this.claim=r,this.reason=a,this.payload=t}}ie.code="ERR_JWT_CLAIM_VALIDATION_FAILED";class Js extends X{constructor(s,t,r="unspecified",a="unspecified"){super(s,{cause:{claim:r,reason:a,payload:t}}),this.code="ERR_JWT_EXPIRED",this.claim=r,this.reason=a,this.payload=t}}Js.code="ERR_JWT_EXPIRED";class or extends X{constructor(){super(...arguments),this.code="ERR_JOSE_ALG_NOT_ALLOWED"}}or.code="ERR_JOSE_ALG_NOT_ALLOWED";class me extends X{constructor(){super(...arguments),this.code="ERR_JOSE_NOT_SUPPORTED"}}me.code="ERR_JOSE_NOT_SUPPORTED";class vn extends X{constructor(s="decryption operation failed",t){super(s,t),this.code="ERR_JWE_DECRYPTION_FAILED"}}vn.code="ERR_JWE_DECRYPTION_FAILED";class An extends X{constructor(){super(...arguments),this.code="ERR_JWE_INVALID"}}An.code="ERR_JWE_INVALID";class V extends X{constructor(){super(...arguments),this.code="ERR_JWS_INVALID"}}V.code="ERR_JWS_INVALID";class rt extends X{constructor(){super(...arguments),this.code="ERR_JWT_INVALID"}}rt.code="ERR_JWT_INVALID";class Dn extends X{constructor(){super(...arguments),this.code="ERR_JWK_INVALID"}}Dn.code="ERR_JWK_INVALID";class at extends X{constructor(){super(...arguments),this.code="ERR_JWKS_INVALID"}}at.code="ERR_JWKS_INVALID";class nt extends X{constructor(s="no applicable key found in the JSON Web Key Set",t){super(s,t),this.code="ERR_JWKS_NO_MATCHING_KEY"}}nt.code="ERR_JWKS_NO_MATCHING_KEY";class ir extends X{constructor(s="multiple matching keys found in the JSON Web Key Set",t){super(s,t),this.code="ERR_JWKS_MULTIPLE_MATCHING_KEYS"}}ir.code="ERR_JWKS_MULTIPLE_MATCHING_KEYS";class cr extends X{constructor(s="request timed out",t){super(s,t),this.code="ERR_JWKS_TIMEOUT"}}cr.code="ERR_JWKS_TIMEOUT";class lr extends X{constructor(s="signature verification failed",t){super(s,t),this.code="ERR_JWS_SIGNATURE_VERIFICATION_FAILED"}}lr.code="ERR_JWS_SIGNATURE_VERIFICATION_FAILED";function pe(e,s="algorithm.name"){return new TypeError(`CryptoKey does not support this operation, its ${s} must be ${e}`)}function os(e,s){return e.name===s}function Ws(e){return parseInt(e.name.slice(4),10)}function On(e){switch(e){case"ES256":return"P-256";case"ES384":return"P-384";case"ES512":return"P-521";default:throw new Error("unreachable")}}function Cn(e,s){if(s.length&&!s.some(t=>e.usages.includes(t))){let t="CryptoKey does not support this operation, its usages must include ";if(s.length>2){const r=s.pop();t+=`one of ${s.join(", ")}, or ${r}.`}else s.length===2?t+=`one of ${s[0]} or ${s[1]}.`:t+=`${s[0]}.`;throw new TypeError(t)}}function kn(e,s,...t){switch(s){case"HS256":case"HS384":case"HS512":{if(!os(e.algorithm,"HMAC"))throw pe("HMAC");const r=parseInt(s.slice(2),10);if(Ws(e.algorithm.hash)!==r)throw pe(`SHA-${r}`,"algorithm.hash");break}case"RS256":case"RS384":case"RS512":{if(!os(e.algorithm,"RSASSA-PKCS1-v1_5"))throw pe("RSASSA-PKCS1-v1_5");const r=parseInt(s.slice(2),10);if(Ws(e.algorithm.hash)!==r)throw pe(`SHA-${r}`,"algorithm.hash");break}case"PS256":case"PS384":case"PS512":{if(!os(e.algorithm,"RSA-PSS"))throw pe("RSA-PSS");const r=parseInt(s.slice(2),10);if(Ws(e.algorithm.hash)!==r)throw pe(`SHA-${r}`,"algorithm.hash");break}case"EdDSA":{if(e.algorithm.name!=="Ed25519"&&e.algorithm.name!=="Ed448")throw pe("Ed25519 or Ed448");break}case"Ed25519":{if(!os(e.algorithm,"Ed25519"))throw pe("Ed25519");break}case"ES256":case"ES384":case"ES512":{if(!os(e.algorithm,"ECDSA"))throw pe("ECDSA");const r=On(s);if(e.algorithm.namedCurve!==r)throw pe(r,"algorithm.namedCurve");break}default:throw new TypeError("CryptoKey does not support this operation")}Cn(e,t)}function ur(e,s,...t){var r;if(t=t.filter(Boolean),t.length>2){const a=t.pop();e+=`one of type ${t.join(", ")}, or ${a}.`}else t.length===2?e+=`one of type ${t[0]} or ${t[1]}.`:e+=`of type ${t[0]}.`;return s==null?e+=` Received ${s}`:typeof s=="function"&&s.name?e+=` Received function ${s.name}`:typeof s=="object"&&s!=null&&(r=s.constructor)!=null&&r.name&&(e+=` Received an instance of ${s.constructor.name}`),e}const ht=(e,...s)=>ur("Key must be ",e,...s);function dr(e,s,...t){return ur(`Key for the ${e} algorithm must be `,s,...t)}const pr=e=>nr(e)?!0:(e==null?void 0:e[Symbol.toStringTag])==="KeyObject",Os=["CryptoKey"],Nn=(...e)=>{const s=e.filter(Boolean);if(s.length===0||s.length===1)return!0;let t;for(const r of s){const a=Object.keys(r);if(!t||t.size===0){t=new Set(a);continue}for(const n of a){if(t.has(n))return!1;t.add(n)}}return!0};function jn(e){return typeof e=="object"&&e!==null}function Ie(e){if(!jn(e)||Object.prototype.toString.call(e)!=="[object Object]")return!1;if(Object.getPrototypeOf(e)===null)return!0;let s=e;for(;Object.getPrototypeOf(s)!==null;)s=Object.getPrototypeOf(s);return Object.getPrototypeOf(e)===s}const Ln=(e,s)=>{if(e.startsWith("RS")||e.startsWith("PS")){const{modulusLength:t}=s.algorithm;if(typeof t!="number"||t<2048)throw new TypeError(`${e} requires key modulusLength to be 2048 bits or larger`)}};function es(e){return Ie(e)&&typeof e.kty=="string"}function Mn(e){return e.kty!=="oct"&&typeof e.d=="string"}function Fn(e){return e.kty!=="oct"&&typeof e.d>"u"}function $n(e){return es(e)&&e.kty==="oct"&&typeof e.k=="string"}function Pn(e){let s,t;switch(e.kty){case"RSA":{switch(e.alg){case"PS256":case"PS384":case"PS512":s={name:"RSA-PSS",hash:`SHA-${e.alg.slice(-3)}`},t=e.d?["sign"]:["verify"];break;case"RS256":case"RS384":case"RS512":s={name:"RSASSA-PKCS1-v1_5",hash:`SHA-${e.alg.slice(-3)}`},t=e.d?["sign"]:["verify"];break;case"RSA-OAEP":case"RSA-OAEP-256":case"RSA-OAEP-384":case"RSA-OAEP-512":s={name:"RSA-OAEP",hash:`SHA-${parseInt(e.alg.slice(-3),10)||1}`},t=e.d?["decrypt","unwrapKey"]:["encrypt","wrapKey"];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}case"EC":{switch(e.alg){case"ES256":s={name:"ECDSA",namedCurve:"P-256"},t=e.d?["sign"]:["verify"];break;case"ES384":s={name:"ECDSA",namedCurve:"P-384"},t=e.d?["sign"]:["verify"];break;case"ES512":s={name:"ECDSA",namedCurve:"P-521"},t=e.d?["sign"]:["verify"];break;case"ECDH-ES":case"ECDH-ES+A128KW":case"ECDH-ES+A192KW":case"ECDH-ES+A256KW":s={name:"ECDH",namedCurve:e.crv},t=e.d?["deriveBits"]:[];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}case"OKP":{switch(e.alg){case"Ed25519":s={name:"Ed25519"},t=e.d?["sign"]:["verify"];break;case"EdDSA":s={name:e.crv},t=e.d?["sign"]:["verify"];break;case"ECDH-ES":case"ECDH-ES+A128KW":case"ECDH-ES+A192KW":case"ECDH-ES+A256KW":s={name:e.crv},t=e.d?["deriveBits"]:[];break;default:throw new me('Invalid or unsupported JWK "alg" (Algorithm) Parameter value')}break}default:throw new me('Invalid or unsupported JWK "kty" (Key Type) Parameter value')}return{algorithm:s,keyUsages:t}}const mr=async e=>{if(!e.alg)throw new TypeError('"alg" argument is required when "jwk.alg" is not present');const{algorithm:s,keyUsages:t}=Pn(e),r=[s,e.ext??!1,e.key_ops??t],a={...e};return delete a.alg,delete a.use,tt.subtle.importKey("jwk",a,...r)},_r=e=>Le(e);let We,qe;const fr=e=>(e==null?void 0:e[Symbol.toStringTag])==="KeyObject",Cs=async(e,s,t,r,a=!1)=>{let n=e.get(s);if(n!=null&&n[r])return n[r];const o=await mr({...t,alg:r});return a&&Object.freeze(s),n?n[r]=o:e.set(s,{[r]:o}),o},Un=(e,s)=>{if(fr(e)){let t=e.export({format:"jwk"});return delete t.d,delete t.dp,delete t.dq,delete t.p,delete t.q,delete t.qi,t.k?_r(t.k):(qe||(qe=new WeakMap),Cs(qe,e,t,s))}return es(e)?e.k?Le(e.k):(qe||(qe=new WeakMap),Cs(qe,e,e,s,!0)):e},xn=(e,s)=>{if(fr(e)){let t=e.export({format:"jwk"});return t.k?_r(t.k):(We||(We=new WeakMap),Cs(We,e,t,s))}return es(e)?e.k?Le(e.k):(We||(We=new WeakMap),Cs(We,e,e,s,!0)):e},Wn={normalizePublicKey:Un,normalizePrivateKey:xn};async function Er(e,s){if(!Ie(e))throw new TypeError("JWK must be an object");switch(s||(s=e.alg),e.kty){case"oct":if(typeof e.k!="string"||!e.k)throw new TypeError('missing "k" (Key Value) Parameter value');return Le(e.k);case"RSA":if("oth"in e&&e.oth!==void 0)throw new me('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');case"EC":case"OKP":return mr({...e,alg:s});default:throw new me('Unsupported "kty" (Key Type) Parameter value')}}const Je=e=>e==null?void 0:e[Symbol.toStringTag],Vs=(e,s,t)=>{var r,a;if(s.use!==void 0&&s.use!=="sig")throw new TypeError("Invalid key for this operation, when present its use must be sig");if(s.key_ops!==void 0&&((a=(r=s.key_ops).includes)==null?void 0:a.call(r,t))!==!0)throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${t}`);if(s.alg!==void 0&&s.alg!==e)throw new TypeError(`Invalid key for this operation, when present its alg must be ${e}`);return!0},qn=(e,s,t,r)=>{if(!(s instanceof Uint8Array)){if(r&&es(s)){if($n(s)&&Vs(e,s,t))return;throw new TypeError('JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present')}if(!pr(s))throw new TypeError(dr(e,s,...Os,"Uint8Array",r?"JSON Web Key":null));if(s.type!=="secret")throw new TypeError(`${Je(s)} instances for symmetric algorithms must be of type "secret"`)}},Hn=(e,s,t,r)=>{if(r&&es(s))switch(t){case"sign":if(Mn(s)&&Vs(e,s,t))return;throw new TypeError("JSON Web Key for this operation be a private JWK");case"verify":if(Fn(s)&&Vs(e,s,t))return;throw new TypeError("JSON Web Key for this operation be a public JWK")}if(!pr(s))throw new TypeError(dr(e,s,...Os,r?"JSON Web Key":null));if(s.type==="secret")throw new TypeError(`${Je(s)} instances for asymmetric algorithms must not be of type "secret"`);if(t==="sign"&&s.type==="public")throw new TypeError(`${Je(s)} instances for asymmetric algorithm signing must be of type "private"`);if(t==="decrypt"&&s.type==="public")throw new TypeError(`${Je(s)} instances for asymmetric algorithm decryption must be of type "private"`);if(s.algorithm&&t==="verify"&&s.type==="private")throw new TypeError(`${Je(s)} instances for asymmetric algorithm verifying must be of type "public"`);if(s.algorithm&&t==="encrypt"&&s.type==="private")throw new TypeError(`${Je(s)} instances for asymmetric algorithm encryption must be of type "public"`)};function hr(e,s,t,r){s.startsWith("HS")||s==="dir"||s.startsWith("PBES2")||/^A\d{3}(?:GCM)?KW$/.test(s)?qn(s,t,r,e):Hn(s,t,r,e)}hr.bind(void 0,!1);const gt=hr.bind(void 0,!0);function Kn(e,s,t,r,a){if(a.crit!==void 0&&(r==null?void 0:r.crit)===void 0)throw new e('"crit" (Critical) Header Parameter MUST be integrity protected');if(!r||r.crit===void 0)return new Set;if(!Array.isArray(r.crit)||r.crit.length===0||r.crit.some(o=>typeof o!="string"||o.length===0))throw new e('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');let n;t!==void 0?n=new Map([...Object.entries(t),...s.entries()]):n=s;for(const o of r.crit){if(!n.has(o))throw new me(`Extension Header Parameter "${o}" is not recognized`);if(a[o]===void 0)throw new e(`Extension Header Parameter "${o}" is missing`);if(n.get(o)&&r[o]===void 0)throw new e(`Extension Header Parameter "${o}" MUST be integrity protected`)}return new Set(r.crit)}const Bn=(e,s)=>{if(s!==void 0&&(!Array.isArray(s)||s.some(t=>typeof t!="string")))throw new TypeError(`"${e}" option must be an array of strings`);if(s)return new Set(s)};function Jn(e,s){const t=`SHA-${e.slice(-3)}`;switch(e){case"HS256":case"HS384":case"HS512":return{hash:t,name:"HMAC"};case"PS256":case"PS384":case"PS512":return{hash:t,name:"RSA-PSS",saltLength:e.slice(-3)>>3};case"RS256":case"RS384":case"RS512":return{hash:t,name:"RSASSA-PKCS1-v1_5"};case"ES256":case"ES384":case"ES512":return{hash:t,name:"ECDSA",namedCurve:s.namedCurve};case"Ed25519":return{name:"Ed25519"};case"EdDSA":return{name:s.name};default:throw new me(`alg ${e} is not supported either by JOSE or your javascript runtime`)}}async function Vn(e,s,t){if(s=await Wn.normalizePublicKey(s,e),nr(s))return kn(s,e,t),s;if(s instanceof Uint8Array){if(!e.startsWith("HS"))throw new TypeError(ht(s,...Os));return tt.subtle.importKey("raw",s,{hash:`SHA-${e.slice(-3)}`,name:"HMAC"},!1,[t])}throw new TypeError(ht(s,...Os,"Uint8Array","JSON Web Key"))}const Yn=async(e,s,t,r)=>{const a=await Vn(e,s,"verify");Ln(e,a);const n=Jn(e,a.algorithm);try{return await tt.subtle.verify(n,a,t,r)}catch{return!1}};async function zn(e,s,t){if(!Ie(e))throw new V("Flattened JWS must be an object");if(e.protected===void 0&&e.header===void 0)throw new V('Flattened JWS must have either of the "protected" or "header" members');if(e.protected!==void 0&&typeof e.protected!="string")throw new V("JWS Protected Header incorrect type");if(e.payload===void 0)throw new V("JWS Payload missing");if(typeof e.signature!="string")throw new V("JWS Signature missing or incorrect type");if(e.header!==void 0&&!Ie(e.header))throw new V("JWS Unprotected Header incorrect type");let r={};if(e.protected)try{const h=Le(e.protected);r=JSON.parse(Ls.decode(h))}catch{throw new V("JWS Protected Header is invalid")}if(!Nn(r,e.header))throw new V("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");const a={...r,...e.header},n=Kn(V,new Map([["b64",!0]]),t==null?void 0:t.crit,r,a);let o=!0;if(n.has("b64")&&(o=r.b64,typeof o!="boolean"))throw new V('The "b64" (base64url-encode payload) Header Parameter must be a boolean');const{alg:i}=a;if(typeof i!="string"||!i)throw new V('JWS "alg" (Algorithm) Header Parameter missing or invalid');const c=t&&Bn("algorithms",t.algorithms);if(c&&!c.has(i))throw new or('"alg" (Algorithm) Header Parameter value not allowed');if(o){if(typeof e.payload!="string")throw new V("JWS Payload must be a string")}else if(typeof e.payload!="string"&&!(e.payload instanceof Uint8Array))throw new V("JWS Payload must be a string or an Uint8Array instance");let l=!1;typeof s=="function"?(s=await s(r,e),l=!0,gt(i,s,"verify"),es(s)&&(s=await Er(s,i))):gt(i,s,"verify");const u=Rn(Ss.encode(e.protected??""),Ss.encode("."),typeof e.payload=="string"?Ss.encode(e.payload):e.payload);let d;try{d=Le(e.signature)}catch{throw new V("Failed to base64url decode the signature")}if(!await Yn(i,s,d,u))throw new lr;let f;if(o)try{f=Le(e.payload)}catch{throw new V("Failed to base64url decode the payload")}else typeof e.payload=="string"?f=Ss.encode(e.payload):f=e.payload;const _={payload:f};return e.protected!==void 0&&(_.protectedHeader=r),e.header!==void 0&&(_.unprotectedHeader=e.header),l?{..._,key:s}:_}async function Gn(e,s,t){if(e instanceof Uint8Array&&(e=Ls.decode(e)),typeof e!="string")throw new V("Compact JWS must be a string or Uint8Array");const{0:r,1:a,2:n,length:o}=e.split(".");if(o!==3)throw new V("Invalid Compact JWS");const i=await zn({payload:a,protected:r,signature:n},s,t),c={payload:i.payload,protectedHeader:i.protectedHeader};return typeof s=="function"?{...c,key:i.key}:c}const Xn=e=>Math.floor(e.getTime()/1e3),gr=60,yr=gr*60,ot=yr*24,Qn=ot*7,Zn=ot*365.25,eo=/^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i,yt=e=>{const s=eo.exec(e);if(!s||s[4]&&s[1])throw new TypeError("Invalid time period format");const t=parseFloat(s[2]),r=s[3].toLowerCase();let a;switch(r){case"sec":case"secs":case"second":case"seconds":case"s":a=Math.round(t);break;case"minute":case"minutes":case"min":case"mins":case"m":a=Math.round(t*gr);break;case"hour":case"hours":case"hr":case"hrs":case"h":a=Math.round(t*yr);break;case"day":case"days":case"d":a=Math.round(t*ot);break;case"week":case"weeks":case"w":a=Math.round(t*Qn);break;default:a=Math.round(t*Zn);break}return s[1]==="-"||s[4]==="ago"?-a:a},bt=e=>e.toLowerCase().replace(/^application\//,""),so=(e,s)=>typeof e=="string"?s.includes(e):Array.isArray(e)?s.some(Set.prototype.has.bind(new Set(e))):!1,to=(e,s,t={})=>{let r;try{r=JSON.parse(Ls.decode(s))}catch{}if(!Ie(r))throw new rt("JWT Claims Set must be a top-level JSON object");const{typ:a}=t;if(a&&(typeof e.typ!="string"||bt(e.typ)!==bt(a)))throw new ie('unexpected "typ" JWT header value',r,"typ","check_failed");const{requiredClaims:n=[],issuer:o,subject:i,audience:c,maxTokenAge:l}=t,u=[...n];l!==void 0&&u.push("iat"),c!==void 0&&u.push("aud"),i!==void 0&&u.push("sub"),o!==void 0&&u.push("iss");for(const _ of new Set(u.reverse()))if(!(_ in r))throw new ie(`missing required "${_}" claim`,r,_,"missing");if(o&&!(Array.isArray(o)?o:[o]).includes(r.iss))throw new ie('unexpected "iss" claim value',r,"iss","check_failed");if(i&&r.sub!==i)throw new ie('unexpected "sub" claim value',r,"sub","check_failed");if(c&&!so(r.aud,typeof c=="string"?[c]:c))throw new ie('unexpected "aud" claim value',r,"aud","check_failed");let d;switch(typeof t.clockTolerance){case"string":d=yt(t.clockTolerance);break;case"number":d=t.clockTolerance;break;case"undefined":d=0;break;default:throw new TypeError("Invalid clockTolerance option type")}const{currentDate:m}=t,f=Xn(m||new Date);if((r.iat!==void 0||l)&&typeof r.iat!="number")throw new ie('"iat" claim must be a number',r,"iat","invalid");if(r.nbf!==void 0){if(typeof r.nbf!="number")throw new ie('"nbf" claim must be a number',r,"nbf","invalid");if(r.nbf>f+d)throw new ie('"nbf" claim timestamp check failed',r,"nbf","check_failed")}if(r.exp!==void 0){if(typeof r.exp!="number")throw new ie('"exp" claim must be a number',r,"exp","invalid");if(r.exp<=f-d)throw new Js('"exp" claim timestamp check failed',r,"exp","check_failed")}if(l){const _=f-r.iat,h=typeof l=="number"?l:yt(l);if(_-d>h)throw new Js('"iat" claim timestamp check failed (too far in the past)',r,"iat","check_failed");if(_<0-d)throw new ie('"iat" claim timestamp check failed (it should be in the past)',r,"iat","check_failed")}return r};async function ro(e,s,t){var o;const r=await Gn(e,s,t);if((o=r.protectedHeader.crit)!=null&&o.includes("b64")&&r.protectedHeader.b64===!1)throw new rt("JWTs MUST NOT use unencoded payload");const n={payload:to(r.protectedHeader,r.payload,t),protectedHeader:r.protectedHeader};return typeof s=="function"?{...n,key:r.key}:n}function ao(e){switch(typeof e=="string"&&e.slice(0,2)){case"RS":case"PS":return"RSA";case"ES":return"EC";case"Ed":return"OKP";default:throw new me('Unsupported "alg" value for a JSON Web Key Set')}}function no(e){return e&&typeof e=="object"&&Array.isArray(e.keys)&&e.keys.every(oo)}function oo(e){return Ie(e)}function br(e){return typeof structuredClone=="function"?structuredClone(e):JSON.parse(JSON.stringify(e))}class io{constructor(s){if(this._cached=new WeakMap,!no(s))throw new at("JSON Web Key Set malformed");this._jwks=br(s)}async getKey(s,t){const{alg:r,kid:a}={...s,...t==null?void 0:t.header},n=ao(r),o=this._jwks.keys.filter(l=>{let u=n===l.kty;if(u&&typeof a=="string"&&(u=a===l.kid),u&&typeof l.alg=="string"&&(u=r===l.alg),u&&typeof l.use=="string"&&(u=l.use==="sig"),u&&Array.isArray(l.key_ops)&&(u=l.key_ops.includes("verify")),u)switch(r){case"ES256":u=l.crv==="P-256";break;case"ES256K":u=l.crv==="secp256k1";break;case"ES384":u=l.crv==="P-384";break;case"ES512":u=l.crv==="P-521";break;case"Ed25519":u=l.crv==="Ed25519";break;case"EdDSA":u=l.crv==="Ed25519"||l.crv==="Ed448";break}return u}),{0:i,length:c}=o;if(c===0)throw new nt;if(c!==1){const l=new ir,{_cached:u}=this;throw l[Symbol.asyncIterator]=async function*(){for(const d of o)try{yield await wt(u,d,r)}catch{}},l}return wt(this._cached,i,r)}}async function wt(e,s,t){const r=e.get(s)||e.set(s,{}).get(s);if(r[t]===void 0){const a=await Er({...s,ext:!0},t);if(a instanceof Uint8Array||a.type!=="public")throw new at("JSON Web Key Set members must be public keys");r[t]=a}return r[t]}function St(e){const s=new io(e),t=async(r,a)=>s.getKey(r,a);return Object.defineProperties(t,{jwks:{value:()=>br(s._jwks),enumerable:!0,configurable:!1,writable:!1}}),t}const co=async(e,s,t)=>{let r,a,n=!1;typeof AbortController=="function"&&(r=new AbortController,a=setTimeout(()=>{n=!0,r.abort()},s));const o=await fetch(e.href,{signal:r?r.signal:void 0,redirect:"manual",headers:t.headers}).catch(i=>{throw n?new cr:i});if(a!==void 0&&clearTimeout(a),o.status!==200)throw new X("Expected 200 OK from the JSON Web Key Set HTTP response");try{return await o.json()}catch{throw new X("Failed to parse the JSON Web Key Set HTTP response as JSON")}};function lo(){return typeof WebSocketPair<"u"||typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"||typeof EdgeRuntime<"u"&&EdgeRuntime==="vercel"}let Ys;var Ts,Pt;(typeof navigator>"u"||!((Pt=(Ts=navigator.userAgent)==null?void 0:Ts.startsWith)!=null&&Pt.call(Ts,"Mozilla/5.0 ")))&&(Ys="jose/v5.10.0");const qs=Symbol();function uo(e,s){return!(typeof e!="object"||e===null||!("uat"in e)||typeof e.uat!="number"||Date.now()-e.uat>=s||!("jwks"in e)||!Ie(e.jwks)||!Array.isArray(e.jwks.keys)||!Array.prototype.every.call(e.jwks.keys,Ie))}class po{constructor(s,t){if(!(s instanceof URL))throw new TypeError("url must be an instance of URL");this._url=new URL(s.href),this._options={agent:t==null?void 0:t.agent,headers:t==null?void 0:t.headers},this._timeoutDuration=typeof(t==null?void 0:t.timeoutDuration)=="number"?t==null?void 0:t.timeoutDuration:5e3,this._cooldownDuration=typeof(t==null?void 0:t.cooldownDuration)=="number"?t==null?void 0:t.cooldownDuration:3e4,this._cacheMaxAge=typeof(t==null?void 0:t.cacheMaxAge)=="number"?t==null?void 0:t.cacheMaxAge:6e5,(t==null?void 0:t[qs])!==void 0&&(this._cache=t==null?void 0:t[qs],uo(t==null?void 0:t[qs],this._cacheMaxAge)&&(this._jwksTimestamp=this._cache.uat,this._local=St(this._cache.jwks)))}coolingDown(){return typeof this._jwksTimestamp=="number"?Date.now()<this._jwksTimestamp+this._cooldownDuration:!1}fresh(){return typeof this._jwksTimestamp=="number"?Date.now()<this._jwksTimestamp+this._cacheMaxAge:!1}async getKey(s,t){(!this._local||!this.fresh())&&await this.reload();try{return await this._local(s,t)}catch(r){if(r instanceof nt&&this.coolingDown()===!1)return await this.reload(),this._local(s,t);throw r}}async reload(){this._pendingFetch&&lo()&&(this._pendingFetch=void 0);const s=new Headers(this._options.headers);Ys&&!s.has("User-Agent")&&(s.set("User-Agent",Ys),this._options.headers=Object.fromEntries(s.entries())),this._pendingFetch||(this._pendingFetch=co(this._url,this._timeoutDuration,this._options).then(t=>{this._local=St(t),this._cache&&(this._cache.uat=Date.now(),this._cache.jwks=t),this._jwksTimestamp=Date.now(),this._pendingFetch=void 0}).catch(t=>{throw this._pendingFetch=void 0,t})),await this._pendingFetch}}function mo(e,s){const t=new po(e,s),r=async(a,n)=>t.getKey(a,n);return Object.defineProperties(r,{coolingDown:{get:()=>t.coolingDown(),enumerable:!0,configurable:!1},fresh:{get:()=>t.fresh(),enumerable:!0,configurable:!1},reload:{value:()=>t.reload(),enumerable:!0,configurable:!1,writable:!1},reloading:{get:()=>!!t._pendingFetch,enumerable:!0,configurable:!1},jwks:{value:()=>{var a;return(a=t._local)==null?void 0:a.jwks()},enumerable:!0,configurable:!1,writable:!1}}),r}const _e=new Map;let Y={hits:0,misses:0,writes:0,evictions:0};function ve(e){const s=_e.get(e);return s?s.expires<Date.now()?(_e.delete(e),Y.evictions++,Y.misses++,null):(Y.hits++,s.data):(Y.misses++,null)}function se(e,s,t){const r=Date.now()+t*1e3;if(_e.set(e,{data:s,expires:r}),Y.writes++,_e.size>1e3){const a=_e.keys().next().value;a&&(_e.delete(a),Y.evictions++)}}function _o(e){let s=0;for(const t of _e.keys())t.includes(e)&&(_e.delete(t),s++);return s}async function ss(e,s){const t=Array.isArray(s)?s:[s];for(const r of t){const a=_o(r);a>0&&console.log(`[Cache] 🧹 메모리 캐시 삭제: ${r} (${a}개)`);try{await e.CACHE_KV.delete(r),console.log(`[Cache] 🧹 KV 캐시 삭제: ${r}`)}catch(n){console.error(`[Cache] ❌ KV 캐시 삭제 실패: ${r}`,n)}}}const ts={LIVE_STREAMS:["streams:live","streams:all","streams:scheduled","live_streams:live:all:20:0","live_streams:"],PRODUCTS:["products:","featured_products"],CART:e=>[`cart:${e}`],ORDERS:e=>[`orders:${e}`],ALL:["streams:","live_streams:","products:","cart:","orders:"]};function fo(e){const s=e.status>=500?"error":e.status>=400?"warn":"info";console.log(JSON.stringify({timestamp:new Date().toISOString(),level:s,message:"API Request",context:e,duration:e.duration}))}function Eo(e){return{name:"tosspayments",async confirmPayment(s){try{const t=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify({paymentKey:s.paymentKey,orderId:s.orderId,amount:s.amount})}),r=await t.json();if(!t.ok)return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:r.message||"결제 승인 실패",rawData:r};let a={};r.card&&(a={cardCompany:r.card.company,cardNumber:r.card.number,installmentMonths:r.card.installmentPlanMonths||0});let n={};return r.virtualAccount&&(n={virtualAccountBank:r.virtualAccount.bankCode,virtualAccountNumber:r.virtualAccount.accountNumber,virtualAccountHolder:r.virtualAccount.customerName,virtualAccountDueDate:r.virtualAccount.dueDate}),{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,transactionId:r.transactionKey,...a,...n,rawData:r}}catch(t){return{success:!1,orderId:s.orderId,paymentKey:s.paymentKey,method:"",totalAmount:s.amount,status:"FAILED",approvedAt:"",error:t.message,rawData:null}}},async cancelPayment(s){try{const t={cancelReason:s.cancelReason};s.cancelAmount&&(t.cancelAmount=s.cancelAmount);const r=await fetch(`https://api.tosspayments.com/v1/payments/${s.paymentKey}/cancel`,{method:"POST",headers:{Authorization:`Basic ${btoa(e+":")}`,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(t)}),a=await r.json();return r.ok?{success:!0,canceledAt:a.canceledAt||new Date().toISOString(),rawData:a}:{success:!1,error:a.message||"취소 실패"}}catch(t){return{success:!1,error:t.message}}},async getPayment(s){try{const t=await fetch(`https://api.tosspayments.com/v1/payments/${s}`,{method:"GET",headers:{Authorization:`Basic ${btoa(e+":")}`,"TossPayments-API-Version":"2022-11-16"}}),r=await t.json();if(!t.ok)throw new Error(r.message);return{success:!0,orderId:r.orderId,paymentKey:r.paymentKey,method:r.method,totalAmount:r.totalAmount,status:r.status,approvedAt:r.approvedAt,rawData:r}}catch(t){throw t}}}}function ho(e,s){switch(e.toLowerCase()){case"tosspayments":return Eo(s);default:throw new Error(`Unknown payment provider: ${e}`)}}const p=new er;p.use("*",async(e,s)=>{if(e.req.url.includes("localhost")||e.req.url.includes("127.0.0.1"))try{ha(e.env),ga(e.env)}catch(r){console.error("[ENV] Validation failed:",r)}await s()});async function go(e){try{const s=e.req.header("Authorization"),t=(s==null?void 0:s.replace("Bearer ",""))||"";if(!t)return console.warn("[Firebase Auth] No token provided"),null;try{const{verifyFirebaseIdToken:r}=await Promise.resolve().then(()=>Uo),a=await r(t,e.env.FIREBASE_PROJECT_ID||"urteam-live-commerce-5b284");console.log("[Firebase Auth] ✅ Firebase token verified:",a.uid);const n=await e.env.DB.prepare(`
        SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?
      `).bind(a.uid).first();if(!n)return console.warn("[Firebase Auth] User not found for UID:",a.uid),null;const o=a.role||n.user_type||"user";return console.log("[Firebase Auth] ✅ User authenticated:",{userId:n.id,userType:o,email:n.email,firebaseUID:a.uid}),{userId:n.id,userType:o,email:n.email,firebaseUID:a.uid}}catch(r){return console.error("[Firebase Auth] Token verification failed:",r),null}}catch(s){return console.error("[Firebase Auth Error]",s),null}}async function Pe(e,s,t){if(!s)return null;const r=`session:${s}`;try{const a=ve(r);if(a)return a;const n=await e.get(r);if(!n)return null;const o=JSON.parse(n);if(o.expires_at&&Date.now()>o.expires_at)return t!=null&&t.executionCtx||await e.delete(r),null;const i={user_id:o.user_id,user_type:o.user_type||"user",created_at:o.created_at};return se(r,i,900),i}catch(a){return console.error("[Auth] Session lookup error:",a),null}}async function j(e,s){const t=await go(e);if(!t)return e.json({success:!1,error:"Authentication required - Firebase ID Token 필요",code:"AUTH_REQUIRED"},401);e.set("user",{userId:t.userId,userType:t.userType,email:t.email,firebaseUID:t.firebaseUID}),e.set("userId",t.userId),e.set("userType",t.userType),e.set("email",t.email),e.set("firebaseUID",t.firebaseUID),await s()}async function yo(e,s){const t=e.get("userType"),r=e.get("userId");if(t!=="admin")return console.warn("[Security] Unauthorized admin access attempt:",{userId:r,userType:t}),e.json({success:!1,error:"관리자 권한이 필요합니다."},403);await s()}async function bo(e,s){const t=e.get("userType"),r=e.get("userId");if(t!=="seller")return console.warn("[Security] Unauthorized seller access attempt:",{userId:r,userType:t}),e.json({success:!1,error:"판매자 권한이 필요합니다."},403);await s()}async function wo(e){return async(s,t)=>{const r=s.get("userId");if(s.get("userType")==="admin"){await t();return}const n=s.req.param("userId");if(n&&n!==String(r))return console.warn("[Security] Unauthorized resource access attempt:",{resourceType:e,requestedUserId:n,actualUserId:r}),s.json({success:!1,error:"본인의 정보만 조회할 수 있습니다."},403);await t()}}async function So(e,s){try{const t=ve(s);if(t!==null)return t;const r=await e.get(s);if(r){const a=JSON.parse(r);return se(s,a,300),a}return null}catch(t){return console.error("[Cache] Read error:",t),null}}async function ds(e,s,t,r=60,a=!1){try{se(s,t,r),a?(await e.put(s,JSON.stringify(t),{expirationTtl:r}),console.log(`[Cache] ✅ Saved to both Memory + KV: ${s}`)):console.log(`[Cache] ✅ Saved to Memory only (KV Write skipped): ${s}`)}catch(n){console.error("[Cache] Write error:",n)}}async function it(e,...s){try{await Promise.all(s.map(t=>e.delete(t)))}catch(t){console.error("[Cache] Delete error:",t)}}async function ys(e,s,t,r,a,n,o){try{await e.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(s,t,r,a,n,o||null).run(),console.log(`[Notification] Created for ${t} ${s}: ${a}`)}catch(i){console.error("[Notification] Create error:",i)}}async function To(e,s,t,r,a){await ys(e,s,"seller","new_order","🛒 신규 주문이 접수되었습니다",`${r}님의 주문 (${t}) - ${Ro(a)}`,"/seller/orders")}async function wr(e,s,t,r,a,n){let o="",i="";switch(r){case"preparing":o="📦 상품 준비 중",i=`주문번호 ${t}의 상품을 준비하고 있습니다`;break;case"shipping":o="🚚 배송이 시작되었습니다",i=`주문번호 ${t}가 배송 중입니다`,a&&n&&(i+=` (${a}: ${n})`);break;case"delivered":o="✅ 배송 완료",i=`주문번호 ${t}가 배송 완료되었습니다`;break;default:return}await ys(e,s,"user","shipping_status",o,i,"/my-orders")}async function Sr(e,s,t,r,a){await ys(e,s,"seller","low_stock","⚠️ 재고 부족 알림",`${t}의 재고가 ${r}개로 부족합니다 (기준: ${a}개)`,"/seller/products")}function Ro(e){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW"}).format(e)}async function Io(e,s,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const r=await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:s,description:t,scheduledStartTime:new Date().toISOString()},status:{privacyStatus:"public",selfDeclaredMadeForKids:!1},contentDetails:{enableAutoStart:!0,enableAutoStop:!0}})});if(!r.ok){const d=await r.text();throw new Error(`YouTube Broadcast 생성 실패: ${d}`)}const n=(await r.json()).id,o=await fetch("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:`${s} - Stream`},cdn:{frameRate:"variable",ingestionType:"rtmp",resolution:"variable"}})});if(!o.ok){const d=await o.text();throw new Error(`YouTube Stream 생성 실패: ${d}`)}const i=await o.json(),c=i.id,l=i.cdn.ingestionInfo.streamName,u=i.cdn.ingestionInfo.ingestionAddress;return await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${n}&streamId=${c}&part=snippet`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}}),{broadcastId:n,streamId:c,streamKey:l,streamUrl:u}}catch(r){throw console.error("[YouTube API] Live broadcast creation failed:",r),r}}async function vo(e,s){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{const t=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${s}&part=status`,{method:"POST",headers:{Authorization:`Bearer ${e.accessToken}`}});if(!t.ok){const r=await t.text();throw new Error(`YouTube 방송 종료 실패: ${r}`)}}catch(t){throw console.error("[YouTube API] Live broadcast end failed:",t),t}}async function Ao(e,s,t){if(!e.accessToken)throw new Error("YouTube OAuth Access Token이 필요합니다");try{let r=`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${s}&part=snippet,authorDetails`;t&&(r+=`&pageToken=${t}`);const a=await fetch(r,{headers:{Authorization:`Bearer ${e.accessToken}`}});if(!a.ok){const o=await a.text();throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${o}`)}const n=await a.json();return{messages:n.items||[],nextPageToken:n.nextPageToken,pollingIntervalMillis:n.pollingIntervalMillis||5e3}}catch(r){throw console.error("[YouTube API] Get chat messages failed:",r),r}}async function Do(e,s){if(!e.apiKey&&!e.accessToken)throw new Error("YouTube API Key 또는 Access Token이 필요합니다");try{const t=e.accessToken?{Authorization:`Bearer ${e.accessToken}`}:{},r=e.accessToken?`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}`:`https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${s}&key=${e.apiKey}`,a=await fetch(r,{headers:t});if(!a.ok){const l=await a.text();throw new Error(`YouTube 통계 가져오기 실패: ${l}`)}const n=await a.json();if(!n.items||n.items.length===0)throw new Error("Video not found");const o=n.items[0],i=o.statistics,c=o.liveStreamingDetails;return{viewCount:parseInt(i.viewCount||"0"),likeCount:parseInt(i.likeCount||"0"),commentCount:parseInt(i.commentCount||"0"),concurrentViewers:c!=null&&c.concurrentViewers?parseInt(c.concurrentViewers):void 0}}catch(t){throw console.error("[YouTube API] Get live stats failed:",t),t}}function Tr(e){try{if(!/^https?:\/\//.test(e)&&/^[\w-]{11}$/.test(e))return e;const s=new URL(e);if(s.hostname.includes("youtube.com")){const t=s.searchParams.get("v");if(t)return t;const r=s.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);if(r)return r[2]}if(s.hostname==="youtu.be"){const t=s.pathname.slice(1).split("?")[0];if(t&&t.length===11)return t}return null}catch{return null}}function Rr(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const t=s.pathname.match(/\/video\/(\d+)/);if(t)return t[1];const r=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(r)return r[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}function Oo(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){if(s.pathname.includes("/live"))return"live";if(s.pathname.includes("/video/"))return"video"}return null}catch{return null}}function Ir(e){try{const s=new URL(e);if(s.hostname.includes("tiktok.com")){const t=s.pathname.match(/\/@([a-zA-Z0-9_.]+)/);if(t)return t[1]}return s.hostname.includes("vm.tiktok.com")||s.hostname.includes("vt.tiktok.com")?s.pathname.slice(1):null}catch{return null}}p.use("*",async(e,s)=>{await s(),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; frame-src 'self' https://www.youtube.com https://youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");const t=new URL(e.req.url);t.hostname!=="localhost"&&t.protocol==="https:"&&e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("X-Frame-Options","SAMEORIGIN"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",S());p.use(Fe($e.auth));p.use(Fe($e.alimtalk));p.use(Fe($e.order));p.use(Fe($e.refund));p.use(Fe($e.cart));p.use(Fe($e.upload));p.use("/api/*",Fe($e.api));p.use("*",async(e,s)=>{await s(),e.header("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload"),e.header("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"),e.header("X-Frame-Options","DENY"),e.header("X-Content-Type-Options","nosniff"),e.header("X-XSS-Protection","1; mode=block"),e.header("Referrer-Policy","strict-origin-when-cross-origin"),e.header("Permissions-Policy","geolocation=(), microphone=(), camera=(), payment=(self), usb=()")});p.use("/api/*",async(e,s)=>{const t=Date.now(),r=e.req.method,a=e.req.path;await s();const n=Date.now()-t,o=e.res.status,i={method:r,path:a,status:o,duration:n},c=e.get("userId");c&&(i.userId=c),fo(i)});p.use("/static/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/images/*",async(e,s)=>{await s(),e.header("Cache-Control","public, max-age=31536000, immutable"),e.header("CDN-Cache-Control","public, max-age=31536000")});p.use("/api/admin*",async(e,s)=>{if(e.req.path==="/api/admin/login")return s();const t=await j(e,()=>Promise.resolve());if(t)return t;const r=await yo(e,()=>Promise.resolve());return r||s()});p.use("/api/seller*",async(e,s)=>{if(e.req.path==="/api/seller/register")return s();const t=await j(e,()=>Promise.resolve());if(t)return t;const r=await bo(e,()=>Promise.resolve());return r||s()});async function rs(e,s){const t=await e.get(`session:${s}`);if(!t)return null;const r=JSON.parse(t);return r.expires_at&&Date.now()>r.expires_at?(await e.delete(`session:${s}`),null):{session_token:s,[`${r.user_type}_id`]:r.user_id,user_type:r.user_type,...r.userData}}p.post("/api/auth/user/register",S(),$a(qa),async e=>{const{DB:s}=e.env;try{const{email:t,password:r,name:a,phone:n}=e.get("validatedData"),o=`placeholder_hash_for_${r}`;try{const c=(await s.prepare(`
        INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(t,o,a,n||null).run()).meta.last_row_id,l=`user_${c}_${Date.now()}_${Math.random().toString(36).substring(7)}`;return e.json({success:!0,data:{access_token:l,user:{id:c,email:t,name:a,phone:n}}})}catch(i){const c=i.message||"";if(c.includes("UNIQUE")||c.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw i}}catch(t){return console.error("[User Register] Error:",t),e.json({success:!1,error:t.message||"회원가입 중 오류가 발생했습니다"},500)}});p.post("/api/auth/user/login",S(),async e=>{const{DB:s,SESSION_KV:t}=e.env;try{const{email:r,password:a}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const n=await s.prepare(`
      SELECT id, email, name, kakao_id, password_hash, password, created_at
      FROM users 
      WHERE email = ?
    `).bind(r).first();if(!n)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(n.password_hash&&n.password_hash.includes(`placeholder_hash_for_${a}`)||n.password&&n.password===a))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);await s.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(n.id).run();const i=crypto.randomUUID(),c=Date.now()+720*60*60*1e3;return await t.put(`session:${i}`,JSON.stringify({user_id:n.id,user_type:"user",expires_at:c,created_at:Date.now()}),{expirationTtl:720*60*60}),console.log("[User Login] Session created in SESSION_KV for user:",n.id),e.json({success:!0,data:{session_token:i,user:{id:n.id,email:n.email,name:n.name,phone:n.phone,profile_image:n.profile_image}}})}catch(r){return console.error("[User Login] Error:",r),e.json({success:!1,error:r.message||"로그인 중 오류가 발생했습니다"},500)}});p.post("/api/auth/login",S(),async e=>e.json({success:!1,error:"This endpoint is deprecated. Please use Firebase Authentication.",message:"Admin/Seller login should use /api/admin/login or /api/seller/login with Firebase Auth",code:"DEPRECATED_ENDPOINT"},410));p.post("/api/auth/logout",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");return t&&await e.env.SESSION_KV.delete(`session:${t}`),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/seller/register",S(),async e=>{const{DB:s}=e.env;try{const{email:t,password:r,name:a,phone:n,business_number:o,company_name:i}=await e.req.json();if(!t||!r||!a||!n)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(r.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const c=t.split("@")[0],l=`placeholder_hash_for_${r}`;try{const u=await s.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, phone, 
          business_number, company_name, status, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
      `).bind(c,t,l,a,n,o||null,i||null).run();return e.json({success:!0,data:{sellerId:u.meta.last_row_id,message:"회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."}})}catch(u){const d=u.message||"";if(d.includes("UNIQUE")||d.includes("unique"))return e.json({success:!1,error:"이미 가입된 이메일입니다"},400);throw u}}catch(t){return console.error("Seller registration error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/admin/login",S(),async e=>{const{DB:s}=e.env;try{const{email:t,password:r}=await e.req.json();if(!t||!r)return e.json({success:!1,error:"이메일과 비밀번호를 입력해주세요"},400);const a=await s.prepare(`
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
    `).bind(t).first();if(!a)return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!(t==="admin@example.com"&&r==="admin123"||a.password_hash&&a.password_hash.includes(`placeholder_hash_for_${r}`)))return e.json({success:!1,error:"이메일 또는 비밀번호가 일치하지 않습니다"},401);if(!a.is_active)return e.json({success:!1,error:"비활성화된 계정입니다"},403);const i=gs(e.env),c=`admin_${a.id}`;try{await i.auth.getUser(c).catch(async()=>{await i.auth.createUser({uid:c,email:a.email,displayName:a.name})}),await i.auth.setCustomUserClaims(c,{role:"admin",userId:a.id,userName:a.name||a.email,email:a.email});const l=await i.createCustomToken(c,{role:"admin",userId:a.id,userName:a.name||a.email,email:a.email});return await s.prepare(`
        UPDATE admins SET firebase_uid = ? WHERE id = ?
      `).bind(c,a.id).run(),await s.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(a.id).run(),console.log(`[Firebase Login] ✅ Admin ${a.email} logged in with Firebase (KV Write: 0)`),e.json({success:!0,data:{customToken:l,admin:{id:a.id,username:a.username,email:a.email,name:a.name,firebaseUID:c}}})}catch(l){return console.error("[Firebase] Admin login error:",l),e.json({success:!1,error:"Firebase authentication failed"},500)}}catch(t){return console.error("Admin login error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/auth/verify",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await rs(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=r.user_type==="admin"?"admins":"sellers",n=r.user_type==="admin"?r.admin_id:r.seller_id,o=await s.prepare(`
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
    `).bind(n).first();return o?e.json({success:!0,data:{user:{id:o.id,type:r.user_type,username:o.username,name:o.name,email:o.email,businessName:o.business_name}}}):e.json({success:!1,error:"사용자를 찾을 수 없습니다"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/auth/kakao/sync/callback",async e=>{var t,r,a,n,o,i,c,l,u,d,m,f,_;const{DB:s}=e.env;try{console.log("[Kakao Sync] Callback started"),console.log("[Kakao Sync] DB available:",!!s);const h=e.req.query("code"),w=e.req.query("state")||"/",b=e.req.query("error");if(console.log("[Kakao Sync] Query params:",{hasCode:!!h,state:w,error:b}),b)return console.error("[Kakao Sync] OAuth error:",b),e.redirect(`${w}?error=kakao_oauth_${b}`);if(!h)return console.error("[Kakao Sync] No authorization code"),e.redirect(`${w}?error=no_code`);console.log("[Kakao Sync] Authorization code received");const g=e.env.KAKAO_REST_API_KEY||"5dd74bccb797640b0efd070467f3bafd",T=`${new URL(e.req.url).origin}/auth/kakao/sync/callback`;console.log("[Kakao Sync] Exchanging code for token..."),console.log("  - REST_API_KEY:",g.substring(0,10)+"..."),console.log("  - REDIRECT_URI:",T),console.log("[Kakao Sync] Step 1: Fetching access token...");const y=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:g,redirect_uri:T,code:h})});if(console.log("[Kakao Sync] Token response status:",y.status),console.log("[Kakao Sync] Token request details:",{client_id:g,redirect_uri:T,code_length:h.length,code_prefix:h.substring(0,20)}),!y.ok){const q=await y.text();return console.error("[Kakao Sync] Token request failed:",q),e.redirect(`${w}?error=token_request_failed&detail=${encodeURIComponent(q)}`)}const R=await y.json();if(console.log("[Kakao Sync] Token data received:",{hasAccessToken:!!R.access_token,error:R.error,errorDescription:R.error_description}),!R.access_token)return console.error("[Kakao Sync] Token error:",R),e.redirect(`${w}?error=token_failed&detail=${encodeURIComponent(R.error||"unknown")}`);console.log("[Kakao Sync] Access token obtained successfully"),console.log("[Kakao Sync] Step 2: Fetching user info...");const F=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${R.access_token}`}});console.log("[Kakao Sync] User response status:",F.status);const C=await F.json();if(console.log("[Kakao Sync] User data received:",{hasId:!!C.id,id:C.id,hasNickname:!!((t=C.properties)!=null&&t.nickname||(a=(r=C.kakao_account)==null?void 0:r.profile)!=null&&a.nickname)}),!C.id)return console.error("[Kakao Sync] Failed to get user info:",C),e.redirect(`${w}?error=user_info_failed`);console.log("[Kakao Sync] User info obtained successfully"),console.log("[Kakao Sync] Step 2.5: Fetching service terms...");const D=await fetch("https://kapi.kakao.com/v2/user/service_terms",{headers:{Authorization:`Bearer ${R.access_token}`}});console.log("[Kakao Sync] Terms response status:",D.status);let W=null;if(D.ok?(W=await D.json(),console.log("[Kakao Sync] Service terms received:",{allowedServiceTerms:((n=W.allowed_service_terms)==null?void 0:n.length)||0,tags:(o=W.allowed_service_terms)==null?void 0:o.map(q=>q.tag)})):console.warn("[Kakao Sync] Failed to fetch service terms (non-critical)"),console.log("[Kakao Sync] Step 3: Saving user to database..."),!s)return console.error("[Kakao Sync] DB is not available!"),e.redirect(`${w}?error=db_not_available`);const P=C.id.toString(),L=((i=C.properties)==null?void 0:i.nickname)||((l=(c=C.kakao_account)==null?void 0:c.profile)==null?void 0:l.nickname)||"Kakao User",$=((u=C.kakao_account)==null?void 0:u.email)||"",Q=((d=C.properties)==null?void 0:d.profile_image)||((f=(m=C.kakao_account)==null?void 0:m.profile)==null?void 0:f.profile_image_url)||"",z=R.access_token,v=((_=W==null?void 0:W.allowed_service_terms)==null?void 0:_.map(q=>q.tag))||[],te=JSON.stringify(v);console.log("[Kakao Sync] User data:",{kakaoId:P,nickname:L,email:$?"exists":"none",serviceTerms:v});try{const q=await s.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(P).first();console.log("[Kakao Sync] Existing user check:",!!q);let U;q?(U=q.id,await s.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(L,$,Q,U).run(),console.log("[Kakao Sync] Updated user:",U)):(U=(await s.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(P,L,$||null,Q||null).run()).meta.last_row_id,console.log("[Kakao Sync] Created user:",U)),console.log("[Kakao Sync] User saved successfully, userId:",U),console.log("[Kakao Sync] Step 4: Generating Firebase Custom Token...");try{const H=gs(e.env),re=`kakao_${P}`,bs=await H.createCustomToken(re,{role:"user",userId:U,userName:L,email:$||void 0,kakaoId:P});try{await s.prepare(`
            UPDATE users SET firebase_uid = ? WHERE id = ?
          `).bind(re,U).run()}catch(ct){console.warn("[Kakao Sync] firebase_uid column not found, skipping update:",ct)}console.log("[Kakao Sync] ✅ Firebase Custom Token 발급 완료 for user:",U),console.log("[Kakao Sync] Step 5: Redirecting with Firebase Custom Token...");const as=w.includes("?")?`${w}&firebase_token=${encodeURIComponent(bs)}&userName=${encodeURIComponent(L)}`:`${w}?firebase_token=${encodeURIComponent(bs)}&userName=${encodeURIComponent(L)}`;return console.log("[Kakao Sync] Redirect URL (Firebase):",as.substring(0,100)+"..."),e.redirect(as)}catch(H){console.error("[Kakao Sync] 🔴 Firebase Custom Token 생성 실패:",H),console.error("[Kakao Sync] Firebase 환경변수 체크 필요:",{hasProjectId:!!e.env.FIREBASE_PROJECT_ID,hasPrivateKey:!!e.env.FIREBASE_PRIVATE_KEY,hasClientEmail:!!e.env.FIREBASE_CLIENT_EMAIL,hasDatabaseURL:!!e.env.FIREBASE_DATABASE_URL});const re=H.message||"Unknown error";return e.redirect(`${w}?error=firebase_config_error&detail=${encodeURIComponent("Firebase 인증 설정 오류. 관리자에게 문의하세요. ("+re+")")}`)}}catch(q){return console.error("[Kakao Sync] Database error:",q),console.error("[Kakao Sync] DB error details:",{message:q.message,name:q.name}),e.redirect(`${w}?error=database_error&detail=${encodeURIComponent(q.message)}`)}}catch(h){console.error("[Kakao Sync] Exception:",h),console.error("[Kakao Sync] Error details:",{message:h.message,stack:h.stack,name:h.name});const w=e.req.query("state")||"/",b=encodeURIComponent(h.message||"unknown");return e.redirect(`${w}?error=kakao_sync_failed&detail=${b}`)}});p.post("/api/auth/kakao/callback",S(),async e=>{const{DB:s}=e.env;try{const{code:t,redirect_uri:r}=await e.req.json();if(!t)return e.json({success:!1,error:"Authorization code is required"},400);if(!e.env.KAKAO_REST_API_KEY)return console.error("[Kakao Callback] KAKAO_REST_API_KEY not configured"),e.json({success:!1,error:"Server configuration error",code:"MISSING_API_KEY"},500);const a=r||"https://live.ur-team.com/auth/kakao/callback";console.log("[Kakao Callback] Starting OAuth flow with Firebase Custom Token");const n=await ka(t,a,e.env.KAKAO_REST_API_KEY),{user:o}=await tr(s,n),i=gs(e.env),c=`kakao_${o.kakao_id}`,l=await i.createCustomToken(c,{userId:o.id,userName:o.name,role:o.type||"user",email:o.email||void 0,kakaoId:o.kakao_id});console.log("[Kakao Callback] ✅ Firebase Custom Token 발급 완료 for user:",o.id);try{await s.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(c,o.id).run()}catch(u){console.warn("[Kakao Callback] firebase_uid column not found, skipping update:",u)}return e.json({success:!0,data:{customToken:l,user:{id:o.id,name:o.name,email:o.email,profile_image:o.profile_image,firebaseUID:c}}})}catch(t){return console.error("[Kakao Callback] Error:",t),t instanceof ne?e.json({success:!1,error:t.message,code:t.code},t.statusCode):e.json({success:!1,error:t.message||"Internal server error",code:"UNKNOWN_ERROR"},500)}});p.post("/api/auth/kakao/firebase",S(),async e=>{const{DB:s}=e.env;try{const{accessToken:t}=await e.req.json();if(!t)return e.json({success:!1,error:"Access token is required"},400);console.log("[Kakao Firebase] Processing Kakao OAuth login");const r=Date.now(),{user:a}=await tr(s,t);console.log("[Kakao Firebase] ProcessKakaoLogin completed in",Date.now()-r,"ms");const n=await generateFirebaseCustomToken(a.id.toString(),{role:"user",email:a.email,name:a.name});return console.log("[Kakao Firebase] ✅ Firebase Custom Token 생성 완료 for user:",a.id),console.log("[Kakao Firebase] Total login time:",Date.now()-r,"ms"),e.json({success:!0,customToken:n,user:{id:a.id,name:a.name,email:a.email,profile_image:a.profile_image}})}catch(t){return console.error("[Kakao Firebase] Error:",t),t instanceof ne?e.json({success:!1,error:t.message,code:t.code},t.statusCode):e.json({success:!1,error:t instanceof Error?t.message:"Login failed",code:"UNKNOWN_ERROR"},500)}});let Hs=null;function Co(e){if(e!=null&&e.FIREBASE_PROJECT_ID)return e.FIREBASE_PROJECT_ID;const s="urteam-live-commerce-5b284";return console.warn("[Firebase] ⚠️ FIREBASE_PROJECT_ID 환경 변수 없음, 폴백 사용:",s),s}async function ko(e,s){var r;const t=Co(s);try{Hs||(Hs=mo(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")),console.log("[Firebase] ✅ JWK Set initialized for project:",t));const{payload:a}=await ro(e,Hs,{issuer:`https://securetoken.google.com/${t}`,audience:t});return console.log("[Firebase] ✅ Token verified:",{sub:a.sub,email:a.email,iss:a.iss,aud:a.aud,exp:a.exp}),a}catch(a){return console.error("[Firebase] ❌ Token verification failed:",{error:a.message,code:a.code,claim:a.claim,reason:a.reason,expectedProjectId:t}),a.code==="ERR_JWT_EXPIRED"?console.error("[Firebase] Token expired. User needs to re-authenticate."):a.code==="ERR_JWT_CLAIM_VALIDATION_FAILED"?(console.error("[Firebase] Claim validation failed:",a.claim),a.claim==="aud"&&(console.error("[Firebase] ⚠️ Audience mismatch! Check FIREBASE_PROJECT_ID"),console.error("[Firebase] Expected:",t),console.error("[Firebase] Got:",(r=a.payload)==null?void 0:r.aud))):a.code==="ERR_JWS_SIGNATURE_VERIFICATION_FAILED"&&console.error("[Firebase] Invalid signature. Token may be tampered."),null}}p.post("/api/auth/firebase/sync",S(),async e=>{var r,a;const{DB:s,CACHE_KV:t}=e.env;try{const{idToken:n,firebaseUid:o,email:i,displayName:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"idToken and firebaseUid are required"},400);const l=`sync_limit:${o}`,u=await t.get(l),d=6e5;if(u){const _=Date.now()-parseInt(u);if(_<d)return console.log(`[Firebase Sync] ⏳ Rate limited (${Math.floor((d-_)/1e3)}s remaining):`,o),e.json({success:!1,error:"Rate limited",retryAfter:Math.ceil((d-_)/1e3)},429)}console.log("[Firebase Sync] Syncing user to D1:",{firebaseUid:o,email:i});const m=await ko(n,e.env);if(console.log("[Firebase Sync] Token decoded:",{hasDecoded:!!m,decodedSub:m==null?void 0:m.sub,firebaseUid:o,match:(m==null?void 0:m.sub)===o}),!m||m.sub!==o)return console.error("[Firebase Sync] ❌ Token validation failed:",{decoded:!!m,expectedUid:o,actualSub:m==null?void 0:m.sub,projectId:((r=e.env)==null?void 0:r.FIREBASE_PROJECT_ID)||"NOT_SET"}),e.json({success:!1,error:"Invalid Firebase token",details:{expectedUid:o,actualSub:(m==null?void 0:m.sub)||null,projectId:((a=e.env)==null?void 0:a.FIREBASE_PROJECT_ID)||"NOT_SET"}},401);console.log("[Firebase Sync] ✅ Token verified successfully");const f=await s.prepare("SELECT id, email, name FROM users WHERE firebase_uid = ?").bind(o).first();if(f)return await s.prepare(`
        UPDATE users 
        SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE firebase_uid = ?
      `).bind(i||f.email,c||f.name,o).run(),await t.put(l,Date.now().toString(),{expirationTtl:60}),console.log("[Firebase Sync] ✅ 기존 사용자 업데이트 완료:",f.id),e.json({success:!0,user:{id:f.id,email:i||f.email,name:c||f.name}});if(i){const _=await s.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(i).first();if(_)return await s.prepare(`
            UPDATE users 
            SET firebase_uid = ?, name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
          `).bind(o,c||_.name,i).run(),await t.put(l,Date.now().toString(),{expirationTtl:60}),console.log("[Firebase Sync] ✅ 기존 이메일 사용자에 firebase_uid 연결:",_.id),e.json({success:!0,user:{id:_.id,email:_.email,name:c||_.name}})}return e.json({success:!1,error:"User not found. Please register first."},404)}catch(n){console.error("[Firebase Sync] Error:",n);const o=n instanceof Error?n.message:"Unknown error";return o.includes("no such column: firebase_uid")?(console.warn("[Firebase Sync] ⚠️ firebase_uid column not found - migration needed"),e.json({success:!0,warning:"Database migration pending",requiresMigration:!0})):((o.includes("D1_ERROR")||o.includes("SQLITE_ERROR"))&&console.error("[Firebase Sync] 🔴 D1 Database Error:",o),e.json({success:!1,error:o},500))}});p.get("/api/auth/firebase/user-id/:firebaseUid",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("firebaseUid");if(!t)return e.json({success:!1,error:"firebaseUid is required"},400);const r=await s.prepare("SELECT id, name, email FROM users WHERE firebase_uid = ?").bind(t).first();return r?e.json({success:!0,userId:r.id,userName:r.name,userEmail:r.email}):e.json({success:!1,error:"User not found"},404)}catch(t){console.error("[Firebase User ID Lookup] Error:",t);const r=t instanceof Error?t.message:"Unknown error";return r.includes("no such column: firebase_uid")?e.json({success:!1,error:"Database migration needed",requiresMigration:!0},503):e.json({success:!1,error:r},500)}});p.post("/api/auth/firebase/register",S(),async e=>{const{DB:s}=e.env;try{const{idToken:t,firebaseUid:r,email:a,name:n,userType:o}=await e.req.json();if(!t||!r||!a||!n)return e.json({success:!1,error:"idToken, firebaseUid, email, and name are required"},400);console.log("[Firebase Register] Registering new user:",{firebaseUid:r,email:a,userType:o});const i=await verifyFirebaseToken(t,e.env);if(!i||i.uid!==r)return e.json({success:!1,error:"Invalid Firebase token"},401);const c=await s.prepare(`
      INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(r,a,n).run();return console.log("[Firebase Register] ✅ 새 사용자 생성 완료:",c.meta.last_row_id),e.json({success:!0,user:{id:c.meta.last_row_id,email:a,name:n,firebaseUid:r}})}catch(t){return console.error("[Firebase Register] Error:",t),t instanceof Error&&t.message.includes("UNIQUE")?e.json({success:!1,error:"Email already exists",code:"EMAIL_EXISTS"},409):e.json({success:!1,error:t instanceof Error?t.message:"Registration failed"},500)}});p.get("/api/auth/validate",S(),async e=>{try{const s=e.req.header("Authorization"),t=(s==null?void 0:s.replace("Bearer ",""))||"";if(!t)return e.json({success:!1,valid:!1,error:"No JWT token provided",code:"NO_TOKEN"},401);const r=getJwtSecret(e.env);console.log("[JWT Validate] Secret (first 20 chars):",r.substring(0,20)),console.log("[JWT Validate] Token (first 50 chars):",t.substring(0,50));const a=await verifyCachedToken(t,r);return console.log("[JWT Validate] Payload:",a?"Valid":"Invalid/Expired"),a?e.json({success:!0,valid:!0,data:{user_id:a.userId,user_type:a.userType,email:a.email,session_valid:!0},user:{userId:a.userId,userType:a.userType,email:a.email}}):e.json({success:!1,valid:!1,error:"JWT token expired or invalid",code:"TOKEN_EXPIRED"},401)}catch(s){return console.error("[JWT Validate Error]",s),e.json({success:!1,valid:!1,error:"Internal server error",code:"INTERNAL_ERROR"},500)}});p.post("/api/auth/refresh",S(),async e=>{try{const s=await e.req.json(),{refreshToken:t}=s;if(!t)return e.json({success:!1,error:"No refresh token provided",code:"NO_REFRESH_TOKEN"},400);const r=getJwtSecret(e.env),a=await refreshAccessToken(t,r);return a?e.json({success:!0,data:{accessToken:a}}):e.json({success:!1,error:"Refresh token expired or invalid",code:"REFRESH_TOKEN_EXPIRED"},401)}catch(s){return console.error("[JWT Refresh Error]",s),e.json({success:!1,error:"Internal server error",code:"INTERNAL_ERROR"},500)}});p.post("/api/auth/kakao/logout",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token")||"";return t&&(await s.prepare("DELETE FROM admin_sessions WHERE session_token = ?").bind(t).run(),console.log("[Kakao Sync] Session deleted")),e.json({success:!0})}catch(t){return console.error("[Kakao Sync] Logout error:",t),e.json({success:!1,error:"Logout failed"},500)}});p.post("/api/auth/kakao/unlink",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증이 필요합니다"},401);if(console.log("[Kakao Unlink] Starting unlink process..."),!await s.prepare(`
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
    `).run(),await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(n.id).run(),await s.prepare("DELETE FROM users WHERE id = ?").bind(n.id).run(),console.log("[Kakao Webhook] User data deleted successfully"),e.json({success:!0})):(console.log("[Kakao Webhook] User not found:",r),e.json({success:!0}))}catch(t){return console.error("[Kakao Webhook] Error:",t),e.json({success:!1,error:"Webhook processing failed"},500)}});p.get("/api/auth/user/verify",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다"},401);const r=await rs(e.env.SESSION_KV,t);if(!r||r.user_type!=="user")return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const a=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:a.results||[]})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/shipping-addresses",S(),j,async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),r=t.user_id,a=t.recipient_name,n=t.phone,o=t.postal_code,i=t.address,c=t.address_detail,l=t.is_default;if(console.log("[POST /api/shipping-addresses] Received:",JSON.stringify(t)),!r||!a||!n||!i)return console.error("[POST /api/shipping-addresses] Missing required fields:",{userId:r,recipientName:a,phone:n,address:i}),e.json({success:!1,error:"필수 정보를 입력해주세요"},400);l&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(r).run();const u=await s.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a,n,o||"",i,c||"",l?1:0).run();return console.log("[POST /api/shipping-addresses] Success:",{id:u.meta.last_row_id}),e.json({success:!0,data:{id:u.meta.last_row_id}})}catch(t){return console.error("[POST /api/shipping-addresses] Error:",t),e.json({success:!1,error:t.message},500)}});p.put("/api/shipping-addresses/:id",S(),j,async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=await e.req.json(),a=r.user_id,n=r.recipient_name,o=r.phone,i=r.postal_code,c=r.address,l=r.address_detail,u=r.is_default;return u&&await s.prepare("UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?").bind(a).run(),await s.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(n,o,i||"",c,l||"",u?1:0,t,a).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/shipping-addresses/:id",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("id"),r=e.req.query("userId");return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t,r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});async function x(e){const s=e.req.header("Authorization");if(s!=null&&s.startsWith("Bearer ")){const a=s.substring(7);try{const n=await verifyJWT(a,e.env.JWT_SECRET);return n.userType!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:n.userId,userData:n}}catch(n){console.error("[verifyAdminSession] JWT verification failed:",n)}}const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await rs(e.env.SESSION_KV,t);return!r||r.user_type!=="admin"?{success:!1,error:"관리자 권한이 필요합니다"}:{success:!0,adminId:r.admin_id,userData:r}}async function k(e){const s=e.req.header("Authorization");if(s!=null&&s.startsWith("Bearer ")){const a=s.substring(7);try{const n=await verifyJWT(a,e.env.JWT_SECRET);return n.userType!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:n.userId,userData:n}}catch(n){console.error("[verifySellerSession] JWT verification failed:",n)}}const t=e.req.header("X-Session-Token");if(!t)return{success:!1,error:"인증 토큰이 없습니다"};const r=await rs(e.env.SESSION_KV,t);return!r||r.user_type!=="seller"?{success:!1,error:"판매자 권한이 필요합니다"}:{success:!0,sellerId:r.seller_id,userData:r}}p.get("/api/health",e=>e.json({success:!0,status:"healthy",timestamp:new Date().toISOString(),env:{hasDB:!!e.env.DB,hasSessionKV:!!e.env.SESSION_KV,hasCacheKV:!!e.env.CACHE_KV}}));p.get("/api/cleanup/expired-reservations",async e=>{const{DB:s}=e.env;try{console.log("========================================"),console.log("[Cleanup] ⏰ 만료된 재고 예약 정리 시작"),console.log("========================================");const t=new Date().toISOString();console.log("[Cleanup] 현재 시간:",t);const r=await s.prepare(`
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
        `).bind(n.id).run(),console.log(`[Cleanup] ✅ ${n.order_number}: ${o.results.length}개 상품 예약 해제`),a++}catch(o){console.error(`[Cleanup] ❌ ${n.order_number} 처리 실패:`,o)}return console.log(`[Cleanup] ✅ 정리 완료: ${a}/${r.results.length}개`),e.json({success:!0,message:`${a}개의 만료된 예약을 정리했습니다.`,cleaned:a,total:r.results.length})}catch(t){return console.error("[Cleanup] ❌ 정리 실패:",t),e.json({success:!1,error:"만료된 예약 정리 중 오류가 발생했습니다.",details:t.message},500)}});p.get("/api/test/env",async e=>{try{const s=await wa(e.env);return e.json(s)}catch(s){return e.json({success:!1,error:"환경 변수 테스트 실행 중 오류 발생",details:s instanceof Error?s.message:String(s)},500)}});p.get("/api/streams",et(st.liveStreams),async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.query("status")||"all",a=`streams:${r}`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});let o=`
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
      ls.created_at DESC`;const i=await s.prepare(o).all();return await t.put(a,JSON.stringify(i.results),{expirationTtl:600}),e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:id",async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=await s.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(t).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/live-streams",async e=>{const{DB:s}=e.env,{status:t,seller_id:r,limit:a="20",offset:n="0"}=e.req.query();try{const o=`live_streams:${t||"all"}:${r||"all"}:${a}:${n}`,i=60,c=ve(o);if(c)return console.log("[LiveStreams] ⚡ 메모리 캐시 히트:",o),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStreams] 🔄 백그라운드 갱신 시작:",o);const u=await Tt(s,t,r,a,n);se(o,u,i),console.log("[LiveStreams] ✅ 백그라운드 갱신 완료:",o)}catch(u){console.error("[LiveStreams] ❌ 백그라운드 갱신 실패:",u)}})()),e.json({success:!0,data:c});console.log("[LiveStreams] 💾 DB 조회:",o);const l=await Tt(s,t,r,a,n);return se(o,l,i),e.json({success:!0,data:l})}catch(o){return console.error("[API] Live streams list error:",o),e.json({success:!1,error:`라이브 스트림 목록 조회 실패: ${o.message}`},500)}});async function Tt(e,s,t,r,a){let n=`
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;const o=[];s&&(n+=" AND ls.status = ?",o.push(s)),t&&(n+=" AND ls.seller_id = ?",o.push(t)),n+=' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC',n+=" LIMIT ? OFFSET ?",o.push(parseInt(r),parseInt(a));const{results:i}=await e.prepare(n).bind(...o).all();return i}p.get("/api/live-streams/:id",async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=`live_stream:${t}`,a=30,n=ve(r);if(n)return console.log("[LiveStream] ⚡ 메모리 캐시 히트:",r),e.executionCtx.waitUntil((async()=>{try{console.log("[LiveStream] 🔄 백그라운드 갱신 시작:",r);const i=await Rt(s,t);i&&(se(r,i,a),console.log("[LiveStream] ✅ 백그라운드 갱신 완료:",r))}catch(i){console.error("[LiveStream] ❌ 백그라운드 갱신 실패:",i)}})()),e.json({success:!0,data:n});console.log("[LiveStream] 💾 DB 조회:",r);const o=await Rt(s,t);return o?(se(r,o,a),e.json({success:!0,data:o})):e.json({success:!1,error:"Stream not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});async function Rt(e,s){return await e.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(s).first()}p.get("/api/products",et(st.products),async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.query("featured"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0"),o=`products:list:${r||"all"}:${a}:${n}`,i=ve(o);if(i)return e.executionCtx.waitUntil((async()=>{try{const l=await It(s,r,a,n);se(o,l,3600),await ds(t,o,l,300,!1)}catch(l){console.error("[Cache Revalidate] Products error:",l)}})()),e.json({success:!0,data:i,cached:!0});const c=await It(s,r,a,n);return se(o,c,3600),await ds(t,o,c,300,!1),e.json({success:!0,data:c,cached:!1})}catch(r){return console.error("Products list error:",r),e.json({success:!1,error:r.message},500)}});async function It(e,s,t,r){let a;return s==="true"?a=`
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
    `,(await e.prepare(a).bind(t,r).all()).results||[]}p.get("/api/products/popular",async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r="products:popular",a=ve(r);if(a)return e.executionCtx.waitUntil((async()=>{try{const o=await vt(s);se(r,o,3600),await ds(t,r,o,600,!1)}catch(o){console.error("[Cache Revalidate] Popular products error:",o)}})()),e.json({success:!0,data:a,cached:!0});const n=await vt(s);return se(r,n,3600),await ds(t,r,n,600,!1),e.json({success:!0,data:n,cached:!1})}catch(r){return console.error("Popular products error:",r),e.json({success:!1,error:r.message},500)}});async function vt(e){return(await e.prepare(`
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
        `).bind(o,r,a).all(),l=await s.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(o).first();return e.json({success:!0,data:{products:c.results||[],total:(l==null?void 0:l.total)||0,query:t,limit:r,offset:a,searchMethod:"fts5"}})}else throw console.log("[Search] ⚠️ FTS5 미사용 - LIKE 검색 fallback"),new Error("FTS5 not available")}catch(i){console.log("[Search] 💾 LIKE 검색 fallback:",i.message);const c=`%${n}%`,l=await s.prepare(`
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
      `).bind(c,c,c,c,c).first();return e.json({success:!0,data:{products:l.results||[],total:(u==null?void 0:u.total)||0,query:t,limit:r,offset:a,searchMethod:"like"}})}}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/products/:id",async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=`product:detail:${t}`,a=ve(r);if(a)return e.executionCtx.waitUntil((async()=>{try{const o=await At(s,t);se(r,o,1800)}catch(o){console.error("[Cache Revalidate] Product detail error:",o)}})()),e.json({success:!0,data:a,cached:!0});const n=await At(s,t);return n?(se(r,n,1800),e.json({success:!0,data:n,cached:!1})):e.json({success:!1,error:"Product not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});async function At(e,s){const t=await e.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, '리스터코퍼레이션') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(s).first();if(!t)return null;const r=await e.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(s).all();return{product:t,options:r.results}}p.get("/api/products/:id/stock",et(st.microCache),async e=>{const{DB:s}=e.env,t=e.req.param("id");try{const r=await s.prepare("SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1").bind(t).first();return r?e.json({success:!0,data:{productId:r.id,productName:r.name,stock:r.stock,available:r.stock>0}}):e.json({success:!1,error:"Product not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/products",async e=>{const{DB:s}=e.env,t=e.req.param("streamId");try{const r=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:`장바구니 조회 실패: ${r.message}`},500)}});p.get("/api/cart/:userId",j,async e=>{const{DB:s}=e.env,t=e.get("userId"),r=e.req.param("userId");try{let a=await s.prepare("SELECT id FROM users WHERE id = ?").bind(t).first();if(!a)return e.json({success:!1,error:"사용자를 찾을 수 없습니다."},404);const n=a.id;if(r!==String(n))return e.json({success:!1,error:"본인의 장바구니만 조회할 수 있습니다."},403);const o=await s.prepare(`
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
    `).bind(n).all();return e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/users",async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),{kakaoId:r,name:a,email:n,phone:o}=t;if(!r||!a)return e.json({success:!1,error:"kakaoId and name are required"},400);const i=await s.prepare("SELECT id FROM users WHERE kakao_id = ?").bind(r).first();if(i)return e.json({success:!0,data:{id:i.id}});const c=await s.prepare("INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)").bind(r,a,n||null,o||null).run();return e.json({success:!0,data:{id:c.meta.last_row_id}})}catch(t){return console.error("Error creating user:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/cart",S(),j,async e=>{const{DB:s}=e.env;try{const t=e.get("userId");if(!t)return e.json({success:!1,error:"Authentication required"},401);const r=await e.req.json(),{productId:a,optionId:n,quantity:o,priceSnapshot:i,liveStreamId:c}=r,l=t,u=await s.prepare("SELECT stock FROM products WHERE id = ?").bind(a).first();if(!u||u.stock<o)return e.json({success:!1,error:"Insufficient stock"},400);const d=await s.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(l,a,n||null,n||null).first();let m;if(d){const f=d.quantity+o;await s.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(f,i,d.id).run(),m=d.id}else m=(await s.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(l,a,n||null,o,i,c||null).run()).meta.last_row_id;return e.json({success:!0,data:{id:m,isUpdate:!!d}})}catch(t){return console.error("[API /api/cart POST] Error:",t),console.error("[API /api/cart POST] Error message:",t.message),console.error("[API /api/cart POST] Error stack:",t.stack),e.json({success:!1,error:"Failed to add to cart: "+(t.message||"Unknown error")},500)}});p.delete("/api/cart/:cartItemId",j,async e=>{const{DB:s}=e.env,t=e.req.param("cartItemId");try{return await s.prepare("DELETE FROM cart_items WHERE id = ?").bind(t).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/cart/clear/:userId",j,wo("cart"),async e=>{const{DB:s}=e.env,t=e.req.param("userId");try{return await s.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(t).run(),e.json({success:!0,message:"장바구니가 비워졌습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/cart/:cartItemId",j,async e=>{const{DB:s}=e.env,t=e.req.param("cartItemId");try{const r=await e.req.json(),{quantity:a}=r;if(!a||a<1)return e.json({success:!1,error:"Invalid quantity"},400);const n=await s.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(t).first();return n?n.stock<a?e.json({success:!1,error:"Insufficient stock"},400):(await s.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(a,t).run(),e.json({success:!0})):e.json({success:!1,error:"Cart item not found"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/orders",j,async e=>{const{DB:s}=e.env;try{const t=await e.req.json(),{userId:r,cartItemIds:a,shippingInfo:n,items:o,shippingAddress:i,shippingAddressDetail:c,recipientName:l,recipientPhone:u,deliveryMemo:d,totalAmount:m,shippingFee:f,orderNumber:_,paymentKey:h,paymentMethod:w}=t;if(o&&o.length>0){const D=o.map(M=>M.productId),W=D.map(()=>"?").join(","),P=await s.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${W})
      `).bind(...D).all(),L=new Map(P.results.map(M=>[M.id,M])),$=[],Q=[];try{for(const M of o){const oe=L.get(M.productId);if(!oe)throw new Error(`상품을 찾을 수 없습니다 (ID: ${M.productId})`);if(oe.stock-(oe.reserved_stock||0)<M.quantity)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${oe.name})`);if((await s.prepare(`
            UPDATE products 
            SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND (stock - reserved_stock) >= ?
          `).bind(M.quantity,M.productId,M.quantity).run()).meta.changes===0)throw new Error(`죄송합니다. 방금 상품이 모두 판매되었습니다. (${oe.name})`);console.log(`[Stock] ✅ 재고 예약 성공: ${oe.name} (${M.quantity}개)`),Q.push({product_id:M.productId,quantity:M.quantity}),$.push({product_id:M.productId,option_id:M.optionId||null,quantity:M.quantity,price:M.price,product_name:oe.name,product_stock:oe.stock})}}catch(M){if(console.error("[Stock] ❌ 재고 예약 실패:",M.message),Q.length>0){console.log(`[Stock] 🔄 ${Q.length}개 상품 예약 롤백 시작...`);for(const oe of Q)await s.prepare(`
              UPDATE products 
              SET reserved_stock = reserved_stock - ?
              WHERE id = ?
            `).bind(oe.quantity,oe.product_id).run();console.log("[Stock] ✅ 예약 롤백 완료")}return e.json({success:!1,error:M.message},400)}const z=new Date,v=z.getFullYear().toString().slice(-2),te=(z.getMonth()+1).toString().padStart(2,"0"),q=z.getDate().toString().padStart(2,"0"),U=`${v}${te}${q}`,H=Math.random().toString(36).substring(2,7).toUpperCase(),re=_||`ORD-${U}-${H}`,bs=c?`${i} ${c}`:i,as=new Date(Date.now()+600*1e3).toISOString(),lt=(await s.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, reservation_expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(re,r||null,m||0,"pending","pending",bs||null,l||null,u||null,d||null,h||null,as).run()).meta.last_row_id;for(const M of $)await s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(lt,M.product_id,M.option_id,M.quantity,M.price,M.product_name).run();return console.log(`[Order] ✅ 주문 생성 완료: ${re} (예약 만료: ${as})`),e.json({success:!0,data:{orderId:lt,orderNumber:re,totalAmount:m}})}if(!a||a.length===0)return e.json({success:!1,error:"No items provided"},400);const b=a.map(()=>"?").join(","),g=await s.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${b})
    `).bind(...a).all();if(g.results.length===0)return e.json({success:!1,error:"No items found"},400);for(const D of g.results)if(D.product_stock<D.quantity)return e.json({success:!1,error:`Insufficient stock for ${D.product_name}`},400);const T=g.results.reduce((D,W)=>D+W.price_snapshot*W.quantity,0),y=`ORD${Date.now()}${Math.floor(Math.random()*1e3)}`,F=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(y,r,T,n.address,n.name,n.phone).run()).meta.last_row_id,C=[];for(const D of g.results){let W=!1,P="";for(let L=0;L<3;L++){const $=await s.prepare(`
          SELECT stock, version FROM products WHERE id = ?
        `).bind(D.product_id).first();if(!$){P=`상품을 찾을 수 없습니다: ${D.product_name}`;break}const Q=$.stock,z=$.version;if(Q<D.quantity){P=`재고 부족: ${D.product_name} (남은 재고: ${Q}개)`;break}if((await s.prepare(`
          UPDATE products 
          SET stock = stock - ?, 
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ? 
            AND version = ?
            AND stock >= ?
            AND is_active = 1
        `).bind(D.quantity,D.product_id,z,D.quantity).run()).meta.changes>0){W=!0,console.log(`[재고] ✅ 재고 차감 성공: ${D.product_name} (수량: ${D.quantity}, 버전: ${z} → ${z+1})`);break}console.warn(`[재고] ⚠️ 버전 충돌 감지 (시도 ${L+1}/3): ${D.product_name}`),L<2?await new Promise(te=>setTimeout(te,50*(L+1))):P="주문 처리 중 오류 발생. 잠시 후 다시 시도해주세요. (동시 주문 처리 중)"}if(!W)return e.json({success:!1,error:P||"주문 처리 중 오류가 발생했습니다."},P.includes("재고 부족")?400:409);C.push(s.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(F,D.product_id,D.option_id,D.quantity,D.price_snapshot,D.product_name))}C.push(s.prepare(`DELETE FROM cart_items WHERE id IN (${b})`).bind(...a)),await s.batch(C);try{const D=g.results.map(L=>L.product_id),W=D.map(()=>"?").join(","),P=await s.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${W}) AND seller_id IS NOT NULL
      `).bind(...D).all();for(const L of P.results){const $=L.seller_id;await To(s,$,y,buyerName||shippingName||"고객",T)}}catch(D){console.error("[Order] Notification error:",D)}return e.json({success:!0,data:{orderId:F,orderNumber:y,totalAmount:T}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/streams/:streamId/current-product",async e=>{const{DB:s,LIVE_CACHE:t}=e.env,r=e.req.param("streamId");try{const a=`current-product:${r}`,n=await rr(t,a,3);if(n)return e.json({success:!0,data:n});const o=await s.prepare("SELECT current_product_id FROM live_streams WHERE id = ?").bind(r).first();if(!o||!o.current_product_id)return await Ds(t,a,null,3),e.json({success:!0,data:null});const i=await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(o.current_product_id).first(),c=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(o.current_product_id).all(),l={product:i,options:c.results};return await Ds(t,a,l,3),e.json({success:!0,data:l})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/streams/:streamId/product-wait",async e=>{const{LIVE_CACHE:s}=e.env,t=e.req.param("streamId"),r=e.req.query("lastTimestamp")||"0";try{const a=`product-timestamp:${t}`,n=`current-product:${t}`,o=25e3,i=Date.now();for(;Date.now()-i<o;){const c=await s.get(a)||"0";if(c!==r){const l=await rr(s,n,30);return e.json({success:!0,timestamp:c,data:l,changed:!0})}await new Promise(l=>setTimeout(l,1e3))}return e.json({success:!0,timestamp:r,data:null,changed:!1})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/dashboard/stats",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=e.req.query("period")||"7d";let n=7;a==="30d"?n=30:a==="90d"&&(n=90);const o=await s.prepare(`
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
    `).bind(r,`-${n} days`).all();return e.json({success:!0,data:{period:a,daily:o.results||[],summary:i||{},topProducts:c.results||[]}})}catch(r){return console.error("Error loading seller dashboard stats:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/analytics/products",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading product analytics:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/streams",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=t.sellerId,a=await s.prepare(`
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
    `).bind(r).all();return e.json({success:!0,data:a.results||[]})}catch(r){return console.error("Error loading seller streams:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/streams",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,youtube_video_id:n,youtube_url:o,thumbnail_url:i,scheduled_at:c,status:l,seller_instagram:u,seller_youtube:d,seller_facebook:m}=await e.req.json();let f=n,_="youtube",h=null,w=null,b=i;if(o&&!f&&(f=Tr(o),!f))if(f=Rr(o),h=Ir(o),w=Oo(o),f)_="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok live stream URL."},400);if(!b&&f&&_==="youtube"&&(b=`https://img.youtube.com/vi/${f}/maxresdefault.jpg`),!r||!f)return e.json({success:!1,error:"Title and live stream URL are required"},400);const g=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,f,l||"scheduled",c||null,t.sellerId,u||null,d||null,m||null,_,h,w,b||null).run(),T=await s.prepare(`
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
    `).bind(g.meta.last_row_id).first(),y=await s.prepare("SELECT display_name, username FROM sellers WHERE id = ?").bind(t.sellerId).first();try{const{sendLiveStreamCreatedEmail:R}=await Promise.resolve().then(()=>Wo);R({streamId:g.meta.last_row_id,title:r,sellerName:(y==null?void 0:y.display_name)||(y==null?void 0:y.username)||"알 수 없음",platform:_,scheduledAt:c,status:l||"scheduled"}).then(F=>{F.success?console.log(`[Email] Live stream notification sent for stream #${F.meta.last_row_id}`):console.error("[Email] Failed to send notification:",F.error)}).catch(F=>{console.error("[Email] Exception while sending notification:",F)})}catch(R){console.error("[Email] Failed to send live stream notification:",R)}return await ss(e.env,ts.LIVE_STREAMS),e.json({success:!0,data:T})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const{title:n,description:o,youtube_video_id:i,youtube_url:c,scheduled_at:l,status:u,seller_instagram:d,seller_youtube:m,seller_facebook:f}=await e.req.json(),_=[],h=[];if(n!==void 0&&(_.push("title = ?"),h.push(n)),o!==void 0&&(_.push("description = ?"),h.push(o)),c!==void 0||i!==void 0){let w=i,b="youtube",g=null;if(c&&(w=Tr(c),!w))if(w=Rr(c),g=Ir(c),w)b="tiktok";else return e.json({success:!1,error:"Invalid URL. Please provide a valid YouTube or TikTok video URL."},400);w!==void 0&&(_.push("youtube_video_id = ?"),h.push(w),_.push("platform = ?"),h.push(b),b==="tiktok"&&g&&(_.push("tiktok_username = ?"),h.push(g)))}return u!==void 0&&(_.push("status = ?"),h.push(u)),l!==void 0&&(_.push("scheduled_at = ?"),h.push(l)),d!==void 0&&(_.push("seller_instagram = ?"),h.push(d)),m!==void 0&&(_.push("seller_youtube = ?"),h.push(m)),f!==void 0&&(_.push("seller_facebook = ?"),h.push(f)),_.length===0?e.json({success:!1,error:"No fields to update"},400):(_.push("updated_at = datetime('now')"),await s.prepare(`
      UPDATE live_streams SET ${_.join(", ")} WHERE id = ?
    `).bind(...h,r).run(),await ss(e.env,ts.LIVE_STREAMS),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/streams/:id",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");return await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first()?(await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),await ss(e.env,ts.LIVE_STREAMS),e.json({success:!0})):e.json({success:!1,error:"Stream not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/youtube/create-live",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,scheduled_at:n}=await e.req.json();if(!r)return e.json({success:!1,error:"라이브 방송 제목은 필수입니다"},400);const o=e.env.YOUTUBE_ACCESS_TOKEN;if(!o)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.",help:"wrangler secret put YOUTUBE_ACCESS_TOKEN"},400);const i=await Io({accessToken:o},r,a||""),l=(await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(r,a||null,i.broadcastId,n||null,t.sellerId,i.broadcastId,i.streamKey).run()).meta.last_row_id;return await ys(s,t.sellerId,"seller","live_created","📺 YouTube 라이브 방송이 생성되었습니다",`${r} - 스트림 키와 URL을 확인하세요`,`/seller/live-control?streamId=${l}`),e.json({success:!0,data:{streamId:l,broadcastId:i.broadcastId,youtubeVideoId:i.broadcastId,streamKey:i.streamKey,streamUrl:i.streamUrl,watchUrl:`https://www.youtube.com/watch?v=${i.broadcastId}`}})}catch(r){return console.error("[YouTube Live] Create broadcast error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/seller/youtube/end-live/:streamId",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=e.env.YOUTUBE_ACCESS_TOKEN;if(!n)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다."},400);const o=a.youtube_broadcast_id||a.youtube_video_id;return o?(await vo({accessToken:n},o),await s.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await ys(s,t.sellerId,"seller","live_ended","✅ YouTube 라이브 방송이 종료되었습니다",`${a.title} 방송이 종료되었습니다`,"/seller/streams"),e.json({success:!0,message:"라이브 방송이 종료되었습니다"})):e.json({success:!1,error:"YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다."},400)}catch(r){return console.error("[YouTube Live] End broadcast error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/youtube/stats/:streamId",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const n=a.youtube_video_id;if(!n)return e.json({success:!1,error:"YouTube Video ID가 없습니다"},400);const o=e.env.YOUTUBE_API_KEY,i=e.env.YOUTUBE_ACCESS_TOKEN;if(!o&&!i)return e.json({success:!1,error:"YouTube API Key 또는 Access Token이 설정되지 않았습니다"},400);const c=await Do({apiKey:o,accessToken:i},n);return e.json({success:!0,data:{streamId:r,videoId:n,stats:c}})}catch(r){return console.error("[YouTube Live] Get stats error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/youtube/chat/:streamId",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),a=e.req.query("pageToken"),n=await s.prepare("SELECT id, seller_id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first();if(!n)return e.json({success:!1,error:"라이브 방송을 찾을 수 없습니다"},404);const o=n.youtube_live_chat_id;if(!o)return e.json({success:!1,error:"Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다."},400);const i=e.env.YOUTUBE_ACCESS_TOKEN;if(!i)return e.json({success:!1,error:"YouTube OAuth Access Token이 설정되지 않았습니다"},400);const c=await Ao({accessToken:i},o,a);return e.json({success:!0,data:c})}catch(r){return console.error("[YouTube Live] Get chat messages error:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/streams",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{title:r,description:a,youtube_video_id:n,platform:o,tiktok_username:i,status:c}=await e.req.json();if(!r)return e.json({success:!1,error:"제목은 필수입니다"},400);const l=o||"youtube";if(l==="youtube"&&!n)return e.json({success:!1,error:"YouTube 플랫폼은 영상 ID가 필수입니다"},400);if(l==="tiktok"&&!i)return e.json({success:!1,error:"TikTok 플랫폼은 사용자명이 필수입니다"},400);const u=await s.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(r,a||null,n||null,l,i||null,c||"scheduled",t.sellerId||null).run();return await ss(e.env,ts.LIVE_STREAMS),e.json({success:!0,data:{id:u.meta.last_row_id,title:r,description:a,youtube_video_id:n,platform:l,tiktok_username:i,status:c||"scheduled"}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{title:a,description:n,youtube_video_id:o,platform:i,tiktok_username:c,status:l}=await e.req.json();return await s.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i||"youtube",c||null,l,r).run(),await ss(e.env,ts.LIVE_STREAMS),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("streamId"),{productId:a}=await e.req.json();if(!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Stream not found or unauthorized"},404);const o=await s.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(a,t.sellerId).first();if(!o)return e.json({success:!1,error:"Product not found or not active"},404);const i=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ?").bind(a).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(a,r).run();const{LIVE_CACHE:c}=e.env,l=`product-timestamp:${r}`,u=`current-product:${r}`,d=Date.now().toString();await c.put(l,d),await Ds(c,u,{product:o,options:i.results},30);try{await gs(e.env).changeCurrentProduct(parseInt(r),a),console.log(`🔥 Firebase: Product changed for stream ${r} to ${a}`)}catch(m){console.error("⚠️ Firebase sync failed (non-blocking):",m)}return e.json({success:!0,data:{product:o,options:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/streams/:id",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");return await s.prepare("DELETE FROM live_streams WHERE id = ?").bind(r).run(),await ss(e.env,ts.LIVE_STREAMS),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/streams/:streamId/change-product",async e=>{const{DB:s}=e.env,t=e.req.param("streamId");try{const{productId:r}=await e.req.json(),a=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!a)return e.json({success:!1,error:"Product not found"},404);const n=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock FROM product_options WHERE product_id = ?").bind(r).all();await s.prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?').bind(r,t).run();const{LIVE_CACHE:o}=e.env,i=`product-timestamp:${t}`,c=`current-product:${t}`,l=Date.now().toString();return await o.put(i,l),await Ds(o,c,{product:a,options:n.results},30),e.json({success:!0,data:{product:a,options:n.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/wishlists",S(),async e=>{const{DB:s}=e.env;try{const{userId:t,productId:r}=await e.req.json();if(!t||!r)return e.json({success:!1,error:"사용자 ID와 상품 ID가 필요합니다."},400);if(!await s.prepare("SELECT id FROM users WHERE id = ?").bind(t).first())return e.json({success:!1,error:"존재하지 않는 사용자입니다."},404);const n=await s.prepare("SELECT id, name FROM products WHERE id = ? AND is_active = 1").bind(r).first();if(!n)return e.json({success:!1,error:"존재하지 않는 상품이거나 판매가 중단된 상품입니다."},404);if(await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,r).first())return e.json({success:!1,error:"이미 찜한 상품입니다."},409);const i=await s.prepare(`
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
    `).bind(t,r,a).all(),o=await s.prepare("SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?").bind(t).first();return e.json({success:!0,data:{items:n,total:(o==null?void 0:o.count)||0,limit:r,offset:a}})}catch(t){return console.error("[Wishlist] Get error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/wishlists/check/:userId/:productId",S(),async e=>{const{DB:s}=e.env;try{const t=e.req.param("userId"),r=e.req.param("productId"),a=await s.prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?").bind(t,r).first();return e.json({success:!0,data:{isWishlisted:!!a,wishlistId:(a==null?void 0:a.id)||null}})}catch(t){return console.error("[Wishlist] Check error:",t),e.json({success:!1,error:t.message},500)}});p.delete("/api/shipping-addresses/:id",j,async e=>{const{DB:s}=e.env,t=e.req.param("id");e.get("userId");try{return await s.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(t,userId).run(),e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products",async e=>{const{DB:s,CACHE_KV:t}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:products`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(r.sellerId).all();return await t.put(a,JSON.stringify(o.results),{expirationTtl:300}),e.json({success:!0,data:o.results})}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/seller/upload-image",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{image:r,filename:a}=await e.req.json();if(!r)return e.json({success:!1,error:"Image data is required"},400);const n=r.match(/^data:(image\/[\w+]+);base64,/);if(!n)return e.json({success:!1,error:"잘못된 이미지 형식입니다."},400);const o=n[1],i=r.replace(/^data:image\/\w+;base64,/,"");let c;try{c=Uint8Array.from(atob(i),m=>m.charCodeAt(0))}catch{return e.json({success:!1,error:"이미지 디코딩 실패"},400)}const l=10*1024*1024;if(c.length>l)return e.json({success:!1,error:`파일 크기가 너무 큽니다. 최대 ${l/1024/1024}MB까지 허용됩니다.`},400);const u=await Ea(c.buffer);if(!u.valid)return e.json({success:!1,error:"유효하지 않은 이미지 파일입니다."},400);const d=e.env.IMAGES;if(d){console.log("[Image Upload] Using R2 storage");const m=fa(a||"upload.jpg"),f=`products/${t.sellerId}/${m}`;await d.put(f,c,{httpMetadata:{contentType:u.detectedType||o}});const _=`/api/images/${f}`;return e.json({success:!0,url:_,variants:{thumbnail:`${_}?width=200&format=webp`,medium:`${_}?width=800&format=webp`,large:`${_}?width=1600&format=webp`,original:_},storage:"r2"})}else return console.log("[Image Upload] R2 not available, using Base64 fallback"),r.length*.75/(1024*1024)>1?e.json({success:!1,error:"Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)"},400):e.json({success:!0,url:r,storage:"base64",warning:"Using Base64 storage. Enable R2 for better performance."})}catch(r){return console.error("[Image Upload] Error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/images/*",async e=>{var s;try{const t=e.env.IMAGES;if(!t)return e.json({success:!1,error:"R2 not configured"},503);const r=e.req.path.replace("/api/images/",""),a=e.req.query("width"),n=e.req.query("format"),o=e.req.query("quality")||"85",i=await t.get(r);if(!i)return e.notFound();const c={"Content-Type":((s=i.httpMetadata)==null?void 0:s.contentType)||"image/jpeg","Cache-Control":"public, max-age=31536000"};if(a||n){const l=[];a&&l.push(`width=${a}`),n&&l.push(`format=${n}`),o&&l.push(`quality=${o}`),c["cf-resize"]=l.join(",")}return new Response(i.body,{headers:c})}catch(t){return console.error("[Image Get] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/products",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{name:r,description:a,price:n,original_price:o,discount_rate:i,image_url:c,stock:l,category:u,live_stream_id:d,is_active:m}=await e.req.json();if(!r||!n)return e.json({success:!1,error:"Name and price are required"},400);if(d&&!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(d,t.sellerId).first())return e.json({success:!1,error:"Live stream not found or unauthorized"},404);const f=await s.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a||null,n,o||null,i||0,c||null,l||0,u||null,d||null,t.sellerId,m!==void 0?m:1).run(),_=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(f.meta.last_row_id).first();return await it(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0,data:_})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(r,t.sellerId).first();return a?e.json({success:!0,data:a}):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{name:n,description:o,price:i,original_price:c,image_url:l,stock:u,category:d,is_active:m,live_stream_id:f}=await e.req.json(),_=[],h=[];if(n!==void 0&&(_.push("name = ?"),h.push(n)),o!==void 0&&(_.push("description = ?"),h.push(o)),i!==void 0&&(_.push("price = ?"),h.push(i)),c!==void 0&&(_.push("original_price = ?"),h.push(c),i!==void 0&&c)){const b=Math.round((c-i)/c*100);_.push("discount_rate = ?"),h.push(b)}if(l!==void 0&&(_.push("image_url = ?"),h.push(l)),u!==void 0&&(_.push("stock = ?"),h.push(u)),d!==void 0&&(_.push("category = ?"),h.push(d)),m!==void 0&&(_.push("is_active = ?"),h.push(m?1:0)),f!==void 0&&(_.push("live_stream_id = ?"),h.push(f||null)),_.push("updated_at = CURRENT_TIMESTAMP"),h.push(r,t.sellerId),_.length===1)return e.json({success:!1,error:"No fields to update"},400);await s.prepare(`UPDATE products SET ${_.join(", ")} WHERE id = ? AND seller_id = ?`).bind(...h).run();const w=await s.prepare("SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id, created_at FROM products WHERE id = ?").bind(r).first();return await it(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0,data:w})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/products/:id",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?").bind(r).first();return n&&n.count>0?e.json({success:!1,error:"이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요."},400):(await s.prepare("DELETE FROM product_options WHERE product_id = ?").bind(r).run(),await s.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(r).run(),await s.prepare("UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?").bind(r).run(),await s.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).run(),await it(e.env.CACHE_KV,`seller:${t.sellerId}:products`,`public:seller:${t.sellerId}`),e.json({success:!0}))}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const n=await s.prepare("SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY id").bind(r).all();return e.json({success:!0,data:n.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/products/:id/options",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id");if(!await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first())return e.json({success:!1,error:"Product not found or unauthorized"},404);const{option_type:n,option_value:o,price_adjustment:i,stock:c}=await e.req.json();if(!n||!o)return e.json({success:!1,error:"Option type and value are required"},400);const l=await s.prepare("INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").bind(r,n,o,i||0,c||0).run();return e.json({success:!0,data:{id:l.meta.last_row_id,product_id:r,option_type:n,option_value:o,price_adjustment:i||0,stock:c||0}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/seller/products/:productId/options/:optionId",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("productId"),a=e.req.param("optionId");return await s.prepare("SELECT id, seller_id FROM products WHERE id = ? AND seller_id = ?").bind(r,t.sellerId).first()?(await s.prepare("DELETE FROM product_options WHERE id = ? AND product_id = ?").bind(a,r).run(),e.json({success:!0})):e.json({success:!1,error:"Product not found or unauthorized"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/stats",async e=>{const{DB:s,CACHE_KV:t}=e.env,r=await k(e);if(!r.success)return e.json({success:!1,error:r.error},401);try{const a=`seller:${r.sellerId}:stats`,n=await t.get(a,"json");if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ?").bind(r.sellerId).first(),i=await s.prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1").bind(r.sellerId).first(),c=await s.prepare("SELECT SUM(stock) as total FROM products WHERE seller_id = ?").bind(r.sellerId).first(),l=await s.prepare(`
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
    `).bind(r.sellerId).first(),m=(d==null?void 0:d.total)||0,f={totalProducts:o.count||0,activeProducts:i.count||0,totalStock:c.total||0,totalOrders:l.count||0,totalRevenue:l.total||0,activeStreams:u.count||0,totalViewers:m};return await t.put(a,JSON.stringify(f),{expirationTtl:60}),e.json({success:!0,data:f})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/stats/sales",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("period")||"daily";let a,n,o;switch(r){case"weekly":a="%Y-W%W",n="week",o=28;break;case"monthly":a="%Y-%m",n="month",o=180;break;default:a="%Y-%m-%d",n="day",o=30}const i=await s.prepare(`
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
    `).bind(t.sellerId).all();return e.json({success:!0,data:{period:r,sales:i.results}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/stats/products",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=parseInt(e.req.query("limit")||"10"),a=parseInt(e.req.query("days")||"30"),n=await s.prepare(`
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
    `).bind(t.sellerId,r).all();return e.json({success:!0,data:{products:n.results,period_days:a}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/business-info",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{business_number:r,business_name:a,ceo_name:n,business_type:o,business_category:i,postal_code:c,address:l,phone:u,email:d}=await e.req.json();if(!r||!a||!n)return e.json({success:!1,error:"사업자등록번호, 상호명, 대표자명은 필수입니다."},400);const m=await s.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();let f;return m?f=await s.prepare(`
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
      `).bind(r,a,n,o,i,c,l,u,d,t.sellerId).run():f=await s.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(t.sellerId,r,a,n,o,i,c,l,u,d).run(),e.json({success:!0,data:{id:m?m.id:f.meta.last_row_id,seller_id:t.sellerId,business_number:r,is_verified:!1,message:"사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."}})}catch(r){return console.error("사업자 정보 등록 오류:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/business-info",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(t.sellerId).first();return r?e.json({success:!0,data:r}):e.json({success:!1,error:"등록된 사업자 정보가 없습니다."},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/seller-business/:id/verify",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);const r=e.req.param("id"),{verified:a}=await e.req.json();try{return a?(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보가 승인되었습니다."})):(await s.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(r).run(),e.json({success:!0,message:"사업자 정보 승인이 취소되었습니다."}))}catch(n){return e.json({success:!1,error:n.message},500)}});p.get("/api/admin/seller-business",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
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
    `).bind(t).all(),a=new Map;for(const o of r.results){const i=o.id;a.has(i)||a.set(i,{id:o.id,user_id:o.user_id,order_number:o.order_number,status:o.status,total_amount:o.total_amount,shipping_fee:o.shipping_fee,payment_method:o.payment_method,payment_key:o.payment_key,shipping_address:o.shipping_address,shipping_name:o.shipping_name,shipping_phone:o.shipping_phone,delivery_request:o.delivery_request,created_at:o.created_at,updated_at:o.updated_at,items:[]}),o.item_id&&a.get(i).items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value})}const n=Array.from(a.values());return e.json({success:!0,data:n})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/orders/user/:userId",j,async e=>{const{DB:s}=e.env,t=e.get("userId"),r=parseInt(e.req.param("userId"));try{if(r!==t)return e.json({success:!1,error:"본인의 주문 내역만 조회할 수 있습니다."},403);const a=await s.prepare(`
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
    `).bind(t).all(),n=new Map;for(const i of a.results){const c=i.id;n.has(c)||n.set(c,{id:i.id,user_id:i.user_id,order_number:i.order_number,status:i.status,total_amount:i.total_amount,shipping_fee:i.shipping_fee,payment_method:i.payment_method,payment_key:i.payment_key,shipping_address:i.shipping_address,shipping_name:i.shipping_name,shipping_phone:i.shipping_phone,delivery_request:i.delivery_request,created_at:i.created_at,updated_at:i.updated_at,items:[]}),i.item_id&&n.get(c).items.push({id:i.item_id,product_id:i.product_id,option_id:i.option_id,quantity:i.quantity,price:i.item_price,product_name:i.product_name,image_url:i.image_url,option_value:i.option_value})}const o=Array.from(n.values());return e.json({success:!0,data:o})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/orders/:orderNumber",j,async e=>{const{DB:s}=e.env,t=e.req.param("orderNumber");try{const r=await s.prepare(`
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
    `).bind(t).all();if(r.results.length===0)return e.json({success:!1,error:"Order not found"},404);const a=r.results[0],n={id:a.id,user_id:a.user_id,order_number:a.order_number,status:a.status,total_amount:a.total_amount,shipping_fee:a.shipping_fee,payment_method:a.payment_method,payment_key:a.payment_key,shipping_address:a.shipping_address,shipping_name:a.shipping_name,shipping_phone:a.shipping_phone,delivery_request:a.delivery_request,created_at:a.created_at,updated_at:a.updated_at,items:[]};for(const o of r.results)o.item_id&&n.items.push({id:o.item_id,product_id:o.product_id,option_id:o.option_id,quantity:o.quantity,price:o.item_price,product_name:o.product_name,image_url:o.image_url,option_value:o.option_value});return e.json({success:!0,data:n})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/orders/:orderId/cancel",j,async e=>{const{DB:s}=e.env,t=e.req.param("orderId");try{const a=(await e.req.json()).reason||"사유 없음",n=await s.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(t).first();if(!n)return e.json({success:!1,error:"Order not found"},404);if(n.status!=="pending")return e.json({success:!1,error:"결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요."},400);const o=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").bind(t).all();if(o.results.length>0){const i=o.results.map(c=>s.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(c.quantity,c.product_id));await s.batch(i)}return await s.prepare("UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind("cancelled",a,t).run(),e.json({success:!0,message:"Order cancelled successfully",data:{orderId:t,reason:a,itemsRestored:o.results.length}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/streams/:streamId/viewer-count",async e=>{const{DB:s}=e.env;try{const t=e.req.param("streamId"),r=await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(t).first();return r?e.json({success:!0,data:{viewer_count:r.viewer_count||0}}):e.json({success:!1,error:"Stream not found"},404)}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/streams/:streamId/viewer-count",async e=>{const{DB:s}=e.env,t=await x(e),r=t.success?{success:!1}:await k(e);if(!t.success&&!r.success)return e.json({success:!1,error:"Unauthorized"},401);try{const a=e.req.param("streamId"),{viewer_count:n}=await e.req.json();return typeof n!="number"||n<0?e.json({success:!1,error:"Invalid viewer count"},400):r.success&&!await s.prepare("SELECT id FROM live_streams WHERE id = ? AND seller_id = ?").bind(a,r.sellerId).first()?e.json({success:!1,error:"Stream not found or unauthorized"},404):(await s.prepare("UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(n,a).run(),e.json({success:!0,data:{viewer_count:n}}))}catch(a){return e.json({success:!1,error:a.message},500)}});p.post("/api/streams/:streamId/view",async e=>{const{DB:s}=e.env;try{const t=e.req.param("streamId");await s.prepare("UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(t).run();const r=await s.prepare("SELECT viewer_count FROM live_streams WHERE id = ?").bind(t).first();return e.json({success:!0,data:{viewer_count:(r==null?void 0:r.viewer_count)||0}})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/payments/confirm",async e=>{var r;const{DB:s}=e.env;let t=null;try{t=await e.req.json();const{paymentKey:a,orderId:n,amount:o}=t;if(console.log("========================================"),console.log("[Payment] 🚀 결제 승인 API 호출됨"),console.log("========================================"),console.log("[Payment] 📋 요청 파라미터:"),console.log("  - orderId:",n),console.log("  - paymentKey:",a),console.log("  - amount:",o),console.log("  - timestamp:",new Date().toISOString()),!a||!n||!o)return console.error("[Payment] ❌ 필수 파라미터 누락!"),console.error("[Payment] paymentKey:",!!a),console.error("[Payment] orderId:",!!n),console.error("[Payment] amount:",!!o),e.json({success:!1,error:"필수 파라미터가 누락되었습니다.",details:{paymentKey:!!a,orderId:!!n,amount:!!o}},400);console.log("[Payment] ✅ 필수 파라미터 검증 통과");const i=await s.prepare("SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?").bind(n).first();if(!i)return console.error("[Payment] ❌ 주문을 찾을 수 없음:",n),e.json({success:!1,error:"주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.",orderId:n},404);if(console.log("[Payment] ✅ 주문 확인됨:",{id:i.id,order_number:i.order_number,total_amount:i.total_amount,status:i.status}),Number(o)!==Number(i.total_amount))return console.error("[Payment] ❌ 금액 불일치!",{requested:Number(o),expected:Number(i.total_amount)}),e.json({success:!1,error:"결제 금액이 주문 금액과 일치하지 않습니다.",requestedAmount:Number(o),expectedAmount:Number(i.total_amount)},400);const c=e.env.TOSS_SECRET_KEY;if(!c)return console.error("[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음"),console.error("[Payment] c.env:",Object.keys(e.env||{})),e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);console.log("[Payment] ✅ TOSS_SECRET_KEY 확인됨:",c.substring(0,20)+"..."),console.log("[Payment] 🌐 토스페이먼츠 API 호출 시작..."),console.log("[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm"),console.log("[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)");const l="Basic "+btoa(c+":");console.log("[Payment] Authorization 헤더 생성 완료");const u={orderId:n,amount:Number(o),paymentKey:a};console.log("[Payment] 요청 본문:",JSON.stringify(u,null,2)),console.log("[Payment] 📊 amount 타입:",typeof u.amount),console.log("[Payment] 📊 amount 값:",u.amount);const d=await fetch("https://api.tosspayments.com/v1/payments/confirm",{method:"POST",headers:{Authorization:l,"Content-Type":"application/json","TossPayments-API-Version":"2022-11-16"},body:JSON.stringify(u)}),m=await d.json();if(console.log("[Payment] 📡 토스페이먼츠 API 응답:"),console.log("  - HTTP 상태:",d.status),console.log("  - 응답 OK?:",d.ok),console.log("  - 응답 데이터 (일부):",JSON.stringify(m).substring(0,300)),!d.ok)return console.error("[Payment] ❌❌❌ 토스페이먼츠 승인 실패!"),console.error("[Payment] HTTP 상태:",d.status),console.error("[Payment] 에러 코드:",m.code),console.error("[Payment] 에러 메시지:",m.message),console.error("[Payment] 전체 응답:",JSON.stringify(m,null,2)),e.json({success:!1,error:m.message||"결제 승인에 실패했습니다.",code:m.code,tossError:m},d.status);console.log("[Payment] ✅ 결제 승인 성공! paymentKey:",a),console.log("[Payment] ✅ 주문 번호:",n);try{await s.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            reservation_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(a,n).run(),console.log("[Payment] ✅ 주문 상태 업데이트 완료");const f=await s.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").bind(n).all();if(f.results.length>0){console.log(`[Stock] 🔒 재고 확정 시작: ${f.results.length}개 상품`);const _=f.results.map(b=>s.prepare(`
            UPDATE products 
            SET stock = stock - ?,
                reserved_stock = reserved_stock - ?
            WHERE id = ?
          `).bind(b.quantity,b.quantity,b.product_id)),h=await s.batch(_);let w=0;for(let b=0;b<h.length;b++)if(h[b].meta.changes>0){w++;const g=f.results[b];console.log(`[Stock] ✅ 재고 확정: product_id=${g.product_id}, quantity=${g.quantity}`)}else{const g=f.results[b];console.error(`[Stock] ⚠️ 재고 확정 실패: product_id=${g.product_id}`)}console.log(`[Stock] ✅ 재고 확정 완료: ${w}/${f.results.length}개 성공`);try{const b=f.results.map(y=>y.product_id),g=b.map(()=>"?").join(","),T=await s.prepare(`
            SELECT id, name, stock, reserved_stock, stock_alert_threshold, seller_id 
            FROM products 
            WHERE id IN (${g})
          `).bind(...b).all();for(const y of T.results){const R=y.stock_alert_threshold||10,F=y.stock||0,C=y.reserved_stock||0,D=F-C;D<=R&&y.seller_id&&(await Sr(s,y.seller_id,y.name,D,R),console.log(`[Low Stock Alert] 📢 ${y.name}: 가용재고 ${D}개 (임계값 ${R}개)`))}}catch(b){console.error("[Low Stock Alert] ⚠️ 알림 전송 실패:",b)}}try{const _=i.id,h=await za(e.env,_);h.success?console.log(`[Payment] ✅ 알림톡 발송 성공 (주문 ${_})`):console.warn(`[Payment] ⚠️ 알림톡 발송 실패 (주문 ${_}):`,h.reason||h.error)}catch(_){console.error("[Payment] ⚠️ 알림톡 발송 중 오류:",_)}}catch(f){console.error("[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):",f)}if(e.env.DISCORD_WEBHOOK_URL)try{await wn(e.env.DISCORD_WEBHOOK_URL,"결제 성공",`주문번호 ${n} 결제 완료`,{주문번호:n,결제금액:`₩${Number(o).toLocaleString()}`,결제키:a.substring(0,20)+"...",사용자ID:i.user_id})}catch(f){console.error("[Discord] 결제 성공 알림 실패:",f)}return e.json({success:!0,data:m})}catch(a){return console.error("[Payment] ❌ 결제 승인 실패:",{orderId:t==null?void 0:t.orderId,error:a.message,stack:(r=a.stack)==null?void 0:r.substring(0,500)}),e.json({success:!1,error:"결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",details:a.message},500)}});p.post("/api/payments/rollback",async e=>{var t;const{DB:s}=e.env;try{const{orderId:r,reason:a}=await e.req.json();if(console.log("========================================"),console.log("[Rollback] 🔄 재고 예약 해제 시작"),console.log("========================================"),console.log("[Rollback] 주문 번호:",r),console.log("[Rollback] 사유:",a||"결제 실패"),!r)return e.json({success:!1,error:"주문 번호가 필요합니다."},400);const n=await s.prepare("SELECT id, order_number, status FROM orders WHERE order_number = ?").bind(r).first();if(!n)return console.warn("[Rollback] ⚠️ 주문을 찾을 수 없음:",r),e.json({success:!1,error:"주문을 찾을 수 없습니다."},404);if(n.status==="paid")return console.warn("[Rollback] ⚠️ 이미 결제 완료된 주문:",r),e.json({success:!1,error:"이미 결제가 완료된 주문입니다."},400);console.log("[Rollback] ✅ 주문 확인됨:",n.order_number);const o=await s.prepare(`
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
    `).bind(r).run(),console.log("[Rollback] ✅ 주문 취소 완료:",r),e.json({success:!0,message:"재고 예약이 해제되었습니다.",data:{orderId:r,releasedItems:l}})}catch(r){return console.error("[Rollback] ❌ 예약 해제 실패:",{error:r.message,stack:(t=r.stack)==null?void 0:t.substring(0,500)}),e.json({success:!1,error:"재고 예약 해제 중 오류가 발생했습니다.",details:r.message},500)}});p.post("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,userName:n,userAvatar:o,message:i,isSeller:c,isAdmin:l}=r;if(!i||i.trim().length===0)return e.json({success:!1,error:"Message cannot be empty"},400);if(i.length>500)return e.json({success:!1,error:"Message is too long (max 500 characters)"},400);if(a&&await s.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(t,a).first())return e.json({success:!1,error:"You are banned from this chat"},403);const u=["씨발","개새끼","병신","좆","시발"];let d=i;u.forEach(f=>{const _=new RegExp(f,"gi");d=d.replace(_,"*".repeat(f.length))});const m=await s.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(t,a||null,n,o||null,d,c?1:0,l?1:0).run();return e.json({success:!0,data:{id:m.meta.last_row_id,message:d}})}catch(r){return console.error("Error sending chat message:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/chat/:liveStreamId/messages",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId"),r=e.req.query("since"),a=Number(e.req.query("limit"))||50;try{let n=`
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
    `).bind(t).run(),e.json({success:!0,message:"Message deleted successfully"})}catch(r){return console.error("Error deleting chat message:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/chat/:liveStreamId/ban",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId");try{const r=await e.req.json(),{userId:a,bannedBy:n,reason:o,duration:i}=r;if(!a||!n)return e.json({success:!1,error:"userId and bannedBy are required"},400);let c=null;if(i){const l=new Date;l.setMinutes(l.getMinutes()+i),c=l.toISOString()}return await s.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(t,a,n,o||null,c).run(),e.json({success:!0,message:"User banned successfully"})}catch(r){return console.error("Error banning user:",r),e.json({success:!1,error:r.message},500)}});p.delete("/api/chat/:liveStreamId/ban/:userId",S(),async e=>{const{DB:s}=e.env,t=e.req.param("liveStreamId"),r=e.req.param("userId");try{return await s.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(t,r).run(),e.json({success:!0,message:"Ban removed successfully"})}catch(a){return console.error("Error removing ban:",a),e.json({success:!1,error:a.message},500)}});async function No(e,s,t){try{const r=new TextEncoder,a=r.encode(t),n=r.encode(e),o=await crypto.subtle.importKey("raw",a,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),i=await crypto.subtle.sign("HMAC",o,n),c=Array.from(new Uint8Array(i)),l=btoa(String.fromCharCode(...c));return s===l}catch(r){return console.error("[Webhook] 서명 검증 오류:",r),!1}}p.post("/api/payments/webhook",async e=>{const{DB:s}=e.env;try{const t=e.req.header("toss-signature"),r=await e.req.text();if(t&&e.env.TOSS_SECRET_KEY){if(!await No(r,t,e.env.TOSS_SECRET_KEY))return console.error("[Webhook] ❌ 서명 검증 실패 - 위조된 웹훅 요청"),e.json({success:!1,error:"Invalid signature"},401);console.log("[Webhook] ✅ 서명 검증 성공")}else console.warn("[Webhook] ⚠️ 서명 검증 건너뜀 (개발 환경 또는 서명 없음)");const a=JSON.parse(r);switch(console.log("[Webhook] 토스페이먼츠 웹훅 수신:",{eventType:a.eventType,orderId:a.orderId,status:a.status,timestamp:new Date().toISOString()}),a.eventType){case"PAYMENT_STATUS_CHANGED":await jo(s,a);break;case"VIRTUAL_ACCOUNT_ISSUED":await Lo(s,a);break;default:console.log("[Webhook] 처리하지 않는 이벤트 타입:",a.eventType)}return e.json({success:!0})}catch(t){return console.error("[Webhook] ❌ 웹훅 처리 실패:",t.message),e.json({success:!1,error:t.message},500)}});async function jo(e,s){const{orderId:t,status:r,paymentKey:a}=s;console.log("[Webhook] 결제 상태 변경:",{orderId:t,status:r}),await e.prepare(`
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
    `).bind(t).run(),console.log("[Webhook] ✅ 가상계좌 입금 완료 처리:",t))}async function Lo(e,s){const{orderId:t,virtualAccount:r}=s;console.log("[Webhook] 가상계좌 발급:",{orderId:t,bank:r==null?void 0:r.bank,accountNumber:r==null?void 0:r.accountNumber}),await e.prepare(`
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
    `).bind(t).first();if(!o)return e.json({success:!1,error:"결제 정보를 찾을 수 없습니다."},404);if(o.status==="CANCELED"||o.status==="cancelled")return e.json({success:!1,error:"이미 취소된 결제입니다."},400);const i=o.pg_provider||"tosspayments",c=e.env.TOSS_SECRET_KEY;if(!c)return e.json({success:!1,error:"결제 시스템 설정이 올바르지 않습니다."},500);const l=ho(i,c),u=n&&n<o.amount,d=n||o.amount;console.log("[Payment] PG 결제 취소 요청 중...",{pgProvider:i,paymentKey:t,cancelAmount:d,isPartial:u});const m=await l.cancelPayment({paymentKey:t,cancelReason:a,cancelAmount:d});return m.success?(console.log("[Payment] ✅ PG 결제 취소 완료:",{paymentKey:t,cancelAmount:d,canceledAt:m.canceledAt}),await s.prepare(`
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
    `).bind(o.order_id).run(),console.log(`[Payment] ✅ 결제 취소 완료 [${i}]: ${t}`),e.json({success:!0,data:{paymentKey:t,orderId:o.order_id,cancelAmount:d,canceledAt:m.canceledAt,status:"CANCELED"}})):(console.error(`[Payment] ❌ ${i} 결제 취소 실패:`,m.error),e.json({success:!1,error:m.error||"결제 취소에 실패했습니다."},400))}catch(t){return console.error("[Payment] ❌ 결제 취소 처리 실패:",t.message),e.json({success:!1,error:"결제 취소 처리 중 오류가 발생했습니다."},500)}});p.get("/api/payments/:paymentKey",async e=>{const{DB:s}=e.env;try{const t=e.req.param("paymentKey"),r=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:r.results||[]})}catch(t){return console.error("[Payment] ❌ 결제 목록 조회 실패:",t.message),e.json({success:!1,error:"결제 목록 조회 중 오류가 발생했습니다."},500)}});p.get("/api/seller/orders",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("status"),a=e.req.query("start_date"),n=e.req.query("end_date"),o=e.req.query("min_amount"),i=e.req.query("max_amount"),c=parseInt(e.req.query("page")||"1"),l=parseInt(e.req.query("limit")||"50"),u=(c-1)*l,d=["oi.seller_id = ?"],m=[t.sellerId];r&&(d.push("o.status = ?"),m.push(r)),a&&(d.push("DATE(o.created_at) >= ?"),m.push(a)),n&&(d.push("DATE(o.created_at) <= ?"),m.push(n)),o&&(d.push("o.total_amount >= ?"),m.push(parseInt(o))),i&&(d.push("o.total_amount <= ?"),m.push(parseInt(i)));const f=d.join(" AND "),_=await s.prepare(`
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
      WHERE ${f}
      ORDER BY o.created_at DESC, oi.id ASC
      LIMIT ? OFFSET ?
    `).bind(...m,l,u).all(),h=await s.prepare(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${f}
    `).bind(...m).first(),w=(h==null?void 0:h.total)||0,b=Math.ceil(w/l),g=new Map;for(const y of _.results){const R=y.id;g.has(R)||g.set(R,{id:y.id,user_id:y.user_id,user_name:y.user_name,order_number:y.order_number,status:y.status,total_amount:y.total_amount,shipping_fee:y.shipping_fee,payment_method:y.payment_method,payment_key:y.payment_key,shipping_address:y.shipping_address,shipping_name:y.shipping_name,shipping_phone:y.shipping_phone,delivery_request:y.delivery_request,created_at:y.created_at,updated_at:y.updated_at,items:[]}),y.item_id&&g.get(R).items.push({id:y.item_id,product_id:y.product_id,option_id:y.option_id,quantity:y.quantity,price:y.item_price,seller_id:y.seller_id,product_name:y.product_name,image_url:y.image_url,option_value:y.option_value})}const T=Array.from(g.values());return e.json({success:!0,data:T,pagination:{page:c,limit:l,total:w,totalPages:b},filters:{status:r||null,startDate:a||null,endDate:n||null,minAmount:o?parseInt(o):null,maxAmount:i?parseInt(i):null}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/orders/export",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.query("format")||"csv",a=e.req.query("start_date"),n=e.req.query("end_date");let o=`
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
    `;const i=[t.sellerId];a&&(o+=" AND date(o.created_at) >= ?",i.push(a)),n&&(o+=" AND date(o.created_at) <= ?",i.push(n)),o+=" GROUP BY o.id ORDER BY o.created_at DESC";const c=await s.prepare(o).bind(...i).all();if(r==="csv"){const l=["주문번호","주문일시","주문상태","결제상태","주문금액","배송지","수령인","연락처","택배사","운송장번호","구매자명","구매자이메일","구매자연락처"],u=c.results.map(h=>[h.order_number||"",h.created_at?new Date(h.created_at).toLocaleString("ko-KR"):"",h.status||"",h.payment_status||"",h.total_amount||0,h.shipping_address||"",h.shipping_name||"",h.shipping_phone||"",h.carrier||"",h.tracking_number||"",h.buyer_name||"",h.buyer_email||"",h.buyer_phone||""]),m="\uFEFF"+[l.join(","),...u.map(h=>h.map(w=>{const b=String(w);return b.includes(",")||b.includes(`
`)||b.includes('"')?`"${b.replace(/"/g,'""')}"`:b}).join(","))].join(`
`),f=new Date,_=`orders_${f.toISOString().split("T")[0]}_${f.getTime()}.csv`;return new Response(m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${encodeURIComponent(_)}"`,"Cache-Control":"no-cache"}})}else return e.json({success:!1,error:"Unsupported format"},400)}catch(r){return console.error("Export error:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/seller/orders/:orderNumber/status",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber"),{status:a}=await e.req.json();if(!["PAY_COMPLETE","PREPARING","SHIPPING","DELIVERED","CANCELLED"].includes(a))return e.json({success:!1,error:"Invalid status"},400);const o=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,t.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);if(await s.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?").bind(a,r).run(),a==="DELIVERED")try{console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${r}, 자동 발행 시작...`);const c=await s.prepare(`
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
            `).bind(c.id).all(),d=Number(c.total_amount),m=Math.floor(d/1.1),f=d-m,_=new Date().toISOString().split("T")[0].replace(/-/g,""),h=Math.random().toString(36).substring(2,8).toUpperCase(),w=`${_}-${h}`,g=(await s.prepare(`
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
            `).bind(t.sellerId,r,w,l.business_number,l.business_name,l.ceo_name,l.address||"",l.business_type||"",l.business_category||"",l.email||"",l.phone||"",c.buyer_business_number,c.buyer_business_name,c.buyer_ceo_name||"",c.buyer_business_address||"",c.buyer_business_type||"",c.buyer_business_category||"",c.buyer_email||"",c.buyer_phone||"",m,f,d,`AUTO-${Date.now()}-${h}`).run()).meta.last_row_id;if(u.results.length>0){const T=u.results.map(y=>{const R=Math.floor(Number(y.price)*Number(y.quantity)/1.1),F=Number(y.price)*Number(y.quantity)-R;return s.prepare(`
                  INSERT INTO tax_invoice_items (
                    tax_invoice_id, product_name, quantity, unit_price,
                    supply_price, tax_amount, description, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).bind(g,y.product_name||"상품명 없음",y.quantity,y.price,R,F,y.option_name||"")});await s.batch(T)}await s.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(r,t.sellerId,g).run(),console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${g}, invoice_number=${w}`)}}else console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${r}`)}catch(c){console.error("[AUTO TAX INVOICE] 발행 실패:",c);try{await s.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(r,t.sellerId,c.message).run()}catch(l){console.error("[AUTO TAX INVOICE] 로그 기록 실패:",l)}}try{const c=await s.prepare("SELECT id, user_id FROM orders WHERE order_number = ?").bind(r).first();if(c&&c.user_id){const u={PREPARING:"preparing",SHIPPING:"shipping",DELIVERED:"delivered"}[a];u&&await wr(s,c.user_id,r,u)}}catch(c){console.error("[Order Status] Notification error:",c)}return e.json({success:!0})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/seller/orders/:orderNumber/tracking",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber"),{courier:a,tracking_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Courier and tracking number are required"},400);const o=await s.prepare("SELECT id FROM orders WHERE order_number = ?").bind(r).first();if(!o)return e.json({success:!1,error:"Order not found"},404);if(!await s.prepare("SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?").bind(o.id,t.sellerId).first())return e.json({success:!1,error:"Unauthorized"},403);await s.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(a,n,r).run();try{const c=await s.prepare("SELECT user_id FROM orders WHERE order_number = ?").bind(r).first();c&&c.user_id&&await wr(s,c.user_id,r,"shipping",a,n)}catch(c){console.error("[Tracking] Notification error:",c)}return e.json({success:!0,message:"Tracking information updated"})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/admin/orders",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/sellers",async e=>{const{DB:s}=e.env,{limit:t="20",offset:r="0"}=e.req.query();try{const a=`sellers:list:${t}:${r}`,n=ve(a);if(n)return e.executionCtx.waitUntil((async()=>{try{const i=await Dt(s,parseInt(t),parseInt(r));se(a,i,3600)}catch(i){console.error("[Cache Revalidate] Sellers error:",i)}})()),e.json({success:!0,data:n,cached:!0});const o=await Dt(s,parseInt(t),parseInt(r));return se(a,o,3600),e.json({success:!0,data:o,cached:!1})}catch(a){return console.error("[API] Sellers list error:",a),e.json({success:!1,error:`셀러 목록 조회 실패: ${a.message}`},500)}});async function Dt(e,s,t){const r=`
    SELECT id, business_name, name as display_name, 
           commission_rate, created_at
    FROM sellers 
    WHERE is_active = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `,{results:a}=await e.prepare(r).bind(s,t).all();return a}p.get("/api/admin/sellers",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, commission_rate, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();return e.json({success:!0,data:r.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/sellers",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{username:r,password:a,name:n,email:o,phone:i,business_name:c,business_number:l}=await e.req.json();if(!r||!a||!n||!o||!c)return e.json({success:!1,error:"필수 항목을 모두 입력해주세요"},400);if(await s.prepare("SELECT id FROM sellers WHERE username = ?").bind(r).first())return e.json({success:!1,error:"이미 존재하는 아이디입니다"},400);if(await s.prepare("SELECT id FROM sellers WHERE email = ?").bind(o).first())return e.json({success:!1,error:"이미 존재하는 이메일입니다"},400);const m=`$2a$10$placeholder_hash_for_${a}`,f=await s.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(r,m,n,o,i||null,c,l||null,t.adminId).run();return e.json({success:!0,data:{id:f.meta.last_row_id,username:r,name:n,email:o,business_name:c}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.put("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{name:a,email:n,phone:o,business_name:i,business_number:c,is_active:l,status:u}=await e.req.json();return await s.prepare("SELECT id FROM sellers WHERE id = ?").bind(r).first()?(await s.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,n,o||null,i,c||null,l,u,r).run(),e.json({success:!0})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.delete("/api/admin/sellers/:id",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();return a?(await s.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${a.username}'의 로그인 권한이 삭제되었습니다`})):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/admin/sellers/:id/reset-password",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{new_password:a}=await e.req.json();if(!a||a.length<6)return e.json({success:!1,error:"비밀번호는 6자 이상이어야 합니다"},400);const n=await s.prepare("SELECT id, username FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const o=`$2a$10$placeholder_hash_for_${a}`;return await s.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(o,r).run(),await s.prepare("DELETE FROM admin_sessions WHERE seller_id = ?").bind(r).run(),e.json({success:!0,message:`판매자 '${n.username}'의 비밀번호가 재설정되었습니다`})}catch(r){return e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/commission",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{commission_rate:a}=await e.req.json();if(a==null)return e.json({success:!1,error:"수수료율을 입력해주세요"},400);const n=parseFloat(a);if(isNaN(n)||n<0||n>100)return e.json({success:!1,error:"수수료율은 0에서 100 사이의 값이어야 합니다"},400);const o=await s.prepare("SELECT id, username, commission_rate FROM sellers WHERE id = ?").bind(r).first();if(!o)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);const i=o.commission_rate||10;return await s.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(n,r).run(),console.log(`수수료율 변경: 판매자 ${o.username} (ID: ${r}), ${i}% → ${n}%`),e.json({success:!0,message:`판매자 '${o.username}'의 수수료율이 ${i}%에서 ${n}%로 변경되었습니다`,data:{seller_id:r,seller_username:o.username,old_commission_rate:i,new_commission_rate:n}})}catch(r){return console.error("수수료율 변경 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/approve",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();if(!a)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(a.status==="approved")return e.json({success:!1,error:"이미 승인된 판매자입니다"},400);if(await s.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(t.adminId,r).run(),console.log(`셀러 승인: ${a.username} (ID: ${r}) by Admin ID: ${t.adminId}`),a.email)try{const{sendEmail:n,getSellerApprovalEmailHTML:o}=await Promise.resolve().then(()=>Cr),i=e.env.RESEND_API_KEY||"",c=o(a.name,a.username),l=await n({to:a.email,subject:"🎉 리스터코퍼레이션 판매자 승인 완료",html:c},i,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");l.success?console.log(`[셀러 승인] 이메일 발송 성공: ${a.email}`):console.warn(`[셀러 승인] 이메일 발송 실패: ${l.error}`)}catch(n){console.error("[셀러 승인] 이메일 발송 오류:",n)}try{const{createNotification:n,NotificationTemplates:o}=await Promise.resolve().then(()=>kr),i=o.seller_approved(a.name);await n(s,{userId:parseInt(r),type:"seller_approved",title:i.title,message:i.message,linkUrl:i.linkUrl})}catch(n){console.error("[셀러 승인] 알림 생성 오류:",n)}return e.json({success:!0,message:`판매자 '${a.name}'님이 승인되었습니다`,data:{seller_id:r,seller_username:a.username,seller_name:a.name,status:"approved",approved_at:new Date().toISOString()}})}catch(r){return console.error("셀러 승인 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/sellers/:id/reject",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json();if(!a)return e.json({success:!1,error:"거부 사유를 입력해주세요"},400);const n=await s.prepare("SELECT id, username, email, name, status FROM sellers WHERE id = ?").bind(r).first();if(!n)return e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404);if(n.status==="rejected")return e.json({success:!1,error:"이미 거부된 판매자입니다"},400);if(await s.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(a,t.adminId,r).run(),console.log(`셀러 거부: ${n.username} (ID: ${r}), 사유: ${a}`),n.email)try{const{sendEmail:o,getSellerRejectionEmailHTML:i}=await Promise.resolve().then(()=>Cr),c=e.env.RESEND_API_KEY||"",l=i(n.name,a),u=await o({to:n.email,subject:"리스터코퍼레이션 판매자 승인 결과 안내",html:l},c,e.env.EMAIL_FROM||"리스터코퍼레이션 <noreply@ur-team.com>");u.success?console.log(`[셀러 거부] 이메일 발송 성공: ${n.email}`):console.warn(`[셀러 거부] 이메일 발송 실패: ${u.error}`)}catch(o){console.error("[셀러 거부] 이메일 발송 오류:",o)}try{const{createNotification:o,NotificationTemplates:i}=await Promise.resolve().then(()=>kr),c=i.seller_rejected(a);await o(s,{userId:parseInt(r),type:"seller_rejected",title:c.title,message:c.message,linkUrl:c.linkUrl})}catch(o){console.error("[셀러 거부] 알림 생성 오류:",o)}return e.json({success:!0,message:`판매자 '${n.name}'님의 승인이 거부되었습니다`,data:{seller_id:r,seller_username:n.username,seller_name:n.name,status:"rejected",rejection_reason:a,rejected_at:new Date().toISOString()}})}catch(r){return console.error("셀러 거부 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/sellers/pending",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=await s.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();return e.json({success:!0,data:r.results,count:r.results.length})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/admin/dashboard/stats",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=new Date;r.setHours(0,0,0,0);const a=r.toISOString(),n=await s.prepare(`
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
    `).first(),f=(m==null?void 0:m.count)||0;return e.json({success:!0,stats:{todaySales:o,todayOrders:c,currentVisitors:d,liveStreams:f},timestamp:new Date().toISOString()})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/public/seller/:sellerId",async e=>{const{DB:s,CACHE_KV:t}=e.env;try{const r=e.req.param("sellerId"),a=`public:seller:${r}`,n=await So(t,a);if(n)return e.json({success:!0,data:n,cached:!0});const o=await s.prepare(`
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
    `).bind(r).first(),d={profile:o,live_streams:i.results,scheduled_streams:c.results,products:l.results,stats:u};return await ds(t,a,d,60,!1),e.json({success:!0,data:d})}catch(r){return console.error("셀러 프로필 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/public/seller/username/:username",async e=>{const{DB:s}=e.env;try{const t=e.req.param("username"),r=await s.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(t).first();return r?e.json({success:!0,data:{seller_id:r.id}}):e.json({success:!1,error:"판매자를 찾을 수 없습니다"},404)}catch(t){return console.error("셀러 조회 실패:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/admin/settlement/stats",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{period:r}=e.req.query();let a="";const n=new Date;switch(r){case"today":a=`AND DATE(o.created_at) = '${n.toISOString().split("T")[0]}'`;break;case"week":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-10080*60*1e3).toISOString().split("T")[0]}'`;break;case"month":a=`AND DATE(o.created_at) >= '${new Date(n.getTime()-720*60*60*1e3).toISOString().split("T")[0]}'`;break;default:a=""}const o=await s.prepare(`
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
    `).all();return e.json({success:!0,data:{overview:o,sellers:i.results,period:r||"all"}})}catch(r){return console.error("정산 통계 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/records",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{seller_id:r,period:a,status:n}=e.req.query();let o=["payment_status = 'completed'","is_cancelled = 0"];const i=[];r&&(o.push("o.seller_id = ?"),i.push(r)),n&&(o.push("o.settlement_status = ?"),i.push(n));const c=new Date;switch(a){case"today":const d=c.toISOString().split("T")[0];o.push(`DATE(o.created_at) = '${d}'`);break;case"week":const m=new Date(c.getTime()-10080*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${m}'`);break;case"month":const f=new Date(c.getTime()-720*60*60*1e3).toISOString().split("T")[0];o.push(`DATE(o.created_at) >= '${f}'`);break}const l=o.length>0?`WHERE ${o.join(" AND ")}`:"",u=await s.prepare(`
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
    `).bind(...i).all();return e.json({success:!0,data:u.results})}catch(r){return console.error("정산 내역 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.patch("/api/admin/settlement/:orderId/status",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderId"),{status:a}=await e.req.json();if(!["pending","completed"].includes(a))return e.json({success:!1,error:"유효하지 않은 정산 상태입니다"},400);const n=await s.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(r).first();return n?(await s.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${a==="completed"?"datetime('now')":"NULL"}
      WHERE id = ?
    `).bind(a,r).run(),console.log(`정산 상태 변경: 주문 ${n.order_number}, ${n.settlement_status} → ${a}`),e.json({success:!0,message:`정산 상태가 '${a}'로 변경되었습니다`,data:{order_id:r,order_number:n.order_number,old_status:n.settlement_status,new_status:a}})):e.json({success:!1,error:"주문을 찾을 수 없습니다"},404)}catch(r){return console.error("정산 상태 변경 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/admin/settlement/batch-complete",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{order_ids:r}=await e.req.json();if(!Array.isArray(r)||r.length===0)return e.json({success:!1,error:"주문 ID 배열이 필요합니다"},400);let a=0,n=0;for(const o of r)try{await s.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(o).run(),a++}catch(i){n++,console.error(`주문 ${o} 정산 처리 실패:`,i)}return e.json({success:!0,message:`${a}건 정산 완료, ${n}건 실패`,data:{total:r.length,success:a,failed:n}})}catch(r){return console.error("일괄 정산 처리 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/admin/settlement/export-csv",async e=>{const{DB:s}=e.env,t=await x(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{seller_id:r,period:a}=e.req.query();let n=["payment_status = 'completed'","is_cancelled = 0"];const o=[];r&&(n.push("o.seller_id = ?"),o.push(r));const i=new Date;switch(a){case"today":const _=i.toISOString().split("T")[0];n.push(`DATE(o.created_at) = '${_}'`);break;case"week":const h=new Date(i.getTime()-10080*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${h}'`);break;case"month":const w=new Date(i.getTime()-720*60*60*1e3).toISOString().split("T")[0];n.push(`DATE(o.created_at) >= '${w}'`);break}const c=n.length>0?`WHERE ${n.join(" AND ")}`:"",u=(await s.prepare(`
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
`;u.forEach(_=>{const h=d.map(w=>{const b=_[w];if(b==null)return"";const g=String(b);return g.includes(",")||g.includes('"')||g.includes(`
`)?`"${g.replace(/"/g,'""')}"`:g});m+=h.join(",")+`
`});const f="\uFEFF";return new Response(f+m,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${a||"all"}_${Date.now()}.csv"`}})}catch(r){return console.error("CSV 내보내기 실패:",r),e.json({success:!1,error:r.message},500)}});p.post("/api/orders/create",j,async e=>{const{DB:s}=e.env;try{const{userId:t,cartItems:r,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i,buyerBusinessNumber:c,buyerBusinessName:l,buyerCeoName:u}=await e.req.json();console.log("[DEPRECATED /api/orders/create] 주문 생성 요청:",{userId:t,cartItems:r==null?void 0:r.length,totalAmount:a,shippingAddressId:n,sellerId:o,issueTaxInvoice:i});let d=10;if(o){const v=await s.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(o).first();v&&v.commission_rate!==null&&(d=v.commission_rate)}console.log("수수료율:",{sellerId:o,commissionRate:d});const m=Math.floor(a*(d/100)),f=a-m;let _=null;if(n){const v=await s.prepare(`
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
      `).bind(n,t).first();if(!v)return e.json({success:!1,error:"배송지 정보를 찾을 수 없습니다"},400);_=v}if(!t)return e.json({success:!1,error:"User ID is required. Please login with Kakao first."},401);const h=t,w=new Date,b=w.getFullYear().toString().slice(-2),g=(w.getMonth()+1).toString().padStart(2,"0"),T=w.getDate().toString().padStart(2,"0"),y=`${b}${g}${T}`,R=Math.random().toString(36).substring(2,7).toUpperCase(),F=`ORD-${y}-${R}`,C=r.map(v=>v.product_id),D=C.map(()=>"?").join(","),W=await s.prepare(`
      SELECT id, stock FROM products WHERE id IN (${D})
    `).bind(...C).all(),P=new Map(W.results.map(v=>[v.id,v.stock]));for(const v of r){const te=P.get(v.product_id);if(te===void 0)return e.json({success:!1,error:`상품을 찾을 수 없습니다 (ID: ${v.product_id})`},400);if(te<v.quantity)return e.json({success:!1,error:`재고가 부족합니다 (상품 ID: ${v.product_id})`},400)}const $=(await s.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(F,h,a,"pending",o||null,d,m,f,n||null,(_==null?void 0:_.recipient_name)||null,(_==null?void 0:_.phone)||null,_!=null&&_.address?`${_.address} ${_.address_detail}`:null,(_==null?void 0:_.postal_code)||null,i?1:0,c||null,l||null,u||null).run()).meta.last_row_id,Q=r.map(v=>s.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind($,v.product_id,v.option_id||null,v.quantity,v.price_snapshot||v.price)),z=r.map(v=>s.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(v.quantity,v.product_id));await s.batch([...Q,...z]);try{const v=gs(e.env),te=r.map(H=>H.product_id),q=te.map(()=>"?").join(","),U=await s.prepare(`
        SELECT id, name, price, original_price, discount_rate, stock, image_url
        FROM products
        WHERE id IN (${q})
      `).bind(...te).all();await Promise.all(U.results.map(H=>v.updateProductStock(H.id,H.stock,{name:H.name,price:H.price,original_price:H.original_price,discount_rate:H.discount_rate,image_url:H.image_url}))),console.log(`🔥 Firebase: Stock updated for ${U.results.length} products`)}catch(v){console.error("⚠️ Firebase stock sync failed (non-blocking):",v)}try{const v=r.map(U=>U.product_id),te=v.map(()=>"?").join(","),q=await s.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${te})
      `).bind(...v).all();for(const U of q.results){const H=U.stock_alert_threshold||5,re=U.stock;re<=H&&U.seller_id&&(await Sr(s,U.seller_id,U.name,re,H),console.log(`[Low Stock Alert] ${U.name}: ${re} <= ${H}`))}}catch(v){console.error("[Low Stock Alert] Error:",v)}return console.log("주문 생성 완료:",{orderId:$,orderNumber:F}),e.json({success:!0,orderId:$,orderNumber:F,totalAmount:a})}catch(t){return console.error("주문 생성 실패:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/orders/:orderNumber/refund",S(),j,async e=>{const{DB:s}=e.env;try{const t=e.req.param("orderNumber"),{reason:r}=await e.req.json();console.log("[Order Refund] 환불 요청:",{orderNumber:t,reason:r});const a=await s.prepare(`
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
        `).bind(i.quantity,i.product_id));await s.batch(o),console.log("[Order Refund] 재고 복구 완료:",{items:n.results.length})}return console.log("[Order Refund] ✅ 환불 완료:",{orderNumber:t,reason:r}),e.json({success:!0,message:"주문이 취소되었습니다",data:{orderNumber:t,cancelDate:new Date().toISOString()}})}catch(t){return console.error("[Order Refund] Error:",t),e.json({success:!1,error:t.message||"주문 취소 중 오류가 발생했습니다"},500)}});p.use("/api/seller/*",j);p.get("/api/seller/sales",S(),async e=>{try{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await rs(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],l=await s.prepare(`
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
    `).bind(a,i,c).all();return e.json({success:!0,data:{seller:l,stats:u,orders:(d==null?void 0:d.results)||[]}})}catch(s){return console.error("Seller sales query error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/settlement-csv",S(),async e=>{try{const{DB:s}=e.env,t=e.req.header("X-Session-Token");if(!t)return e.json({success:!1,error:"인증 토큰이 없습니다."},401);const r=await rs(e.env.SESSION_KV,t);if(!r)return e.json({success:!1,error:"유효하지 않은 세션입니다."},401);if(r.user_type!=="seller")return e.json({success:!1,error:"셀러만 접근 가능합니다."},403);const a=r.seller_id||r.user_id,{startDate:n,endDate:o}=e.req.query(),i=n||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0],c=o||new Date().toISOString().split("T")[0],l=await s.prepare(`
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
`;for(const d of(l==null?void 0:l.results)||[]){const m=d.status==="delivered"?"배송완료":d.status==="shipped"?"배송중":d.status==="preparing"?"상품준비중":d.status==="paid"?"결제완료":"대기중",f=d.buyer_business_name||"-",_=d.buyer_business_number||"-",h=d.invoice_number||"-",w=d.issue_date||"-",b=d.tax_invoice_status==="issued"?"발행완료":d.tax_invoice_status==="cancelled"?"취소":"-",g=d.nts_confirm_number||"-";u+=`${d.order_number},${d.created_at},${d.user_name||"익명"},${d.total_amount},${d.commission_amount},${d.seller_amount},${m},${f},${_},${h},${w},${b},${g}
`}return new Response(u,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="settlement_${i}_${c}.csv"`}})}catch(s){return console.error("CSV download error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/tax-invoices/issue",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{order_number:r}=await e.req.json();if(!r)return e.json({success:!1,error:"주문번호는 필수입니다."},400);const a=await s.prepare(`
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
    `).bind(a.id).all(),i=Number(a.total_amount),c=Math.floor(i/1.1),l=i-c,u=new Date().toISOString().split("T")[0],d=`${u}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,m=va(n,a,o.results);let f,_,h;try{f=await Ia(m),_=f.ntsConfirmNumber,h=f.invoiceKey,console.log("바로빌 발행 성공:",{ntsConfirmNumber:_,invoiceKey:h,mockMode:cs()})}catch(g){console.error("바로빌 API 호출 실패:",g),_="FAILED",h=null}const b=(await s.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(t.sellerId,r,"tax",d,u,n.business_number,n.business_name,n.ceo_name,n.address,n.business_type,n.business_category,a.buyer_business_number,a.buyer_business_name,a.buyer_ceo_name,c,l,i,_==="FAILED"?"failed":"issued",cs()?"mock":"barobill",h,_).run()).meta.last_row_id;for(const g of o.results){const T=Math.floor(Number(g.price)*Number(g.quantity)/1.1),y=Number(g.price)*Number(g.quantity)-T;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(b,g.id,g.product_name,g.quantity,g.price,T,y).run()}return e.json({success:!0,data:{invoice_id:b,invoice_number:d,issue_date:u,total_amount:i,supply_price:c,tax_amount:l,status:_==="FAILED"?"failed":"issued",nts_confirm_number:_,api_invoice_key:h,mock_mode:cs(),message:_==="FAILED"?"바로빌 API 호출 실패. 나중에 다시 시도해주세요.":cs()?"세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)":"세금계산서가 발행되었습니다."}})}catch(r){return console.error("세금계산서 발행 오류:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/tax-invoices",async e=>{var r;const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{start_date:a,end_date:n,status:o}=e.req.query();let i=`
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;const c=[t.sellerId];a&&(i+=" AND issue_date >= ?",c.push(a)),n&&(i+=" AND issue_date <= ?",c.push(n)),o&&(i+=" AND status = ?",c.push(o)),i+=" ORDER BY created_at DESC";const l=await s.prepare(i).bind(...c).all();return e.json({success:!0,data:l.results||[],total:((r=l.results)==null?void 0:r.length)||0})}catch(a){return e.json({success:!1,error:a.message},500)}});p.get("/api/seller/tax-invoices/:id",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),a=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,t.sellerId).first();if(!a)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const n=await s.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(r).all();return e.json({success:!0,data:{...a,items:n.results||[]}})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/tax-invoices/:id/cancel",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("id"),{reason:a}=await e.req.json(),n=await s.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(r,t.sellerId).first();if(!n)return e.json({success:!1,error:"세금계산서를 찾을 수 없습니다."},404);const o=new Date(n.issue_date),i=new Date(o);if(i.setDate(i.getDate()+1),new Date>i)return e.json({success:!1,error:"발행일 익일까지만 취소 가능합니다."},400);try{if(n.api_invoice_key&&!cs()){const l=await s.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(t.sellerId).first();l&&l.business_number&&await Ra(l.business_number,n.api_invoice_key,a||"판매자 요청")}}catch(l){console.error("바로빌 취소 API 호출 실패:",l)}return await s.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(r).run(),e.json({success:!0,message:"세금계산서가 취소되었습니다."})}catch(r){return e.json({success:!1,error:r.message},500)}});p.get("/api/seller/tax-invoices/auto-issue-logs",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const{status:r,limit:a=50}=e.req.query();let n=`
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_number = o.order_number
      WHERE log.seller_id = ?
    `;const o=[t.sellerId];r&&(n+=" AND log.status = ?",o.push(r)),n+=" ORDER BY log.created_at DESC LIMIT ?",o.push(Number(a));const i=await s.prepare(n).bind(...o).all();return e.json({success:!0,data:i.results})}catch(r){return e.json({success:!1,error:r.message},500)}});p.post("/api/seller/tax-invoices/retry/:orderNumber",async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:t.error},401);try{const r=e.req.param("orderNumber");console.log(`[TAX INVOICE RETRY] 재시도 시작: ${r}`);const a=await s.prepare(`
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
    `).bind(o.id).all(),l=Number(o.total_amount),u=Math.floor(l/1.1),d=l-u,m=new Date().toISOString().split("T")[0].replace(/-/g,""),f=Math.random().toString(36).substring(2,8).toUpperCase(),_=`${m}-${f}`,w=(await s.prepare(`
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
    `).bind(t.sellerId,r,_,i.business_number,i.business_name,i.ceo_name,i.address||"",i.business_type||"",i.business_category||"",i.email||"",i.phone||"",o.buyer_business_number,o.buyer_business_name,o.buyer_ceo_name||"",o.buyer_business_address||"",o.buyer_business_type||"",o.buyer_business_category||"",o.buyer_email||"",o.buyer_phone||"",u,d,l,`RETRY-${Date.now()}-${f}`).run()).meta.last_row_id;for(const b of c.results){const g=Math.floor(Number(b.price)*Number(b.quantity)/1.1),T=Number(b.price)*Number(b.quantity)-g;await s.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(w,b.product_name||"상품명 없음",b.quantity,b.price,g,T,b.option_name||"").run()}return await s.prepare(`
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
    `).bind(t).first();if(!r||!r.seller_id)return e.json({success:!1,error:"유효하지 않은 세션입니다"},401);const{profile_image:a,bio:n,sns_instagram:o,sns_youtube:i,sns_facebook:c,sns_twitter:l,website_url:u,kakao_chat_link:d}=await e.req.json(),m=[],f=[];if(a!==void 0&&(m.push("profile_image = ?"),f.push(a)),n!==void 0&&(m.push("bio = ?"),f.push(n)),o!==void 0&&(m.push("sns_instagram = ?"),f.push(o)),i!==void 0&&(m.push("sns_youtube = ?"),f.push(i)),c!==void 0&&(m.push("sns_facebook = ?"),f.push(c)),l!==void 0&&(m.push("sns_twitter = ?"),f.push(l)),u!==void 0&&(m.push("website_url = ?"),f.push(u)),d!==void 0&&(m.push("kakao_chat_link = ?"),f.push(d)),m.length===0)return e.json({success:!1,error:"수정할 내용이 없습니다"},400);m.push("updated_at = datetime('now')"),f.push(r.seller_id),await s.prepare(`
      UPDATE sellers 
      SET ${m.join(", ")}
      WHERE id = ?
    `).bind(...f).run();const _=await s.prepare(`
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
    `).bind(t).all();return e.json({success:!0,data:r.results})}catch(r){return console.error("상품 목록 조회 실패:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/notifications",j,async e=>{const{DB:s}=e.env;try{const t=e.get("userId"),r=e.get("userType"),a=parseInt(e.req.query("limit")||"50"),n=e.req.query("unread_only")==="true";let o=`
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;n&&(o+=" AND is_read = 0"),o+=" ORDER BY created_at DESC LIMIT ?";const i=await s.prepare(o).bind(t,r,a).all();return e.json({success:!0,data:i.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/api/notifications/unread-count",j,async e=>{const{DB:s}=e.env;try{const t=e.get("userId"),r=e.get("userType"),a=await s.prepare(`
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
    `).all();return e.json({success:!0,data:r.results})}catch(t){return e.json({success:!1,error:t.message},500)}});p.post("/api/admin/banners",j,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const{title:r,image_url:a,link_url:n,description:o,is_active:i,display_order:c,start_date:l,end_date:u}=await e.req.json();if(!r||!a)return e.json({success:!1,error:"제목과 이미지는 필수입니다."},400);const d=await s.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(r,a,n||null,o||null,i!==!1?1:0,c||0,l||null,u||null).run();return e.json({success:!0,id:d.meta.last_row_id})}catch(t){return e.json({success:!1,error:t.message},500)}});p.put("/api/admin/banners/:id",j,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id"),{title:a,image_url:n,link_url:o,description:i,is_active:c,display_order:l,start_date:u,end_date:d}=await e.req.json();return await s.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(a,n,o||null,i||null,c?1:0,l||0,u||null,d||null,r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.delete("/api/admin/banners/:id",j,async e=>{const{DB:s}=e.env;try{if(e.get("userType")!=="admin")return e.json({success:!1,error:"관리자 권한이 필요합니다."},403);const r=e.req.param("id");return await s.prepare("DELETE FROM banners WHERE id = ?").bind(r).run(),e.json({success:!0})}catch(t){return e.json({success:!1,error:t.message},500)}});p.get("/order-complete",e=>e.redirect("/order-complete.html",302));p.notFound(e=>{const s=e.req.path;return s.startsWith("/api/")?e.json({success:!1,error:"Not found",message:`The requested endpoint ${s} was not found.`},404):new Response(null,{status:404})});p.onError((e,s)=>{const t=s.req.path;if(e instanceof bn)return console.error("[AppError]",{path:t,method:s.req.method,code:e.code,message:e.message,statusCode:e.statusCode}),s.json({success:!1,error:{code:e.code,message:e.message,...e.details&&{details:e.details}}},e.statusCode);if(console.error("[Global Error Handler]",{path:t,method:s.req.method,error:e.message,stack:e.stack}),t.startsWith("/api/")){let r=500,a="Internal Server Error";return e.message.includes("Unauthorized")||e.message.includes("로그인")?(r=401,a="인증이 필요합니다. 로그인해주세요."):e.message.includes("Forbidden")||e.message.includes("권한")?(r=403,a="접근 권한이 없습니다."):e.message.includes("Not found")||e.message.includes("찾을 수 없")?(r=404,a="요청하신 리소스를 찾을 수 없습니다."):(e.message.includes("Bad request")||e.message.includes("잘못된"))&&(r=400,a="잘못된 요청입니다."),s.json({success:!1,error:e.message||a},r)}return s.html(`
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
    `).bind(t||"2000-01-01",r||"2100-01-01").all();return e.json({success:!0,statistics:{total:a,by_seller:n.results}})}catch(t){return console.error("[Admin Alimtalk Statistics] Error:",t),e.json({success:!1,error:t.message},500)}});p.use("/api/seller/alimtalk/*",j);p.get("/api/seller/alimtalk/account",S(),async e=>{const{env:s}=e;try{const t=e.get("user");if(!t||t.userType!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const r=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(t.userId).first();return e.json({success:!0,account:r})}catch(t){return console.error("[Seller Alimtalk Account] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/register",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Pe(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{channel_id:a,phone_number:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=ar(n),i=await Ha(s,{channelId:a,phoneNumber:o});if(!i.success)return e.json({success:!1,error:"Failed to register Kakao channel"},500);const c=await s.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(r.user_id,a,a,i.senderKey,o).run();return e.json({success:!0,account_id:c.meta.last_row_id,sender_key:i.senderKey,message:"Kakao channel registered successfully"})}catch(t){return console.error("[Seller Alimtalk Register] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Pe(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const a=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!a)return e.json({success:!1,error:"Alimtalk account not found"},404);const n=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(a.id).all();return e.json({success:!0,templates:n.results})}catch(t){return console.error("[Seller Alimtalk Templates] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/templates",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Pe(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_code:a,template_name:n,template_content:o,template_type:i}=await e.req.json();if(!a||!n||!o)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(!(await Ka(s,c.sender_key,{name:n,content:o,templateCode:a})).success)return e.json({success:!1,error:"Failed to register template"},500);const u=await s.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(c.id,a,n,o,i||"basic").run();return e.json({success:!0,template_id:u.meta.last_row_id,message:"Template registered successfully. Approval pending (1-2 days)"})}catch(t){return console.error("[Seller Alimtalk Template Register] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/pricing",S(),async e=>{const{env:s}=e;try{const t=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();return e.json({success:!0,pricing:t.results})}catch(t){return console.error("[Seller Alimtalk Pricing] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/charge",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Pe(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{amount:a,pricing_id:n}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const o=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!o)return e.json({success:!1,error:"Alimtalk account not found"},404);const i=await s.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(n).first();if(!i)return e.json({success:!1,error:"Pricing not found"},404);const c=a*i.unit_price,l=`alimtalk_${o.id}_${Date.now()}`,u=await s.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(o.id,a,c,i.unit_price,l).run(),d=`https://api.tosspayments.com/v1/payment/${l}`;return e.json({success:!0,charge_id:u.meta.last_row_id,order_id:l,amount:a,price:c,unit_price:i.unit_price,payment_url:d})}catch(t){return console.error("[Seller Alimtalk Charge] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/charge/complete",S(),async e=>{const{env:s}=e;try{const{order_id:t,payment_id:r}=await e.req.json();if(!t)return e.json({success:!1,error:"Missing order_id"},400);const a=await s.DB.prepare(`
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
    `).bind(a.amount,a.account_id).run(),e.json({success:!0,message:"Charge completed successfully",charged_amount:a.amount})):e.json({success:!1,error:"Charge not found or already completed"},404)}catch(t){return console.error("[Seller Alimtalk Charge Complete] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/send",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Pe(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{template_id:a,recipient_phone:n,variables:o,order_id:i}=await e.req.json();if(!a||!n)return e.json({success:!1,error:"Missing required fields"},400);const c=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(r.user_id).first();if(!c)return e.json({success:!1,error:"Active alimtalk account not found"},404);if(c.balance<1)return e.json({success:!1,error:"Insufficient balance. Please charge first."},400);const l=await s.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(a,c.id).first();if(!l)return e.json({success:!1,error:"Template not found or not approved"},404);const u=Ba(l.template_content,o||{}),d=ar(n),m=await Qs(s,{senderKey:c.sender_key,templateCode:l.template_code,to:d,message:u});if(!m.success)return await s.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(c.id,a,i||null,d,u,m.error).run(),e.json({success:!1,error:m.error},500);const f=await s.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(c.id,a,i||null,d,u,15,m.messageId).run();return await s.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(c.id).run(),e.json({success:!0,message_id:f.meta.last_row_id,aligo_message_id:m.messageId,status:"sent",remaining_balance:c.balance-1})}catch(t){return console.error("[Seller Alimtalk Send] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/messages",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Pe(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{page:a="1",limit:n="20",status:o}=e.req.query(),i=await s.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(r.user_id).first();if(!i)return e.json({success:!1,error:"Alimtalk account not found"},404);const c=(parseInt(a)-1)*parseInt(n);let l=`
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;const u=[i.id];o&&(l+=" AND m.status = ?",u.push(o)),l+=" ORDER BY m.created_at DESC LIMIT ? OFFSET ?",u.push(parseInt(n),c);const d=await s.DB.prepare(l).bind(...u).all(),m=await s.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(i.id).first();return e.json({success:!0,messages:d.results,pagination:{total:m.total,page:parseInt(a),limit:parseInt(n)}})}catch(t){return console.error("[Seller Alimtalk Messages] Error:",t),e.json({success:!1,error:t.message},500)}});p.get("/api/seller/alimtalk/statistics",S(),async e=>{const{env:s}=e;try{const t=e.req.header("X-Session-Token"),r=await Pe(s,t);if(!r||r.user_type!=="seller")return e.json({success:!1,error:"Unauthorized"},401);const{start_date:a,end_date:n}=e.req.query(),o=await s.DB.prepare(`
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
    `).bind(o.id,a||"2000-01-01",n||"2100-01-01").all(),l=i.total_sent>0?(i.total_success/i.total_sent*100).toFixed(2):0;return e.json({success:!0,statistics:{total_sent:i.total_sent,total_success:i.total_success,total_failed:i.total_failed,success_rate:l,total_cost:i.total_cost,by_template:c.results}})}catch(t){return console.error("[Seller Alimtalk Statistics] Error:",t),e.json({success:!1,error:t.message},500)}});p.post("/api/seller/alimtalk/send",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,recipients:a,variables:n}=t;if(!r||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and recipients are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await Zs(e.env,{accountId:o.id,templateId:parseInt(r),recipients:a.map(c=>({phone:c.phone,name:c.name,variables:c.variables||{}})),variables:n||{}});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/send/order",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,orderId:a,customMessage:n}=t;if(!r||!a)return e.json({success:!1,error:"templateId and orderId are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);if(!await e.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(a),parseInt(s)).first())return e.json({success:!1,error:"Order not found or unauthorized"},404);const c=await tn(e.env,o.id,parseInt(r),parseInt(a),n);return e.json({success:c.success,data:{total:c.totalRecipients,sent:c.successCount,failed:c.failedCount,refunded:c.refundedAmount},messages:c.messages})}catch(s){return console.error("[Alimtalk Send Order] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/send/bulk",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.req.json(),{templateId:r,rows:a,variables:n}=t;if(!r||!Array.isArray(a)||a.length===0)return e.json({success:!1,error:"templateId and rows are required"},400);const o=await e.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(s)).first();if(!o)return e.json({success:!1,error:"No active alimtalk account found"},404);const i=await rn(e.env,o.id,parseInt(r),a,n||{});return e.json({success:i.success,data:{total:i.totalRecipients,sent:i.successCount,failed:i.failedCount,refunded:i.refundedAmount},messages:i.messages})}catch(s){return console.error("[Alimtalk Send Bulk] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/seller/alimtalk/templates/:id/preview",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=e.req.param("id"),r=await e.req.json(),{variables:a}=r,n=await e.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(t),parseInt(s)).first();if(!n)return e.json({success:!1,error:"Template not found"},404);let o=n.template_content;return a&&Object.entries(a).forEach(([i,c])=>{const l=new RegExp(`#{${i}}`,"g");o=o.replace(l,c)}),e.json({success:!0,data:{template_name:n.template_name,original:n.template_content,preview:o,required_variables:Array.from(n.template_content.matchAll(/#{(\w+)}/g),i=>i[1])}})}catch(s){return console.error("[Alimtalk Preview] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements",S(),async e=>{try{const s=await e.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all();return e.json({success:!0,data:s.results})}catch(s){return console.error("[Admin Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements/:id",S(),async e=>{try{const s=parseInt(e.req.param("id")),t=await un(e.env.DB,s);return t?e.json({success:!0,data:t}):e.json({success:!1,error:"Settlement not found"},404)}catch(s){return console.error("[Admin Settlement Detail] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/admin/settlements/generate",S(),async e=>{try{const s=await e.req.json(),{startDate:t,endDate:r}=s,a=t&&r?{startDate:t,endDate:r}:nn(),n=await cn(e.env.DB,a);return await ln(e.env.DB,n),e.json({success:!0,data:n})}catch(s){return console.error("[Admin Generate Settlement] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.env.DB.prepare(`
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
    `).bind(parseInt(s)).all();return e.json({success:!0,data:t.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/admin/settlements/calculate",S(),async e=>{const{DB:s}=e.env;if(!(await x(e)).success)return e.json({success:!1,error:"관리자 권한이 필요합니다"},401);try{const r=e.req.query("seller_id"),a=e.req.query("period")||"monthly",n=e.req.query("format")||"json";let o=e.req.query("start_date"),i=e.req.query("end_date");if(!r)return e.json({success:!1,error:"seller_id가 필요합니다"},400);const c=new Date;if(a==="weekly"){const g=new Date(c);g.setDate(c.getDate()-c.getDay()-6),g.setHours(0,0,0,0);const T=new Date(g);T.setDate(g.getDate()+6),T.setHours(23,59,59,999),o=g.toISOString().split("T")[0],i=T.toISOString().split("T")[0]}else if(a==="monthly"){const g=new Date(c.getFullYear(),c.getMonth()-1,1),T=new Date(c.getFullYear(),c.getMonth(),0);o=g.toISOString().split("T")[0],i=T.toISOString().split("T")[0]}else if(a==="custom"&&(!o||!i))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const l=await s.prepare(`
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
    `).bind(r,o,i).all()).results,m=d.length,f=d.reduce((g,T)=>g+(T.total_amount||0),0),_=d.reduce((g,T)=>g+(T.commission_amount||0),0),h=f-_,w=m>0?d.reduce((g,T)=>g+(T.commission_rate||0),0)/m:0,b={sellerId:parseInt(r),sellerName:l.seller_name||"Unknown",businessName:l.business_name||null,period:{type:a,startDate:o,endDate:i},summary:{totalOrders:m,totalSales:f,totalCommission:_,netAmount:h,commissionRate:Math.round(w*100)/100},orders:d.map(g=>({orderNumber:g.order_number,createdAt:g.created_at,status:g.status,totalAmount:g.total_amount||0,commissionAmount:g.commission_amount||0,sellerAmount:g.seller_amount||0}))};if(n==="csv"){const g=[];g.push("셀러 정산서"),g.push(`셀러명,${b.sellerName}`),g.push(`사업자명,${b.businessName||"N/A"}`),g.push(`정산 기간,${b.period.startDate} ~ ${b.period.endDate}`),g.push(""),g.push("구분,금액"),g.push(`총 주문 건수,${b.summary.totalOrders}건`),g.push(`총 매출,${b.summary.totalSales.toLocaleString()}원`),g.push(`플랫폼 수수료 (${b.summary.commissionRate}%),${b.summary.totalCommission.toLocaleString()}원`),g.push(`정산 금액,${b.summary.netAmount.toLocaleString()}원`),g.push(""),g.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const R of b.orders)g.push(`${R.orderNumber},${R.createdAt},${R.status},${R.totalAmount},${R.commissionAmount},${R.sellerAmount}`);const T=g.join(`
`),y=`settlement_${r}_${o}_${i}.csv`;return e.text(T,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${y}"`})}return e.json({success:!0,data:b})}catch(r){return console.error("[Settlement] Calculation error:",r),e.json({success:!1,error:r.message},500)}});p.get("/api/seller/settlements/my",S(),async e=>{const{DB:s}=e.env,t=await k(e);if(!t.success)return e.json({success:!1,error:"셀러 권한이 필요합니다"},401);const r=new URL(e.req.url);r.searchParams.set("seller_id",String(t.sellerId));const a=new Request(r.toString(),e.req.raw);({...e,req:new Proxy(a,{get(n,o){return o==="query"?i=>i==="seller_id"?String(t.sellerId):r.searchParams.get(i):n[o]}})});try{const n=t.sellerId,o=e.req.query("period")||"monthly",i=e.req.query("format")||"json";let c=e.req.query("start_date"),l=e.req.query("end_date");const u=new Date;if(o==="weekly"){const y=new Date(u);y.setDate(u.getDate()-u.getDay()-6),y.setHours(0,0,0,0);const R=new Date(y);R.setDate(y.getDate()+6),R.setHours(23,59,59,999),c=y.toISOString().split("T")[0],l=R.toISOString().split("T")[0]}else if(o==="monthly"){const y=new Date(u.getFullYear(),u.getMonth()-1,1),R=new Date(u.getFullYear(),u.getMonth(),0);c=y.toISOString().split("T")[0],l=R.toISOString().split("T")[0]}else if(o==="custom"&&(!c||!l))return e.json({success:!1,error:"custom 기간 선택 시 start_date와 end_date가 필요합니다"},400);const d=await s.prepare(`
      SELECT s.id, s.business_name, s.commission_rate, u.name as seller_name
      FROM sellers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).bind(n).first();if(!d)return e.json({success:!1,error:"셀러를 찾을 수 없습니다"},404);const f=(await s.prepare(`
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
    `).bind(n,c,l).all()).results,_=f.length,h=f.reduce((y,R)=>y+(R.total_amount||0),0),w=f.reduce((y,R)=>y+(R.commission_amount||0),0),b=h-w,g=_>0?f.reduce((y,R)=>y+(R.commission_rate||0),0)/_:0,T={sellerId:n,sellerName:d.seller_name||"Unknown",businessName:d.business_name||null,period:{type:o,startDate:c,endDate:l},summary:{totalOrders:_,totalSales:h,totalCommission:w,netAmount:b,commissionRate:Math.round(g*100)/100},orders:f.map(y=>({orderNumber:y.order_number,createdAt:y.created_at,status:y.status,totalAmount:y.total_amount||0,commissionAmount:y.commission_amount||0,sellerAmount:y.seller_amount||0}))};if(i==="csv"){const y=[];y.push("셀러 정산서"),y.push(`셀러명,${T.sellerName}`),y.push(`사업자명,${T.businessName||"N/A"}`),y.push(`정산 기간,${T.period.startDate} ~ ${T.period.endDate}`),y.push(""),y.push("구분,금액"),y.push(`총 주문 건수,${T.summary.totalOrders}건`),y.push(`총 매출,${T.summary.totalSales.toLocaleString()}원`),y.push(`플랫폼 수수료 (${T.summary.commissionRate}%),${T.summary.totalCommission.toLocaleString()}원`),y.push(`정산 금액,${T.summary.netAmount.toLocaleString()}원`),y.push(""),y.push("주문번호,주문일시,상태,주문금액,플랫폼수수료,정산금액");for(const C of T.orders)y.push(`${C.orderNumber},${C.createdAt},${C.status},${C.totalAmount},${C.commissionAmount},${C.sellerAmount}`);const R=y.join(`
`),F=`my_settlement_${c}_${l}.csv`;return e.text(R,200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${F}"`})}return e.json({success:!0,data:T})}catch(n){return console.error("[My Settlement] Error:",n),e.json({success:!1,error:n.message},500)}});p.get("/api/seller/settlements",S(),async e=>{try{const s=e.req.header("X-Seller-ID");if(!s)return e.json({success:!1,error:"Unauthorized"},401);const t=await e.env.DB.prepare(`
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
    `).bind(parseInt(s)).all();return e.json({success:!0,data:t.results})}catch(s){return console.error("[Seller Settlements] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/live/:streamId/sse",async e=>{const s=e.req.param("streamId");return dn(s,e.env)});p.get("/api/live/:streamId/chat/sse",async e=>{const s=e.req.param("streamId");return pn(s,e.env)});p.get("/api/seller/orders/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?mn(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});p.get("/api/seller/stock/sse",async e=>{const s=e.req.header("X-Seller-ID");return s?_n(s,e.env):e.json({success:!1,error:"Unauthorized"},401)});p.post("/api/push/subscribe",S(),async e=>{try{const s=e.req.header("X-User-ID"),t=e.req.header("X-User-Type");if(!s||!t)return e.json({success:!1,error:"Unauthorized"},401);const r=await e.req.json();return await fn(e.env.DB,parseInt(s),t,r),e.json({success:!0})}catch(s){return console.error("[Push Subscribe] Error:",s),e.json({success:!1,error:s.message},500)}});p.post("/api/push/unsubscribe",S(),async e=>{try{const{endpoint:s}=await e.req.json();return s?(await En(e.env.DB,s),e.json({success:!0})):e.json({success:!1,error:"Endpoint required"},400)}catch(s){return console.error("[Push Unsubscribe] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/push/vapid-public-key",S(),async e=>{try{const s=e.env.VAPID_PUBLIC_KEY||"";return e.json({success:!0,publicKey:s})}catch(s){return console.error("[Push VAPID Key] Error:",s),e.json({success:!1,error:s.message},500)}});p.get("/api/cache/stats",async e=>{const s=e.req.query("token"),t=e.env.STATS_SECRET_TOKEN||"your-secret-token-here";if(s!==t)return e.json({success:!1,error:"접근 권한이 없습니다. 올바른 token을 제공해주세요."},403);const r=Y.hits+Y.misses>0?(Y.hits/(Y.hits+Y.misses)*100).toFixed(2):"0.00";return e.json({success:!0,data:{cache:{...Y,hitRate:`${r}%`,cacheSize:_e.size,maxSize:1e3,memoryUsage:`${(_e.size/1e3*100).toFixed(1)}%`},description:{hits:"Memory cache로 처리된 요청 (KV 읽기 0회)",misses:"Memory cache 미스로 KV 조회한 요청",writes:"Memory cache에 저장된 항목 수",evictions:"Memory cache에서 삭제된 항목 수 (만료 또는 크기 제한)",hitRate:"Cache hit 비율 (높을수록 KV 사용량 감소)",cacheSize:"현재 Memory cache에 저장된 항목 수",maxSize:"Memory cache 최대 크기",memoryUsage:"Memory cache 사용률 (cacheSize / maxSize)"},kvUsageGuide:{currentHitRate:`${r}%`,recommendation:parseFloat(r)>=90?"✅ 캐시가 매우 효과적으로 작동하고 있습니다.":parseFloat(r)>=70?"⚠️ 캐시 히트율이 낮습니다. TTL 조정을 고려하세요.":"❌ 캐시 히트율이 매우 낮습니다. 캐시 설정을 확인하세요.",kvDailyReadsLimit:"100,000 reads/day (free tier)",kvDailyWritesLimit:"1,000 writes/day (free tier)",estimatedDailyReads:Math.round(Y.misses/(Y.hits+Y.misses||1)*1e4),estimatedDailyWrites:Math.round(Y.writes/(Y.hits+Y.misses||1)*1e3)}}})});let Ot={},Ct={};p.get("/api/debug/kv-usage",S(),async e=>{try{const s=Object.entries(Ot).sort((i,c)=>c[1]-i[1]).slice(0,20),t=Object.entries(Ct).sort((i,c)=>c[1]-i[1]).slice(0,20),r=Object.values(Ot).reduce((i,c)=>i+c,0),a=Object.values(Ct).reduce((i,c)=>i+c,0),n=r/1e3*100,o=a/1e5*100;if((n>=50||o>=50)&&e.env.DISCORD_WEBHOOK_URL)try{await Sn(e.env.DISCORD_WEBHOOK_URL,o,n)}catch(i){console.error("[Discord] KV 경고 전송 실패:",i)}return e.json({success:!0,stats:{total_writes:r,total_reads:a,daily_write_limit:1e3,daily_read_limit:1e5,write_usage_percent:n.toFixed(2)+"%",read_usage_percent:o.toFixed(2)+"%",top_writes:s,top_reads:t},recommendations:r>500?["⚠️ KV Write 사용량이 높습니다!","1. 세션 갱신 주기를 늘리세요 (현재 29일)","2. 캐시를 메모리에만 저장하세요 (forceKvWrite: false)","3. JWT 인증으로 전환하세요 (KV 사용량 90% 감소)"]:["✅ KV 사용량이 정상 범위입니다."]})}catch(s){return e.json({success:!1,error:s.message},500)}});p.get("/api/notifications",S(),async e=>{var t;const{DB:s}=e.env;try{const r=e.req.query("userId"),a=parseInt(e.req.query("limit")||"20"),n=parseInt(e.req.query("offset")||"0");if(!r)return e.json({success:!1,error:"userId is required"},400);const o=await s.prepare(`
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
    `).bind(t,r).run()).meta.changes===0?e.json({success:!1,error:"Notification not found"},404):e.json({success:!0,message:"Notification deleted"}):e.json({success:!1,error:"userId is required"},400)}catch(t){return console.error("[Notifications] Delete error:",t),e.json({success:!1,error:t.message},500)}});async function Mo(e,s,t){var a,n;const r={embeds:[{title:"🚨 서버 에러 발생",color:16711680,fields:[{name:"에러 메시지",value:s.message||"Unknown error",inline:!1},{name:"발생 시각",value:new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}),inline:!0},{name:"HTTP 메소드",value:t.method||"N/A",inline:!0},{name:"API 경로",value:t.path||"N/A",inline:!1},{name:"사용자 ID",value:((a=t.userId)==null?void 0:a.toString())||"비로그인",inline:!0},{name:"사용자 타입",value:t.userType||"N/A",inline:!0},{name:"에러 스택",value:"```\n"+(((n=s.stack)==null?void 0:n.substring(0,800))||"N/A")+"\n```",inline:!1}],timestamp:new Date().toISOString(),footer:{text:"UR LIVE Error Monitoring"}}]};try{await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)}),console.log("[Discord] Error alert sent successfully")}catch(o){console.error("[Discord Webhook] Failed to send alert:",o)}}p.onError(async(e,s)=>{if(console.error("[Error]",e),s.env.DISCORD_WEBHOOK_URL)try{await Mo(s.env.DISCORD_WEBHOOK_URL,e,{method:s.req.method,path:s.req.path,userId:s.get("userId"),userType:s.get("userType")})}catch(t){console.error("[Discord] Webhook failed, but continuing:",t)}return s.json({success:!1,error:{code:e.code||"INTERNAL_ERROR",message:e.message||"서버 오류가 발생했습니다."}},e.status||500)});const kt=new er,Fo=Object.assign({"/src/index.tsx":p});let vr=!1;for(const[,e]of Object.entries(Fo))e&&(kt.route("/",e),kt.notFound(e.notFoundHandler),vr=!0);if(!vr)throw new Error("Can't import modules from ['/src/index.tsx']");let is=null;async function Ar(e,s){try{const t=e.split(".");if(t.length!==3)throw new Error("Invalid token structure");const r=JSON.parse(atob(t[0].replace(/-/g,"+").replace(/_/g,"/"))),a=JSON.parse(atob(t[1].replace(/-/g,"+").replace(/_/g,"/")));if(console.log("[Firebase JWT] Token header:",r),console.log("[Firebase JWT] Token payload (aud, iss, exp):",{aud:a.aud,iss:a.iss,exp:a.exp}),a.aud!==s)throw new Error(`Invalid audience. Expected ${s}, got ${a.aud}`);if(!a.iss||!a.iss.includes(s))throw new Error("Invalid issuer");if(a.exp<Math.floor(Date.now()/1e3))throw new Error("Token expired");return await $o(e,r.kid),console.log("[Firebase JWT] ✅ Token verified successfully"),a}catch(t){throw console.error("[Firebase JWT] ❌ Verification failed:",t),t}}async function Dr(){const e=Date.now();if(is&&is.expires>e)return is.keys;const s=await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");if(!s.ok)throw new Error("Failed to fetch public keys");const t=await s.json(),a=(s.headers.get("cache-control")||"").match(/max-age=(\d+)/),n=a?parseInt(a[1]):3600;return is={keys:Object.entries(t).map(([o,i])=>({kid:o,cert:i})),expires:e+n*1e3},is.keys}async function $o(e,s){if(!(await Dr()).find(a=>a.kid===s))throw new Error(`Public key not found for kid: ${s}`);console.log("[Firebase JWT] Public key found for kid:",s)}const Po={verifyFirebaseIdToken:Ar,getPublicKeys:Dr},Uo=Object.freeze(Object.defineProperty({__proto__:null,default:Po,verifyFirebaseIdToken:Ar},Symbol.toStringTag,{value:"Module"}));async function Or(e){try{const{to:s,subject:t,htmlContent:r,textContent:a}=e,n=await fetch("https://api.mailchannels.net/tx/v1/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:s}]}],from:{email:"noreply@live.ur-team.com",name:"리스터코퍼레이션"},subject:t,content:[{type:"text/html",value:r},...a?[{type:"text/plain",value:a}]:[]]})});if(!n.ok){const o=await n.text();return console.error("[Email] Failed to send:",n.status,o),{success:!1,error:`Email send failed: ${n.status}`}}return console.log("[Email] Successfully sent to:",s),{success:!0}}catch(s){return console.error("[Email] Exception:",s),{success:!1,error:s.message}}}async function xo(e){const{streamId:s,title:t,sellerName:r,platform:a,scheduledAt:n,status:o}=e,i=`https://live.ur-team.com/live/${s}`,c=o==="live"?"🔴 라이브 중":o==="scheduled"?"📅 예약됨":"⏸️ 대기 중",l=`
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
  `,u=`
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
  `;return Or({to:"jiwon@ur-team.com",subject:`[리스터코퍼레이션] 🎉 새 라이브 스트림 생성: ${t}`,htmlContent:l,textContent:u})}const Wo=Object.freeze(Object.defineProperty({__proto__:null,sendEmail:Or,sendLiveStreamCreatedEmail:xo},Symbol.toStringTag,{value:"Module"}));async function qo(e,s,t){const r=e.from||t||"리스터코퍼레이션 <onboarding@resend.dev>",{to:a,subject:n,html:o}=e;if(!s)return console.warn("[Email] RESEND_API_KEY not configured, skipping email"),{success:!1,error:"API key not configured"};try{console.log("[Email] Sending email:",{to:a,subject:n,from:r});const i=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${s}`,"Content-Type":"application/json"},body:JSON.stringify({from:r,to:a,subject:n,html:o})}),c=await i.json();return i.ok?(console.log("[Email] Sent successfully:",{to:a,subject:n,id:c.id}),{success:!0}):(console.error("[Email] Failed to send:",c),{success:!1,error:c.message||"Failed to send email"})}catch(i){return console.error("[Email] Error:",i),{success:!1,error:i.message}}}function Ho(e,s){return`
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
  `}const Cr=Object.freeze(Object.defineProperty({__proto__:null,getSellerApprovalEmailHTML:Ho,getSellerRejectionEmailHTML:Ko,sendEmail:qo},Symbol.toStringTag,{value:"Module"}));async function Bo(e,s){const{userId:t,type:r,title:a,message:n,linkUrl:o}=s;try{const i=await e.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(t,r,a,n,o||null).run();return console.log(`[Notification] Created for user ${t}: ${r} - ${a}`),{success:!0,id:i.meta.last_row_id}}catch(i){return console.error("[Notification] Failed to create:",i),{success:!1,error:i.message}}}const Jo={seller_approved:e=>({title:"🎉 판매자 승인 완료",message:`${e}님, 축하합니다! 리스터코퍼레이션 판매자로 승인되었습니다.`,linkUrl:"/seller"}),seller_rejected:e=>({title:"판매자 승인 거부",message:`죄송합니다. 판매자 승인이 거부되었습니다. 사유: ${e}`,linkUrl:"/seller/register"}),order_complete:e=>({title:"주문 완료",message:`주문번호 ${e}의 주문이 접수되었습니다.`,linkUrl:`/orders/${e}`}),order_shipped:e=>({title:"배송 시작",message:`주문번호 ${e}의 상품이 배송 시작되었습니다.`,linkUrl:`/orders/${e}`}),order_delivered:e=>({title:"배송 완료",message:`주문번호 ${e}의 상품이 배송 완료되었습니다.`,linkUrl:`/orders/${e}`}),refund_requested:e=>({title:"환불 요청 접수",message:`주문번호 ${e}의 환불이 접수되었습니다.`,linkUrl:`/orders/${e}`}),refund_complete:(e,s)=>({title:"환불 완료",message:`주문번호 ${e}의 환불(₩${s.toLocaleString()})이 완료되었습니다.`,linkUrl:`/orders/${e}`}),product_low_stock:(e,s)=>({title:"⚠️ 재고 부족 알림",message:`${e}의 재고가 ${s}개 남았습니다.`,linkUrl:"/seller/products"}),product_sold_out:e=>({title:"❌ 품절 알림",message:`${e}이(가) 품절되었습니다.`,linkUrl:"/seller/products"})},kr=Object.freeze(Object.defineProperty({__proto__:null,NotificationTemplates:Jo,createNotification:Bo},Symbol.toStringTag,{value:"Module"}));export{kt as default};
