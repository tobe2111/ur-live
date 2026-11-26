#!/usr/bin/env bash
# 🔗 작업실(세션) 연결 (2026-11-26 대표 "모든 세션들 모두 연결해서 한번에 관리하는게 좋지 않겠어? 새 세션을 만들더라도").
#   이 레포에서 열린 모든 Claude Code 세션이 시작·질문·턴 끝에 어드민 "AI 팀 본사" 로 한 줄씩 보고한다.
#   쓰임: .claude/settings.json 의 SessionStart · UserPromptSubmit · Stop 훅 → `ai-hq-report.sh start|prompt|stop`
#
#   철칙(이 스크립트가 세션을 방해하면 안 된다):
#   - **아무것도 출력하지 않는다** — UserPromptSubmit 훅의 출력은 세션 대화에 끼어든다.
#   - **기다리지 않는다** — 보고는 백그라운드로 던지고 즉시 exit 0. 실패해도 조용히 넘어간다.
#   - 어드민 자격(URDEAL_ADMIN_EMAIL/PASSWORD)이 없거나 AI_HQ_REPORT=0 이면 아무것도 안 한다.
#   - 비밀번호·토큰을 어디에도 찍지 않는다. 토큰은 컨테이너 안 임시 파일(권한 600)에 50분 재사용.
EVENT="${1:-}"
# 일찍 끝날 때도 입력(stdin)을 끝까지 읽고 끝낸다 — 안 읽고 나가면 보내는 쪽이 EPIPE 를 맞는다
#   (2026-11-26 CI 실측: 시험이 `spawnSync bash EPIPE` 로 간헐 실패).
quit() { cat >/dev/null 2>&1; exit 0; }
case "$EVENT" in start|prompt|stop) ;; *) quit ;; esac
[ "${AI_HQ_REPORT:-1}" = "0" ] && quit
[ -n "${URDEAL_ADMIN_EMAIL:-}" ] && [ -n "${URDEAL_ADMIN_PASSWORD:-}" ] || quit
command -v python3 >/dev/null 2>&1 || quit

INPUT_FILE="$(mktemp 2>/dev/null)" || quit
head -c 200000 > "$INPUT_FILE" 2>/dev/null

nohup python3 - "$EVENT" "$INPUT_FILE" >/dev/null 2>&1 <<'PY' &
import json, os, sys, time, subprocess, urllib.request, urllib.error
event, input_file = sys.argv[1], sys.argv[2]
try:
    raw = open(input_file, encoding='utf-8', errors='ignore').read()
finally:
    try: os.unlink(input_file)
    except Exception: pass
try: data = json.loads(raw) if raw.strip() else {}
except Exception: data = {}
sid = str(data.get('session_id') or os.environ.get('CLAUDE_CODE_SESSION_ID') or '')
if not sid: sys.exit(0)
BASE = 'https://live.ur-team.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
TOK_FILE = '/tmp/.ai-hq-token'

def call(path, body, tok=None):
    h = {'Content-Type': 'application/json', 'User-Agent': UA}
    if tok: h['Authorization'] = 'Bearer ' + tok
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=h, method='POST')
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read() or b'{}')

def token(fresh=False):
    if not fresh:
        try:
            if time.time() - os.path.getmtime(TOK_FILE) < 3000:
                t = open(TOK_FILE).read().strip()
                if t: return t
        except Exception: pass
    d = call('/api/admin/login', {'email': os.environ['URDEAL_ADMIN_EMAIL'], 'password': os.environ['URDEAL_ADMIN_PASSWORD']})
    x = d.get('data') or {}
    t = x.get('accessToken') or x.get('token') or d.get('token') or ''
    if t:
        fd = os.open(TOK_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        os.write(fd, t.encode()); os.close(fd)
    return t

def branch():
    try:
        cwd = data.get('cwd') or os.environ.get('CLAUDE_PROJECT_DIR') or '.'
        return subprocess.run(['git', '-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], capture_output=True, text=True, timeout=3).stdout.strip() or None
    except Exception: return None

def last_reply():
    p = data.get('transcript_path')
    if not p or not os.path.exists(p): return None
    try:
        with open(p, 'rb') as f:
            f.seek(0, 2); size = f.tell(); f.seek(max(0, size - 300000))
            lines = f.read().decode('utf-8', 'ignore').splitlines()
        for line in reversed(lines):
            try: o = json.loads(line)
            except Exception: continue
            m = o.get('message') or {}
            if o.get('type') != 'assistant' and m.get('role') != 'assistant': continue
            c = m.get('content')
            if isinstance(c, str) and c.strip(): return c.strip()[:200]
            if isinstance(c, list):
                for part in c:
                    if isinstance(part, dict) and part.get('type') == 'text' and part.get('text', '').strip():
                        return part['text'].strip()[:200]
    except Exception: return None
    return None

body = {'session_id': sid, 'event': event, 'branch': branch()}
if event == 'prompt': body['title'] = (data.get('prompt') or '')[:80]
if event == 'stop': body['summary'] = last_reply()
try:
    t = token()
    try: call('/api/admin/ai-team/session', body, t)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403): call('/api/admin/ai-team/session', body, token(fresh=True))
except Exception:
    pass
PY
exit 0
