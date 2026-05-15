import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { Alert, I18nManager } from "react-native";
import i18n, { LANGUAGE_KEY } from "../i18n";

export interface Language {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
  rtl: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "bs", label: "Bosnian",  nativeLabel: "Bosanski",   flag: "🇧🇦", rtl: false },
  { code: "en", label: "English",  nativeLabel: "English",    flag: "🇬🇧", rtl: false },
  { code: "de", label: "German",   nativeLabel: "Deutsch",    flag: "🇩🇪", rtl: false },
  { code: "tr", label: "Turkish",  nativeLabel: "Türkçe",     flag: "🇹🇷", rtl: false },
  { code: "fr", label: "French",   nativeLabel: "Français",   flag: "🇫🇷", rtl: false },
  { code: "es", label: "Spanish",  nativeLabel: "Español",    flag: "🇪🇸", rtl: false },
  { code: "it", label: "Italian",  nativeLabel: "Italiano",   flag: "🇮🇹", rtl: false },
  { code: "ar", label: "Arabic",   nativeLabel: "العربية",    flag: "🇸🇦", rtl: true  },
];

export function useLanguage() {
  const [currentLanguage, setCurrentLanguage] = useState<string>(
    i18n.resolvedLanguage ?? i18n.language ?? "en"
  );

  const changeLanguage = async (code: string) => {
    if (code === currentLanguage) return;

    const target = LANGUAGES.find((l) => l.code === code);
    const current = LANGUAGES.find((l) => l.code === currentLanguage);

    await i18n.changeLanguage(code);
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
    setCurrentLanguage(code);

    const rtlChanged = (target?.rtl ?? false) !== (current?.rtl ?? false);
    if (rtlChanged) {
      I18nManager.forceRTL(target?.rtl ?? false);
      Alert.alert(
        target?.rtl ? "تغيير الاتجاه" : "Layout Direction",
        target?.rtl
          ? "أعد تشغيل التطبيق لتطبيق الكتابة من اليمين إلى اليسار."
          : "Restart the app to apply the new layout direction.",
      );
    }
  };

  return { currentLanguage, changeLanguage, languages: LANGUAGES };
}
