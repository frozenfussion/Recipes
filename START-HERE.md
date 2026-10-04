# START HERE · Setting up Chef Buddy on Windows

You will build the app on your own PC with Claude Code, using the plan in this folder.
Work in the folder `C:\Users\User\Development\web\recipes`.

## 1. Install the tools (once)
| Tool | How | Check it worked |
|---|---|---|
| **Node.js 22 or newer** | Download the LTS installer from https://nodejs.org and run it | `node -v` shows v22 or higher |
| **Git for Windows** | Download from https://git-scm.com/downloads/win and run it (defaults are fine) | `git --version` |
| **Claude Code** | see the command just below the table | open a **new** terminal, then `claude --version` |

Install Claude Code from PowerShell (not CMD):
```
irm https://claude.ai/install.ps1 | iex
```
(or `winget install Anthropic.ClaudeCode`).

Claude Code needs a Claude Pro, Max, Team, Enterprise or Console account. You log in the first time you run `claude`.
You also need an **Anthropic API key** (for recipes) and an **OpenAI API key** (for AI dish photos). You enter them later on the app's Settings page. Never paste them into files or chat.

Tell Git who you are (once):
```
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 2. Get the project into your folder
The project lives at https://github.com/frozenfussion/Recipes (branch `main`). Your folder is empty, so clone into it:
```
cd C:\Users\User\Development\web\recipes
git clone https://github.com/frozenfussion/Recipes .
```
(The dot at the end means "into this folder".) A browser window may ask you to sign in to GitHub the first time. That is Git Credential Manager, it is normal.

Check:
```
git status
git branch
dir
```
You should see `main`, a clean status, and `CLAUDE.md`, `docs`, `mockups`, `assets` in the folder.

### Alternative: you downloaded the zip instead
Unzip it **into** `C:\Users\User\Development\web\recipes` so that `CLAUDE.md` sits directly in that folder. To link it to GitHub afterwards:
```
cd C:\Users\User\Development\web\recipes
git init
git remote add origin https://github.com/frozenfussion/Recipes
git fetch origin
git checkout -B main origin/main
```
If Git says some files would be overwritten, delete the unzipped copies of those files and run the last command again (they are identical to the ones on GitHub).

## 3. Start Claude Code in the folder
```
cd C:\Users\User\Development\web\recipes
claude
```
Claude Code reads `CLAUDE.md` automatically. Tip: press **Shift+Tab** until it says *plan mode* when you want it to propose before it changes anything.

### The first prompt (paste this)
```
Read CLAUDE.md and every file in docs/specs/. Look at mockups/index.html and the images in mockups/screens/.
Do NOT write code yet.
1. Summarise in your own words what we are building.
2. List anything unclear, risky or missing in the specs.
3. Propose exactly what you will do in Phase 0 and which files you will create.
Then wait for my approval.
```

## 4. How each phase goes (recursive refinement)
Do not accept the first thing Claude generates. For every phase:
1. **Approve the plan** first, or change it.
2. Let it build, then **run the app yourself** and click through it.
3. **Make it explain**: "Explain what you built like I'm a beginner. Which 3 files matter most?"
4. **Challenge it**: "What could go wrong? What did you not test? What would you change?"
5. **Ask for changes**, one clear thing at a time, and repeat steps 2 to 4 until you understand all of it and are happy.
6. Only then: "Commit this phase with a clear message", and move on:
```
Go ahead with Phase 1 from docs/specs/08-build-plan.md. Follow the same process: plan first.
```

## 5. Everyday Git commands
```
git status                 what changed?
git add -A                 stage everything
git commit -m "Phase 0: skeleton"
git push                   send to GitHub
git pull                   get the latest from GitHub
git log --oneline          history, newest first
git restore .              THROW AWAY uncommitted changes (careful, cannot be undone)
```
Commit at the end of every phase. Each commit is a safe point you can return to. You can also just ask Claude Code: "commit this with a good message and push".

## 6. What is in this folder
```
CLAUDE.md            instructions Claude Code reads every session
START-HERE.md        this file
README.md            short project description (the app will extend it)
.gitignore           keeps keys, database and node_modules out of Git
.env.example         optional PORT and HOST settings
assets/              logo.svg, favicon.svg
docs/specs/          the 8 spec files (the plan)
mockups/             index.html (open in a browser) and screens/ (PNGs)
```
`data/` (database and images, including your API keys) is created by the app and is never committed.

## 7. Trying it on your phone (later)
Same Wi-Fi: set `HOST=0.0.0.0` in a `.env` file, restart, allow Node in the Windows Firewall prompt, and open `http://<your-PC-IP>:3000` on the phone. The app has no login, so only do this on a network you trust and switch it back after.
