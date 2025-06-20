import { useCallback } from 'react';
import { Alert } from 'react-native';
import moment from 'moment';
import { EventFormData } from '../types/eventTypes';
import { determineEventTitle } from '../utils/eventUtils';

export const useEventValidation = () => {
  
  const validateForm = useCallback((formData: EventFormData): boolean => {
    console.log('🔍 Validating form data:', {
      selectedDays: Array.from(formData.selectedDays),
      startTime: formData.startTime,
      endTime: formData.endTime,
      title: formData.title,
      academyName: formData.academyName,
      category: formData.category
    });

    // 1. 요일 선택 검사
    if (formData.selectedDays.size === 0) {
      Alert.alert('오류', '최소 하나의 요일을 선택해주세요.');
      return false;
    }

    // 2. 시간 설정 검사
    if (!formData.startTime || !formData.endTime) {
      Alert.alert('오류', '시작 시간과 종료 시간을 설정해주세요.');
      return false;
    }

    // 3. 시간 순서 검사
    if (moment(formData.startTime, 'HH:mm').isSameOrAfter(moment(formData.endTime, 'HH:mm'))) {
      Alert.alert('오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return false;
    }

    // 4. 제목/학원명 검사
    const eventTitle = determineEventTitle(formData.category, formData.title, formData.academyName);
    console.log('🔍 Determined event title for validation:', eventTitle);
    
    if (!eventTitle || !eventTitle.trim()) {
      Alert.alert('오류', formData.category === '학원' ? '학원명을 입력해주세요.' : '제목을 입력해주세요.');
      return false;
    }

    console.log('✅ Form validation passed');
    return true;
  }, []);

  const validateTimeSlot = useCallback((startTime: string, endTime: string): boolean => {
    if (!startTime || !endTime) {
      Alert.alert('오류', '시간을 선택해주세요.');
      return false;
    }

    if (moment(startTime, 'HH:mm').isSameOrAfter(moment(endTime, 'HH:mm'))) {
      Alert.alert('오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return false;
    }

    return true;
  }, []);

  const validateAcademyData = useCallback((academyName: string, category: string): boolean => {
    if (category === '학원' && (!academyName || !academyName.trim())) {
      Alert.alert('오류', '학원명을 입력해주세요.');
      return false;
    }
    return true;
  }, []);

  return {
    validateForm,
    validateTimeSlot,
    validateAcademyData,
  };
};