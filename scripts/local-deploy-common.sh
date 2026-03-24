#!/bin/zsh
set -euo pipefail

if [[ "${LEDGERFLOW_LOCAL_DEPLOY_COMMON_LOADED:-0}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

export LEDGERFLOW_LOCAL_DEPLOY_COMMON_LOADED=1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

export REPO_DIR
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH}"

cd "${REPO_DIR}"

set -a
source "${REPO_DIR}/.env"
if [[ -f "${REPO_DIR}/.env.localdeploy" ]]; then
  source "${REPO_DIR}/.env.localdeploy"
fi
if [[ -f "${REPO_DIR}/.env.tunnel" ]]; then
  source "${REPO_DIR}/.env.tunnel"
fi
set +a

export POSTGRES_PORT="${POSTGRES_PORT:-5432}"

docker_compose() {
  if [[ -n "${DOCKER_CONTEXT:-}" ]]; then
    docker --context "${DOCKER_CONTEXT}" compose "$@"
    return
  fi

  docker compose "$@"
}

ensure_local_infra() {
  if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
    docker_compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d postgres cloudflared >/dev/null
  else
    docker_compose up -d postgres >/dev/null
  fi

  for _ in {1..30}; do
    if docker_compose exec -T postgres pg_isready -U postgres -d ledgerflow >/dev/null 2>&1; then
      return 0
    fi

    sleep 2
  done

  echo "PostgreSQL no responde despues de 60s" >&2
  return 1
}

ensure_local_schema() {
  npx prisma migrate deploy >/dev/null
}

ensure_local_build() {
  npm run build >/dev/null
}
