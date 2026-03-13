import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createDomTranslator } from '../i18n/domTranslator';

const LANGUAGE_STORAGE_KEY = 'erp3_language';
const LanguageContext = createContext(null);

const getInitialLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === 'es' ? 'es' : 'en';
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(getInitialLanguage);
  const translatorRef = useRef(null);
  const languageRef = useRef(language);

  useEffect(() => {
    languageRef.current = language;
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    translatorRef.current?.refresh();
  }, [language]);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return undefined;

    translatorRef.current = createDomTranslator(root, () => languageRef.current);
    translatorRef.current.refresh();

    return () => {
      translatorRef.current?.disconnect();
      translatorRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
