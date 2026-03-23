#!/bin/zsh
set -euo pipefail

APP_SESSION="ledgerflow-app"
WORKER_SESSION="ledgerflow-analysis-worker"

echo "tmux:"
tmux has-session -t "${APP_SESSION}" 2>/dev/null && echo "- ${APP_SESSION}: up" || echo "- ${APP_SESSION}: down"
tmux has-session -t "${WORKER_SESSION}" 2>/dev/null && echo "- ${WORKER_SESSION}: up" || echo "- ${WORKER_SESSION}: down"

echo
echo "web:"
curl -I --max-time 5 http://localhost:7331/self-hosted | sed -n '1,5p'
