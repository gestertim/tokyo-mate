import type { PropsWithChildren } from 'react';

export function Modal({ children, open, onClose }: PropsWithChildren<{ open: boolean; onClose: () => void }>) {
  if (!open) return null;
  return <div role="dialog" aria-modal="true"><button type="button" aria-label="關閉" onClick={onClose}>關閉</button>{children}</div>;
}