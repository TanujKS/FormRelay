# Form Relay - Cloudflare Worker

A powerful Cloudflare Worker that handles HTML form submissions and forwards them via Mailgun to your email address. Supports single and multiple forms with advanced configuration options.

## Features

- ✅ **Mailgun email integration** - Reliable email delivery
- ✅ **CORS support** - Works with JavaScript clients
- ✅ **Honeypot protection** - Built-in bot protection
- ✅ **Multiple forms** - Support for different form types with file-based configuration
- ✅ **Multiple recipients** - Send emails to different addresses per form
- ✅ **Custom redirects** - Custom thank you pages per form
- ✅ **File-based configuration** - Easy form management through JSON files
- ✅ **Rate limiting** - Optional IP-based rate limiting (KV storage)
- ✅ **Turnstile verification** - Optional Cloudflare Turnstile integration
- ✅ **D1 database storage** - Optional form submission storage
- ✅ **Local testing** - Full local development support

## Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **Mailgun Account** with API key and domain configured
3. **Domain Setup** (optional) - Point your domain to Cloudflare

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Mailgun

1. Go to your Mailgun dashboard
2. Add your domain (e.g., `mail.yourdomain.com`)
3. Get your API key from Settings > API Keys
4. Verify your domain in Mailgun

### 3. Configure Form Settings

The worker uses file-based configuration instead of environment variables for form settings:

1. **Edit `config/defaults.json`** - Set default settings:
```json
{
  "defaultNotifyTo": "your-email@example.com",
  "defaultFromEmail": "forms@mail.yourdomain.com",
  "defaultThankYouUrl": "/thank-you"
}
```

2. **Edit `config/forms.json`** - Configure individual forms:
```json
{
  "contact": {
    "name": "Contact Form",
    "notifyTo": ["your-email@example.com"],
    "fromEmail": "forms@mail.yourdomain.com",
    "thankYouUrl": "/thank-you",
    "subject": "New Contact Form Submission",
    "enabled": true
  }
}
```

### 4. Set Required Environment Variables

Set the required secrets using Wrangler:

```bash
# Your Mailgun API key
wrangler secret put MAILGUN_API_KEY

# Your Mailgun domain (e.g., "mail.yourdomain.com")
wrangler secret put MAILGUN_DOMAIN
```

### 5. Deploy

```bash
# Deploy to production
npm run deploy

# Or deploy a preview
npm run deploy:preview
```

## Basic Usage

### Simple HTML Form

```html
<form action="https://your-worker.workers.dev/submit" method="POST">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <textarea name="message" placeholder="Your Message" required></textarea>
  
  <!-- Honeypot field (hidden from users) -->
  <input type="text" name="_hp" style="display:none" tabindex="-1">
  
  <button type="submit">Send Message</button>
</form>
```



## Form Configuration

The worker supports multiple forms with different configurations through file-based settings.

### URL Structure

- **Default form**: `https://your-worker.workers.dev/submit`
- **Named forms**: `https://your-worker.workers.dev/{form-name}/submit`

### Examples
- `https://your-worker.workers.dev/contact/submit`
- `https://your-worker.workers.dev/support/submit`
- `https://your-worker.workers.dev/newsletter/submit`

### Configuration Schema

```typescript
type FormConfig = {
  name: string;           // Display name for the form
  notifyTo: string[];     // Array of email addresses to notify
  fromEmail?: string;     // From email address (uses default if not specified)
  thankYouUrl?: string;   // Custom thank you page URL
  subject?: string;       // Custom email subject
  enabled?: boolean;      // Enable/disable the form (default: true)
}
```

### Fallback Behavior

If a form doesn't have specific configuration:

1. **Recipients**: Uses `defaultNotifyTo` from `config/defaults.json`
2. **From Email**: Uses `defaultFromEmail` from `config/defaults.json`  
3. **Subject**: Uses `"New {form-name} submission"`
4. **Thank You**: Uses `defaultThankYouUrl` from `config/defaults.json` or form's `_redirect` field

## Local Testing

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Edit `.dev.vars` file with your Mailgun credentials
   - Add your API key and domain

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Test the form:**
   - Open `test/test.html` in your browser
   - Fill out and submit the form
   - Check your email for the submission

### Environment Variables for Testing

Make sure your `.dev.vars` file contains:

```bash
MAILGUN_API_KEY=key-your-actual-mailgun-api-key
MAILGUN_DOMAIN=mail.yourdomain.com
```

## Optional Features

### Rate Limiting

If you want to enable rate limiting (5 submissions per 10 minutes per IP):

1. Create a KV namespace in Cloudflare dashboard
2. Update `wrangler.toml` with your KV namespace ID:

```toml
[[kv_namespaces]]
binding = "RATE_KV"
id = "your-kv-namespace-id"
```

### D1 Database Storage

If you want to store form submissions in a database:

1. Create a D1 database in Cloudflare dashboard
2. Update `wrangler.toml` with your database details:

```toml
[[d1_databases]]
binding = "FORMS_D1"
database_name = "forms"
database_id = "your-database-id"
```

### Form Parameters

- `_form`: Form identifier (default: "contact")
- `_redirect`: Custom redirect URL after submission
- `_hp`: Honeypot field (leave empty, hidden from users)

## Configuration Files

The worker uses two configuration files:

### `config/defaults.json`
Contains default settings used as fallbacks:
```json
{
  "defaultNotifyTo": "your-email@example.com",
  "defaultFromEmail": "forms@mail.yourdomain.com",
  "defaultThankYouUrl": "/thank-you"
}
```

### `config/forms.json`
Contains individual form configurations:
```json
{
  "contact": {
    "name": "Contact Form",
    "notifyTo": ["your-email@example.com"],
    "fromEmail": "forms@mail.yourdomain.com",
    "thankYouUrl": "/thank-you",
    "subject": "New Contact Form Submission",
    "enabled": true
  },
  "support": {
    "name": "Support Form",
    "notifyTo": ["support@yourdomain.com"],
    "subject": "New Support Request",
    "enabled": true
  }
}
```

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

Example log output:
```
[2025-01-09T23:30:00.000Z] POST /contact/submit - IP: 192.168.1.1
Found form config for: contact
📧 Sending email via Mailgun:
  From: forms@mail.yourdomain.com
  To: your-email@example.com
  Subject: New Contact Form Submission
✅ Email sent successfully to: your-email@example.com
🔄 Redirecting to: /thank-you
```

## Debugging

### 1. Check Console Logs
The Wrangler dev server will show console.log output in your terminal. Look for:
- Form data being received
- Mailgun API responses
- Any error messages

### 2. Check Network Tab
In your browser's developer tools:
- Go to Network tab
- Submit the form
- Check the request/response details

### 3. Check Email Delivery
- Verify the email arrives in your inbox
- Check spam folder if needed
- Verify the email content and formatting

### 4. Common Issues

**"Connection Error" in Browser:**
- Make sure Wrangler dev server is running
- Check that it's running on the correct port (8787)
- Try refreshing the page

**"Mailgun failed" Error:**
- Check your API key in `.dev.vars`
- Verify your Mailgun domain is correct
- Ensure your Mailgun account is active

**Email Not Received:**
- Check spam folder
- Verify the email addresses in `config/defaults.json` or `config/forms.json`
- Check Mailgun logs in your dashboard

**Form Not Working:**
- Check if form is enabled in configuration
- Verify the route matches your configuration key
- Check logs with `wrangler tail`

**Emails Not Sending:**
- Verify Mailgun configuration
- Check recipient email addresses in `config/forms.json` and `config/defaults.json`
- Ensure form configuration files contain valid JSON

**Wrong Redirect:**
- Check `thankYouUrl` in form configuration
- Verify form's `_redirect` field
- Check URL query parameters

## Production Testing

Before deploying to production:

1. Test with `npm run dev:remote` to use Cloudflare's edge
2. Set up your production secrets:
   ```bash
   wrangler secret put MAILGUN_API_KEY
   wrangler secret put MAILGUN_DOMAIN
   # Form configurations are now in config/forms.json and config/defaults.json
   ```
3. Deploy to a preview environment first:
   ```bash
   npm run deploy:preview
   ```
4. Test the preview URL
5. Deploy to production:
   ```bash
   npm run deploy
   ```

## Security Features

- **Honeypot**: Hidden `_hp` field catches bots
- **Rate Limiting**: Optional IP-based rate limiting
- **Turnstile**: Optional Cloudflare Turnstile verification
- **Input Validation**: Basic validation and sanitization
- **Environment Variables**: Encrypted and secure

## Tips

- Use different `_form` values to test multiple form types
- Test with both HTML forms and JavaScript fetch requests
- Verify CORS works if you plan to use it from different domains
- Test the redirect functionality thoroughly
- Check that honeypot protection works as expected
- Use `wrangler tail` to monitor form submissions in real-time

## Customization

The worker can be customized by modifying `src/worker.ts`:

- Change email format
- Add custom validation
- Modify redirect behavior
- Add additional security measures
- Customize form processing logic

## Troubleshooting

1. **Domain not working**: Ensure your domain is configured in Cloudflare DNS
2. **Email not sending**: Check Mailgun API key and domain configuration
3. **CORS issues**: The worker includes CORS headers for JavaScript clients
4. **Rate limiting**: Check KV namespace configuration if enabled
5. **Multi-form issues**: Verify `FORM_CONFIGS` environment variable is valid JSON