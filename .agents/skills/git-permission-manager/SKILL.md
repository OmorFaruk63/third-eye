---
name: git-permission-manager
description: >-
  Strictly enforces user confirmation and permission before executing any Git commands 
  (commit, push, pull, branch, checkout, reset, rebase, merge, stash, etc.). 
  Grants full autonomy for all other non-Git tasks (coding, refactoring, building, debugging, installing APK, running server).
---

# Git Permission Manager Skill

## Core Principle
- **Git Operations**: **MUST ALWAYS ASK PERMISSION FIRST**. Never execute any `git` command (`git add`, `git commit`, `git push`, `git pull`, `git checkout`, `git reset`, `git merge`, `git branch`, etc.) without showing the exact command and changes to the user and receiving explicit permission.
- **Non-Git Tasks**: **100% AUTONOMOUS**. The agent should autonomously edit code, build projects, run tests, fix bugs, start servers, install APKs, or perform any other non-git operations without interrupting the user.

---

## Git Operations Protocol

Whenever a task requires version control or any Git-related action:

### 1. Prepare & Display the Plan
Before proposing or running any `git` command, clearly explain to the user:
- What Git action is about to be taken (e.g., commit, push, create branch).
- The exact command line to be executed (e.g., `git commit -m "fix(camera): resolve zombie recording state"`).
- The list of files affected and a brief summary of the commit/diff.

### 2. Request Explicit Approval
Ask the user directly:
> *"I have prepared the changes. May I run the following Git command(s)?"*
> ```bash
> git add <files>
> git commit -m "<message>"
> git push origin <branch>
> ```
Wait for the user's confirmation before executing.

### 3. Prohibited Without Confirmation
The following commands must **NEVER** be run autonomously:
- `git commit`
- `git push`
- `git pull` / `git fetch`
- `git checkout` / `git switch`
- `git branch` (creating or deleting)
- `git reset` / `git revert`
- `git merge` / `git rebase`
- `git stash`

---

## Non-Git Tasks Protocol (Full Autonomy)

For any non-Git tasks, the agent should proceed independently with full confidence:
- Writing or editing code, layouts, configs, or documentation.
- Building the project (`./gradlew assembleDebug`, `npm run build`).
- Running dev servers or local services (`npm start`, `npm run dev`).
- Installing applications via ADB (`adb install`).
- Debugging and inspecting logcat or runtime errors.
- Do what is best for the codebase without asking for permission on routine technical decisions.
