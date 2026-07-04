/* =========================================
   MIKI UNIVERSE — HD Image Page
   - Rate limit: 5x/hari per akun
   - Loading progress bar 0-100%
   - Before/After slider hasil
   ========================================= */

(function () {
  const WORKER_URL = "https://miki-hd-proxy.mine14788.workers.dev";
  const DAILY_LIMIT = 5;

  let selectedFile = null;
  let selectedDataURL = null;
  let isProcessing = false;
  let progressInterval = null;

  function $(id) { return document.getElementById(id); }

  /* --- gate: cek login --- */
  function refreshGate() {
    const user = window.__mikiAuthState?.currentUser;
    const gate = $("hdLoginGate");
    const main = $("hdMain");
    if (!gate || !main) return;
    if (user) { gate.style.display = "none"; main.style.display = "block"; }
    else { gate.style.display = "flex"; main.style.display = "none"; }
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
    };
    reader.readAsDataURL(file);
  }

  /* --- progress bar --- */
  function startProgress(phase1Label, phase2Label) {
    const loading = $("hdLoading");
    const bar = $("hdProgressBar");
    const label = $("hdLoadingLabel");
    const pct = $("hdLoadingPct");
    if (!loading) return;

    loading.style.display = "block";
    let current = 0;
    let target = 45;
    let currentPhase = 1;

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
      phase2() {
        target = 92;
        currentPhase = 2;
      },
      done() {
        clearInterval(progressInterval);
        current = 100; target = 100;
        bar.style.width = "100%";
        pct.textContent = "100%";
        label.textContent = "Selesai!";
        setTimeout(() => { if (loading) loading.style.display = "none"; }, 700);
      },
      error() {
        clearInterval(progressInterval);
        if (loading) loading.style.display = "none";
      }
    };
  }

  function setServerBtnsDisabled(val) {
    document.querySelectorAll(".hdpage-server-btn").forEach(b => b.disabled = val);
  }

  /* --- init slider --- */
  function initSlider(beforeSrc, afterSrc) {
    const beforeImg = $("hdBeforeImg");
    const afterImg = $("hdAfterImg");
    const afterWrap = $("hdAfterWrap");
    const handle = $("hdSliderHandle");
    const divider = $("hdSliderDivider");
    const range = $("hdSliderRange");
    if (!beforeImg || !afterImg || !range) return;

    beforeImg.src = beforeSrc;
    afterImg.src = afterSrc;
    range.value = 50;

    let pending = false;
    function applySlider() {
      pending = false;
      const v = range.value;
      afterWrap.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
      handle.style.left = v + "%";
      divider.style.left = v + "%";
    }
    range.addEventListener("input", () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(applySlider);
    });
    applySlider();
  }

  /* --- main: upload + hit server --- */
  async function runHdUpscale(serverNum) {
    if (isProcessing) return;
    if (!selectedFile) { $("hdError").textContent = "Pilih foto dulu."; return; }
    if (!window.__mikiAuthState?.currentUser) { refreshGate(); return; }

    if (!WORKER_URL) {
  $("hdError").textContent = "Worker belum dipasang. Hubungi admin.";
  return;
}

    // Cek rate limit
    const check = await window.hdCheckUsage?.();
    if (check && !check.ok) {
      $("hdError").textContent = check.reason;
      return;
    }
    const usedCount = check?.used ?? 0;

    isProcessing = true;
    setServerBtnsDisabled(true);
    $("hdError").textContent = "";
    $("hdResult").style.display = "none";

    const progress = startProgress(
      `Mengupload foto... (Sisa hari ini: ${DAILY_LIMIT - usedCount - 1}x)`,
      `Server ${serverNum} memproses HD...`
    );

    try {
      // Step 1 progress naik ke 45%
      const form = new FormData();
      form.append("server", String(serverNum));
      form.append("image", selectedFile, selectedFile.name || "image.jpg");
      form.append("filename", selectedFile.name || "image.jpg");

      // Pindah ke phase 2 setelah 2 detik (simulasi upload selesai)
      setTimeout(() => progress.phase2(), 2000);

      const res = await fetch(WORKER_URL, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120000)
      });
      const data = await res.json();

      if (!data?.ok || !data?.result) {
        throw new Error(data?.error || `Server ${serverNum} gagal. Coba server lain.`);
      }

      progress.done();

      // Increment usage
      await window.hdIncrementUsage?.();

      // Tampilkan slider before/after
      const resultBox = $("hdResult");
      const downloadBtn = $("hdDownloadBtn");
      if (downloadBtn) downloadBtn.href = data.result;
      if (resultBox) resultBox.style.display = "flex";

      // Init slider setelah gambar after ke-load
      const afterImg = $("hdAfterImg");
      if (afterImg) {
        afterImg.onload = () => initSlider(selectedDataURL, data.result);
        afterImg.onerror = () => {
          // Fallback kalau gambar nggak bisa di-load di img tag (CORS), tampilkan link aja
          afterImg.src = "";
          $("hdBeforeImg").src = selectedDataURL;
        };
      }
      initSlider(selectedDataURL, data.result);

      // Update sisa pemakaian
      const newUsed = usedCount + 1;
      const remaining = DAILY_LIMIT - newUsed;
      $("hdError").style.color = remaining <= 1 ? "#f59e0b" : "#22c55e";
      $("hdError").textContent = `Berhasil! Sisa pemakaian hari ini: ${remaining}x`;
      setTimeout(() => {
        $("hdError").textContent = "";
        $("hdError").style.color = "";
      }, 4000);

    } catch (err) {
      progress.error();
      const msg = err.name === "TimeoutError"
        ? `Server ${serverNum} timeout. Coba server lain.`
        : (err.message || `Error. Coba server lain.`);
      $("hdError").textContent = msg;
      $("hdError").style.color = "";
    } finally {
      isProcessing = false;
      setServerBtnsDisabled(false);
    }
  }

  function hdReset() {
    selectedFile = null;
    selectedDataURL = null;
    if (progressInterval) clearInterval(progressInterval);
    $("hdPreviewImg").src = "";
    $("hdPreviewImg").style.display = "none";
    $("hdUploadHint").style.display = "flex";
    $("hdServers").style.display = "none";
    $("hdResult").style.display = "none";
    $("hdLoading").style.display = "none";
    $("hdError").textContent = "";
    $("hdError").style.color = "";
    $("hdFileInput").value = "";
  }

  /* --- init --- */
  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = $("hdFileInput");
    if (fileInput) fileInput.addEventListener("change", onFileSelected);
    window.__mikiOnAuthChange = refreshGate;
    refreshGate();
    const check = setInterval(() => {
      if (window.__mikiAuthState !== undefined) { refreshGate(); clearInterval(check); }
    }, 200);
  });

  Object.assign(window, { runHdUpscale, hdReset });
})();
