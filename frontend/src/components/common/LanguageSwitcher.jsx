import { useLanguage } from '../../context/LanguageContext';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div data-no-translate="true" className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-2 py-1.5">
      <span className="material-symbols-outlined text-slate-400 text-base">language</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer"
        aria-label="Language selector"
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;
