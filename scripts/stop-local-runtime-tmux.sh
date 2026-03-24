#!/bin/zsh
set -euo pipefail

APP_SESSION="ledgerflow-app"
WORKER_SESSION="ledgerflow-analysis-worker"

tmux has-session -t "${APP_SESSION}" 2>/dev/null && tmux kill-session -t "${APP_SESSION}" || true
tmux has-session -t "${WORKER_SESSION}" 2>/dev/null && tmux kill-session -t "${WORKER_SESSION}" || true

echo "Sesiones tmux detenidas:"
echo "- ${APP_SESSION}"
echo "- ${WORKER_SESSION}"
