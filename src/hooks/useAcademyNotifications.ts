import { useCallback } from 'react';
import NotificationService from '../services/NotificationService';
import DatabaseService from '../services/DatabaseService';

export const useAcademyNotifications = () => {
  
  // 학원 생성 후 알림 설정
  const handleAcademyCreated = useCallback(async (academyId: number) => {
    try {
      console.log(`🏫 새 학원 생성됨: Academy ID ${academyId}`);
      
      const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
      console.log(`🔔 알림 활성화 상태: ${isNotificationEnabled}`);
      
      if (isNotificationEnabled) {
        const academy = await DatabaseService.getAcademyById(academyId);
        
        if (academy && academy.status === '진행' && academy.payment_day) {
          console.log(`💳 결제일 설정된 학원: ${academy.name} (${academy.payment_day}일)`);
          await NotificationService.updateAcademyNotifications(academyId);
          console.log(`✅ 새 학원 ${academy.name}의 결제일 알림이 설정되었습니다.`);
        } else if (academy) {
          console.log(`💡 학원 ${academy.name}: 결제일이 설정되지 않아 알림을 설정하지 않습니다. (상태: ${academy.status}, 결제일: ${academy.payment_day})`);
        } else {
          console.log(`❌ 학원 ID ${academyId}를 찾을 수 없습니다.`);
        }
      } else {
        console.log('🔕 알림이 비활성화되어 있어 알림 설정을 건너뜁니다.');
      }
    } catch (error) {
      console.error('❌ 학원 생성 후 알림 설정 오류:', error);
    }
  }, []);

  // 학원 수정 후 알림 업데이트
  const handleAcademyUpdated = useCallback(async (academyId: number) => {
    try {
      console.log(`🔄 학원 수정됨: Academy ID ${academyId}`);
      
      const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
      
      if (isNotificationEnabled) {
        const academy = await DatabaseService.getAcademyById(academyId);
        
        if (academy) {
          console.log(`📝 업데이트된 학원 정보: ${academy.name} (상태: ${academy.status}, 결제일: ${academy.payment_day})`);
          
          // 학원 상태나 결제일에 따라 알림 처리
          if (academy.status === '진행' && academy.payment_day) {
            await NotificationService.updateAcademyNotifications(academyId);
            console.log(`✅ 학원 ${academy.name}의 알림이 업데이트되었습니다.`);
          } else {
            // 진행 상태가 아니거나 결제일이 없는 경우 알림 취소
            await NotificationService.cancelAcademyNotifications(academyId);
            console.log(`🛑 학원 ${academy.name}의 알림이 취소되었습니다. (상태: ${academy.status}, 결제일: ${academy.payment_day})`);
          }
        } else {
          console.log(`❌ 학원 ID ${academyId}를 찾을 수 없습니다.`);
        }
      } else {
        console.log('🔕 알림이 비활성화되어 있어 업데이트를 건너뜁니다.');
      }
    } catch (error) {
      console.error('❌ 학원 수정 후 알림 업데이트 오류:', error);
    }
  }, []);

  // 학원 삭제 후 알림 제거
  const handleAcademyDeleted = useCallback(async (academyId: number) => {
    try {
      console.log(`🗑️ 학원 삭제됨: Academy ID ${academyId}`);
      
      await NotificationService.cancelAcademyNotifications(academyId);
      console.log(`✅ 학원 ID ${academyId}의 모든 알림이 제거되었습니다.`);
    } catch (error) {
      console.error('❌ 학원 삭제 후 알림 제거 오류:', error);
    }
  }, []);

  // 학원 상태 변경 후 알림 업데이트
  const handleAcademyStatusChanged = useCallback(async (academyId: number, newStatus: '진행' | '중단') => {
    try {
      console.log(`🔄 학원 상태 변경: Academy ID ${academyId} → ${newStatus}`);
      
      if (newStatus === '중단') {
        // 중단된 학원의 알림 제거
        await NotificationService.cancelAcademyNotifications(academyId);
        console.log(`🛑 중단된 학원 ID ${academyId}의 모든 알림이 제거되었습니다.`);
      } else {
        // 재개된 학원의 알림 설정
        const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
        if (isNotificationEnabled) {
          const academy = await DatabaseService.getAcademyById(academyId);
          
          if (academy && academy.payment_day) {
            await NotificationService.updateAcademyNotifications(academyId);
            console.log(`▶️ 재개된 학원 ${academy.name}의 알림이 설정되었습니다.`);
          } else {
            console.log(`⚠️ 재개된 학원에 결제일이 설정되지 않아 알림을 설정하지 않습니다. (결제일: ${academy?.payment_day})`);
          }
        } else {
          console.log('🔕 알림이 비활성화되어 있어 재개 알림 설정을 건너뜁니다.');
        }
      }
    } catch (error) {
      console.error('❌ 학원 상태 변경 후 알림 업데이트 오류:', error);
    }
  }, []);

  // 모든 알림 재설정 (스케줄 변경 시 등)
  const refreshAllNotifications = useCallback(async () => {
    try {
      console.log('🔄 모든 알림 재설정 시작...');
      
      const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
      
      if (isNotificationEnabled) {
        console.log('📅 기존 알림 취소 및 새로운 알림 스케줄링 중...');
        
        // 현재 스케줄과 학원 정보 확인
        const activeSchedule = await DatabaseService.getActiveSchedule();
        if (activeSchedule) {
          const academies = await DatabaseService.getAcademiesBySchedule(activeSchedule.id);
          const activeAcademies = academies.filter(academy => 
            academy.status === '진행' && academy.payment_day
          );
          console.log(`🏫 알림 설정 대상 학원: ${activeAcademies.length}개`);
          
          await NotificationService.scheduleAllPaymentNotifications();
          console.log('✅ 모든 알림이 성공적으로 재설정되었습니다.');
        } else {
          console.log('❌ 활성 스케줄이 없어서 알림을 재설정할 수 없습니다.');
        }
      } else {
        console.log('🔕 알림이 비활성화되어 있어 재설정을 건너뜁니다.');
      }
    } catch (error) {
      console.error('❌ 전체 알림 재설정 오류:', error);
    }
  }, []);

  // 알림 디버깅 (개발용)
  const debugNotifications = useCallback(async () => {
    try {
      console.log('🔍 알림 디버깅 정보 조회 중...');
      await NotificationService.debugNotifications();
    } catch (error) {
      console.error('❌ 알림 디버깅 오류:', error);
    }
  }, []);

  // 테스트 알림 발송
  const sendTestNotification = useCallback(async () => {
    try {
      console.log('🧪 테스트 알림 발송 중...');
      await NotificationService.sendTestNotification();
      console.log('✅ 테스트 알림이 2초 후 발송됩니다.');
      return true;
    } catch (error) {
      console.error('❌ 테스트 알림 발송 오류:', error);
      return false;
    }
  }, []);

  // 예약된 알림 목록 조회
  const getScheduledNotifications = useCallback(async () => {
    try {
      const notifications = await NotificationService.getScheduledNotifications();
      console.log(`📋 현재 예약된 알림: ${notifications.length}개`);
      return notifications;
    } catch (error) {
      console.error('❌ 예약된 알림 조회 오류:', error);
      return [];
    }
  }, []);

  // 특정 학원의 알림 상태 확인
  const checkAcademyNotifications = useCallback(async (academyId: number) => {
    try {
      const notifications = await NotificationService.getScheduledNotifications();
      const academyNotifications = notifications.filter(notification => 
        notification.data?.academyId === academyId
      );
      
      console.log(`🔍 학원 ID ${academyId}의 예약된 알림: ${academyNotifications.length}개`);
      
      if (academyNotifications.length > 0) {
        console.log('📅 예약된 알림 목록:');
        academyNotifications.forEach((notification, index) => {
          console.log(`  ${index + 1}. ${notification.body}`);
        });
      }
      
      return academyNotifications;
    } catch (error) {
      console.error('❌ 학원 알림 상태 확인 오류:', error);
      return [];
    }
  }, []);

  // 🧪 테스트 모드 토글
  const toggleTestMode = useCallback(async () => {
    try {
      const newTestMode = NotificationService.toggleTestMode();
      
      // 테스트 모드 변경 후 모든 알림 재설정
      const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
      if (isNotificationEnabled) {
        console.log('🔄 Test mode changed, refreshing all notifications...');
        await NotificationService.scheduleAllPaymentNotifications();
      }
      
      return newTestMode;
    } catch (error) {
      console.error('❌ Error toggling test mode:', error);
      return false;
    }
  }, []);

  // 🧪 테스트 모드 상태 확인
  const isTestMode = useCallback(() => {
    return NotificationService.isTestMode();
  }, []);

  return {
    handleAcademyCreated,
    handleAcademyUpdated,
    handleAcademyDeleted,
    handleAcademyStatusChanged,
    refreshAllNotifications,
    debugNotifications,
    sendTestNotification,
    getScheduledNotifications,
    checkAcademyNotifications,
    toggleTestMode,
    isTestMode,
  };
};