/**
 * 알림톡 발송 페이지
 * 
 * 기능:
 * - 템플릿 선택
 * - 변수 입력
 * - 수신자 관리 (직접 입력/CSV 업로드)
 * - 미리보기
 * - 발송
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { 
  Send, 
  ArrowLeft, 
  Upload, 
  Eye, 
  Trash2,
  Plus,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'

interface Template {
  id: number
  template_code: string
  template_name: string
  template_content: string
  status: string
}

interface Recipient {
  phone: string
  name?: string
  variables?: Record<string, string>
}

interface Variable {
  name: string
  value: string
}

export default function AlimtalkSendPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [variables, setVariables] = useState<Variable[]>([])
  const [preview, setPreview] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [sendResult, setSendResult] = useState<any>(null)

  // 새 수신자 입력 폼
  const [newPhone, setNewPhone] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    if (selectedTemplate) {
      extractVariables()
      updatePreview()
    }
  }, [selectedTemplate, variables])

  async function loadTemplates() {
    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      const res = await api.get('/api/seller/alimtalk/templates', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      
      // approved된 템플릿만 표시
      const approved = res.data.data.filter((t: Template) => t.status === 'approved')
      setTemplates(approved)
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  function extractVariables() {
    if (!selectedTemplate) return

    const matches = Array.from(
      selectedTemplate.template_content.matchAll(/#{(\w+)}/g),
      match => match[1]
    )

    const uniqueVars = Array.from(new Set(matches))
    setVariables(uniqueVars.map(name => ({ name, value: '' })))
  }

  async function updatePreview() {
    if (!selectedTemplate) return

    const variablesObj = variables.reduce((acc, v) => ({
      ...acc,
      [v.name]: v.value || `[${v.name}]`
    }), {})

    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      const sellerId = localStorage.getItem('seller_id')

      const res = await api.post(
        `/api/seller/alimtalk/templates/${selectedTemplate.id}/preview`,
        { variables: variablesObj },
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'X-Seller-ID': sellerId
          }
        }
      )

      setPreview(res.data.data.preview)
    } catch (err) {
      console.error('Failed to get preview:', err)
    }
  }

  function addRecipient() {
    if (!newPhone) {
      alert('전화번호를 입력하세요')
      return
    }

    // 전화번호 형식 검증
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/
    if (!phoneRegex.test(newPhone.replace(/-/g, ''))) {
      alert('올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)')
      return
    }

    const formattedPhone = newPhone.replace(/-/g, '')
    
    // 중복 확인
    if (recipients.find(r => r.phone === formattedPhone)) {
      alert('이미 추가된 전화번호입니다')
      return
    }

    setRecipients([...recipients, {
      phone: formattedPhone,
      name: newName
    }])

    setNewPhone('')
    setNewName('')
  }

  function removeRecipient(phone: string) {
    setRecipients(recipients.filter(r => r.phone !== phone))
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      
      // CSV 파싱 (phone,name 형식)
      const newRecipients: Recipient[] = []
      
      for (let i = 1; i < lines.length; i++) { // 첫 줄은 헤더
        const [phone, name] = lines[i].split(',').map(s => s.trim())
        
        if (phone) {
          const formattedPhone = phone.replace(/-/g, '')
          if (!recipients.find(r => r.phone === formattedPhone) && 
              !newRecipients.find(r => r.phone === formattedPhone)) {
            newRecipients.push({ phone: formattedPhone, name })
          }
        }
      }

      setRecipients([...recipients, ...newRecipients])
      alert(`${newRecipients.length}명의 수신자를 추가했습니다`)
    }

    reader.readAsText(file)
  }

  async function sendAlimtalk() {
    if (!selectedTemplate) {
      alert('템플릿을 선택하세요')
      return
    }

    if (recipients.length === 0) {
      alert('수신자를 추가하세요')
      return
    }

    // 변수 값 확인
    const emptyVars = variables.filter(v => !v.value)
    if (emptyVars.length > 0) {
      alert(`다음 변수를 입력하세요: ${emptyVars.map(v => v.name).join(', ')}`)
      return
    }

    const unitCost = 15
    const totalCost = recipients.length * unitCost

    if (!confirm(
      `총 ${recipients.length}명에게 발송합니다.\n` +
      `예상 차감 포인트: ${totalCost}원\n` +
      `계속하시겠습니까?`
    )) {
      return
    }

    setLoading(true)
    setSendResult(null)

    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      const sellerId = localStorage.getItem('seller_id')

      const variablesObj = variables.reduce((acc, v) => ({
        ...acc,
        [v.name]: v.value
      }), {})

      const res = await api.post('/api/seller/alimtalk/send', {
        templateId: selectedTemplate.id,
        recipients: recipients,
        variables: variablesObj
      }, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-Seller-ID': sellerId
        }
      })

      setSendResult(res.data)
      
      if (res.data.success) {
        alert(
          `발송 완료!\n` +
          `성공: ${res.data.data.sent}건\n` +
          `실패: ${res.data.data.failed}건\n` +
          `환불: ${res.data.data.refunded}원`
        )
        
        // 성공 시 초기화
        setRecipients([])
        setVariables([])
        setSelectedTemplate(null)
      } else {
        alert(`발송 실패: ${res.data.error}`)
      }
    } catch (err: any) {
      console.error('Failed to send alimtalk:', err)
      alert(`발송 실패: ${err.response?.data?.error || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/seller/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">알림톡 발송</h1>
              <p className="text-sm text-gray-500">템플릿 선택 후 발송하세요</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 좌측: 발송 설정 */}
          <div className="space-y-6">
            {/* 1. 템플릿 선택 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                1. 템플릿 선택
              </h2>
              
              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => {
                  const template = templates.find(t => t.id === parseInt(e.target.value))
                  setSelectedTemplate(template || null)
                }}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">-- 템플릿 선택 --</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.template_name} ({template.template_code})
                  </option>
                ))}
              </select>

              {selectedTemplate && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {selectedTemplate.template_content}
                  </p>
                </div>
              )}
            </div>

            {/* 2. 변수 입력 */}
            {selectedTemplate && variables.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  2. 변수 입력
                </h2>

                <div className="space-y-3">
                  {variables.map((variable, index) => (
                    <div key={variable.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        #{'{' + variable.name + '}'}
                      </label>
                      <input
                        type="text"
                        value={variable.value}
                        onChange={(e) => {
                          const updated = [...variables]
                          updated[index].value = e.target.value
                          setVariables(updated)
                        }}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder={`${variable.name} 입력`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. 수신자 추가 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                3. 수신자 추가
              </h2>

              {/* 직접 입력 */}
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className="px-4 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="이름 (선택)"
                    className="px-4 py-2 border rounded-lg"
                  />
                </div>
                <button
                  onClick={addRecipient}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  수신자 추가
                </button>
              </div>

              {/* CSV 업로드 */}
              <div className="border-t pt-4">
                <label className="block">
                  <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 text-center">
                    <Upload className="w-5 h-5 inline mr-2" />
                    CSV 파일로 대량 추가
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  * CSV 형식: phone,name (첫 줄은 헤더)
                </p>
              </div>

              {/* 수신자 목록 */}
              {recipients.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    수신자 목록 ({recipients.length}명)
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {recipients.map((recipient) => (
                      <div
                        key={recipient.phone}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="text-sm">
                          <span className="font-medium">{recipient.phone}</span>
                          {recipient.name && (
                            <span className="text-gray-500 ml-2">({recipient.name})</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeRecipient(recipient.phone)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 미리보기 & 발송 */}
          <div className="space-y-6">
            {/* 미리보기 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                미리보기
              </h2>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="mb-2 pb-2 border-b border-yellow-300">
                  <p className="text-xs font-medium text-yellow-800">카카오톡 알림톡</p>
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {preview || '템플릿을 선택하고 변수를 입력하세요'}
                </div>
              </div>

              {selectedTemplate && (
                <div className="mt-4 text-xs text-gray-500 space-y-1">
                  <p>• 템플릿: {selectedTemplate.template_name}</p>
                  <p>• 템플릿 코드: {selectedTemplate.template_code}</p>
                  <p>• 수신자 수: {recipients.length}명</p>
                  <p>• 예상 비용: {recipients.length * 15}원 (건당 15원)</p>
                </div>
              )}
            </div>

            {/* 발송 버튼 */}
            <div className="bg-white rounded-lg shadow p-6">
              <button
                onClick={sendAlimtalk}
                disabled={!selectedTemplate || recipients.length === 0 || loading}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    알림톡 발송
                  </>
                )}
              </button>

              <div className="mt-4 text-sm text-gray-500 space-y-1">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>발송 전 잔액이 충분한지 확인하세요</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>실패한 발송 건은 자동으로 포인트가 환불됩니다</p>
                </div>
              </div>
            </div>

            {/* 발송 결과 */}
            {sendResult && (
              <div className={`p-4 rounded-lg ${sendResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {sendResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <p className="font-semibold">
                    {sendResult.success ? '발송 완료' : '발송 실패'}
                  </p>
                </div>

                {sendResult.success && (
                  <div className="text-sm space-y-1">
                    <p>• 성공: {sendResult.data.sent}건</p>
                    <p>• 실패: {sendResult.data.failed}건</p>
                    <p>• 환불: {sendResult.data.refunded}원</p>
                  </div>
                )}

                {sendResult.error && (
                  <p className="text-sm text-red-600">{sendResult.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
