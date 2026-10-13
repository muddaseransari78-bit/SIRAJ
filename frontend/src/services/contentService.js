import api from "./api";
import { localDate } from "../utils/date";

// ---- Hadith ----
export const fetchCollections = async () => (await api.get("/hadith/collections")).data.data.collections;
export const fetchHadithBooks = async (collection) => (await api.get(`/hadith/collections/${collection}/books`)).data.data.books;
export const fetchHadiths = async (collection, bookNumber, offset = 0, limit = 20) =>
  (await api.get(`/hadith/collections/${collection}/books/${bookNumber}/hadiths`, { params: { offset, limit } })).data.data;
export const searchHadith = async (q) => (await api.get("/hadith/search", { params: { q } })).data.data;
export const fetchHadithOfTheDay = async () => (await api.get("/hadith/today")).data.data.hadith;

// ---- Duas ----
export const fetchDuaCategories = async () => (await api.get("/duas")).data.data;
export const fetchDuas = async (category) => (await api.get(`/duas/${category}`)).data.data;

// ---- Qibla ----
export const fetchQibla = async (lat, lng) => (await api.get("/qibla", { params: { lat, lng } })).data.data;
export const searchPlaces = async (q) => (await api.get("/qibla/search", { params: { q } })).data.data.places;

// ---- Tasbeeh ----
// The browser sends its own local date, so "today" is correct in every time zone.
export const saveTasbeehSession = async (payload) => (await api.post("/tasbeeh/sessions", { ...payload, date: localDate() })).data.data;
export const fetchTasbeehHistory = async () => (await api.get("/tasbeeh/sessions", { params: { today: localDate() } })).data.data;
export const deleteTasbeehSession = async (id) => (await api.delete(`/tasbeeh/sessions/${id}`)).data;

// ---- User data ----
export const fetchBookmarks = async () => (await api.get("/bookmarks")).data.data.bookmarks;
export const deleteBookmark = async (id) => api.delete(`/bookmarks/${id}`);
export const fetchNotes = async () => (await api.get("/notes")).data.data.notes;
export const deleteNote = async (id) => api.delete(`/notes/${id}`);
export const fetchProgress = async () => (await api.get("/progress")).data.data.progress;
export const updateProgress = async (surahNumber, ayahNumber) => api.put("/progress", { surahNumber, ayahNumber, date: localDate() });
export const fetchProgressStats = async () => (await api.get("/progress/stats", { params: { today: localDate() } })).data.data.stats;
export const setCompleted = async (type, number, completed) =>
  (await api.post("/progress/complete", { type, number, completed, date: localDate() })).data.data.stats;
export const resetProgress = async () => (await api.post("/progress/reset", { date: localDate() })).data.data.stats;
export const addBookmark = async (payload) => (await api.post("/bookmarks", payload)).data.data.bookmark;
// Same as addBookmark but also tells us if it was already saved
export const saveBookmark = async (payload) => (await api.post("/bookmarks", payload)).data.data;
export const moveBookmark = async (id, collectionName) => (await api.patch(`/bookmarks/${id}`, { collectionName })).data.data.bookmark;

// ---- Bookmark collections ----
export const fetchBookmarkCollections = async () => (await api.get("/bookmarks/collections")).data.data.collections;
export const createCollection = async (name) => api.post("/bookmarks/collections", { name });
export const renameCollection = async (from, to) => api.patch("/bookmarks/collections/rename", { from, to });
export const deleteCollection = async (name) => api.delete("/bookmarks/collections", { params: { name } });

// ---- Tafseer / Calendar / Search / Announcements ----
export const fetchTafsirSources = async () => (await api.get("/tafseer/sources")).data.data.sources;
export const fetchTafsir = async (surah, ayah, source) => (await api.get(`/tafseer/${surah}/${ayah}`, { params: { source } })).data.data;
export const fetchCalendar = async (month, year) => (await api.get("/calendar", { params: { month, year } })).data.data;
// dmy = "DD-MM-YYYY". Exactly one of { gregorian, hijri }.
export const convertDate = async (params) => (await api.get("/calendar/convert", { params })).data.data;
export const fetchUpcomingEvents = async (date, limit = 8) => (await api.get("/calendar/upcoming", { params: { date, limit } })).data.data;
// opts.types: one type or a comma list ("quran,hadith"); opts.limit: 1-50. Both optional.
export const globalSearch = async (q, opts = {}) => {
  const params = { q };
  if (opts.types) params.types = opts.types;
  if (opts.limit) params.limit = opts.limit;
  if (opts.lang && opts.lang !== "en") params.lang = opts.lang; // Urdu / Arabic readers get Ayahs in their own language
  return (await api.get("/search", { params, signal: opts.signal })).data.data;
};
// Short list for the navbar search box (fast: no text search on the server).
export const searchSuggest = async (q, signal) => (await api.get("/search/suggest", { params: { q }, signal })).data.data.suggestions;
export const fetchAnnouncements = async () => (await api.get("/announcements")).data.data.announcements;

// ---- Admin ----
export const adminStats = async () => (await api.get("/admin/stats")).data.data;
export const adminUsers = async (params) => (await api.get("/admin/users", { params })).data.data;
export const adminSetActive = async (id, isActive) => (await api.patch(`/admin/users/${id}/active`, { isActive })).data.data.user;
export const adminSetRole = async (id, role) => (await api.patch(`/admin/users/${id}/role`, { role })).data.data.user;
export const adminSystem = async () => (await api.get("/admin/system")).data.data;
export const adminAnnouncements = async () => (await api.get("/admin/announcements")).data.data.announcements;
export const adminAddAnnouncement = async (p) => (await api.post("/admin/announcements", p)).data.data.announcement;
export const adminToggleAnnouncement = async (id, isActive) => (await api.patch(`/admin/announcements/${id}`, { isActive })).data.data.announcement;
export const adminDeleteAnnouncement = async (id) => api.delete(`/admin/announcements/${id}`);

// ---- Prayer (user) ----
export const fetchPrayerSettings = async () => (await api.get("/prayer/settings")).data.data.settings;
export const savePrayerSettings = async (payload) => (await api.put("/prayer/settings", payload)).data.data.settings;
export const fetchPrayerLog = async (date) => (await api.get("/prayer/log", { params: date ? { date } : {} })).data.data;
export const setPrayerLog = async (prayer, completed, date) => (await api.post("/prayer/log", { prayer, completed, date })).data.data.log;
export const fetchPrayerStats = async (today) => (await api.get("/prayer/stats", { params: today ? { today } : {} })).data.data;

// ---- Ramadan / fasting ----
export const fetchFasting = async (hijriYear) => (await api.get("/ramadan/fasting", { params: { hijriYear } })).data.data;
export const setFasting = async (payload) => (await api.post("/ramadan/fasting", payload)).data.data;
export const fetchRamadanInfo = async (date) => (await api.get("/ramadan/info", { params: { date } })).data.data;
export const fetchRamadanDuas = async () => (await api.get("/ramadan/duas")).data.data.duas;
export const fetchRamadanTimetable = async (params) => (await api.get("/ramadan/timetable", { params })).data.data;

// ---- Goals ----
const tzParams = () => ({ today: localDate(), tz: new Date().getTimezoneOffset() });
export const fetchGoals = async () => (await api.get("/goals", { params: tzParams() })).data.data;
export const saveGoal = async (type, target) => (await api.put(`/goals/${type}`, { target })).data.data.goal;
export const removeGoal = async (type) => api.delete(`/goals/${type}`);

// ---- Notifications ----
export const fetchNotifications = async () => (await api.get("/notifications")).data.data;
export const fetchUnreadCount = async () => (await api.get("/notifications/unread-count")).data.data.unreadCount;
export const markNotificationRead = async (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = async () => api.patch("/notifications/read-all");
export const deleteNotification = async (id) => api.delete(`/notifications/${id}`);

// ---- Profile / preferences ----
export const fetchPreferences = async () => (await api.get("/users/preferences")).data.data.preferences;
export const savePreferences = async (payload) => (await api.put("/users/preferences", payload)).data.data.preferences;
export const updateProfileName = async (name) => (await api.patch("/users/profile", { name })).data.data.user;
export const changePassword = async (currentPassword, newPassword) => api.post("/users/change-password", { currentPassword, newPassword });

// ---- Admin: broadcast ----
export const adminBroadcast = async (payload) => (await api.post("/admin/notifications/broadcast", payload)).data;

// ---- Source Finder (assistant) ----
export const askAssistant = async (q, lang) => (await api.post("/assistant/ask", { q, lang })).data.data;

// ---- Daily reminder (admin-managed) ----
export const fetchReminderOfTheDay = async () => (await api.get("/reminders/today")).data.data.reminder;

// ---- Admin: content, error logs ----
export const adminDuas = async () => (await api.get("/admin/duas")).data.data.duas;
export const adminSaveDua = async (id, payload) => (id ? api.put(`/admin/duas/${id}`, payload) : api.post("/admin/duas", payload));
export const adminToggleDua = async (id, isActive) => api.patch(`/admin/duas/${id}`, { isActive });
export const adminDeleteDua = async (id) => api.delete(`/admin/duas/${id}`);
export const adminReminders = async () => (await api.get("/admin/reminders")).data.data.reminders;
export const adminAddReminder = async (payload) => api.post("/admin/reminders", payload);
export const adminToggleReminder = async (id, isActive) => api.patch(`/admin/reminders/${id}`, { isActive });
export const adminDeleteReminder = async (id) => api.delete(`/admin/reminders/${id}`);
export const adminErrorLogs = async () => (await api.get("/admin/error-logs")).data.data;
export const adminClearErrorLogs = async () => api.delete("/admin/error-logs");

// ---- Dashboard (My SIRAJ) ----
export const fetchDashboardSummary = async () =>
  (await api.get("/dashboard/summary", { params: tzParams() })).data.data;
export const fetchReadingHistory = async (days = 84) =>
  (await api.get("/dashboard/reading-history", { params: { today: localDate(), days } })).data.data;
export const fetchPrayerHistory = async (days = 30) =>
  (await api.get("/dashboard/prayer-history", { params: { today: localDate(), days } })).data.data;

// ---- Phase 17: admin portal + public website settings ----
export const fetchPublicSettings = async () => (await api.get("/settings/public")).data.data.settings;
export const adminOverview = async () => (await api.get("/admin/overview", { params: { today: localDate() } })).data.data;
export const adminUserDetail = async (id) => (await api.get(`/admin/users/${id}`)).data.data;
export const adminSources = async () => (await api.get("/admin/sources")).data.data;
export const adminClearCache = async () => (await api.post("/admin/cache/clear")).data;
export const adminDuaCategories = async () => (await api.get("/admin/dua-categories")).data.data.categories;
export const adminGetSettings = async () => (await api.get("/admin/settings")).data.data.settings;
export const adminSaveSettings = async (patch) => (await api.put("/admin/settings", patch)).data.data.settings;
export const adminReport = async (from, to) => (await api.get("/admin/reports", { params: { from, to, today: localDate() } })).data.data;
export const adminAuditLog = async () => (await api.get("/admin/audit-log")).data.data.logs;
export const adminBroadcastHistory = async () => (await api.get("/admin/notifications/history")).data.data.logs;
export const adminApiStatus = async () => (await api.get("/admin/api-status")).data.data;
