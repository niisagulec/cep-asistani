import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotifications } from './notificationService';

const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';

// Define the background task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  console.log('=== [BACKGROUND FETCH] Görev Tetiklendi! ===');
  try {
    // 1. Fetch unread notifications from backend
    const unreadNotifications = await getNotifications(1, 10, 'unread');
    console.log('[BACKGROUND FETCH] Alınan bildirim sayısı:', unreadNotifications?.length || 0);

    if (!unreadNotifications || unreadNotifications.length === 0) {
      console.log('[BACKGROUND FETCH] Yeni okunmamış bildirim yok.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 2. Load already shown notification IDs from AsyncStorage
    const storedIdsJson = await AsyncStorage.getItem('shownNotificationIds');
    const shownIds = storedIdsJson ? JSON.parse(storedIdsJson) : [];
    console.log('[BACKGROUND FETCH] Daha önce gösterilen ID sayısı:', shownIds.length);

    // 3. Find any notifications that are new
    const newNotifications = unreadNotifications.filter(
      (noti) => !shownIds.includes(noti.id)
    );
    console.log('[BACKGROUND FETCH] Yeni/Gösterilmemiş bildirim sayısı:', newNotifications.length);

    if (newNotifications.length === 0) {
      console.log('[BACKGROUND FETCH] Tüm bildirimler zaten kilit ekranına düşürülmüş.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 4. Trigger a native local push notification for each new item!
    for (const noti of newNotifications) {
      console.log('[BACKGROUND FETCH] Kilit ekranına düşürülüyor:', noti.title);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: noti.title,
          body: noti.body,
          data: noti.data || {},
          sound: true,
          badge: unreadNotifications.length,
        },
        trigger: null, // trigger immediately
      });
      shownIds.push(noti.id);
    }

    // 5. Save updated list of shown notification IDs
    await AsyncStorage.setItem('shownNotificationIds', JSON.stringify(shownIds));

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background fetch failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Helper to register the background fetch task
export async function registerBackgroundFetchAsync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (isRegistered) {
      console.log('Background task already registered');
      return;
    }

    // Configure the background fetch interval (minimum is 15 minutes / 900 seconds)
    await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,   // keep running even if app is closed/terminated!
      startOnBoot: true,        // restart task on device reboot!
    });
    console.log('Background task registered successfully');
  } catch (err) {
    console.error('Failed to register background task:', err);
  }
}

// Helper to unregister the background fetch task (on logout)
export async function unregisterBackgroundFetchAsync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      await AsyncStorage.removeItem('shownNotificationIds');
      console.log('Background task unregistered successfully');
    }
  } catch (err) {
    console.error('Failed to unregister background task:', err);
  }
}
