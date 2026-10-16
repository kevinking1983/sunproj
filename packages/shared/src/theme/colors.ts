/**
 * RATION brand palette.
 *
 * Contrast rules (WCAG, measured):
 * - White on Kingdom Green 8.8:1, on Deep Covenant 12.3:1, on Living Vine 4.7:1 (AA only; keep text >= 14px).
 * - Divine Gold surfaces take Scripture Ink (6.7:1) or Deep Covenant (5.5:1) text. Never white (2.3:1).
 * - Divine Gold is never used as text or thin icons on Ivory/White (2.2:1). Use goldText instead.
 * - Olive Slate on Ivory 4.9:1 is for secondary labels only, never body copy.
 */
export const palette = {
  kingdomGreen: "#20543B",
  deepCovenant: "#123C2D",
  livingVine: "#3D805A",
  divineGold: "#D9A441",
  graceIvory: "#FFFCF6",
  pureWhite: "#FFFFFF",
  scriptureInk: "#202820",
  oliveSlate: "#667267",
} as const;

export const colors = {
  // brand
  primary: palette.kingdomGreen,
  primaryDark: palette.deepCovenant,
  primaryLight: palette.livingVine,
  accent: palette.divineGold,
  /** Darkened gold for the rare case gold must be text on a light surface (AA 4.6:1 on white). */
  goldText: "#8A6420",

  // surfaces
  background: palette.graceIvory,
  surface: palette.pureWhite,
  surfaceMuted: "#F3F1EA",
  border: "#E6E2D8",
  divider: "#EFECE4",

  // text
  text: palette.scriptureInk,
  textMuted: palette.oliveSlate,
  textOnPrimary: palette.pureWhite,
  textOnAccent: palette.scriptureInk,
  textOnDark: palette.graceIvory,

  // tints for chips, badges and backgrounds
  primaryTint: "#E4EFE8",
  accentTint: "#FBF1DC",

  // semantic
  success: palette.livingVine,
  successTint: "#E4EFE8",
  warning: "#B7791F",
  warningTint: "#FBF1DC",
  danger: "#B42318",
  dangerTint: "#FBE9E7",
  info: "#1F5F8B",
  infoTint: "#E3EEF6",

  // misc
  overlay: "rgba(18, 60, 45, 0.55)",
  skeleton: "#ECE9E1",
  rating: palette.divineGold,
} as const;

export type ColorToken = keyof typeof colors;
