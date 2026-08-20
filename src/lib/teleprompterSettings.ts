// Persisted teleprompter preferences (speed / font size / text color).
// Stored locally so the user never has to re-configure after a refresh,
// a new script, or finishing a recording.

const STORAGE_KEY = "oratix.teleprompter.settings.v1";

export type TeleprompterTextColor = "white" | "red" | "blue";

export interface TeleprompterSettings {
  speed: number;
  fontSize: number;
  textColor: TeleprompterTextColor;
}

export const SPEED_MIN = 0.5;
export const SPEED_MAX = 10;
export const FONT_SIZE_MIN = 16;
export const FONT_SIZE_MAX = 80;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function loadTeleprompterSettings(defaults: TeleprompterSettings): TeleprompterSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TeleprompterSettings> | null;
    if (!parsed || typeof parsed !== "object") return defaults;

    const speed = typeof parsed.speed === "number" && Number.isFinite(parsed.speed)
      ? Math.round(clamp(parsed.speed, SPEED_MIN, SPEED_MAX) * 10) / 10
      : defaults.speed;
    const fontSize = typeof parsed.fontSize === "number" && Number.isFinite(parsed.fontSize)
      ? Math.round(clamp(parsed.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX))
      : defaults.fontSize;
    const textColor: TeleprompterTextColor =
      parsed.textColor === "red" || parsed.textColor === "blue" || parsed.textColor === "white"
        ? parsed.textColor
        : defaults.textColor;

    return { speed, fontSize, textColor };
  } catch {
    return defaults;
  }
}

export function saveTeleprompterSettings(settings: TeleprompterSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode / quota) — preferences are non-critical.
  }
}
