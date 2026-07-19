const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('docs').filter(f => f.startsWith('RELEASE_NOTES_')).sort((a, b) => {
  const va = a.replace('RELEASE_NOTES_', '').replace('.txt', '').split('.').map(Number);
  const vb = b.replace('RELEASE_NOTES_', '').replace('.txt', '').split('.').map(Number);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const diff = (va[i] || 0) - (vb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
});

let changelog = `# Changelog

Todas las versiones relevantes de R+.

Formato basado en [Keep a Changelog](https://keepachangelog.com/).
`;

for (const f of files) {
  const ver = f.replace('RELEASE_NOTES_', '').replace('.txt', '');
  const content = fs.readFileSync(path.join('docs', f), 'utf-8').trim();
  changelog += `\n## [${ver}](docs/${f})\n\n${content}\n\n`;
}

fs.writeFileSync('CHANGELOG.md', changelog);
console.log('CHANGELOG.md created: ' + changelog.length + ' bytes');
