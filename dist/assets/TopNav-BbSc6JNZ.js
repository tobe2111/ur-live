import{c as i,j as e,u as d}from"./index-DXw3LVcu.js";import{c as h,b as m}from"./react-vendor-Bpsz4-Wf.js";import{B as g}from"./button-5Z19NGgr.js";import{u}from"./useTranslation-2Dzffr6p.js";import{G as x}from"./globe-zrbTlJBr.js";import{S as b}from"./search-DqFJOK2O.js";import{B as f}from"./bell-Bm8xdNY2.js";import{U as p}from"./user-C5G0Qtu1.js";/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=[["path",{d:"M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z",key:"oz39mx"}]],U=i("bookmark",j);/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]],N=i("menu",k);function v(){const{i18n:s}=u(),r=[{code:"ko",label:"한국어",flag:"🇰🇷"},{code:"en",label:"English",flag:"🇺🇸"}],l=s.language||"en",t=r.find(a=>a.code===l)||r[0],o=a=>{s.changeLanguage(a),localStorage.setItem("i18nextLng",a)};return e.jsxs("div",{className:"relative group",children:[e.jsxs(g,{variant:"ghost",size:"sm",className:"gap-2 h-10",children:[e.jsx(x,{className:"h-4 w-4"}),e.jsx("span",{className:"hidden sm:inline",children:t.label}),e.jsx("span",{className:"inline sm:hidden",children:t.flag})]}),e.jsx("div",{className:"absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50",children:r.map(a=>e.jsxs("button",{onClick:()=>o(a.code),className:`
              block w-full text-left px-4 py-2 first:rounded-t-md last:rounded-b-md
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
              ${l===a.code?"bg-gray-50 dark:bg-gray-700 font-semibold":""}
            `,children:[e.jsx("span",{className:"mr-2",children:a.flag}),a.label]},a.code))})]})}function E(){const s=h(),{isLoggedIn:r}=d(),[l,t]=m.useState(!1),o=()=>{s(r?"/user/profile":"/login?returnUrl=/user/profile")},a=()=>{s("/search")},c=()=>{r?(console.log("알림 클릭"),alert("알림 기능은 준비 중입니다.")):s("/login?returnUrl=/")};return e.jsxs(e.Fragment,{children:[e.jsx("header",{className:"sticky top-0 z-50 w-full bg-background border-b border-border",children:e.jsx("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",children:e.jsxs("div",{className:"flex items-center justify-between h-16",children:[e.jsx("button",{onClick:()=>t(!l),"aria-label":"Open menu",className:"p-1 text-foreground",children:e.jsx(N,{className:"h-6 w-6",strokeWidth:1.5})}),e.jsxs("h1",{className:"text-xl font-extrabold tracking-tighter text-foreground uppercase",children:["UR ",e.jsx("span",{className:"text-accent-foreground",style:{color:"#ef4444"},children:"LIVE"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(v,{}),e.jsx("button",{onClick:a,"aria-label":"Search",className:"p-1 text-foreground hover:text-gray-600 transition-colors",children:e.jsx(b,{className:"h-5 w-5",strokeWidth:1.5})}),e.jsxs("button",{onClick:c,"aria-label":"Notifications",className:"relative p-1 text-foreground hover:text-gray-600 transition-colors",children:[e.jsx(f,{className:"h-5 w-5",strokeWidth:1.5}),e.jsx("span",{className:"absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500"})]}),e.jsx("button",{onClick:o,"aria-label":"Profile",className:"p-1 text-foreground hover:text-gray-600 transition-colors",children:e.jsx(p,{className:"h-5 w-5",strokeWidth:1.5})})]})]})})}),l&&e.jsxs("div",{className:"fixed inset-0 z-[60]",children:[e.jsx("div",{className:"absolute inset-0 bg-black/40",onClick:()=>t(!1)}),e.jsxs("nav",{className:"absolute left-0 top-0 h-full w-72 bg-background p-6 shadow-lg animate-slide-in-left",children:[e.jsx("button",{onClick:()=>t(!1),className:"mb-8 text-sm text-muted-foreground hover:text-foreground transition-colors","aria-label":"Close menu",children:"닫기"}),e.jsx("ul",{className:"flex flex-col gap-5",children:[{label:"Home",path:"/"},{label:"Shop",path:"/browse"},{label:"Live",path:"/live/1"},{label:"My Page",path:"/user/profile"},{label:"Cart",path:"/cart"},{label:"Orders",path:"/my-orders"}].map(n=>e.jsx("li",{children:e.jsx("button",{onClick:()=>{s(n.path),t(!1)},className:"text-base font-semibold text-foreground hover:text-red-500 transition-colors",children:n.label})},n.label))})]})]}),e.jsx("style",{children:`
        @keyframes slide-in-left {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.3s ease-out;
        }
      `})]})}export{U as B,E as T};
//# sourceMappingURL=TopNav-BbSc6JNZ.js.map
