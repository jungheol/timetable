import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import 'moment/locale/ko';
import DatabaseService, { Event, Schedule, Holiday } from '../services/DatabaseService';
import HolidayService from '../services/HolidayService';
import { RootStackParamList } from '../../App';

moment.locale('ko');

const { width: screenWidth } = Dimensions.get('window');

type TimeTableScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface Props {
  navigation: TimeTableScreenNavigationProp;
}

const TimeTableScreen: React.FC<Props> = ({ navigation }) => {
  const [currentWeek, setCurrentWeek] = useState(moment());
  const [events, setEvents] = useState<Event[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [holidays, setHolidays] = useState<{ [key: string]: Holiday }>({});
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  
  // 스케줄 관리 상태
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editScheduleName, setEditScheduleName] = useState('');

  useEffect(() => {
    loadSchedule();
    loadAllSchedules();
  }, []);

  // 화면에 포커스될 때마다 이벤트와 공휴일 새로고침
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        console.log('🔍 [TimeTable] Screen focused - checking for schedule changes...');
        
        // 스케줄 목록 새로고침 (새 스케줄이 추가되었을 수 있음)
        await loadAllSchedules();
        
        // 활성 스케줄 확인 및 업데이트
        const currentActiveSchedule = await DatabaseService.getActiveSchedule();
        console.log('🔍 [TimeTable] Current active schedule from DB:', currentActiveSchedule);
        console.log('🔍 [TimeTable] Current schedule in state:', schedule);
        
        if (currentActiveSchedule) {
          // 새로운 활성 스케줄이 있는 경우
          if (!schedule || schedule.id !== currentActiveSchedule.id) {
            console.log('🔄 [TimeTable] New active schedule detected:', currentActiveSchedule.name);
            console.log('🔄 [TimeTable] Previous schedule was:', schedule?.name || 'none');
            
            setSchedule(currentActiveSchedule);
            
            // 새 스케줄에 맞는 주간으로 포커싱
            const focusWeek = calculateFocusWeek(currentActiveSchedule);
            setCurrentWeek(focusWeek);
            
            console.log('📅 [TimeTable] Focusing to week:', focusWeek.format('YYYY-MM-DD'));
            
            // 이벤트와 공휴일도 새로 로드
            setTimeout(() => {
              loadEvents();
              loadHolidaysForCurrentPeriod();
            }, 100);
            
            return; // 새 스케줄로 전환했으므로 여기서 리턴
          } else {
            console.log('✅ [TimeTable] Same schedule, no change needed');
          }
        } else {
          console.log('⚠️ [TimeTable] No active schedule found in DB');
        }
  
        // 기존 스케줄이 있는 경우에만 이벤트와 공휴일 로드
        if (schedule || currentActiveSchedule) {
          loadEvents();
          loadHolidaysForCurrentPeriod();
        }
      };
      
      handleFocus().catch(error => {
        console.error('❌ [TimeTable] Error in focus handler:', error);
      });
    }, [schedule, currentWeek]) // dependencies 확인
  );

  // 새 스케줄에 맞는 포커스 주간 계산
  const calculateFocusWeek = (newSchedule: Schedule): moment.Moment => {
    const today = moment();
    const todayOfWeek = today.day(); // 0=일요일, 1=월요일, ..., 6=토요일
    
    console.log('📅 Calculating focus week for schedule:', {
      scheduleName: newSchedule.name,
      showWeekend: newSchedule.show_weekend,
      todayOfWeek,
      today: today.format('YYYY-MM-DD ddd')
    });

    // 주말을 표시하는 스케줄인 경우, 오늘이 포함된 주간으로
    if (newSchedule.show_weekend) {
      console.log('📅 Weekend schedule - showing current week');
      return today.clone();
    }
    
    // 주말을 표시하지 않는 스케줄인 경우
    // 오늘이 주말(토요일=6, 일요일=0)이면 다음 월요일이 있는 주간으로
    if (todayOfWeek === 0 || todayOfWeek === 6) {
      // 다음 월요일 찾기
      const nextMonday = today.clone().add(1, 'week').startOf('isoWeek');
      console.log('📅 Weekend day + weekday-only schedule - showing next Monday week:', nextMonday.format('YYYY-MM-DD'));
      return nextMonday;
    }
    
    // 오늘이 평일이면 오늘이 포함된 주간으로
    console.log('📅 Weekday + weekday-only schedule - showing current week');
    return today.clone();
  };

  const loadSchedule = async () => {
    try {
      const activeSchedule = await DatabaseService.getActiveSchedule();
      setSchedule(activeSchedule);
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const loadAllSchedules = async () => {
    try {
      const schedules = await DatabaseService.getAllSchedules();
      setAllSchedules(schedules);
    } catch (error) {
      console.error('Error loading all schedules:', error);
    }
  };

  const loadHolidaysForCurrentPeriod = async () => {
    try {
      const weekDays = getWeekDays();
      const startDate = weekDays[0].format('YYYY-MM-DD');
      const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
      
      console.log(`🇰🇷 Loading holidays for period: ${startDate} ~ ${endDate}`);
      
      // DB에서 현재 표시 기간의 공휴일 조회
      const periodHolidays = await DatabaseService.getHolidaysInRange(startDate, endDate);
      
      // 날짜를 키로 하는 객체로 변환
      const holidayMap: { [key: string]: Holiday } = {};
      periodHolidays.forEach(holiday => {
        holidayMap[holiday.date] = holiday;
      });
      
      setHolidays(holidayMap);
      console.log(`🇰🇷 Loaded ${periodHolidays.length} holidays for period`);
      
      // 공휴일이 없는 경우, 해당 연도 데이터가 있는지 확인하고 없으면 조용히 백그라운드에서 로드
      if (periodHolidays.length === 0) {
        const years = Array.from(new Set(weekDays.map(day => day.year())));
        loadMissingHolidaysQuietly(years);
      }
    } catch (error) {
      console.error('❌ Error loading holidays for period:', error);
    }
  };

  // 조용히 백그라운드에서 누락된 공휴일 데이터 로드
  const loadMissingHolidaysQuietly = async (years: number[]) => {
    try {
      // 비동기로 실행하여 UI 블로킹 방지
      setTimeout(async () => {
        for (const year of years) {
          const existingHolidays = await DatabaseService.getHolidaysByYear(year);
          if (existingHolidays.length === 0) {
            console.log(`🇰🇷 Quietly loading missing holidays for year ${year}...`);
            try {
              await HolidayService.getHolidaysForYear(year);
              
              // 로드 완료 후 현재 기간에 해당하는 공휴일이 있으면 UI 업데이트
              const weekDays = getWeekDays();
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
            } catch (error) {
              console.warn(`🇰🇷 Failed to quietly load holidays for ${year}:`, error);
            }
          }
        }
      }, 100); // 100ms 후에 백그라운드에서 실행
    } catch (error) {
      console.error('❌ Error in quiet holiday loading:', error);
    }
  };

  const loadEvents = useCallback(async () => {
    if (!schedule) return;

    try {
      const weekDays = getWeekDays();
      const startDate = weekDays[0].format('YYYY-MM-DD');
      const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
      
      console.log('🔍 TimeTable: Loading events for period:', startDate, 'to', endDate);
      
      // ✅ 반복 일정 지원하는 메서드로 변경
      const weekEvents = await DatabaseService.getEventsWithRecurring(schedule.id!, startDate, endDate);
      
      console.log('🔍 TimeTable: Events loaded:', weekEvents.length);
      console.log('🔍 TimeTable: Events details:', weekEvents);
      
      setEvents(weekEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }, [schedule, currentWeek]);

  // 스케줄 변경 처리
  const handleScheduleChange = async (selectedSchedule: Schedule) => {
    try {
      // 기존 활성 스케줄을 비활성화
      if (schedule) {
        await DatabaseService.updateSchedule({
          ...schedule,
          is_active: false,
        });
      }

      // 선택한 스케줄을 활성화
      await DatabaseService.updateSchedule({
        ...selectedSchedule,
        is_active: true,
      });

      setSchedule(selectedSchedule);
      setShowScheduleDropdown(false);
      
      // 스케줄 변경 시에도 적절한 주간으로 포커싱
      const focusWeek = calculateFocusWeek(selectedSchedule);
      setCurrentWeek(focusWeek);
      
      console.log(`✅ Switched to schedule: ${selectedSchedule.name}`);
    } catch (error) {
      console.error('Error switching schedule:', error);
      Alert.alert('오류', '스케줄 변경 중 오류가 발생했습니다.');
    }
  };

  // 새 스케줄 생성으로 이동
  const handleCreateNewSchedule = () => {
    setShowScheduleDropdown(false);
    navigation.navigate('InitialSetupFromMain', {
      // 간단한 플래그만 전달하고 실제 콜백은 useFocusEffect에서 처리
      isFromModal: true
    });
  };

  // 스케줄 이름 수정 시작
  const handleEditScheduleName = (scheduleToEdit: Schedule) => {
    setEditingSchedule(scheduleToEdit);
    setEditScheduleName(scheduleToEdit.name);
    setShowEditModal(true);
    setShowScheduleDropdown(false);
  };

  // 스케줄 이름 수정 완료
  const handleSaveScheduleName = async () => {
    if (!editingSchedule || !editScheduleName.trim()) {
      Alert.alert('알림', '스케줄 이름을 입력해주세요.');
      return;
    }

    try {
      const updatedSchedule = {
        ...editingSchedule,
        name: editScheduleName.trim(),
      };

      await DatabaseService.updateSchedule(updatedSchedule);
      
      // 현재 활성 스케줄이 수정된 경우 업데이트
      if (schedule && schedule.id === editingSchedule.id) {
        setSchedule(updatedSchedule);
      }
      
      // 스케줄 목록 새로고침
      await loadAllSchedules();
      
      setShowEditModal(false);
      setEditingSchedule(null);
      setEditScheduleName('');
      
      console.log(`✅ Schedule name updated: ${editScheduleName}`);
    } catch (error) {
      console.error('Error updating schedule name:', error);
      Alert.alert('오류', '스케줄 이름 수정 중 오류가 발생했습니다.');
    }
  };

  // 🧪 디버깅용 테스트 메서드 추가
  const testRecurringEvents = useCallback(async () => {
    if (!schedule) return;
    
    try {
      console.log('🧪 Testing recurring events...');
      await DatabaseService.testRecurringRetrieval(schedule.id!);
    } catch (error) {
      console.error('Test error:', error);
    }
  }, [schedule]);

  // 🧪 공휴일 디버깅 메서드
  const debugHolidays = useCallback(async () => {
    try {
      console.log('🧪 Starting holiday debug...');
      
      // 전체 공휴일 정보 디버깅
      await DatabaseService.debugHolidayData();
      
      // 현재 표시 중인 주간의 공휴일 디버깅
      if (schedule) {
        const weekDays = getWeekDays();
        const startDate = weekDays[0].format('YYYY-MM-DD');
        const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
        
        await DatabaseService.debugHolidaysInRange(startDate, endDate);
        
        Alert.alert(
          '공휴일 디버그 완료', 
          `DB 공휴일 정보를 콘솔에 출력했습니다.\n\n현재 주간: ${startDate} ~ ${endDate}\n표시된 공휴일: ${Object.keys(holidays).length}개\n\n자세한 내용은 개발자 도구의 콘솔을 확인하세요.`
        );
      } else {
        Alert.alert(
          '공휴일 디버그 완료', 
          `DB 공휴일 정보를 콘솔에 출력했습니다.\n\n자세한 내용은 개발자 도구의 콘솔을 확인하세요.`
        );
      }
    } catch (error) {
      console.error('🧪 Holiday debug error:', error);
      Alert.alert('디버그 오류', '공휴일 디버깅 중 오류가 발생했습니다.');
    }
  }, [schedule, holidays]);

  // 공휴일 강제 업데이트 (필요시에만 사용)
  const handleRefreshHolidays = async () => {
    if (isLoadingHolidays) return; // 중복 요청 방지
    
    try {
      Alert.alert(
        '공휴일 업데이트',
        `공휴일 데이터를 API에서 다시 가져오시겠습니까?\n\n참고: 초기 설정에서 이미 공휴일 데이터가 로드되었으며, 일반적으로 수동 업데이트는 필요하지 않습니다.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '강제 업데이트',
            onPress: async () => {
              setIsLoadingHolidays(true);
              try {
                console.log('🔄 Manual holiday update requested...');
                await HolidayService.forceUpdateCurrentYears();
                await loadHolidaysForCurrentPeriod();
                
                // 업데이트 결과 확인
                const currentYear = new Date().getFullYear();
                const currentYearHolidays = await DatabaseService.getHolidaysByYear(currentYear);
                
                if (currentYearHolidays.length > 0) {
                  Alert.alert(
                    '업데이트 완료', 
                    `${currentYear}년 공휴일 ${currentYearHolidays.length}개가 업데이트되었습니다.`
                  );
                } else {
                  Alert.alert(
                    '업데이트 완료', 
                    `API에서 공휴일 데이터를 가져올 수 없습니다.\nAPI 키 등록이 필요할 수 있습니다.`
                  );
                }
              } catch (error) {
                console.error('❌ Holiday update error:', error);
                Alert.alert(
                  '업데이트 오류', 
                  'API에서 공휴일 데이터를 가져오는 중 오류가 발생했습니다.\n네트워크 연결과 API 키를 확인해주세요.'
                );
              } finally {
                setIsLoadingHolidays(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in refresh holidays:', error);
    }
  };

  const getWeekDays = () => {
    const startOfWeek = schedule?.show_weekend
      ? currentWeek.clone().startOf('week')  // 일요일 시작
      : currentWeek.clone().startOf('isoWeek'); // 월요일 시작
    
    const days = [];
    const dayCount = schedule?.show_weekend ? 7 : 5;
    
    for (let i = 0; i < dayCount; i++) {
      days.push(startOfWeek.clone().add(i, 'day'));
    }
    
    return days;
  };

  const getTimeSlots = () => {
    if (!schedule) return [];
    
    const slots = [];
    const start = moment(schedule.start_time, 'HH:mm');
    const end = moment(schedule.end_time, 'HH:mm');
    
    // 기본적으로 1시간 단위로, 나중에 timeUnit 정보를 추가할 수 있음
    const increment = schedule.time_unit === '30min' ? 30 : 60; // minutes
    
    let current = start.clone();
    while (current.isBefore(end)) {
      slots.push(current.format('HH:mm'));
      current.add(increment, 'minutes');
    }
    
    return slots;
  };

  const getEventsForDateAndTime = (date: moment.Moment, time: string) => {
    const dateStr = date.format('YYYY-MM-DD');
    const filteredEvents = events.filter(event => {
      // 날짜 확인
      const eventDateMatches = event.event_date === dateStr;
      
      // 시간 확인 - 시작 시간이 현재 시간보다 작거나 같고, 종료 시간이 현재 시간보다 큰 경우
      const eventStartTime = moment(event.start_time, 'HH:mm');
      const eventEndTime = moment(event.end_time, 'HH:mm');
      const currentTime = moment(time, 'HH:mm');
      
      const timeMatches = eventStartTime.isSameOrBefore(currentTime) && eventEndTime.isAfter(currentTime);
      
      return eventDateMatches && timeMatches;
    });
    
    return filteredEvents;
  };

  const handleCellPress = (date: moment.Moment, time: string) => {
    const dateStr = date.format('YYYY-MM-DD');
    const cellEvents = getEventsForDateAndTime(date, time);
    
    // 반복 일정의 경우 임시 ID를 가질 수 있으므로 첫 번째 이벤트 선택
    const selectedEvent = cellEvents.length > 0 ? cellEvents[0] : null;
    
    console.log('🖱️ Cell pressed:', dateStr, time, selectedEvent?.title || 'No event');
    
    // EventScreen으로 네비게이션
    navigation.navigate('EventScreen', {
      event: selectedEvent,
      selectedDate: dateStr,
      selectedTime: time,
      scheduleId: schedule!.id!,
      onSave: loadEvents,
    });
  };

  const handleEventSave = () => {
    // EventScreen에서 돌아왔을 때 실행
    loadEvents();
  };

  const getEventStyle = (category: Event['category']) => {
    switch (category) {
      case '학교/기관':
        return { backgroundColor: '#34C759', color: '#fff' };
      case '학원':
        return { backgroundColor: '#007AFF', color: '#fff' };
      case '공부':
        return { backgroundColor: '#FF9500', color: '#fff' };
      case '휴식':
        return { backgroundColor: '#FF3B30', color: '#fff' };
      default:
        return { backgroundColor: '#8E8E93', color: '#fff' };
    }
  };

  const isHoliday = (date: moment.Moment) => {
    const dateStr = date.format('YYYY-MM-DD');
    return holidays[dateStr];
  };

  const isToday = (date: moment.Moment) => {
    return date.isSame(moment(), 'day');
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => 
      direction === 'prev' 
        ? prev.clone().subtract(1, 'week')
        : prev.clone().add(1, 'week')
    );
  };

  const goToToday = () => {
    if (schedule) {
      const focusWeek = calculateFocusWeek(schedule);
      setCurrentWeek(focusWeek);
    } else {
      setCurrentWeek(moment());
    }
  };

  if (!schedule) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>일정표를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const weekDays = getWeekDays();
  const timeSlots = getTimeSlots();
  const dayWidth = schedule.show_weekend ? screenWidth / 8 : screenWidth / 6; // 시간 열 포함

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowScheduleDropdown(true)}>
          <View style={styles.scheduleButton}>
            <Ionicons name="create-outline" size={24} color="#007AFF" />
            <Text style={styles.scheduleButtonText}>{schedule.name}</Text>
            <Ionicons name="chevron-down" size={16} color="#007AFF" />
          </View>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>시간표</Text>
        
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleRefreshHolidays} disabled={isLoadingHolidays}>
            <Ionicons 
              name={isLoadingHolidays ? "refresh" : "calendar-outline"} 
              size={24} 
              color="#007AFF" 
              style={isLoadingHolidays ? styles.rotating : undefined}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={debugHolidays}>
            <Ionicons name="information-circle-outline" size={24} color="#34C759" />
          </TouchableOpacity>
          <TouchableOpacity onPress={testRecurringEvents}>
            <Ionicons name="bug-outline" size={24} color="#FF9500" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 주간 네비게이션 */}
      <View style={styles.weekNavigation}>
        <TouchableOpacity onPress={() => navigateWeek('prev')}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToToday} style={styles.weekTitle}>
          <Text style={styles.weekTitleText}>
            {currentWeek.format('YYYY년 MM월')}
          </Text>
          <Text style={styles.weekSubtitle}>
            {weekDays[0].format('MM.DD')} - {weekDays[weekDays.length - 1].format('MM.DD')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => navigateWeek('next')}>
          <Ionicons name="chevron-forward" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* 이벤트 요약 정보 표시 (디버깅용) */}
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          총 {events.length}개 일정 
          {events.filter(e => e.is_recurring).length > 0 && 
            ` (반복: ${events.filter(e => e.is_recurring).length}개)`
          }
          {/* ✅ 예외 표시 추가 */}
          {events.filter(e => !!(e as any).exception_id).length > 0 && 
            ` (예외: ${events.filter(e => !!(e as any).exception_id).length}개)`
          }
          {Object.keys(holidays).length > 0 && 
            ` | 공휴일: ${Object.keys(holidays).length}개`
          }
        </Text>
      </View>

      {/* 날짜 헤더 */}
      <View style={styles.dateHeader}>
        <View style={[styles.timeColumn, { width: dayWidth }]} />
        {weekDays.map((day, index) => {
          const holiday = isHoliday(day);
          return (
            <View key={index} style={[styles.dayColumn, { width: dayWidth }]}>
              <Text style={[
                styles.dayName, 
                isToday(day) && styles.todayText,
                holiday && styles.holidayText
              ]}>
                {day.format('ddd')}
              </Text>
              <View style={styles.dayDateContainer}>
                <Text style={[
                  styles.dayDate, 
                  isToday(day) && styles.todayDate,
                  holiday && styles.holidayDate
                ]}>
                  {day.format('DD')}
                </Text>
                {holiday && (
                  <View style={styles.holidayIndicator}>
                    <Text style={styles.holidayName} numberOfLines={1}>
                      {holiday.name}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* 시간표 그리드 */}
      <ScrollView style={styles.timeTable} showsVerticalScrollIndicator={false}>
        {timeSlots.map((time, timeIndex) => (
          <View key={timeIndex} style={styles.timeRow}>
            <View style={[styles.timeCell, { width: dayWidth }]}>
              <Text style={styles.timeText}>{time}</Text>
            </View>
            {weekDays.map((day, dayIndex) => {
              const holiday = isHoliday(day);
              return (
                <TouchableOpacity
                  key={dayIndex}
                  style={[
                    styles.scheduleCell,
                    { width: dayWidth },
                    isToday(day) && styles.todayColumn,
                    holiday && styles.holidayColumn,
                  ]}
                  onPress={() => handleCellPress(day, time)}
                >
                  {getEventsForDateAndTime(day, time).map((event, eventIndex) => {
                    const isException = !!(event as any).exception_id;
                    return (
                      <View
                        key={`${event.id}-${eventIndex}`}
                        style={[
                          styles.eventBlock,
                          getEventStyle(event.category),
                          isException && styles.exceptionEventBlock, // 예외 스타일 추가
                        ]}
                      >
                        <Text style={styles.eventTitle} numberOfLines={1}>
                          {event.title}
                          {event.is_recurring && !isException && (
                            <Text style={styles.recurringIndicator}> ↻</Text>
                          )}
                          {isException && (
                            <Text style={styles.exceptionIndicator}> ✱</Text>
                          )}
                        </Text>
                      </View>
                    );
                  })}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* 스케줄 드롭다운 모달 */}
      <Modal
        visible={showScheduleDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowScheduleDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowScheduleDropdown(false)}
        >
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownTitle}>스케줄 선택</Text>
            
            <ScrollView style={styles.scheduleList} showsVerticalScrollIndicator={false}>
              {allSchedules.map((scheduleItem) => (
                <View key={scheduleItem.id} style={styles.scheduleItem}>
                  <TouchableOpacity
                    style={[
                      styles.scheduleNameButton,
                      scheduleItem.id === schedule.id && styles.activeScheduleItem
                    ]}
                    onPress={() => handleScheduleChange(scheduleItem)}
                  >
                    <Text style={[
                      styles.scheduleNameText,
                      scheduleItem.id === schedule.id && styles.activeScheduleText
                    ]}>
                      {scheduleItem.name}
                    </Text>
                    {scheduleItem.id === schedule.id && (
                      <Ionicons name="checkmark" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEditScheduleName(scheduleItem)}
                  >
                    <Ionicons name="create-outline" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateNewSchedule}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>새 스케줄 만들기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 스케줄 이름 수정 모달 */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContainer}>
            <Text style={styles.editModalTitle}>스케줄 이름 수정</Text>
            
            <TextInput
              style={styles.editInput}
              value={editScheduleName}
              onChangeText={setEditScheduleName}
              placeholder="스케줄 이름을 입력하세요"
              autoFocus={true}
              maxLength={50}
            />
            
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingSchedule(null);
                  setEditScheduleName('');
                }}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.editModalButton, styles.saveButton]}
                onPress={handleSaveScheduleName}
              >
                <Text style={styles.saveButtonText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  scheduleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    maxWidth: 100,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rotating: {
    opacity: 0.6,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
  },
  weekTitle: {
    alignItems: 'center',
  },
  weekTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  weekSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  debugInfo: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#fff3cd',
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
  },
  debugText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  dateHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  timeColumn: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayColumn: {
    paddingVertical: 15,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
  },
  dayName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  dayDateContainer: {
    alignItems: 'center',
    position: 'relative',
    minHeight: 30,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  todayText: {
    color: '#007AFF',
  },
  todayDate: {
    color: '#fff',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  holidayText: {
    color: '#FF3B30',
  },
  holidayDate: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  holidayIndicator: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#FFE6E6',
    borderRadius: 4,
    maxWidth: 60,
  },
  holidayName: {
    fontSize: 8,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '500',
  },
  timeTable: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeCell: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  scheduleCell: {
    minHeight: 60,
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
    padding: 5,
  },
  todayColumn: {
    backgroundColor: '#f0f8ff',
  },
  holidayColumn: {
    backgroundColor: '#fff5f5',
  },
  eventBlock: {
    borderRadius: 4,
    padding: 4,
    marginVertical: 1,
    marginHorizontal: 2,
  },
  eventTitle: {
    fontSize: 10,
    fontWeight: '500',
  },
  recurringIndicator: {
    fontSize: 8,
    opacity: 0.8,
  },
  // 스케줄 드롭다운 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  scheduleList: {
    maxHeight: 250,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduleNameButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeScheduleItem: {
    backgroundColor: '#f0f8ff',
    borderColor: '#007AFF',
  },
  scheduleNameText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  activeScheduleText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  editButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // 스케줄 이름 수정 모달 스타일
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
  },
  editModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  exceptionEventBlock: {
    borderWidth: 2,
    borderColor: '#FF9500',
    borderStyle: 'dashed',
  },
  exceptionIndicator: {
    fontSize: 8,
    opacity: 0.8,
    color: '#FF9500',
  },
});

export default TimeTableScreen;