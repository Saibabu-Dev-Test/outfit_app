import { Platform } from 'react-native';

export const BACKEND_IP = '192.168.0.109';
// export const BACKEND_IP = '54.167.113.100';
export const BACKEND_PORT = '3000';

export const getAuthBaseUrls = (): string[] => {
  return [
    `http://${BACKEND_IP}:${BACKEND_PORT}`,
    Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
};
