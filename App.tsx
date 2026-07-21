import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootStackParams } from './src/navigation';
import { AuthScreen } from './src/screens/AuthScreen';
import { FilesScreen } from './src/screens/FilesScreen';
import { PreviewScreen } from './src/screens/PreviewScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TransfersScreen } from './src/screens/TransfersScreen';
import { SessionProvider, useSession } from './src/session/SessionContext';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { TransferProvider } from './src/transfers/TransferContext';

const Stack = createNativeStackNavigator<RootStackParams>();
function AppContent() {
  const { colors, dark } = useAppTheme();
  const baseTheme = dark ? DarkTheme : DefaultTheme;
  const theme = { ...baseTheme, colors: { ...baseTheme.colors, background: colors.background, card: colors.navy, text: colors.ink, border: colors.border, primary: colors.blue } };
  const { booting, user } = useSession();
  if (booting) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.blue} size="large" /><StatusBar style={dark ? 'light' : 'dark'} /></View>;
  if (!user) return <><AuthScreen /><StatusBar style={dark ? 'light' : 'dark'} /></>;
  return <NavigationContainer theme={theme}>
    <StatusBar style="light" />
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.navy }, headerShadowVisible: false, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700', fontSize: 18 }, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Files" component={FilesScreen} options={{ title: 'My files' }} />
      <Stack.Screen name="Preview" component={PreviewScreen} options={({ route }) => ({ title: route.params.file.name })} />
      <Stack.Screen name="Transfers" component={TransfersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  </NavigationContainer>;
}

export default function App() {
  return <SafeAreaProvider><ThemeProvider><SessionProvider><TransferProvider><AppContent /></TransferProvider></SessionProvider></ThemeProvider></SafeAreaProvider>;
}
