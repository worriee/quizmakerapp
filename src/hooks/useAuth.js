import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE_URL = "/api";

export function useAuth({ fetchSessions, restoreActiveSession }) {
  const [user, setUser] = useState(null);
  const [bootStatus, setBootStatusState] = useState("INITIALIZING");
  const bootStatusRef = useRef("INITIALIZING");
  const bootSequenceRef = useRef(null);

  const updateBootStatus = useCallback((status) => {
    setBootStatusState(status);
    bootStatusRef.current = status;
  }, []);

  const withTimeout = useCallback((promise, ms, taskName) => {
    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${taskName} timed out after ${ms}ms`)),
        ms,
      ),
    );
    return Promise.race([promise, timeout]);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      setUser(null);
      setBootStatusState("UNAUTHENTICATED");
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    let bootWatchdog;

    const bootSequence = async () => {
      try {
        const response = await withTimeout(
          fetch(`${API_BASE_URL}/auth/me`, {
            method: "GET",
            credentials: "include",
          }),
          5000,
          "Auth session check",
        );

        if (!response.ok) {
          if (isSubscribed) updateBootStatus("UNAUTHENTICATED");
          return;
        }

        const data = await response.json();
        if (!isSubscribed) return;

        setUser(data.user);
        updateBootStatus("AUTHENTICATING");

        const promises = [
          withTimeout(fetchSessions(), 7000, "Fetch sessions"),
        ];

        if (restoreActiveSession) {
          promises.push(
            withTimeout(
              restoreActiveSession(),
              7000,
              "Load active session",
            ),
          );
        }

        const results = await Promise.allSettled(promises);

        if (results.every((r) => r.status === "rejected")) {
          console.warn(
            "[Boot] All data fetches failed — connection lost",
          );
          if (isSubscribed) updateBootStatus("CONNECTION_ERROR");
          return;
        }

        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.warn(
              `[Boot] ${i === 0 ? "fetchSessions" : "restoreActiveSession"} failed, continuing with degraded data`,
              r.reason,
            );
          }
        });

        if (isSubscribed) updateBootStatus("READY");
      } catch (error) {
        const isNetworkError =
          error.message?.includes("timed out") ||
          error.message?.includes("Failed to fetch") ||
          error.name === "TypeError";

        console.error("Critical boot sequence failure:", error);
        if (isSubscribed) {
          updateBootStatus(
            isNetworkError ? "CONNECTION_ERROR" : "UNAUTHENTICATED",
          );
        }
      }
    };

    bootSequenceRef.current = bootSequence;

    bootWatchdog = setTimeout(() => {
      if (
        isSubscribed &&
        (bootStatusRef.current === "INITIALIZING" ||
          bootStatusRef.current === "AUTHENTICATING")
      ) {
        console.error(
          "[Boot] Global watchdog triggered: boot took too long. Showing connection error.",
        );
        updateBootStatus("CONNECTION_ERROR");
      }
    }, 15000);

    bootSequence();

    return () => {
      isSubscribed = false;
      clearTimeout(bootWatchdog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryBoot = useCallback(() => {
    if (bootSequenceRef.current) {
      updateBootStatus("INITIALIZING");
      bootSequenceRef.current();
    }
  }, [updateBootStatus]);

  return { user, bootStatus, logout, retryBoot };
}
