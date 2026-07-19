# pi-rewind

Undo/Redo for Pi using automatic Git snapshots.

## Install

```bash
pi install npm:pi-rewind
```

## Usage

Commands are registered automatically after install:

- **`/undo`** — Reverts the last file changes via Git and forks the session to before the last user message.
- **`/redo`** — Re-applies the last reverted change and switches back to the original session.
- **`/rewind-history`** — Shows snapshot history with inline display.

## How it works

After every agent turn, `pi-rewind` creates an automatic Git commit snapshot of any uncommitted file changes. The `/undo` command reverts the latest snapshot and forks the conversation tree, so you get a clean branch to continue from.

## Requirements

- A Git repository in your project (run `git init` first).
- Pi with extension support (≥ 0.74.0).
