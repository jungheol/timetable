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
  
  // 공휴일 로딩 상태 - 디버깅 정보 추가
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [holidayLoadStep, setHolidayLoadStep] = useState('');
  const [holidayLoadComplete, setHolidayLoadComplete] = useState(false);
  const [holidayErrors, setHolidayErrors] = useState<string[]>([]);
  const [holidayDebugInfo, setHolidayDebugInfo] = useState<string[]>([]);
  const [showHolidayDebug, setShowHolidayDebug] = useState(false);

  // 컴포넌트 마운트 시 백그라운드에서 공휴일 로딩 시작
  useEffect(() => {
    initializeHolidaysInBackground();
  }, []);

  // 백그라운드에서 공휴일 데이터 초기화 - 에러 처리 강화
  const initializeHolidaysInBackground = async () => {
    try {
      console.log('🎌 [Setup] Starting background holiday initialization...');
      setIsLoadingHolidays(true);
      setHolidayLoadStep('공휴일 데이터를 확인하는 중...');
      setHolidayErrors([]);
      setHolidayDebugInfo([]);
      
      // 디버그 정보 초기화
      const debugInfo: string[] = [];
      const errors: string[] = [];
      
      // DB에서 현재 연도와 다음 연도 공휴일 확인
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      
      debugInfo.push(`🎌 확인 중인 연도: ${currentYear}, ${nextYear}`);
      
      try {
        const currentYearHolidays = await DatabaseService.getHolidaysByYear(currentYear);
        const nextYearHolidays = await DatabaseService.getHolidaysByYear(nextYear);
        
        debugInfo.push(`📊 DB 내 ${currentYear}년 공휴일: ${currentYearHolidays.length}개`);
        debugInfo.push(`📊 DB 내 ${nextYear}년 공휴일: ${nextYearHolidays.length}개`);
        
        console.log(`🎌 [Setup] Current year (${currentYear}) holidays in DB: ${currentYearHolidays.length}`);
        console.log(`🎌 [Setup] Next year (${nextYear}) holidays in DB: ${nextYearHolidays.length}`);
        
        let needsCurrentYear = currentYearHolidays.length === 0;
        let needsNextYear = nextYearHolidays.length === 0;
        
        if (needsCurrentYear || needsNextYear) {
          setHolidayLoadStep('API에서 공휴일 정보를 가져오는 중...');
          debugInfo.push('🌐 API 호출 시작');
          
          if (needsCurrentYear) {
            debugInfo.push(`📡 ${currentYear}년 공휴일 API 호출 중...`);
            console.log(`🎌 [Setup] Fetching ${currentYear} holidays from API...`);
            
            try {
              const fetchedCurrentYear = await HolidayService.getHolidaysForYear(currentYear);
              console.log(`🎌 [Setup] Fetched ${fetchedCurrentYear.length} holidays for ${currentYear}`);
              
              debugInfo.push(`✅ ${currentYear}년: ${fetchedCurrentYear.length}개 공휴일 로드`);
              setHolidayLoadStep(`${currentYear}년 공휴일 ${fetchedCurrentYear.length}개 로드 완료`);
              
              if (fetchedCurrentYear.length === 0) {
                errors.push(`⚠️ ${currentYear}년 공휴일 데이터가 없습니다.`);
              }
            } catch (error: any) {
              const errorMsg = `❌ ${currentYear}년 공휴일 로드 실패: ${error.message || 'Unknown error'}`;
              console.warn(`🎌 [Setup] Failed to fetch ${currentYear} holidays:`, error);
              errors.push(errorMsg);
              debugInfo.push(errorMsg);
              
              // 네트워크 오류 상세 정보
              if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
                errors.push('🌐 네트워크 연결 문제가 발생했습니다.');
              } else if (error.name === 'AbortError') {
                errors.push('⏰ API 요청 시간이 초과되었습니다.');
              }
              
              setHolidayLoadStep(`${currentYear}년 공휴일 로드 실패`);
            }
          }
          
          if (needsNextYear) {
            debugInfo.push(`📡 ${nextYear}년 공휴일 API 호출 중...`);
            console.log(`🎌 [Setup] Fetching ${nextYear} holidays from API...`);
            
            try {
              const fetchedNextYear = await HolidayService.getHolidaysForYear(nextYear);
              console.log(`🎌 [Setup] Fetched ${fetchedNextYear.length} holidays for ${nextYear}`);
              
              debugInfo.push(`✅ ${nextYear}년: ${fetchedNextYear.length}개 공휴일 로드`);
              setHolidayLoadStep(`${nextYear}년 공휴일 ${fetchedNextYear.length}개 로드 완료`);
              
              if (fetchedNextYear.length === 0) {
                errors.push(`⚠️ ${nextYear}년 공휴일 데이터가 없습니다.`);
              }
            } catch (error: any) {
              const errorMsg = `❌ ${nextYear}년 공휴일 로드 실패: ${error.message || 'Unknown error'}`;
              console.warn(`🎌 [Setup] Failed to fetch ${nextYear} holidays:`, error);
              errors.push(errorMsg);
              debugInfo.push(errorMsg);
              setHolidayLoadStep(`${nextYear}년 공휴일 로드 실패`);
            }
          }
          
          setHolidayLoadStep('공휴일 데이터 준비 완료');
        } else {
          setHolidayLoadStep('기존 공휴일 데이터 사용');
          debugInfo.push('✅ 기존 DB 데이터 사용');
          console.log('🎌 [Setup] Using existing holiday data from DB');
        }
        
        // 최종 확인
        const finalCurrentYearHolidays = await DatabaseService.getHolidaysByYear(currentYear);
        const finalNextYearHolidays = await DatabaseService.getHolidaysByYear(nextYear);
        
        debugInfo.push(`📊 최종 결과 - ${currentYear}: ${finalCurrentYearHolidays.length}개, ${nextYear}: ${finalNextYearHolidays.length}개`);
        
        console.log(`🎌 [Setup] Final holiday count - ${currentYear}: ${finalCurrentYearHolidays.length}, ${nextYear}: ${finalNextYearHolidays.length}`);
        
        setHolidayLoadComplete(true);
        
      } catch (dbError: any) {
        const errorMsg = `💾 데이터베이스 오류: ${dbError.message || 'Unknown DB error'}`;
        errors.push(errorMsg);
        debugInfo.push(errorMsg);
        console.error('🎌 [Setup] Database error:', dbError);
      }
      
      // 디버그 정보 업데이트
      setHolidayDebugInfo(debugInfo);
      setHolidayErrors(errors);
      
    } catch (error: any) {
      const errorMsg = `🚨 전체 공휴일 초기화 오류: ${error.message || 'Unknown error'}`;
      console.error('🎌 [Setup] Holiday initialization error:', error);
      
      setHolidayErrors(prev => [...prev, errorMsg]);
      setHolidayDebugInfo(prev => [...prev, errorMsg]);
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

  // 공휴일 디버그 정보 표시
  const showHolidayDebugInfo = () => {
    const debugText = holidayDebugInfo.join('\n');
    const errorText = holidayErrors.length > 0 ? '\n\n❌ 오류 목록:\n' + holidayErrors.join('\n') : '';
    
    Alert.alert(
      '공휴일 로딩 디버그 정보',
      debugText + errorText,
      [
        { text: '복사', onPress: () => {
          // 클립보드에 복사 기능은 expo-clipboard 라이브러리가 필요하므로 로그로 대체
          console.log('🎌 HOLIDAY DEBUG INFO:\n' + debugText + errorText);
          Alert.alert('정보', '디버그 정보가 콘솔에 출력되었습니다.');
        }},
        { text: '확인' }
      ]
    );
  };

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

        {/* 공휴일 정보 및 디버깅 섹션 - 확장됨 */}
        <View style={styles.holidayNoticeContainer}>
          <View style={styles.holidayNoticeHeader}>
            <Text style={styles.holidayNotice}>
              💡 공휴일 정보를 백그라운드에서 자동으로 로드합니다.
            </Text>
            <TouchableOpacity
              style={styles.debugToggleButton}
              onPress={() => setShowHolidayDebug(!showHolidayDebug)}
            >
              <Ionicons 
                name={showHolidayDebug ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#007AFF" 
              />
            </TouchableOpacity>
          </View>
          
          {/* 현재 상태 표시 */}
          {isLoadingHolidays && (
            <View style={styles.holidayStatus}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.holidayStatusText}>{holidayLoadStep}</Text>
            </View>
          )}
          
          {holidayLoadComplete && !isLoadingHolidays && (
            <View style={styles.holidayStatus}>
              <Ionicons 
                name={holidayErrors.length > 0 ? "warning" : "checkmark-circle"} 
                size={16} 
                color={holidayErrors.length > 0 ? "#FF9500" : "#34C759"} 
              />
              <Text style={[
                styles.holidayStatusText, 
                { color: holidayErrors.length > 0 ? "#FF9500" : "#34C759" }
              ]}>
                {holidayErrors.length > 0 ? '공휴일 로드 중 일부 오류 발생' : '공휴일 데이터 준비 완료'}
              </Text>
            </View>
          )}

          {/* 오류 요약 표시 */}
          {holidayErrors.length > 0 && (
            <View style={styles.errorSummary}>
              <Text style={styles.errorSummaryText}>
                ⚠️ {holidayErrors.length}개의 오류가 발생했습니다
              </Text>
            </View>
          )}

          {/* 디버그 정보 표시 영역 */}
          {showHolidayDebug && (
            <View style={styles.debugInfoContainer}>
              <View style={styles.debugHeader}>
                <Text style={styles.debugTitle}>🔍 공휴일 로딩 상세 정보</Text>
                <TouchableOpacity
                  style={styles.debugDetailButton}
                  onPress={showHolidayDebugInfo}
                >
                  <Text style={styles.debugDetailButtonText}>전체 보기</Text>
                </TouchableOpacity>
              </View>
              
              {/* 디버그 정보 요약 */}
              <ScrollView style={styles.debugInfoScroll} nestedScrollEnabled>
                {holidayDebugInfo.slice(-5).map((info, index) => (
                  <Text key={index} style={styles.debugInfoText}>
                    {info}
                  </Text>
                ))}
              </ScrollView>
              
              {/* 오류 정보 */}
              {holidayErrors.length > 0 && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorTitle}>❌ 발생한 오류:</Text>
                  {holidayErrors.slice(-3).map((error, index) => (
                    <Text key={index} style={styles.errorText}>
                      {error}
                    </Text>
                  ))}
                </View>
              )}
              
              {/* 액션 버튼들 */}
              <View style={styles.debugActions}>
                <TouchableOpacity
                  style={styles.debugActionButton}
                  onPress={() => {
                    // API 재시도
                    initializeHolidaysInBackground();
                  }}
                >
                  <Text style={styles.debugActionButtonText}>🔄 재시도</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.debugActionButton}
                  onPress={showHolidayDebugInfo}
                >
                  <Text style={styles.debugActionButtonText}>📋 상세 로그</Text>
                </TouchableOpacity>
              </View>
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
  // 공휴일 디버깅 스타일들
  holidayNoticeContainer: {
    marginTop: 15,
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  holidayNoticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holidayNotice: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    flex: 1,
  },
  debugToggleButton: {
    padding: 4,
    marginLeft: 8,
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
  errorSummary: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF3CD',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  errorSummaryText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  debugInfoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
  },
  debugDetailButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  debugDetailButtonText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  debugInfoScroll: {
    maxHeight: 120,
    marginVertical: 8,
  },
  debugInfoText: {
    fontSize: 11,
    color: '#6c757d',
    marginBottom: 2,
  },
  errorContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8d7da',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#721c24',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#721c24',
    marginBottom: 2,
  },
  debugActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    gap: 8,
  },
  debugActionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#6c757d',
    borderRadius: 6,
    alignItems: 'center',
  },
  debugActionButtonText: {
    fontSize: 12,
    color: '#fff',
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