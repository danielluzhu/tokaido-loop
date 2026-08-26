/**
 * A per-trip visual theme, stored as an ordinary setting so it inherits undo,
 * git export and the artifact pipeline without any extra plumbing.
 *
 * Values are validated hard rather than trusted: they are interpolated into a
 * <style> block on a shareable page, so a stray "}" would let content break out
 * of CSS and into markup.
 */

export const COLOR_KEYS = [
  "ink", "inkSoft", "muted", "ground", "surface", "surface2",
  "rail", "railSoft", "accent", "accentSoft", "hairline",
] as const;

const CSS_VAR: Record<string, string> = {
  ink: "--ink", inkSoft: "--ink-soft", muted: "--muted", ground: "--ground",
  surface: "--surface", surface2: "--surface-2", rail: "--rail",
  railSoft: "--rail-soft", accent: "--accent", accentSoft: "--accent-soft",
  hairline: "--hairline",
};

export type Theme = {
  light?: Record<string, string>;
  dark?: Record<string, string>;
  fonts?: { display?: string; body?: string; mono?: string };
  layout?: { width?: number; radius?: number; density?: "compact" | "normal" | "roomy" };
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FONT = /^[A-Za-z0-9][A-Za-z0-9 ]{0,40}$/;

export const DEFAULT_FONTS = {
  display: "Zen Kaku Gothic New",
  body: "Newsreader",
  mono: "IBM Plex Mono",
};

const FALLBACK: Record<string, string> = {
  display: '"Hiragino Sans","Helvetica Neue",sans-serif',
  body: 'Georgia,"Times New Roman",serif',
  mono: "ui-monospace,monospace",
};

/** Throws with a usable message rather than silently dropping bad input. */
export function validateTheme(t: any): Theme {
  const out: Theme = {};
  if (t == null) return out;

  for (const mode of ["light", "dark"] as const) {
    if (!t[mode]) continue;
    const bag: Record<string, string> = {};
    for (const [k, v] of Object.entries(t[mode] as Record<string, string>)) {
      if (!COLOR_KEYS.includes(k as any))
        throw new Error(`unknown colour "${k}". Use one of: ${COLOR_KEYS.join(", ")}`);
      if (typeof v !== "string" || !HEX.test(v))
        throw new Error(`${mode}.${k} must be a hex colour like #E8622C, got "${v}"`);
      bag[k] = v;
    }
    if (Object.keys(bag).length) out[mode] = bag;
  }

  if (t.fonts) {
    const f: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.fonts as Record<string, string>)) {
      if (!["display", "body", "mono"].includes(k))
        throw new Error(`unknown font role "${k}". Use display, body or mono.`);
      if (typeof v !== "string" || !FONT.test(v))
        throw new Error(`font "${v}" is not a plausible Google Fonts family name`);
      f[k] = v;
    }
    if (Object.keys(f).length) out.fonts = f as any;
  }

  if (t.layout) {
    const l: any = {};
    if (t.layout.width != null) {
      const w = Number(t.layout.width);
      if (!Number.isFinite(w) || w < 520 || w > 1400)
        throw new Error("layout.width must be between 520 and 1400 px");
      l.width = Math.round(w);
    }
    if (t.layout.radius != null) {
      const r = Number(t.layout.radius);
      if (!Number.isFinite(r) || r < 0 || r > 28)
        throw new Error("layout.radius must be between 0 and 28 px");
      l.radius = Math.round(r);
    }
    if (t.layout.density != null) {
      if (!["compact", "normal", "roomy"].includes(t.layout.density))
        throw new Error('layout.density must be "compact", "normal" or "roomy"');
      l.density = t.layout.density;
    }
    if (Object.keys(l).length) out.layout = l;
  }

  return out;
}

/** Confirm a family actually exists, so a typo fails loudly instead of falling back. */
export async function fontExists(family: string) {
  try {
    const url =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family).replace(/%20/g, "+") +
      "&display=swap";
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; TokaidoLoop/1.0)" },
    });
    return res.ok;
  } catch {
    return true; // offline: don't block the edit on a network failure
  }
}

export function fontFamilies(theme: Theme) {
  return {
    display: theme.fonts?.display ?? DEFAULT_FONTS.display,
    body: theme.fonts?.body ?? DEFAULT_FONTS.body,
    mono: theme.fonts?.mono ?? DEFAULT_FONTS.mono,
  };
}

/** The Google Fonts stylesheet URL for whichever families this theme uses. */
export function fontsHref(theme: Theme) {
  const f = fontFamilies(theme);
  const spec = (name: string, axes: string) =>
    encodeURIComponent(name).replace(/%20/g, "+") + ":" + axes;
  const parts = [
    spec(f.display, "wght@400;500;700;900"),
    spec(f.body, "ital,wght@0,400;0,500;0,600;1,400"),
    spec(f.mono, "wght@400;500;600"),
  ];
  return "https://fonts.googleapis.com/css2?family=" + parts.join("&family=") + "&display=swap";
}

const DENSITY = {
  compact: { pad: "14px 16px 16px", gap: "10px", slotGap: "11px", body: "16px" },
  normal: { pad: "20px 22px 22px", gap: "15px", slotGap: "15px", body: "16.5px" },
  roomy: { pad: "28px 30px 30px", gap: "21px", slotGap: "20px", body: "17.5px" },
};

/** CSS that overrides the base stylesheet. Emitted after it, so it wins. */
export function themeCSS(theme: Theme) {
  const out: string[] = [];
  const vars = (bag: Record<string, string> | undefined) =>
    bag
      ? Object.entries(bag)
          .map(([k, v]) => `${CSS_VAR[k]}:${v}`)
          .join(";")
      : "";

  // Light must land on bare :root, and dark in both the media query and the
  // explicit stamp, or a toggled theme keeps the old palette.
  if (theme.light) out.push(`:root{${vars(theme.light)}}`);
  if (theme.dark) {
    out.push(`@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars(theme.dark)}}}`);
    out.push(`:root[data-theme="dark"]{${vars(theme.dark)}}`);
  }
  // A light-only override would otherwise bleed into dark mode.
  if (theme.light && !theme.dark) {
    out.push(`@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars(theme.light)}}}`);
    out.push(`:root[data-theme="dark"]{${vars(theme.light)}}`);
  }

  const f = fontFamilies(theme);
  out.push(
    `h1,h2,.city,.trip-name,.route,.leg-title,.note h3,.chat-title{font-family:"${f.display}",${FALLBACK.display}}`,
    `body,.slot-body,.standfirst,.note p,.bubble{font-family:"${f.body}",${FALLBACK.body}}`,
    `.mono,.daynum,.eyebrow,.chip,.stat dt,.leg-meta,.from-note,.slot-label,.shot figcaption,.fares th,.trip-meta,.trip-date{font-family:"${f.mono}",${FALLBACK.mono}}`,
  );

  if (theme.layout?.width) out.push(`.wrap{max-width:${theme.layout.width}px}`);
  if (theme.layout?.radius != null) {
    const r = theme.layout.radius;
    out.push(`.day,.leg,.shot img,.trip-card,.stats{border-radius:${r}px}`);
  }
  if (theme.layout?.density) {
    const d = DENSITY[theme.layout.density];
    out.push(
      `.day{padding:${d.pad}}`,
      `.slots{gap:${d.slotGap}}`,
      `.timeline{row-gap:${d.gap}}`,
      `.slot-body{font-size:${d.body}}`,
    );
  }

  return out.join("\n");
}
