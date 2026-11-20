// Under ESM a CommonJS package imported with `import * as x` exposes only what
// Node's export detection finds, often just `default`. tsc does not catch it;
// the call fails at run time. Check every namespace import against the members
// the code uses.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });

const usages = new Map<string, { members: Set<string>; called: boolean }>();
for (const file of [
  ...sources(join(root, 'apps')),
  ...sources(join(root, 'libs')),
]) {
  const code = readFileSync(file, 'utf8');
  for (const m of code.matchAll(/^import \* as (\w+) from '([^.#][^']*)';/gm)) {
    const [, name, pkg] = m;
    if (builtinModules.includes(pkg.replace(/^node:/, '').split('/')[0]))
      continue;
    const use = usages.get(pkg) || {
      members: new Set<string>(),
      called: false,
    };
    for (const u of code.matchAll(new RegExp(`\\b${name}\\.(\\w+)`, 'g')))
      use.members.add(u[1]);
    if (new RegExp(`\\b${name}\\(`).test(code)) use.called = true;
    usages.set(pkg, use);
  }
}

// ask Node itself: Vitest's loader synthesizes named exports that Node does not
const nodeExports = (pkg: string): string[] =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const ns = await import(${JSON.stringify(pkg)}); console.log(JSON.stringify(Object.keys(ns)))`,
      ],
      { cwd: root, encoding: 'utf8' },
    ),
  );

describe('ESM interop of namespace imports', () => {
  it.each([...usages.keys()])('%s provides what the code uses', (pkg) => {
    const keys = nodeExports(pkg);
    const { members, called } = usages.get(pkg);
    expect(called ? 'called as a function' : 'ok').toBe('ok');
    expect([...members].filter((m) => !keys.includes(m))).toEqual([]);
  });
});
