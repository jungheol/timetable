import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import DatabaseService, { Event, Academy, Schedule } from '../services/DatabaseService';
import { useAcademyNotifications } from '../hooks/useAcademyNotifications';
import CustomPicker from '../components/CustomPicker';

// App.tsx에서 정의된 타입 import
import { RootStackParamList } from '../../App';

type EventScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EventScreen'>;
type EventScreenRouteProp = RouteProp<RootStackParamList, 'EventScreen'>;

interface Props {
  navigation: EventScreenNavigationProp;
  route: EventScreenRouteProp;
}

interface DayButton {
  key: string;
  label: string;
  index: number;
}

const EventScreen: React.FC<Props> = ({ navigation, route }) => {
  const { event, selectedDate, selectedTime, scheduleId, onSave } = route.params;

  // 🔔 알림 훅 추가
  const {
    handleAcademyCreated,
    handleAcademyUpdated,
    handleAcademyDeleted,
  } = useAcademyNotifications();

  // 기본 상태
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<Event['category']>('선택안함');
  const [academyName, setAcademyName] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Academy['subject']>('국어');
  const [isRecurring, setIsRecurring] = useState(false);
  const [memo, setMemo] = useState('');
  
  // UI 상태
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [showAcademyPicker, setShowAcademyPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // 요일 데이터
  const weekdays: DayButton[] = [
    { key: 'monday', label: '월', index: 1 },
    { key: 'tuesday', label: '화', index: 2 },
    { key: 'wednesday', label: '수', index: 3 },
    { key: 'thursday', label: '목', index: 4 },
    { key: 'friday', label: '금', index: 5 },
    { key: 'saturday', label: '토', index: 6 },
    { key: 'sunday', label: '일', index: 0 },
  ];

  // 표시할 요일 (주말 포함 여부에 따라)
  const availableDays = useMemo(() => {
    if (!schedule) return weekdays.slice(0, 5); // 기본적으로 월-금
    
    if (schedule.show_weekend) {
      return weekdays; // 일-토 모든 요일
    } else {
      return weekdays.slice(0, 5); // 월-금만
    }
  }, [schedule]);

  // 시간 옵션 생성
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
  const categoryOptions = ['학교/기관', '학원', '공부', '휴식', '선택안함'];

  // 과목 옵션
  const subjectOptions: Academy['subject'][] = ['국어', '수학', '영어', '예체능', '사회과학', '기타'];

  // 학원 선택 옵션
  const academyOptions = useMemo(() => {
    return academies.map(academy => ({
      value: academy.id.toString(),
      label: `${academy.name} (${academy.subject})`
    }));
  }, [academies]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 스케줄과 현재 스케줄의 학원 정보 로드
      const [activeSchedule, academyList] = await Promise.all([
        DatabaseService.getActiveSchedule(),
        DatabaseService.getAcademiesBySchedule(scheduleId) // ✅ 현재 스케줄의 학원만 조회
      ]);
      
      console.log('📚 Loaded academies for schedule', scheduleId, ':', academyList);
      
      setSchedule(activeSchedule);
      setAcademies(academyList);
      
      // 편집 모드 확인 및 폼 초기화
      if (event) {
        setIsEditMode(true);
        await loadEventData(event, academyList);
      } else {
        setIsEditMode(false);
        initializeNewEventForm();
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const loadEventData = async (eventData: Event, academyList: Academy[]) => {
    try {
      console.log('Loading event data for editing:', eventData);
      
      // 기본 정보 설정
      setTitle(eventData.title);
      setStartTime(eventData.start_time);
      setEndTime(eventData.end_time);
      setCategory(eventData.category);
      setIsRecurring(eventData.is_recurring || false);
      
      // 현재 선택된 날짜의 요일 구하기
      const currentDayIndex = moment(selectedDate).day();
      const currentDayKey = weekdays.find(day => day.index === currentDayIndex)?.key;
      
      if (eventData.is_recurring && eventData.recurring_group_id) {
        // 반복 일정인 경우 - 반복 패턴에서 요일 정보 가져오기
        try {
          const recurringPattern = await DatabaseService.getRecurringPattern(eventData.recurring_group_id);
          if (recurringPattern) {
            const selectedDaysSet = new Set<string>();
            if (recurringPattern.monday) selectedDaysSet.add('monday');
            if (recurringPattern.tuesday) selectedDaysSet.add('tuesday');
            if (recurringPattern.wednesday) selectedDaysSet.add('wednesday');
            if (recurringPattern.thursday) selectedDaysSet.add('thursday');
            if (recurringPattern.friday) selectedDaysSet.add('friday');
            if (recurringPattern.saturday) selectedDaysSet.add('saturday');
            if (recurringPattern.sunday) selectedDaysSet.add('sunday');
            setSelectedDays(selectedDaysSet);
          }
        } catch (error) {
          console.error('Error loading recurring pattern:', error);
          // 반복 패턴을 불러올 수 없는 경우 현재 요일만 선택
          if (currentDayKey) {
            setSelectedDays(new Set([currentDayKey]));
          }
        }
      } else {
        // 일반 일정인 경우 현재 요일 선택
        if (currentDayKey) {
          setSelectedDays(new Set([currentDayKey]));
        }
      }
      
      // 학원 카테고리인 경우 학원 정보 설정
      if (eventData.category === '학원' && eventData.academy_id) {
        const academy = academyList.find(a => a.id === eventData.academy_id);
        if (academy) {
          setSelectedAcademy(academy);
          setAcademyName(academy.name);
          setSelectedSubject(academy.subject);
          
          console.log('Loaded academy data:', academy);
        } else {
          console.warn('Academy not found for ID:', eventData.academy_id);
          // 학원을 찾을 수 없는 경우 제목에서 학원명 추출
          setAcademyName(eventData.title);
        }
      }
      
      console.log('Event data loaded successfully');
    } catch (error) {
      console.error('Error loading event data:', error);
      Alert.alert('오류', '일정 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const initializeNewEventForm = () => {
    // 현재 선택된 날짜의 요일 구하기
    const currentDayIndex = moment(selectedDate).day();
    const currentDayKey = weekdays.find(day => day.index === currentDayIndex)?.key;
    
    // 새 일정 추가 모드
    resetForm();
    
    // 현재 요일 선택
    if (currentDayKey) {
      setSelectedDays(new Set([currentDayKey]));
    }
    
    // 기본 시간 설정
    if (selectedTime) {
      setStartTime(selectedTime);
      const start = moment(selectedTime, 'HH:mm');
      const interval = schedule?.time_unit === '30min' ? 30 : 60;
      setEndTime(start.add(interval, 'minutes').format('HH:mm'));
    }
  };

  const resetForm = () => {
    setTitle('');
    setCategory('선택안함');
    setAcademyName('');
    setSelectedSubject('국어');
    setSelectedAcademy(null);
    setIsRecurring(false);
    setMemo('');
    setSelectedDays(new Set());
  };

  // 요일 선택/해제
  const toggleDay = (dayKey: string) => {
    const newSelectedDays = new Set(selectedDays);
    if (newSelectedDays.has(dayKey)) {
      newSelectedDays.delete(dayKey);
    } else {
      newSelectedDays.add(dayKey);
    }
    setSelectedDays(newSelectedDays);
  };

  // 카테고리 변경 시 처리
  const handleCategoryChange = (newCategory: Event['category']) => {
    setCategory(newCategory);
    if (newCategory !== '학원') {
      setAcademyName('');
      setSelectedSubject('국어');
      setSelectedAcademy(null);
    }
  };

  // 학원 선택 처리
  const handleAcademySelect = (academyIdStr: string) => {
    if (academyIdStr === 'new') {
      // 새 학원 추가
      setSelectedAcademy(null);
      setAcademyName('');
      setSelectedSubject('국어');
    } else {
      const academy = academies.find(a => a.id.toString() === academyIdStr);
      if (academy) {
        setSelectedAcademy(academy);
        setAcademyName(academy.name);
        setSelectedSubject(academy.subject);
      }
    }
  };

  const handleSave = async () => {
    // 유효성 검사
    if (selectedDays.size === 0) {
      Alert.alert('오류', '최소 하나의 요일을 선택해주세요.');
      return;
    }

    if (!startTime || !endTime) {
      Alert.alert('오류', '시작 시간과 종료 시간을 설정해주세요.');
      return;
    }

    if (moment(startTime, 'HH:mm').isSameOrAfter(moment(endTime, 'HH:mm'))) {
      Alert.alert('오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    const eventTitle = category === '학원' ? academyName : title;
    if (!eventTitle.trim()) {
      Alert.alert('오류', category === '학원' ? '학원명을 입력해주세요.' : '제목을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode) {
        // 편집 모드
        await updateExistingEvent();
      } else {
        // 새 일정 생성 모드
        if (isRecurring) {
          await saveRecurringEvent();
        } else {
          await saveSingleEvent();
        }
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

  const updateExistingEvent = async () => {
    if (!event?.id) return;

    const eventTitle = category === '학원' ? academyName : title;
    let academyId: number | undefined = selectedAcademy?.id;
    let newlyCreatedAcademyId: number | undefined;
    
    // 학원 카테고리인 경우 학원 생성/조회
    if (category === '학원' && academyName.trim()) {
      academyId = await DatabaseService.createAcademyForRecurringEvent(
        academyName.trim(),
        selectedSubject,
        scheduleId // ✅ 스케줄 ID 전달
      );
      
      // 🔔 새로 생성된 학원인지 확인
      if (!selectedAcademy || selectedAcademy.name !== academyName.trim()) {
        newlyCreatedAcademyId = academyId;
        console.log('🏫 New academy created during event update:', newlyCreatedAcademyId);
      }
    }

    const updatedEvent: Event = {
      ...event,
      title: eventTitle.trim(),
      start_time: startTime,
      end_time: endTime,
      category,
      academy_id: academyId,
      event_date: selectedDate, // 편집 시에는 현재 선택된 날짜 유지
    };

    await DatabaseService.updateEvent(updatedEvent);
    console.log('Event updated successfully');

    // 🔔 새로 생성된 학원에 대해서는 알림 설정하지 않음 (결제일 없음)
    if (newlyCreatedAcademyId) {
      console.log('💡 New academy created, but no payment notification set (no payment day)');
    }
  };

  const saveSingleEvent = async () => {
    const eventTitle = category === '학원' ? academyName : title;
    const selectedDaysArray = Array.from(selectedDays);
    
    let academyId: number | undefined;
    
    // 학원 카테고리인 경우 학원 생성/조회
    if (category === '학원' && academyName.trim()) {
      academyId = await DatabaseService.createAcademyForRecurringEvent(
        academyName.trim(),
        selectedSubject,
        scheduleId // ✅ 스케줄 ID 전달
      );
      
      // 🔔 새로 생성된 학원은 결제일이 없으므로 알림 설정하지 않음
      console.log('💡 Academy created from event, but no payment notification set (no payment day)');
    }
    
    const eventData = {
      schedule_id: scheduleId,
      title: eventTitle.trim(),
      start_time: startTime,
      end_time: endTime,
      category,
      academy_id: academyId,
      is_recurring: false,
    };

    if (selectedDaysArray.length === 1) {
      // 단일 요일 - 기존 방식
      await DatabaseService.createEvent({
        ...eventData,
        event_date: selectedDate,
      });
    } else {
      // 다중 요일 - 각 요일별로 이벤트 생성
      await DatabaseService.createMultiDayEvents(
        eventData,
        selectedDaysArray,
        selectedDate
      );
    }
  };

  const saveRecurringEvent = async () => {
    console.log('Saving recurring event...');
    console.log('Selected days:', Array.from(selectedDays));
    console.log('Category:', category);
    console.log('Academy name:', academyName);
    console.log('Title:', title);
    
    // 반복 패턴 생성
    const patternData = {
      monday: selectedDays.has('monday'),
      tuesday: selectedDays.has('tuesday'),
      wednesday: selectedDays.has('wednesday'),
      thursday: selectedDays.has('thursday'),
      friday: selectedDays.has('friday'),
      saturday: selectedDays.has('saturday'),
      sunday: selectedDays.has('sunday'),
      start_date: selectedDate,
      end_date: undefined, // 무한 반복
    };

    console.log('Pattern data:', patternData);

    const recurringPatternId = await DatabaseService.createRecurringPattern(patternData);
    console.log('Created pattern with ID:', recurringPatternId);
    
    const eventTitle = category === '학원' ? academyName : title;
    let academyId: number | undefined;
    
    // 학원 카테고리인 경우 학원 생성/조회
    if (category === '학원' && academyName.trim()) {
      console.log('Creating academy for recurring event...');
      academyId = await DatabaseService.createAcademyForRecurringEvent(
        academyName.trim(),
        selectedSubject,
        scheduleId // ✅ 스케줄 ID 전달
      );
      console.log('Academy ID:', academyId);
      
      // 🔔 새로 생성된 학원은 결제일이 없으므로 알림 설정하지 않음
      console.log('💡 Academy created from recurring event, but no payment notification set (no payment day)');
    }
    
    const eventData: Omit<Event, 'id' | 'created_at' | 'updated_at'> = {
      schedule_id: scheduleId,
      title: eventTitle.trim(),
      start_time: startTime,
      end_time: endTime,
      event_date: undefined, // 반복 일정은 event_date가 null
      category,
      academy_id: academyId,
      is_recurring: true,
      recurring_group_id: recurringPatternId,
    };

    console.log('Event data:', eventData);
    
    const eventId = await DatabaseService.createEvent(eventData);
    console.log('Created recurring event with ID:', eventId);
  };

  const handleDelete = async () => {
    if (!event?.id) return;

    const deleteMessage = event.is_recurring 
      ? '이 반복 일정을 삭제하시겠습니까? 모든 반복 일정이 삭제됩니다.'
      : '이 일정을 삭제하시겠습니까?';

    Alert.alert(
      '일정 삭제',
      deleteMessage,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              // 🔔 학원 일정 삭제 시 알림도 함께 처리
              if (event.category === '학원' && event.academy_id) {
                try {
                  // 해당 학원의 다른 일정이 있는지 확인
                  const relatedEvents = await DatabaseService.getEvents(
                    scheduleId, 
                    moment().subtract(1, 'year').format('YYYY-MM-DD'),
                    moment().add(1, 'year').format('YYYY-MM-DD')
                  );
                  
                  const academyEvents = relatedEvents.filter(e => 
                    e.academy_id === event.academy_id && e.id !== event.id
                  );
                  
                  // 해당 학원의 마지막 일정이라면 알림도 삭제
                  if (academyEvents.length === 0) {
                    await handleAcademyDeleted(event.academy_id);
                    console.log('✅ Academy notifications deleted for:', event.academy_id);
                  }
                } catch (notificationError) {
                  console.error('❌ Error handling academy notifications:', notificationError);
                  // 알림 처리 실패해도 일정 삭제는 계속 진행
                }
              }

              if (event.is_recurring) {
                await DatabaseService.deleteRecurringEvent(event.id!);
              } else {
                await DatabaseService.deleteEvent(event.id!);
              }
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

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {isEditMode ? '수정' : '추가'}
        </Text>
        
        <View style={styles.headerRight}>
          {event && (
            <TouchableOpacity 
              onPress={handleDelete} 
              style={styles.headerButton}
              disabled={isLoading}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSave} disabled={isLoading}>
            <Ionicons name="chevron-down" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 🔔 알림 관련 정보 표시 (학원 카테고리일 때만) */}
        {category === '학원' && (
          <View style={styles.notificationInfo}>
            <Ionicons name="notifications-outline" size={16} color="#FF9500" />
            <Text style={styles.notificationInfoText}>
              학원 관리에서 결제일을 설정하면 결제 알림을 받을 수 있습니다.
            </Text>
          </View>
        )}

        {/* 요일 선택 */}
        <View style={styles.section}>
          <View style={styles.dayButtons}>
            {availableDays.map((day) => (
              <TouchableOpacity
                key={day.key}
                style={[
                  styles.dayButton,
                  selectedDays.has(day.key) && styles.dayButtonSelected
                ]}
                onPress={() => toggleDay(day.key)}
              >
                <Text style={[
                  styles.dayButtonText,
                  selectedDays.has(day.key) && styles.dayButtonTextSelected
                ]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 시간 설정 */}
        <View style={styles.section}>
          <View style={styles.timeContainer}>
            <Text style={styles.timeLabel}>시간</Text>
            <View style={styles.timeButtons}>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  {startTime ? moment(startTime, 'HH:mm').format('A hh:mm') : '시간 선택'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.timeSeparator}>~</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  {endTime ? moment(endTime, 'HH:mm').format('A hh:mm') : '시간 선택'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 분류 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>분류</Text>
          <View style={styles.categoryContainer}>
            {categoryOptions.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  category === cat && styles.categoryButtonSelected
                ]}
                onPress={() => handleCategoryChange(cat as Event['category'])}
              >
                <Text style={[
                  styles.categoryButtonText,
                  category === cat && styles.categoryButtonTextSelected
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 학원 선택 시 추가 필드 */}
        {category === '학원' && (
          <>
            {/* 기존 학원 선택 또는 새 학원 추가 */}
            {academies.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>학원 선택</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowAcademyPicker(true)}
                >
                  <Text style={styles.pickerButtonText}>
                    {selectedAcademy 
                      ? `${selectedAcademy.name} (${selectedAcademy.subject})`
                      : '학원 선택 또는 새로 추가'
                    }
                  </Text>
                  <Ionicons name="chevron-down-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            )}

            {/* 제목 (학원명) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>학원명</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="school-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={academyName}
                  onChangeText={setAcademyName}
                  placeholder="학원명 입력"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* 과목 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>과목</Text>
              <View style={styles.subjectContainer}>
                {subjectOptions.map((subject) => (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.subjectButton,
                      selectedSubject === subject && styles.subjectButtonSelected
                    ]}
                    onPress={() => setSelectedSubject(subject)}
                  >
                    <Text style={[
                      styles.subjectButtonText,
                      selectedSubject === subject && styles.subjectButtonTextSelected
                    ]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {/* 일반 제목 (학원이 아닌 경우) */}
        {category !== '학원' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>제목</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="create-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="제목 입력"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        )}

        {/* 반복 설정 (편집 모드가 아니거나 기존에 반복 일정이 아닌 경우에만 표시) */}
        {(!isEditMode || !event?.is_recurring) && (
          <View style={styles.section}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>선택한 요일 매주 반복</Text>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                thumbColor={isRecurring ? '#fff' : '#fff'}
              />
            </View>
          </View>
        )}

        {/* 기존 반복 일정 편집 시 안내 메시지 */}
        {isEditMode && event?.is_recurring && (
          <View style={styles.section}>
            <View style={styles.infoContainer}>
              <Ionicons name="information-circle-outline" size={20} color="#FF9500" />
              <Text style={styles.infoText}>
                반복 일정은 개별 수정이 불가능합니다. 삭제 후 새로 생성해주세요.
              </Text>
            </View>
          </View>
        )}

        {/* 메모 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>메모</Text>
          <TextInput
            style={styles.memoInput}
            value={memo}
            onChangeText={setMemo}
            placeholder="메모 입력"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* CustomPicker들 */}
      <CustomPicker
        visible={showStartTimePicker}
        title="시작 시간"
        selectedValue={startTime}
        options={timeOptions}
        onCancel={() => setShowStartTimePicker(false)}
        onConfirm={(value) => {
          setStartTime(value);
          setShowStartTimePicker(false);
          
          // 종료 시간 자동 조정
          const start = moment(value, 'HH:mm');
          const interval = schedule?.time_unit === '30min' ? 30 : 60;
          const newEndTime = start.add(interval, 'minutes').format('HH:mm');
          if (timeOptions.includes(newEndTime)) {
            setEndTime(newEndTime);
          }
        }}
      />

      <CustomPicker
        visible={showEndTimePicker}
        title="종료 시간"
        selectedValue={endTime}
        options={timeOptions}
        onCancel={() => setShowEndTimePicker(false)}
        onConfirm={(value) => {
          setEndTime(value);
          setShowEndTimePicker(false);
        }}
      />

      {/* 학원 선택 Picker */}
      <CustomPicker
        visible={showAcademyPicker}
        title="학원 선택"
        selectedValue={selectedAcademy?.id.toString() || 'new'}
        options={[...academyOptions.map(opt => opt.value), 'new']}
        optionLabels={[...academyOptions.map(opt => opt.label), '새 학원 추가']}
        onCancel={() => setShowAcademyPicker(false)}
        onConfirm={(value) => {
          handleAcademySelect(value);
          setShowAcademyPicker(false);
        }}
      />
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
    padding: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  // 🔔 알림 정보 스타일 추가
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  notificationInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#F57C00',
    lineHeight: 16,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  // 요일 버튼
  dayButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#007AFF',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  // 시간 설정
  timeContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  timeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 8,
  },
  // 카테고리
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 20,
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  // 과목
  subjectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 20,
  },
  subjectButtonSelected: {
    backgroundColor: '#007AFF',
  },
  subjectButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  subjectButtonTextSelected: {
    color: '#fff',
  },
  // Picker 버튼
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  // 입력 필드
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  memoInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
  },
  // 토글
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  // 정보 컨테이너
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  infoText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
});

export default EventScreen;