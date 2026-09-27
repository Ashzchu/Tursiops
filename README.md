# Tursiops

**Project-aware memory & context companion for VS Code.**

Tursiops sits in your Activity Bar and works alongside your AI coding agent to give it persistent memory, intelligent file navigation, and a full change history — all powered by your own Gemini API key.

## Features

### 🧠 Prompt Memory
Remember or forget prompts across sessions. Tursiops uses Gemini to refine each prompt and stores it in `.tursiops/memory/` as a versioned timeline. Inline editing lets you tweak refined prompts at any time.

### 🧭 Navigator
Type a natural-language description ("find the auth utility", "where is the login screen?") and Gemini scans your workspace file inventory to return the most relevant files — click to open instantly.

### 📝 Change Summary
Pick any two commits from your git history and get a Gemini-generated, file-by-file summary of exactly what changed between them.

### 🌿 MiniGit
After every prompt submission a snapshot of your current git diff is saved to `.tursiops/changes/change_N.md` with a Gemini summary. Give the file path to your IDE agent to revert any change at any time.

## Requirements

- A free [Google AI Studio](https://aistudio.google.com) Gemini API key
- Git installed and a git repository open in your workspace

## Getting Started

1. Click the **Tursiops** dolphin icon in the Activity Bar
2. Sign in or create an account
3. Paste your Gemini API key — it's validated live and stored securely
4. Select a function from the dropdown and start working

## Release Notes

### 1.9.0
Full stable release: all bug fixes integrated, publisher aligned to Conquestcore, stale extension ID suppressed via IBM Bob settings, old vsix artefacts cleaned, `.vscodeignore` updated. Fn3 commit dropdown, MiniGit live-refresh, and single git watcher all stable.

### 1.8.0
Stability release: all three core bug fixes fully integrated — Fn3 commit dropdown loads last 20 commits correctly, MiniGit panel live-refreshes after every prompt, single git watcher eliminates reset race condition on commit.

### 1.7.0
Bug fixes: Fn3 Change Summary commit dropdown now correctly loads all 20 commits. MiniGit panel auto-refreshes immediately after every prompt submission. Removed duplicate git commit watcher that caused race conditions on reset. Publisher aligned with Marketplace account.

### 1.6.0
Full release: Prompt Memory, Navigator, Change Summary, and MiniGit — all four functions complete with Gemini integration, git-aware file storage, and automatic memory reset on commit.
