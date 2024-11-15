#!/usr/bin/env bash

set -ex

export DUO_STATUS_URL=${DUO_STATUS_URL:-https://status.duolicious.app}
export DUO_API_URL=${DUO_API_URL:-https://api.duolicious.app}
export DUO_CHAT_URL=${DUO_CHAT_URL:-wss://chat.duolicious.app}
export DUO_IMAGES_URL=${DUO_IMAGES_URL:-https://user-images.duolicious.app}
export DUO_AUDIO_URL=${DUO_AUDIO_URL:-https://user-audio.duolicious.app}

USES_CLEARTEXT_TRAFFIC=0

for url in "$DUO_STATUS_URL" "$DUO_API_URL" "$DUO_CHAT_URL" "$DUO_IMAGES_URL" "$DUO_AUDIO_URL"; do
    if [[ ! $url =~ ^(https://|wss://) ]]; then
        USES_CLEARTEXT_TRAFFIC=1
        break
    fi
done

rm -rf android ios

EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean

# Some random person on GitHub recommended this and I don't know why it's needed
( cd android && ./gradlew clean )

patch android/build.gradle \
  < apk-build-resources/build.gradle.patch

patch android/app/build.gradle \
  < apk-build-resources/app/build.gradle.patch

patch android/app/src/main/AndroidManifest.xml \
  < apk-build-resources/app/src/main/AndroidManifest.xml.notification.patch

patch android/app/src/main/AndroidManifest.xml \
  < apk-build-resources/app/src/main/AndroidManifest.xml.deep-links.patch

if [ "$USES_CLEARTEXT_TRAFFIC" -eq 1 ]; then
  patch android/app/src/main/AndroidManifest.xml \
    < apk-build-resources/app/src/main/AndroidManifest.xml.patch
fi

find android/app/src/main/res -mindepth 1 -type d -exec rm -r {} +

cp -r \
  apk-build-resources/res \
  android/app/src/main

cp -r \
  apk-build-resources/ic_launcher-playstore.png \
  android/app/src/main

( cd android && ./gradlew build )

if [ "$USES_CLEARTEXT_TRAFFIC" -eq 0 ]; then
  ( cd android && ./gradlew bundleRelease )
fi
