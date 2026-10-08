import { useEffect, useState } from 'react';
import { AccessApiError } from '../services/access-api';
import { clearPendingEpochs, confirmEpochIssuance, pendingEpochs, startNewEpochOperation } from '../services/request-epoch-api';
import { loadEpochOperationStatus } from '../services/self-service-api';

export function RequestEpochPanel() {
  const [commands, setCommands] = useState(pendingEpochs);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => setCommands(pendingEpochs());
    const leave = () => { clearPendingEpochs(); setCommands([]); };
    window.addEventListener('tokyo-mate:epoch-changed', update);
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('tokyo-mate:epoch-changed', update);
      window.removeEventListener('pagehide', leave); clearPendingEpochs(); };
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof AccessApiError ? error.message : '無法確認操作結果，請稍後手動查詢。'); }
    finally { setBusy(false); }
  }
  if (!commands.length) return null;
  return <section aria-label="原操作手動確認">
    <h2>原操作手動確認</h2>
    <p>確認簽發只取回原授權，不會送出付費操作、補簽或延長期限。離開此頁會清除記憶體識別，不代表原操作未成立。</p>
    {commands.map((command) => <div key={command.endpoint}>
      <p>{command.endpoint}：{command.state === 'ready' ? '已確認簽發，請回原畫面再次手動送出。' :
        command.state === 'issuing' ? '正在確認簽發。' : '目前無法確認原操作結果，不會自動重送。'}</p>
      <button disabled={busy || command.state !== 'unknown'} onClick={() => run(async () => {
        await confirmEpochIssuance(command.endpoint);
        setMessage('已確認原簽發結果；請回原畫面再次手動送出。尚未執行付費操作。');
      })}>確認簽發結果</button>
      <button disabled={busy || !command.issued} onClick={() => run(async () => {
        if (!command.issued) return;
        const result = await loadEpochOperationStatus(command.endpoint, command.issued.requestEpochId, command.issued.operationHandle);
        setMessage(result.userMessage);
      })}>手動查看原操作狀態</button>
      <button disabled={busy || command.state === 'issuing'} onClick={() => {
        startNewEpochOperation(command.endpoint);
        setMessage('已明確建立新操作；原記帳或預留不會取消。請回原畫面手動送出。');
      }}>明確建立新操作</button>
    </div>)}
    {message && <p role="status">{message}</p>}
  </section>;
}
