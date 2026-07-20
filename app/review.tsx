import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../constants/api';
import { Colors } from '../constants/theme';

interface ReviewWord {
  id: number;
  english: string;
  translation: string;
  pronunciation: string;
  culturalContext: string;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function ReviewScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/api/review/default`)
      .then((res) => res.json())
      .then((data) => setWords(Array.isArray(data) ? data : []))
      .catch(() => setWords([]))
      .finally(() => setLoading(false));
  }, []);

  const currentWord = words[index];

  useEffect(() => {
    if (currentWord) {
      Speech.speak(currentWord.translation, { language: 'zh-CN' });
    }
  }, [currentWord]);

  const handleAnswer = async (remembered: boolean) => {
    if (!currentWord) return;
    try {
      await fetch(`${API_URL}/api/review/default/${currentWord.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remembered }),
      });
    } catch {
      // Silently continue - not worth blocking the review flow over a network hiccup
    }
    setReviewedCount((prev) => prev + 1);
    setRevealed(false);
    setIndex((prev) => prev + 1);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  if (!currentWord) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {reviewedCount > 0 ? `Reviewed ${reviewedCount} word${reviewedCount === 1 ? '' : 's'}! 🎉` : 'Nothing to review right now'}
        </Text>
        <Text style={styles.subtitle}>
          {reviewedCount > 0
            ? 'Come back tomorrow for more.'
            : "Scan a few objects, then check back once they're due for review."}
        </Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {words.length}</Text>

      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => setRevealed(true)}>
        <Text style={styles.translation}>{currentWord.translation}</Text>
        <Text style={styles.pronunciation}>{currentWord.pronunciation}</Text>

        {revealed && (
          <>
            <Text style={styles.english}>{capitalize(currentWord.english)}</Text>
            {!!currentWord.culturalContext && (
              <Text style={styles.culturalContext}>{currentWord.culturalContext}</Text>
            )}
          </>
        )}

        {!revealed && <Text style={styles.tapHint}>Tap to reveal</Text>}
      </TouchableOpacity>

      {revealed && (
        <View style={styles.answerButtons}>
          <TouchableOpacity style={[styles.answerButton, styles.stillLearning]} onPress={() => handleAnswer(false)}>
            <Text style={styles.answerButtonText}>Still Learning</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.answerButton, styles.gotIt]} onPress={() => handleAnswer(true)}>
            <Text style={styles.answerButtonText}>Got It</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    color: Colors.olive,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Lexend_400Regular',
    color: Colors.olive,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  progress: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: Colors.olive,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
    minHeight: 220,
    justifyContent: 'center',
  },
  translation: {
    fontSize: 48,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    color: Colors.olive,
  },
  pronunciation: {
    fontSize: 18,
    fontFamily: 'Lexend_400Regular',
    color: Colors.olive,
    marginTop: 8,
  },
  english: {
    fontSize: 20,
    fontFamily: 'Lexend_500Medium',
    color: Colors.orange,
    marginTop: 20,
  },
  culturalContext: {
    fontSize: 14,
    fontFamily: 'Lexend_300Light',
    color: Colors.olive,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  tapHint: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: Colors.olive,
    opacity: 0.5,
    marginTop: 20,
  },
  answerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  answerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  stillLearning: {
    backgroundColor: Colors.red,
  },
  gotIt: {
    backgroundColor: Colors.green,
  },
  answerButtonText: {
    fontSize: 15,
    fontFamily: 'Lexend_500Medium',
    color: 'white',
  },
  closeButton: {
    marginTop: 20,
  },
  closeButtonText: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: Colors.olive,
    opacity: 0.6,
  },
  doneButton: {
    backgroundColor: Colors.orange,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 20,
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: 'Lexend_500Medium',
    color: 'white',
  },
});
