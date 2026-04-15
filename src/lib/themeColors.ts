export const THEME_COLORS = [
    { id: "blue",    name: "Blue",    swatch: "hsl(220, 60%, 48%)" },
    { id: "indigo",  name: "Indigo",  swatch: "hsl(235, 65%, 55%)" },
    { id: "violet",  name: "Violet",  swatch: "hsl(262, 60%, 55%)" },
    { id: "rose",    name: "Rose",    swatch: "hsl(347, 70%, 55%)" },
    { id: "amber",   name: "Amber",   swatch: "hsl(35, 95%, 50%)" },
    { id: "teal",    name: "Teal",    swatch: "hsl(172, 66%, 38%)" },
    { id: "emerald", name: "Emerald", swatch: "hsl(158, 60%, 40%)" },
    { id: "slate",   name: "Slate",   swatch: "hsl(220, 18%, 40%)" },
] as const

export type ThemeColor = typeof THEME_COLORS[number]["id"]

export const DEFAULT_THEME_COLOR: ThemeColor = "blue"
