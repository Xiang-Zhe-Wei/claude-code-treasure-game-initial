---
description: 將本地專案建置並部署到 Vercel，完成後回報部署 URL
argument-hint: "[prod]  （加上 prod 代表部署到 production，預設為 preview）"
allowed-tools: Bash(npm:*), Bash(npx:*), Bash(vercel:*), Bash(node:*), Bash(cat:*), Bash(ls:*), Read, Write
---

請將目前這個專案部署到 Vercel，並在完成後告訴我部署的 URL。

參數：`$ARGUMENTS`（若包含 `prod`，部署到 production；否則部署 preview）

## 步驟

1. **檢查 Vercel CLI**
   - 執行 `vercel --version`；若找不到指令，改用 `npx vercel@latest`（後續所有 `vercel` 指令都用同樣方式呼叫）。

2. **檢查登入狀態**
   - 執行 `vercel whoami`。
   - 若尚未登入，**停下來**，請我在提示列輸入 `! vercel login` 完成登入後再繼續。不要自行嘗試互動式登入。

3. **本地建置驗證**
   - 若沒有 `node_modules`，先執行 `npm install`。
   - 執行 `npm run build`，確認建置成功。注意本專案輸出目錄是 `build/`（不是 `dist/`）。
   - 建置失敗就停止，並回報錯誤訊息。

4. **確認 Vercel 設定**
   - 讀取專案根目錄的 `vercel.json`，確認 `outputDirectory` 為 `build`、`buildCommand` 為 `npm run build`。
   - 若檔案不見了，重新建立：
     ```json
     {
       "$schema": "https://openapi.vercel.sh/vercel.json",
       "framework": "vite",
       "installCommand": "npm install",
       "buildCommand": "npm run build",
       "outputDirectory": "build"
     }
     ```

5. **部署**
   - Preview：`vercel deploy --yes`
   - Production（參數含 `prod`）：`vercel deploy --prod --yes`
   - `--yes` 會在第一次部署時自動建立並連結專案。

6. **回報結果**
   - 從指令輸出擷取部署 URL（`https://....vercel.app`）。
   - 以清楚的格式回報：
     - ✅ 部署狀態
     - 🔗 部署 URL
     - 環境（Preview / Production）
   - 提醒：本專案的 SQLite API 伺服器（`server/index.mjs`）無法在 Vercel 上執行，所以登入／分數功能在線上版本不可用，只有前端遊戲（可用訪客模式遊玩）。
