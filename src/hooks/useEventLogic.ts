import { useState, useEffect, useCallback, useMemo } from 'react';
import moment from 'moment';
import { Alert } from 'react-native';
import DatabaseService, { Event, Academy, Schedule } from '../services/DatabaseService';
import { useAcademyNotifications } from './useAcademyNotifications';

// 타입 정의
export interface EventFormData {
  title: string;
  startTime: string;
  endTime: string;
  selectedDays: Set<string>;
  category: Event['category'];
  academyName: string;
  selectedSubject: Academy['subject'];
  isRecurring: boolean;
  memo: string;
  selectedAcademy: Academy | null;
}

export interface EventUIState {
  showStartTimePicker: boolean;
  showEndTimePicker: boolean;
  showCategoryPicker: boolean;
  showSubjectPicker: boolean;
  showAcademyPicker: boolean;
  showRecurringEditModal: boolean;
  showRecurringDeleteModal: boolean;
  isLoading: boolean;
  isEditingException: boolean;
}

export interface EventOptions {
  weekdays: DayButton[];
  availableDays: DayButton[];
  timeOptions: string[];
  categoryOptions: string[];
  subjectOptions: Academy['subject'][];
  academyOptions: { value: string; label: string }[];
}

export interface DayButton {
  key: string;
  label: string;
  index: number;
}

interface EventScreenParams {
  event?: Event | null;
  selectedDate: string;
  selectedTime?: string;
  scheduleId: number;
  onSave: () => void;
}

// 초기 상태 정의
const createInitialFormData = (): EventFormData => ({
  title: '',
  startTime: '',
  endTime: '',
  selectedDays: new Set<string>(),
  category: '선택안함' as Event['category'],
  academyName: '',
  selectedSubject: '국어' as Academy['subject'],
  isRecurring: false,
  memo: '',
  selectedAcademy: null,
});

const createInitialUIState = (): EventUIState => ({
  showStartTimePicker: false,
  showEndTimePicker: false,
  showCategoryPicker: false,
  showSubjectPicker: false,
  showAcademyPicker: false,
  showRecurringEditModal: false,
  showRecurringDeleteModal: false,
  isLoading: false,
  isEditingException: false,
});

// 메인 훅
export const useEventLogic = (
  params: EventScreenParams,
  // ✅ navigation을 파라미터로 받아옴
  navigation: any
) => {
  const { event, selectedDate, selectedTime, scheduleId, onSave } = params;
  
  // 🔔 알림 훅
  const {
    handleAcademyCreated,
    handleAcademyUpdated,
    handleAcademyDeleted,
  } = useAcademyNotifications();

  // 상태 관리
  const [formData, setFormData] = useState<EventFormData>(createInitialFormData);
  const [uiState, setUIState] = useState<EventUIState>(createInitialUIState);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [academies, setAcademies] = useState<Academy[]>([]);

  // 편집 모드 체크
  const isEditMode = !!event;

  // 옵션 생성
  const options = useMemo<EventOptions>(() => {
    const weekdays: DayButton[] = [
      { key: 'monday', label: '월', index: 1 },
      { key: 'tuesday', label: '화', index: 2 },
      { key: 'wednesday', label: '수', index: 3 },
      { key: 'thursday', label: '목', index: 4 },
      { key: 'friday', label: '금', index: 5 },
      { key: 'saturday', label: '토', index: 6 },
      { key: 'sunday', label: '일', index: 0 },
    ];

    // ✅ Boolean 타입 안전 확인
    const availableDays = Boolean(schedule?.show_weekend)
      ? weekdays 
      : weekdays.slice(0, 5);

    const timeOptions: string[] = [];
    if (schedule) {
      const startMoment = moment(schedule.start_time, 'HH:mm');
      const endMoment = moment(schedule.end_time, 'HH:mm');
      const interval = schedule.time_unit === '30min' ? 30 : 60;
      
      let current = startMoment.clone();
      while (current.isSameOrBefore(endMoment)) {
        timeOptions.push(current.format('HH:mm'));
        current.add(interval, 'minutes');
      }
    }

    const academyOptions = academies.map(academy => ({
      value: academy.id.toString(),
      label: `${academy.name} (${academy.subject})`
    }));

    return {
      weekdays,
      availableDays,
      timeOptions,
      categoryOptions: ['학교/기관', '학원', '공부', '휴식', '선택안함'],
      subjectOptions: ['국어', '수학', '영어', '예체능', '사회과학', '기타'],
      academyOptions,
    };
  }, [schedule, academies]);

  // 데이터 타입 변환 헬퍼
  const sanitizeEventData = useCallback((eventData: any): Event => ({
    ...eventData,
    is_recurring: Boolean(eventData.is_recurring),
    del_yn: Boolean(eventData.del_yn),
  }), []);

  // 초기 데이터 로드
  const loadInitialData = useCallback(async () => {
    try {
      const [activeSchedule, academyList] = await Promise.all([
        DatabaseService.getActiveSchedule(),
        DatabaseService.getAcademiesBySchedule(scheduleId)
      ]);
      
      setSchedule(activeSchedule);
      setAcademies(academyList);
      
      if (event) {
        await loadEventData(event, academyList);
      } else {
        initializeNewEventForm();
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }, [event, scheduleId]);

  // 이벤트 데이터 로드 (편집 모드)
  const loadEventData = useCallback(async (eventData: Event, academyList: Academy[]) => {
    try {
      const sanitizedEvent = sanitizeEventData(eventData);
      
      // 기본 정보 설정
      setFormData(prev => ({
        ...prev,
        title: sanitizedEvent.title,
        startTime: sanitizedEvent.start_time,
        endTime: sanitizedEvent.end_time,
        category: sanitizedEvent.category,
        isRecurring: sanitizedEvent.is_recurring,
      }));

      // 예외 편집 모드 확인
      setUIState(prev => ({
        ...prev,
        isEditingException: Boolean((sanitizedEvent as any).exception_id),
      }));

      // 요일 정보 설정
      await loadDaySelection(sanitizedEvent);
      
      // 학원 정보 설정
      if (sanitizedEvent.category === '학원' && sanitizedEvent.academy_id) {
        loadAcademyInfo(sanitizedEvent.academy_id, academyList);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
      Alert.alert('오류', '일정 정보를 불러오는 중 오류가 발생했습니다.');
    }
  }, [sanitizeEventData]);

  // 요일 선택 로드
  const loadDaySelection = useCallback(async (sanitizedEvent: Event) => {
    const currentDayIndex = moment(selectedDate).day();
    const currentDayKey = options.weekdays.find(day => day.index === currentDayIndex)?.key;
    
    if (sanitizedEvent.is_recurring && sanitizedEvent.recurring_group_id) {
      try {
        const recurringPattern = await DatabaseService.getRecurringPattern(sanitizedEvent.recurring_group_id);
        if (recurringPattern) {
          const selectedDaysSet = new Set<string>();
          if (Boolean(recurringPattern.monday)) selectedDaysSet.add('monday');
          if (Boolean(recurringPattern.tuesday)) selectedDaysSet.add('tuesday');
          if (Boolean(recurringPattern.wednesday)) selectedDaysSet.add('wednesday');
          if (Boolean(recurringPattern.thursday)) selectedDaysSet.add('thursday');
          if (Boolean(recurringPattern.friday)) selectedDaysSet.add('friday');
          if (Boolean(recurringPattern.saturday)) selectedDaysSet.add('saturday');
          if (Boolean(recurringPattern.sunday)) selectedDaysSet.add('sunday');
          
          setFormData(prev => ({ ...prev, selectedDays: selectedDaysSet }));
          return;
        }
      } catch (error) {
        console.error('Error loading recurring pattern:', error);
      }
    }
    
    // 기본값: 현재 요일
    if (currentDayKey) {
      setFormData(prev => ({ ...prev, selectedDays: new Set([currentDayKey]) }));
    }
  }, [selectedDate, options.weekdays]);

  // 학원 정보 로드
  const loadAcademyInfo = useCallback((academyId: number, academyList: Academy[]) => {
    const academy = academyList.find(a => a.id === academyId);
    if (academy) {
      setFormData(prev => ({
        ...prev,
        selectedAcademy: academy,
        academyName: academy.name,
        selectedSubject: academy.subject,
      }));
    }
  }, []);

  // 새 이벤트 폼 초기화
  const initializeNewEventForm = useCallback(() => {
    const currentDayIndex = moment(selectedDate).day();
    const currentDayKey = options.weekdays.find(day => day.index === currentDayIndex)?.key;
    
    setFormData(prev => ({
      ...prev,
      selectedDays: currentDayKey ? new Set([currentDayKey]) : new Set(),
    }));
    
    if (selectedTime && schedule) {
      const start = moment(selectedTime, 'HH:mm');
      const interval = schedule.time_unit === '30min' ? 30 : 60;
      const endTime = start.add(interval, 'minutes').format('HH:mm');
      
      setFormData(prev => ({
        ...prev,
        startTime: selectedTime,
        endTime: endTime,
      }));
    }
  }, [selectedDate, selectedTime, schedule, options.weekdays]);

  // 폼 데이터 업데이트
  const updateFormData = useCallback((updates: Partial<EventFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // UI 상태 업데이트
  const updateUIState = useCallback((updates: Partial<EventUIState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  }, []);

  // 유효성 검사
  const validateForm = useCallback((): boolean => {
    if (formData.selectedDays.size === 0) {
      Alert.alert('오류', '최소 하나의 요일을 선택해주세요.');
      return false;
    }

    if (!formData.startTime || !formData.endTime) {
      Alert.alert('오류', '시작 시간과 종료 시간을 설정해주세요.');
      return false;
    }

    if (moment(formData.startTime, 'HH:mm').isSameOrAfter(moment(formData.endTime, 'HH:mm'))) {
      Alert.alert('오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return false;
    }

    const eventTitle = formData.category === '학원' ? formData.academyName : formData.title;
    if (!eventTitle.trim()) {
      Alert.alert('오류', formData.category === '학원' ? '학원명을 입력해주세요.' : '제목을 입력해주세요.');
      return false;
    }

    return true;
  }, [formData]);

  // ✅ 저장 완료 후 화면 닫기 헬퍼
  const finishSave = useCallback(() => {
    console.log('✅ Save completed, calling onSave and navigating back');
    onSave();
    navigation.goBack();
  }, [onSave, navigation]);

  // ✅ 저장 처리 - 수정된 버전
  const handleSave = useCallback(async () => {
    console.log('🔄 handleSave called');
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    setUIState(prev => ({ ...prev, isLoading: true }));

    try {
      if (isEditMode) {
        const sanitizedEvent = event ? sanitizeEventData(event) : null;
        
        if (sanitizedEvent?.is_recurring && !uiState.isEditingException) {
          console.log('🔄 Opening recurring edit modal');
          setUIState(prev => ({ 
            ...prev, 
            showRecurringEditModal: true, 
            isLoading: false // ✅ 모달 표시 시 로딩 해제
          }));
          return;
        } else {
          console.log('🔄 Updating existing event');
          await updateExistingEvent();
        }
      } else {
        if (formData.isRecurring) {
          console.log('🔄 Saving recurring event');
          await saveRecurringEvent();
        } else {
          console.log('🔄 Saving single event');
          await saveSingleEvent();
        }
      }

      console.log('✅ Save operation completed');
      finishSave(); // ✅ 저장 완료 후 화면 닫기
      
    } catch (error) {
      console.error('❌ Error saving event:', error);
      Alert.alert('오류', '일정을 저장하는 중 오류가 발생했습니다.');
    } finally {
      setUIState(prev => ({ ...prev, isLoading: false }));
    }
  }, [validateForm, isEditMode, event, uiState.isEditingException, formData, finishSave, sanitizeEventData]);

  // ✅ 반복 일정 편집 확인 처리
  const handleRecurringEditConfirm = useCallback(async (editType: 'this_only' | 'all_future') => {
    console.log('🔄 Recurring edit confirm:', editType);
    
    setUIState(prev => ({ 
      ...prev, 
      showRecurringEditModal: false,
      isLoading: true 
    }));

    try {
      if (editType === 'this_only') {
        console.log('🔄 Saving as exception');
        await saveAsException();
      } else {
        console.log('🔄 Updating entire recurring series');
        await updateEntireRecurringSeries();
      }

      console.log('✅ Recurring edit completed');
      finishSave(); // ✅ 저장 완료 후 화면 닫기
      
    } catch (error) {
      console.error('❌ Error in recurring edit:', error);
      Alert.alert('오류', '반복 일정 수정 중 오류가 발생했습니다.');
    } finally {
      setUIState(prev => ({ ...prev, isLoading: false }));
    }
  }, [finishSave]);

  // ✅ 반복 일정 삭제 확인 처리
  const handleRecurringDeleteConfirm = useCallback(async (deleteType: 'this_only' | 'all_future' | 'restore') => {
    console.log('🔄 Recurring delete confirm:', deleteType);
    
    setUIState(prev => ({ 
      ...prev, 
      showRecurringDeleteModal: false,
      isLoading: true 
    }));

    try {
      if (deleteType === 'this_only') {
        console.log('this_only delete - Feature not implemented yet');
        // TODO: DatabaseService에 예외 처리 메서드들을 추가해야 함
      } else if (deleteType === 'all_future') {
        console.log('🔄 Deleting entire recurring event');
        await DatabaseService.deleteRecurringEvent(event!.id!);
      } else if (deleteType === 'restore') {
        console.log('restore delete - Feature not implemented yet');
        // TODO: DatabaseService에 예외 처리 메서드들을 추가해야 함
      }

      console.log('✅ Recurring delete completed');
      finishSave(); // ✅ 삭제 완료 후 화면 닫기
      
    } catch (error) {
      console.error('❌ Error in recurring delete:', error);
      Alert.alert('오류', '반복 일정 삭제 중 오류가 발생했습니다.');
    } finally {
      setUIState(prev => ({ ...prev, isLoading: false }));
    }
  }, [event, finishSave]);

  // 🆕 예외로 저장 - TODO: DatabaseService 메서드 구현 필요
  const saveAsException = useCallback(async () => {
    console.log('saveAsException - Feature not implemented yet');
    // 현재는 전체 시리즈 업데이트로 대체
    await updateEntireRecurringSeries();
  }, []);

  // 🆕 전체 반복 시리즈 수정
  const updateEntireRecurringSeries = useCallback(async () => {
    await updateExistingEvent();
  }, []);

  // 기존 이벤트 업데이트
  const updateExistingEvent = useCallback(async () => {
    if (!event?.id) return;

    console.log('🔄 Updating existing event:', event.id);

    const eventTitle = formData.category === '학원' ? formData.academyName : formData.title;
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

  // 단일 이벤트 저장
  const saveSingleEvent = useCallback(async () => {
    console.log('🔄 Saving single event');
    
    const eventTitle = formData.category === '학원' ? formData.academyName : formData.title;
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

  // 반복 이벤트 저장
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
    
    const eventTitle = formData.category === '학원' ? formData.academyName : formData.title;
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

  // ✅ 삭제 처리 - 수정된 버전
  const handleDelete = useCallback(async () => {
    if (!event?.id) return;

    console.log('🔄 handleDelete called');

    const sanitizedEvent = sanitizeEventData(event);

    if (sanitizedEvent.is_recurring) {
      console.log('🔄 Opening recurring delete modal');
      setUIState(prev => ({ ...prev, showRecurringDeleteModal: true }));
    } else {
      Alert.alert(
        '일정 삭제',
        '이 일정을 삭제하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: deleteSingleEvent,
          },
        ]
      );
    }
  }, [event, sanitizeEventData]);

  // 단일 이벤트 삭제
  const deleteSingleEvent = useCallback(async () => {
    if (!event?.id) return;
    
    console.log('🔄 Deleting single event:', event.id);
    
    setUIState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // 🔔 학원 일정 삭제 시 알림 처리
      if (event.category === '학원' && event.academy_id) {
        try {
          const relatedEvents = await DatabaseService.getEvents(
            scheduleId, 
            moment().subtract(1, 'year').format('YYYY-MM-DD'),
            moment().add(1, 'year').format('YYYY-MM-DD')
          );
          
          const academyEvents = relatedEvents.filter(e => 
            e.academy_id === event.academy_id && e.id !== event.id
          );
          
          if (academyEvents.length === 0) {
            await handleAcademyDeleted(event.academy_id);
          }
        } catch (notificationError) {
          console.error('❌ Error handling academy notifications:', notificationError);
        }
      }

      await DatabaseService.deleteEvent(event.id);
      console.log('✅ Single event deleted successfully');
      
      finishSave(); // ✅ 삭제 완료 후 화면 닫기
      
    } catch (error) {
      console.error('❌ Error deleting event:', error);
      Alert.alert('오류', '일정을 삭제하는 중 오류가 발생했습니다.');
    } finally {
      setUIState(prev => ({ ...prev, isLoading: false }));
    }
  }, [event, scheduleId, handleAcademyDeleted, finishSave]);

  // ✅ 학원 선택 핸들러 추가
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
  }, [academies]);

  // ✅ 시간 선택 핸들러들 추가
  const handleStartTimeConfirm = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, startTime: value }));
    
    // 종료 시간 자동 조정
    if (schedule) {
      const start = moment(value, 'HH:mm');
      const interval = schedule.time_unit === '30min' ? 30 : 60;
      const newEndTime = start.add(interval, 'minutes').format('HH:mm');
      if (options.timeOptions.includes(newEndTime)) {
        setFormData(prev => ({ ...prev, endTime: newEndTime }));
      }
    }
  }, [schedule, options.timeOptions]);

  const handleEndTimeConfirm = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, endTime: value }));
  }, []);

  // 초기화
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 예외 편집 모드 설정
  useEffect(() => {
    if (event && Boolean(event.is_recurring)) {
      setUIState(prev => ({
        ...prev,
        isEditingException: !!(event as any).exception_id
      }));
    }
  }, [event]);

  return {
    // 상태
    formData,
    uiState,
    options,
    schedule,
    academies,
    isEditMode,
    
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
    
    // 헬퍼
    sanitizeEventData,
  };
};