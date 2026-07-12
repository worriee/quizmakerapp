# TUON AI Lazy Notes

## Overview

Phase 1 modernized the database from a single JSONB blob approach to an
industry-standard relational design. The old `chat_sessions.history` column
stored ALL messages in one giant JSON array. The new `messages` table stores
each message as its own row.

---

## All 8 Database Tables

### Tables Actively In Use

#### 1. profiles — User Accounts

Purpose: Stores user identity and authentication data.

| Column                | Type          | Purpose                         |
| --------------------- | ------------- | ------------------------------- |
| id                    | uuid (PK)     | Unique user ID (auto-generated) |
| email                 | text (unique) | User email (login identifier)   |
| password_hash         | text          | bcrypt hash of user's password  |
| email_verified        | boolean       | Whether email is confirmed      |
| verification_token    | text          | Token for email verification    |
| reset_token           | text          | Token for password reset        |
| reset_token_expires   | timestamptz   | Expiration of reset token       |
| failed_login_attempts | integer       | Lockout counter (5 max)         |
| locked_until          | timestamptz   | Lockout expiration timestamp    |
| created_at            | timestamptz   | Account creation time           |

Connects to: Every other user table references `profiles.id` via `user_id`.

---

#### 2. chat_sessions — Conversation Metadata

Purpose: One row per conversation. Stores the title, pin status, and timestamps.
The old `history` JSONB column is still written (dual-write) until Week 4 drops it.

| Column     | Type                    | Purpose                                           |
| ---------- | ----------------------- | ------------------------------------------------- |
| id         | uuid (PK)               | Unique session ID                                 |
| user_id    | uuid (FK → profiles.id) | Owner of this session                             |
| topic      | text                    | Session title (AI-generated or user-chosen)       |
| history    | jsonb                   | OLD: entire conversation array (being phased out) |
| pinned     | boolean                 | Whether pinned to sidebar top                     |
| created_at | timestamptz             | When session was created                          |
| updated_at | timestamptz             | Auto-updates via trigger on every save            |

Connects to: `messages.session_id` references this table.

---

#### 3. messages — Individual Chat Messages (NEW)

Purpose: One row per message. This is the NEW system that replaces the
old JSONB blob. Each message gets its own row, making search, counting,
and individual updates possible.

| Column     | Type                         | Purpose                            |
| ---------- | ---------------------------- | ---------------------------------- |
| id         | uuid (PK)                    | Unique message ID                  |
| session_id | uuid (FK → chat_sessions.id) | Which conversation this belongs to |
| role       | text                         | "user" or "model" (AI)             |
| content    | text                         | The actual message text            |
| position   | integer                      | Order in conversation (0, 1, 2...) |
| created_at | timestamptz                  | When message was created           |

Unique constraint: (session_id, position) — prevents duplicate positions.

Indexes: session_id (fast lookup), (session_id, position) (fast ordered load).

---

### Tables Created Empty — Ready for Future Phases

#### 4. collections — User-Created Folders

Purpose: Named folders the user creates to organize sessions.
Example: "Biology Notes", "Exam Prep", "Favorite Chats".

| Column     | Type                    | Purpose                       |
| ---------- | ----------------------- | ----------------------------- |
| id         | uuid (PK)               | Unique collection ID          |
| user_id    | uuid (FK → profiles.id) | Who owns this folder          |
| name       | text                    | Folder name ("Biology Notes") |
| created_at | timestamptz             | When folder was created       |

Used in: Phase 2.3 — sidebar folder feature.

---

#### 5. session_collections — Links Sessions to Folders

Purpose: Many-to-many join table. One session can live in multiple
folders, and one folder can hold multiple sessions.

| Column        | Type                         | Purpose     |
| ------------- | ---------------------------- | ----------- |
| session_id    | uuid (FK → chat_sessions.id) | The session |
| collection_id | uuid (FK → collections.id)   | The folder  |

Primary key: (session_id, collection_id) — no duplicates.

Used in: Phase 2.3 — when user adds a session to a folder.

---

#### 6. quiz_attempts — Quiz History

Purpose: Records every quiz the user takes. Tracks which session it
came from, topic, difficulty, score, and timestamp.

| Column     | Type                         | Purpose                 |
| ---------- | ---------------------------- | ----------------------- |
| id         | uuid (PK)                    | Unique attempt ID       |
| user_id    | uuid (FK → profiles.id)      | Who took the quiz       |
| session_id | uuid (FK → chat_sessions.id) | Which session's notes   |
| topic      | text                         | What the quiz was about |
| difficulty | text                         | Easy / Normal / Hard    |
| score      | integer                      | Correct answers         |
| total      | integer                      | Total questions         |
| created_at | timestamptz                  | When quiz was taken     |

Used in: Phase 4 — Quiz Attempts Dashboard (optional).

---

#### 7. review_items — Spaced Repetition Data

Purpose: Tracks spaced repetition (SM-2 algorithm) data for specific
messages. Each item links to a specific message that the user wants
to review later.

| Column           | Type                    | Purpose                              |
| ---------------- | ----------------------- | ------------------------------------ |
| id               | uuid (PK)               | Unique review item ID                |
| user_id          | uuid (FK → profiles.id) | Who owns this item                   |
| message_id       | uuid (FK → messages.id) | Which message to review              |
| ease_factor      | real                    | SM-2 difficulty rating (default 2.5) |
| interval         | integer                 | Days until next review               |
| due_at           | timestamptz             | When next review is due              |
| last_reviewed_at | timestamptz             | Last time user reviewed this         |

Used in: Phase 4 — Flashcard/SM-2 spaced repetition (optional).

---

#### 8. shared_quizzes — Public Quiz Share Links

Purpose: Lets users share quizzes via a public URL with an expiration.

| Column      | Type                         | Purpose                         |
| ----------- | ---------------------------- | ------------------------------- |
| id          | uuid (PK)                    | Unique share ID                 |
| session_id  | uuid (FK → chat_sessions.id) | Which session's quiz            |
| share_token | text (unique)                | Random token for the public URL |
| expires_at  | timestamptz                  | When the link expires           |
| created_at  | timestamptz                  | When link was created           |

Used in: Phase 4 — quiz sharing via public link (optional).

---

## Week 4 — Cleanup (Drop the Old System)

### What Week 4 does

Right now the app writes to TWO places (dual-write):

saveSessionToDb()
→ writes to chat_sessions.history (old JSONB blob) ← STILL HAPPENS
→ writes to messages table (new individual rows) ← NEW

Week 4 removes the old system:

ALTER TABLE chat_sessions DROP COLUMN IF EXISTS history;

After Week 4:

- chat_sessions keeps only: id, topic, pinned, created_at, updated_at
- All conversation data lives exclusively in messages
- The history JSONB column is gone forever

### Why wait?

The dual-write is a safety net. If anything breaks with the messages table,
you still have the blob as a backup. Use the app for a few days. Once you're
confident everything works, Week 4 removes the dead weight.

### Week 4 code changes (when ready)

Step 1: Run in Supabase SQL Editor:
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS history;

Step 2: In api/index.js, update POST /session/create:

- Remove `history: history || []` from the insert payload

Step 3: In api/index.js, update POST /session/:id/update:

- Remove `history,` from the .update() call, keep only `topic`

That's it — 1 SQL command + 2 small code edits.

### Rollback if needed

If something breaks after Week 4, you can't easily restore the column.
That's why you wait and monitor first. The Week 3 code change (reading
from messages table) is reversible by reverting one endpoint. But dropping
a column is permanent — always back up first.

---

## How the Tables Relate (Entity Relationship)

profiles (users)
├── chat_sessions (conversations) [1 user → many sessions]
│ ├── messages (individual messages) [1 session → many messages]
│ ├── quiz_attempts [1 session → many quiz attempts]
│ ├── shared_quizzes [1 session → many share links]
│ └── session_collections ──→ collections (folders)
├── review_items [1 user → many review items]
└── collections (folders) [1 user → many collections]

---

## RLS (Row Level Security)

All 8 tables have RLS ENABLED with "Service role only" deny-all policies.
This means the anonymous public API key cannot access any table directly.
All reads/writes go through the server-side `supabaseService` client
which uses the service_role key and bypasses RLS.

User-level authorization is enforced at the API layer via JWT verification,
not at the database layer.

---

## Summary: Phase 1 Progress

| Step   | What                                           | Status                     |
| ------ | ---------------------------------------------- | -------------------------- |
| Week 1 | Create tables, add updated_at, dual-write code | ✅ Complete                |
| Week 2 | Backfill old history blobs into messages table | ✅ Complete                |
| Week 3 | Switch reads to messages table                 | ✅ Complete                |
| Week 4 | Drop old history column                        | ⬜ Pending (monitor first) |

---

## setNoDelay(true) notes related to Render platform and TCP_NODELAY explanation

Imagine you're typing a message to a friend, but instead of sending every word as you type it, you wait until you have a full paragraph — then hit send. That's what TCP normally does with Nagle's algorithm. It's like saying:

```
"I'll hold these words until I have enough
to make a big, efficient package."
```

This is great for downloading files or loading a webpage (big chunks = fewer trips). But for AI streaming, where you want to see text word by word like ChatGPT, it's terrible. You'd see:

```
... (wait 5 seconds) ... (wait 5 seconds) ...
"The user is asking..." (burst)
```

setNoDelay(true) is the opposite. It's like hitting send on every single word the instant you type it:

```
"The" → instantly
" user " → instantly
" is " → instantly
" asking " → instantly
```

Each tiny piece arrives at the browser immediately. No batching, no waiting.
On Render specifically, this matters more because Render's proxy (Envoy) is another layer that can also batch things. Without setNoDelay, you get double-batching: Nagle batches at the server level, then Envoy batches again at the proxy level. With setNoDelay, the first batch is eliminated so the proxy gets each word immediately too.
In short: setNoDelay(true) = "Send each word now, don't wait to collect more."
