// Workaround for react-native-svg 15.12.1 whose npm tarball ships a
// `react-native` field pointing at `src/index.ts` — a source file that
// isn't included in the published tarball. Metro picks `react-native` over
// `main`, then fails to resolve the missing file. The package's built
// output at `lib/module/index.js` is shipped fine.
//
// Some npm caches resolve the package correctly (patch-package's clean
// install did) while ours from `expo install` did not. To be robust against
// either, this postinstall step idempotently rewrites the manifest field
// if it still points at `src/index.ts`.
//
// Tracked upstream: https://github.com/software-mansion/react-native-svg/issues
// Remove this script + the postinstall hook once the upstream tarball ships
// a working `react-native` field (or once the dep is upgraded past the bug).

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const manifestPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-svg',
  'package.json',
);

if (!fs.existsSync(manifestPath)) {
  // Dependency not installed yet (e.g. first npm install with --ignore-scripts).
  // Nothing to fix — exit cleanly.
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const current = manifest['react-native'];
const desired = 'lib/module/index.js';

if (current === desired) {
  // Already correct (e.g. upstream fixed, or a previous postinstall ran).
  process.exit(0);
}

if (current !== 'src/index.ts') {
  // Some other unexpected value — log and bail so we don't clobber an
  // intentional override.
  console.warn(
    `[fix-react-native-svg-manifest] expected "react-native": "src/index.ts", got ${JSON.stringify(current)} — skipping`,
  );
  process.exit(0);
}

manifest['react-native'] = desired;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  '[fix-react-native-svg-manifest] patched react-native-svg/package.json react-native field → lib/module/index.js',
);
