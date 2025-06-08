import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import DatabaseService, { Schedule } from '../services/DatabaseService';
import HolidayService from '../services/HolidayService';
import CustomPicker from '../components/CustomPicker';

interface Props {
  onSetupComplete?: () => void;
  navigation?: any;
  route?: any;
}

const InitialSetupScreen: React.FC<Props> = ({ onSetupComplete, navigation, route }) => {
  const [timeUnit, setTimeUnit] = useState<'30min' | '1hour'>('1hour');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [showWeekend, setShowWeekend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  // 공휴일 로딩 상태
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [holidayLoadStep, setHolidayLoadStep] = useState('');
  const [holidayLoadComplete, setHolidayLoadComplete] = useState(false);

  // 컴포넌트 마운트 시 백그라운드에서 공휴일 로딩 시작
  useEffect(() => {
    initializeHolidaysInBackground();
  }, []);

  // 백그라운드에서 공휴일 데이터 초기화
  const initializeHolidaysInBackground = async () => {
    try {
      console.log('🎌 [Setup] Starting background holiday initialization...');
      setIsLoadingHolidays(true);
      setHolidayLoadStep('공휴일 데이터를 확인하는 중...');
      
      // DB에서 현재 연도와 다음 연도 공휴일 확인
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      
      const currentYearHolidays = await DatabaseService.getHolidaysByYear(currentYear);
      const nextYearHolidays = await DatabaseService.getHolidaysByYear(nextYear);
      
      console.log(`🎌 [Setup] Current year (${currentYear}) holidays in DB: ${currentYearHolidays.length}`);
      console.log(`🎌 [Setup] Next year (${nextYear}) holidays in DB: ${nextYearHolidays.length}`);
      
      let needsCurrentYear = currentYearHolidays.length === 0;
      let needsNextYear = nextYearHolidays.length === 0;
      
      if (needsCurrentYear || needsNextYear) {
        setHolidayLoadStep('API에서 공휴일 정보를 가져오는 중...');
        
        if (needsCurrentYear) {
          console.log(`🎌 [Setup] Fetching ${currentYear} holidays from API...`);
          try {
            const fetchedCurrentYear = await HolidayService.getHolidaysForYear(currentYear);
            console.log(`🎌 [Setup] Fetched ${fetchedCurrentYear.length} holidays for ${currentYear}`);
            setHolidayLoadStep(`${currentYear}년 공휴일 ${fetchedCurrentYear.length}개 로드 완료`);
          } catch (error) {
            console.warn(`🎌 [Setup] Failed to fetch ${currentYear} holidays:`, error);
            setHolidayLoadStep(`${currentYear}년 공휴일 로드 실패`);
          }
        }
        
        if (needsNextYear) {
          console.log(`🎌 [Setup] Fetching ${nextYear} holidays from API...`);
          try {
            const fetchedNextYear = await HolidayService.getHolidaysForYear(nextYear);
            console.log(`🎌 [Setup] Fetched ${fetchedNextYear.length} holidays for ${nextYear}`);
            setHolidayLoadStep(`${nextYear}년 공휴일 ${fetchedNextYear.length}개 로드 완료`);
          } catch (error) {
            console.warn(`🎌 [Setup] Failed to fetch ${nextYear} holidays:`, error);
            setHolidayLoadStep(`${nextYear}년 공휴일 로드 실패`);
          }
        }
        
        setHolidayLoadStep('공휴일 데이터 준비 완료');
      } else {
        setHolidayLoadStep('기존 공휴일 데이터 사용');
        console.log('🎌 [Setup] Using existing holiday data from DB');
      }
      
      // 최종 확인
      const finalCurrentYearHolidays = await DatabaseService.getHolidaysByYear(currentYear);
      const finalNextYearHolidays = await DatabaseService.getHolidaysByYear(nextYear);
      
      console.log(`🎌 [Setup] Final holiday count - ${currentYear}: ${finalCurrentYearHolidays.length}, ${nextYear}: ${finalNextYearHolidays.length}`);
      
      setHolidayLoadComplete(true);
      
    } catch (error) {
      console.error('🎌 [Setup] Holiday initialization error:', error);
      setHolidayLoadStep('공휴일 데이터 로드 실패 (선택사항)');
      setHolidayLoadComplete(true); // 실패해도 완료로 처리
    } finally {
      setIsLoadingHolidays(false);
    }
  };
  // timeUnit에 따른 시간 옵션 생성 (메모화)
  const timeOptions = useMemo(() => {
    const options: string[] = [];
    const increment = timeUnit === '30min' ? 30 : 60;
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += increment) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    
    return options;
  }, [timeUnit]);

  // timeUnit이 변경될 때 시간 값들을 가장 가까운 유효한 시간으로 조정
  const adjustTimeToUnit = useCallback((time: string, unit: '30min' | '1hour') => {
    const [hour, minute] = time.split(':').map(Number);
    
    if (unit === '1hour') {
      // 1시간 단위일 때는 분을 0으로 설정
      return `${hour.toString().padStart(2, '0')}:00`;
    } else {
      // 30분 단위일 때는 가장 가까운 30분 단위로 조정
      const adjustedMinute = minute < 15 ? 0 : minute < 45 ? 30 : 0;
      const adjustedHour = minute >= 45 ? (hour + 1) % 24 : hour;
      return `${adjustedHour.toString().padStart(2, '0')}:${adjustedMinute.toString().padStart(2, '0')}`;
    }
  }, []);

  const handleTimeUnitChange = useCallback((unit: '30min' | '1hour') => {
    const newStartTime = adjustTimeToUnit(startTime, unit);
    const newEndTime = adjustTimeToUnit(endTime, unit);
    
    setTimeUnit(unit);
    setStartTime(newStartTime);
    setEndTime(newEndTime);
  }, [startTime, endTime, adjustTimeToUnit]);

  const handleStartTimeConfirm = (selectedTime: string) => {
    setStartTime(selectedTime);
    
    // 시작시간이 종료시간보다 크거나 같으면 종료시간을 자동 조정
    if (selectedTime >= endTime) {
      const [hour, minute] = selectedTime.split(':').map(Number);
      const increment = timeUnit === '30min' ? 30 : 60;
      let nextHour = hour;
      let nextMinute = minute + increment;
      
      if (nextMinute >= 60) {
        nextHour = (nextHour + 1) % 24;
        nextMinute = 0;
      }
      
      const newEndTime = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
      setEndTime(newEndTime);
    }
    setShowStartTimePicker(false);
  };

  const handleEndTimeConfirm = (selectedTime: string) => {
    if (selectedTime <= startTime) {
      Alert.alert('알림', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    setEndTime(selectedTime);
    setShowEndTimePicker(false);
  };

  // 공휴일 데이터 초기화 (제거 - 이제 백그라운드에서 처리)
  // const initializeHolidays = async () => { ... } 

  const handleSave = async () => {
    if (startTime >= endTime) {
      Alert.alert('오류', '시작 시간은 종료 시간보다 빨라야 합니다.');
      return;
    }
  
    setIsLoading(true);
  
    try {
      console.log('🚀 [Setup] Starting schedule setup...');
  
      // 1. 먼저 모든 기존 스케줄을 비활성화 (더 확실한 방법)
      const existingSchedule = await DatabaseService.getActiveSchedule();
      console.log('🔍 [Setup] Existing active schedule:', existingSchedule);
      
      if (existingSchedule) {
        console.log('🔄 [Setup] Deactivating existing schedule:', existingSchedule.name);
        await DatabaseService.updateSchedule({
          ...existingSchedule,
          is_active: false,
        });
        console.log('✅ [Setup] Existing schedule deactivated');
        
        // 비활성화 확인
        const checkDeactivated = await DatabaseService.getActiveSchedule();
        console.log('🔍 [Setup] After deactivation check:', checkDeactivated);
      }
  
      // 2. 새 일정표 생성
      const newSchedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'> = {
        name: '내 일정표',
        start_time: startTime,
        end_time: endTime,
        show_weekend: showWeekend,
        is_active: true,
        time_unit: timeUnit,
        del_yn: false,
      };
  
      console.log('📝 [Setup] Creating new schedule:', newSchedule);
      const newScheduleId = await DatabaseService.createSchedule(newSchedule);
      console.log('✅ [Setup] New schedule created with ID:', newScheduleId);
      
      // 3. 약간의 지연 후 검증 (DB 업데이트 완료 대기)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 4. 생성된 스케줄이 실제로 활성화되었는지 확인
      const verifySchedule = await DatabaseService.getActiveSchedule();
      console.log('🔍 [Setup] Verification - Active schedule after creation:', verifySchedule);
      
      if (!verifySchedule || verifySchedule.id !== newScheduleId) {
        console.error('❌ [Setup] Schedule activation verification failed!');
        console.error('Expected ID:', newScheduleId, 'Got:', verifySchedule?.id);
        
        // 강제로 활성화 시도
        console.log('🔧 [Setup] Attempting to force activate new schedule...');
        const createdSchedule = await DatabaseService.getScheduleById(newScheduleId);
        if (createdSchedule) {
          await DatabaseService.updateSchedule({
            ...createdSchedule,
            is_active: true,
          });
          
          // 재검증
          const reVerifySchedule = await DatabaseService.getActiveSchedule();
          console.log('🔍 [Setup] Re-verification after force activation:', reVerifySchedule);
          
          if (!reVerifySchedule || reVerifySchedule.id !== newScheduleId) {
            throw new Error('Schedule activation failed even after force activation');
          }
        } else {
          throw new Error('Created schedule not found');
        }
      }
      
      console.log('✅ [Setup] Schedule setup completed successfully');
      
      // 공휴일 로딩 대기...
      if (!holidayLoadComplete && isLoadingHolidays) {
        console.log('🎌 [Setup] Waiting for holiday loading to complete...');
        
        const maxWaitTime = 3000;
        const startWaitTime = Date.now();
        
        while (!holidayLoadComplete && (Date.now() - startWaitTime) < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (holidayLoadComplete) {
          console.log('🎌 [Setup] Holiday loading completed during wait');
        } else {
          console.log('🎌 [Setup] Holiday loading timeout, proceeding anyway');
        }
      }
      
      // 설정 완료 콜백 호출
      if (route?.params) {
        console.log('🎉 [Setup] Modal completion - going back...');
        navigation.goBack();
      } else if (onSetupComplete) {
        console.log('🎉 [Setup] Main completion callback...');
        onSetupComplete();
      } else {
        console.log('🎉 [Setup] No callback provided, setup completed');
      }
    } catch (error) {
      console.error('❌ [Setup] Error during setup:', error);
      Alert.alert('오류', '일정표를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const LoadingIndicator = () => (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingTitle}>설정을 완료하는 중...</Text>
        <Text style={styles.loadingText}>일정표 저장 중</Text>
        {!holidayLoadComplete && (
          <Text style={styles.loadingSubText}>
            (공휴일 데이터는 백그라운드에서 처리됩니다)
          </Text>
        )}
        <Text style={styles.loadingDescription}>
          잠시만 기다려주세요
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>일정표 설정</Text>
        <Text style={styles.subtitle}>
          초등학생의 일정을 효과적으로 관리하기 위해{'\n'}
          시간표를 설정해주세요.
        </Text>

        {/* 시간 단위 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>시간 표시 설정</Text>
          <View style={styles.optionContainer}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                timeUnit === '30min' && styles.selectedOption,
              ]}
              onPress={() => handleTimeUnitChange('30min')}
            >
              <Text
                style={[
                  styles.optionText,
                  timeUnit === '30min' && styles.selectedOptionText,
                ]}
              >
                30분 단위
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                timeUnit === '1hour' && styles.selectedOption,
              ]}
              onPress={() => handleTimeUnitChange('1hour')}
            >
              <Text
                style={[
                  styles.optionText,
                  timeUnit === '1hour' && styles.selectedOptionText,
                ]}
              >
                1시간 단위
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.unitDescription}>
            선택한 단위에 따라 시간표에서 시간 간격이 조정됩니다.
          </Text>
        </View>

        {/* 시간 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>하루 시간 설정</Text>
          
          {/* 시작 시간 설정 */}
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowStartTimePicker(true)}
          >
            <View style={styles.timeButtonContent}>
              <Text style={styles.timeButtonLabel}>시작 시간</Text>
              <View style={styles.timeButtonValue}>
                <Text style={styles.timeButtonText}>{startTime}</Text>
                <Ionicons name="chevron-down" size={20} color="#007AFF" />
              </View>
            </View>
          </TouchableOpacity>
          
          {/* 종료 시간 설정 */}
          <TouchableOpacity
            style={[styles.timeButton, { marginTop: 10 }]}
            onPress={() => setShowEndTimePicker(true)}
          >
            <View style={styles.timeButtonContent}>
              <Text style={styles.timeButtonLabel}>종료 시간</Text>
              <View style={styles.timeButtonValue}>
                <Text style={styles.timeButtonText}>{endTime}</Text>
                <Ionicons name="chevron-down" size={20} color="#007AFF" />
              </View>
            </View>
          </TouchableOpacity>
          
          <Text style={styles.unitDescription}>
            하루 일정표에 표시될 시간 범위를 설정하세요.
          </Text>
        </View>

        {/* 주말 표시 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>주말 표시</Text>
          <View style={styles.optionContainer}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                !showWeekend && styles.selectedOption,
              ]}
              onPress={() => setShowWeekend(false)}
            >
              <Text
                style={[
                  styles.optionText,
                  !showWeekend && styles.selectedOptionText,
                ]}
              >
                평일만
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                showWeekend && styles.selectedOption,
              ]}
              onPress={() => setShowWeekend(true)}
            >
              <Text
                style={[
                  styles.optionText,
                  showWeekend && styles.selectedOptionText,
                ]}
              >
                주말 포함
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.unitDescription}>
            {showWeekend ? '월~일 7일간 표시됩니다.' : '월~금 5일간 표시됩니다.'}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? '설정 중...' : '설정 완료'}
          </Text>
        </TouchableOpacity>

        {/* 설정 완료 시 공휴일 로딩에 대한 안내 */}
        <View style={styles.holidayNoticeContainer}>
          <Text style={styles.holidayNotice}>
            💡 공휴일 정보를 백그라운드에서 자동으로 로드합니다.
          </Text>
          {isLoadingHolidays && (
            <View style={styles.holidayStatus}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.holidayStatusText}>{holidayLoadStep}</Text>
            </View>
          )}
          {holidayLoadComplete && !isLoadingHolidays && (
            <View style={styles.holidayStatus}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={[styles.holidayStatusText, { color: '#34C759' }]}>
                공휴일 데이터 준비 완료
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 커스텀 시작 시간 Picker */}
      <CustomPicker
        visible={showStartTimePicker}
        title="시작 시간"
        selectedValue={startTime}
        options={timeOptions}
        onCancel={() => setShowStartTimePicker(false)}
        onConfirm={handleStartTimeConfirm}
      />

      {/* 커스텀 종료 시간 Picker */}
      <CustomPicker
        visible={showEndTimePicker}
        title="종료 시간"
        selectedValue={endTime}
        options={timeOptions}
        onCancel={() => setShowEndTimePicker(false)}
        onConfirm={handleEndTimeConfirm}
      />

      {/* 로딩 오버레이 */}
      {isLoading && <LoadingIndicator />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 40,
    lineHeight: 24,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  optionContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  selectedOption: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#fff',
  },
  unitDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  timeButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
  },
  timeButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeButtonLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  timeButtonValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  holidayNoticeContainer: {
    marginTop: 15,
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  holidayNotice: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  holidayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  holidayStatusText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  // 로딩 오버레이 스타일
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  loadingSubText: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 5,
    textAlign: 'center',
  },
  loadingDescription: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default InitialSetupScreen;