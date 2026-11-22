import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]';

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 min-h-[32px] gap-1.5',
      md: 'text-xs px-3.5 py-2 min-h-[38px] sm:min-h-[36px] gap-2',
      lg: 'text-sm px-5 py-2.5 min-h-[44px] gap-2.5',
    };

    const variantStyles = {
      primary:
        'bg-app-accent text-app-accent-contrast hover:opacity-90 shadow-sm focus-visible:ring-app-accent font-semibold',
      secondary:
        'bg-app-surface-2 text-app-text hover:bg-app-border border border-app-border focus-visible:ring-app-accent',
      ghost:
        'text-app-text-muted hover:text-app-text hover:bg-app-surface-2 focus-visible:ring-app-accent',
      danger:
        'bg-app-danger text-white hover:opacity-90 shadow-sm focus-visible:ring-app-danger font-semibold',
      outline:
        'bg-transparent text-app-text border border-app-border hover:bg-app-surface-2 focus-visible:ring-app-accent',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
