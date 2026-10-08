import { useEffect } from 'react';
import { useAccessQuery } from '../../hooks/useAccessQuery';
import { loadAdminOverviewData } from '../../services/admin-api';
import type { AdminOverviewView } from '../../types/access';
import type { AdminOverviewData } from '../../../api/_lib/admin-store';

interface Props { load?: (signal?: AbortSignal) => Promise<AdminOverviewView>; onBack: () => void; onAuthorized?: () => void }
export function AdminOverviewScreen({ load = loadAdminOverviewData, onBack, onAuthorized }: Props) {
  const { state, refresh } = useAccessQuery<AdminOverviewData>(load);
  useEffect(() => { if (state.status === 'ready') onAuthorized?.(); }, [state.status, onAuthorized]);
  return <section aria-label="管理者儀表板">
    <h2>管理者儀表板</h2>
    {state.status === 'loading' && <p role="status">正在確認管理者權限與資料。</p>}
    {state.status === 'error' && <p role="alert">{state.message}</p>}
    {state.status === 'ready' && <>
      <h3>核准狀態</h3>
      <dl>
        {([['待審核', state.data.approvalCounts.pending], ['已核准', state.data.approvalCounts.approved],
          ['已拒絕', state.data.approvalCounts.rejected], ['已撤銷', state.data.approvalCounts.revoked],
          ['已到期', state.data.approvalCounts.expired]] as const).map(([label, count]) =>
          <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}
      </dl>
      <p>今日已用估算 US${state.data.estimatedUsage.dailyUsedEstimatedUsd}；
        本週已用估算 US${state.data.estimatedUsage.weeklyUsedEstimatedUsd}</p>
      {!state.data.protectionAvailable && <p role="alert">必要防護服務目前無法確認，付費功能先暫停。</p>}
      {state.data.nearLimits && <section aria-label="接近上限提示"><h3>接近上限提示</h3>
        {state.data.nearLimits.length === 0 ? <p>目前沒有接近上限的提示。</p> :
          <ul>{state.data.nearLimits.map((v) => <li key={`${v.identitySubject}:${v.window}`}>
            {v.identitySubject}：{v.window === 'day' ? '日' : '週'}已用估算 US${v.usedEstimatedUsd}／上限 US${v.limitEstimatedUsd}</li>)}</ul>}
      </section>}
      <p>此頁顯示估算成本，不是供應商實際帳單。管理者自身也受相同額度與預留限制。
        週追加沒有累計上限，不能僅靠個人週額度保證整站帳單上限。</p>
    </>}
    <button type="button" onClick={() => void refresh()}>重新確認管理資料</button>
    <button type="button" onClick={onBack}>返回公開內容</button>
  </section>;
}
