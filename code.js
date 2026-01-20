"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
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
const LOCALE_ALIASES = {
    pt: "pt-PT",
    ca: "ca-ES",
};
const SETTINGS_KEY = "screenshot-localiser-settings";
const loadedFonts = new Set();
figma.showUI(__html__, { width: 420, height: 660 });
function sanitizeFilename(name) {
    const cleaned = name.replace(/[\\/:*?"<>|]+/g, "-").trim();
    return cleaned.length ? cleaned : "frame";
}
function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
function collectTextNodes(root) {
    const nodes = [];
    const visit = (node) => {
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
function loadFontsForNode(node) {
    return __awaiter(this, void 0, void 0, function* () {
        const segments = node.getStyledTextSegments(["fontName"]);
        const fonts = new Map();
        for (const segment of segments) {
            const fontName = segment.fontName;
            fonts.set(JSON.stringify(fontName), fontName);
        }
        for (const font of fonts.values()) {
            const key = JSON.stringify(font);
            if (!loadedFonts.has(key)) {
                yield figma.loadFontAsync(font);
                loadedFonts.add(key);
            }
        }
    });
}
function applyTextWithShrink(node, text, sourceText, allowShrink, minScaleInput) {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadFontsForNode(node);
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
        const originalFontSize = node.fontSize;
        const originalLineHeight = node.lineHeight;
        const originalLetterSpacing = node.letterSpacing;
        const minScaleRaw = Number.isFinite(minScaleInput) && minScaleInput > 0 ? minScaleInput : 0.7;
        const minScale = Math.min(1, Math.max(0.1, minScaleRaw));
        const minFontSize = Math.max(1, Math.floor(originalFontSize * minScale));
        const preferMultiline = originalAutoResize === "HEIGHT" ||
            sourceText.includes("\n") ||
            text.includes("\n");
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
                const needsShrink = wrappedHeight > originalHeight + 0.1 ||
                    naturalWidth > originalWidth + 0.1;
                if (!needsShrink) {
                    break;
                }
                const scale = Math.min(originalWidth / naturalWidth, originalHeight / wrappedHeight);
                const currentSize = node.fontSize;
                const nextSize = Math.max(minFontSize, Math.floor(currentSize * scale));
                if (nextSize >= currentSize) {
                    break;
                }
                // Keep the original width so line wrapping stays multiline.
                node.textAutoResize = "HEIGHT";
                node.resizeWithoutConstraints(originalWidth, originalHeight);
                node.fontSize = nextSize;
                if (originalLineHeight !== figma.mixed &&
                    originalLineHeight.unit === "PIXELS") {
                    node.lineHeight = {
                        unit: "PIXELS",
                        value: originalLineHeight.value * (nextSize / originalFontSize),
                    };
                }
                if (originalLetterSpacing !== figma.mixed &&
                    originalLetterSpacing.unit === "PIXELS") {
                    node.letterSpacing = {
                        unit: "PIXELS",
                        value: originalLetterSpacing.value * (nextSize / originalFontSize),
                    };
                }
                shrunk = true;
                continue;
            }
            node.textAutoResize = "WIDTH_AND_HEIGHT";
            const needsShrink = node.width > originalWidth + 0.1 || node.height > originalHeight + 0.1;
            if (!needsShrink) {
                break;
            }
            const scale = Math.min(originalWidth / node.width, originalHeight / node.height);
            const currentSize = node.fontSize;
            const nextSize = Math.max(minFontSize, Math.floor(currentSize * scale));
            if (nextSize >= currentSize) {
                break;
            }
            node.fontSize = nextSize;
            if (originalLineHeight !== figma.mixed &&
                originalLineHeight.unit === "PIXELS") {
                node.lineHeight = {
                    unit: "PIXELS",
                    value: originalLineHeight.value * (nextSize / originalFontSize),
                };
            }
            if (originalLetterSpacing !== figma.mixed &&
                originalLetterSpacing.unit === "PIXELS") {
                node.letterSpacing = {
                    unit: "PIXELS",
                    value: originalLetterSpacing.value * (nextSize / originalFontSize),
                };
            }
            shrunk = true;
        }
        finalize();
        return { shrunk, skipped: false };
    });
}
function normalizeLocales(locales) {
    return locales.map((locale) => {
        var _a;
        return ({
            raw: locale,
            normalized: (_a = LOCALE_ALIASES[locale]) !== null && _a !== void 0 ? _a : locale,
        });
    });
}
function callGemini(apiKey, model, prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const response = yield fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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
        });
        if (!response.ok) {
            const errorText = yield response.text();
            throw new Error(`Gemini error ${response.status}: ${errorText || response.statusText}`);
        }
        const data = yield response.json();
        const text = (_e = (_d = (_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d.map((part) => part.text || "").join("")) !== null && _e !== void 0 ? _e : "";
        if (!text) {
            throw new Error("Gemini returned an empty response.");
        }
        return text;
    });
}
function parseTranslations(raw, expectedCount) {
    const tryParse = (value) => {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item));
            }
            if (parsed && Array.isArray(parsed.translations)) {
                return parsed.translations.map((item) => String(item));
            }
        }
        catch (_a) {
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
function translateStrings(strings, locale, settings) {
    return __awaiter(this, void 0, void 0, function* () {
        const prompt = `Translate the following UI strings to ${locale}. ` +
            `Return a JSON array of strings in the same order. ` +
            `Preserve punctuation, casing, and line breaks. ` +
            `Do not add commentary or code fences.\n\n` +
            strings
                .map((value, index) => `${index + 1}. ${JSON.stringify(value)}`)
                .join("\n");
        const responseText = yield callGemini(settings.apiKey, settings.model, prompt);
        const parsed = parseTranslations(responseText, strings.length);
        if (parsed.length !== strings.length) {
            throw new Error(`Could not parse Gemini response for ${locale}. Try a smaller batch or different model.`);
        }
        return parsed;
    });
}
function runLocalization(settings) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const exportFormat = settings.exportFormat === "JPG" ? "JPG" : "PNG";
        const scale = Number.isFinite(settings.scale) && settings.scale > 0
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
                message: "Download ZIP is off and 'Keep translated duplicates' is off, so outputs will not be saved.",
            });
        }
        const selection = figma.currentPage.selection;
        const frames = selection.filter((node) => node.type === "FRAME");
        if (!frames.length) {
            throw new Error("Select at least one frame to localize.");
        }
        const frameData = frames.map((frame) => {
            const textNodes = collectTextNodes(frame);
            const texts = textNodes.map((node) => node.characters);
            return { frame, textNodes, texts };
        });
        const allStrings = new Set();
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
        const totalUnits = normalizedLocales.length * (batches.length + frames.length);
        let completedUnits = 0;
        const originalPage = figma.currentPage;
        const originalSelection = originalPage.selection;
        const tempPage = figma.createPage();
        tempPage.name = settings.keepDuplicates
            ? "Localized Screenshots"
            : "__localize_tmp__";
        const layoutBounds = settings.keepDuplicates
            ? frames.reduce((acc, frame) => {
                acc.minX = Math.min(acc.minX, frame.x);
                acc.minY = Math.min(acc.minY, frame.y);
                acc.maxX = Math.max(acc.maxX, frame.x + frame.width);
                acc.maxY = Math.max(acc.maxY, frame.y + frame.height);
                return acc;
            }, {
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY,
            })
            : null;
        const localeYOffset = settings.keepDuplicates && layoutBounds
            ? layoutBounds.maxY - layoutBounds.minY + 120
            : 0;
        if (settings.downloadZip) {
            figma.ui.postMessage({ type: "zip-start" });
        }
        try {
            for (let localeIndex = 0; localeIndex < normalizedLocales.length; localeIndex += 1) {
                const localeInfo = normalizedLocales[localeIndex];
                if (localeInfo.normalized !== localeInfo.raw) {
                    figma.ui.postMessage({
                        type: "log",
                        message: `Locale ${localeInfo.raw} mapped to ${localeInfo.normalized}.`,
                    });
                }
                const translations = new Map();
                let batchIndex = 0;
                for (const batch of batches) {
                    figma.ui.postMessage({
                        type: "progress",
                        message: `Translating ${localeInfo.normalized} (${batchIndex + 1}/${batches.length})...`,
                        progress: Math.round((completedUnits / totalUnits) * 100),
                    });
                    const translated = yield translateStrings(batch, localeInfo.normalized, settings);
                    batch.forEach((source, index) => {
                        var _a;
                        translations.set(source, (_a = translated[index]) !== null && _a !== void 0 ? _a : source);
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
                    if (settings.keepDuplicates && localeYOffset) {
                        clone.x = data.frame.x;
                        clone.y = data.frame.y + localeYOffset * localeIndex;
                    }
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
                        const translated = (_a = translations.get(sourceText)) !== null && _a !== void 0 ? _a : sourceText;
                        const { shrunk, skipped } = yield applyTextWithShrink(cloneTextNodes[i], translated, sourceText, settings.shrinkText, settings.minShrinkScale);
                        if (skipped) {
                            figma.ui.postMessage({
                                type: "log",
                                message: `Skipped shrink for mixed font sizes in ${data.frame.name}.`,
                            });
                        }
                        else if (shrunk) {
                            figma.ui.postMessage({
                                type: "log",
                                message: `Shrunk text in ${data.frame.name} to fit.`,
                            });
                        }
                    }
                    if (settings.downloadZip) {
                        const bytes = yield clone.exportAsync({
                            format: exportFormat,
                            constraint: { type: "SCALE", value: scale },
                        });
                        const fileName = `${sanitizeFilename(data.frame.name)}.${exportFormat === "PNG" ? "png" : "jpg"}`;
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
        }
        finally {
            if (!settings.keepDuplicates) {
                tempPage.remove();
            }
            yield figma.setCurrentPageAsync(originalPage);
            originalPage.selection = originalSelection;
        }
    });
}
function getStoredSettings() {
    return __awaiter(this, void 0, void 0, function* () {
        const stored = (yield figma.clientStorage.getAsync(SETTINGS_KEY));
        return {
            apiKey: (stored === null || stored === void 0 ? void 0 : stored.apiKey) || "",
            model: (stored === null || stored === void 0 ? void 0 : stored.model) || "gemini-2.5-flash",
            locales: (stored === null || stored === void 0 ? void 0 : stored.locales) || DEFAULT_LOCALES,
            exportFormat: (stored === null || stored === void 0 ? void 0 : stored.exportFormat) || "PNG",
            scale: (stored === null || stored === void 0 ? void 0 : stored.scale) || 1,
            keepDuplicates: (stored === null || stored === void 0 ? void 0 : stored.keepDuplicates) === undefined ? false : stored.keepDuplicates,
            shrinkText: (stored === null || stored === void 0 ? void 0 : stored.shrinkText) === undefined ? true : stored.shrinkText,
            downloadZip: (stored === null || stored === void 0 ? void 0 : stored.downloadZip) === undefined ? true : stored.downloadZip,
            minShrinkScale: (stored === null || stored === void 0 ? void 0 : stored.minShrinkScale) === undefined ? 0.7 : stored.minShrinkScale,
        };
    });
}
function storeSettings(settings) {
    return __awaiter(this, void 0, void 0, function* () {
        yield figma.clientStorage.setAsync(SETTINGS_KEY, settings);
    });
}
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    if (msg.type === "get-settings") {
        const settings = yield getStoredSettings();
        figma.ui.postMessage({ type: "settings", settings });
        return;
    }
    if (msg.type === "start") {
        figma.ui.postMessage({ type: "run-start" });
        const rawSettings = msg.settings;
        const settings = {
            apiKey: (_b = (_a = rawSettings.apiKey) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : "",
            model: ((_c = rawSettings.model) === null || _c === void 0 ? void 0 : _c.trim()) || "gemini-2.5-flash",
            locales: (rawSettings.locales || [])
                .map((locale) => locale.trim())
                .filter(Boolean),
            exportFormat: rawSettings.exportFormat === "JPG" ? "JPG" : "PNG",
            scale: rawSettings.scale,
            keepDuplicates: Boolean(rawSettings.keepDuplicates),
            shrinkText: rawSettings.shrinkText === undefined ? true : Boolean(rawSettings.shrinkText),
            downloadZip: rawSettings.downloadZip === undefined ? true : Boolean(rawSettings.downloadZip),
            minShrinkScale: typeof rawSettings.minShrinkScale === "number"
                ? Math.min(1, Math.max(0.1, rawSettings.minShrinkScale))
                : 0.7,
        };
        try {
            yield storeSettings(settings);
            yield runLocalization(settings);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unexpected error.";
            figma.ui.postMessage({ type: "error", message });
            figma.notify(message);
        }
        finally {
            figma.ui.postMessage({ type: "run-end" });
        }
    }
    if (msg.type === "close") {
        figma.closePlugin();
    }
});
