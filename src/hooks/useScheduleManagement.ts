import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import DatabaseService, { Schedule } from '../services/DatabaseService';

export const useScheduleManagement = () => {
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editScheduleName, setEditScheduleName] = useState('');

  const loadAllSchedules = useCallback(async () => {
    try {
      const schedules = await DatabaseService.getAllSchedules();
      setAllSchedules(schedules);
    } catch (error) {
      console.error('Error loading all schedules:', error);
    }
  }, []);

  // 스케줄 변경 처리
  const handleScheduleChange = useCallback(async (
    selectedSchedule: Schedule, 
    currentSchedule: Schedule | null,
    onScheduleChanged: (schedule: Schedule) => void
  ) => {
    try {
      // 기존 활성 스케줄을 비활성화
      if (currentSchedule) {
        await DatabaseService.updateSchedule({
          ...currentSchedule,
          is_active: false,
        });
      }

      // 선택한 스케줄을 활성화
      await DatabaseService.updateSchedule({
        ...selectedSchedule,
        is_active: true,
      });

      onScheduleChanged(selectedSchedule);
      setShowScheduleDropdown(false);
      
      console.log(`✅ Switched to schedule: ${selectedSchedule.name}`);
      return selectedSchedule;
    } catch (error) {
      console.error('Error switching schedule:', error);
      Alert.alert('오류', '스케줄 변경 중 오류가 발생했습니다.');
      throw error;
    }
  }, []);

  // 스케줄 이름 수정 시작
  const handleEditScheduleName = useCallback((scheduleToEdit: Schedule) => {
    setEditingSchedule(scheduleToEdit);
    setEditScheduleName(scheduleToEdit.name);
    setShowEditModal(true);
    setShowScheduleDropdown(false);
  }, []);

  // 스케줄 이름 수정 완료
  const handleSaveScheduleName = useCallback(async (
    currentSchedule: Schedule | null,
    onScheduleUpdated: (schedule: Schedule) => void
  ) => {
    if (!editingSchedule || !editScheduleName.trim()) {
      Alert.alert('알림', '스케줄 이름을 입력해주세요.');
      return;
    }

    try {
      const updatedSchedule = {
        ...editingSchedule,
        name: editScheduleName.trim(),
      };

      await DatabaseService.updateSchedule(updatedSchedule);
      
      // 현재 활성 스케줄이 수정된 경우 업데이트
      if (currentSchedule && currentSchedule.id === editingSchedule.id) {
        onScheduleUpdated(updatedSchedule);
      }
      
      // 스케줄 목록 새로고침
      await loadAllSchedules();
      
      setShowEditModal(false);
      setEditingSchedule(null);
      setEditScheduleName('');
      
      console.log(`✅ Schedule name updated: ${editScheduleName}`);
    } catch (error) {
      console.error('Error updating schedule name:', error);
      Alert.alert('오류', '스케줄 이름 수정 중 오류가 발생했습니다.');
    }
  }, [editingSchedule, editScheduleName, loadAllSchedules]);

  // 모달 닫기
  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingSchedule(null);
    setEditScheduleName('');
  }, []);

  const openScheduleDropdown = useCallback(() => {
    setShowScheduleDropdown(true);
  }, []);

  const closeScheduleDropdown = useCallback(() => {
    setShowScheduleDropdown(false);
  }, []);

  return {
    // 상태
    allSchedules,
    showScheduleDropdown,
    showEditModal,
    editingSchedule,
    editScheduleName,
    
    // 액션
    setEditScheduleName,
    loadAllSchedules,
    handleScheduleChange,
    handleEditScheduleName,
    handleSaveScheduleName,
    closeEditModal,
    openScheduleDropdown,
    closeScheduleDropdown,
  };
};