import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import api from "../services/api";
import { saveBookmark, updateProgress } from "../services/contentService";

// Shared bookmark / note / "last read" handlers used by every Quran reading page.
export default function useAyahActions(notify) {
  const { user } = useAuth();
  const { t } = useI18n();

  async function bookmark(ayah) {
    if (!user) return notify(t("toast.loginBookmark"));
    try {
      const result = await saveBookmark({ type: "AYAH", surahNumber: ayah.surahNumber, ayahNumber: ayah.numberInSurah });
      notify(result.alreadySaved ? t("toast.alreadyBookmarked") : t("toast.bookmarkSaved"));
    } catch {
      notify(t("toast.bookmarkFail"));
    }
  }

  async function markRead(ayah) {
    if (!user) return notify(t("toast.loginPosition"));
    try {
      await updateProgress(ayah.surahNumber, ayah.numberInSurah);
      notify(t("toast.positionSaved", { s: ayah.surahNumber, a: ayah.numberInSurah }));
    } catch {
      notify(t("toast.positionFail"));
    }
  }

  // returns true when saved, so AyahCard can close the note box
  async function saveNote(ayah, text) {
    if (!user) { notify(t("toast.loginNote")); return false; }
    try {
      await api.post("/notes", { surahNumber: ayah.surahNumber, ayahNumber: ayah.numberInSurah, text });
      notify(t("toast.noteSaved"));
      return true;
    } catch {
      notify(t("toast.noteFail"));
      return false;
    }
  }

  return { bookmark, markRead, saveNote };
}
