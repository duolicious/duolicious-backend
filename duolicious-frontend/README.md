# duolicious-frontend

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
export DUO_STATUS_URL=https://status.duolicious.app
export DUO_API_URL=https://api.duolicious.app
export DUO_CHAT_URL=wss://chat.duolicious.app
export DUO_IMAGES_URL=https://user-images.duolicious.app

rm -rf android ios

# To generate all the Android and IOS files
EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean

# Maybe do this, maybe don't. See below.
git clean -f android/app/src/main/res/
git checkout android/app/src/main/res/ android/app/src/main/ic_launcher-playstore.png
git apply git-patches/build.gradle.patch

# Some random person on GitHub recommended this and I don't know why it's needed
( cd android && ./gradlew clean )

# TODO: change minSdkVersion in android/build.gradle to 27

( cd android && ./gradlew build )

adb install android/app/build/outputs/apk/release/app-release.apk

# Make sure to connect your device or to run your Emulator
npx react-native run-android --mode=release

# If you want to sign the APK and publish to Google Play Store.
npx react-native build-android --mode=release
```

At some point (I think before running `run-android` or `build-android`), I opened the `android/` directory in Android Studio. Then I navigated to `android/app/src/main/res/` in the file tree. I right-clicked the directory and clicked 'New' > 'Image Asset'. Then I followed the wizard, using `assets/icon.png` as my icon, zoomed in at 67%. If you don't do all that, the Android app will have a white border around it. I don't understand why. But now that I've done that, it's possible to run this instead:

```bash
git clean -f android/app/src/main/res/
git checkout android/app/src/main/res/ android/app/src/main/ic_launcher-playstore.png
```
