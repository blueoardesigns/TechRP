import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../lib/theme';

export interface RecordingPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface Props {
  recordingUrl: string | null;
  vapiCallId: string | null;
  sessionId: string;
}

const RecordingPlayer = forwardRef<RecordingPlayerHandle, Props>(
  function RecordingPlayer({ recordingUrl, vapiCallId, sessionId }, ref) {
    const [url, setUrl] = useState<string | null>(recordingUrl);
    const [loading, setLoading] = useState(!recordingUrl && !!vapiCallId);
    const [error, setError] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const soundRef = useRef<Audio.Sound | null>(null);

    const ensureSound = async (): Promise<Audio.Sound | null> => {
      if (soundRef.current) return soundRef.current;
      if (!url) return null;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false },
        (status) => {
          if (!status.isLoaded) return;
          setPosition(status.positionMillis ?? 0);
          setDuration(status.durationMillis ?? 0);
          if (status.didJustFinish) {
            setPlaying(false);
            setPosition(0);
            soundRef.current?.setPositionAsync(0).catch(() => {});
          }
        }
      );
      soundRef.current = sound;
      return sound;
    };

    useImperativeHandle(ref, () => ({
      async seekTo(seconds: number) {
        try {
          const sound = await ensureSound();
          if (!sound) return;
          await sound.setPositionAsync(seconds * 1000);
          await sound.playAsync();
          setPlaying(true);
        } catch (e) {
          console.error('seekTo error:', e);
        }
      },
    }), [url]);

    useEffect(() => {
      if (recordingUrl || !vapiCallId) return;
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      fetch(`${baseUrl}/api/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: vapiCallId }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.recordingUrl) {
            setUrl(d.recordingUrl);
          } else {
            setError(true);
          }
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, [recordingUrl, vapiCallId]);

    useEffect(() => {
      return () => {
        soundRef.current?.unloadAsync().catch(() => {});
      };
    }, []);

    const togglePlay = async () => {
      if (!url) return;
      try {
        const sound = await ensureSound();
        if (!sound) return;
        if (playing) {
          await sound.pauseAsync();
          setPlaying(false);
        } else {
          await sound.playAsync();
          setPlaying(true);
        }
      } catch (e) {
        console.error('Audio playback error:', e);
        setError(true);
      }
    };

    const formatTime = (ms: number) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    if (loading) {
      return (
        <View style={styles.container}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.statusText}>Loading recording…</Text>
        </View>
      );
    }

    if (!url) {
      return (
        <View style={styles.container}>
          <Ionicons name="mic-off-outline" size={16} color={colors.textDim} />
          <Text style={styles.statusText}>
            {error ? 'Recording unavailable (may have expired).' : 'No recording available.'}
          </Text>
        </View>
      );
    }

    const progress = duration > 0 ? position / duration : 0;

    return (
      <View style={styles.playerCard}>
        <View style={styles.playerRow}>
          <TouchableOpacity onPress={togglePlay} style={styles.playButton} activeOpacity={0.7}>
            <Ionicons name={playing ? 'pause' : 'play'} size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

export default RecordingPlayer;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statusText: { color: colors.textDim, fontSize: 13 },

  playerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: { flex: 1 },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: { color: colors.textDim, fontSize: 11 },
});
