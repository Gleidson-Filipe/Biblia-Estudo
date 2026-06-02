import React, { useRef, useEffect } from 'react';
import { Text, View, PanResponder, Animated } from 'react-native';
import { GripVertical } from 'lucide-react-native';

export const ITEM_HEIGHT = 72;
export type VersionKey = 'ara' | 'arc' | 'kjv' | 'dby';

interface VersionMeta { label: string; fullName: string; }
interface Props {
  order: VersionKey[];
  onOrderChange: (order: VersionKey[]) => void;
  versionMeta: Record<string, VersionMeta>;
  colors: { text: string; textMuted: string; backgroundElement: string };
  spacing: { two: number; three: number };
}

export default function SortableVersionList({ order, onOrderChange, versionMeta, colors, spacing }: Props) {
  // Slot position for each key: slot * ITEM_HEIGHT = visual top
  const slots = useRef<Record<string, number>>(
    Object.fromEntries(order.map((k, i) => [k, i]))
  );

  // Each key has a persistent Animated.Value for translateY
  // Visual position = slot * ITEM_HEIGHT + translateY
  const animY = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(order.map((k, i) => [k, new Animated.Value(i * ITEM_HEIGHT)]))
  ).current;

  const makePan = (key: VersionKey) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderMove: (_, gs) => {
      const fromSlot = slots.current[key];
      const toSlot = Math.min(order.length - 1, Math.max(0, Math.round(fromSlot + gs.dy / ITEM_HEIGHT)));

      // Move dragged item with finger
      animY[key].setValue(fromSlot * ITEM_HEIGHT + gs.dy);

      // Shift neighbours
      for (const k of order) {
        if (k === key) continue;
        const s = slots.current[k];
        let target = s;
        if (fromSlot < toSlot && s > fromSlot && s <= toSlot) target = s - 1;
        if (fromSlot > toSlot && s < fromSlot && s >= toSlot) target = s + 1;
        animY[k].setValue(target * ITEM_HEIGHT);
      }
    },

    onPanResponderRelease: (_, gs) => {
      const fromSlot = slots.current[key];
      const toSlot = Math.min(order.length - 1, Math.max(0, Math.round(fromSlot + gs.dy / ITEM_HEIGHT)));

      // Snap all to final positions — no setState, no re-render
      const newSlots: Record<string, number> = { ...slots.current };
      if (fromSlot !== toSlot) {
        for (const k of order) {
          const s = slots.current[k];
          if (k === key) { newSlots[k] = toSlot; continue; }
          if (fromSlot < toSlot && s > fromSlot && s <= toSlot) newSlots[k] = s - 1;
          else if (fromSlot > toSlot && s < fromSlot && s >= toSlot) newSlots[k] = s + 1;
        }
      }

      slots.current = newSlots;

      // Snap each item to its final slot position instantly
      for (const k of order) {
        animY[k].setValue(newSlots[k] * ITEM_HEIGHT);
      }

      if (fromSlot !== toSlot) {
        // Build ordered array and notify parent with delay
        const next = [...order].sort((a, b) => newSlots[a] - newSlots[b]);
        setTimeout(() => onOrderChange(next), 400);
      }
    },

    onPanResponderTerminate: () => {
      // Reset to current slots
      for (const k of order) animY[k].setValue(slots.current[k] * ITEM_HEIGHT);
    },
  });

  const panResponders = useRef<Record<string, ReturnType<typeof PanResponder.create>>>(
    Object.fromEntries(order.map(k => [k, makePan(k as VersionKey)]))
  ).current;

  return (
    <View style={{ height: order.length * ITEM_HEIGHT, position: 'relative' }}>
      {order.map((key) => {
        const meta = versionMeta[key];
        return (
          <Animated.View
            key={key}
            style={{
              position: 'absolute',
              left: 0, right: 0,
              transform: [{ translateY: animY[key] }],
              height: ITEM_HEIGHT,
            }}
          >
            <View
              {...panResponders[key].panHandlers}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: ITEM_HEIGHT - 10,
                marginVertical: 5,
                paddingHorizontal: spacing.three,
                borderRadius: 10,
                backgroundColor: colors.backgroundElement,
                gap: spacing.three,
              }}
            >
              <GripVertical size={22} color={colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 17, fontWeight: 'bold', color: colors.text }}>{meta.label}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{meta.fullName}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
