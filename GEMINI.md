# Workspace Instructions & Rules

## 🔒 Git Permission Policy
- **Git Actions**: Any `git` command (`git commit`, `git push`, `git checkout`, `git branch`, `git reset`, `git merge`, etc.) **MUST ALWAYS** have explicit permission from the user before execution. Present the diff/commit message and wait for approval.
- **Non-Git Actions**: The agent has **FULL AUTONOMY**. For coding, fixing bugs, building APKs, deploying, running servers, and backend testing, do whatever is best for the project without asking for permission.

## 🌐 Browser Testing Policy
- **Manual Browser Testing Only**: The AI must **NEVER** automatically open or test the web app/admin dashboard in a browser using automated browser subagents. When browser testing is needed, notify the user with the test details/URL. The user will test in their own browser, report any issues, and provide screenshots.
