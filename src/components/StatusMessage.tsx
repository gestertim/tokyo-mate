import type { PropsWithChildren } from 'react';

export function StatusMessage({ children, role = 'status' }: PropsWithChildren<{ role?: 'status' | 'alert' }>) {
  return <p role={role}>{children}</p>;
}