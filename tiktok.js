/* =========================================
   MIKI UNIVERSE — TikTok Downloader
   2 mode: No Watermark (HD) & Audio/MP3.
   Langsung download, gak pake iklan/timer.
   ========================================= */

(function () {
  const WORKER_URL = "https://miki-tiktok-proxy.mine14788.workers.dev";

  let isProcessing = false;
  let currentInfo = null; // { title, cover, author, hd, audio }

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

  /* --- download langsung, gak ada gate apapun --- */
  function downloadTiktok(kind) {
    if (!currentInfo) return;
    if (kind === "hd") triggerDownload(currentInfo.hd, "video");
    else if (kind === "audio") triggerDownload(currentInfo.audio, "audio");
  }

  Object.assign(window, { runTiktokProcess, downloadTiktok });
})();
