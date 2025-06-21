import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { Schedule, Event, Holiday } from '../services/DatabaseService';
import ViewShot from 'react-native-view-shot';
import ScreenshotButton from './ScreenshotButton'; // ✅ 추가
import { 
  getEventsForDateAndTime, 
  getEventStyle, 
  isToday,
} from '../utils/timeTableUtils';

// 타입 정의
interface TimeTableHeaderProps {
  schedule: Schedule;
  onScheduleDropdownPress: () => void;
  captureRef: React.RefObject<ViewShot | null>;
  filename: string;
  onRefreshHolidays: () => Promise<void>;
  isLoadingHolidays: boolean;
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
  isLoading?: boolean;
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

// ✅ 수정된 헤더 컴포넌트
export const TimeTableHeader: React.FC<TimeTableHeaderProps> = ({
  schedule,
  onScheduleDropdownPress,
  captureRef,
  filename,
  onRefreshHolidays,
  isLoadingHolidays,
}) => (
  <View style={headerStyles.container}>
    <TouchableOpacity onPress={onScheduleDropdownPress}>
      <View style={headerStyles.scheduleButton}>
        <Text style={headerStyles.scheduleButtonText}>{schedule.name}</Text>
        <Ionicons name="chevron-down" size={16} color="#007AFF" />
      </View>
    </TouchableOpacity>
        
    <View style={headerStyles.rightButtons}>
      {/* ✅ ScreenshotButton 컴포넌트 사용 */}
      <ScreenshotButton
        captureRef={captureRef}
        filename={filename}
        size={24}
        color="#007AFF"
        style={headerStyles.button}
        onCaptureStart={() => console.log('📸 Capture started')}
        onCaptureEnd={() => console.log('📸 Capture ended')}
        onSuccess={(uri: string) => console.log('📸 Capture success:', uri)}
        onError={(error: any) => console.error('📸 Capture error:', error)}
      />
      
      <TouchableOpacity onPress={onRefreshHolidays} disabled={isLoadingHolidays} style={headerStyles.button}>
        <Ionicons 
          name={isLoadingHolidays ? "refresh" : "calendar-outline"} 
          size={24} 
          color="#007AFF" 
          style={isLoadingHolidays ? headerStyles.rotating : undefined}
        />
      </TouchableOpacity>
    </View>
  </View>
);

// 주간 네비게이션 컴포넌트
export const WeekNavigation: React.FC<WeekNavigationProps> = ({
  currentWeek,
  weekDays,
  onNavigateWeek,
  onGoToToday,
}) => (
  <View style={weekNavigationStyles.container}>
    <TouchableOpacity onPress={() => onNavigateWeek('prev')}>
      <Ionicons name="chevron-back" size={24} color="#007AFF" />
    </TouchableOpacity>
    
    <TouchableOpacity onPress={onGoToToday} style={weekNavigationStyles.titleContainer}>
      <Text style={weekNavigationStyles.title}>
        {currentWeek.format('YYYY년 MM월')}
      </Text>
      <Text style={weekNavigationStyles.subtitle}>
        {weekDays[0]?.format('MM.DD')} - {weekDays[weekDays.length - 1]?.format('MM.DD')}
      </Text>
    </TouchableOpacity>
    
    <TouchableOpacity onPress={() => onNavigateWeek('next')}>
      <Ionicons name="chevron-forward" size={24} color="#007AFF" />
    </TouchableOpacity>
  </View>
);

// 날짜 헤더 컴포넌트
export const DateHeader: React.FC<DateHeaderProps> = ({ weekDays, dayWidth, holidays }) => (
  <View style={dateHeaderStyles.container}>
    <View style={[dateHeaderStyles.timeColumn, { width: dayWidth }]} />
    {weekDays.map((day, index) => {
      const holiday = holidays[day.format('YYYY-MM-DD')];
      return (
        <View key={index} style={[dateHeaderStyles.dayColumn, { width: dayWidth }]}>
          <Text style={[
            dateHeaderStyles.dayName, 
            isToday(day) && dateHeaderStyles.todayText,
            holiday && dateHeaderStyles.holidayText
          ]}>
            {day.format('ddd')}
          </Text>
          <View style={dateHeaderStyles.dayDateContainer}>
            <Text style={[
              dateHeaderStyles.dayDate, 
              isToday(day) && dateHeaderStyles.todayDate,
              holiday && dateHeaderStyles.holidayDate
            ]}>
              {day.format('DD')}
            </Text>
            {holiday && (
              <View style={dateHeaderStyles.holidayIndicator}>
                <Text style={dateHeaderStyles.holidayName} numberOfLines={1}>
                  {holiday.name}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    })}
  </View>
);

// 시간표 그리드 컴포넌트
export const TimeTableGrid: React.FC<TimeTableGridProps> = ({
  timeSlots,
  weekDays,
  dayWidth,
  events,
  holidays,
  onCellPress,
}) => (
  <ScrollView style={gridStyles.container} showsVerticalScrollIndicator={false}>
    {timeSlots.map((time, timeIndex) => (
      <View key={timeIndex} style={gridStyles.timeRow}>
        <View style={[gridStyles.timeCell, { width: dayWidth }]}>
          <Text style={gridStyles.timeText}>{time}</Text>
        </View>
        {weekDays.map((day, dayIndex) => {
          const holiday = holidays[day.format('YYYY-MM-DD')];
          const cellEvents = getEventsForDateAndTime(events, day, time);
          
          return (
            <TouchableOpacity
              key={dayIndex}
              style={[
                gridStyles.scheduleCell,
                { width: dayWidth },
                isToday(day) && gridStyles.todayColumn,
                holiday && gridStyles.holidayColumn,
              ]}
              onPress={() => onCellPress(day, time)}
            >
              {cellEvents.map((event, eventIndex) => {
                const isException = !!(event as any).exception_id;
                return (
                  <View
                    key={`${event.id}-${eventIndex}`}
                    style={[
                      gridStyles.eventBlock,
                      getEventStyle(event.category),
                      isException && gridStyles.exceptionEventBlock,
                    ]}
                  >
                    <Text style={gridStyles.eventTitle} numberOfLines={1}>
                      {event.title}
                      {event.is_recurring && !isException && (
                        <Text style={gridStyles.recurringIndicator}> ↻</Text>
                      )}
                      {isException && (
                        <Text style={gridStyles.exceptionIndicator}> ✱</Text>
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
);

// 스케줄 드롭다운 모달 컴포넌트
export const ScheduleDropdownModal: React.FC<ScheduleDropdownModalProps> = ({
  visible,
  onClose,
  schedules,
  currentSchedule,
  onScheduleChange,
  onEditSchedule,
  onCreateNew,
}) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
    onRequestClose={onClose}
  >
    <TouchableOpacity style={modalStyles.overlay} onPress={onClose}>
      <View style={modalStyles.dropdownContainer}>
        <Text style={modalStyles.dropdownTitle}>스케줄 선택</Text>
        
        <ScrollView style={modalStyles.scheduleList} showsVerticalScrollIndicator={false}>
          {schedules.map((scheduleItem) => (
            <View key={scheduleItem.id} style={modalStyles.scheduleItem}>
              <TouchableOpacity
                style={[
                  modalStyles.scheduleNameButton,
                  scheduleItem.id === currentSchedule.id && modalStyles.activeScheduleItem
                ]}
                onPress={() => onScheduleChange(scheduleItem)}
              >
                <Text style={[
                  modalStyles.scheduleNameText,
                  scheduleItem.id === currentSchedule.id && modalStyles.activeScheduleText
                ]}>
                  {scheduleItem.name}
                </Text>
                {scheduleItem.id === currentSchedule.id && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={modalStyles.editButton}
                onPress={() => onEditSchedule(scheduleItem)}
              >
                <Ionicons name="create-outline" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        
        <TouchableOpacity style={modalStyles.createButton} onPress={onCreateNew}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={modalStyles.createButtonText}>새 스케줄 만들기</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

// 스케줄 편집 모달 컴포넌트
export const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
  visible,
  onClose,
  scheduleName,
  onScheduleNameChange,
  onSave,
}) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={editModalStyles.overlay}>
      <View style={editModalStyles.container}>
        <Text style={editModalStyles.title}>스케줄 이름 수정</Text>
        
        <TextInput
          style={editModalStyles.input}
          value={scheduleName}
          onChangeText={onScheduleNameChange}
          placeholder="스케줄 이름을 입력하세요"
          autoFocus={true}
          maxLength={50}
        />
        
        <View style={editModalStyles.buttons}>
          <TouchableOpacity
            style={[editModalStyles.button, editModalStyles.cancelButton]}
            onPress={onClose}
          >
            <Text style={editModalStyles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[editModalStyles.button, editModalStyles.saveButton]}
            onPress={onSave}
          >
            <Text style={editModalStyles.saveButtonText}>저장</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// 스타일 정의
const headerStyles = StyleSheet.create({
  container: {
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
  },
  scheduleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    maxWidth: 100,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    padding: 4,
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
    backgroundColor: '#f8f9fa',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});

const dateHeaderStyles = StyleSheet.create({
  container: {
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
    paddingVertical: 10,
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
    marginTop: 6,
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

const modalStyles = StyleSheet.create({
  overlay: {
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
});

const editModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
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
});