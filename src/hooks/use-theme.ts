import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/components/ThemeContext';

export function useTheme() {
  const { isDark } = useAppTheme();
  return Colors[isDark ? 'dark' : 'light'];
}
