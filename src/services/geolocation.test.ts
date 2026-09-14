import { describe, expect, it, vi } from 'vitest';
import { requestGeolocation } from './geolocation';

describe('requestGeolocation', () => {
  it('uses the browser geolocation only when the user triggers it and rethrows permission denial clearly', async () => {
    const getCurrentPosition = vi.fn((success, error) => {
      error?.({ code: 1, message: 'denied' });
    });
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    await expect(requestGeolocation()).rejects.toMatchObject({
      code: 'GEOLOCATION_DENIED',
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('does not persist coordinates in browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 35.69, longitude: 139.7 } });
    });
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    const coords = await requestGeolocation();
    expect(coords).toMatchObject({ latitude: 35.69, longitude: 139.7 });
    expect(setItem).not.toHaveBeenCalled();
  });
});
