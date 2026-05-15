import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Appearance } from "react-native";
import { getItem, setItem } from "../helper";

interface ThemeContextType {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  darkMode: false,
  setDarkMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkModeState] = useState(
    Appearance.getColorScheme() === "dark"
  );
  // null = follow system, true/false = user manual override
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
      // else null: no preference saved → keep following system
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

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
