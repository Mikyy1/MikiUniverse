/* =========================================
   MIKI UNIVERSE — TikTok Downloader
   3 mode: No Watermark biasa, No Watermark HD (gated iklan+timer),
   dan Audio/MP3.
   ========================================= */

(function () {
  const WORKER_URL = "https://miki-tiktok-proxy.mine14788.workers.dev";
  const AD_WAIT_SECONDS = 30; // durasi wajib tunggu sebelum download HD kebuka

  let isProcessing = false;
  let currentInfo = null; // { title, cover, author, normal, hd, audio }
  let adTimerInterval = null;
  let adUnlocked = false;

  function $(id) { return document.getElementById(id); }

  /* --- proses link --- */
  async function runTiktokProcess() {
    if (isProcessing) return;
    const rawUrl = $("ttUrlInput").value.trim();
    const errorEl = $("ttError");
    const resultEl = $("ttResult");
    errorEl.textContent = "";
    resultEl.style.display = "none";
    currentInfo = null;

    if (!rawUrl) { errorEl.textContent = "Tempel link TikTok dulu ya."; return; }
    if (!/tiktok\.com/i.test(rawUrl)) { errorEl.textContent = "Ini bukan link TikTok yang valid."; return; }

    isProcessing = true;
    $("ttProsesBtn").disabled = true;
    $("ttLoading").style.display = "flex";

    try {
      const res = await fetch(`${WORKER_URL}?action=info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl }),
        signal: AbortSignal.timeout(40000)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Gagal proses link ini.");

      currentInfo = data;
      $("ttTitle").textContent = data.title || "TikTok Video";
      $("ttAuthor").textContent = data.author ? "@" + data.author : "";
      if (data.cover) { $("ttCover").src = data.cover; $("ttCover").style.display = "block"; }
      else { $("ttCover").style.display = "none"; }

      resultEl.style.display = "block";
    } catch (err) {
      errorEl.textContent = err.name === "TimeoutError" ? "Timeout, coba lagi." : (err.message || "Gagal proses link ini.");
    } finally {
      isProcessing = false;
      $("ttProsesBtn").disabled = false;
      $("ttLoading").style.display = "none";
    }
  }

  /* --- trigger download beneran, lewat worker (proxy stream) --- */
  function triggerDownload(upstreamUrl, type) {
    if (!upstreamUrl) {
      $("ttError").textContent = "Link file gak tersedia buat opsi ini.";
      return;
    }
    const proxyUrl = `${WORKER_URL}?action=download&type=${type}&target=${encodeURIComponent(upstreamUrl)}`;
    const a = document.createElement("a");
    a.href = proxyUrl;
    a.download = `tiktok-${type}.${type === "audio" ? "mp3" : "mp4"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* --- download langsung (No Watermark biasa & Audio) --- */
  function downloadTiktok(kind) {
    if (!currentInfo) return;
    if (kind === "normal") triggerDownload(currentInfo.normal, "video");
    else if (kind === "audio") triggerDownload(currentInfo.audio, "audio");
  }

  /* --- gate iklan buat HD --- */
  function openAdGate() {
    if (!currentInfo?.hd) {
      $("ttError").textContent = "Versi HD gak tersedia buat video ini.";
      return;
    }
    adUnlocked = false;
    $("ttAdUnlockBtn").disabled = true;
    $("ttAdUnlockBtn").textContent = "Download Sekarang";
    $("ttAdStatusText").textContent = "Mohon tunggu...";
    window.openModal?.("ttAdModal");
    document.body.style.overflow = "hidden";
    startAdTimer();
  }

  function closeAdGate() {
    window.closeModal?.("ttAdModal");
    document.body.style.overflow = "";
    if (adTimerInterval) clearInterval(adTimerInterval);
  }

  function startAdTimer() {
    let remaining = AD_WAIT_SECONDS;
    const circumference = 2 * Math.PI * 19; // r=19 di SVG ring
    $("ttAdCountdown").textContent = remaining;
    $("ttAdRingFg").style.strokeDasharray = circumference;
    $("ttAdRingFg").style.strokeDashoffset = 0;

    if (adTimerInterval) clearInterval(adTimerInterval);
    adTimerInterval = setInterval(() => {
      remaining--;
      $("ttAdCountdown").textContent = Math.max(remaining, 0);
      const progress = 1 - remaining / AD_WAIT_SECONDS;
      $("ttAdRingFg").style.strokeDashoffset = circumference * progress;

      if (remaining <= 0) {
        clearInterval(adTimerInterval);
        adUnlocked = true;
        $("ttAdStatusText").textContent = "Selesai! Download udah kebuka.";
        $("ttAdUnlockBtn").disabled = false;
      }
    }, 1000);
  }

  function confirmAdAndDownload() {
    if (!adUnlocked || !currentInfo?.hd) return;
    triggerDownload(currentInfo.hd, "video-hd");
    closeAdGate();
  }

  Object.assign(window, {
    runTiktokProcess, downloadTiktok, openAdGate, closeAdGate, confirmAdAndDownload
  });
})();
