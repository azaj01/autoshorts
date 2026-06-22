import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AudioLines,
  BadgeCheck,
  Captions,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  FileVideo,
  Loader2,
  Play,
  RefreshCw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react";
import "./styles.css";

type EnvironmentStatus = {
  dataDir: string;
  hasFfmpeg: boolean;
  hasFfprobe: boolean;
  hasDeepgramKey: boolean;
  hasAnthropicKey: boolean;
};

type Project = {
  id: string;
  sourcePath: string;
  sourceDuration: number | null;
  status: string;
  transcriptionMode: string;
  createdAt: string;
  updatedAt: string;
};

type Transcript = {
  id: string;
  projectId: string;
  engine: string;
  rawJson: string;
  language: string | null;
  createdAt: string;
};

type Candidate = {
  id: string;
  projectId: string;
  startSec: number;
  endSec: number;
  score: number;
  hook: string;
  rationale: string;
  rank: number;
  selected: boolean;
};

type Clip = {
  id: string;
  candidateId: string;
  status: string;
  outputPath: string | null;
  faceTrackJson: string | null;
  captionAssPath: string | null;
  renderLog: string | null;
};

type ProjectDetail = {
  project: Project;
  transcript: Transcript | null;
  candidates: Candidate[];
  clips: Clip[];
};

type NormalizedTranscript = {
  language: string;
  duration: number;
  speakers: string[];
  segments: Array<{
    start: number;
    end: number;
    speaker: string | null;
    text: string;
  }>;
};

type BusyState =
  | "idle"
  | "import"
  | "transcribe"
  | "demoTranscript"
  | "moments"
  | "clipCount"
  | "cut";

function App() {
  const [environment, setEnvironment] = useState<EnvironmentStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [busy, setBusy] = useState<BusyState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deepgramKey, setDeepgramKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");

  const transcript = useMemo(() => {
    if (!detail?.transcript) return null;
    try {
      return JSON.parse(detail.transcript.rawJson) as NormalizedTranscript;
    } catch {
      return null;
    }
  }, [detail?.transcript]);

  const selectedCount = detail?.candidates.filter((candidate) => candidate.selected).length ?? 0;
  const clipByCandidate = useMemo(() => {
    return new Map(detail?.clips.map((clip) => [clip.candidateId, clip]) ?? []);
  }, [detail?.clips]);
  const selectedCandidates = detail?.candidates.filter((candidate) => candidate.selected) ?? [];
  const selectedCutCount = selectedCandidates.filter((candidate) => {
    const clip = clipByCandidate.get(candidate.id);
    return clip?.status === "done" && Boolean(clip.outputPath);
  }).length;
  const canUseCloudKey = environment?.hasDeepgramKey || deepgramKey.trim().length > 0;
  const canUseClaude = environment?.hasAnthropicKey || anthropicKey.trim().length > 0;

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(nextProjectId = detail?.project.id) {
    setError(null);
    const [env, projectList] = await Promise.all([
      invoke<EnvironmentStatus>("environment_status"),
      invoke<Project[]>("list_projects"),
    ]);
    setEnvironment(env);
    setProjects(projectList);

    const projectId = nextProjectId ?? projectList[0]?.id;
    if (projectId) {
      const nextDetail = await invoke<ProjectDetail>("get_project_detail", { projectId });
      setDetail(nextDetail);
    } else {
      setDetail(null);
    }
  }

  async function run(action: BusyState, task: () => Promise<void>) {
    setBusy(action);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("idle");
    }
  }

  async function importMedia() {
    await run("import", async () => {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Media",
            extensions: ["mp4", "mov", "mp3", "wav", "m4a"],
          },
        ],
      });
      if (typeof selected !== "string") return;
      const project = await invoke<Project>("create_project_from_path", {
        path: selected,
        transcriptionMode: "cloud",
      });
      await refresh(project.id);
    });
  }

  async function selectProject(projectId: string) {
    await run("idle", async () => {
      const nextDetail = await invoke<ProjectDetail>("get_project_detail", { projectId });
      setDetail(nextDetail);
    });
  }

  async function transcribe() {
    if (!detail) return;
    await run("transcribe", async () => {
      await invoke<Transcript>("transcribe_project", {
        projectId: detail.project.id,
        provider: "deepgram",
        apiKey: deepgramKey.trim() || null,
      });
      await refresh(detail.project.id);
    });
  }

  async function demoTranscript() {
    if (!detail) return;
    await run("demoTranscript", async () => {
      await invoke<Transcript>("save_demo_transcript", { projectId: detail.project.id });
      await refresh(detail.project.id);
    });
  }

  async function moments(allowDemo: boolean) {
    if (!detail) return;
    await run("moments", async () => {
      await invoke<Candidate[]>("generate_candidates", {
        projectId: detail.project.id,
        apiKey: anthropicKey.trim() || null,
        allowDemo,
      });
      await refresh(detail.project.id);
    });
  }

  async function updateClipCount(count: number) {
    if (!detail) return;
    await run("clipCount", async () => {
      const candidates = await invoke<Candidate[]>("set_selected_clip_count", {
        projectId: detail.project.id,
        count,
      });
      setDetail({ ...detail, candidates });
    });
  }

  async function cutCandidate(candidateId: string) {
    if (!detail) return;
    await run("cut", async () => {
      await invoke<string>("render_flat_clip_for_candidate", { candidateId });
      await refresh(detail.project.id);
    });
  }

  async function cutSelected() {
    if (!detail) return;
    await run("cut", async () => {
      for (const candidate of selectedCandidates) {
        await invoke<string>("render_flat_clip_for_candidate", { candidateId: candidate.id });
      }
      await refresh(detail.project.id);
    });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <Clapperboard size={22} />
          </div>
          <div>
            <h1>Shortcast</h1>
            <p>Long recording in. Short clips out.</p>
          </div>
        </div>

        <button className="primary-action" onClick={importMedia} disabled={busy !== "idle"}>
          {busy === "import" ? <Loader2 className="spin" size={18} /> : <FileVideo size={18} />}
          Import recording
        </button>

        <div className="status-grid">
          <StatusPill label="ffmpeg" active={environment?.hasFfmpeg} />
          <StatusPill label="ffprobe" active={environment?.hasFfprobe} />
          <StatusPill label="Deepgram" active={environment?.hasDeepgramKey || deepgramKey.length > 0} />
          <StatusPill label="Claude" active={environment?.hasAnthropicKey || anthropicKey.length > 0} />
        </div>

        <div className="key-stack">
          <label>
            <span>Deepgram key</span>
            <input
              value={deepgramKey}
              onChange={(event) => setDeepgramKey(event.target.value)}
              placeholder={environment?.hasDeepgramKey ? "Loaded from env" : "Optional"}
              type="password"
            />
          </label>
          <label>
            <span>Claude key</span>
            <input
              value={anthropicKey}
              onChange={(event) => setAnthropicKey(event.target.value)}
              placeholder={environment?.hasAnthropicKey ? "Loaded from env" : "Optional"}
              type="password"
            />
          </label>
        </div>

        <section className="project-list" aria-label="Projects">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-row ${detail?.project.id === project.id ? "active" : ""}`}
              onClick={() => void selectProject(project.id)}
            >
              <FileVideo size={17} />
              <span>{fileName(project.sourcePath)}</span>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
      </aside>

      <section className="workspace">
        {detail ? (
          <>
            <header className="topbar">
              <div>
                <div className="eyebrow">{detail.project.status}</div>
                <h2>{fileName(detail.project.sourcePath)}</h2>
              </div>
              <button className="icon-button" onClick={() => void refresh(detail.project.id)} title="Refresh">
                <RefreshCw size={18} />
              </button>
            </header>

            {error && <div className="error-banner">{error}</div>}

            <div className="pipeline-strip">
              <PipelineStep icon={<AudioLines size={18} />} label="Transcript" done={Boolean(detail.transcript)} />
              <PipelineStep icon={<Sparkles size={18} />} label="Moments" done={detail.candidates.length > 0} />
              <PipelineStep icon={<Scissors size={18} />} label="Cut" done={selectedCount > 0 && selectedCutCount === selectedCount} />
              <PipelineStep icon={<Captions size={18} />} label="Captions" done={false} />
              <PipelineStep icon={<Download size={18} />} label="Export" done={false} />
            </div>

            <div className="work-grid">
              <section className="panel transcript-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Transcript</h3>
                    <p>{transcript ? `${transcript.segments.length} segments` : "No transcript"}</p>
                  </div>
                  <div className="button-pair">
                    <button onClick={transcribe} disabled={busy !== "idle" || !canUseCloudKey}>
                      {busy === "transcribe" ? <Loader2 className="spin" size={16} /> : <AudioLines size={16} />}
                      Cloud
                    </button>
                    <button onClick={demoTranscript} disabled={busy !== "idle"}>
                      {busy === "demoTranscript" ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
                      Demo
                    </button>
                  </div>
                </div>

                <div className="transcript-list">
                  {transcript?.segments.map((segment, index) => (
                    <article key={`${segment.start}-${index}`} className="segment-row">
                      <span>{formatTime(segment.start)}</span>
                      <p>{segment.text}</p>
                    </article>
                  )) ?? <EmptyState icon={<AudioLines size={28} />} label="Transcript pending" />}
                </div>
              </section>

              <section className="panel candidate-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Clip Candidates</h3>
                    <p>{detail.candidates.length ? `${selectedCount} selected` : "No candidates"}</p>
                  </div>
                  <div className="button-pair">
                    <button onClick={cutSelected} disabled={busy !== "idle" || selectedCount === 0 || !environment?.hasFfmpeg}>
                      {busy === "cut" ? <Loader2 className="spin" size={16} /> : <Scissors size={16} />}
                      Cut
                    </button>
                    <button onClick={() => void moments(false)} disabled={busy !== "idle" || !detail.transcript || !canUseClaude}>
                      {busy === "moments" ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                      Claude
                    </button>
                    <button onClick={() => void moments(true)} disabled={busy !== "idle" || !detail.transcript}>
                      {busy === "moments" ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
                      Demo
                    </button>
                  </div>
                </div>

                {detail.candidates.length > 0 && (
                  <div className="clip-control">
                    <SlidersHorizontal size={17} />
                    <input
                      type="range"
                      min="0"
                      max={detail.candidates.length}
                      value={selectedCount}
                      onChange={(event) => void updateClipCount(Number(event.target.value))}
                    />
                    <strong>{selectedCount}</strong>
                  </div>
                )}

                <div className="candidate-list">
                  {detail.candidates.map((candidate) => {
                    const clip = clipByCandidate.get(candidate.id);
                    const isCut = clip?.status === "done" && Boolean(clip.outputPath);
                    return (
                      <article key={candidate.id} className={`candidate-card ${candidate.selected ? "selected" : ""}`}>
                        <div className="candidate-rank">
                          <span>#{candidate.rank}</span>
                          {candidate.selected && <Check size={15} />}
                        </div>
                        <div className="candidate-body">
                          <div className="candidate-meta">
                            <span>{formatTime(candidate.startSec)}-{formatTime(candidate.endSec)}</span>
                            <span>{Math.round(candidate.score * 100)}%</span>
                          </div>
                          <h4>{candidate.hook}</h4>
                          <p>{candidate.rationale}</p>
                          <div className="candidate-actions">
                            <span className={`clip-status ${isCut ? "ready" : clip?.status === "error" ? "error" : ""}`}>
                              {isCut ? "Cut ready" : clip?.status === "error" ? "Cut failed" : clip?.status ?? "Pending"}
                            </span>
                            <button
                              className="cut-button"
                              onClick={() => void cutCandidate(candidate.id)}
                              disabled={busy !== "idle" || !environment?.hasFfmpeg}
                            >
                              {busy === "cut" ? <Loader2 className="spin" size={15} /> : <Scissors size={15} />}
                              {isCut ? "Re-cut" : "Cut"}
                            </button>
                          </div>
                          {clip?.outputPath && <div className="output-path">{clip.outputPath}</div>}
                          {clip?.renderLog && <div className="render-log">{clip.renderLog}</div>}
                        </div>
                      </article>
                    );
                  })}
                  {detail.candidates.length === 0 && <EmptyState icon={<Sparkles size={28} />} label="Moments pending" />}
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="empty-workspace">
            <Clapperboard size={46} />
            <h2>Shortcast</h2>
            <button className="primary-action compact" onClick={importMedia}>
              <FileVideo size={18} />
              Import recording
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className={`status-pill ${active ? "active" : ""}`}>
      <BadgeCheck size={14} />
      {label}
    </div>
  );
}

function PipelineStep({ icon, label, done }: { icon: React.ReactNode; label: string; done: boolean }) {
  return (
    <div className={`pipeline-step ${done ? "done" : ""}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="empty-state">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
