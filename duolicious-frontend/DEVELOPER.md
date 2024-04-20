# Developer instructions

## Starting The Server

You might need to run this the first time you run the Duolicious frontend:

```bash
export NODE_OPTIONS=--openssl-legacy-provider
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

```bash
npm install
npx patch-package

# If you want to use the real (production) backend server, you can set these
# environment variables
export DUO_STATUS_URL=https://status.duolicious.app
export DUO_API_URL=https://api.duolicious.app
export DUO_CHAT_URL=wss://chat.duolicious.app
export DUO_IMAGES_URL=https://user-images.duolicious.app

npx expo start
```

## Building the Android APK

Add these to `~/.gradle/gradle.properties`:

```
DUOLICIOUS_UPLOAD_STORE_FILE=duolicious.keystore
DUOLICIOUS_UPLOAD_KEY_ALIAS=duolicious
DUOLICIOUS_UPLOAD_STORE_PASSWORD=*****
DUOLICIOUS_UPLOAD_KEY_PASSWORD=*****
```

Then:

```bash
./build-apk.sh
```

If you want to install the APK:

```
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Building the iOS App

Run:

```bash
EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean
```

Set up certificates in xcode.

Add these to `ios/.xcode.env.local`:

```bash
export DUO_STATUS_URL=https://status.duolicious.app
export DUO_API_URL=https://api.duolicious.app
export DUO_CHAT_URL=wss://chat.duolicious.app
export DUO_IMAGES_URL=https://user-images.duolicious.app
```

This generates an ipa file:

```bash
eas build --platform ios --local
```

This generates an ad-hoc ipa file:

```bash
eas build --profile preview --platform ios --local
```