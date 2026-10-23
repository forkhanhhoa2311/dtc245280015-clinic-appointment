#!/usr/bin/env sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CERT_DIR="$PROJECT_DIR/nginx/certs"
SERVER_IP="${1:-192.168.244.130}"

if [ -s "$CERT_DIR/selfsigned.crt" ] && [ -s "$CERT_DIR/selfsigned.key" ]; then
    echo "Đã có đủ chứng chỉ và khóa. Giữ nguyên."
    exit 0
fi

if [ -e "$CERT_DIR/selfsigned.crt" ] || [ -e "$CERT_DIR/selfsigned.key" ]; then
    echo "Lỗi: chứng chỉ hoặc khóa đang thiếu/rỗng. Kiểm tra nginx/certs."
    exit 1
fi

command -v openssl >/dev/null 2>&1 || {
    echo "Thiếu openssl. Cài bằng: sudo apt install openssl"
    exit 1
}

mkdir -p "$CERT_DIR"
umask 077

openssl req -x509 -nodes -newkey rsa:2048 \
    -days 365 \
    -keyout "$CERT_DIR/selfsigned.key" \
    -out "$CERT_DIR/selfsigned.crt" \
    -subj "/CN=$SERVER_IP" \
    -addext "subjectAltName=IP:$SERVER_IP,DNS:localhost"

chmod 600 "$CERT_DIR/selfsigned.key"
chmod 644 "$CERT_DIR/selfsigned.crt"

echo "Đã tạo chứng chỉ cho IP: $SERVER_IP"
