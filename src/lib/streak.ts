/** One miss pauses a streak; a second miss in a row ends it. */
export function pausedStreak(values: number[], doneThreshold = 0.5): number {
  let n = 0;
  let usedPause = false;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] >= doneThreshold) n += 1;
    else if (!usedPause) usedPause = true;
    else break;
  }
  return n;
}
