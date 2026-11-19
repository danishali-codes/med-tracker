import { latestRelease, CACHE } from './_release.js';

export default async function handler(req, res) {
  try {
    const rel = await latestRelease();
    res.setHeader('Cache-Control', CACHE);
    res.status(200).json(rel);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'Could not reach GitHub' });
  }
}
