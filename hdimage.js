/* =========================================
   MIKI UNIVERSE — HD Image Page
   Fixed: before/after direction, slider double-init, guest gate
   ========================================= */

(function () {
  const WORKER_URL = "https://miki-hd-proxy.mine14788.workers.dev";
  const DAILY_LIMIT = 5;

  let selectedFile = null;
  let selectedDataURL = null;
  let isProcessing = false;
  let progressInterval = null;
  let sliderInited = false;

  function $(id) { return document.getElementById(id); }

  /* --- gate: cek login (wajib Google, bukan tamu) --- */
  function refreshGate() {
    const user = window.__mikiAuthState?.currentUser;
    const profile = window.__mikiAuthState?.currentProfile;
    const gate = $("hdLoginGate");
    const main = $("hdMain");
    if (!gate || !main) return;
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

  function setServerBtnsDisabled(val) {
    document.querySelectorAll(".hdpage-server-btn").forEach(b => b.disabled = val);
  }

  /* --- slider (dipanggil SEKALI setelah kedua gambar siap) ---
     FIX 1: clip-path inset dari KIRI biar before=kiri, after=kanan (standar)
     FIX 2: satu initSlider call doang, pakai flag sliderInited
  */
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

    // Tunggu afterImg loaded baru init, biar container punya tinggi
    function doInit() {
      sliderInited = true;
      range.value = 50;

      // Remove existing listener dulu (bersih)
      const newRange = range.cloneNode(true);
      range.parentNode.replaceChild(newRange, range);

      function applySlider() {
        const v = newRange.value;
        // FIX: inset dari kiri → before kiri, after kanan
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
      afterImg.onerror = doInit; // init anyway even on error
      afterImg.src = afterSrc;
    }
  }

  /* --- main --- */
  async function runHdUpscale(serverNum) {
    if (isProcessing) return;
    if (!selectedFile) { $("hdError").textContent = "Pilih foto dulu."; return; }
    if (!window.__mikiAuthState?.currentUser) { refreshGate(); return; }

    if (!WORKER_URL) {
  $("hdError").textContent = "Worker belum dipasang. Hubungi admin.";
  return;
}

    const check = await window.hdCheckUsage?.();
    if (check && !check.ok) { $("hdError").textContent = check.reason; return; }
    const usedCount = check?.used ?? 0;

    isProcessing = true;
    sliderInited = false;
    setServerBtnsDisabled(true);
    $("hdError").textContent = "";
    $("hdResult").style.display = "none";

    const progress = startProgress(
      `Mengupload foto... (Sisa hari ini: ${DAILY_LIMIT - usedCount - 1}x)`,
      `Server ${serverNum} memproses HD...`
    );

    try {
      const form = new FormData();
      form.append("server", String(serverNum));
      form.append("image", selectedFile, selectedFile.name || "image.jpg");
      form.append("filename", selectedFile.name || "image.jpg");
      setTimeout(() => progress.phase2(), 2000);

      const res = await fetch(WORKER_URL, {
        method: "POST", body: form,
        signal: AbortSignal.timeout(120000)
      });
      const data = await res.json();
      if (!data?.ok || !data?.result) throw new Error(data?.error || `Server ${serverNum} gagal. Coba server lain.`);

      progress.done();
      await window.hdIncrementUsage?.();

      const downloadBtn = $("hdDownloadBtn");
      const resultBox = $("hdResult");
      if (downloadBtn) downloadBtn.href = data.result;
      if (resultBox) resultBox.style.display = "flex";

      // FIX 2: SATU panggilan initSlider aja
      initSlider(selectedDataURL, data.result);

      const remaining = DAILY_LIMIT - usedCount - 1;
      $("hdError").style.color = remaining <= 1 ? "#f59e0b" : "#22c55e";
      $("hdError").textContent = `Berhasil! Sisa pemakaian hari ini: ${remaining}x`;
      setTimeout(() => { $("hdError").textContent = ""; $("hdError").style.color = ""; }, 4000);

    } catch (err) {
      progress.error();
      $("hdError").textContent = err.name === "TimeoutError"
        ? `Server ${serverNum} timeout. Coba server lain.`
        : (err.message || `Error. Coba server lain.`);
      $("hdError").style.color = "";
    } finally {
      isProcessing = false;
      setServerBtnsDisabled(false);
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
  }

  /* --- init --- */
  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = $("hdFileInput");
    if (fileInput) fileInput.addEventListener("change", onFileSelected);

    // FIX 3: refreshGate dipanggil langsung + dari auth callback
    window.__mikiOnAuthChange = refreshGate;
    refreshGate();

    // Polling buat kasus auth.js module load duluan
    const check = setInterval(() => {
      if (window.__mikiAuthState !== undefined) {
        refreshGate();
        clearInterval(check);
      }
    }, 150);
  });

  Object.assign(window, { runHdUpscale, hdReset });
})();
