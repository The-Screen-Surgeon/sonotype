// ── Sonotype ──────────────────────────────────────────────
// Local-first audio/video transcription desktop app

const dropZone = document.querySelector("#drop-zone");
const fileInput = document.querySelector("#file-input");
const fileName = document.querySelector("#file-name");
const recordButton = document.querySelector("#record-button");
const stopButton = document.querySelector("#stop-button");
const recordingLabel = document.querySelector("#recording-label");
const recordingTime = document.querySelector("#recording-time");
const recordingNote = document.querySelector("#recording-note");
const youtubeUrl = document.querySelector("#youtube-url");
const fetchButton = document.querySelector("#fetch-button");
const youtubeNote = document.querySelector("#youtube-note");
const transcribeButton = document.querySelector("#transcribe-button");
const transcript = document.querySelector("#transcript");
const progressPanel = document.querySelector("#progress-panel");
const progressBar = document.querySelector("#progress-bar");
const progressPercent = document.querySelector("#progress-percent");
const progressMessage = document.querySelector("#progress-message");
const confidence = document.querySelector("#confidence");
const copyButton = document.querySelector("#copy-button");
const saveButton = document.querySelector("#save-button");
const statusBar = document.querySelector("#status-bar");
const statusIcon = document.querySelector("#status-icon");
const statusText = document.querySelector("#status");
const modal = document.querySelector("#first-run-modal");
const modalDismiss = document.querySelector("#modal-dismiss");

let activeSource = "record";
let selectedFile = null;
let readyYoutubeUrl = "";
let recorder = null;
let recordingChunks = [];
let recordingTimer = null;
let recordingStartedAt = 0;
let hasTranscribed = false;

// ── Helpers ───────────────────────────────────────────────

function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusBar.className = `status-bar${type ? ` ${type}` : ""}`;
  statusIcon.textContent = type === "success" ? "✓" : type === "error" ? "⚠" : "ℹ";
}

function updateReadyState() {
  const ready = activeSource === "youtube" ? Boolean(readyYoutubeUrl) : Boolean(selectedFile);
  transcribeButton.disabled = !ready || recorder?.state === "recording";
}

function displayFile(file, source = "file") {
  selectedFile = file;
  readyYoutubeUrl = "";
  const size = Math.max(0.1, file.size / 1048576).toFixed(1);
  if (source === "record") {
    recordingLabel.textContent = "Recording ready";
    recordingNote.textContent = `${file.name} (${size} MB) — ready to transcribe.`;
  } else {
    fileName.textContent = `${file.name} (${size} MB)`;
  }
  setStatus("");
  updateReadyState();
}

// ── First-run modal ───────────────────────────────────────

function maybeShowFirstRunModal() {
  if (!hasTranscribed && !localStorage.getItem("sonotype-modal-seen")) {
    modal.classList.remove("hidden");
  }
}

modalDismiss.addEventListener("click", () => {
  modal.classList.add("hidden");
  localStorage.setItem("sonotype-modal-seen", "1");
});

// Show modal shortly after page loads
setTimeout(maybeShowFirstRunModal, 800);

// ── Tab switching ─────────────────────────────────────────

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  activeSource = tab.dataset.source;
  document.querySelectorAll(".tab").forEach((item) => {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", active);
  });
  document.querySelectorAll(".source-panel").forEach((panel) => panel.classList.toggle("hidden", panel.id !== `${activeSource}-panel`));
  setStatus("");
  updateReadyState();
}));

// ── File upload ────────────────────────────────────────────

fileInput.addEventListener("change", () => { if (fileInput.files[0]) displayFile(fileInput.files[0]); });
["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add("dragging"); }));
["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove("dragging"); }));
dropZone.addEventListener("drop", (event) => { if (event.dataTransfer.files[0]) displayFile(event.dataTransfer.files[0]); });

// ── Recording ─────────────────────────────────────────────

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event) => event.data.size && recordingChunks.push(event.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      clearInterval(recordingTimer);
      recordingTime.textContent = formatTime(Math.floor((Date.now() - recordingStartedAt) / 1000));
      recordButton.classList.remove("recording");
      stopButton.classList.add("hidden");
      const recording = new Blob(recordingChunks, { type: mimeType });
      displayFile(new File([recording], "sonotype-recording.webm", { type: mimeType }), "record");
    };
    recorder.start(250);
    recordingStartedAt = Date.now();
    recordingLabel.textContent = "Recording…";
    recordingTime.textContent = "00:00";
    recordButton.classList.add("recording");
    stopButton.classList.remove("hidden");
    recordingTimer = setInterval(() => { recordingTime.textContent = formatTime(Math.floor((Date.now() - recordingStartedAt) / 1000)); }, 1000);
    updateReadyState();
  } catch {
    setStatus("Microphone access was not granted.", "error");
  }
}

recordButton.addEventListener("click", () => recorder?.state === "recording" ? recorder.stop() : startRecording());
stopButton.addEventListener("click", () => recorder?.state === "recording" && recorder.stop());

// ── YouTube ───────────────────────────────────────────────

fetchButton.addEventListener("click", () => {
  const value = youtubeUrl.value.trim();
  try {
    const parsed = new URL(value);
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"].includes(parsed.hostname)) throw new Error();
    readyYoutubeUrl = value;
    selectedFile = null;
    youtubeNote.textContent = "Video ready. Audio will be downloaded locally when you transcribe.";
    setStatus("");
  } catch {
    readyYoutubeUrl = "";
    youtubeNote.textContent = "Enter a valid YouTube URL. Use only content you own or are permitted to download.";
  }
  updateReadyState();
});
youtubeUrl.addEventListener("input", () => { readyYoutubeUrl = ""; updateReadyState(); });

// ── Transcription ────────────────────────────────────────

function setProgress(percent, message) {
  progressPanel.classList.remove("hidden");
  if (message) progressMessage.textContent = message;
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
}

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

transcribeButton.addEventListener("click", async () => {
  if (activeSource !== "youtube" && !selectedFile) return;
  if (activeSource === "youtube" && !readyYoutubeUrl) return;
  transcribeButton.disabled = true;
  confidence.classList.add("hidden");
  setStatus("");
  setProgress(0, activeSource === "youtube" ? "Preparing audio download…" : "Preparing transcription…");
  const form = new FormData();
  // Diarization is always on
  form.append("diarize", "true");
  let endpoint = "/transcribe";
  if (activeSource === "youtube") { endpoint = "/transcribe/youtube"; form.append("url", readyYoutubeUrl); }
  else form.append("media", selectedFile, selectedFile.name);
  try {
    const response = await fetch(endpoint, { method: "POST", body: form });
    if (!response.ok) { const problem = await response.json(); throw new Error(problem.detail || "Transcription could not start."); }
    const result = await consumeEvents(response);
    transcript.textContent = result.transcript;
    confidence.textContent = `Confidence: ${result.confidence}%`;
    confidence.classList.remove("hidden");
    setProgress(100, "Complete");
    setStatus("Transcript ready. Edit or save below.", "success");
    hasTranscribed = true;
  } catch (error) {
    progressPanel.classList.add("hidden");
    setStatus(error.message, "error");
  } finally {
    updateReadyState();
  }
});

// ── Copy ──────────────────────────────────────────────────

copyButton.addEventListener("click", async () => {
  const text = transcript.innerText.trim();
  if (!text) { setStatus("Nothing to copy yet.", "error"); return; }
  try { await navigator.clipboard.writeText(text); setStatus("Copied to clipboard.", "success"); }
  catch { setStatus("Could not copy automatically. Select the text and copy manually.", "error"); }
});

// ── Save As (any text format) ─────────────────────────────

saveButton.addEventListener("click", async () => {
  const text = transcript.innerText.trim();
  if (!text) { setStatus("Nothing to save yet.", "error"); return; }

  // Try the native file save picker (showSaveFilePicker) first, fall back to download
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `sonotype-transcript`,
        types: [
          { description: "Text file", accept: { "text/plain": [".txt"] } },
          { description: "Markdown", accept: { "text/markdown": [".md"] } },
          { description: "Word document", accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] } },
          { description: "PDF", accept: { "application/pdf": [".pdf"] } },
          { description: "HTML", accept: { "text/html": [".html"] } },
          { description: "CSV", accept: { "text/csv": [".csv"] } },
        ],
      });
      const ext = handle.name.split(".").pop().toLowerCase();

      if (ext === "docx") {
        // Use the export endpoint for DOCX
        const form = new FormData();
        form.append("transcript", text);
        const response = await fetch("/export/docx", { method: "POST", body: form });
        if (!response.ok) { setStatus("Save failed.", "error"); return; }
        const blob = await response.blob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else if (ext === "pdf") {
        const form = new FormData();
        form.append("transcript", text);
        const response = await fetch("/export/pdf", { method: "POST", body: form });
        if (!response.ok) { setStatus("Save failed.", "error"); return; }
        const blob = await response.blob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // Plain text formats: txt, md, html, csv — write directly
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
      }
      setStatus(`Saved as ${handle.name}`, "success");
    } catch (err) {
      if (err.name !== "AbortError") setStatus("Save failed.", "error");
    }
  } else {
    // Fallback: trigger a download with a default .txt extension
    const blob = new Blob([text], { type: "text/plain" });
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "sonotype-transcript.txt" });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    setStatus("Saved as sonotype-transcript.txt", "success");
  }
});