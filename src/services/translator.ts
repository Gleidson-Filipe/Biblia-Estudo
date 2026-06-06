import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';

const cache = new Map<string, string>();

export async function translateToPt(text: string): Promise<string> {
  if (!text) return text;
  if (cache.has(text)) return cache.get(text)!;
  try {
    const result = await TranslateText.translate({
      text,
      sourceLanguage: TranslateLanguage.ENGLISH,
      targetLanguage: TranslateLanguage.PORTUGUESE,
      downloadModelIfNeeded: true,
    });
    const translated = (result as any)?.result ?? (result as any) ?? text;
    const str = typeof translated === 'string' ? translated : text;
    cache.set(text, str);
    return str;
  } catch (e) {
    console.warn('Translation failed:', e);
    return text;
  }
}

export async function initTranslator(): Promise<boolean> {
  try {
    // Warm up by translating a short string — downloads models if needed
    await translateToPt('God');
    return true;
  } catch {
    return false;
  }
}

export function isTranslatorReady(): boolean {
  return cache.size > 0;
}
