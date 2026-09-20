import { Router } from "express";
import {
  getBearerToken,
  getSupabaseUser,
  normalizeSupabaseSession,
  normalizeSupabaseUser,
  requireSupabaseUser,
  sendSupabaseError,
  supabaseRequest,
} from "../lib/supabase";

const router = Router();

function validCredentials(body: unknown): body is {
  email: string;
  password: string;
} {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return (
    typeof value.email === "string" &&
    value.email.includes("@") &&
    typeof value.password === "string" &&
    value.password.length >= 8
  );
}

function authResponse(raw: Record<string, unknown>) {
  const session = normalizeSupabaseSession(raw);
  return {
    session,
    user: normalizeSupabaseUser(
      (raw.user as Record<string, unknown> | undefined) ?? session?.user ?? null,
    ),
    requiresEmailConfirmation: !session,
  };
}

router.post("/auth/signup", async (req, res) => {
  if (!validCredentials(req.body)) {
    res.status(400).json({
      code: "invalid_credentials",
      message: "Email and password are required. Passwords must be at least 8 characters.",
    });
    return;
  }

  try {
    const raw = await supabaseRequest<Record<string, unknown>>(
      "/auth/v1/signup",
      { method: "POST", body: req.body },
    );
    res.json(authResponse(raw));
  } catch (error) {
    sendSupabaseError(req, res, error);
  }
});

router.post("/auth/login", async (req, res) => {
  if (!validCredentials(req.body)) {
    res.status(400).json({
      code: "invalid_credentials",
      message: "Email and password are required.",
    });
    return;
  }

  try {
    const raw = await supabaseRequest<Record<string, unknown>>(
      "/auth/v1/token?grant_type=password",
      { method: "POST", body: req.body },
    );
    const response = authResponse(raw);
    if (!response.session) {
      res.status(502).json({
        code: "auth_session_missing",
        message: "Supabase did not return a login session.",
      });
      return;
    }
    res.json(response);
  } catch (error) {
    sendSupabaseError(req, res, error);
  }
});

router.post("/auth/refresh", async (req, res) => {
  const refreshToken =
    req.body && typeof req.body.refreshToken === "string"
      ? req.body.refreshToken
      : null;
  if (!refreshToken) {
    res.status(400).json({
      code: "invalid_refresh_token",
      message: "A refresh token is required.",
    });
    return;
  }

  try {
    const raw = await supabaseRequest<Record<string, unknown>>(
      "/auth/v1/token?grant_type=refresh_token",
      { method: "POST", body: { refresh_token: refreshToken } },
    );
    const response = authResponse(raw);
    if (!response.session) {
      res.status(502).json({
        code: "auth_session_missing",
        message: "Supabase did not return a refreshed session.",
      });
      return;
    }
    res.json(response);
  } catch (error) {
    sendSupabaseError(req, res, error);
  }
});

router.post("/auth/logout", requireSupabaseUser, async (req, res) => {
  try {
    await supabaseRequest(
      "/auth/v1/logout",
      { method: "POST" },
      res.locals.supabaseAccessToken,
    );
    res.status(204).send();
  } catch (error) {
    sendSupabaseError(req, res, error);
  }
});

router.get("/auth/me", requireSupabaseUser, (req, res) => {
  res.json(res.locals.supabaseUser);
});

export default router;