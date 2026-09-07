export const APP_THEMES = ["green", "red", "sky"] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export const DEFAULT_APP_THEME: AppTheme = "green";

export function resolveAppTheme(value: string | undefined): AppTheme {
	return (APP_THEMES as readonly string[]).includes(value ?? "")
		? (value as AppTheme)
		: DEFAULT_APP_THEME;
}
