import { useCallback } from 'react';
import { Alert } from 'react-native';
import moment from 'moment';
import DatabaseService, { Event, Academy, Schedule, RecurringException } from '../services/DatabaseService';
import { EventFormData, EventUIState, DayButton } from '../types/eventTypes';
import { sanitizeEventData, getCurrentDayKey, calculateEndTime } from '../utils/eventUtils';

interface UseEventDataLoaderProps {
  selectedDate: string;
  scheduleId: number;
  weekdays: DayButton[];
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  setUIState: React.Dispatch<React.SetStateAction<EventUIState>>;
  setSchedule: React.Dispatch<React.SetStateAction<Schedule | null>>;
  setAcademies: React.Dispatch<React.SetStateAction<Academy[]>>;
  setCurrentException: React.Dispatch<React.SetStateAction<RecurringException | null>>;
}

export const useEventDataLoader = ({
  selectedDate,
  scheduleId,
  weekdays,
  setFormData,
  setUIState,
  setSchedule,
  setAcademies,
  setCurrentException,
}: UseEventDataLoaderProps) => {

  // ✅ 예외 데이터 로드
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
  }, [selectedDate, setCurrentException]);

  // ✅ 요일 선택 로드
  const loadDaySelection = useCallback(async (sanitizedEvent: Event) => {
    const currentDayKey = getCurrentDayKey(selectedDate);
    
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
  }, [selectedDate, setFormData]);

  // ✅ 학원 정보 로드
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
  }, [setFormData]);

  // ✅ 이벤트 데이터 로드
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
      
      // ✅ 기본 폼 데이터를 먼저 설정
      const baseFormData = {
        title: sanitizedEvent.title,
        startTime: sanitizedEvent.start_time,
        endTime: sanitizedEvent.end_time,
        category: sanitizedEvent.category,
        isRecurring: sanitizedEvent.is_recurring,
      };
      
      console.log('📝 Setting base form data:', baseFormData);
      setFormData(prev => ({ ...prev, ...baseFormData }));
      
      // ✅ 예외 처리
      const hasExceptionId = !!(eventData as any).exception_id;
      let exception: RecurringException | null = null;
      
      if (sanitizedEvent.is_recurring && selectedDate) {
        if (hasExceptionId) {
          console.log('✅ Event has exception_id, treating as exception');
          setUIState(prev => ({ ...prev, isEditingException: true }));
          exception = await loadExceptionData(sanitizedEvent.id);
        } else {
          exception = await loadExceptionData(sanitizedEvent.id);
          if (exception) {
            console.log('✅ Found exception in DB, setting exception mode');
            setUIState(prev => ({ ...prev, isEditingException: true }));
          }
        }
        
        // 예외 데이터 적용
        if (exception && exception.exception_type === 'modify') {
          console.log('✅ Loading exception data for date:', selectedDate);
          
          const exceptionFormUpdates: Partial<EventFormData> = {};
          
          if (exception.modified_title && exception.modified_title.trim()) {
            exceptionFormUpdates.title = exception.modified_title;
          }
          if (exception.modified_start_time && exception.modified_start_time.trim()) {
            exceptionFormUpdates.startTime = exception.modified_start_time;
          }
          if (exception.modified_end_time && exception.modified_end_time.trim()) {
            exceptionFormUpdates.endTime = exception.modified_end_time;
          }
          if (exception.modified_category && exception.modified_category.trim()) {
            exceptionFormUpdates.category = exception.modified_category as Event['category'];
          }
          
          setFormData(prev => ({ ...prev, ...exceptionFormUpdates }));
          
          // 수정된 학원 처리
          if (exception.modified_academy_id) {
            const modifiedAcademy = academyList.find(a => a.id === exception?.modified_academy_id);
            if (modifiedAcademy) {
              setFormData(prev => ({
                ...prev,
                selectedAcademy: modifiedAcademy,
                academyName: modifiedAcademy.name,
                selectedSubject: modifiedAcademy.subject,
              }));
            }
          } else if (sanitizedEvent.category === '학원' && sanitizedEvent.academy_id) {
            loadAcademyInfo(sanitizedEvent.academy_id, academyList);
          }
          
          await loadDaySelection(sanitizedEvent);
          return;
        }
      }
      
      // 일반 이벤트 또는 예외가 없는 경우
      if (!exception || exception.exception_type !== 'modify') {
        setUIState(prev => ({ ...prev, isEditingException: false }));
        await loadDaySelection(sanitizedEvent);
        
        if (sanitizedEvent.category === '학원' && sanitizedEvent.academy_id) {
          loadAcademyInfo(sanitizedEvent.academy_id, academyList);
        }
      }
      
      console.log('✅ Event data loaded successfully');
      
    } catch (error) {
      console.error('❌ Error loading event data:', error);
      Alert.alert('오류', '일정 정보를 불러오는 중 오류가 발생했습니다.');
    }
  }, [selectedDate, loadExceptionData, loadDaySelection, loadAcademyInfo, setFormData, setUIState]);

  // ✅ 새 이벤트 폼 초기화
  const initializeNewEventForm = useCallback((currentSchedule?: Schedule | null, selectedTime?: string) => {
    const currentDayKey = getCurrentDayKey(selectedDate);
    
    console.log('🆕 Initializing new event form');
    
    const formUpdates: Partial<EventFormData> = {
      selectedDays: currentDayKey ? new Set([currentDayKey]) : new Set(),
      title: '',
      category: '선택안함',
    };
    
    if (selectedTime && currentSchedule) {
      const calculatedEndTime = calculateEndTime(selectedTime, currentSchedule);
      formUpdates.startTime = selectedTime;
      formUpdates.endTime = calculatedEndTime;
      console.log(`⏰ Using selected time: ${selectedTime} ~ ${calculatedEndTime}`);
    } else if (currentSchedule) {
      const defaultStart = currentSchedule.start_time;
      const calculatedEndTime = calculateEndTime(defaultStart, currentSchedule);
      formUpdates.startTime = defaultStart;
      formUpdates.endTime = calculatedEndTime;
      console.log(`⏰ Using default time: ${defaultStart} ~ ${calculatedEndTime}`);
    }
    
    console.log('🆕 New event form updates:', formUpdates);
    setFormData(prev => ({ ...prev, ...formUpdates }));
  }, [selectedDate, setFormData]);

  // ✅ 초기 데이터 로드
  const loadInitialData = useCallback(async (event?: Event | null, selectedTime?: string) => {
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
        initializeNewEventForm(activeSchedule, selectedTime);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }, [scheduleId, setSchedule, setAcademies, loadEventData, initializeNewEventForm]);

  return {
    loadInitialData,
    loadEventData,
    loadExceptionData,
    loadDaySelection,
    loadAcademyInfo,
    initializeNewEventForm,
  };
};