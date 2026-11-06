import React, { forwardRef } from 'react';

const Input = forwardRef(function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  disabled = false,
  error = false,
  leftIcon,
  rightElement,
  ...props
}, ref) {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      {leftIcon && (
        <div className="absolute left-3.5 text-muted pointer-events-none flex items-center justify-center">
          {leftIcon}
        </div>
      )}
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full h-12 bg-surface text-text text-sm rounded-control border transition-all duration-150 placeholder:text-muted/60 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
          leftIcon ? 'pl-11' : 'pl-4'
        } ${rightElement ? 'pr-20' : 'pr-4'} ${
          error ? 'border-danger focus-visible:ring-danger' : 'border-border focus-visible:border-accent'
        }`}
        {...props}
      />
      {rightElement && (
        <div className="absolute right-2 flex items-center">
          {rightElement}
        </div>
      )}
    </div>
  );
});

export default Input;

