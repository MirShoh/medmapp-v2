#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu 22.04/24.04 server for MedMapp. Copy this file to the server and run as root:
#   scp deploy/server-setup.sh root@SERVER_IP:/root/   then on the server:   bash /root/server-setup.sh
# Installs Docker + Compose, firewall (SSH, HTTP, HTTPS only), fail2ban, automatic security updates, swap,
# Tashkent time zone, and creates a read-only GitHub deploy key for cloning the private repository.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run as root (sudo -i)."; exit 1; fi
export DEBIAN_FRONTEND=noninteractive

echo "==> System update"
timedatectl set-timezone Asia/Tashkent || true
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades openssl cron

echo "==> Docker (official repository)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
# keep container logs from filling the disk
mkdir -p /etc/docker
[ -f /etc/docker/daemon.json ] || cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
JSON
systemctl restart docker

echo "==> Firewall: only SSH, HTTP, HTTPS"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> fail2ban (blocks SSH password guessing) and automatic security updates"
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Swap (helps the 'docker build' step on small servers)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> GitHub deploy key (read-only access to the private repository)"
KEY=/root/.ssh/medmapp_deploy
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -f "$KEY" ] || ssh-keygen -t ed25519 -N "" -C "medmapp-server" -f "$KEY" >/dev/null
grep -q "Host github.com" /root/.ssh/config 2>/dev/null || cat >> /root/.ssh/config <<CFG
Host github.com
  IdentityFile $KEY
  IdentitiesOnly yes
CFG
ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null

echo
echo "======================================================================"
echo " Server is ready. Add this key to GitHub:"
echo "   repository -> Settings -> Deploy keys -> Add deploy key (leave 'Allow write access' OFF)"
echo
cat "$KEY.pub"
echo
echo " Then:"
echo "   git clone git@github.com:MirShoh/medmapp-v2.git /opt/medmapp"
echo "   cd /opt/medmapp && bash deploy/deploy.sh"
echo "======================================================================"
