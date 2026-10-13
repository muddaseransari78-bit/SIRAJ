import api from "./api";

// ---- Logged-in users ----
export async function submitFeedback(payload) {
  const { data } = await api.post("/feedback", payload);
  return data.data.feedback;
}
export async function fetchMyFeedback() {
  const { data } = await api.get("/feedback/mine");
  return data.data.feedback;
}

// ---- Admin ----
export async function adminFeedbackList(params) {
  const { data } = await api.get("/admin/feedback", { params });
  return data.data;
}
export async function adminFeedbackSummary() {
  const { data } = await api.get("/admin/feedback/summary");
  return data.data;
}
export async function adminFeedbackSetStatus(id, status) {
  const { data } = await api.patch(`/admin/feedback/${id}`, { status });
  return data.data.feedback;
}
export async function adminFeedbackDelete(id) {
  await api.delete(`/admin/feedback/${id}`);
}
