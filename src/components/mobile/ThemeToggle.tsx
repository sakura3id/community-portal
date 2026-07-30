import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { t } from '../../lib/i18n';
import type { ThemeMode } from '../../hooks/useTheme';

const icons: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const labelKeys: Record<ThemeMode, string> = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
};

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const Icon = icons[theme];
  const label = t(labelKeys[theme]);

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={cycleTheme}
      aria-label={t('theme.toggle_label')}
      title={label}
    >
      <Icon size={16} />
      <span className="theme-toggle-label">{label}</span>
    </button>
  );
}
