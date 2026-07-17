import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/notificationService';
import { FeedbackIcon, CafeteriaIcon, ShuttleIcon, LeaveIcon, ShiftIcon } from '../components/CustomIcons';

export function NotificationScreen({ currentUser, onNavigate, onRefreshComplete }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function fetchNotificationsList(targetPage = 1, shouldAppend = false) {
    try {
      if (targetPage === 1) setLoading(true);
      const data = await getNotifications(targetPage, 20, 'all');

      if (data.length < 20) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      if (shouldAppend) {
        setNotifications((prev) => {
          // Filter duplicates
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = data.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      } else {
        setNotifications(data);
      }

      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchNotificationsList(1, false);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setPage(1);
    await fetchNotificationsList(1, false);
  }

  async function handleLoadMore() {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchNotificationsList(nextPage, true);
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleNotificationPress(item) {
    try {
      if (!item.is_read) {
        await markNotificationAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
        if (onRefreshComplete) {
          onRefreshComplete();
        }
      }

      // Navigate based on screen parameter
      if (item.data && item.data.screen) {
        onNavigate(
          item.data.screen,
          item.data.request_id || item.data.feedback_id || item.data.shift_id
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Group notifications by Today, Yesterday, and Older
  const groupedNotifications = useMemo(() => {
    const today = [];
    const yesterday = [];
    const older = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    notifications.forEach((item) => {
      const date = new Date(item.created_at);
      if (date >= todayStart) {
        today.push(item);
      } else if (date >= yesterdayStart) {
        yesterday.push(item);
      } else {
        older.push(item);
      }
    });

    return [
      { title: 'BUGÜN', data: today },
      { title: 'DÜN', data: yesterday },
      { title: 'DAHA ÖNCE', data: older },
    ].filter((g) => g.data.length > 0);
  }, [notifications]);

  const renderIcon = (type) => {
    const iconColor = colors.primary;
    if (type === 'FEEDBACK_STATUS') return <FeedbackIcon color={iconColor} />;
    if (type === 'CORRECTION_STATUS' || type === 'CORRECTION_CREATED') return <LeaveIcon color={iconColor} />;
    if (type === 'LEAVE_STATUS' || type === 'LEAVE_CREATED') return <LeaveIcon color={iconColor} />;
    if (type === 'SHIFT_ASSIGN') return <ShiftIcon color={iconColor} />;
    return <FeedbackIcon color={iconColor} />;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hrs = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  const formatDateLabel = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  };

  // Convert grouped sections into a flat list for FlatList rendering to keep performance optimal
  const flatDataList = useMemo(() => {
    const flat = [];
    groupedNotifications.forEach((group) => {
      flat.push({ isHeader: true, title: group.title });
      group.data.forEach((item) => {
        flat.push({ ...item, isHeader: false });
      });
    });
    return flat;
  }, [groupedNotifications]);

  if (loading && page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.actionsBar}>
        <Text style={styles.summaryText}>{notifications.filter(n => !n.is_read).length} okunmamış bildirim</Text>
        <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
          <Text style={styles.markAllText}>Tümünü okundu yap</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={flatDataList}
        keyExtractor={(item, index) => (item.isHeader ? `h-${item.title}` : `n-${item.id}`)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          if (item.isHeader) {
            return (
              <View style={styles.headerContainer}>
                <Text style={styles.headerText}>{item.title}</Text>
              </View>
            );
          }

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleNotificationPress(item)}
              style={[
                styles.itemCard,
                !item.is_read && styles.unreadItem,
              ]}
            >
              {!item.is_read && <View style={styles.unreadDot} />}
              <View style={styles.iconContainer}>{renderIcon(item.type)}</View>

              <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemBody}>{item.body}</Text>
                <Text style={styles.itemTime}>
                  {item.created_at ? (item.title === 'DAHA ÖNCE' ? formatDateLabel(item.created_at) : formatTime(item.created_at)) : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Henüz hiç bildiriminiz bulunmuyor.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionsBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1E293B' : '#E2E8F0',
    },
    summaryText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: '600',
    },
    markAllText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '700',
    },
    listContent: {
      paddingBottom: 24,
    },
    headerContainer: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 8,
    },
    headerText: {
      fontSize: 11,
      fontWeight: '900',
      color: colors.muted,
      letterSpacing: 1.5,
    },
    itemCard: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1E293B' : '#F1F5F9',
      backgroundColor: isDark ? '#111622' : '#FFFFFF',
      position: 'relative',
    },
    unreadItem: {
      backgroundColor: isDark ? '#1E293B80' : '#EFF6FF',
    },
    unreadDot: {
      position: 'absolute',
      top: 22,
      left: 8,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#0F172A',
      marginBottom: 3,
    },
    itemBody: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
      marginBottom: 6,
    },
    itemTime: {
      fontSize: 11,
      color: colors.muted,
      fontWeight: '500',
    },
    footerLoader: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
  });
