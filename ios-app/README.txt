Literature Card Game for iPhone
===============================

This folder is the complete Xcode project for the iPhone app. The game itself is in www/
and is copied into ios/App/App/public/ for the app.

From the repository root, run node scripts/build-web.mjs to copy the current
game into www/. Then run npm ci and npm run sync from this folder.

With a Mac:     open ios/App/App.xcodeproj in Xcode 26.3 or later.
Without a Mac:  use the repository's "Check game and iPhone build" workflow
                for an unsigned simulator build. It needs no Apple secrets.
For TestFlight: use "Build iPhone app" after setting the Apple credentials.

See ../docs/app-store.md for the release steps and remaining account setup.
