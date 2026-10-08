import { useEffect, useRef, useState } from 'react';
import { AdminApiError, submitAdminMutation, type AdminAction, type AdminMutationInput, type AdminUserDetail } from '../../services/admin-api';
export const adminActionLabel: Record<AdminAction, string> = { approve: '核准', reject: '拒絕', change_tier: '切換等級',
  revoke: '撤銷資格', top_up: '追加本週額度', top_up_revoke: '撤銷此筆追加' };
interface Props { user: AdminUserDetail; onComplete: () => void; reviewId?: string; reviewKind?: 'paid_access' | 'weekly_top_up' }
export function AdminMutationPanel({ user, onComplete, reviewId, reviewKind }: Props) {
  const actions: AdminAction[] = reviewKind === 'weekly_top_up' ? ['top_up', 'reject'] :
    reviewKind === 'paid_access' || user.status === 'pending' ? ['approve', 'reject'] :
    user.status === 'approved' ? ['change_tier', 'revoke', 'top_up', 'top_up_revoke'] : [];
  const [action, setAction] = useState<AdminAction>(actions[0] ?? 'approve');
  const [tier, setTier] = useState<'tier1' | 'tier2'>(user.tier ?? 'tier1');
  const [amount, setAmount] = useState('');
  const [topUpId, setTopUpId] = useState(user.topUps.find((t) => t.status === 'active')?.topUpId ?? '');
  const [reasonCode, setReason] = useState('operator_review');
  const [pending, setPending] = useState<AdminMutationInput | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const active = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const dialog = useRef<HTMLDivElement>(null);
  const prepareButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; active.current?.abort(); };
  }, []);
  useEffect(() => {
    if (pending) dialog.current?.focus();
    else if (restoreFocus.current) {
      prepareButton.current?.focus();
      restoreFocus.current = false;
    }
  }, [pending]);
  function prepare() {
    setMessage(''); setError('');
    if (action === 'top_up' && (!/^\d{1,10}(\.\d{1,6})?$/.test(amount) || Number(amount) <= 0)) {
      setError('請輸入正值金額，最多六位小數。'); return;
    }
    if (action === 'top_up_revoke' && !topUpId) { setError('請選擇有效追加。'); return; }
    setUncertain(false);
    setPending({ action, idempotencyKey: crypto.randomUUID(), targetIdentitySubject: user.identitySubject,
      confirmed: true, reasonCode, ...(reviewId ? { reviewId } : {}),
      ...(['approve', 'change_tier'].includes(action) ? { tier } : {}),
      ...(action === 'top_up' || action === 'top_up_revoke' ? {
        weekWindowKey: user.weekly.windowKey, expiresAt: user.weekly.resetAt, scope: 'all_protected_endpoints' as const,
        ...(action === 'top_up' ? { amountEstimatedUsd: amount } : { topUpId }),
      } : {}) });
  }
  function cancel() {
    if (active.current || uncertain) return;
    restoreFocus.current = true;
    setPending(null); setError('');
  }
  async function confirm() {
    if (!pending || active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setMessage(''); setError('');
    try {
      const result = await submitAdminMutation(pending, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setPending(null); setMessage(result.outcome === 'duplicate' ? '此操作已完成，未重複套用。' : '管理異動已完成並留下稽核紀錄。');
      setUncertain(false);
      onComplete();
    } catch (e) {
      if (!alive.current || controller.signal.aborted) return;
      const rejected = e instanceof AdminApiError && ['INVALID_INPUT', 'AUTH_REQUIRED', 'ADMIN_REQUIRED',
        'ACCESS_NOT_APPROVED', 'RATE_LIMITED', 'IDEMPOTENCY_CONFLICT', 'REQUEST_NOT_FOUND',
        'REQUEST_ALREADY_RESOLVED'].includes(e.code);
      setUncertain((previous) => previous || !rejected);
      setError(e instanceof Error ? e.message : '無法確認異動結果。');
    } finally {
      if (active.current === controller) active.current = null;
      if (alive.current) setBusy(false);
    }
  }
  if (actions.length === 0) return <p>目前狀態沒有可執行的資格異動。</p>;
  return <section aria-label="管理異動"><h3>管理異動</h3>
    {pending ? <div ref={dialog} tabIndex={-1} role="dialog" aria-label="確認管理異動" aria-modal="false" aria-busy={busy}>
      <p>確認對 {user.displayName ?? user.identitySubject} 執行「{adminActionLabel[pending.action]}」？</p>
      {pending.tier && <p>新等級：{pending.tier === 'tier1' ? '第一級' : '第二級'}</p>}
      {pending.action === 'top_up' && <p>追加 US${pending.amountEstimatedUsd}；僅限 {pending.weekWindowKey}，
        至 {pending.expiresAt}，全六端點共用。日上限不變；同週累計目前 US${user.weekly.activeTopUpEstimatedUsd}。</p>}
      {pending.action === 'top_up_revoke' && <p>僅移除此筆追加，不取消既有預留或已結算金額。</p>}
      <p>原因：{pending.reasonCode}。操作鍵：{pending.idempotencyKey}</p>
      {uncertain && <p>異動結果尚未確認；請使用相同操作鍵手動確認，不要取消後建立新的異動。</p>}
      <button disabled={busy} onClick={() => void confirm()}>{busy ? '正在確認異動結果' :
        uncertain ? '以相同操作鍵手動確認異動' : '確認送出異動'}</button>
      <button disabled={busy || uncertain} onClick={cancel}>取消</button>
    </div> : <>
      <label>操作<select value={action} onChange={(e) => setAction(e.target.value as AdminAction)}>
        {actions.map((a) => <option value={a} key={a}>{adminActionLabel[a]}</option>)}</select></label>
      {['approve', 'change_tier'].includes(action) && <label>核准等級<select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
        <option value="tier1">第一級：US$3／日、US$15／週</option><option value="tier2">第二級：US$10／日、US$50／週</option></select></label>}
      {action === 'top_up' && <>
        <label>追加金額（US$）<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} maxLength={17} /></label>
        <p>適用範圍：全六個付費端點；週別 {user.weekly.windowKey}；有效期限 {user.weekly.resetAt}（伺服器決定，不可延長）。</p>
        <p>無固定次數或累計上限；日上限不變。若追加成功，同週累計約 US${(
          Number(user.weekly.activeTopUpEstimatedUsd) + (Number(amount) || 0)).toFixed(2)}（僅供確認，後端為權威）。</p>
      </>}
      {action === 'top_up_revoke' && <label>選擇追加<select value={topUpId} onChange={(e) => setTopUpId(e.target.value)}>
        <option value="">請選擇</option>{user.topUps.filter((t) => t.status === 'active').map((t) =>
          <option key={t.topUpId} value={t.topUpId}>{t.topUpId}／US${t.amountEstimatedUsd}</option>)}</select></label>}
      {action === 'top_up_revoke' && <label>或輸入稽核紀錄中的追加 ID<input value={topUpId}
        maxLength={128} onChange={(e) => setTopUpId(e.target.value)} /></label>}
      <label>異動原因<select value={reasonCode} onChange={(e) => setReason(e.target.value)}>
        <option value="operator_review">管理者審核</option><option value="weekly_limit_review">本週額度審核</option>
        <option value="access_review">資格檢視</option></select></label>
      <button ref={prepareButton} onClick={prepare}>檢視並確認異動</button>
    </>}
    {busy && <p role="status">正在確認異動結果，請勿重複操作。</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
