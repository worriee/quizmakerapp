# Implementation Plans & Feature Flow Memory

## 0. Last Synchronized Checkpoint

- **Last AI Analysis Timestamp**: July 12, 2026, 10:42 am PST

## 1. Documented Implementation Plans & Feature Flows

### [FLOW-022] Phase 2.1 — SSE Streaming for AI Chat Responses

- **Context/Objective**: The AI chat felt slow — users sent a message, then stared at blank loading for 8-10 seconds until the full response appeared at once. The goal was to make text appear word-by-word as the AI generates it (like ChatGPT), giving users immediate visual feedback. This covers the complete streaming implementation including the backend SSE endpoint, frontend streaming parser, and all UI refinements.
- **Step-by-Step Logic Outline**:

  **1. Backend: Streaming AI function (`api/ai.js`)**
  - Added `callOpenAICompatibleAPIStream()` — identical setup to the existing buffered function (API key resolution, model config, message formatting, URL validation) but with two key differences:
    - Sets `stream: true` in the request body to tell the AI provider to send SSE chunks
    - Reads the response as a stream via `response.body.getReader()` instead of awaiting `response.json()`
    - For each SSE line (`data: {"choices":[{"delta":{"content":"..."}}]}`), extracts the text fragment and writes it directly to the Express response via `res.write(encoder.encode(content))`
  - **Idle timeout instead of wall-clock timeout**: A `setInterval` checks every 5 seconds if any chunk arrived in the last 20 seconds. If the AI goes silent mid-stream (no data for 20s), the stream is closed. This replaces the old 30-second `Promise.race` timeout which doesn't work for streaming (chunks are actively arriving, you just can't set a total time limit).
  - Added `handleChatStream()` — exported wrapper that resolves model config (built-in or custom) and calls the streaming function. Handles errors by writing to the response.

  **2. Backend: SSE Route (`api/index.js`)**
  - New `POST /api/chat/stream` route with:
    - **Auth via query-param JWT**: SSE doesn't reliably send cookies on all browsers, so the endpoint accepts `?token=xxx` in the URL. The frontend reads the JWT from `document.cookie` and appends it. Falls back to cookie-based auth if no query param.
    - Same security pipeline as the buffered `/api/chat` endpoint: `sanitizeMessage()`, `detectPromptInjection()`, model-aware `chatLimiter` rate limiting.
    - SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
    - **Abort on disconnect**: Creates an `AbortController` that fires `abortController.abort()` on `req.on("close")`. The abort signal is passed to the AI fetch call, cancelling it if the user navigates away or clicks Stop/Cancel.

  **3. Frontend: Streaming sendMessage (`useChat.js`)**
  - `sendMessage` now splits into two paths:
    - **Quiz intent** (message matches `/quiz|test|questions|\d+\s*items/i`): uses the existing buffered `POST /api/chat` endpoint — quiz JSON must arrive as a complete payload (cannot `JSON.parse()` a half-finished object).
    - **Chat** (no quiz intent): uses the new streaming `POST /api/chat/stream?token=...` endpoint.
  - Streaming flow:
    1. Fetch the streaming endpoint with the JWT token appended
    2. Create a placeholder message with `{ role: "model", text: "", type: "text", isStreaming: true }`
    3. Read chunks via `response.body.getReader()` + `TextDecoder`
    4. On each chunk, call `streamingVisibleText(accumulatedText)` to extract only the displayable content, and update the last message's text in-place
    5. When the stream ends (`done: true`), run `parseAIResponse(fullText)` to extract title/thought/final/structured
    6. If it's a quiz → remove the streaming placeholder and switch to quiz mode
    7. If it's a chat → finalize the message with parsed text, save to DB

  **4. Frontend: streamingVisibleText() parser (`aiParser.js`)**
  - Extracts only the displayable content from partially-accumulated streaming text. This runs on EVERY chunk to determine what the user sees during streaming:
    - **Tag mode (Gemini)**: Finds the last `<final>` opening tag and shows everything after it. Strips all structural tags (`<thought>`, `<title>`, `</final>`, etc.) using `stripAllHtmlTags()`. If no `<final>` tag yet, shows empty (blinking cursor only).
    - **JSON mode (NVIDIA)**: If content starts with `{`, tries to extract the `"text"` field value first (notes/quiz format), then `"content"` (chat format) using a progressive regex `/"text": "((?:[^"\\]|\\.)*)/`. Shows the partial value as chunks arrive.
    - **Plain text**: Shows everything progressively.
    - **Markdown stripping**: Strips `#` heading markers during streaming (`.replace(/^#{1,6}\s+/gm, "")`) since they would show as raw `# text` to the user. After the stream ends, `ReactMarkdown` renders them properly.
    - **Escape sequence decoding**: Replaces `\n` → newline, `\t` → tab in extracted JSON content so the user sees actual line breaks instead of literal `\n`.

  **5. Frontend: UI changes (`ChatInterface.jsx`)**
  - **Removed**: The old three-dot bouncing loading animation (was `{isLoading && <div className="animate-bounce">...}`) that showed during ALL loading states. Replaced with two separate indicators:
    - **Pre-streaming three dots**: Shows when `isLoading && !isStreaming` — meaning the fetch is in flight but the streaming message hasn't been created yet. This shows INSTANTLY after the user clicks Send and stays until the first chunk arrives. Positioned as a model-style message bubble (`bg-app text-app border border-app rounded-2xl rounded-bl-sm`). Uses three `bg-[#7b9acc]` (brand blue) dots with staggered `animationDelay` (0ms, 150ms, 300ms) for the bouncing effect.
    - **Streaming blinking cursor**: Inside the streaming message, when `isStreaming && !msg.text`, shows a simple `animate-pulse` cursor `|`. This is the brief gap between the streaming message being created and the first chunk arriving.
  - **Progressive text**: During active streaming (`isStreaming && msg.text`), shows the text in a `<span className="whitespace-pre-wrap">` (raw text, not markdown) followed by a blinking `|` cursor. Raw text is used because partially-rendered markdown (like `**bold` without closing `**`) would crash ReactMarkdown.
  - **Markdown rendering**: After streaming ends (`!isStreaming`), the full text is rendered via `ReactMarkdown` with `rehype-sanitize` for XSS prevention.
  - **Cancel button**: Removed the small "Cancel" text link that was inside the streaming message bubble. Replaced the Send button (`bg-[#7b9acc] text-white`) with a Cancel button (`bg-red-500 text-white hover:bg-red-600`) in the input area when `isStreaming` is true. The button state is driven by `messages[messages.length-1]?.isStreaming` — when user clicks Cancel, `stopGenerating` finalizes the message (sets `isStreaming: false`) so the button reverts to Send.
  - **Input disabled**: Textarea is `disabled={isLoading}` during all loading states (including streaming) to prevent sending multiple messages.
  - **Quiz button disabled**: `disabled={isLoading}` during loading — same as before.

  **6. stopGenerating cancel handler (`useChat.js`)**
  - Modified to mark the streaming message as no longer streaming when user cancels:
    ```js
    abortController.abort();
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.isStreaming) {
        updated[updated.length - 1] = { ...last, isStreaming: false };
      }
      return updated;
    });
    setIsLoading(false);
    ```
  - This ensures the Cancel button reverts to Send immediately, and the partial streaming text stays visible (without blinking cursor).

  **7. Quiz routing**
  - `sendMessage` checks for quiz intent upfront via regex: `/quiz|test|questions|\d+\s*items/i`
  - If matched → uses buffered `POST /api/chat` (existing behavior, prevents showing raw JSON mid-stream)
  - If not matched → uses streaming `POST /api/chat/stream`
  - `startQuiz()` and `quizAnswer()` always use the buffered endpoint regardless (quiz interactions need complete JSON payloads)

- **Key Files**: `api/ai.js`, `api/index.js`, `src/hooks/useChat.js`, `src/components/ChatInterface.jsx`, `src/utils/aiParser.js`
- **Resolved Issues**: ERR-054 (tags visible during streaming), ERR-055 (cancel button UI), ERR-056 (no pre-streaming loading indicator)

### How Streaming Works End-to-End

**Local Development (`npm run dev`):**
- The Vite dev server serves the React frontend (port 5173), and a Node.js process runs the API (port 3000). They communicate via the Vite proxy configured in `vite.config.js` which forwards `/api/*` requests to port 3000.
- When the user sends a chat message, `useChat.js` creates an `AbortController`, fetches `POST /api/chat/stream?token=...` with the message and model config.
- The server (`api/index.js` → `api/ai.js`) sends the request to the AI provider with `stream: true`. It reads SSE chunks (`data: {"choices":[{"delta":{"content":"..."}}]}\n\n`) from the provider, extracts content, and writes raw text to the response via `res.write(encoder.encode(content))`.
- On the client, `response.body.getReader()` reads raw bytes (no SSE parsing needed — chunks are appended directly to `accumulatedText`).
- Every chunk triggers `setMessages()` with `text: streamingVisibleText(accumulatedText)` — the function extracts displayable content from the partial text.
- When the AI stream ends (`done: true` from the provider), the server's `while(true)` loop breaks, and `api/index.js` calls `res.end()`. The client exits its reading loop and runs `parseAIResponse(accumulatedText)` to get the final `{ title, thought, final, structured }`. The placeholder message is replaced with `{ text: structured.text || final, isStreaming: false }`.
- There is no proxy between the Node.js server and the browser locally, so TCP chunks arrive as written — no chunk splitting, no buffering delays.

**Render Deployment (`node server.js`):**
- The same Express app runs as a persistent Node.js process on Render. `server.js` imports the app from `api/index.js` and listens on `process.env.PORT || 3000`.
- Render uses **Envoy** as an L7 reverse proxy in front of the Node.js process. This proxy can:
  1. **Buffer TCP writes** — small `res.write()` calls from the server may be batched by the proxy instead of forwarded immediately to the client. This causes chunk delays and mid-stream timeouts.
  2. **Split chunks at arbitrary boundaries** — a single `res.write("Hello")` might arrive at the client as two separate `reader.read()` results: `"He"` and `"llo"`. While concatenation still works, the server's SSE line parsing (`chunk.split("\n")`) can break if a single SSE data line is split across chunks.
  3. **Delay connection close** — when the server calls `res.end()`, the proxy doesn't immediately forward the close signal. The client's `reader.read()` hangs waiting for more data, never returns `{ done: true }`, and the final message update (`parseAIResponse` + `setMessages`) never executes.

**Render-Specific Fixes Applied:**

1. **`setNoDelay(true)`** (`api/index.js` stream route): Disables Nagle's algorithm on the TCP socket. Nagle's algorithm deliberately buffers small writes to coalesce them into larger TCP segments — normally good for network efficiency but disastrous for SSE where each word must arrive immediately. `setNoDelay(true)` forces the kernel to send every `res.write()` call as an independent TCP segment, bypassing the buffer. Without this, Render's Envoy proxy combined with Nagle's algorithm would batch 20+ seconds of AI output into a single chunk, causing the client to see nothing for 20 seconds then receive a burst.

2. **`trust proxy: 1`** (`api/index.js`): Tells Express to trust the `X-Forwarded-For` header set by Render's proxy. This is needed for:
   - Correct client IP detection for rate limiting (otherwise Express sees the proxy's IP, not the actual user)
   - Proper `req.ip` resolution in the authentication middleware

3. **Line buffer for SSE chunks** (`api/ai.js`): Before this fix, the server parsed SSE lines with `chunk.split("\n")` on each incoming TCP chunk independently. When Render's Envoy proxy split a single SSE line across multiple chunks (e.g., chunk 1: `data: {"choices":[{"delta":{"content":"Hel`, chunk 2: `lo"}}]}\n\n`), the first part was discarded because it didn't start with `"data: "`, and the second part was discarded because it also didn't start with `"data: "`. The fix:
   - Maintains a `lineBuffer` string across chunks
   - Appends each new chunk to the buffer, then splits by `\n`
   - Keeps the last (incomplete) line in the buffer for the next chunk
   - After the AI stream ends, processes any remaining complete data in the buffer

4. **End-of-stream signal** (`api/ai.js`): After the AI provider's stream completes, the server writes `res.write(encoder.encode("\n\n"))` BEFORE `res.end()`. This gives Envoy a clean data boundary to forward to the client. Without this, the proxy holds the connection open waiting for more data, the client's `reader.read()` hangs, and the browser may timeout or display stale streaming text.

5. **Thinking pattern check in `streamingVisibleText`** (`aiParser.js`): When no `<final>` tag has arrived yet (the model is still outputting reasoning), the function now checks if the visible text starts with thinking patterns like `"The user is asking..."`, `"I need..."`, `"Let me..."`, `"Since..."`, `"As an..."`, `"Based on..."`. If it does, it returns an empty string (showing the blinking cursor only) instead of leaking the reasoning text to the user. On Render, where proxy delays cause `<final>` to arrive later, this prevents users from ever seeing the thinking text during streaming.

6. **Static serving + SPA catch-all** (`api/index.js`): Since Render serves both the API and the built React frontend from the same process, `express.static("dist")` serves the compiled React files, and `app.get("*")` serves `index.html` for client-side routing paths (like `/forgot-password`, `/verify-email`). CSP middleware was also added with `manifest-src 'self'` and `worker-src 'self'`.

### How Parsing Works (Same on Local and Render)

The `parseAIResponse()` function in `aiParser.js` uses a cascading approach — each layer tries to extract content, and if it fails, the next layer tries:

1. **JSON mode** (fast path): If the entire raw text is valid JSON with `"content"` (chat) or `"type": "notes"/"quiz"` fields, extract and return immediately. Used by NVIDIA/Step models that output `{"title":"...","thought":"...","content":"..."}`.
2. **Tag extraction**: Finds paired XML-like tags (`<thought>...</thought>`, `<final>...</final>`, `<title>...</title>`) using a flexible regex `(\w*think\w*)` that matches ANY tag containing "think". Used by Gemini/Gemma models that follow the `SYSTEM_PROMPT_TAGS` format. If `<final>` contains JSON, it's parsed for quiz/notes mode.
3. **JSON regex fallback**: If no tags found, searches for `{"type":"notes"}` or `{"type":"quiz"}` JSON objects anywhere in the raw text using a position-agnostic regex. Handles models that output JSON surrounded by extra text.
4. **Heuristic cleanup**: If no tags and no JSON, checks if the text is "mostly thinking" using `isMostlyThinking()` which scans for reasoning indicators. If yes, `stripThinkingText()` filters out sentences matching thinking patterns (`"I need"`, `"I will"`, `"The user"`, `"Let me"`, `"Since"`, `"Based on"`, etc.). If no, returns the full text as-is.
5. **`normalizeOutput()`**: A universal cleaner that runs on extracted content: unescapes `\n`, `\t`, adds blank lines before `##` headers, fixes `##Header` → `## Header`, ensures blank lines before `-` bullets, deduplicates blank lines, and strips trailing whitespace.
- **Fallback title extraction**: If no `<title>` tag, tries `Title:` line pattern, then uses the first complete sentence of `final` as a fallback title.

### How `streamingVisibleText` Works During Streaming

Runs on EVERY chunk to determine what the user sees WHILE the AI is still generating:

1. **Tag mode (Gemini)**: Finds the last `<final>` opening tag in the accumulated text. If found, shows everything after it (stripped of HTML tags). If NOT found (model is still outputting `<thought>`), checks if the visible text starts with thinking patterns — if yes, shows empty (blinking cursor); if no, shows the text (for models that output content without tags).
2. **JSON mode (NVIDIA)**: If accumulated text starts with `{`, tries to extract the `"text"` field value first (notes/quiz format), then `"content"` (chat format) using progressive JSON regex. Shows partial values as they arrive. Returns empty if no extractable field yet.
3. **Plain text**: Shows all text progressively with HTML tags stripped. If the text starts with thinking patterns and no `<final>` tag exists, returns empty.
4. **Markdown stripping**: Strips `#` heading markers during streaming (raw markdown symbols would look ugly to the user). After the stream ends, `ReactMarkdown` renders them properly.
5. **Escape decoding**: Replaces `\n` → newline, `\t` → tab in extracted JSON content so the user sees actual line breaks instead of literal `\n`.

### Why Local Works Without These Fixes

On local dev, there is no Envoy proxy between the Node.js server and the browser:
- TCP chunks arrive exactly as `res.write()` sends them — no splitting, no batching, no delays. Nagle's algorithm doesn't cause issues because the loopback interface has near-zero latency.
- Connection close (`res.end()`) propagates immediately to the client — `reader.read()` returns `{ done: true }` instantly.
- There's no `X-Forwarded-For` header to trust, so `trust proxy` is irrelevant.
- The thinking text before `<final>` is still visible briefly, but the `parseAIResponse()` call after the stream ends replaces it with clean content fast enough that users don't notice.

All Render-specific fixes are designed to be NO-OPs on local: `setNoDelay(true)` on a loopback socket has no effect, the line buffer still works correctly with complete chunks, and the end-of-stream signal is just an extra `\n\n` that the client ignores.

- **Status**: COMPLETED
- **Logged At**: July 10, 2026, 12:34 pm PST
- **Completed At**: July 12, 2026, 10:42 am PST

### [FLOW-021] Model-Agnostic Unified AI Parser (normalizeOutput + Flexible Tag Matching)

- **Context/Objective**: Different OpenAI-compatible AI models (Gemini 3.1 Flash Lite, Step 3.7 Flash, custom/local LLMs) output inconsistent formats — different tag names (`<thought>` vs `<thinking>`), inconsistent spacing (some models output walls of text without line breaks), literal `\n` characters instead of real newlines, and JSON in varying positions (sometimes with extra text before/after). The goal was to build a single parser that handles ANY model's output consistently without model-specific if/else branches.
- **Step-by-Step Logic Outline**:
  1. Added `normalizeOutput()` function in `src/utils/aiParser.js` — a universal output cleaner that: (a) unescapes `\n`, `\t`, `\r` to real characters, (b) ensures blank lines before `##` headers, (c) fixes `##Header` → `## Header`, (d) ensures blank lines before `-` bullet points, (e) deduplicates excessive blank lines (3+ → 2), (f) strips trailing whitespace per line.
  2. Changed `thoughtMatch` regex from hardcoded `(?:thought|thinking)` to `(\w*think\w*)` with `\1` backreference — matches ANY tag containing "think" (case-insensitive): `<thought>`, `<thinking>`, `<THINK>`, `<thought_process>`, etc.
  3. Updated `tagRegex` to strip common structural tags: `think*`, `final`, `title`, `reasoning`, `analysis`, `output`, `response`.
  4. Changed JSON fallback from `startsWith("{")` position check to a regex that finds `{"type":"notes"}` or `{"type":"quiz"}` objects anywhere in the text (handles extra text before/after JSON).
  5. Reverted notes JSON extraction to keep full JSON (instead of extracting `parsed.text`), letting the structured parser handle extraction consistently.
- **Dependencies Involved**: `src/utils/aiParser.js`
- **Status**: COMPLETED
- **Logged At**: July 8, 2026, 02:09 PM PST

---

### [FLOW-020] AI Title Error Recovery (renameSession on First Prompt Failure)

- **Context/Objective**: When the first AI prompt fails (timeout, API error, network error), the session is created with a truncated user message as its title. When the user retries and the AI succeeds, the session title stays as the failed attempt's truncated message instead of updating to the AI-generated title. This flow ensures that on retry, the session title updates to match the AI response.
- **Step-by-Step Logic Outline**:
  1. Added `renameSession` as a parameter dependency to the `useChat` hook in `App.jsx`.
  2. In `useChat.js sendMessage`, after the AI responds successfully, if `title` (from `<title>` tag) is non-empty and `sessionId` exists, call `renameSession(sessionId, title).catch(() => {})` — fire-and-forget.
  3. This runs regardless of whether it's a first attempt or a retry, because the AI only generates a title on the first response per SYSTEM_PROMPT instruction. So it fires at most once per session.
- **Dependencies Involved**: `src/App.jsx`, `src/hooks/useChat.js`
- **Status**: COMPLETED
- **Logged At**: July 8, 2026, 02:09 PM PST

---

### [FLOW-019] Session Menu Always Visible (Three-Dot Menu)

- **Context/Objective**: The three-dot context menu (pin, rename, delete) in the sidebar session list was hidden by default and only appeared on hover via `opacity-0 group-hover:opacity-100`. This was poor UX — users on mobile or touch devices couldn't access the menu easily. The fix makes the three-dot menu always visible while keeping the hover highlight effect.
- **Step-by-Step Logic Outline**: Removed `opacity-0 group-hover:opacity-100` from the session context menu button's className in `MainLayout.jsx:161`. Kept `hover:bg-[#7b9acc]/10` for the hover background highlight. One-line CSS class change.
- **Dependencies Involved**: `src/components/MainLayout.jsx`
- **Status**: COMPLETED
- **Logged At**: July 8, 2026, 02:09 PM PST

---

### [FLOW-017] TUON AI Multi-Phase Roadmap (Phases 0–3) — Foundation Refactor + Schema Modernization + Core & Advanced Features

- **Context/Objective**: Following a full codebase analysis, the user (a 3rd-year college student developer) requested a beginner-friendly roleducible feature roadmap plus a tech-debt cleanup plan. After interactive Q&A, the user approved the following 4-phase plan in strict sequence. This log preserves the full plan with all visual diagrams so the user can re-read it later if they ever forget the rationale or step ordering. The plan moves from foundational cleanup (Phase 0) → database modernization using an industry-standard zero-downtime migration (Phase 1) → core user-facing features (Phase 2) → advanced multimodal & voice features (Phase 3). Each phase is independently shippable and ends with a feature-flag-protected release.
- **Scope/Effort Estimate**: ~210 hours total / ~12 weeks part-time work / ~1 academic semester of side-project effort.
- **Status**: COMPLETE — Phase 0 (Steps 0.1–0.3) and Phase 1 (Weeks 1–4) fully finished. All 8 database tables created and RLS-secured. `history` JSONB column dropped from `chat_sessions`; `messages` table is the sole source of truth. Ready for Phase 2 (Streaming + Search + Collections).
- **Logged At**: July 5, 2026, 04:42 PM PST
- **Last Updated**: July 8, 2026, 11:02 AM PST

---

#### Phase 0 — "Cleanup Your Room Before Buying New Furniture" (Refactor + Tests) — Estimated 2–3 weeks

**Problem it solves**: `App.jsx` is **784 lines long** and does everything (login, chat, quiz, saving, model selection, custom models). Adding new features risks breaking unrelated pieces. There are also **zero automated tests** in the project, so every change requires manual verification.

**Step 0.1 — Decompose `App.jsx` into focused hooks**

The goal is to split the giant single file into multiple small "specialist" files (one concern each). Each new file is a React hook that owns its slice of state and logic. `App.jsx` becomes a thin orchestrator (~200 lines) that wires the hooks together.

```
BEFORE (1 giant file doing everything):

+---------------------------------------------+
| App.jsx (784 lines)                          |
| - handles login                              |
| - handles chat                               |
| - handles quiz                               |
| - handles saving sessions                    |
| - handles model selection                    |
| - handles custom models                      |
| - handles logout                             |
+---------------------------------------------+

AFTER (small focused files — one concern each):

+--------------+  +--------------+  +--------------+
| useAuth.js   |  | useChat.js   |  | useSessions  |
| - login      |  | - send msg   |  | .js          |
| - logout     |  | - start quiz |  | - fetch list |
| - boot check |  | - answers    |  | - delete     |
+--------------+  +--------------+  | - rename     |
                                   | - pin        |
                  +--------------+  +--------------+
                  | useCustomMod |
                  | els.js       |
                  | - add LLM    |
                  | - delete LLM |
                  +--------------+

App.jsx becomes a thin "boss" that hires these workers
and tells them what to do (~200 lines instead of 784).
```

**Why this matters** (especially for a student developer):

- Fewer bugs. A typo in chat logic will no longer break the login flow because they live in different files.
- This is how every professional React app is structured. Future employers look for this pattern on GitHub.
- Easier to revisit 2 months later — you instantly know that chat logic lives in `useChat.js`, not buried in a 784-line file.

**Step 0.2 — Add automated tests (Vitest + Playwright)**

**What "automated testing" means**: Without tests, every code change requires manual clicking around the app to confirm nothing broke. With tests, you write small code files that _test your code_ — running `npm run test` re-checks everything in 5 seconds.

Initial coverage targets (the simplest pure-utility files — easy wins):

```
my-app/
+-- src/
|   +-- utils/
|       +-- aiParser.js          <-- your real code
|       +-- aiParser.test.js     <-- tests for it (NEW)
+-- package.json                 <-- adds "test": "vitest" script
```

Example of what a test file looks like:

```js
test("extracts title from <title> tag", () => {
  const result = parseAIResponse("<title>My Topic</title><final>...</final>");
  expect(result.title).toBe("My Topic");
});
```

Run: `npm run test`
Result: `24 tests passed in 0.4s` <-- automatic confidence

Files to test first:

- `src/utils/aiParser.js` — every `parseAIResponse` branch (tagged, untagged, missing final, JSON-only).
- `api/sanitize.js` — `detectPromptInjection` across all 14 patterns + Unicode homoglyphs.
- `api/validatePassword.js` — all 5 rules + boundary cases.
- `src/utils/customModelStorage.js` — localStorage/sessionStorage split logic.

Add scripts: `npm run test`, `npm run test:e2e`. Wire GitHub Actions CI to run on every PR.

**Bonus for a student**: "Tested with Vitest + Playwright" on a resumé is a recruiter magnet — most students do not have this.

**Step 0.3 — Add a visible "Connection lost -> Retry" banner**

Current behavior: if the internet blips during the boot sequence, the app silently shows an empty sidebar and the user is confused. We will detect the failure and show a friendly banner: "Connection lost. [Retry]".

**Phase 0 Acceptance Criteria**:

- Behavior identical to current build (all existing routes boot cleanly).
- `npm run test` passes with >=80% coverage on the targeted utility files.
- CI runs on PRs.
- Boot failure under simulated offline mode shows the retry banner.

---

#### Phase 1 — "Rebuild the Database Foundation Before Adding New Floors" (Schema Modernization) — Estimated 4 weeks

**Pre-requisite**: Phase 0 complete (hooks + tests + retry banner).

**Problem it solves**: Your backend currently stores chat history inside one giant JSON blob column. Every new message re-writes the entire blob. Concurrent edits on different devices collide. And you cannot search inside chat contents efficiently.

**How the database looks TODAY**:

```
The "chat_sessions" table:

+----------+--------+-----------------------------------+
| id       | topic  | history                            |
+----------+--------+-----------------------------------+
| session1 | "Math" | [{role:user, text:"What is 2+2"}, |  <-- one giant
|          |        |  {role:AI,   text:"4"},            |      text
|          |        |  {role:user, text:"Explain..."},   |      column
|          |        |  ...100 messages in one box...]    |
+----------+--------+-----------------------------------+
```

**Problem**: Adding a single new message rewrites the entire 100-message blob. Two devices editing the same session at once overwrite each other.

**How it should look AFTER Phase 1**:

```
The "chat_sessions" table (slim, just metadata):

+----------+--------+-------------+----------+
| id       | topic  | updated_at  | pinned   |
+----------+--------+-------------+----------+
| session1 | "Math" | 2026-07-05  | false    |
+----------+--------+-------------+----------+

A NEW "messages" table (each message = ONE row):

+--------+-----------+-------+-------------+------+
| id     | session_id| role  | content     | pos  |
+--------+-----------+-------+-------------+------+
| msg-001| session1  | user  | What is 2+2 | 0    |
| msg-002| session1  | AI    | 4           | 1    |
| msg-003| session1  | user  | Explain...  | 2    |
| msg-004| session1  | AI    | Sure! 2+2...| 3    |  <-- adding a new
|        |           |       |             |      |      message = ONE
|        |           |       |             |      |      new row, not a
|        |           |       |             |      |      whole rewrite
+--------+-----------+-------+-------------+------+
```

**What is a "database migration"?**

A migration is a **SQL script that changes the shape of your database**. Like a recipe you write down so the database knows how to evolve. Each migration runs once, in order — like git commits but for your database.

```
migrations/
  0001_add_updated_at_to_sessions.sql
  0002_create_messages_table.sql
  0003_seed_messages_from_existing_history.sql  <-- one-time copy
  0004_drop_history_column.sql                   <-- only after we trust it
```

**Industry-standard 4-week zero-downtime migration flow**:

```
+-----------------------------------------------------------+
| Week 1: PREPARE (nothing changes for users yet)           |
+-----------------------------------------------------------+
| 1. Write migration 0001+0002 (add columns/tables)         |
| 2. Run them on Supabase. DB now has BOTH systems.         |
| 3. Update backend code so EVERY save writes to BOTH        |
|    the old history blob AND the new messages table.       |
|    (This is called "dual-write".)                         |
| 4. Deploy. Users keep using the app normally; they have  |
|    no idea anything changed -- everything still reads     |
|    from the blob.                                         |
+-----------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------+
| Week 2: BACKFILL (copy old data into the new shape)       |
+-----------------------------------------------------------+
| 5. Write a one-time script that reads every existing     |
|    chat_sessions.history blob and INSERTs each message   |
|    as a row into messages (with the correct pos number). |
| 6. Run it on Supabase. Now messages table has EVERY old  |
|    message.                                               |
| 7. Verify with a COUNT() -- messages in messages table   |
|    should equal messages in all history blobs combined.  |
|    If mismatch, investigate BEFORE switching reads.      |
+-----------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------+
| Week 3: SWITCH READS (cutover to the new system)         |
+-----------------------------------------------------------+
| 8. Update backend to READ from the messages table instead |
|    of the history blob. Still write to BOTH (belt+suspenders).
| 9. Deploy. Watch logs for a few days. If anything breaks,|
|    flip the feature flag back to reading from blob --    |
|    that's your instant rollback, no migration needed.    |
+-----------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------+
| Week 4: CLEANUP (remove the old system)                    |
+-----------------------------------------------------------+
| 10. Once reads have been on messages for a week with no   |
|     issues, stop writing to the history blob.             |
| 11. Write migration 0004 that drops the history column.  |
| 12. Run it. Done -- the old system is safely gone.        |
+-----------------------------------------------------------+
```

**Why the 4-week dance?** If you drop the blob on Day 1 and something breaks at 2 AM, users can't access their chats until you fix it. The 4-week flow always keeps a backup path. This is what senior engineers do at real companies — learning this flow puts a student developer ahead of 90% of peers.

**Additional tables to create in Phase 1** (empty, unused — ready for future phases):

- `quiz_attempts (id, user_id, session_id, topic, difficulty, score, total, created_at)` — for the future Quiz Dashboard.
- `review_items (id, user_id, message_id, ease_factor, interval, due_at, last_reviewed_at)` — for the future Spaced Repetition feature.
- `shared_quizzes (id, session_id, share_token, expires_at, created_at)` — for the future quiz-sharing feature.
- `collections (id, user_id, name, created_at)` + `session_collections (session_id, collection_id, PRIMARY KEY(session_id, collection_id))` — for Phase 2's folder feature.

**Phase 1 Acceptance Criteria**:

- Migration runs cleanly.
- Rollback scripts tested locally.
- All existing sessions still load (old `history` column stays shimmed until full cutover).
- App remains functional throughout.

---

#### Phase 2 — Core Features (Streaming + Search + Collections) — Estimated 3–4 weeks

**Pre-requisite**: Phase 1 complete (messages are individual rows, so search is possible).

**2.1 — Streaming AI Responses (chat only, NOT quiz)**

**What it does today**: When a user sends a message, the AI takes 5–10 seconds, then _all text appears at once_. Feels slow.

**What we want**: Text appears word-by-word as the AI thinks, like ChatGPT does.

```
WITHOUT streaming:
User sends message
[10 seconds of nothing happens... spinner spins... ]
TEXT APPEARS ALL AT ONCE: "Sure! 2 + 2 = 4. Here's why..."

WITH streaming:
User sends message
[immediately, words start appearing:]
>Sure!
>Sure! 2 +
>Sure! 2 + 2 =
>Sure! 2 + 2 = 4.
>Sure! 2 + 2 = 4. Here's why...
[completes after ~10 seconds, but the user saw progress]
```

**How (high level)**: AI providers (Gemini, NVIDIA NIM) support a mode called SSE (Server-Sent Events) — instead of sending the full answer, they send small chunks as the AI thinks. Your backend `api/ai.js` passes those chunks through to the frontend. The frontend updates the screen on every arriving chunk.

**User's chosen constraint**: Streaming is chat-only. Quiz generation stays buffered (waits for the full JSON), because quiz needs the complete question before showing it. Simpler and safer — no partial-JSON parser needed.

**Implementation steps**:

- Frontend: New `src/hooks/useStreamingChat.js` using `fetch` with `ReadableStream` + `TextDecoder`. `ChatInterface.jsx` appends chunks live to the active model message.
- Backend (`api/ai.js`): Switch `callOpenAICompatibleAPI` to use the upstream `stream: true` flag. Send response as `text/event-stream` from a new `POST /api/chat/stream` endpoint. Keep the existing synchronous `POST /api/chat` as fallback (used by quiz generation). Preserve the 30s `Promise.race` timeout watchdog; on timeout, end the stream with an `<error>` event.
- Parser strategy: Stream only inside `<thought>`/`<final>` once tags are detected; never JSON.parse a partial body. Quiz flow stays non-streamed. Final title parse runs once on completion to extract the title.

**Acceptance**: Streaming visible in chat; quiz flow remains buffered; `stopGenerating` aborts mid-stream cleanly; no partial-JSON crashes.

---

**2.2 — Global Search (Ctrl+K)**

**What it does today**: Only scroll the sidebar. With 50+ sessions, finding that one chat about "photosynthesis" from last month is impossible.

**What we want**: A search bar at the top. Type a word -> see all sessions matching that word, both in titles AND in chat content.

```
+--------------------------------------------------+
|  [search icon] [search: "photosynthesis"     ] Ctrl+K |
+--------------------------------------------------+

Results:
+---------------------------------------------+
| [pin] Biology Midterm Review   (title match)|
|    "Photosynthesis is how plants..."        |
+---------------------------------------------+
| [note] Random chat 3           (content match)
|    "...asked me about photosynthesis in..." |
+---------------------------------------------+
```

**Why Phase 1 had to come first**: To search inside chat content, each message must be its own database row. With the old JSON blob, search would require opening every chat and scanning the blob in code — too slow. With the `messages` table, it's one SQL query:

```sql
SELECT session_id, snippet(content, 'photosynthesis')
FROM messages
WHERE content ILIKE '%photosynthesis%';
```

**Implementation steps**:

- Frontend: New `src/components/SearchBar.jsx` in `MainLayout` header (next to `ModelSelector`). `Ctrl+K` focus shortcut. Debounced (300ms) query -> `GET /api/sessions/search?q=...`. Results grouped by "Title matches" and "Content matches".
- Backend: New `GET /api/sessions/search` endpoint in `api/index.js` — primary search on `chat_sessions.topic` ILIKE, secondary on `messages.content` ILIKE (now possible because of Phase 1). Start with `ILIKE`; upgrade to Postgres FTS (`to_tsvector` + `ts_rank`) if message volume grows.

**Acceptance**: Typing "photosynthesis" finds sessions by both title and content; sub-200ms response on a sample of 1000 messages.

---

**2.3 — Collections (Folders)**

**What it does today**: Binary Pin/Not-Pinned.

**What we want**: Real folders. Group all "Biology Midterm" chats together, all "JavaScript Interview" chats together.

```
Sidebar after Phase 2.3:

v Biology Midterm
    +-- [pinned] Cell structure quiz
    +-- Photosynthesis notes
    +-- Mitochondria question
v JavaScript Interview
    +-- Closures deep dive
    +-- Event loop quiz
v Uncategorized (4)
    +-- Random thought
    +-- Math help
    +-- ...
```

**Implementation steps**:

- Frontend: Sidebar shows collections as collapsible groups above the Pinned/Recent sections. Each session has a "Move to Collection" option in its context menu (alongside Pin/Rename/Delete). A built-in "Uncategorized" pseudo-collection holds everything without an assigned collection. New `src/components/CollectionModal.jsx` for create/rename/delete collections.
- Backend: `GET /api/collections` (list user collections with session counts), `POST /api/collections` (create), `DELETE /api/collections/:id`, `POST /api/collections/:id/sessions/:sid` (assign), `DELETE /api/collections/:id/sessions/:sid` (unassign). All routes use the existing `authenticate` middleware.
- Constraint: One-level nesting only (no folders inside folders) — keeps the UX clean.

**Acceptance**: Sessions can be grouped, removed, reassigned; sidebar reflects changes live.

---

#### Phase 3 — Advanced Features (Multimodal + Voice) — Estimated 2–3 weeks

**Pre-requisite**: Phase 2 complete.

**3.1 — Multimodal (Image & File Upload)**

**What it does today**: Only text chat.

**What we want**: User drops a photo of a textbook page and asks "quiz me from this page" -> AI reads the image and produces a quiz.

**Important technical constraint**:

- **Gemini supports vision** (it can "see" images).
- **NVIDIA NIM models (Step, GLM) DO NOT support vision** in the current setup.
- When a user attaches an image, the `ModelSelector` **greys out** the non-vision models automatically:

```
When NO image attached:
+---------------------+
| Gemini 3.1 Flash [v]|
| Step 3.7 Flash      |
| GLM 5.1             |
+---------------------+

When image attached:
+---------------------+
| Gemini 3.1 Flash [v]|  <-- usable
| Step 3.7 Flash      |  <-- greyed out, "Vision only" label
| GLM 5.1             |  <-- greyed out, "Vision only" label
+---------------------+
```

**Where images are stored**: **Supabase Storage** (a separate private bucket, like a folder in the cloud) — NOT in the database. Databases are not meant for big files. Each upload gets a private signed URL that expires in 24 hours.

**Implementation steps**:

- Frontend: New `src/components/FileUploadButton.jsx` in `ChatInterface` (paperclip icon). Supports clipboard paste, drag-drop, and click-upload. Preview thumbnails appear above the textarea before sending. Accepts `image/png, image/jpeg, image/webp, application/pdf`. Per-image size limit 4MB, max 4 images per message (server-enforced).
- Backend (`api/ai.js`): Add an `images: [{url, mimeType}]` array to the request body — either a new `POST /api/chat/multimodal` endpoint or extend `/api/chat`. Convert each image to base64 data URL OR upload to Supabase Storage and pass the public signed URL (preferred — avoids bloat). Send to Gemini via the OpenAI-compatible content parts schema:
  ```js
  content: [
    { type: "text", text: message },
    { type: "image_url", image_url: { url: "data:image/png;base64,..." } },
  ];
  ```
- Security: Validate MIME type server-side (reject `text/html`, `application/javascript`). Size limits enforced. Log a new `SEC-017` entry in security memory documenting the new attack surface.

**Acceptance**: User uploads a textbook photo; AI summarizes/extracts/quiz-generates from it. Non-vision models are blocked from this path with a clear UI message.

---

**3.2 — Voice Input & Read-Aloud (Web Speech API)**

**Voice input**: A mic icon button in `ChatInterface` next to the Send button. Click -> speak -> words appear in your text box -> you can review before sending. Uses a free browser API (`webkitSpeechRecognition`) — works in Chrome and Edge. Firefox/Safari don't support it, so we hide the button there (graceful fallback).

**Read-aloud (Text-to-Speech)**: A speaker button on every AI reply bubble and on every quiz feedback block. Click -> the browser reads the message out loud. Uses another free browser API (`speechSynthesis`). Voices selectable (default = first English voice). Single active utterance — clicking again pauses/cancels. Add a global "Stop reading" control in the header when active.

```
Your chat interface after Phase 3.2:

+----------------------------------------------+
| AI: The French Revolution began in 1789...  |
|                                       [spkr] |  <-- read aloud button
+----------------------------------------------+

+----------------------------------------------+
| [attach]  [mic]                              |
| [Type your question...             ]  [Send] |
+----------------------------------------------+
```

**Accessibility bonus**: These two features double as an accessibility win for visually-impaired or motor-impaired users. Document in review memory.

**Acceptance**: Voice dictation works in Chrome/Edge. Read-aloud reads notes and quiz feedback, pauses when the user navigates away from the message, respects reduced-motion preferences.

---

#### Phase 4 (Optional / Deferred — NOT in current priority)

These features were suggested but NOT selected by the user in this session. They slot cleanly into the post-Phase-1 architecture whenever the user is ready:

- **Quiz Attempts Dashboard** — uses the `quiz_attempts` table created in Phase 1. Shows score trends over time, weakest topics, accuracy per difficulty tier.
- **Spaced Repetition** — uses the `review_items` table. SM-2 algorithm ported as a small `src/utils/spacedRepetition.js`.
- **Flashcard Decks** — built on top of `review_items`. Supports flip-to-reveal UX. Export to `.csv` / `.json` for Anki.
- **Quiz Sharing (read-only public links)** — uses the `shared_quizzes` table. New `/q/:token` route.
- **Quiz Question Types Expansion** — true/false, fill-in-the-blank (text input, AI-graded), short answer (AI eval pass/fail). Schema + parser + UI changes.
- **Streaming Quiz Flow** — extend streaming to quiz generation later. Riskier (needs streaming-aware JSON parser), deferred until chat streaming is proven stable.
- **Topic Templates / Quick Start** — pre-built prompt templates ("SAT Math Drill", "Spanish Vocabulary"). Reduces cold-start friction.
- **Streaks / Daily Goal** — localStorage + server-side persistence. Lightweight gamification.
- **Refresh Token Auth** — replaces the 1-day JWT with a 7-day refresh + 1-day access cookie pair. Reduces annoying daily logins.
- **Monitoring / Alerting** — Sentry or lightweight observability hook so API failures are visible to the developer, not just the user.

---

#### Risk Register

| Risk                                                            | Mitigation                                                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming partial-JSON crash                                    | Stream only inside `<thought>`/`<final>` once tags are detected; never JSON.parse a partial body. Quiz flow stays non-streamed.                            |
| Schema migration breaks existing sessions                       | Keep `history` column during Phase 2 migration; run sync job; cut over behind feature flag; preserve rollback SQL.                                         |
| `App.jsx` refactor introduces subtle state-ordering regressions | Refactor commit-by-commit; each hook extracted and shipped independently with the test suite green; Playwright e2e matches every regression.               |
| Multimodal API cost spike                                       | Add per-user daily image quota (5 images/day default, configurable). Reuse existing rate-limit framework (`express-rate-limit`) on `/api/chat/multimodal`. |
| Voice API inconsistent across browsers                          | Feature-detect `webkitSpeechRecognition`. Hide mic button where unsupported — no broken UI.                                                                |

---

#### Phase-by-Phase Timeline Summary

| Phase                                                | Effort                            | Calendar                |
| ---------------------------------------------------- | --------------------------------- | ----------------------- |
| Phase 0 — Refactor + tests                           | ~50 hours                         | 2–3 weeks               |
| Phase 1 — DB schema migration (industry 4-week flow) | ~30 hours work + observation time | 4 weeks                 |
| Phase 2 — Streaming + Search + Collections           | ~80 hours                         | 3–4 weeks               |
| Phase 3 — Multimodal + Voice                         | ~50 hours                         | 2–3 weeks               |
| **Total**                                            | **~210 hours**                    | **~12 weeks part-time** |

For a 3rd-year student doing this part-time alongside classes, this is roughly **one full semester of side-project work** — totally normal and achievable.

---

#### Phase Ordering Dependency Diagram

```
Phase 0          Phase 1           Phase 2              Phase 3
-------          -------           -------              -------
Cleanup code     New database      New user-facing      Advanced
foundation       shape (4-week      features (search,    features
(tests + hooks)  industry           folders, streaming)  (+ voice)
                 migration)

   |------->     |------->         |------->            ---->
                                                                 |
                                                                 v
                                                        Phase 4 (later):
                                                        Quiz history dashboard
                                                        Spaced repetition
                                                        Flashcards
                                                        Quiz sharing
                                                        ... and more
```

Each column must finish before the next starts. If you build Phase 2 search on the old JSON-blob database, you'd have to rewrite it later. **Phase 1 sets the foundation for life.**

---

### [FLOW-016] Verbose Error Logging Fix (SEC-005)

- **Context/Objective**: Prevent full error objects from being logged to Vercel logs, which could expose internal paths, database schema, or API keys.
- **Step-by-Step Logic Outline**:
  1. Audited all `console.error()` calls across `api/index.js` (8 locations), `api/ai.js` (2 locations), and `api/auth.js` (3 locations).
  2. Changed every `console.error('...', error)` to `console.error('...', error.message || error)` — logs only the human-readable message string, not the full error object with stack traces.
  3. 13 total logging locations fixed across 3 backend files.
- **Dependencies Involved**: `api/index.js`, `api/ai.js`, `api/auth.js`
- **Status**: COMPLETED
- **Logged At**: July 1, 2026, 11:10 AM PST

---

### [FLOW-015] Self-Hosted Workbox Runtime (SEC-004)

- **Context/Objective**: Remove CDN dependency for Workbox in the service worker to prevent supply chain attacks.
- **Step-by-Step Logic Outline**:
  1. Rewrote `public/pwabuilder-sw.js` to be fully self-contained — no `importScripts` from CDN.
  2. Replaced `workbox.navigationPreload.isSupported()` and `workbox.navigationPreload.enable()` with native `self.registration.navigationPreload` API.
  3. Added `self.skipWaiting()` in install event and `self.clients.claim()` in activate event for immediate activation.
  4. Removed the `public/workbox/` directory that was temporarily created for CDN file downloads.
- **Dependencies Involved**: `public/pwabuilder-sw.js`
- **Status**: COMPLETED
- **Logged At**: July 1, 2026, 11:10 AM PST

---

### [FLOW-014] Email Verification System (SEC-003)

- **Context/Objective**: Prevent disposable email abuse by requiring email verification before allowing AI feature access.
- **Step-by-Step Logic Outline**:
  1. Installed `resend` package (npm) for email delivery via Resend API.
  2. Created `api/email.js` with `sendVerificationEmail()` and `sendPasswordResetEmail()` helper functions — HTML email templates with branded TUON AI styling.
  3. Added `generateToken()` helper using `crypto.randomBytes(32)` for secure token generation.
  4. Updated signup route in `api/auth.js` to generate verification token, save to `profiles.verification_token`, and send verification email (fire-and-forget).
  5. Added `POST /api/auth/verify-email` endpoint — validates token, sets `email_verified = true`, clears token.
  6. Updated `GET /api/auth/me` to return `email_verified` field.
  7. Updated JWT payload to include `emailVerified` claim.
  8. Created `src/components/VerifyEmail.jsx` — standalone page that reads `?token=xxx` from URL and calls verify endpoint.
  9. Added Vercel rewrite for `/verify-email` → `/index.html` and client-side routing in `App.jsx`.
- **Database Migration Required**:
  ```sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_token TEXT DEFAULT NULL;
  ```
- **Environment Variables Required**:
  - `RESEND_API_KEY` — from Resend dashboard
  - `EMAIL_FROM` — optional, defaults to `onboarding@resend.dev`
  - `APP_URL` — optional, defaults to `https://quizmakerapp.vercel.app`
- **Dependencies Involved**: `api/auth.js`, `api/email.js`, `src/components/VerifyEmail.jsx`, `src/App.jsx`, `vercel.json`
- **Status**: COMPLETED
- **Logged At**: July 1, 2026, 11:10 AM PST

---

### [FLOW-013] Password Reset System (SEC-002)

- **Context/Objective**: Allow users to self-recover accounts when they forget their password.
- **Step-by-Step Logic Outline**:
  1. Added `POST /api/auth/forgot-password` endpoint — accepts email, generates reset token (1-hour expiry), saves to `profiles.reset_token` and `profiles.reset_token_expires`, sends reset email. Returns success message even if email not found (prevents email enumeration).
  2. Added `POST /api/auth/reset-password` endpoint — accepts token + new password, validates token and expiry, hashes new password with bcrypt, updates `password_hash`, clears `reset_token` and `reset_token_expires`, resets `failed_login_attempts` and `locked_until`.
  3. Created `src/components/ForgotPassword.jsx` — email input form, sends reset request, shows success message.
  4. Created `src/components/ResetPassword.jsx` — new password form with real-time password requirements checklist (same as signup), validates token from URL.
  5. Added "Forgot password?" link to `Login.jsx` (shown only in sign-in mode).
  6. Added Vercel rewrites for `/forgot-password` and `/reset-password` → `/index.html`.
  7. Added client-side routing in `App.jsx` for all three auth pages.
- **Database Migration Required**:
  ```sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reset_token TEXT DEFAULT NULL;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ DEFAULT NULL;
  ```
- **Dependencies Involved**: `api/auth.js`, `src/components/ForgotPassword.jsx`, `src/components/ResetPassword.jsx`, `src/components/Login.jsx`, `src/App.jsx`, `vercel.json`
- **Status**: COMPLETED
- **Logged At**: July 1, 2026, 11:10 AM PST

---

### [FLOW-012] Per-Account Lockout (SEC-009)

- **Context/Objective**: Add per-account lockout to prevent brute-force attacks that bypass IP-based rate limiting. After 5 failed login attempts, lock the account for 15 minutes regardless of which IP the requests come from. Send email notification when account is locked.
- **Step-by-Step Logic Outline**:
  1. Added `MAX_FAILED_ATTEMPTS = 5` and `LOCKOUT_MINUTES = 15` constants in `api/auth.js`.
  2. Added `checkAccountLock(user)` helper — checks if `user.locked_until` is in the future; returns `{ locked, message }` with remaining lockout time in minutes.
  3. Added `recordFailedLogin(email)` helper — queries current `failed_login_attempts`, increments by 1, sets `locked_until` to now + 15min when attempts reach 5. Sends lockout notification email via Resend when account is locked.
  4. Added `resetFailedLogins(email)` helper — resets `failed_login_attempts` to 0 and `locked_until` to null on successful login.
  5. Login route integration: (a) After finding user, before password check → call `checkAccountLock()` → return 429 if locked. (b) After failed `bcrypt.compare` → call `recordFailedLogin()`. (c) After successful `bcrypt.compare` → call `resetFailedLogins()`.
  6. Updated `Login.jsx` `formatAuthError()` to map "Account locked" messages to user-friendly text.
  7. Added `sendLockoutEmail(email, lockedUntil)` to `api/email.js` — sends branded HTML email with lockout duration and unlock time (Asia/Manila timezone).
  8. **Database migration required** — user must run SQL in Supabase dashboard:
     ```sql
     ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
     ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL;
     ```
- **Email Notification**: Implemented via Resend. Sends fire-and-forget email when account is locked at 5th failed attempt. Email includes unlock time in Philippine time.
- **Dependencies Involved**: `api/auth.js`, `api/email.js`, `src/components/Login.jsx`, Supabase `profiles` table
- **Status**: COMPLETED
- **Logged At**: July 1, 2026, 11:42 AM PST

---

### [FLOW-011] Per-Model Rate Limiting

- **Context/Objective**: Replace the single global `chatLimiter` (30 req/min for all models) with a model-aware rate limiter that applies different RPM limits based on which AI provider is being used. This maximizes each provider's capacity — Google Gemini has 15 RPM, NVIDIA NIM has 40 RPM — while preventing any single model from being over- or under-provisioned.
- **Step-by-Step Logic Outline**:
  1. Added `MODEL_RPM_LIMITS` map in `api/index.js` defining per-model limits: `gemini-3.1-flash-lite` → 15, `step-3.7-flash` → 40, `glm-5.1` → 40, with `DEFAULT_RPM = 20` for custom/unknown models.
  2. Replaced the static `chatLimiter` with a model-aware version using `express-rate-limit`'s dynamic `max` and `keyGenerator` functions.
  3. `keyGenerator` creates unique keys in format `ip:model` (e.g., `192.168.1.1:gemini-3.1-flash-lite`) so each IP+model combination has its own independent counter.
  4. `max` function reads `req.body.model` and returns the model-specific limit from `MODEL_RPM_LIMITS`, falling back to `DEFAULT_RPM` (20) for custom models.
  5. `express.json()` is applied globally before the route, so `req.body.model` is available when the limiter middleware runs.
- **Provider RPM Breakdown**:
  - Google Gemini 3.1 Flash Lite: 15 RPM (Google AI Studio free tier)
  - Step 3.7 Flash: 40 RPM (NVIDIA NIM)
  - GLM 5.1: 40 RPM (NVIDIA NIM)
  - Custom LLMs: 20 RPM (safe default — provider limits unknown)
- **Cross-Model Isolation**: A burst of Gemini requests does NOT consume NVIDIA's quota. Each model has its own independent counter per IP.
- **Dependencies Involved**: `api/index.js`
- **Status**: COMPLETED
- **Logged At**: July 1, 2026, 10:29 AM PST

---

### [FLOW-010] Changelog Modal

- **Context/Objective**: Replace the floating announcement banner with a clickable version tag that opens a modal window showing full release notes from `public/changelog.json`. The version tag displays a notification dot when a new version hasn't been dismissed yet.
- **Step-by-Step Logic Outline**:
  1. The `v1.0.0` tag in `MainLayout.jsx` header bar is now a `<button>` that calls `handleOpenChangelog()`. Shows a notification dot when `localStorage.getItem('quizmaker_dismissed_version') !== VERSION`.
  2. Changelog source is `public/changelog.json` — static JSON file served by Vercel CDN, copied to `dist/` on build. Contains an array of version objects with `version`, `date`, and `notes` fields.
  3. Modal UI: Centered overlay with backdrop blur, max-width `max-w-lg`, scrollable (`max-h-[80vh]`), sticky header with "What's New" title and close button. Each version is rendered as a section with version badge, date, and bullet-pointed notes.
  4. Version-Aware Dismissal: Closing the modal stores the current version string in localStorage (`quizmaker_dismissed_version`). The notification dot only appears when the stored version differs from the app's `VERSION` constant.
  5. Caching: The changelog data is fetched once and cached in React state. Subsequent clicks open instantly without a network request.
  6. Loading State: A spinner overlay is shown while fetching the JSON file, with a "Loading changelog..." message.
- **Dependencies Involved**: `public/changelog.json`, `src/components/MainLayout.jsx`
- **Status**: COMPLETED
- **Logged At**: June 30, 2026, 11:01 AM PST

---

### [FLOW-009] Announcement Banner (Replaced by FLOW-010)

- **Context/Objective**: Added a floating announcement bar at the top of the main content area with a close button (x) and localStorage persistence. Shows "TUON AI v1.0.0" with a companion message.
- **Step-by-Step Logic Outline**:
  1. Added a floating announcement bar component in `MainLayout.jsx`.
  2. Implemented close button with localStorage dismissal persistence (`quizmaker_dismissed_announcement`).
  3. Dismissed state survives page refreshes.
- **Dependencies Involved**: `src/components/MainLayout.jsx`
- **Status**: ARCHIVED (replaced by FLOW-010)
- **Logged At**: June 30, 2026, 11:01 AM PST

---

### [FLOW-008] Local LLM Option

- **Context/Objective**: Add support for user-provided custom/local LLMs. Users can now add any OpenAI-compatible local server (e.g., Ollama, LM Studio) directly through the ModelSelector dropdown. The backend accepts dynamic model configurations that bypass the fixed `MODEL_CONFIGS` lookup.
- **Step-by-Step Logic Outline**:
  1. ModelSelector UI: Added a "Custom LLMs" section at the bottom of the dropdown with a divider. Users see saved custom models listed with a delete button (trash icon). An "Add Custom LLM" button expands an inline form with fields for display name, base URL, model ID, and optional API key.
  2. Persistence: Custom models are stored in localStorage under `quizmaker_custom_models` as an array of `{ id, name, baseUrl, modelId, apiKey }` objects. The `App.jsx` state is initialized from localStorage on boot.
  3. API Integration: When a custom model is selected, `App.jsx` passes the full `customModelConfig` object alongside `model` in all `/api/chat` requests. The backend (`api/index.js`) forwards it to `handleChat` in `api/ai.js`.
  4. Backend Dynamic Config: `handleChat` in `api/ai.js` now accepts an optional `customModelConfig` parameter. If provided, it builds a dynamic config (strips trailing slash from baseUrl, uses inline API key or empty) and calls `callOpenAICompatibleAPI` directly, bypassing the `MODEL_CONFIGS` lookup.
  5. Auth Header Flexibility: `callOpenAICompatibleAPI` now supports inline API keys in the config object (taking precedence over env-based lookups). If the API key is empty, the `Authorization` header is omitted entirely.
- **Dependencies Involved**: `src/components/ModelSelector.jsx`, `src/App.jsx`, `src/components/MainLayout.jsx`, `api/ai.js`, `api/index.js`
- **Status**: COMPLETED
- **Logged At**: June 30, 2026, 11:01 AM PST

---

## 2. ARCHIVE STATUS

- **Archive File**: `.opencode/archives/implementation_archive.md`
- **Threshold**: 10 active entries per section
- **Total Archived**: 8
- **Last Archive Check**: July 5, 2026, 09:47 AM PST

| Entries Archived | Archived At (PST)           |
| ---------------- | --------------------------- |
| 3                | June 30, 2026, 07:53 PM PST |
| 5                | July 5, 2026, 09:47 AM PST |

<!-- c: worrie -->
