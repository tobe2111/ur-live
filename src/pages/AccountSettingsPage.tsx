import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, User, Mail, Phone, Lock, Bell, Shield, CreditCard,
  MapPin, Globe, HelpCircle, ChevronRight, Edit, X, Eye, EyeOff, Check,
} from 'lucide-react';
import { getUserIdSync, getUserNameSync, getUserEmail } from '@/utils/auth';
import api from '@/lib/api';
import { toast } from '@/hooks/useToast';

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ id: '', name: '', email: '', phone: '' });

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [editLoading, setEditLoading] = useState(false);

  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

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
    } catch (e: any) {
      toast.error(e.response?.data?.error || '업데이트에 실패했습니다.');
    } finally { setEditLoading(false); }
  }

  async function changePassword() {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) { toast.error('모든 항목을 입력해주세요.'); return; }
    if (pwForm.next.length < 8) { toast.error('새 비밀번호는 8자 이상이어야 합니다.'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('새 비밀번호가 일치하지 않습니다.'); return; }
    setPwLoading(true);
    try {
      const res = await api.post('/api/auth/change-password', { current_password: pwForm.current, new_password: pwForm.next });
      if (res.data.success) {
        setPwModal(false); setPwForm({ current: '', next: '', confirm: '' });
        toast.success('비밀번호가 변경되었습니다.');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || '비밀번호 변경에 실패했습니다.');
    } finally { setPwLoading(false); }
  }

  function toggleNotif(key: 'push' | 'email') {
    const next = { ...notif, [key]: !notif[key] };
    setNotif(next);
    localStorage.setItem('notif_settings', JSON.stringify(next));
    toast.success(`${key === 'push' ? '푸시' : '이메일'} 알림이 ${next[key] ? '켜졌' : '꺼졌'}습니다.`);
  }

  return (
    <div className="bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-gray-700 hover:text-gray-900">
            <ChevronLeft className="w-6 h-6" /><span className="ml-1">뒤로</span>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">계정 설정</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="px-4 py-6 pb-32">
        {/* 프로필 */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">내 프로필</h2>
            <button onClick={openEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg shadow-sm hover:shadow transition-shadow text-sm font-medium text-gray-700">
              <Edit className="w-4 h-4" />수정
            </button>
          </div>
          <div className="space-y-3">
            {[
              { icon: <User className="w-5 h-5 text-purple-500" />, label: '이름', value: user.name },
              { icon: <Mail className="w-5 h-5 text-purple-500" />, label: '이메일', value: user.email },
              { icon: <Phone className="w-5 h-5 text-purple-500" />, label: '전화번호', value: user.phone || '미등록' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center space-x-3 bg-white rounded-xl p-3">
                {icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-medium text-gray-900 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Section title="보안">
          <Item icon={<Lock className="w-5 h-5" />} label="비밀번호 변경" onClick={() => setPwModal(true)} />
          <Item icon={<Shield className="w-5 h-5" />} label="2단계 인증" onClick={() => toast.info('준비 중인 기능입니다.')} badge="준비중" />
        </Section>

        <Section title="알림">
          <ToggleItem icon={<Bell className="w-5 h-5" />} label="푸시 알림" value={notif.push} onChange={() => toggleNotif('push')} />
          <ToggleItem icon={<Mail className="w-5 h-5" />} label="이메일 알림" value={notif.email} onChange={() => toggleNotif('email')} />
        </Section>

        <Section title="결제 및 배송">
          <Link to="/mypage/addresses" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3"><MapPin className="w-5 h-5 text-gray-600" /><span className="text-gray-900">배송지 관리</span></div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Item icon={<CreditCard className="w-5 h-5" />} label="결제 수단 관리" onClick={() => toast.info('준비 중인 기능입니다.')} badge="준비중" />
        </Section>

        <Section title="기타">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3"><Globe className="w-5 h-5 text-gray-600" /><span className="text-gray-900">언어 설정</span></div>
            <span className="text-sm text-gray-500">한국어</span>
          </div>
          <Link to="/faq" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3"><HelpCircle className="w-5 h-5 text-gray-600" /><span className="text-gray-900">고객센터</span></div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </Section>

        <Section title="약관 및 정책">
          <Link to="/privacy" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <span className="text-gray-900">개인정보 처리방침</span><ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Link to="/terms" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <span className="text-gray-900">이용약관</span><ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Link to="/refund" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <span className="text-gray-900">배송 및 환불 정책</span><ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </Section>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">앱 정보</h3>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-600">버전</span><span className="font-medium text-gray-900">1.0.0</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">최신 버전</span><span className="text-green-600 font-medium">사용 중</span></div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <Link to="/account/delete-warning" className="text-xs text-gray-400 hover:text-gray-600 underline">회원 탈퇴</Link>
        </div>
      </main>

      {/* 프로필 편집 모달 */}
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

      {/* 비밀번호 변경 모달 */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">비밀번호 변경</h3>
              <button onClick={() => { setPwModal(false); setPwForm({ current: '', next: '', confirm: '' }); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              {([
                { key: 'current' as const, label: '현재 비밀번호', showKey: 'current' as const },
                { key: 'next' as const, label: '새 비밀번호 (8자 이상)', showKey: 'next' as const },
                { key: 'confirm' as const, label: '새 비밀번호 확인', showKey: 'confirm' as const },
              ]).map(({ key, label, showKey }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <div className="relative">
                    <input type={showPw[showKey] ? 'text' : 'password'} value={pwForm[key]}
                      onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                    <button type="button" onClick={() => setShowPw(s => ({ ...s, [showKey]: !s[showKey] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw[showKey] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {key === 'confirm' && pwForm.confirm && pwForm.next && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${pwForm.next === pwForm.confirm ? 'text-green-600' : 'text-red-500'}`}>
                      {pwForm.next === pwForm.confirm ? <><Check className="w-3 h-3" />일치합니다</> : '비밀번호가 일치하지 않습니다'}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setPwModal(false); setPwForm({ current: '', next: '', confirm: '' }); }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors">취소</button>
              <button onClick={changePassword} disabled={pwLoading}
                className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                {pwLoading ? '변경 중...' : '변경'}
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
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function Item({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
      <div className="flex items-center space-x-3">
        <span className="text-gray-600">{icon}</span>
        <span className="text-gray-900">{label}</span>
        {badge && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </button>
  );
}

function ToggleItem({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center space-x-3">
        <span className="text-gray-600">{icon}</span>
        <span className="text-gray-900">{label}</span>
      </div>
      <button onClick={onChange} className={`relative w-[44px] h-[24px] rounded-full transition-colors duration-200 shrink-0 ${value ? 'bg-blue-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
