# Security Archive

- **Source File**: `security_memory.md`
- **Last Archived At**: June 30, 2026, 07:53 PM PST
- **Total Entries Archived**: 4

---

## Archived Entries

### [SEC-005] Verbose Error Logging (LOW)

- **Vulnerability Rating**: 2/10
- **Severity Level**: LOW
- **Attacker Exploit Methodology**: `api/index.js:54,72,100` and `api/ai.js:156,186` log full error objects to Vercel logs. Could expose internal paths, database schema, or API keys.
- **Production-Ready Remediation Plan**:
  1. Strip error objects to message strings only
  2. Never log API keys or tokens
- **Status**: OPEN
- **Logged At**: June 30, 2026, 11:01 AM PST

---

### [SEC-004] Service Worker CDN Supply Chain (LOW)

- **Vulnerability Rating**: 2/10
- **Severity Level**: LOW
- **Attacker Exploit Methodology**: `pwabuilder-sw.js:3` loads Workbox from external CDN. If compromised, malicious code runs in service worker context.
- **Production-Ready Remediation Plan**:
  1. Self-host the Workbox runtime
  2. Pin version and verify integrity
- **Status**: OPEN
- **Logged At**: June 30, 2026, 11:01 AM PST

---

### [SEC-003] No Email Verification (LOW)

- **Vulnerability Rating**: 2/10
- **Severity Level**: LOW
- **Attacker Exploit Methodology**: `api/auth.js:50-117` creates accounts immediately. Disposable emails can be used for spam AI requests.
- **Production-Ready Remediation Plan**:
  1. Send verification email on signup with time-limited token
  2. Block AI features until verified
- **Status**: OPEN
- **Logged At**: June 30, 2026, 11:01 AM PST

---

### [SEC-002] No Password Reset (LOW)

- **Vulnerability Rating**: 2/10
- **Severity Level**: LOW
- **Attacker Exploit Methodology**: No forgot-password endpoint exists. Users who forget passwords have no self-service recovery.
- **Production-Ready Remediation Plan**:
  1. Create `/api/auth/forgot-password` endpoint
  2. Generate time-limited reset token stored in database
  3. Send reset link via email
- **Status**: OPEN
- **Logged At**: June 30, 2026, 11:01 AM PST

---

<!-- c: worrie -->
