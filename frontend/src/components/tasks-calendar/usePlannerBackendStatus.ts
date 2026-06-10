import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";

type HealthPayload = {
  status?: string;
  database?: { ok: boolean; message?: string };
};

export function usePlannerBackendStatus() {
  const [databaseOk, setDatabaseOk] = useState<boolean | null>(null);
  const [databaseMessage, setDatabaseMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<HealthPayload>("/health");
      const db = r.data?.database;
      if (db && typeof db.ok === "boolean") {
        setDatabaseOk(db.ok);
        setDatabaseMessage(db.ok ? null : db.message ?? "Database unavailable.");
      } else {
        setDatabaseOk(null);
        setDatabaseMessage(null);
      }
    } catch {
      setDatabaseOk(null);
      setDatabaseMessage(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { databaseOk, databaseMessage, refreshBackendStatus: refresh };
}
