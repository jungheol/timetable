import { useCallback } from 'react';
import { EventFormData, EventUIState } from '../types/eventTypes';
import { Academy, Event, Schedule } from '../services/DatabaseService';
import { calculateEndTime, isValidTimeOption, findNextValidTime } from '../utils/eventUtils';

interface UseEventHandlersProps {
  formData: EventFormData;
  uiState: EventUIState;
  schedule: Schedule | null;
  academies: Academy[];
  timeOptions: string[];
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  setUIState: React.Dispatch<React.SetStateAction<EventUIState>>;
}

export const useEventHandlers = ({
  formData,
  uiState,
  schedule,
  academies,
  timeOptions,
  setFormData,
  setUIState,
}: UseEventHandlersProps) => {

  // ✅ 폼 데이터 업데이트
  const updateFormData = useCallback((updates: Partial<EventFormData>) => {
    console.log('📝 Updating form data with:', updates);
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      console.log('📝 Form data state after update:', {
        title: newData.title,
        startTime: newData.startTime,
        endTime: newData.endTime,
        category: newData.category,
        academyName: newData.academyName
      });
      return newData;
    });
  }, [setFormData]);

  // ✅ UI 상태 업데이트
  const updateUIState = useCallback((updates: Partial<EventUIState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  }, [setUIState]);

  // ✅ 시작 시간 선택 핸들러
  const handleStartTimeConfirm = useCallback((value: string) => {
    console.log('⏰ Start time selected:', value);
    console.log('📝 Current form data before update:', {
      startTime: formData.startTime,
      endTime: formData.endTime,
      title: formData.title
    });
    
    setFormData(prev => ({ ...prev, startTime: value }));
    
    // 종료 시간 자동 조정
    if (schedule) {
      const calculatedEndTime = calculateEndTime(value, schedule);
      
      if (isValidTimeOption(calculatedEndTime, timeOptions)) {
        setFormData(prev => ({ ...prev, endTime: calculatedEndTime }));
        console.log('✅ End time auto-set to:', calculatedEndTime);
      } else {
        const nextValidTime = findNextValidTime(value, timeOptions);
        
        if (nextValidTime) {
          setFormData(prev => ({ ...prev, endTime: nextValidTime }));
          console.log('✅ End time set to next valid time:', nextValidTime);
        } else {
          console.log('⚠️ No valid end time found, keeping current end time');
        }
      }
    }
  }, [schedule, timeOptions, formData, setFormData]);

  // ✅ 종료 시간 선택 핸들러
  const handleEndTimeConfirm = useCallback((value: string) => {
    console.log('⏰ End time selected:', value);
    console.log('📝 Current form data before update:', {
      startTime: formData.startTime,
      endTime: formData.endTime,
      title: formData.title
    });
    
    setFormData(prev => ({ ...prev, endTime: value }));
  }, [formData, setFormData]);

  // ✅ 카테고리 변경 핸들러
  const handleCategoryChange = useCallback((newCategory: Event['category']) => {
    setFormData(prev => ({
      ...prev,
      category: newCategory,
      // 학원이 아닌 경우 학원 관련 데이터 초기화
      ...(newCategory !== '학원' && {
        academyName: '',
        selectedSubject: '국어' as Academy['subject'],
        selectedAcademy: null,
      })
    }));
  }, [setFormData]);

  // ✅ 요일 토글 핸들러
  const toggleDay = useCallback((dayKey: string) => {
    setFormData(prev => {
      const newSelectedDays = new Set(prev.selectedDays);
      if (newSelectedDays.has(dayKey)) {
        newSelectedDays.delete(dayKey);
      } else {
        newSelectedDays.add(dayKey);
      }
      return { ...prev, selectedDays: newSelectedDays };
    });
  }, [setFormData]);

  // ✅ 학원 선택 핸들러
  const handleAcademySelect = useCallback((academyIdStr: string) => {
    if (academyIdStr === 'new') {
      setFormData(prev => ({
        ...prev,
        selectedAcademy: null,
        academyName: '',
        selectedSubject: '국어',
      }));
    } else {
      const academy = academies.find(a => a.id.toString() === academyIdStr);
      if (academy) {
        setFormData(prev => ({
          ...prev,
          selectedAcademy: academy,
          academyName: academy.name,
          selectedSubject: academy.subject,
        }));
      }
    }
    setUIState(prev => ({ ...prev, showAcademyPicker: false }));
  }, [academies, setFormData, setUIState]);

  return {
    updateFormData,
    updateUIState,
    handleStartTimeConfirm,
    handleEndTimeConfirm,
    handleCategoryChange,
    toggleDay,
    handleAcademySelect,
  };
};