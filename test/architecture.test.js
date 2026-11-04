// Guards the layer rules from docs/PLAN.md:
//   core   -> core only
//   sim    -> core, sim
//   editor -> core, sim, editor
//   client -> everything
// core/, sim/ and editor/ must also stay free of browser APIs and of
// nondeterminism (wall-clock time, Math.random).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const ALLOWED_IMPORTS = {
  core: ['core'],
  sim: ['core', 'sim'],
  editor: ['core', 'sim', 'editor'],
  client: ['core', 'sim', 'editor', 'client'],
};
const PURE_LAYERS = ['core', 'sim', 'editor'];

const FORBIDDEN_APIS = [
  [/\bdocument\b/, 'document'],
  [/\bwindow\b/, 'window'],
  [/\bnavigator\b/, 'navigator'],
  [/\bcanvas\b/i, 'canvas'],
  [/\bgetContext\b/, 'getContext'],
  [/\brequestAnimationFrame\b/, 'requestAnimationFrame'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bperformance\s*\.\s*now\b/, 'performance.now'],
  [/\bDate\s*\.\s*now\b/, 'Date.now'],
  [/\bnew\s+Date\b/, 'new Date'],
  [/\bMath\s*\.\s*random\b/, 'Math.random'],
];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function importSpecifiers(source) {
  const specifiers = [];
  const pattern =
    /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1] ?? match[2] ?? match[3]);
  }
  return specifiers;
}

/** Returns a list of human-readable violations for one file. */
function analyze(source, filePath) {
  const layer = path.relative(srcDir, filePath).split(path.sep)[0];
  const code = stripComments(source);
  const violations = [];

  if (PURE_LAYERS.includes(layer)) {
    for (const [pattern, name] of FORBIDDEN_APIS) {
      if (pattern.test(code)) violations.push(`uses forbidden API "${name}"`);
    }
  }

  for (const specifier of importSpecifiers(code)) {
    if (!specifier.startsWith('.')) {
      if (PURE_LAYERS.includes(layer)) violations.push(`imports external module "${specifier}"`);
      continue;
    }
    const target = path.resolve(path.dirname(filePath), specifier);
    const targetLayer = path.relative(srcDir, target).split(path.sep)[0];
    if (!ALLOWED_IMPORTS[targetLayer]) {
      violations.push(`imports "${specifier}", which is outside src/ layers`);
    } else if (!ALLOWED_IMPORTS[layer].includes(targetLayer)) {
      violations.push(`layer "${layer}" may not import from layer "${targetLayer}" ("${specifier}")`);
    }
  }
  return violations;
}

// --- The guard must actually catch things -----------------------------------

test('scanner flags browser APIs and nondeterminism in pure layers', () => {
  const file = path.join(srcDir, 'sim', 'x.js');
  for (const bad of [
    'const t = Date.now();',
    'const r = Math.random();',
    'document.title = "x";',
    'const t = performance.now();',
    'localStorage.setItem("a", "b");',
  ]) {
    assert.ok(analyze(bad, file).length > 0, `should flag: ${bad}`);
  }
});

test('scanner ignores forbidden words in comments', () => {
  const file = path.join(srcDir, 'sim', 'x.js');
  assert.deepEqual(analyze('// uses document and Math.random\n/* window */\nconst a = 1;', file), []);
});

test('scanner allows browser APIs in the client layer', () => {
  const file = path.join(srcDir, 'client', 'x.js');
  assert.deepEqual(analyze('const t = performance.now(); document.title = "x";', file), []);
});

test('scanner enforces import directions', () => {
  const sim = path.join(srcDir, 'sim', 'x.js');
  const core = path.join(srcDir, 'core', 'x.js');
  const editor = path.join(srcDir, 'editor', 'x.js');
  const client = path.join(srcDir, 'client', 'x.js');

  assert.ok(analyze("import { a } from '../client/App.js';", sim).length > 0);
  assert.ok(analyze("import { a } from '../editor/History.js';", sim).length > 0);
  assert.ok(analyze("import { a } from '../sim/World.js';", core).length > 0);
  assert.ok(analyze("import { a } from '../client/App.js';", editor).length > 0);
  assert.ok(analyze("import fs from 'node:fs';", sim).length > 0);

  assert.deepEqual(analyze("import { a } from '../core/math.js';", sim), []);
  assert.deepEqual(analyze("import { a } from '../sim/World.js';", editor), []);
  assert.deepEqual(analyze("import { a } from '../sim/World.js';\nexport * from '../editor/History.js';", client), []);
});

test('scanner handles multi-line import lists', () => {
  const sim = path.join(srcDir, 'sim', 'x.js');
  const source = "import {\n  a,\n  b,\n} from '../client/App.js';";
  assert.ok(analyze(source, sim).length > 0);
});

// --- The real source tree ----------------------------------------------------

function jsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(dir, name));
}

for (const layer of Object.keys(ALLOWED_IMPORTS)) {
  test(`src/${layer} respects the architecture rules`, () => {
    const problems = [];
    for (const file of jsFiles(path.join(srcDir, layer))) {
      for (const violation of analyze(fs.readFileSync(file, 'utf8'), file)) {
        problems.push(`${path.relative(srcDir, file)}: ${violation}`);
      }
    }
    assert.deepEqual(problems, []);
  });
}
