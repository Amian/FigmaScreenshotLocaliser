type PluginSettings = {
  apiKey: string;
  model: string;
  locales: string[];
  exportFormat: "PNG" | "JPG";
  scale: number;
  keepDuplicates: boolean;
  shrinkText: boolean;
  downloadZip: boolean;
};

const DEFAULT_LOCALES = [
  "ar",
  "ca",
  "cs",
  "da",
  "de",
  "el",
  "es",
  "fi",
  "fr",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "ms",
  "nl",
  "no",
  "pl",
  "pt",
  "pt-BR",
  "ro",
  "ru",
  "sk",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh-CN",
  "zh-TW",
];

const LOCALE_ALIASES: Record<string, string> = {
  pt: "pt-PT",
  ca: "ca-ES",
};

const SETTINGS_KEY = "screenshot-localiser-settings";
const loadedFonts = new Set<string>();

figma.showUI(__html__, { width: 420, height: 620 });

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return cleaned.length ? cleaned : "frame";
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function collectTextNodes(root: SceneNode): TextNode[] {
  const nodes: TextNode[] = [];
  const visit = (node: SceneNode) => {
    if (node.type === "TEXT") {
      nodes.push(node);
    }
    if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(root);
  return nodes;
}

async function loadFontsForNode(node: TextNode): Promise<void> {
  const segments = node.getStyledTextSegments(["fontName"]);
  const fonts = new Map<string, FontName>();
  for (const segment of segments) {
    const fontName = segment.fontName as FontName;
    fonts.set(JSON.stringify(fontName), fontName);
  }
  for (const font of fonts.values()) {
    const key = JSON.stringify(font);
    if (!loadedFonts.has(key)) {
      await figma.loadFontAsync(font);
      loadedFonts.add(key);
    }
  }
}

async function applyTextWithShrink(
  node: TextNode,
  text: string,
  sourceText: string,
  allowShrink: boolean
): Promise<{ shrunk: boolean; skipped: boolean }> {
  await loadFontsForNode(node);
  const originalAutoResize = node.textAutoResize;
  const originalX = node.x;
  const originalY = node.y;
  const originalWidth = node.width;
  const originalHeight = node.height;
  const finalize = () => {
    node.textAutoResize = "NONE";
    node.resizeWithoutConstraints(originalWidth, originalHeight);
    node.x = originalX;
    node.y = originalY;
    node.textAutoResize = originalAutoResize;
  };

  node.characters = text;

  if (typeof node.fontSize !== "number") {
    finalize();
    return { shrunk: false, skipped: true };
  }

  if (!allowShrink) {
    finalize();
    return { shrunk: false, skipped: false };
  }

  const preferMultiline =
    originalAutoResize === "HEIGHT" ||
    sourceText.includes("\n") ||
    text.includes("\n");

  const originalFontSize = node.fontSize as number;
  const originalLineHeight = node.lineHeight;
  const originalLetterSpacing = node.letterSpacing;

  let shrunk = false;

  for (let i = 0; i < 3; i++) {
    if (preferMultiline) {
      // Measure wrapped height at the original width.
      node.textAutoResize = "HEIGHT";
      node.resizeWithoutConstraints(originalWidth, originalHeight);
      const wrappedHeight = node.height;

      // Measure natural width for single-line overflow (e.g., long words).
      node.textAutoResize = "WIDTH_AND_HEIGHT";
      const naturalWidth = node.width;

      const needsShrink =
        wrappedHeight > originalHeight + 0.1 ||
        naturalWidth > originalWidth + 0.1;
      if (!needsShrink) {
        break;
      }

      const scale = Math.min(
        originalWidth / naturalWidth,
        originalHeight / wrappedHeight
      );
      const currentSize = node.fontSize as number;
      const nextSize = Math.max(1, Math.floor(currentSize * scale));
      if (nextSize === node.fontSize) {
        break;
      }

      // Keep the original width so line wrapping stays multiline.
      node.textAutoResize = "HEIGHT";
      node.resizeWithoutConstraints(originalWidth, originalHeight);
      node.fontSize = nextSize;
      if (
        originalLineHeight !== figma.mixed &&
        originalLineHeight.unit === "PIXELS"
      ) {
        node.lineHeight = {
          unit: "PIXELS",
          value: originalLineHeight.value * (nextSize / originalFontSize),
        };
      }
      if (
        originalLetterSpacing !== figma.mixed &&
        originalLetterSpacing.unit === "PIXELS"
      ) {
        node.letterSpacing = {
          unit: "PIXELS",
          value: originalLetterSpacing.value * (nextSize / originalFontSize),
        };
      }
      shrunk = true;
      continue;
    }

    node.textAutoResize = "WIDTH_AND_HEIGHT";
    const needsShrink =
      node.width > originalWidth + 0.1 || node.height > originalHeight + 0.1;
    if (!needsShrink) {
      break;
    }

    const scale = Math.min(
      originalWidth / node.width,
      originalHeight / node.height
    );
    const currentSize = node.fontSize as number;
    const nextSize = Math.max(1, Math.floor(currentSize * scale));
    if (nextSize === node.fontSize) {
      break;
    }
    node.fontSize = nextSize;
    if (
      originalLineHeight !== figma.mixed &&
      originalLineHeight.unit === "PIXELS"
    ) {
      node.lineHeight = {
        unit: "PIXELS",
        value: originalLineHeight.value * (nextSize / originalFontSize),
      };
    }
    if (
      originalLetterSpacing !== figma.mixed &&
      originalLetterSpacing.unit === "PIXELS"
    ) {
      node.letterSpacing = {
        unit: "PIXELS",
        value: originalLetterSpacing.value * (nextSize / originalFontSize),
      };
    }
    shrunk = true;
  }

  finalize();
  return { shrunk, skipped: false };
}

function normalizeLocales(locales: string[]): { raw: string; normalized: string }[] {
  return locales.map((locale) => ({
    raw: locale,
    normalized: LOCALE_ALIASES[locale] ?? locale,
  }));
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini error ${response.status}: ${errorText || response.statusText}`
    );
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("") ?? "";
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

function parseTranslations(
  raw: string,
  expectedCount: number
): string[] {
  const tryParse = (value: string): string[] | null => {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
      if (parsed && Array.isArray(parsed.translations)) {
        return parsed.translations.map((item: string) => String(item));
      }
    } catch {
      return null;
    }
    return null;
  };

  const direct = tryParse(raw);
  if (direct && direct.length === expectedCount) {
    return direct;
  }

  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    const extracted = tryParse(match[0]);
    if (extracted && extracted.length === expectedCount) {
      return extracted;
    }
  }

  const lines = raw
    .split(/\n/)
    .map((line) => line.replace(/^\s*\d+[\).\s-]*/, "").trim())
    .filter(Boolean);
  if (lines.length === expectedCount) {
    return lines;
  }

  return [];
}

async function translateStrings(
  strings: string[],
  locale: string,
  settings: PluginSettings
): Promise<string[]> {
  const prompt =
    `Translate the following UI strings to ${locale}. ` +
    `Return a JSON array of strings in the same order. ` +
    `Preserve punctuation, casing, and line breaks. ` +
    `Do not add commentary or code fences.\n\n` +
    strings
      .map((value, index) => `${index + 1}. ${JSON.stringify(value)}`)
      .join("\n");

  const responseText = await callGemini(settings.apiKey, settings.model, prompt);
  const parsed = parseTranslations(responseText, strings.length);
  if (parsed.length !== strings.length) {
    throw new Error(
      `Could not parse Gemini response for ${locale}. Try a smaller batch or different model.`
    );
  }
  return parsed;
}

async function runLocalization(settings: PluginSettings): Promise<void> {
  const exportFormat = settings.exportFormat === "JPG" ? "JPG" : "PNG";
  const scale =
    Number.isFinite(settings.scale) && settings.scale > 0
      ? settings.scale
      : 1;
  if (!settings.apiKey) {
    throw new Error("Missing Gemini API key.");
  }
  if (!settings.locales.length) {
    throw new Error("No locales provided.");
  }
  if (!settings.downloadZip && !settings.keepDuplicates) {
    figma.ui.postMessage({
      type: "log",
      message:
        "Download ZIP is off and 'Keep translated duplicates' is off, so outputs will not be saved.",
    });
  }
  const selection = figma.currentPage.selection;
  const frames = selection.filter(
    (node): node is FrameNode => node.type === "FRAME"
  );

  if (!frames.length) {
    throw new Error("Select at least one frame to localize.");
  }

  const frameData = frames.map((frame) => {
    const textNodes = collectTextNodes(frame);
    const texts = textNodes.map((node) => node.characters);
    return { frame, textNodes, texts };
  });

  const allStrings = new Set<string>();
  for (const data of frameData) {
    for (const text of data.texts) {
      if (text.trim().length) {
        allStrings.add(text);
      }
    }
  }

  if (!allStrings.size) {
    throw new Error("No text nodes found in the selected frames.");
  }

  const normalizedLocales = normalizeLocales(settings.locales);

  const stringList = Array.from(allStrings.values());
  const batchSize = 20;
  const batches = chunkArray(stringList, batchSize);

  const totalUnits =
    normalizedLocales.length * (batches.length + frames.length);
  let completedUnits = 0;

  const originalPage = figma.currentPage;
  const originalSelection = originalPage.selection;
  const tempPage = figma.createPage();
  tempPage.name = settings.keepDuplicates
    ? "Localized Screenshots"
    : "__localize_tmp__";

  if (settings.downloadZip) {
    figma.ui.postMessage({ type: "zip-start" });
  }

  try {
    for (const localeInfo of normalizedLocales) {
      if (localeInfo.normalized !== localeInfo.raw) {
        figma.ui.postMessage({
          type: "log",
          message: `Locale ${localeInfo.raw} mapped to ${localeInfo.normalized}.`,
        });
      }

      const translations = new Map<string, string>();
      let batchIndex = 0;
      for (const batch of batches) {
        figma.ui.postMessage({
          type: "progress",
          message: `Translating ${localeInfo.normalized} (${batchIndex + 1}/${
            batches.length
          })...`,
          progress: Math.round((completedUnits / totalUnits) * 100),
        });

        const translated = await translateStrings(
          batch,
          localeInfo.normalized,
          settings
        );
        batch.forEach((source, index) => {
          translations.set(source, translated[index] ?? source);
        });
        batchIndex += 1;
        completedUnits += 1;
      }

      for (const data of frameData) {
        figma.ui.postMessage({
          type: "progress",
          message: `Exporting ${localeInfo.normalized}: ${data.frame.name}`,
          progress: Math.round((completedUnits / totalUnits) * 100),
        });

        const clone = data.frame.clone();
        tempPage.appendChild(clone);
        clone.name = `${data.frame.name} (${localeInfo.normalized})`;

        const cloneTextNodes = collectTextNodes(clone);
        const length = Math.min(cloneTextNodes.length, data.texts.length);
        if (cloneTextNodes.length !== data.texts.length) {
          figma.ui.postMessage({
            type: "log",
            message: `Text node count mismatch in ${data.frame.name}. Some text may be skipped.`,
          });
        }

        for (let i = 0; i < length; i++) {
          const sourceText = data.texts[i];
          const translated = translations.get(sourceText) ?? sourceText;
          const { shrunk, skipped } = await applyTextWithShrink(
            cloneTextNodes[i],
            translated,
            sourceText,
            settings.shrinkText
          );
          if (skipped) {
            figma.ui.postMessage({
              type: "log",
              message: `Skipped shrink for mixed font sizes in ${data.frame.name}.`,
            });
          } else if (shrunk) {
            figma.ui.postMessage({
              type: "log",
              message: `Shrunk text in ${data.frame.name} to fit.`,
            });
          }
        }

        if (settings.downloadZip) {
          const bytes = await clone.exportAsync({
            format: exportFormat,
            constraint: { type: "SCALE", value: scale },
          });
          const fileName = `${sanitizeFilename(data.frame.name)}.${
            exportFormat === "PNG" ? "png" : "jpg"
          }`;
          const path = `${localeInfo.normalized}/${fileName}`;

          figma.ui.postMessage({
            type: "zip-add",
            path,
            bytes,
          });
        }

        if (!settings.keepDuplicates) {
          clone.remove();
        }
        completedUnits += 1;
      }
    }

    if (settings.downloadZip) {
      figma.ui.postMessage({
        type: "zip-finish",
        zipName: "localized_screenshots.zip",
      });
    }

    figma.ui.postMessage({
      type: "progress",
      message: "Done.",
      progress: 100,
    });
  } finally {
    if (!settings.keepDuplicates) {
      tempPage.remove();
    }
    await figma.setCurrentPageAsync(originalPage);
    originalPage.selection = originalSelection;
  }
}

async function getStoredSettings(): Promise<PluginSettings> {
  const stored = (await figma.clientStorage.getAsync(
    SETTINGS_KEY
  )) as Partial<PluginSettings> | null;

  return {
    apiKey: stored?.apiKey || "",
    model: stored?.model || "gemini-2.5-flash",
    locales: stored?.locales || DEFAULT_LOCALES,
    exportFormat: stored?.exportFormat || "PNG",
    scale: stored?.scale || 1,
    keepDuplicates:
      stored?.keepDuplicates === undefined ? false : stored.keepDuplicates,
    shrinkText: stored?.shrinkText === undefined ? true : stored.shrinkText,
    downloadZip:
      stored?.downloadZip === undefined ? true : stored.downloadZip,
  };
}

async function storeSettings(settings: PluginSettings): Promise<void> {
  await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "get-settings") {
    const settings = await getStoredSettings();
    figma.ui.postMessage({ type: "settings", settings });
    return;
  }

  if (msg.type === "start") {
    figma.ui.postMessage({ type: "run-start" });
    const rawSettings = msg.settings as PluginSettings;
    const settings: PluginSettings = {
      apiKey: rawSettings.apiKey?.trim() ?? "",
      model: rawSettings.model?.trim() || "gemini-2.5-flash",
      locales: (rawSettings.locales || [])
        .map((locale) => locale.trim())
        .filter(Boolean),
      exportFormat: rawSettings.exportFormat === "JPG" ? "JPG" : "PNG",
      scale: rawSettings.scale,
      keepDuplicates: Boolean(rawSettings.keepDuplicates),
      shrinkText:
        rawSettings.shrinkText === undefined ? true : Boolean(rawSettings.shrinkText),
      downloadZip:
        rawSettings.downloadZip === undefined ? true : Boolean(rawSettings.downloadZip),
    };
    try {
      await storeSettings(settings);
      await runLocalization(settings);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error.";
      figma.ui.postMessage({ type: "error", message });
      figma.notify(message);
    } finally {
      figma.ui.postMessage({ type: "run-end" });
    }
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
