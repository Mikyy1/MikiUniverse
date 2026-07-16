/**
 * MIKI UNIVERSE — TikTok Downloader Proxy Worker
 *
 * Alur:
 * 1. action=info  -> ambil metadata + link download (no-watermark, HD, audio)
 *    dari api-faa.my.id dulu, kalau gagal/di-block otomatis fallback ke tikwm.com
 * 2. action=download -> proxy/stream file aslinya biar:
 *    - tombol download di browser reliable (gak kebuka tab baru doang)
 *    - URL sumber asli gak keliatan user
 *
 * PENTING: sama kayak worker HD Image, hasil file di-stream langsung
 * (bukan base64), biar gak kena limit CPU time Cloudflare Workers.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

async function safeJson(res) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch (_) {
    throw new Error(`respons bukan JSON (status ${res.status}, kemungkinan di-block)`);
  }
}

function absUrl(base, maybeRelative) {
  if (!maybeRelative) return null;
  if (maybeRelative.startsWith("http")) return maybeRelative;
  return base + maybeRelative;
}

/* --- Sumber 1: api-faa.my.id (diminta duluan sesuai request) ---
   Skema respons persisnya belum pasti (belum ada dokumentasi resmi),
   jadi dicoba beberapa kemungkinan nama field yang umum dipakai
   API sejenis. Kalau semua gak cocok, otomatis lempar error
   dan sistem bakal fallback ke tikwm. */
async function fetchFromFaa(tiktokUrl) {
  const res = await fetch(
    `https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(tiktokUrl)}`,
    { signal: AbortSignal.timeout(30000), headers: BROWSER_HEADERS }
  );
  const data = await safeJson(res);
  const r = data?.result || data?.data || data;
  if (!r) throw new Error("faa: format respons gak dikenali");

  const hd = r.hd || r.hd_watermark || r.video?.hd || r.hdplay || r.video_hd || r.no_watermark || r.nowm || r.video?.noWatermark || r.play || r.video_no_wm;
  const audio = r.audio || r.music || r.mp3 || r.video?.audio;
  const title = r.title || r.desc || r.caption || "TikTok Video";
  const cover = r.cover || r.thumbnail || r.video?.cover;
  const author = r.author?.nickname || r.author?.name || r.username || "";

  if (!hd && !audio) throw new Error("faa: gak ada link video di respons");

  return { title, cover, author, hd, audio, source: "faa" };
}

/* --- Sumber 2: tikwm.com (fallback, API publik yang formatnya stabil & terdokumentasi) --- */
async function fetchFromTikwm(tiktokUrl) {
  const base = "https://www.tikwm.com";
  const res = await fetch(
    `${base}/api/?url=${encodeURIComponent(tiktokUrl)}&hd=1`,
    { signal: AbortSignal.timeout(30000), headers: BROWSER_HEADERS }
  );
  const data = await safeJson(res);
  if (data?.code !== 0 || !data?.data) throw new Error("tikwm: " + (data?.msg || "gagal ambil data"));
  const d = data.data;

  return {
    title: d.title || "TikTok Video",
    cover: absUrl(base, d.cover),
    author: d.author?.nickname || d.author?.unique_id || "",
    hd: absUrl(base, d.hdplay) || absUrl(base, d.play),
    audio: absUrl(base, d.music),
    source: "tikwm"
  };
}

async function fetchTiktokInfo(tiktokUrl) {
  const errors = [];
  for (const fn of [fetchFromFaa, fetchFromTikwm]) {
    try {
      return await fn(tiktokUrl);
    } catch (e) {
      errors.push(e.message);
      console.log("[TikTok Worker] sumber gagal:", e.message);
    }
  }
  throw new Error("Semua sumber gagal: " + errors.join(" | "));
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // --- ambil metadata + link download ---
    if (request.method === "POST" && (action === "info" || !action)) {
      let tiktokUrl;
      try {
        const body = await request.json();
        tiktokUrl = (body?.url || "").trim();
      } catch (_) {
        return json({ ok: false, error: "Request format salah." }, 400);
      }
      if (!tiktokUrl || !/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(tiktokUrl)) {
        return json({ ok: false, error: "Link TikTok gak valid." }, 400);
      }

      try {
        const info = await fetchTiktokInfo(tiktokUrl);
        return json({ ok: true, ...info });
      } catch (e) {
        console.error("[TikTok Worker] Gagal proses:", e.message);
        const isDebug = url.searchParams.get("debug") === "1";
        return json({
          ok: false,
          error: "Gagal proses link ini. Coba link lain atau beberapa saat lagi.",
          ...(isDebug ? { debugDetail: e.message } : {})
        }, 500);
      }
    }

    // --- proxy/stream file (video atau audio) ---
    if (request.method === "GET" && action === "download") {
      const target = url.searchParams.get("target");
      const type = url.searchParams.get("type") || "video";
      if (!target) return json({ error: "Target kosong." }, 400);

      try {
        const upstream = await fetch(decodeURIComponent(target), {
          signal: AbortSignal.timeout(60000),
          headers: BROWSER_HEADERS
        });
        if (!upstream.ok || !upstream.body) throw new Error(`Upstream ${upstream.status}`);

        const contentType = upstream.headers.get("content-type") ||
          (type === "audio" ? "audio/mpeg" : "video/mp4");
        const ext = type === "audio" ? "mp3" : "mp4";
        const randomId = Math.random().toString(36).slice(2, 8);

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="MikiTiktok-${randomId}.${ext}"`,
            ...CORS_HEADERS
          }
        });
      } catch (e) {
        console.error("[TikTok Worker] Gagal download:", e.message);
        return json({ error: "Gagal ambil file. Coba proses ulang link-nya." }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  }
};
