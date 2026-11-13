#!/usr/bin/env node
// Proves that compiled TypeScript is the same program as the hand-edited JavaScript
// that used to be committed in bot-worker/dist (WP-20, step 1 and 2).
//
// Both sides are JavaScript. Each is parsed with the TypeScript compiler, comments and
// whitespace are dropped (they are trivia to the scanner), and module boilerplate is
// set aside: "use strict", the __esModule marker, the emit helpers, `exports.x = ...`
// and `module.exports = {...}`, and the require() statements. Imports and exports are
// then compared as sets, and every other top-level statement is compared token by
// token. Imported names are written the way TypeScript emits them (`logger_js_1.logger`,
// `(0, mod_1.fn)`), so those are rewritten back to the bare name first.
//
// Usage:
//   node scripts/equivalence-check.cjs <old.js> <new.js> [--verbose]
//   node scripts/equivalence-check.cjs --rev <git-rev> <compiled-dir> <name...>
//     compares `git show <rev>:bot-worker/dist/<name>.js` with <compiled-dir>/<name>.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('typescript');

const HELPERS = new Set(['__createBinding', '__setModuleDefault', '__importStar', '__importDefault']);

const KEYWORDS_BEFORE_EXPRESSION = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete',
  'void', 'throw', 'instanceof', 'yield', 'await']);

function tokensOf(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ true, ts.LanguageVariant.Standard, text);
  const out = [];
  // One entry per open `${`: how many plain `{` are open inside that substitution.
  const templateDepth = [];
  let kind = scanner.scan();
  while (kind !== ts.SyntaxKind.EndOfFileToken) {
    if (kind === ts.SyntaxKind.SlashToken || kind === ts.SyntaxKind.SlashEqualsToken) {
      // Regex or divide, decided the way the parser would: after an operand it is a divide.
      const prev = out[out.length - 1];
      const operandEnd = prev && !KEYWORDS_BEFORE_EXPRESSION.has(prev) && (/^[\w$)\]]/.test(prev) || /^['"`\d]/.test(prev));
      if (!operandEnd) kind = scanner.reScanSlashToken();
    }
    if (kind === ts.SyntaxKind.OpenBraceToken && templateDepth.length) templateDepth[templateDepth.length - 1]++;
    if (kind === ts.SyntaxKind.CloseBraceToken && templateDepth.length) {
      if (templateDepth[templateDepth.length - 1] === 0) {
        kind = scanner.reScanTemplateToken(false);
        templateDepth.pop();
      } else {
        templateDepth[templateDepth.length - 1]--;
      }
    }
    if (kind === ts.SyntaxKind.TemplateHead || kind === ts.SyntaxKind.TemplateMiddle) templateDepth.push(0);
    let t = scanner.getTokenText();
    if (kind === ts.SyntaxKind.StringLiteral) t = JSON.stringify(scanner.getTokenValue());
    out.push(t);
    kind = scanner.scan();
  }
  return out;
}

/** Statement-level split with the parser; returns { imports, exports, body: string[][] }. */
function analyse(text) {
  const sf = ts.createSourceFile('x.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const imports = new Map(); // alias -> { spec, kind, names? }
  const exportNames = new Set();
  const body = [];
  const isRequire = (e) => e && ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'require'
    && e.arguments.length === 1 && ts.isStringLiteral(e.arguments[0]);
  const unwrapHelper = (e) => (e && ts.isCallExpression(e) && ts.isIdentifier(e.expression) && HELPERS.has(e.expression.text)) ? e.arguments[0] : e;
  const specOf = (s) => s.replace(/\.js$/, '');

  for (const st of sf.statements) {
    const src = st.getText(sf);
    if (ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression) && st.expression.text === 'use strict') continue;
    if (/^Object\.defineProperty\(exports, "__esModule"/.test(src)) continue;
    if (ts.isVariableStatement(st)) {
      const d = st.declarationList.declarations;
      if (d.length === 1 && ts.isIdentifier(d[0].name) && HELPERS.has(d[0].name.text)) continue;
      if (d.length === 1 && d[0].initializer) {
        const init = unwrapHelper(d[0].initializer);
        const wrapped = init !== d[0].initializer ? d[0].initializer.expression.text : null;
        if (isRequire(init)) {
          const spec = specOf(init.arguments[0].text);
          if (ts.isIdentifier(d[0].name)) {
            imports.set(d[0].name.text, { spec, kind: wrapped === '__importDefault' ? 'default' : 'namespace' });
          } else if (ts.isObjectBindingPattern(d[0].name)) {
            for (const el of d[0].name.elements) {
              const local = el.name.getText(sf);
              const imported = el.propertyName ? el.propertyName.getText(sf) : local;
              imports.set(local, { spec, kind: 'named', imported });
            }
          }
          continue;
        }
      }
    }
    if (ts.isExpressionStatement(st) && ts.isBinaryExpression(st.expression)
      && st.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = st.expression.left.getText(sf);
      const m = /^exports\.([\w$]+)$/.exec(left);
      if (m) {
        // `exports.a = exports.b = void 0;` chains and `exports.a = a;`
        let e = st.expression;
        const names = [m[1]];
        while (ts.isBinaryExpression(e.right) && /^exports\.[\w$]+$/.test(e.right.left.getText(sf))) {
          names.push(e.right.left.getText(sf).slice(8));
          e = e.right;
        }
        const rhs = e.right.getText(sf);
        if (rhs === 'void 0' || names.every((n) => n === rhs)) { names.forEach((n) => exportNames.add(n)); continue; }
      }
      if (left === 'module.exports' && ts.isObjectLiteralExpression(st.expression.right)) {
        for (const p of st.expression.right.properties) exportNames.add(p.name.getText(sf));
        continue;
      }
    }
    body.push(src);
  }
  // `export const x = ...` compiles to `exports.x = ...` uses inside the body; a plain
  // `const x = ...` with `module.exports = { x }` does not. Rewrite the former.
  const rewritten = body.map((src) => rewriteAliases(tokensOf(src), imports, exportNames));
  return { imports, exportNames, body: rewritten };
}

function rewriteAliases(tokens, imports, exportNames) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // (0, alias.name)  ->  name
    if (t === '(' && tokens[i + 1] === '0' && tokens[i + 2] === ',' && imports.has(tokens[i + 3])
      && tokens[i + 4] === '.' && tokens[i + 6] === ')') {
      out.push(tokens[i + 5]); i += 6; continue;
    }
    // alias.name -> name (named import); alias.default -> alias (default import)
    if (imports.has(t) && tokens[i + 1] === '.' && out[out.length - 1] !== '.') {
      const imp = imports.get(t);
      if (imp.kind === 'default' && tokens[i + 2] === 'default') { out.push(`<default:${imp.spec}>`); i += 2; continue; }
      if (/^[\w$]+_\d+$/.test(t)) { out.push(tokens[i + 2]); i += 2; continue; }
    }
    if (t === 'exports' && tokens[i + 1] === '.' && exportNames.has(tokens[i + 2]) && out[out.length - 1] !== '.') {
      out.push(tokens[i + 2]); i += 2; continue;
    }
    out.push(t);
  }
  return out.join(' ');
}

function importSet(imports) {
  const set = new Set();
  for (const [alias, imp] of imports) {
    if (imp.kind === 'named') set.add(`${imp.spec}#${imp.imported}`);
    else if (/^[\w$]+_\d+$/.test(alias)) set.add(`${imp.spec}#*`); // named imports via an emitted alias
    else set.add(`${imp.spec}#${imp.kind === 'default' ? 'default' : '*'} as ${alias}`);
  }
  return set;
}

function compare(oldText, newText, label, verbose) {
  const a = analyse(oldText);
  const b = analyse(newText);
  const problems = [];
  const ea = [...a.exportNames].sort().join(','), eb = [...b.exportNames].sort().join(',');
  if (ea !== eb) problems.push(`exports differ:\n  old: ${ea}\n  new: ${eb}`);
  // Imports: compare module specifiers; named-vs-alias forms are equivalent once rewritten.
  const sa = new Set([...a.imports.values()].map((i) => i.spec));
  const sb = new Set([...b.imports.values()].map((i) => i.spec));
  const ia = [...sa].sort().join(','), ib = [...sb].sort().join(',');
  if (ia !== ib) problems.push(`imported modules differ:\n  old: ${ia}\n  new: ${ib}`);
  const n = Math.max(a.body.length, b.body.length);
  let differing = 0;
  for (let i = 0; i < n; i++) {
    if (a.body[i] !== b.body[i]) {
      differing++;
      const ta = (a.body[i] || '<none>').split(' '), tb = (b.body[i] || '<none>').split(' ');
      let k = 0;
      while (k < ta.length && ta[k] === tb[k]) k++;
      const from = Math.max(0, k - 12);
      if (verbose || differing <= 3) problems.push(`statement ${i + 1} differs at token ${k}:\n  old: …${ta.slice(from, k + 25).join(' ')}\n  new: …${tb.slice(from, k + 25).join(' ')}`);
    }
  }
  const tokens = a.body.reduce((s, x) => s + x.split(' ').length, 0);
  const summary = `${label}: ${a.body.length} vs ${b.body.length} top-level statements, ${tokens} tokens, ` +
    `${differing} differing; exports [${ea}]; imports [${ia}]`;
  return { ok: problems.length === 0, summary, problems };
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const rest = args.filter((x) => x !== '--verbose');
  const pairs = [];
  if (rest[0] === '--rev') {
    const [, rev, dir, ...names] = rest;
    for (const name of names) {
      const oldText = execFileSync('git', ['show', `${rev}:bot-worker/dist/${name}.js`], { encoding: 'utf8', maxBuffer: 1 << 26 });
      pairs.push([name, oldText, fs.readFileSync(path.join(dir, `${name}.js`), 'utf8')]);
    }
  } else {
    pairs.push([rest[1], fs.readFileSync(rest[0], 'utf8'), fs.readFileSync(rest[1], 'utf8')]);
  }
  let failed = 0;
  for (const [label, oldText, newText] of pairs) {
    const r = compare(oldText.replace(/\r/g, ''), newText.replace(/\r/g, ''), label, verbose);
    console.log(`${r.ok ? 'EQUIVALENT' : 'DIFFERENT '} ${r.summary}`);
    for (const p of r.problems) console.log('  ' + p.replace(/\n/g, '\n  '));
    if (!r.ok) failed++;
  }
  process.exit(failed ? 1 : 0);
}

main();
