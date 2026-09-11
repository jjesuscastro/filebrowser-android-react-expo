# Play Store Publishing Guide

This app should be published to Google Play as an Android App Bundle (`.aab`), not as an APK.

The Play Store production build for this project is:

```bash
eas build --platform android --profile production
```

The `production` profile in `eas.json` is already configured to create an app bundle:

```json
{
  "android": {
    "buildType": "app-bundle"
  }
}
```

## Current App Identity

Check `app.json` before publishing:

- App name: `File Browser Native`
- Package name: `com.hesukastro.filebrowser`
- Version: `1.0.0`
- Version code: `1`

The Android package name is permanent after the first Play Store release, so confirm it before publishing.

## One-Time Requirements

1. Create a Google Play Developer account.
2. Confirm the app name and package name.
3. Prepare a privacy policy URL.
4. Prepare store listing assets:
   - App icon
   - Feature graphic, 1024 x 500
   - Phone screenshots
   - Short description
   - Full description
   - Contact email
   - App category

## Build The Play Store Release

Install or log in to EAS:

```bash
npx eas login
```

If the project has not been configured with EAS yet, run:

```bash
npx eas build:configure
```

Create the Play Store build:

```bash
eas build --platform android --profile production
```

Download the generated `.aab` from the EAS build page.

Do not upload the existing APK files in this repo for production Play Store publishing. APKs are useful for local or sideload testing, but Google Play production releases should use the `.aab` file.

## Signing

EAS can manage the Android signing key for this app.

If EAS asks whether to generate/manage credentials, let EAS manage them unless you specifically need to control your own signing key.

Keep any downloaded signing credentials safe. Losing signing credentials can make future app updates difficult or impossible without Play App Signing recovery steps.

## Google Play Console Setup

In Play Console:

1. Create a new app.
2. Use the same app/package identity from `app.json`.
3. Complete the store listing.
4. Upload screenshots and feature graphic.
5. Complete app content declarations:
   - Data safety
   - Content rating
   - Target audience
   - Ads declaration
   - Privacy policy
6. Create an internal, closed, or production release.
7. Upload the `.aab` from the EAS production build.

For new developer accounts, Google may require closed testing before production release. If required, create a closed testing track first, invite testers, complete the test period, then promote the release to production.

## Target SDK Requirement

Google Play enforces target API level requirements.

As of August 31, 2026, new apps and app updates must target Android 16 / API level 36 or higher.

If Play Console rejects the uploaded `.aab` because the target API is too low, upgrade the Expo SDK / React Native Android configuration and rebuild:

```bash
eas build --platform android --profile production
```

## Pre-Release Checklist

- Run tests:

```bash
npm test
```

- Run TypeScript checks:

```bash
npm run typecheck
```

- Build the production AAB:

```bash
eas build --platform android --profile production
```

- Test the app on a real Android device.
- Verify login/session behavior.
- Verify file browsing.
- Verify downloads/uploads/transfers.
- Verify previews for supported file types.
- Verify app icon and splash screen.
- Confirm privacy policy and Data Safety answers match the app's actual behavior.

## Useful References

- Google Play target API requirement: https://developer.android.com/google/play/requirements/target-sdk
- Android app signing: https://developer.android.com/studio/publish/app-signing
- Play Console app setup: https://support.google.com/googleplay/android-developer/answer/9859152
