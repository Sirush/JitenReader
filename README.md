# Jiten Reader

## Contents

1. [Downloads](#downloads)
2. [Features](#features)
3. [Automatic parsing](#automatic-parsing)
4. [Installation](#installation)
5. [Setup](#setup)
6. [Usage](#usage)
7. [Customize parsing](#customize-parsing)
8. [Customize text colors and furigana](#customize-text-colors-and-furigana)
9. [Building](#building)
10. [Contributing](#contributing)
11. [License](#license)

## Downloads

* [Chrome (Browser Extension) for Chromium-based browsers](#)
* [Firefox (Browser Extension) for Firefox and Firefox Android](#)
* [All Releases](https://github.com/Sirush/JitenReader/releases)

A browser extension to parse Japanese texts anywhere, get your coverage and keep track of words you know, powered by [Jiten](https://jiten.moe).

This extension is a fork of [Kagu-chan's Anki JPDB Reader](https://github.com/Kagu-chan/anki-jpdb.reader) which is itself a fork of [JPDB Web Reader extension](https://github.com/max-kamps/jpd-breader). It is not associated with their authors in any way.

Thanks to Kagu-chan, Max, and all of those that contributed to the original projects and made a solid foundation for this fork!

## Features
- Parse Japanese text on any website and supported apps including ttsu reader and asbplayer
- View the coverage of the content you're currently engaging with
- Keep track of the words you know and review them
- Customise the theme to your liking
- Easily switch profile to support multiple users or presets

### Please note:

* Currently, only Chromium-based browsers and Firefox (including Android) are supported.
* This extension is able to run on mobile devices as reported by users, but this usage is not officially supported.
* Custom parsers and support for specific websites in general can break because of 3rd party changes. Please report any issues you encounter.

## Custom parsers

Some web apps and sites require special attention to work properly; therefore, they parse automatically on certain triggers. These can be disabled or extended in the settings.

| App                                                  | URLs                                                                                                                                                                                                                                                                                       |
|------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [ッツ Reader](https://github.com/ttu-ttu/ebook-reader) | [reader.ttsu.app](https://reader.ttsu.app), [ttu-ebook.web.app](https://ttu-ebook.web.app)                                                                                                                                                                                                 |
| Texthooker pages                                     | [anacreondjt texthooker](https://anacreondjt.gitlab.io/texthooker.html), [learnjapanese.moe texthooker](https://learnjapanese.moe/texthooker.html), [exSTATic tracker](https://kamwithk.github.io/exSTATic/tracker.html), [renji-xd texthooker](https://renji-xd.github.io/texthooker-ui/) |
| Mokuro                                               | [reader.mokuro.app](https://reader.mokuro.app)                                                                                                                                                                                                                                             |
| Mokuro (Legacy)                                      | [Mokuro](https://github.com/kha-white/mokuro): **IMPORTANT**: File path must contain `mokuro`, and file name must end in `.html`                                                                                                                                                           |
| Readwok                                              | [app.readwok.com](https://app.readwok.com/)                                                                                                                                                                                                                                                |
| Satori Reader                                        | [satorireader.com](https://www.satorireader.com/)                                                                                                                                                                                                                                          |
| NHK News (web easy)                                  | [news.web.nhk/newsweb](https://news.web.nhk/newsweb/) and [news.web.nhk/news/easy](https://news.web.nhk/news/easy/)                                                                                                                                                                        |
| Wikipedia                                            | [ja.wikipedia.org](https://ja.wikipedia.org/)                                                                                                                                                                                                                                              |
| Bunpro                                               | [bunpro.jp](https://bunpro.jp) (Experimental)                                                                                                                                                                                                                                              |
| asbplayer                                            | [github.com/killergerbah/asbplayer](https://github.com/killergerbah/asbplayer)                                                                                                                                                                                                             |
                                                                                                                                                                                                                                                        |
| JPDB Custom Dictionaries                             | [CDM by Nakura Nakamoto](https://gitlab.com/nakura/jpdb_cdm)                                                                                                                                                                                                                               |
| LunaTranslator                                       | [Luna Translator](https://docs.lunatranslator.org/en/) with WebView2 enabled                                                                                                                                                                                                               |

## Installation

### Chrome

[Chrome Browser Extension](#) **or**

1. Download the latest `*-chromium.zip` file from the releases page.
2. Unpack the zip file in a location of your choosing.
3. Open your browser and navigate to `chrome://extensions/`.
4. Enable `Developer mode` (top right).
5. Click the `Load unpacked` button (top left).
6. In the file picker dialog, navigate to the folder you unpacked earlier. You should see a file called `manifest.json` inside the folder.
7. Click select/open/choose to exit the dialog and load the extension.
8. Continue with the [Setup](#setup) section.

### Firefox

[Firefox Browser Extension](#), or install it via Firefox for Android **or**

1. Download the latest `-firefox.xpi` file from the releases page.
2. Open your browser and navigate to `about:debugging`.
3. Click on `This Firefox`, then `Load Temporary Add-on`.
4. In the file picker dialog, navigate to the folder where you downloaded the xpi file.
5. Click select/open/choose to exit the dialog and load the extension.
6. Continue with the [Setup](#setup) section.

Please note that if you use the manual setup, the extension will be unloaded the next time you open Firefox. Your settings will be preserved. This is only for testing and debugging!

## Setup

Upon installation, the settings page will open. You can also find it by clicking on the reader icon (読) in the browser menu bar. It might be hidden behind the extension overflow menu, which looks like a little puzzle piece (🧩).

Here you will need to enter your Jiten API key. It can be found at the very bottom of the [Jiten settings page](https://jiten.moe/settings).  
You can also change various hotkeys.

## Usage

You can use the reader on any website. Just select some text, right-click, and choose the "Jiten Reader > Parse Election" option. Alternatively, use the shortcut (Alt+P) or the extension menu at the top right corner.

Words will be colored according to their state (known, new, etc.). Hover over words while holding Shift to see their meaning, and to mine or review them.

## Customize parsing

Parsing can be enabled or disabled per integration. You can also add custom URLs to automatically parse in the settings.

Additionally, you can add complete meta definitions in JSON format - refer to [the typings](https://github.com/Sirush/JitenReader/blob/dev/src/shared/host-meta/public-api.ts) or see [the docs](docs/custom-meta.md)

## Customize text colors and furigana

Customization is currently done with custom CSS, as it is the simplest way to offer a flexible framework. [See the docs on it here](docs/custom-css.md).

## Building

Node version 22.x is used!

You can run the following commands to build the extension locally:

```sh
npm install
npm run build
```

The resulting files will be located in the `jiten.reader/` folder.

For development, you can also run the build in watch mode:

```sh
npm install
npm run watch
```

This will continuously rebuild the source code as it changes, and place the output in the `jiten.reader/` folder.
It can be loaded as an unpacked extension from there.
Please remember to wait until building is done, and reload the extension on the "Manage Extensions" page before testing your changes.

Reloading is not required for the browser popup (top right) or the settings page.

Also, please look at the [Contributing](#contributing) section if you plan on contributing your changes.

## Contributing

Issues with feedback or ideas for new features are very welcome. Don't be afraid to join [Jiten's Discord server](https://discord.gg/cZWM7b4wzk) and ask there!

The following commands may be of interest to you:

* `npm run lint`: Checks your code for formatting issues, linter warnings, and type errors. The CI also runs this, so your pull request will only be accepted if it passes. You can use eslint ignore comments if you get false positives, but leave a comment explaining why you think the error is false and safe to ignore.
* `npm run lint:fix`: Reformats your code, as well as fixing any fixable lint issues. Note: if your editor has a `prettier` plugin, installing that and turning on "format on save" will be more convenient.
* `npm run build`: Compiles the code for Chrome, putting the compiled code into `jiten.reader/`.
* `npm run build [target]`: Builds for a specific target.
* `npm run watch`: Automatically recompiles the code for Chrome when it changes, putting the output into `jiten.reader/`. Using this is recommended during development.
* `npm run watch [target]`: Recompiles for the specified target.
* `npm run pack`: Builds, then packs the extension for all targets. The archives are placed inside `packages/`.
* `npm run pack [target, [target...]]`: Builds for specified targets.

Currently, `chrome|chromium` and `firefox` are supported.

## License

[MIT](https://choosealicense.com/licenses/mit/)

This project uses [Font Awesome 4](https://fontawesome.com/v4.7.0/), which is licensed under the [MIT License](https://opensource.org/licenses/MIT). Please ensure compliance with its license when using or distributing this project.
