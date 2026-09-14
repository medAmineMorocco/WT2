import { spawnSync } from 'child_process';
import path from 'path';

const [, , platform, arch] = process.argv;
const supportedTargets = {
  linux: new Set(['x64', 'arm64']),
  win: new Set(['x64', 'ia32', 'arm64']),
  macos: new Set(['x64', 'arm64']),
};

if (!(platform in supportedTargets)) {
  throw new Error(`Unsupported package platform: ${platform || '(missing)'}`);
}
if (!supportedTargets[platform].has(arch)) {
  throw new Error(
    `Unsupported ${platform} architecture: ${arch || '(missing)'}`,
  );
}

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) {
  throw new Error('npm_execpath is unavailable. Run this helper through npm.');
}
const targetPlatform =
  platform === 'macos' ? 'darwin' : platform === 'win' ? 'win32' : 'linux';
const targetEnvironment = {
  ...process.env,
  npm_config_arch: arch,
  npm_config_platform: targetPlatform,
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, '../..'),
    env: targetEnvironment,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited with code ${result.status}`,
    );
  }
}

function runNpm(args) {
  run(process.execPath, [npmCliPath, ...args]);
}

run(process.execPath, [
  require.resolve('ts-node/dist/bin.js'),
  './.erb/scripts/clean.js',
  'dist',
]);
runNpm(['run', 'build']);
runNpm(['run', 'install:native-deps']);
runNpm(['run', 'prepare:native']);
runNpm(['run', 'rebuild']);

const platformArguments = {
  linux: ['--linux', 'deb', 'rpm'],
  win: ['--win', 'nsis'],
  macos: ['--macos', 'dmg'],
};
run(process.execPath, [
  require.resolve('electron-builder/out/cli/cli.js'),
  'build',
  ...platformArguments[platform],
  `--${arch}`,
  '--publish',
  'never',
]);
runNpm(['run', 'build:dll']);
