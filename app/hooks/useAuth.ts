import { useRouter } from "expo-router";
import { useEffect } from "react";
import { getItem } from "../helper";

export default function useAuth(expectedRole?: "admin" | "waiter" | "bartender") {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const role = await getItem("@role");
      const placeId = await getItem("@placeId");
      const loggedIn = await getItem("@loggedIn");

      if (expectedRole === "admin") {
        if (!loggedIn || role !== "admin") {
          router.replace("/login");
          return;
        }
      } else {
        // Admin can enter any role screen for preview/testing
        if (role === "admin" && loggedIn) return;

        if (!placeId || !role) {
          router.replace("/join");
          return;
        }
        if (expectedRole && role !== expectedRole) {
          router.replace("/join");
          return;
        }
      }
    })();
  }, []);
}
