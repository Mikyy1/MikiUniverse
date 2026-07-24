const WORKER_URL = "https://miki-hd-proxy.mine14788.workers.dev";

let selectedFile = null;
let selectedMode = "uhd";

// DOM elements
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const previewImage = document.getElementById("previewImage");
const generateBtn = document.getElementById("generateBtn");
const loading = document.getElementById("loading");
const result = document.getElementById("result");
const resultImage = document.getElementById("resultImage");
const downloadBtn = document.getElementById("downloadBtn");
const error = document.getElementById("error");

// Mode selector
document.querySelectorAll(".hd-mode-option").forEach(option => {
  option.addEventListener("click", () => {
    document.querySelectorAll(".hd-mode-option").forEach(o => o.classList.remove("selected"));
    option.classList.add("selected");
    option.querySelector("input").checked = true;
    selectedMode = option.dataset.mode;
  });
});

// Upload area
uploadArea.addEventListener("click", () => fileInput.click());

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    handleFile(file);
  }
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showError("File terlalu besar! Max 10MB.");
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    preview.classList.add("active");
    generateBtn.disabled = false;
    hideError();
  };
  reader.readAsDataURL(file);
}

generateBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  try {
    generateBtn.disabled = true;
    preview.classList.remove("active");
    result.classList.remove("active");
    loading.classList.add("active");
    hideError();

    const resultBlob = await runHdUpscale();
    const resultUrl = URL.createObjectURL(resultBlob);
    
    resultImage.src = resultUrl;
    downloadBtn.href = resultUrl;
    downloadBtn.download = `hd-${selectedMode}-${Date.now()}.jpg`;
    
    loading.classList.remove("active");
    result.classList.add("active");
    generateBtn.disabled = false;
  } catch (err) {
    loading.classList.remove("active");
    preview.classList.add("active");
    showError(err.message || "Gagal memproses gambar. Coba lagi.");
    generateBtn.disabled = false;
  }
});

async function runHdUpscale() {
  // Step 1: Get captcha challenge
  const challengeRes = await fetch(`${WORKER_URL}?action=captcha-challenge`);
  if (!challengeRes.ok) throw new Error("Gagal mengambil captcha");
  const captchaChallenge = await challengeRes.json();

  // Step 2: Solve captcha (proof-of-work)
  const captchaSolution = await solveCaptcha(captchaChallenge);

  // Step 3: Upload and process
  const form = new FormData();
  form.append("image", selectedFile, selectedFile.name || "image.jpg");
  form.append("filename", selectedFile.name || "image.jpg");
  form.append("mode", selectedMode);
  form.append("captchaSalt", captchaChallenge.salt);
  form.append("captchaTimestamp", String(captchaChallenge.timestamp));
  form.append("captchaSignature", captchaChallenge.signature);
  form.append("captchaNonce", String(captchaSolution));

  const processRes = await fetch(WORKER_URL, {
    method: "POST",
    body: form
  });

  if (!processRes.ok) {
    const errData = await processRes.json().catch(() => ({}));
    throw new Error(errData.error || `Server error: ${processRes.status}`);
  }

  const contentType = processRes.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const errData = await processRes.json();
    throw new Error(errData.error || "Gagal memproses gambar");
  }

  return await processRes.blob();
}

async function solveCaptcha(challenge) {
  const { salt, difficulty } = challenge;
  const prefix = "0".repeat(difficulty);
  
  for (let nonce = 0; nonce < 10000000; nonce++) {
    const hash = await sha256Hex(`${salt}:${nonce}`);
    if (hash.startsWith(prefix)) {
      return nonce;
    }
  }
  
  throw new Error("Gagal menyelesaikan captcha");
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function showError(msg) {
  error.textContent = msg;
  error.classList.add("active");
}

function hideError() {
  error.classList.remove("active");
}
