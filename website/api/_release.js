// Looks up the newest Sabr release on GitHub. Called from this site's server only, and the
// answer is cached at Vercel's edge, so visitors' browsers never contact GitHub just to view
// the page.
export const REPO = 'danishali-codes/sabr-med-tracker';
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

export async function latestRelease() {
  // Not /releases/latest: every merge to main also recreates a rolling "latest" build
  // release (a SHA-named APK that is deleted on the next merge), and GitHub can mark that
  // one as latest. Only versioned releases (v0.6.0...) keep their APK URL for good.
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sabr-website' },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const releases = await res.json();
  return pickRelease(releases);
}

export function pickRelease(releases) {
  const versioned = releases
    .filter((r) => !r.draft && !r.prerelease && /^v\d+(\.\d+)*$/.test(r.tag_name || ''))
    .map((r) => ({ r, apk: (r.assets || []).find((a) => a.name.endsWith('.apk')) }))
    .filter((x) => x.apk)
    .sort((a, b) => compareVersions(b.r.tag_name, a.r.tag_name));
  if (!versioned.length) throw new Error('No versioned release with an APK');
  const { r, apk } = versioned[0];
  return {
    version: r.tag_name.replace(/^v/, ''),
    published: r.published_at,
    page: r.html_url,
    apk: apk.browser_download_url,
    size: apk.size,
  };
}

function compareVersions(a, b) {
  const x = a.slice(1).split('.').map(Number);
  const y = b.slice(1).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
}

// Fresh for 10 minutes at the edge, then served stale for up to a day while it refreshes.
export const CACHE = 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400';
