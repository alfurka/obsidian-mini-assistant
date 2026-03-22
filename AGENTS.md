# Repository Guidelines

## Project Structure & Module Organization
This repository is an Obsidian plugin written in TypeScript. Keep source files in `src/`:
- `src/main.ts` bootstraps the plugin, commands, and settings tab.
- `src/modal.ts` contains chat, prompt, and speech UI flows.
- `src/openai_api.ts` handles provider-specific API calls.
- `src/settings.ts` stores defaults and shared constants.

Build artifacts and plugin metadata live at the root: `main.js`, `manifest.json`, `styles.css`, and `versions.json`. Treat `main.js` as generated output; make source changes in `src/`.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start the esbuild watcher for local development.
- `npm run build` — run TypeScript checks and produce a production `main.js`.
- `npx eslint src --ext .ts` — lint TypeScript files using the repo ESLint config.

For manual testing, copy the plugin into your Obsidian vault’s `.obsidian/plugins/mini-assistant/` folder, then reload plugins after rebuilding.

## Coding Style & Naming Conventions
Follow `.editorconfig`: tabs, width 4, UTF-8, LF line endings, and a final newline. Prefer TypeScript with explicit, descriptive names. Use:
- `PascalCase` for classes and modal/plugin types.
- `camelCase` for functions, methods, and variables.
- `UPPER_SNAKE_CASE` for exported constants such as defaults.

Keep changes focused and consistent with the existing small-module layout. Use ESLint before opening a PR.

## Testing Guidelines
There is no automated test suite yet. Until one is added, treat `npm run build` as the required verification step and manually exercise changed commands inside Obsidian. If you add tests, place them under `tests/` or alongside the module they cover, and keep names aligned with the feature, for example `openai_api.test.ts`.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects (for example, `Update manifest.json`). Prefer clearer messages like `Add provider fallback for speech`. Keep each commit focused on one change.

Pull requests should include:
- a brief summary of user-visible changes,
- linked issues or context when relevant,
- screenshots or short recordings for modal or settings UI updates,
- confirmation that `npm run build` and any manual Obsidian checks passed.

## Security & Release Notes
Never commit API keys or vault-specific data. Store secrets only in Obsidian settings. When changing plugin compatibility or releasing a new version, update `manifest.json` and `versions.json` together.
