There's two implementations for performance reasons. `react-native-svg` is slow
on mobile. But I couldn't figure out how to make `@shopify/react-native-skia`
work on web.

`LogoActivityIndicator` shows pre-rendered animated WebPs from `spinner/`
instead, because they're far cheaper to animate than either implementation.
`generate-spinner.py` (which needs Pillow) renders them from `logo-16.json`, one
per colour in `spinnerColors` and per pixel size the named sizes need at common
screen densities. Re-run it after changing anything in `logo-16.json`. Colours
that aren't in `spinnerColors` fall back to `Logo16`.
