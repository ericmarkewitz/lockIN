# lockIN

A mobile app for planning and tracking workouts, built with Expo (SDK 58) and React Native. Data lives in a local SQLite database on the device.

## Features

- **Weekly plan setup.** On first launch, choose which days you train, which are rest days, and the exercises (with sets/reps, or minutes/distance) for each day. Edit it any time from the **Plan** button.
- **Calendar.** Day, Week (default) and Month views. The month view shows which days are planned, done, in progress, missed or rest.
- **Workout logging.** Open a day to see the full plan or focus on one lift at a time. Record weight and reps per set (or duration and distance for cardio), tick sets off, add or remove sets and exercises, and keep notes. The previous result for each exercise is shown as a hint.
- **Exercise categories.** Lifts, Cardio (running, biking, hiking, skiing, ...), Yoga and Mobility are built in. You can add your own exercises to any category.
- **CSV export.** Export all data, the last 30 days, or a custom date range. Choose which fields to include and share the file (e.g. with a trainer) through the system share sheet.

## Getting started

```bash
npm install
npx expo start
```

Requires Node with the built-in `node:sqlite` module (Node 26, matching CI; `node:sqlite` needs 22.13+ at minimum), which the tests use.

## Scripts

| Command | What it does |
| --- | --- |
| `npm test` | Run the Jest test suite |
| `npm run test:watch` | Re-run tests on change |
| `npm run type` | TypeScript check (`tsc --noEmit`) |
| `npx expo lint` | Lint |

CI runs typecheck, lint and tests on every push.

## Project layout

```
src/
  app/          Expo Router routes (thin wrappers around screens)
  screens/      Calendar, WorkoutView, PlanEditor, ExportScreen
  components/   SetRow, ExercisePicker, shared UI
  data/         Repositories: exercises, plan, workouts, export, csv
  db/           Db interface, migrations, DbContext
  lib/          Pure helpers: dates, calendar navigation, number parsing
  hooks/        useLoad
  test/         Test DB helper (node:sqlite) and render helper
```

### How the data works

- The **weekly plan** (`plan_days`, `plan_items`) is a template.
- A **workout** for a specific date is created from the plan the first time that day is opened. After that it is independent, so editing the plan never rewrites logged history. Saving the plan only regenerates future workouts that have nothing logged.
- Dates are local `YYYY-MM-DD` strings; weekdays use JS numbering (0 = Sunday), and the UI shows weeks starting Monday.
- Schema changes are append-only migrations in `src/db/migrations.ts`, tracked with `PRAGMA user_version`.

## Testing

The project is developed test-first. The data layer runs against a real in-memory SQLite database (`node:sqlite`) behind the same `Db` interface that `expo-sqlite` satisfies, so tests exercise actual SQL without mocks. Screen tests use React Native Testing Library against that same database, mocking only the router, file system and share sheet.
