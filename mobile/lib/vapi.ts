let VapiClass: any = null;
try {
  // Native WebRTC modules are only available in custom builds (not Expo Go).
  VapiClass = require('@vapi-ai/react-native').default;
} catch {
  console.warn('[Vapi] Native SDK unavailable — running in Expo Go or simulator');
}

let _instance: any | null = null;

export function getVapi(): any {
  if (!VapiClass) {
    throw new Error('Vapi SDK unavailable: run a custom native build to use voice calls');
  }
  if (!_instance) {
    const key = process.env.EXPO_PUBLIC_VAPI_API_KEY;
    if (!key) throw new Error('EXPO_PUBLIC_VAPI_API_KEY is not set');
    _instance = new VapiClass(key);
  }
  return _instance;
}

export function isVapiAvailable(): boolean {
  return VapiClass !== null;
}
