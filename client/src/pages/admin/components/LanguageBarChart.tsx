import React from 'react';
import { SupportedLanguage } from '../../../types';

interface LanguageUsageItem {
  language: SupportedLanguage;
  count: number;
  percentage: number;
}

interface LanguageBarChartProps {
  data: LanguageUsageItem[];
}

const LANGUAGE_CONFIG: Record<
  SupportedLanguage,
  { name: string; color: string; border: string; bg: string }
> = {
  python: {
    name: 'Python',
    color: '#10b981', // emerald
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/15',
  },
  javascript: {
    name: 'JavaScript',
    color: '#eab308', // yellow
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/15',
  },
  java: {
    name: 'Java',
    color: '#f97316', // orange
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/15',
  },
  cpp: {
    name: 'C++',
    color: '#0ea5e9', // sky
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/15',
  },
};

export const LanguageBarChart: React.FC<LanguageBarChartProps> = ({ data }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const config = LANGUAGE_CONFIG[item.language] || {
          name: item.language,
          color: '#38bdf8',
          border: 'border-app-border',
          bg: 'bg-app-surface-2',
        };
        const barWidthPercent = Math.max(6, Math.round((item.count / maxCount) * 100));

        return (
          <div key={item.language} className="group">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center space-x-2">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-semibold text-app-text">{config.name}</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-app-text-muted font-mono">{item.count} rooms</span>
                <span className="font-bold text-app-text font-mono w-10 text-right">
                  {item.percentage}%
                </span>
              </div>
            </div>

            {/* Bar Container */}
            <div className="w-full h-3 rounded-full bg-app-surface-2 overflow-hidden p-0.5 border border-app-border">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${barWidthPercent}%`,
                  backgroundColor: config.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
