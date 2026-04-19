#!/bin/sh
set -e

: "${XMPP_DOMAIN:=parley.local}"
: "${XMPP_COMPONENT_SECRET:=parley-bridge-secret}"
: "${XMPP_PEER_DOMAIN:=}"
: "${PARLEY_AUTH_URL:=http://server:3000/api/xmpp/auth}"

export XMPP_DOMAIN XMPP_COMPONENT_SECRET XMPP_PEER_DOMAIN PARLEY_AUTH_URL

CERTS_DIR=/var/lib/prosody/certs
mkdir -p "$CERTS_DIR"

generate_cert() {
    local domain="$1"
    local key_file="$CERTS_DIR/${domain}.key"
    local crt_file="$CERTS_DIR/${domain}.crt"
    if [ ! -s "$crt_file" ]; then
        echo "[entrypoint] generating self-signed cert for $domain"
        openssl req -new -newkey rsa:2048 -nodes -x509 \
            -days 3650 \
            -subj "/CN=${domain}" \
            -addext "subjectAltName=DNS:${domain}" \
            -keyout "$key_file" \
            -out "$crt_file" >/dev/null 2>&1
        chmod 640 "$key_file"
    fi
}

generate_cert "${XMPP_DOMAIN}"
generate_cert "bridge.${XMPP_DOMAIN}"
generate_cert "conference.${XMPP_DOMAIN}"

exec "$@"
