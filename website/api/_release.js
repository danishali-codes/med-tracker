// Looks up the newest Sabr release on GitHub. Called from this site's server only, and the
// answer is cached at Vercel's edge, so visitors' browsers never contact GitHub just to view
// the page.
export const REPO = 'danishali-codes/sabr-med-tracker';
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

export async function latestRelease() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sabr-website' },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const rel = await res.json();
  const apk = (rel.assets || []).find((a) => a.name.endsWith('.apk'));
  return {
    version: String(rel.tag_name || '').replace(/^v/, ''),
    published: rel.published_at,
    page: rel.html_url,
    apk: apk ? apk.browser_download_url : null,
    size: apk ? apk.size : null,
  };
}

// Fresh for 10 minutes at the edge, then served stale for up to a day while it refreshes.
export const CACHE = 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400';
