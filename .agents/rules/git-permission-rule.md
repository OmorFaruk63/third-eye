# Git Operations Permission Rule

## ⚠️ MANDATORY RULE: Git Operations Require User Permission

1. **Git Operations (PERMISSION REQUIRED)**:
   - The agent is **STRICTLY FORBIDDEN** from running any `git` command (`git add`, `git commit`, `git push`, `git pull`, `git checkout`, `git branch`, `git reset`, `git rebase`, `git merge`, `git stash`, etc.) without asking the user for permission first.
   - Always present the proposed command and a summary of the changes to the user and wait for their explicit approval.

2. **All Other Operations (FULL AUTONOMY)**:
   - For all non-Git tasks, the agent has **FULL AUTONOMY** and should proceed directly without asking for permission:
     - Writing, modifying, and refactoring source code.
     - Compiling and building Android APKs (`./gradlew assembleDebug`).
     - Installing APKs via ADB (`adb install`).
     - Running Node.js backend and React dashboard (`npm start`, `npm run dev`).
     - Running diagnostic and debugging commands.
     - Creating or updating project documentation.
   - The agent should exercise its best technical judgment and proceed autonomously for all non-Git work.
