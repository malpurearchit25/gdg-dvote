// A portable launcher: no globally installed npm/pnpm is needed after installation.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
process.chdir(path.resolve(__dirname, '..'));
const command = process.argv[2] || 'dev';
const hardhat = () => require.resolve('hardhat/internal/cli/cli.js');
const vite = () => path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const commands = {
  dev: () => [vite(), 'frontend', '--host', '127.0.0.1'],
  node: () => [hardhat(), 'node', '--hostname', '127.0.0.1'],
  deploy: () => [hardhat(), 'run', 'scripts/deploy.js', '--network', 'localhost'],
  seed: () => [hardhat(), 'run', 'scripts/seed.js', '--network', 'localhost'],
  test: () => [hardhat(), 'test'],
  compile: () => [hardhat(), 'compile'],
  build: () => [vite(), 'build', 'frontend'],
  preview: () => [vite(), 'preview', 'frontend', '--host', '127.0.0.1'],
  integration: () => [path.resolve('scripts/integration.js')],
  frontend: () => [path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run'],
  wallet: () => [path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', '--config', 'vitest.rpc.config.mjs'],
};
if (!commands[command]) {
  console.error(`Unknown command: ${command}\nUse: dev, node, deploy, seed, test, frontend, wallet, compile, build, preview, integration, or install (via run.cmd).`);
  process.exitCode = 1;
} else if (!fs.existsSync('node_modules')) {
  console.error('Dependencies are missing. Run .\\run.cmd install first.'); process.exitCode = 1;
} else {
  try {
    const child = spawn(process.execPath, commands[command](), { stdio: 'inherit', env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}` } });
    child.on('error', error => { console.error(error.message); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code || 0; });
    process.on('SIGINT', () => { if (!child.killed) child.kill('SIGINT'); });
    process.on('SIGTERM', () => { if (!child.killed) child.kill('SIGTERM'); });
  } catch (error) { console.error(error.message, '\nRun .\\run.cmd install to restore dependencies.'); process.exitCode = 1; }
}
