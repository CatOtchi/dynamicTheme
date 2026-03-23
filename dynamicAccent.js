// NAME: Dynamic Accent
// AUTHOR: CatOtchi
// DESCRIPTION: Dynamically updates accent colors from the current track artwork.
// VERSION: 1.0.0

(function DynamicAccent() {
    const root = document.documentElement;
    const cache = new Map();

    const SETTINGS = {
        debug: false,

        // Palette order returned by Spicetify.colorExtractor(uri)
        palettePriority: [
            "VIBRANT_NON_ALARMING",
            "VIBRANT",
            "PROMINENT",
            "LIGHT_VIBRANT",
            "DARK_VIBRANT",
            "DESATURATED"
        ],

        // Variables that many themes use for accent-like UI elements
        applyVars: [
            "accent",
            "accent-active",
            "button",
            "button-active",
            "border-active",
            "banner",
            "tab-active",
            "sidebar-button-active"
        ],

        // How much accent-active / border-active shift away from the base accent
        lightenOnDarkUi: 0.14,
        darkenOnLightUi: 0.10
    };

    let lastUri = "";

    function log(...args) {
        if (SETTINGS.debug) {
            console.log("[Dynamic Accent]", ...args);
        }
    }

    function waitForSpicetify() {
        if (!window.Spicetify?.Player || !window.Spicetify?.colorExtractor) {
            setTimeout(waitForSpicetify, 150);
            return;
        }

        init();
    }

    function init() {
        applyFromCurrentTrack();
        Spicetify.Player.addEventListener("songchange", applyFromCurrentTrack);
        log("initialized");
    }

    function normalizeHex(hex) {
        if (!hex) return null;
        let value = String(hex).trim().replace(/^#/, "");

        if (value.length === 3) {
            value = value
                .split("")
                .map((c) => c + c)
                .join("");
        }

        if (!/^[0-9a-fA-F]{6}$/.test(value)) {
            return null;
        }

        return `#${value.toLowerCase()}`;
    }

    function hexToRgb(hex) {
        const normalized = normalizeHex(hex);
        if (!normalized) return null;

        const n = parseInt(normalized.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function rgbToHex([r, g, b]) {
        return (
            "#" +
            [r, g, b]
                .map((v) => Math.max(0, Math.min(255, Math.round(v))))
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("")
        );
    }

    function mix(hexA, hexB, amount) {
        const a = hexToRgb(hexA);
        const b = hexToRgb(hexB);
        if (!a || !b) return normalizeHex(hexA) || normalizeHex(hexB);

        return rgbToHex(
            a.map((v, i) => v + (b[i] - v) * amount)
        );
    }

    function luminance(hex) {
        const rgb = hexToRgb(hex);
        if (!rgb) return 0;

        const [r, g, b] = rgb.map((v) => {
            const c = v / 255;
            return c <= 0.03928
                ? c / 12.92
                : Math.pow((c + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function getCssHexVar(varName, fallback) {
        const value = getComputedStyle(root).getPropertyValue(varName).trim();
        return normalizeHex(value) || normalizeHex(fallback);
    }

    function isDarkUi() {
        const mainColor = getCssHexVar("--spice-main", "#121212");
        return luminance(mainColor) < 0.35;
    }

    function setVar(name, hex) {
        const normalized = normalizeHex(hex);
        const rgb = hexToRgb(normalized);
        if (!normalized || !rgb) return;

        root.style.setProperty(`--spice-${name}`, normalized);
        root.style.setProperty(`--spice-rgb-${name}`, `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`);
    }

    function chooseAccent(palette) {
        for (const key of SETTINGS.palettePriority) {
            const color = normalizeHex(palette?.[key]);
            if (color) return color;
        }
        return null;
    }

    async function getPalette(uri) {
        if (cache.has(uri)) return cache.get(uri);
        const palette = await Spicetify.colorExtractor(uri);
        cache.set(uri, palette);
        return palette;
    }

    function buildVarMap(accent) {
        const darkUi = isDarkUi();

        const accentActive = darkUi
            ? mix(accent, "#ffffff", SETTINGS.lightenOnDarkUi)
            : mix(accent, "#000000", SETTINGS.darkenOnLightUi);

        const borderActive = accentActive;
        const banner = accent;
        const button = accent;
        const buttonActive = accentActive;
        const tabActive = accent;
        const sidebarButtonActive = accent;

        return {
            "accent": accent,
            "accent-active": accentActive,
            "button": button,
            "button-active": buttonActive,
            "border-active": borderActive,
            "banner": banner,
            "tab-active": tabActive,
            "sidebar-button-active": sidebarButtonActive
        };
    }

    async function applyFromCurrentTrack() {
        const item = Spicetify.Player.data?.item;
        const uri = item?.uri;

        if (!uri) {
            log("no current track uri");
            return;
        }

        if (uri === lastUri) return;
        lastUri = uri;

        try {
            const palette = await getPalette(uri);
            const accent = chooseAccent(palette);

            if (!accent) {
                log("no valid palette color", palette);
                return;
            }

            const vars = buildVarMap(accent);

            for (const name of SETTINGS.applyVars) {
                if (vars[name]) setVar(name, vars[name]);
            }

            log("applied", {
                track: item?.name,
                uri,
                accent
            });
        } catch (err) {
            console.error("[Dynamic Accent] failed to apply accent", err);
        }
    }

    waitForSpicetify();
})();