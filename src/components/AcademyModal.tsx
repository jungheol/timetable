import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import Modal from 'react-native-modal';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import DatabaseService, { Academy } from '../services/DatabaseService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  academy?: Academy | null;
}

const AcademyModal: React.FC<Props> = ({
  visible,
  onClose,
  onSave,
  academy,
}) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState<Academy['subject']>('기타');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [paymentCycle, setPaymentCycle] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'카드' | '이체'>('카드');
  const [paymentDay, setPaymentDay] = useState('');
  const [paymentInstitution, setPaymentInstitution] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [textbookFee, setTextbookFee] = useState('');
  const [textbookBank, setTextbookBank] = useState('');
  const [textbookAccount, setTextbookAccount] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [status, setStatus] = useState<'진행' | '중단'>('진행');
  const [providesVehicle, setProvidesVehicle] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      if (academy) {
        // 편집 모드
        setName(academy.name);
        setSubject(academy.subject);
        setMonthlyFee(academy.monthly_fee?.toString() || '');
        setPaymentCycle(academy.payment_cycle || 1);
        setPaymentMethod(academy.payment_method || '카드');
        setPaymentDay(academy.payment_day?.toString() || '');
        setPaymentInstitution(academy.payment_institution || '');
        setPaymentAccount(academy.payment_account || '');
        setTextbookFee(academy.textbook_fee?.toString() || '');
        setTextbookBank(academy.textbook_bank || '');
        setTextbookAccount(academy.textbook_account || '');
        setStartMonth(academy.start_month || '');
        setEndMonth(academy.end_month || '');
        setStatus(academy.status);
        setProvidesVehicle(academy.provides_vehicle || false);
        setNote(academy.note || '');
      } else {
        // 새 학원 추가 모드
        resetForm();
      }
    }
  }, [visible, academy]);

  const resetForm = () => {
    setName('');
    setSubject('기타');
    setMonthlyFee('');
    setPaymentCycle(1);
    setPaymentMethod('카드');
    setPaymentDay('');
    setPaymentInstitution('');
    setPaymentAccount('');
    setTextbookFee('');
    setTextbookBank('');
    setTextbookAccount('');
    setStartMonth(moment().format('YYYY-MM'));
    setEndMonth('');
    setStatus('진행');
    setProvidesVehicle(false);
    setNote('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('오류', '학원 이름을 입력해주세요.');
      return;
    }

    if (paymentDay && (parseInt(paymentDay) < 1 || parseInt(paymentDay) > 31)) {
      Alert.alert('오류', '결제일은 1-31 사이의 값을 입력해주세요.');
      return;
    }

    try {
      const academyData: Omit<Academy, 'id' | 'created_at' | 'updated_at'> = {
        name: name.trim(),
        subject,
        monthly_fee: monthlyFee ? parseInt(monthlyFee) : undefined,
        payment_cycle: paymentCycle,
        payment_method: paymentMethod,
        payment_day: paymentDay ? parseInt(paymentDay) : undefined,
        payment_institution: paymentInstitution.trim() || undefined,
        payment_account: paymentAccount.trim() || undefined,
        textbook_fee: textbookFee ? parseInt(textbookFee) : undefined,
        textbook_bank: textbookBank.trim() || undefined,
        textbook_account: textbookAccount.trim() || undefined,
        start_month: startMonth || undefined,
        end_month: endMonth || undefined,
        status,
        provides_vehicle: providesVehicle,
        note: note.trim() || undefined,
        del_yn: false,
      };

      if (academy?.id) {
        // 편집
        await DatabaseService.updateAcademy({ ...academyData, id: academy.id });
      } else {
        // 새 학원 추가
        await DatabaseService.createAcademy(academyData);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving academy:', error);
      Alert.alert('오류', '학원 정보를 저장하는 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!academy?.id) return;

    Alert.alert(
      '학원 삭제',
      '이 학원을 삭제하시겠습니까?\n관련된 모든 일정도 함께 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteAcademy(academy.id!);
              onSave();
              onClose();
            } catch (error) {
              console.error('Error deleting academy:', error);
              Alert.alert('오류', '학원을 삭제하는 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
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
            {academy ? '학원 편집' : '새 학원 추가'}
          </Text>
          {academy && (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.form}>
          {/* 기본 정보 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>기본 정보</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>학원 이름 *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="학원 이름을 입력하세요"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>과목</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={subject}
                  onValueChange={setSubject}
                  style={styles.picker}
                >
                  <Picker.Item label="국어" value="국어" />
                  <Picker.Item label="수학" value="수학" />
                  <Picker.Item label="영어" value="영어" />
                  <Picker.Item label="예체능" value="예체능" />
                  <Picker.Item label="사회과학" value="사회과학" />
                  <Picker.Item label="기타" value="기타" />
                </Picker>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>상태</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={status}
                  onValueChange={setStatus}
                  style={styles.picker}
                >
                  <Picker.Item label="진행" value="진행" />
                  <Picker.Item label="중단" value="중단" />
                </Picker>
              </View>
            </View>
          </View>

          {/* 학원비 정보 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>학원비 정보</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>월 학원비 (원)</Text>
              <TextInput
                style={styles.textInput}
                value={monthlyFee}
                onChangeText={setMonthlyFee}
                placeholder="예: 100000"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>결제 주기 (개월)</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={paymentCycle}
                  onValueChange={setPaymentCycle}
                  style={styles.picker}
                >
                  <Picker.Item label="1개월" value={1} />
                  <Picker.Item label="2개월" value={2} />
                  <Picker.Item label="3개월" value={3} />
                  <Picker.Item label="6개월" value={6} />
                  <Picker.Item label="12개월" value={12} />
                </Picker>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>결제 방법</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={paymentMethod}
                  onValueChange={setPaymentMethod}
                  style={styles.picker}
                >
                  <Picker.Item label="카드 결제" value="카드" />
                  <Picker.Item label="계좌 이체" value="이체" />
                </Picker>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>결제일</Text>
              <TextInput
                style={styles.textInput}
                value={paymentDay}
                onChangeText={setPaymentDay}
                placeholder="예: 15 (매월 15일)"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>은행명/카드사</Text>
              <TextInput
                style={styles.textInput}
                value={paymentInstitution}
                onChangeText={setPaymentInstitution}
                placeholder="예: 신한은행, 삼성카드"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>계좌번호/카드번호</Text>
              <TextInput
                style={styles.textInput}
                value={paymentAccount}
                onChangeText={setPaymentAccount}
                placeholder="계좌번호 또는 카드번호"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* 교재비 정보 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>교재비 정보</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>교재비 (원)</Text>
              <TextInput
                style={styles.textInput}
                value={textbookFee}
                onChangeText={setTextbookFee}
                placeholder="예: 50000"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>교재비 은행</Text>
              <TextInput
                style={styles.textInput}
                value={textbookBank}
                onChangeText={setTextbookBank}
                placeholder="예: 국민은행"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>교재비 계좌번호</Text>
              <TextInput
                style={styles.textInput}
                value={textbookAccount}
                onChangeText={setTextbookAccount}
                placeholder="교재비 계좌번호"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* 기타 정보 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>기타 정보</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>시작월</Text>
              <TextInput
                style={styles.textInput}
                value={startMonth}
                onChangeText={setStartMonth}
                placeholder="YYYY-MM (예: 2025-03)"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>종료월</Text>
              <TextInput
                style={styles.textInput}
                value={endMonth}
                onChangeText={setEndMonth}
                placeholder="YYYY-MM (비워두면 진행중)"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>차량 제공</Text>
                <Switch
                  value={providesVehicle}
                  onValueChange={setProvidesVehicle}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                  thumbColor={providesVehicle ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>메모</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={note}
                onChangeText={setNote}
                placeholder="추가 메모사항"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>저장</Text>
        </TouchableOpacity>
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
    maxHeight: '95%',
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
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
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
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

export default AcademyModal;