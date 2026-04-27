import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'security_relogin_2026_04_27_dismissed';

function hasAnyAuthTrace(): boolean {
  return [
    'user_type', 'user_id', 'user_session',
    'kakao_token', 'firebase_token',
    'seller_token', 'admin_token', 'agency_token',
  ].some((k) => localStorage.getItem(k));
}

export default function SecurityReloginBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true';
    if (dismissed) return;
    if (!hasAnyAuthTrace()) return;
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[9998] bg-blue-600 text-white rounded-xl shadow-2xl p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm mb-1">🔒 보안 업데이트 안내</p>
        <p className="text-xs leading-relaxed text-blue-50">
          보안 강화를 위해 인증 키가 갱신되었습니다.
          이전 로그인이 만료되었으니 다시 로그인해주세요.
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="닫기"
        className="flex-shrink-0 -m-1 p-1 hover:bg-blue-700 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
