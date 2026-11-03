# Android and Google Play

The Android app uses the same game source as the web version. Its package name is io.github.yasuic.literature. Test APKs use io.github.yasuic.literature.debug so they can be installed alongside a later Play release.

## Build

The Build and test Android app workflow checks the rules, generates the native project with Capacitor 8.5.2, builds an installable test APK and an unsigned Android App Bundle, then tests launch, dealing and saved game resume on an Android emulator. Artifacts include the builds and screenshots.

To build on a development machine with Node 22 or later, Java 21 and Android SDK 36:

1. From the repository root, run node scripts/build-web.mjs.
2. In android-app/, run npm ci and npx cap add android.
3. Run node ../scripts/configure-android.mjs, then npx cap sync android.
4. In android-app/android/, run the Gradle wrapper with assembleDebug bundleRelease.

The native project and bundled web assets are generated from locked dependencies and the root game files. They are not separate editable copies in Git.

## Release

Google Play requires a signed Android App Bundle for a new app. The unsigned bundle from the check workflow cannot be uploaded as a release. The generated project supports upload signing through ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD environment variables. Keep the keystore and its passwords out of source and public build artifacts.

Complete the Play Console developer account, identity verification, required testing, store listing, privacy and data safety forms, content rating, app access details and merchant setup for a paid download. Select the intended price in Play Console before release. A successful build is not a Google Play publication.

## Google requirements checked on 3 November 2026

- [Play Console setup](https://support.google.com/googleplay/android-developer/answer/6112435): US$25 one time developer fee; new personal accounts require identity and Android device verification.
- [Personal account testing](https://support.google.com/googleplay/android-developer/answer/14151465): accounts created after 13 November 2023 need at least 12 testers opted into a closed test continuously for 14 days before applying for production access.
- [Target Android API](https://support.google.com/googleplay/android-developer/answer/11926878): new apps must target API 36 or later from 31 August 2026. This project compiles and targets API 36.
- [App signing](https://developer.android.com/studio/publish/app-signing): sign the upload bundle and use Play App Signing for distribution.
