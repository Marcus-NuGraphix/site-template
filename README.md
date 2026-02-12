# Company Temporary Site (Production)

Production-ready temporary website for `https://example.com/`, built for xneelo shared hosting.

## Live Routes

- `/` - Website under construction splash page
- `/privacy-policy/` - Privacy policy endpoint
- `/delete-my-data/` - Delete-my-data form
- `/delete-my-data/submit.php` - PHP form handler (POST)

Legacy route redirects are included:

- `/privacy-policy.html` -> `/privacy-policy/`
- `/delete-my-data.html` -> `/delete-my-data/`

## Production Structure

- `assets/` - Images, logos, favicon
- `styles/` - CSS tokens/base/layout/components/pages
- `scripts/` - Front-end JS modules
- `privacy-policy/index.html` - Static policy page
- `delete-my-data/index.html` - Form page
- `delete-my-data/submit.php` - Server-side request handler
- `.htaccess` - HTTPS, redirects, headers, cache policy
- `.data/.htaccess` - Protects fallback rate-limit storage path

## Upload to xneelo

1. Upload the full contents of this `site-template` folder into your domain web root (`public_html/`).
2. Ensure SSL is enabled for the domain.
3. Keep `.htaccess` in place so HTTP redirects to HTTPS.
4. Configure mailbox/alias forwarding:
   - Create `delete@<domain>`
   - Forward to your operational inboxes
5. In `delete-my-data/submit.php`, confirm constants match your live domain:
   - `DELETE_REQUEST_TO`
   - `MAIL_FROM`

Reference docs aligned:

- "How to set up mail forwarding via the xneelo Control Panel"
- "Force HTTPS using a .htaccess file via the xneelo Control Panel"
- "Is PHP available with all web hosting packages?"
- "Do you support SendMail on your servers?"

## Security and Behavior

- Form submits same-origin to `/delete-my-data/submit.php`.
- Server-side validation is authoritative.
- Anti-spam controls:
  - Honeypot field
  - Minimum submit time
  - IP rate limiting
- Uses `From: no-reply@<domain>` and `Reply-To: requester email`.
- Returns JSON responses with safe user-facing errors.

## Pre-Launch Checklist

1. `http://<domain>/` redirects to `https://<domain>/`
2. `/privacy-policy/` and `/delete-my-data/` load correctly
3. `/privacy-policy.html` and `/delete-my-data.html` return 301 redirects
4. Delete form successful submit returns success and sends email to `delete@<domain>`
5. Security headers are present (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`)
6. `robots.txt` currently disallows indexing for temporary phase
7. `sitemap.xml` lists `/`, `/privacy-policy/`, `/delete-my-data/`

## Local Quick Check (Optional)

Serve from this folder as web root:

```powershell
python -m http.server 8080
```

Then open:

- `http://localhost:8080/`
- `http://localhost:8080/privacy-policy/`
- `http://localhost:8080/delete-my-data/`

Note: `python -m http.server` does not execute PHP; use hosting or a PHP-capable server for form endpoint tests.
