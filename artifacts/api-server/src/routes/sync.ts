import { Router } from "express";
import {
  requireSupabaseUser,
  sendSupabaseError,
  supabaseRequest,
  type SupabaseUser,
} from "../lib/supabase";

const router = Router();
const ENTITY_NAMES = new Set([
  "profile",
  "applications",
  "contacts",
  "savedEvents",
  "cvDocuments",
]);

type SyncMutation = {
  idempotencyKey: string;
  entity: string;
  recordId: string;
  operation: "upsert" | "delete";
  payload?: Record<string, unknown>;
  updatedAt: string;
};

type SyncRecord = {
  entity: string;
  recordId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  deletedAt: string | null;
};

function currentUser(res: { locals: Record<string, unknown> }): SupabaseUser {
  return res.locals.supabaseUser as SupabaseUser;
}

function token(res: { locals: Record<string, unknown> }): string {
  return res.locals.supabaseAccessToken as string;
}

function isMutation(value: unknown): value is SyncMutation {
  if (!value || typeof value !== "object") return false;
  const mutation = value as Record<string, unknown>;
  return (
    typeof mutation.idempotencyKey === "string" &&
    typeof mutation.entity === "string" &&
    ENTITY_NAMES.has(mutation.entity) &&
    typeof mutation.recordId === "string" &&
    (mutation.operation === "upsert" || mutation.operation === "delete") &&
    typeof mutation.updatedAt === "string" &&
    (mutation.payload === undefined ||
      (typeof mutation.payload === "object" && mutation.payload !== null))
  );
}

function toRecord(row: Record<string, unknown>): SyncRecord {
  return {
    entity: String(row.entity),
    recordId: String(row.record_id),
    payload:
      typeof row.payload === "object" && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : {},
    updatedAt: String(row.updated_at),
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

router.post("/sync/pull", requireSupabaseUser, async (req, res) => {
  const since =
    typeof req.body?.since === "string" ? req.body.since : "1970-01-01T00:00:00.000Z";
  const entities = Array.isArray(req.body?.entities)
    ? req.body.entities.filter(
        (entity: unknown): entity is string =>
          typeof entity === "string" && ENTITY_NAMES.has(entity),
      )
    : [];

  try {
    const params = new URLSearchParams({
      select: "entity,record_id,payload,updated_at,deleted_at",
      user_id: `eq.${currentUser(res).id}`,
      updated_at: `gt.${since}`,
      order: "updated_at.asc",
      limit: "500",
    });
    if (entities.length) params.set("entity", `in.(${entities.join(",")})`);

    const rows = await supabaseRequest<Record<string, unknown>[]>(
      `/rest/v1/user_records?${params.toString()}`,
      {},
      token(res),
    );
    res.json({
      records: rows.map(toRecord),
      cursor: new Date().toISOString(),
    });
  } catch (error) {
    sendSupabaseError(req, res, error);
  }
});

router.post("/sync/push", requireSupabaseUser, async (req, res) => {
  const mutations = Array.isArray(req.body?.mutations)
    ? req.body.mutations
    : [];
  if (!mutations.every(isMutation)) {
    res.status(400).json({
      code: "invalid_sync_mutations",
      message: "Each sync mutation must include a valid entity, record, operation, and timestamp.",
    });
    return;
  }

  const applied: string[] = [];
  const conflicts: SyncRecord[] = [];
  try {
    for (const mutation of mutations) {
      const row = {
        user_id: currentUser(res).id,
        entity: mutation.entity,
        record_id: mutation.recordId,
        payload: mutation.operation === "delete" ? {} : mutation.payload ?? {},
        updated_at: mutation.updatedAt,
        deleted_at: mutation.operation === "delete" ? mutation.updatedAt : null,
        idempotency_key: mutation.idempotencyKey,
      };
      const result = await supabaseRequest<Record<string, unknown>[]>(
        "/rest/v1/user_records?on_conflict=user_id%2Centity%2Crecord_id",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: row,
        },
        token(res),
      );
      const saved = result[0];
      if (saved) applied.push(mutation.idempotencyKey);
    }
    res.json({
      applied,
      conflicts,
      cursor: new Date().toISOString(),
    });
  } catch (error) {
    sendSupabaseError(req, res, error);
  }
});

export default router;