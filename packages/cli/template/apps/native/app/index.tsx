import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-4xl font-bold">{{ projectName }}</Text>
      <Text className="mt-4 text-lg text-gray-600">
        Your native app is ready.
      </Text>
    </View>
  );
}
