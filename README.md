# GoA II — Mobile 2D

A mobile userscript for [Guards of Atlantis II](https://goa2.frontend.pedroliv.dev).
Open your game with `3d=0` in the URL. Supports portrait and phone landscape;
the website handles game rules and actions.

## Install

### Android — Firefox

I recommend **Firefox for Android** because it supports browser extensions, unlike Chrome for Android. This allows the script to be installed and managed cleanly through Greasemonkey.

1. Install [Firefox for Android](https://play.google.com/store/apps/details?id=org.mozilla.firefox).
2. Install [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/).
3. In Greasemonkey, choose **Install from URL**.
4. Paste:

   `https://raw.githubusercontent.com/SebastianKrog/goa2-mobile-2d-patch/main/dist/goa2-mobile-2d.user.js`

5. Reload the GoA2 page.

### iPhone / iPad

On iOS, use Safari with the free [Userscripts app](https://apps.apple.com/us/app/userscripts/id1463298887). Enable its Safari extension, then install the script from the URL above.

## Use

- Board is the default view. Tap **Heroes**, **Hand**, **Deck**, **Log** or **Settings**; tap the active tab again to return to Board.
- Tap a card to inspect it, or a hero name to focus that hero. Your played card appears above action choices.
- Deck offers **Tree**, **List** and **Grid**. Deck plans are previews; level-up choices require **Commit**.
- Long messages scroll automatically. Tap the message bar to read three rows; tap elsewhere to collapse it.
- Preferences and received events are saved on this device. Log also retrieves server decision history; local events cannot recover events missed while offline.

## Development

Use Node.js 24 (minimum 22.12).

```sh
npm ci
npm run build
npm test
```

Edit `src/`, rebuild, and commit source and generated `dist/` files together.

See [test coverage](tests/README.md), [stylesheet notes](src/STYLES.md),
[the changelog](CHANGELOG.md) and [planned work](ROADMAP.md).

## Attribution

The card painter is adapted from [PedroVIOliv/goa2-frontend-portfolio](https://github.com/PedroVIOliv/goa2-frontend-portfolio).
Card art, icons and fonts load from the game website.
