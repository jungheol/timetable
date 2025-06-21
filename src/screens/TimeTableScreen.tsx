import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import ViewShot from 'react-native-view-shot';
import moment from 'moment';
import DatabaseService, { Schedule } from '../services/DatabaseService';
import ScreenshotButton from '../components/ScreenshotButton';
import { RootStackParamList } from '../../App';

// 분리된 훅들
import { useTimeTableData } from '../hooks/useTimeTableData';
import { useScheduleManagement } from '../hooks/useScheduleManagement';
import { useTimeTableFocus } from '../hooks/useTimeTableFocus';

// 분리된 컴포넌트들
import {
  TimeTableHeader,
  WeekNavigation,
  DateHeader,
  TimeTableGrid,
  ScheduleDropdownModal,
  EditScheduleModal,
} from '../components/TimeTableComponents';

// 분리된 유틸리티들
import { getWeekDays, getTimeSlots, calculateDayWidth } from '../utils/timeTableUtils';

const { width: screenWidth } = Dimensions.get('window');

type TimeTableScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface Props {
  navigation: TimeTableScreenNavigationProp;
}

const TimeTableScreen: React.FC<Props> = ({ navigation }) => {
  // 📸 스크린샷을 위한 ref
  const captureRef = useRef<ViewShot>(null);

  // ✅ 분리된 훅들 사용
  const {
    currentWeek,
    events,
    schedule,
    holidays,
    isLoadingHolidays,
    isLoadingEvents,
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
  } = useTimeTableData();

  const {
    allSchedules,
    showScheduleDropdown,
    showEditModal,
    editScheduleName,
    setEditScheduleName,
    loadAllSchedules,
    handleScheduleChange,
    handleEditScheduleName,
    handleSaveScheduleName,
    closeEditModal,
    openScheduleDropdown,
    closeScheduleDropdown,
  } = useScheduleManagement();

  // 화면 포커스 관리
  useTimeTableFocus({
    schedule,
    currentWeek,
    setSchedule,
    setCurrentWeek,
    calculateFocusWeek,
    loadAllSchedules,
    loadEvents,
    loadHolidaysForCurrentPeriod,
  });

  // 초기 로드
  useEffect(() => {
    loadSchedule();
    loadAllSchedules();
  }, []);

  // ✅ 핸들러들
  const handleCellPress = (date: moment.Moment, time: string) => {
    const dateStr = date.format('YYYY-MM-DD');
    const cellEvents = events.filter(event => {
      const eventDateMatches = event.event_date === dateStr;
      const eventStartTime = moment(event.start_time, 'HH:mm');
      const eventEndTime = moment(event.end_time, 'HH:mm');
      const currentTime = moment(time, 'HH:mm');
      const timeMatches = eventStartTime.isSameOrBefore(currentTime) && eventEndTime.isAfter(currentTime);
      return eventDateMatches && timeMatches;
    });
    
    const selectedEvent = cellEvents.length > 0 ? cellEvents[0] : null;
    
    console.log('🖱️ Cell pressed:', dateStr, time, selectedEvent?.title || 'No event');
    
    navigation.navigate('EventScreen', {
      event: selectedEvent,
      selectedDate: dateStr,
      selectedTime: time,
      scheduleId: schedule!.id!,
      onSave: () => {
        // ✅ 즉시 캐시 무효화 + 강제 새로고침
        console.log('🔄 Event saved, invalidating cache and refreshing');
        invalidateCache();
        forceRefreshEvents();
      },
    });
  };

  const handleCreateNewSchedule = () => {
    closeScheduleDropdown();
    navigation.navigate('InitialSetupFromMain', {
      isFromModal: true
    });
  };

  // ✅ 스케줄 변경 - 모든 딜레이 제거
  const onScheduleChanged = (newSchedule: Schedule) => {
    console.log('🔄 TimeTable: Schedule changing to:', newSchedule.name, '(immediate)');
    
    // ✅ 즉시 스케줄과 주간 업데이트 (useEffect가 이벤트 로딩 처리)
    setSchedule(newSchedule);
    const focusWeek = calculateFocusWeek(newSchedule);
    setCurrentWeek(focusWeek);
    
    console.log('✅ TimeTable: Schedule and week updated immediately');
  };

  const onScheduleUpdated = (updatedSchedule: Schedule) => {
    setSchedule(updatedSchedule);
  };

  const handleRefreshHolidaysWithAlert = async () => {
    try {
      Alert.alert(
        '공휴일 업데이트',
        `공휴일 데이터를 API에서 다시 가져오시겠습니까?\n\n참고: 초기 설정에서 이미 공휴일 데이터가 로드되었으며, 일반적으로 수동 업데이트는 필요하지 않습니다.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '강제 업데이트',
            onPress: async () => {
              try {
                const count = await handleRefreshHolidays();
                
                if (count !== undefined && count > 0) {
                  Alert.alert(
                    '업데이트 완료', 
                    `${new Date().getFullYear()}년 공휴일 ${count}개가 업데이트되었습니다.`
                  );
                } else {
                  Alert.alert(
                    '업데이트 완료', 
                    `API에서 공휴일 데이터를 가져올 수 없습니다.\nAPI 키 등록이 필요할 수 있습니다.`
                  );
                }
              } catch (error) {
                Alert.alert(
                  '업데이트 오류', 
                  'API에서 공휴일 데이터를 가져오는 중 오류가 발생했습니다.\n네트워크 연결과 API 키를 확인해주세요.'
                );
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in refresh holidays:', error);
    }
  };

  // 로딩 상태 처리
  if (!schedule) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>일정표를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 계산된 값들
  const weekDays = getWeekDays(schedule, currentWeek);
  const timeSlots = getTimeSlots(schedule);
  const dayWidth = calculateDayWidth(screenWidth, schedule);

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <TimeTableHeader
        schedule={schedule}
        onScheduleDropdownPress={openScheduleDropdown}
        captureRef={captureRef}
        filename={`${schedule.name}_${currentWeek.format('YYYY-MM-DD')}`}
        onRefreshHolidays={handleRefreshHolidaysWithAlert}
        isLoadingHolidays={isLoadingHolidays}
      />

      {/* 주간 네비게이션 */}
      <WeekNavigation
        currentWeek={currentWeek}
        weekDays={weekDays}
        onNavigateWeek={navigateWeek}
        onGoToToday={goToToday}
        isLoading={isLoadingEvents}
      />

      {/* 📸 캡처 대상 영역 */}
      <ViewShot ref={captureRef} style={styles.captureArea}>
        {/* 날짜 헤더 */}
        <DateHeader
          weekDays={weekDays}
          dayWidth={dayWidth}
          holidays={holidays}
        />

        {/* ✅ 로딩 오버레이와 시간표 그리드 */}
        <View style={styles.gridContainer}>
          <TimeTableGrid
            timeSlots={timeSlots}
            weekDays={weekDays}
            dayWidth={dayWidth}
            events={events}
            holidays={holidays}
            onCellPress={handleCellPress}
            isLoading={isLoadingEvents}
          />
          
          {/* ✅ 부드러운 로딩 오버레이 */}
          {isLoadingEvents && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingIndicator}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            </View>
          )}
        </View>
      </ViewShot>

      {/* 스케줄 드롭다운 모달 */}
      <ScheduleDropdownModal
        visible={showScheduleDropdown}
        onClose={closeScheduleDropdown}
        schedules={allSchedules}
        currentSchedule={schedule}
        onScheduleChange={(selectedSchedule) => 
          handleScheduleChange(selectedSchedule, schedule, onScheduleChanged)
        }
        onEditSchedule={handleEditScheduleName}
        onCreateNew={handleCreateNewSchedule}
      />

      {/* 스케줄 편집 모달 */}
      <EditScheduleModal
        visible={showEditModal}
        onClose={closeEditModal}
        scheduleName={editScheduleName}
        onScheduleNameChange={setEditScheduleName}
        onSave={() => handleSaveScheduleName(schedule, onScheduleUpdated)}
      />
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  captureArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  gridContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 10,
    zIndex: 1000,
    paddingTop: 10,
  },
  loadingIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default TimeTableScreen;