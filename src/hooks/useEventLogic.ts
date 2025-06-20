// 📁 hooks/useEventLogic.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import moment from 'moment';
import { Alert } from 'react-native';
import DatabaseService, { Event, Academy, Schedule, RecurringException } from '../services/DatabaseService';
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

// ✅ 시간 계산 헬퍼 함수
const calculateEndTime = (startTime: string, schedule: Schedule | null): string => {
  if (!schedule || !startTime) return '';
  
  const start = moment(startTime, 'HH:mm');
  const interval = schedule.time_unit === '30min' ? 30 : 60;
  const endTime = start.clone().add(interval, 'minutes').format('HH:mm');
  
  return endTime;
};

const isValidTimeOption = (time: string, timeOptions: string[]): boolean => {
  return timeOptions.includes(time);
};

const findNextValidTime = (currentTime: string, timeOptions: string[]): string | null => {
  return timeOptions.find(time => 
    moment(time, 'HH:mm').isAfter(moment(currentTime, 'HH:mm'))
  ) || null;
};

// 메인 훅
export const useEventLogic = (
  params: EventScreenParams,
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
  
  // ✅ 현재 예외 정보 저장
  const [currentException, setCurrentException] = useState<RecurringException | null>(null);

  // 편집 모드 체크
  const isEditMode = !!event;

  // weekdays를 상수로 분리
  const weekdays: DayButton[] = useMemo(() => [
    { key: 'monday', label: '월', index: 1 },
    { key: 'tuesday', label: '화', index: 2 },
    { key: 'wednesday', label: '수', index: 3 },
    { key: 'thursday', label: '목', index: 4 },
    { key: 'friday', label: '금', index: 5 },
    { key: 'saturday', label: '토', index: 6 },
    { key: 'sunday', label: '일', index: 0 },
  ], []);

  // 옵션 생성
  const options = useMemo<EventOptions>(() => {
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
  }, [schedule, academies, weekdays]);

  // 데이터 타입 변환 헬퍼
  const sanitizeEventData = useCallback((eventData: any): Event => ({
    ...eventData,
    is_recurring: Boolean(eventData.is_recurring),
    del_yn: Boolean(eventData.del_yn),
  }), []);

  // ✅ 예외 데이터 로드 개선
  const loadExceptionData = useCallback(async (eventId: number): Promise<RecurringException | null> => {
    try {
        console.log('🔍 Looking for exceptions for event:', eventId, 'on date:', selectedDate);
        
        const exceptions = await DatabaseService.getRecurringExceptions(
        eventId,
        selectedDate,
        selectedDate
        );
        
        if (exceptions.length > 0) {
        const exception = exceptions[0];
        console.log('✅ Found exception:', {
            id: exception.id,
            type: exception.exception_type,
            date: exception.exception_date,
            hasModifications: !!(exception.modified_title || exception.modified_start_time || exception.modified_end_time)
        });
        setCurrentException(exception);
        return exception;
        }
        
        console.log('ℹ️ No exception found for this date');
        setCurrentException(null);
        return null;
    } catch (error) {
        console.error('❌ Error loading exception data:', error);
        setCurrentException(null);
        return null;
    }
    }, [selectedDate]);

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
        initializeNewEventForm(activeSchedule);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }, [event, scheduleId]);

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

  // ✅ 이벤트 데이터 로드 개선 - null 체크 추가
  const loadEventData = useCallback(async (eventData: Event, academyList: Academy[]) => {
    try {
        const sanitizedEvent = sanitizeEventData(eventData);
        console.log('📝 Loading event data:', {
        id: sanitizedEvent.id,
        title: sanitizedEvent.title,
        startTime: sanitizedEvent.start_time,
        endTime: sanitizedEvent.end_time,
        category: sanitizedEvent.category,
        isRecurring: sanitizedEvent.is_recurring,
        hasExceptionId: !!(eventData as any).exception_id,
        selectedDate
        });
        
        // ✅ 기본 폼 데이터를 먼저 설정 (예외와 상관없이)
        const baseFormData: Partial<EventFormData> = {
        title: sanitizedEvent.title,
        startTime: sanitizedEvent.start_time,
        endTime: sanitizedEvent.end_time,
        category: sanitizedEvent.category,
        isRecurring: sanitizedEvent.is_recurring,
        };
        
        console.log('📝 Setting base form data:', baseFormData);
        setFormData(prev => ({ ...prev, ...baseFormData }));
        
        // ✅ 예외 ID가 있는지 먼저 확인 (이벤트 객체에서)
        const hasExceptionId = !!(eventData as any).exception_id;
        let exception: RecurringException | null = null;
        
        // ✅ 반복 일정인 경우 예외 확인
        if (sanitizedEvent.is_recurring && selectedDate) {
        // 예외 ID가 있거나 DB에서 예외를 찾아봄
        if (hasExceptionId) {
            console.log('✅ Event has exception_id, treating as exception');
            setUIState(prev => ({ ...prev, isEditingException: true }));
            
            // 예외 데이터 로드
            exception = await loadExceptionData(sanitizedEvent.id);
        } else {
            // 예외 ID가 없어도 DB에서 확인
            exception = await loadExceptionData(sanitizedEvent.id);
            
            if (exception) {
            console.log('✅ Found exception in DB, setting exception mode');
            setUIState(prev => ({ ...prev, isEditingException: true }));
            }
        }
        
        // ✅ 예외가 있는 경우 예외 데이터로 폼 업데이트
        if (exception && exception.exception_type === 'modify') {
            console.log('✅ Loading exception data for date:', selectedDate);
            
            // 예외 데이터로 폼 업데이트 - 기본값 위에 덮어쓰기
            const exceptionFormUpdates: Partial<EventFormData> = {};
            
            if (exception.modified_title !== null && exception.modified_title !== undefined && exception.modified_title.trim() !== '') {
            exceptionFormUpdates.title = exception.modified_title;
            console.log(`📝 Using exception title: "${exception.modified_title}"`);
            } else {
            console.log(`📝 Using original title: "${sanitizedEvent.title}"`);
            }
            
            if (exception.modified_start_time !== null && exception.modified_start_time !== undefined && exception.modified_start_time.trim() !== '') {
            exceptionFormUpdates.startTime = exception.modified_start_time;
            console.log(`⏰ Using exception start time: "${exception.modified_start_time}"`);
            } else {
            console.log(`⏰ Using original start time: "${sanitizedEvent.start_time}"`);
            }
            
            if (exception.modified_end_time !== null && exception.modified_end_time !== undefined && exception.modified_end_time.trim() !== '') {
            exceptionFormUpdates.endTime = exception.modified_end_time;
            console.log(`⏰ Using exception end time: "${exception.modified_end_time}"`);
            } else {
            console.log(`⏰ Using original end time: "${sanitizedEvent.end_time}"`);
            }
            
            if (exception.modified_category !== null && exception.modified_category !== undefined && exception.modified_category.trim() !== '') {
            exceptionFormUpdates.category = exception.modified_category as Event['category'];
            console.log(`📂 Using exception category: "${exception.modified_category}"`);
            } else {
            console.log(`📂 Using original category: "${sanitizedEvent.category}"`);
            }
            
            // 예외 데이터 적용
            setFormData(prev => {
            const updatedData = { ...prev, ...exceptionFormUpdates };
            console.log('📝 Final form data after exception:', {
                title: updatedData.title,
                startTime: updatedData.startTime,
                endTime: updatedData.endTime,
                category: updatedData.category
            });
            return updatedData;
            });
            
            // 수정된 학원이 있는 경우
            if (exception.modified_academy_id !== null && exception.modified_academy_id !== undefined) {
            const modifiedAcademy = academyList.find(a => a.id === exception?.modified_academy_id);
            if (modifiedAcademy) {
                setFormData(prev => ({
                ...prev,
                selectedAcademy: modifiedAcademy,
                academyName: modifiedAcademy.name,
                selectedSubject: modifiedAcademy.subject,
                }));
                console.log(`🏫 Using exception academy: "${modifiedAcademy.name}"`);
            }
            } else if (sanitizedEvent.category === '학원' && sanitizedEvent.academy_id) {
            // 예외에서 학원이 수정되지 않은 경우 원본 학원 정보 사용
            loadAcademyInfo(sanitizedEvent.academy_id, academyList);
            }
            
            console.log('✅ Exception form data loaded');
            await loadDaySelection(sanitizedEvent);
            return;
        } else if (exception && exception.exception_type === 'cancel') {
            // 취소된 일정인 경우에 대한 처리
            console.log('ℹ️ This event is cancelled on this date');
            setUIState(prev => ({ ...prev, isEditingException: true }));
        }
        }
        
        // ✅ 예외가 없거나 일반 일정인 경우는 이미 기본 데이터가 설정됨
        if (!exception || exception.exception_type !== 'modify') {
        setUIState(prev => ({ ...prev, isEditingException: false }));
        
        console.log('📝 Using original event data (no exception)');

        // 요일 정보 설정
        await loadDaySelection(sanitizedEvent);
        
        // 학원 정보 설정
        if (sanitizedEvent.category === '학원' && sanitizedEvent.academy_id) {
            loadAcademyInfo(sanitizedEvent.academy_id, academyList);
        }
        }
        
        console.log('✅ Event data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading event data:', error);
        Alert.alert('오류', '일정 정보를 불러오는 중 오류가 발생했습니다.');
    }
    }, [sanitizeEventData, selectedDate, loadExceptionData, loadDaySelection, loadAcademyInfo]);

  // 새 이벤트 폼 초기화
  const initializeNewEventForm = useCallback((currentSchedule?: Schedule | null) => {
    const scheduleToUse = currentSchedule || schedule;
    
    const currentDayIndex = moment(selectedDate).day();
    const currentDayKey = weekdays.find(day => day.index === currentDayIndex)?.key;
    
    console.log('🆕 Initializing new event form with schedule:', scheduleToUse);
    
    const formUpdates: Partial<EventFormData> = {
        selectedDays: currentDayKey ? new Set([currentDayKey]) : new Set(),
        title: '', // 명시적으로 빈 문자열 설정
        category: '선택안함',
    };
    
    if (selectedTime && scheduleToUse) {
        const calculatedEndTime = calculateEndTime(selectedTime, scheduleToUse);
        formUpdates.startTime = selectedTime;
        formUpdates.endTime = calculatedEndTime;
        console.log(`⏰ Using selected time: ${selectedTime} ~ ${calculatedEndTime}`);
    } else if (scheduleToUse) {
        const defaultStart = scheduleToUse.start_time;
        const calculatedEndTime = calculateEndTime(defaultStart, scheduleToUse);
        formUpdates.startTime = defaultStart;
        formUpdates.endTime = calculatedEndTime;
        console.log(`⏰ Using default time: ${defaultStart} ~ ${calculatedEndTime}`);
    }
    
    console.log('🆕 New event form updates:', formUpdates);
    setFormData(prev => ({ ...prev, ...formUpdates }));
    }, [selectedDate, selectedTime, schedule, weekdays]);

  // 폼 데이터 업데이트
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
    }, []);

  // UI 상태 업데이트
  const updateUIState = useCallback((updates: Partial<EventUIState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  }, []);

  // 유효성 검사
  const validateForm = useCallback((): boolean => {
    console.log('🔍 Validating form data:', {
        selectedDays: Array.from(formData.selectedDays),
        startTime: formData.startTime,
        endTime: formData.endTime,
        title: formData.title,
        academyName: formData.academyName,
        category: formData.category
    });

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
    console.log('🔍 Determined event title for validation:', eventTitle);
    
    if (!eventTitle || !eventTitle.trim()) {
        Alert.alert('오류', formData.category === '학원' ? '학원명을 입력해주세요.' : '제목을 입력해주세요.');
        return false;
    }

    console.log('✅ Form validation passed');
    return true;
    }, [formData]);

  // 저장 완료 후 화면 닫기
  const finishSave = useCallback(() => {
    console.log('✅ Save completed, calling onSave and navigating back');
    onSave();
    navigation.goBack();
  }, [onSave, navigation]);

  // ✅ 폼 상태 보존을 위한 디버깅 함수
    const debugFormStateBeforeSave = useCallback(() => {
    console.log('🔍 === FORM STATE BEFORE SAVE ===');
    console.log('Title:', `"${formData.title}"`);
    console.log('Start Time:', `"${formData.startTime}"`);
    console.log('End Time:', `"${formData.endTime}"`);
    console.log('Category:', `"${formData.category}"`);
    console.log('Academy Name:', `"${formData.academyName}"`);
    console.log('Is Recurring:', formData.isRecurring);
    console.log('Selected Days:', Array.from(formData.selectedDays));
    console.log('Is Editing Exception:', uiState.isEditingException);
    console.log('=== END FORM STATE BEFORE SAVE ===');
    
    return { ...formData }; // 복사본 반환
    }, [formData, uiState.isEditingException]);

  
    // ✅ 디버깅을 위한 현재 폼 상태 체크 함수
    const debugFormState = useCallback(() => {
    console.log('🔍 Current form state debug:', {
        title: formData.title,
        startTime: formData.startTime,
        endTime: formData.endTime,
        category: formData.category,
        academyName: formData.academyName,
        selectedAcademy: formData.selectedAcademy?.name,
        isRecurring: formData.isRecurring,
        selectedDaysCount: formData.selectedDays.size,
        isEditingException: uiState.isEditingException,
        currentExceptionId: currentException?.id
    });
    }, [formData, uiState.isEditingException, currentException]);

  // ✅ 저장 처리 개선
  const handleSave = useCallback(async () => {
    console.log('🔄 handleSave called');
    
    // 저장 전에 폼 상태 보존
    const preservedFormData = debugFormStateBeforeSave();
    
    if (!validateForm()) {
        console.log('❌ Form validation failed');
        return;
    }

    setUIState(prev => ({ ...prev, isLoading: true }));

    try {
        if (isEditMode) {
        const sanitizedEvent = event ? sanitizeEventData(event) : null;
        
        if (sanitizedEvent?.is_recurring) {
            if (uiState.isEditingException) {
            console.log('🔄 Updating existing exception');
            await updateExistingException();
            } else {
            console.log('🔄 Opening recurring edit modal with preserved data');
            // 폼 데이터를 다시 설정하여 보존
            setFormData(preservedFormData);
            setUIState(prev => ({ 
                ...prev, 
                showRecurringEditModal: true, 
                isLoading: false
            }));
            return;
            }
        } else {
            console.log('🔄 Updating regular event');
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
        finishSave();
        
    } catch (error) {
        console.error('❌ Error saving event:', error);
        Alert.alert('오류', '일정을 저장하는 중 오류가 발생했습니다.');
    } finally {
        setUIState(prev => ({ ...prev, isLoading: false }));
    }
    }, [validateForm, isEditMode, event, uiState.isEditingException, formData, finishSave, sanitizeEventData, debugFormStateBeforeSave]);

  // ✅ 기존 예외 수정 - null 체크 추가
  const updateExistingException = useCallback(async () => {
    if (!currentException || !event?.id) {
        console.log('❌ No current exception or event found');
        return;
    }

    // 현재 폼 데이터 보존
    const preservedFormData = { ...formData };
    console.log('🔄 Updating existing exception with current form data:', {
        exceptionId: currentException.id,
        eventId: event.id,
        date: selectedDate,
        preservedFormData: {
        title: preservedFormData.title,
        academyName: preservedFormData.academyName,
        category: preservedFormData.category,
        startTime: preservedFormData.startTime,
        endTime: preservedFormData.endTime
        }
    });

    const eventTitle = preservedFormData.category === '학원' ? preservedFormData.academyName : preservedFormData.title;
    let academyId: number | undefined = preservedFormData.selectedAcademy?.id;
    
    // 학원 카테고리인 경우 학원 생성/조회
    if (preservedFormData.category === '학원' && preservedFormData.academyName.trim()) {
        try {
        academyId = await DatabaseService.createAcademyForRecurringEvent(
            preservedFormData.academyName.trim(),
            preservedFormData.selectedSubject,
            scheduleId
        );
        console.log('✅ Academy created/found with ID:', academyId);
        } catch (error) {
        console.error('❌ Error creating academy:', error);
        Alert.alert('오류', '학원 정보 저장 중 오류가 발생했습니다.');
        return;
        }
    }

    // ✅ 예외 업데이트 - 보존된 데이터 사용
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
        console.log('✅ Exception updated successfully with preserved data');
    } catch (error) {
        console.error('❌ Error updating exception:', error);
        throw error;
    }
    }, [currentException, event, formData, scheduleId, selectedDate]);

    // ✅ 폼 데이터를 직접 받는 새로운 saveAsException 함수
    const saveAsExceptionWithData = useCallback(async (preservedFormData: EventFormData) => {
    if (!event?.id || !selectedDate) return;

    console.log('🔄 Saving as exception with preserved data for date:', selectedDate, {
        eventId: event.id,
        preservedFormData: {
        title: preservedFormData.title,
        academyName: preservedFormData.academyName,
        category: preservedFormData.category,
        startTime: preservedFormData.startTime,
        endTime: preservedFormData.endTime,
        selectedAcademy: preservedFormData.selectedAcademy?.name
        }
    });

    // ✅ 제목 결정 로직 - 보존된 데이터 사용
    let eventTitle = '';
    if (preservedFormData.category === '학원') {
        eventTitle = preservedFormData.academyName?.trim() || '';
    } else {
        eventTitle = preservedFormData.title?.trim() || '';
    }

    console.log('📝 Determined event title from preserved data:', eventTitle);

    let academyId: number | undefined = preservedFormData.selectedAcademy?.id;
    
    // 학원 카테고리인 경우 학원 생성/조회
    if (preservedFormData.category === '학원' && eventTitle) {
        try {
        academyId = await DatabaseService.createAcademyForRecurringEvent(
            eventTitle,
            preservedFormData.selectedSubject,
            scheduleId
        );
        console.log('✅ Academy created/found with ID:', academyId);
        } catch (error) {
        console.error('❌ Error creating academy:', error);
        Alert.alert('오류', '학원 정보 저장 중 오류가 발생했습니다.');
        return;
        }
    }

    // ✅ 저장할 데이터 검증 및 로깅 - 보존된 데이터 사용
    const exceptionData = {
        recurring_event_id: event.id,
        exception_date: selectedDate,
        exception_type: 'modify' as const,
        modified_title: eventTitle || undefined,
        modified_start_time: preservedFormData.startTime || undefined,
        modified_end_time: preservedFormData.endTime || undefined,
        modified_category: preservedFormData.category || undefined,
        modified_academy_id: academyId || undefined,
        del_yn: false,
    };

    console.log('💾 Exception data to save with preserved data:', {
        ...exceptionData,
        hasTitle: !!exceptionData.modified_title,
        hasStartTime: !!exceptionData.modified_start_time,
        hasEndTime: !!exceptionData.modified_end_time,
        hasCategory: !!exceptionData.modified_category,
        hasAcademyId: !!exceptionData.modified_academy_id
    });

    try {
        const exceptionId = await DatabaseService.createRecurringException(exceptionData);
        console.log('✅ Exception created/updated with ID:', exceptionId);
    } catch (error) {
        console.error('❌ Error saving exception with preserved data:', error);
        throw error;
    }
    }, [event, selectedDate, scheduleId]);

    // ✅ 전체 반복 시리즈 업데이트도 보존된 데이터 사용
    const updateEntireRecurringSeriesWithData = useCallback(async (preservedFormData: EventFormData) => {
    if (!event?.id) return;

    console.log('🔄 Updating entire recurring series with preserved data:', event.id, {
        preservedData: {
        title: preservedFormData.title,
        startTime: preservedFormData.startTime,
        endTime: preservedFormData.endTime,
        category: preservedFormData.category
        }
    });

    const eventTitle = preservedFormData.category === '학원' ? preservedFormData.academyName : preservedFormData.title;
    let academyId: number | undefined = preservedFormData.selectedAcademy?.id;
    
    if (preservedFormData.category === '학원' && eventTitle?.trim()) {
        academyId = await DatabaseService.createAcademyForRecurringEvent(
        eventTitle.trim(),
        preservedFormData.selectedSubject,
        scheduleId
        );
    }

    const updatedEvent: Event = {
        ...event,
        title: eventTitle?.trim() || event.title,
        start_time: preservedFormData.startTime || event.start_time,
        end_time: preservedFormData.endTime || event.end_time,
        category: preservedFormData.category || event.category,
        academy_id: academyId,
        event_date: selectedDate,
    };

    await DatabaseService.updateEvent(updatedEvent);
    console.log('✅ Recurring series updated successfully with preserved data');
    }, [event, selectedDate, scheduleId]);

  // 반복 일정 편집 확인 처리
  const handleRecurringEditConfirm = useCallback(async (editType: 'this_only' | 'all_future') => {
  console.log('🔄 Recurring edit confirm:', editType);
  
  // ✅ 현재 폼 데이터를 저장해서 보존
  const currentFormData = { ...formData };
    console.log('💾 Preserving current form data:', {
        title: currentFormData.title,
        startTime: currentFormData.startTime,
        endTime: currentFormData.endTime,
        category: currentFormData.category,
        academyName: currentFormData.academyName
    });
    
    setUIState(prev => ({ 
        ...prev, 
        showRecurringEditModal: false,
        isLoading: true 
    }));

    try {
        if (editType === 'this_only') {
        console.log('🔄 Saving as exception with preserved data');
        await saveAsExceptionWithData(currentFormData);
        } else {
        console.log('🔄 Updating entire recurring series with preserved data');
        await updateEntireRecurringSeriesWithData(currentFormData);
        }

        console.log('✅ Recurring edit completed');
        finishSave();
        
    } catch (error) {
        console.error('❌ Error in recurring edit:', error);
        Alert.alert('오류', '반복 일정 수정 중 오류가 발생했습니다.');
    } finally {
        setUIState(prev => ({ ...prev, isLoading: false }));
    }
    }, [formData, finishSave]);

  // ✅ 반복 일정 삭제 확인 처리 개선 - null 체크 추가
  const handleRecurringDeleteConfirm = useCallback(async (deleteType: 'this_only' | 'all_future' | 'restore') => {
    console.log('🔄 Recurring delete confirm:', deleteType, {
        eventId: event?.id,
        selectedDate,
        currentException: currentException?.id,
        isEditingException: uiState.isEditingException
    });
    
    setUIState(prev => ({ 
        ...prev, 
        showRecurringDeleteModal: false,
        isLoading: true 
    }));

    try {
        if (deleteType === 'this_only') {
        if (!event?.id || !selectedDate) return;
        
        console.log('🔄 Creating cancel exception for this date only');
        await DatabaseService.createRecurringException({
            recurring_event_id: event.id,
            exception_date: selectedDate,
            exception_type: 'cancel',
            del_yn: false,
        });
        console.log('✅ Cancel exception created successfully');
        
        } else if (deleteType === 'all_future') {
        console.log('🔄 Deleting entire recurring event');
        if (event?.id) {
            await DatabaseService.deleteRecurringEvent(event.id);
            console.log('✅ Entire recurring series deleted');
        }
        
        } else if (deleteType === 'restore') {
        // ✅ 예외 복원 로직 개선 - 더 안전한 방법
        console.log('🔄 Restoring by removing exception');
        
        let exceptionToDelete: RecurringException | null = currentException;
        
        // currentException이 없는 경우 DB에서 직접 찾기
        if (!exceptionToDelete && event?.id && selectedDate) {
            console.log('🔍 No currentException, searching in DB...');
            try {
            const exceptions = await DatabaseService.getRecurringExceptions(
                event.id, 
                selectedDate, 
                selectedDate
            );
            
            if (exceptions.length > 0) {
                exceptionToDelete = exceptions[0];
                console.log('✅ Found exception in DB:', exceptionToDelete.id);
            } else {
                console.log('⚠️ No exception found in DB either');
            }
            } catch (error) {
            console.error('❌ Error searching for exception:', error);
            }
        }
        
        if (exceptionToDelete) {
            console.log('🔄 Deleting exception with ID:', exceptionToDelete.id);
            await DatabaseService.deleteRecurringException(exceptionToDelete.id);
            console.log('✅ Exception removed, recurring event date restored');
            
            // 상태 초기화
            setCurrentException(null);
            setUIState(prev => ({ ...prev, isEditingException: false }));
        } else {
            console.log('⚠️ No exception to restore');
            Alert.alert('알림', '복원할 예외가 없습니다.');
            return;
        }
        }

        console.log('✅ Recurring delete completed');
        finishSave();
        
    } catch (error) {
        console.error('❌ Error in recurring delete:', error);
        Alert.alert('오류', '반복 일정 삭제 중 오류가 발생했습니다.');
    } finally {
        setUIState(prev => ({ ...prev, isLoading: false }));
    }
    }, [event, selectedDate, currentException, finishSave, uiState.isEditingException]);

  // ✅ 예외로 저장 개선
  const saveAsException = useCallback(async () => {
    const currentFormData = { ...formData };
    console.log('🔄 saveAsException called, using current form data');
    await saveAsExceptionWithData(currentFormData);
    }, [formData, saveAsExceptionWithData]);

  // 전체 반복 시리즈 수정
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

  // ✅ 삭제 처리 개선
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
      // 학원 일정 삭제 시 알림 처리
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
      
      finishSave();
      
    } catch (error) {
      console.error('❌ Error deleting event:', error);
      Alert.alert('오류', '일정을 삭제하는 중 오류가 발생했습니다.');
    } finally {
      setUIState(prev => ({ ...prev, isLoading: false }));
    }
  }, [event, scheduleId, handleAcademyDeleted, finishSave]);

  // 학원 선택 핸들러
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

  // ✅ 시간 선택 핸들러들
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
        
        if (isValidTimeOption(calculatedEndTime, options.timeOptions)) {
        setFormData(prev => ({ ...prev, endTime: calculatedEndTime }));
        console.log('✅ End time auto-set to:', calculatedEndTime);
        } else {
        const nextValidTime = findNextValidTime(value, options.timeOptions);
        
        if (nextValidTime) {
            setFormData(prev => ({ ...prev, endTime: nextValidTime }));
            console.log('✅ End time set to next valid time:', nextValidTime);
        } else {
            console.log('⚠️ No valid end time found, keeping current end time');
        }
        }
    }
    }, [schedule, options.timeOptions, formData]);

    const handleEndTimeConfirm = useCallback((value: string) => {
        console.log('⏰ End time selected:', value);
        console.log('📝 Current form data before update:', {
            startTime: formData.startTime,
            endTime: formData.endTime,
            title: formData.title
        });
        
        setFormData(prev => ({ ...prev, endTime: value }));
    }, [formData]);

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
  }, []);

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
  }, []);

  // 초기화
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ✅ 이벤트 데이터가 변경될 때 예외 상태 업데이트
  useEffect(() => {
    if (event && Boolean(event.is_recurring)) {
        // 이벤트 객체에 exception_id가 있으면 예외 편집 모드로 설정
        const hasExceptionId = !!(event as any).exception_id;
        console.log('🔍 Event exception check:', {
        eventId: event.id,
        hasExceptionId,
        selectedDate
        });
        
        setUIState(prev => ({
        ...prev,
        isEditingException: hasExceptionId
        }));
        
        // exception_id가 있으면 해당 예외 데이터도 로드
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
    
    // 헬퍼
    sanitizeEventData,
  };
};