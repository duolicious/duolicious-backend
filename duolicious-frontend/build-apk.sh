set -ex

export DUO_STATUS_URL=https://status.duolicious.app
export DUO_API_URL=https://api.duolicious.app
export DUO_CHAT_URL=wss://chat.duolicious.app
export DUO_IMAGES_URL=https://user-images.duolicious.app

rm -rf android ios

EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean

# Some random person on GitHub recommended this and I don't know why it's needed
( cd android && ./gradlew clean )

patch android/build.gradle \
  < apk-build-resources/build.gradle.patch

patch android/app/build.gradle \
  < apk-build-resources/app/build.gradle.patch

find android/app/src/main/res -mindepth 1 -type d -exec rm -r {} +

cp -r \
  apk-build-resources/res \
  android/app/src/main

cp -r \
  apk-build-resources/ic_launcher-playstore.png \
  android/app/src/main

( cd android && ./gradlew build )
