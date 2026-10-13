const hijriApi = require("./external/hijriApi");
const { ramadanTarget } = require("../utils/hijriEvents");
const { daysBetweenDMY } = require("../utils/dates");

/**
 * Which Ramadan is the next/current one, when its first day is (calculated), and how far away.
 * todayDMY = the user's local date (DD-MM-YYYY).
 */
async function getRamadanInfo(todayDMY) {
  const today = (await hijriApi.gregorianToHijri(todayDMY)).hijri;
  const target = ramadanTarget(today);
  const first = await hijriApi.hijriToGregorian(`01-09-${target.year}`);
  return {
    hijriToday: today,
    ramadanYear: target.year,
    inProgress: target.inProgress,
    firstDay: first.gregorian, // calculated 1 Ramadan (moon sighting can move it by a day)
    daysUntil: target.inProgress ? 0 : daysBetweenDMY(todayDMY, first.gregorian.date),
  };
}

module.exports = { getRamadanInfo };
