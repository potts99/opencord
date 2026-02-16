/**
 * Generate a random device ID for this client installation.
 */
export function generateDeviceId(): string {
  return crypto.randomUUID();
}

/**
 * Get or create a device ID, persisting it for this browser/device.
 */
export function getOrCreateDeviceId(storage?: Storage): string {
  const key = 'opencord_device_id';
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);

  if (store) {
    const existing = store.getItem(key);
    if (existing) return existing;

    const deviceId = generateDeviceId();
    store.setItem(key, deviceId);
    return deviceId;
  }

  return generateDeviceId();
}
