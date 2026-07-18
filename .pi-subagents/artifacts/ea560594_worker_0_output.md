Everything checks out. Here's the full acceptance report:

---

## ✅ Implementation Complete — Path A

### Changed Files Summary

| # | File | Change | Status |
|---|---|---|---|
| 1 | `src/hooks/useAuth.js` | `API_BASE_URL = import.meta.env.VITE_API_URL \|\| "/api"` | ✅ |
| 2 | `src/hooks/useChat.js` | Same | ✅ |
| 3 | `src/hooks/useSessions.js` | Same | ✅ |
| 4 | `src/components/Login.jsx` | Same | ✅ |
| 5 | `src/components/ForgotPassword.jsx` | Same | ✅ |
| 6 | `src/components/ResetPassword.jsx` | Same | ✅ |
| 7 | `src/components/VerifyEmail.jsx` | Same (single quotes preserved) | ✅ |
| 8 | `vercel.json` | Added Render URL to CSP `connect-src`; removed `/api/(.*)` rewrite | ✅ |
| 9 | `api/email.js` | `APP_URL = process.env.APP_URL \|\| process.env.RENDER_EXTERNAL_URL` | ✅ |
| 10 | `api/index.js` | Added `https://tuon-ai.vercel.app` to CSP `connect-src` | ✅ |
| — | `src/components/MainLayout.jsx` | Unintended whitespace (blank line removed, no functional impact) | ⚠️ |

### Validation

- **Lint**: 0 errors, 1 pre-existing warning (useChat.js:346 — unrelated `useCallback` dependency)
- **Build**: ✅ 203 modules transformed, built in 492ms, no errors
- **No staged files**: All changes are unstaged working-tree modifications

### Residual Risks / Manual Steps Required

| Step | Where | What |
|---|---|---|
| 🔧 Render dashboard | Environment Variables | Add `CORS_ORIGIN=https://your-app.vercel.app` and `APP_URL=https://your-app.vercel.app` |
| 🔧 Vercel dashboard | Environment Variables | Add `VITE_API_URL=https://tuonai-worrie.onrender.com` |
| 🔧 `api/index.js` | Line 35 CSP | Update `https://tuon-ai.vercel.app` to your actual Vercel domain (or remove — it's harmless but unnecessary) |
| 🔧 Step 4 (later) | `api/index.js` lines 562-569 | Remove static file serving and SPA catch-all AFTER Vercel is confirmed working |
| 🔧 Vercel dashboard | Git settings | Connect repo, set Framework: **Vite**, Build: `npm run build`, Output: `dist` |