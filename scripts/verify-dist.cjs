#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcPath = path.join(root, 'src', 'index.ts');
const distPath = path.join(root, 'dist', 'index.js');
const dtsPath = path.join(root, 'dist', 'index.d.ts');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fail(message, details = []) {
  console.error(`dist verification failed: ${message}`);
  for (const detail of details) console.error(`  - ${detail}`);
  process.exit(1);
}

const source = read(srcPath);
const expectedFunctions = [...source.matchAll(/^export function\s+([A-Za-z_$][\w$]*)\b/gm)]
  .map((match) => match[1])
  .sort();

if (expectedFunctions.length === 0) {
  fail('no exported functions found in src/index.ts');
}

const runtimeExports = require(distPath);
const declarations = read(dtsPath);

const missingRuntime = expectedFunctions.filter((name) => typeof runtimeExports[name] !== 'function');
const missingTypes = expectedFunctions.filter(
  (name) => !new RegExp(`export declare function\\s+${name}\\b`).test(declarations)
);

if (missingRuntime.length > 0 || missingTypes.length > 0) {
  fail('dist artifacts are stale or incomplete', [
    missingRuntime.length > 0 ? `missing runtime exports: ${missingRuntime.join(', ')}` : null,
    missingTypes.length > 0 ? `missing type declarations: ${missingTypes.join(', ')}` : null,
  ].filter(Boolean));
}

console.log(`Verified ${expectedFunctions.length} public function exports in dist/index.js and dist/index.d.ts.`);
