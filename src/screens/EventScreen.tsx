import React, { useState, useEffect } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import DatabaseService, { Event, Academy } from '../services/DatabaseService';

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
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAcademies();
    initializeForm();
  }, []);

  const loadAcademies = async () => {
    try {
      const academyList = await DatabaseService.getAcademies();
      setAcademies(academyList.filter(a => a.status === '진행'));
    } catch (error) {
      console.error('Error loading academies:', error);
    }
  };

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
        setEndTime(moment(selectedTime).add(1, 'hour').toDate());
      }
    }
  };

  const onEndTimeChange = (event: any, selectedTime?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setEndTime(selectedTime);
    }
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
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={category}
              onValueChange={setCategory}
              style={styles.picker}
            >
              <Picker.Item label="선택안함" value="선택안함" />
              <Picker.Item label="학교/기관" value="학교/기관" />
              <Picker.Item label="학원" value="학원" />
              <Picker.Item label="공부" value="공부" />
              <Picker.Item label="휴식" value="휴식" />
            </Picker>
          </View>
        </View>

        {/* 학원 선택 (카테고리가 '학원'일 때만) */}
        {category === '학원' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>학원 선택</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={academyId}
                onValueChange={setAcademyId}
                style={styles.picker}
              >
                <Picker.Item label="학원을 선택하세요" value={undefined} />
                {academies.map(academy => (
                  <Picker.Item
                    key={academy.id}
                    label={`${academy.name} (${academy.subject})`}
                    value={academy.id}
                  />
                ))}
              </Picker>
            </View>
            
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

      {/* 시간 선택기 */}
      {showStartTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onStartTimeChange}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onEndTimeChange}
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
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