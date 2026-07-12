# Error Archive

- **Source File**: `error_memory.md`
- **Last Archived At**: June 30, 2026, 06:15 PM PST
- **Total Entries Archived**: 33

---

## Archived Entries

### [RESOLVED] NVIDIA NIM 404 — Incorrect GLM 5.1 Namespace (ERR-032)

- **The Issue**: Selecting GLM 5.1 returned 404 from NVIDIA NIM.
- **Root Cause**: `MODEL_CONFIGS` entry used incorrect namespace prefix for GLM 5.1.
- **Resolution**: Updated `modelId` to `'z-ai/glm-5.1'` in `api/ai.js`.

---

### [RESOLVED] NVIDIA NIM 404 — Incorrect Step 3.7 Flash Namespace (ERR-031)

- **The Issue**: Selecting Step 3.7 Flash returned 404 from NVIDIA NIM.
- **Root Cause**: `MODEL_CONFIGS` entry used `modelId: 'stepfun-ai/step-3.7-flash'` which does not exist on NVIDIA NIM.
- **Resolution**: Updated `modelId` to the correct value.

---

### [RESOLVED] Model ID Key Mismatch — Frontend/Backend Desync (ERR-030)

- **The Issue**: Selecting Gemma 4 31B returned `Unsupported model ID` from backend.
- **Root Cause**: Frontend used `id: 'gemma-4-31b-it'` but backend used key `'gemma-4-31b'`.
- **Resolution**: Aligned frontend ID to match backend key (model has since been removed).

---

### [RESOLVED] AI Timeout After Model Change (ERR-029)

- **The Issue**: AI stopped responding with "The AI is taking too long to respond."
- **Root Cause**: Model was changed to `gemma-4-31b-it` which was either invalid or had high latency.
- **Resolution**: Reverted model identifier to `gemini-3.1-flash-lite` in `api/ai.js`.

---

### [RESOLVED] Quiz Stuck at Question 2 (ERR-028)

- **The Issue**: Quiz progressed to Question 2 but never moved to Question 3.
- **Root Cause**: `handleQuizAnswer` failed to update `history` state with the selected option and AI feedback. The stateless AI model received stagnant history on every request after the first answer.
- **Resolution**: Fixed `handleQuizAnswer` to correctly update `history` with the current interaction and persist via `saveSessionToDb`.

---

### [RESOLVED] Quiz UI Not Scrollable (ERR-027)

- **The Issue**: Quiz interface was not scrollable; answer choices were cut off on smaller screens.
- **Root Cause**: `QuizInterface` used `flex flex-col h-full` without overflow strategy.
- **Resolution**: Wrapped content in `flex-1 overflow-y-auto` with sticky header margin.

---

### [RESOLVED] Backend Crash — Backtick Syntax Error in System Prompt (ERR-026)

- **The Issue**: Backend crashed with `SyntaxError: Unexpected identifier 'feedback'`, causing 500 errors on all API endpoints.
- **Root Cause**: `SYSTEM_PROMPT` template literal contained unescaped backticks around `feedback` and `text`, prematurely terminating the string.
- **Resolution**: Escaped backticks (`\`feedback\``and`\`text\``) within the template literal.
- **Prevention**: Always escape backticks in large prompt template literals.

---

### [RESOLVED] Quiz Interface Layout & UX (ERR-025)

- **The Issue**: Feedback card at bottom; full-width layout hurt readability.
- **Resolution**: Moved feedback card to top, added "Current Question" badge, improved spacing and theme-consistent colors.

---

### [RESOLVED] Quiz Selected Option Persistence (ERR-024)

- **The Issue**: Previous question's selected option remained highlighted on next question.
- **Root Cause**: Local state `selectedOption` was not reset when `quizData` prop changed.
- **Resolution**: Added `useEffect` in `QuizInterface` to reset `selectedOption` to `null` on `quizData` change.

---

### [RESOLVED] Quiz Feedback Text Concatenation (ERR-023)

- **The Issue**: Previous feedback was concatenated with the next question's text.
- **Root Cause**: Ambiguous `SYSTEM_PROMPT` instructions led AI to include feedback in both the `feedback` object and the `text` field.
- **Resolution**: Refined `SYSTEM_PROMPT` to strictly isolate feedback within the `feedback` object.

---

### [RESOLVED] Reserved Keyword Import — `delete` in MainLayout (ERR-022)

- **The Issue**: App crashed with `SyntaxError` due to reserved keyword import.
- **Root Cause**: `import delete from '../assets/delete.png'` — `delete` is a JS reserved keyword.
- **Resolution**: Renamed to `deleteIcon` in import and all usages.

---

### [RESOLVED] Duplicate Default Export — Module Crash (ERR-021)

- **The Issue**: `SyntaxError: Identifier '.default' has already been declared` causing 500 on all auth endpoints.
- **Root Cause**: Duplicate `export default app;` in `api/index.js` and conflicting exports between `api/index.js` and `api/auth.js`.
- **Resolution**: Removed duplicate default export; standardized `api/auth.js` to named exports.

---

### [RESOLVED] Session Persistence Failure — RLS Violation (ERR-020)

- **The Issue**: Chat sessions not saved to "Recent Chats" sidebar; title generation not appearing.
- **Root Cause**: After JWT migration, Supabase Auth UID was absent. `chat_sessions` RLS policies rely on `auth.uid()`, causing `42501` errors.
- **Resolution**: Routed all session CRUD through backend API using `supabaseService` (`service_role` client) with JWT authorization at the API layer.

---

### [RESOLVED] Profile Schema Mismatch in `/me` (ERR-018)

- **The Issue**: `/api/auth/me` returned 401 even with valid JWT, keeping users on login screen.
- **Root Cause**: `me` endpoint queried `created_at` column on `profiles` table — column does not exist (uses `updated_at`). Postgres `42703` error was caught as "User not found".
- **Resolution**: Removed `created_at` from the `.select()` call.
- **Prevention**: Verify DB schema against API queries during migrations.

---

### [RESOLVED] JWT Session Loss on Vercel (ERR-017)

- **The Issue**: Login succeeded (200 OK), but `/api/auth/me` returned 401 with "No token found in cookies".
- **Root Cause**: Cookies lacked `path: '/'`; `sameSite: 'lax'` and conditional `secure` caused rejection on Vercel redirects; `cookieParser` not applied globally.
- **Resolution**: Moved `cookieParser()` to `api/index.js` globally; set cookie with `sameSite: 'none'`, `secure: true`, `path: '/'`.
- **Prevention**: For serverless multi-host deployments, use `sameSite: 'none'` + `secure: true` + root path.

---

### [RESOLVED] JWT Login Fails for Pre-Migration Users — Missing `password_hash` (ERR-016)

- **The Issue**: Existing users (Supabase Auth era) could not log in after custom JWT migration.
- **Root Cause**: `password_hash` is `NULL` for pre-migration profiles. `bcrypt.compare(password, user.password_hash)` crashed without null guard.
- **Resolution**: Added null guard for `password_hash` in login route.
- **Prevention**: Always validate column presence before `bcrypt.compare`. Provide password-reset endpoint for migration-era accounts.

---

### [RESOLVED] Profile Popup Text Color Mismatch (ERR-015)

- **The Issue**: Profile popup text used brand blue instead of black.
- **Resolution**: Changed text classes to `text-black` with appropriate opacities.

---

### [RESOLVED] Profile Popup Toggle Regression (ERR-014)

- **The Issue**: Clicking profile icon opened popup, but clicking again caused immediate re-open due to event race with click-outside listener.
- **Resolution**: Changed trigger from `onClick` to `onMouseDown` with `e.stopPropagation()`.
- **Prevention**: Use `onMouseDown` for toggle buttons paired with outside-click detectors.

---

### [RESOLVED] Sidebar Toggle Inoperative on Large Screens (ERR-013)

- **The Issue**: Hamburger icon did not toggle sidebar on desktop because `lg:translate-x-0 lg:relative` forced it visible.
- **Resolution**: Changed to conditional `lg:hidden` / `lg:block` based on `isSidebarOpen` state.
- **Prevention**: Avoid forcing visibility with responsive utilities that bypass state control.

---

### [RESOLVED] User Message Color Incorrect (ERR-012)

- **The Issue**: User messages appeared in blue instead of black.
- **Resolution**: Changed `text-[#7b9acc]` to `text-black` in user message bubble.

---

### [RESOLVED] Infinite Loading Screen / Boot Hang (ERR-011)

- **The Issue**: App occasionally stuck on "Preparing TUON AI" loading screen indefinitely.
- **Root Cause**: `supabase.auth.getSession()` promise hung without resolving/rejecting, preventing boot state transition.
- **Resolution**: Replaced Supabase Auth with custom JWT-based authentication using HTTP-only cookies.
- **Prevention**: Avoid third-party SDK session hooks for boot-critical paths. Use short, controlled timeouts on custom endpoints.

---

### [HISTORICAL] Refresh Session & AI Regression (ERR-010) — Attempt 1

- **The Issue**: Refreshing the page caused session loading to fail and AI to stop working.
- **Attempted Resolution**: Implemented atomic boot sequence with `isRestoringSessionRef` and parallel loading.
- **Outcome**: Failed. Issue persisted until JWT migration (see ERR-011).

---

### [RESOLVED] Sidebar Empty on Page Refresh (ERR-009)

- **The Issue**: After login, page refresh caused sidebar to disappear or load very slowly (~10s).
- **Resolution**: Replaced `isRestoringSession` state with `useRef`; removed redundant `getSession()` calls; implemented `Promise.all` for parallel session loading; added `localStorage` cache for sessions list.
- **Prevention**: Use `useRef` for process-tracking flags in `useEffect`. Cache read-heavy lists locally.

---

### [RESOLVED] Empty Sidebar on Saved Login (ERR-008)

- **The Issue**: Authenticated users saw empty sidebar and no chat loaded on saved login.
- **Resolution**: Rewrote initial auth effect with dedicated `checkSession` function that calls `/api/auth/me`, fetches sessions, and restores active chat.
- **Prevention**: Always perform explicit initial data fetch on boot for authenticated users.

---

### [RESOLVED] AI Non-Functional (ERR-006)

- **The Issue**: AI stopped generating responses.
- **Resolution**: Resolved after diagnostic logging. Likely transient configuration state.
- **Prevention**: Add comprehensive request/response logging for critical API paths.

---

### [RESOLVED] Sessions Unviewable (ERR-005)

- **The Issue**: Clicking sidebar chats did not load history; sometimes caused logout.
- **Resolution**: Added guard for empty `data.history`; replaced `JSON.parse` with `parseAIResponse`; removed aggressive `setSession(null)` on non-auth errors.
- **Prevention**: Default empty arrays for DB queries; use centralized AI parsing utilities.

---

### [RESOLVED] Background Save Error Handling (ERR-004)

- **The Issue**: `saveSessionToDb` failures were silently logged to console, leaving users unaware of data loss.
- **Resolution**: Added `saveStatus` state (`synced`, `saving`, `error`); added visible "Save Status" indicator in header; added manual retry mechanism.
- **Prevention**: Never silence critical background task failures. Provide visible status + retry path.

---

### [RESOLVED] Sidebar Session History Not Implemented (ERR-002)

- **The Issue**: Sidebar showed static "No recent chats" instead of session list with management options.
- **Resolution**: Implemented full sidebar session mapping with pin/rename/delete context menu.

---

### [RESOLVED] Unused Components in Main Flow

- **The Issue**: `QuizInterface`, `QuizSummary`, and `TopicInput` were defined but not integrated.
- **Resolution**: Integrated `QuizInterface` and `QuizSummary` via `view` state routing. Removed `TopicInput`.
- **Prevention**: Integrate components into main flow immediately on creation.

---

### [RESOLVED] White Screen / TDZ ReferenceError

- **The Issue**: White screen due to `ReferenceError` when callbacks accessed before declaration.
- **Resolution**: Reordered function declarations (`handleSendMessage` before `handleStartLearning`).
- **Prevention**: Ensure all `useCallback` hooks are declared before they are referenced.

---

### [RESOLVED] Dual Parsing Logic Inconsistency

- **The Issue**: `App.jsx` used inline regex parsing for `<thought>`/`<final>` tags while `src/utils/aiParser.js` existed but was unused.
- **Resolution**: Integrated `parseAIResponse` from `aiParser.js` into `handleSendMessage` and `handleStartQuiz`.
- **Prevention**: Always use centralized utility functions for critical logic.

---

### [RESOLVED] Disjointed Topic Entry UI

- **The Issue**: App landed on separate `TopicInput` screen before chat, creating fragmented UX.
- **Resolution**: Removed `TopicInput` component. Default view is now `'chat'`.
- **Prevention**: Integrate entry points into the core interaction UI.

---

<!-- c: worrie -->
