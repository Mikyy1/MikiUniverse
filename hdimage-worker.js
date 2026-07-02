/**
 * MIKI UNIVERSE — HD Image Proxy Worker
 * Coba beberapa image host secara berurutan kalau ada yang gagal.
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

/* --- Upload ke beberapa host, pakai yang pertama berhasil --- */

async function uploadTo0x0(imageBlob, filename) {
  const form = new FormData();
  form.append("file", imageBlob, filename);
  const res = await fetch("https://0x0.st", {
    method: "POST",
    body: form,
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
  // tmpfiles balikin URL viewer, ubah jadi direct download
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

/* --- Upscale servers --- */

async function upscaleServer1(imageUrl) {
  const res = await fetch(
    `https://api.ikyyxd.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}`,
    { signal: AbortSignal.timeout(90000) }
  );
  const data = await res.json();
  if (!data?.status || !data?.result?.upscale) throw new Error("Server 1 gagal: " + JSON.stringify(data).slice(0, 100));
  return data.result.upscale;
}

async function upscaleServer2(imageUrl) {
  const res = await fetch(
    `https://api.lexcode.biz.id/api/tools/upscale?url=${encodeURIComponent(imageUrl)}`,
    { signal: AbortSignal.timeout(90000) }
  );
  const data = await res.json();
  if (!data?.success || !data?.result) throw new Error("Server 2 gagal: " + JSON.stringify(data).slice(0, 100));
  return data.result;
}

async function upscaleServer3(imageUrl) {
  const resultUrl = `https://api.zenzxz.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}&scale=4`;
  const check = await fetch(resultUrl, { signal: AbortSignal.timeout(90000) });
  if (!check.ok) throw new Error(`Server 3 response ${check.status}`);
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
      const imageUrl = await uploadImage(imageBlob, filename);

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
