import type { ProductError } from '../types/error';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function requestGeolocation(): Promise<Coordinates> {
  return new Promise<Coordinates>((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({
        code: 'GEOLOCATION_UNAVAILABLE',
        userTitle: '定位目前不可用',
        userMessage: '這個裝置或瀏覽器目前無法取得位置資訊。',
        actionableStep: '請改為輸入地區名稱，例如「新宿」或「淺草」來搜尋附近地點。',
      } satisfies ProductError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({ latitude, longitude });
      },
      (error) => {
        const code = error?.code === 1 ? 'GEOLOCATION_DENIED' : 'GEOLOCATION_UNAVAILABLE';
        reject({
          code,
          userTitle: code === 'GEOLOCATION_DENIED' ? '定位權限被拒絕' : '定位目前不可用',
          userMessage: code === 'GEOLOCATION_DENIED'
            ? '您已拒絕位置權限，系統已切換到手動地區搜尋。'
            : '目前無法取得您的位置，請改用手動輸入地區。',
          actionableStep: '請輸入要搜尋的區域，例如「東京站」或「淺草」。',
        } satisfies ProductError);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}
