// ── Sonotype ──────────────────────────────────────────────
// Local-first audio/video transcription desktop app

const $ = (selector) => document.querySelector(selector);

const topTabs = document.querySelectorAll(".top-tab");
const recordView = $("#record-view");
const libraryView = $("#library-view");
const sourceTabs = document.querySelectorAll(".source-tab");
const sourcePanels = document.querySelectorAll(".source-panel");
const dropZone = $("#drop-zone");
const fileInput = $("#file-input");
const fileName = $("#file-name");
const fileReadiness = $("#file-readiness");
const fileProgressBar = $("#file-progress-bar");
const fileProgressPercent = $("#file-progress-percent");
const fileProgressMessage = $("#file-progress-message");
const fileReadyNote = $("#file-ready-note");
const recordButton = $("#record-button");
const recordButtonSymbol = $("#record-button-symbol");
const stopButton = $("#stop-button");
const recordingControls = $("#recording-controls");
const recordingLabel = $("#recording-label");
const recordingTime = $("#recording-time");
const recordingNote = $("#recording-note");
const youtubeUrl = $("#youtube-url");
const prepareYoutubeButton = $("#prepare-youtube-button");
const youtubeNote = $("#youtube-note");
const youtubeReadiness = $("#youtube-readiness");
const youtubeProgressBar = $("#youtube-progress-bar");
const youtubeProgressPercent = $("#youtube-progress-percent");
const youtubeProgressMessage = $("#youtube-progress-message");
const youtubeReadyNote = $("#youtube-ready-note");
const transcribeButton = $("#transcribe-button");
const transcript = $("#transcript");
const progressPanel = $("#progress-panel");
const progressBar = $("#progress-bar");
const progressPercent = $("#progress-percent");
const progressMessage = $("#progress-message");
const confidence = $("#confidence");
const copyButton = $("#copy-button");
const formatSelect = $("#format-select");
const saveButton = $("#save-button");
const statusBar = $("#status-bar");
const statusIcon = $("#status-icon");
const statusText = $("#status");
const libraryList = $("#library-list");
const modal = $("#first-run-modal");
const modalDismiss = $("#modal-dismiss");

const LIBRARY_STORAGE_KEY = "sonotype-library-v1";
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);
const FORMAT_CONFIG = {
  txt: { label: "Plain text", extension: "txt", mime: "text/plain" },
  md: { label: "Markdown", extension: "md", mime: "text/markdown" },
  csv: { label: "CSV", extension: "csv", mime: "text/csv" },
  html: { label: "HTML", extension: "html", mime: "text/html" },
  docx: { label: "DOCX", extension: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  pdf: { label: "PDF", extension: "pdf", mime: "application/pdf" },
};

let activeView = "record";
let activeSource = "record";
let selectedFile = null;
let fileReady = false;
let readyYoutubeUrl = "";
let youtubeReady = false;
let preparationToken = 0;
let preparationTimer = null;
let recorder = null;
let recordingStream = null;
let recordingChunks = [];
let recordingTimer = null;
let recordingStartedAt = 0;
let recordingPausedAt = 0;
let recordingPausedTotal = 0;
let recordingFinalizing = false;
let isTranscribing = false;
let hasTranscribed = false;
let currentSourceName = "";
let libraryEntries = [];

// ── Helpers ───────────────────────────────────────────────

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `${hours ? `${hours.toString().padStart(2, "0")}:` : ""}${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusBar.className = `status-bar${type ? ` ${type}` : ""}`;
  statusIcon.textContent = type === "success" ? "✓" : type === "error" ? "!" : "•";
}

function setProgress(percent, message) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  progressPanel.classList.remove("hidden");
  if (message) progressMessage.textContent = message;
  progressBar.style.width = `${value}%`;
  progressPercent.textContent = `${Math.round(value)}%`;
}

function updateSourceAction() {
  const sourceIsReady = activeSource === "file" ? Boolean(selectedFile && fileReady) : Boolean(readyYoutubeUrl && youtubeReady);
  transcribeButton.classList.toggle("hidden", activeSource === "record");
  transcribeButton.disabled = !sourceIsReady || isTranscribing;
  recordButton.disabled = isTranscribing || recordingFinalizing;
}

function switchView(view) {
  activeView = view;
  topTabs.forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  recordView.classList.toggle("hidden", view !== "record");
  libraryView.classList.toggle("hidden", view !== "library");
  if (view === "library") renderLibrary();
}

function switchSource(source) {
  activeSource = source;
  sourceTabs.forEach((tab) => {
    const active = tab.dataset.source === source;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  sourcePanels.forEach((panel) => panel.classList.toggle("hidden", panel.id !== `${source}-panel`));
  updateSourceAction();
}

function formatFileSize(file) {
  return `${Math.max(0.1, file.size / 1048576).toFixed(1)} MB`;
}

function clearPreparation() {
  preparationToken += 1;
  if (preparationTimer) window.clearInterval(preparationTimer);
  preparationTimer = null;
}

function prepareLocalSource(kind, label) {
  clearPreparation();
  const token = preparationToken;
  const isFile = kind === "file";
  const card = isFile ? fileReadiness : youtubeReadiness;
  const bar = isFile ? fileProgressBar : youtubeProgressBar;
  const percentLabel = isFile ? fileProgressPercent : youtubeProgressPercent;
  const messageLabel = isFile ? fileProgressMessage : youtubeProgressMessage;
  const noteLabel = isFile ? fileReadyNote : youtubeReadyNote;
  let percent = 0;

  if (isFile) fileReady = false;
  else youtubeReady = false;
  card.classList.remove("hidden");
  messageLabel.textContent = "Preparing local import…";
  percentLabel.textContent = "0%";
  bar.style.width = "0%";
  noteLabel.textContent = `${label} stays on this machine.`;
  updateSourceAction();

  preparationTimer = window.setInterval(() => {
    if (token !== preparationToken) return;
    percent = Math.min(100, percent + 20);
    bar.style.width = `${percent}%`;
    percentLabel.textContent = `${percent}%`;
    if (percent < 100) return;
    window.clearInterval(preparationTimer);
    preparationTimer = null;
    if (isFile) fileReady = true;
    else youtubeReady = true;
    messageLabel.textContent = isFile ? "Import complete · Ready to transcribe" : "URL ready · Ready to transcribe";
    noteLabel.textContent = isFile ? "Transcription will run locally on this machine." : "Audio will be downloaded locally when transcription begins.";
    setStatus(isFile ? "Import complete · Ready to transcribe." : "URL ready · Ready to transcribe.", "success");
    updateSourceAction();
  }, 75);
}

function recordingSeconds(now = Date.now()) {
  const end = recordingPausedAt || now;
  return Math.max(0, Math.floor((end - recordingStartedAt - recordingPausedTotal) / 1000));
}

function paintRecordingTimer() {
  recordingTime.textContent = formatTime(recordingSeconds());
}

function resetRecordingControls() {
  clearInterval(recordingTimer);
  recordingTimer = null;
  recordButton.classList.remove("recording", "paused");
  recordButtonSymbol.textContent = "●";
  recordButton.setAttribute("aria-label", "Start recording");
  recordingControls.classList.add("hidden");
  stopButton.disabled = false;
  recordingFinalizing = false;
  updateSourceAction();
}

function displayRecordedFile(file, duration) {
  selectedFile = file;
  fileReady = true;
  readyYoutubeUrl = "";
  currentSourceName = file.name;
  recordingLabel.textContent = "Recording ready";
  recordingTime.textContent = formatTime(duration);
  recordingNote.textContent = `${file.name} · ${formatTime(duration)} · ready for local transcription.`;
}

// ── First-run modal ───────────────────────────────────────

async function maybeShowFirstRunModal() {
  try {
    const response = await fetch("/runtime");
    if (!response.ok) throw new Error("Runtime status unavailable");
    const runtime = await response.json();
    if (!runtime.model_ready && !hasTranscribed) modal.classList.remove("hidden");
    return;
  } catch {
    // Keep the browser fallback useful if the local service is still starting.
    try {
      if (!hasTranscribed && !localStorage.getItem("sonotype-modal-seen")) modal.classList.remove("hidden");
    } catch { /* storage may be unavailable */ }
  }
}

modalDismiss.addEventListener("click", () => {
  modal.classList.add("hidden");
  try { localStorage.setItem("sonotype-modal-seen", "1"); } catch { /* storage may be unavailable */ }
});
setTimeout(() => { maybeShowFirstRunModal(); }, 800);

// ── View and source switching ─────────────────────────────

topTabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
sourceTabs.forEach((tab) => tab.addEventListener("click", () => {
  switchSource(tab.dataset.source);
  setStatus(tab.dataset.source === "record" ? "Ready — processing stays on this machine." : "Choose a local source, then prepare it before transcription.");
}));

// ── File import ────────────────────────────────────────────

function displayFile(file) {
  selectedFile = file;
  readyYoutubeUrl = "";
  youtubeReady = false;
  currentSourceName = file.name;
  fileName.textContent = `${file.name} · ${formatFileSize(file)}`;
  switchSource("file");
  prepareLocalSource("file", file.name);
}

fileInput.addEventListener("change", () => { if (fileInput.files[0]) displayFile(fileInput.files[0]); });
["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
}));
["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
}));
dropZone.addEventListener("drop", (event) => { if (event.dataTransfer.files[0]) displayFile(event.dataTransfer.files[0]); });

// ── Recording ─────────────────────────────────────────────

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    setStatus("This device does not provide local microphone recording.", "error");
    return;
  }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    recorder = new MediaRecorder(recordingStream, { mimeType });
    recorder.ondataavailable = (event) => event.data.size && recordingChunks.push(event.data);
    recorder.onstop = async () => {
      const duration = recordingSeconds();
      recordingStream?.getTracks().forEach((track) => track.stop());
      recordingStream = null;
      const recording = new Blob(recordingChunks, { type: mimeType });
      const file = new File([recording], "sonotype-recording.webm", { type: mimeType });
      recorder = null;
      resetRecordingControls();
      displayRecordedFile(file, duration);
      setStatus("Recording stopped. Starting local transcription…");
      await beginTranscription({ file, sourceName: file.name });
    };
    recorder.onerror = () => {
      recordingStream?.getTracks().forEach((track) => track.stop());
      recorder = null;
      resetRecordingControls();
      setStatus("The local recording could not be completed.", "error");
    };
    recorder.start(250);
    recordingStartedAt = Date.now();
    recordingPausedAt = 0;
    recordingPausedTotal = 0;
    recordingLabel.textContent = "Recording in progress";
    recordingTime.textContent = "00:00";
    recordingNote.textContent = "Recording locally · press the button to pause or resume.";
    recordButton.classList.add("recording");
    recordButtonSymbol.textContent = "Ⅱ";
    recordButton.setAttribute("aria-label", "Pause recording");
    recordingControls.classList.remove("hidden");
    recordingTimer = window.setInterval(paintRecordingTimer, 250);
    updateSourceAction();
    setStatus("Recording locally. Stop when you are ready to transcribe.");
  } catch {
    setStatus("Microphone access was not granted.", "error");
  }
}

function toggleRecordingPause() {
  if (!recorder) return;
  if (recorder.state === "recording") {
    recorder.pause();
    recordingPausedAt = Date.now();
    clearInterval(recordingTimer);
    recordingTimer = null;
    recordButton.classList.add("paused");
    recordButtonSymbol.textContent = "▶";
    recordButton.setAttribute("aria-label", "Resume recording");
    recordingLabel.textContent = "Recording paused";
    recordingNote.textContent = "Press the button to continue recording.";
    setStatus("Recording paused.");
  } else if (recorder.state === "paused") {
    recordingPausedTotal += Date.now() - recordingPausedAt;
    recordingPausedAt = 0;
    recorder.resume();
    recordButton.classList.remove("paused");
    recordButtonSymbol.textContent = "Ⅱ";
    recordButton.setAttribute("aria-label", "Pause recording");
    recordingLabel.textContent = "Recording in progress";
    recordingNote.textContent = "Recording locally · press the button to pause or resume.";
    recordingTimer = window.setInterval(paintRecordingTimer, 250);
    setStatus("Recording resumed.");
  }
}

function finishRecording() {
  if (!recorder || recorder.state === "inactive") return;
  recordingFinalizing = true;
  stopButton.disabled = true;
  recordButton.disabled = true;
  recordingLabel.textContent = "Preparing transcription";
  recordingNote.textContent = "Stopping begins transcription automatically.";
  if (recorder.state === "paused") {
    recordingPausedTotal += Date.now() - recordingPausedAt;
    recordingPausedAt = 0;
  }
  recorder.stop();
}

recordButton.addEventListener("click", () => {
  if (recorder?.state === "recording" || recorder?.state === "paused") toggleRecordingPause();
  else if (!isTranscribing) startRecording();
});
stopButton.addEventListener("click", finishRecording);

// ── YouTube preparation ───────────────────────────────────

function validYoutubeUrl(value) {
  try {
    const parsed = new URL(value);
    return YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

prepareYoutubeButton.addEventListener("click", () => {
  const value = youtubeUrl.value.trim();
  if (!validYoutubeUrl(value)) {
    readyYoutubeUrl = "";
    youtubeReady = false;
    youtubeReadiness.classList.add("hidden");
    youtubeNote.textContent = "Enter a valid YouTube URL. Use only content you own or are permitted to download.";
    updateSourceAction();
    return;
  }
  selectedFile = null;
  fileReady = false;
  readyYoutubeUrl = value;
  currentSourceName = "YouTube URL";
  youtubeNote.textContent = "URL accepted. Audio will be downloaded locally when transcription begins.";
  prepareLocalSource("youtube", "This URL");
});
youtubeUrl.addEventListener("input", () => {
  readyYoutubeUrl = "";
  youtubeReady = false;
  youtubeReadiness.classList.add("hidden");
  updateSourceAction();
});

// ── Transcription ─────────────────────────────────────────

async function consumeEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const event of events) {
      if (!event.startsWith("data: ")) continue;
      const data = JSON.parse(event.slice(6));
      if (data.type === "phase") setProgress(Number(progressPercent.textContent.replace("%", "")) || 0, data.phase);
      if (data.type === "progress") setProgress(data.pct);
      if (data.type === "error") throw new Error(data.message);
      if (data.type === "done") return data;
    }
  }
  throw new Error("The local service ended before returning a transcript.");
}

async function beginTranscription({ file = null, sourceName = "", url = "" } = {}) {
  if (isTranscribing) return;
  if (!file && !url) return;
  isTranscribing = true;
  currentSourceName = sourceName || currentSourceName || (file ? file.name : "YouTube URL");
  confidence.classList.add("hidden");
  setStatus("");
  setProgress(0, url ? "Preparing local audio download…" : "Preparing local transcription…");

  const form = new FormData();
  form.append("diarize", "true");
  let endpoint = "/transcribe";
  if (url) {
    endpoint = "/transcribe/youtube";
    form.append("url", url);
  } else {
    form.append("media", file, file.name);
  }

  try {
    const response = await fetch(endpoint, { method: "POST", body: form });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(problem.detail || "Transcription could not start.");
    }
    const result = await consumeEvents(response);
    transcript.textContent = result.transcript || "";
    confidence.textContent = `Confidence: ${result.confidence}%`;
    confidence.classList.remove("hidden");
    setProgress(100, "Transcript ready locally");
    setStatus("Transcript ready locally. Edit and save your copy.", "success");
    hasTranscribed = true;
    modal.classList.add("hidden");
  } catch (error) {
    progressPanel.classList.add("hidden");
    setStatus(error.message, "error");
  } finally {
    isTranscribing = false;
    updateSourceAction();
  }
}

transcribeButton.addEventListener("click", () => {
  if (activeSource === "file" && selectedFile && fileReady) beginTranscription({ file: selectedFile, sourceName: selectedFile.name });
  if (activeSource === "youtube" && readyYoutubeUrl && youtubeReady) beginTranscription({ url: readyYoutubeUrl, sourceName: "YouTube URL" });
});

// ── Copy ──────────────────────────────────────────────────

copyButton.addEventListener("click", async () => {
  const text = transcript.innerText.trim();
  if (!text) { setStatus("Nothing to copy yet.", "error"); return; }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.", "success");
  } catch {
    setStatus("Could not copy automatically. Select the text and copy manually.", "error");
  }
});

// ── Local saving and Library ──────────────────────────────

function readLibrary() {
  try {
    const entries = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

async function persistLibrary() {
  try { localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(libraryEntries)); } catch { /* local storage may be unavailable */ }
  try {
    const response = await fetch("/library", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(libraryEntries),
    });
    if (!response.ok) throw new Error("Library save failed.");
    const saved = await response.json();
    if (Array.isArray(saved)) libraryEntries = saved;
  } catch { /* localStorage remains a browser fallback */ }
}

async function loadLibrary() {
  try {
    const response = await fetch("/library");
    if (!response.ok) throw new Error("Library unavailable");
    const saved = await response.json();
    libraryEntries = Array.isArray(saved) ? saved : [];
    if (!libraryEntries.length) {
      const legacy = readLibrary();
      if (legacy.length) {
        libraryEntries = legacy;
        await persistLibrary();
      }
    }
  } catch {
    libraryEntries = readLibrary();
  }
  renderLibrary();
}

async function addLibraryEntry(name, text, format) {
  const entry = {
    id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    format: format.toUpperCase(),
    text,
    confidence: confidence.textContent,
    savedAt: new Date().toISOString(),
  };
  libraryEntries = [entry, ...libraryEntries.filter((item) => item.name !== name)].slice(0, 40);
  renderLibrary();
  await persistLibrary();
}

function renderLibrary() {
  libraryList.replaceChildren();
  if (!libraryEntries.length) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.innerHTML = "<strong>No saved transcripts yet.</strong><span>Transcribe something, then choose Save transcription.</span>";
    libraryList.append(empty);
    return;
  }
  libraryEntries.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "library-item";
    const open = document.createElement("button");
    open.className = "library-open";
    open.type = "button";
    const title = document.createElement("span");
    title.className = "library-title";
    title.textContent = entry.name;
    const meta = document.createElement("span");
    meta.className = "library-meta";
    meta.textContent = `${entry.format} · ${new Date(entry.savedAt).toLocaleString()}`;
    open.append(title, meta);
    open.addEventListener("click", () => {
      transcript.textContent = entry.text;
      currentSourceName = entry.name;
      if (entry.confidence) {
        confidence.textContent = entry.confidence;
        confidence.classList.remove("hidden");
      }
      switchView("record");
      setStatus(`Opened ${entry.name}.`, "success");
    });
    const remove = document.createElement("button");
    remove.className = "library-delete";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      libraryEntries = libraryEntries.filter((saved) => saved.id !== entry.id);
      renderLibrary();
      await persistLibrary();
    });
    item.append(open, remove);
    libraryList.append(item);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function serializeText(text, extension) {
  if (extension === "html") return `<!doctype html><meta charset="utf-8"><title>Sonotype transcript</title><article><pre>${escapeHtml(text)}</pre></article>`;
  if (extension === "csv") return text.split(/\r?\n/).map((line) => `"${line.replaceAll('"', '""')}"`).join("\n");
  return text;
}

async function fetchExport(endpoint, text) {
  const form = new FormData();
  form.append("transcript", text);
  const response = await fetch(endpoint, { method: "POST", body: form });
  if (!response.ok) throw new Error("Save failed.");
  return response.blob();
}

async function saveTranscription() {
  const text = transcript.innerText.trim();
  if (!text) { setStatus("Nothing to save yet.", "error"); return; }
  const selectedFormat = FORMAT_CONFIG[formatSelect.value] || FORMAT_CONFIG.txt;
  const suggestedName = `sonotype-transcript.${selectedFormat.extension}`;
  try {
    if ("showSaveFilePicker" in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: selectedFormat.label, accept: { [selectedFormat.mime]: [`.${selectedFormat.extension}`] } }],
      });
      const extension = (handle.name.split(".").pop() || selectedFormat.extension).toLowerCase();
      let content = serializeText(text, extension);
      if (extension === "docx") content = await fetchExport("/export/docx", text);
      if (extension === "pdf") content = await fetchExport("/export/pdf", text);
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      await addLibraryEntry(handle.name, text, extension);
      setStatus(`Saved locally as ${handle.name}`, "success");
      return;
    }

    const extension = selectedFormat.extension;
    const content = extension === "docx" || extension === "pdf"
      ? await fetchExport(`/export/${extension}`, text)
      : serializeText(text, extension);
    const blob = content instanceof Blob ? content : new Blob([content], { type: selectedFormat.mime });
    const href = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), { href, download: suggestedName });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    await addLibraryEntry(suggestedName, text, extension);
    setStatus(`Saved locally as ${suggestedName}`, "success");
  } catch (error) {
    if (error.name !== "AbortError") setStatus(error.message || "Save failed.", "error");
  }
}

saveButton.addEventListener("click", saveTranscription);

// Start with the approved utility state: Record first, local processing always visible.
switchView("record");
switchSource("record");
renderLibrary();
loadLibrary();
setStatus("Ready — processing stays on this machine.");
