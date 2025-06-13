import { useCallback } from 'react';
import NotificationService from '../services/NotificationService';
import DatabaseService from '../services/DatabaseService';

export const useAcademyNotifications = () => {
  
  // 학원 생성 후 알림 설정
  const handleAcademyCreated = useCallback(async (academyId: number) => {
    try {
      const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
      
      if (isNotificationEnabled) {
        const academy = await DatabaseService.getAcademyById(academyId);
        
        if (academy && academy.status === '진행' && academy.payment_day) {
          await NotificationService.updateAcademyNotifications(academyId);
          console.log(`새 학원 ${academy.name}의 결제일 알림이 설정되었습니다.`);
        }
      }
    } catch (error) {
      console.error('학원 생성 후 알림 설정 오류:', error);
    }
  }, []);

  // 학원 수정 후 알림 업데이트
  const handleAcademyUpdated = useCallback(async (academyId: number) => {
    try {
      const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
      
      if (isNotificationEnabled) {
        await NotificationService.updateAcademyNotifications(academyId);
        console.log(`학원 ID ${academyId}의 알림이 업데이트되었습니다.`);
      }
    } catch (error) {
      console.error('학원 수정 후 알림 업데이트 오류:', error);
    }
  }, []);

  // 학원 삭제 후 알림 제거
  const handleAcademyDeleted = useCallback(async (academyId: number) => {
    try {
      await NotificationService.cancelAcademyNotifications(academyId);
      console.log(`학원 ID ${academyId}의 알림이 제거되었습니다.`);
    } catch (error) {
      console.error('학원 삭제 후 알림 제거 오류:', error);
    }
  }, []);

  // 학원 상태 변경 후 알림 업데이트
  const handleAcademyStatusChanged = useCallback(async (academyId: number, newStatus: '진행' | '중단') => {
    try {
      if (newStatus === '중단') {
        // 중단된 학원의 알림 제거
        await NotificationService.cancelAcademyNotifications(academyId);
        console.log(`중단된 학원 ID ${academyId}의 알림이 제거되었습니다.`);
      } else {
        // 재개된 학원의 알림 설정
        const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
        if (isNotificationEnabled) {
          await NotificationService.updateAcademyNotifications(academyId);
          console.log(`재개된 학원 ID ${academyId}의 알림이 설정되었습니다.`);
        }
      }
    } catch (error) {
      console.error('학원 상태 변경 후 알림 업데이트 오류:', error);
    }
  }, []);

  // 모든 알림 재설정 (스케줄 변경 시 등)
  const refreshAllNotifications = useCallback(async () => {
    try {
      const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
      
      if (isNotificationEnabled) {
        await NotificationService.scheduleAllPaymentNotifications();
        console.log('모든 알림이 재설정되었습니다.');
      }
    } catch (error) {
      console.error('전체 알림 재설정 오류:', error);
    }
  }, []);

  return {
    handleAcademyCreated,
    handleAcademyUpdated,
    handleAcademyDeleted,
    handleAcademyStatusChanged,
    refreshAllNotifications,
  };
};