import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPasswordToggle?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      isPasswordToggle = false,
      type = 'text',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const effectiveType = isPasswordToggle ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-app-text-muted select-none"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-app-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            className={`w-full bg-app-surface border ${
              error
                ? 'border-app-danger focus:ring-app-danger'
                : 'border-app-border focus:border-app-accent focus:ring-app-accent'
            } rounded-lg ${
              leftIcon ? 'pl-9' : 'pl-3'
            } ${
              rightIcon || isPasswordToggle ? 'pr-9' : 'pr-3'
            } py-2.5 sm:py-2 min-h-[40px] text-xs text-app-text placeholder:text-app-text-muted/60 focus:outline-none focus:ring-1 transition-all duration-150 ${className}`}
            {...props}
          />
          {isPasswordToggle ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 p-0.5 text-app-text-muted hover:text-app-text transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : (
            rightIcon && (
              <div className="absolute right-3 flex items-center pointer-events-none text-app-text-muted">
                {rightIcon}
              </div>
            )
          )}
        </div>
        {error ? (
          <p className="text-[11px] text-app-danger font-medium leading-tight">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-app-text-muted leading-tight">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
