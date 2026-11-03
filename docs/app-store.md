# iPhone release

The repository already contains an iPhone app built with Capacitor 8.5.2, which packages the game inside an iOS app. It is configured for iOS 15 or later and uses bundle identifier io.github.yasuic.literature. This identifier is now consistent between Capacitor and Xcode.

## Build checks

Run node --test tests/engine.test.cjs from the repository root. Run node scripts/build-web.mjs to check page scripts and copy the web source into both dist/ and ios-app/www/.

The Check game and iPhone build workflow builds an unsigned iPhone simulator app on a cloud Mac. It uses Xcode 26.3 and needs no Apple signing credentials. A successful simulator build checks compilation; testing audio, swipes, backgrounding and saved games still requires an iPhone or simulator play session.

## TestFlight

1. Use an Apple Developer Program membership with permission to sign and distribute this app. No enrollment fee or legal agreement has been accepted by this project.
2. Create or confirm the bundle identifier io.github.yasuic.literature under that Apple team, then create the corresponding Literature app in App Store Connect. If that identifier is unavailable, choose an owned identifier and change both Capacitor configuration files, both Xcode build configurations and the BUNDLE_ID repository variable together.
3. Add APPLE_TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 to the repository's Actions secrets. Add BUNDLE_ID as an Actions variable. The App Store Connect API credential needs the team's signing and upload permissions. Enter credentials directly in GitHub settings; do not add them to source files.
4. Run Build iPhone app. It checks the rules, copies the current game, syncs Capacitor, signs an archive and uploads it to App Store Connect. Each uploaded build needs a new build number. The existing workflow uses its increasing run number.
5. After Apple processes the build, add internal TestFlight testers and test on an iPhone. External testers may require Apple's beta review.

## App Store submission

Prepare an app description, category, age rating, screenshots, support URL and public privacy policy URL. The private ChatGPT development copy requires sign in, so use the public GitHub Pages policy URL for Apple: https://yasuic.github.io/literature/privacy.html. Update that public page with the reviewed policy before submission.

The game has no accounts, ads or analytics. Check the built app and included SDKs before completing Apple's privacy questions. The optional web export only saves a file unless the player chooses to share it. App Store approval has not been obtained.

Select a tested build in App Store Connect, complete its review information and submit it to Apple. The account owner must handle any Apple agreement or membership payment when prompted. Publishing the web copy does not submit an iPhone app to Apple.

## Official references checked on 3 November 2026

- [Apple's SDK submission requirements](https://developer.apple.com/news/upcoming-requirements/): uploads require Xcode 26 or later and an iOS 26 or later SDK.
- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Capacitor iOS environment](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Cloud Mac software](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md): Xcode 26.3 is installed; the default Xcode is older, so workflows select 26.3 explicitly.
