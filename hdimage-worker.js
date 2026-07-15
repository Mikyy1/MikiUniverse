/**
 * MIKI UNIVERSE — HD Image Proxy Worker
 * Upload gambar user -> coba beberapa API upscale berurutan (auto-fallback
 * kalau salah satu gagal/di-block) -> stream hasilnya langsung sebagai
 * bytes gambar (BUKAN base64, biar gak kena limit CPU time Workers).
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

/* --- Verifikasi captcha Turnstile ke Cloudflare (server-side, gak bisa dipalsuin dari browser) --- */
async function verifyTurnstile(token, secretKey, remoteIp) {
  if (!secretKey) {
    console.error("[HD Worker] TURNSTILE_SECRET_KEY belum diset di Worker Secrets.");
    throw new Error("captcha belum dikonfigurasi di server");
  }
  if (!token) throw new Error("captcha kosong");

  const form = new FormData();
  form.append("secret", secretKey);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(15000)
  });
  const data = await res.json().catch(() => null);
  if (!data?.success) {
    console.error("[HD Worker] Turnstile gagal:", JSON.stringify(data?.["error-codes"] || data));
    throw new Error("captcha tidak valid");
  }
}

/* --- Upload dulu ke host sementara, biar punya URL yang bisa dibaca API upscale --- */

async function uploadTo0x0(imageBlob, filename) {
  const form = new FormData();
  form.append("file", imageBlob, filename);
  const res = await fetch("https://0x0.st", {
    method: "POST",
    body: form,
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(30000)
  });
  const text = (await res.text()).trim();
  if (!text.startsWith("https://")) throw new Error("0x0.st gagal: " + text.slice(0, 80));
  return text;
}

async function uploadToTmpfiles(imageBlob, filename) {
  const form = new FormData();
  form.append("file", imageBlob, filename);
  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const data = await res.json();
  if (!data?.data?.url) throw new Error("tmpfiles gagal");
  return data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

async function uploadToLitterbox(imageBlob, filename) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("time", "1h");
  form.append("fileToUpload", imageBlob, filename);
  const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const text = (await res.text()).trim();
  if (!text.startsWith("https://")) throw new Error("litterbox gagal: " + text.slice(0, 80));
  return text;
}

async function uploadImage(imageBlob, filename) {
  const hosts = [
    { name: "0x0.st", fn: () => uploadTo0x0(imageBlob, filename) },
    { name: "litterbox", fn: () => uploadToLitterbox(imageBlob, filename) },
    { name: "tmpfiles", fn: () => uploadToTmpfiles(imageBlob, filename) }
  ];
  const errors = [];
  for (const host of hosts) {
    try {
      const url = await host.fn();
      console.log(`Upload berhasil via ${host.name}: ${url}`);
      return url;
    } catch (e) {
      errors.push(`${host.name}: ${e.message}`);
      console.log(`${host.name} gagal: ${e.message}`);
    }
  }
  throw new Error("Semua upload host gagal: " + errors.join(" | "));
}

/* --- Server-server upscale, dicoba berurutan sampe ada yang berhasil --- */

async function upscaleFaa(imageUrl) {
  const res = await fetch(
    `https://api-faa.my.id/faa/hdv4?url=${encodeURIComponent(imageUrl)}`,
    { signal: AbortSignal.timeout(90000), headers: BROWSER_HEADERS }
  );
  const data = await safeJson(res);
  if (!data?.status || !data?.result?.image_upscaled) throw new Error("faa gagal: " + JSON.stringify(data).slice(0, 100));
  return data.result.image_upscaled;
}

async function upscaleIkyyxd(imageUrl) {
  const res = await fetch(
    `https://api.ikyyxd.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}`,
    { signal: AbortSignal.timeout(90000), headers: BROWSER_HEADERS }
  );
  const data = await safeJson(res);
  if (!data?.status || !data?.result?.upscale) throw new Error("ikyyxd gagal: " + JSON.stringify(data).slice(0, 100));
  return data.result.upscale;
}

async function upscaleLexcode(imageUrl) {
  const res = await fetch(
    `https://api.lexcode.biz.id/api/tools/upscale?url=${encodeURIComponent(imageUrl)}`,
    { signal: AbortSignal.timeout(90000), headers: BROWSER_HEADERS }
  );
  const data = await safeJson(res);
  if (!data?.success || !data?.result) throw new Error("lexcode gagal: " + JSON.stringify(data).slice(0, 100));
  return data.result;
}

async function upscaleZenzxz(imageUrl) {
  const resultUrl = `https://api.zenzxz.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}&scale=4`;
  const check = await fetch(resultUrl, { signal: AbortSignal.timeout(90000), headers: BROWSER_HEADERS });
  if (!check.ok) throw new Error(`zenzxz response ${check.status}`);
  return resultUrl;
}

async function upscaleImage(imageUrl) {
  const servers = [
    { name: "faa", fn: () => upscaleFaa(imageUrl) },
    { name: "ikyyxd", fn: () => upscaleIkyyxd(imageUrl) },
    { name: "lexcode", fn: () => upscaleLexcode(imageUrl) },
    { name: "zenzxz", fn: () => upscaleZenzxz(imageUrl) }
  ];
  const errors = [];
  for (const server of servers) {
    try {
      const url = await server.fn();
      console.log(`Upscale berhasil via ${server.name}: ${url}`);
      return url;
    } catch (e) {
      errors.push(`${server.name}: ${e.message}`);
      console.log(`${server.name} gagal: ${e.message}`);
    }
  }
  throw new Error("Semua server upscale gagal: " + errors.join(" | "));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "Method tidak didukung." }, 405);

    let imageBlob, filename, turnstileToken;
    try {
      const formData = await request.formData();
      imageBlob = formData.get("image");
      filename = formData.get("filename") || "image.jpg";
      turnstileToken = formData.get("cf-turnstile-response");
      if (!imageBlob) return json({ ok: false, error: "Gagal memproses gambar. Coba lagi." }, 400);
    } catch (e) {
      console.error("[HD Worker] Request format salah:", e.message);
      return json({ ok: false, error: "Gagal memproses gambar. Coba lagi." }, 400);
    }

    // Wajib lolos captcha dulu sebelum ngapa-ngapain lagi
    try {
      await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP"));
    } catch (e) {
      console.error("[HD Worker] Captcha ditolak:", e.message);
      return json({ ok: false, error: "Verifikasi captcha gagal. Coba lagi." }, 403);
    }

    try {
      const imageUrl = await uploadImage(imageBlob, filename);
      const upscaledUrl = await upscaleImage(imageUrl);

      // Stream langsung bytes-nya, JANGAN diubah ke base64 manual —
      // itu proses CPU-berat dan gampang kena limit CPU time di Workers.
      const imgRes = await fetch(upscaledUrl, { signal: AbortSignal.timeout(60000), headers: BROWSER_HEADERS });
      if (!imgRes.ok || !imgRes.body) throw new Error(`Gagal ambil hasil gambar (${imgRes.status})`);

      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      return new Response(imgRes.body, {
        status: 200,
        headers: { "Content-Type": contentType, ...CORS_HEADERS }
      });
    } catch (e) {
      // PENTING: detail asli (nama API pihak ketiga, URL, status code) cuma masuk log
      // server (keliatan di Cloudflare dashboard > Logs), TIDAK PERNAH dikirim ke client.
      console.error("[HD Worker] Proses gagal:", e.message);
      return json({ ok: false, error: "Gagal memproses gambar. Coba lagi beberapa saat." }, 500);
    }
  }
};
