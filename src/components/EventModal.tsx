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
} from 'react-native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import DatabaseService, { Event, Academy } from '../services/DatabaseService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  event?: Event | null;
  selectedDate: string;
  selectedTime: string;
  scheduleId: number;
}

const EventModal: React.FC<Props> = ({
  visible,
  onClose,
  onSave,
  event,
  selectedDate,
  selectedTime,
  scheduleId,
}) => {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [category, setCategory] = useState<Event['category']>('선택안함');
  const [academyId, setAcademyId] = useState<number | undefined>();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAcademies();
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
    }
  }, [visible, event, selectedDate, selectedTime]);

  const loadAcademies = async () => {
    try {
      const academyList = await DatabaseService.getAcademies();
      setAcademies(academyList.filter(a => a.status === '진행'));
    } catch (error) {
      console.error('Error loading academies:', error);
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
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('오류', '일정을 저장하는 중 오류가 발생했습니다.');
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
            try {
              await DatabaseService.deleteEvent(event.id!);
              onSave();
              onClose();
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('오류', '일정을 삭제하는 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
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
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modal}
      avoidKeyboard={true}
    >
      <View style={styles.modalContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {event ? '일정 편집' : '새 일정'}
          </Text>
          {event && (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.form}>
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
            <Text style={styles.dateText}>
              {moment(selectedDate).format('YYYY년 M월 D일 dddd')}
            </Text>
          </View>

          {/* 시작 시간 */}
          <View style={styles.formGroup}>
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

          {/* 종료 시간 */}
          <View style={styles.formGroup}>
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
              <Text style={styles.label}>학원</Text>
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
            </View>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>저장</Text>
        </TouchableOpacity>

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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  form: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default EventModal;