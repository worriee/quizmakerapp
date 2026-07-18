# Task for worker

[Read from: C:\Users\Julry\vscodefiles\tuon-ai\context.md, C:\Users\Julry\vscodefiles\tuon-ai\plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Edit the following 7 frontend files to change their API_BASE_URL from hardcoded "/api" to use import.meta.env.VITE_API_URL:

1. src/hooks/useAuth.js (line 3): Change `const API_BASE_URL = "/api"` to `const API_BASE_URL = import.meta.env.VITE_API_URL || "/api"`

2. src/hooks/useChat.js (line 4): Same change

3. src/hooks/useSessions.js (line 3): Same change

4. src/components/Login.jsx (line 3): Same change

5. src/components/ForgotPassword.jsx (line 3): Same change

6. src/components/ResetPassword.jsx (line 3): Same change

7. src/components/VerifyEmail.jsx (line 3): Same change (note: this file uses single quotes - change `const API_BASE_URL = '/api'` to `const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'`)

Use the edit tool for each file. Return the list of files edited and whether each succeeded.

---
Update progress at: C:\Users\Julry\vscodefiles\tuon-ai\.pi-subagents\artifacts\progress\ea560594\progress.md

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```