# Design

## Theme

Dark-primary product. Deep cool navy (`#1C2035`) for dark, Apple off-white (`#F5F5F7`) for light.
Physical scene: someone glancing at their phone after paying at a coffee shop — ambient daylight or indoor light. Light mode is the daily driver; dark mode is for evenings and preference.

## Color Strategy

Restrained. One accent (`--purple`, iOS blue) for primary actions, active states, and focus rings only. Gold (`--gold`) reserved for amounts and financial data. Semantic colors (success/danger) for state only.

| Token | Dark | Light | Role |
|---|---|---|---|
| `--purple` | `#0A84FF` | `#0071E3` | Primary action, active nav, focus |
| `--gold` | `#FF9F0A` | `#FF9500` | Currency amounts, financial data |
| `--success` | `#30D158` | `#34C759` | Income, positive state |
| `--danger` | `#FF453A` | `#FF3B30` | Expense, error, delete |
| `--bg` | `#1C2035` | `#F5F5F7` | Page background |
| `--bg-card` | glass gradient | `#FFFFFF` | Card surfaces |
| `--text` | `#FFFFFF` | `#1D1D1F` | Primary text |
| `--text-muted` | `rgba(235,235,245,0.48)` | `#6E6E73` | Labels, metadata |

## Typography

System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
Numeric data: `font-variant-numeric: tabular-nums`

| Role | Size | Weight | Notes |
|---|---|---|---|
| Header title | 17px | 700 | `letter-spacing: -0.02em` |
| Section title | 15px | 600 | `letter-spacing: -0.01em` |
| Body | 14px | 400–500 | |
| Label/meta | 13px | 500–600 | |
| Caption | 11–12px | 500 | |
| Amount large | 32px | 700 | tabular-nums |
| Amount mid | 16–18px | 700 | tabular-nums |

## Spacing & Radii

```
--r-sm:   10px   inputs, small chips
--r-md:   16px   cards, transaction rows
--r-lg:   22px   section cards
--r-xl:   28px   modal sheet corners
--r-full: 9999px pill buttons, FAB, dots
```

Section cards: `padding: 18px`. Transaction rows: `padding: 11px 13px`. Stats grid: `gap: 8px`.

## Motion

Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo) for all UI interactions.
Duration: 150–220ms for micro-interactions, 280–320ms for sheet transitions.
Bars and progress fills: 650ms ease-out-expo.
No decorative animations. Motion = state change only.
Respect `prefers-reduced-motion`.

## Components

### Buttons
- **Primary (submit-btn)**: filled `--purple`, `border-radius: var(--r-full)`, 17px/600
- **Primary outline (export-btn.primary)**: `--purple-dim` bg, `--purple` border/text → fills on hover
- **Secondary (export-btn)**: glass card bg, muted text → subtle bg shift on hover
- **Icon button (icon-btn)**: 36×36 circle, glass bg → `--purple-dim` on hover, no glow

### Cards
- Glass effect in dark mode, solid white in light mode
- `box-shadow: var(--glass-inset-sm), var(--glass-shadow)` in dark
- Clean drop shadow in light: `0 1px 3px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.07)`
- No side-stripe borders — use full border tint or background tint for semantic color

### Insight cards
- Type communicated via icon + full border tint + background gradient
- Spike: amber border `rgba(245,158,11,0.28)` + amber background gradient
- Opportunity: green border `rgba(34,197,94,0.28)` + green background gradient

### Navigation (bottom)
- Floating pill: `border-radius: 28px`, backdrop blur
- Active tab: `color: var(--purple)`, icon `scale(1.12)`, dot indicator `4px` below
- Labels: 11px/500, no uppercase, minimal tracking

### Forms
- Inputs: `border-radius: var(--r-sm)`, focus ring `0 0 0 3px var(--purple-dim)`
- Amount input: 32px/700, bare (no border)
- Currency symbol: muted, 24px/600, no glow

## Interaction states

All interactive elements must have: default, hover, focus-visible, active, disabled.
- Hover: subtle background shift, no glow
- Focus: `outline: 2px solid var(--purple); outline-offset: 2px`
- Active: `transform: scale(0.96–0.99)` depending on size
- Disabled: `opacity: 0.3`
