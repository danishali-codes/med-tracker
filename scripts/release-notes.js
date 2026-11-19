// Prints the versions in CHANGELOG.md as JSON lines: {version, tag, commit, notes}.
// Used by the release job to create one GitHub release per version.
const fs = require('fs');
const text = fs.readFileSync(process.argv[2] || 'CHANGELOG.md', 'utf8');
const parts = text.split(/^## /m).slice(1);
for (const part of parts) {
  const [head, ...rest] = part.split('\n');
  const version = head.trim();
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) continue;
  let body = rest.join('\n');
  const m = body.match(/^commit: *([0-9a-f]{7,40}) *\n/m);
  const commit = m ? m[1] : null;
  if (m) body = body.replace(m[0], '');
  console.log(JSON.stringify({ version, tag: version.split('.').length === 2 ? `v${version}.0` : `v${version}`, commit, notes: body.trim() + '\n' }));
}
