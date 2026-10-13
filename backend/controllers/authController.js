const authService = require("../services/authService");
const socialAuth = require("../services/socialAuthService");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const httpError = require("../utils/httpError");
const { getSettings } = require("../services/settingsService");

// COOKIE_SAMESITE: "lax" (default, frontend + backend on the same site) or "none"
// (frontend and backend on DIFFERENT domains, e.g. Vercel + Render; "none" requires HTTPS).
const SAME_SITE = ["lax", "strict", "none"].includes(process.env.COOKIE_SAMESITE) ? process.env.COOKIE_SAMESITE : "lax";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || SAME_SITE === "none",
  sameSite: SAME_SITE,
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days, renewed every time the person comes back (see refresh below)
};

const register = asyncHandler(async (req, res) => {
  // An admin can close new sign-ups (Admin -> Settings)
  if (!(await getSettings()).registrationEnabled) throw httpError(403, "New registrations are closed right now");
  const { user, accessToken, refreshToken } = await authService.registerUser(req.body);
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
  return sendSuccess(res, {
    statusCode: 201,
    message: "Account created successfully",
    data: { user, accessToken },
  });
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.loginUser(req.body);
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
  return sendSuccess(res, {
    message: "Logged in successfully",
    data: { user, accessToken },
  });
});

// Google / Apple: the browser sends the ID token it received from the provider
const socialLogin = (signIn) => asyncHandler(async (req, res) => {
  const allowSignup = !!(await getSettings()).registrationEnabled;
  const { user, accessToken, refreshToken } = await signIn(req.body, { allowSignup });
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
  return sendSuccess(res, { message: "Logged in successfully", data: { user, accessToken } });
});
const google = socialLogin(socialAuth.googleSignIn);
const apple = socialLogin(socialAuth.appleSignIn);

// Which social buttons the login page should show (the client ids are set on the server)
const providers = asyncHandler(async (req, res) => {
  return sendSuccess(res, { message: "Sign-in methods", data: socialAuth.providers() });
});

const refresh = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken } = await authService.refreshAccessToken(req.cookies?.refreshToken);
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS); // renew: staying away 90 days is the only way to be logged out
  return sendSuccess(res, { message: "Token refreshed", data: { accessToken } });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
  return sendSuccess(res, { message: "Logged out successfully" });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  return sendSuccess(res, { message: "Current user", data: { user: authService.sanitizeUser(user) } });
});

module.exports = { register, login, google, apple, providers, refresh, logout, getMe };
