#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -p "require('${repo_dir}/package.json').version")"
spec="${1:-@ianalloway/kelly-js@${version}}"
smoke_dir="$(mktemp -d)"
trap 'rm -rf "$smoke_dir"' EXIT
cd "$smoke_dir"

# A new directory ensures Node resolves the installed tarball, not this checkout.
for attempt in 1 2 3 4 5; do
  if npm install --ignore-scripts --no-audit --no-fund --prefer-online "$spec"; then
    break
  fi
  if [[ "$attempt" == 5 ]]; then
    exit 1
  fi
  sleep 5
done

EXPECTED_VERSION="$version" node <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'node_modules/@ianalloway/kelly-js/package.json'), 'utf8'));
const { kelly, clv, bankrollStats, simultaneousKelly, toDecimal } = require('@ianalloway/kelly-js');

assert.equal(pkg.version, process.env.EXPECTED_VERSION);
assert.equal(kelly(0.58, -110).fraction, 0.118);
assert.equal(kelly(0.58, -110).halfDollars(1000), 59);
assert.equal(clv(-108, -115).verdict, 'positive');
assert.equal(bankrollStats([{ stake: 100, americanOdds: -110, result: 'win' }], 1000).totalBets, 1);
const slate = simultaneousKelly([{ probability: 0.55, decimalOdds: toDecimal(-110) }]);
assert.equal(slate.method, 'exact');
assert.equal(slate.fractions.length, 1);
console.log(`Verified clean install of @ianalloway/kelly-js@${pkg.version}`);
NODE
