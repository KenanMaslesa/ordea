import { PRIMARY } from "@/theme";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Appearance } from "react-native";
import { getItem, setItem } from "../helper";

interface ThemeContextType {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  /** Brand colour — loaded from AsyncStorage, editable by admin. */
  primaryColor: string;
  setPrimaryColor: (color: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  darkMode: false,
  setDarkMode: () => {},
  primaryColor: PRIMARY,
  setPrimaryColor: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkModeState] = useState(
    Appearance.getColorScheme() === "dark"
  );
  const [primaryColor, setPrimaryColorState] = useState(PRIMARY);
  const userOverrideRef = useRef<boolean | null>(null);

  useEffect(() => {
    getItem("@darkMode").then(val => {
      if (val === "on") {
        userOverrideRef.current = true;
        setDarkModeState(true);
      } else if (val === "off") {
        userOverrideRef.current = false;
        setDarkModeState(false);
      }
    });

    getItem("@primaryColor").then(val => {
      if (val) setPrimaryColorState(val);
    });

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (userOverrideRef.current === null) {
        setDarkModeState(colorScheme === "dark");
      }
    });
    return () => sub.remove();
  }, []);

  const setDarkMode = async (val: boolean) => {
    userOverrideRef.current = val;
    setDarkModeState(val);
    await setItem("@darkMode", val ? "on" : "off");
  };

  const setPrimaryColor = async (color: string) => {
    setPrimaryColorState(color);
    await setItem("@primaryColor", color);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, primaryColor, setPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
