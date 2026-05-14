import { useRouter } from "expo-router";
import { ReactNode, useEffect, useState } from "react";
import { getItem } from "../helper";

type Props = {
  children: ReactNode;
  role?: "waiter" | "bartender" | "admin";
};

export default function WithAuth({ children, role }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const loggedIn = await getItem("@loggedIn");
      const storedRole = await getItem("@role");

      if (!loggedIn) {
        router.replace("/login");
        return;
      }

      if (!storedRole) {
        router.replace("/role");
        return;
      }

      if (role && storedRole !== role) {
        router.replace("/role");
        return;
      }

      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  return <>{children}</>;
}
