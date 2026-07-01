/**
 * MIKI UNIVERSE — HD Image Proxy Worker
 * Cara pasang:
 * 1. Cloudflare dashboard → Workers & Pages → Create → Create Worker
 * 2. Kasih nama misal "miki-hd-proxy"
 * 3. Edit code → hapus semua isi default → paste SELURUH isi file ini
 * 4. Deploy
 * 5. Catat URL worker-nya (miki-hd-proxy.NAMAKAMU.workers.dev)
 *    → Paste URL itu di hdimage.js sebagai nilai WORKER_URL
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

async function uploadToCatbox(imageBlob, filename) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", imageBlob, filename || "image.jpg");
  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form
  });
  const text = await res.text();
  if (!text.startsWith("https://")) throw new Error("Upload catbox gagal: " + text.slice(0, 100));
  return text.trim();
}

async function upscaleServer1(imageUrl) {
  const res = await fetch(
    `https://api.ikyyxd.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}`,
    { signal: AbortSignal.timeout(90000) }
  );
  const data = await res.json();
  if (!data?.status || !data?.result?.upscale) throw new Error("Server 1 gagal.");
  return data.result.upscale;
}

async function upscaleServer2(imageUrl) {
  const res = await fetch(
    `https://api.lexcode.biz.id/api/tools/upscale?url=${encodeURIComponent(imageUrl)}`,
    { signal: AbortSignal.timeout(90000) }
  );
  const data = await res.json();
  if (!data?.success || !data?.result) throw new Error("Server 2 gagal.");
  return data.result;
}

async function upscaleServer3(imageUrl) {
  // Server 3 balikin URL langsung, kita fetch buat cek valid dulu
  const resultUrl = `https://api.zenzxz.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}&scale=4`;
  const check = await fetch(resultUrl, { method: "HEAD", signal: AbortSignal.timeout(90000) });
  if (!check.ok) throw new Error("Server 3 gagal.");
  return resultUrl;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "Method tidak didukung." }, 405);

    let server, imageBlob, filename;
    try {
      const formData = await request.formData();
      server = parseInt(formData.get("server") || "1", 10);
      imageBlob = formData.get("image");
      filename = formData.get("filename") || "image.jpg";
      if (!imageBlob) return json({ error: "Gambar tidak ada." }, 400);
    } catch (_) {
      return json({ error: "Request format salah." }, 400);
    }

    try {
      // 1. Upload ke catbox
      const imageUrl = await uploadToCatbox(imageBlob, filename);

      // 2. Upscale sesuai server
      let resultUrl;
      if (server === 1) resultUrl = await upscaleServer1(imageUrl);
      else if (server === 2) resultUrl = await upscaleServer2(imageUrl);
      else resultUrl = await upscaleServer3(imageUrl);

      return json({ ok: true, result: resultUrl });
    } catch (e) {
      return json({ ok: false, error: e.message || "Terjadi kesalahan." }, 500);
    }
  }
};
