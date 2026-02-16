import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { InstanceConnection } from '@opencord/api-client';

export default function AddInstanceScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'url' | 'login'>('url');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleConnect = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const conn = new InstanceConnection(url.trim());
      const info = await conn.getInstanceInfo();
      setInstanceUrl(url.trim());
      setStep('login');
    } catch {
      Alert.alert('Error', 'Could not connect to instance');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const conn = new InstanceConnection(instanceUrl);
      await conn.login({ email, password });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'url') {
    return (
      <View className="flex-1 bg-gray-900 p-6 justify-center">
        <Text className="text-2xl font-bold text-white mb-2">Add Instance</Text>
        <Text className="text-gray-400 mb-6">Enter the URL of an OpenCord instance</Text>

        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://chat.example.com"
          placeholderTextColor="#6b7280"
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <TouchableOpacity
          onPress={handleConnect}
          disabled={loading}
          className="bg-indigo-600 py-3 rounded-lg items-center"
        >
          <Text className="text-white font-semibold">
            {loading ? 'Connecting...' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-900 p-6 justify-center">
      <Text className="text-2xl font-bold text-white mb-2">Sign In</Text>
      <Text className="text-gray-400 mb-6">{instanceUrl}</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#6b7280"
        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-3"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4"
        secureTextEntry
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        className="bg-indigo-600 py-3 rounded-lg items-center"
      >
        <Text className="text-white font-semibold">
          {loading ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
