/**
 * Short form cues shown in workout mode, keyed by built-in exercise name (`CATALOG`).
 * Exercises without an entry show no tips button. Keep each cue to one line you could
 * read between sets; up to five per exercise. A test fails if a key isn't in the catalog.
 */
export const FORM_TIPS: Record<string, readonly string[]> = {};

/** Tips for a built-in exercise; custom exercises have none, even with a built-in's name. */
export function formTipsFor({ name, isCustom }: { name: string; isCustom: boolean }): readonly string[] | null {
  return isCustom ? null : FORM_TIPS[name] ?? null;
}
