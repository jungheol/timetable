import moment from 'moment';
import { Event, Schedule } from '../services/DatabaseService';

// 주간 날짜 계산
export const getWeekDays = (schedule: Schedule | null, currentWeek: moment.Moment) => {
  if (!schedule) return [];
  
  const startOfWeek = schedule.show_weekend
    ? currentWeek.clone().startOf('week')  // 일요일 시작
    : currentWeek.clone().startOf('isoWeek'); // 월요일 시작
  
  const days = [];
  const dayCount = schedule.show_weekend ? 7 : 5;
  
  for (let i = 0; i < dayCount; i++) {
    days.push(startOfWeek.clone().add(i, 'day'));
  }
  
  return days;
};

// 시간 슬롯 계산
export const getTimeSlots = (schedule: Schedule | null) => {
  if (!schedule) return [];
  
  const slots = [];
  const start = moment(schedule.start_time, 'HH:mm');
  const end = moment(schedule.end_time, 'HH:mm');
  
  const increment = schedule.time_unit === '30min' ? 30 : 60; // minutes
  
  let current = start.clone();
  while (current.isBefore(end)) {
    slots.push(current.format('HH:mm'));
    current.add(increment, 'minutes');
  }
  
  return slots;
};

// 특정 날짜와 시간에 해당하는 이벤트 찾기
export const getEventsForDateAndTime = (
  events: Event[], 
  date: moment.Moment, 
  time: string
) => {
  const dateStr = date.format('YYYY-MM-DD');
  
  return events.filter(event => {
    // 날짜 확인
    const eventDateMatches = event.event_date === dateStr;
    
    // 시간 확인 - 시작 시간이 현재 시간보다 작거나 같고, 종료 시간이 현재 시간보다 큰 경우
    const eventStartTime = moment(event.start_time, 'HH:mm');
    const eventEndTime = moment(event.end_time, 'HH:mm');
    const currentTime = moment(time, 'HH:mm');
    
    const timeMatches = eventStartTime.isSameOrBefore(currentTime) && eventEndTime.isAfter(currentTime);
    
    return eventDateMatches && timeMatches;
  });
};

// 이벤트 카테고리별 스타일
export const getEventStyle = (category: Event['category']) => {
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

// 날짜 체크 유틸리티
export const isToday = (date: moment.Moment) => {
  return date.isSame(moment(), 'day');
};

// 화면 너비 계산
export const calculateDayWidth = (screenWidth: number, schedule: Schedule | null) => {
  if (!schedule) return screenWidth / 6;
  return schedule.show_weekend ? screenWidth / 8 : screenWidth / 6; // 시간 열 포함
};