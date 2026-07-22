# File Browser Native

An Android-native client for an existing [File Browser](https://filebrowser.org/) server. It uses File Browser's HTTP API for native browsing, search, previews, uploads, downloads, file operations, and public links. File Browser 2.34.1 or newer and its standard username/password login are required.

## Development

This app uses native transfer and media modules and therefore requires an Expo development build; it does not run in Expo Go.

```sh
npm install
npm run typecheck
npm run android:prebuild
npm run android
```

For local Android builds, install Android Studio/JDK and set up the Android SDK. The generated `android/` directory can then be built with Gradle.

## Build an installable APK

1. Install and authenticate the EAS CLI: `npm install --global eas-cli` and `eas login`.
2. Run `eas init` once to link the project to your Expo account.
3. Run `npm run build:apk`.
4. Download the APK from the build link printed by EAS and install it on the Android device.

The `preview` EAS profile creates an APK for direct installation. HTTP servers are allowed because local File Browser deployments commonly use them, but the app warns before saving an unencrypted URL. HTTPS certificate errors are never bypassed.

## Data and privacy

The app stores the configured server URL in app preferences and the File Browser JWT in Android's encrypted credential storage. If “Keep me signed in” is selected, the login credentials are also kept in encrypted credential storage so the app can obtain a new JWT when the server session expires. Signing out or forgetting the server deletes them. It has no analytics and sends no data to an application-owned backend. Downloads are handed to Android's download manager.
