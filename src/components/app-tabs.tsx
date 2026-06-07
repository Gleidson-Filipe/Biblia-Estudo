import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Pressable, StyleSheet, useColorScheme, Platform, Text } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { BookOpen, Search, Languages, BookMarked, MessageSquare, Copy, BookCopy, X, Link, Bookmark, Check } from 'lucide-react-native';
import { verseContextRef, tabBarVisibilityRef } from '@/components/verse-context-ref';

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Leitura' }} />
      <Tabs.Screen name="search" options={{ title: 'Pesquisa' }} />
      <Tabs.Screen name="lexicon" options={{ title: 'Léxico' }} />
      <Tabs.Screen name="study" options={{ title: 'Estudo' }} />
      <Tabs.Screen name="journal" options={{ title: 'Salvos' }} />
      <Tabs.Screen name="annotation" options={{ href: null }} />
      <Tabs.Screen name="selector" options={{ href: null, animation: 'none' }} />
    </Tabs>
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const [, forceUpdate] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentRoute = state.routes[state.index];
  const isLeituraTab = currentRoute.name === 'index';
  const verseSelected = isLeituraTab && verseContextRef.current !== null;

  // Re-render when verse selection or tab bar visibility changes
  useEffect(() => {
    let prevHidden = tabBarVisibilityRef.hidden;
    const interval = setInterval(() => {
      const isLeituraActive = state.routes[state.index].name === 'index';
      const hasVerse = isLeituraActive && verseContextRef.current !== null;
      const nowHidden = tabBarVisibilityRef.hidden;
      if (hasVerse !== verseSelected || nowHidden !== prevHidden) {
        prevHidden = nowHidden;
        forceUpdate(n => n + 1);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [verseSelected, state.index]);

  if (tabBarVisibilityRef.hidden) return null;

  if (currentRoute.name === 'annotation' || currentRoute.name === 'study' || currentRoute.name === 'selector') return null;

  const dockStyle = [
    styles.dock,
    {
      backgroundColor: isDark ? 'rgba(26, 24, 23, 0.92)' : 'rgba(250, 247, 242, 0.92)',
      borderColor: isDark ? '#242120' : '#EAE2D5',
      shadowColor: isDark ? '#000000' : '#1A1613',
    },
  ];

  if (verseSelected) {
    const COLORS = ['#FCD34D', '#6EE7B7', '#60A5FA', '#FCA5A5'];
    // Read from ref at call time, not at render time
    const getCtx = () => verseContextRef.current;
    return (
      <View style={styles.container} pointerEvents="box-none">
        {/* Color picker row */}
        <View style={[dockStyle, { marginBottom: 8, justifyContent: 'center', gap: 12, width: 'auto', paddingHorizontal: 20 }]}>
          {COLORS.map(color => (
            <Pressable
              key={color}
              onPress={() => getCtx()?.onColorSelect(color)}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: color,
                opacity: getCtx()?.activeColor === color ? 1 : 0.85,
                transform: getCtx()?.activeColor === color ? [{ scale: 1.15 }] : [{ scale: 1 }],
              }}
            />
          ))}
          <Pressable
            onPress={() => getCtx()?.onColorClear()}
            style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.textSecondary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={14} color={colors.textSecondary} />
          </Pressable>
        </View>
        {/* Actions row */}
        <View style={dockStyle}>
          <Pressable style={styles.tabButton} onPress={() => getCtx()?.onAnnotation()}>
            <MessageSquare size={22} color={colors.accent} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Anotação</Text>
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => getCtx()?.onLink()}>
            <Link size={22} color={colors.accent} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Vincular</Text>
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => { getCtx()?.onCopy(); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check size={22} color="#10B981" strokeWidth={2.5} /> : <Copy size={22} color={colors.accent} strokeWidth={1.8} />}
            <Text style={[styles.actionLabel, { color: copied ? '#10B981' : colors.text }]}>{copied ? 'Copiado!' : 'Copiar'}</Text>
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => getCtx()?.onCompare()}>
            <BookCopy size={22} color={colors.accent} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Comparar</Text>
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => getCtx()?.onClose()}>
            <X size={22} color={colors.textSecondary} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={dockStyle}>
        {state.routes.filter((r: any) => !['annotation', 'study', 'selector'].includes(r.name)).map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          if (options.href === null) return null;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          let IconComponent = BookOpen;
          if (route.name === 'search') IconComponent = Search;
          else if (route.name === 'lexicon') IconComponent = Languages;
          else if (route.name === 'study') IconComponent = BookMarked;
          else if (route.name === 'journal') IconComponent = Bookmark;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.tabButton}
            >
              <IconComponent size={22} color={isFocused ? colors.accent : colors.textSecondary} strokeWidth={isFocused ? 2.5 : 1.8} />
              {isFocused && <View style={[styles.activeIndicator, { backgroundColor: colors.accent }]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 18,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    zIndex: 100,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 32,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
    maxWidth: 360,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    position: 'relative',
    height: 48,
    flex: 1,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 14,
    height: 3,
    borderRadius: 1.5,
  },
  actionLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
});
