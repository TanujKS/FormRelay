# Local Testing Guide

This guide explains how to test your form handling Cloudflare Worker locally using Wrangler.

## Quick Start

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
   - Open `test-form.html` in your browser
   - Fill out and submit the form
   - Check your email for the submission

## Testing Options

### Option 1: Local Development (Recommended)
```bash
npm run dev
```
- Runs on `http://localhost:8787`
- Uses local environment variables from `.dev.vars`
- Faster iteration and debugging
- No network calls to Cloudflare

### Option 2: Remote Development
```bash
npm run dev:remote
```
- Runs on Cloudflare's edge network
- Uses actual Cloudflare environment
- Better for testing real-world conditions
- Requires setting up secrets with `wrangler secret put`

## Testing Steps

### 1. Basic Form Submission Test

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open `test-form.html` in your browser

3. Fill out the form with test data:
   - Name: "Test User"
   - Email: "test@example.com"
   - Subject: "Local Test"
   - Message: "This is a test message from local development"

4. Submit the form

5. Check the console output in your terminal for logs

6. Check your email for the form submission

### 2. Testing Different Scenarios

#### Test Honeypot Protection
- Fill out the form normally (should work)
- Try to fill the hidden `_hp` field (should be ignored)

#### Test Form Redirects
- Add `?redirect=/custom-page` to the form action
- Or add a hidden field: `<input type="hidden" name="_redirect" value="/thank-you">`

#### Test Different Form Types
- Change the `_form` hidden field value to test different form identifiers

### 3. Testing with cURL

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

### 4. Testing Error Handling

#### Test Invalid Requests
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

#### "Connection Error" in Browser
- Make sure Wrangler dev server is running
- Check that it's running on the correct port (8787)
- Try refreshing the page

#### "Mailgun failed" Error
- Check your API key in `.dev.vars`
- Verify your Mailgun domain is correct
- Ensure your Mailgun account is active

#### Email Not Received
- Check spam folder
- Verify the `NOTIFY_TO` email address
- Check Mailgun logs in your dashboard

## Environment Variables for Testing

Make sure your `.dev.vars` file contains:

```bash
MAILGUN_API_KEY=key-your-actual-mailgun-api-key
MAILGUN_DOMAIN=mail.tanuj.xyz
NOTIFY_TO=your-email@example.com
FROM_EMAIL=forms@mail.tanuj.xyz
```

## Production Testing

Before deploying to production:

1. Test with `npm run dev:remote` to use Cloudflare's edge
2. Set up your production secrets:
   ```bash
   wrangler secret put MAILGUN_API_KEY
   wrangler secret put MAILGUN_DOMAIN
   wrangler secret put NOTIFY_TO
   wrangler secret put FROM_EMAIL
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

## Tips

- Use different `_form` values to test multiple form types
- Test with both HTML forms and JavaScript fetch requests
- Verify CORS works if you plan to use it from different domains
- Test the redirect functionality thoroughly
- Check that honeypot protection works as expected
