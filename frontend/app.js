const sourceName = document.querySelector("#source-name");
const fileInput = document.querySelector("#file-input");
const recordButton = document.querySelector("#record-button");
const transcribeButton = document.querySelector("#transcribe-button");
const diarizeInput = document.querySelector("#diarize-input");
const transcript = document.querySelector("#transcript");
const progressPanel = document.querySelector("#progress-panel");
const progressBar = document.querySelector("#progress-bar");
const progressPercent = document.querySelector("#progress-percent");
const progressMessage = document.querySelector("#progress-message");
const confidence = document.querySelector("#confidence");
const status = document.querySelector("#status");
const recordingTime = document.querySelector("#recording-time");
let selectedFile = null;
let recorder = null;
let recordingChunks = [];
let timer = null;
let startedAt = 0;
let transcriptionDetails = { confidence: "", duration: "" };

function displayFile(file) {
  selectedFile = file;
  sourceName.textContent = `${file.name} (${Math.max(1, file.size / 1048576).toFixed(1)} MB)`;
  transcribeButton.disabled = false;
  status.textContent = "";
}

function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

fileInput.addEventListener("change", () => { if (fileInput.files[0]) displayFile(fileInput.files[0]); });

recordButton.addEventListener("click", async () => {
  if (recorder?.state === "recording") {
    recorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = event => event.data.size && recordingChunks.push(event.data);
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      clearInterval(timer);
      recordButton.textContent = "Start recording";
      recordButton.classList.remove("active");
      const recording = new Blob(recordingChunks, { type: mimeType });
      displayFile(new File([recording], "browser-recording.webm", { type: mimeType }));
    };
    recorder.start(250);
    startedAt = Date.now();
    timer = setInterval(() => recordingTime.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    recordButton.textContent = "Stop recording";
    recordButton.classList.add("active");
  } catch {
    status.textContent = "Microphone access was not granted.";
  }
});

function setProgress(percent, message = "Transcribing locally…") {
  progressPanel.classList.remove("hidden");
  progressMessage.textContent = message;
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
      if (data.type === "progress") setProgress(data.percent);
      if (data.type === "error") throw new Error(data.message);
      if (data.type === "done") return data;
    }
  }
  throw new Error("The local service ended before returning a transcript.");
}

transcribeButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  transcribeButton.disabled = true;
  setProgress(0);
  status.textContent = "";
  confidence.classList.add("hidden");
  const form = new FormData();
  form.append("audio", selectedFile, selectedFile.name);
  form.append("diarize", diarizeInput.checked);
  try {
    const response = await fetch("/transcribe", { method: "POST", body: form });
    if (!response.ok) throw new Error((await response.json()).detail || "Transcription could not start.");
    const result = await consumeEvents(response);
    transcript.textContent = result.text;
    transcriptionDetails = { confidence: result.confidence, duration: result.duration ? formatTime(Math.round(result.duration)) : "" };
    confidence.textContent = `Estimated confidence: ${result.confidence}%`;
    confidence.classList.remove("hidden");
    setProgress(100, "Complete");
    status.textContent = "Transcript ready for review.";
  } catch (error) {
    progressPanel.classList.add("hidden");
    status.textContent = error.message;
  } finally {
    transcribeButton.disabled = false;
  }
});

document.querySelector("#copy-button").addEventListener("click", async () => {
  await navigator.clipboard.writeText(transcript.innerText.trim());
  status.textContent = "Transcript copied.";
});

async function exportTranscript(format) {
  const text = transcript.innerText.trim();
  if (!text) { status.textContent = "Add transcript text before exporting."; return; }
  const form = new FormData();
  form.append("transcript", text);
  form.append("source_name", selectedFile?.name || "transcript");
  form.append("confidence", transcriptionDetails.confidence);
  form.append("duration", transcriptionDetails.duration);
  const response = await fetch(`/export/${format}`, { method: "POST", body: form });
  if (!response.ok) { status.textContent = (await response.json()).detail; return; }
  const blob = await response.blob();
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `local-transcript.${format}` });
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelector("#docx-button").addEventListener("click", () => exportTranscript("docx"));
document.querySelector("#pdf-button").addEventListener("click", () => exportTranscript("pdf"));
