#!/usr/bin/env bash
# pAIdb01 (172.16.5.19) Supabase Docker 셀프호스팅 설치
# root 권한으로 실행
set -euo pipefail

SUPABASE_DIR="/opt/supabase"
DB_SERVER_IP="172.16.5.19"
WEB_SERVER_IP="172.16.1.87"

echo "========================================"
echo " Supabase 셀프호스팅 설치"
echo "========================================"

echo "[1] Supabase Docker 파일 가져오기"
cd /opt
if [ -d "$SUPABASE_DIR" ]; then
  echo "기존 $SUPABASE_DIR 디렉토리가 있습니다. 백업 후 진행합니다."
  mv "$SUPABASE_DIR" "${SUPABASE_DIR}.bak.$(date +%Y%m%d%H%M%S)"
fi

git clone --depth 1 https://github.com/supabase/supabase /opt/supabase-repo
mkdir -p "$SUPABASE_DIR"
cp -rf /opt/supabase-repo/docker/* "$SUPABASE_DIR/"
cp /opt/supabase-repo/docker/.env.example "$SUPABASE_DIR/.env"
rm -rf /opt/supabase-repo

cd "$SUPABASE_DIR"

echo ""
echo "[2] 보안 키 생성"

POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
SECRET_KEY_BASE=$(openssl rand -base64 48)
VAULT_ENC_KEY=$(openssl rand -hex 16)
PG_META_CRYPTO_KEY=$(openssl rand -base64 24)
LOGFLARE_PUBLIC_TOKEN=$(openssl rand -base64 24)
LOGFLARE_PRIVATE_TOKEN=$(openssl rand -base64 24)
S3_ACCESS_KEY_ID=$(openssl rand -hex 16)
S3_ACCESS_KEY_SECRET=$(openssl rand -hex 32)
MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)
DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)

echo "생성된 키 정보를 기록합니다..."
cat > "$SUPABASE_DIR/generated-keys.txt" << KEYSEOF
====================================
  Supabase 셀프호스팅 생성 키 정보
  생성일시: $(date)
  이 파일을 안전하게 보관하세요!
====================================

POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD

Studio 접속: http://${DB_SERVER_IP}:8000
  ID: supabase
  PW: $DASHBOARD_PASSWORD
====================================
KEYSEOF
chmod 600 "$SUPABASE_DIR/generated-keys.txt"

echo ""
echo "[3] .env 설정 파일 수정"

# sed를 이용한 .env 파일 업데이트
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
sed -i "s|^SECRET_KEY_BASE=.*|SECRET_KEY_BASE=${SECRET_KEY_BASE}|" .env
sed -i "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=${VAULT_ENC_KEY}|" .env
sed -i "s|^PG_META_CRYPTO_KEY=.*|PG_META_CRYPTO_KEY=${PG_META_CRYPTO_KEY}|" .env

sed -i "s|^LOGFLARE_PUBLIC_ACCESS_TOKEN=.*|LOGFLARE_PUBLIC_ACCESS_TOKEN=${LOGFLARE_PUBLIC_TOKEN}|" .env
sed -i "s|^LOGFLARE_PRIVATE_ACCESS_TOKEN=.*|LOGFLARE_PRIVATE_ACCESS_TOKEN=${LOGFLARE_PRIVATE_TOKEN}|" .env
sed -i "s|^S3_PROTOCOL_ACCESS_KEY_ID=.*|S3_PROTOCOL_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}|" .env
sed -i "s|^S3_PROTOCOL_ACCESS_KEY_SECRET=.*|S3_PROTOCOL_ACCESS_KEY_SECRET=${S3_ACCESS_KEY_SECRET}|" .env
sed -i "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}|" .env

sed -i "s|^DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=supabase|" .env
sed -i "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}|" .env

sed -i "s|^SITE_URL=.*|SITE_URL=http://${WEB_SERVER_IP}:3000|" .env
sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=http://${DB_SERVER_IP}:8000|" .env
sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=http://${DB_SERVER_IP}:8000|" .env

echo ""
echo "[4] JWT 기반 ANON_KEY, SERVICE_ROLE_KEY 생성"

# 내장 generate-keys.sh가 있으면 사용, 없으면 수동 생성
if [ -f "./utils/generate-keys.sh" ]; then
  echo "내장 generate-keys.sh를 사용합니다..."
  echo "y" | sh ./utils/generate-keys.sh 2>/dev/null || true
fi

echo ""
echo "[5] Docker 이미지 Pull"
docker compose pull

echo ""
echo "[6] Supabase 시작"
docker compose up -d

echo ""
echo "[7] 서비스 상태 확인 (30초 대기)"
sleep 30
docker compose ps

echo ""
echo "[8] 방화벽 포트 열기"
firewall-cmd --permanent --add-port=8000/tcp 2>/dev/null || true
firewall-cmd --permanent --add-port=5432/tcp 2>/dev/null || true
firewall-cmd --permanent --add-port=6543/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

echo ""
echo "========================================"
echo " Supabase 셀프호스팅 설치 완료!"
echo ""
echo " Studio: http://${DB_SERVER_IP}:8000"
echo " API:    http://${DB_SERVER_IP}:8000/rest/v1/"
echo " Auth:   http://${DB_SERVER_IP}:8000/auth/v1/"
echo ""
echo " 키 정보: cat $SUPABASE_DIR/generated-keys.txt"
echo ""
echo " ANON_KEY 확인:"
echo "   grep ANON_KEY $SUPABASE_DIR/.env"
echo ""
echo " SERVICE_ROLE_KEY 확인:"
echo "   grep SERVICE_ROLE_KEY $SUPABASE_DIR/.env"
echo "========================================"
