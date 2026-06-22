# Shortcast

Shortcast is a local-first desktop app for turning long-form recordings into ranked short-form clip candidates, then rendering vertical clips with captions and platform copy.

This repository implements the build specification from `Shortcast_Build_Specification.docx` as a Tauri 2 + React + Rust app foundation.

## Current Scope

- Desktop shell and project UI
- SQLite data model for projects, transcripts, candidates, clips, copy, and schedule entries
- Media probing hooks through `ffprobe`
- Audio extraction/rendering hooks through `ffmpeg`
- Cloud transcription integration boundary for Deepgram
- Claude moment-detection integration boundary with structured candidate storage
- Debug transcript and candidate views
- Clip-count slider that promotes already-ranked candidates without another LLM call

## Prerequisites

- Node.js 20+
- Rust 1.80+
- FFmpeg and FFprobe on `PATH`
- Optional: `DEEPGRAM_API_KEY`
- Optional: `ANTHROPIC_API_KEY`

## Run

```bash
npm install
npm run tauri:dev
```

If FFmpeg or cloud API keys are unavailable, the UI shows the missing capability and keeps local project/candidate management usable.
