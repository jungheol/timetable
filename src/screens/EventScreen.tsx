import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import CustomPicker from '../components/CustomPicker';
import { useEventLogic } from '../hooks/useEventLogic';
import { RootStackParamList } from '../../App';

type EventScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EventScreen'>;
type EventScreenRouteProp = RouteProp<RootStackParamList, 'EventScreen'>;

interface Props {
  navigation: EventScreenNavigationProp;
  route: EventScreenRouteProp;
}

const EventScreen: React.FC<Props> = ({ navigation, route }) => {
  // 모든 비즈니스 로직이 커스텀 훅으로 분리됨
  const {
    formData,
    uiState,
    options,
    isEditMode,
    updateFormData,
    updateUIState,
    handleSave,
    handleDelete,
    handleRecurringEditConfirm,
    handleRecurringDeleteConfirm,
    handleAcademySelect,
    handleStartTimeConfirm,
    handleEndTimeConfirm,
  } = useEventLogic(route.params, navigation);

  // UI 이벤트 핸들러들
  const handleCancel = () => {
    navigation.goBack();
  };

  const handleCategoryChange = (newCategory: any) => {
    updateFormData({ category: newCategory });
    if (newCategory !== '학원') {
      updateFormData({
        academyName: '',
        selectedSubject: '국어',
        selectedAcademy: null,
      });
    }
  };

  const toggleDay = (dayKey: string) => {
    const newSelectedDays = new Set(formData.selectedDays);
    if (newSelectedDays.has(dayKey)) {
      newSelectedDays.delete(dayKey);
    } else {
      newSelectedDays.add(dayKey);
    }
    updateFormData({ selectedDays: newSelectedDays });
  };

  // ✅ 시간 선택 디버깅을 위한 래퍼 핸들러들
  const handleStartTimeSelect = (value: string) => {
    handleStartTimeConfirm(value);
    updateUIState({ showStartTimePicker: false });
  };

  const handleEndTimeSelect = (value: string) => {
    handleEndTimeConfirm(value);
    updateUIState({ showEndTimePicker: false });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {isEditMode ? (uiState.isEditingException ? '예외 수정' : '수정') : '추가'}
        </Text>
        
        <View style={styles.headerRight}>
          {isEditMode && (
            <TouchableOpacity 
              onPress={handleDelete} 
              style={styles.headerButton}
              disabled={uiState.isLoading}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSave} disabled={uiState.isLoading}>
            <Ionicons name="chevron-down" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>


        {/* 예외 편집 알림 */}
        {uiState.isEditingException && (
          <View style={styles.exceptionInfo}>
            <Ionicons name="information-circle-outline" size={16} color="#FF9500" />
            <Text style={styles.exceptionInfoText}>
              이 날짜만 수정된 일정입니다. 원래 반복 일정으로 되돌리려면 삭제 버튼을 눌러주세요.
            </Text>
          </View>
        )}

        {/* 알림 관련 정보 표시 */}
        {formData.category === '학원' && (
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
            {options.availableDays.map((day) => (
              <TouchableOpacity
                key={day.key}
                style={[
                  styles.dayButton,
                  formData.selectedDays.has(day.key) && styles.dayButtonSelected
                ]}
                onPress={() => toggleDay(day.key)}
                disabled={isEditMode && formData.isRecurring && !uiState.isEditingException}
              >
                <Text style={[
                  styles.dayButtonText,
                  formData.selectedDays.has(day.key) && styles.dayButtonTextSelected
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
              {/* 시작 시간 버튼 */}
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => {
                  console.log('📱 Start time picker opened');
                  updateUIState({ showStartTimePicker: true });
                }}
              >
                <Text style={styles.timeButtonText}>
                  {formData.startTime ? moment(formData.startTime, 'HH:mm').format('A hh:mm') : '시간 선택'}
                </Text>
              </TouchableOpacity>

              {/* 구분자 */}
              <Text style={styles.timeSeparator}>~</Text>

              {/* 종료 시간 버튼 */}
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => {
                  console.log('📱 End time picker opened');
                  updateUIState({ showEndTimePicker: true });
                }}
              >
                <Text style={styles.timeButtonText}>
                  {formData.endTime ? moment(formData.endTime, 'HH:mm').format('A hh:mm') : '시간 선택'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 분류 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>분류</Text>
          <View style={styles.categoryContainer}>
            {options.categoryOptions.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  formData.category === cat && styles.categoryButtonSelected
                ]}
                onPress={() => handleCategoryChange(cat)}
              >
                <Text style={[
                  styles.categoryButtonText,
                  formData.category === cat && styles.categoryButtonTextSelected
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 학원 선택 시 추가 필드 */}
        {formData.category === '학원' && (
          <>
            {/* 기존 학원 선택 */}
            {options.academyOptions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>학원 선택</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => updateUIState({ showAcademyPicker: true })}
                >
                  <Text style={styles.pickerButtonText}>
                    {formData.selectedAcademy 
                      ? `${formData.selectedAcademy.name} (${formData.selectedAcademy.subject})`
                      : '학원 선택 또는 새로 추가'
                    }
                  </Text>
                  <Ionicons name="chevron-down-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            )}

            {/* 학원명 입력 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>학원명</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="school-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={formData.academyName}
                  onChangeText={(text) => updateFormData({ academyName: text })}
                  placeholder="학원명 입력"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* 과목 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>과목</Text>
              <View style={styles.subjectContainer}>
                {options.subjectOptions.map((subject) => (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.subjectButton,
                      formData.selectedSubject === subject && styles.subjectButtonSelected
                    ]}
                    onPress={() => updateFormData({ selectedSubject: subject })}
                  >
                    <Text style={[
                      styles.subjectButtonText,
                      formData.selectedSubject === subject && styles.subjectButtonTextSelected
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
        {formData.category !== '학원' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>제목</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="create-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={formData.title}
                onChangeText={(text) => updateFormData({ title: text })}
                placeholder="제목 입력"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        )}

        {/* 반복 설정 */}
        {(!isEditMode || !formData.isRecurring) && (
          <View style={styles.section}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>선택한 요일 매주 반복</Text>
              <Switch
                value={formData.isRecurring}
                onValueChange={(value) => {
                  console.log('🔄 Recurring toggle changed to:', value);
                  updateFormData({ isRecurring: value });
                }}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                thumbColor={formData.isRecurring ? '#fff' : '#fff'}
              />
            </View>
          </View>
        )}

        {/* 반복 일정 정보 표시 */}
        {isEditMode && formData.isRecurring && !uiState.isEditingException && (
          <View style={styles.section}>
            <View style={styles.recurringInfo}>
              <Ionicons name="refresh-outline" size={20} color="#007AFF" />
              <Text style={styles.recurringInfoText}>
                이 일정은 반복 일정입니다. 수정 시 옵션을 선택할 수 있습니다.
              </Text>
            </View>
          </View>
        )}

        {/* 메모 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>메모</Text>
          <TextInput
            style={styles.memoInput}
            value={formData.memo}
            onChangeText={(text) => updateFormData({ memo: text })}
            placeholder="메모 입력"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* 반복 일정 편집 옵션 모달 */}
      <Modal
        visible={uiState.showRecurringEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => updateUIState({ showRecurringEditModal: false })}
      >
        <View style={styles.recurringModalOverlay}>
          <View style={styles.recurringModalContainer}>
            <Text style={styles.recurringModalTitle}>반복 일정 편집</Text>
            <Text style={styles.recurringModalDescription}>
              이 일정은 반복 일정입니다. 어떻게 수정하시겠습니까?
            </Text>
            
            <TouchableOpacity
              style={styles.recurringOptionButton}
              onPress={() => handleRecurringEditConfirm('this_only')}
            >
              <View style={styles.recurringOptionContent}>
                <Text style={styles.recurringOptionTitle}>이번만 수정</Text>
                <Text style={styles.recurringOptionDescription}>
                  {moment(route.params.selectedDate).format('M월 D일')} 일정만 수정합니다
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.recurringOptionButton}
              onPress={() => handleRecurringEditConfirm('all_future')}
            >
              <View style={styles.recurringOptionContent}>
                <Text style={styles.recurringOptionTitle}>앞으로 모두 수정</Text>
                <Text style={styles.recurringOptionDescription}>
                  반복 패턴 자체를 변경하여 모든 미래 일정에 적용합니다
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.recurringCancelButton}
              onPress={() => updateUIState({ showRecurringEditModal: false })}
            >
              <Text style={styles.recurringCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 반복 일정 삭제 옵션 모달 */}
      <Modal
        visible={uiState.showRecurringDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => updateUIState({ showRecurringDeleteModal: false })}
      >
        <View style={styles.recurringModalOverlay}>
          <View style={styles.recurringModalContainer}>
            <Text style={styles.recurringModalTitle}>
              {uiState.isEditingException ? '예외 삭제' : '반복 일정 삭제'}
            </Text>
            <Text style={styles.recurringModalDescription}>
              {uiState.isEditingException 
                ? '이 날짜의 수정사항을 제거하고 원래 반복 일정으로 되돌리시겠습니까?'
                : '이 반복 일정을 어떻게 삭제하시겠습니까?'
              }
            </Text>
            
            {uiState.isEditingException ? (
              <TouchableOpacity
                style={styles.recurringOptionButton}
                onPress={() => handleRecurringDeleteConfirm('restore')}
              >
                <View style={styles.recurringOptionContent}>
                  <Text style={styles.recurringOptionTitle}>원래대로 되돌리기</Text>
                  <Text style={styles.recurringOptionDescription}>
                    {moment(route.params.selectedDate).format('M월 D일')} 수정사항을 제거하고 원래 반복 일정으로 복원합니다
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.recurringOptionButton}
                  onPress={() => handleRecurringDeleteConfirm('this_only')}
                >
                  <View style={styles.recurringOptionContent}>
                    <Text style={styles.recurringOptionTitle}>이번만 삭제</Text>
                    <Text style={styles.recurringOptionDescription}>
                      {moment(route.params.selectedDate).format('M월 D일')} 일정만 삭제합니다
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.recurringOptionButton, styles.dangerOption]}
                  onPress={() => handleRecurringDeleteConfirm('all_future')}
                >
                  <View style={styles.recurringOptionContent}>
                    <Text style={[styles.recurringOptionTitle, styles.dangerText]}>전체 삭제</Text>
                    <Text style={[styles.recurringOptionDescription, styles.dangerText]}>
                      모든 반복 일정을 삭제합니다 (복구 불가)
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </>
            )}
            
            <TouchableOpacity
              style={styles.recurringCancelButton}
              onPress={() => updateUIState({ showRecurringDeleteModal: false })}
            >
              <Text style={styles.recurringCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CustomPicker들 */}
      <CustomPicker
        visible={uiState.showStartTimePicker}
        title="시작 시간"
        selectedValue={formData.startTime}
        options={options.timeOptions}
        onCancel={() => {
          console.log('❌ Start time picker cancelled');
          updateUIState({ showStartTimePicker: false });
        }}
        onConfirm={handleStartTimeSelect}
      />

      <CustomPicker
        visible={uiState.showEndTimePicker}
        title="종료 시간"
        selectedValue={formData.endTime}
        options={options.timeOptions}
        onCancel={() => {
          console.log('❌ End time picker cancelled');
          updateUIState({ showEndTimePicker: false });
        }}
        onConfirm={handleEndTimeSelect}
      />

      {/* 학원 선택 Picker */}
      <CustomPicker
        visible={uiState.showAcademyPicker}
        title="학원 선택"
        selectedValue={formData.selectedAcademy?.id.toString() || 'new'}
        options={[...options.academyOptions.map(opt => opt.value), 'new']}
        optionLabels={[...options.academyOptions.map(opt => opt.label), '새 학원 추가']}
        onCancel={() => updateUIState({ showAcademyPicker: false })}
        onConfirm={handleAcademySelect}
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
  // ✅ 디버깅 정보 스타일 추가
  debugInfo: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#F57C00',
    marginBottom: 2,
  },
  exceptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  exceptionInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#F57C00',
    lineHeight: 16,
    fontWeight: '500',
  },
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
  recurringInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  recurringInfoText: {
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  recurringModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  recurringModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recurringModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  recurringModalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  recurringOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  recurringOptionContent: {
    flex: 1,
  },
  recurringOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  recurringOptionDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 16,
  },
  dangerOption: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FED7D7',
  },
  dangerText: {
    color: '#FF3B30',
  },
  recurringCancelButton: {
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  recurringCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
});

export default EventScreen;