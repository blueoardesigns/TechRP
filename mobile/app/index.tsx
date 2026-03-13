import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// TODO: Install the Vapi React Native SDK
// Check https://docs.vapi.ai for the correct package name
// Common options: @vapi-ai/react-native, @vapi-ai/client, or vapi-ai-sdk
// Once installed, update the import below:
// import { Vapi } from '@vapi-ai/react-native';

// Placeholder assistant ID - replace with your actual assistant ID from Vapi dashboard
const VAPI_ASSISTANT_ID = 'your-assistant-id-here';

export default function HomeScreen() {
  const [isCalling, setIsCalling] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const vapiRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Vapi with public API key
    const publicKey = process.env.EXPO_PUBLIC_VAPI_API_KEY;
    
    if (!publicKey) {
      console.error('EXPO_PUBLIC_VAPI_API_KEY is not set in environment variables');
      Alert.alert(
        'Configuration Error',
        'Vapi API key is not configured. Please check your .env file.'
      );
      return;
    }

    // TODO: Update initialization based on actual Vapi SDK API
    // Example patterns (adjust based on actual SDK):
    //
    // Option 1: If SDK uses class constructor
    // import { Vapi } from '@vapi-ai/react-native';
    // const vapiInstance = new Vapi({
    //   publicKey: publicKey,
    // });
    //
    // Option 2: If SDK uses factory function
    // import { createVapi } from '@vapi-ai/react-native';
    // const vapiInstance = createVapi({ publicKey });
    //
    // Option 3: If SDK uses initialize function
    // import { initializeVapi } from '@vapi-ai/react-native';
    // const vapiInstance = initializeVapi(publicKey);

    try {
      // TODO: Replace with actual Vapi SDK initialization
      // For now, creating a placeholder structure
      // vapiRef.current = vapiInstance;

      // Set up event listeners
      // TODO: Update event names based on actual Vapi SDK API
      // Common event patterns:
      // - vapiInstance.on('call-start', () => { ... })
      // - vapiInstance.on('call-end', () => { ... })
      // - vapiInstance.on('error', (error) => { ... })
      // - vapiInstance.addEventListener('callStarted', () => { ... })

      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing Vapi:', error);
      Alert.alert('Initialization Error', 'Failed to initialize Vapi SDK');
    }

    // Cleanup on unmount
    return () => {
      if (vapiRef.current) {
        try {
          // TODO: Update cleanup based on actual SDK
          // Common patterns:
          // - vapiRef.current.removeAllListeners()
          // - vapiRef.current.destroy()
          // - vapiRef.current.cleanup()
        } catch (error) {
          console.error('Error cleaning up Vapi:', error);
        }
      }
    };
  }, []);

  const handleStartTraining = async () => {
    if (!vapiRef.current) {
      Alert.alert('Error', 'Vapi SDK is not initialized');
      return;
    }

    if (!VAPI_ASSISTANT_ID || VAPI_ASSISTANT_ID === 'your-assistant-id-here') {
      Alert.alert(
        'Configuration Needed',
        'Please set your VAPI_ASSISTANT_ID in the code. Get it from your Vapi dashboard.'
      );
      return;
    }

    try {
      setIsCalling(true);

      // TODO: Update method name based on actual Vapi SDK API
      // Common method patterns:
      // - await vapiRef.current.start({ assistantId: VAPI_ASSISTANT_ID })
      // - await vapiRef.current.startCall(VAPI_ASSISTANT_ID)
      // - await vapiRef.current.call({ assistantId: VAPI_ASSISTANT_ID })
      // - await vapiRef.current.connect(VAPI_ASSISTANT_ID)

      // Placeholder - replace with actual SDK call
      // await vapiRef.current.start({ assistantId: VAPI_ASSISTANT_ID });
      
      console.log('Starting call with assistant:', VAPI_ASSISTANT_ID);
      Alert.alert(
        'SDK Needed',
        'Please install the Vapi SDK and update the code with the actual SDK methods.'
      );
      setIsCalling(false);
    } catch (error) {
      console.error('Error starting call:', error);
      Alert.alert('Error', 'Failed to start call. Please check the console for details.');
      setIsCalling(false);
    }
  };

  const handleEndCall = async () => {
    if (!vapiRef.current) {
      return;
    }

    try {
      // TODO: Update method name based on actual Vapi SDK API
      // Common method patterns:
      // - await vapiRef.current.stop()
      // - await vapiRef.current.end()
      // - await vapiRef.current.disconnect()
      // - await vapiRef.current.endCall()

      // Placeholder - replace with actual SDK call
      // await vapiRef.current.stop();
      
      console.log('Ending call');
      setIsCalling(false);
    } catch (error) {
      console.error('Error ending call:', error);
      Alert.alert('Error', 'Failed to end call. Please check the console for details.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>TechRP Training</Text>
      <Text style={styles.subtitle}>Voice AI Roleplay Training</Text>
      
      {isCalling ? (
        <View style={styles.callingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.callingText}>Call in progress...</Text>
          <TouchableOpacity 
            style={[styles.button, styles.endCallButton]} 
            onPress={handleEndCall}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>End Call</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={[styles.button, !isInitialized && styles.buttonDisabled]} 
          onPress={handleStartTraining}
          activeOpacity={0.8}
          disabled={!isInitialized}
        >
          <Text style={styles.buttonText}>Start Training</Text>
        </TouchableOpacity>
      )}
      
      {!isInitialized && (
        <Text style={styles.warningText}>
          Vapi SDK not initialized. Check console for errors.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  callingContainer: {
    alignItems: 'center',
    gap: 20,
  },
  callingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
    marginTop: 10,
  },
  warningText: {
    marginTop: 20,
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
  },
});
