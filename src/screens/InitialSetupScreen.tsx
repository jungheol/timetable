import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import DatabaseService, { Schedule } from '../services/DatabaseService';
import CustomPicker from '../components/CustomPicker';

interface Props {
  onSetupComplete: () => void;
}

const InitialSetupScreen: React.FC<Props> = ({ onSetupComplete }) => {
  const [timeUnit, setTimeUnit] = useState<'30min' | '1hour'>('1hour');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [showWeekend, setShowWeekend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

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

  const handleSave = async () => {
    if (startTime >= endTime) {
      Alert.alert('오류', '시작 시간은 종료 시간보다 빨라야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      // 기존 활성 일정표를 비활성화
      const existingSchedule = await DatabaseService.getActiveSchedule();
      if (existingSchedule) {
        await DatabaseService.updateSchedule({
          ...existingSchedule,
          is_active: false,
        });
      }

      // 새 일정표 생성
      const newSchedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'> = {
        name: '내 일정표',
        start_time: startTime,
        end_time: endTime,
        show_weekend: showWeekend,
        is_active: true,
        time_unit: timeUnit,
        del_yn: false,
      };

      await DatabaseService.createSchedule(newSchedule);
      
      // 설정 완료 콜백 호출
      onSetupComplete();
    } catch (error) {
      console.error('Error saving schedule:', error);
      Alert.alert('오류', '일정표를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

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
            {isLoading ? '저장 중...' : '설정 완료'}
          </Text>
        </TouchableOpacity>
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
});

export default InitialSetupScreen;