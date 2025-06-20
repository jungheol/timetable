import React, { useState } from 'react';
import { TouchableOpacity, Alert, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

interface ScreenshotButtonProps {
  captureRef: React.RefObject<any>;
  filename?: string;
  style?: ViewStyle;
  size?: number;
  color?: string;
  onCaptureStart?: () => void;
  onCaptureEnd?: () => void;
  onSuccess?: (uri: string) => void;
  onError?: (error: any) => void;
}

const ScreenshotButton: React.FC<ScreenshotButtonProps> = ({
  captureRef: viewRef,
  filename = 'timetable',
  style,
  size = 24,
  color = '#007AFF',
  onCaptureStart,
  onCaptureEnd,
  onSuccess,
  onError,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (!viewRef.current) {
      Alert.alert('오류', '캡처할 수 없습니다.');
      return;
    }

    try {
      setIsCapturing(true);
      onCaptureStart?.();

      // 권한 요청
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진 저장을 위해 갤러리 접근 권한이 필요합니다.');
        return;
      }

      // 스크린샷 캡처
      const uri = await captureRef(viewRef.current, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
        fileName: filename,
      });

      console.log('📸 Screenshot captured:', uri);
      onSuccess?.(uri);

      // 사용자에게 옵션 제공
      Alert.alert(
        '캡처 완료',
        '캡처된 이미지를 어떻게 처리하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '갤러리에 저장',
            onPress: async () => {
              try {
                await MediaLibrary.saveToLibraryAsync(uri);
                Alert.alert('완료', '이미지가 갤러리에 저장되었습니다.');
              } catch (error) {
                console.error('Error saving to gallery:', error);
                Alert.alert('오류', '갤러리 저장 중 오류가 발생했습니다.');
                onError?.(error);
              }
            }
          },
          {
            text: '공유하기',
            onPress: async () => {
              try {
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                  await Sharing.shareAsync(uri, {
                    dialogTitle: '이미지 공유하기',
                    mimeType: 'image/png'
                  });
                } else {
                  Alert.alert('오류', '공유 기능을 사용할 수 없습니다.');
                }
              } catch (error) {
                console.error('Error sharing:', error);
                Alert.alert('오류', '공유 중 오류가 발생했습니다.');
                onError?.(error);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      Alert.alert('오류', '스크린샷 캡처 중 오류가 발생했습니다.');
      onError?.(error);
    } finally {
      setIsCapturing(false);
      onCaptureEnd?.();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handleCapture}
      disabled={isCapturing}
    >
      <Ionicons
        name={isCapturing ? "camera" : "camera-outline"}
        size={size}
        color={isCapturing ? "#999" : color}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});

export default ScreenshotButton;