# Dynamic Accent

Dynamic Accent is a Spicetify extension that updates accent-related Spotify UI colors from the current track artwork.

It is designed to work **on top of any theme**, including Marketplace-installed themes. It does not replace your theme and it does not edit theme files directly.

## Features

- Uses the current track artwork palette to derive a dynamic accent color
- Updates common Spicetify accent variables at runtime
- Works with Marketplace-installed themes
- Theme-agnostic by design
- Does not replace fonts, layouts, or theme assets

## Installation

### Marketplace Installation

1. Install Spicetify and Marketplace normally.
2. Open **Marketplace** in Spotify.
3. Go to the **Extensions** tab.
4. Search for **Dynamic Accent**.
5. Install it.
6. Reload Spotify if needed.

### Manual Installation

1. Install Spicetify and set it up.
2. Put `dynamicAccent.js` into your Spicetify Extensions folder.

Windows:
`%appdata%\spicetify\Extensions\`

Linux:
`~/.config/spicetify/Extensions`
or
`$XDG_CONFIG_HOME/spicetify/Extensions/`

macOS:
`~/.config/spicetify/Extensions`
or
`~/.spicetify/Extensions`

3. Enable it:

```bash
spicetify config extensions dynamicAccent.js
spicetify apply