(() => {
  'use strict';
  if (window.__recallStudyWindowV198) return;
  const core = window.recallCore;
  if (!core) return;
  window.__recallStudyWindowV198 = true;

  const START_HOUR = 8;
  const END_HOUR = 21;
  const state = () => core.getState();

  function atHour(ts, hour) {
    const d = new Date(Number(ts));
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  }

  function nextDayAt(ts, hour) {
    const d = new Date(Number(ts));
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  }

  function clampExistingDue(ts) {
    const due = Number(ts);
    if (!Number.isFinite(due) || due <= 0) return due;
    const start = atHour(due, START_HOUR);
    const end = atHour(due, END_HOUR);
    if (due < start) return start;
    if (due > end) return end;
    return due;
  }

  function clampNewDue(ts, now = Date.now()) {
    const raw = Number(ts);
    if (!Number.isFinite(raw) || raw <= 0) return raw;

    const start = atHour(raw, START_HOUR);
    const end = atHour(raw, END_HOUR);
    let target = raw;

    if (raw < start) target = start;
    else if (raw > end) target = end;

    // If a review is done after the 21:00 boundary, never create an
    // immediately-overdue loop for the same evening. Move that next review
    // to 08:00 on the following day instead.
    if (raw > now && target <= now) target = nextDayAt(now, START_HOUR);
    return target;
  }

  function migrateExistingSchedules() {
    const s = state();
    s.settings ||= {};
    s.settings.studyWindow ||= {};
    s.settings.studyWindow.startHour = START_HOUR;
    s.settings.studyWindow.endHour = END_HOUR;

    let changed = false;
    for (const deckId of Object.keys(core.DECKS || {})) {
      for (const card of (s.cards?.[deckId] || [])) {
        for (const direction of ['recognition','production']) {
          const sched = card.schedules?.[direction];
          if (!sched) continue;
          const oldDue = Number(sched.due);
          const newDue = clampExistingDue(oldDue);
          if (Number.isFinite(newDue) && newDue !== oldDue) {
            sched.due = newDue;
            changed = true;
          }
        }
      }
    }

    s.settings.studyWindow.migratedV198 = true;
    if (changed || !s.settings.studyWindow.migratedV198) core.save();
    else core.save();
  }

  const baseRateSchedule = core.getRateSchedule();
  core.setRateSchedule(function(schedule, kind) {
    const before = Date.now();
    const result = baseRateSchedule(schedule, kind);
    if (schedule && Number.isFinite(Number(schedule.due))) {
      schedule.due = clampNewDue(schedule.due, before);
    }
    return result;
  });

  migrateExistingSchedules();
})();