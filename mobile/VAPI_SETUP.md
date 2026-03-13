# Vapi SDK Setup Instructions

## 1. Install Vapi React Native SDK

The exact package name depends on Vapi's SDK. Check the [Vapi.ai documentation](https://docs.vapi.ai) for the correct React Native SDK package name.

Common possibilities:
- `@vapi-ai/react-native`
- `@vapi-ai/client`
- `vapi-ai-sdk`
- `@vapi-ai/react-native-sdk`

Once you know the package name, install it:

```bash
npm install <package-name>
# or
npx expo install <package-name>
```

## 2. Update the Code

After installing the SDK, you need to:

1. **Update the import in `app/index.tsx`:**
   ```typescript
   import { Vapi } from '<package-name>';
   ```

2. **Update the initialization code** based on the SDK's API:
   - Replace the placeholder initialization with the actual SDK initialization
   - Common patterns:
     - `new Vapi({ publicKey })`
     - `createVapi({ publicKey })`
     - `initializeVapi(publicKey)`

3. **Update event listeners** based on the SDK's event system:
   - Common event names: `call-start`, `call-end`, `error`, `callStarted`, `callEnded`, etc.
   - Update event listener methods: `.on()`, `.addEventListener()`, etc.

4. **Update method calls:**
   - `start()` or `startCall()` - to start a call
   - `stop()` or `end()` or `endCall()` - to end a call
   - Update method parameters based on SDK requirements

5. **Update cleanup code** for proper SDK cleanup

## 3. Configure Environment Variables

Make sure your `.env` file has:

```env
EXPO_PUBLIC_VAPI_API_KEY=your_vapi_public_key_here
```

Get your public key from: https://dashboard.vapi.ai

## 4. Set Your Assistant ID

Update `VAPI_ASSISTANT_ID` in `app/index.tsx` with your actual assistant ID from the Vapi dashboard:

```typescript
const VAPI_ASSISTANT_ID = 'your-actual-assistant-id';
```

## 5. Check Vapi Documentation

For the most up-to-date SDK API documentation, visit:
- https://docs.vapi.ai
- https://docs.vapi.ai/sdks/react-native (if available)



