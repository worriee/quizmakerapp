# Workspace Error Log & Debugging Memory

## 0. Last Synchronized Checkpoint

- **Last Error Check**: July 12, 2026, 10:42 am PST

## 1. Active & Unresolved Errors

_(No active errors remaining)_

---

## 2. Historical & Resolved Errors

### [PHASE 2.1 COMPLETE] SSE Streaming Fully Operational on Render — All Parsing & Streaming Errors Resolved (ERR-067)

- **Phase 2.1 Summary**: SSE streaming for AI chat responses is now fully implemented and stable on Render. The feature went through a complete cycle: initial implementation → Render migration → multiple bug fixes → full project reset → re-implementation with proper Render proxy handling. All related errors (ERR-054 through ERR-066) are resolved and documented below.
- **Key Deliverables**:
  - Backend: `callOpenAICompatibleAPIStream()` with line buffer, idle timeout, end-of-stream signal
  - Backend: SSE route at `POST /api/chat/stream` with JWT query-param auth, abort-on-disconnect
  - Frontend: `streamingVisibleText()` with tag mode, JSON mode, plain text, thinking-text hiding
  - Frontend: Progressive text display with blinking cursor (streaming) + ReactMarkdown (complete)
  - Frontend: Cancel button (replaces Send during streaming), pre-streaming loading dots
  - Deployment: Render full-stack (Node.js) with `setNoDelay`, `trust proxy 1`, static serving, CSP headers
- **Related Error Entries**: ERR-054 (tags visible), ERR-055 (cancel UI), ERR-056 (loading indicator), ERR-057 (Vercel timeout → Render), ERR-058 (SSE framing + Nagle), ERR-059 (line-buffered reader), ERR-060 (thinking leaks), ERR-061 (revert + tryParseJson), ERR-062 (JSON extraction), ERR-063 (stripTrailingThinking), ERR-064 (project reset), ERR-065 (Render 404), ERR-066 (setNoDelay + line buffer + thinking pattern)
- **Completed At**: July 12, 2026, 10:42 am PST

### [RESOLVED] Render Streaming Cut Off + Thinking Leak — Proxy Buffering + Missing Line Buffer + setNoDelay (ERR-066)

- **The Issue**: On Render deployment, two problems appeared that did NOT occur locally:
  1. **Output cut off**: The AI response was incomplete — text stopped mid-response (e.g., after "Robust: Java emphasizes early error checking..."). The stream appeared to terminate before the full generation.
  2. **Thinking text leaked at the beginning**: "The user is asking for a definition of Java. Since this is the first interaction, I will act as a Learning Assistant and provide comprehensive study notes in the requested..." — AI reasoning text appeared in the final visible output instead of being hidden.
- **Root Causes**:
  1. **No `setNoDelay(true)`**: Render's Envoy proxy buffers HTTP responses by default. Without disabling Nagle's algorithm on the TCP socket, small chunks from the AI provider were delayed/batched by the proxy, causing the connection to appear stalled and eventually timeout mid-stream.
  2. **No line buffer for SSE chunks**: The AI provider sends SSE data (`data: {"choices":[{"delta":{"content":"..."}}]}\n\n`). When Render's proxy splits a line across TCP chunks, the original code processed each chunk independently (`.split("\n")` on each chunk). This caused partial SSE lines to be discarded, losing content mid-word.
  3. **No end-of-stream signal**: After the AI stream completed, the server just called `res.end()`. On Render, the proxy doesn't immediately forward the connection close to the client. The client's `reader.read()` hung, and the last visible state (including thinking text) persisted.
  4. **`streamingVisibleText` showed everything before `<final>`**: When no `<final>` tag existed yet, the function returned all plain text (including thinking). On Render's slower proxy, the delay meant users saw thinking text for longer.
- **The Fix** (4 changes across 3 files):
  1. **`api/index.js`**: Added `app.set("trust proxy", 1)` (line 17) and `req.socket.setNoDelay(true)` in the stream route (lines 483-485) — disables Nagle's algorithm so small chunks are sent immediately through Render's proxy.
  2. **`api/ai.js`**: Added line buffer (`lineBuffer` at line 378, processed at lines 402-409) — accumulates partial SSE lines across chunk boundaries. Added remaining buffer processing after the loop (lines 428-447). Added end-of-stream signal `\n\n` (line 450) — tells the client the stream is done even if `res.end()` is delayed by the proxy.
  3. **`src/utils/aiParser.js`**: Added thinking pattern check in `streamingVisibleText` (lines 256-259) — when no `<final>` tag exists and visible text starts with thinking patterns (`"The user is asking..."`, `"I need..."`, etc.), returns empty string (shows blinking cursor) instead of leaking the thinking text.
- **Files Changed**: `api/index.js` (+6 lines), `api/ai.js` (+37 lines), `src/utils/aiParser.js` (+5 lines)
- **Resolved At**: July 12, 2026, 10:29 am PST

### [RESOLVED] Render "Cannot GET /" 404 — Missing Static File Serving After Reset (ERR-065)

- **The Issue**: The beta branch deployed on Render showed "Cannot GET /" at the root URL. Browser console: `GET https://quizmakerapp.onrender.com/ 404 (Not Found)`. The entire React app was unreachable.
- **Root Cause**: After resetting to commit `8eec977`, the codebase was in Vercel-serverless mode. `api/index.js` only defined API routes (`/api/auth/*`, `/api/chat/*`, `/api/sessions/*`). It had NO `express.static("dist")` to serve the built React frontend and NO `app.get("*")` catch-all for SPA client-side routing. When Render started the server via `server.js` → `api/index.js`, the Express app received `GET /` but had no matching route → returned default Express 404.
- **The Fix**: Added 3 things to `api/index.js`:
  1. `import path from "path"` (line 5) — for `__dirname` resolution in ES modules
  2. CSP middleware (lines 29-36) — Content-Security-Policy header with `manifest-src 'self'` and `worker-src 'self'`
  3. Static serving + SPA catch-all (lines 506-513):
     - `app.use(express.static(path.join(__dirname, "..", "dist")))` — serves built React files
     - `app.get("*", (req, res) => { res.sendFile(path.join(__dirname, "..", "dist", "index.html")) })` — catch-all for client-side routing
- **Files Changed**: `api/index.js` (+19 lines: import, CSP, static serving, catch-all)
- **Resolved At**: July 12, 2026, 10:07 am PST

### [RESOLVED] Full Project Reset — Both Branches Reset to Commit 8eec977 (ERR-064)

- **The Issue**: The user reset both `main` and `beta` branches to commit `8eec977` via `git reset --hard` and force push. This removed ALL commits after `8eec977`, including:
  - `ac14caa` feat: migrate to Render full-stack deployment
  - `abd1211` fix: response_format removal, setNoDelay, AI error detection for Render streaming
  - `0588fcd` fix: line-buffered SSE reader to handle chunk-split messages + trust proxy
  - `b0c3562` fix: always use SYSTEM_PROMPT_TAGS for streaming, hide thinking text during stream
  - `8025c3d` fix: preserve JSON escapes, add JSON fallback to streamingVisibleText and parseAIResponse
  - All merge commits between main and beta
- **What This Means**: The project is now back to the pre-streaming-fixes state:
  - SSE streaming exists (from `46219dd`) but with the ORIGINAL implementation — NO line-buffered reader, NO setNoDelay, NO trust proxy
  - `aiParser.js` is the original 439-line version — NO `tryParseJson`, NO `stripTrailingThinking`, NO universal JSON extraction before stripThinkingText
  - `api/ai.js` is the original 288-line version — NO streaming function, NO handleChatStream
  - Deployment target is Vercel (NOT Render) — `vercel.json` is the active config
  - All test files are gone — `aiParser.test.js` was untracked+deleted, `e2e/` directory removed
  - ERR-057 through ERR-063 are all technically undone (the code they fixed no longer exists)
- **Status**: RESOLVED (intentional reset)
- **Resolved At**: July 11, 2026, 04:34 pm PST

### [RESOLVED] Universal Trailing Thinking Stripper — `stripTrailingThinking` Catches Models Ignoring Format Instructions (ERR-063)

- **The Issue**: All models (Gemini/Gemma, NVIDIA/Step, Minimax, custom) leaked thinking/reasoning text into the final output when they ignored their system prompt format. The real-world pattern was: models output clean markdown content followed by a thinking paragraph like "The user is asking a follow-up question about React.js, continuing the technology/computing topic theme." The `isMostlyThinking` check correctly returned `false` (text was mostly clean), so `stripThinkingText` was never called and the thinking tail passed through unmodified.
- **Root Cause**: There was a fundamental GAP in the parser — no mechanism to detect and strip **trailing** thinking text at the end of an otherwise-clean response. The existing tools only handled two scenarios:
  1. **Tags extracted via `<tag>` regex** — fails when model doesn't use tags
  2. **`isMostlyThinking` + `stripThinkingText`** — only runs when the ENTIRE text is mostly thinking. Fails when 80% is clean content with only 20% thinking at the end
- **The Fix** — New `stripTrailingThinking(text)` function at `aiParser.js`:
  1. **Scans from the LAST paragraph backward**: Splits text by `\n\n`, starts from the end, checks each paragraph against conservative thinking patterns (e.g., `/^The user (?:is asking|wants|provided|...)/i`, `/^I (?:need to (?:acknowledge|provide|respond|...))/i`). Removes all trailing paragraphs that match.
  2. **Single-paragraph fallback**: If only 1 paragraph, checks trailing sentences instead (splits by `.`/`!`/`?`, same backward scan).
  3. **Safety guard**: Only strips if removed paragraphs < 40% of total (or unlimited for < 5 paragraphs). Prevents stripping legitimate content.
  4. **30 conservative patterns**: Only matches meta-cognitive text like "The user is asking...", "I need to respond...", "As an AI assistant...", "Let me explain...", "Based on your question...". Never matches legitimate content like "The user can install React using npm."
  5. **Called at TWO points in the pipeline**:
     - `parseAIResponse()` (line ~580) — runs after ALL format-specific extraction (tags, JSON, JSON-in-text, isMostlyThinking). Catches ANY model regardless of format.
     - `streamingVisibleText()` (line ~303) — also strips trailing thinking during streaming, so user never sees it even in partial output.
- **Test Results** — 28/28 tests pass covering:
  - Gemini/Gemma: proper tags, malformed tags, chat mode, trailing thinking AFTER clean `<final>` content
  - NVIDIA: pure JSON, JSON with leading text, real newlines, trailing remnants
  - Minimax-style: clean markdown + trailing thinking paragraph, multiple trailing paragraphs, single paragraph with trailing thinking sentence, clean text unchanged, "The user can" (legitimate) NOT stripped, short text below threshold
  - General OpenAI: plain text, backtick JSON, code block JSON, generic trailing thinking sentence
  - streamingVisibleText: null, error, `<final>` tag, plain text, trailing thinking stripped
  - Regression: empty/null input
- **Files Changed**: `src/utils/aiParser.js` (added `stripTrailingThinking()` function at line 55, called from `parseAIResponse` at line ~580 and `streamingVisibleText` at line ~303)
- **Resolved At**: July 11, 2026, 04:34 pm PST

### [RESOLVED] Thinking Text Leaks in Final Output Across All Models — Universal JSON Extraction Before Heuristic Stripping (ERR-062)

- **The Issue**: After all previous fixes, Gemini, Gemma, and NVIDIA models all still showed thinking/reasoning text in the final displayed output. The `stripThinkingText` heuristic was damaging actual content (stripping headings and content mixed with thinking-like text) while leaving JSON structural remnants (`"}`) in the output.
- **Root Cause**: The `stripThinkingText` heuristic at `aiParser.js:438-441` was TOO aggressive and worked WRONG:
  1. **`stripThinkingText` splits by newlines** and classifies each paragraph using `isMostlyThinking`. Paragraphs containing BOTH content AND thinking-like text (e.g., `## BSIT Overview` in the same paragraph as `"thought":"The user wants..."`) were entirely discarded.
  2. **JSON structural remnants leaked** — when the JSON was broken by `normalizeOutput` (converting `\n` to real newlines), paragraph splitting at `\n\n` boundaries separated JSON key-value pairs. The `"` and `}` from the JSON object appeared as trailing garbage in the output.
  3. **Chat JSON without `"type"` field** was never matched by the fallback regex (`/\{[\s\S]*?"type"\s*:\s*"(notes|quiz)"[\s\S]*?\}/`), so the entire raw text (thinking + JSON) went through `stripThinkingText` which mangled it.
- **The Fix** — Universal JSON extraction before heuristic stripping (line 438):
  1. **Moved `isMostlyThinking` into an `else if` branch**: The new code first tries to extract JSON from `final` using a broader regex `/\{[\s\S]*?"(?:content|text)"\s*:\s*"((?:[^"\\]|\\.)*)[\s\S]*?\}/` that matches BOTH `"content"` (chat format) and `"text"` (notes/quiz format) fields. Only if no JSON is found does it fall through to `isMostlyThinking`/`stripThinkingText`.
  2. The extracted JSON text value is returned cleanly without JSON structural characters. The `\n`/`\t` escapes are decoded.
  3. This works for ALL models and ALL output formats: tags, pure JSON, mixed text+JSON, backtick-wrapped code blocks, etc.
- **Test Results** — 17/17 tests pass covering:
  - Gemini/Gemma: proper tags, malformed tags, missing closing tags, chat mode without JSON
  - NVIDIA: pure JSON chat, JSON notes, JSON with leading text, JSON with real newlines, JSON with trailing remnants
  - General OpenAI-compatible: plain text, backtick-wrapped JSON, code block JSON
  - All verify thinking text does NOT leak into `displayText`
- **Files Changed**: `src/utils/aiParser.js` (line 438: replaced `isMostlyThinking`-only check with JSON extraction + `isMostlyThinking` fallback)
- **Resolved At**: July 11, 2026, 04:09 pm PST

### [RESOLVED] Final Output Still Messy After All Parser Changes — Reverted to Original + tryParseJson Sanitizer (ERR-061)

- **The Issue**: Previous parser changes (ERR-060) broke both local and deployed output. The final text included thinking/reasoning, JSON fragments (`text": "## BSIT...`), and actual newlines corrupting the display. The user reported the ORIGINAL parser worked correctly — the problem was only in the new changes.
- **Root Cause**: Four compounding mistakes:
  1. **`streamingVisibleText`**: Changed from "show all text" to "return empty until `<final>`" — user saw nothing during streaming.
  2. **Removed `normalizeOutput` from regex fallback**: `normalizeOutput` was needed for HTML entity decoding and markdown formatting fixes. Removing it broke formatting.
  3. **Added broader JSON regex fallback**: Tried to extract any `{...}` from raw text. But the model outputs JSON with actual newlines in string values (instead of `\n` escapes). `JSON.parse` fails on these. The fallback silently fails, `final` stays empty, and the ENTIRE raw text (thinking + broken JSON) becomes the displayed output.
  4. **Forced `SYSTEM_PROMPT_TAGS` on ALL models** (the ROOT CAUSE that persisted through all fixes): NVIDIA models with `jsonMode: true` were trained on `SYSTEM_PROMPT_JSON`. Forcing `SYSTEM_PROMPT_TAGS` confused them — they output inconsistent JSON/tag mixes that the parser couldn't handle. Gemini models (jsonMode: false) work fine with tags.
- **The REAL missing fix**: Two things the original code never had:
  1. `tryParseJson` — sanitizes real newlines → `\n` escapes before `JSON.parse`, handling model output with literal newlines inside JSON string values (common when `response_format` is not enforced during streaming).
  2. **Per-model system prompt** — NVIDIA models use `SYSTEM_PROMPT_JSON` (their native format), Gemini models use `SYSTEM_PROMPT_TAGS` (their native format).
- **Fix**:
  1. **Reverted `aiParser.js` to the ORIGINAL code** (commit `ac14caa`), restoring the parsing logic the user confirmed works.
  2. **Added `tryParseJson` function**: Sanitizes real newlines → `\n` escapes before `JSON.parse`.
  3. **Replaced ALL 4 `JSON.parse` calls** with `tryParseJson`.
  4. **Added JSON regex extraction on `final` before text cleanup**: When `tryParseJson` fails on tag-extracted `final` (because of tag remnants like `final>` appended to the JSON), extract JSON from `final` using `{...}` regex before falling back to text cleanup.
  5. **Reverted system prompt to per-model selection** (`api/ai.js`): Changed from `const systemPrompt = SYSTEM_PROMPT_TAGS` back to `const systemPrompt = useJsonMode ? SYSTEM_PROMPT_JSON : SYSTEM_PROMPT_TAGS`. NVIDIA models (jsonMode=true) now get `SYSTEM_PROMPT_JSON`, Gemini models (jsonMode=false) get `SYSTEM_PROMPT_TAGS`.
  6. **Added diagnostic logging** to `parseAIResponse`: Console logs `[PARSE] raw:`, `[PARSE] final:`, and `[PARSE] structured.text:` on each call. Visible in Render logs if issues persist.
- **Files Changed**: `api/ai.js` (reverted system prompt to per-model), `src/utils/aiParser.js` (reverted to original + tryParseJson + JSON fallback + diagnostic logging)
- **Resolved At**: July 11, 2026, 03:58 pm PST

### [RESOLVED] Thinking Text Leaks During Streaming + Final Output Contains Reasoning (ERR-060)

- **The Issue**: Two related UI bugs after switching streaming to SYSTEM_PROMPT_TAGS:
  1. **During streaming**: Thinking/reasoning text (`<thought>` content) leaks into the visible chat bubble while the AI is still generating.
  2. **After streaming completes**: The final parsed text still includes thinking/reasoning content instead of only the clean `<final>` output. Output showed `text": "## BSIT...` — JSON fragments leaking into displayed text.
  3. **Streaming no longer word-by-word**: After hiding `<thought>` content, the bubble stayed empty during the entire stream, then dumped the full text at once.
- **Root Cause** (Fix #1 was incomplete — 3 additional factors):
  1. `streamingVisibleText()` showed `<thought>` content instead of hiding it.
  2. **`normalizeOutput` corrupting JSON before extraction** (`aiParser.js:360`): In the fallback path (no tags found), `stripAllHtmlTags(normalizeOutput(raw))` was called. `normalizeOutput` converts `\n` to real newlines, which **breaks JSON** inside the raw text. The subsequent regex `/\{[\s\S]*?"type".../` found the broken JSON, but `JSON.parse` failed. The entire corrupted text (thought + broken JSON) became the `final` output.
  3. **No JSON fallback in `streamingVisibleText`**: When the model output JSON directly without tags (ignoring `SYSTEM_PROMPT_TAGS`), `streamingVisibleText` returned empty for the entire stream because it only looked for `<final>` tags. The user saw nothing during streaming.
  4. **No broader JSON fallback in `parseAIResponse`**: The regex only found JSON with `"type": "notes"` or `"type": "quiz"`. Regular chat responses (JSON with `"content"` field, no `type`) were not extracted.
- **Fix #1** (Round 1 — incomplete):
  1. Always use SYSTEM_PROMPT_TAGS for streaming (`api/ai.js`)
  2. Hide everything before `<final>` during streaming (`aiParser.js`)
  3. Updated rationale comment in `api/ai.js`
- **Fix #2** (Round 2 — complete):
  1. **Remove `normalizeOutput` before JSON extraction** (`aiParser.js:360`): Changed `stripAllHtmlTags(normalizeOutput(raw))` to `stripAllHtmlTags(raw)`. This preserves `\n` escapes in JSON, allowing `JSON.parse` to succeed. The `\n` escapes are correctly decoded later only after valid JSON extraction.
  2. **JSON field extraction in `streamingVisibleText`** (`aiParser.js:257-272`): When no `<final>` tag exists, if the accumulated text starts with `{`, try to extract `"content"` or `"text"` field values using regex. This shows progressive text during streaming even when the model outputs JSON without tags.
  3. **Broader JSON fallback in `parseAIResponse`** (`aiParser.js:377-389`): After the notes/quiz-specific regex, added a general JSON regex `/\{(?:[^{}]|[\s\S])*?\}/` that finds any JSON object with `content` or `text` fields. This handles regular chat responses that output JSON without a `type` field.
- **Files Changed**: `src/utils/aiParser.js` (line 360: removed normalizeOutput, line 257: JSON fallback in streamingVisibleText, line 377: broader JSON regex)
- **Resolved At**: July 11, 2026, 02:58 pm PST

### [RESOLVED] AI Streaming Still Stops Midway — Line-Buffered Reader Fix + Reconstructed SSE Lines (ERR-059)

- **The Issue**: After Fix #1 (SSE framing) and Fix #2 (response_format removal + setNoDelay), AI streaming on Render still stopped midway. Render logs revealed the actual cause: `[AI] Malformed SSE chunk: {"choices":[{"delta":{"content":"` — incomplete JSON strings.
- **Root Cause**: The `reader.read()` from the AI provider's streaming response delivers data at arbitrary TCP chunk boundaries. When Render's Envoy proxy is in the network path, SSE messages (`data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n`) can be SPLIT across chunks:
  - Chunk A: `data: {"choices":[{"delta":{"content":"`  (first half of SSE message)
  - Chunk B: `Hello"}}]}\n\n`  (second half)
  - Chunk A fails `JSON.parse` (incomplete) → `catch` → `[AI] Malformed SSE chunk`
  - Chunk B's `Hello"}}]}}` doesn't start with `data: ` → SKIPPED entirely
  - Result: Content between chunk boundaries is **permanently lost**, causing the stream to appear stopped and content to be missing.
- **Why local works**: Localhost (Vite proxy → Express loopback) delivers full SSE messages per `reader.read()`. Render's Envoy proxy splits at byte-level boundaries instead.
- **Fix**:
  1. **Line-buffered reader** (`api/ai.js:393-419`): Added `lineBuffer` accumulator. Each chunk is appended to the buffer, then split by `\n`. Only COMPLETE lines are processed. The last (potentially incomplete) line stays in the buffer for the next chunk. This ensures partial SSE messages are reassembled before parsing.
  2. **Trailing buffer flush** (`api/ai.js:421-437`): After the stream ends, any remaining complete `data:` line in the buffer is processed as a final content chunk.
  3. **`trust proxy` setting** (`api/index.js:16`): Added `app.set("trust proxy", 1)` to resolve Express rate-limit's `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` validation error on Render (Render's proxy sets `X-Forwarded-For`).
- **Files Changed**: `api/ai.js` (line-buffered reader + trailing flush), `api/index.js` (trust proxy)
- **Resolved At**: July 11, 2026, 02:26 pm PST

### [RESOLVED] AI Streaming Stops Midway on Render — SSE Framing + Nagle + response_format + Silent Errors (ERR-058)

- **The Issue**: On Render deployment, AI streaming responses start but stop midway — the bubble shows partial text then freezes. The exact same code works perfectly on localhost. Fix #1 (SSE framing + heartbeat + 90s timeout) was not enough — the issue persisted.
- **Root Cause** (6 combined factors):
  1. **SSE Content-Type mismatch**: Server set `Content-Type: text/event-stream` but wrote raw text without SSE `data:` framing.
  2. **20-second idle timeout too aggressive**: Original code had 20s idle timeout (designed for Vercel's 10s limit).
  3. **No heartbeat keep-alive**: Render's Envoy proxy drops idle connections (~60s timeout).
  4. **Nagle's algorithm delaying small writes** (Fix #2 addition): Each AI token is 1-50 bytes. Node.js TCP Nagle algorithm delays these tiny writes, waiting to coalesce them. Render's Envoy proxy sees delayed data and may buffer or drop the connection as "idle."
  5. **`response_format` + `stream: true` conflict** (Fix #2 addition): NVIDIA models (step-3.7-flash, minimax-m2.7) sent both `response_format: { type: "json_object" }` AND `stream: true` — a non-standard combination. The AI provider stops producing tokens after hitting internal boundaries from this conflict.
  6. **AI provider errors silently swallowed** (Fix #2 addition): Empty `catch {}` at `api/ai.js:410` silently dropped malformed SSE chunks AND provider error messages (`{"error":{"message":"rate limit"}}`), making the stream appear to stop for no reason.
- **Fix #1** (SSE framing + heartbeat + timeout):
  1. Proper SSE framing: each content delta wrapped as `data: ${content}\n\n`
  2. Stream end marker: `data: [DONE]\n\n` before `res.end()`
  3. Heartbeat timer: `: heartbeat\n\n` every 15s
  4. Idle timeout: 20s → 90s
  5. Frontend SSE parser: strips `data:` prefix, skips heartbeat/`[DONE]` lines
  6. Error propagation: `data: [ERROR]` to frontend
- **Fix #2** (Nagle + response_format + error detection):
  1. **Disable Nagle's algorithm** (`api/index.js`): `res.socket.setNoDelay(true)` after SSE headers — forces TCP to flush every `res.write()` immediately, preventing Render's proxy from seeing "idle" connections.
  2. **Remove `response_format` from streaming** (`api/ai.js`): Removed `body.response_format` from streaming requests — is incompatible with `stream: true` on OpenAI-compatible APIs. SYSTEM_PROMPT_JSON still guides model output.
  3. **AI error detection in stream** (`api/ai.js`): Replaced empty `catch {}` with `console.warn()` logging AND added `json.error` detection — when provider returns an error mid-stream, it sends `data: [ERROR]` to the frontend and breaks the loop cleanly.
  4. **`Transfer-Encoding: chunked` header** (`api/index.js`): Explicitly tells the proxy to expect chunked transfer, reducing buffering.
- **Files Changed (Fix #1)**: `api/ai.js`, `src/hooks/useChat.js`, `src/utils/aiParser.js`
- **Files Changed (Fix #2)**: `api/ai.js` (removed response_format, replaced empty catch, added error detection), `api/index.js` (added setNoDelay, Transfer-Encoding header)
- **Resolved At**: July 11, 2026, 02:13 pm PST

### [RESOLVED] Vercel 10-Second Timeout Killing AI Streaming Responses (ERR-057)

- **The Issue**: On the deployed Vercel version, AI responses were either empty or stopped mid-stream. The manifest.json failed to load with a CSP error. Local development worked perfectly, but the deployed version was unusable.
- **Root Cause** (two separate causes):
  1. **Vercel Hobby plan 10-second serverless timeout**: The AI providers (Gemini, NVIDIA) often take 8-15 seconds to respond. Vercel kills the function at 10 seconds, cutting off the stream mid-response. This explains both empty responses (AI didn't finish generating before timeout) and incomplete responses (stream cut off mid-chunk).
  2. **Missing CSP directives**: The `vercel.json` CSP had `default-src 'none'` but was missing `manifest-src 'self'` and `worker-src 'self'`, causing the browser to block the PWA manifest and service worker.
- **Fix — Migration from Vercel to Render (Option B — full-stack)**:
  1. Removed `server.js` from `.gitignore` so Render can use it as the entry point.
  2. Added CSP middleware to `api/index.js` (early in the middleware chain, covers all responses) with `manifest-src 'self'` and `worker-src 'self'`.
  3. Added `express.static("dist")` to serve the built React frontend from the same Express server.
  4. Added a catch-all `app.get("*")` route that serves `dist/index.html` for client-side routing, with a guard for `/api` paths.
  5. Updated `vercel.json` CSP to include `manifest-src` and `worker-src` (kept as fallback).
- **Files Changed**: `.gitignore`, `api/index.js`, `vercel.json`
- **Resolved At**: July 10, 2026, 10:54 pm PST

### [RESOLVED] No Waiting Indicator During AI Thinking Before Streaming (ERR-056)

- **The Issue**: After the user sends a message, there's a delay while the AI processes the request before streaming starts. The UI showed nothing during this period — users had no feedback that the AI was working.
- **Root Cause**: The streaming message bubble is only created after the fetch response is received. Between clicking Send and the first chunk, there was no loading indicator.
- **Fix**: 
  1. Added a three-dot bouncing loading indicator (`bg-[#7b9acc]` brand blue) that shows immediately after Send is clicked, positioned as a model message bubble (`bg-app text-app border border-app rounded-2xl rounded-bl-sm`). It appears when `isLoading && !isStreaming` — meaning the fetch is in flight but no streaming has started yet.
  2. Removed the three-dot animation that was inside the streaming bubble (ERR-056 v1 was wrong — placed dots inside the bubble instead of before it). Replaced with just a blinking cursor `|` for the brief gap between bubble creation and first chunk.
- **Behavior**: Dots show instantly after Send → disappear when streaming message appears → cursor shows until first chunk → text fills in progressively.
- **Files Changed**: `src/components/ChatInterface.jsx`
- **Resolved At**: July 10, 2026, 12:14 PM PST

### [RESOLVED] Streaming Cancel Button UI Redesign (ERR-055)

- **The Issue**: The Cancel button was embedded inside the streaming message bubble as small underlined text (`text-xs text-app-muted hover:text-app underline`). Poor UX — hard to find, mismatched with the rest of the UI.
- **Root Cause**: Original streaming implementation placed the cancel action inside the message component.
- **Fix**: 
  1. Removed the Cancel button from inside the streaming message bubble in `ChatInterface.jsx`.
  2. Replaced the Send button in the input area with a Cancel button (`bg-red-500 text-white hover:bg-red-600`) during streaming. The button switches between Send and Cancel based on `messages[messages.length-1]?.isStreaming`.
  3. Modified `stopGenerating` in `useChat.js` to finalize the streaming message (set `isStreaming: false`) when cancelled, so the button correctly reverts to Send after abort.
- **Files Changed**: `src/components/ChatInterface.jsx`, `src/hooks/useChat.js`
- **Resolved At**: July 10, 2026, 11:50 AM PST

### [RESOLVED] Raw Tags and JSON Visible During Streaming — Parser Leak (ERR-054)

- **The Issue**: During streaming, users saw raw AI tags (`<thought>`, `<final>`, `<title>`) AND raw JSON structures (`{"type":"notes","text":"..."}`) appearing progressively in the chat bubble before the stream finished. The raw `\n` escape sequences also showed as literal text instead of line breaks.
- **Root Cause**: The first version of `streamingVisibleText()` only handled plain text after `<final>` tags. It did NOT handle:
  1. JSON content inside `<final>` tags (Gemini notes/quiz) — showed `{"type":"notes","text":"..."}` raw
  2. JSON mode responses (NVIDIA) — only checked for `"content"` field, missed `"text"` field (notes/quiz format)
  3. Escape sequences (`\n`) in extracted JSON — showed as literal text instead of line breaks
- **Fix** (complete, v3):
  1. Rewrote `streamingVisibleText()` in `src/utils/aiParser.js` with three extraction layers:
     - Extracts content after `<final>` (tag mode) or uses full text (no tags)
     - If content starts with `{`: tries `"text"` first (notes/quiz format), then `"content"` (chat format) — extracts field value from partial JSON
     - Decodes `\n` → newline, `\t` → tab in extracted content
  2. Strips markdown heading markers (`#`) from the visible streaming text so users don't see raw `# Introduction` during streaming — the rendered markdown appears after the stream completes via `ReactMarkdown`.
- **Files Changed**: `src/utils/aiParser.js` (rewrote `streamingVisibleText` function)
- **Resolved At**: July 10, 2026, 11:50 AM PST

### [RESOLVED] Session Title Flicker After Failed Prompts — Race Condition (ERR-053)

- **The Issue**: When the first 2 AI prompts fail (timeout/network error) and the 3rd succeeds, the session title briefly flickers to the AI-generated title ("ReactJS Basics Explained") then reverts to the old truncated title ("what is react js"). The user sees the correct title appear for a split second, then disappear.
- **Root Cause**: Race condition between two fire-and-forget async writes. When the 3rd prompt succeeded:
  1. `renameSession(sessionId, "ReactJS Basics Explained")` fires — DB title becomes new title → `fetchSessions()` → UI shows "ReactJS Basics Explained"
  2. Then `saveSessionToDb(updatedHistory, topic, sessionId)` fires — topic was computed as `sessions.find(...)?.topic` which returned the STALE old title "what is react js" from React component state → DB title overwritten back to "what is react js" → `fetchSessions()` → UI reverts
  3. Result: flicker — user sees the new title then it snaps back to the old one
- **Resolution**: Changed the `topic` variable computation in `useChat.js` to prefer the AI-generated `title` when available, even when `currentSessionId` exists:
  - `useChat.js:244` (quiz path) and `useChat.js:282` (chat path)
  - Before: `sessions.find((s) => s.id === currentSessionId)?.topic || "Chat"`
  - After: `title || sessions.find((s) => s.id === currentSessionId)?.topic || "Chat"`
  - When `title` is non-empty (first successful AI response), `saveSessionToDb` now writes the same title as `renameSession` — no race, no overwrite, no flicker.
  - `title` only exists on the first successful AI response per SYSTEM_PROMPT, so subsequent messages are unaffected.
- **Prevention Strategy**: When two fire-and-forget writes (`renameSession` + `saveSessionToDb`) target the same field, ensure they both derive their value from the same source. Use the AI response's `title` directly rather than reading from stale React state (`sessions.find(...)?.topic`).
- **Files Changed**: `src/hooks/useChat.js` (lines 244, 282 — added `title ||` fallback)
- **Resolved At**: July 9, 2026, 10:22 AM PST

---

### [RESOLVED] Inconsistent AI Output Across Models — Unified Parser Fix (ERR-052)

- **The Issue**: Different AI models (Gemini 3.1 Flash Lite, Step 3.7 Flash, custom/local LLMs) all output inconsistent formats. Gemini used `<thinking>` tags instead of `<thought>`, outputted raw JSON with literal `\n` characters, and had extra text before/after the JSON. Step 3.7 Flash produced messy spacing (no line breaks between sections). Custom models sometimes dumped thinking text without any tags. Each model required a different fix approach.
- **Root Cause**: The `parseAIResponse` function used hardcoded tag names (`(?:thought|thinking)`) and had no output normalization step. It trusted the model to produce clean markdown, which different models do inconsistently. The parser also had brittle JSON extraction (only tried `startsWith("{")`) that failed when models added extra text before/after JSON.
- **Resolution**: 
  1. Added flexible tag matching using backreference regex `(\w*think\w*)` — matches ANY tag containing "think" (case-insensitive): `<thought>`, `<thinking>`, `<THUNK>`, `<thought_process>`, etc.
  2. Added `normalizeOutput()` function — unescapes `\n`, adds blank lines before headers and bullet points, fixes `##Header` spacing, deduplicates blank lines, strips trailing whitespace. Runs on ALL model outputs.
  3. Changed JSON fallback extraction from `startsWith("{")` to a regex that finds JSON objects anywhere in the text, so it handles extra text before/after JSON.
  4. Updated `tagRegex` to strip common structural tags: `think*`, `final`, `title`, `reasoning`, `analysis`, `output`, `response`.
  5. Reverted notes JSON extraction to keep full JSON (instead of extracting `parsed.text`), letting the structured parser handle extraction consistently.
- **Prevention Strategy**: The parser is now model-agnostic — no model-specific if/else branches. The `normalizeOutput()` function applies universal markdown formatting fixes to all output regardless of source. Future models (even those using unknown tags) are handled by the flexible `(\w*think\w*)` pattern and the normalization layer.
- **Files Changed**: `src/utils/aiParser.js` (added `normalizeOutput`, updated 4 regex patterns)
- **Resolved At**: July 8, 2026, 02:09 PM PST

---

### [RESOLVED] React Hooks Conditional Call + Unused Imports After Phase 0.1 Refactor (ERR-050)

- **The Issue**: After decomposing `App.jsx` into 5 hooks (useTheme, useCustomModels, useSessions, useChat, useAuth), running `npm run lint` produced 17 errors and 3 warnings. The 12 errors from our refactoring were: (1) `useState` imported but never used in `App.jsx`, (2) 9 "React Hook is called conditionally" errors because early returns for auth pages (`/verify-email`, `/forgot-password`, `/reset-password`) were placed BEFORE hook calls, violating React's Rules of Hooks, (3) `user` passed to `useChat` but never used inside the hook (3 unnecessary dependency warnings).
- **Root Cause**: The early returns on lines 20–22 of `App.jsx` (`if (path === "/verify-email") return <VerifyEmail />`) executed before the hooks on lines 25+, causing React to call hooks in a different order depending on the route. Also, `user` was added to `useChat` parameters during the initial draft but the hook logic never reads it.
- **Resolution**: (1) Removed `useState` from the React import in `App.jsx` (only `useCallback` is needed). (2) Moved the 3 early returns from lines 20–22 to AFTER all hook calls (after line 113), placing them just before the `return` statement. This ensures hooks are always called in the same order. (3) Removed `user` from `useChat`'s function parameter list and from all 3 dependency arrays where it appeared. (4) Removed `user: null` from the `useChat` call in `App.jsx`.
- **Files Changed**: `src/App.jsx` (moved early returns, removed `useState` import, removed `user: null` prop), `src/hooks/useChat.js` (removed `user` parameter and 3 dependency entries)
- **Prevention Strategy**: When building React components with route-based early returns, ALWAYS place them AFTER all hook calls, never before. Use a linting rule (`react-hooks/rules-of-hooks`) to catch this. For hooks that receive unused parameters, remove them to avoid dependency array warnings.
- **Resolved At**: July 6, 2026, 01:57 PM PST

---

### [RESOLVED] Long AI Output Has No Dedicated Horizontal Scroll Area (ERR-047)

- **The Issue**: When an AI response contained wide content (code blocks, long unbroken lines, ASCII tables, wide URLs) the text either wrapped awkwardly or got clipped after the ERR-045 `break-words` fix. The user wanted wide content to scroll horizontally inside a dedicated horizontal-scrollable strip rendered directly below the surrounding text, rather than widening the chat bubble or forcing wrap. The horizontal scrollbar had to match the light/dark theme and blend like the existing themed scrollbar.
- **Root Cause**: The markdown renderer in `ChatInterface.jsx` used default `react-markdown` element rendering. Block elements like `<pre>` (code blocks) and tables had no `overflow-x-auto` wrapper, so they expanded the `prose` container or were clipped by the bubble's `overflow-hidden`. No custom `components` override wrapped wide block elements in a horizontally scrollable container.
- **Resolution**: Added a `markdownComponents` renderers object in `ChatInterface.jsx` and wired it via the `components` prop on `ReactMarkdown`. Custom renderers: (1) `pre` → a themed strip `<div className="overflow-x-auto ... rounded-lg bg-app-surface border border-app">` containing the `<pre>` (the strip scrolls horizontally and sits directly below the surrounding text); (2) `code` → inline code rendered with a themed `bg-app-surface` / brand-blue chip, block code passed through unchanged; (3) `table` → an `overflow-x-auto` wrapper around the table. Removed the `overflow-hidden` from the prose div (it would have clipped the new scroll strips' scrollbar thumbs) while keeping `break-words` for inline wrapping. The horizontal scrollbars automatically reuse the ERR-046 themed scrollbar CSS (`::-webkit-scrollbar { height: 8px }` + `scrollbar-color` on `html`/`html.dark`), so they blend with whichever theme is active.
- **Files Changed**: `src/components/ChatInterface.jsx` (added `markdownComponents` renderers object, wired `components` prop on `ReactMarkdown`, adjusted prose div classNames)
- **Prevention Strategy**: When rendering markdown inside a width-constrained bubble, always override the wide-block elements (`pre`, `table`) with `overflow-x-auto` wrappers via `react-markdown`'s `components` prop, and keep the bubble's outer container free of `overflow-hidden` so the inner horizontal scrollbar thumbs aren't clipped. Pair this with a global themed scrollbar block so the horizontal scrollbars match the vertical ones.
- **Resolved At**: July 3, 2026, 12:39 PM PST

---

### [RESOLVED] Scrollbar Thumb Stays White in Dark Mode (ERR-046)

- **The Issue**: The browser scrollbar remained white (light-mode default) when the app was switched to dark mode. With a dark `.bg-app`/`.bg-app-surface` background, the white scrollbar looked jarring and broke visual consistency.
- **Root Cause**: No dark-mode scrollbar theming was defined. `src/index.css` only defined `.bg-app`, `.bg-app-surface`, etc. utility classes but had NO `scrollbar-color` or `::-webkit-scrollbar` overrides for `html.dark`. Both the main message scroll container (`ChatInterface.jsx:36` `overflow-y-auto`) and the sidebar session list inherited the OS-default light scrollbar.
- **Resolution**: Added a dedicated scrollbar theming block to `src/index.css`: `scrollbar-width: thin` globally (reduces visual weight), standard `scrollbar-color` on `html` (light: brand-blue translucent) and `html.dark` (lighter blue translucent), plus `::-webkit-scrollbar` track/thumb rules (8px width, transparent track, rounded translucent thumb with hover states and a dark-mode thumb override via `html.dark ::-webkit-scrollbar-thumb`). The thumb now matches the theme in both modes.
- **Files Changed**: `src/index.css` (appended scrollbar theming block after `.border-warning`)
- **Prevention Strategy**: When defining a themed CSS variable system, always pair it with scrollbar theming (`scrollbar-color` + `::-webkit-scrollbar`) so browsers don't fall back to the OS-default scrollbar that clashes with the surface colors.
- **Resolved At**: July 3, 2026, 12:32 PM PST

---

### [RESOLVED] Chat Response Text Overlaps UI Header in Dark Mode (ERR-045)

- **The Issue**: When the AI generated long output, the text overflowed past the content area and bled up behind/over the header region. Visually the chat text and the header (TUON AI title, theme toggle, profile avatar) overlapped on top of each other. Reported via screenshot (which this model cannot read) and the user described it as "generated output the text overlaps to that ui".
- **Root Cause**: Classic flexbox overflow bug — missing `min-height: 0` (`min-h-0`) on nested flex children. Layout chain: `<main className="flex-1 flex flex-col overflow-hidden">` (MainLayout.jsx:296) → content wrapper `<div className="flex-1 overflow-hidden">` (MainLayout.jsx:448) → `ChatInterface` root `<div className="flex flex-col h-full">` (ChatInterface.jsx:34) → messages area `<div className="flex-1 overflow-y-auto">` (ChatInterface.jsx:36). In a flex column, child flex items default to `min-height: auto`, so when content is taller than the container the flex item expanded to its content's natural size instead of staying clamped at `flex-1`'s computed height — pushing the messages area up over the header (a sibling, not an ancestor, so `overflow-hidden` on `<main>` didn't clip it). A secondary contributor was the markdown `prose` div using `max-w-none` without `break-words`, allowing long URLs/code blocks to push the bubble wider than its `max-w-[85%]` clamp.
- **Resolution**: Three surgical fixes — (1) added `min-h-0` to the content wrapper in `MainLayout.jsx:448`, to the `ChatInterface` root div, and to the messages scroll area so the flex column now properly constrains and scrolls within itself instead of overflowing the header; (2) added `break-words overflow-hidden` to the markdown `prose` div so long unbroken text wraps and is clipped to the bubble width; (3) added explicit `z-10 relative` to the header div so even if any child misbehaves, the header's stacking context keeps it painted above the content layer.
- **Files Changed**: `src/components/MainLayout.jsx` (header `z-10 relative`, content wrapper `min-h-0`), `src/components/ChatInterface.jsx` (root `min-h-0`, messages area `min-h-0`, prose `break-words overflow-hidden`)
- **Prevention Strategy**: In any flex-column layout that contains a scrollable region, always chain `min-h-0` (and `min-w-0` for rows) down through every flex child from the scroll container up to its nearest fixed-size ancestor. The default `min-height: auto` breaks `overflow-y-auto` inside flex columns. Also pair `max-w-none` prose containers with `break-words`/`overflow-hidden`.
- **Resolved At**: July 3, 2026, 12:32 PM PST

---

### [RESOLVED] Custom Model ID Collision — Deterministic ID Allows Silent Overwrites (ERR-044)

- **The Issue**: Creating two custom models with the same display name silently overwrites the first model. No error, no confirmation — the first model's config (including API key) was permanently lost.
- **Root Cause**: `ModelSelector.jsx:30` generated the model ID as `'custom_' + modelData.name.toLowerCase().replace(/\s+/g, '_')` — fully deterministic, no timestamp or UUID. `customModelStorage.js` had a `generateModelId()` function that appends `Date.now()` for uniqueness, but `ModelSelector` bypassed it entirely.
- **Resolution**: 
  1. Exported `generateModelId()` from `customModelStorage.js`
  2. Updated `ModelSelector.jsx` to import and use `generateModelId()` — each custom model now gets a unique ID with timestamp suffix
  3. Same-name models now coexist without overwriting
- **Prevention Strategy**: Always use unique ID generation (UUID or timestamp) for user-created entities; never use deterministic IDs for mutable data.
- **Resolved At**: July 1, 2026, 12:13 PM PST

---

### [RESOLVED] Session Title Shows Thinking Text from Custom Models (ERR-043)

- **The Issue**: Custom/local models (e.g., Gemma 4) that don't use proper `<thought>`/`<title>` tags output thinking/reasoning text as the session title in the sidebar AND as the chat response. Example title: `. I should respond in "C...` when user typed "test". Chat bubble showed full thinking text starting with `` to send a friendly introductory message.AI Learning Assistant Setup...``
- **Root Cause**: Two bugs in `src/utils/aiParser.js`:
  1. `stripThinkingText()` had a 70% safety threshold that prevented stripping when thinking was dominant (>70% of output). Local models dump entire reasoning process, making thinking 80%+ of the text.
  2. `isMostlyThinking()` had limited patterns that didn't match title-style thinking like "I should respond", "I need to", "introduce my", "CHAT MODE". Titles with these patterns returned false, so title sanitization was never entered.
- **Resolution**: 
  1. Replaced 70% threshold logic in `stripThinkingText()` with first-greeting detection: find the first greeting phrase ("Hello", "Hi there", etc.) and strip everything before it, regardless of thinking length.
  2. Added response marker detection in `stripThinkingText()`: before greeting detection, check for `Final:`, `Response:`, `Answer:` markers (plain text format used by custom models) and extract content after the LAST marker. Strips short label prefix (e.g., "Plain text explanation.").
  3. Added title extraction from plain text `Title:` line in `parseAIResponse()`: when `<title>` tags are absent, looks for `Title: ...` in the raw output and uses it as the session title.
  4. Added 4 new thinking indicators to `isMostlyThinking()`: `/I need/i`, `/I will/i`, `/introduce my/i`, `/CHAT MODE|NOTE MODE|QUIZ MODE/i`.
  5. Simplified title sanitization: if `isMostlyThinking(title)` is true, clear title entirely.
  6. Added `fallbackTitle` extraction in `parseAIResponse()`: when title is empty, extracts the first substantive sentence (>15 chars) from the cleaned AI response, truncated to 30 chars.
- **Files Changed**: `src/utils/aiParser.js` (rewrote `stripThinkingText` with response marker detection + greeting fallback, expanded `isMostlyThinking` patterns, added `Title:` line extraction in `parseAIResponse`, simplified title clearing, added `fallbackTitle` extraction), `src/App.jsx` (destructured `fallbackTitle`, updated topic fallback chain to `title || fallbackTitle || userMessage`)

---

### [RESOLVED] Local Development API 404 Errors (ERR-041)

- **The Issue**: Signup and login API calls failed with 404 errors when running locally on port 5173. The deployed version on Vercel worked fine.
- **Root Cause**: Vite dev server runs on port 5173, but the Express backend server (with API endpoints) wasn't running locally. The frontend's `API_BASE_URL` was set to `/api`, which routed requests to the Vite server instead of the Express backend. No proxy configuration existed to forward API requests.
- **Resolution**: Created `server.js` to run the Express app locally on port 3000. Updated `vite.config.js` to proxy `/api` requests to `http://localhost:3000`. Added `dev:server` and `dev:full` scripts to package.json for easy local development.
- **Files Changed**: `server.js` (new), `vite.config.js`, `package.json`, `.env` (added JWT_SECRET and SUPABASE_SERVICE_ROLE_KEY placeholders)

---

### [RESOLVED] PWA Address Bar Visible After Installation (ERR-040)

- **The Issue**: The address bar (`quizmakerapp.vercel.app`) was visible above the installed PWA on mobile devices.
- **Root Cause**: The `manifest.json` used `display: "fullscreen"`, which Chrome on Android does not fully respect — it still shows an origin bar. Additionally, `start_url` was set to an absolute URL with no trailing slash, and `display_override` with `window-controls-overlay` may have interfered with mobile display mode.
- **Resolution**: Changed `display` to `"standalone"`, `start_url` to `"/"`, removed `display_override`, and updated the service worker to cache the `start_url` (`/`) on install with `skipWaiting()`.
- **Files Changed**: `public/manifest.json`, `public/pwabuilder-sw.js`

---

### [RESOLVED] PWABuilder Service Worker Warning (ERR-039)

- **The Issue**: PWABuilder flagged "Make your app faster and more reliable by adding a service worker" despite the service worker being present.
- **Root Cause**: PWABuilder expected explicit caching of the `start_url` and immediate service worker activation (`skipWaiting()` + `clients.claim()`).
- **Resolution**: Updated `public/pwabuilder-sw.js` to cache the `start_url` (`/`) and force immediate activation. The service worker now meets PWABuilder's production-ready criteria.
- **Files Changed**: `public/pwabuilder-sw.js`

---

### [RESOLVED] Unused genAI Variable (ERR-038)

- **The Issue**: IDE flagged `genAI` in `api/ai.js` as "assigned a value but never used".
- **Root Cause**: `GoogleGenerativeAI` SDK was imported and instantiated, but the project shifted to a unified `fetch`-based dispatcher. The `genAI` constant was dead code.
- **Resolution**: Removed the `GoogleGenerativeAI` import and the `genAI` variable declaration.
- **Prevention**: Periodically review imports and constants when switching to generalized API dispatchers.

---

### [RESOLVED] Gemini 404 — Double Slash in URL (ERR-037)

- **The Issue**: AI calls to `gemini-3.1-flash-lite` failed with `API Error (404): Not Found`.
- **Root Cause**: The `baseUrl` in `MODEL_CONFIGS` ended with a trailing slash, and `callOpenAICompatibleAPI` appended `/chat/completions`, producing `.../openai//chat/completions`.
- **Resolution**: Removed trailing slash from `baseUrl` for `gemini-3.1-flash-lite` in `api/ai.js`.
- **Prevention**: Maintain no-trailing-slash convention for all `baseUrl` entries.

---

### [RESOLVED] Auto-Start Quiz Crashes App with TypeError (ERR-036)

- **The Issue**: Typing "make me a quiz" in chat caused a white screen. Console: `Cannot destructure property 'text' of 'e' as it is null`.
- **Root Cause**: `setView('quiz')` was called before `handleStartQuiz` fetched and set `quizData`. `QuizInterface` then mounted with `quizData={null}` and crashed on destructuring.
- **Resolution**: Removed early `setView('quiz')` call; view switch now happens inside `handleStartQuiz` after API response is parsed. Added null-guard loading state in `QuizInterface`.
- **Files**: `src/App.jsx`, `src/components/QuizInterface.jsx`
- **Prevention**: Never switch to a data-dependent view before data is ready. Always add null/loading guards in child components.

---

### [RESOLVED] White Screen / TDZ — handleStartQuiz Referenced Before Init (ERR-035)

- **The Issue**: Entire website rendered blank after quiz feature changes.
- **Root Cause**: `handleSendMessage` called `handleStartQuiz` in its `useCallback` body and dependency array, but `handleStartQuiz` was declared later. TDZ threw a `ReferenceError` at module load time.
- **Resolution**: Reordered `useCallback` declarations so `handleStartQuiz` is declared before `handleSendMessage`.

---

### [RESOLVED] NVIDIA NIM Slash — Step 3.7 Flash & GLM 5.1 404 (ERR-033 / ERR-034)

- **The Issue**: After namespace fixes, both models still returned 404 from NVIDIA NIM.
- **Root Cause**: `callOpenAICompatibleAPI` constructed `${config.baseUrl}chat/completions` without a leading slash, producing `v1chat/completions`.
- **Resolution**: Added forward slash: `` `${config.baseUrl}/chat/completions` `` in `api/ai.js`.

---

### [RESOLVED] NVIDIA NIM 404 — Incorrect GLM 5.1 Namespace (ERR-032)

- **The Issue**: Selecting GLM 5.1 returned 404 from NVIDIA NIM.
- **Root Cause**: `MODEL_CONFIGS` entry used incorrect namespace prefix for GLM 5.1.
- **Resolution**: Updated `modelId` to `'z-ai/glm-5.1'` in `api/ai.js`.

---

## 3. Persistent Debugging Rules

- **Lookback Before Guessing**: Before fixing any code, cross-reference this file to see if a similar failure has happened before.
- **Immediate Documentation**: Every time a debugger action fails or reveals a new error, log it under Section 1 before writing any fixes.
- **Clean Transitions**: When an error is resolved, update its status, document the solution, and shift it to Section 2.

---

## 4. ARCHIVE STATUS

- **Archive File**: `.opencode/archives/error_archive.md`
- **Threshold**: 10 active entries per section
- **Total Archived**: 33
- **Last Archive Check**: June 30, 2026, 07:53 PM PST

| Entries Archived | Archived At (PST)           |
| ---------------- | --------------------------- |
| 33               | June 30, 2026, 06:15 PM PST |

<!-- c: worrie -->
