import { useState, useCallback, useEffect, useRef } from 'react';
import moment from 'moment';
import DatabaseService, { Event, Schedule, Holiday } from '../services/DatabaseService';
import HolidayService from '../services/HolidayService';

// ✅ 이벤트 캐시 인터페이스
interface EventCache {
  [key: string]: {
    events: Event[];
    timestamp: number;
  };
}

// ✅ 캐시 유효 시간 (5분)
const CACHE_DURATION = 5 * 60 * 1000;

export const useTimeTableData = () => {
  const [currentWeek, setCurrentWeek] = useState(moment());
  const [events, setEvents] = useState<Event[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [holidays, setHolidays] = useState<{ [key: string]: Holiday }>({});
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  
  // ✅ 이벤트 캐시 및 프리로딩을 위한 ref
  const eventCacheRef = useRef<EventCache>({});
  const preloadingRef = useRef<Set<string>>(new Set());

  // 새 스케줄에 맞는 포커스 주간 계산
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
      console.log('📅 Weekend schedule - showing current week');
      return today.clone();
    }
    
    if (todayOfWeek === 0 || todayOfWeek === 6) {
      const nextMonday = today.clone().add(1, 'week').startOf('isoWeek');
      console.log('📅 Weekend day + weekday-only schedule - showing next Monday week:', nextMonday.format('YYYY-MM-DD'));
      return nextMonday;
    }
    
    console.log('📅 Weekday + weekday-only schedule - showing current week');
    return today.clone();
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const activeSchedule = await DatabaseService.getActiveSchedule();
      setSchedule(activeSchedule);
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  }, []);

  // ✅ 캐시 키 생성
  const getCacheKey = useCallback((scheduleId: number, startDate: string, endDate: string) => {
    return `${scheduleId}-${startDate}-${endDate}`;
  }, []);

  // ✅ 캐시에서 이벤트 가져오기
  const getEventsFromCache = useCallback((cacheKey: string): Event[] | null => {
    const cached = eventCacheRef.current[cacheKey];
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
    if (isExpired) {
      delete eventCacheRef.current[cacheKey];
      return null;
    }
    
    console.log('🚀 Cache hit for:', cacheKey);
    return cached.events;
  }, []);

  // ✅ 캐시에 이벤트 저장
  const saveEventsToCache = useCallback((cacheKey: string, events: Event[]) => {
    eventCacheRef.current[cacheKey] = {
      events: [...events],
      timestamp: Date.now()
    };
    console.log('💾 Cached events for:', cacheKey, 'Count:', events.length);
  }, []);

  // ✅ 최적화된 이벤트 로딩 - 캐시 우선 + 즉시 로딩
  const loadEvents = useCallback(async (targetWeek?: moment.Moment, targetSchedule?: Schedule) => {
    const week = targetWeek || currentWeek;
    const sched = targetSchedule || schedule;
    
    if (!sched) {
      console.log('⚠️ TimeTable: No schedule available, skipping event load');
      setEvents([]);
      return;
    }

    try {
      const weekDays = getWeekDays(sched, week);
      const startDate = weekDays[0].format('YYYY-MM-DD');
      const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
      const cacheKey = getCacheKey(sched.id!, startDate, endDate);
      
      console.log('🔍 TimeTable: Loading events for period:', startDate, 'to', endDate);
      
      // ✅ 캐시 확인
      const cachedEvents = getEventsFromCache(cacheKey);
      if (cachedEvents) {
        setEvents(cachedEvents);
        setIsLoadingEvents(false);
        
        // 백그라운드에서 데이터 갱신 (optional)
        setTimeout(async () => {
          try {
            const freshEvents = await DatabaseService.getEventsWithRecurring(sched.id!, startDate, endDate);
            if (JSON.stringify(freshEvents) !== JSON.stringify(cachedEvents)) {
              console.log('🔄 Background refresh: Data changed, updating cache');
              saveEventsToCache(cacheKey, freshEvents);
              setEvents(freshEvents);
            }
          } catch (error) {
            console.warn('Background refresh failed:', error);
          }
        }, 100);
        
        return;
      }
      
      // ✅ 캐시 미스 - 즉시 로딩
      setIsLoadingEvents(true);
      const weekEvents = await DatabaseService.getEventsWithRecurring(sched.id!, startDate, endDate);
      
      console.log('🔍 TimeTable: Events loaded:', weekEvents.length);
      console.log('🔍 TimeTable: Events breakdown:', {
        regular: weekEvents.filter(e => !e.is_recurring).length,
        recurring: weekEvents.filter(e => e.is_recurring).length,
        withExceptions: weekEvents.filter(e => !!(e as any).exception_id).length
      });

      // ✅ 즉시 UI 업데이트
      setEvents(weekEvents);
      setIsLoadingEvents(false);
      
      // ✅ 캐시에 저장
      saveEventsToCache(cacheKey, weekEvents);
      
      // ✅ 인접 주간 프리로딩 (백그라운드)
      preloadAdjacentWeeks(sched, week);
      
    } catch (error) {
      console.error('❌ TimeTable: Error loading events:', error);
      setEvents([]);
      setIsLoadingEvents(false);
    }
  }, [schedule, currentWeek, getCacheKey, getEventsFromCache, saveEventsToCache]);

  // ✅ 인접 주간 프리로딩
  const preloadAdjacentWeeks = useCallback(async (sched: Schedule, week: moment.Moment) => {
    const preloadWeeks = [
      week.clone().subtract(1, 'week'), // 이전 주
      week.clone().add(1, 'week'),      // 다음 주
    ];
    
    for (const preloadWeek of preloadWeeks) {
      const weekDays = getWeekDays(sched, preloadWeek);
      const startDate = weekDays[0].format('YYYY-MM-DD');
      const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
      const cacheKey = getCacheKey(sched.id!, startDate, endDate);
      
      // 이미 캐시되어 있거나 프리로딩 중이면 스킵
      if (getEventsFromCache(cacheKey) || preloadingRef.current.has(cacheKey)) {
        continue;
      }
      
      preloadingRef.current.add(cacheKey);
      
      // 백그라운드에서 프리로딩
      setTimeout(async () => {
        try {
          console.log('🔮 Preloading week:', startDate, 'to', endDate);
          const events = await DatabaseService.getEventsWithRecurring(sched.id!, startDate, endDate);
          saveEventsToCache(cacheKey, events);
          console.log('✅ Preloaded:', events.length, 'events for', startDate);
        } catch (error) {
          console.warn('⚠️ Preload failed for', startDate, ':', error);
        } finally {
          preloadingRef.current.delete(cacheKey);
        }
      }, 50);
    }
  }, [getCacheKey, getEventsFromCache, saveEventsToCache]);

  // ✅ 즉시 로딩 - useEffect에서 딜레이 제거
  useEffect(() => {
    if (schedule && currentWeek) {
      console.log('🔄 TimeTable: Auto-loading events (immediate)');
      loadEvents(); // setTimeout 제거
    }
  }, [schedule?.id, currentWeek.format('YYYY-MM-DD')]);

  // ✅ 캐시 무효화 - 강제 새로고침
  const invalidateCache = useCallback(() => {
    console.log('🗑️ Invalidating event cache');
    eventCacheRef.current = {};
    preloadingRef.current.clear();
  }, []);

  // ✅ 강제 새로고침 - 딜레이 제거
  const forceRefreshEvents = useCallback(async () => {
    console.log('🔄 TimeTable: Force refreshing events (immediate)');
    
    // 캐시 무효화
    invalidateCache();
    
    // 즉시 로드
    await loadEvents();
  }, [loadEvents, invalidateCache]);

  const loadHolidaysForCurrentPeriod = useCallback(async () => {
    if (!schedule) return;

    try {
      const weekDays = getWeekDays(schedule, currentWeek);
      const startDate = weekDays[0].format('YYYY-MM-DD');
      const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
      
      console.log(`🇰🇷 Loading holidays for period: ${startDate} ~ ${endDate}`);
      
      const periodHolidays = await DatabaseService.getHolidaysInRange(startDate, endDate);
      
      const holidayMap: { [key: string]: Holiday } = {};
      periodHolidays.forEach(holiday => {
        holidayMap[holiday.date] = holiday;
      });
      
      setHolidays(holidayMap);
      console.log(`🇰🇷 Loaded ${periodHolidays.length} holidays for period`);
      
      if (periodHolidays.length === 0) {
        const years = Array.from(new Set(weekDays.map(day => day.year())));
        loadMissingHolidaysQuietly(years);
      }
    } catch (error) {
      console.error('❌ Error loading holidays for period:', error);
    }
  }, [schedule, currentWeek]);

  const loadMissingHolidaysQuietly = useCallback(async (years: number[]) => {
    try {
      setTimeout(async () => {
        for (const year of years) {
          const existingHolidays = await DatabaseService.getHolidaysByYear(year);
          if (existingHolidays.length === 0) {
            console.log(`🇰🇷 Quietly loading missing holidays for year ${year}...`);
            try {
              await HolidayService.getHolidaysForYear(year);
              
              if (schedule) {
                const weekDays = getWeekDays(schedule, currentWeek);
                const startDate = weekDays[0].format('YYYY-MM-DD');
                const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
                
                const updatedPeriodHolidays = await DatabaseService.getHolidaysInRange(startDate, endDate);
                
                if (updatedPeriodHolidays.length > 0) {
                  const holidayMap: { [key: string]: Holiday } = {};
                  updatedPeriodHolidays.forEach(holiday => {
                    holidayMap[holiday.date] = holiday;
                  });
                  
                  setHolidays(holidayMap);
                  console.log(`🇰🇷 Quietly updated holidays: ${updatedPeriodHolidays.length}`);
                }
              }
            } catch (error) {
              console.warn(`🇰🇷 Failed to quietly load holidays for ${year}:`, error);
            }
          }
        }
      }, 50); // 딜레이 단축
    } catch (error) {
      console.error('❌ Error in quiet holiday loading:', error);
    }
  }, [schedule, currentWeek]);

  const handleRefreshHolidays = useCallback(async () => {
    if (isLoadingHolidays) return;
    
    try {
      setIsLoadingHolidays(true);
      console.log('🔄 Manual holiday update requested...');
      await HolidayService.forceUpdateCurrentYears();
      await loadHolidaysForCurrentPeriod();
      
      const currentYear = new Date().getFullYear();
      const currentYearHolidays = await DatabaseService.getHolidaysByYear(currentYear);
      
      return currentYearHolidays.length;
    } catch (error) {
      console.error('❌ Holiday update error:', error);
      throw error;
    } finally {
      setIsLoadingHolidays(false);
    }
  }, [isLoadingHolidays, loadHolidaysForCurrentPeriod]);

  // ✅ 주간 네비게이션 - 즉시 적용 + 캐시 활용
  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    const newWeek = direction === 'prev' 
      ? currentWeek.clone().subtract(1, 'week')
      : currentWeek.clone().add(1, 'week');
    
    console.log('📅 TimeTable: Navigating week (immediate):', direction, 'to', newWeek.format('YYYY-MM-DD'));
    
    // ✅ 즉시 주간 변경 (useEffect가 이벤트 로딩 처리)
    setCurrentWeek(newWeek);
  }, [currentWeek]);

  // ✅ 오늘로 이동 - 즉시 적용
  const goToToday = useCallback(() => {
    if (schedule) {
      const focusWeek = calculateFocusWeek(schedule);
      console.log('📅 TimeTable: Going to today week (immediate):', focusWeek.format('YYYY-MM-DD'));
      setCurrentWeek(focusWeek);
    } else {
      setCurrentWeek(moment());
    }
  }, [schedule, calculateFocusWeek]);

  return {
    // 상태
    currentWeek,
    events,
    schedule,
    holidays,
    isLoadingHolidays,
    isLoadingEvents,
    
    // 액션
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

// 유틸리티 함수
const getWeekDays = (schedule: Schedule, currentWeek: moment.Moment) => {
  const startOfWeek = schedule?.show_weekend
    ? currentWeek.clone().startOf('week')
    : currentWeek.clone().startOf('isoWeek');
  
  const days = [];
  const dayCount = schedule?.show_weekend ? 7 : 5;
  
  for (let i = 0; i < dayCount; i++) {
    days.push(startOfWeek.clone().add(i, 'day'));
  }
  
  return days;
};