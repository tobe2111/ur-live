/**
 * 개인정보 처리방침 — 인스타그램 연결(댓글 자동 DM) 문단.
 *
 * 메타 앱 심사가 요구하는 것 셋을 한 자리에 둔다:
 *   ① 무엇을 수집하나 ② 얼마나 보관하나 ③ 어떻게 지우나(+ 데이터 삭제 콜백의 상태 확인 주소).
 * 데이터 삭제 콜백(`/api/instagram/oauth/data-deletion`)은 삭제를 동기로 끝낸 뒤
 * `/privacy?ig_deletion=<코드>#instagram` 을 돌려준다 — 그 코드를 여기서 "완료"와 함께 보여 준다.
 *
 * 심사관은 대개 영어로 읽는다. 사이트는 국내 지역이라 한국어 본문이 뜨므로, 이 문단만 영어 요약을 함께 싣는다.
 */
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

const DELETION_CODE_RE = /^ig-[A-Za-z0-9-]{1,40}$/

export default function InstagramConnectSection({ number }: { number?: string }) {
  const [params] = useSearchParams()
  const raw = params.get('ig_deletion') || ''
  const code = DELETION_CODE_RE.test(raw) ? raw : null

  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#instagram') return
    document.getElementById('instagram')?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <section id="instagram" className="border-t border-rule pt-6 mt-6 scroll-mt-20">
      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">
        {number ? `${number}. ` : ''}인스타그램 연결 (댓글 자동 DM) / Instagram connection
      </h2>

      {code && (
        <div className="mb-4 rounded-lg bg-tone-ok-bg p-4 text-[13px] text-tone-ok">
          <p className="font-semibold">삭제가 완료되었습니다 (Deletion completed)</p>
          <p className="mt-1">확인 코드 (Confirmation code): <span className="font-semibold tabular-nums">{code}</span></p>
        </div>
      )}

      <div className="space-y-3 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
        <p>
          사업자 유저(매장)와 그 매장을 대신 운영하는 중개사가 자기 인스타그램 비즈니스·크리에이터 계정을 유어딜에 연결하면,
          정해 둔 키워드로 댓글을 단 사람에게 링크를 담은 메시지를 한 번 보냅니다(댓글 1개당 1통, 댓글 후 7일 이내).
        </p>

        <div className="bg-warm rounded-lg p-4 space-y-1">
          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">① 처리하는 항목</h3>
          <p>연결한 계정: 인스타그램 계정 ID, 아이디(@), 접근 토큰(암호화 저장), 토큰 만료일</p>
          <p>댓글을 단 사람: 인스타그램 사용자 ID, 아이디(@), 댓글 ID, 댓글 내용 앞부분(최대 200자), 게시물 ID</p>
          <p>발송 기록: 보낸 시각, 적용된 규칙, 성공·실패 여부와 실패 사유</p>
        </div>

        <div className="bg-warm rounded-lg p-4 space-y-1">
          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">② 목적과 보관 기간</h3>
          <p>같은 댓글에 두 번 보내지 않기, 하루 발송 상한 지키기, 매장에 발송 결과 보여 주기에만 씁니다.
            광고, 추적, 제3자 제공에는 쓰지 않습니다.</p>
          <p>발송 기록은 90일이 지나면 파기합니다. 연결을 해제하면 접근 토큰과 발송 기록을 즉시 파기하고,
            매장이 만든 키워드 규칙만 다시 연결할 때를 위해 남깁니다. 삭제를 요청하면 규칙까지 모두 파기합니다.</p>
        </div>

        <div className="bg-warm rounded-lg p-4 space-y-1">
          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">③ 삭제하는 방법</h3>
          <p>매장: 마이 → 전체 도구 → 인스타 자동 DM 에서 「연결 해제」.</p>
          <p>누구나: 인스타그램 설정의 웹사이트 권한(앱 및 웹사이트)에서 유어딜을 삭제하면 연결이 해제되고,
            삭제를 요청하면 그 계정의 규칙, 발송 기록, 토큰이 자동으로 모두 지워집니다. 이메일(jiwon@ur-team.com)로 요청해도 됩니다.</p>
        </div>

        <p className="text-gray-500 dark:text-gray-400">
          <span className="font-semibold">English summary.</span> When a business connects its Instagram professional account,
          UrDeal stores that account&apos;s ID, username and an encrypted access token, and, for each comment that matches a keyword,
          the commenter&apos;s Instagram user ID, username, comment ID, the first 200 characters of the comment and a send log.
          This data is used only to send one reply per comment and to show the business its send results. It is never sold,
          shared or used for advertising. Send logs are deleted after 90 days. Disconnecting deletes the token and send logs
          at once; a data deletion request (from Instagram &rarr; Settings &rarr; Website permissions, or by emailing
          jiwon@ur-team.com) deletes everything, including the business&apos;s keyword rules.
        </p>
      </div>
    </section>
  )
}
