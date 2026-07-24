/* =========================================
   MIKI UNIVERSE — HD Image Page (dengan Mode HD/UHD)
   ========================================= */

(function () {
  // GANTI URL INI DENGAN URL WORKER KAMU!
  const WORKER_URL = "https://miki-hd-proxy.mine14788.workers.dev";
  const DAILY_LIMIT = 5;

  let selectedFile = null;
  let selectedDataURL = null;
  let isProcessing = false;
  let progressInterval = null;
  let sliderInited = false;
  let featureEnabled = true;

  let captchaChallenge = null;
  let captchaSolution = null;
  let captchaBusy = false;

  function $(id) { return document.getElementById(id); }

  /* --- Hash --- */
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /* --- Captcha UI --- */
  function setCaptchaVisual(state) {
    const box = $("hdCaptchaBox");
    const label = $("hdCaptchaLabel");
    if (!box || !label) return;
    box.classList.remove("is-verifying", "is-verified", "is-error");
    if (state === "verifying") { box.classList.add("is-verifying"); label.textContent = "Memverifikasi..."; }
    else if (state === "verified") { box.classList.add("is-verified"); label.textContent = "Berhasil!"; }
    else if (state === "error") { box.classList.add("is-error"); label.textContent = "Gagal, klik buat coba lagi"; }
    else { label.textContent = "Klik buat verifikasi"; }
  }

  function resetCaptcha() {
    captchaChallenge = null;
    captchaSolution = null;
    captchaBusy = false;
    setCaptchaVisual("idle");
    updateGenerateBtnState();
  }

  async function startHdCaptcha() {
    if (captchaBusy || captchaSolution) return;
    captchaBusy = true;
    setCaptchaVisual("verifying");
    try {
      const res = await fetch(`${WORKER_URL}?action=captcha-challenge`, { signal: AbortSignal.timeout(15000) });
      const challenge = await res.json();
      if (!res.ok || !challenge?.salt) throw new Error(challenge?.error || `Gagal ambil soal captcha (HTTP ${res.status})`);
      captchaChallenge = challenge;

      const prefix = "0".repeat(challenge.difficulty || 4);
      let nonce = 0;
      while (true) {
        const hash = await sha256Hex(`${challenge.salt}:${nonce}`);
        if (hash.startsWith(prefix)) break;
        nonce++;
        if (nonce % 500 === 0) await new Promise(r => setTimeout(r, 0));
        if (nonce > 2_000_000) throw new Error("Captcha kelamaan, coba lagi");
      }
      captchaSolution = nonce;
      setCaptchaVisual("verified");
    } catch (e) {
      console.error("HD captcha gagal:", e.message || e);
      captchaChallenge = null;
      captchaSolution = null;
      setCaptchaVisual("error");
    } finally {
      captchaBusy = false;
      updateGenerateBtnState();
    }
  }

  function updateGenerateBtnState() {
    const btn = $("hdGenerateBtn");
    if (!btn) return;
    btn.disabled = isProcessing || !captchaSolution;
  }

  /* --- Gate Login --- */
  async function refreshGate() {
    const user = window.__mikiAuthState?.currentUser;
    const profile = window.__mikiAuthState?.currentProfile;
    const gate = $("hdLoginGate");
    const maintGate = $("hdMaintenanceGate");
    const main = $("hdMain");
    if (!gate || !main || !maintGate) return;

    featureEnabled = await window.hdCheckFeatureEnabled?.() ?? true;
    if (!featureEnabled) {
      gate.style.display = "none";
      main.style.display = "none";
      maintGate.style.display = "flex";
      return;
    }
    maintGate.style.display = "none";

    const isGoogle = user && !user.isAnonymous && profile?.provider === "google";
    if (isGoogle) {
      gate.style.display = "none";
      main.style.display = "block";
    } else {
      gate.style.display = "flex";
      main.style.display = "none";
    }
  }

  /* --- File Pilih --- */
  function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      selectedDataURL = reader.result;
      $("hdPreviewImg").src = reader.result;
      $("hdPreviewImg").style.display = "block";
      $("hdUploadHint").style.display = "none";
      $("hdServers").style.display = "block";
      $("hdResult").style.display = "none";
      $("hdError").textContent = "";
      sliderInited = false;
      resetCaptcha();
    };
    reader.readAsDataURL(file);
  }

  /* --- Progress --- */
  function startProgress(phase1Label, phase2Label) {
    const loading = $("hdLoading");
    const bar = $("hdProgressBar");
    const label = $("hdLoadingLabel");
    const pct = $("hdLoadingPct");
    if (!loading) return { phase2(){}, done(){}, error(){} };

    loading.style.display = "block";
    let current = 0, target = 45, currentPhase = 1;
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (current < target) {
        current += (target - current) * 0.06 + 0.3;
        if (current > target) current = target;
      }
      const rounded = Math.min(99, Math.round(current));
      bar.style.width = rounded + "%";
      pct.textContent = rounded + "%";
      label.textContent = currentPhase === 1 ? phase1Label : phase2Label;
    }, 80);

    return {
      phase2() { target = 92; currentPhase = 2; },
      done() {
        clearInterval(progressInterval);
        bar.style.width = "100%"; pct.textContent = "100%"; label.textContent = "Selesai!";
        setTimeout(() => { if (loading) loading.style.display = "none"; }, 700);
      },
      error() { clearInterval(progressInterval); if (loading) loading.style.display = "none"; }
    };
  }

  /* --- Slider --- */
  function initSlider(beforeSrc, afterSrc) {
    if (sliderInited) return;
    const beforeImg = $("hdBeforeImg");
    const afterImg = $("hdAfterImg");
    const afterWrap = $("hdAfterWrap");
    const handle = $("hdSliderHandle");
    const divider = $("hdSliderDivider");
    const range = $("hdSliderRange");
    if (!beforeImg || !afterImg || !range) return;

    beforeImg.src = beforeSrc;

    function doInit() {
      sliderInited = true;
      range.value = 50;

      const newRange = range.cloneNode(true);
      range.parentNode.replaceChild(newRange, range);

      function applySlider() {
        const v = newRange.value;
        afterWrap.style.clipPath = `inset(0 0 0 ${v}%)`;
        handle.style.left = v + "%";
        if (divider) divider.style.left = v + "%";
      }

      let pending = false;
      newRange.addEventListener("input", () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; applySlider(); });
      });
      applySlider();
    }

    if (afterImg.src === afterSrc && afterImg.complete) {
      doInit();
    } else {
      afterImg.onload = doInit;
      afterImg.onerror = doInit;
      afterImg.src = afterSrc;
    }
  }

  function genericErrorMessage() {
    return "Gagal memproses gambar. Coba lagi beberapa saat.";
  }

  /* --- MAIN: Run Upscale --- */
  async function runHdUpscale() {
    if (isProcessing) return;
    if (!featureEnabled) { await refreshGate(); return; }
    if (!selectedFile) { $("hdError").textContent = "Pilih foto dulu."; return; }
    if (!window.__mikiAuthState?.currentUser) { refreshGate(); return; }
    if (!captchaSolution || !captchaChallenge) { $("hdError").textContent = "Selesaikan verifikasi captcha dulu."; return; }

    if (!WORKER_URL) {
      $("hdError").textContent = "Worker belum dipasang. Hubungi admin.";
      return;
    }

    const check = await window.hdCheckUsage?.();
    if (check && !check.ok) { $("hdError").textContent = check.reason; return; }
    const usedCount = check?.used ?? 0;

    isProcessing = true;
    sliderInited = false;
    updateGenerateBtnState();
    $("hdError").textContent = "";
    $("hdResult").style.display = "none";

    // Ambil mode yang dipilih user
    const modeSelect = document.getElementById("hdModeSelect");
    const selectedMode = modeSelect ? modeSelect.value : "uhd";

    const progress = startProgress(
      `Mengupload foto... (Mode: ${selectedMode.toUpperCase()})`,
      `Memproses ${selectedMode.toUpperCase()}... (30-120s)`
    );

    try {
      const form = new FormData();
      form.append("image", selectedFile, selectedFile.name || "image.jpg");
      form.append("filename", selectedFile.name || "image.jpg");
      form.append("mode", selectedMode); // <-- KIRIM MODE KE WORKER
      form.append("captchaSalt", captchaChallenge.salt);
      form.append("captchaTimestamp", String(captchaChallenge.timestamp));
      form.append("captchaSignature", captchaChallenge.signature);
      form.append("captchaNonce", String(captchaSolution));
      
      setTimeout(() => progress.phase2(), 2000);

      const res = await fetch(WORKER_URL, {
        method: "POST", body: form,
        signal: AbortSignal.timeout(180000) // 3 menit untuk UHD
      });

      const contentType = res.headers.get("content-type") || "";
      let resultUrl;
      if (res.ok && contentType.startsWith("image/")) {
        const blob = await res.blob();
        resultUrl = URL.createObjectURL(blob);
      } else {
        let detail = `HTTP ${res.status}`;
        try { detail += " — " + JSON.stringify(await res.json()); } catch (_) {}
        console.error("HD upscale gagal:", detail);
        throw new Error(genericErrorMessage());
      }

      progress.done();
      await window.hdIncrementUsage?.();

      const downloadBtn = $("hdDownloadBtn");
      const resultBox = $("hdResult");
      if (downloadBtn) {
        downloadBtn.href = resultUrl;
        downloadBtn.download = "hd-" + (selectedFile.name || "image.jpg");
      }
      if (resultBox) resultBox.style.display = "flex";

      initSlider(selectedDataURL, resultUrl);

      const remaining = DAILY_LIMIT - usedCount - 1;
      $("hdError").style.color = remaining <= 1 ? "#f59e0b" : "#22c55e";
      $("hdError").textContent = `✅ Berhasil! Sisa hari ini: ${remaining}x | Mode: ${selectedMode.toUpperCase()}`;
      setTimeout(() => { $("hdError").textContent = ""; $("hdError").style.color = ""; }, 5000);

    } catch (err) {
      console.error("HD upscale exception:", err);
      $("hdError").textContent = err.name === "TimeoutError" ? "⏱️ Timeout. Coba lagi." : genericErrorMessage();
      $("hdError").style.color = "";
    } finally {
      isProcessing = false;
      resetCaptcha();
    }
  }

  function hdReset() {
    selectedFile = null; selectedDataURL = null; sliderInited = false;
    if (progressInterval) clearInterval(progressInterval);
    const p = $("hdPreviewImg"); if (p) { p.src = ""; p.style.display = "none"; }
    const h = $("hdUploadHint"); if (h) h.style.display = "flex";
    const s = $("hdServers"); if (s) s.style.display = "none";
    const r = $("hdResult"); if (r) r.style.display = "none";
    const l = $("hdLoading"); if (l) l.style.display = "none";
    const e = $("hdError"); if (e) { e.textContent = ""; e.style.color = ""; }
    const f = $("hdFileInput"); if (f) f.value = "";
    resetCaptcha();
  }

  /* --- INIT --- */
  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = $("hdFileInput");
    if (fileInput) fileInput.addEventListener("change", onFileSelected);

    // === INJECT DROPDOWN MODE ===
    const serversDiv = $("hdServers");
    const generateBtn = $("hdGenerateBtn");
    if (serversDiv && generateBtn) {
      // Cek apakah dropdown sudah ada, kalau belum buat
      if (!document.getElementById("hdModeSelect")) {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display:flex; flex-direction:column; gap:8px; width:100%; margin-bottom:12px;";
        
        const label = document.createElement("label");
        label.htmlFor = "hdModeSelect";
        label.textContent = "Pilih Kualitas:";
        label.style.cssText = "font-size:0.9rem; opacity:0.8; font-weight:500;";
        
        const select = document.createElement("select");
        select.id = "hdModeSelect";
        select.style.cssText = `
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          font-size: 1rem;
          font-weight: 500;
          outline: none;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 18px;
          padding-right: 40px;
        `;
        
        const optHd = document.createElement("option");
        optHd.value = "hd";
        optHd.textContent = "✨ HD (2K) — Lebih Cepat";
        
        const optUhd = document.createElement("option");
        optUhd.value = "uhd";
        optUhd.textContent = "🔥 Ultra HD (4K+) — Kualitas Maksimal";
        optUhd.selected = true;
        
        select.appendChild(optHd);
        select.appendChild(optUhd);
        
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        
        // Sisipkan sebelum tombol Generate
        serversDiv.insertBefore(wrapper, generateBtn);
      }
    }

    window.__mikiOnAuthChange = refreshGate;
    refreshGate();

    const check = setInterval(() => {
      if (window.__mikiAuthState !== undefined) {
        refreshGate();
        clearInterval(check);
      }
    }, 150);
  });

  Object.assign(window, { runHdUpscale, hdReset, startHdCaptcha });
})();