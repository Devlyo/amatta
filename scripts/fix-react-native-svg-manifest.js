// react-native-svg 15.12.1 + Expo SDK 54 / RN 0.81 (new architecture) fix.
//
// THE BUG: react-native-svg's published `package.json` sets
//   "react-native": "lib/module/index.js"  (the COMPILED output).
// Under the new architecture, `@react-native/babel-plugin-codegen` runs during
// Metro bundling on every file that calls `codegenNativeComponent(...)` and must
// read the TypeScript generic type argument (e.g.
//   codegenNativeComponent<NativeProps>('RNSVGCircle', …))
// to generate the Fabric view config. The compiled `lib/module/fabric/
// *NativeComponent.js` files have that type argument STRIPPED, so codegen throws
//   "Could not find component config for native component"
// the moment any react-native-svg component is actually imported into the bundle
// (e.g. our amatta SVG icons / pickup-banner cars). This fails the Metro bundle
// itself — both `expo start` and the EAS build's JS-bundle phase.
//
// THE FIX: point the `react-native` field at the TYPED SOURCE
//   "react-native": "src/index.ts"
// so Metro resolves react-native-svg to `src/fabric/*.ts`, where the
// `codegenNativeComponent<NativeProps>(…)` type argument is intact and codegen
// succeeds. (This also matches the package's own `codegenConfig.jsSrcsDir:
// "./src/fabric"`.) Verified: `npx expo export -p ios` bundles cleanly with the
// source field, and crashes with the compiled field.
//
// Idempotent postinstall so EAS builds (which run `npm install`) get the fix too.
// Remove once react-native-svg ships a `react-native` field pointing at source,
// or the dep is upgraded past the bug.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const pkgDir = path.join(__dirname, '..', 'node_modules', 'react-native-svg');
const manifestPath = path.join(pkgDir, 'package.json');
const desired = 'src/index.ts';

if (!fs.existsSync(manifestPath)) {
  // Dependency not installed yet (e.g. first npm install with --ignore-scripts).
  process.exit(0);
}

// The source entry must actually exist in this install; if a future tarball
// drops `src/`, bail rather than point at a missing file.
if (!fs.existsSync(path.join(pkgDir, 'src', 'index.ts'))) {
  console.warn(
    '[fix-react-native-svg-manifest] react-native-svg/src/index.ts missing — skipping (cannot point at source)',
  );
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest['react-native'] === desired) {
  process.exit(0); // already correct
}

manifest['react-native'] = desired;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  '[fix-react-native-svg-manifest] patched react-native-svg/package.json react-native field → src/index.ts (new-arch codegen needs the typed source)',
);
