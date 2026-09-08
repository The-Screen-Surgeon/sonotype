const sourceName = document.querySelector("#file-name");
const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const recordButton = document.querySelector("#record-button");
const stopButton = document.querySelector("#stop-button");
const recordingLabel = document.querySelector("#recording-label");
const recordingTime = document.querySelector("#recording-time");
const recordingNote = document.querySelector("#recording-note");
const youtubeUrl = document.querySelector("#youtube-url");
const fetchButton = document.querySelector("#fetch-button");
const youtubeNote = document.querySelector("#youtube-note");
const transcribeButton = document.querySelector("#transcribe-button");
const diarizeInput = document.querySelector("#diarize-input");
const transcript = document.querySelector("#transcript");
const progressPanel = document.querySelector("#progress-panel");
const progressBar = document.querySelector("#progress-bar");
const progressPercent = document.querySelector("#progress-percent");
const progressMessage = document.querySelector("#progress-message");
const confidence = document.querySelector("#confidence");
const status = document.querySelector("#status");

let activeSource = "file";
let selectedFile = null;
let readyYoutubeUrl = "";
let recorder = null;
let recordingChunks = [];
let recordingTimer = null;
let recordingStartedAt = 0;

function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function setStatus(message) { status.textContent = message; }
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
    recordingNote.textContent = `${file.name} (${size} MB) is ready to transcribe.`;
  } else {
    sourceName.textContent = `${file.name} (${size} MB)`;
  }
  setStatus("");
  updateReadyState();
}

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

fileInput.addEventListener("change", () => { if (fileInput.files[0]) displayFile(fileInput.files[0]); });
["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault(); dropZone.classList.add("dragging");
}));
["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault(); dropZone.classList.remove("dragging");
}));
dropZone.addEventListener("drop", (event) => { if (event.dataTransfer.files[0]) displayFile(event.dataTransfer.files[0]); });

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
    recordingLabel.textContent = "Recording in progress";
    recordingTime.textContent = "00:00";
    recordButton.classList.add("recording");
    stopButton.classList.remove("hidden");
    recordingTimer = setInterval(() => { recordingTime.textContent = formatTime(Math.floor((Date.now() - recordingStartedAt) / 1000)); }, 1000);
    updateReadyState();
  } catch {
    setStatus("Microphone access was not granted.");
  }
}
recordButton.addEventListener("click", () => recorder?.state === "recording" ? recorder.stop() : startRecording());
stopButton.addEventListener("click", () => recorder?.state === "recording" && recorder.stop());

fetchButton.addEventListener("click", () => {
  const value = youtubeUrl.value.trim();
  try {
    const parsed = new URL(value);
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"].includes(parsed.hostname)) throw new Error();
    readyYoutubeUrl = value;
    selectedFile = null;
    youtubeNote.textContent = "Video ready. Audio will be downloaded to this machine only when you transcribe.";
    setStatus("");
  } catch {
    readyYoutubeUrl = "";
    youtubeNote.textContent = "Enter a valid YouTube URL. Use only content you own or are permitted to download.";
  }
  updateReadyState();
});
youtubeUrl.addEventListener("input", () => { readyYoutubeUrl = ""; updateReadyState(); });

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
  setProgress(0, activeSource === "youtube" ? "Preparing audio download…" : "Preparing local transcription…");
  const form = new FormData();
  form.append("diarize", diarizeInput.checked);
  let endpoint = "/transcribe";
  if (activeSource === "youtube") { endpoint = "/transcribe/youtube"; form.append("url", readyYoutubeUrl); }
  else form.append("media", selectedFile, selectedFile.name);
  try {
    const response = await fetch(endpoint, { method: "POST", body: form });
    if (!response.ok) { const problem = await response.json(); throw new Error(problem.detail || "Transcription could not start."); }
    const result = await consumeEvents(response);
    transcript.textContent = result.transcript;
    confidence.textContent = `Estimated confidence: ${result.confidence}%`;
    confidence.classList.remove("hidden");
    setProgress(100, "Complete");
    setStatus("Transcript ready for review.");
  } catch (error) {
    progressPanel.classList.add("hidden");
    setStatus(error.message);
  } finally { updateReadyState(); }
});

document.querySelector("#copy-button").addEventListener("click", async () => {
  const text = transcript.innerText.trim();
  if (!text) { setStatus("Add transcript text before copying."); return; }
  try { await navigator.clipboard.writeText(text); setStatus("Transcript copied."); }
  catch { setStatus("Could not copy automatically. Select the transcript and copy it manually."); }
});
async function exportTranscript(format) {
  const text = transcript.innerText.trim();
  if (!text) { setStatus("Add transcript text before exporting."); return; }
  const form = new FormData(); form.append("transcript", text);
  const response = await fetch(`/export/${format}`, { method: "POST", body: form });
  if (!response.ok) { setStatus((await response.json()).detail || "Export failed."); return; }
  const blob = await response.blob();
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `sonotype-transcript.${format}` });
  document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
}
document.querySelector("#docx-button").addEventListener("click", () => exportTranscript("docx"));
document.querySelector("#pdf-button").addEventListener("click", () => exportTranscript("pdf"));
