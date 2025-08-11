import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';

export const getPersistentDeviceId = async () => {
  // 1. Try to load existing ID
  const storedId = await SecureStore.getItemAsync('deviceId');
  if (storedId) return storedId;

  // 2. Generate new ID
  let deviceId;
  if (Platform.OS === 'android') {
    deviceId = Application.androidId;
  } else if (Platform.OS === 'ios') {
    deviceId = await Application.getIosIdForVendorAsync();
  }

  // 3. Fallback if no platform ID available
  if (!deviceId) {
    deviceId = `fallback-${Application.installationId}`;
  }

  // 4. Store for future use
  await SecureStore.setItemAsync('deviceId', deviceId);
  return deviceId;
};