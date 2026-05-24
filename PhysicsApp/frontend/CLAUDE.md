@AGENTS.md

# PhysicsApp/frontend

Source root for the React Native (Expo) mobile app. iOS + Android only — no web build.

See `../CLAUDE.md` for the source-tree contract (tech stack, design system, file naming, coding standards) and `../../CLAUDE.md` for project-level context. Both are authoritative; this file just adds frontend-local reminders.

## Local reminders

- **Routing:** file-based via `expo-router` — every route is a file in `src/app/`. No React Navigation; no `App.tsx` entry point (the entry is `expo-router/entry` per `package.json`).
- **Path alias:** `@/*` → `./src/*` (e.g. `import { theme } from '@/ui/theme'`).
- **Theme:** UI defaults to the dark minimalist sci-fi palette in `src/ui/theme.ts` — derived from `../../docs/product/visualization-theme.md`. Do not introduce light-mode variants.
- **Physics tick lives on the UI thread.** Drive Matter.js from a Reanimated 4 `useFrameCallback` worklet — never from `requestAnimationFrame` or `setInterval` on the JS thread. Pass body positions to Skia via shared values.
- **Reanimated 4 note:** worklets are now in the separate `react-native-worklets` package (already a transitive dep). The legacy `react-native-reanimated/plugin` babel plugin is **not** required in SDK 56 — do not add it.
- **Asset & body discipline:** see the resource-conservation rules in `../../docs/product/visualization-theme.md` — they are a hard contract, not a suggestion.
