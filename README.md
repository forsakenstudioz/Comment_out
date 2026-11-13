# Comment Out

A Firefox extension that comments out HTML elements on any page. Built as a helper for automation testing.

## Features

- Type a tag (`div`), a class (`.banner`), an id (`#header`), any CSS selector, or paste an opening tag (`<div class="banner">`) in the popup. Every matching element is replaced by an HTML comment holding its original markup.
- Hold **Ctrl+Shift** and **double-click** any element to comment it out. The element under the pointer is outlined in red while the keys are held.
- **Ctrl+Shift+Z** undoes the last action, one step at a time.
- **Restore** per rule, or **Restore all**, from the popup.
- **Keep on this site after reload** re-applies a rule every time that site loads.
- Elements the page adds later that match an active rule are commented out too.

`<html>`, `<head>` and `<body>` are never commented out, and iframes are not reached.

## Install

### Temporary (for development)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.

Firefox removes temporary add-ons when it closes.

### Permanent

Zip the files (`manifest.json` at the top level of the zip), submit the zip at <https://addons.mozilla.org/developers/> choosing **On your own** distribution, download the signed `.xpi`, and install it from `about:addons` → gear icon → **Install Add-on From File…**

## Privacy

The extension collects and transmits no data. Saved rules are stored locally in the browser.

## License

[Mozilla Public License 2.0](LICENSE)
