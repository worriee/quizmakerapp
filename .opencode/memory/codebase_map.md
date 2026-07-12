# Codebase Map Guide

## 0. Last Synchronized Checkpoint

- **Last AI Analysis Timestamp**: July 11, 2026, 04:34 pm PST

## 1. Project Stack & Core Execution Flow

- **Frontend Layer**: React 19, Vite 8, Tailwind CSS 4
- **Backend/Logic Layer**: Express.js (serverless on Vercel), Google Gemini + NVIDIA NIM via multi-provider OpenAI-compatible dispatcher, Resend email service
- **Data/Storage Layer**: Supabase (PostgreSQL) using "Backend-Proxy" security model (RLS Deny-All, access via `service_role` client)
- **PWA Layer**: Self-contained service worker (no CDN dependencies), web app manifest, offline fallback, platform-specific icons
- **Security Layer**: CSP headers, input sanitization, prompt injection detection, per-model rate limiting, account lockout, email verification, password reset
- **Testing Layer**: Vitest v4 (test infrastructure configured, 0 test files present — all cleaned/removed), @testing-library/react, jsdom

### Global Application Flow

1. **App Start**: `src/main.jsx` mounts React app in StrictMode and registers the PWA service worker (`/pwabuilder-sw.js`) on window load → `App.jsx` initializes with bootStatus = `INITIALIZING`.
2. **Auth Check**: `App.jsx` calls `GET /api/auth/me` with a 5-second timeout. The backend (`api/index.js` → `api/auth.js`) reads the JWT from the HTTP-only `token` cookie and returns the user profile. If the server (api/index.js) or auth module (api/auth.js) fails, the app stays stuck loading.
3. **No Session**: If `/api/auth/me` returns 401, render the `Login` component. The user fills in email+password → `Login.jsx` calls `POST /api/auth/signup` or `POST /api/auth/login` → on success, does `window.location.href = '/'` (full page reload, which re-triggers the boot sequence cleanly).
4. **Auth Success**: Session is established → bootStatus transitions to `AUTHENTICATING`. The app concurrently fetches sidebar sessions (`GET /api/sessions` with 7s timeout) and loads the active session (`GET /api/session/:id` with 7s timeout) using `Promise.all`.
5. **Session Established**: bootStatus = `READY`. Renders `MainLayout` which contains the sidebar (session list with Pinned/Recent sections) on the left, and `ChatInterface` or quiz views on the right, depending on `view` state.
6. **User Interaction (chat)**: User types and sends a message in `ChatInterface`. `handleSendMessage()` in `App.jsx` checks for quiz intent (via regex), appends user message to `history`, calls `POST /api/chat` with the conversation so far. The backend (`api/index.js`) verifies the JWT via `authenticate` middleware, then calls `handleChat()` from `api/ai.js`.
7. **API Processing**: `api/index.js` receives the request, runs `authenticate` (from `api/auth.js`) to verify JWT, validates the request body (non-empty message), then calls `handleChat(message, history, modelId)` from `api/ai.js` with the user's message, full chat history, and the selected model ID.
8. **AI Generation**: `api/ai.js` looks up the model in `MODEL_CONFIGS`, constructs an OpenAI-compatible JSON payload with the `SYSTEM_PROMPT` + conversation history, and sends a `POST` to `${config.baseUrl}/chat/completions`. A 30-second `Promise.race` timeout prevents serverless function expiry. Returns raw text with `<thought>`/`<final>` tags.
9. **Frontend Parsing**: `App.jsx` receives the raw AI text and calls `parseAIResponse()` from `src/utils/aiParser.js`. This extracts the `<thought>` (AI reasoning, shown collapsible), `<final>` (response content), and `<title>` (session title suggestion). If the `<final>` contains valid JSON, `structured` is parsed into an object (for quiz data or notes).
10. **UI Update**: `App.jsx` creates a new `messages` entry with `{ role: 'model', text, thought, raw, type }` and appends it to state. React re-renders `ChatInterface`, which displays the message (collapsible reasoning section + rendered markdown or inline quiz). If the response was a quiz, view transitions to `'quiz'` and `QuizInterface` mounts.
11. **Background Save**: After updating `messages`, `App.jsx` calls `saveSessionToDb()` (fire-and-forget with `.catch()`). This sends `POST /api/session/:id/update` to persist the conversation to Supabase. Save errors are tracked in `saveStatus` state and shown as a warning icon in the header.
12. **Offline**: If the user loses internet and navigates to a new page, the service worker (`pwabuilder-sw.js`) intercepts the failed request and serves `offline.html` from the cache, showing a branded "You're offline" message with a retry button.

---

## 2. Comprehensive Directory & File Registry

### 📂 Key Folders

- `/src` - Contains the main React frontend application code
- `/src/hooks` - Custom React hooks (5 files: useAuth, useChat, useSessions, useTheme, useCustomModels)
- `/src/components` - All UI components
- `/src/utils` - Utility functions and helpers
- `/api` - Serverless API endpoints (Vercel functions) and test files
- `/e2e` - Playwright end-to-end tests
- `/public` - Static assets, PWA manifest, service worker, offline page, and icon packages

### 📄 File-by-File Breakdown

#### Root Configuration Files

- `package.json`: Project manifest with dependencies (React 19, Vite 8, Tailwind 4, Supabase, Google GenAI, Express, bcryptjs, jsonwebtoken, cookie-parser, cors, express-rate-limit, react-markdown, remark-gfm, rehype-sanitize, dotenv, resend). Scripts: `dev`, `build`, `lint`, `preview`, `test` (Vitest), `test:watch`, `test:e2e` (Playwright).
- `package-lock.json`: NPM dependency lock file
- `README.md`: Project documentation
- `vite.config.js`: Vite configuration with React and Tailwind CSS v4 plugins. Also includes Vitest config (`globals: true`, `environment: 'jsdom'`, test file include patterns).
- `vercel.json`: Vercel deployment config - CSP headers, rewrites `/api/*` to `/api/index.js`, rewrites for auth pages (`/verify-email`, `/forgot-password`, `/reset-password`)
- `playwright.config.js`: Playwright E2E test configuration targeting Chromium, with dev server auto-start on localhost:5173.
- `eslint.config.js`: ESLint flat config with React hooks and refresh plugins
- `index.html`: Entry HTML file, links PWA manifest, theme-color `#7b9acc`, iOS apple-touch-icons (120, 152, 167, 180), title "TUON AI" (18 lines)
- `.gitignore`: Ignores logs, node_modules, dist, \*.local, .env, .roo, editor files

#### Frontend Entry Points

- `src/main.jsx`: React 19 entry point - creates root and renders `<App />` in StrictMode, registers the PWA service worker `/pwabuilder-sw.js` immediately (not deferred to window.load) before the React render (21 lines)
- `src/index.css`: Global styles - imports Tailwind CSS v4 via `@import "tailwindcss"` (1 line)
- `src/App.jsx`: **Main application orchestrator** (215 lines, reduced from 897 after Phase 0.1 refactor) - delegates all concerns to 5 hooks: `useAuth.js` (boot sequence, user state, retryBoot), `useChat.js` (messages, history, quiz state), `useSessions.js` (sidebar sessions, CRUD), `useTheme.js` (light/dark theme), `useCustomModels.js` (model selection). Added `CONNECTION_ERROR` render branch (lines 117-137) — shows a "Connection Lost" warning icon, subtitle message, and Retry button that calls `retryBoot()` from useAuth. Composes hook return values and passes them as props to UI components. Handles path-based routing for auth pages (`/verify-email`, `/forgot-password`, `/reset-password`). **Rendered by**: `src/main.jsx`. **Renders**: all 8 UI components in `src/components/`. **Depends on**: 5 hooks in `src/hooks/`, `parseAIResponse` from `aiParser.js`.

#### Supabase Client

- `src/supabaseClient.js`: **REMOVED** (was unused — all DB access goes through server-side `supabaseService` in `api/auth.js`).

#### Custom React Hooks (`/src/hooks/`) — NEW (Phase 0.1)

- `useAuth.js`: **Auth & boot hook** (147 lines) - Owns `user` state, `bootStatus` state, and the boot sequence `useEffect`. Accepts `{ fetchSessions, restoreActiveSession }` as arguments. Runs `/api/auth/me` on mount with 5-second timeout, restores sessions in parallel using `Promise.allSettled`, global 15-second watchdog. New boot states: `CONNECTION_ERROR` (shown when network errors or timeouts occur during boot — displays a Retry banner in App.jsx). Uses `bootSequenceRef` to store the boot function for `retryBoot()` re-invocation. The catch block distinguishes network errors (TypeError, timeouts → CONNECTION_ERROR) from other errors (→ UNAUTHENTICATED). Exposes `logout()` (API call + setUser(null) + setBootStatus("UNAUTHENTICATED")) and `retryBoot()` (resets to INITIALIZING and re-runs the boot sequence). **Depended by**: `App.jsx`. **Depends on**: nothing external (uses fetch API).
- `useChat.js`: **Chat & quiz hook** (472 lines) - Owns `messages`, `history`, `isLoading`, `view`, `quizData`, `quizScore`, `quizParams`, `wrongAnswers`, `abortController`. Provides: `sendMessage()`, `startQuiz()`, `quizAnswer()`, `stopGenerating()`, `newChat()`, `resetToChat()`, `loadSessionData()`, `reset()`. Depends on `selectedModel`, `getCustomModelConfig`, `fetchSessions`, `saveSessionToDb`, `currentSessionId`, `setCurrentSessionId`, `sessions`, `setSaveStatus`. **Title flicker fix (July 9)**: topic computation now prefers AI-generated `title` over `sessions.find(...)?.topic` in both quiz path (line 244) and chat path (line 282). **Depended by**: `App.jsx`. **Depends on**: `parseAIResponse` from `src/utils/aiParser.js` for tag extraction.
- `useSessions.js`: **Session management hook** (215 lines) - Owns `sessions`, `currentSessionId`, `saveStatus`. Provides: `setCurrentSessionId()`, `fetchSessions()`, `saveSessionToDb()`, `loadSession()` (returns raw session object), `deleteSession()`, `renameSession()`, `togglePin()`, `reset()`. All CRUD operations go through backend API at `/api/sessions` and `/api/session/:id`. **Depended by**: `App.jsx`. **Depends on**: nothing (uses fetch API directly).
- `useTheme.js`: **Theme hook** (21 lines) - Owns `theme` state (light/dark) with localStorage persistence. Syncs `document.documentElement.classList.toggle("dark")` on change. Provides `toggleTheme()`. **Depended by**: `App.jsx`. **Depends on**: nothing (uses built-in DOM + localStorage APIs).
- `useCustomModels.js`: **Custom models hook** (49 lines) - Owns `selectedModel` and `customModels` list with localStorage persistence. Provides: `setSelectedModel()`, `addCustomModel()`, `deleteCustomModel()`, `getCustomModelConfig()`. Uses `customModelStorage.js` utility for sessionStorage-backed API key isolation (SEC-014). **Depended by**: `App.jsx`. **Depends on**: `customModelStorage.js` for localStorage/sessionStorage abstraction.

#### Test Files

_(No test files present. All were removed during project reset to commit 8eec977.)_

#### E2E Tests

_(No e2e tests present. Directory was removed during project reset.)_

#### UI Components (`/src/components/`)

- `MainLayout.jsx`: **Layout wrapper** (481 lines) with collapsible sidebar (desktop: state-driven `lg:block`/`lg:hidden`; mobile: overlay backdrop). Shows "New Chat" button, session list with Pinned/Recent sections, Pin/Rename/Delete context menu, user avatar, profile popup with `onMouseDown` toggle to avoid race conditions. Includes `ModelSelector` in header (responsive flex-wrap layout: wraps to own row on mobile), save status indicator (text hidden on mobile). Changelog modal with version tag button (`v1.0.2`), loading state, and fetch from `/changelog.json`. **Rendered by**: `App.jsx`. **Renders**: `ModelSelector`, session list items, profile popup, `ChatInterface`. **Depends on**: props from App.jsx (sessions, user, callbacks, customModels, selectedModel), PNG icons from `src/assets/`.
- `ChatInterface.jsx`: **Primary chat UI** (126 lines) - renders messages with markdown rendering via `react-markdown` + `remark-gfm` + `rehype-sanitize` (XSS prevention), quiz interface rendering (inline), auto-expanding textarea, loading indicator (3 bouncing dots), hero quote "Study to Understand, Navigate to Succeed." on empty state with version tag, Quiz button, Send button, footer disclaimer. Responsive padding and font sizing for mobile. **Rendered by**: `MainLayout.jsx`. **Depends on**: props from App.jsx (messages, onSend, quizData, onStartQuiz).
- `Login.jsx`: **Authentication form** (118 lines) - handles both Sign In and Sign Up via custom JWT endpoints (`/auth/signup`, `/auth/login`), toggles between modes, shows formatted errors. On login success, redirects via `window.location.href = '/'`. **Rendered by**: `App.jsx` (only when user is not authenticated). **Depends on**: props from App.jsx (onLogin).
- `QuizInterface.jsx`: **Dedicated quiz view** (115 lines) - renders the interactive quiz experience with stepped progress indicator, feedback card at top with correct/incorrect styling, question text with "Current Question" badge, answer options grid, null-guard loading state ("Preparing your quiz..."). Resets `selectedOption` on `quizData` change via `useEffect`. Responsive padding and font sizing. **Rendered by**: `App.jsx` (only when view='quiz'). **Depends on**: props from App.jsx (quizData, onAnswer).
- `QuizSetup.jsx`: **Quiz configuration view** (81 lines) - allows users to select question count (3-20 via range slider) and difficulty level (Easy/Normal/Hard via 3-column button group). Responsive padding and font sizes. **Rendered by**: `App.jsx` (only when view='quizSetup'). **Depends on**: props from App.jsx (onStartQuiz).
- `QuizSummary.jsx`: **Quiz completion screen** (42 lines) - shows score display, summary text, "Focus on Growth Areas" button (conditional on `hasWrongAnswers`), and "Back to Chats" button. Responsive button layout (`flex-col sm:flex-row`). **Rendered by**: `App.jsx` (only when view='summary'). **Depends on**: props from App.jsx (quizData, onRetry, onNewTopic).
- `ModelSelector.jsx`: **AI model selector** (147 lines) - dropdown with outside-click handler, lists `Gemini 3.1 Flash Lite`, `Step 3.7 Flash`, and `GLM 5.1`. Shows checkmark on selected model, animates chevron rotation. Includes "Custom LLMs" section with add/delete, opens `CustomLLMModal` for adding new models. **Rendered by**: `MainLayout.jsx` (inside the header bar). **Depends on**: `CustomLLMModal`, props from App.jsx (selectedModel, setSelectedModel, customModels, onSaveCustomModel, onDeleteCustomModel).
- `CustomLLMModal.jsx`: **Custom LLM configuration modal** (218 lines) - form for configuring custom OpenAI-compatible LLMs. Fields: display name, base URL, model ID, optional API key. **URL validation**: `isValidApiUrl()`. **Conversation History toggle** (SEC-011): `sendHistory` switch with warning banner when enabled ("Your entire conversation will be sent to this external server. Only enable if you trust the provider."). Save button disabled when form is invalid.
- `VerifyEmail.jsx`: **Email verification page** - reads `?token=xxx` from URL, calls `POST /api/auth/verify-email`, shows success/error states with branded UI.
- `ForgotPassword.jsx`: **Password reset request page** - email input form, sends reset request, shows success message ("If an account exists with this email, a reset link has been sent.").
- `ResetPassword.jsx`: **New password form** - reads `?token=xxx` from URL, password input with real-time requirements checklist (8+ chars, uppercase, lowercase, number, not common), calls `POST /api/auth/reset-password`.

#### Utilities (`/src/utils/`)

- `aiParser.js`: **Unified model-agnostic AI parser** (380 lines) - `parseAIResponse(raw)` extracts tags from ANY model's output. Uses flexible `(\w*think\w*)` regex to match `<thought>`, `<thinking>`, `<THINK>`, or any future thinking-tag variant. `normalizeOutput()` is a universal output cleaner that unescapes `\n`, adds blank lines before headers/bullets, deduplicates spacing, and fixes markdown formatting — runs on ALL model output regardless of source. JSON fallback uses regex (not position-based) to find `{"type":"notes"}` or `{"type":"quiz"}` anywhere in the text, handling extra text before/after JSON. `tagRegex` strips common structural tags: `think*`, `final`, `title`, `reasoning`, `analysis`, `output`, `response`. Also includes: `stripThinkingText()` (handles response markers, greetings, system prompt echoes), `isMostlyThinking()` (detects thinking patterns), `trimTitle()` (strips leading articles, truncates to 30 chars), `generateTitle()` (unused utility), `streamingVisibleText()` (extracts displayable content during SSE streaming — tag mode, JSON mode, plain text), `stripAllHtmlTags()`. **Depended by**: `src/hooks/useChat.js`. **Depends on**: nothing (pure utility, no imports).
- `src/utils/customModelStorage.js`: **Custom model storage utility** (114 lines) - Implements SEC-014: API Key Protection via sessionStorage isolation. Exports `loadCustomModels()`, `saveCustomModel()`, `deleteCustomModel()`, `getCustomModelById()`. localStorage stores model metadata (name, baseUrl, modelId) WITHOUT apiKeys. sessionStorage stores API keys separately under `quizmaker_api_keys` key (cleared when browser tab closes). `loadCustomModels()` merges keys back from sessionStorage on page load. `saveCustomModel()` strips apiKey before saving to localStorage and stores key in sessionStorage. **Depended by**: `src/App.jsx` (replaces direct localStorage calls for custom models). **Depends on**: nothing (uses built-in browser storage APIs). Renamed from `sessionKeyStorage.js` for clarity.

#### Backend API (`/api/`)

- `api/index.js`: **Vercel serverless entry point** (~423 lines) - Express app with CORS, `express.json({ limit: '1mb' })`, CSP headers (applied via `vercel.json` headers), `authLimiter` (20 req/15min), model-aware `chatLimiter` (Gemini: 15, NVIDIA: 40, Custom: 20 RPM). Input sanitization via `sanitizeMessage()` and `detectPromptInjection()`. AI output validation via `validateAiOutput()`. Session router with 10 endpoints. **Phase 1 complete**: All chat history now stored in `messages` table (relational), `history` JSONB column dropped from `chat_sessions`. New `POST /messages/bulk` and `GET /messages/:sessionId` endpoints. `GET /session/:id` now reads from `messages` table. **Phase 2.1 — SSE streaming**: `POST /api/chat/stream` route with JWT query-param auth, idle timeout, abort-on-disconnect. Deployed on Vercel Hobby plan (10s function timeout).
- `api/auth.js`: **Authentication logic** (430 lines) - Custom JWT auth with 1-day expiry, bcrypt, account lockout (5 attempts/15 min), email verification, password reset. Routes: POST `/signup` (with verification email), POST `/login` (with lockout check), POST `/logout`, GET `/me`, POST `/verify-email`, POST `/forgot-password`, POST `/reset-password`. Exports `authRouter`, `supabaseService`, `authenticate`.
- `api/ai.js`: **AI interaction logic** (516 lines) - `MODEL_CONFIGS` for Gemini, Step, GLM. Two system prompts: `SYSTEM_PROMPT_TAGS` (used by Gemini with `<thought>/<final>` tags) and `SYSTEM_PROMPT_JSON` (used by NVIDIA models, forces JSON with `"content"`/`"thought"` fields). `handleChat()` with custom model support, `sendHistory` consent check, 30s timeout. `callOpenAICompatibleAPI()` with SSRF protection, redirect blocking, model ID validation. `callOpenAICompatibleAPIStream()` — streaming variant with `stream: true`, line-buffered SSE parsing, idle timeout, heartbeat. `handleChatStream()` — exported wrapper. Uses per-model `jsonMode` flag to select system prompt: `jsonMode: true` → `SYSTEM_PROMPT_JSON`, `jsonMode: false` → `SYSTEM_PROMPT_TAGS`.
- `api/sanitize.js`: **Input sanitization** (165 lines) - `sanitizeMessage()` (5000 char limit, control char stripping), `detectPromptInjection()` (14 patterns + Unicode homoglyph normalization), `validateAiOutput()` (checks `<final>` tag, validates quiz JSON, detects malicious payloads).
- `api/validatePassword.js`: **Password validation** (55 lines) - `validatePassword()` enforcing 5 rules: 8+ chars, uppercase, lowercase, number, common password blocklist (~50 entries).
- `api/email.js`: **Email service** (155 lines) - Resend integration with `sendVerificationEmail()`, `sendPasswordResetEmail()`, `sendLockoutEmail()`. Branded HTML email templates with TUON AI styling.

#### Server Entry Points

- `server.js`: **Render entry point** (8 lines) — imports `app` from `api/index.js` and starts listening on `process.env.PORT || 3000`. Used by Render as the start command (`node server.js`). Previously gitignored (was only for local dev), now tracked so Render can deploy it.
- `api/index.js`: **Express application** — imported by `server.js`. Contains all routes, middleware, and config. Started by `server.js` on Render (always-on process) or by Vercel as a serverless function (when `export default app` is used).

#### PWA Assets (`/public/`)

- `public/manifest.json`: PWA manifest - `name: "TUON AI"`, `display: "standalone"`, `start_url: "/"`, education category, icons.
- `public/pwabuilder-sw.js`: **Self-contained service worker** (48 lines) - No CDN dependencies (SEC-004). Uses native `self.registration.navigationPreload` API. Caches `offline.html` on install, serves offline fallback on network failure. `skipWaiting()` + `clients.claim()` for immediate activation.
- `public/offline.html`: Branded offline fallback page - styled with TUON AI colors, external CSS/JS (SEC-013).
- `public/offline.css`: Extracted styles from offline.html (SEC-013).
- `public/offline.js`: Extracted click handler from offline.html (SEC-013).
- `public/android/`: Android launcher icons (48, 72, 96, 144, 192, 512px)
- `public/ios/`: iOS home screen icons (120, 152, 167, 180px)
- `public/windows/`: Windows tile and splash screen icons
- `public/.well-known/assetlinks.json`: Digital Asset Links file for Android TWA verification.
- `public/changelog.json`: Static release notes file.

#### Assets (`/src/assets/`)

- `src/assets/thumbtacks.png` - Pin icon (used in sidebar session items and context menu)
- `src/assets/edit.png` - Rename icon (used in session context menu)
- `src/assets/delete.png` - Delete icon (used in session context menu)
- `src/assets/logout.png` - Logout icon (used in profile popup)
### 🔗 Component Dependency Chain (Who Calls Whom?)

Think of this section as a **family tree for the codebase**. It shows which files rely on which other files to work. If you edit one file, check this list to see what else might break.

**Frontend (`src/`) — How the visual pieces connect:**

| File                             | What it does                                                                                   | Who it depends on                                                                                    | Who depends on it                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/main.jsx`                   | Entry point — mounts React app, registers PWA service worker                                   | `App.jsx` (it renders `<App />`)                                                                     | Nothing — it is the starting line                                                       |
| `src/App.jsx` (194 lines)        | Thin orchestrator — composes 5 hooks, routes views, passes props to components                 | 5 hooks (`useAuth`, `useChat`, `useSessions`, `useTheme`, `useCustomModels`), `parseAIResponse`      | Every UI component — they only render when App.jsx gives them data (props)              |
| `src/hooks/useAuth.js`           | Auth + boot sequence — user state, JWT check, 15s watchdog                                    | fetch API for `/api/auth/me` and `/api/auth/logout`                                                  | `App.jsx`                                                                               |
| `src/hooks/useChat.js`           | Chat + quiz — messages, history, quiz flow, sendMessage, startQuiz                             | `parseAIResponse` from aiParser.js, `saveSessionToDb` from useSessions                               | `App.jsx`                                                                               |
| `src/hooks/useSessions.js`       | Session CRUD — sidebar list, save/load/delete/rename/pin sessions                              | fetch API for `/api/sessions/*`                                                                      | `App.jsx`, `useChat` (via `saveSessionToDb`)                                            |
| `src/hooks/useTheme.js`          | Theme toggle — light/dark with localStorage persistence                                        | localStorage, DOM API                                                                                | `App.jsx`                                                                               |
| `src/hooks/useCustomModels.js`   | Custom LLM — model selection, add/delete, API key isolation (SEC-014)                          | `customModelStorage.js` for storage abstraction                                                      | `App.jsx`                                                                               |
| `src/components/*.jsx` (8 files) | Visual screens — Login, Chat, QuizSetup, QuizInterface, QuizSummary, MainLayout, ModelSelector | Props and callbacks from `App.jsx`                                                                   | None — they are leaf nodes (do not import each other)                                   |
| `src/utils/aiParser.js`          | Translator — extracts `<thought>`/`<final>`/`<title>` tags from raw AI text                    | Nothing (pure utility)                                                                               | `useChat.js`, `App.jsx`                                                                 |
| `src/utils/customModelStorage.js`| Secure storage — API keys in sessionStorage, metadata in localStorage                          | Nothing (uses built-in browser storage APIs)                                                         | `useCustomModels.js`                                                                    |

**Backend (`api/`) — How the server processes requests:**

| File           | What it does                                                                                                             | Who it depends on                                                                             | Who depends on it                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `api/index.js` | Front door — all `/api/*` requests enter here. Mounts auth routes, session routes (Phase 1 complete: `messages` table is sole storage, `history` column dropped), chat endpoint | `api/auth.js` for `authenticate` middleware + `supabaseService`; `api/ai.js` for `handleChat` | Every frontend API call — if this breaks, the whole app is unusable |
| `api/auth.js`  | Security guard — signup, login, logout, JWT verification, database access via `supabaseService`                          | bcryptjs, jsonwebtoken, supabase client, dotenv                                               | `api/index.js` — if this breaks, nobody can log in, chat, or save sessions |
| `api/ai.js`    | The brain — AI model configs (Gemini, Step, GLM), `handleChat` sends messages to AI, `SYSTEM_PROMPT` defines AI behavior | dotenv for API keys; fetch (built into Node) for HTTP calls                                   | `api/index.js` calls `handleChat` when user sends a message                |

**Data flow (simplified) — after Phase 0.1 refactor + Phase 1 completion (messages table is sole storage):**

```
User types a message
  → ChatInterface sends text → handleSendMessage (in useChat hook)
    → useChat creates/updates session via useSessions.saveSessionToDb
      → POST /api/session/:id/update writes to messages table
      → Messages table stores individual rows (session_id, role, content, position)
    → useChat sends fetch POST /api/chat
      → api/index.js receives request
        → api/auth.js checks JWT (is user logged in?)
        → api/ai.js calls the AI model with your message + chat history
      → AI responds with raw text
    → api/index.js sends response back to frontend
  → useChat runs parseAIResponse() to extract <thought>/<final> tags
  → useChat updates messages state in useChat hook
  → React re-renders ChatInterface.jsx with new message
  → useChat calls useSessions.saveSessionToDb (background) to persist to Supabase
    → When loading: GET /api/session/:id reads from messages table (Phase 1 complete, history column dropped)
```

---

### 📂 Critical Codebase Registry (with Dependency Notes)

- `src/App.jsx` – Thin orchestrator (194 lines, 78% reduction from original 897). Composes 5 hooks and passes props to UI components. **Depended by**: `src/main.jsx` (renders it). **Depends on**: 5 hooks in `src/hooks/`, `aiParser.js`.
- `src/hooks/useAuth.js` – Auth + boot hook. Owns user/bootStatus. Runs boot sequence on mount. **Depended by**: `App.jsx`. **Depends on**: fetch API.
- `src/hooks/useChat.js` – Chat + quiz hook (462 lines). Owns messages/history/quiz state. Session title assignment uses AI-generated `<title>` tags (from `parseAIResponse`) with a fallback chain: `title || fallbackTitle || truncated user message` for new sessions, or existing session topic for returning sessions. Also calls `renameSession(sessionId, title)` when AI generates a title and this is a retry (handles first-prompt-failure recovery). **Depended by**: `App.jsx`. **Depends on**: `aiParser.js` (`parseAIResponse`), `saveSessionToDb` from useSessions, `renameSession` from App.jsx.
- `src/hooks/useSessions.js` – Session management hook (215 lines). Owns sessions/currentSessionId/saveStatus. **Depended by**: `App.jsx`, `useChat` (via saveSessionToDb). **Depends on**: fetch API.
- `src/hooks/useTheme.js` – Theme hook (21 lines). Owns theme state. **Depended by**: `App.jsx`. **Depends on**: localStorage, DOM API.
- `src/hooks/useCustomModels.js` – Custom models hook (49 lines). Owns selectedModel/customModels. **Depended by**: `App.jsx`. **Depends on**: `customModelStorage.js`.
- `src/components/ChatInterface.jsx` – Chat UI, reasoning display, markdown rendering, and inline quiz rendering. **Depended by**: `App.jsx` (renders inside MainLayout when view='chat'). **Depends on**: props from App.jsx.
- `src/components/MainLayout.jsx` – Sidebar layout, session list (three-dot context menu always visible — removed hover-only opacity), pin/rename/delete, profile popup, logout. **Depended by**: `App.jsx`. **Depends on**: props from App.jsx; imports PNG icons from `src/assets/`.
- `src/components/Login.jsx` – Authentication UI with sign-in/sign-up toggle. **Depended by**: `App.jsx` (renders when user is not logged in). **Depends on**: props from App.jsx.
- `src/components/QuizSetup.jsx` – Quiz parameter selection (item count + difficulty). **Depended by**: `App.jsx` (renders when view='quizSetup'). **Depends on**: props from App.jsx.
- `src/components/QuizInterface.jsx` – Dedicated interactive quiz view. **Depended by**: `App.jsx` (renders when view='quiz'). **Depends on**: props from App.jsx.
- `src/components/QuizSummary.jsx` – Quiz completion screen. **Depended by**: `App.jsx` (renders when view='summary'). **Depends on**: props from App.jsx.
- `src/components/ModelSelector.jsx` – Dropdown for selecting the active AI model. **Depended by**: `MainLayout.jsx`. **Depends on**: props from App.jsx, `CustomLLMModal`.
- `src/utils/aiParser.js` – Unified model-agnostic AI parser (`parseAIResponse` + `normalizeOutput`). Handles `<thought>`, `<thinking>`, and any future tag variant via flexible `(\w*think\w*)` regex. Universal `normalizeOutput()` cleans spacing/formatting for all models. **Depended by**: `useChat.js` hook, `App.jsx`. **Depends on**: nothing (pure utility).
- `src/utils/customModelStorage.js` – Custom model storage utility. **Depended by**: `useCustomModels.js`. **Depends on**: localStorage, sessionStorage.
- `api/ai.js` – Multi-provider AI dispatcher; `handleChat` and `MODEL_CONFIGS`. **Depended by**: `api/index.js`. **Depends on**: dotenv, fetch.
- `api/auth.js` – Custom JWT authentication routes and `authenticate` middleware. **Depended by**: `api/index.js`. **Depends on**: bcryptjs, jsonwebtoken, supabase client, dotenv.
- `api/index.js` – Express wrapper for Vercel; routes for auth, chat, sessions, message endpoints (Phase 1 complete: history column dropped, messages table is sole storage). **Depended by**: Every frontend API call. **Depends on**: `api/auth.js`, `api/ai.js`.
- `api/sanitize.js` – Input sanitization, injection detection, output validation. **Depended by**: `api/index.js`. **Depends on**: nothing (pure utility).
- `api/validatePassword.js` – Password strength validation. **Depended by**: `api/auth.js`. **Depends on**: nothing (pure utility).
- `api/auth.js` – Custom JWT authentication routes (`/signup`, `/login`, `/logout`, `/me`) and `authenticate` middleware. **Depended by**: `api/index.js` (imports middleware + supabaseService). **Depends on**: bcryptjs, jsonwebtoken, supabase client, dotenv.
- `api/index.js` – Express wrapper for Vercel; routes for auth, chat, sessions, and message endpoints. **Phase 1 complete**: All chat history now stored in `messages` table, `history` JSONB column dropped from `chat_sessions`. `POST /messages/bulk` and `GET /messages/:sessionId` endpoints handle message CRUD. `GET /session/:id` reads from `messages`. **Depended by**: Every frontend API call. **Depends on**: `api/auth.js` (authenticate, supabaseService), `api/ai.js` (handleChat).
- `src/supabaseClient.js` – Supabase client setup (frontend, only used for non-RLS features; RLS is deny-all so all real DB ops route through server-side `supabaseService`). **Depended by**: Nothing currently.
- `src/main.jsx` – React entry point; registers PWA service worker on window load
- `src/index.css` – Imports Tailwind CSS v4 via `@import "tailwindcss"`
- `public/manifest.json` – PWA manifest with app metadata, theme colors, and icon set
- `public/pwabuilder-sw.js` – Service worker that serves `offline.html` when navigation fails
- `public/offline.html` – Branded offline fallback page with a "Try again" button
- `index.html` – Links the manifest, sets theme color, and references iOS apple-touch-icon sizes (120, 152, 167, 180)
- `vercel.json` – Vercel deployment config; rewrites `/api/*` to `/api/index.js`
- `vite.config.js` – Vite config with React and Tailwind CSS v4 plugins
- `package.json` – Dependencies: React 19, Vite 8, Tailwind 4, Supabase, Google GenAI, Express, bcryptjs, jsonwebtoken, cookie-parser, cors, express-rate-limit, react-markdown, remark-gfm, dotenv

---

### ⚙️ CRITICAL FUNCTIONAL REGISTRY (METHODS & LOGIC)

#### File: `src/App.jsx` (784 lines)

- `updateBootStatus(status)` – Syncs `bootStatus` state and ref for stable state-machine transitions.
- `handleSetSelectedModel(model)` – Persists selected model to `localStorage` via `MODEL_STORAGE_KEY`.
- `updateCurrentSessionId(id)` – Updates active session and persists `SESSION_STORAGE_KEY` to `localStorage`.
- `fetchSessions()` – Loads sidebar sessions from `/api/sessions` with cache fallback to `SESSIONS_CACHE_KEY`.
- `handleLogout()` – Calls `/api/auth/logout`, clears local state and storage.
- `saveSessionToDb(updatedHistory, topic, sessionId)` – Creates or updates the active session via backend API endpoints.
- `handleStartQuiz(params, overrideSessionId, initialHistoryEntries, overrideTopic)` – Builds dynamic difficulty prompts, calls `/api/chat`, parses quiz JSON, and switches `view` to `'quiz'` only after data is populated.
- `handleSendMessage(text)` – Processes user input, detects quiz intent via regex, creates sessions on first message, and routes AI responses into chat or quiz mode.
- `handleQuizAnswer(option)` – Records user answers, updates `history`, tracks `wrongAnswers`, and persists progress.
- `handleNewChat()` – Resets the current chat and session states.
- `handleResetToChat()` – Resets view to chat, clears quiz state.
- `handleLoadSession(sessionId)` – Restores session history and maps it back into `messages` for the UI.
- `handleDeleteSession(sessionId)` / `handleRenameSession(sessionId, newTitle)` / `handleTogglePin(sessionId, currentPinStatus)` – Sidebar session management handlers.
- `stopGenerating()` – Aborts the active AI request via `AbortController`.
- **Boot Sequence** (`useEffect`) – Calls `/api/auth/me` with 5s timeout; on success transitions to `AUTHENTICATING`, fetches sessions and loads active session in parallel (7s timeouts each), then transitions to `READY`. Global watchdog at 15s forces `READY` if boot hangs.

#### File: `api/ai.js` (249 lines)

- `MODEL_CONFIGS` – Declarative provider configs for `gemini-3.1-flash-lite`, `step-3.7-flash`, and `glm-5.1`.
- `callOpenAICompatibleAPI(config, message, history)` – Converts internal SDK history to OpenAI format and sends to `${baseUrl}/chat/completions`.
- `handleChat(message, history, modelId)` – Selects model from `MODEL_CONFIGS`, races API call against 30-second timeout, and returns raw AI text.
- `SYSTEM_PROMPT` – Defines AI persona, mandatory `<title>`/`<thought>`/`<final>` tags, note/quiz JSON formats, and strict isolation of feedback outside the `text` field.

#### File: `api/auth.js` (176 lines)

- `POST /api/auth/signup` – Creates a profile with bcrypt password hash and issues a JWT cookie.
- `POST /api/auth/login` – Verifies credentials, null-guards missing `password_hash`, and issues JWT cookie.
- `POST /api/auth/logout` – Clears the auth cookie.
- `GET /api/auth/me` – Returns the current user from the JWT cookie.
- `authenticate(req, res, next)` – Verifies JWT from the `token` cookie and attaches `req.user`.

#### File: `api/index.js` (408 lines)

- Express serverless entry for Vercel with `/api` routes mounted.
- Global `cookieParser()` and `express.json()` middleware.
- `sessionRouter` – 10 endpoints: GET `/` (list), `GET /:id` (reads from `messages` table), POST `/create` (writes to `messages`), POST `/:id/update` (updates `topic` + `messages`), POST `/:id/rename`, POST `/:id/pin`, DELETE `/:id`, POST `/messages/bulk` (batch insert), GET `/messages/:sessionId` (load by session).
- Route wiring: `/api/auth` (auth), `/api/chat` (protected AI), `/api/session` and `/api/sessions` (protected session + message routes).
- POST `/api/chat` – JWT-verified AI chat endpoint with input sanitization, injection detection, AI output validation.

#### File: `src/utils/aiParser.js` (146 lines)

- `parseAIResponse(raw)` – Extracts `<title>`, `<thought>`, `<final>` tags; attempts JSON parsing of the `<final>` content; returns `{ title, thought, final, structured }` with fallback for untagged output.


---

## 3. Learning Notes & Dependency Mapping

### Critical Third-Party Libraries

- **@google/generative-ai**: Google's SDK for Gemini AI - imported in `api/ai.js` but not actively used (all model calls go through OpenAI-compatible fetch; the SDK client is initialized but the `callOpenAICompatibleAPI` function uses raw `fetch`)
- **@supabase/supabase-js**: Supabase client for database (chat_sessions and profiles tables). Frontend client in `src/supabaseClient.js`; server-side `supabaseService` in `api/auth.js` using `service_role` key
- **react-markdown + remark-gfm**: Renders markdown in chat messages (GitHub-flavored markdown support) - used in `ChatInterface.jsx`
- **express**: Web framework for Vercel serverless function (`api/index.js`)
- **dotenv**: Loads environment variables for local development (imported in `api/ai.js`)
- **tailwindcss v4 + @tailwindcss/vite**: New Tailwind CSS v4 with Vite plugin for styling
- **bcryptjs**: Password hashing for custom authentication (used in `api/auth.js`)
- **jsonwebtoken**: JWT generation and verification for secure sessions (used in `api/auth.js`; `api/index.js` imports the `authenticate` middleware instead of duplicating JWT logic)
- **cookie-parser**: Middleware to parse HTTP-only cookies (used globally in `api/index.js` and locally in `authRouter`)
- **cors**: CORS middleware with `origin: true, credentials: true` (used in `api/index.js`)
- **express-rate-limit**: Rate limiting middleware actively used in `api/index.js` for `/api/auth/*` and `/api/chat` endpoints.
- **rehype-sanitize**: Markdown sanitizer wired into `ReactMarkdown` in `ChatInterface.jsx` for XSS prevention.
- **workbox-sw**: Service worker runtime loaded by `public/pwabuilder-sw.js` from CDN for offline page handling

### Tricky Code Paths

1. **Auth Middleware Deduplication**: Originally, `api/index.js` had 7 inline JWT verification blocks (~120 lines) duplicated across session and chat routes. These were extracted into the `authenticate` middleware exported from `api/auth.js`. If you add a new protected route, you must import `authenticate` from `api/auth.js` — do NOT inline JWT verification again.
2. **Cookie Clear Requires Exact Flag Matching**: `res.clearCookie('token')` in `api/auth.js` must include the exact same `httpOnly`, `secure`, `sameSite`, and `path` options as when the cookie was set (`res.cookie`). If flags don't match, the browser ignores the clear and keeps the old cookie, trapping the user in a logged-in state.
3. **`withTimeout` Anti-Hang Pattern**: Every critical boot-sequence network call is wrapped in a `Promise.race` between the actual request and a timeout promise (5-7s). If the serverless function hangs, the timeout rejects, and the app degrades gracefully instead of freezing. The pattern is: `Promise.race([fetch(...), new Promise((_, rej) => setTimeout(() => rej(Error('timeout')), ms))])`.
4. **CORS Environment Switching**: Production restricts origin to `process.env.CORS_ORIGIN` (default `https://quizmakerapp.vercel.app`), but development uses `origin: true`. This is controlled by `NODE_ENV === 'production'` check in `api/index.js`. If CORS errors appear in dev, check that the env is not accidentally set to 'production'.
5. **AI URL Construction Constraint**: `baseUrl` in `MODEL_CONFIGS` must NOT have a trailing slash. The route `/chat/completions` is appended centrally in `callOpenAICompatibleAPI`. A missing or double slash (e.g., `.../openai//chat/completions`) causes 404 errors — this was the root cause of ERR-037.
6. **Session Management**: `App.jsx` manages multiple state pieces: `messages` (UI), `history` (AI context), `sessions` (sidebar list), `currentSessionId` (active session). Sync between these is handled via `useCallback` and `useEffect`. The `useCallback` dependency arrays are critical — TDZ errors have occurred when declaration order was wrong.
7. **Session Ordering**: Sidebar sessions are fetched and ordered by `pinned DESC, created_at DESC` to keep important chats at the top. Server-side DB query uses `.order('pinned', { ascending: false }).order('created_at', { ascending: false })`. Client-side also re-sorts after fetch.
8. **Background Saves**: `saveSessionToDb` is called with `.catch()` to avoid blocking UI, but errors update `saveStatus` state. Retry mechanism exposed via `onRetrySave` prop.
9. **JWT Authentication**: Auth is handled via HTTP-only cookies (`token`); the frontend calls `/api/auth/me` on boot to restore the session without relying on third-party SDK hooks. JWT is verified server-side via the single `authenticate` middleware exported from `api/auth.js` and used across all protected routes in `api/index.js`.
10. **Quiz Flow**: `handleStartQuiz` constructs a dynamic difficulty prompt and sends it to `/api/chat`. The `view` switches to `'quiz'` only after `quizData` is populated to prevent `QuizInterface` null destructuring crash.
11. **Auto-Quiz Intent Detection**: `handleSendMessage` checks user text against `/quiz|test|questions|\d+\s*items/i` regex and routes to `handleStartQuiz` with default 5-item Normal params, bypassing `QuizSetup`.
12. **PWA Service Worker**: The service worker uses Workbox with precaching, stale-while-revalidate for static assets, and network-first for API calls. It intentionally avoids caching dynamic AI responses or chat history to avoid stale data. Vite copies the contents of `public/` directly into `dist/` during build. The service worker caches the `start_url` (`/`) on install and calls `skipWaiting()`.
13. **Login Redirect**: On successful login, `Login.jsx` uses `window.location.href = '/'` for a full page reload rather than React state transitions, which simplifies boot sequence re-entry.
14. **Duplicated Session Router Mount**: `api/index.js` mounts `sessionRouter` at both `/api/session` and `/api/sessions` — the frontend uses `/api/sessions` for listing and `/api/session/*` for CRUD operations.
15. **Custom LLM Flow**: Users add custom models via `CustomLLMModal` (opens from ModelSelector dropdown). `App.jsx:handleSaveCustomModel` uses `customModelStorage.js` utility to persist models. **API keys are stored securely in sessionStorage** (cleared on tab close), while model metadata is stored in localStorage without keys. On each `/api/chat` request, `getCustomModelConfig(selectedModel)` retrieves the config with API key merged from sessionStorage and sends it as `customModelConfig` in the request body. Backend `api/ai.js:handleChat` checks for `customModelConfig`: if present, it uses the user-provided `baseUrl`, `modelId`, and optional `apiKey`; otherwise it falls back to `MODEL_CONFIGS`. The currently active model is persisted in `quizmaker_selected_model` in localStorage.

### Data Structures & Database Schema

- **Message Object** (in `messages` state):
  ```js
  { role: "user" | "model", text: string, type: "text" | "quiz" | "notes", raw: string, thought: string, ...data }
  ```
- **History Object** (sent to AI):
  ```js
  { role: "user" | "model", parts: [{ text: string }] }
  ```
- **Database Tables**:
  - `profiles`: `id` (uuid, PK), `email` (text, unique, normalized), `password_hash` (text), `created_at` (timestamptz), `updated_at` (timestamptz) [Index: `email`]
  - `chat_sessions`: `id` (uuid, PK), `user_id` (uuid, FK → `profiles.id`), `topic` (text), `pinned` (boolean), `created_at` (timestamptz), `updated_at` (timestamptz) [Composite Index: `(user_id, created_at DESC)`]. `history` column DROPPED in Phase 1 Week 4. `updated_at` auto-populates via trigger.
  - `messages`: `id` (uuid, PK), `session_id` (uuid, FK → `chat_sessions.id` ON DELETE CASCADE), `role` (text, CHECK 'user'/'model'), `content` (text), `position` (integer), `created_at` (timestamptz). Unique constraint: `(session_id, position)`. Indexes: `session_id`, `(session_id, position)`.
  - `quiz_attempts`: `id` (uuid, PK), `user_id` (uuid, FK → `profiles.id`), `session_id` (uuid, FK → `chat_sessions.id`), `topic` (text), `difficulty` (text), `score` (integer), `total` (integer), `created_at` (timestamptz). [Future use]
  - `review_items`: `id` (uuid, PK), `user_id` (uuid, FK → `profiles.id`), `message_id` (uuid, FK → `messages.id`), `ease_factor` (real), `interval` (integer), `due_at` (timestamptz), `last_reviewed_at` (timestamptz). [Future use]
  - `shared_quizzes`: `id` (uuid, PK), `session_id` (uuid, FK → `chat_sessions.id`), `share_token` (text UNIQUE), `expires_at` (timestamptz), `created_at` (timestamptz). [Future use]
  - `collections`: `id` (uuid, PK), `user_id` (uuid, FK → `profiles.id`), `name` (text), `created_at` (timestamptz). [Future use]
  - `session_collections`: `session_id` (uuid, FK → `chat_sessions.id`), `collection_id` (uuid, FK → `collections.id`), PRIMARY KEY `(session_id, collection_id)`. [Future use]
- **Session Object** (from Supabase):
  ```js
  {
    id: string,
    user_id: string,
    topic: string,
    history: array,    // populated from messages table (history column dropped)
    pinned: boolean,
    created_at: string,
    updated_at: string
  }
  ```
- **Quiz Data** (parsed from AI JSON in `<final>`):
  ```js
  { type: "quiz", text: string, options: string[], feedback: { isCorrect: boolean, text: string }, progress: { current: number, total: number }, isFinished: boolean, summary: string }
  ```
<!-- c: worrie -->
