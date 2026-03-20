const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// Copy xterm CSS to dist
const xtermCssPath = path.join(__dirname, '..', 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css');
if (fs.existsSync(xtermCssPath)) {
  fs.copyFileSync(xtermCssPath, path.join(distDir, 'xterm.css'));
}

// Bundle renderer JS (includes xterm.js)
esbuild.buildSync({
  entryPoints: [path.join(srcDir, 'renderer.js')],
  bundle: true,
  outfile: path.join(distDir, 'renderer.js'),
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  minify: false,
  sourcemap: true,
});

console.log('Build complete.');
