// Import form configurations from repository files
import formConfigs from '../config/forms.json';
import defaultConfigs from '../config/defaults.json';

type FormConfig = {
    name: string;
    notifyTo: string[];
    fromEmail?: string;
    thankYouUrl?: string;
    subject?: string;
    enabled?: boolean;
  };

type Env = {
    MAILGUN_API_KEY: string;
    MAILGUN_DOMAIN: string; // e.g., "mail.tanuj.xyz"
  
    // Optional bindings
    RATE_KV?: KVNamespace;
    FORMS_D1?: D1Database;
  
    // Turnstile (optional)
    TURNSTILE_SECRET_KEY?: string;
  };
  
  export default {
    async fetch(req: Request, env: Env, ctx: ExecutionContext) {
      const url = new URL(req.url);
      console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname} - IP: ${req.headers.get("CF-Connecting-IP") || "unknown"}`);
  
      // CORS preflight for JS clients (HTML <form> posts don't need this)
      if (req.method === "OPTIONS") {
        console.log("Handling CORS preflight request");
        return cors(new Response(null, { status: 204 }));
      }


      // Check if this is a form submission route (e.g., /submit, /ecofresh/submit, /contact/submit)
      const isFormRoute = url.pathname === "/submit" || 
                         (url.pathname.split('/').length === 3 && url.pathname.endsWith('/submit'));
      
      if (!isFormRoute) {
        console.log(`404: Path not found: ${url.pathname}`);
        return new Response("Not Found", { status: 404 });
      }
  
      if (req.method !== "POST") {
        console.log(`405: Method not allowed: ${req.method}`);
        return cors(new Response("Method Not Allowed", { status: 405 }));
      }
  
      try {
        // Check environment variables first
        console.log("Checking environment variables...");
        if (!env.MAILGUN_API_KEY) {
          console.error("❌ MAILGUN_API_KEY is missing!");
          throw new Error("MAILGUN_API_KEY environment variable is not set");
        }
        if (!env.MAILGUN_DOMAIN) {
          console.error("❌ MAILGUN_DOMAIN is missing!");
          throw new Error("MAILGUN_DOMAIN environment variable is not set");
        }
        console.log("✅ All required environment variables are present");

        const data = await parseBody(req);
        console.log("Form data received:", JSON.stringify(data, null, 2));
  
        // Get form configuration
        const formConfig = getFormConfig(url.pathname);
        const formName = formConfig?.name || data._form || "contact";
        const defaults = getDefaultConfigs();
        
        // Check if form is enabled
        if (formConfig && formConfig.enabled === false) {
          console.log(`❌ Form '${formName}' is disabled`);
          return cors(new Response("Form is currently disabled", { status: 503 }));
        }
  
        // Optional: basic honeypot (bots fill hidden field)
        if (data._hp) {
          console.log("🤖 Honeypot triggered - likely a bot");
          return cors(new Response("OK", { status: 200 }));
        }
  
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
        const subject = formConfig?.subject || `New ${formName} submission`;
        
        // Generate beautiful HTML email
        const htmlContent = generateHtmlEmail(data, formName, formConfig);
        const textContent = generateTextEmail(data, formName, formConfig);
        
        // Determine recipients
        const recipients = formConfig?.notifyTo || [defaults.defaultNotifyTo];
        const fromEmail = formConfig?.fromEmail || defaults.defaultFromEmail;
        
        console.log(`📧 Sending email via Mailgun:`);
        console.log(`  From: ${fromEmail}`);
        console.log(`  To: ${recipients.join(', ')}`);
        console.log(`  Subject: ${subject}`);
        console.log(`  Domain: ${env.MAILGUN_DOMAIN}`);
        
        // Send to all recipients
        for (const recipient of recipients) {
          await sendWithMailgun(env, { 
            to: recipient, 
            from: fromEmail, 
            subject, 
            html: htmlContent,
            text: textContent
          });
          console.log(`✅ Email sent successfully to: ${recipient}`);
        }
  
        // Redirect target:
        // priority: explicit _redirect -> form config thankYouUrl -> ?redirect= param -> default /thank-you
        const explicit = data._redirect;
        const formThankYou = formConfig?.thankYouUrl;
        const qsRedirect = url.searchParams.get("redirect");
        const fallback = "/thank-you";
        const target = explicit || formThankYou || qsRedirect || fallback;
  
        // Smart redirect logic: if thankYouUrl is relative, use requesting origin
        let absolute;
        if (formThankYou && formThankYou.startsWith('/') && !explicit) {
          // Get the requesting origin from the Referer header
          const referer = req.headers.get('referer');
          if (referer) {
            try {
              const refererUrl = new URL(referer);
              absolute = `${refererUrl.origin}${formThankYou}`;
              console.log(`🔄 Smart redirect: Using requesting origin ${refererUrl.origin} + ${formThankYou}`);
            } catch (e) {
              // Fallback to current domain if referer is invalid
              absolute = new URL(formThankYou, req.url).toString();
              console.log(`🔄 Fallback redirect: Invalid referer, using current domain`);
            }
          } else {
            // No referer, use current domain
            absolute = new URL(formThankYou, req.url).toString();
            console.log(`🔄 No referer: Using current domain for relative path`);
          }
        } else {
          // Absolute URL or explicit redirect - use as-is
          absolute = new URL(target, req.url).toString();
        }
        
        console.log(`🔄 Redirecting to: ${absolute}`);
        
        // Always redirect for form submissions - simple and works everywhere
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
        console.error("❌ Form submission failed:", err);
        console.error("Error details:", {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
        // Return JSON for JS clients; HTML forms will just see a simple text
        return cors(new Response(`Error: ${err.message || err}`, { status: 400 }));
      }
    },
  } satisfies ExportedHandler<Env>;
  
  // ===== helpers =====
  
  function getFormConfigs(): Record<string, FormConfig> {
    console.log("Loaded form configurations:", Object.keys(formConfigs));
    return formConfigs as Record<string, FormConfig>;
  }
  
  function getDefaultConfigs() {
    return defaultConfigs;
  }
  
  function getFormConfig(pathname: string): FormConfig | null {
    const configs = getFormConfigs();
    
    // Extract form name from path like /ecofresh/submit -> ecofresh
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && pathParts[1] === 'submit') {
      const formName = pathParts[0];
      const config = configs[formName];
      
      if (config) {
        console.log(`Found form config for: ${formName}`);
        return config;
      } else {
        console.log(`No config found for form: ${formName}`);
      }
    }
    
    return null;
  }
  
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
  
  function generateHtmlEmail(data: Record<string, string>, formName: string, formConfig: FormConfig | null): string {
    const timestamp = new Date().toLocaleString();
    const formDisplayName = formConfig?.name || formName;
    
    // Filter out system fields
    const filteredData = Object.entries(data)
      .filter(([key]) => !key.startsWith('_'))
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {} as Record<string, string>);
    
    const fieldsHtml = Object.entries(filteredData)
      .map(([key, value]) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057; width: 150px;">
            ${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529;">
            ${value.replace(/\n/g, '<br>')}
          </td>
        </tr>
      `).join('');
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${formDisplayName} Submission</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .email-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px;
        }
        .form-info {
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin-bottom: 25px;
            border-radius: 0 4px 4px 0;
        }
        .form-info h3 {
            margin: 0 0 8px 0;
            color: #007bff;
            font-size: 16px;
        }
        .form-info p {
            margin: 0;
            color: #6c757d;
            font-size: 14px;
        }
        .submission-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .submission-table th {
            background: #f8f9fa;
            padding: 15px 12px;
            text-align: left;
            font-weight: 600;
            color: #495057;
            border-bottom: 2px solid #dee2e6;
        }
        .submission-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
        }
        .submission-table tr:last-child td {
            border-bottom: none;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #6c757d;
            font-size: 12px;
            border-top: 1px solid #dee2e6;
        }
        .timestamp {
            background: #e9ecef;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            color: #495057;
            display: inline-block;
            margin-top: 10px;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .header, .content, .footer {
                padding: 20px;
            }
            .submission-table {
                font-size: 14px;
            }
            .submission-table th,
            .submission-table td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>📧 New Form Submission</h1>
            <p>${formDisplayName}</p>
        </div>
        
        <div class="content">
            <div class="form-info">
                <h3>Form Details</h3>
                <p>You have received a new submission from your ${formDisplayName.toLowerCase()}.</p>
            </div>
            
            <table class="submission-table">
                <thead>
                    <tr>
                        <th>Field</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${fieldsHtml}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>This email was automatically generated by your form handling system.</p>
            <div class="timestamp">Received: ${timestamp}</div>
        </div>
    </div>
</body>
</html>`;
  }
  
  function generateTextEmail(data: Record<string, string>, formName: string, formConfig: FormConfig | null): string {
    const timestamp = new Date().toLocaleString();
    const formDisplayName = formConfig?.name || formName;
    
    // Filter out system fields
    const filteredData = Object.entries(data)
      .filter(([key]) => !key.startsWith('_'))
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {} as Record<string, string>);
    
    const fieldsText = Object.entries(filteredData)
      .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}: ${value}`)
      .join('\n');
    
    return `
New Form Submission - ${formDisplayName}

You have received a new submission from your ${formDisplayName.toLowerCase()}.

${fieldsText}

---
This email was automatically generated by your form handling system.
Received: ${timestamp}
`;
  }
  
  async function sendWithMailgun(env: Env, { to, from, subject, html, text }: { to: string; from: string; subject: string; html: string; text: string; }) {
    const url = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;
    console.log(`📡 Making request to Mailgun API: ${url}`);
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa("api:" + env.MAILGUN_API_KEY),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ 
        from, 
        to, 
        subject, 
        html,
        text 
      }),
    });
    
    console.log(`📡 Mailgun API response: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Mailgun API error: ${res.status} ${res.statusText}`);
      console.error(`❌ Mailgun error response: ${errorText}`);
      throw new Error(`Mailgun failed: ${res.status} ${errorText}`);
    }
    
    const responseText = await res.text();
    console.log(`✅ Mailgun API success: ${responseText}`);
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
  