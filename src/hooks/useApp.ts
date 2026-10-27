import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { SearchDockContext } from '../context/SearchDock';
import { AuthContext } from '../context/AuthContext';

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function useSearchDock() {
  const ctx = useContext(SearchDockContext);
  if (!ctx) throw new Error('useSearchDock must be used inside <SearchDockProvider>');
  return ctx;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
