export type LiveDataLevel = 'not_required' | 'live_required' | 'verified' | 'unavailable' | 'uncertain';

interface LiveDataStatusProps {
  status: LiveDataLevel;
  message?: string;
  nextAction?: string;
}

export function LiveDataStatus({ status, message, nextAction }: LiveDataStatusProps) {
  const labelMap: Record<LiveDataLevel, string> = {
    not_required: '不需要即時資訊',
    live_required: '需要即時資訊',
    verified: '已確認最新資訊',
    unavailable: '目前無法確認',
    uncertain: '資訊不確定',
  };

  return (
    <aside aria-live="polite">
      <strong>{labelMap[status]}</strong>
      {message && <p>{message}</p>}
      {nextAction && <p>{nextAction}</p>}
    </aside>
  );
}
