# sabr.danishali.dev

The one-page website for Sabr. Plain HTML, CSS and a little JavaScript, hosted on Vercel.

- `public/`: the page, styles, fonts (Nunito, SIL Open Font License, served from this site) and icons.
- `build.mjs`: copies `public/` to `dist/` and adds the screenshots of the newest version from `../docs/screenshots/`, so a new release's screenshots show up on the next deploy.
- `api/latest.js`: the newest release's version and APK size, for the line under the download button.
- `api/download.js`: `/download` redirects to the newest release's APK, whatever its file name.

Both API routes ask GitHub on the server and are cached for 10 minutes, so the page itself never contacts GitHub. The site has no cookies, analytics or third-party requests, and its Content-Security-Policy only allows its own files.

## Run it locally

```bash
cd website
node build.mjs
npx serve dist        # the /download and /api routes need `npx vercel dev` instead
```

## Vercel settings

Root directory `website`. Everything else comes from `vercel.json`.
