import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  SafeAreaView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import DatabaseService, { Event, Academy, Schedule } from '../services/DatabaseService';
import CustomPicker from '../components/CustomPicker';

// App.tsx에서 정의된 타입 import
import { RootStackParamList } from '../../App';

type EventScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EventScreen'>;
type EventScreenRouteProp = RouteProp<RootStackParamList, 'EventScreen'>;

interface Props {
  navigation: EventScreenNavigationProp;
  route: EventScreenRouteProp;
}

const EventScreen: React.FC<Props> = ({ navigation, route }) => {
  const { event, selectedDate, selectedTime, scheduleId, onSave } = route.params;

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [category, setCategory] = useState<Event['category']>('선택안함');
  const [academyId, setAcademyId] = useState<number | undefined>();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAcademyPicker, setShowAcademyPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
    initializeForm();
  }, []);

  const loadData = async () => {
    try {
      const [academyList, activeSchedule] = await Promise.all([
        DatabaseService.getAcademies(),
        DatabaseService.getActiveSchedule()
      ]);
      
      setAcademies(academyList.filter(a => a.status === '진행'));
      setSchedule(activeSchedule);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // 시간 옵션 생성 (스케줄 설정에 따라)
  const timeOptions = useMemo(() => {
    if (!schedule) return [];
    
    const options: string[] = [];
    const startMoment = moment(schedule.start_time, 'HH:mm');
    const endMoment = moment(schedule.end_time, 'HH:mm');
    const interval = schedule.time_unit === '30min' ? 30 : 60;
    
    let current = startMoment.clone();
    while (current.isSameOrBefore(endMoment)) {
      options.push(current.format('HH:mm'));
      current.add(interval, 'minutes');
    }
    
    return options;
  }, [schedule]);

  // 카테고리 옵션
  const categoryOptions = ['선택안함', '학교/기관', '학원', '공부', '휴식'];

  // 학원 옵션 (이름과 과목 조합)
  const academyOptions = useMemo(() => {
    return academies.map(academy => `${academy.name} (${academy.subject})`);
  }, [academies]);

  const initializeForm = () => {
    if (event) {
      // 편집 모드
      setTitle(event.title);
      setStartTime(moment(`${selectedDate} ${event.start_time}`).toDate());
      setEndTime(moment(`${selectedDate} ${event.end_time}`).toDate());
      setCategory(event.category);
      setAcademyId(event.academy_id);
    } else {
      // 새 일정 추가 모드
      resetForm();
      const start = moment(`${selectedDate} ${selectedTime}`).toDate();
      const end = moment(start).add(1, 'hour').toDate();
      setStartTime(start);
      setEndTime(end);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCategory('선택안함');
    setAcademyId(undefined);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '일정 제목을 입력해주세요.');
      return;
    }

    if (startTime >= endTime) {
      Alert.alert('오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    if (category === '학원' && !academyId) {
      Alert.alert('오류', '학원을 선택해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const eventData: Omit<Event, 'id' | 'created_at' | 'updated_at'> = {
        schedule_id: scheduleId,
        title: title.trim(),
        start_time: moment(startTime).format('HH:mm'),
        end_time: moment(endTime).format('HH:mm'),
        event_date: selectedDate,
        category,
        academy_id: category === '학원' ? academyId : undefined,
        is_recurring: false,
      };

      if (event?.id) {
        // 편집
        await DatabaseService.updateEvent({ ...eventData, id: event.id });
      } else {
        // 새 일정 추가
        await DatabaseService.createEvent(eventData);
      }

      onSave();
      navigation.goBack();
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('오류', '일정을 저장하는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;

    Alert.alert(
      '일정 삭제',
      '이 일정을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await DatabaseService.deleteEvent(event.id!);
              onSave();
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('오류', '일정을 삭제하는 중 오류가 발생했습니다.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const onStartTimeChange = (event: any, selectedTime?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setStartTime(selectedTime);
      // 종료 시간이 시작 시간보다 빠르면 자동 조정
      if (selectedTime >= endTime) {
        const interval = schedule?.time_unit === '30min' ? 30 : 60;
        setEndTime(moment(selectedTime).add(interval, 'minutes').toDate());
      }
    }
  };

  const onEndTimeChange = (event: any, selectedTime?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setEndTime(selectedTime);
    }
  };

  // CustomPicker 핸들러들
  const handleStartTimeConfirm = (value: string) => {
    const newStartTime = moment(`${selectedDate} ${value}`).toDate();
    setStartTime(newStartTime);
    
    // 종료 시간이 시작 시간보다 빠르면 자동 조정
    if (newStartTime >= endTime) {
      const interval = schedule?.time_unit === '30min' ? 30 : 60;
      setEndTime(moment(newStartTime).add(interval, 'minutes').toDate());
    }
    
    setShowStartTimePicker(false);
  };

  const handleEndTimeConfirm = (value: string) => {
    const newEndTime = moment(`${selectedDate} ${value}`).toDate();
    setEndTime(newEndTime);
    setShowEndTimePicker(false);
  };

  const handleCategoryConfirm = (value: string) => {
    setCategory(value as Event['category']);
    if (value !== '학원') {
      setAcademyId(undefined);
    }
    setShowCategoryPicker(false);
  };

  const handleAcademyConfirm = (value: string) => {
    const selectedAcademy = academies.find(
      academy => `${academy.name} (${academy.subject})` === value
    );
    setAcademyId(selectedAcademy?.id);
    setShowAcademyPicker(false);
  };

  const getSelectedAcademyName = () => {
    if (!academyId) return '학원을 선택하세요';
    const academy = academies.find(a => a.id === academyId);
    return academy ? `${academy.name} (${academy.subject})` : '학원을 선택하세요';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {event ? '일정 편집' : '새 일정'}
        </Text>
        
        <View style={styles.headerRight}>
          {event && (
            <TouchableOpacity 
              onPress={handleDelete} 
              style={[styles.headerButton, styles.deleteButton]}
              disabled={isLoading}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 일정 제목 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>일정 제목</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="일정 제목을 입력하세요"
            placeholderTextColor="#999"
          />
        </View>

        {/* 날짜 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>날짜</Text>
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
              {moment(selectedDate).format('YYYY년 M월 D일 dddd')}
            </Text>
          </View>
        </View>

        {/* 시간 설정 */}
        <View style={styles.timeSection}>
          <View style={styles.timeRow}>
            <View style={styles.timeGroup}>
              <Text style={styles.label}>시작 시간</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  {moment(startTime).format('HH:mm')}
                </Text>
                <Ionicons name="time-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.timeGroup}>
              <Text style={styles.label}>종료 시간</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  {moment(endTime).format('HH:mm')}
                </Text>
                <Ionicons name="time-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.durationText}>
            소요 시간: {moment.duration(moment(endTime).diff(moment(startTime))).asMinutes()}분
          </Text>
        </View>

        {/* 카테고리 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>카테고리</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{category}</Text>
            <Ionicons name="chevron-down-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* 학원 선택 (카테고리가 '학원'일 때만) */}
        {category === '학원' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>학원 선택</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowAcademyPicker(true)}
            >
              <Text style={[
                styles.pickerButtonText,
                !academyId && styles.placeholderText
              ]}>
                {getSelectedAcademyName()}
              </Text>
              <Ionicons name="chevron-down-outline" size={20} color="#666" />
            </TouchableOpacity>
            
            {academies.length === 0 && (
              <Text style={styles.noAcademyText}>
                등록된 학원이 없습니다. 학원관리에서 먼저 학원을 추가해주세요.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* 저장 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? '저장 중...' : '저장'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 기본 시간 선택기 (fallback) */}
      {showStartTimePicker && timeOptions.length === 0 && (
        <DateTimePicker
          value={startTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onStartTimeChange}
        />
      )}

      {showEndTimePicker && timeOptions.length === 0 && (
        <DateTimePicker
          value={endTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onEndTimeChange}
        />
      )}

      {/* CustomPicker들 */}
      <CustomPicker
        visible={showStartTimePicker && timeOptions.length > 0}
        title="시작 시간"
        selectedValue={moment(startTime).format('HH:mm')}
        options={timeOptions}
        onCancel={() => setShowStartTimePicker(false)}
        onConfirm={handleStartTimeConfirm}
      />

      <CustomPicker
        visible={showEndTimePicker && timeOptions.length > 0}
        title="종료 시간"
        selectedValue={moment(endTime).format('HH:mm')}
        options={timeOptions}
        onCancel={() => setShowEndTimePicker(false)}
        onConfirm={handleEndTimeConfirm}
      />

      <CustomPicker
        visible={showCategoryPicker}
        title="카테고리"
        selectedValue={category}
        options={categoryOptions}
        onCancel={() => setShowCategoryPicker(false)}
        onConfirm={handleCategoryConfirm}
      />

      {category === '학원' && academies.length > 0 && (
        <CustomPicker
          visible={showAcademyPicker}
          title="학원 선택"
          selectedValue={getSelectedAcademyName()}
          options={academyOptions}
          onCancel={() => setShowAcademyPicker(false)}
          onConfirm={handleAcademyConfirm}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerButton: {
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  headerRight: {
    width: 50,
    alignItems: 'flex-end',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  deleteButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  dateContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  timeSection: {
    marginBottom: 25,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 10,
  },
  timeGroup: {
    flex: 1,
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    backgroundColor: '#fff',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    backgroundColor: '#fff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  noAcademyText: {
    fontSize: 14,
    color: '#FF9500',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
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

export default EventScreen;