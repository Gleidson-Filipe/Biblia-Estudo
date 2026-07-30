import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import {
  Platform,
  TextInput,
  TextInputProps,
  requireNativeComponent,
  UIManager,
  findNodeHandle,
} from 'react-native';

// @ts-ignore
import TextInputState from 'react-native/Libraries/Components/TextInput/TextInputState';

const NativeSentinelTextInput = Platform.OS === 'android'
  ? requireNativeComponent<TextInputProps & { ref?: any }>('SentinelTextInput')
  : null;

const SentinelTextInput = forwardRef<TextInput, TextInputProps>((props, ref) => {
  const nativeRef = useRef<any>(null);

  useImperativeHandle(ref, () => {
    return {
      focus() {
        // Nova Arquitetura: passa o host component diretamente, não o tag numérico
        if (nativeRef.current) TextInputState.focusTextInput(nativeRef.current);
      },
      blur() {
        if (nativeRef.current) TextInputState.blurTextInput(nativeRef.current);
      },
      setNativeProps(nativeProps: object) {
        const tag = findNodeHandle(nativeRef.current);
        if (tag != null) UIManager.updateView(tag, 'SentinelTextInput', nativeProps);
      },
      clear() {},
      isFocused: () => false,
      measure: () => {},
      measureInWindow: () => {},
      measureLayout: () => {},
    } as unknown as TextInput;
  }, []);

  if (NativeSentinelTextInput) {
    return <NativeSentinelTextInput {...props} ref={nativeRef} />;
  }
  return <TextInput {...props} ref={ref} />;
});

SentinelTextInput.displayName = 'SentinelTextInput';
export default SentinelTextInput;
