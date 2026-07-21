import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { TransferTask } from '../types';

type TransferContextValue = {
  transfers: TransferTask[];
  begin: (task: Omit<TransferTask, 'state' | 'bytesTransferred'>) => void;
  progress: (id: string, bytesTransferred: number, totalBytes?: number) => void;
  finish: (id: string) => void;
  fail: (id: string, error: string) => void;
  clearFinished: () => void;
};

const TransferContext = createContext<TransferContextValue | null>(null);

export function TransferProvider({ children }: { children: ReactNode }) {
  const [transfers, setTransfers] = useState<TransferTask[]>([]);
  const patch = useCallback((id: string, data: Partial<TransferTask>) =>
    setTransfers(items => items.map(item => item.id === id ? { ...item, ...data } : item)), []);
  const begin = useCallback((task: Omit<TransferTask, 'state' | 'bytesTransferred'>) =>
    setTransfers(items => [{ ...task, state: 'running', bytesTransferred: 0 }, ...items]), []);
  const progress = useCallback((id: string, bytesTransferred: number, totalBytes?: number) => patch(id, { bytesTransferred, totalBytes }), [patch]);
  const finish = useCallback((id: string) => patch(id, { state: 'completed' }), [patch]);
  const fail = useCallback((id: string, error: string) => patch(id, { state: 'failed', error }), [patch]);
  const clearFinished = useCallback(() => setTransfers(items => items.filter(item => item.state === 'running' || item.state === 'queued')), []);
  const value = useMemo(() => ({ transfers, begin, progress, finish, fail, clearFinished }), [transfers, begin, progress, finish, fail, clearFinished]);
  return <TransferContext.Provider value={value}>{children}</TransferContext.Provider>;
}

export function useTransfers() {
  const value = useContext(TransferContext);
  if (!value) throw new Error('useTransfers must be used inside TransferProvider.');
  return value;
}
