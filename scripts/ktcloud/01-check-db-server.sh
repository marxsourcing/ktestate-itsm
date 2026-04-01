#!/usr/bin/env bash
# pAIdb01 (172.16.5.19) 서버 사양 확인 스크립트
# VPN 접속 후 DB 서버에서 실행
set -euo pipefail

echo "========================================"
echo " pAIdb01 서버 사양 확인"
echo "========================================"

echo ""
echo "[1] OS 정보"
cat /etc/os-release | head -5

echo ""
echo "[2] CPU"
echo "코어 수: $(nproc)"
lscpu | grep "Model name" || true

echo ""
echo "[3] RAM"
free -h

echo ""
echo "[4] 디스크"
df -h / /var 2>/dev/null || df -h /

echo ""
echo "[5] Docker 설치 여부"
if command -v docker &>/dev/null; then
  echo "Docker 설치됨: $(docker --version)"
  docker compose version 2>/dev/null || echo "Docker Compose 플러그인 없음"
else
  echo "Docker 미설치"
fi

echo ""
echo "[6] Git 설치 여부"
git --version 2>/dev/null || echo "Git 미설치"

echo ""
echo "[7] 사용 중인 포트 (8000, 5432, 6543)"
ss -tlnp | grep -E ':(8000|5432|6543)\s' || echo "해당 포트 미사용 (OK)"

echo ""
echo "[8] 외부 인터넷 접근 테스트"
curl -sI --connect-timeout 5 https://hub.docker.com 2>/dev/null | head -1 || echo "외부 인터넷 접근 불가"
curl -sI --connect-timeout 5 https://registry.npmjs.org 2>/dev/null | head -1 || echo "npm registry 접근 불가"

echo ""
echo "[9] 방화벽 상태"
firewall-cmd --state 2>/dev/null || echo "firewalld 미실행"
firewall-cmd --list-all 2>/dev/null || true

echo ""
echo "========================================"
echo " 확인 완료 - 결과를 복사해서 가져오세요"
echo "========================================"
