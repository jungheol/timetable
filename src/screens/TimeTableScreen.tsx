import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import 'moment/locale/ko';
import DatabaseService, { Event, Schedule } from '../services/DatabaseService';
import { RootStackParamList } from '../../App';

moment.locale('ko');

const { width: screenWidth } = Dimensions.get('window');

// 한국 공휴일 데이터 (2025년 기준)
const holidays = {
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-05-05': '어린이날',
  '2025-05-06': '어린이날 대체공휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-09-06': '추석 연휴',
  '2025-09-07': '추석 연휴',
  '2025-09-08': '추석',
  '2025-09-09': '추석 연휴',
  '2025-10-03': '개천절',
  '2025-10-09': '한글날',
  '2025-12-25': '크리스마스',
};

type TimeTableScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface Props {
  navigation: TimeTableScreenNavigationProp;
}

const TimeTableScreen: React.FC<Props> = ({ navigation }) => {
  const [currentWeek, setCurrentWeek] = useState(moment());
  const [events, setEvents] = useState<Event[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  // 화면에 포커스될 때마다 이벤트 새로고침
  useFocusEffect(
    useCallback(() => {
      if (schedule) {
        loadEvents();
      }
    }, [schedule, currentWeek])
  );

  const loadSchedule = async () => {
    try {
      const activeSchedule = await DatabaseService.getActiveSchedule();
      setSchedule(activeSchedule);
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const loadEvents = useCallback(async () => {
    if (!schedule) return;

    try {
      const weekDays = getWeekDays();
      const startDate = weekDays[0].format('YYYY-MM-DD');
      const endDate = weekDays[weekDays.length - 1].format('YYYY-MM-DD');
      
      const weekEvents = await DatabaseService.getEvents(schedule.id!, startDate, endDate);
      setEvents(weekEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }, [schedule, currentWeek]);

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
    const increment = 60; // minutes
    
    let current = start.clone();
    while (current.isBefore(end)) {
      slots.push(current.format('HH:mm'));
      current.add(increment, 'minutes');
    }
    
    return slots;
  };

  const getEventsForDateAndTime = (date: moment.Moment, time: string) => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter(event => 
      event.event_date === dateStr && 
      event.start_time <= time && 
      event.end_time > time
    );
  };

  const handleCellPress = (date: moment.Moment, time: string) => {
    const dateStr = date.format('YYYY-MM-DD');
    const cellEvents = getEventsForDateAndTime(date, time);
    
    const selectedEvent = cellEvents.length > 0 ? cellEvents[0] : null;
    
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
    return holidays[dateStr as keyof typeof holidays];
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
    setCurrentWeek(moment());
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
        <TouchableOpacity>
          <Ionicons name="create-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>시간표</Text>
        <TouchableOpacity>
          <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
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

      {/* 날짜 헤더 */}
      <View style={styles.dateHeader}>
        <View style={[styles.timeColumn, { width: dayWidth }]} />
        {weekDays.map((day, index) => (
          <View key={index} style={[styles.dayColumn, { width: dayWidth }]}>
            <Text style={[styles.dayName, isToday(day) && styles.todayText]}>
              {day.format('ddd')}
            </Text>
            <View style={styles.dayDateContainer}>
              <Text style={[styles.dayDate, isToday(day) && styles.todayDate]}>
                {day.format('DD')}
              </Text>
              {isHoliday(day) && <View style={styles.holidayDot} />}
            </View>
          </View>
        ))}
      </View>

      {/* 시간표 그리드 */}
      <ScrollView style={styles.timeTable} showsVerticalScrollIndicator={false}>
        {timeSlots.map((time, timeIndex) => (
          <View key={timeIndex} style={styles.timeRow}>
            <View style={[styles.timeCell, { width: dayWidth }]}>
              <Text style={styles.timeText}>{time}</Text>
            </View>
            {weekDays.map((day, dayIndex) => (
              <TouchableOpacity
                key={dayIndex}
                style={[
                  styles.scheduleCell,
                  { width: dayWidth },
                  isToday(day) && styles.todayColumn,
                ]}
                onPress={() => handleCellPress(day, time)}
              >
                {getEventsForDateAndTime(day, time).map((event, eventIndex) => (
                  <View
                    key={eventIndex}
                    style={[
                      styles.eventBlock,
                      getEventStyle(event.category),
                    ]}
                  >
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                  </View>
                ))}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
  holidayDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
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
});

export default TimeTableScreen;