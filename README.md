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
| `npm run release:ios` | Build in the cloud and submit to TestFlight (see [Releasing](#releasing-to-testflight-ios)) |
| `npm run release:update` | Publish an over-the-air JS update to TestFlight builds |

CI runs typecheck, lint and tests on every push.

## Releasing to TestFlight (iOS)

Builds, signing and uploads run on [EAS](https://docs.expo.dev/eas/) (Expo's cloud build service). You don't need Xcode. Config lives in `eas.json` and `app.json` (bundle ID `com.ericmarkewitz.lockin`).

### One-time setup

You need a paid Apple Developer account and access to the `ericmarkewitz` Expo account.

1. From the project root, run `npx testflight` and follow the prompts:
   - Sign in to Expo and to your Apple Developer account.
   - Confirm the bundle ID `com.ericmarkewitz.lockin`. It can't be changed once the App Store Connect app exists.
   - Let it create the distribution certificate, the provisioning profile and an **App Store Connect API key**. EAS stores all of these, so later builds don't ask for Apple credentials.

   It creates the app in App Store Connect, builds it in the cloud (about 15–30 min) and uploads it. Apple then takes another 5–15 min to process it.
2. Set `submit.production.ios.ascAppId` in `eas.json` to the app's **Apple ID** (a number) from App Store Connect, under **General → App Information**. It's already set for lockIN (`6835224059`). It isn't a secret, and with it set, releases never ask which app to submit to.

### Adding testers

In App Store Connect, open the app and go to **TestFlight**:

- **Internal testers** (up to 100 members of your developer team): add them under *Internal Testing*. They get each build as soon as Apple finishes processing it, with no review.
- **External testers** (anyone): create a group under *External Testing*, add the build and turn on a **public link** you can share. A group's first build goes through Beta App Review, which usually takes under a day.

Testers install the **TestFlight** app from the App Store, then open the invite email or the public link.

### Shipping changes

| Change | Command | What happens |
| --- | --- | --- |
| Native: new or upgraded package with native code, `app.json` plugins or permissions, or an Expo SDK upgrade | `npm run release:ios` | A new build is made and submitted to TestFlight. The build number goes up automatically. |
| JS/TS only: screens, logic, styles, images | `npm run release:update` | An over-the-air update goes out. Testers get it the next time they relaunch the app (it can take two launches). |

Not sure which one you need? `npm run release:ios` is always safe. `runtimeVersion` uses the `fingerprint` policy, so an OTA update only reaches builds with matching native code. If native code changed, the update just won't reach existing builds, and you'll need a new build.

Bump `version` in `app.json` when you want a new user-facing version (for example `1.1.0`). Build numbers are managed remotely by EAS (`appVersionSource: "remote"`).

### Later: automation

The next step is an [EAS Workflow](https://docs.expo.dev/eas/workflows/examples/deploy-to-production/) on pushes to `main`. It fingerprints the app, then either publishes an OTA update or builds and submits to TestFlight. It needs the GitHub repo linked in the project settings on expo.dev and `ascAppId` (already set).

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
- A **workout** for a specific date is created from the plan the first time that day is opened. After that it is independent, so editing the plan never rewrites logged history. Saving the plan only regenerates future workouts that have nothing logged and haven't been changed by hand.
- Dates are local `YYYY-MM-DD` strings; weekdays use JS numbering (0 = Sunday), and the UI shows weeks starting Monday.
- Schema changes are append-only migrations in `src/db/migrations.ts`, tracked with `PRAGMA user_version`.

## Testing

The project is developed test-first. The data layer runs against a real in-memory SQLite database (`node:sqlite`) behind the same `Db` interface that `expo-sqlite` satisfies, so tests exercise actual SQL without mocks. Screen tests use React Native Testing Library against that same database, mocking only the router, file system and share sheet.
