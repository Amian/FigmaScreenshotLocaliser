# Figma Screenshot Localiser

A Figma plugin that automatically translates UI text and exports localized screenshots across multiple languages — all in one click.

![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-F24E1E?logo=figma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)
![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini-4285F4?logo=google&logoColor=white)

---

## What it does

Select any Figma frames, pick your target locales, and the plugin will:

1. **Translate** all text in your frames using Google Gemini AI
2. **Shrink** text intelligently so translations fit the original layout (no overflow)
3. **Export** localized screenshots as a neatly organized ZIP file

Perfect for design teams who need to validate or showcase their UI in multiple languages without manually copy-pasting translations into every frame.

---

## Features

- **AI-powered translations** via Google Gemini (free tier available)
- **Smart text shrinking** — when a translation is longer than the original, the plugin automatically scales down font size to fit the bounds, preserving line wrapping and proportional line-height
- **RTL language support** — automatically flips text alignment for Arabic, Hebrew, etc.
- **32 locales by default** — `ar, ca, cs, da, de, el, es, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nl, no, pl, pt, pt-BR, ro, ru, sk, sv, th, tr, uk, vi, zh-CN, zh-TW`
- **Flexible export** — PNG or JPG at 1×–4× scale
- **ZIP download** — organized by locale (`/fr/Frame.png`, `/ja/Frame.png`, etc.)
- **Settings persistence** — your API key, model, and preferences are saved locally in Figma

---

## Requirements

- Figma desktop app (or Figma in browser)
- **Google Gemini API key** — required for translation. Get one free at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) (no credit card needed)
- Node.js + npm (for local development/building only)

---

## Installation

### Option 1 — Install from Figma Community
> Coming soon

### Option 2 — Install from source (development)

1. **Clone the repo**
   ```bash
   git clone https://github.com/Amian/FigmaScreenshotLocaliser.git
   cd FigmaScreenshotLocaliser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the plugin**
   ```bash
   npm run build
   ```
   Or use watch mode during development:
   ```bash
   npm run watch
   ```

4. **Load into Figma**
   - Open Figma
   - Go to **Plugins → Development → Import plugin from manifest...**
   - Select the `manifest.json` file from this repo

---

## Setting up your Figma file

For the plugin to work correctly, **text layers must use Auto Layout** so they can dynamically resize when translated content expands or contracts. Fixed-size text boxes that don't resize will cause translations to overflow or get clipped.

**→ Use this ready-made template with correct Auto Layout settings already configured:**
[Figma Screenshot Template](https://www.figma.com/design/l2hlLNVpX4zo0MN7Vwglez/Screenshot-Template?node-id=0-1&t=dmw6pfTBhHqIkfjx-1)

You can duplicate this template into your project as a starting point, or use it as a reference when setting up your own frames.

### Auto Layout requirements

- Text containers should use **Auto Layout** (Hug contents or Fill) rather than fixed dimensions
- Frames should be set to **Hug** their content vertically so they grow with the text
- Avoid fixed-height text boxes unless paired with the auto-shrink option enabled in the plugin

---

## Getting a Gemini API key

The plugin uses Google Gemini to translate text. The free tier is more than sufficient for most use cases.

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with a Google account
3. Click **"Create API key"**
4. Copy the key and paste it into the plugin settings

No credit card is required for the free tier.

---

## Usage

1. **Set up your frames** with Auto Layout text layers (see above, or use the [template](https://www.figma.com/design/l2hlLNVpX4zo0MN7Vwglez/Screenshot-Template?node-id=0-1&t=dmw6pfTBhHqIkfjx-1))
2. **Select frames** in Figma that contain the text you want to localize
3. **Open the plugin** via Plugins → Development → ScreenshotLocaliser
4. **Configure settings:**
   - Paste your **Gemini API key**
   - Choose a **model** (default: `gemini-2.5-flash`)
   - Enter **target locales** — one per line or comma-separated (e.g. `fr, de, ja, ar`)
   - Set **export format** (PNG or JPG) and **scale** (1×–4×)
   - Toggle options: *Keep translated duplicates*, *Auto-shrink text*, *Download ZIP*
5. **Click "Translate & Export"** and watch the progress bar
6. **Download your ZIP** — each locale gets its own folder

### Tips

- You can use **locale aliases**: `pt` → `pt-PT`, `ca` → `ca-ES`
- The **minimum shrink scale** (default 0.7) controls how aggressively text shrinks — set to 1.0 to disable shrinking entirely
- Enable **Keep translated duplicates** to keep the localized frames in a "Localized Screenshots" page for review

---

## Configuration Options

| Option | Default | Description |
|---|---|---|
| Gemini API Key | — | Required. Get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Model | `gemini-2.5-flash` | Gemini model to use for translation |
| Locales | 32 languages | Target locales, comma or newline separated |
| Export Format | PNG | PNG or JPG |
| Scale | 1× | Export resolution multiplier (1–4) |
| Auto-shrink text | On | Scale down font size if translation overflows |
| Min shrink scale | 0.7 | Minimum font scale allowed (0.1–1.0) |
| Keep duplicates | Off | Keep translated frames in a separate Figma page |
| Download ZIP | On | Auto-download ZIP when export is complete |

---

## Development

```bash
npm run build      # compile TypeScript once
npm run watch      # compile on save
npm run lint       # lint with ESLint
npm run lint:fix   # lint + auto-fix
```

**Project structure:**

```
FigmaScreenshotLocaliser/
├── code.ts          # Main plugin logic (Figma API, translation, shrinking, export)
├── ui.html          # Plugin UI panel (settings form, progress, ZIP download)
├── manifest.json    # Figma plugin manifest
├── package.json
└── tsconfig.json
```

---

## License

MIT
