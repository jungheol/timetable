import { useCallback } from 'react';
import { Alert } from 'react-native';
import moment from 'moment';
import DatabaseService, { Event, Academy, RecurringException } from '../services/DatabaseService';
import { EventFormData, EventUIState, RecurringEditType, RecurringDeleteType } from '../types/eventTypes';
import { determineEventTitle, logFormState } from '../utils/eventUtils';
import { useAcademyNotifications } from './useAcademyNotifications';

interface UseEventSaveLogicProps {
  scheduleId: number;
  selectedDate: string;
  event?: Event | null;
  formData: EventFormData;
  currentException: RecurringException | null;
  isEditingException: boolean;
  onSave: () => void;
  navigation: any;
  setUIState: React.Dispatch<React.SetStateAction<EventUIState>>;
}

export const useEventSaveLogic = ({
  scheduleId,
  selectedDate,
  event,
  formData,
  currentException,
  isEditingException,
  onSave,
  navigation,
  setUIState,
}: UseEventSaveLogicProps) => {

  const {
    handleAcademyCreated,
    handleAcademyUpdated,
    handleAcademyDeleted,
  } = useAcademyNotifications();

  // ✅ 저장 완료 후 화면 닫기
  const finishSave = useCallback(() => {
    console.log('✅ Save completed, calling onSave and navigating back');
    onSave();
    navigation.goBack();
  }, [onSave, navigation]);

  // ✅ 폼 상태 보존
  const preserveFormData = useCallback(() => {
    logFormState(formData, 'FORM STATE BEFORE SAVE');
    return { ...formData };
  }, [formData]);

  // ✅ 기존 예외 수정
  const updateExistingException = useCallback(async () => {
    if (!currentException || !event?.id) {
      console.log('❌ No current exception or event found');
      return;
    }

    const preservedFormData = { ...formData };
    console.log('🔄 Updating existing exception with current form data');

    const eventTitle = determineEventTitle(preservedFormData.category, preservedFormData.title, preservedFormData.academyName);
    let academyId: number | undefined = preservedFormData.selectedAcademy?.id;
    
    if (preservedFormData.category === '학원' && preservedFormData.academyName.trim()) {
      try {
        academyId = await DatabaseService.createAcademyForRecurringEvent(
          preservedFormData.academyName.trim(),
          preservedFormData.selectedSubject,
          scheduleId
        );
      } catch (error) {
        console.error('❌ Error creating academy:', error);
        Alert.alert('오류', '학원 정보 저장 중 오류가 발생했습니다.');
        return;
      }
    }

    const updatedException: RecurringException = {
      ...currentException,
      exception_type: 'modify',
      modified_title: eventTitle?.trim() || undefined,
      modified_start_time: preservedFormData.startTime || undefined,
      modified_end_time: preservedFormData.endTime || undefined,
      modified_category: preservedFormData.category || undefined,
      modified_academy_id: academyId || undefined,
    };

    try {
      await DatabaseService.updateRecurringException(updatedException);
      console.log('✅ Exception updated successfully');
    } catch (error) {
      console.error('❌ Error updating exception:', error);
      throw error;
    }
  }, [currentException, event, formData, scheduleId]);

  // ✅ 예외로 저장 - 개선된 에러 처리
  const saveAsException = useCallback(async (preservedFormData: EventFormData) => {
    if (!event?.id || !selectedDate) {
      console.error('❌ Missing event ID or selected date for exception');
      throw new Error('이벤트 정보가 부족합니다.');
    }

    console.log('🔄 Saving as exception with preserved data:', {
      eventId: event.id,
      selectedDate,
      category: preservedFormData.category,
      title: preservedFormData.title,
      academyName: preservedFormData.academyName
    });

    const eventTitle = determineEventTitle(preservedFormData.category, preservedFormData.title, preservedFormData.academyName);
    console.log('📝 Determined event title:', eventTitle);
    
    // ✅ 제목 검증 강화
    if (!eventTitle || !eventTitle.trim()) {
      console.error('❌ Empty event title after determination');
      throw new Error(preservedFormData.category === '학원' ? '학원명을 입력해주세요.' : '제목을 입력해주세요.');
    }

    let academyId: number | undefined = preservedFormData.selectedAcademy?.id;
    
    // ✅ 학원 카테고리 처리 개선
    if (preservedFormData.category === '학원') {
      const academyNameForCreation = preservedFormData.academyName.trim();
      
      if (!academyNameForCreation) {
        console.error('❌ Empty academy name for academy category');
        throw new Error('학원명을 입력해주세요.');
      }
      
      try {
        console.log('🔄 Creating/finding academy for exception:', academyNameForCreation);
        academyId = await DatabaseService.createAcademyForRecurringEvent(
          academyNameForCreation,
          preservedFormData.selectedSubject,
          scheduleId
        );
        console.log('✅ Academy ID for exception:', academyId);
      } catch (academyError) {
        console.error('❌ Error creating academy for exception:', academyError);
        throw new Error('학원 정보 저장 중 오류가 발생했습니다.');
      }
    }

    const exceptionData = {
      recurring_event_id: event.id,
      exception_date: selectedDate,
      exception_type: 'modify' as const,
      modified_title: eventTitle.trim(),
      modified_start_time: preservedFormData.startTime,
      modified_end_time: preservedFormData.endTime,
      modified_category: preservedFormData.category,
      modified_academy_id: academyId,
      del_yn: false,
    };

    console.log('📝 Exception data to save:', exceptionData);

    try {
      const exceptionId = await DatabaseService.createRecurringException(exceptionData);
      console.log('✅ Exception created with ID:', exceptionId);
    } catch (dbError) {
      console.error('❌ Database error saving exception:', dbError);
      throw new Error('예외 일정 저장 중 데이터베이스 오류가 발생했습니다.');
    }
  }, [event, selectedDate, scheduleId]);

  // ✅ 전체 반복 시리즈 업데이트 - 개선된 에러 처리
  const updateEntireRecurringSeries = useCallback(async (preservedFormData: EventFormData) => {
    if (!event?.id) {
      console.error('❌ Missing event ID for recurring series update');
      throw new Error('이벤트 정보가 부족합니다.');
    }

    console.log('🔄 Updating entire recurring series:', event.id);

    const eventTitle = determineEventTitle(preservedFormData.category, preservedFormData.title, preservedFormData.academyName);
    console.log('📝 Determined event title for series:', eventTitle);
    
    // ✅ 제목 검증
    if (!eventTitle || !eventTitle.trim()) {
      console.error('❌ Empty event title for series update');
      throw new Error(preservedFormData.category === '학원' ? '학원명을 입력해주세요.' : '제목을 입력해주세요.');
    }

    let academyId: number | undefined = preservedFormData.selectedAcademy?.id;
    
    // ✅ 학원 카테고리 처리
    if (preservedFormData.category === '학원') {
      const academyNameForCreation = preservedFormData.academyName.trim();
      
      if (!academyNameForCreation) {
        console.error('❌ Empty academy name for series update');
        throw new Error('학원명을 입력해주세요.');
      }
      
      try {
        console.log('🔄 Creating/finding academy for series:', academyNameForCreation);
        academyId = await DatabaseService.createAcademyForRecurringEvent(
          academyNameForCreation,
          preservedFormData.selectedSubject,
          scheduleId
        );
        console.log('✅ Academy ID for series:', academyId);
      } catch (academyError) {
        console.error('❌ Error creating academy for series:', academyError);
        throw new Error('학원 정보 저장 중 오류가 발생했습니다.');
      }
    }

    // ✅ 필수 필드 검증
    if (!preservedFormData.startTime || !preservedFormData.endTime) {
      console.error('❌ Missing time information for series update');
      throw new Error('시작 시간과 종료 시간을 설정해주세요.');
    }

    const updatedEvent: Event = {
      ...event,
      title: eventTitle.trim(),
      start_time: preservedFormData.startTime,
      end_time: preservedFormData.endTime,
      category: preservedFormData.category,
      academy_id: academyId,
      // ✅ event_date는 반복 일정에서는 undefined여야 함
      event_date: undefined,
    };

    console.log('📝 Updated event data for series:', updatedEvent);

    try {
      await DatabaseService.updateEvent(updatedEvent);
      console.log('✅ Recurring series updated successfully');
    } catch (dbError) {
      console.error('❌ Database error updating series:', dbError);
      throw new Error('반복 일정 업데이트 중 데이터베이스 오류가 발생했습니다.');
    }
  }, [event, scheduleId]);

  // ✅ 기존 이벤트 업데이트
  const updateExistingEvent = useCallback(async () => {
    if (!event?.id) return;

    console.log('🔄 Updating existing event:', event.id);

    const eventTitle = determineEventTitle(formData.category, formData.title, formData.academyName);
    let academyId: number | undefined = formData.selectedAcademy?.id;
    
    if (formData.category === '학원' && formData.academyName.trim()) {
      academyId = await DatabaseService.createAcademyForRecurringEvent(
        formData.academyName.trim(),
        formData.selectedSubject,
        scheduleId
      );
    }

    const updatedEvent: Event = {
      ...event,
      title: eventTitle.trim(),
      start_time: formData.startTime,
      end_time: formData.endTime,
      category: formData.category,
      academy_id: academyId,
      event_date: selectedDate,
    };

    await DatabaseService.updateEvent(updatedEvent);
    console.log('✅ Event updated successfully');
  }, [event, formData, scheduleId, selectedDate]);

  // ✅ 단일 이벤트 저장
  const saveSingleEvent = useCallback(async () => {
    console.log('🔄 Saving single event');
    
    const eventTitle = determineEventTitle(formData.category, formData.title, formData.academyName);
    const selectedDaysArray = Array.from(formData.selectedDays);
    
    let academyId: number | undefined;
    
    if (formData.category === '학원' && formData.academyName.trim()) {
      academyId = await DatabaseService.createAcademyForRecurringEvent(
        formData.academyName.trim(),
        formData.selectedSubject,
        scheduleId
      );
    }
    
    const eventData = {
      schedule_id: scheduleId,
      title: eventTitle.trim(),
      start_time: formData.startTime,
      end_time: formData.endTime,
      category: formData.category,
      academy_id: academyId,
      is_recurring: false,
    };

    if (selectedDaysArray.length === 1) {
      await DatabaseService.createEvent({
        ...eventData,
        event_date: selectedDate,
      });
    } else {
      await DatabaseService.createMultiDayEvents(
        eventData,
        selectedDaysArray,
        selectedDate
      );
    }
    
    console.log('✅ Single event saved successfully');
  }, [formData, scheduleId, selectedDate]);

  // ✅ 반복 이벤트 저장
  const saveRecurringEvent = useCallback(async () => {
    console.log('🔄 Saving recurring event');
    
    const patternData = {
      monday: formData.selectedDays.has('monday'),
      tuesday: formData.selectedDays.has('tuesday'),
      wednesday: formData.selectedDays.has('wednesday'),
      thursday: formData.selectedDays.has('thursday'),
      friday: formData.selectedDays.has('friday'),
      saturday: formData.selectedDays.has('saturday'),
      sunday: formData.selectedDays.has('sunday'),
      start_date: selectedDate,
      end_date: undefined,
    };

    const recurringPatternId = await DatabaseService.createRecurringPattern(patternData);
    console.log('✅ Recurring pattern created:', recurringPatternId);
    
    const eventTitle = determineEventTitle(formData.category, formData.title, formData.academyName);
    let academyId: number | undefined;
    
    if (formData.category === '학원' && formData.academyName.trim()) {
      academyId = await DatabaseService.createAcademyForRecurringEvent(
        formData.academyName.trim(),
        formData.selectedSubject,
        scheduleId
      );
    }
    
    const eventData = {
      schedule_id: scheduleId,
      title: eventTitle.trim(),
      start_time: formData.startTime,
      end_time: formData.endTime,
      event_date: undefined,
      category: formData.category,
      academy_id: academyId,
      is_recurring: true,
      recurring_group_id: recurringPatternId,
    };
    
    await DatabaseService.createEvent(eventData);
    console.log('✅ Recurring event saved successfully');
  }, [formData, selectedDate, scheduleId]);

  // ✅ 개선된 반복 일정 편집 확인 - 더 자세한 에러 로깅
  const handleRecurringEditConfirm = useCallback(async (editType: RecurringEditType) => {
    console.log('🔄 Recurring edit confirm:', editType);
    console.log('📝 Current form data at confirm:', {
      category: formData.category,
      title: formData.title,
      academyName: formData.academyName,
      startTime: formData.startTime,
      endTime: formData.endTime
    });
    
    // ✅ 1. 즉시 모달 닫기 및 로딩 시작
    setUIState((prev: EventUIState) => ({ 
      ...prev, 
      showRecurringEditModal: false,
      isLoading: true 
    }));
    
    // ✅ 2. 폼 데이터 보존
    const currentFormData = preserveFormData();
    
    try {
      if (editType === 'this_only') {
        console.log('🔄 Saving as exception');
        await saveAsException(currentFormData);
      } else {
        console.log('🔄 Updating entire series');
        await updateEntireRecurringSeries(currentFormData);
      }

      console.log('✅ Recurring edit completed');
      
      // ✅ 3. 저장 완료 후 화면 닫기
      finishSave();
      
    } catch (error) {
      console.error('❌ Error in recurring edit:', error);
      const errorMessage = error instanceof Error ? error.message : '반복 일정 수정 중 오류가 발생했습니다.';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('❌ Error details:', {
        message: errorMessage,
        stack: errorStack,
        editType,
        eventId: event?.id,
        selectedDate,
        formData: currentFormData,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name
      });
      
      // 사용자에게 더 구체적인 에러 메시지 표시
      Alert.alert('오류', errorMessage);
      
      // ✅ 4. 에러 시 로딩만 해제 (모달은 이미 닫힘)
      setUIState((prev: EventUIState) => ({ ...prev, isLoading: false }));
    }
  }, [preserveFormData, saveAsException, updateEntireRecurringSeries, finishSave, setUIState, formData, event, selectedDate]);

  // ✅ 개선된 반복 일정 삭제 확인 - 모달 즉시 닫기
  const handleRecurringDeleteConfirm = useCallback(async (deleteType: RecurringDeleteType) => {
    console.log('🔄 Recurring delete confirm:', deleteType);
    
    // ✅ 1. 즉시 모달 닫기 및 로딩 시작
    setUIState((prev: EventUIState) => ({ 
      ...prev, 
      showRecurringDeleteModal: false,
      isLoading: true 
    }));
    
    try {
      if (deleteType === 'this_only') {
        if (!event?.id || !selectedDate) return;
        
        console.log('🔄 Creating cancel exception');
        await DatabaseService.createRecurringException({
          recurring_event_id: event.id,
          exception_date: selectedDate,
          exception_type: 'cancel',
          del_yn: false,
        });
        
      } else if (deleteType === 'all_future') {
        console.log('🔄 Deleting entire recurring event');
        if (event?.id) {
          await DatabaseService.deleteRecurringEvent(event.id);
        }
        
      } else if (deleteType === 'restore') {
        console.log('🔄 Restoring by removing exception');
        
        let exceptionToDelete = currentException;
        
        if (!exceptionToDelete && event?.id && selectedDate) {
          const exceptions = await DatabaseService.getRecurringExceptions(
            event.id, 
            selectedDate, 
            selectedDate
          );
          
          if (exceptions.length > 0) {
            exceptionToDelete = exceptions[0];
          }
        }
        
        if (exceptionToDelete) {
          await DatabaseService.deleteRecurringException(exceptionToDelete.id);
          console.log('✅ Exception removed, recurring event restored');
        } else {
          Alert.alert('알림', '복원할 예외가 없습니다.');
          setUIState((prev: EventUIState) => ({ ...prev, isLoading: false }));
          return;
        }
      }

      console.log('✅ Recurring delete completed');
      
      // ✅ 2. 작업 완료 후 화면 닫기
      finishSave();
      
    } catch (error) {
      console.error('❌ Error in recurring delete:', error);
      Alert.alert('오류', '반복 일정 삭제 중 오류가 발생했습니다.');
      
      // ✅ 3. 에러 시 로딩만 해제 (모달은 이미 닫힘)
      setUIState((prev: EventUIState) => ({ ...prev, isLoading: false }));
    }
  }, [event, selectedDate, currentException, finishSave, setUIState]);

  return {
    finishSave,
    preserveFormData,
    updateExistingException,
    saveAsException,
    updateEntireRecurringSeries,
    updateExistingEvent,
    saveSingleEvent,
    saveRecurringEvent,
    handleRecurringEditConfirm,
    handleRecurringDeleteConfirm,
  };
};