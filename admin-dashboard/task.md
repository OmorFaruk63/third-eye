# MUI Migration Tasks

## Phase 1 — Setup
- [x] Install MUI packages, remove Tailwind
- [x] Create src/theme.js (custom dark cyber theme)
- [x] Update src/main.jsx (ThemeProvider + CssBaseline)
- [x] Update vite.config.js (remove Tailwind plugin)
- [x] Replace src/index.css (only CCTV animations + global resets in MUI Theme)

## Phase 2 — Layout
- [x] Convert src/components/Layout.jsx to MUI (AppBar, Drawer, List, Dialog)

## Phase 3 — Pages
- [x] Convert src/pages/Overview.jsx to MUI (Grid, Cards, Tables, Progress)
- [x] Convert src/pages/Devices.jsx to MUI (Filter Buttons, Search, Table & Mobile Cards, Pagination)
- [x] Convert src/pages/Recordings.jsx to MUI (Grid, CCTV Cards, Checkboxes, Dialog triggers, Pagination)
- [x] Convert src/pages/Settings.jsx to MUI (LinearProgress, Step Papers, Endpoints List)

## Phase 4 — Verify
- [x] npm run build (zero errors verified)
- [x] npm run lint / oxlint (0 errors verified)
- [ ] Visual browser check (pending CDP browser subagent resolution)
