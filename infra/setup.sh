#!/bin/bash
# UR Live 미디어 서버 자동 셋업 스크립트
#
# 사용법 (Oracle Cloud / Hetzner / 어떤 Ubuntu 22.04 VPS 든):
#   ssh root@<서버IP>
#   curl -sSL https://raw.githubusercontent.com/tobe2111/ur-live/main/infra/setup.sh | bash
#
# 또는 환경변수 미리 지정:
#   curl -sSL .../setup.sh | DOMAIN=stream.ur-team.com bash
#
# 설치 내용:
#   - Docker + Docker Compose
#   - Let's Encrypt SSL (certbot)
#   - 방화벽 (ufw + iptables)
#   - OvenMediaEngine 컨테이너 (자동 시작)
#   - Cron: 인증서 자동 갱신

set -euo pipefail

DOMAIN="${DOMAIN:-stream.ur-team.com}"
EMAIL="${EMAIL:-admin@ur-team.com}"
REPO="${REPO:-https://github.com/tobe2111/ur-live.git}"

log() { echo -e "\033[1;36m[setup]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
fail() { echo -e "\033[1;31m[fail]\033[0m $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "root 으로 실행해주세요. (sudo bash)"

log "1/8 시스템 업데이트"
apt-get update -qq
apt-get install -y -qq curl gnupg ca-certificates lsb-release ufw netfilter-persistent iptables-persistent

log "2/8 Docker 설치"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

log "3/8 방화벽 설정"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (certbot)'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 1935/tcp comment 'RTMP'
ufw allow 3333/tcp comment 'WebRTC signaling (insecure)'
ufw allow 3334/tcp comment 'WebRTC signaling (TLS)'
ufw allow 3478/tcp comment 'TURN'
ufw allow 3478/udp comment 'STUN'
ufw allow 8081/tcp comment 'OME API'
ufw allow 10000:10100/udp comment 'WebRTC ICE'
ufw --force enable

# Oracle Cloud Ubuntu 이미지는 iptables 가 별도로 막혀있음 — ufw 위에 덮어씀
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 1935 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3334 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3478 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p udp --dport 3478 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p udp --dport 10000:10100 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8081 -j ACCEPT 2>/dev/null || true
netfilter-persistent save 2>/dev/null || true

log "4/8 Let's Encrypt SSL 인증서 발급 ($DOMAIN)"
apt-get install -y -qq certbot
if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  certbot certonly --standalone --non-interactive --agree-tos --email "$EMAIL" -d "$DOMAIN" \
    || fail "SSL 발급 실패 — DNS 가 $DOMAIN 을 이 서버 IP 로 가리키고 있는지 확인하세요"
else
  log "  기존 인증서 발견 — 건너뜀"
fi

log "5/8 UR Live 리포 클론 (OME 설정 파일용)"
mkdir -p /opt/ome
cd /opt/ome
if [[ ! -d .git ]]; then
  git clone --depth=1 "$REPO" /tmp/ur-live-repo
  cp /tmp/ur-live-repo/infra/ome/Server.xml ./Server.xml
  cp /tmp/ur-live-repo/infra/ome/Logger.xml ./Logger.xml
  cp /tmp/ur-live-repo/infra/ome/docker-compose.yml ./docker-compose.yml
  rm -rf /tmp/ur-live-repo
fi

log "6/8 환경변수 .env 생성"
PUBLIC_IP=$(curl -fsS ifconfig.me || curl -fsS ipinfo.io/ip)
[[ -n "$PUBLIC_IP" ]] || fail "Public IP 자동 감지 실패"

if [[ ! -f .env ]]; then
  OME_API_TOKEN=$(openssl rand -hex 32)
  OME_WEBHOOK_SECRET=$(openssl rand -hex 32)
  cat > .env <<EOF
OME_HOST_IP=$PUBLIC_IP
OME_API_TOKEN=$OME_API_TOKEN
OME_WEBHOOK_SECRET=$OME_WEBHOOK_SECRET
OME_WEBHOOK_URL=https://live.ur-team.com/api/internal/ome/admission
EOF
  chmod 600 .env
  log "  새 .env 생성됨"
else
  log "  기존 .env 발견 — 재사용"
fi

log "7/8 OvenMediaEngine 컨테이너 시작"
docker compose down 2>/dev/null || true
docker compose pull
docker compose up -d
sleep 5
if ! docker ps --format '{{.Names}}' | grep -q '^ome$'; then
  docker compose logs --tail 50
  fail "OME 컨테이너 시작 실패 — 위 로그 확인"
fi

log "8/8 SSL 자동 갱신 cron 설치"
cat > /etc/cron.d/certbot-renew <<EOF
0 3 * * * root certbot renew --quiet --post-hook 'cd /opt/ome && docker compose restart'
EOF

log ""
log "✅ 셋업 완료!"
log ""
log "  도메인: https://$DOMAIN"
log "  WHIP endpoint: https://$DOMAIN:3334/app/{stream_name}?whip=1"
log "  OME REST API: http://$DOMAIN:8081 (관리용 — Worker 만 호출)"
log ""
log "다음 단계 — Cloudflare Pages 환경변수 등록:"
log ""
echo "  OME_HOST=$DOMAIN"
echo "  OME_API_TOKEN=$(grep OME_API_TOKEN .env | cut -d= -f2)"
echo "  OME_WEBHOOK_SECRET=$(grep OME_WEBHOOK_SECRET .env | cut -d= -f2)"
log ""
log "Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables 에 등록."
log ""
log "다운로드 / 동작 확인:"
log "  curl -H 'Authorization: Basic $(echo -n :$(grep OME_API_TOKEN .env | cut -d= -f2) | base64)' http://localhost:8081/v1/stats/current"
