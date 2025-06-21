import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  TouchableWithoutFeedback,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import moment from 'moment';

import { Schedule, Event, Holiday } from '../services/DatabaseService';
import ScreenshotButton from './ScreenshotButton';
import PDFExportButton from './PDFExportButton'; // 새로 추가

// 확장된 Event 타입 (JOIN으로 가져온 academy 정보 포함)
interface ExtendedEvent extends Event {
  academy_name?: string;
  academy_subject?: string;
}

// Props 인터페이스들
interface TimeTableHeaderProps {
  schedule: Schedule;
  onScheduleDropdownPress: () => void;
  captureRef: React.RefObject<ViewShot | null>;
  filename: string;
  onRefreshHolidays: () => void;
  isLoadingHolidays: boolean;
  // PDF 내보내기를 위한 추가 props
  events: Event[];
  holidays: { [key: string]: Holiday }; // 객체 형태로 수정
  weekDays: moment.Moment[];
  timeSlots: string[];
}

interface WeekNavigationProps {
  currentWeek: moment.Moment;
  weekDays: moment.Moment[];
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  isLoading?: boolean;
}

interface DateHeaderProps {
  weekDays: moment.Moment[];
  dayWidth: number;
  holidays: { [key: string]: Holiday };
}

interface TimeTableGridProps {
  timeSlots: string[];
  weekDays: moment.Moment[];
  dayWidth: number;
  events: Event[];
  holidays: { [key: string]: Holiday };
  onCellPress: (date: moment.Moment, time: string) => void;
}

interface ScheduleDropdownModalProps {
  visible: boolean;
  onClose: () => void;
  schedules: Schedule[];
  currentSchedule: Schedule;
  onScheduleChange: (schedule: Schedule) => void;
  onEditSchedule: (schedule: Schedule) => void;
  onCreateNew: () => void;
}

interface EditScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  scheduleName: string;
  onScheduleNameChange: (name: string) => void;
  onSave: () => void;
}

// 유틸리티 함수들
const isToday = (date: moment.Moment): boolean => {
  return date.isSame(moment(), 'day');
};

const isSunday = (date: moment.Moment): boolean => {
  return date.day() === 0; // 0 = 일요일
};

const getEventsForDateAndTime = (events: Event[], date: moment.Moment, time: string): ExtendedEvent[] => {
  const dateStr = date.format('YYYY-MM-DD');
  return events.filter(event => {
    const eventDateMatches = event.event_date === dateStr;
    const eventStartTime = moment(event.start_time, 'HH:mm');
    const eventEndTime = moment(event.end_time, 'HH:mm');
    const currentTime = moment(time, 'HH:mm');
    const timeMatches = eventStartTime.isSameOrBefore(currentTime) && eventEndTime.isAfter(currentTime);
    return eventDateMatches && timeMatches;
  }) as ExtendedEvent[];
};

const getEventStyle = (category: string) => {
  const styles = {
    '학원': { backgroundColor: '#E3F2FD', color: '#1976D2' },
    '학교': { backgroundColor: '#FFF3E0', color: '#F57C00' },
    '개인공부': { backgroundColor: '#F3E5F5', color: '#7B1FA2' },
    '기타': { backgroundColor: '#E8F5E8', color: '#388E3C' },
  };
  return styles[category as keyof typeof styles] || styles['기타'];
};

// 시간표 헤더 컴포넌트
export const TimeTableHeader: React.FC<TimeTableHeaderProps> = ({
  schedule,
  onScheduleDropdownPress,
  captureRef,
  filename,
  onRefreshHolidays,
  isLoadingHolidays,
  events,
  holidays,
  weekDays,
  timeSlots,
}) => {
  return (
    <View style={headerStyles.container}>
      <TouchableOpacity style={headerStyles.scheduleButton} onPress={onScheduleDropdownPress}>
        <Text style={headerStyles.scheduleButtonText} numberOfLines={1}>
          {schedule.name}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#007AFF" />
      </TouchableOpacity>
      
      <View style={headerStyles.rightButtons}>
        <TouchableOpacity 
          style={[headerStyles.button, isLoadingHolidays && headerStyles.rotating]} 
          onPress={onRefreshHolidays}
          disabled={isLoadingHolidays}
        >
          <Ionicons 
            name={isLoadingHolidays ? "refresh" : "calendar"} 
            size={20} 
            color="#007AFF" 
          />
        </TouchableOpacity>
        
        {/* PDF 내보내기 버튼 */}
        <PDFExportButton
          schedule={schedule}
          events={events}
          holidays={holidays}
          weekDays={weekDays}
          timeSlots={timeSlots}
          size={20}
          color="#007AFF"
          style={headerStyles.button}
          onExportStart={() => console.log('📄 PDF export starting...')}
          onSuccess={(uri) => console.log('✅ PDF exported:', uri)}
          onError={(error) => console.error('❌ PDF export error:', error)}
        />
        
        {/* 기존 ScreenshotButton */}
        <ScreenshotButton
          captureRef={captureRef}
          filename={filename}
          size={20}
          color="#007AFF"
          style={headerStyles.button}
          onCaptureStart={() => console.log('📸 Screenshot starting...')}
          onSuccess={(uri) => console.log('✅ Screenshot saved:', uri)}
          onError={(error) => console.error('❌ Screenshot error:', error)}
        />
      </View>
    </View>
  );
};

// 주간 네비게이션 컴포넌트
export const WeekNavigation: React.FC<WeekNavigationProps> = ({
  currentWeek,
  weekDays,
  onNavigateWeek,
  onGoToToday,
  isLoading = false,
}) => {
  const formatWeekRange = () => {
    if (weekDays.length === 0) return '';
    const start = weekDays[0];
    const end = weekDays[weekDays.length - 1];
    return `${start.format('M.D')} - ${end.format('M.D')}`;
  };

  return (
    <View style={weekNavigationStyles.container}>
      <TouchableOpacity onPress={() => onNavigateWeek('prev')} disabled={isLoading}>
        <Ionicons name="chevron-back" size={24} color={isLoading ? "#ccc" : "#007AFF"} />
      </TouchableOpacity>
      
      <TouchableOpacity style={weekNavigationStyles.titleContainer} onPress={onGoToToday}>
        <Text style={weekNavigationStyles.title}>
          {currentWeek.format('YYYY년 M월')}
        </Text>
        <Text style={weekNavigationStyles.subtitle}>
          {formatWeekRange()}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => onNavigateWeek('next')} disabled={isLoading}>
        <Ionicons name="chevron-forward" size={24} color={isLoading ? "#ccc" : "#007AFF"} />
      </TouchableOpacity>
    </View>
  );
};

// 날짜 헤더 컴포넌트 - 일요일 색상 추가
export const DateHeader: React.FC<DateHeaderProps> = ({ weekDays, dayWidth, holidays }) => {
  return (
    <View style={dateHeaderStyles.container}>
      <View style={dateHeaderStyles.timeSlot} />
      {weekDays.map((day, index) => {
        const dayKey = day.format('YYYY-MM-DD');
        const holiday = holidays[dayKey];
        const isTodayDay = isToday(day);
        const isHolidayDay = !!holiday;
        const isSundayDay = isSunday(day); // 일요일 체크 추가

        return (
          <View 
            key={index} 
            style={[
              dateHeaderStyles.dayHeader,
              { width: dayWidth },
              isTodayDay && dateHeaderStyles.todayHeader,
              (isHolidayDay || isSundayDay) && dateHeaderStyles.holidayHeader, // 일요일도 공휴일 스타일 적용
            ]}
          >
            <Text style={[
              dateHeaderStyles.dayName,
              isTodayDay && dateHeaderStyles.todayText,
              (isHolidayDay || isSundayDay) && dateHeaderStyles.holidayText, // 일요일도 공휴일 텍스트 색상 적용
            ]}>
              {day.format('ddd')}
            </Text>
            <Text style={[
              dateHeaderStyles.dayDate,
              isTodayDay && dateHeaderStyles.todayText,
              (isHolidayDay || isSundayDay) && dateHeaderStyles.holidayText, // 일요일도 공휴일 텍스트 색상 적용
            ]}>
              {day.format('M/D')}
            </Text>
            {holiday && (
              <Text style={dateHeaderStyles.holidayName} numberOfLines={1}>
                {holiday.name}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

// 시간표 그리드 컴포넌트 - 일요일 색상 추가
export const TimeTableGrid: React.FC<TimeTableGridProps> = ({
  timeSlots,
  weekDays,
  dayWidth,
  events,
  holidays,
  onCellPress,
}) => {
  return (
    <ScrollView style={gridStyles.container} showsVerticalScrollIndicator={false}>
      {timeSlots.map((time, timeIndex) => (
        <View key={timeIndex} style={gridStyles.timeRow}>
          <View style={gridStyles.timeSlot}>
            <Text style={gridStyles.timeText}>{time}</Text>
          </View>
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDateAndTime(events, day, time);
            const hasEvent = dayEvents.length > 0;
            const dayKey = day.format('YYYY-MM-DD');
            const isHolidayDay = !!holidays[dayKey];
            const isTodayDay = isToday(day);
            const isSundayDay = isSunday(day); // 일요일 체크 추가

            return (
              <TouchableOpacity
                key={dayIndex}
                style={[
                  gridStyles.timeCell,
                  { width: dayWidth },
                  hasEvent && gridStyles.eventCell,
                  isTodayDay && gridStyles.todayCell,
                  (isHolidayDay || isSundayDay) && gridStyles.holidayCell, // 일요일도 공휴일 셀 스타일 적용
                ]}
                onPress={() => onCellPress(day, time)}
                activeOpacity={0.7}
              >
                {hasEvent && (
                  <View style={[
                    gridStyles.eventContent,
                    { backgroundColor: getEventStyle(dayEvents[0].category).backgroundColor }
                  ]}>
                    <Text 
                      style={[
                        gridStyles.eventTitle,
                        { color: getEventStyle(dayEvents[0].category).color }
                      ]}
                      numberOfLines={1}
                    >
                      {dayEvents[0].title}
                    </Text>
                    {dayEvents[0].academy_name && (
                      <Text 
                        style={[
                          gridStyles.eventSubtitle,
                          { color: getEventStyle(dayEvents[0].category).color }
                        ]}
                        numberOfLines={1}
                      >
                        {dayEvents[0].academy_name}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
};

// 스케줄 드롭다운 모달 컴포넌트
export const ScheduleDropdownModal: React.FC<ScheduleDropdownModalProps> = ({
  visible,
  onClose,
  schedules,
  currentSchedule,
  onScheduleChange,
  onEditSchedule,
  onCreateNew,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={modalStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={modalStyles.dropdown}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {schedules.map((schedule, index) => (
                  <TouchableOpacity
                    key={schedule.id}
                    style={[
                      modalStyles.scheduleItem,
                      schedule.id === currentSchedule.id && modalStyles.selectedScheduleItem,
                      index === schedules.length - 1 && { borderBottomWidth: 0 }
                    ]}
                    onPress={() => {
                      onScheduleChange(schedule);
                      onClose();
                    }}
                  >
                    <View style={modalStyles.scheduleInfo}>
                      <Text style={[
                        modalStyles.scheduleName,
                        schedule.id === currentSchedule.id && modalStyles.selectedScheduleName
                      ]}>
                        {schedule.name}
                      </Text>
                      <Text style={modalStyles.scheduleTime}>
                        {schedule.start_time} - {schedule.end_time}
                      </Text>
                    </View>
                    {schedule.id === currentSchedule.id && (
                      <TouchableOpacity
                        style={modalStyles.editButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          onEditSchedule(schedule);
                          onClose();
                        }}
                      >
                        <Ionicons name="create-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
                
                <TouchableOpacity
                  style={modalStyles.createButton}
                  onPress={() => {
                    onCreateNew();
                    onClose();
                  }}
                >
                  <Ionicons name="add" size={20} color="#007AFF" />
                  <Text style={modalStyles.createButtonText}>새 일정표 만들기</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// 스케줄 편집 모달 컴포넌트
export const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
  visible,
  onClose,
  scheduleName,
  onScheduleNameChange,
  onSave,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={editModalStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={editModalStyles.modal}>
              <View style={editModalStyles.header}>
                <Text style={editModalStyles.title}>일정표 이름 변경</Text>
                <TouchableOpacity onPress={onClose} style={editModalStyles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={editModalStyles.content}>
                <TextInput
                  style={editModalStyles.input}
                  value={scheduleName}
                  onChangeText={onScheduleNameChange}
                  placeholder="일정표 이름을 입력하세요"
                  maxLength={50}
                  autoFocus
                />
                
                <TouchableOpacity
                  style={[
                    editModalStyles.saveButton,
                    !scheduleName.trim() && editModalStyles.saveButtonDisabled
                  ]}
                  onPress={onSave}
                  disabled={!scheduleName.trim()}
                >
                  <Text style={editModalStyles.saveButtonText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// 스타일 정의들
const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 20,
  },
  scheduleButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  rotating: {
    opacity: 0.6,
  },
});

const weekNavigationStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
});

const dateHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  timeSlot: {
    width: 60,
    height: 60,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#dee2e6',
  },
  dayHeader: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#dee2e6',
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  todayHeader: {
    backgroundColor: '#e3f2fd',
  },
  holidayHeader: {
    backgroundColor: '#ffebee',
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  dayDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  todayText: {
    color: '#1976d2',
  },
  holidayText: {
    color: '#c62828',
  },
  holidayName: {
    fontSize: 10,
    color: '#c62828',
    marginTop: 2,
    textAlign: 'center',
  },
});

const gridStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeSlot: {
    width: 60,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#dee2e6',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  timeCell: {
    height: 50,
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
    backgroundColor: '#fff',
    padding: 2,
  },
  eventCell: {
    backgroundColor: '#f8f9fa',
  },
  todayCell: {
    backgroundColor: '#f3f8ff',
  },
  holidayCell: {
    backgroundColor: '#fefefe',
  },
  eventContent: {
    flex: 1,
    borderRadius: 4,
    padding: 4,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  eventSubtitle: {
    fontSize: 9,
    lineHeight: 11,
    marginTop: 1,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedScheduleItem: {
    backgroundColor: '#f0f8ff',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  selectedScheduleName: {
    color: '#007AFF',
    fontWeight: '600',
  },
  scheduleTime: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    padding: 8,
    marginLeft: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    margin: 8,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
});

const editModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});