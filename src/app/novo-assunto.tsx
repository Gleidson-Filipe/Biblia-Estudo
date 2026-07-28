import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

import {
  View, Text, StyleSheet, TextInput, Pressable,
  Vibration, PanResponder, Dimensions, Animated, Keyboard,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Ban, Check, Clock, Star, Pencil, Pipette, ChevronsUpDown, X, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { createPasta } from '@/database/queries';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PICKER_WIDTH = SCREEN_WIDTH - 32; // padding 16 each side on sheet
const CANVAS_HEIGHT = 180;
const HUE_BAR_HEIGHT = 14;
const PRESETS = ['#E74C3C','#E67E22','#F1C40F','#2ECC71','#3498DB','#9B59B6','#E91E8C'];
const MAX_FAVORITAS = 10;

// ── HSV ↔ HEX helpers ──────────────────────────────────────────────
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, v];
}

function isValidHex(h: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(h);
}

function hexToRgbString(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r}, ${g}, ${b}`;
}

function rgbStringToHex(rgb: string): string | null {
  const parts = rgb.split(',').map(p => parseInt(p.trim(), 10));
  if (parts.length !== 3) return null;
  const [r, g, b] = parts;
  if ([r,g,b].some(v => isNaN(v) || v < 0 || v > 255)) return null;
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
}

// ── Color Picker component ──────────────────────────────────────────
function ColorPicker({
  color, onChange, onUseCor, favoritas, onToggleFavorita, onInputFocus,
}: {
  color: string;
  onChange: (hex: string) => void;
  onUseCor: () => void;
  favoritas: string[];
  onToggleFavorita: (hex: string) => void;
  onInputFocus?: () => void;
}) {
  'use no memo';
  const [hue, saturation, value] = hexToHsv(color);
  const [h, setH] = useState(hue);
  const [s, setS] = useState(saturation);
  const [v, setV] = useState(value);
  const [hexInput, setHexInput] = useState(color.toUpperCase());
  const [rgbInput, setRgbInput] = useState(hexToRgbString(color));
  const [format, setFormat] = useState<'hex' | 'rgb'>('hex');
  const [copied, setCopied] = useState(false);
  const canvasLeft = useRef(0);
  const canvasTop = useRef(0);
  const hueBarLeft = useRef(0);
  const canvasWRef = useRef(PICKER_WIDTH);
  const hueBarWRef = useRef(PICKER_WIDTH);
  const [canvasW, setCanvasW] = useState(PICKER_WIDTH);
  const isFavorita = favoritas.includes(color);

  // Use refs for HSV inside PanResponder callbacks to avoid stale closures
  const hRef = useRef(h);
  const sRef = useRef(s);
  const vRef = useRef(v);
  useEffect(() => { hRef.current = h; }, [h]);
  useEffect(() => { sRef.current = s; }, [s]);
  useEffect(() => { vRef.current = v; }, [v]);

  const emit = useCallback((nh: number, ns: number, nv: number) => {
    const hex = hsvToHex(nh, ns, nv);
    setHexInput(hex.toUpperCase());
    setRgbInput(hexToRgbString(hex));
    onChange(hex);
  }, [onChange]);

  const THUMB_R = 9;
  const HUE_THUMB_R = 8;
  const hueBaseColor = hsvToHex(h, 1, 1);

  // Limitar o thumb nos cantos superiores arredondados
  const cornerR = 14;
  let cx = s * canvasW;
  let cy = (1 - v) * CANVAS_HEIGHT;

  // Canto superior esquerdo
  if (cx < cornerR && cy < cornerR) {
    const dx = cornerR - cx;
    const dy = cornerR - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > cornerR) {
      cx = cornerR - dx * (cornerR / dist);
      cy = cornerR - dy * (cornerR / dist);
    }
  }
  // Canto superior direito
  else if (cx > canvasW - cornerR && cy < cornerR) {
    const dx = cx - (canvasW - cornerR);
    const dy = cornerR - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > cornerR) {
      cx = (canvasW - cornerR) + dx * (cornerR / dist);
      cy = cornerR - dy * (cornerR / dist);
    }
  }

  const thumbX = cx - THUMB_R;
  const thumbY = cy - THUMB_R;
  const hueThumbX = (h / 360) * canvasW - HUE_THUMB_R;

  const [canvasPan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_e, gs) => {
      const w = canvasWRef.current;
      const rx = Math.max(0, Math.min(1, (gs.x0 - canvasLeft.current) / w));
      const ry = Math.max(0, Math.min(1, (gs.y0 - canvasTop.current) / CANVAS_HEIGHT));
      setS(rx); setV(1 - ry); emit(hRef.current, rx, 1 - ry);
    },
    onPanResponderMove: (_e, gs) => {
      const w = canvasWRef.current;
      const rx = Math.max(0, Math.min(1, (gs.moveX - canvasLeft.current) / w));
      const ry = Math.max(0, Math.min(1, (gs.moveY - canvasTop.current) / CANVAS_HEIGHT));
      setS(rx); setV(1 - ry); emit(hRef.current, rx, 1 - ry);
    },
  }));

  const [huePan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_e, gs) => {
      const w = hueBarWRef.current;
      const nh = Math.max(0, Math.min(360, ((gs.x0 - hueBarLeft.current) / w) * 360));
      setH(nh); emit(nh, sRef.current, vRef.current);
    },
    onPanResponderMove: (_e, gs) => {
      const w = hueBarWRef.current;
      const nh = Math.max(0, Math.min(360, ((gs.moveX - hueBarLeft.current) / w) * 360));
      setH(nh); emit(nh, sRef.current, vRef.current);
    },
  }));

  return (
    <View style={pk.container}>
      {/* Canvas container — sem overflow clip para o thumb não ser cortado */}
      <View
        style={pk.canvasContainer}
        onLayout={e => {
          const { width } = e.nativeEvent.layout;
          canvasWRef.current = width;
          setCanvasW(width);
          e.target.measure((_x, _y, _w, _h, px, py) => {
            canvasLeft.current = px;
            canvasTop.current = py;
          });
        }}
        {...canvasPan.panHandlers}
      >
        {/* Gradients clipped pelos cantos arredondados */}
        <View style={pk.canvas}>
          <LinearGradient
            colors={[hueBaseColor, hueBaseColor]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['#FFFFFF', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', '#000000']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        {/* Thumb — recortado pelo canvasContainer overflow hidden */}
        <View style={[pk.canvasThumb, { left: thumbX, top: thumbY }]} />
      </View>

      {/* Hue slider row */}
      <View style={pk.hueRow}>
        <Pipette size={15} color='#555555' />
        <View
          style={pk.hueBarWrap}
          onLayout={e => {
            const { width } = e.nativeEvent.layout;
            hueBarWRef.current = width;
            e.target.measure((_x, _y, _w, _h, px) => {
              hueBarLeft.current = px;
            });
          }}
          {...huePan.panHandlers}
        >
          <LinearGradient
            colors={['#FF0000','#FFFF00','#00FF00','#00FFFF','#0000FF','#FF00FF','#FF0000']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={pk.hueBar}
          />
          {/* Hue thumb */}
          <View style={[pk.hueThumb, { left: hueThumbX, backgroundColor: hueBaseColor }]} />
        </View>
      </View>

      {/* Input row */}
      <View style={pk.hexRow}>
        {/* Preview */}
        <View style={pk.hexPreviewWrap}>
          <View style={[pk.hexPreview, { backgroundColor: color }]} />
        </View>
        {/* Value field */}
        <View style={pk.hexInputWrap}>
          {format === 'hex' ? (
            <TextInput
              style={pk.hexInputField}
              value={hexInput}
              onChangeText={t => {
                const val = t.startsWith('#') ? t : `#${t}`;
                setHexInput(val.toUpperCase());
                if (isValidHex(val)) {
                  const [nh, ns, nv] = hexToHsv(val);
                  setH(nh); setS(ns); setV(nv);
                  setRgbInput(hexToRgbString(val));
                  onChange(val);
                }
              }}
              onFocus={onInputFocus}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              maxLength={7}
              placeholderTextColor='#555555'
              selectTextOnFocus
            />
          ) : (
            <TextInput
              style={pk.hexInputField}
              value={rgbInput}
              onChangeText={t => {
                setRgbInput(t);
                const hex = rgbStringToHex(t);
                if (hex) {
                  setHexInput(hex);
                  const [nh, ns, nv] = hexToHsv(hex);
                  setH(nh); setS(ns); setV(nv);
                  onChange(hex);
                }
              }}
              onFocus={onInputFocus}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numeric"
              placeholderTextColor='#555555'
              selectTextOnFocus
            />
          )}
          <Pressable
            style={pk.copyBtn}
            onPress={async () => {
              const text = format === 'hex' ? hexInput : rgbInput;
              await Clipboard.setStringAsync(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy size={13} color={copied ? '#4A8FE7' : '#555555'} />
          </Pressable>
        </View>
        {/* Format toggle */}
        <Pressable
          style={({ pressed }) => [pk.hexType, pressed && { backgroundColor: '#1A1A1A' }]}
          onPress={() => setFormat(f => f === 'hex' ? 'rgb' : 'hex')}
        >
          <Text style={pk.hexTypeText}>{format === 'hex' ? 'Hex' : 'RGB'}</Text>
          <ChevronsUpDown size={12} color='#555555' />
        </Pressable>
      </View>

      {/* Actions */}
      <View style={pk.actions}>
        <Pressable
          style={pk.actionBtn}
          onPress={() => onToggleFavorita(color)}
        >
          <Star size={14} color={isFavorita ? '#F5C542' : '#FFFFFF'} fill={isFavorita ? '#F5C542' : 'none'} />
          <Text style={pk.actionText}>{isFavorita ? 'Favoritado' : 'Favoritar'}</Text>
          <Text style={pk.actionCounter}>{favoritas.length}/{MAX_FAVORITAS}</Text>
        </Pressable>
        <Pressable style={pk.actionBtn} onPress={onUseCor}>
          <Check size={14} color='#FFFFFF' />
          <Text style={pk.actionText}>Usar cor</Text>
        </Pressable>
      </View>
    </View>
  );
}

const pk = StyleSheet.create({
  container: {},
  canvasContainer: {
    width: '100%',
    height: CANVAS_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  canvasThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  hueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hueBarWrap: {
    flex: 1,
    height: HUE_BAR_HEIGHT,
    borderRadius: 7,
    overflow: 'visible',
    position: 'relative',
  },
  hueBar: {
    flex: 1,
    height: HUE_BAR_HEIGHT,
    borderRadius: 7,
  },
  hueThumb: {
    position: 'absolute',
    top: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  hexPreviewWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexPreview: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  hexInputWrap: {
    flex: 1,
    height: 40,
    backgroundColor: '#0F0F0F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  hexInputField: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    padding: 0,
  },
  copyBtn: {
    paddingLeft: 6,
    paddingVertical: 4,
  },
  hexType: {
    width: 62,
    height: 40,
    backgroundColor: '#0F0F0F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hexTypeText: { fontSize: 12, fontWeight: '600', color: '#8A8A8A' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#292929',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  actionText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  actionCounter: { fontSize: 11, color: '#666666' },
});

// ── Main screen ─────────────────────────────────────────────────────
type ColorTab = 'recentes' | 'favoritas';

export default function NovoAssunto() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerColor, setPickerColor] = useState('#4A8FE7');
  const [plusRotate] = useState(() => new Animated.Value(0));
  const plusSpin = useMemo(
    () => plusRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }),
    [plusRotate],
  );

  useEffect(() => {
    Animated.timing(plusRotate, {
      toValue: showPicker ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showPicker, plusRotate]);
  const [colorTab, setColorTab] = useState<ColorTab>('favoritas');
  const [favoritas, setFavoritas] = useState<string[]>([]);
  const [recentes, setRecentes] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleToggleFavorita = (hex: string) => {
    setFavoritas(prev =>
      prev.includes(hex)
        ? prev.filter(c => c !== hex)
        : prev.length < MAX_FAVORITAS ? [hex, ...prev] : prev
    );
  };

  const handleUsarCor = () => {
    setCor(pickerColor);
    setRecentes(prev => [pickerColor, ...prev.filter(c => c !== pickerColor)].slice(0, 10));
    setShowPicker(false);
  };

  const handleCriar = () => {
    if (!nome.trim()) return;
    createPasta(nome.trim(), cor, descricao.trim() || null);
    Vibration.vibrate(20);
    router.back();
  };

  const displayedColors = colorTab === 'favoritas' ? favoritas : recentes;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color='#FFFFFF' />
        </Pressable>
        <Text style={styles.headerTitle}>Novo assunto</Text>
      </View>

      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        {/* Nome */}
        <View style={styles.section}>
          <Text style={styles.label}>Nome do assunto</Text>
          <View style={[styles.inputRow, nome.length > 0 && { borderColor: '#4A8FE7' }]}>
            <TextInput
              style={styles.input}
              placeholder="Ex: Cristologia, Oração..."
              placeholderTextColor='#444444'
              value={nome}
              onChangeText={t => setNome(t.slice(0, 30))}
              autoFocus
              maxLength={30}
            />
            <Text style={styles.counter}>{nome.length}/30</Text>
          </View>
        </View>

        {/* Cor */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Cor</Text>
            <Text style={styles.opcional}>(opcional)</Text>
          </View>

          {/* Dots row */}
          <View style={styles.corRow}>
            {/* Sem cor */}
            <Pressable
              style={[styles.corDot, { backgroundColor: '#2E2E2E' }, cor === null && !showPicker && styles.corDotSelected]}
              onPress={() => { setCor(null); setShowPicker(false); }}
            >
              <Ban size={12} color='#666666' />
            </Pressable>

            {PRESETS.map(c => (
              <Pressable
                key={c}
                style={[styles.corDot, { backgroundColor: c }, cor === c && !showPicker && styles.corDotSelected]}
                onPress={() => { setCor(c); setShowPicker(false); }}
              />
            ))}

            {/* Abrir picker */}
            <Pressable
              style={[styles.corDotAdd, showPicker && { borderColor: '#4A8FE7' }]}
              onPress={() => {
                setPickerColor(cor ?? '#4A8FE7');
                setShowPicker(v => !v);
              }}
            >
              <Animated.Text style={[styles.corDotAddText, {
                transform: [{ rotate: plusSpin }],
              }]}>+</Animated.Text>
            </Pressable>
          </View>

          {/* Separator */}
          <View style={styles.corSep} />

          {/* Tabs: Recentes | Favoritas | Editar */}
          <View style={styles.corTabRow}>
            <Pressable
              style={[styles.corTabChip, colorTab === 'recentes' && styles.corTabChipActive]}
              onPress={() => { setColorTab('recentes'); setEditMode(false); }}
            >
              <Clock size={11} color={colorTab === 'recentes' ? '#FFFFFF' : '#555555'} />
              <Text style={[styles.corTabText, { color: colorTab === 'recentes' ? '#FFFFFF' : '#555555', fontWeight: colorTab === 'recentes' ? '600' : '400' }]}>Recentes</Text>
            </Pressable>
            <Pressable
              style={[styles.corTabChip, colorTab === 'favoritas' && styles.corTabChipActive]}
              onPress={() => { setColorTab('favoritas'); setEditMode(false); }}
            >
              <Star size={11} color={colorTab === 'favoritas' ? '#FFFFFF' : '#555555'} fill={colorTab === 'favoritas' ? '#FFFFFF' : 'none'} />
              <Text style={[styles.corTabText, { color: colorTab === 'favoritas' ? '#FFFFFF' : '#555555', fontWeight: colorTab === 'favoritas' ? '600' : '400' }]}>Favoritas</Text>
              <Text style={styles.corTabCounter}>{favoritas.length}/{MAX_FAVORITAS}</Text>
            </Pressable>
            {colorTab === 'favoritas' && favoritas.length > 0 && (
              <Pressable
                style={[styles.corTabChip, editMode && { backgroundColor: '#242424', borderColor: '#2A2A2A' }]}
                onPress={() => setEditMode(v => !v)}
              >
                <Pencil size={12} color={editMode ? '#FFFFFF' : '#555555'} />
                <Text style={[styles.corTabText, { color: editMode ? '#FFFFFF' : '#555555' }]}>Editar</Text>
              </Pressable>
            )}
          </View>

          {/* Cores da aba */}
          {displayedColors.length > 0 && (
            <View style={styles.corSavedRow}>
              {displayedColors.map((c, i) => (
                <View key={`${c}_${i}`} style={styles.corSavedWrap}>
                  <Pressable
                    style={[styles.corSavedDot, { backgroundColor: c }, !editMode && cor === c && styles.corDotSelected]}
                    onPress={() => {
                      if (editMode) return;
                      setCor(cor === c ? null : c);
                    }}
                  />
                  {editMode && colorTab === 'favoritas' && (
                    <Pressable
                      style={styles.corSavedBadge}
                      onPress={() => setFavoritas(prev => prev.filter(fc => fc !== c))}
                      hitSlop={4}
                    >
                      <X size={8} color='#FFFFFF' />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Color picker expandido */}
          {showPicker && (
            <View style={styles.pickerWrap}>
              <ColorPicker
                color={pickerColor}
                onChange={setPickerColor}
                onUseCor={handleUsarCor}
                favoritas={favoritas}
                onToggleFavorita={handleToggleFavorita}
                onInputFocus={undefined}
              />
            </View>
          )}
        </View>

        {/* Descrição */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Descrição</Text>
            <Text style={styles.opcional}>(opcional)</Text>
          </View>
          <TextInput
            style={styles.descInput}
            placeholder="Uma breve descrição sobre este assunto..."
            placeholderTextColor='#444444'
            value={descricao}
            onChangeText={setDescricao}
            multiline
            textAlignVertical="top"
          />
        </View>
      </KeyboardAwareScrollView>

      {/* CTA */}
      {!kbVisible && (
        <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={[styles.createBtn, !nome.trim() && { opacity: 0.4 }]}
            onPress={handleCriar}
          >
            <Check size={18} color='#FFFFFF' />
            <Text style={styles.createText}>Criar assunto</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    padding: 20,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
  },
  opcional: {
    fontSize: 12,
    color: '#444444',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#242424',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    padding: 0,
  },
  counter: {
    fontSize: 12,
    color: '#555555',
    marginLeft: 8,
  },
  corRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  corDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corDotSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  corDotAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#242424',
    borderWidth: 1.5,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corDotAddText: {
    fontSize: 18,
    color: '#555555',
    lineHeight: 22,
  },
  corSep: {
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  corTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  corTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  corTabChipActive: {
    backgroundColor: '#242424',
    borderColor: '#3A3A3A',
  },
  corTabText: {
    fontSize: 12,
  },
  corTabCounter: {
    fontSize: 11,
    color: '#888888',
  },
  corSavedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  corSavedWrap: {
    width: 28,
    height: 28,
    position: 'relative',
  },
  corSavedDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  corSavedBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerWrap: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    overflow: 'hidden',
  },
  descInput: {
    backgroundColor: '#242424',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#FFFFFF',
    height: 110,
    textAlignVertical: 'top',
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4A8FE7',
    borderRadius: 16,
    paddingVertical: 17,
  },
  createText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
