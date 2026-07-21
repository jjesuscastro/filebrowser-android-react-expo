const { withAndroidManifest } = require('expo/config-plugins');

/**
 * File Browser is commonly hosted over HTTP on trusted home networks.
 * This enables cleartext transport without weakening Android's TLS checks.
 */
module.exports = function withAndroidCleartext(config) {
  return withAndroidManifest(config, configWithManifest => {
    const application = configWithManifest.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return configWithManifest;
  });
};
