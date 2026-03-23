#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/local-deploy-common.sh"

if [[ "${LOCAL_INFRA_READY:-0}" != "1" ]]; then
  ensure_local_infra
fi

if [[ "${LOCAL_SCHEMA_READY:-0}" != "1" ]]; then
  ensure_local_schema
fi

exec npm run start
