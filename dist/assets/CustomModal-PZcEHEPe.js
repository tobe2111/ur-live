import{r as h,b4 as g,j as e,X as p,ad as y,b5 as b,a0 as j,ae as w}from"./vendor-Be5lhO-3.js";function k({isOpen:i,onClose:t,onConfirm:n,title:o,message:c,children:s,type:a="alert",maxWidth:l="sm"}){if(!i)return null;const x=a==="confirm",m=a==="custom",d=()=>{switch(a){case"success":return e.jsx(w,{className:"w-12 h-12 text-green-500",strokeWidth:1.5});case"error":return e.jsx(j,{className:"w-12 h-12 text-red-500",strokeWidth:1.5});case"warning":return e.jsx(b,{className:"w-12 h-12 text-yellow-500",strokeWidth:1.5});case"info":return e.jsx(y,{className:"w-12 h-12 text-blue-500",strokeWidth:1.5});default:return null}},u=()=>{switch(l){case"md":return"max-w-md";case"lg":return"max-w-lg";case"xl":return"max-w-xl";default:return"max-w-sm"}},f=e.jsxs("div",{className:"fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn",onClick:r=>{r.target===r.currentTarget&&t()},children:[e.jsx("div",{className:`bg-white rounded-3xl shadow-2xl ${u()} w-full ${m?"p-0":"p-6"} animate-slideUp relative`,onClick:r=>r.stopPropagation(),children:m?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"flex items-center justify-between px-5 py-4 border-b border-gray-200",children:[e.jsx("h3",{className:"text-[17px] font-bold text-gray-900",children:o}),e.jsx("button",{onClick:t,className:"w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors",children:e.jsx(p,{className:"w-5 h-5 text-gray-500"})})]}),e.jsx("div",{className:"px-5 py-4 max-h-[70vh] overflow-y-auto",onClick:r=>r.stopPropagation(),children:s})]}):e.jsxs(e.Fragment,{children:[d()&&e.jsx("div",{className:"flex justify-center mb-4",children:d()}),o&&e.jsx("h3",{className:"text-lg font-bold text-gray-900 text-center mb-2",children:o}),s?e.jsx("div",{className:"mb-6",children:s}):c?e.jsx("p",{className:"text-sm text-gray-600 text-center mb-6 leading-relaxed whitespace-pre-line",children:c}):null,e.jsx("div",{className:`flex gap-3 ${x?"flex-row":"flex-col"}`,children:x?e.jsxs(e.Fragment,{children:[e.jsx("button",{onClick:t,className:"flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-full hover:bg-gray-200 transition-colors text-sm",children:"취소"}),e.jsx("button",{onClick:()=>{n==null||n(),t()},className:"flex-1 py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm",children:"확인"})]}):e.jsx("button",{onClick:t,className:"w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm",children:"확인"})})]})}),e.jsx("style",{children:`
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
      `})]});return g.createPortal(f,document.body)}function v(){const[i,t]=h.useState({isOpen:!1,message:""});return{modal:i,showAlert:(s,a="alert",l)=>{t({isOpen:!0,title:l,message:s,type:a})},showConfirm:(s,a,l)=>{t({isOpen:!0,title:l,message:s,type:"confirm",onConfirm:a})},closeModal:()=>{t({isOpen:!1,message:""})}}}export{k as C,v as u};
//# sourceMappingURL=CustomModal-PZcEHEPe.js.map
