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

