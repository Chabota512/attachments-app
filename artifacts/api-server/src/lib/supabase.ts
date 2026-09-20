import { ReplitConnectors } from "@replit/connectors-sdk";
import type { NextFunction, Request, Response } from "express";

const connectors = new ReplitConnectors();

export interface SupabaseUser {
  id: string;
  email: string;
  createdAt?: string;
  lastSignInAt?: string;
}

export class SupabaseApiError extends Error {
  constructor(
    readonly status: number,
    readonly data: unknown,
  ) {
    super("Supabase request failed");
    this.name = "SupabaseApiError";
  }
}

function parseResponseBody(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function supabaseRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/json",
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const response = await connectors.proxy("supabase", path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = parseResponseBody(await response.text());

  if (!response.ok) {
    throw new SupabaseApiError(response.status, body);
  }

  return body as T;
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function normalizeUser(raw: Record<string, unknown>): SupabaseUser {
  return {
    id: String(raw.id ?? ""),
    email: String(raw.email ?? ""),
    createdAt: typeof raw.created_at === "string" ? raw.created_at : undefined,
    lastSignInAt:
      typeof raw.last_sign_in_at === "string" ? raw.last_sign_in_at : undefined,
  };
}

export async function getSupabaseUser(
  accessToken: string,
): Promise<SupabaseUser> {
  const raw = await supabaseRequest<Record<string, unknown>>(
    "/auth/v1/user",
    {},
    accessToken,
  );
  const user = normalizeUser(raw);
  if (!user.id || !user.email) {
    throw new SupabaseApiError(401, { message: "Invalid Supabase user" });
  }
  return user;
}

export async function requireSupabaseUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    res.status(401).json({
      code: "auth_required",
      message: "A bearer access token is required.",
    });
    return;
  }

  try {
    const user = await getSupabaseUser(accessToken);
    res.locals.supabaseAccessToken = accessToken;
    res.locals.supabaseUser = user;
    next();
  } catch (error) {
    if (error instanceof SupabaseApiError && error.status === 401) {
      res.status(401).json({
        code: "auth_invalid",
        message: "The Supabase session is invalid or expired.",
      });
      return;
    }
    req.log.error({ err: error }, "Supabase authentication failed");
    res.status(502).json({
      code: "supabase_unavailable",
      message: "Authentication service is temporarily unavailable.",
    });
  }
}

export function sendSupabaseError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  if (error instanceof SupabaseApiError) {
    if (error.status === 400 || error.status === 401 || error.status === 422) {
      res.status(error.status).json({
        code: error.status === 401 ? "auth_invalid" : "supabase_request_invalid",
        message: "Supabase rejected the request.",
        details: error.data,
      });
      return;
    }
  }

  req.log.error({ err: error }, "Supabase request failed");
  res.status(502).json({
    code: "supabase_unavailable",
    message: "Cloud service is temporarily unavailable. Try again later.",
  });
}

export function normalizeSupabaseUser(
  raw: Record<string, unknown> | null | undefined,
): SupabaseUser | null {
  if (!raw) return null;
  const user = normalizeUser(raw);
  return user.id && user.email ? user : null;
}

export function normalizeSupabaseSession(
  raw: Record<string, unknown> | null | undefined,
): {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt?: number;
  user: SupabaseUser;
} | null {
  if (!raw) return null;
  const user = normalizeSupabaseUser(
    (raw.user as Record<string, unknown> | undefined) ?? null,
  );
  if (
    typeof raw.access_token !== "string" ||
    typeof raw.refresh_token !== "string" ||
    typeof raw.expires_in !== "number" ||
    !user
  ) {
    return null;
  }

  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    tokenType: typeof raw.token_type === "string" ? raw.token_type : "bearer",
    expiresIn: raw.expires_in,
    expiresAt: typeof raw.expires_at === "number" ? raw.expires_at : undefined,
    user,
  };
}