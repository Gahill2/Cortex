import type { Response } from "express";

type ApiMeta = {
  source?: "mock" | "live";
  timestamp: string;
};

type ApiSuccessEnvelope<T> = {
  ok: true;
  data: T;
  meta: ApiMeta;
};

export const sendSuccess = <T>(res: Response, data: T, source: "mock" | "live" = "mock"): void => {
  const body: ApiSuccessEnvelope<T> = {
    ok: true,
    data,
    meta: {
      source,
      timestamp: new Date().toISOString()
    }
  };
  res.json(body);
};
