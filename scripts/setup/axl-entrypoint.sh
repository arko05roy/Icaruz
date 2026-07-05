#!/bin/sh
# axl-entrypoint — templates the Yggdrasil-format AXL node config from env at
# runtime so the Ed25519 private key never lives in the image. Then exec the
# daemon. AXL inherits Yggdrasil's config schema (capitalised keys).
set -eu

CFG_PATH="${AXL_NODE_CONFIG_PATH:-/etc/axl/node-config.json}"
mkdir -p "$(dirname "$CFG_PATH")"

if [ -z "${AXL_PRIVATE_KEY_HEX:-}" ]; then
    echo "axl-entrypoint: AXL_PRIVATE_KEY_HEX not set" >&2
    exit 1
fi

# Yggdrasil expects a 128-char hex (32-byte seed + 32-byte public key).
KEY_LEN=$(printf '%s' "$AXL_PRIVATE_KEY_HEX" | wc -c)
if [ "$KEY_LEN" -ne 128 ]; then
    echo "axl-entrypoint: AXL_PRIVATE_KEY_HEX must be 128 hex chars (got $KEY_LEN)" >&2
    exit 1
fi

# Mesh listen URL — what other AXL daemons connect to.
LISTEN="${AXL_MESH_LISTEN:-tls://0.0.0.0:7000}"
PEERS_JSON="${AXL_PEERS_JSON:-[]}"

cat > "$CFG_PATH" <<EOF
{
  "PrivateKey": "${AXL_PRIVATE_KEY_HEX}",
  "Peers": ${PEERS_JSON},
  "Listen": ["${LISTEN}"]
}
EOF

echo "axl-entrypoint: config written ($(wc -c < "$CFG_PATH") bytes); listen=${LISTEN}; public_key=${AXL_PUBLIC_KEY_HEX:-unset}"

exec /usr/local/bin/axl -config "$CFG_PATH"
