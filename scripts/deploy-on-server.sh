#!/usr/bin/env bash
# 서버에서만 실행: CI가 SSH로 git 동기화 후 이 스크립트를 호출합니다.
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"
npm ci
npm run build

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe ktestate >/dev/null 2>&1; then
    pm2 reload ktestate
  else
    pm2 start npm --name ktestate -- start
  fi
elif systemctl cat ktestate.service &>/dev/null; then
  sudo systemctl restart ktestate
else
  echo "pm2 앱 ktestate 또는 systemd 유닛 ktestate.service 를 서버에 설정하세요."
  exit 1
fi
