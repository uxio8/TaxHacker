#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

mkdir -p "${REPO_DIR}/backups/local"
cd "${REPO_DIR}"

exec /usr/bin/env node --experimental-strip-types ./scripts/backup-local.ts "$@"
