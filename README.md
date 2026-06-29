## 1. Project Stack & Core Execution Flow

- **Frontend Layer**: React 19, Vite 8, Tailwind CSS 4
- **Backend/Logic Layer**: Express.js (serverless on Vercel), Google Generative AI (gemini-3.1-flash-lite) via multi-provider OpenAI-compatible dispatcher
- **Data/Storage Layer**: Supabase (PostgreSQL) using "Backend-Proxy" security model (RLS Deny-All, access via `service_role` client)
- **PWA Layer**: Web app manifest, service worker, offline fallback, platform-specific icons

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
- `/src/components` - All UI components
- `/src/utils` - Utility functions and helpers
- `/api` - Serverless API endpoints (Vercel functions)
- `/public` - Static assets, PWA manifest, service worker, offline page, and icon packages

### 📄 File-by-File Breakdown

#### Root Configuration Files

- `package.json`: Project manifest with dependencies (React 19, Vite 8, Tailwind 4, Supabase, Google GenAI, Express, bcryptjs, jsonwebtoken, cookie-parser, cors, express-rate-limit, react-markdown, remark-gfm, rehype-sanitize, dotenv). Scripts: `dev`, `build`, `lint`, `preview`.
- `package-lock.json`: NPM dependency lock file
- `README.md`: Project documentation
- `vite.config.js`: Vite configuration with React and Tailwind CSS v4 plugins (7 lines)
- `vercel.json`: Vercel deployment config - rewrites `/api/*` to `/api/index.js` (5 lines)
- `eslint.config.js`: ESLint flat config with React hooks and refresh plugins
- `index.html`: Entry HTML file, links PWA manifest, theme-color `#7b9acc`, iOS apple-touch-icons (120, 152, 167, 180), title "TUON AI" (18 lines)
- `.gitignore`: Ignores logs, node_modules, dist, \*.local, .env, .roo, editor files

#### Frontend Entry Points

- `src/main.jsx`: React 19 entry point - creates root and renders `<App />` in StrictMode, registers the PWA service worker `/pwabuilder-sw.js` immediately (not deferred to window.load) before the React render (21 lines)
- `src/index.css`: Global styles - imports Tailwind CSS v4 via `@import "tailwindcss"` (1 line)
- `src/App.jsx`: **Main application orchestrator** (769 lines) - manages auth state, session state, chat history, message history, API calls, and session persistence. Contains all core logic: `handleStartQuiz`, `handleSendMessage`, `handleNewChat`, `handleResetToChat`, `handleLoadSession`, `saveSessionToDb`, `fetchSessions`, `handleLogout`, `stopGenerating`, `handleDeleteSession`, `handleRenameSession`, `handleTogglePin`, `handleQuizAnswer`. Boot sequence with `withTimeout` wrapper and 15s global watchdog. Manages custom model state (`customModels`, `handleSaveCustomModel`, `handleDeleteCustomModel`, `getCustomModelConfig`). **Rendered by**: `src/main.jsx`. **Renders**: all 8 UI components in `src/components/`. **Depends on**: `aiParser.js`, backend API at `/api/auth/*`, `/api/chat`, `/api/sessions`, `/api/session/*`.

#### Supabase Client

- `src/supabaseClient.js`: Initializes Supabase client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables. Only used for non-RLS frontend features; all real DB access goes through server-side `supabaseService`. (8 lines) **NOT currently imported or used by any component in the active codebase.**

#### UI Components (`/src/components/`)

- `MainLayout.jsx`: **Layout wrapper** (513 lines) with collapsible sidebar (desktop: state-driven `lg:block`/`lg:hidden`; mobile: overlay backdrop). Shows "New Chat" button, session list with Pinned/Recent sections, Pin/Rename/Delete context menu, user avatar, profile popup with `onMouseDown` toggle to avoid race conditions. Includes `ModelSelector` in header (responsive flex-wrap layout: wraps to own row on mobile), save status indicator (text hidden on mobile). Changelog modal with version tag button (`v1.0.2`), loading state, and fetch from `/changelog.json`. **Rendered by**: `App.jsx`. **Renders**: `ModelSelector`, session list items, profile popup, `ChatInterface`. **Depends on**: props from App.jsx (sessions, user, callbacks, customModels, selectedModel), PNG icons from `src/assets/`.
- `ChatInterface.jsx`: **Primary chat UI** (134 lines) - renders messages with markdown rendering via `react-markdown` + `remark-gfm` + `rehype-sanitize` (XSS prevention), quiz interface rendering (inline), auto-expanding textarea, loading indicator (3 bouncing dots), hero quote "Study to Understand, Navigate to Succeed." on empty state with version tag, Quiz button, Send button, footer disclaimer. Responsive padding and font sizing for mobile. **Rendered by**: `MainLayout.jsx`. **Depends on**: props from App.jsx (messages, onSend, quizData, onStartQuiz).
- `Login.jsx`: **Authentication form** (118 lines) - handles both Sign In and Sign Up via custom JWT endpoints (`/auth/signup`, `/auth/login`), toggles between modes, shows formatted errors. On login success, redirects via `window.location.href = '/'`. **Rendered by**: `App.jsx` (only when user is not authenticated). **Depends on**: props from App.jsx (onLogin).
- `QuizInterface.jsx`: **Dedicated quiz view** (125 lines) - renders the interactive quiz experience with stepped progress indicator, feedback card at top with correct/incorrect styling, question text with "Current Question" badge, answer options grid, null-guard loading state ("Preparing your quiz..."). Resets `selectedOption` on `quizData` change via `useEffect`. Responsive padding and font sizing. **Rendered by**: `App.jsx` (only when view='quiz'). **Depends on**: props from App.jsx (quizData, onAnswer).
- `QuizSetup.jsx`: **Quiz configuration view** (88 lines) - allows users to select question count (3-20 via range slider) and difficulty level (Easy/Normal/Hard via 3-column button group). Responsive padding and font sizes. **Rendered by**: `App.jsx` (only when view='quizSetup'). **Depends on**: props from App.jsx (onStartQuiz).
- `QuizSummary.jsx`: **Quiz completion screen** (36 lines) - shows score display, summary text, "Focus on Growth Areas" button (conditional on `hasWrongAnswers`), and "Try Another Topic" button. Responsive button layout (`flex-col sm:flex-row`). **Rendered by**: `App.jsx` (only when view='summary'). **Depends on**: props from App.jsx (quizData, onRetry, onNewTopic).
- `ModelSelector.jsx`: **AI model selector** (158 lines) - dropdown with outside-click handler, lists `Gemini 3.1 Flash Lite`, `Step 3.7 Flash`, and `GLM 5.1`. Shows checkmark on selected model, animates chevron rotation. Includes "Custom LLMs" section with add/delete, opens `CustomLLMModal` for adding new models. **Rendered by**: `MainLayout.jsx` (inside the header bar). **Depends on**: `CustomLLMModal`, props from App.jsx (selectedModel, setSelectedModel, customModels, onSaveCustomModel, onDeleteCustomModel).
- `CustomLLMModal.jsx`: **Custom LLM configuration modal** (~170 lines) - form for configuring custom OpenAI-compatible LLMs (Ollama, LM Studio, etc.). Fields: display name, base URL, model ID, optional API key. **URL validation**: `isValidApiUrl()` validates max 500 chars, `http://` or `https://` scheme, and `new URL()` format. Inline error messages with red border on invalid URLs. Save button disabled when form is invalid. Theme-matched design (`#7b9acc` blue, `#FCF6F5` creamy beige). **Rendered by**: `ModelSelector.jsx`. **Depends on**: props from ModelSelector (isOpen, onClose, onSave, initialData).

#### Utilities (`/src/utils/`)

- `aiParser.js`: **AI response parser** (169 lines) - `parseAIResponse(raw)` extracts `<title>`, `<thought>`, and `<final>` tags from raw AI response, returns a structured object `{ title, thought, final, fallbackTitle, structured }`. Implements resilient parsing: `stripThinkingText()` handles response markers (`Final:`, `Response:`, `Answer:`), greeting detection, and system prompt echo removal. `isMostlyThinking()` detects 10+ thinking patterns. Handles both tagged and untagged JSON content via fallback regex and JSON.parse attempts. Extracts `fallbackTitle` from first substantive sentence when `<title>` tags are absent. **Depended by**: `src/App.jsx` (imported and called after every AI response). **Depends on**: nothing (pure utility, no imports).
- `src/utils/customModelStorage.js`: **Custom model storage utility** (130 lines) - Implements SEC-014: API Key Protection via sessionStorage isolation. Exports `loadCustomModels()`, `saveCustomModel()`, `deleteCustomModel()`, `getCustomModelById()`. localStorage stores model metadata (name, baseUrl, modelId) WITHOUT apiKeys. sessionStorage stores API keys separately under `quizmaker_api_keys` key (cleared when browser tab closes). `loadCustomModels()` merges keys back from sessionStorage on page load. `saveCustomModel()` strips apiKey before saving to localStorage and stores key in sessionStorage. **Depended by**: `src/App.jsx` (replaces direct localStorage calls for custom models). **Depends on**: nothing (uses built-in browser storage APIs). Renamed from `sessionKeyStorage.js` for clarity.

#### Backend API (`/api/`)

- `api/index.js`: **Vercel serverless entry point** (217 lines) - Express app with CORS (restricted origin in production via `CORS_ORIGIN`, credentials: true), global `cookieParser()`, `express.json()`, `authLimiter` (20 req/15min) and `chatLimiter` (30 req/min) via `express-rate-limit`. `authRouter` mounted at `/api/auth`. `sessionRouter` with imported `authenticate` middleware: GET `/` (list sessions), GET `/:id` (single session), POST `/create`, POST `/:id/update`, POST `/:id/rename`, POST `/:id/pin` (toggles pin state via fetch-then-update), DELETE `/:id`. Session router mounted at both `/api/session` and `/api/sessions`. POST `/api/chat` with input validation (non-empty string check), calls `handleChat`. **Depended by**: every frontend API call (`fetch('/api/...')`). **Depends on**: `authenticate` middleware + `supabaseService` from `api/auth.js`; `handleChat` from `api/ai.js`.
- `api/auth.js`: **Authentication logic** (176 lines) - `authRouter` with POST `/signup` (creates profile with bcrypt hash, email validation, signs JWT, sets HTTP-only cookie with `sameSite: 'none', secure: true, path: '/', maxAge: 7d`), POST `/login` (verifies credentials, email validation, null-guards `password_hash`, issues cookie), POST `/logout` (clears cookie with matched flags), GET `/me` (returns user from JWT). Exports `authRouter`, `supabaseService`, and `authenticate` middleware. **Depended by**: `api/index.js` (imports all three exports). **Depends on**: bcryptjs (password hashing), jsonwebtoken (JWT sign/verify), supabase client (database), dotenv (env vars).
- `api/ai.js`: **AI interaction logic** (195 lines) - `MODEL_CONFIGS` for `gemini-3.1-flash-lite` (Google OpenAI-compatible endpoint), `step-3.7-flash` and `glm-5.1` (NVIDIA NIM). `validateApiUrl(baseUrl)` validates URL format (non-empty string, max 500 chars, `http://` or `https://` scheme, valid via `new URL()` constructor) and throws clear error messages on invalid URLs. Called before every `fetch()` in `callOpenAICompatibleAPI` to prevent SSRF attacks. `callOpenAICompatibleAPI(config, message, history)` converts SDK history to OpenAI format and sends to `${config.baseUrl}/chat/completions`. Supports inline API keys (custom model) or env-based keys. `handleChat(message, history, modelId, customModelConfig)` selects model, handles custom model configs (bypasses MODEL_CONFIGS), races API call against 30s `timeoutPromise`, returns raw AI text. `SYSTEM_PROMPT` defines dual-mode AI persona, mandatory `<title>`/`<thought>`/`<final>` tags, chat/note/quiz JSON formats. **Depended by**: `api/index.js` (calls `handleChat` for POST `/api/chat`). **Depends on**: dotenv (reads `GOOGLE_API_KEY`, `NVIDIA_API_KEY`), Node built-in `fetch`.

#### PWA Assets (`/public/`)

- `public/manifest.json`: PWA manifest (29 lines) - `name: "TUON AI"`, `short_name: "TUON AI"`, `id: "com.tuonai.worrie"`, `theme_color: "#7b9acc"`, `background_color: "#fcf6f5"`, `display: "standalone"`, `start_url: "/"`, education category, icons referencing `/android/` launcher icons (48-512px).
- `public/pwabuilder-sw.js`: Service worker (36 lines) using Workbox from CDN (`workbox-sw.js v5.1.2`). Precaches static assets via `self.__WB_MANIFEST`, stale-while-revalidate for static assets (30-day, 60-entry limit), network-first for API calls (24-hour expiry), offline fallback via `offline.html`. Caches `start_url` (`/`) on install with `skipWaiting()`. `clients.claim()` on activate. Custom model inputs get their trailing slashes stripped automatically.
- `public/offline.html`: Branded offline fallback page (56 lines) - styled with TUON AI colors (`#7b9acc`, `#FCF6F5`), shows "You're offline" message and "Try again" button.
- `public/android/`: Android launcher icons (48, 72, 96, 144, 192, 512px)
- `public/ios/`: iOS home screen icons (120, 152, 167, 180px)
- `public/windows/`: Windows tile and splash screen icons (generated by PWABuilder, not referenced in manifest)
- `public/.well-known/assetlinks.json`: Digital Asset Links file for Android Trusted Web Activity (TWA) verification. Required for the PWABuilder-generated APK to open the PWA in fullscreen without an address bar.
- `public/changelog.json`: Static release notes file (array of version objects with `version`, `date`, `notes`). Served by Vercel CDN, fetched by the changelog modal in MainLayout.

#### Assets (`/src/assets/`)

- `src/assets/thumbtacks.png` - Pin icon (used in sidebar session items and context menu)
- `src/assets/edit.png` - Rename icon (used in session context menu)
- `src/assets/delete.png` - Delete icon (used in session context menu)
- `src/assets/logout.png` - Logout icon (used in profile popup)

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
  - `chat_sessions`: `id` (uuid, PK), `user_id` (uuid, FK → `profiles.id`), `topic` (text), `history` (jsonb), `pinned` (boolean), `created_at` (timestamptz) [Composite Index: `(user_id, created_at DESC)`]
- **Session Object** (from Supabase):
  ```js
  {
    id: string,
    user_id: string,
    topic: string,
    history: array,
    pinned: boolean,
    created_at: string
  }
  ```
- **Quiz Data** (parsed from AI JSON in `<final>`):
  ```js
  { type: "quiz", text: string, options: string[], feedback: { isCorrect: boolean, text: string }, progress: { current: number, total: number }, isFinished: boolean, summary: string }
  ```
