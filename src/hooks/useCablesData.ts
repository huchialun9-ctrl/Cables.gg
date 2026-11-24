import { useState, useEffect, useCallback } from "react";
import type { BlogProfileConfig, DatabasePayload, SourcesPayload } from "../types/cables";

export function useDatabase() {
  const [data, setData] = useState<DatabasePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/database");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "無法載入 database.json");
      }
      const json = (await res.json()) as DatabasePayload;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入資料失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useSources() {
  const [data, setData] = useState<SourcesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sources");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "無法載入 sources.json");
      }
      const json = (await res.json()) as SourcesPayload;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入設定失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, setData, loading, error, refetch };
}

export function useBlogProfile() {
  const [data, setData] = useState<BlogProfileConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/blog-profile");
      if (res.ok) {
        const json = (await res.json()) as BlogProfileConfig;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, setData, loading, refetch };
}

