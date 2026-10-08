import { usePaidAccessQuota, type PaidQuotaFreshnessPolicy } from '../hooks/usePaidAccessQuota';
import { loadOwnQuota } from '../services/access-api';
import type { OwnQuotaView } from '../types/access';

interface Props {
  load?: (signal?: AbortSignal) => Promise<OwnQuotaView>;
  onOpenPublic: () => void;
  freshness?: PaidQuotaFreshnessPolicy;
}
export function PaidFeatureQuotaBanner({ load = loadOwnQuota, onOpenPublic, freshness }: Props) {
  const { state, refresh } = usePaidAccessQuota(load, freshness);
  return (
    <section aria-label="付費功能估算額度">
      {state.status === 'loading' && <p role="status">正在確認使用狀態，這不是付費操作授權。</p>}
      {state.status === 'error' && <div role="alert">
        {state.title && <h2>{state.title}</h2>}
        <p>{state.message}</p>
      </div>}
      {state.status === 'error' && state.code === 'AUTH_REQUIRED' &&
        <a href="/api/auth/login">登入（不會自動送出原操作）</a>}
      {state.status === 'ready' && <>
        <h2>{state.data.tier === 'tier1' ? '第一級' : '第二級'}估算額度</h2>
        <p>此處顯示最近一次後端內部估算額度快照，不是供應商實際帳單，也不代表目前可用額度或操作授權。每次操作仍由後端重新判斷。</p>
        {([['今日', state.data.daily], ['本週', state.data.weekly]] as const).map(([label, quota]) => (
          <section key={label} aria-label={`${label}額度`}>
            <h3>{label}</h3>
            <p>上限 US${quota.limitEstimatedUsd}；已使用 US${quota.usedEstimatedUsd}；
              預留中 US${quota.reservedEstimatedUsd}；剩餘 US${quota.remainingEstimatedUsd}</p>
            <p>下次重置：<time dateTime={quota.resetAt}>
              {new Date(quota.resetAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
            </time>（台灣時間）</p>
          </section>
        ))}
        <p>本週基準 US${state.data.weekly.baseLimitEstimatedUsd}；有效追加 US${state.data.weekly.activeTopUpEstimatedUsd}。
          週追加不會提高今日上限。</p>
      </>}
      <button type="button" onClick={() => void refresh()}>重新確認額度</button>
      <button type="button" onClick={onOpenPublic}>查看東京百科</button>
    </section>
  );
}
