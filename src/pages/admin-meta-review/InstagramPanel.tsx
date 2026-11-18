/**
 * 🎬 인스타(페이스북 로그인) 시연 —
 *   해시태그 검색(Instagram Public Content Access) → 인플루언서 프로필 확인(business_discovery, instagram_basic)
 *   → 제휴 제안 DM 초안(사람 승인 후 발송, instagram_manage_messages)
 *   + 내 게시물 댓글에 답하기(instagram_manage_comments).
 * 🔒 인스타는 먼저 대화를 건 사람에게만 DM 을 보낼 수 있다 — 그래서 초안은 "받은 대화함"에서 고른 상대에게만 나간다.
 * ⚠️ 라이트 대시보드 — dark: variant 금지.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Loader2, Search } from 'lucide-react'
import { ApprovalSend, BASE, Empty, PostRow, Section, apiErr, field, getData } from './shared'

const when = (t?: string) => (t ? new Date(t).toLocaleString('ko-KR') : '')
export const outreachDraft = (u: string) =>
  `안녕하세요 @${u}님, 유어딜(urdeal.kr) 팀입니다. 올려 주신 동네 맛집 콘텐츠를 보고 연락드려요. 유어딜에서 할인 이용권을 소개해 주시면 판매 수수료를 드리는 파트너 프로그램이 있는데, 관심 있으시면 이 대화로 답장 주세요!`

export default function InstagramPanel({ connected }: { connected: boolean }) {
  const [tag, setTag] = useState('맛집')
  const [edge, setEdge] = useState<'top' | 'recent'>('top')
  const [media, setMedia] = useState<any[] | null>(null)
  const [uname, setUname] = useState('')
  const [profile, setProfile] = useState<any | null>(null)
  const [convs, setConvs] = useState<any[] | null>(null)
  const [mine, setMine] = useState<any[] | null>(null)
  const [comments, setComments] = useState<Record<string, any[]>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn() } catch (e) { toast.error(apiErr(e, 'Meta API error')) } finally { setBusy(null) } }
  const searchTag = () => load('tag', async () => { const d = await getData<{ data: any[] }>(`${BASE}/ig/hashtag?${new URLSearchParams({ q: tag, edge })}`); setMedia(d?.data || []) })
  const lookUp = () => load('profile', async () => { const d = await getData<any>(`${BASE}/ig/profile?${new URLSearchParams({ username: uname })}`); setProfile(d?.business_discovery || null) })
  const loadConvs = () => load('convs', async () => { const d = await getData<{ data: any[] }>(`${BASE}/ig/conversations`); setConvs(d?.data || []) })
  const loadMine = () => load('mine', async () => { const d = await getData<{ data: any[] }>(`${BASE}/ig/media`); setMine(d?.data || []) })
  const loadComments = (id: string) => load(`c:${id}`, async () => { const d = await getData<{ data: any[] }>(`${BASE}/ig/comments/${id}`); setComments(c => ({ ...c, [id]: d?.data || [] })) })
  const send = async (rid: string, text: string) => { await api.post(`${BASE}/ig/message`, { recipient_id: rid, text, approved: true }) }
  const replyComment = async (cid: string, text: string) => { await api.post(`${BASE}/ig/comment-reply`, { comment_id: cid, text, approved: true }) }
  const spin = (k: string) => busy === k && <Loader2 className="mr-1 h-4 w-4 animate-spin" />

  if (!connected) return <Empty>Log in with Facebook above first. (위에서 페이스북 로그인을 먼저 해 주세요)</Empty>

  return (
    <>
      <Section step="Step 4" title="Find public posts by hashtag" ko="해시태그로 공개 게시물 찾기(로컬 맛집 크리에이터 발굴)" perms={['Instagram Public Content Access', 'instagram_basic', 'pages_show_list', 'pages_read_engagement']}>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-sm text-gray-500">#</span>
          <input className={`${field} max-w-xs`} value={tag} onChange={e => setTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchTag()} />
          <div className="flex gap-1"><Button size="sm" variant={edge === 'top' ? 'default' : 'outline'} onClick={() => setEdge('top')}>Top media</Button><Button size="sm" variant={edge === 'recent' ? 'default' : 'outline'} onClick={() => setEdge('recent')}>Recent media</Button></div>
          <Button onClick={searchTag} disabled={!tag.trim() || busy !== null}>{spin('tag') || <Search className="mr-1 h-4 w-4" />}Search hashtag</Button>
        </div>
        {media && (media.length === 0 ? <Empty>No media.</Empty> : (
          <ul className="mt-2">
            {media.map(m => <PostRow key={m.id} text={m.caption} meta={`${m.media_type} · ♥ ${m.like_count ?? '-'} · 💬 ${m.comments_count ?? '-'} · ${when(m.timestamp)}`} link={m.permalink} />)}
          </ul>
        ))}
      </Section>

      <Section step="Step 5" title="Check a creator's public business profile" ko="크리에이터 공개 프로필 확인(팔로워·소개)" perms={['instagram_basic', 'Business Discovery']}>
        <div className="flex flex-wrap gap-2">
          <input className={`${field} max-w-xs`} value={uname} onChange={e => setUname(e.target.value)} placeholder="instagram username" onKeyDown={e => e.key === 'Enter' && lookUp()} />
          <Button onClick={lookUp} disabled={!uname.trim() || busy !== null}>{spin('profile')}Look up</Button>
        </div>
        {profile && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
            <p className="font-semibold text-gray-900">@{profile.username} {profile.name && <span className="font-normal text-gray-600">· {profile.name}</span>}</p>
            <p className="text-xs text-gray-600">Followers {profile.followers_count ?? '-'} · Posts {profile.media_count ?? '-'}</p>
            {profile.biography && <p className="mt-1 whitespace-pre-line text-xs">{profile.biography}</p>}
          </div>
        )}
      </Section>

      <Section step="Step 6" title="Partnership message, sent only after human approval" ko="제휴 제안 메시지 초안 → 사람이 확인하고 보내기(대화를 건 상대에게만)" perms={['instagram_manage_messages', 'pages_manage_metadata']}>
        <Button variant="outline" onClick={loadConvs} disabled={busy !== null}>{spin('convs')}Load Instagram inbox</Button>
        {convs && (convs.length === 0 ? <Empty>No conversations yet.</Empty> : (
          <ul className="mt-2">
            {convs.map(cv => {
              const other = (cv.participants?.data || []).find((p: any) => p.username) || cv.participants?.data?.[0]
              const last = cv.messages?.data?.[0]
              const rid = other?.id
              return (
                <PostRow key={cv.id} who={other?.username} text={last?.message} meta={when(cv.updated_time)}>
                  {rid && (open === cv.id
                    ? <ApprovalSend initial={outreachDraft(other?.username || '')} label="Send message" onSend={t => send(rid, t)} />
                    : <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(cv.id)}>Draft partnership message</Button>)}
                </PostRow>
              )
            })}
          </ul>
        ))}
      </Section>

      <Section step="Step 7" title="Reply to comments on our own posts" ko="내 게시물 댓글 읽고 답하기" perms={['instagram_manage_comments']}>
        <Button variant="outline" onClick={loadMine} disabled={busy !== null}>{spin('mine')}Load my recent posts</Button>
        {mine && (mine.length === 0 ? <Empty>No posts.</Empty> : (
          <ul className="mt-2">
            {mine.map(m => (
              <PostRow key={m.id} text={m.caption} meta={`💬 ${m.comments_count ?? 0} · ${when(m.timestamp)}`} link={m.permalink}>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => loadComments(m.id)} disabled={busy !== null}>Show comments</Button>
                {comments[m.id] && (comments[m.id].length === 0 ? <Empty>No comments.</Empty> : (
                  <ul className="ml-4 mt-2 border-l border-gray-100 pl-3">
                    {comments[m.id].map(cm => (
                      <PostRow key={cm.id} who={cm.username} text={cm.text} meta={when(cm.timestamp)}>
                        {open === cm.id
                          ? <ApprovalSend initial="댓글 감사합니다! 자세한 내용은 프로필 링크에서 확인해 주세요 :)" label="Reply" onSend={t => replyComment(cm.id, t)} />
                          : <Button size="sm" variant="outline" className="mt-1" onClick={() => setOpen(cm.id)}>Reply</Button>}
                      </PostRow>
                    ))}
                  </ul>
                ))}
              </PostRow>
            ))}
          </ul>
        ))}
      </Section>
    </>
  )
}
