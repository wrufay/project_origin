import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { UserPrefs } from '../services/userPreferences';

export default function Index() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    UserPrefs.hasCompletedOnboarding().then(setHasCompletedOnboarding);
  }, []);

  if (hasCompletedOnboarding === null) {
    // Briefly blank while AsyncStorage resolves - avoids a flash of the wrong screen.
    return <View />;
  }

  return hasCompletedOnboarding
    ? <Redirect href="/(tabs)" />
    : <Redirect href="/(onboarding)/welcome" />;
}
