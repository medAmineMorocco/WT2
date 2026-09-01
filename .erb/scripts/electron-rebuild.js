import { execSync } from 'child_process';
import fs from 'fs';
import { dependencies } from '../../release/app/package.json';
import webpackPaths from '../configs/webpack.paths';

// node-pty ships N-API prebuilds for the supported desktop platforms. Forcing
// electron-rebuild to compile it discards those prebuilds and unnecessarily
// requires a local C++ toolchain.
const dependenciesWithBundledPrebuilds = new Set(['node-pty']);
const dependenciesToRebuild = Object.keys(dependencies || {}).filter(
  (dependency) => !dependenciesWithBundledPrebuilds.has(dependency),
);

if (
  dependenciesToRebuild.length > 0 &&
  fs.existsSync(webpackPaths.appNodeModulesPath)
) {
  const electronRebuildCmd = `../../node_modules/.bin/electron-rebuild --force --types prod,dev,optional --module-dir . --only ${dependenciesToRebuild.join(
    ',',
  )}`;
  const cmd =
    process.platform === 'win32'
      ? electronRebuildCmd.replace(/\//g, '\\')
      : electronRebuildCmd;
  execSync(cmd, {
    cwd: webpackPaths.appPath,
    stdio: 'inherit',
  });
}
