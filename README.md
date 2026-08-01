# Flowly 💸

A Hebrew-first, RTL personal expense tracker — built as an installable PWA with a privacy-first design: **all data lives on your device**. No account, no server, no tracking of your finances.

## Features

- **Expense & income tracking** — quick add, categories, payment methods (cash / credit / Bit / transfer / check), payment splitting, and installment purchases that always sum exactly to the original amount
- **Multi-currency** — enter expenses in any currency; automatic conversion with live exchange rates (historical rates for back-dated entries), lossless display of the original amount
- **Bank & credit-card import** — parses Isracard / Bank Hapoalim Excel exports in the browser, converts foreign charges, and detects duplicates with a fuzzy matcher (±3-day settlement window, currency-aware tolerance)
- **Recurring expenses** — auto-posting monthly templates with limited-installment support, pause/resume, and stop-from-month
- **Analytics** — monthly summary with burn-rate ring, category / payment-method / card / merchant breakdowns, weekly trend, and a spending forecast
- **Travel mode** — per-trip budgets in trip currency with cash-vs-credit breakdown
- **Debt tracking** — who owes whom, settle into transactions
- **PWA** — offline-first, installable to home screen, share-target integration
- **Bilingual** — Hebrew (RTL) and English, light/dark theme

## Tech stack

- **React 18 + TypeScript**, built with **Vite**
- **vite-plugin-pwa** (Workbox service worker)
- **Recharts** for charts, **dnd-kit** for drag-to-reorder, **SheetJS** for in-browser Excel parsing
- State via React Context + `localStorage` persistence with cross-tab sync
- No backend — the entire app is static and runs client-side

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

## Privacy

All financial data is stored exclusively in the browser's `localStorage`. A full JSON backup/restore is built in (Settings → גיבוי) for migrating between devices.
