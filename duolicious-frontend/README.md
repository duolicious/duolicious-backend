# duolicious-frontend

## Starting The Server

You might need to run this the first time you run Duolicious:

```bash
export NODE_OPTIONS=--openssl-legacy-provider
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

```bash
npm install
npx patch-package
npx expo start
```
