import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "../../assets/locales/ar.json";
import bs from "../../assets/locales/bs.json";
import de from "../../assets/locales/de.json";
import en from "../../assets/locales/en.json";
import es from "../../assets/locales/es.json";
import fr from "../../assets/locales/fr.json";
import it from "../../assets/locales/it.json";
import tr from "../../assets/locales/tr.json";

export const LANGUAGE_KEY = "@app_language";
export const SUPPORTED_LANGUAGES = ["bs", "en", "de", "tr", "fr", "es", "it", "ar"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const languageDetector = {
  type: "languageDetector" as const,
  async: true,
  detect: (callback: (lang: string) => void) => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((saved) => {
        if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
          callback(saved);
          return;
        }
        const deviceLocale = Localization.getLocales()[0]?.languageCode ?? "en";
        const matched = (SUPPORTED_LANGUAGES as readonly string[]).includes(deviceLocale)
          ? deviceLocale
          : "en";
        callback(matched);
      })
      .catch(() => callback("en"));
  },
  init: () => {},
  cacheUserLanguage: (lang: string) => {
    AsyncStorage.setItem(LANGUAGE_KEY, lang).catch(() => {});
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: "v3",
    resources: {
      bs: { translation: bs },
      en: { translation: en },
      de: { translation: de },
      tr: { translation: tr },
      fr: { translation: fr },
      es: { translation: es },
      it: { translation: it },
      ar: { translation: ar },
    },
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;
