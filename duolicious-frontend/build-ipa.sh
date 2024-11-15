#!/usr/bin/env bash

set -ex

export DUO_STATUS_URL=${DUO_STATUS_URL:-https://status.duolicious.app}
export DUO_API_URL=${DUO_API_URL:-https://api.duolicious.app}
export DUO_CHAT_URL=${DUO_CHAT_URL:-wss://chat.duolicious.app}
export DUO_IMAGES_URL=${DUO_IMAGES_URL:-https://user-images.duolicious.app}
export DUO_AUDIO_URL=${DUO_AUDIO_URL:-https://user-audio.duolicious.app}

rm -rf android ios

EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean

cat << EOF >> ios/.xcode.env.local
export DUO_STATUS_URL=https://status.duolicious.app
export DUO_API_URL=https://api.duolicious.app
export DUO_CHAT_URL=wss://chat.duolicious.app
export DUO_IMAGES_URL=https://user-images.duolicious.app
export DUO_AUDIO_URL=https://user-audio.duolicious.app
EOF


EAS_LOCAL_BUILD_SKIP_CLEANUP=1 eas build --platform ios --local
