import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'studycomp_workspace_settings_v1';

const DEFAULTS = {
  appearance: 'dark',
  defaultFocusMinutes: 25,
  defaultBreakMinutes: 5,
  longBreakMinutes: 15,
  autoStartNextSession: false,
  sessionCompleteAlert: true,
  reminderAlert: true,
  soundEnabled: false,
  motionEnabled: true
};

function resolveAppearance(mode) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyAppearance(mode) {
  const resolved = resolveAppearance(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

function SettingsPanel() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [resolvedTheme, setResolvedTheme] = useState('dark');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings((current) => ({ ...current, ...parsed }));
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
    }
  }, [settings]);

  useEffect(() => {
    const syncTheme = () => {
      const nextTheme = resolveAppearance(settings.appearance);
      setResolvedTheme(nextTheme);
      applyAppearance(settings.appearance);
    };

    syncTheme();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (settings.appearance === 'system') {
        syncTheme();
      }
    };

    media.addEventListener?.('change', handleChange);
    media.addListener?.(handleChange);

    return () => {
      media.removeEventListener?.('change', handleChange);
      media.removeListener?.(handleChange);
    };
  }, [settings.appearance]);

  const surfaceClass = useMemo(
    () =>
      resolvedTheme === 'light'
        ? 'border-[rgba(24,24,28,0.08)] bg-[rgba(255,255,255,0.72)] text-[#1E1B22] backdrop-blur-[12px]'
        : 'border-white/6 bg-[rgba(255,255,255,0.03)] text-[#F5F2EE] backdrop-blur-[12px]',
    [resolvedTheme]
  );

  const mutedTextClass = resolvedTheme === 'light' ? 'text-[rgba(30,27,34,0.58)]' : 'text-[rgba(245,242,238,0.58)]';
  const sectionLabelClass = resolvedTheme === 'light' ? 'text-[rgba(30,27,34,0.42)]' : 'text-[rgba(245,242,238,0.42)]';
  const inputClass =
    resolvedTheme === 'light'
      ? 'border-[rgba(30,27,34,0.10)] bg-[rgba(255,255,255,0.86)] text-[#1E1B22]'
      : 'border-white/6 bg-[rgba(12,11,17,0.76)] text-[#F5F2EE]';
  const rowBorderClass = resolvedTheme === 'light' ? 'border-[rgba(30,27,34,0.08)]' : 'border-white/5';

  const update = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const renderSwitch = (checked, onChange) => (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`relative h-7 w-[46px] rounded-full transition ${
        checked
          ? 'bg-[linear-gradient(135deg,#FF8A3D_0%,#FF5C7A_100%)]'
          : resolvedTheme === 'light'
            ? 'bg-[rgba(30,27,34,0.16)]'
            : 'bg-[rgba(255,255,255,0.16)]'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition ${checked ? 'left-[21px]' : 'left-[3px]'}`}
      />
    </button>
  );

  const renderToggleRow = (label, key) => (
    <div key={key} className={`flex h-14 items-center justify-between border-b ${rowBorderClass} pr-1`}>
      <span className={`text-[15px] font-medium ${resolvedTheme === 'light' ? 'text-[#1E1B22]' : 'text-[#F5F2EE]'}`}>{label}</span>
      {renderSwitch(Boolean(settings[key]), () => update(key, !settings[key]))}
    </div>
  );

  return (
    <div
      className={`mx-auto w-full max-w-[960px] rounded-[24px] border px-7 pb-10 pt-8 ${surfaceClass}`}
    >
      <div>
        <h2 className={`text-[28px] font-bold ${resolvedTheme === 'light' ? 'text-[#1E1B22]' : 'text-[#F5F2EE]'}`}>Settings</h2>
        <p className={`mt-[6px] text-[14px] font-medium ${mutedTextClass}`}>
          Manage appearance, session defaults, and alerts.
        </p>
      </div>

      <div className="mt-7">
        <p className={`text-[12px] font-bold uppercase tracking-[0.14em] ${sectionLabelClass}`}>Appearance</p>
        <div className="mt-[14px] grid grid-cols-3 gap-3">
          {['light', 'dark', 'system'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => update('appearance', mode)}
              className={`h-[52px] rounded-[16px] border text-[15px] font-semibold transition ${
                settings.appearance === mode
                  ? 'border-[rgba(255,138,61,0.42)] bg-[rgba(255,138,61,0.14)] text-[#F5F2EE] shadow-[inset_0_0_0_1px_rgba(255,138,61,0.18)]'
                  : resolvedTheme === 'light'
                    ? 'border-[rgba(24,24,28,0.08)] bg-[rgba(255,255,255,0.45)] text-[rgba(30,27,34,0.82)]'
                    : 'border-white/6 bg-white/3 text-[rgba(245,242,238,0.82)]'
              }`}
            >
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className={`text-[12px] font-bold uppercase tracking-[0.14em] ${sectionLabelClass}`}>Session defaults</p>
        <div className="mt-[14px] grid grid-cols-3 gap-4">
          {[
            ['Focus', 'defaultFocusMinutes', 1, 240],
            ['Break', 'defaultBreakMinutes', 1, 120],
            ['Long break', 'longBreakMinutes', 1, 180]
          ].map(([label, key, min, max]) => (
            <label key={key} className="block">
              <span className={`mb-2 block text-[13px] font-semibold ${resolvedTheme === 'light' ? 'text-[rgba(30,27,34,0.72)]' : 'text-[rgba(245,242,238,0.72)]'}`}>
                {label}
              </span>
              <input
                type="number"
                min={min}
                max={max}
                value={settings[key]}
                onChange={(e) => update(key, Math.max(min, Math.min(max, Number(e.target.value) || min)))}
                className={`h-[52px] w-full rounded-[16px] border px-4 text-[18px] font-semibold outline-none focus:border-[rgba(255,138,61,0.5)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)] ${inputClass}`}
              />
            </label>
          ))}
        </div>
        <p className={`mt-[10px] text-[13px] font-medium ${resolvedTheme === 'light' ? 'text-[rgba(30,27,34,0.46)]' : 'text-[rgba(245,242,238,0.46)]'}`}>
          Used when a new session starts.
        </p>
      </div>

      <div className="mt-[34px]">
        <p className={`text-[12px] font-bold uppercase tracking-[0.14em] ${sectionLabelClass}`}>Notifications</p>
        <div className="mt-[14px]">
          {renderToggleRow('Session complete alert', 'sessionCompleteAlert')}
          {renderToggleRow('Reminder alert', 'reminderAlert')}
          {renderToggleRow('Sound', 'soundEnabled')}
        </div>
      </div>

      <div className="mt-[34px]">
        <p className={`text-[12px] font-bold uppercase tracking-[0.14em] ${sectionLabelClass}`}>Advanced</p>
        <div className="mt-[14px]">
          {renderToggleRow('Auto-start next session', 'autoStartNextSession')}
          {renderToggleRow('Background motion', 'motionEnabled')}
        </div>
        <p className={`mt-[10px] text-[13px] font-medium ${resolvedTheme === 'light' ? 'text-[rgba(30,27,34,0.42)]' : 'text-[rgba(245,242,238,0.42)]'}`}>
          These affect session behavior and motion.
        </p>
      </div>

      <p className={`mt-[26px] text-[13px] font-medium ${resolvedTheme === 'light' ? 'text-[rgba(30,27,34,0.42)]' : 'text-[rgba(245,242,238,0.42)]'}`}>
        Changes are saved automatically.
      </p>
    </div>
  );
}

export default SettingsPanel;

