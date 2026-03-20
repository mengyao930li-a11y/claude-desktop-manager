/**
 * Patches @electron/node-gyp to support Visual Studio 2025 (v18).
 * Run after npm install and before electron-rebuild.
 */
const fs = require('fs');
const path = require('path');

const findVsPath = path.join(
  __dirname, '..', 'node_modules', '@electron', 'node-gyp', 'lib', 'find-visualstudio.js'
);
const buildJsPath = path.join(
  __dirname, '..', 'node_modules', '@electron', 'node-gyp', 'lib', 'build.js'
);

if (!fs.existsSync(findVsPath)) {
  console.log('find-visualstudio.js not found, skipping patch.');
  process.exit(0);
}

let src = fs.readFileSync(findVsPath, 'utf-8');
let changed = false;

// 1. Add VS 2025 to supported years arrays
const yearPatterns = [
  { from: /\[2019,\s*2022\]/g, to: '[2019, 2022, 2025]' },
];
for (const p of yearPatterns) {
  if (p.from.test(src)) {
    src = src.replace(p.from, p.to);
    changed = true;
  }
}

// 2. Add version major 18 -> year 2025 mapping
if (!src.includes('ret.versionMajor === 18')) {
  src = src.replace(
    /if \(ret\.versionMajor === 17\) \{\s*\n\s*ret\.versionYear = 2022\s*\n\s*return ret\s*\n\s*\}/,
    `if (ret.versionMajor === 17) {\n      ret.versionYear = 2022\n      return ret\n    }\n    if (ret.versionMajor === 18) {\n      ret.versionYear = 2025\n      return ret\n    }`
  );
  changed = true;
}

// 3. Add toolset v145 for year 2025
if (!src.includes("versionYear === 2025")) {
  src = src.replace(
    /else if \(versionYear === 2022\) \{\s*\n\s*return 'v143'\s*\n\s*\}/,
    `else if (versionYear === 2022) {\n      return 'v143'\n    } else if (versionYear === 2025) {\n      return 'v145'\n    }`
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(findVsPath, src);
  console.log('Patched find-visualstudio.js for VS 2025 support.');
} else {
  console.log('find-visualstudio.js already patched or does not need patching.');
}

// 4. Disable Spectre mitigation in MSBuild args
if (fs.existsSync(buildJsPath)) {
  let buildSrc = fs.readFileSync(buildJsPath, 'utf-8');
  if (!buildSrc.includes('SpectreMitigation=false')) {
    buildSrc = buildSrc.replace(
      /argv\.push\('\/p:Configuration=' \+ buildType \+ ';Platform=' \+ p\)/,
      "argv.push('/p:Configuration=' + buildType + ';Platform=' + p + ';SpectreMitigation=false')"
    );
    fs.writeFileSync(buildJsPath, buildSrc);
    console.log('Patched build.js to disable Spectre mitigation.');
  }
}
