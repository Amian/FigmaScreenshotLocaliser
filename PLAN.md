# Plan: Figma Screenshot Localiser (App Store Connect)

## Goal
Duplicate English screenshot frames, translate all text for each target App Store locale, and export a single download with one folder per language (no manual translation files).

## High-level approach
1. **UI + Inputs**
   - Provide a simple UI to select:
     - Source frames (selected frames or whole page)
     - Target locales (App Store locale codes)
     - Translation provider + API key
     - Export format (PNG/JPG) and scale
2. **Collect and prepare text**
   - For each source frame, traverse descendants and collect all `TextNode` items.
   - Normalize text into a translation map (dedupe identical strings to reduce cost).
   - Capture per-node metadata (font, size, width, auto-resize, original text).
3. **Translate text (automatic)**
   - Call a translation API in batches (provider-dependent), caching results.
   - Map results back to nodes by original string and locale.
4. **Duplicate and localize**
   - For each locale:
     - Duplicate each source frame into a new “locale” page or a grouped frame set.
     - Apply translated text back to corresponding nodes.
     - Handle layout overflow (auto-resize or manual reflow rules).
5. **Export**
   - Export each localized frame to image bytes via `exportAsync`.
   - In the UI, build a ZIP with folder per locale and screenshots inside.
   - Trigger a single download of the ZIP.
6. **Quality & resilience**
   - Surface missing fonts, translation errors, or overflow warnings.
   - Cache translations locally (e.g., client storage) to avoid re-translation.

## Technical details / implementation notes
- **Translation provider**: Use a configurable provider (e.g., DeepL, Google, Microsoft) with API key stored in client storage.
- **Node mapping**: Assign stable IDs by traversing the duplicated frame in the same order as the source to ensure correct replacement.
- **Text sizing strategy**: Prefer setting `textAutoResize` to `WIDTH_AND_HEIGHT` or `HEIGHT` and/or scale down if overflow. Provide a toggle in UI.
- **ZIP creation**: Use `JSZip` in UI (plugin main thread can’t trigger downloads directly).
- **Folder structure**: `export.zip/<locale>/<frame_name>.png`.

## Deliverables
- UI for selecting frames, locales, provider, and export settings.
- Core plugin logic to translate, duplicate, and export.
- ZIP download with per-locale folders.

## Open questions / ambiguities
1. **Locales**: Which exact App Store locales do you need (e.g., `en-US`, `de-DE`, `ja-JP`)?
 ar,ca,cs,da,de,el,es,fi,fr,he,hi,hr,hu,id,it,ja,ko,ms,nl,no,pl,pt,pt-BR,ro,ru,sk,sv,th,tr,uk,vi,zh-CN,zh-TW
    
2. **Source selection**: Should it process only selected frames, or all frames on the current page?
Process selected frames only

3. **Layout handling**: If translated text overflows, should it auto-resize, shrink font size, or allow overflow?
Shrink

4. **Provider choice**: Do you have a preferred translation API (DeepL/Google/Microsoft)? Are you ok supplying an API key in the UI?
API key for Gemini

5. **Output naming**: Use frame names as filenames or include order/index prefixes?
framenames

6. **Page structure**: Should localized frames be created on separate pages per locale, or just duplicated temporarily for export and then cleaned up?
duplicated temporarily for export and then cleaned up
