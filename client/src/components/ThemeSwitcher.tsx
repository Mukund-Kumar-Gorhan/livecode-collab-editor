import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useThemeStore, AVAILABLE_THEMES } from '../store/themeStore';
import { AppTheme } from '../types';

export const ThemeSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (selectedTheme: AppTheme) => {
    setTheme(selectedTheme, true);
    setIsOpen(false);
  };

  const currentThemeConfig = AVAILABLE_THEMES.find((t) => t.id === theme) || AVAILABLE_THEMES[0];

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Change App Theme"
        className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text hover:bg-app-surface-2 transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-app-accent text-xs font-medium ${
          isOpen ? 'ring-1 ring-app-accent border-app-accent' : ''
        }`}
      >
        <Palette className="w-3.5 h-3.5 text-app-accent shrink-0" />
        {!compact && <span className="capitalize">{currentThemeConfig.name}</span>}
        <span className="flex items-center space-x-1 pl-1">
          <span
            className="w-2.5 h-2.5 rounded-full border border-black/20"
            style={{ backgroundColor: currentThemeConfig.previewColors.bg }}
          />
          <span
            className="w-2.5 h-2.5 rounded-full border border-black/20"
            style={{ backgroundColor: currentThemeConfig.previewColors.accent }}
          />
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-app-surface border border-app-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1.5 text-[11px] font-semibold text-app-text-muted uppercase tracking-wider border-b border-app-border mb-1">
            Theme Palette
          </div>
          <div className="space-y-1">
            {AVAILABLE_THEMES.map((item) => {
              const isSelected = item.id === theme;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors duration-150 ${
                    isSelected
                      ? 'bg-app-accent/15 text-app-text font-semibold border border-app-accent/30'
                      : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-2'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    {/* Theme Swatch Dot Stack */}
                    <div className="flex items-center -space-x-1">
                      <span
                        className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: item.previewColors.bg }}
                      />
                      <span
                        className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: item.previewColors.surface }}
                      />
                      <span
                        className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: item.previewColors.accent }}
                      />
                    </div>
                    <span>{item.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-app-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
