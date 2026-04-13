export const THEME_COLORS = [
    { id: "blue",    name: "Blue",    swatch: "hsl(220, 55%, 48%)" },
    { id: "indigo",  name: "Indigo",  swatch: "hsl(235, 60%, 55%)" },
    { id: "violet",  name: "Violet",  swatch: "hsl(262, 55%, 55%)" },
    { id: "rose",    name: "Rose",    swatch: "hsl(347, 65%, 55%)" },
    { id: "amber",   name: "Amber",   swatch: "hsl(35, 92%, 50%)" },
    { id: "teal",    name: "Teal",    swatch: "hsl(172, 60%, 38%)" },
    { id: "emerald", name: "Emerald", swatch: "hsl(158, 55%, 40%)" },
    { id: "slate",   name: "Slate",   swatch: "hsl(220, 14%, 40%)" },
] as const

export type ThemeColor = typeof THEME_COLORS[number]["id"]

export const DEFAULT_THEME_COLOR: ThemeColor = "blue"
