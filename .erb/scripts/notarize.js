const { notarize } = require('@electron/notarize');
const { execFile } = require('child_process');
const path = require('path');
const util = require('util');
const { build } = require('../../package.json');

const execFileAsync = util.promisify(execFile);

exports.default = async function notarizeMacos(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (process.env.CI !== 'true') {
    console.warn('Skipping notarizing step. Packaging is not running in CI');
    return;
  }

  if (
    !process.env.APPLE_ID ||
    !process.env.APPLE_APP_SPECIFIC_PASSWORD ||
    !process.env.APPLE_TEAM_ID
  ) {
    console.warn(
      'Skipping notarizing step. APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID must be set'
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log('>>> Notarization started');

  await notarize({
    tool: 'notarytool',
    appBundleId: build.appId,
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log('>>> Stapling app');

  await execFileAsync('xcrun', ['stapler', 'staple', appPath]);

  console.log('>>> Stapling done');
};
