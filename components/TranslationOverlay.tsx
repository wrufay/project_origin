import { Audio } from 'expo-av';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../constants/api';

export type FamiliarityChoice = 'unfamiliar' | 'neutral' | 'familiar';

interface TranslationOverlayProps {
  translation: string;
  pronunciation: string;
  english: string;
  culturalContext?: string;
  isScanning?: boolean;
  onDismiss?: () => void;
  onFamiliarityChoice?: (choice: FamiliarityChoice) => void;
}

export default function TranslationOverlay({
  translation,
  pronunciation,
  english,
  culturalContext,
  isScanning = false,
  onDismiss,
  onFamiliarityChoice,
}: TranslationOverlayProps) {
  // Check if this is an error/nothing detected message
  const isErrorMessage = !translation && (english.includes('Nothing detected') || english.includes('Try again'));

  const [dots, setDots] = useState('.');
  const [definition, setDefinition] = useState<string | null>(null);
  const [loadingDefinition, setLoadingDefinition] = useState(false);
  const [showDefinition, setShowDefinition] = useState(false);
  // 0 = show translation, 1 = show cultural context, 2 = hide everything
  const [viewState, setViewState] = useState(0);

  useEffect(() => {
    if (!isScanning && translation) {
      playPronunciation(translation);
    }
  }, [translation, isScanning]);


  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isScanning]);

  const playPronunciation = async (text: string) => {
    try {
      const response = await fetch(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.error('TTS API error:', response.status);
        return;
      }

      const data = await response.json();

      if (!data.audio) {
        console.error('No audio data in response');
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${data.audio}` }
      );

      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Audio error:', error);
      // Silently fail - don't crash the app if TTS fails
    }
  };

  const fetchDefinition = async () => {
    if (definition) {
      // If definition is already loaded, close it
      setShowDefinition(false);
      setDefinition(null);
      return;
    }

    setLoadingDefinition(true);
    try {
      const response = await fetch(`${API_URL}/api/definition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: english }),
      });

      if (!response.ok) {
        console.error('Definition API error:', response.status);
        setLoadingDefinition(false);
        return;
      }

      const data = await response.json();
      setDefinition(data.definition || 'No definition available');
      setShowDefinition(true);
      setLoadingDefinition(false);
    } catch (error) {
      console.error('Definition fetch error:', error);
      setDefinition('Unable to fetch definition');
      setShowDefinition(true);
      setLoadingDefinition(false);
    }
  };

  if (isScanning) {
    return <Text style={styles.scanningText}>{dots}</Text>;
  }

  const handleScreenTap = () => {
    // If it's an error message, just dismiss immediately
    if (isErrorMessage) {
      onDismiss?.();
      return;
    }
    // Only advance from translation (0) to cultural context (1)
    // Cultural context stays until a familiarity button is pressed
    if (viewState === 0) {
      setViewState(1);
    }
  };

  const handleFamiliarityPress = (choice: FamiliarityChoice) => {
    // Notify parent of the choice so it can adjust familiarity level
    onFamiliarityChoice?.(choice);
    // Dismiss the overlay when any familiarity button is pressed
    setViewState(2);
  };

  // If viewState is 2 (hide everything), return null to make the overlay disappear
  if (viewState === 2) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handleScreenTap}
      activeOpacity={1}
      style={{ maxHeight: '80%', alignItems: 'center', width: '100%' }}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ width: '100%' }}
      >
        {viewState === 0 && (
          <>
            <Text style={styles.translation}>{translation}</Text>
            <Text style={styles.pinyin}>{pronunciation}</Text>
            {isErrorMessage ? (
              <Text style={styles.english}>{english}</Text>
            ) : (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  fetchDefinition();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.english}>{english}</Text>
              </TouchableOpacity>
            )}
            {loadingDefinition && (
              <View style={styles.definitionBubble}>
                <ActivityIndicator color="#7c6a0a" />
              </View>
            )}
            {showDefinition && definition && !loadingDefinition && (
              <View style={styles.definitionBubble}>
                <Text style={styles.definitionText}>{definition}</Text>
              </View>
            )}
          </>
        )}
        {viewState === 1 && culturalContext && culturalContext.length > 0 && (
          <>
            <View style={styles.culturalBubble}>
              <Text style={styles.culturalContext}>{culturalContext}</Text>
            </View>
            <View style={styles.familiarityButtons}>
              <TouchableOpacity style={styles.familiarityButton} onPress={() => handleFamiliarityPress('unfamiliar')}>
                <Text style={styles.familiarityButtonText}>Unfamiliar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.familiarityButton} onPress={() => handleFamiliarityPress('neutral')}>
                <Text style={styles.familiarityButtonText}>Neutral</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.familiarityButton} onPress={() => handleFamiliarityPress('familiar')}>
                <Text style={styles.familiarityButtonText}>Familiar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  translation: {
    fontSize: 64,
    color: '#ffd166',
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
    letterSpacing: 2,
  },
  pinyin: {
    fontSize: 24,
    color: '#fefadc',
    marginTop: 12,
    fontFamily: 'Lexend_400Regular',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  english: {
    fontSize: 26,
    color: '#fefadc',
    marginTop: 8,
    fontFamily: 'NanumPenScript_400Regular',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  definitionBubble: {
    marginTop: 16,
    backgroundColor: "rgba(254, 250, 220, 0.6)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#ffd16680',
    maxWidth: '90%',
    minHeight: 50,
    justifyContent: 'center',
  },
  definitionText: {
    fontSize: 15,
    color: '#7c6a0a',
    fontFamily: 'Lexend_300Light',
    lineHeight: 22,
    textAlign: 'center',
  },
  culturalBubble: {
    marginTop: 20,
    backgroundColor: "rgba(254, 250, 220, 0.95)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: '#ffd166',
    width: '90%',
    alignSelf: 'center',
  },
  culturalContext: {
    fontSize: 15,
    color: '#7c6a0a',
    fontFamily: 'Lexend_300Light',
    lineHeight: 22,
    textAlign: 'center',
  },
  familiarityButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    width: '90%',
  },
  familiarityButton: {
    backgroundColor: 'rgba(255, 209, 102, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffd166',
  },
  familiarityButtonText: {
    fontSize: 12,
    color: '#7c6a0a',
    fontFamily: 'Lexend_400Regular',
  },
  scanningText: {
    color: '#fefadc',
    fontSize: 32,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
});
