import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ListRenderItemInfo,
} from 'react-native';

const { height: screenHeight } = Dimensions.get('window');
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface CustomPickerProps {
  visible: boolean;
  title: string;
  selectedValue: string;
  options: string[];
  optionLabels?: string[]; // ✅ 추가된 prop
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

const CustomPicker: React.FC<CustomPickerProps> = ({
  visible,
  title,
  selectedValue,
  options,
  optionLabels, // ✅ 새로 추가된 prop
  onCancel,
  onConfirm,
}) => {
  const [currentValue, setCurrentValue] = useState(selectedValue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<Animated.FlatList>(null);
  const prevOptionsRef = useRef<string[]>([]);
  const prevVisibleRef = useRef<boolean>(false);

  // ✅ 표시할 라벨을 결정하는 함수
  const getDisplayLabel = useCallback((option: string, actualIndex: number): string => {
    if (optionLabels && optionLabels[actualIndex]) {
      return optionLabels[actualIndex];
    }
    return option;
  }, [optionLabels]);

  // Modal이 열릴 때 선택된 값으로 초기화
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      // Modal이 새로 열릴 때만 초기화
      setCurrentValue(selectedValue);
      const index = options.indexOf(selectedValue);
      setCurrentIndex(index >= 0 ? index : 0);
      setIsInitialized(false);
    }
    prevVisibleRef.current = visible;
  }, [visible, selectedValue, options]);

  // 패딩을 위한 수정된 옵션 리스트 (앞뒤로 빈 아이템 추가)
  const modifiedOptions = useMemo(() => {
    return ['', '', ...options, '', ''];
  }, [options]);

  // options가 변경되었는지 확인하는 함수
  const hasOptionsChanged = useCallback(() => {
    if (prevOptionsRef.current.length !== options.length) {
      return true;
    }
    return prevOptionsRef.current.some((item, index) => item !== options[index]);
  }, [options]);

  // Modal이 열릴 때 또는 options가 변경될 때 선택된 아이템으로 스크롤
  useEffect(() => {
    if (visible && flatListRef.current && currentIndex >= 0) {
      const optionsChanged = hasOptionsChanged();
      
      // options가 변경되었거나 아직 초기화되지 않은 경우에만 스크롤
      if (!isInitialized || optionsChanged) {
        const targetOffset = currentIndex * ITEM_HEIGHT;
        
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: targetOffset,
            animated: false, // 애니메이션 없이 즉시 이동
          });
          scrollY.setValue(targetOffset);
          setIsInitialized(true);
        }, 100); // 딜레이를 줄임
        
        // 이전 options 저장
        prevOptionsRef.current = [...options];
      }
    }
  }, [visible, currentIndex, scrollY, isInitialized, hasOptionsChanged, options]);

  // ✅ 아이템 렌더링 - WheelPicker 스타일로 수정 + optionLabels 지원
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<string>) => {
    // 빈 아이템은 빈 View로 렌더링
    if (!item) {
      return <View style={{ height: ITEM_HEIGHT }} />;
    }

    // 실제 아이템 인덱스 (빈 아이템 2개 제외)
    const actualIndex = index - 2;
    
    // WheelPicker와 동일한 inputRange 계산
    const inputRange = [
      (actualIndex - 2) * ITEM_HEIGHT,
      (actualIndex - 1) * ITEM_HEIGHT,
      actualIndex * ITEM_HEIGHT,
      (actualIndex + 1) * ITEM_HEIGHT,
      (actualIndex + 2) * ITEM_HEIGHT,
    ];

    // 스케일 애니메이션
    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [0.7, 0.85, 1, 0.85, 0.7],
      extrapolate: 'clamp',
    });

    // 투명도 애니메이션
    const opacity = scrollY.interpolate({
      inputRange,
      outputRange: [0.3, 0.6, 1, 0.6, 0.3],
      extrapolate: 'clamp',
    });

    // ✅ 표시할 텍스트 결정 (optionLabels 사용)
    const displayText = getDisplayLabel(item, actualIndex);

    return (
      <Animated.View
        style={[
          styles.pickerItem,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <Text style={styles.pickerItemText}>
          {displayText}
        </Text>
      </Animated.View>
    );
  }, [scrollY, getDisplayLabel]);

  // 스크롤 종료 시 처리
  const handleMomentumScrollEnd = useCallback((
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    
    if (index >= 0 && index < options.length) {
      setCurrentIndex(index);
      setCurrentValue(options[index]); // ✅ 실제 값은 여전히 options에서 가져옴
    }
  }, [options]);

  const handleConfirm = () => {
    onConfirm(currentValue); // ✅ 실제 값 전달 (라벨이 아닌 원본 값)
  };

  const handleCancel = () => {
    setIsInitialized(false); // 취소 시 초기화 상태 리셋
    onCancel();
  };

  // Modal이 닫힐 때 초기화 상태 리셋
  useEffect(() => {
    if (!visible) {
      setIsInitialized(false);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.modalDoneText}>완료</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContainer}>
            <Animated.FlatList
              ref={flatListRef}
              data={modifiedOptions}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              onMomentumScrollEnd={handleMomentumScrollEnd}
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true }
              )}
              getItemLayout={(_, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * index,
                index,
              })}
              style={{ height: PICKER_HEIGHT }}
              bounces={false}
              overScrollMode="never"
            />
            
            {/* 선택 영역 표시기 - 중앙에 위치 */}
            <View style={styles.indicatorHolder}>
              <View style={[styles.indicator, styles.topIndicator]} />
              <View style={[styles.indicator, styles.bottomIndicator]} />
            </View>
            
            {/* 상단 그라데이션 마스크 */}
            <View style={[styles.gradientMask, styles.topMask]} />
            
            {/* 하단 그라데이션 마스크 */}
            <View style={[styles.gradientMask, styles.bottomMask]} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Modal 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalDoneText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  // Picker 스타일
  pickerContainer: {
    position: 'relative',
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerItemText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#333',
  },
  // 선택 표시기 스타일
  indicatorHolder: {
    position: 'absolute',
    top: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    pointerEvents: 'none',
  },
  indicator: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  topIndicator: {
    top: 0,
  },
  bottomIndicator: {
    bottom: 0,
  },
  // 그라데이션 마스크 스타일
  gradientMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    pointerEvents: 'none',
  },
  topMask: {
    top: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  bottomMask: {
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});

export default CustomPicker;