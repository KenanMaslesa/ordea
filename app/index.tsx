import { useRouter } from "expo-router";
import { useEffect } from "react";
import { getItem } from "./helper";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const loggedIn = await getItem("@loggedIn");
      const role = await getItem("@role");
      const placeId = await getItem("@placeId");

      if (loggedIn && role === "admin") {
        router.replace(placeId ? "/admin" : "/register");
        return;
      }

      if (placeId && role === "waiter") {
        router.replace("/waiter");
        return;
      }

      if (placeId && role === "bartender") {
        router.replace("/bartender");
        return;
      }

      router.replace("/join");
    })();
  }, []);

  return null;
}
