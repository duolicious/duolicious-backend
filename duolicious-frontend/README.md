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
