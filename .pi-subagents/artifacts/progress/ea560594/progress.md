# Progress: Config File Updates (vercel.json, api/index.js, api/email.js)

**Status:** Complete
**Date:** 2026-07-14

## Changes Made

### 1. `vercel.json`
- ✅ Removed the API rewrite: `{ "source": "/api/(.*)", "destination": "/api/index.js" }`
- ✅ Updated CSP `connect-src` to include `https://tuonai-worrie.onrender.com`
- Kept SPA rewrites for client-side routing intact

### 2. `api/index.js` (line 35)
- ✅ Added `https://tuon-ai.vercel.app` to CSP `connect-src` alongside `'self'` and `https://*.supabase.co`

### 3. `api/email.js` (line 5)
- ✅ Changed to fallback: `const APP_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;`
- Render dashboard needs `APP_URL` env var set to Vercel frontend URL

## Verification
- ✅ `npm run build` passed (203 modules, 560ms, no errors)
- ✅ All 3 files verified by re-read
- ✅ No staged files in git
