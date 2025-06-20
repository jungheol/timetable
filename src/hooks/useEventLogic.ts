import { useState, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import DatabaseService, { Academy, Schedule, RecurringException } from '../services/DatabaseService';
import { 
  EventFormData, 
  EventUIState, 
  EventScreenParams, 
  createInitialFormData, 
  createInitialUIState,
  WEEKDAYS 
} from '../types/eventTypes';
import { generateEventOptions } from '../utils/eventUtils';
import { useEventValidation } from './useEventValidation';
import { useEventHandlers } from './useEventHandlers';
import { useEventDataLoader } from './useEventDataLoader';
import { useEventSaveLogic } from './useEventSaveLogic';
import { useEventDeleteLogic } from './useEventDeleteLogic';

// 메인 이벤트 로직 훅
export const useEventLogic = (
  params: EventScreenParams,
  navigation: any
) => {
  const { event, selectedDate, selectedTime, scheduleId, onSave } = params;
  
  // 상태 관리
  const [formData, setFormData] = useState<EventFormData>(createInitialFormData);
  const [uiState, setUIState] = useState<EventUIState>(createInitialUIState);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [currentException, setCurrentException] = useState<RecurringException | null>(null);

  // 편집 모드 체크
  const isEditMode = !!event;

  // 옵션 생성
  const options = useMemo(() => generateEventOptions(schedule, academies), [schedule, academies]);

  // 커스텀 훅들
  const { validateForm } = useEventValidation();
  
  const {
    updateFormData,
    updateUIState,
    handleStartTimeConfirm,
    handleEndTimeConfirm,
    handleCategoryChange,
    toggleDay,
    handleAcademySelect,
  } = useEventHandlers({
    formData,
    uiState,
    schedule,
    academies,
    timeOptions: options.timeOptions,
    setFormData,
    setUIState,
  });

  const {
    loadInitialData,
    loadEventData,
    loadExceptionData,
    initializeNewEventForm,
  } = useEventDataLoader({
    selectedDate,
    scheduleId,
    weekdays: WEEKDAYS,
    setFormData,
    setUIState,
    setSchedule,
    setAcademies,
    setCurrentException,
  });

  // ✅ setUIState 전달하여 모달 즉시 닫기 가능하도록 수정
  const {
    finishSave,
    updateExistingException,
    updateExistingEvent,
    saveSingleEvent,
    saveRecurringEvent,
    handleRecurringEditConfirm,
    handleRecurringDeleteConfirm,
  } = useEventSaveLogic({
    scheduleId,
    selectedDate,
    event,
    formData,
    currentException,
    isEditingException: uiState.isEditingException,
    onSave,
    navigation,
    setUIState, // ✅ setUIState 전달
  });

  const { handleDelete } = useEventDeleteLogic({
    event,
    scheduleId,
    setUIState,
    finishSave,
  });

  // ✅ 메인 저장 처리 - 모달 처리 개선
  const handleSave = async () => {
    console.log('🔄 handleSave called');
    
    if (!validateForm(formData)) {
      console.log('❌ Form validation failed');
      return;
    }

    setUIState(prev => ({ ...prev, isLoading: true }));

    try {
      if (isEditMode) {
        if (event?.is_recurring) {
          if (uiState.isEditingException) {
            console.log('🔄 Updating existing exception');
            await updateExistingException();
            // ✅ 예외 수정 시 즉시 화면 닫기
            finishSave();
          } else {
            console.log('🔄 Opening recurring edit modal');
            // ✅ 모달만 열고 로딩은 해제 (실제 작업은 모달에서 처리)
            setUIState((prev: EventUIState) => ({ 
              ...prev, 
              showRecurringEditModal: true, 
              isLoading: false  // 모달이 열리면 로딩 해제
            }));
            return; // 여기서 리턴하여 이후 코드 실행 방지
          }
        } else {
          console.log('🔄 Updating regular event');
          await updateExistingEvent();
          finishSave();
        }
      } else {
        if (formData.isRecurring) {
          console.log('🔄 Saving recurring event');
          await saveRecurringEvent();
        } else {
          console.log('🔄 Saving single event');
          await saveSingleEvent();
        }
        finishSave();
      }

      console.log('✅ Save operation completed');
      
    } catch (error) {
      console.error('❌ Error saving event:', error);
      Alert.alert('오류', '일정을 저장하는 중 오류가 발생했습니다.');
      setUIState((prev: EventUIState) => ({ ...prev, isLoading: false }));
    }
  };

  // 초기화
  useEffect(() => {
    loadInitialData(event);
  }, []);

  // ✅ 이벤트 데이터가 변경될 때 예외 상태 업데이트
  useEffect(() => {
    if (event && Boolean(event.is_recurring)) {
      const hasExceptionId = !!(event as any).exception_id;
      console.log('🔍 Event exception check:', {
        eventId: event.id,
        hasExceptionId,
        selectedDate
      });
      
      setUIState((prev: EventUIState) => ({
        ...prev,
        isEditingException: hasExceptionId
      }));
      
      if (hasExceptionId) {
        loadExceptionData(event.id).then(exception => {
          if (exception) {
            console.log('✅ Exception data loaded from effect:', exception.id);
          }
        }).catch(error => {
          console.error('❌ Error loading exception from effect:', error);
        });
      }
    }
  }, [event, selectedDate, loadExceptionData]);

  return {
    // 상태
    formData,
    uiState,
    options,
    schedule,
    academies,
    isEditMode,
    currentException,
    
    // 액션
    updateFormData,
    updateUIState,
    handleSave,
    handleDelete,
    handleRecurringEditConfirm,
    handleRecurringDeleteConfirm,
    handleAcademySelect,
    handleStartTimeConfirm,
    handleEndTimeConfirm,
    handleCategoryChange,
    toggleDay,
  };
};