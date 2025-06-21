import { useState, useCallback, useEffect, useRef } from 'react';
import moment from 'moment';
import DatabaseService, { Event, Schedule, Holiday } from '../services/DatabaseService';
import HolidayService from '../services/HolidayService';

// ✅ 통합된 상태 인터페이스
interface TimeTableState {
  currentWeek: moment.Moment;
  events: Event[];
  schedule: Schedule | null;
  holidays: { [key: string]: Holiday };
  isLoading: boolean;
  loadingMessage: string;
}

// ✅ 이벤트 캐시 인터페이스 (기존 유지)
interface EventCache {
  [key: string]: {
    events: Event[];
    timestamp: number;
  };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5분

export const useTimeTableData = () => {
  // ✅ 통합된 상태 관리
  const [state, setState] = useState<TimeTableState>({
    currentWeek: moment(),
    events: [],
    schedule: null,
    holidays: {},
    isLoading: false,
    loadingMessage: ''
  });

  // 캐시 관련 ref들 (기존 유지)
  const eventCacheRef = useRef<EventCache>({});
  const preloadingRef = useRef<Set<string>>(new Set());
  const loadingRef = useRef<boolean>(false);

  // ✅ 배치 상태 업데이트 함수
  const updateStateBatch = useCallback((updates: Partial<TimeTableState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // ✅ 개별 setter들 (호환성을 위해 유지)
  const setCurrentWeek = useCallback((week: moment.Moment) => {
    updateStateBatch({ currentWeek: week });
  }, [updateStateBatch]);

  const setSchedule = useCallback((schedule: Schedule | null) => {
    updateStateBatch({ schedule });
  }, [updateStateBatch]);

  // 캐시 관련 함수들 (기존 로직 유지)
  const getCacheKey = useCallback((scheduleId: number, startDate: string, endDate: string) => {
    return `${scheduleId}_${startDate}_${endDate}`;
  }, []);

  const getEventsFromCache = useCallback((cacheKey: string): Event[] | null => {
    const cached = eventCacheRef.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.events;
    }
    return null;
  }, []);

  const saveEventsToCache = useCallback((cacheKey: string, events: Event[]) => {
    eventCacheRef.current[cacheKey] = {
      events,
      timestamp: Date.now()
    };
  }, []);

  // ✅ 새 스케줄에 맞는 포커스 주간 계산
  const calculateFocusWeek = useCallback((newSchedule: Schedule): moment.Moment => {
    const today = moment();
    const todayOfWeek = today.day();
    
    console.log('📅 Calculating focus week for schedule:', {
      scheduleName: newSchedule.name,
      showWeekend: newSchedule.show_weekend,
      todayOfWeek,
      today: today.format('YYYY-MM-DD ddd')
    });

    if (newSchedule.show_weekend) {
      return today.clone();
    }
    
    if (todayOfWeek === 0 || todayOfWeek === 6) {
      const nextMonday = today.clone().add(1, 'week').startOf('isoWeek');
      return nextMonday;
    }
    
    return today.clone();
  }, []);

  // ✅ 통합된 데이터 로딩 함수 (배치 처리)
  const loadAllData = useCallback(async (
    targetSchedule?: Schedule, 
    targetWeek?: moment.Moment,
    showLoading: boolean = true
  ) => {
    const sched = targetSchedule || state.schedule;
    const week = targetWeek || state.currentWeek;
    
    if (!sched || loadingRef.current) return;

    loadingRef.current = true;

    try {
      if (showLoading) {
        updateStateBatch({ 
          isLoading: true, 
          loadingMessage: '데이터 로딩 중...' 
        });
      }

      // 주간 데이터 계산
      const weekDays = getWeekDays(sched, week);
      const startDate = weekDays[0].format('YYYY-MM-DD');
      const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
      
      console.log('🔄 Loading data batch:', {
        schedule: sched.name,
        period: `${startDate} ~ ${endDate}`,
        showLoading
      });

      // 캐시 확인
      const cacheKey = getCacheKey(sched.id!, startDate, endDate);
      const cachedEvents = getEventsFromCache(cacheKey);

      // 병렬로 데이터 로드
      const [events, holidayMap] = await Promise.all([
        cachedEvents || DatabaseService.getEventsWithRecurring(sched.id!, startDate, endDate),
        loadHolidaysForPeriod(startDate, endDate)
      ]);

      // 캐시에 저장 (새로 로드한 경우)
      if (!cachedEvents) {
        saveEventsToCache(cacheKey, events);
      }

      // ✅ 한 번에 모든 상태 업데이트 (깜빡임 방지)
      updateStateBatch({
        events,
        holidays: holidayMap,
        isLoading: false,
        loadingMessage: '',
        ...(targetSchedule && { schedule: targetSchedule }),
        ...(targetWeek && { currentWeek: targetWeek })
      });

      console.log('✅ Data batch loaded successfully:', {
        eventsCount: events.length,
        holidaysCount: Object.keys(holidayMap).length
      });

      // 백그라운드 프리로딩
      if (!cachedEvents) {
        setTimeout(() => preloadAdjacentWeeks(sched, week), 100);
      }

    } catch (error) {
      console.error('❌ Error loading data batch:', error);
      updateStateBatch({
        isLoading: false,
        loadingMessage: '',
        events: [],
        holidays: {}
      });
    } finally {
      loadingRef.current = false;
    }
  }, [state.schedule, state.currentWeek, getCacheKey, getEventsFromCache, saveEventsToCache, updateStateBatch]);

  // 공휴일 로딩 함수
  const loadHolidaysForPeriod = useCallback(async (startDate: string, endDate: string) => {
    try {
      const periodHolidays = await DatabaseService.getHolidaysInRange(startDate, endDate);
      const holidayMap: { [key: string]: Holiday } = {};
      periodHolidays.forEach(holiday => {
        holidayMap[holiday.date] = holiday;
      });
      return holidayMap;
    } catch (error) {
      console.error('❌ Error loading holidays:', error);
      return {};
    }
  }, []);

  // 주간 데이터 계산 함수
  const getWeekDays = useCallback((schedule: Schedule, week: moment.Moment) => {
    const startOfWeek = schedule.show_weekend
      ? week.clone().startOf('week')
      : week.clone().startOf('isoWeek');
    
    const days = [];
    const dayCount = schedule.show_weekend ? 7 : 5;
    
    for (let i = 0; i < dayCount; i++) {
      days.push(startOfWeek.clone().add(i, 'day'));
    }
    
    return days;
  }, []);

  // 인접 주간 프리로딩 (기존 로직 유지)
  const preloadAdjacentWeeks = useCallback(async (sched: Schedule, week: moment.Moment) => {
    const preloadWeeks = [
      week.clone().subtract(1, 'week'),
      week.clone().add(1, 'week'),
    ];
    
    for (const preloadWeek of preloadWeeks) {
      const weekDays = getWeekDays(sched, preloadWeek);
      const startDate = weekDays[0].format('YYYY-MM-DD');
      const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
      const cacheKey = getCacheKey(sched.id!, startDate, endDate);
      
      if (getEventsFromCache(cacheKey) || preloadingRef.current.has(cacheKey)) {
        continue;
      }
      
      preloadingRef.current.add(cacheKey);
      
      setTimeout(async () => {
        try {
          console.log('🔮 Preloading week:', startDate, 'to', endDate);
          const events = await DatabaseService.getEventsWithRecurring(sched.id!, startDate, endDate);
          saveEventsToCache(cacheKey, events);
        } catch (error) {
          console.warn('❌ Preload failed:', error);
        } finally {
          preloadingRef.current.delete(cacheKey);
        }
      }, 500);
    }
  }, [getCacheKey, getEventsFromCache, saveEventsToCache, getWeekDays]);

  // ✅ 개별 함수들 (호환성을 위해 유지하되 내부적으로는 loadAllData 사용)
  const loadSchedule = useCallback(async () => {
    try {
      const activeSchedule = await DatabaseService.getActiveSchedule();
      if (activeSchedule) {
        await loadAllData(activeSchedule, state.currentWeek, false);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  }, [loadAllData, state.currentWeek]);

  const loadEvents = useCallback(async () => {
    if (state.schedule) {
      await loadAllData(state.schedule, state.currentWeek, false);
    }
  }, [loadAllData, state.schedule, state.currentWeek]);

  const forceRefreshEvents = useCallback(async () => {
    // 캐시 무효화 후 강제 리로드
    eventCacheRef.current = {};
    if (state.schedule) {
      await loadAllData(state.schedule, state.currentWeek, true);
    }
  }, [loadAllData, state.schedule, state.currentWeek]);

  const invalidateCache = useCallback(() => {
    eventCacheRef.current = {};
    preloadingRef.current.clear();
  }, []);

  const loadHolidaysForCurrentPeriod = useCallback(async () => {
    if (!state.schedule) return;
    
    const weekDays = getWeekDays(state.schedule, state.currentWeek);
    const startDate = weekDays[0].format('YYYY-MM-DD');
    const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
    
    const holidayMap = await loadHolidaysForPeriod(startDate, endDate);
    updateStateBatch({ holidays: holidayMap });
  }, [state.schedule, state.currentWeek, getWeekDays, loadHolidaysForPeriod, updateStateBatch]);

  // 공휴일 새로고침
  const handleRefreshHolidays = useCallback(async (): Promise<number | undefined> => {
    try {
      updateStateBatch({ isLoading: true, loadingMessage: '공휴일 업데이트 중...' });
      
      const currentYear = new Date().getFullYear();
      await HolidayService.forceUpdateCurrentYears();
      
      const currentYearHolidays = await DatabaseService.getHolidaysByYear(currentYear);
      
      // 현재 기간의 공휴일 다시 로드
      await loadHolidaysForCurrentPeriod();
      
      updateStateBatch({ isLoading: false, loadingMessage: '' });
      
      return currentYearHolidays.length;
    } catch (error) {
      console.error('❌ Holiday refresh error:', error);
      updateStateBatch({ isLoading: false, loadingMessage: '' });
      throw error;
    }
  }, [loadHolidaysForCurrentPeriod, updateStateBatch]);

  // 주간 네비게이션
  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    const newWeek = direction === 'prev' 
      ? state.currentWeek.clone().subtract(1, 'week')
      : state.currentWeek.clone().add(1, 'week');
    
    if (state.schedule) {
      loadAllData(state.schedule, newWeek, false);
    }
  }, [state.currentWeek, state.schedule, loadAllData]);

  const goToToday = useCallback(() => {
    if (state.schedule) {
      const focusWeek = calculateFocusWeek(state.schedule);
      loadAllData(state.schedule, focusWeek, false);
    } else {
      updateStateBatch({ currentWeek: moment() });
    }
  }, [state.schedule, calculateFocusWeek, loadAllData, updateStateBatch]);

  return {
    // 상태
    currentWeek: state.currentWeek,
    events: state.events,
    schedule: state.schedule,
    holidays: state.holidays,
    isLoadingHolidays: state.isLoading,
    isLoadingEvents: state.isLoading,
    
    // 새로운 통합 함수
    loadAllData,
    updateStateBatch,
    
    // 기존 호환성 함수들
    setCurrentWeek,
    setSchedule,
    loadSchedule,
    loadEvents,
    forceRefreshEvents,
    invalidateCache,
    loadHolidaysForCurrentPeriod,
    handleRefreshHolidays,
    calculateFocusWeek,
    navigateWeek,
    goToToday,
  };
};