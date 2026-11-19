#!/bin/zsh
set -e
setopt null_glob
cd "$(dirname "$0")"
node_ready() { command -v node >/dev/null 2>&1 && node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' >/dev/null 2>&1; }
if ! node_ready; then
  for candidate in "$HOME"/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /opt/homebrew/opt/node@24/bin/node /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.nvm/versions/node/v*/bin/node; do
    if [[ -x "$candidate" ]] && "$candidate" -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' >/dev/null 2>&1; then
      export PATH="$(dirname "$candidate"):$PATH"
      break
    fi
  done
fi
if ! node_ready; then
  print '需要 Node.js 24 或更高版本。安装后重新打开此文件。'; read; exit 1
fi
if [[ ! -d node_modules ]]; then npm ci --no-audit --no-fund; fi
npm run build
print "启动后请打开 http://127.0.0.1:${CW_PORT:-8787} 。保留此终端窗口，关闭会停止工作台。"
npm start
