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
}

class NotificationService {
  private static instance: NotificationService;
  private initialized: boolean = false;
  
  // 🧪 테스트 모드 설정 (배포 시 false로 변경)
  private TEST_MODE = true;  // true: 30분 간격 테스트 알림 / false: 정상 알림

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // 알림 서비스 초기화 (로컬 알림만 사용)
  async initialize(): Promise<boolean> {
    try {
      if (this.initialized) return true;

      console.log('🔔 Initializing local notification service...');

      // 알림 권한 요청
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('🔒 Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Notification permissions denied');
        return false;
      }

      console.log('✅ Local notification service initialized successfully');
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Local notification service initialization error:', error);
      return false;
    }
  }

  // 푸시 토큰 가져오기 (로컬 알림에서는 불필요)
  getExpoPushToken(): string {
    return 'local-notifications-only';
  }

  // 결제일 알림 설정 저장
  async setPaymentNotificationEnabled(enabled: boolean): Promise<void> {
    try {
      console.log('💾 [Notification] Saving setting:', enabled);
      await AsyncStorage.setItem('payment_notification_enabled', JSON.stringify(enabled));
      
      // ✅ 저장 후 검증
      const verification = await AsyncStorage.getItem('payment_notification_enabled');
      console.log('✅ [Notification] Setting saved and verified:', verification);
      
      if (enabled) {
        await this.scheduleAllPaymentNotifications();
      } else {
        await this.cancelAllNotifications();
      }
    } catch (error) {
      console.error('❌ [Notification] Error saving setting:', error);
      throw error;
    }
  }

  // 결제일 알림 설정 가져오기
  async getPaymentNotificationEnabled(): Promise<boolean | null> {
    try {
      const saved = await AsyncStorage.getItem('payment_notification_enabled');
      
      // ✅ 개선: null, undefined, 빈 문자열 모두 처리
      if (saved === null || saved === undefined || saved === '') {
        console.log('🔍 [Notification] No saved setting found, returning null');
        return null; // 설정이 없음을 명확히 표시
      }
      
      const parsed = JSON.parse(saved);
      console.log('🔍 [Notification] Loaded saved setting:', parsed);
      return Boolean(parsed); // 확실하게 boolean으로 변환
    } catch (error) {
      console.error('❌ [Notification] Error loading setting:', error);
      return null; // 오류 시에도 null 반환 (첫 설치로 간주)
    }
  }

  // 모든 결제일 알림 스케줄링
  async scheduleAllPaymentNotifications(): Promise<void> {
    try {
      // 기존 알림 모두 취소
      await this.cancelAllNotifications();

      console.log('📅 Scheduling local payment notifications...');

      // 현재 활성 스케줄 가져오기
      const activeSchedule = await DatabaseService.getActiveSchedule();
      if (!activeSchedule) {
        console.log('❌ No active schedule found');
        return;
      }

      // 해당 스케줄의 진행 중인 학원들 가져오기
      const academies = await DatabaseService.getAcademiesBySchedule(activeSchedule.id);
      const activeAcademies = academies.filter(academy => 
        academy.status === '진행' && academy.payment_day
      );

      if (activeAcademies.length === 0) {
        console.log('📋 No academies with payment dates found');
        return;
      }

      console.log(`🏫 Scheduling local notifications for ${activeAcademies.length} academies`);

      // 각 학원에 대해 알림 스케줄링
      let totalScheduled = 0;
      for (const academy of activeAcademies) {
        const scheduled = await this.schedulePaymentNotification(academy);
        totalScheduled += scheduled;
      }

      console.log(`✅ ${totalScheduled} local notifications scheduled successfully`);
    } catch (error) {
      console.error('❌ Error scheduling local payment notifications:', error);
      throw error;
    }
  }

  // 개별 학원 결제일 알림 스케줄링
  private async schedulePaymentNotification(academy: any): Promise<number> {
    try {
      const paymentDay = academy.payment_day;
      if (!paymentDay || paymentDay < 1 || paymentDay > 31) {
        console.log(`⚠️ ${academy.name}: Invalid payment day (${paymentDay})`);
        return 0;
      }

      console.log(`📝 Scheduling local notifications for ${academy.name} (payment day: ${paymentDay})`);

      if (this.TEST_MODE) {
        // 🧪 테스트 모드: 30분 간격으로 알림 생성
        return await this.scheduleTestNotifications(academy);
      } else {
        // 📅 정상 모드: 월별 결제일 알림
        return await this.scheduleNormalNotifications(academy, paymentDay);
      }

    } catch (error) {
      console.error(`❌ Error scheduling local notifications for ${academy.name}:`, error);
      return 0;
    }
  }

  // 🧪 테스트 모드: 30분 간격 알림
  private async scheduleTestNotifications(academy: any): Promise<number> {
    const now = new Date();
    let scheduledCount = 0;

    // 다음 분부터 시작해서 3시간 동안 30분마다 알림 (총 6개)
    for (let i = 1; i <= 6; i++) {
      const notificationTime = new Date(now.getTime() + (1 * 60 * 1000 * i)); // 5분 * i
      const notificationId = `test_payment_${academy.id}_${i}`;
      
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: '🧪 테스트 결제일 알림',
          body: `${academy.name} 결제일 테스트 알림 ${i}/6 (${academy.payment_day}일)`,
          data: {
            type: 'payment_reminder_test',
            academyId: academy.id,
            academyName: academy.name,
            paymentDay: academy.payment_day,
            testNumber: i,
            targetDate: notificationTime.toISOString(),
          },
          sound: 'default',
        },
        trigger: notificationTime as any,
      });

      scheduledCount++;
    }

    return scheduledCount;
  }

  // 📅 정상 모드: 월별 결제일 알림
  private async scheduleNormalNotifications(academy: any, paymentDay: number): Promise<number> {
    const now = new Date();
    let scheduledCount = 0;

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
      
      // 로컬 알림 스케줄링 (Date 객체 직접 사용)
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
        trigger: notificationDate as any,
      });

      scheduledCount++;
    }

    console.log(`✅ ${academy.name}: ${scheduledCount} normal notifications scheduled`);
    return scheduledCount;
  }

  // 모든 알림 취소
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ All scheduled local notifications cancelled');
    } catch (error) {
      console.error('❌ Error cancelling local notifications:', error);
      throw error;
    }
  }

  // 특정 학원의 알림만 취소
  async cancelAcademyNotifications(academyId: number): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      const academyNotifications = scheduledNotifications.filter(notification => {
        // 정상 알림과 테스트 알림 모두 포함
        return notification.identifier.startsWith(`payment_${academyId}_`) ||
               notification.identifier.startsWith(`test_payment_${academyId}_`);
      });

      for (const notification of academyNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      console.log(`✅ Cancelled ${academyNotifications.length} local notifications for academy ${academyId}`);
    } catch (error) {
      console.error('❌ Error cancelling academy local notifications:', error);
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
      console.error('❌ Error getting scheduled local notifications:', error);
      return [];
    }
  }

  // 즉시 테스트 알림 보내기 (개발/테스트용)
  async sendTestNotification(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 테스트 알림',
          body: '로컬 알림이 정상적으로 작동합니다!',
          data: { type: 'test' },
          sound: 'default',
        },
        trigger: { seconds: 2 } as any,
      });
      console.log('✅ Test local notification scheduled for 2 seconds');
    } catch (error) {
      console.error('❌ Error sending test local notification:', error);
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
          console.log(`✅ Local notifications updated for academy ${academyId}`);
        }
      }
    } catch (error) {
      console.error('❌ Error updating academy local notifications:', error);
      throw error;
    }
  }

  // 디버깅용: 예약된 알림 상태 출력
  async debugNotifications(): Promise<void> {
    try {
      console.log('🔔 === 로컬 알림 디버그 정보 ===');
      console.log(`📱 Device: ${Device.isDevice ? 'Real Device' : 'Simulator'}`);
      console.log('💾 Notification Type: Local Notifications Only');
      console.log(`🧪 Test Mode: ${this.TEST_MODE ? 'ENABLED (30min intervals)' : 'DISABLED (normal mode)'}`);
      
      const isEnabled = await this.getPaymentNotificationEnabled();
      console.log(`🔔 Notification Enabled: ${isEnabled}`);
      
      const scheduledNotifications = await this.getScheduledNotifications();
      console.log(`📋 Scheduled Local Notifications: ${scheduledNotifications.length}`);
      
      // 테스트 알림과 정상 알림 분리해서 표시
      const testNotifications = scheduledNotifications.filter(n => n.data?.type === 'payment_reminder_test');
      const normalNotifications = scheduledNotifications.filter(n => n.data?.type === 'payment_reminder');
      
      if (testNotifications.length > 0) {
        console.log(`🧪 Test Notifications: ${testNotifications.length}`);
        testNotifications.forEach((notification, index) => {
          console.log(`  ${index + 1}. ${notification.title}`);
          console.log(`     📝 Body: ${notification.body}`);
          console.log(`     ⏰ Trigger: ${JSON.stringify(notification.trigger)}`);
          console.log('---');
        });
      }
      
      if (normalNotifications.length > 0) {
        console.log(`📅 Normal Notifications: ${normalNotifications.length}`);
        normalNotifications.forEach((notification, index) => {
          console.log(`  ${index + 1}. ${notification.title}`);
          console.log(`     📝 Body: ${notification.body}`);
          console.log(`     ⏰ Trigger: ${JSON.stringify(notification.trigger)}`);
          console.log('---');
        });
      }
      
      // 현재 활성 학원들 확인
      const activeSchedule = await DatabaseService.getActiveSchedule();
      if (activeSchedule) {
        const academies = await DatabaseService.getAcademiesBySchedule(activeSchedule.id);
        const activeAcademies = academies.filter(academy => 
          academy.status === '진행' && academy.payment_day
        );
        
        console.log(`🏫 Active Academies with Payment Days: ${activeAcademies.length}`);
        activeAcademies.forEach(academy => {
          console.log(`  - ${academy.name}: ${academy.payment_day}일`);
        });
      }
      
      console.log('🔔 === 로컬 알림 디버그 정보 끝 ===');
    } catch (error) {
      console.error('❌ Error in local notification debug:', error);
    }
  }

  // 🧪 테스트 모드 토글 (개발용)
  toggleTestMode(): boolean {
    this.TEST_MODE = !this.TEST_MODE;
    console.log(`🧪 Test mode ${this.TEST_MODE ? 'ENABLED' : 'DISABLED'}`);
    return this.TEST_MODE;
  }

  // 🧪 테스트 모드 상태 확인
  isTestMode(): boolean {
    return this.TEST_MODE;
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
      console.error('❌ Error checking permissions:', error);
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
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }
}

export default NotificationService.getInstance();