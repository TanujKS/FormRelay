# Form Relay - Cloudflare Worker

A powerful Cloudflare Worker that handles HTML form submissions and forwards them via Mailgun to your email address. Supports single and multiple forms with advanced configuration options.

## Features

- ✅ **Mailgun email integration** - Reliable email delivery
- ✅ **CORS support** - Works with JavaScript clients
- ✅ **Honeypot protection** - Built-in bot protection
- ✅ **Multiple forms** - Support for different form types with custom configurations
- ✅ **Multiple recipients** - Send emails to different addresses per form
- ✅ **Custom redirects** - Custom thank you pages per form
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

### 3. Set Environment Variables

Set the required secrets using Wrangler:

```bash
# Your Mailgun API key
wrangler secret put MAILGUN_API_KEY

# Your Mailgun domain (e.g., "mail.yourdomain.com")
wrangler secret put MAILGUN_DOMAIN

# Email address to receive form submissions
wrangler secret put NOTIFY_TO

# From email address (e.g., "forms@mail.yourdomain.com")
wrangler secret put FROM_EMAIL
```

### 4. Deploy

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

### Form with Custom Redirect

```html
<form action="https://your-worker.workers.dev/submit?redirect=/thank-you" method="POST">
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

fetch('https://your-worker.workers.dev/submit', {
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

## Advanced: Multiple Forms Configuration

The worker supports multiple forms with different configurations, routes, and notification settings.

### URL Structure

- **Default form**: `https://your-worker.workers.dev/submit`
- **Named forms**: `https://your-worker.workers.dev/{form-name}/submit`

### Examples
- `https://your-worker.workers.dev/ecofresh/submit`
- `https://your-worker.workers.dev/contact/submit`
- `https://your-worker.workers.dev/support/submit`

### Configuration Schema

```typescript
type FormConfig = {
  name: string;           // Display name for the form
  notifyTo: string[];     // Array of email addresses to notify
  fromEmail: string;      // From email address
  thankYouUrl?: string;   // Custom thank you page URL
  subject?: string;       // Custom email subject
  enabled?: boolean;      // Enable/disable the form (default: true)
}
```

### Example Configuration

Set the `FORM_CONFIGS` environment variable as a JSON string:

```bash
wrangler secret put FORM_CONFIGS
```

Paste this JSON configuration:

```json
{
  "ecofresh": {
    "name": "EcoFresh Contact Form",
    "notifyTo": [
      "sales@ecofresh.com",
      "support@ecofresh.com"
    ],
    "fromEmail": "noreply@ecofresh.com",
    "thankYouUrl": "/ecofresh/thank-you",
    "subject": "New EcoFresh Contact Form Submission",
    "enabled": true
  },
  "contact": {
    "name": "General Contact Form",
    "notifyTo": [
      "info@yourdomain.com"
    ],
    "fromEmail": "forms@mail.yourdomain.com",
    "thankYouUrl": "/contact/thank-you",
    "subject": "New Contact Form Submission",
    "enabled": true
  }
}
```

### Multi-Form Usage Examples

#### HTML Forms

```html
<!-- EcoFresh form -->
<form action="https://your-worker.workers.dev/ecofresh/submit" method="POST">
  <input type="text" name="name" required>
  <input type="email" name="email" required>
  <textarea name="message" required></textarea>
  <input type="hidden" name="_form" value="ecofresh">
  <button type="submit">Send to EcoFresh</button>
</form>

<!-- General contact form -->
<form action="https://your-worker.workers.dev/contact/submit" method="POST">
  <input type="text" name="name" required>
  <input type="email" name="email" required>
  <textarea name="message" required></textarea>
  <input type="hidden" name="_form" value="contact">
  <button type="submit">Send Message</button>
</form>
```

#### JavaScript Fetch

```javascript
// EcoFresh form submission
const ecofreshData = new FormData();
ecofreshData.append('name', 'John Doe');
ecofreshData.append('email', 'john@example.com');
ecofreshData.append('message', 'Interested in EcoFresh products');

fetch('https://your-worker.workers.dev/ecofresh/submit', {
  method: 'POST',
  body: ecofreshData
});

// General contact form submission
const contactData = new FormData();
contactData.append('name', 'Jane Smith');
contactData.append('email', 'jane@example.com');
contactData.append('message', 'General inquiry');

fetch('https://your-worker.workers.dev/contact/submit', {
  method: 'POST',
  body: contactData
});
```

### Multi-Form Features

- ✅ **Multiple Forms** - Each form can have its own route (`/form-name/submit`)
- ✅ **Multiple Recipients** - Send emails to multiple addresses per form
- ✅ **Custom Email Settings** - Custom from email and subject lines per form
- ✅ **Custom Thank You Pages** - Each form can redirect to its own thank you page
- ✅ **Form Enable/Disable** - Enable or disable individual forms
- ✅ **Fallback Support** - Backward compatible with existing single-form setup

### Fallback Behavior

If a form route doesn't have a specific configuration:

1. **Recipients**: Uses `NOTIFY_TO` environment variable
2. **From Email**: Uses `FROM_EMAIL` environment variable  
3. **Subject**: Uses `"New {form-name} submission"`
4. **Thank You**: Uses `/thank-you` or form's `_redirect` field

## Local Testing

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Edit `.dev.vars` file with your actual Mailgun credentials
   - Replace the placeholder values with your real API key, domain, etc.

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Test the form:**
   - Open `test/index.html` in your browser
   - Fill out and submit the form
   - Check your email for the submission

### Testing Options

#### Option 1: Local Development (Recommended)
```bash
npm run dev
```
- Runs on `http://localhost:8787`
- Uses local environment variables from `.dev.vars`
- Faster iteration and debugging
- No network calls to Cloudflare

#### Option 2: Remote Development
```bash
npm run dev:remote
```
- Runs on Cloudflare's edge network
- Uses actual Cloudflare environment
- Better for testing real-world conditions
- Requires setting up secrets with `wrangler secret put`

### Testing Steps

#### 1. Basic Form Submission Test

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open `test/index.html` in your browser

3. Fill out the form with test data:
   - Name: "Test User"
   - Email: "test@example.com"
   - Subject: "Local Test"
   - Message: "This is a test message from local development"

4. Submit the form

5. Check the console output in your terminal for logs

6. Check your email for the form submission

#### 2. Testing Different Scenarios

**Test Honeypot Protection:**
- Fill out the form normally (should work)
- Try to fill the hidden `_hp` field (should be ignored)

**Test Form Redirects:**
- Add `?redirect=/custom-page` to the form action
- Or add a hidden field: `<input type="hidden" name="_redirect" value="/thank-you">`

**Test Different Form Types:**
- Change the `_form` hidden field value to test different form identifiers

#### 3. Testing with cURL

You can also test the API directly with cURL:

```bash
# Basic form submission
curl -X POST http://localhost:8787/submit \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Test User&email=test@example.com&message=Test message&_form=curl-test"

# JSON submission
curl -X POST http://localhost:8787/submit \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","message":"Test message","_form":"json-test"}'
```

#### 4. Testing Error Handling

```bash
# Wrong method
curl -X GET http://localhost:8787/submit

# Wrong path
curl -X POST http://localhost:8787/wrong-path

# Missing required fields (if you add validation)
curl -X POST http://localhost:8787/submit \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Test User"
```

### Environment Variables for Testing

Make sure your `.dev.vars` file contains:

```bash
MAILGUN_API_KEY=key-your-actual-mailgun-api-key
MAILGUN_DOMAIN=mail.yourdomain.com
NOTIFY_TO=your-email@example.com
FROM_EMAIL=forms@mail.yourdomain.com
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

Example log output:
```
[2025-01-09T23:30:00.000Z] POST /ecofresh/submit - IP: 192.168.1.1
Found form config for: ecofresh
📧 Sending email via Mailgun:
  From: noreply@ecofresh.com
  To: sales@ecofresh.com, support@ecofresh.com
  Subject: New EcoFresh Contact Form Submission
✅ Email sent successfully to: sales@ecofresh.com
✅ Email sent successfully to: support@ecofresh.com
🔄 Redirecting to: /ecofresh/thank-you
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
- Verify the `NOTIFY_TO` email address
- Check Mailgun logs in your dashboard

**Form Not Working:**
- Check if form is enabled in configuration
- Verify the route matches your configuration key
- Check logs with `wrangler tail`

**Emails Not Sending:**
- Verify Mailgun configuration
- Check recipient email addresses
- Ensure form configuration is valid JSON

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
   wrangler secret put NOTIFY_TO
   wrangler secret put FROM_EMAIL
   wrangler secret put FORM_CONFIGS  # If using multi-form setup
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