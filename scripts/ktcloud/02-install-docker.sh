#!/usr/bin/env bash
# pAIdb01 (172.16.5.19) Docker + Docker Compose 설치
# Rocky Linux 8.10 용 - root 권한으로 실행
set -euo pipefail

echo "========================================"
echo " Docker 설치 시작 (Rocky Linux 8)"
echo "========================================"

if command -v docker &>/dev/null; then
  echo "Docker가 이미 설치되어 있습니다: $(docker --version)"
  echo "건너뜁니다..."
else
  echo "[1] 기존 충돌 패키지 제거"
  dnf remove -y docker docker-client docker-client-latest \
    docker-common docker-latest docker-latest-logrotate \
    docker-logrotate docker-engine 2>/dev/null || true

  echo "[2] Docker 저장소 추가"
  dnf install -y dnf-plugins-core
  dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

  echo "[3] Docker 설치"
  dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

  echo "[4] Docker 서비스 시작 및 부팅 시 자동 시작"
  systemctl start docker
  systemctl enable docker
fi

echo ""
echo "[5] 설치 확인"
docker --version
docker compose version

echo ""
echo "[6] Docker 테스트"
docker run --rm hello-world

echo ""
echo "========================================"
echo " Docker 설치 완료"
echo "========================================"
