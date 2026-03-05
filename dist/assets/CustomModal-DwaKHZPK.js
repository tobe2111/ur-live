import{c as u,j as e}from"./index-DXw3LVcu.js";import{b as p,k as g}from"./react-vendor-Bpsz4-Wf.js";import{X as y}from"./x-De6ewqx2.js";import{C as b}from"./circle-alert-5CwveBeA.js";import{C as j}from"./circle-check-big-BxMM5Ign.js";/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],k=u("info",w);/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],v=u("triangle-alert",N);function O({isOpen:c,onClose:t,onConfirm:n,title:l,message:i,children:s,type:a="alert",maxWidth:o="sm"}){if(!c)return null;const m=a==="confirm",d=a==="custom",x=()=>{switch(a){case"success":return e.jsx(j,{className:"w-12 h-12 text-green-500",strokeWidth:1.5});case"error":return e.jsx(b,{className:"w-12 h-12 text-red-500",strokeWidth:1.5});case"warning":return e.jsx(v,{className:"w-12 h-12 text-yellow-500",strokeWidth:1.5});case"info":return e.jsx(k,{className:"w-12 h-12 text-blue-500",strokeWidth:1.5});default:return null}},f=()=>{switch(o){case"md":return"max-w-md";case"lg":return"max-w-lg";case"xl":return"max-w-xl";default:return"max-w-sm"}},h=e.jsxs("div",{className:"fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn",onClick:r=>{r.target===r.currentTarget&&t()},children:[e.jsx("div",{className:`bg-white rounded-3xl shadow-2xl ${f()} w-full ${d?"p-0":"p-6"} animate-slideUp relative`,onClick:r=>r.stopPropagation(),children:d?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"flex items-center justify-between px-5 py-4 border-b border-gray-200",children:[e.jsx("h3",{className:"text-[17px] font-bold text-gray-900",children:l}),e.jsx("button",{onClick:t,className:"w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors",children:e.jsx(y,{className:"w-5 h-5 text-gray-500"})})]}),e.jsx("div",{className:"px-5 py-4 max-h-[70vh] overflow-y-auto",onClick:r=>r.stopPropagation(),children:s})]}):e.jsxs(e.Fragment,{children:[x()&&e.jsx("div",{className:"flex justify-center mb-4",children:x()}),l&&e.jsx("h3",{className:"text-lg font-bold text-gray-900 text-center mb-2",children:l}),s?e.jsx("div",{className:"mb-6",children:s}):i?e.jsx("p",{className:"text-sm text-gray-600 text-center mb-6 leading-relaxed whitespace-pre-line",children:i}):null,e.jsx("div",{className:`flex gap-3 ${m?"flex-row":"flex-col"}`,children:m?e.jsxs(e.Fragment,{children:[e.jsx("button",{onClick:t,className:"flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-full hover:bg-gray-200 transition-colors text-sm",children:"취소"}),e.jsx("button",{onClick:()=>{n==null||n(),t()},className:"flex-1 py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm",children:"확인"})]}):e.jsx("button",{onClick:t,className:"w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm",children:"확인"})})]})}),e.jsx("style",{children:`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `})]});return g.createPortal(h,document.body)}function U(){const[c,t]=p.useState({isOpen:!1,message:""});return{modal:c,showAlert:(s,a="alert",o)=>{t({isOpen:!0,title:o,message:s,type:a})},showConfirm:(s,a,o)=>{t({isOpen:!0,title:o,message:s,type:"confirm",onConfirm:a})},closeModal:()=>{t({isOpen:!1,message:""})}}}export{O as C,k as I,U as u};
//# sourceMappingURL=CustomModal-DwaKHZPK.js.map
