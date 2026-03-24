// NAME: Dynamic Accent
// AUTHOR: CatOtchi
// DESCRIPTION: Dynamically updates accent colors from the current track artwork.
// VERSION: 1.1.0

(function DynamicAccent() {
    const root = document.documentElement;
    const cache = new Map();
    let lastArtwork = "";

    const SETTINGS = {
        debug: false,
        brightenOnDarkUi: 0.14,
        darkenOnLightUi: 0.10,
    };

    function log(...args) {
        if (SETTINGS.debug) console.log("[Dynamic Accent]", ...args);
    }

    function waitForSpicetify() {
        if (!window.Spicetify?.Player) {
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
            value = value.split("").map((c) => c + c).join("");
        }
        if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
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
        return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount));
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

    function isDarkUi() {
        const main = getComputedStyle(root).getPropertyValue("--spice-main").trim() || "#121212";
        return luminance(main) < 0.35;
    }

    function setVar(name, hex) {
        const normalized = normalizeHex(hex);
        const rgb = hexToRgb(normalized);
        if (!normalized || !rgb) return;
        root.style.setProperty(`--spice-${name}`, normalized);
        root.style.setProperty(`--spice-rgb-${name}`, `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`);
    }

    function getArtworkUrl(item) {
        let url = item?.metadata?.image_url || "";

        if (!url) {
            const img = document.querySelector(".main-image-image.cover-art-image");
            url = img?.src || "";
        }

        if (!url) return null;

        if (url.startsWith("spotify:image:")) {
            return url.replace("spotify:image:", "https://i.scdn.co/image/");
        }

        return url;
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;

        if (max === min) return { h: 0, s: 0, l };

        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        let h;
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            default:
                h = (r - g) / d + 4;
                break;
        }

        h /= 6;
        return { h, s, l };
    }

    function extractAccentFromImage(img) {
        const size = 64;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map();

        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 180) continue;

            const { s, l } = rgbToHsl(r, g, b);

            if (s < 0.18) continue;
            if (l < 0.12 || l > 0.88) continue;

            const key = `${r >> 4},${g >> 4},${b >> 4}`;
            const weight =
                1 +
                s * 3 +
                (1 - Math.abs(l - 0.52)) * 2;

            const prev = buckets.get(key) || {
                score: 0,
                r: 0,
                g: 0,
                b: 0,
                count: 0,
            };

            prev.score += weight;
            prev.r += r * weight;
            prev.g += g * weight;
            prev.b += b * weight;
            prev.count += weight;

            buckets.set(key, prev);
        }

        if (!buckets.size) {
            return "#1db954";
        }

        let best = null;
        for (const bucket of buckets.values()) {
            if (!best || bucket.score > best.score) best = bucket;
        }

        return rgbToHex([
            best.r / best.count,
            best.g / best.count,
            best.b / best.count,
        ]);
    }

    async function getAccentForArtwork(artworkUrl) {
        if (cache.has(artworkUrl)) return cache.get(artworkUrl);

        const img = await loadImage(artworkUrl);
        const accent = extractAccentFromImage(img);

        cache.set(artworkUrl, accent);
        return accent;
    }

    function applyVars(accent) {
        const darkUi = isDarkUi();

        const accentActive = darkUi
            ? mix(accent, "#ffffff", SETTINGS.brightenOnDarkUi)
            : mix(accent, "#000000", SETTINGS.darkenOnLightUi);

        const borderActive = accentActive;
        const banner = accent;
        const button = accent;
        const buttonActive = accentActive;
        const tabActive = accent;

        setVar("accent", accent);
        setVar("accent-active", accentActive);
        setVar("border-active", borderActive);
        setVar("banner", banner);
        setVar("button", button);
        setVar("button-active", buttonActive);
        setVar("tab-active", tabActive);
    }

    async function applyFromCurrentTrack() {
        const item = Spicetify.Player.data?.item;
        if (!item || item.provider === "ad") return;

        const artworkUrl = getArtworkUrl(item);
        if (!artworkUrl) return;

        if (artworkUrl === lastArtwork) return;
        lastArtwork = artworkUrl;

        try {
            const accent = await getAccentForArtwork(artworkUrl);
            applyVars(accent);
            log("applied", { track: item.name, artworkUrl, accent });
        } catch (err) {
            console.error("[Dynamic Accent] failed to extract artwork color", err);
        }
    }

    waitForSpicetify();
})();