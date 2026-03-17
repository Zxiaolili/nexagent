#!/usr/bin/env node
/**
 * Scans tracked files for potential secrets / key-like patterns.
 * Exits with 1 if any match is found (to block git push).
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

// Files/dirs to skip (same idea as .gitignore for scan)
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'scripts']);
const SKIP_FILES = new Set(['secret-scan.js', 'pnpm-lock.yaml']);
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.env', '.yaml', '.yml', '.md']);

// Patterns: [ /regex/, description ]
const PATTERNS = [
  [/api[_-]?key\s*=\s*["'][^"']{8,}["']/i, 'API key assignment'],
  [/apikey\s*[:=]\s*["'][^"']{8,}["']/i, 'API key'],
  [/secret\s*=\s*["'][^"']{6,}["']/i, 'Secret assignment'],
  [/password\s*[:=]\s*["'][^"']+["']/i, 'Password in plain text'],
  [/bearer\s+[a-zA-Z0-9_\-]{20,}/i, 'Bearer token'],
  [/sk-[a-zA-Z0-9]{20,}/i, 'OpenAI-style API key (sk-...)'],
  [/sk_live_[a-zA-Z0-9]+/i, 'Stripe live secret key'],
  [/sk_test_[a-zA-Z0-9]+/i, 'Stripe test secret key'],
  [/AKIA[0-9A-Z]{16}/i, 'AWS access key ID'],
  [/ghp_[a-zA-Z0-9]{36}/i, 'GitHub personal access token'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/m, 'Private key block'],
  [/["'][a-zA-Z0-9_-]{32,}["']\s*(#.*)?(api[_-]?key|secret|token)/im, 'Long token-like value with key/secret/token comment'],
];

function getTrackedFiles() {
  const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf-8' });
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((p) => resolve(ROOT, p));
}

function shouldScan(filePath) {
  const rel = relative(ROOT, filePath);
  const parts = rel.split(/[/\\]/);
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  const base = parts[parts.length - 1];
  if (SKIP_FILES.has(base)) return false;
  const ext = base.includes('.') ? '.' + base.split('.').pop() : '';
  return SCAN_EXT.has(ext) || base.startsWith('.env');
}

function scanFile(filePath) {
  const rel = relative(ROOT, filePath);
  if (!existsSync(filePath)) return [];
  let text;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  const lines = text.split('\n');
  const hits = [];
  for (const [re, desc] of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push({ file: rel, line: i + 1, desc, content: lines[i].trim().slice(0, 80) });
      }
    }
  }
  return hits;
}

const files = getTrackedFiles().filter(shouldScan);
const allHits = [];
for (const f of files) {
  allHits.push(...scanFile(f));
}

if (allHits.length > 0) {
  console.error('Secret scan found potential secrets (push blocked):\n');
  for (const h of allHits) {
    console.error(`  ${h.file}:${h.line}  [${h.desc}]`);
    console.error(`    ${h.content}`);
  }
  process.exit(1);
}
console.log('Secret scan: no potential secrets found.');
process.exit(0);
