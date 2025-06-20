import moment from 'moment';
import { Event, Schedule, Academy } from '../services/DatabaseService';
import { EventOptions, WEEKDAYS, CATEGORY_OPTIONS, SUBJECT_OPTIONS } from '../types/eventTypes';

// ✅ 시간 계산 헬퍼 함수들
export const calculateEndTime = (startTime: string, schedule: Schedule | null): string => {
  if (!schedule || !startTime) return '';
  
  const start = moment(startTime, 'HH:mm');
  const interval = schedule.time_unit === '30min' ? 30 : 60;
  const endTime = start.clone().add(interval, 'minutes').format('HH:mm');
  
  return endTime;
};

export const isValidTimeOption = (time: string, timeOptions: string[]): boolean => {
  return timeOptions.includes(time);
};

export const findNextValidTime = (currentTime: string, timeOptions: string[]): string | null => {
  return timeOptions.find(time => 
    moment(time, 'HH:mm').isAfter(moment(currentTime, 'HH:mm'))
  ) || null;
};

// ✅ 시간 옵션 생성
export const generateTimeOptions = (schedule: Schedule | null): string[] => {
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
  
  return timeOptions;
};

// ✅ 이벤트 옵션 생성
export const generateEventOptions = (
  schedule: Schedule | null, 
  academies: Academy[]
): EventOptions => {
  const availableDays = Boolean(schedule?.show_weekend)
    ? WEEKDAYS 
    : WEEKDAYS.slice(0, 5);

  const timeOptions = generateTimeOptions(schedule);

  const academyOptions = academies.map(academy => ({
    value: academy.id.toString(),
    label: `${academy.name} (${academy.subject})`
  }));

  return {
    weekdays: WEEKDAYS,
    availableDays,
    timeOptions,
    categoryOptions: CATEGORY_OPTIONS,
    subjectOptions: SUBJECT_OPTIONS,
    academyOptions,
  };
};

// ✅ 데이터 변환 헬퍼
export const sanitizeEventData = (eventData: any): Event => ({
  ...eventData,
  is_recurring: Boolean(eventData.is_recurring),
  del_yn: Boolean(eventData.del_yn),
});

// ✅ 현재 요일 키 찾기
export const getCurrentDayKey = (selectedDate: string): string | undefined => {
  const currentDayIndex = moment(selectedDate).day();
  return WEEKDAYS.find(day => day.index === currentDayIndex)?.key;
};

// ✅ 디버깅 헬퍼
export const logFormState = (formData: any, prefix: string = 'Form State') => {
  console.log(`🔍 === ${prefix} ===`);
  console.log('Title:', `"${formData.title}"`);
  console.log('Start Time:', `"${formData.startTime}"`);
  console.log('End Time:', `"${formData.endTime}"`);
  console.log('Category:', `"${formData.category}"`);
  console.log('Academy Name:', `"${formData.academyName}"`);
  console.log('Is Recurring:', formData.isRecurring);
  console.log('Selected Days:', Array.from(formData.selectedDays || []));
  console.log(`=== End ${prefix} ===`);
};

// ✅ 시간 유효성 검사
export const validateTimeRange = (startTime: string, endTime: string): boolean => {
  if (!startTime || !endTime) return false;
  return moment(startTime, 'HH:mm').isBefore(moment(endTime, 'HH:mm'));
};

// ✅ 이벤트 제목 결정
export const determineEventTitle = (category: Event['category'], title: string, academyName: string): string => {
  return category === '학원' ? academyName : title;
};