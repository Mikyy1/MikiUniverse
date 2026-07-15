/* =========================================
   MIKI UNIVERSE — HD Image Page
   + Captcha custom (proof-of-work, gak pake layanan pihak ketiga)
   + Cek maintenance flag dari admin panel
   + Error yang ditampilin ke user digenericin (gak bocorin detail server)
   ========================================= */

(function () {
  const WORKER_URL = "https://miki-hd-proxy.mine14788.workers.dev";
  const DAILY_LIMIT = 5;

  let selectedFile = null;
  let selectedDataURL = null;
  let isProcessing = false;
  let progressInterval = null;
  let sliderInited = false;
  let featureEnabled = true; // default nyala, dicek ulang ke Firestore pas init

  let captchaChallenge = null;   // { salt, timestamp, difficulty, signature }
  let captchaSolution = null;    // nonce hasil hitungan
  let captchaBusy = false;

  function $(id) { return document.getElementById(id); }

  /* --- util hash, sama persis kayak yang dipake worker biar hasilnya nyambung --- */
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function setCaptchaVisual(state) {
    // state: "idle" | "verifying" | "verified" | "error"
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
    if (captchaBusy || captchaSolution) return; // udah verified atau lagi proses, gak usah diulang
    captchaBusy = true;
    setCaptchaVisual("verifying");
    try {
      const res = await fetch(`${WORKER_URL}?action=captcha-challenge`, { signal: AbortSignal.timeout(15000) });
      const challenge = await res.json();
      if (!res.ok || !challenge?.salt) throw new Error("Gagal ambil soal captcha");
      captchaChallenge = challenge;

      // Cari nonce lewat brute-force ringan (proof-of-work).
      // Di-yield tiap 500 percobaan biar UI/browser gak nge-freeze.
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

  /* --- gate: cek login (wajib Google) + cek maintenance flag --- */
  async function refreshGate() {
    const user = window.__mikiAuthState?.currentUser;
    const profile = window.__mikiAuthState?.currentProfile;
    const gate = $("hdLoginGate");
    const maintGate = $("hdMaintenanceGate");
    const main = $("hdMain");
    if (!gate || !main || !maintGate) return;

    // Cek maintenance flag dulu (berlaku buat semua orang termasuk admin,
    // biar admin juga bisa mastiin tampilan yang dilihat user awam)
    featureEnabled = await window.hdCheckFeatureEnabled?.() ?? true;
    if (!featureEnabled) {
      gate.style.display = "none";
      main.style.display = "none";
      maintGate.style.display = "flex";
      return;
    }
    maintGate.style.display = "none";

    // Hanya izinkan user Google (bukan anonymous/guest)
    const isGoogle = user && !user.isAnonymous && profile?.provider === "google";
    if (isGoogle) {
      gate.style.display = "none";
      main.style.display = "block";
    } else {
      gate.style.display = "flex";
      main.style.display = "none";
    }
  }

  /* --- file pilih --- */
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

  /* --- progress bar --- */
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

  /* --- slider (dipanggil SEKALI setelah kedua gambar siap) --- */
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

  /* --- pesan error generic buat user, detail asli cuma dikonsol dev (bukan production) --- */
  function genericErrorMessage() {
    return "Gagal memproses gambar. Coba lagi beberapa saat.";
  }

  /* --- main --- */
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

    const progress = startProgress(
      `Mengupload foto... (Sisa hari ini: ${DAILY_LIMIT - usedCount - 1}x)`,
      `Memproses HD...`
    );

    try {
      const form = new FormData();
      form.append("image", selectedFile, selectedFile.name || "image.jpg");
      form.append("filename", selectedFile.name || "image.jpg");
      form.append("captchaSalt", captchaChallenge.salt);
      form.append("captchaTimestamp", String(captchaChallenge.timestamp));
      form.append("captchaSignature", captchaChallenge.signature);
      form.append("captchaNonce", String(captchaSolution));
      setTimeout(() => progress.phase2(), 2000);

      const res = await fetch(WORKER_URL, {
        method: "POST", body: form,
        signal: AbortSignal.timeout(120000)
      });

      const contentType = res.headers.get("content-type") || "";
      let resultUrl;
      if (res.ok && contentType.startsWith("image/")) {
        // Sukses: worker balikin bytes gambar langsung
        const blob = await res.blob();
        resultUrl = URL.createObjectURL(blob);
      } else {
        // Gagal — apapun detail errornya di server, ke user cuma pesan generic.
        // Detail asli (nama API, status code, dll) sengaja gak diteruskan ke sini.
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
      $("hdError").textContent = `Berhasil! Sisa pemakaian hari ini: ${remaining}x`;
      setTimeout(() => { $("hdError").textContent = ""; $("hdError").style.color = ""; }, 4000);

    } catch (err) {
      progress.error();
      $("hdError").textContent = err.name === "TimeoutError" ? "Timeout. Coba lagi." : genericErrorMessage();
      $("hdError").style.color = "";
    } finally {
      isProcessing = false;
      resetCaptcha(); // captcha sekali pakai, wajib solve ulang tiap generate
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

  /* --- init --- */
  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = $("hdFileInput");
    if (fileInput) fileInput.addEventListener("change", onFileSelected);

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
