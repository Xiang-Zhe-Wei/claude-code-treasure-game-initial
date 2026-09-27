---
description: 登入 GitHub、必要時建立 Repo，並將專案建置部署到 GitHub Pages，完成後回報網址
argument-hint: "[repo-name]  （選填；沒有 origin 遠端時用來建立新 Repo，預設為資料夾名稱）"
allowed-tools: Bash(gh:*), Bash(git:*), Bash(npm:*), Bash(brew:*), Bash(curl:*), Bash(cat:*), Bash(ls:*), Bash(mktemp:*), Bash(rm:*), Bash(touch:*), Bash(cp:*), Bash(basename:*), Read, Write, AskUserQuestion
---

請將目前這個專案部署到 GitHub Pages，並在完成後告訴我網址。

參數：`$ARGUMENTS`（選填的 Repo 名稱，只在需要建立新 Repo 時使用）

部署方式：原始碼推到 `main`，建置結果（`build/`）強制推到 `gh-pages` 分支，GitHub Pages 從 `gh-pages` 分支根目錄提供網頁。不使用 GitHub Actions（避免需要額外的 `workflow` 權限）。

## 步驟

1. **檢查 GitHub CLI**
   - 執行 `gh --version`。
   - 若找不到指令：有 `brew` 就執行 `brew install gh`；沒有 `brew` 就**停下來**，請我到 https://cli.github.com 安裝後再執行本指令。

2. **檢查登入狀態（未登入時引導我登入）**
   - 執行 `gh auth status`。
   - 若尚未登入，**停下來**，不要自行嘗試互動式登入，並清楚告訴我：
     1. 在提示列輸入：`! gh auth login --hostname github.com --git-protocol https --web`
     2. 終端機會顯示一組一次性代碼，並開啟瀏覽器（沒開就手動前往 https://github.com/login/device）
     3. 在瀏覽器登入 GitHub、貼上代碼並按 Authorize
     4. 看到 `✓ Logged in as <帳號>` 後，再執行一次 `/deploy_github_page`
   - 已登入：執行 `gh auth setup-git`（讓 git push 使用 gh 的憑證），並用 `gh api user --jq .login` 取得帳號名稱 `OWNER`。

3. **準備本地 git 版本庫**
   - 若不是 git 版本庫（`git rev-parse --is-inside-work-tree` 失敗），執行 `git init -b main`。
   - 確認 `.gitignore` 內有 `node_modules/`、`build/`、`.vercel`、`.env`、`server/*.db`；缺少就補上。
   - 執行 `git status --short`，確認沒有要被提交的祕密檔案（`.env`、`*.db`、金鑰等）；若有，停下來告訴我。
   - 若有未提交的變更：`git add -A` 並 `git commit -m "Deploy to GitHub Pages"`。

4. **確認 GitHub Repo（沒有就建立）**
   - 執行 `git remote get-url origin`。
   - **已有 origin**：從網址解析出 `OWNER/REPO`，執行 `git push -u origin HEAD:main` 推送原始碼。
   - **沒有 origin**：
     - Repo 名稱 `REPO`：用 `$ARGUMENTS`；沒有參數就用目前資料夾名稱（轉小寫，非英數字元換成 `-`）。
     - 用 `gh repo view OWNER/REPO` 檢查名稱是否已被使用；若已存在，問我要改用那個 Repo 還是換名稱。
     - 用 AskUserQuestion 跟我確認一次：「將建立**公開** Repo `OWNER/REPO` 並推送原始碼」。（免費帳號的 GitHub Pages 只能用在公開 Repo。）
     - 確認後執行：`gh repo create REPO --public --source=. --remote=origin --push`

5. **建置**
   - 若沒有 `node_modules`，先執行 `npm install`。
   - 執行 `npm run build -- --base=./`。使用相對路徑是因為 GitHub Pages 網址在子路徑 `/REPO/` 下，預設的 `/` 會讓 JS／CSS／圖片 404。
   - 輸出目錄是 `build/`（不是 `dist/`）。建置失敗就停止並回報錯誤訊息。

6. **推送到 `gh-pages` 分支**
   - 在暫存資料夾操作，不要動到專案本身的 git 歷史：
     ```bash
     TMP=$(mktemp -d)
     cp -R build/. "$TMP"/
     touch "$TMP/.nojekyll"
     git -C "$TMP" init -b gh-pages
     git -C "$TMP" add -A
     git -C "$TMP" commit -m "Deploy $(git rev-parse --short HEAD)"
     git -C "$TMP" push -f "https://github.com/OWNER/REPO.git" gh-pages
     rm -rf "$TMP"
     ```

7. **啟用 GitHub Pages**
   - 注意：推送 `gh-pages` 分支後，GitHub 通常會自動啟用 Pages，此時 POST 會回 `409 GitHub Pages is already enabled`，屬正常情況，不是錯誤。
   - `gh api repos/OWNER/REPO/pages`：
     - 回傳 404（尚未啟用）→ `gh api -X POST repos/OWNER/REPO/pages -f "source[branch]=gh-pages" -f "source[path]=/"`
     - 已啟用但來源不是 `gh-pages` → `gh api -X PUT repos/OWNER/REPO/pages -f "source[branch]=gh-pages" -f "source[path]=/"`
   - 從回應的 `html_url` 取得網址（通常是 `https://OWNER.github.io/REPO/`）。

8. **驗證部署**
   - 每 15 秒查一次 `gh api repos/OWNER/REPO/pages/builds/latest --jq .status`，最多約 5 分鐘，直到 `built`；若為 `errored`，停止並回報 `.error.message`。
   - 用 `curl -s -o /dev/null -w "%{http_code}" <網址>` 確認回傳 `200`，並確認頁面中引用的 `assets/*.js` 也能取得 `200`。第一次啟用時 CDN 可能要多等一兩分鐘。

9. **回報結果**
   - 以清楚的格式回報：
     - ✅ 部署狀態
     - 🔗 網址（`https://OWNER.github.io/REPO/`）
     - 📦 Repo 網址（`https://github.com/OWNER/REPO`）
     - 本次是否新建了 Repo
   - 提醒：GitHub Pages 只提供靜態檔案，本專案的 SQLite API 伺服器（`server/index.mjs`）無法執行，所以線上版的登入和分數功能都不能用，只能用訪客模式玩前端遊戲。
