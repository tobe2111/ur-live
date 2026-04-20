import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, User, Mail, Phone, Bell, CreditCard,
  MapPin, Globe, HelpCircle, ChevronRight, Edit, X,
} from 'lucide-react';
import { getUserIdSync, getUserNameSync, getUserEmail } from '@/utils/auth';
import api from '@/lib/api';
import SEO from '@/components/SEO';
import { toast } from '@/hooks/useToast';

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ id: '', name: '', email: '', phone: '' });

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [editLoading, setEditLoading] = useState(false);


  const [notif, setNotif] = useState(() => {
    try {
      const s = localStorage.getItem('notif_settings');
      return s ? JSON.parse(s) : { push: true, email: true };
    } catch { return { push: true, email: true }; }
  });

  useEffect(() => {
    const userId = getUserIdSync();
    if (!userId) { toast.info('로그인이 필요합니다.'); navigate('/login'); return; }
    (async () => {
      let phone = '';
      try {
        const res = await api.get('/api/auth/me');
        if (res.data.success && res.data.data) phone = res.data.data.phone || '';
      } catch {}
      setUser({ id: userId, name: getUserNameSync() || '사용자', email: getUserEmail() || '', phone });
    })();
  }, [navigate]);

  function openEdit() { setEditForm({ name: user.name, phone: user.phone }); setEditModal(true); }

  async function saveProfile() {
    if (!editForm.name.trim()) { toast.error('이름을 입력해주세요.'); return; }
    setEditLoading(true);
    try {
      const res = await api.patch('/api/auth/profile', { name: editForm.name.trim(), phone: editForm.phone.trim() });
      if (res.data.success) {
        setUser(u => ({ ...u, name: editForm.name.trim(), phone: editForm.phone.trim() }));
        localStorage.setItem('user_name', editForm.name.trim());
        setEditModal(false);
        toast.success('프로필이 업데이트되었습니다.');
      }
    } catch (e: unknown) {
      const e_ = e as { response?: { data?: { error?: string }; status?: number } }
      toast.error(e_.response?.data?.error || '업데이트에 실패했습니다.');
    } finally { setEditLoading(false); }
  }

  function toggleNotif(key: 'push' | 'email') {
    const next = { ...notif, [key]: !notif[key] };
    setNotif(next);
    localStorage.setItem('notif_settings', JSON.stringify(next));
    toast.success(`${key === 'push' ? '푸시' : '이메일'} 알림이 ${next[key] ? '켜졌' : '꺼졌'}습니다.`);
  }

  return (
    <div className="min-h-screen bg-[#020202]">
      <SEO
        title="계정 설정"
        description="프로필, 알림, 결제 수단 등 계정 설정을 관리하세요."
        url="/account/settings"
      />
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#020202]/90 backdrop-blur border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-[15px]">계정 설정</h1>
          <div className="w-6" />
        </div>
      </div>

      <main className="px-4 py-6 pb-32">
        {/* 프로필 */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">내 프로필</h2>
            <button onClick={openEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg transition-colors text-sm font-medium text-gray-300 hover:bg-[#2A2A2A]">
              <Edit className="w-4 h-4" />수정
            </button>
          </div>
          <div className="space-y-3">
            {[
              { icon: <User className="w-5 h-5 text-pink-400" />, label: '이름', value: user.name },
              { icon: <Mail className="w-5 h-5 text-pink-400" />, label: '이메일', value: user.email },
              { icon: <Phone className="w-5 h-5 text-pink-400" />, label: '전화번호', value: user.phone || '미등록' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center space-x-3 bg-[#1A1A1A] rounded-xl p-3">
                {icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-medium text-white truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Section title="알림">
          <ToggleItem icon={<Bell className="w-5 h-5" />} label="푸시 알림" value={notif.push} onChange={() => toggleNotif('push')} />
          <ToggleItem icon={<Mail className="w-5 h-5" />} label="이메일 알림" value={notif.email} onChange={() => toggleNotif('email')} />
        </Section>

        <Section title="결제 및 배송">
          <Link to="/mypage/addresses" className="flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors">
            <div className="flex items-center space-x-3"><MapPin className="w-5 h-5 text-gray-400" /><span className="text-gray-300">배송지 관리</span></div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </Link>
          <Item icon={<CreditCard className="w-5 h-5" />} label="결제 수단 관리" onClick={() => toast.info('준비 중인 기능입니다.')} badge="준비중" />
        </Section>

        <Section title="기타">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3"><Globe className="w-5 h-5 text-gray-400" /><span className="text-gray-300">언어 설정</span></div>
            <span className="text-sm text-gray-500">한국어</span>
          </div>
          <Link to="/faq" className="flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors">
            <div className="flex items-center space-x-3"><HelpCircle className="w-5 h-5 text-gray-400" /><span className="text-gray-300">고객센터</span></div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </Link>
        </Section>

        <Section title="약관 및 정책">
          <Link to="/privacy" className="flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors">
            <span className="text-gray-300">개인정보 처리방침</span><ChevronRight className="w-5 h-5 text-gray-500" />
          </Link>
          <Link to="/terms" className="flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors">
            <span className="text-gray-300">이용약관</span><ChevronRight className="w-5 h-5 text-gray-500" />
          </Link>
          <Link to="/refund" className="flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors">
            <span className="text-gray-300">배송 및 환불 정책</span><ChevronRight className="w-5 h-5 text-gray-500" />
          </Link>
        </Section>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">앱 정보</h3>
          <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-400">버전</span><span className="font-medium text-white">1.0.0</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">최신 버전</span><span className="text-green-400 font-medium">사용 중</span></div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-[#1A1A1A] text-center">
          <Link to="/account/delete-warning" className="text-xs text-gray-500 hover:text-gray-400 underline">회원 탈퇴</Link>
        </div>
      </main>

      {/* 프로필 편집 모달 — stays white for readability */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">프로필 수정</h3>
              <button onClick={() => setEditModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 <span className="text-red-500">*</span></label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="이름을 입력하세요" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">전화번호</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="010-0000-0000" type="tel" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors">취소</button>
              <button onClick={saveProfile} disabled={editLoading} className="flex-1 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50">
                {editLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">{title}</h3>
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl overflow-hidden divide-y divide-[#1A1A1A]">{children}</div>
    </div>
  );
}

function Item({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors text-left">
      <div className="flex items-center space-x-3">
        <span className="text-gray-400">{icon}</span>
        <span className="text-gray-300">{label}</span>
        {badge && <span className="text-xs bg-[#1A1A1A] text-gray-500 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
    </button>
  );
}

function ToggleItem({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center space-x-3">
        <span className="text-gray-400">{icon}</span>
        <span className="text-gray-300">{label}</span>
      </div>
      <button onClick={onChange} className={`relative w-[44px] h-[24px] rounded-full transition-colors duration-200 shrink-0 ${value ? 'bg-pink-500' : 'bg-gray-600'}`}>
        <span className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
