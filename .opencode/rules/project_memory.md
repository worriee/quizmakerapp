# Project Memory & Context Tracker

## 0. Last Synchronized Checkpoint

- **Last AI Analysis Timestamp**: July 11, 2026, 04:34 pm PST

## 1. Project Overview

**TUON AI** is an AI-powered learning platform that lets users explore topics, generate structured notes, and take interactive quizzes. The app maintains persistent chat sessions, parses AI reasoning, and presents content in a clean, responsive UI.

- **Core Goals** – Seamless AI-driven learning, persistent session history, and structured knowledge extraction.
- **Active Constraints** – Vercel serverless functions enforce a 15 s timeout; all AI calls are wrapped with safeguards and the request timeout is set to 30 s. Streaming responses are subject to the 10s function timeout on Vercel Hobby plan.
- **Boot Logic** – A state-machine boot sequence restores authentication and session data deterministically. Network errors during boot show a "Connection Lost" banner with a Retry button instead of silently failing. A 15-second watchdog prevents infinite hang states.
- **Authentication** – Custom JWT-based auth with 1-day expiry, bcrypt, HTTP-only cookies, account lockout (5 attempts/15 min), email verification, and password reset via Resend.
- **AI Routing** – All generation is unified through a multi-provider OpenAI-compatible dispatcher supporting Google Gemini and NVIDIA NIM models with per-model rate limiting.
- **PWA** – Self-contained service worker (no CDN dependencies), manifest, offline fallback page, and platform-specific icons.
- **Security** – 16/16 SEC vulnerabilities resolved. CSP headers, input sanitization, prompt injection detection, SSRF protection, body size limits, and verbose error logging fix.

## 2. Current Architecture & Tech Stack

- **Languages** – JavaScript, JSX, CSS
- **Frameworks / Libraries** – React 19, Vite 8, Tailwind CSS 4, Express, @google/generative-ai, @supabase/supabase-js, react-markdown + remark-gfm
- **Testing** – Vitest v4 (test infrastructure available, 0 test files present — all cleaned via `-clean`), @testing-library/react, jsdom
- **Database / Storage** – Supabase (PostgreSQL) with a Backend-Proxy architecture; RLS enabled with deny-all public policy on ALL tables (profiles, chat_sessions, messages, quiz_attempts, review_items, shared_quizzes, collections, session_collections); all data access goes through API endpoints using the `service_role` client
- **Authentication** – Custom JWT with bcrypt, HTTP-only cookies, 7-day expiry; `authenticate` middleware protects `/api/chat`, `/api/sessions`, and session write routes
- **Key Modules / Directories**
  - `server.js` — Render entry point (imports Express app, starts listening)
  - `src/` – Front-end React code
  - `src/hooks/` – Custom React hooks (`useAuth.js`, `useChat.js`, `useSessions.js`, `useTheme.js`, `useCustomModels.js`)
  - `src/components/` – UI components (`ChatInterface`, `MainLayout`, `Login`, `QuizInterface`, `QuizSummary`, `QuizSetup`, `ModelSelector`, `CustomLLMModal`)
  - `src/utils/` – Utilities (`aiParser.js`, `customModelStorage.js`)
  - `api/` – Vercel serverless endpoints (`index.js` at 408 lines, Phase 1 complete: `messages` table is sole storage, `history` column dropped; `ai.js`, `auth.js`)
  - `src/assets/` – Imported PNG icons (`thumbtacks.png`, `edit.png`, `delete.png`, `logout.png`)
  - `public/` – Static PWA assets (`manifest.json`, `pwabuilder-sw.js`, `offline.html`, `changelog.json`, `android/`, `ios/`, `windows/` icons)
  - `e2e/` – Playwright end-to-end tests (`app.spec.js`)
  - Test files: `src/**/*.test.js`, `api/**/*.test.js` (8 test files, 192 unit tests)

---

## 3. Core Features & Business Logic

- **AI Reasoning**: AI responses are parsed through a unified model-agnostic parser that handles `<thought>`, `<thinking>`, or ANY thinking-tag variant via flexible `(\w*think\w*)` regex. A `normalizeOutput()` step cleans spacing for all models. The parser handles tagged JSON, untagged JSON (found anywhere in the text), plain markdown, and raw text fallback — works with Step 3.7 Flash, Gemini 3.1 Flash Lite, custom local LLMs, and any future OpenAI-compatible model.
- **Session Persistence**: Chat histories are stored as individual rows in the `messages` table (`session_id`, `role`, `content`, `position`). The old `history` JSONB column in `chat_sessions` was dropped in Phase 1 Week 4 — `messages` is the sole source of truth for conversation data. Sessions are pinned, renamed, deleted, and sorted by pin status and creation time. `chat_sessions` has `updated_at` auto-populated via trigger. Future tables are pre-created and empty (ready for Phase 2+): `quiz_attempts`, `review_items`, `shared_quizzes`, `collections`, `session_collections`.
- **Smart Titles**: The AI generates short session titles on the first response, constrained by a strict SYSTEM_PROMPT instruction ("5 words max, no articles The/A/An") plus a client-side `trimTitle()` function in `aiParser.js` that strips leading articles and truncates to 30 chars. This produces concise titles like "API Key Explained" instead of verbose AI output. The `title` from `<title>` tags flows through `parseAIResponse` → `trimTitle` → saved as session topic in `useChat.js`.
- **Interactive Quizzing**: The AI generates JSON quiz data which is rendered in `ChatInterface` or `QuizInterface`. Difficulty tiers (Easy, Normal, Hard) drive prompt generation. Wrong answers are tracked and fed into a "Focus on Growth Areas" retry loop.
- **Multi-Provider AI**: Users can switch between `Gemini 3.1 Flash`, `Step 3.7 Flash`, and `GLM 5.1`. The selection is persisted in `localStorage` and sent with every `/api/chat` call.
- **PWA**: The app is installable with a manifest, service worker, and offline page. The service worker serves `offline.html` when navigation fails.

---

## 4. Current State & Active Focus

### Active Tasks

- **[July 11, 2026, 04:34 PM PST] Full Project Reset**: Both `main` and `beta` branches were reset to commit `8eec977` (before streaming fixes and Render migration). All commits after that point (phase 2.1 streaming fixes, Render migration, parser patches) were removed. The app is back to SSE streaming with the original implementation, deployed on Vercel. FLOW-017 (multi-phase roadmap) is preserved as a reference. All ERR-057 through ERR-064 entries in error_memory.md document the full history even though the code is gone.

### Completed Milestones

- **Full Project Reset to Commit 8eec977** (July 11, 2026, 04:34 PM PST): Both `main` and `beta` branches reset via `git reset --hard` and force push. This removed: Render deployment migration, all streaming fixes (line-buffered reader, setNoDelay, trust proxy, SYSTEM_PROMPT_TAGS enforcement, JSON escape handling, stripTrailingThinking, tryParseJson), and all test files. The app now runs on Vercel with the original SSE streaming implementation from commit `46219dd`. ERRs 057-064 document the full history of what was built and then reverted.

- **Phase 1 — Database Schema Modernization** (July 9, 2026, 11:32 AM PST): Full zero-downtime migration from JSONB history blobs to a relational `messages` table. 
  - **Week 1**: Created `messages` and 5 future tables; implemented dual-write in `api/index.js` (writes to both blob and table); enabled RLS on all new tables.
  - **Week 2**: Backfilled all existing conversation blobs into `messages` rows; verified matching counts (4 = 4).
  - **Week 3**: Switched reads in `GET /api/session/:id` to read exclusively from `messages` table; added unique constraint on `(session_id, position)`.
  - **Week 4**: Dropped the old `history` column from `chat_sessions` and removed dual-write logic in `api/index.js`. All conversation data now lives exclusively in the `messages` table. Phase 1 is fully complete.

- **Render Deployment Migration** (July 10, 2026, 10:54 PM PST): Migrated from Vercel-only deployment to Render full-stack (Option B). Root cause: Vercel Hobby plan's 10-second serverless timeout killed AI streaming responses mid-stream. Fix:
  1. Removed `server.js` from `.gitignore` so Render can use it as the entry point.
  2. Added Express CSP middleware with `manifest-src` and `worker-src` directives.
  3. Added `express.static("dist")` and catch-all `app.get("*")` route so the same server serves both the React frontend and the API.
  4. Render Build Command: `npm run build`. Start Command: `node server.js`.
  5. Environment variables set in Render dashboard (same as Vercel).
  6. The app now runs as a persistent Node.js process on Render — no 10-second function timeout. Streaming works. Cold start ~30-50s after 15 min idle.

- **Session Title Flicker Fix — Title Race Condition on Retry** (July 9, 2026, 10:22 AM PST): Fixed a race condition where the session title flickered when the first 2 AI prompts failed and the 3rd succeeded. Root cause: `topic` variable in `useChat.js` used `sessions.find(...)?.topic` (old title from React state) instead of the AI-generated `title` when available. Fix: added `title ||` fallback in topic computation at lines 244 and 282. Both `renameSession` and `saveSessionToDb` now write the same AI-generated title — no race, no flicker.

- **Unified Model-Agnostic AI Parser** (July 8, 2026, 02:09 PM PST): Built a comprehensive, model-agnostic `parseAIResponse` pipeline that handles ANY OpenAI-compatible model's output consistently. Added `normalizeOutput()` function in `src/utils/aiParser.js` — a universal output cleaner that unescapes `\n`, ensures blank lines before `##` headers, fixes `##Header` spacing, adds blank lines before `-` bullet points, deduplicates excessive blank lines, and strips trailing whitespace. Changed tag matching from hardcoded `(?:thought|thinking)` to flexible `(\w*think\w*)` with backreference — matches `<thought>`, `<thinking>`, `<THINK>`, `<thought_process>`, or ANY future thinking-tag variant. Updated `tagRegex` to strip common structural tags: `think*`, `final`, `title`, `reasoning`, `analysis`, `output`, `response`. Made JSON fallback extraction location-agnostic (regex search, not `startsWith("{")`), handling extra text before/after JSON. Reverted notes JSON extraction to keep full JSON consistently. No model-specific if/else branches anywhere. Resolved ERR-052 (inconsistent AI output across models). Fixes both Gemini (messy `<thinking>` tags, raw `\n` characters) and Step 3.7 Flash (missing spacing). Lint 0 errors, build compiles. Added `normalizeOutput()` function in `src/utils/aiParser.js` — a universal output cleaner that unescapes `\n`, ensures blank lines before `##` headers, fixes `##Header` spacing, adds blank lines before `-` bullet points, deduplicates excessive blank lines, and strips trailing whitespace. Changed tag matching from hardcoded `(?:thought|thinking)` to flexible `(\w*think\w*)` with backreference — matches `<thought>`, `<thinking>`, `<THINK>`, `<thought_process>`, or ANY future thinking-tag variant. Updated `tagRegex` to strip common structural tags: `think*`, `final`, `title`, `reasoning`, `analysis`, `output`, `response`. Made JSON fallback extraction location-agnostic (regex search, not `startsWith("{")`), handling extra text before/after JSON. Reverted notes JSON extraction to keep full JSON consistently. No model-specific if/else branches anywhere. Resolved ERR-052 (inconsistent AI output across models). Fixes both Gemini (messy `<thinking>` tags, raw `\n` characters) and Step 3.7 Flash (missing spacing). Lint 0 errors, build compiles.

- **Session Menu Always Visible + AI Title Error Recovery** (July 8, 2026, 01:08 PM PST): Removed `opacity-0 group-hover:opacity-100` from the session context menu button in `MainLayout.jsx:161` so the three-dot (pin, rename, delete) menu is always visible instead of only on hover. Fixed AI title generation failing silently when first prompt errors out (timeout, network error). Added `renameSession` as a dependency to `useChat` hook in `App.jsx`. When AI responds with a title (even on retry after first-prompt failure), `renameSession(sessionId, title)` fires to update the session title to match the actual AI response instead of keeping the truncated error message. Works for both chat and quiz flows. Attempted to improve AI output formatting in `api/ai.js` SYSTEM_PROMPT with mandatory markdown rules (bullet points, bold, headers) but the model (Step 3.7 Flash) inconsistently followed instructions and leaked `##` syntax into session titles. Reverted formatting prompt changes to original plain-text guidelines. Bold text rendering already works from the AI's natural output via the existing `ReactMarkdown` prose renderer.

- **AI-Generated Short Titles** (July 8, 2026, 11:48 AM PST): 

- **AI-Generated Short Titles** (July 8, 2026, 11:48 AM PST): Reverted from client-side `generateTitle()` to AI-generated titles with strict short-title enforcement. Updated `api/ai.js:31` SYSTEM_PROMPT to instruct "5 words max, no articles (The, A, An)" with concrete short-title examples. Added `trimTitle()` function in `aiParser.js` that strips leading articles and truncates to 30 chars at word boundary — applied to both `<title>` tag and `Title:` line fallback. Reverted `useChat.js` to original topic assignment logic: `!currentSessionId ? title || fallbackTitle || text : sessions.find(...)`. Removed `generateTitle` import and `getTopic` helper. Fixed `sendMessage` dependency array to include `sessions` directly. Lint 0 errors, build compiles.

- **Phase 0, Step 0.3 — Connection-Lost Retry Banner** (July 8, 2026, 11:02 AM PST): Implemented a visible "Connection Lost → Retry" banner that appears when the boot sequence fails due to network issues. Modified `useAuth.js` to distinguish between 401 auth failures (→ Login) and network errors/timeouts (→ CONNECTION_ERROR banner). Added `retryBoot()` function to re-run the boot sequence on button click. Changed the 15-second watchdog from forcing `READY` to showing `CONNECTION_ERROR` instead. Used `Promise.allSettled` for the AUTHENTICATING phase so that if both `fetchSessions` AND `restoreActiveSession` fail simultaneously, the user gets the retry banner instead of a silent empty sidebar. Updated `App.jsx` with a new `CONNECTION_ERROR` render branch showing a warning icon, "Connection Lost" message, and Retry button. Moved the save status indicator dot (sync status) from between the theme toggle and profile avatar to the LEFT of the theme toggle in `MainLayout.jsx:333-382`. Created `useAuth.test.js` (later cleaned) with 8 unit tests verifying: boot success path, 401 → UNAUTHENTICATED, network error → CONNECTION_ERROR, total data fetch failure → CONNECTION_ERROR, partial failure → still READY, retryBoot re-runs boot, logout clears state. All 8 tests passing, lint 0 errors, build compiles. **Step 0.3 is complete, Phase 0 is fully finished.**

- **Phase 0, Step 0.2 — Test Infrastructure Expansion** (July 6, 2026, 09:38 AM PST): Expanded Vitest unit tests from 58→192 tests. Created 4 new test files for hooks (useTheme: 7, useCustomModels: 10, useSessions: 11, useChat: 15). Expanded Playwright E2E tests from 3→10. Coverage: ~95% on utilities, ~95% on hooks. All 192 unit tests + 10 E2E tests passing.

- **Full Security Hardening** (July 1, 2026, 11:49 AM PST): Resolved all 16 SEC vulnerabilities from the original audit. Implemented: CSP headers (SEC-013), input sanitization with prompt injection detection (SEC-012), custom LLM history consent toggle (SEC-011), password strength validation with common password blocklist (SEC-010), per-account lockout with email notification (SEC-009), JSON.parse error handling (SEC-008), request body size limit (SEC-007), JWT 1-day expiry (SEC-006), verbose error logging fix (SEC-005), self-hosted Workbox (SEC-004), email verification (SEC-003), password reset (SEC-002). Integrated Resend email service. Security score: 10/10.

- **Per-Model Rate Limiting** (July 1, 2026, 10:29 AM PST): Replaced global chat limiter with model-aware rate limiting. Google Gemini: 15 RPM, NVIDIA NIM: 40 RPM, Custom: 20 RPM. Each IP+model has independent counter.

- **Version 1.0.2 Release** (June 30, 2026, 06:27 PM PST): Released version 1.0.2 with two key improvements: (1) Fixed custom model generated output by removing thinking text so it displays final output only. (2) Fixed mobile responsiveness of adding custom LLM UI. Updated changelog.json and MainLayout.jsx version tag.

- **Code Formatting Standardization** (June 29, 2026, 10:58 AM PST): Updated quote style from single to double quotes across `App.jsx`, `main.jsx`, and `supabaseClient.js` for consistency. Improved code readability with better indentation and line breaks throughout the codebase.

- **SEC-015 SSRF Remediation** (June 29, 2026, 10:55 AM PST): Implemented frontend + backend URL validation for custom LLM base URLs. `CustomLLMModal.jsx` now validates URL format (http/https only, max 500 chars, `new URL()` check) with inline error messages. `api/ai.js` now validates URLs server-side before every `fetch()` call. Private IPs (localhost, 192.168.x, etc.) intentionally allowed for local LLMs. Security score improved from 3/10 to 4/10.
- **Full Security Audit** (June 28, 2026, 1:15 PM PST): Comprehensive codebase security audit. Identified 15 vulnerabilities: 2 critical (SSRF, localStorage API keys), 3 high (no CSP, no input sanitization, history exfiltration), 5 medium (weak passwords, no lockout, JSON.parse crash, no body limits, long JWT), 4 low (verbose logging, CDN supply chain, no email verification, no password reset). Only SEC-015 (Supabase Backend-Proxy) verified as secure. Score: 3/10.
- **AI Parser Comprehensive Rewrite for Custom Models** (June 27, 2026, 10:36 AM PST): Fixed persistent issues with custom/local models (Gemma 4) that output structured plain text instead of proper `<thought>`/`<final>` tags. Three-pronged fix: (1) `stripThinkingText()` now detects `Final:`, `Response:`, `Answer:` markers and extracts content after the last one, stripping short label prefixes like "Plain text explanation." — falls back to greeting detection if no markers found. (2) `isMostlyThinking()` patterns generalized (`/I need/i`, `/I will/i`) to catch more thinking variants. (3) `parseAIResponse()` now extracts title from plain text `Title:` line when `<title>` tags are absent. Combined with previous `fallbackTitle` extraction and title clearing, this ensures clean session titles and chat output regardless of model output format. Resolved ERR-043.
- **Quiz Button Empty Chat Guard & Back to Chats Fix** (June 26, 2026, 10:30 AM PST): Added empty chat check to Quiz button — if `messages.length === 0`, clicking Quiz silently returns without navigating to QuizSetup. Fixed "Try Another Topic" button in `QuizSummary` — renamed to "Back to Chats" and fixed prop name mismatch (`onReset` → `onResetToChat` in `App.jsx:770`) that caused the button to be non-functional. Build verified.
- **Custom LLM Configuration Popup** (June 26, 2026, 10:15 AM PST): Created dedicated popup modal for configuring custom LLM settings (base URL, API key, model ID). Moved form from inline dropdown to separate `CustomLLMModal` component matching app theme (`#7b9acc` blue, `#FCF6F5` creamy beige). Updated `ModelSelector` to use modal with proper state management. Build verified successful.
- **Local Environment Setup** (June 26, 2026, 09:15 AM PST): Created `beta` branch in GitHub repo for local testing. Populated `.env` file with Vercel environment variables (placeholder values): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GOOGLE_API_KEY`, `NVIDIA_API_KEY`. Logical OR fallback pattern already implemented in `src/supabaseClient.js:4-5` and `api/auth.js:21` for seamless Vercel-to-local environment switching.
- **Responsive UI Overhaul** (FLOW-011): Fixed header overlap by replacing `absolute left-1/2 -translate-x-1/2` ModelSelector centering with a flex-wrap layout. ModelSelector wraps to its own row on mobile (`order-last sm:order-none`). Profile popup now uses `absolute right-0 top-full mt-2` relative to avatar container instead of `absolute right-4 top-16` relative to `<main>`. Save status indicator hides text on mobile (`hidden sm:inline`). ChatInterface, QuizSetup, and QuizInterface all received responsive padding and font-size adjustments for 6.4"–6.8" screens. ERR-040 finally resolved using TWA wrapping (assetlinks.json + PWABuilder APK) to fully hide the address bar on Android.
- **Changelog Modal** (FLOW-010): Replaced the floating announcement banner with a clickable version tag that opens a modal showing full changelog from `public/changelog.json`. Version tag shows a notification dot on new versions (compared against `quizmaker_dismissed_version` in localStorage). Closing the modal marks the current version as seen. Moveable, reusable changelog system for future updates.
- **Local LLM Option** (FLOW-008): Added support for user-provided custom/local LLMs. Users can add any OpenAI-compatible local server (Ollama, LM Studio, etc.) via the ModelSelector dropdown with name, base URL, model ID, and optional API key. Custom models are persisted in localStorage and included in all chat/quiz API requests. Backend (`api/ai.js`) accepts dynamic model configs that bypass the fixed `MODEL_CONFIGS` lookup for full flexibility.
- **Announcement Banner** (FLOW-009): Added a floating announcement bar at the top of the main content area with a close button (x) and localStorage dismissal persistence. Shows "TUON AI v1.0.0" with a companion message. Dismissed state survives page refreshes.
- **Quiz Interface Progress UI Enhancement**: Removed the dotted progress indicator from `QuizInterface.jsx` and enhanced the progress text UI on the right side. Progress now shows "Question **1** of **5**" with bold numbers, brand blue text, and a smoother progress bar. This creates a cleaner, more professional quiz experience with more vertical space for questions.
- **Component Dependency Documentation**: Added comprehensive "Component Dependency Chain" section to `project_memory.md` with tables showing who-depends-on-whom for both frontend and backend. Enriched Critical Codebase Registry with dependency annotations for all files.
- **Cookie Clear Fix**: Corrected `res.clearCookie` in `/api/auth/logout` to include `httpOnly`, `secure`, `sameSite`, and `path` options matching the login cookie.
- **Markdown Sanitization**: Installed and wired `rehype-sanitize` into `ReactMarkdown` in `ChatInterface.jsx` to prevent XSS via rendered markdown.
- **Server-Side Input Validation**: Added email format validation (`EMAIL_REGEX`) in `api/auth.js` for both signup and login; added request body validation for session and chat endpoints in `api/index.js`.
- **Auth Middleware Deduplication**: Exported `authenticate` middleware from `api/auth.js` and used it across all protected routes in `api/index.js`, removing ~120 lines of duplicated JWT verification code.
- **CORS Hardening**: Restricted CORS `origin` to production domain (`https://quizmakerapp.vercel.app`) in production; configurable via `CORS_ORIGIN` environment variable.
- **Rate Limiting**: Wired up `express-rate-limit` for `/api/auth/*` (20 req/15min) and `/api/chat` (30 req/min) endpoints in `api/index.js`.
- **Supabase Security**: Removed `VITE_SUPABASE_ANON_KEY` fallback from `supabaseService` and ensured it crashes if `SUPABASE_SERVICE_ROLE_KEY` is missing.
- **JWT Security**: Removed hardcoded JWT fallback secrets and ensured the app crashes if `JWT_SECRET` is missing.
- **Version Tag UI**: Added a `v1.0.0` tag beside the hero quote in `ChatInterface` header, wrapped in a small rounded border using brand colors.
- **Quiz Stuck at Question 2** (ERR-028): Fixed by correctly updating `history` in `handleQuizAnswer` and persisting progress.
- **TDZ Resolution**: Fixed white screen crash by reordering `useCallback` declarations in `App.jsx` to avoid forward references.
- **Quiz Progress UI**: Added a stepped progress indicator in `QuizInterface` and fixed "Take Another Topic" to preserve the current chat session.
- **Multi-Provider Architecture**: Supports Google Generative AI (`gemini-3.1-flash-lite`) and NVIDIA NIM (`step-3.7-flash`, `glm-5.1`) through a single dispatcher.
- **Unified AI Config**: Moved Gemini 3.1 Flash Lite into `MODEL_CONFIGS`, unifying all model calls through `callOpenAICompatibleAPI`.
- **Model Persistence**: Implemented `selectedModel` persistence via `localStorage` in `App.jsx` using `MODEL_STORAGE_KEY` and `DEFAULT_MODEL`.
- **NVIDIA NIM Fix**: Resolved 404 errors by correcting the endpoint URL concatenation to `${baseUrl}/chat/completions` in `api/ai.js`.
- **Model Cleanup**: Removed Gemma 4 31B from `ModelSelector` and `MODEL_CONFIGS`.
- **Auto-Start Quiz from Chat Intent** (FLOW-004): Implemented and stabilized so `view` switches to `'quiz'` only after `quizData` is populated; `QuizInterface` includes a defensive loading state.
- **Boot Sequence Watchdog**: Added anti-hang timeout logic so the app never stalls on the loading screen.
- Replaced SVG icons in `MainLayout.jsx` with imported assets (`thumbtacks.png`, `edit.png`, `delete.png`, `logout.png`).
- **Enhanced Quiz Experience** (FLOW-003):
  - New `QuizSetup` view for item count and difficulty selection.
  - Dynamic AI prompting based on difficulty tiers (Easy, Normal, Hard).
  - Integrated `wrongAnswers` tracking in `handleQuizAnswer`.
  - Implemented "Focus on Growth Areas" targeted retry loop in `QuizSummary`.
- Refactored session context menu in `MainLayout.jsx` for a professional, clean layout with animations.
- **Custom JWT Auth Migration** (FLOW-002): Fully implemented custom JWT authentication with bcrypt password hashing and HTTP-only cookie storage; Supabase Auth completely removed from frontend.
- **Automated Session Management** (FLOW-001): Smart titles, session creation on first AI response, and enhanced sidebar UI.
- **Bug Fix**: Resolved User Profile popup toggle race condition.
- **Mobile Responsiveness**: Optimized sidebar as a mobile overlay and implemented responsive typography for modern smartphones (6.4" to 6.8").
- **UX/UI Refinement**: Added hero quote, footer disclaimer, attribution `-Jul`, and removed decorative emojis for a professional look.
- **Theme Migration**: Implemented "Warm Minimalist" theme using a creamy beige (`#F5F2E9`) and golden-brown (`#C5A059`) palette, later refined to brand colors `#7b9acc` and `#FCF6F5`.
- **Rebranding**: Full transition from "Quiz Maker" to "**TUON AI**" across all UI and metadata.
- Implemented User Profile and Logout UI in the sidebar, including a profile popup with user details and logout functionality.
- Conducted full codebase cleanup (removed unused components, redundant logs).
- Resolved Empty Sidebar on Saved Login (ERR-008).
- Implemented Sidebar session management (Delete, Rename, Pin).
- Fixed initial feedback bug in Quiz Mode.
- Improved AI response parsing to handle untagged JSON.
- Resolved AI response hangs in serverless by switching to `generateContent` and then to a unified OpenAI-compatible dispatcher.
- Fixed server-side `ReferenceError` and `SyntaxError` in `api/index.js`.
- Fixed Supabase session retrieval hang (state-first + timeout).
- Fixed sequential prompt failure bug (history format).
- Resolved Refresh State Loss and Session Freeze regressions.
- **PWA Conversion** (FLOW-005): Implemented `manifest.json`, `pwabuilder-sw.js`, `offline.html`, registered the service worker in `src/main.jsx`, linked the manifest in `index.html`, and added the icon assets to the manifest. Verified with a successful production build (`npm run build`).

---

### Pending Tasks

- for the offline html it seems like the offline css isnt working too and i can see a random letter T in the above what is that? remove it if unecessary.

- **[ACTIVE ROADMAP] TUON AI Multi-Phase Roadmap (FLOW-017)** (July 5, 2026, 04:42 PM PST): Full implementation roadmap approved by user (3rd-year college student developer). Logged in full with all visual diagrams in `implementation_memory.md` under entry `[FLOW-017]`. The plan is a strict 4-phase sequence (each phase must complete before the next starts), estimated at ~210 hours / ~12 weeks part-time work.
  - **Phase 0 — Refactor + Tests** (~2-3 weeks): ✅ **Step 0.1 COMPLETE** (July 6, 2026, 01:57 PM PST). Decomposed `App.jsx` (897 lines → 194 lines, 78% reduction) into 5 focused hooks. ✅ **Step 0.2 COMPLETE** (July 6, 2026, 01:57 PM PST). Added Vitest + Playwright test infrastructure. 192 unit tests across 8 test files. All 192 tests passing. 10 Playwright E2E tests. Coverage: ~95% utilities, ~95% hooks. ✅ **Step 0.3 COMPLETE** (July 8, 2026, 11:02 AM PST). Connection-lost retry banner implemented. Network errors during boot now show "Connection Lost" with Retry button instead of silently falling to Login or showing an empty sidebar. Phase 0 is fully complete.
  - **Phase 1 — Database Schema Modernization** (~4 weeks): ✅ **COMPLETE** (July 9, 2026, 11:32 AM PST). Fully migrated from JSONB `history` blob to relational `messages` table. Implemented dual-write, backfilled existing data, switched reads to new table, and dropped old column. All 8 target tables created and RLS-secured. **Next: Phase 2** (Core Features: Streaming + Search + Collections).
  - **Phase 2 — Core Features: Streaming + Search + Collections** (~3-4 weeks):

    **Pre-requisite**: Phase 1 complete (messages are individual rows, so search is possible).

    **Pre-Phase 2 TASK — Increase AI timeout**: Before starting streaming, change `30000` → `60000` in both `timeoutPromise(30000)` calls at `api/ai.js:309` and `api/ai.js:341`. This gives the AI a full 60 seconds to respond and stops the "AI is taking too long" errors. The streaming endpoint in Phase 2.1 will replace this wall-clock timeout with an idle timeout anyway, but this quick bump helps immediately (2-minute change, zero risk).

    **2.1 — Streaming AI Responses (chat only, NOT quiz)** (~2 weeks)

    **What it does today**: User sends message → 8 seconds of blank loading → all text appears at once. Feels slow.

    **What streaming does**: Text appears word-by-word as the AI generates it, like ChatGPT. User sees progress immediately.

    **How it works**: Backend sends AI request with `stream: true` flag. AI responds with small chunks via SSE (Server-Sent Events). Backend reads each chunk and forwards it to frontend via a `ReadableStream`. Frontend appends chunk text to the screen progressively.

    **Backend changes**:
    - `api/ai.js`: New `callOpenAICompatibleAPIStream()` function — same logic as existing but adds `stream: true` to request body, reads response as chunks via `response.body.getReader()`, and writes each chunk to the HTTP response via `res.write()`.
    - `api/index.js`: New `POST /api/chat/stream` route — sets SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`), calls the streaming function. Listens for `req.on('close', ...)` for abort handling. Accepts `?token=xxx` JWT query param for auth (SSE doesn't reliably send cookies on all browsers).
    - **Idle timeout instead of wall-clock timeout**: Tracks `lastChunkTime`. If no chunk arrives for 20 seconds, closes the stream with an error event. This is different from the 30s wall-clock timeout on the buffered endpoint (which kills the request if the AI hasn't responded at all within 30s). Idle timeout only fires when the AI starts responding but then goes silent.

    **Frontend changes**:
    - `src/hooks/useChat.js`: `sendMessage` checks if response is chat (→ streaming endpoint) or quiz (→ existing buffered endpoint). For streaming: uses `fetch()` with `response.body.getReader()` and `TextDecoder`, accumulates chunks into a `streamingContent` state, updates UI progressively. On stream complete, runs `parseAIResponse()` on the full accumulated text to extract title/thought/final. `stopGenerating()` aborts both the frontend fetch AND signals the backend to cancel the AI call.
    - `src/components/ChatInterface.jsx`: Show text appearing progressively with a blinking cursor `|` at the end. Replace the three-dot loading indicator during streaming. Add a "Cancel" button that calls `stopGenerating()`.

    **What stays the same**: Quiz generation stays on the old non-streaming `POST /api/chat` endpoint. Quiz JSON must arrive as a complete payload — you can't `JSON.parse()` a half-finished object. `startQuiz()` and `quizAnswer()` continue using the buffered flow.

    **Caution — NEVER JSON.parse partial stream data**: The AI sends `<thought>` and `<final>` tags mid-stream. Buffer the full raw text. Only run `parseAIResponse()` once the stream ends. Parsing a partial `<final>` tag containing quiz JSON would crash the app.

    **2.2 — Global Search (Ctrl+K)** (~1 week)

    **What it does today**: Users scroll the sidebar manually. With 50+ sessions, finding old chats is tedious.

    **What search does**: Press `Ctrl+K` (or click search icon), type a word, see results from BOTH session titles AND message content. Phase 1 made this possible — messages are now individual rows in the `messages` table, so one SQL `ILIKE` query finds everything instantly.

    **Backend changes** (`api/index.js`):
    - New `GET /api/sessions/search?q=...` endpoint — queries `chat_sessions.topic` and `messages.content` using `ILIKE`. Requires `authenticate` middleware. Returns `{ titleMatches, contentMatches }`.
    - **IMPORTANT**: The `/search` route must be registered BEFORE `/:id` in the session router, otherwise Express matches "search" as a session ID.

    **Frontend changes**:
    - `src/components/MainLayout.jsx`: New SearchBar in the header bar (between TUON AI logo and ModelSelector). `useEffect` with `keydown` listener for `Ctrl+K`/`Cmd+K`. Debounced (300ms) input. Results dropdown grouped by "Title matches" and "Content matches". Click result → calls `onLoadSession(sessionId)`. Close on Escape or click outside.
    - `src/hooks/useSessions.js`: Add `searchSessions(query)` function that calls `GET /api/sessions/search?q=...`.
    - `src/App.jsx`: Pass search handler to MainLayout.

    **2.3 — Collections/Folders** (~1 week)

    **What it does today**: Only Pin/Unpin — two states.

    **What collections do**: Real folders like organizing files on a laptop. Sessions grouped under collapsible headers in the sidebar.

    **Database**: Tables already exist from Phase 1 (`collections` and `session_collections`). No migration needed.

    **Backend changes** (`api/index.js`): Create `collectionRouter` (same pattern as `sessionRouter`) with 5 endpoints:
    - `GET /api/collections` — list user's collections with session counts
    - `POST /api/collections` — create a new collection (`body: { name }`)
    - `DELETE /api/collections/:id` — delete a collection (sessions inside stay)
    - `POST /api/collections/:id/sessions/:sid` — assign a session to a collection
    - `DELETE /api/collections/:id/sessions/:sid` — remove a session from a collection

    **Frontend changes**:
    - `src/components/CollectionModal.jsx` — **NEW**: modal for create/rename/delete collections.
    - `src/components/MainLayout.jsx` — reworked sidebar: collections as collapsible groups above Pinned/Recent. Sessions not in any collection go to "Uncategorized". "Move to Collection" option in the three-dot context menu.
    - `src/hooks/useSessions.js` — add collection state + CRUD functions.
    - `src/App.jsx` — pass collection handlers to MainLayout.

    **Constraint**: One-level nesting only (no folders inside folders). Keeps UX simple.

    **Risk Register**:
    - Streaming partial-JSON crash → mitigation: never JSON.parse partial body, quiz stays buffered
    - AbortController not cancelling AI stream → mitigation: backend listens to `req.on('close', ...)` and cancels the AI fetch
    - SSE cookie auth not working on all browsers → mitigation: accept JWT via query param `?token=xxx`
    - Model doesn't support streaming → mitigation: fall back to buffered endpoint
  - **Phase 3 — Advanced Features: Multimodal + Voice** (~2-3 weeks): (3.1) Image/PDF upload via Supabase Storage private bucket with signed URLs. Gemini-only (NVIDIA NIM models greyed out in ModelSelector when image attached). 4MB/image, 4 images/message limit. (3.2) Voice input via `webkitSpeechRecognition` (Chrome/Edge only, hidden on unsupported browsers) and read-aloud via `speechSynthesis` on AI replies and quiz feedback.
  - **Risk Register**: Streaming partial-JSON crashes (mitigation: never JSON.parse partial body, quiz stays buffered); schema migration breaks existing sessions (mitigation: 4-week dual-write flow with feature-flag rollback); `App.jsx` refactor regressions (mitigation: commit-by-commit hook extraction with green test suite); multimodal API cost spike (mitigation: per-user daily 5-image quota reusing `express-rate-limit`); voice API browser inconsistency (mitigation: feature-detect and hide on unsupported browsers).
  - **Deferred to Phase 4 (optional, NOT in current priority)**: Quiz Attempts Dashboard, Spaced Repetition (SM-2), Flashcard Decks, Quiz Sharing (public links), Quiz Question Types Expansion (T/F, fill-blank, short-answer), Streaming Quiz Flow, Topic Templates, Streaks/Daily Goal, Refresh Token Auth, Monitoring/Alerting.

---

## 5. Architectural Decisions & Constraints

- **AI Model Strategy**: Default model is `gemini-3.1-flash-lite`. Additional models are provided via NVIDIA NIM (`step-3.7-flash`, `glm-5.1`). Users can also add custom OpenAI-compatible local LLMs (Ollama, LM Studio, etc.) via the ModelSelector dropdown. All built-in and custom models are accessed through the same OpenAI-compatible request path in `callOpenAICompatibleAPI`. Backend validates model IDs to prevent path traversal and injection attacks.
- **Custom LLM Flow**: Users add custom models via `CustomLLMModal` modal (opens from ModelSelector dropdown). `App.jsx:handleSaveCustomModel` uses `customModelStorage.js` utility to persist models. **API keys are stored securely in sessionStorage** (cleared on tab close), while model metadata is stored in localStorage without keys. On each `/api/chat` request, `getCustomModelConfig(selectedModel)` retrieves the config with API key merged from sessionStorage and sends it as `customModelConfig` in the request body. Backend `api/ai.js:137-141` checks for `customModelConfig`: if present, it uses the user-provided `baseUrl`, `modelId`, and optional `apiKey`; otherwise it falls back to `MODEL_CONFIGS`. Users can delete custom models via the trash icon in the dropdown. The currently active model is persisted in `quizmaker_selected_model` in localStorage. Modal design follows app theme with `#7b9acc` blue and `#FCF6F5` creamy beige.
- **Provider Configurations** (`api/ai.js`):
  - `gemini-3.1-flash-lite`: `baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'`, `apiKeyEnv: 'GOOGLE_API_KEY'`, `modelId: 'gemini-3.1-flash-lite'`.
  - `step-3.7-flash`: `baseUrl: 'https://integrate.api.nvidia.com/v1'`, `apiKeyEnv: 'NVIDIA_API_KEY'`, `modelId: 'stepfun-ai/step-3.7-flash'`.
  - `glm-5.1`: `baseUrl: 'https://integrate.api.nvidia.com/v1'`, `apiKeyEnv: 'NVIDIA_API_KEY'`, `modelId: 'z-ai/glm-5.1'`.
- **Parsing**: Centralized AI parsing lives in `src/utils/aiParser.js`. It is the single source of truth for extracting `<title>`, `<thought>`, and `<final>` tags and for JSON fallback parsing.
- **Backend**: Deployed on **Render** (persistent Node.js process) or **Vercel** (serverless fallback). AI calls are wrapped in a 30-second `Promise.race` timeout to prevent function expiration and provider hangs.
- **URL Construction**: `baseUrl` is treated as the API root. The route segment `/chat/completions` is appended centrally by `callOpenAICompatibleAPI`, preserving the abstraction for future endpoints such as `/models` or `/embeddings`. Custom model inputs get their trailing slashes stripped automatically.
- **PWA Strategy**: Minimal service worker approach with Workbox precaching + stale-while-revalidate for static assets and network-first for API calls. The service worker caches `start_url` on install and calls `skipWaiting()` immediately. For full address-bar removal on Android, the app uses a Trusted Web Activity (TWA) wrapper generated via PWABuilder, which requires `public/.well-known/assetlinks.json` for Digital Asset Links verification.
- **Environment Variables Schema**:
  - `GOOGLE_API_KEY` – Required for Gemini model calls.
  - `NVIDIA_API_KEY` – Required for NVIDIA NIM model calls.
  - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` – Used by backend API to access all 8 tables (`profiles`, `chat_sessions`, `messages`, `quiz_attempts`, `review_items`, `shared_quizzes`, `collections`, `session_collections`).
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` – Used by the frontend Supabase client for non-RLS features (RLS is deny-all).
  - `JWT_SECRET` – Used to sign and verify JWT cookies.
- **Frontend Persistence Keys**:
  - `quizmaker_current_session_id` – Active session ID.
  - `quizmaker_sessions_cache` – Cached sidebar session list.
  - `quizmaker_selected_model` – Persisted model selection.
  - `quizmaker_custom_models` – Persisted custom/local LLM configurations.
  - `quizmaker_dismissed_version` – Last seen version string for changelog notification dot.

### Production Database Security Model

- **Security Model**: Backend-Proxy approach.
  - RLS is ENABLED on all 8 tables (profiles, chat_sessions, messages, quiz_attempts, review_items, shared_quizzes, collections, session_collections) with "Service role only" deny-all policies.
  - All DB access is routed through Vercel API endpoints using the `service_role` client (`supabaseService`), which bypasses RLS.
  - This provides Defense-in-Depth: Public access is blocked at the DB level, while user-specific authorization is enforced at the API level via JWT verification.

---

## 6. MEMORY FILE REGISTRY

All specialized memory logs are stored in `.opencode/memory/` directory:

- **Error Memory**: `.opencode/memory/error_memory.md` — Active bugs, stack traces, resolution history
- **Codebase Map**: `.opencode/memory/codebase_map.md` — Directory structure, file purposes, dependency mapping
- **Implementation Memory**: `.opencode/memory/implementation_memory.md` — Architectural design maps, feature flows, execution roadmaps
- **Security Memory**: `.opencode/memory/security_memory.md` — Vulnerability tracking, threat modeling, remediation plans
- **Review Memory**: `.opencode/memory/review_memory.md` — Code review findings, quality assessments
- **Test Memory**: `.opencode/memory/test_memory.md` — Test strategies, coverage analysis, test case documentation

**Archive Files** (pre-created, receive overflow from memory files):

- **Error Archive**: `.opencode/archives/error_archive.md`
- **Implementation Archive**: `.opencode/archives/implementation_archive.md`
- **Security Archive**: `.opencode/archives/security_archive.md`
- **Review Archive**: `.opencode/archives/review_archive.md`
- **Test Archive**: `.opencode/archives/test_archive.md`

_Note: `codebase_map.md` and `project_memory.md` are excluded from archival._

---

## 7. ARCHIVE STATUS

- **Archive Location**: `.opencode/archives/`
- **Threshold**: 10 active entries per section (LIFO ordering)
- **Archives Created**: 3
- **Last Archive Check**: June 30, 2026, 07:53 PM PST

| Archive File              | Source Memory            | Entries Archived | Archived At (PST)           |
| ------------------------- | ------------------------ | ---------------- | --------------------------- |
| error_archive.md          | error_memory.md          | 33               | June 30, 2026, 06:15 PM PST |
| implementation_archive.md | implementation_memory.md | 3                | June 30, 2026, 07:53 PM PST |
| security_archive.md       | security_memory.md       | 4                | June 30, 2026, 07:53 PM PST |
| review_archive.md         | review_memory.md         | 0                | —                           |
| test_archive.md           | test_memory.md           | 0                | —                           |

<!-- c: worrie -->
