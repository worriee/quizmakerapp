# Task for worker

[Read from: C:\Users\Julry\vscodefiles\tuon-ai\context.md, C:\Users\Julry\vscodefiles\tuon-ai\plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Edit the following 3 config files:

1. vercel.json: 
   - Remove the rewrite line: `{ "source": "/api/(.*)", "destination": "/api/index.js" },`
   - Update the CSP connect-src to include the Render backend URL: change `connect-src 'self' https://generativelanguage.googleapis.com https://integrate.api.nvidia.com` to `connect-src 'self' https://tuonai-worrie.onrender.com https://generativelanguage.googleapis.com https://integrate.api.nvidia.com`

2. api/index.js (lines 31-38): Update the CSP connect-src to include the Vercel frontend URL. Change `connect-src 'self' https://*.supabase.co` to `connect-src 'self' https://*.supabase.co https://tuon-ai.vercel.app`

3. api/email.js (line 5): Change `const APP_URL = process.env.RENDER_EXTERNAL_URL` to `const APP_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL`

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