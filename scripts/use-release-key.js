// Switches the generated Android project to sign release builds with the app's own key
// instead of the shared debug key. Run after `expo prebuild` when the signing secrets exist.
// Reads ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD at build time.
const fs = require('fs');
const path = require('path');

const gradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
let src = fs.readFileSync(gradle, 'utf8');
if (!src.includes('signingConfigs.release')) {
  src = src.replace(
    /signingConfigs \{\n/,
    `signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
`,
  );
  // Only the release build type switches keys; debug builds keep the debug key.
  src = src.replace(/(release \{[^}]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
  fs.writeFileSync(gradle, src);
}
if (!src.includes('signingConfigs.release')) throw new Error('Could not switch the release signing config');
console.log('Release builds will be signed with the app key.');
