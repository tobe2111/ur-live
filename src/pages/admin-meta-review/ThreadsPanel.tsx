/**
 * 🎬 스레드 시연 — 키워드 검색(threads_keyword_search) → 사람이 확인한 답글(threads_manage_replies),
 *   내 글의 답글 읽기(threads_read_replies) · 숨기기(threads_manage_replies).
 * ⚠️ 라이트 대시보드 — dark: variant 금지.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Loader2, Search } from 'lucide-react'
import { ApprovalSend, BASE, Empty, PostRow, Section, apiErr, field, getData } from './shared'

const REPLY_DRAFT = '좋은 정보 감사해요! 유어딜(urdeal.kr)에서도 동네 맛집 할인 딜을 모아 두고 있어요 :)'
const when = (t?: string) => (t ? new Date(t).toLocaleString('ko-KR') : '')

export default function ThreadsPanel({ connected }: { connected: boolean }) {
  const [q, setQ] = useState('맛집')
  const [type, setType] = useState<'TOP' | 'RECENT'>('TOP')
  const [results, setResults] = useState<any[] | null>(null)
  const [mine, setMine] = useState<any[] | null>(null)
  const [replies, setReplies] = useState<Record<string, any[]>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn() } catch (e) { toast.error(apiErr(e, 'Meta API error')) } finally { setBusy(null) } }
  const search = () => load('search', async () => { const d = await getData<{ data: any[] }>(`${BASE}/threads/search?${new URLSearchParams({ q, type })}`); setResults(d?.data || []) })
  const loadMine = () => load('mine', async () => { const d = await getData<{ data: any[] }>(`${BASE}/threads/mine`); setMine(d?.data || []) })
  const loadReplies = (id: string) => load(`r:${id}`, async () => { const d = await getData<{ data: any[] }>(`${BASE}/threads/replies/${id}`); setReplies(r => ({ ...r, [id]: d?.data || [] })) })
  const reply = async (id: string, text: string) => { await api.post(`${BASE}/threads/reply`, { reply_to_id: id, text, approved: true }) }
  const hide = (postId: string, replyId: string, h: boolean) => load(`h:${replyId}`, async () => {
    await api.post(`${BASE}/threads/hide`, { reply_id: replyId, hide: h }); toast.success(h ? 'Hidden' : 'Unhidden'); await loadReplies(postId)
  })

  if (!connected) return <Empty>Log in with Threads above first. (위에서 스레드 로그인을 먼저 해 주세요)</Empty>

  return (
    <>
      <Section step="Step 2" title="Search public Threads posts by keyword" ko="키워드로 공개 스레드 글 찾기 → 사람이 확인한 답글 달기" perms={['threads_keyword_search', 'threads_manage_replies', 'threads_content_publish']}>
        <div className="flex flex-wrap gap-2">
          <input className={`${field} max-w-xs`} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="keyword" />
          <select className={`${field} w-auto`} value={type} onChange={e => setType(e.target.value as 'TOP' | 'RECENT')}>
            <option value="TOP">Top</option><option value="RECENT">Recent</option>
          </select>
          <Button onClick={search} disabled={!q.trim() || busy !== null}>{busy === 'search' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}Search</Button>
        </div>
        {results && (results.length === 0 ? <Empty>No results.</Empty> : (
          <ul className="mt-2">
            {results.map(p => (
              <PostRow key={p.id} who={p.username} text={p.text} meta={when(p.timestamp)} link={p.permalink}>
                {open === p.id
                  ? <ApprovalSend initial={REPLY_DRAFT} label="Post reply" onSend={t => reply(p.id, t)} />
                  : <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(p.id)}>Draft a reply</Button>}
              </PostRow>
            ))}
          </ul>
        ))}
      </Section>

      <Section step="Step 3" title="Read and manage replies on our own posts" ko="내 글에 달린 답글 읽기 · 답하기 · 숨기기" perms={['threads_basic', 'threads_read_replies', 'threads_manage_replies']}>
        <Button variant="outline" onClick={loadMine} disabled={busy !== null}>{busy === 'mine' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Load my recent posts</Button>
        {mine && (mine.length === 0 ? <Empty>No posts yet.</Empty> : (
          <ul className="mt-2">
            {mine.map(p => (
              <PostRow key={p.id} text={p.text} meta={when(p.timestamp)} link={p.permalink}>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => loadReplies(p.id)} disabled={busy !== null}>Show replies</Button>
                {replies[p.id] && (replies[p.id].length === 0 ? <Empty>No replies.</Empty> : (
                  <ul className="ml-4 mt-2 border-l border-gray-100 pl-3">
                    {replies[p.id].map(r => (
                      <PostRow key={r.id} who={r.username} text={r.text} meta={`${when(r.timestamp)}${r.hide_status ? ` · ${r.hide_status}` : ''}`}>
                        <div className="mt-1 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setOpen(r.id)}>Reply</Button>
                          <Button size="sm" variant="outline" onClick={() => hide(p.id, r.id, r.hide_status !== 'HIDDEN')}>{r.hide_status === 'HIDDEN' ? 'Unhide' : 'Hide'}</Button>
                        </div>
                        {open === r.id && <ApprovalSend initial="댓글 감사합니다!" label="Post reply" onSend={t => reply(r.id, t)} />}
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
