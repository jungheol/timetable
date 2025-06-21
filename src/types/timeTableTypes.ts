import moment from 'moment';
import { Schedule, Event, Holiday } from '../services/DatabaseService';

// 시간표 상태 타입
export interface TimeTableState {
  currentWeek: moment.Moment;
  events: Event[];
  schedule: Schedule | null;
  holidays: { [key: string]: Holiday };
  isLoadingHolidays: boolean;
}

// 스케줄 관리 상태 타입
export interface ScheduleManagementState {
  allSchedules: Schedule[];
  showScheduleDropdown: boolean;
  showEditModal: boolean;
  editingSchedule: Schedule | null;
  editScheduleName: string;
}

// 시간표 액션 타입
export interface TimeTableActions {
  loadSchedule: () => Promise<void>;
  loadEvents: () => Promise<void>;
  loadHolidaysForCurrentPeriod: () => Promise<void>;
  handleRefreshHolidays: () => Promise<number>;
  navigateWeek: (direction: 'prev' | 'next') => void;
  goToToday: () => void;
  calculateFocusWeek: (schedule: Schedule) => moment.Moment;
}

// 스케줄 관리 액션 타입
export interface ScheduleManagementActions {
  loadAllSchedules: () => Promise<void>;
  handleScheduleChange: (
    selectedSchedule: Schedule,
    currentSchedule: Schedule | null,
    onScheduleChanged: (schedule: Schedule) => void
  ) => Promise<Schedule>;
  handleEditScheduleName: (schedule: Schedule) => void;
  handleSaveScheduleName: (
    currentSchedule: Schedule | null,
    onScheduleUpdated: (schedule: Schedule) => void
  ) => Promise<void>;
  openScheduleDropdown: () => void;
  closeScheduleDropdown: () => void;
  closeEditModal: () => void;
}

// 컴포넌트 Props 타입들
export interface TimeTableHeaderProps {
  schedule: Schedule;
  onScheduleDropdownPress: () => void;
  onScreenshot: () => void;
  onRefreshHolidays: () => void;
  isLoadingHolidays: boolean;
}

export interface WeekNavigationProps {
  currentWeek: moment.Moment;
  weekDays: moment.Moment[];
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
}

export interface EventSummaryProps {
  events: Event[];
  holidays: { [key: string]: Holiday };
}

export interface CaptureHeaderProps {
  schedule: Schedule;
  weekDays: moment.Moment[];
}

export interface DateHeaderProps {
  weekDays: moment.Moment[];
  dayWidth: number;
  holidays: { [key: string]: Holiday };
}

export interface TimeTableGridProps {
  timeSlots: string[];
  weekDays: moment.Moment[];
  dayWidth: number;
  events: Event[];
  holidays: { [key: string]: Holiday };
  onCellPress: (date: moment.Moment, time: string) => void;
}

export interface ScheduleDropdownModalProps {
  visible: boolean;
  onClose: () => void;
  schedules: Schedule[];
  currentSchedule: Schedule;
  onScheduleChange: (schedule: Schedule) => void;
  onEditSchedule: (schedule: Schedule) => void;
  onCreateNew: () => void;
}

export interface EditScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  scheduleName: string;
  onScheduleNameChange: (name: string) => void;
  onSave: () => void;
}

// 유틸리티 함수 타입들
export type WeekDirection = 'prev' | 'next';

export interface TimeSlot {
  time: string;
  events: Event[];
}

export interface DayColumn {
  date: moment.Moment;
  timeSlots: TimeSlot[];
  isToday: boolean;
  isHoliday: boolean;
  holiday?: Holiday;
}

// 이벤트 스타일 타입
export interface EventStyle {
  backgroundColor: string;
  color: string;
}

// 캡처 관련 타입
export interface CaptureOptions {
  filename: string;
  onCaptureStart?: () => void;
  onCaptureEnd?: () => void;
  onSuccess?: (uri: string) => void;
  onError?: (error: any) => void;
}

// 훅 반환 타입들
export interface UseTimeTableDataReturn extends TimeTableState, TimeTableActions {
  setSchedule: (schedule: Schedule | null) => void;
  setCurrentWeek: (week: moment.Moment) => void;
}

export interface UseScheduleManagementReturn extends ScheduleManagementState, ScheduleManagementActions {
  setEditScheduleName: (name: string) => void;
}