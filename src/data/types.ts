export type CategoryKind = 'strength' | 'cardio' | 'mindbody';

export type Exercise = {
  id: number;
  categoryId: number;
  name: string;
  isCustom: boolean;
  categoryName: string;
  categoryKind: CategoryKind;
};

export type Category = {
  id: number;
  name: string;
  kind: CategoryKind;
  exercises: Exercise[];
};

export type Targets = {
  targetSets?: number | null;
  targetReps?: number | null;
  targetDurationMin?: number | null;
  targetDistance?: number | null;
};

export type PlanItemInput = Targets & { exerciseId: number };

export type PlanItem = PlanItemInput & {
  id: number;
  position: number;
  exerciseName: string;
  categoryName: string;
  categoryKind: CategoryKind;
};

export type PlanDay = { weekday: number; isRest: boolean; items: PlanItem[] };

export type WorkoutSet = {
  id: number;
  setNumber: number;
  targetReps: number | null;
  reps: number | null;
  weight: number | null;
  durationMin: number | null;
  distance: number | null;
  completed: boolean;
};

export type WorkoutExercise = {
  id: number;
  exerciseId: number;
  exerciseName: string;
  categoryName: string;
  categoryKind: CategoryKind;
  position: number;
  targetSets: number | null;
  targetReps: number | null;
  targetDurationMin: number | null;
  targetDistance: number | null;
  sets: WorkoutSet[];
};

export type Workout = {
  id: number;
  date: string;
  isRest: boolean;
  notes: string | null;
  exercises: WorkoutExercise[];
};

export type DayStatus = 'none' | 'rest' | 'planned' | 'partial' | 'completed' | 'missed';

export type DaySummary = {
  date: string;
  status: DayStatus;
  exerciseCount: number;
  kinds: CategoryKind[];
};
