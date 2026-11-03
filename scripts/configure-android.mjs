import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const android = path.join(root, 'android-app/android');
const appFile = path.join(android, 'app/build.gradle');
let gradle = await readFile(appFile, 'utf8');
const code = Number(process.env.ANDROID_VERSION_CODE || 1);
if (!Number.isInteger(code) || code < 1) throw new Error('ANDROID_VERSION_CODE must be a positive integer.');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]+"/, 'versionName "1.0.0"');
if (!gradle.includes("applicationIdSuffix '.debug'")) {
  gradle = gradle.replace('buildTypes {', "buildTypes {\n        debug {\n            applicationIdSuffix '.debug'\n            versionNameSuffix '-test'\n        }");
}
if (!gradle.includes('LITERATURE_UPLOAD_SIGNING')) {
  gradle += `
// LITERATURE_UPLOAD_SIGNING: private values come from the release environment.
def literatureStore = System.getenv('ANDROID_KEYSTORE_PATH')
if (literatureStore) {
    android.signingConfigs {
        upload {
            storeFile file(literatureStore)
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.upload
}
`;
}
await writeFile(appFile, gradle);
const variables = await readFile(path.join(android, 'variables.gradle'), 'utf8');
if (!/compileSdkVersion\s*=\s*36/.test(variables) || !/targetSdkVersion\s*=\s*36/.test(variables)) {
  throw new Error('The Android project must target and compile with API 36.');
}

const res = path.join(android, 'app/src/main/res');
const icon = path.join(root, 'icons/icon-512.png');
await mkdir(path.join(res, 'drawable-nodpi'), { recursive: true });
await cp(icon, path.join(res, 'drawable-nodpi/literature_mark.png'));
for (const dir of await readdir(res)) {
  if (/^mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)$/.test(dir)) {
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      await cp(icon, path.join(res, dir, name));
    }
  }
  if (/^drawable-(land|port)-/.test(dir) || dir === 'drawable') {
    await cp(icon, path.join(res, dir, 'splash.png'));
  }
}
await writeFile(path.join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#04060d</color></resources>\n');
const adaptive = '<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground><inset android:drawable="@drawable/literature_mark" android:inset="18%"/></foreground></adaptive-icon>\n';
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  await writeFile(path.join(res, 'mipmap-anydpi-v26', name), adaptive);
}
console.log('Android configured for API 36 with Literature artwork. Test installs use a separate .debug package.');
