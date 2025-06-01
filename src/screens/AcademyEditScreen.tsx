import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import moment from 'moment';
import DatabaseService, { Academy } from '../services/DatabaseService';
import CustomPicker from '../components/CustomPicker';
import { RootStackParamList } from '../../App';

type AcademyEditScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AcademyEditScreen'>;
type AcademyEditScreenRouteProp = RouteProp<RootStackParamList, 'AcademyEditScreen'>;

interface Props {
  navigation: AcademyEditScreenNavigationProp;
  route: AcademyEditScreenRouteProp;
}

const AcademyEditScreen: React.FC<Props> = ({ navigation, route }) => {
  const { academy, onSave } = route.params || {};
  const isEditMode = !!academy;

  // 기본 정보
  const [name, setName] = useState('');
  const [subject, setSubject] = useState<Academy['subject']>('국어');
  
  // 학원비 정보
  const [monthlyFee, setMonthlyFee] = useState('');
  const [paymentCycle, setPaymentCycle] = useState('1개월');
  const [paymentMethod, setPaymentMethod] = useState<'카드' | '이체'>('카드');
  const [paymentDay, setPaymentDay] = useState('1');
  const [paymentInstitution, setPaymentInstitution] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('');
  
  // 교재비 정보
  const [textbookFee, setTextbookFee] = useState('');
  const [textbookBank, setTextbookBank] = useState('');
  const [textbookAccount, setTextbookAccount] = useState('');
  
  // 기간 정보
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  
  // 기타 정보
  const [providesVehicle, setProvidesVehicle] = useState(false);
  const [note, setNote] = useState('');
  
  // UI 상태
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [showPaymentCyclePicker, setShowPaymentCyclePicker] = useState(false);
  const [showPaymentDayPicker, setShowPaymentDayPicker] = useState(false);
  const [showStartMonthPicker, setShowStartMonthPicker] = useState(false);
  const [showEndMonthPicker, setShowEndMonthPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 옵션 데이터
  const subjectOptions: Academy['subject'][] = ['국어', '수학', '영어', '예체능', '사회과학', '기타'];
  const paymentCycleOptions = ['1개월', '2개월', '3개월', '6개월', '1년'];
  const paymentDayOptions = Array.from({ length: 31 }, (_, i) => `${i + 1}`);
  
  // 년/월 옵션 생성 (현재 년도 기준 ±5년)
  const generateMonthOptions = () => {
    const options: string[] = [];
    const currentYear = moment().year();
    
    for (let year = currentYear - 5; year <= currentYear + 5; year++) {
      for (let month = 1; month <= 12; month++) {
        options.push(`${year}-${month.toString().padStart(2, '0')}`);
      }
    }
    return options;
  };
  
  const monthOptions = generateMonthOptions();

  useEffect(() => {
    if (isEditMode && academy) {
      initializeForm();
    } else {
      // 새 학원 추가 시 기본값 설정
      setStartMonth(moment().format('YYYY-MM'));
    }
  }, [academy]);

  const initializeForm = () => {
    if (!academy) return;
    
    setName(academy.name);
    setSubject(academy.subject);
    setMonthlyFee(academy.monthly_fee?.toString() || '');
    setPaymentCycle(getCycleText(academy.payment_cycle || 1));
    setPaymentMethod(academy.payment_method || '카드');
    setPaymentDay(academy.payment_day?.toString() || '1');
    setPaymentInstitution(academy.payment_institution || '');
    setPaymentAccount(academy.payment_account || '');
    setTextbookFee(academy.textbook_fee?.toString() || '');
    setTextbookBank(academy.textbook_bank || '');
    setTextbookAccount(academy.textbook_account || '');
    setStartMonth(academy.start_month || moment().format('YYYY-MM'));
    setEndMonth(academy.end_month || '');
    setProvidesVehicle(academy.provides_vehicle || false);
    setNote(academy.note || '');
  };

  const getCycleText = (cycle: number): string => {
    const cycleMap: { [key: number]: string } = {
      1: '1개월',
      2: '2개월',
      3: '3개월',
      6: '6개월',
      12: '1년'
    };
    return cycleMap[cycle] || '1개월';
  };

  const getCycleNumber = (cycleText: string): number => {
    const cycleMap: { [key: string]: number } = {
      '1개월': 1,
      '2개월': 2,
      '3개월': 3,
      '6개월': 6,
      '1년': 12
    };
    return cycleMap[cycleText] || 1;
  };

  const formatMonthDisplay = (monthStr: string): string => {
    if (!monthStr) return '선택하세요';
    return moment(monthStr, 'YYYY-MM').format('YYYY년 MM월');
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('오류', '학원명을 입력해주세요.');
      return false;
    }

    if (monthlyFee && isNaN(Number(monthlyFee))) {
      Alert.alert('오류', '학원비는 숫자만 입력 가능합니다.');
      return false;
    }

    if (textbookFee && isNaN(Number(textbookFee))) {
      Alert.alert('오류', '교재비는 숫자만 입력 가능합니다.');
      return false;
    }

    if (paymentMethod === '카드' && monthlyFee && (!paymentInstitution.trim() || !paymentAccount.trim())) {
      Alert.alert('오류', '카드명과 카드번호를 입력해주세요.');
      return false;
    }

    if (paymentMethod === '이체' && monthlyFee && (!paymentInstitution.trim() || !paymentAccount.trim())) {
      Alert.alert('오류', '은행명과 계좌번호를 입력해주세요.');
      return false;
    }

    if (textbookFee && (!textbookBank.trim() || !textbookAccount.trim())) {
      Alert.alert('오류', '교재비 은행명과 계좌번호를 입력해주세요.');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const academyData: Omit<Academy, 'id' | 'created_at' | 'updated_at'> = {
        name: name.trim(),
        subject,
        monthly_fee: monthlyFee ? Number(monthlyFee) : undefined,
        payment_cycle: getCycleNumber(paymentCycle),
        payment_method: monthlyFee ? paymentMethod : undefined,
        payment_day: Number(paymentDay),
        payment_institution: paymentInstitution.trim() || undefined,
        payment_account: paymentAccount.trim() || undefined,
        textbook_fee: textbookFee ? Number(textbookFee) : undefined,
        textbook_bank: textbookBank.trim() || undefined,
        textbook_account: textbookAccount.trim() || undefined,
        start_month: startMonth,
        end_month: endMonth || undefined,
        status: academy?.status || '진행',
        provides_vehicle: providesVehicle,
        note: note.trim() || undefined,
        del_yn: false,
      };

      if (isEditMode && academy) {
        await DatabaseService.updateAcademy({ ...academyData, id: academy.id });
      } else {
        await DatabaseService.createAcademy(academyData);
      }

      onSave?.();
      navigation.goBack();
      
      Alert.alert(
        '완료', 
        isEditMode ? '학원 정보가 수정되었습니다.' : '새 학원이 추가되었습니다.'
      );
    } catch (error) {
      console.error('Error saving academy:', error);
      Alert.alert('오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {isEditMode ? '학원 수정' : '학원 추가'}
        </Text>
        
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.headerButton}
          disabled={isLoading}
        >
          <Text style={[styles.saveText, isLoading && styles.disabledText]}>
            {isLoading ? '저장중...' : '저장'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 기본 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기본 정보</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>학원명 *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="학원명을 입력하세요"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>과목</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowSubjectPicker(true)}
            >
              <Text style={styles.pickerButtonText}>{subject}</Text>
              <Ionicons name="chevron-down-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 학원비 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>학원비 정보</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>학원비 (월)</Text>
            <TextInput
              style={styles.textInput}
              value={monthlyFee}
              onChangeText={setMonthlyFee}
              placeholder="금액을 입력하세요"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>결제 주기</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowPaymentCyclePicker(true)}
            >
              <Text style={styles.pickerButtonText}>{paymentCycle}</Text>
              <Ionicons name="chevron-down-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>결제 방법</Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  paymentMethod === '카드' && styles.toggleButtonActive
                ]}
                onPress={() => setPaymentMethod('카드')}
              >
                <Text style={[
                  styles.toggleButtonText,
                  paymentMethod === '카드' && styles.toggleButtonTextActive
                ]}>
                  카드
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  paymentMethod === '이체' && styles.toggleButtonActive
                ]}
                onPress={() => setPaymentMethod('이체')}
              >
                <Text style={[
                  styles.toggleButtonText,
                  paymentMethod === '이체' && styles.toggleButtonTextActive
                ]}>
                  이체
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {paymentMethod === '카드' ? '카드명' : '은행명'}
            </Text>
            <TextInput
              style={styles.textInput}
              value={paymentInstitution}
              onChangeText={setPaymentInstitution}
              placeholder={paymentMethod === '카드' ? '카드명을 입력하세요' : '은행명을 입력하세요'}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {paymentMethod === '카드' ? '카드번호' : '계좌번호'}
            </Text>
            <TextInput
              style={styles.textInput}
              value={paymentAccount}
              onChangeText={setPaymentAccount}
              placeholder={paymentMethod === '카드' ? '카드번호를 입력하세요' : '계좌번호를 입력하세요'}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>결제일</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowPaymentDayPicker(true)}
            >
              <Text style={styles.pickerButtonText}>{paymentDay}일</Text>
              <Ionicons name="chevron-down-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 교재비 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>교재비 정보</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>교재비</Text>
            <TextInput
              style={styles.textInput}
              value={textbookFee}
              onChangeText={setTextbookFee}
              placeholder="교재비를 입력하세요"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>교재비 은행명</Text>
            <TextInput
              style={styles.textInput}
              value={textbookBank}
              onChangeText={setTextbookBank}
              placeholder="은행명을 입력하세요"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>교재비 계좌번호</Text>
            <TextInput
              style={styles.textInput}
              value={textbookAccount}
              onChangeText={setTextbookAccount}
              placeholder="계좌번호를 입력하세요"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* 기간 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기간 정보</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>시작 년/월 *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowStartMonthPicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {formatMonthDisplay(startMonth)}
              </Text>
              <Ionicons name="chevron-down-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>중단 년/월</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowEndMonthPicker(true)}
            >
              <Text style={[
                styles.pickerButtonText,
                !endMonth && styles.placeholderText
              ]}>
                {endMonth ? formatMonthDisplay(endMonth) : '진행중 (선택사항)'}
              </Text>
              <Ionicons name="chevron-down-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 기타 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기타 정보</Text>
          
          <View style={styles.formGroup}>
            <View style={styles.switchContainer}>
              <Text style={styles.label}>차량 제공</Text>
              <Switch
                value={providesVehicle}
                onValueChange={setProvidesVehicle}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>메모</Text>
            <TextInput
              style={styles.textInput}
              value={note}
              onChangeText={setNote}
              placeholder="메모를 입력하세요"
              placeholderTextColor="#999"
            />
          </View>
        </View>
      </ScrollView>

      {/* CustomPicker들 */}
      <CustomPicker
        visible={showSubjectPicker}
        title="과목 선택"
        selectedValue={subject}
        options={subjectOptions}
        onCancel={() => setShowSubjectPicker(false)}
        onConfirm={(value) => {
          setSubject(value as Academy['subject']);
          setShowSubjectPicker(false);
        }}
      />

      <CustomPicker
        visible={showPaymentCyclePicker}
        title="결제 주기"
        selectedValue={paymentCycle}
        options={paymentCycleOptions}
        onCancel={() => setShowPaymentCyclePicker(false)}
        onConfirm={(value) => {
          setPaymentCycle(value);
          setShowPaymentCyclePicker(false);
        }}
      />

      <CustomPicker
        visible={showPaymentDayPicker}
        title="결제일"
        selectedValue={paymentDay}
        options={paymentDayOptions}
        onCancel={() => setShowPaymentDayPicker(false)}
        onConfirm={(value) => {
          setPaymentDay(value);
          setShowPaymentDayPicker(false);
        }}
      />

      <CustomPicker
        visible={showStartMonthPicker}
        title="시작 년/월"
        selectedValue={startMonth}
        options={monthOptions}
        onCancel={() => setShowStartMonthPicker(false)}
        onConfirm={(value) => {
          setStartMonth(value);
          setShowStartMonthPicker(false);
        }}
      />

      <CustomPicker
        visible={showEndMonthPicker}
        title="중단 년/월"
        selectedValue={endMonth}
        options={['', ...monthOptions]}
        onCancel={() => setShowEndMonthPicker(false)}
        onConfirm={(value) => {
          setEndMonth(value);
          setShowEndMonthPicker(false);
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
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  saveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledText: {
    color: '#ccc',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  formGroup: {
    paddingHorizontal: 20,
    marginBottom: 20,
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
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default AcademyEditScreen;