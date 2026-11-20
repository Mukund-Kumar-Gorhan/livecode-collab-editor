import React from 'react';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-app-surface/50 border border-dashed border-app-border rounded-xl">
      <div className="w-12 h-12 rounded-xl bg-app-surface-2 border border-app-border flex items-center justify-center text-app-text-muted mb-3.5 shadow-inner">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-app-text mb-1 font-heading">{title}</h4>
      <p className="text-xs text-app-text-muted max-w-sm mb-5 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
