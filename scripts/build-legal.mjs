// Builds the public legal pages (docs/legal/privacy-policy.html, terms.html)
// from src/legal/legal-text.ts — the same text the in-app screen shows.
// Run: npm run legal:build   → then re-host docs/legal/ (GitHub Pages: devlyo/amatta-legal).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const out = await build({
  entryPoints: ['src/legal/legal-text.ts'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
});
const mod = { exports: {} };
new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, createRequire(import.meta.url));
const { EFFECTIVE_DATE, LEGAL_INTRO, PRIVACY_SECTIONS, TERMS_SECTIONS } = mod.exports;
const version = JSON.parse(readFileSync('app.json', 'utf8')).expo.version;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STYLE = `    :root { color-scheme: light; }
    body {
      margin: 0; padding: 24px 16px 64px;
      font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", sans-serif;
      color: #1d1d1b; background: #ffffff; line-height: 1.7;
      -webkit-text-size-adjust: 100%;
    }
    main { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 24px; letter-spacing: -0.5px; margin: 0 0 4px; }
    .eff { color: #8a8a86; font-size: 14px; margin: 0 0 28px; }
    .intro { color: #4a4a47; font-size: 15px; margin: 0 0 32px; }
    h2 { font-size: 17px; letter-spacing: -0.3px; margin: 32px 0 8px; }
    p { font-size: 15px; margin: 0 0 10px; color: #2a2a29; }
    ul { margin: 8px 0 12px; padding-left: 20px; }
    li { font-size: 15px; margin: 4px 0; color: #2a2a29; }
    footer { margin-top: 40px; color: #8a8a86; font-size: 13px; }`;

function page(title, sections) {
  const body = sections
    .map((s, i) => {
      const ps = s.paragraphs.map((p) => `  <p>${esc(p)}</p>`).join('\n');
      const ul = s.bullets ? `\n  <ul>\n${s.bullets.map((b) => `    <li>${esc(b)}</li>`).join('\n')}\n  </ul>` : '';
      return `  <h2>${i + 1}. ${esc(s.title)}</h2>\n${ps}${ul}`;
    })
    .join('\n\n');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WeMoa ${title}</title>
  <style>
${STYLE}
  </style>
</head>
<body>
<main>
  <h1>WeMoa ${title}</h1>
  <p class="eff">시행일: ${esc(EFFECTIVE_DATE)}</p>

  <p class="intro">${esc(LEGAL_INTRO)}</p>

${body}

  <footer>WeMoa v${version} · ${esc(EFFECTIVE_DATE)} 기준</footer>
</main>
</body>
</html>
`;
}

writeFileSync('docs/legal/privacy-policy.html', page('개인정보처리방침', PRIVACY_SECTIONS));
writeFileSync('docs/legal/terms.html', page('이용약관', TERMS_SECTIONS));
console.log(`docs/legal/*.html — v${version}, 시행일 ${EFFECTIVE_DATE}`);
