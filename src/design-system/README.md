# Airtime design system

Tokens live in `tokens.css` (colors, type, radii, spacing, layout) and are the only
source of color in the app — components never hard-code hex values. Dark is the
default; set `data-theme="light"` on `<html>` for light mode and `data-accent="violet"`
(or teal/blue/emerald/amber) to change the accent. `useTheme()` manages this.

All components are prefixed `A` and exported from `@/design-system`:

| Component | Purpose |
| --- | --- |
| `AAppShell` | Sidebar + header + bottom nav frame. Slots: `search`, `actions`, `rail`, default. |
| `AButton` | `variant` primary / outline / ghost / soft / danger, `size` sm / md / lg, `icon`, `loading`, `to`. |
| `AInput`, `ASelect`, `AToggle`, `ASearchBox` | Form controls with `v-model`. |
| `ASegmented`, `APills` | Single-choice option groups (`v-model`). |
| `AStarRating` | 1–5 stars, `v-model` number \| null, `size`, `readonly`. |
| `AShowCard` | Poster card with follow chip, optional rating and badge. |
| `APoster`, `ABadge`, `AAvatar`, `ACard`, `AStat` | Display primitives. |
| `APageHeader`, `ASectionHeader`, `ASettingsGroup`, `ASettingsRow` | Layout helpers. |
| `ADrawer`, `AModal`, `AToaster` | Overlays. Toasts come from `useUiStore().toast()`. |
| `ATable` | Admin data table with `cell-<key>` slots. |
| `ASkeleton`, `AEmptyState`, `AAlert` | Loading, empty and error states. |

Components are presentational: no Supabase calls, no store access (except `AToaster`).
