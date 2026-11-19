import { latestRelease, RELEASES_PAGE, CACHE } from './_release.js';

// /download always sends you to the newest APK, whatever its file name.
export default async function handler(req, res) {
  let target = RELEASES_PAGE;
  try {
    const rel = await latestRelease();
    if (rel.apk) target = rel.apk;
    res.setHeader('Cache-Control', CACHE);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.redirect(302, target);
}
