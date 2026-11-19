// Background tasks must be defined before the app renders so Android can run them
// when a notification button is pressed while the app is closed.
import { AppRegistry, Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import './src/notifications/background';
import { widgetTaskHandler } from './src/widget/handler';
import { handleWatchAction } from './src/wear/sync';
import 'expo-router/entry';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);

// Taken / Snooze on the watch tile arrive here, even with the app closed.
if (Platform.OS === 'android') AppRegistry.registerHeadlessTask('SabrWearAction', () => handleWatchAction);
