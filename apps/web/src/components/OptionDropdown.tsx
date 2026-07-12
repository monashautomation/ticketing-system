'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { inputSm } from '@/lib/styles';

interface OptionConfig {
  label: string;
  icon: LucideIcon;
}

interface OptionDropdownProps<T extends string> {
  value: T;
  options: readonly T[];
  config: Record<T, OptionConfig>;
  disabled?: boolean;
  className?: string;
  onChange: (value: T) => void;
}

export function OptionDropdown<T extends string>({
  value,
  options,
  config,
  disabled,
  className,
  onChange,
}: OptionDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = config[value];
  const CurrentIcon = current.icon;

  return (
    <div className={`relative ${className ?? ''}`} ref={containerRef}>
      <button
        type="button"
        className={`${inputSm} flex w-full items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CurrentIcon className="h-3.5 w-3.5" />
        {current.label}
        <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 min-w-full animate-fade-in-up rounded-md border border-border bg-panel py-1 shadow-lg"
        >
          {options.map((option) => {
            const { label, icon: Icon } = config[option];
            const selected = option === value;
            return (
              <li key={option} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-left text-sm text-text transition-colors hover:bg-elevated ${
                    selected ? 'bg-elevated' : ''
                  }`}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
