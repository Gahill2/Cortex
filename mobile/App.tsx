import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { MailScreen } from "./src/screens/MailScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0e0e10",
    card: "#141418",
    border: "#2a2a32",
    primary: "#5b8dff",
    text: "#f4f4f5",
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#141418" },
        headerTintColor: "#f4f4f5",
        tabBarStyle: { backgroundColor: "#141418", borderTopColor: "#2a2a32" },
        tabBarActiveTintColor: "#5b8dff",
        tabBarInactiveTintColor: "#71717a",
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Mail" component={MailScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { ready, token } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0e0e10", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#5b8dff" />
      </View>
    );
  }

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <MainTabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
