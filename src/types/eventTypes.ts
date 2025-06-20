import { Event, Academy, Schedule, RecurringException } from '../services/DatabaseService';

// 폼 데이터 타입
export interface EventFormData {
  title: string;
  startTime: string;
  endTime: string;
  selectedDays: Set<string>;
  category: Event['category'];
  academyName: string;
  selectedSubject: Academy['subject'];
  isRecurring: boolean;
  memo: string;
  selectedAcademy: Academy | null;
}

// UI 상태 타입
export interface EventUIState {
  showStartTimePicker: boolean;
  showEndTimePicker: boolean;
  showCategoryPicker: boolean;
  showSubjectPicker: boolean;
  showAcademyPicker: boolean;
  showRecurringEditModal: boolean;
  showRecurringDeleteModal: boolean;
  isLoading: boolean;
  isEditingException: boolean;
}

// 옵션 타입
export interface EventOptions {
  weekdays: DayButton[];
  availableDays: DayButton[];
  timeOptions: string[];
  categoryOptions: string[];
  subjectOptions: Academy['subject'][];
  academyOptions: { value: string; label: string }[];
}

// 요일 버튼 타입
export interface DayButton {
  key: string;
  label: string;
  index: number;
}

// 이벤트 스크린 파라미터 타입
export interface EventScreenParams {
  event?: Event | null;
  selectedDate: string;
  selectedTime?: string;
  scheduleId: number;
  onSave: () => void;
}

// 반복 일정 편집/삭제 타입
export type RecurringEditType = 'this_only' | 'all_future';
export type RecurringDeleteType = 'this_only' | 'all_future' | 'restore';

// 폼 상태 초기화 함수들
export const createInitialFormData = (): EventFormData => ({
  title: '',
  startTime: '',
  endTime: '',
  selectedDays: new Set<string>(),
  category: '선택안함' as Event['category'],
  academyName: '',
  selectedSubject: '국어' as Academy['subject'],
  isRecurring: false,
  memo: '',
  selectedAcademy: null,
});

export const createInitialUIState = (): EventUIState => ({
  showStartTimePicker: false,
  showEndTimePicker: false,
  showCategoryPicker: false,
  showSubjectPicker: false,
  showAcademyPicker: false,
  showRecurringEditModal: false,
  showRecurringDeleteModal: false,
  isLoading: false,
  isEditingException: false,
});

// 상수 정의
export const WEEKDAYS: DayButton[] = [
  { key: 'monday', label: '월', index: 1 },
  { key: 'tuesday', label: '화', index: 2 },
  { key: 'wednesday', label: '수', index: 3 },
  { key: 'thursday', label: '목', index: 4 },
  { key: 'friday', label: '금', index: 5 },
  { key: 'saturday', label: '토', index: 6 },
  { key: 'sunday', label: '일', index: 0 },
];

export const CATEGORY_OPTIONS: string[] = ['학교/기관', '학원', '공부', '휴식', '선택안함'];
export const SUBJECT_OPTIONS: Academy['subject'][] = ['국어', '수학', '영어', '예체능', '사회과학', '기타'];