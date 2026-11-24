This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Project: lockIN (workout planner/tracker)

### Architecture

- Persistence is `expo-sqlite`. All SQL lives in `src/data/*` and `src/db/*`; screens and components never write SQL.
- Repositories take a `Db` (`src/db/types.ts`), a small interface that `expo-sqlite`'s `SQLiteDatabase` satisfies. Screens get it via `useDb()` from `src/db/DbContext.tsx`.
- Route files in `src/app/` stay thin and render a component from `src/screens/`.
- The weekly plan is a template; a dated workout is materialized from it on first open (`ensureWorkout`) and is independent afterwards. Never make plan edits rewrite logged workouts.
- Dates are local `YYYY-MM-DD` strings (`src/lib/dates.ts`). Never parse them with `new Date('YYYY-MM-DD')` (UTC drift). Weekdays are JS numbering (0 = Sunday); weeks display Monday-first.

### Database changes

- Migrations in `src/db/migrations.ts` are append-only. Never edit a shipped migration; add a new entry and add a test.
- Use bound parameters (`?`) for all user input. `execAsync` does not escape parameters.

### Testing (test-driven development is required)

- Write the failing test first, then the implementation. New behavior and bug fixes both need tests; a bug fix starts with a test that reproduces it.
- Tests live in `__tests__/` folders next to the code and match `*.test.ts(x)`.
- Data-layer tests use `createTestDb()` from `src/test/testDb.ts` (in-memory `node:sqlite` plus real migrations). Do not mock the database.
- Screen tests use `renderWithDb` from `src/test/render.tsx`. Mock only the router, `expo-file-system` and `expo-sharing`.
- `@testing-library/react-native` v14 is async: `await render(...)` and `await fireEvent...`.
- `jest.mock` factories may only reference variables prefixed with `mock`.
- Run before finishing any task: `npm test`, `npm run type`, `npx expo lint`. CI runs the same three.

### Conventions

- Add selectable CSV columns in `EXPORT_FIELDS` (`src/data/export.ts`) and cover them in `export.test.ts`.
- Add a built-in exercise or category with one entry in `CATALOG` (`src/data/catalog.ts`) plus its figure in `MOTIONS` (`src/components/motion/motions.ts`); `syncCatalog` adds it to existing installs on launch, so no migration is needed. Renaming, moving or removing a built-in still needs a migration. A lift that also works other muscle groups is written `['Deadlift', 'Legs']` inside `lifts(...)`; those extra groups (table `exercise_subcategories`) only affect where the picker lists it, while `subcategory` stays the label shown everywhere else.
- Never delete an exercise a workout still points at. `removeExercise` (`src/data/exercises.ts`) hides it (`is_hidden`) instead, and the exercise list leaves hidden ones out; history, export and workout queries still join them.
- Exercise categories have a `kind` (`strength`, `cardio`, `mindbody`). It decides whether an exercise logs numbered sets (strength) or one entry, and its default fields.
- What an exercise records is a list of `fields` (`src/data/fields.ts`): weight, reps, time, distance, elevation, a count (steps, routes…), score or difficulty. It's resolved from the most specific stored list down (`resolveFields`): the workout exercise's or plan item's own `fields`, then the exercise's default the user chose (`exercises.fields`), then the catalog's (`exercises.builtin_fields`, set in `CATALOG` and kept in step by `syncCatalog`), then the category's `DEFAULT_FIELDS`. Adding an exercise to the plan asks what to record only for custom exercises and built-ins marked `asks` in `CATALOG` (synced to `builtin_asks`), until the user sets a default; every plan row, day and workout can change it; the day view and workout mode change it for that day (`setWorkoutExerciseFields`) and offer to make it the default (`setDefaultFields`, which pins logged days to what they recorded). Screens render inputs, targets and summaries from `fields`, never from `kind` alone. A new field needs a `FIELDS` entry, a `sets` column (via a migration) if it isn't stored in an existing one, `LOGGED_SET` updated, and an export column.
- `example/` is leftover Expo template code; it is gitignored and excluded from `tsconfig.json`. Don't import from it.
- When filing an issue, set its Priority field (P0, P1 or P2) on the lockIN! project (`gh project item-edit`, project 2). New issues are added to the project automatically, but Priority isn't set from labels. It's the field the Priority board groups by.
