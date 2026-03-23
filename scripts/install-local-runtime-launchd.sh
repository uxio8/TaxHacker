#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_LABEL="com.ledgerflow.app-local"
WORKER_LABEL="com.ledgerflow.analysis-worker-local"
APP_PLIST="${HOME}/Library/LaunchAgents/${APP_LABEL}.plist"
WORKER_PLIST="${HOME}/Library/LaunchAgents/${WORKER_LABEL}.plist"
LOG_DIR="${REPO_DIR}/data/runtime/launchd"
UID_VALUE="$(id -u)"

mkdir -p "${HOME}/Library/LaunchAgents"
mkdir -p "${LOG_DIR}"

set -a
source "${REPO_DIR}/.env"
if [[ -f "${REPO_DIR}/.env.localdeploy" ]]; then
  source "${REPO_DIR}/.env.localdeploy"
fi
set +a

cd "${REPO_DIR}"
npm run build

cat > "${APP_PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${APP_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>exec '${REPO_DIR}/scripts/run-local-app.sh'</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${REPO_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/app.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/app-error.log</string>
  </dict>
</plist>
PLIST

cat > "${WORKER_PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${WORKER_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>exec '${REPO_DIR}/scripts/run-local-analysis-worker.sh'</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${REPO_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/analysis-worker.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/analysis-worker-error.log</string>
  </dict>
</plist>
PLIST

launchctl bootout "gui/${UID_VALUE}" "${APP_PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${UID_VALUE}" "${APP_PLIST}"
launchctl enable "gui/${UID_VALUE}/${APP_LABEL}" >/dev/null 2>&1 || true

launchctl bootout "gui/${UID_VALUE}" "${WORKER_PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${UID_VALUE}" "${WORKER_PLIST}"
launchctl enable "gui/${UID_VALUE}/${WORKER_LABEL}" >/dev/null 2>&1 || true

echo "LaunchAgents instalados:"
echo "- ${APP_LABEL}"
echo "- ${WORKER_LABEL}"
