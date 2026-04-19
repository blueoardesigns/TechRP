import Vapi from '@vapi-ai/react-native';

let _instance: Vapi | null = null;

export function getVapi(): Vapi {
  if (!_instance) {
    const key = process.env.EXPO_PUBLIC_VAPI_API_KEY;
    if (!key) throw new Error('EXPO_PUBLIC_VAPI_API_KEY is not set');
    _instance = new Vapi(key);
  }
  return _instance;
}
