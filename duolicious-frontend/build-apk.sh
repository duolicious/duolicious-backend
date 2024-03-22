set -ex

export DUO_STATUS_URL=https://status.duolicious.app
export DUO_API_URL=https://api.duolicious.app
export DUO_CHAT_URL=wss://chat.duolicious.app
export DUO_IMAGES_URL=https://user-images.duolicious.app

rm -rf android ios
EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean
npx react-native run-android --mode=release
