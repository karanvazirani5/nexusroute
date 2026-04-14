"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { API_BASE } from "./constants";

export interface UserPreferences {
  default_track: string;
  preferred_providers: string[];
  excluded_providers: string[];
  budget_ceiling_per_1m: number | null;
  prefer_open_weight: boolean;
  updated_at: string | null;
}

export function usePreferences() {
  const { getToken, isSignedIn } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPrefs = useCallback(async () => {
    if (!isSignedIn) {
      setPreferences(null);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/user/preferences`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        setPreferences(await res.json());
      }
    } catch {
      // Non-blocking — preferences are optional
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  return { preferences, loading, refetch: fetchPrefs };
}
