import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './DatabaseService';

// 알림 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  token?: string;
}

class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string = '';
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // 알림 서비스 초기화
  async initialize(): Promise<boolean> {
    try {
      if (this.initialized) return true;

      if (!Device.isDevice) {
        console.log('알림은 실제 기기에서만 작동합니다.');
        return false;
      }

      // 알림 권한 요청
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('알림 권한이 거부되었습니다.');
        return false;
      }

      // 푸시 토큰 가져오기
      const tokenData = await Notifications.getExpoPushTokenAsync();
      this.expoPushToken = tokenData.data;
      
      console.log('Expo Push Token:', this.expoPushToken);

      // 설정 저장
      await AsyncStorage.setItem('expo_push_token', this.expoPushToken);

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('알림 서비스 초기화 오류:', error);
      return false;
    }
  }

  // 푸시 토큰 가져오기
  getExpoPushToken(): string {
    return this.expoPushToken;
  }

  // 결제일 알림 설정 저장
  async setPaymentNotificationEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('payment_notification_enabled', JSON.stringify(enabled));
      
      if (enabled) {
        await this.scheduleAllPaymentNotifications();
      } else {
        await this.cancelAllNotifications();
      }
    } catch (error) {
      console.error('결제일 알림 설정 저장 오류:', error);
      throw error;
    }
  }

  // 결제일 알림 설정 가져오기
  async getPaymentNotificationEnabled(): Promise<boolean> {
    try {
      const saved = await AsyncStorage.getItem('payment_notification_enabled');
      return saved ? JSON.parse(saved) : false;
    } catch (error) {
      console.error('결제일 알림 설정 로드 오류:', error);
      return false;
    }
  }

  // 모든 결제일 알림 스케줄링
  async scheduleAllPaymentNotifications(): Promise<void> {
    try {
      // 기존 알림 모두 취소
      await this.cancelAllNotifications();

      // 현재 활성 스케줄 가져오기
      const activeSchedule = await DatabaseService.getActiveSchedule();
      if (!activeSchedule) {
        console.log('활성 스케줄이 없습니다.');
        return;
      }

      // 해당 스케줄의 진행 중인 학원들 가져오기
      const academies = await DatabaseService.getAcademiesBySchedule(activeSchedule.id);
      const activeAcademies = academies.filter(academy => 
        academy.status === '진행' && academy.payment_day
      );

      console.log(`${activeAcademies.length}개 학원의 결제일 알림을 설정합니다.`);

      // 각 학원에 대해 알림 스케줄링
      for (const academy of activeAcademies) {
        await this.schedulePaymentNotification(academy);
      }

      console.log('모든 결제일 알림 스케줄링 완료');
    } catch (error) {
      console.error('결제일 알림 스케줄링 오류:', error);
      throw error;
    }
  }

  // 개별 학원 결제일 알림 스케줄링
  private async schedulePaymentNotification(academy: any): Promise<void> {
    try {
      const paymentDay = academy.payment_day;
      if (!paymentDay || paymentDay < 1 || paymentDay > 31) {
        console.log(`${academy.name}: 유효하지 않은 결제일 (${paymentDay})`);
        return;
      }

      const now = new Date();
      const notifications: any[] = [];

      // 향후 12개월간 알림 설정
      for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
        const targetYear = now.getFullYear() + Math.floor((now.getMonth() + monthOffset) / 12);
        const targetMonth = (now.getMonth() + monthOffset) % 12;
        
        // 해당 월의 마지막 날 확인 (윤년 등 고려)
        const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const actualPaymentDay = Math.min(paymentDay, lastDayOfMonth);
        
        // 결제일 1일 전 날짜 계산
        const notificationDate = new Date(targetYear, targetMonth, actualPaymentDay - 1);
        
        // 과거 날짜는 건너뛰기
        if (notificationDate <= now) {
          continue;
        }

        // 오전 8시로 설정
        notificationDate.setHours(8, 0, 0, 0);

        const notificationId = `payment_${academy.id}_${targetYear}_${targetMonth}`;
        
        // 타입 안전을 위해 명시적 캐스팅 사용
        const triggerInput = notificationDate as any;
        
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId,
          content: {
            title: '💳 학원비 결제 알림',
            body: `내일은 ${academy.name} 결제일입니다. (${actualPaymentDay}일)`,
            data: {
              type: 'payment_reminder',
              academyId: academy.id,
              academyName: academy.name,
              paymentDay: actualPaymentDay,
              targetDate: notificationDate.toISOString(),
            },
            sound: 'default',
          },
          trigger: triggerInput,
        });

        notifications.push({
          academyName: academy.name,
          date: notificationDate.toLocaleDateString(),
          notificationId,
        });
      }

      console.log(`${academy.name}: ${notifications.length}개 알림 예약 완료`);
      
      // 디버깅용: 예약된 알림 정보 출력
      notifications.forEach(notif => {
        console.log(`  - ${notif.date} 08:00 (${notif.notificationId})`);
      });

    } catch (error) {
      console.error(`${academy.name} 결제일 알림 스케줄링 오류:`, error);
    }
  }

  // 모든 알림 취소
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('모든 예약된 알림이 취소되었습니다.');
    } catch (error) {
      console.error('알림 취소 오류:', error);
      throw error;
    }
  }

  // 특정 학원의 알림만 취소
  async cancelAcademyNotifications(academyId: number): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      const academyNotifications = scheduledNotifications.filter(notification => 
        notification.identifier.startsWith(`payment_${academyId}_`)
      );

      for (const notification of academyNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      console.log(`학원 ID ${academyId}의 ${academyNotifications.length}개 알림이 취소되었습니다.`);
    } catch (error) {
      console.error('학원 알림 취소 오류:', error);
      throw error;
    }
  }

  // 예약된 알림 목록 가져오기 (디버깅용)
  async getScheduledNotifications(): Promise<any[]> {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications.map(notification => ({
        id: notification.identifier,
        title: notification.content.title,
        body: notification.content.body,
        trigger: notification.trigger,
        data: notification.content.data,
      }));
    } catch (error) {
      console.error('예약된 알림 조회 오류:', error);
      return [];
    }
  }

  // 즉시 테스트 알림 보내기 (개발/테스트용)
  async sendTestNotification(): Promise<void> {
    try {
      // 타입 안전을 위해 명시적 트리거 설정
      const trigger = { seconds: 2 } as any;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 테스트 알림',
          body: '결제일 알림이 정상적으로 작동합니다!',
          data: { type: 'test' },
          sound: 'default',
        },
        trigger: trigger,
      });
      console.log('테스트 알림이 2초 후 전송됩니다.');
    } catch (error) {
      console.error('테스트 알림 전송 오류:', error);
      throw error;
    }
  }

  // 학원 정보 변경 시 알림 업데이트
  async updateAcademyNotifications(academyId: number): Promise<void> {
    try {
      // 해당 학원의 기존 알림 취소
      await this.cancelAcademyNotifications(academyId);

      // 알림이 활성화되어 있는 경우 새로 스케줄링
      const isEnabled = await this.getPaymentNotificationEnabled();
      if (isEnabled) {
        const academy = await DatabaseService.getAcademyById(academyId);
        if (academy && academy.status === '진행' && academy.payment_day) {
          await this.schedulePaymentNotification(academy);
          console.log(`학원 ID ${academyId}의 알림이 업데이트되었습니다.`);
        }
      }
    } catch (error) {
      console.error('학원 알림 업데이트 오류:', error);
      throw error;
    }
  }

  // 디버깅용: 예약된 알림 상태 출력
  async debugNotifications(): Promise<void> {
    try {
      console.log('🔔 === 알림 디버그 정보 ===');
      
      const isEnabled = await this.getPaymentNotificationEnabled();
      console.log(`알림 활성화 상태: ${isEnabled}`);
      console.log(`푸시 토큰: ${this.expoPushToken}`);
      
      const scheduledNotifications = await this.getScheduledNotifications();
      console.log(`예약된 알림 개수: ${scheduledNotifications.length}`);
      
      scheduledNotifications.forEach((notification, index) => {
        console.log(`${index + 1}. ${notification.title}`);
        console.log(`   내용: ${notification.body}`);
        console.log(`   트리거: ${JSON.stringify(notification.trigger)}`);
        console.log(`   데이터: ${JSON.stringify(notification.data)}`);
        console.log('---');
      });
      
      // 현재 활성 학원들 확인
      const activeSchedule = await DatabaseService.getActiveSchedule();
      if (activeSchedule) {
        const academies = await DatabaseService.getAcademiesBySchedule(activeSchedule.id);
        const activeAcademies = academies.filter(academy => 
          academy.status === '진행' && academy.payment_day
        );
        
        console.log(`활성 학원 (결제일 설정): ${activeAcademies.length}개`);
        activeAcademies.forEach(academy => {
          console.log(`  - ${academy.name}: ${academy.payment_day}일`);
        });
      }
      
      console.log('🔔 === 알림 디버그 정보 끝 ===');
    } catch (error) {
      console.error('알림 디버그 오류:', error);
    }
  }

  // 권한 상태 확인
  async checkPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    status: string;
  }> {
    try {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      return {
        granted: status === 'granted',
        canAskAgain,
        status,
      };
    } catch (error) {
      console.error('권한 확인 오류:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'error',
      };
    }
  }

  // 권한 재요청
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('권한 요청 오류:', error);
      return false;
    }
  }
}

export default NotificationService.getInstance();