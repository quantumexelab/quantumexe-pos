import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANG,
  dictionaries,
  isLang,
  LANG_OPTIONS,
  readStoredLang,
  writeStoredLang,
  type Lang,
} from "./dictionaries";

type I18nCtx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, fallback?: string) => string;
  options: typeof LANG_OPTIONS;
};

const Ctx = createContext<I18nCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return;
    setLangState(next);
    writeStoredLang(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "si" ? "si" : lang === "ta" ? "ta" : "en";
  }, [lang]);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const dict = dictionaries[lang] || dictionaries.en;
      return dict[key] ?? dictionaries.en[key] ?? fallback ?? key;
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, options: LANG_OPTIONS }),
    [lang, setLang, t]
  );

  return createElement(Ctx.Provider, { value }, children);
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      lang: DEFAULT_LANG,
      setLang: (_: Lang) => undefined,
      t: (key: string, fallback?: string) => dictionaries.en[key] ?? fallback ?? key,
      options: LANG_OPTIONS,
    } satisfies I18nCtx;
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export { LANG_OPTIONS, type Lang };
