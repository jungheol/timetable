import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import DatabaseService, { Schedule } from '../services/DatabaseService';

// ✅ 통합된 스케줄 관리 상태 인터페이스
interface ScheduleManagementState {
  allSchedules: Schedule[];
  showScheduleDropdown: boolean;
  showEditModal: boolean;
  editingSchedule: Schedule | null;
  editScheduleName: string;
}

export const useScheduleManagement = () => {
  // ✅ 통합된 상태 관리
  const [state, setState] = useState<ScheduleManagementState>({
    allSchedules: [],
    showScheduleDropdown: false,
    showEditModal: false,
    editingSchedule: null,
    editScheduleName: '',
  });

  // ✅ 배치 상태 업데이트 함수
  const updateStateBatch = useCallback((updates: Partial<ScheduleManagementState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // ✅ 개별 setter들 (호환성을 위해 유지)
  const setEditScheduleName = useCallback((name: string) => {
    updateStateBatch({ editScheduleName: name });
  }, [updateStateBatch]);

  // 스케줄 목록 로드
  const loadAllSchedules = useCallback(async () => {
    try {
      console.log('📋 [ScheduleManagement] Loading all schedules...');
      const schedules = await DatabaseService.getAllSchedules();
      updateStateBatch({ allSchedules: schedules });
      console.log('✅ [ScheduleManagement] Loaded', schedules.length, 'schedules');
    } catch (error) {
      console.error('❌ [ScheduleManagement] Error loading all schedules:', error);
    }
  }, [updateStateBatch]);

  // ✅ 스케줄 변경 처리 (최적화된 버전)
  const handleScheduleChange = useCallback(async (
    selectedSchedule: Schedule, 
    currentSchedule: Schedule | null,
    onScheduleChanged: (schedule: Schedule) => Promise<void>
  ) => {
    try {
      console.log('🔄 [ScheduleManagement] Changing schedule to:', selectedSchedule.name);
      
      // ✅ UI 먼저 닫기 (사용자 경험 개선)
      updateStateBatch({ showScheduleDropdown: false });

      // ✅ DB 업데이트 (병렬 처리)
      const updatePromises = [];
      
      // 기존 활성 스케줄 비활성화
      if (currentSchedule && currentSchedule.id !== selectedSchedule.id) {
        updatePromises.push(
          DatabaseService.updateSchedule({
            ...currentSchedule,
            is_active: false,
          })
        );
      }

      // 선택한 스케줄 활성화
      updatePromises.push(
        DatabaseService.updateSchedule({
          ...selectedSchedule,
          is_active: true,
        })
      );

      // ✅ 병렬로 DB 업데이트 실행
      await Promise.all(updatePromises);

      // ✅ 상위 컴포넌트에 변경 사항 알림 (통합된 함수 호출)
      await onScheduleChanged(selectedSchedule);
      
      console.log('✅ [ScheduleManagement] Schedule changed successfully:', selectedSchedule.name);
      
      return selectedSchedule;
    } catch (error) {
      console.error('❌ [ScheduleManagement] Error switching schedule:', error);
      Alert.alert('오류', '스케줄 변경 중 오류가 발생했습니다.');
      throw error;
    }
  }, [updateStateBatch]);

  // 스케줄 이름 수정 시작
  const handleEditScheduleName = useCallback((scheduleToEdit: Schedule) => {
    console.log('✏️ [ScheduleManagement] Starting to edit schedule:', scheduleToEdit.name);
    
    updateStateBatch({
      editingSchedule: scheduleToEdit,
      editScheduleName: scheduleToEdit.name,
      showEditModal: true,
      showScheduleDropdown: false,
    });
  }, [updateStateBatch]);

  // ✅ 스케줄 이름 수정 완료 (최적화된 버전)
  const handleSaveScheduleName = useCallback(async (
    currentSchedule: Schedule | null,
    onScheduleUpdated: (schedule: Schedule) => void
  ) => {
    if (!state.editingSchedule || !state.editScheduleName.trim()) {
      Alert.alert('알림', '스케줄 이름을 입력해주세요.');
      return;
    }

    try {
      console.log('💾 [ScheduleManagement] Saving schedule name:', state.editScheduleName);
      
      const updatedSchedule = {
        ...state.editingSchedule,
        name: state.editScheduleName.trim(),
      };

      // ✅ DB 업데이트
      await DatabaseService.updateSchedule(updatedSchedule);
      
      // ✅ 현재 활성 스케줄이 수정된 경우 업데이트
      if (currentSchedule && currentSchedule.id === state.editingSchedule.id) {
        onScheduleUpdated(updatedSchedule);
      }
      
      // ✅ 스케줄 목록 새로고침 + 모달 닫기 (병렬 처리)
      await Promise.all([
        loadAllSchedules(),
        // 모달 상태 초기화
        new Promise<void>(resolve => {
          updateStateBatch({
            showEditModal: false,
            editingSchedule: null,
            editScheduleName: '',
          });
          resolve();
        })
      ]);
      
      console.log('✅ [ScheduleManagement] Schedule name updated successfully:', state.editScheduleName);
    } catch (error) {
      console.error('❌ [ScheduleManagement] Error updating schedule name:', error);
      Alert.alert('오류', '스케줄 이름 수정 중 오류가 발생했습니다.');
    }
  }, [state.editingSchedule, state.editScheduleName, loadAllSchedules, updateStateBatch]);

  // ✅ 모달 관리 함수들 (배치 업데이트 사용)
  const openScheduleDropdown = useCallback(() => {
    updateStateBatch({ showScheduleDropdown: true });
  }, [updateStateBatch]);

  const closeScheduleDropdown = useCallback(() => {
    updateStateBatch({ showScheduleDropdown: false });
  }, [updateStateBatch]);

  const closeEditModal = useCallback(() => {
    updateStateBatch({
      showEditModal: false,
      editingSchedule: null,
      editScheduleName: '',
    });
  }, [updateStateBatch]);

  return {
    // 상태
    allSchedules: state.allSchedules,
    showScheduleDropdown: state.showScheduleDropdown,
    showEditModal: state.showEditModal,
    editScheduleName: state.editScheduleName,
    
    // 함수들
    setEditScheduleName,
    loadAllSchedules,
    handleScheduleChange,
    handleEditScheduleName,
    handleSaveScheduleName,
    openScheduleDropdown,
    closeScheduleDropdown,
    closeEditModal,
    
    // 새로운 통합 함수
    updateStateBatch,
  };
};