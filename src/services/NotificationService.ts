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
  private TEST_MODE = true;  // true: 1분 간격 테스트 알림 / false: 정상 알림

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // 알림 서비스 초기화 (기존 방식 - 첫 실행 시 권한 요청)
  async initialize(): Promise<boolean> {
    try {
      if (this.initialized) return true;

      console.log('🔔 Initializing local notification service...');

      // 알림 권한 요청 (기존 방식 유지)
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('🔒 Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Notification permissions denied');
        // 권한이 거부되어도 서비스는 초기화 완료로 처리
      } else {
        console.log('✅ Notification permissions granted');
        
        // 권한이 허용된 경우, 기존 설정이 없다면 자동으로 활성화
        const savedSetting = await this.getPaymentNotificationEnabled();
        if (savedSetting === null) {
          console.log('🔄 First time permission granted - enabling notifications');
          await this.setPaymentNotificationEnabled(true);
        }
      }

      console.log('✅ Local notification service initialized successfully');
      this.initialized = true;
      return finalStatus === 'granted';
    } catch (error) {
      console.error('❌ Local notification service initialization error:', error);
      this.initialized = true;
      return false;
    }
  }

  // 🔄 앱이 포그라운드로 돌아올 때 권한 상태 체크 및 동기화
  async checkAndSyncOnAppResume(): Promise<{ 
    systemGranted: boolean; 
    appEnabled: boolean; 
    changed: boolean;
  }> {
    try {
      const permissions = await this.checkPermissions();
      const currentAppSetting = await this.getPaymentNotificationEnabled();
      
      const systemGranted = permissions.granted;
      const appEnabled = currentAppSetting === true;
      
      console.log('🔍 [Notification] App resume sync check:', {
        systemGranted,
        appEnabled,
        needsSync: systemGranted !== appEnabled
      });
      
      let changed = false;
      
      // 시스템 권한과 앱 설정이 다른 경우 동기화
      if (systemGranted !== appEnabled) {
        console.log('🔄 [Notification] Syncing app setting with system permission');
        await AsyncStorage.setItem('payment_notification_enabled', JSON.stringify(systemGranted));
        
        if (systemGranted) {
          // 권한이 허용된 경우 알림 스케줄링
          await this.scheduleAllPaymentNotifications();
        } else {
          // 권한이 거부된 경우 모든 알림 취소
          await this.cancelAllNotifications();
        }
        
        changed = true;
      }
      
      return { 
        systemGranted, 
        appEnabled: systemGranted, // 동기화 후의 상태
        changed 
      };
    } catch (error) {
      console.error('❌ [Notification] Error in app resume sync:', error);
      return { systemGranted: false, appEnabled: false, changed: false };
    }
  }

  // 결제일 알림 설정 저장 - 권한 체크 추가
  async setPaymentNotificationEnabled(enabled: boolean): Promise<void> {
    try {
      console.log('💾 [Notification] Saving setting:', enabled);
      
      if (enabled) {
        // 알림을 켜려고 할 때 권한 재확인
        const permissions = await this.checkPermissions();
        if (!permissions.granted) {
          console.log('❌ [Notification] Cannot enable - no system permission');
          throw new Error('System notification permission is required');
        }
      }
      
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
      
      if (saved === null || saved === undefined || saved === '') {
        console.log('🔍 [Notification] No saved setting found, returning null');
        return null;
      }
      
      const parsed = JSON.parse(saved);
      console.log('🔍 [Notification] Loaded saved setting:', parsed);
      return Boolean(parsed);
    } catch (error) {
      console.error('❌ [Notification] Error loading setting:', error);
      return null;
    }
  }

  // 모든 결제일 알림 스케줄링
  async scheduleAllPaymentNotifications(): Promise<void> {
    try {
      // 권한 재확인
      const permissions = await this.checkPermissions();
      if (!permissions.granted) {
        console.log('❌ [Notification] Cannot schedule - no system permission');
        return;
      }

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
        // 🧪 테스트 모드: 1분 간격 알림
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

  // 🧪 테스트 모드: 1분 간격 알림
  private async scheduleTestNotifications(academy: any): Promise<number> {
    const now = new Date();
    let scheduledCount = 0;

    // 1분, 2분, 3분 후에 총 3개의 테스트 알림
    for (let i = 1; i <= 3; i++) {
      const notificationTime = new Date(now.getTime() + (i * 60 * 1000)); // i분 후
      const notificationId = `test_payment_${academy.id}_${i}`;
      
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: '🧪 테스트 결제일 알림',
          body: `${academy.name} 결제일 테스트 알림 ${i}/3 (${academy.payment_day}일)`,
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

    console.log(`🧪 ${academy.name}: ${scheduledCount} test notifications scheduled`);
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
      const permissions = await this.checkPermissions();
      if (!permissions.granted) {
        throw new Error('Notification permission is required for test notification');
      }

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
      await this.cancelAcademyNotifications(academyId);

      const isEnabled = await this.getPaymentNotificationEnabled();
      const permissions = await this.checkPermissions();
      
      if (isEnabled && permissions.granted) {
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
      console.log(`🧪 Test Mode: ${this.TEST_MODE ? 'ENABLED (1min intervals)' : 'DISABLED (normal mode)'}`);
      
      const permissions = await this.checkPermissions();
      const isEnabled = await this.getPaymentNotificationEnabled();
      
      console.log(`🔔 System Permission: ${permissions.granted ? 'GRANTED' : 'DENIED'}`);
      console.log(`🔔 App Setting: ${isEnabled === null ? 'NOT_SET' : (isEnabled ? 'ENABLED' : 'DISABLED')}`);
      console.log(`🔄 Synced: ${permissions.granted === (isEnabled === true) ? 'YES' : 'NO'}`);
      
      const scheduledNotifications = await this.getScheduledNotifications();
      console.log(`📋 Scheduled Local Notifications: ${scheduledNotifications.length}`);
      
      const testNotifications = scheduledNotifications.filter(n => n.data?.type === 'payment_reminder_test');
      const normalNotifications = scheduledNotifications.filter(n => n.data?.type === 'payment_reminder');
      
      if (testNotifications.length > 0) {
        console.log(`🧪 Test Notifications: ${testNotifications.length}`);
      }
      
      if (normalNotifications.length > 0) {
        console.log(`📅 Normal Notifications: ${normalNotifications.length}`);
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
      const result = await Notifications.getPermissionsAsync();
      const granted = result.status === 'granted';
      
      return {
        granted,
        canAskAgain: result.canAskAgain ?? false,
        status: result.status,
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
      console.log('🔒 [Notification] Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === 'granted';
      
      console.log('🔍 [Notification] Permission request result:', { status, granted });
      return granted;
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }
}

export default NotificationService.getInstance();