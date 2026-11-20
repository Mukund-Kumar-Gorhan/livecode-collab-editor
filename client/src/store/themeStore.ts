import { create } from 'zustand';
import { AppTheme } from '../types';
import { userApi } from '../services/api';

const THEME_STORAGE_KEY = 'livecode_theme';

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  description: string;
  previewColors: {
    bg: string;
    surface: string;
    accent: string;
    border: string;
  };
}

export const AVAILABLE_THEMES: ThemeConfig[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep navy/slate with electric cyan accents',
    previewColors: {
      bg: '#0e1117',
      surface: '#161b22',
      accent: '#38bdf8',
      border: '#30363d',
    },
  },
  {
    id: 'light',
    name: 'Clean Light',
    description: 'Crisp, high-contrast readable paper light',
    previewColors: {
      bg: '#f8fafc',
      surface: '#ffffff',
      accent: '#0284c7',
      border: '#cbd5e1',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'Classic vampire purple and pastel highlights',
    previewColors: {
      bg: '#282a36',
      surface: '#21222c',
      accent: '#bd93f9',
      border: '#44475a',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    description: 'Balanced Atom-inspired dark palette',
    previewColors: {
      bg: '#21252b',
      surface: '#282c34',
      accent: '#61afef',
      border: '#3e4451',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon pink, cyan & purple on midnight violet',
    previewColors: {
      bg: '#090814',
      surface: '#121026',
      accent: '#ff007f',
      border: '#362f6b',
    },
  },
];

const applyThemeToDom = (theme: AppTheme) => {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
};

const getInitialTheme = (): AppTheme => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    if (saved && AVAILABLE_THEMES.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'midnight';
};

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme, saveToDb?: boolean) => Promise<void>;
  initTheme: (userTheme?: AppTheme | null) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme = getInitialTheme();
  applyThemeToDom(initialTheme);

  return {
    theme: initialTheme,

    setTheme: async (theme: AppTheme, saveToDb: boolean = true) => {
      set({ theme });
      applyThemeToDom(theme);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // LocalStorage access fail safe
      }

      if (saveToDb) {
        try {
          await userApi.updateMe({ theme });
        } catch {
          // If offline or unauthenticated, ignore DB sync error
        }
      }
    },

    initTheme: (userTheme?: AppTheme | null) => {
      if (userTheme && AVAILABLE_THEMES.some((t) => t.id === userTheme)) {
        if (get().theme !== userTheme) {
          set({ theme: userTheme });
          applyThemeToDom(userTheme);
          try {
            localStorage.setItem(THEME_STORAGE_KEY, userTheme);
          } catch {}
        }
      } else {
        applyThemeToDom(get().theme);
      }
    },
  };
});
