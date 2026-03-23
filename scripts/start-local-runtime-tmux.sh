#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/local-deploy-common.sh"
LOG_DIR="${REPO_DIR}/data/runtime/tmux"
APP_SESSION="ledgerflow-app"
WORKER_SESSION="ledgerflow-analysis-worker"

mkdir -p "${LOG_DIR}"
: > "${LOG_DIR}/app.log"
: > "${LOG_DIR}/analysis-worker.log"

ensure_local_infra
ensure_local_schema
ensure_local_build

tmux has-session -t "${APP_SESSION}" 2>/dev/null && tmux kill-session -t "${APP_SESSION}"
tmux has-session -t "${WORKER_SESSION}" 2>/dev/null && tmux kill-session -t "${WORKER_SESSION}"

tmux new-session -d -s "${APP_SESSION}" "cd '${REPO_DIR}' && LOCAL_INFRA_READY=1 LOCAL_SCHEMA_READY=1 exec ./scripts/run-local-app.sh >> '${LOG_DIR}/app.log' 2>&1"
tmux new-session -d -s "${WORKER_SESSION}" "cd '${REPO_DIR}' && LOCAL_INFRA_READY=1 LOCAL_SCHEMA_READY=1 exec ./scripts/run-local-analysis-worker.sh >> '${LOG_DIR}/analysis-worker.log' 2>&1"

echo "Sesiones tmux iniciadas:"
echo "- ${APP_SESSION}"
echo "- ${WORKER_SESSION}"
