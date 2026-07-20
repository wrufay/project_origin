import Constants from 'expo-constants';

// Matches backend/.env.example's default PORT
const LOCAL_BACKEND_PORT = 3000;

function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Constants.expoConfig.hostUri is the Metro dev server's own address
  // (e.g. "192.168.1.42:8081") - stripping the port gives the LAN IP of
  // whichever machine is running `npx expo start`, which is also the
  // machine running the backend in local-first dev.
  const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return debuggerHost
    ? `http://${debuggerHost}:${LOCAL_BACKEND_PORT}`
    : `http://localhost:${LOCAL_BACKEND_PORT}`;
}

export const API_URL = resolveApiUrl();
