type Env = {
    MAILGUN_API_KEY: string;
    MAILGUN_DOMAIN: string; // e.g., "mail.tanuj.xyz"
    NOTIFY_TO: string; // email to receive form submissions
    FROM_EMAIL: string; // e.g., "forms@mail.tanuj.xyz"
  
    // Optional bindings
    RATE_KV?: KVNamespace;
    FORMS_D1?: D1Database;
  
    // Turnstile (optional)
    TURNSTILE_SECRET_KEY?: string;
  };
  
  export default {
    async fetch(req: Request, env: Env, ctx: ExecutionContext) {
      const url = new URL(req.url);
  
      // CORS preflight for JS clients (HTML <form> posts don't need this)
      if (req.method === "OPTIONS") {
        return cors(new Response(null, { status: 204 }));
      }
  
      // Handle different routes
      if (url.pathname === "/thank-you") {
        return cors(new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Thank You</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="success">✅ Thank you! Your message has been sent successfully.</div>
            <p>We'll get back to you soon.</p>
          </body>
          </html>
        `, { 
          status: 200,
          headers: { "Content-Type": "text/html" }
        }));
      }

      if (url.pathname !== "/submit") {
        return new Response("Not Found", { status: 404 });
      }
  
      if (req.method !== "POST") {
        return cors(new Response("Method Not Allowed", { status: 405 }));
      }
  
      try {
        const data = await parseBody(req);
  
        // Optional: basic honeypot (bots fill hidden field)
        if (data._hp) return cors(new Response("OK", { status: 200 }));
  
        // Optional: rate limit per IP
        // if (env.RATE_KV) {
        //   await enforceRateLimit(env.RATE_KV, req);
        // }

        // Optional: verify Cloudflare Turnstile
        // if (env.TURNSTILE_SECRET_KEY && data["cf-turnstile-response"]) {
        //   await verifyTurnstile(env.TURNSTILE_SECRET_KEY, data["cf-turnstile-response"], req);
        // }

        // Optional: persist to D1
        // if (env.FORMS_D1) {
        //   const form = data._form || "contact";
        //   await env.FORMS_D1
        //     .prepare("CREATE TABLE IF NOT EXISTS forms(id INTEGER PRIMARY KEY, form TEXT, payload TEXT, created_at TEXT)")
        //     .run();
        //   await env.FORMS_D1
        //     .prepare("INSERT INTO forms(form, payload, created_at) VALUES(?1, ?2, ?3)")
        //     .bind(form, JSON.stringify(data), new Date().toISOString())
        //     .run();
        // }
  
        // Send email via Mailgun
        const formName = data._form || "contact";
        const subject = `New ${formName} submission`;
        const text = JSON.stringify(data, null, 2);
        await sendWithMailgun(env, { to: env.NOTIFY_TO, from: env.FROM_EMAIL, subject, text });
  
        // Redirect target:
        // priority: explicit _redirect -> ?redirect= param -> default /thank-you
        const explicit = data._redirect;
        const qsRedirect = url.searchParams.get("redirect");
        const fallback = "/thank-you";
        const target = explicit || qsRedirect || fallback;
  
        const absolute = new URL(target, req.url).toString();
        
        // Create a redirect response with CORS headers
        const redirectResponse = new Response(null, {
          status: 303,
          headers: {
            "Location": absolute,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
        
        return redirectResponse;
      } catch (err: any) {
        console.error(err);
        // Return JSON for JS clients; HTML forms will just see a simple text
        return cors(new Response(`Error: ${err.message || err}`, { status: 400 }));
      }
    },
  } satisfies ExportedHandler<Env>;
  
  // ===== helpers =====
  
  async function parseBody(req: Request): Promise<Record<string, string>> {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await req.json();
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const out: Record<string, string> = {};
      fd.forEach((v, k) => (out[k] = String(v)));
      return out;
    }
    const text = await req.text();
    return Object.fromEntries(new URLSearchParams(text));
  }
  
  async function sendWithMailgun(env: Env, { to, from, subject, text }: { to: string; from: string; subject: string; text: string; }) {
    const res = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa("api:" + env.MAILGUN_API_KEY),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ from, to, subject, text }),
    });
    if (!res.ok) throw new Error(`Mailgun failed: ${res.status} ${await res.text()}`);
  }
  
  // very light CORS; adjust origin list as needed
  function cors(res: Response): Response {
    const hdrs = new Headers(res.headers);
    hdrs.set("Access-Control-Allow-Origin", "*"); // or a specific origin list
    hdrs.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    hdrs.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(res.body, { status: res.status, headers: hdrs });
  }
  
  // Cloudflare Turnstile verification
  async function verifyTurnstile(secret: string, token: string, req: Request) {
    const ip = req.headers.get("CF-Connecting-IP") || "";
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const out = await resp.json() as { success: boolean; error_codes?: string[] };
    if (!out.success) throw new Error("Turnstile verification failed");
  }
  
  // KV-based rate limiting: 5 posts per 10 minutes per IP
  async function enforceRateLimit(kv: KVNamespace, req: Request, limit = 5, windowSec = 600) {
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    const key = `rate:${ip}`;
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / windowSec);
  
    const val = await kv.get(key);
    let [countStr, bucketStr] = val ? val.split(":") : ["0", String(bucket)];
    let count = parseInt(countStr || "0", 10);
    let storedBucket = parseInt(bucketStr || "0", 10);
  
    if (storedBucket !== bucket) { count = 0; storedBucket = bucket; }
    count += 1;
  
    await kv.put(key, `${count}:${storedBucket}`, { expirationTtl: windowSec + 60 });
    if (count > limit) throw new Error("Rate limited");
  }
  