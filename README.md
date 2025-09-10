# Form Relay - Cloudflare Worker Deployment Guide

This Cloudflare Worker handles HTML form submissions and forwards them via Mailgun to your email address.

## Features

- ✅ Mailgun email integration
- ✅ CORS support for JavaScript clients
- ✅ Honeypot protection against bots
- ✅ Optional rate limiting (KV storage)
- ✅ Optional Turnstile verification
- ✅ Optional D1 database storage
- ✅ Redirect after submission
- ✅ Support for multiple form types

## Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **Mailgun Account** with API key and domain configured
3. **Domain Setup** - `forms.tanuj.xyz` should point to Cloudflare

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Mailgun

1. Go to your Mailgun dashboard
2. Add your domain `mail.tanuj.xyz` (or use your existing domain)
3. Get your API key from Settings > API Keys
4. Verify your domain in Mailgun

### 3. Set Environment Variables

Set the required secrets using Wrangler:

```bash
# Your Mailgun API key
wrangler secret put MAILGUN_API_KEY

# Your Mailgun domain (e.g., "mail.tanuj.xyz")
wrangler secret put MAILGUN_DOMAIN

# Email address to receive form submissions
wrangler secret put NOTIFY_TO

# From email address (e.g., "forms@mail.tanuj.xyz")
wrangler secret put FROM_EMAIL
```

### 4. Optional: Configure Rate Limiting

If you want to enable rate limiting (5 submissions per 10 minutes per IP):

1. Create a KV namespace in Cloudflare dashboard
2. Update `wrangler.toml` with your KV namespace ID:

```toml
[[kv_namespaces]]
binding = "RATE_KV"
id = "your-kv-namespace-id"
```

### 5. Optional: Configure D1 Database

If you want to store form submissions in a database:

1. Create a D1 database in Cloudflare dashboard
2. Update `wrangler.toml` with your database details:

```toml
[[d1_databases]]
binding = "FORMS_D1"
database_name = "forms"
database_id = "your-database-id"
```

### 6. Deploy

```bash
# Deploy to production
npm run deploy

# Or deploy a preview
npm run deploy:preview
```

## Usage

### Basic HTML Form

```html
<form action="https://forms.tanuj.xyz/submit" method="POST">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <textarea name="message" placeholder="Your Message" required></textarea>
  
  <!-- Honeypot field (hidden from users) -->
  <input type="text" name="_hp" style="display:none" tabindex="-1">
  
  <button type="submit">Send Message</button>
</form>
```

### Advanced Form with Redirect

```html
<form action="https://forms.tanuj.xyz/submit?redirect=/thank-you" method="POST">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <textarea name="message" placeholder="Your Message" required></textarea>
  
  <!-- Form identifier -->
  <input type="hidden" name="_form" value="contact">
  
  <!-- Custom redirect (overrides query param) -->
  <input type="hidden" name="_redirect" value="/custom-thank-you">
  
  <button type="submit">Send Message</button>
</form>
```

### JavaScript Form Submission

```javascript
const formData = new FormData();
formData.append('name', 'John Doe');
formData.append('email', 'john@example.com');
formData.append('message', 'Hello from JavaScript!');
formData.append('_form', 'contact');

fetch('https://forms.tanuj.xyz/submit', {
  method: 'POST',
  body: formData
})
.then(response => {
  if (response.ok) {
    console.log('Form submitted successfully');
  }
})
.catch(error => {
  console.error('Error:', error);
});
```

## Form Parameters

- `_form`: Form identifier (default: "contact")
- `_redirect`: Custom redirect URL after submission
- `_hp`: Honeypot field (leave empty, hidden from users)

## Email Format

Form submissions are sent as JSON in the email body:

```json
{
  "name": "John Doe",
  "email": "john@example.com", 
  "message": "Hello!",
  "_form": "contact"
}
```

## Monitoring

View logs in real-time:

```bash
wrangler tail
```

## Troubleshooting

1. **Domain not working**: Ensure `forms.tanuj.xyz` is configured in Cloudflare DNS
2. **Email not sending**: Check Mailgun API key and domain configuration
3. **CORS issues**: The worker includes CORS headers for JavaScript clients
4. **Rate limiting**: Check KV namespace configuration if enabled

## Security Features

- **Honeypot**: Hidden `_hp` field catches bots
- **Rate Limiting**: Optional IP-based rate limiting
- **Turnstile**: Optional Cloudflare Turnstile verification
- **Input Validation**: Basic validation and sanitization

## Customization

The worker can be customized by modifying `src/worker.ts`:

- Change email format
- Add custom validation
- Modify redirect behavior
- Add additional security measures
