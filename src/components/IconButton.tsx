import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function IconButton({ children, 'aria-label': ariaLabel, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button type="button" aria-label={ariaLabel} {...props}>{children}</button>;
}