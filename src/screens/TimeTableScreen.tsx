import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { RootStackParamList } from '../../App';

// 분리된 훅들
import { useTimeTableData } from '../hooks/useTimeTableData';
import { useScheduleManagement } from '../hooks/useScheduleManagement';
import { useTimeTableFocus } from '../hooks/useTimeTableFocus';

// 분리된 컴포넌트들 (나중에 React.memo 적용)
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

  // ✅ 통합된 상태 관리 훅 사용
  const {
    currentWeek,
    events,
    schedule,
    holidays,
    isLoadingHolidays,
    isLoadingEvents,
    loadAllData,
    updateStateBatch,
    loadSchedule,
    forceRefreshEvents,
    invalidateCache,
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

  // ✅ 화면 포커스 관리 (간소화된 props)
  useTimeTableFocus({
    schedule,
    loadAllData,
    calculateFocusWeek,
    loadAllSchedules,
  });

  // ✅ 계산된 값들 메모이제이션 (재계산 방지)
  const { weekDays, timeSlots, dayWidth } = useMemo(() => {
    if (!schedule) {
      return { weekDays: [], timeSlots: [], dayWidth: 0 };
    }
  
    const calculatedWeekDays = getWeekDays(schedule, currentWeek);
    const calculatedTimeSlots = getTimeSlots(schedule);
    
    // 기존 calculateDayWidth 함수 사용 (매개변수 순서 맞춤)
    const calculatedDayWidth = calculateDayWidth(screenWidth, schedule);
  
    return {
      weekDays: calculatedWeekDays,
      timeSlots: calculatedTimeSlots,
      dayWidth: calculatedDayWidth
    };
  }, [
    schedule?.id,
    schedule?.show_weekend,
    schedule?.start_time,
    schedule?.end_time,
    schedule?.time_unit,
    currentWeek.format('YYYY-MM-DD'),
    screenWidth
  ]);

  // ✅ 초기 로드 (한 번만 실행)
  useEffect(() => {
    const initializeData = async () => {
      console.log('🚀 [TimeTable] Initializing...');
      
      // 병렬로 실행
      await Promise.all([
        loadSchedule(),
        loadAllSchedules()
      ]);
    };
    
    initializeData();
  }, []); // 빈 의존성 배열로 한 번만 실행

  // ✅ 스케줄이나 주간이 변경되었을 때만 데이터 로드
  useEffect(() => {
    if (schedule && weekDays.length > 0) {
      console.log('🔄 [TimeTable] Schedule or week changed, loading data...');
      loadAllData(schedule, currentWeek, false);
    }
  }, [
    schedule?.id, 
    currentWeek.format('YYYY-MM-DD')
  ]); // 필수 의존성만 포함

  // ✅ 이벤트 핸들러들 메모이제이션
  const handleCellPress = useCallback((date: moment.Moment, time: string) => {
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
        // ✅ 저장 후 즉시 캐시 무효화 + 강제 새로고침
        console.log('🔄 Event saved, invalidating cache and refreshing');
        invalidateCache();
        forceRefreshEvents();
      },
    });
  }, [events, schedule, navigation, invalidateCache, forceRefreshEvents]);

  const handleCreateNewSchedule = useCallback(() => {
    closeScheduleDropdown();
    navigation.navigate('InitialSetupFromMain', {
      isFromModal: true
    });
  }, [closeScheduleDropdown, navigation]);

  // ✅ 스케줄 변경 처리 (통합된 함수 사용)
  const onScheduleChanged = useCallback(async (newSchedule: Schedule) => {
    console.log('🔄 TimeTable: Schedule changing to:', newSchedule.name);
    
    try {
      // ✅ 통합된 loadAllData로 스케줄과 데이터를 한 번에 업데이트
      const focusWeek = calculateFocusWeek(newSchedule);
      await loadAllData(newSchedule, focusWeek, true);
      
      console.log('✅ TimeTable: Schedule and data updated successfully');
    } catch (error) {
      console.error('❌ Error changing schedule:', error);
      Alert.alert('오류', '스케줄 변경 중 오류가 발생했습니다.');
    }
  }, [loadAllData, calculateFocusWeek]);

  const onScheduleUpdated = useCallback((updatedSchedule: Schedule) => {
    updateStateBatch({ schedule: updatedSchedule });
  }, [updateStateBatch]);

  const handleRefreshHolidaysWithAlert = useCallback(async () => {
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
  }, [handleRefreshHolidays]);

  // ✅ 로딩 상태 처리 (초기 로딩과 데이터 로딩 구분)
  if (!schedule && !isLoadingEvents) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>일정표를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ✅ 부드러운 로딩 오버레이 (기존 UI 위에 표시) */}
      {isLoadingEvents && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        </View>
      )}

      {/* 헤더 */}
      <TimeTableHeader
        schedule={schedule!}
        onScheduleDropdownPress={openScheduleDropdown}
        captureRef={captureRef}
        filename={`${schedule!.name}_${currentWeek.format('YYYY-MM-DD')}`}
        onRefreshHolidays={handleRefreshHolidaysWithAlert}
        isLoadingHolidays={isLoadingHolidays}
        events={events}
        holidays={holidays}
        weekDays={weekDays}
        timeSlots={timeSlots}
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

        {/* 시간표 그리드 */}
        <TimeTableGrid
          timeSlots={timeSlots}
          weekDays={weekDays}
          dayWidth={dayWidth}
          events={events}
          holidays={holidays}
          onCellPress={handleCellPress}
        />
      </ViewShot>

      {/* 스케줄 드롭다운 모달 */}
      <ScheduleDropdownModal
        visible={showScheduleDropdown}
        onClose={closeScheduleDropdown}
        schedules={allSchedules}
        currentSchedule={schedule!}
        onScheduleChange={(selectedSchedule) => 
          handleScheduleChange(selectedSchedule, schedule!, onScheduleChanged)
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
        onSave={() => handleSaveScheduleName(schedule!, onScheduleUpdated)}
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 10,
    zIndex: 1000,
    paddingTop: 10,
  },
  loadingIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  captureArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  captureHeader: {
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    backgroundColor: '#f8f9fa',
  },
  captureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  captureSubtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default TimeTableScreen;