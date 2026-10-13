// Names of Islamic events/notes come from the server in English; this maps them to translation keys.
// Anything not listed here is shown as the server sent it (never hidden).
const EVENT_KEYS = {
  "Islamic New Year": "ev.newYear",
  "Day of Ashura": "ev.ashura",
  "Mawlid an-Nabi": "ev.mawlid",
  "Isra and Mi'raj": "ev.israMiraj",
  "Mid-Sha'ban": "ev.midShaban",
  "First day of Ramadan": "ev.firstRamadan",
  "Last ten nights of Ramadan": "ev.lastTen",
  "Laylat al-Qadr (search)": "ev.qadr",
  "Eid al-Fitr": "ev.fitr",
  "Day of Arafah": "ev.arafah",
  "Eid al-Adha": "ev.adha"
};
const NOTE_KEYS = {
  "1 Muharram": "evn.muh1",
  "10 Muharram": "evn.muh10",
  "9 Dhul Hijjah": "evn.hij9",
  "10 Dhul Hijjah": "evn.hij10",
  "Commonly observed; scholars differ on observing it": "evn.mawlid",
  "Commonly observed date": "evn.common",
  "Subject to moon sighting": "evn.moon",
  "Seek Laylat al-Qadr in the odd nights of the last ten": "evn.seekQadr",
  "Seek it in the odd nights of the last ten": "evn.seekIt"
};

export const eventName = (t, name) => (EVENT_KEYS[name] ? t(EVENT_KEYS[name]) : name);
export const eventNote = (t, note) => (NOTE_KEYS[note] ? t(NOTE_KEYS[note]) : note);
export const hijriMonthName = (t, number, fallback) => (number >= 1 && number <= 12 ? t(`hm.${number}`) : fallback);
export const daysUntilText = (t, n) => (n === 0 ? t("cal.in0") : n === 1 ? t("cal.in1") : t("cal.inDays", { n }));

// Gregorian names in the chosen language (the browser knows them, so no list to maintain)
export const gregorianMonth = (locale, month) => new Date(2023, month - 1, 1).toLocaleDateString(locale, { month: "long" });
export const weekdayShort = (locale, index) => new Date(2023, 0, 1 + index).toLocaleDateString(locale, { weekday: "short" });
export const weekdayLong = (locale, date) => date.toLocaleDateString(locale, { weekday: "long" });
