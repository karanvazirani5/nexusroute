import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { API_BASE } from "./constants";

/**
 * Hook that returns an `authFetch` function which automatically injects
 * the Clerk Bearer token when the user is signed in.
 * Falls back to a plain (unauthenticated) fetch otherwise.
 */
export function useAuthFetch() {
  const { getToken, isSignedIn } = useAuth();

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      headers.set("Content-Type", "application/json");

      if (isSignedIn) {
        const token = await getToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      }

      const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
      return fetch(url, { ...options, headers });
    },
    [getToken, isSignedIn],
  );

  return { authFetch, isSignedIn };
}
