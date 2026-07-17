import { View } from 'react-native';

export function HomeIcon({ color }) {
  return (
    <View style={{ width: 18, height: 18, justifyContent: 'flex-end', alignItems: 'center' }}>
      {/* Roof */}
      <View style={{
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderLeftWidth: 9,
        borderRightWidth: 9,
        borderBottomWidth: 7,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }} />
      {/* Body */}
      <View style={{
        width: 15,
        height: 9,
        borderWidth: 2,
        borderTopWidth: 0,
        borderColor: color,
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
      }} />
    </View>
  );
}

export function DiscoverIcon({ color }) {
  return (
    <View style={{ width: 18, height: 18, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: color,
      }} />
      <View style={{
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 5,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
      }} />
    </View>
  );
}

export function ProfileIcon({ color }) {
  return (
    <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
      {/* Head */}
      <View style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: color,
        marginBottom: 1,
      }} />
      {/* Shoulders */}
      <View style={{
        width: 16,
        height: 5,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        borderWidth: 2,
        borderBottomWidth: 0,
        borderColor: color,
      }} />
    </View>
  );
}

export function ShiftIcon({ color }) {
  return (
    <View style={{
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    }}>
      {/* Hour hand */}
      <View style={{
        position: 'absolute',
        width: 2,
        height: 5,
        backgroundColor: color,
        top: 4,
      }} />
      {/* Minute hand */}
      <View style={{
        position: 'absolute',
        width: 4,
        height: 2,
        backgroundColor: color,
        right: 3,
        top: 8,
      }} />
    </View>
  );
}

export function FeedbackIcon({ color }) {
  return (
    <View style={{
      width: 19,
      height: 15,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    }}>
      {/* Three dots inside bubble */}
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
        <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
        <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
      </View>
      {/* Bubble tail */}
      <View style={{
        position: 'absolute',
        bottom: -3,
        left: 4,
        width: 4,
        height: 4,
        backgroundColor: 'transparent',
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      }} />
    </View>
  );
}

export function CafeteriaIcon({ color }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {/* Plate */}
      <View style={{
        width: 15,
        height: 15,
        borderRadius: 7.5,
        borderWidth: 2,
        borderColor: color,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* Inner ring */}
        <View style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          borderWidth: 1,
          borderColor: color,
          opacity: 0.6,
        }} />
      </View>
    </View>
  );
}

export function ShuttleIcon({ color }) {
  return (
    <View style={{
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: color,
      padding: 1.5,
      justifyContent: 'space-between',
    }}>
      {/* Windshield */}
      <View style={{
        height: 5,
        borderWidth: 1,
        borderColor: color,
        borderRadius: 1,
      }} />
      {/* Lights and Grill */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
        <View style={{ width: 6, height: 1.5, backgroundColor: color }} />
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function LeaveIcon({ color }) {
  return (
    <View style={{
      width: 18,
      height: 17,
      borderRadius: 3,
      borderWidth: 2,
      borderColor: color,
      position: 'relative',
      paddingTop: 3,
    }}>
      {/* Top rings */}
      <View style={{ position: 'absolute', top: -3, left: 3, width: 2, height: 4, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', top: -3, right: 3, width: 2, height: 4, backgroundColor: color, borderRadius: 1 }} />
      {/* Grid dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 1, marginTop: 1 }}>
        <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
        <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
        <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function BellIcon({ color }) {
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <View style={{
        width: 14,
        height: 12,
        borderWidth: 2,
        borderColor: color,
        borderTopLeftRadius: 7,
        borderTopRightRadius: 7,
        borderBottomLeftRadius: 1,
        borderBottomRightRadius: 1,
      }} />
      <View style={{
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: color,
        marginTop: 1,
      }} />
      <View style={{
        width: 18,
        height: 2,
        backgroundColor: color,
        position: 'absolute',
        bottom: 5,
        borderRadius: 1,
      }} />
    </View>
  );
}
