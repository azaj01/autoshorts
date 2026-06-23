# AutoShorts

AutoShorts is a local-first desktop application for turning long-form video or audio recordings into high-impact, vertical short-form clip candidates (9:16 portrait) with AI-powered viral moment ranking.

This repository implements the desktop app foundation using **Tauri 2 + React + TSX + Rust + SQLite**.

---

## Key Features

- **Dynamic Multi-LLM Support**: Supports both **DeepSeek** (default) and **Claude** (anthropic) for viral moment detection and hooks analysis.
- **Automated Pipeline**: Imports media, extracts audio, transcribes using Deepgram, and automatically analyzes and ranks moments in a single automated chain.
- **Local SQLite Storage**: Saves transcripts, candidates, custom names, and rendering data locally.
- **Native Project Manager**: Create, open, rename, and delete projects from the dashboard.
- **Portrait Auto-Cropping**: Automatically center-crops landscape videos to vertical H.264 portrait clips using native `ffmpeg` integration.
- **Key Warnings**: Built-in visual warnings that identify missing environment variables and prompt you directly in the UI.

---

## Prerequisites

To run or build the application from source:

- **Node.js**: `20+`
- **Rust**: `1.80+`
- **FFmpeg & FFprobe**: Must be installed and available on your system `PATH`.
  - On macOS, you can install them using Homebrew:
    ```bash
    brew install ffmpeg
    ```
    *Note: To ensure full captions rendering support (specifically the `drawtext` and `subtitles` filter dependencies), it is recommended to use a complete, full-featured FFmpeg build. If you encounter any filter issues, tap and install the `homebrew-ffmpeg` formula:*
    ```bash
    brew tap homebrew-ffmpeg/ffmpeg
    brew install homebrew-ffmpeg/ffmpeg/ffmpeg
    ```

---

## Installation Guide (For Users)

### 1. Download the App Bundle
Download the latest `.dmg` or `.app` release from the [GitHub Releases](https://github.com/JayWebtech/autoshorts/releases/tag/autoshorts). Be sure to select the architecture matching your Mac:
- **Apple Silicon (M1/M2/M3)**: Choose the `aarch64` package.
- **Intel Mac**: Choose the `x64` package.

### 2. Install the App
1. Double-click the downloaded `.dmg` file.
2. Drag the **AutoShorts** app icon into your **Applications** folder.

### 3. Bypass macOS Gatekeeper (Unsigned Local Builds)
Because the local build is self-signed/ad-hoc signed, macOS may block it on first run with a warning ("damaged or from an unidentified developer").
- **Easiest fix**: Right-click the `AutoShorts.app` icon in Finder, choose **Open**, and click **Open** in the prompt.
- **Terminal fix**: Run the following command in your terminal:
  ```bash
  xattr -cr /Applications/AutoShorts.app
  ```

### 4. Configure API Credentials
Since the standalone app runs outside your local environment, you need to configure your API keys within the app interface:
1. Open **AutoShorts** and click **API Settings** in the top bar.
2. Paste your API keys for **Deepgram**, **Claude**, and/or **DeepSeek**.
3. The app will visually badge your active provider and alert you if keys are missing.

---

## Developer Guide

### 1. Setup Environment Configuration
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```
Fill in your API Keys:
```env
DEEPGRAM_API_KEY=your-deepgram-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Choose your default AI analysis provider ("deepseek" or "claude")
LLM_PROVIDER=deepseek
```

### 2. Run in Development Mode
To start the live-reloaded frontend and backend development shell:
```bash
npm install
npm run tauri:dev
```

### 3. Build the Application
To build and package the native macOS app bundle (`.app` and `.dmg` installer):
```bash
npm run tauri:build
```
The output installers will be built under `src-tauri/target/release/bundle/`.
