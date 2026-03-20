import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      {/* eslint-disable-next-line react/style-prop-object -- Expo StatusBar uses string style prop */}
      <StatusBar style="auto" />
    </>
  );
}
