(() => {
  'use strict';

  const DAY = 86400000;

  function nextHard(interval) {
    if (interval <= 0) return 1;
    if (interval <= 1) return 2;
    if (interval <= 2) return 4;
    if (interval <= 4) return 7;
    return Math.max(interval + 1, Math.round(interval * 1.45));
  }

  function nextGood(interval) {
    if (interval <= 0) return 1;
    if (interval <= 1) return 3;
    if (interval <= 3) return 7;
    if (interval <= 7) return 15;
    if (interval <= 15) return 35;
    return Math.max(interval + 1, Math.round(interval * 1.8));
  }

  function nextEasy(interval) {
    if (interval <= 0) return 3;
    if (interval <= 3) return 7;
    if (interval <= 7) return 18;
    if (interval <= 18) return 45;
    if (interval <= 45) return 100;
    return Math.max(interval + 2, Math.round(interval * 2));
  }

  function tunedRateSchedule(schedule, kind) {
    const now = Date.now();
    schedule.ease = Number(schedule.ease) || 2.5;
    schedule.interval = Number(schedule.interval) || 0;
    schedule.reps = Number(schedule.reps) || 0;
    schedule.lapses = Number(schedule.lapses) || 0;

    if (kind === 'again') {
      schedule.lapses += 1;
      schedule.ease = Math.max(1.3, schedule.ease - 0.20);
      schedule.interval = 0;
      schedule.due = now + 10 * 60000;
      return;
    }

    schedule.reps += 1;

    if (kind === 'hard') {
      schedule.ease = Math.max(1.3, schedule.ease - 0.10);
      schedule.interval = nextHard(schedule.interval);
    } else if (kind === 'good') {
      schedule.interval = nextGood(schedule.interval);
    } else if (kind === 'easy') {
      schedule.ease = Math.min(3.2, schedule.ease + 0.10);
      schedule.interval = nextEasy(schedule.interval);
    } else {
      return;
    }

    schedule.due = now + schedule.interval * DAY;
  }

  // The main app defines rateSchedule globally. Replacing the global function lets us
  // tune the SRS without touching saved card history or the main application bundle.
  window.rateSchedule = tunedRateSchedule;
})();
