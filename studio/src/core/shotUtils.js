// Pure shot lookup shared by browser (Remotion) and Node (software renderer).
export function shotAt(plan, frame) {
  return plan.shots.find((s) => frame >= s.a && frame < s.b) || plan.shots[plan.shots.length - 1];
}
