import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

import Constants from 'expo-constants';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.log('Push token fetching failed:', e.message || e);
      return null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  return token;
}

export async function registerDeviceToken() {
  try {
    const expoToken = await registerForPushNotificationsAsync();
    if (!expoToken) return;

    await AsyncStorage.setItem('expoPushToken', expoToken);

    const payload = {
      expo_push_token: expoToken,
      platform: Platform.OS,
      app_version: '1.0.0',
    };

    await api.post('/devices/push-token', payload);
    console.log('Registered push token successfully:', expoToken);
  } catch (error) {
    console.error('Error registering device token:', error);
  }
}

export async function deregisterDeviceToken() {
  try {
    const expoToken = await AsyncStorage.getItem('expoPushToken');
    if (!expoToken) return;

    await api.delete(`/devices/push-token?expo_push_token=${encodeURIComponent(expoToken)}`);
    await AsyncStorage.removeItem('expoPushToken');
    console.log('Deregistered push token successfully');
  } catch (error) {
    console.error('Error deregistering device token:', error);
  }
}

export async function getNotifications(page = 1, pageSize = 20, status = 'all') {
  const response = await api.get(`/notifications?page=${page}&page_size=${pageSize}&status=${status}`);
  return response.data;
}

export async function getUnreadNotificationsCount() {
  const response = await api.get('/notifications/unread-count');
  return response.data.unread_count;
}

export async function markNotificationAsRead(id) {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsAsRead() {
  const response = await api.patch('/notifications/read-all');
  return response.data;
}
