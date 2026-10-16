/**
 * 未登录场景的设备标识（device_key）。
 * 首次访问公开 /sos 页时生成并持久化在 localStorage，
 * 用于把匿名用户的紧急联系人绑定到“本设备 + 本浏览器”。
 */
const DEVICE_KEY_STORAGE = 'ecg-screen:device-key';

export function getDeviceKey(): string {
  try {
    let key = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (!key) {
      const rand =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      key = `browser_${rand}`;
      localStorage.setItem(DEVICE_KEY_STORAGE, key);
    }
    return key;
  } catch {
    // localStorage 不可用时退化为会话内随机值（联系人将无法跨刷新保留）
    return `browser_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
