/**
 * Short form cues shown in workout mode, keyed by built-in exercise name (`CATALOG`).
 * A test fails if a built-in has none or a key isn't in the catalog. Keep each cue to one
 * line you could read between sets; three to five per exercise.
 */
export const FORM_TIPS: Record<string, readonly string[]> = {
  // Lifts
  'Bench Press': [
    'Pinch your shoulder blades together and keep them pinned to the bench.',
    'Feet flat and planted; drive through the floor.',
    'Lower the bar to mid-chest with elbows about 45° from your body.',
    'Press up and slightly back toward your face.',
  ],
  'Incline Bench Press': [
    'Set the bench to about 30°; higher turns it into a shoulder press.',
    'Keep your shoulder blades pulled back and down.',
    'Lower the bar to your upper chest, just below the collarbones.',
    'Keep your wrists stacked over your elbows.',
  ],
  Deadlift: [
    'Bar over mid-foot, about an inch from your shins.',
    'Brace your core and flatten your back before the bar leaves the floor.',
    'Push the floor away with your legs; keep the bar dragging up your legs.',
    'Finish by squeezing your glutes, not by leaning back.',
  ],
  'Barbell Row': [
    'Hinge until your torso is close to parallel, back flat.',
    'Pull the bar to your lower ribs, leading with the elbows.',
    'Squeeze your shoulder blades together at the top.',
    'Keep your torso still; no heaving the weight up.',
  ],
  'Pull-up': [
    'Start from a dead hang with your arms fully straight.',
    'Pull your shoulder blades down before you bend your elbows.',
    'Drive your elbows toward your hips until your chin clears the bar.',
    'Lower under control; no kipping.',
  ],
  'Lat Pulldown': [
    'Lean back slightly and keep your chest up.',
    'Pull the bar to your upper chest, not behind your neck.',
    'Think of pulling your elbows down into your back pockets.',
    'Let the bar rise slowly until your arms are straight.',
  ],
  'Overhead Press': [
    'Squeeze your glutes and brace so your lower back doesn’t arch.',
    'Start with the bar on your front shoulders, elbows slightly forward.',
    'Move your head back to let the bar pass, then push it through.',
    'Finish with the bar over your mid-foot, arms locked out.',
  ],
  'Lateral Raise': [
    'Raise your arms out to the sides to shoulder height, no higher.',
    'Keep a slight bend in your elbows throughout.',
    'Lead with your elbows, not your hands.',
    'Use a weight you can lower slowly; no swinging.',
  ],
  'Dumbbell Curl': [
    'Pin your elbows to your sides.',
    'Turn your palms up as you curl and squeeze at the top.',
    'Lower all the way until your arms are straight.',
    'Keep your body still; don’t rock to lift the weight.',
  ],
  'Tricep Pushdown': [
    'Tuck your elbows at your sides and keep them there.',
    'Push down until your arms are fully straight.',
    'Let the bar come up only to about chest height.',
    'Stand tall with a slight forward lean.',
  ],
  Squat: [
    'Feet shoulder-width apart, toes turned out slightly.',
    'Brace your core and take a breath before each rep.',
    'Push your knees out over your toes as you sit down.',
    'Go to at least parallel, then drive up through your whole foot.',
  ],
  'Front Squat': [
    'Keep your elbows high so the bar sits on your shoulders.',
    'Stay upright; your chest leads out of the bottom.',
    'Let your knees travel forward over your toes.',
    'If your wrists hurt, loosen your grip to two or three fingers.',
  ],
  'Romanian Deadlift': [
    'Soft knees; the movement is a hip hinge, not a squat.',
    'Push your hips back and keep the bar close to your legs.',
    'Lower until you feel a stretch in your hamstrings.',
    'Keep your back flat; stop before it rounds.',
  ],
  'Leg Press': [
    'Feet shoulder-width apart in the middle of the platform.',
    'Lower until your knees reach about 90°.',
    'Keep your lower back and hips pressed into the seat.',
    'Don’t lock your knees out hard at the top.',
  ],
  Lunge: [
    'Take a long enough step that both knees reach about 90°.',
    'Keep your torso upright and your core tight.',
    'Your front knee tracks over your toes, not inward.',
    'Push through your front heel to come back up.',
  ],

  // Cardio
  Running: [
    'Run tall with a slight forward lean from the ankles.',
    'Land with your foot under your hips, not out in front.',
    'Keep your shoulders relaxed and your arms swinging front to back.',
    'Most runs should be at a pace you can talk at.',
  ],
  Biking: [
    'Set the saddle so your knee is slightly bent at the bottom of the stroke.',
    'Keep a light grip with relaxed shoulders and bent elbows.',
    'Spin smoothly; aim for 80–90 pedal turns a minute.',
    'Shift early before hills instead of grinding.',
  ],
  Hiking: [
    'Take shorter steps on steep ground.',
    'Use poles on descents to spare your knees.',
    'Keep a pace you can hold while talking.',
    'Drink and snack before you feel you need to.',
  ],
  'Downhill Skiing': [
    'Stay centered over your feet, shins pressing into your boots.',
    'Keep your hands forward where you can see them.',
    'Turn with your legs and keep your upper body facing downhill.',
    'Look ahead to where you’re going, not at your skis.',
  ],
  Swimming: [
    'Keep your head down and your body long and flat.',
    'Breathe out steadily underwater so you only inhale when you turn.',
    'Reach long and rotate from the hips with each stroke.',
    'Kick from the hips with mostly straight legs.',
  ],
  Rowing: [
    'Push with your legs first, then lean back, then pull with your arms.',
    'Return in reverse: arms, body, then legs.',
    'Keep your back straight and your shoulders down.',
    'Power comes from the drive; recover slowly.',
  ],
  Walking: [
    'Stand tall and look ahead, not at your feet.',
    'Swing your arms naturally to set the pace.',
    'Roll from heel to toe with each step.',
    'Brisk enough that you breathe harder but can still talk.',
  ],
  'Ski Touring': [
    'Slide your skis forward; don’t lift them.',
    'Use risers on steep skin tracks to save your calves.',
    'Keep a steady pace you can hold all the way up.',
    'Check avalanche conditions and carry your safety gear.',
  ],
  'Cross-Country Skiing': [
    'Kick down and back, then glide on one ski.',
    'Plant your poles near your feet and push past your hips.',
    'Keep a slight forward lean from your ankles.',
    'Relax your arms between pushes.',
  ],
  Snowshoeing: [
    'Take a slightly wider stance so the shoes don’t clip.',
    'Kick steps into the slope on steep climbs.',
    'Use poles for balance, especially on descents.',
    'Dress in layers and shed one before you overheat.',
  ],
  Climbing: [
    'Climb with your legs; push up rather than pulling with your arms.',
    'Keep your arms straight when you can to save grip.',
    'Keep your hips close to the wall.',
    'Look for your next foothold before you move a hand.',
  ],

  // Yoga
  Vinyasa: [
    'Link each movement to an inhale or an exhale.',
    'Keep your breath steady and audible through your nose.',
    'In chaturanga, keep your elbows tucked by your ribs.',
    'Rest in child’s pose whenever you need to.',
  ],
  Hatha: [
    'Hold each pose for several slow breaths.',
    'Build each pose from the ground up: feet, legs, then spine.',
    'Ease off to a point where you can still breathe calmly.',
    'Use blocks or a strap instead of forcing range.',
  ],
  Yin: [
    'Relax your muscles and let the pose hold you.',
    'Stay in each pose for three to five minutes.',
    'Go to a gentle stretch, never sharp pain.',
    'Come out of each pose slowly.',
  ],
  'Power Yoga': [
    'Brace your core through the transitions.',
    'Keep your alignment as you speed up; slow down if it slips.',
    'Breathe through your nose and match it to your movement.',
    'Take the easier version when you start to tire.',
  ],

  // Mobility
  Stretching: [
    'Warm up a few minutes first; don’t stretch cold muscles.',
    'Hold each stretch 30–60 seconds without bouncing.',
    'Breathe slowly and relax deeper on each exhale.',
    'Feel a stretch, never sharp pain.',
  ],
  'Foam Rolling': [
    'Roll slowly, about an inch per second.',
    'Pause for 20–30 seconds on tender spots.',
    'Stay off joints, bones and your lower back.',
    'Breathe and relax into the roller instead of tensing.',
  ],
};

/** Tips for a built-in exercise; custom exercises have none, even with a built-in's name. */
export function formTipsFor({ name, isCustom }: { name: string; isCustom: boolean }): readonly string[] | null {
  return isCustom ? null : FORM_TIPS[name] ?? null;
}
