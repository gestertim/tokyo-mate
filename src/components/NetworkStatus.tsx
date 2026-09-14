import { useNetworkStatus } from '../services/network';
import { StatusMessage } from './StatusMessage';

export function NetworkStatus() {
  const online = useNetworkStatus();
  if (online) return null;
  return <StatusMessage role="alert">目前離線。翻譯、AI 問答、語音與附近搜尋需要網路，請恢復連線後重試。</StatusMessage>;
}