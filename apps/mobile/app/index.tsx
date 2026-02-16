import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-900 items-center justify-center p-6">
      <Text className="text-3xl font-bold text-white mb-2">OpenCord</Text>
      <Text className="text-gray-400 text-center mb-8">
        Connect to an instance to start chatting
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/add-instance')}
        className="bg-indigo-600 px-8 py-4 rounded-xl"
      >
        <Text className="text-white font-semibold text-lg">Add Instance</Text>
      </TouchableOpacity>
    </View>
  );
}
