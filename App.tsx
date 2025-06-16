import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Event } from './src/services/DatabaseService';
import { Academy } from './src/services/DatabaseService';

// Screens
import InitialSetupScreen from './src/screens/InitialSetupScreen';
import TimeTableScreen from './src/screens/TimeTableScreen';
import AcademyManagementScreen from './src/screens/AcademyManagementScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EventScreen from './src/screens/EventScreen';
import AcademyEditScreen from './src/screens/AcademyEditScreen';

// Services
import DatabaseService from './src/services/DatabaseService';
import NotificationService from './src/services/NotificationService';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 안드로이드 알림 채널 설정
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('payment-reminders', {
    name: '결제일 알림',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#007AFF',
    sound: 'default',
    description: '학원비 결제일을 알려드립니다',
  });
}

// Types
export interface ScheduleSettings {
  timeUnit: '30min' | '1hour';
  startTime: string;
  endTime: string;
  showWeekend: boolean;
}

// Navigation Types
export type RootStackParamList = {
  InitialSetup: {
    onSetupComplete?: () => void;
  } | undefined;
  Main: undefined;
  EventScreen: {
    event?: Event | null;
    selectedDate: string;
    selectedTime: string;
    scheduleId: number;
    onSave: () => void;
  };
  AcademyManagementScreen: undefined;
  AcademyEditScreen: {
    academy?: Academy;
    scheduleId: number;
    onSave?: () => void;
  };
  // 새 스케줄 생성을 위한 InitialSetupScreen 네비게이션
  InitialSetupFromMain: {
    isFromModal?: boolean;
  } | undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<RootStackParamList>();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === '시간표') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === '학원관리') {
            iconName = focused ? 'school' : 'school-outline';
          } else if (route.name === '통계') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === '설정') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'image';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="시간표" component={TimeTableScreen} />
      <Tab.Screen name="학원관리" component={AcademyManagementScreen} />
      <Tab.Screen name="통계" component={StatisticsScreen} />
      <Tab.Screen name="설정" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default function App() {
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 알림 리스너 참조
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // 🔧 개발 모드 설정 (배포 시 false로 변경)
  const DEVELOPMENT_MODE = false;  // true: 항상 초기설정 화면 / false: 정상 동작

  useEffect(() => {
    // 앱 초기화
    initializeApp();
    
    // 알림 리스너 설정
    setupNotificationListeners();
    
    // 컴포넌트 언마운트 시 리스너 정리
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // 앱 초기화
  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing app...');
      
      // 알림 서비스 초기화
      const notificationInitialized = await NotificationService.initialize();
      if (notificationInitialized) {
        console.log('✅ Notification service initialized');
      } else {
        console.log('⚠️ Notification service initialization failed');
      }
      
      // 스케줄 존재 여부 확인
      await checkScheduleExists();
      
    } catch (error) {
      console.error('❌ App initialization error:', error);
      setIsFirstTime(true);
      setIsLoading(false);
    }
  };

  // 알림 리스너 설정
  const setupNotificationListeners = () => {
    // 앱이 foreground에 있을 때 알림 수신 리스너
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Foreground 알림 수신:', notification);
      
      const { type } = notification.request.content.data || {};
      
      if (type === 'payment_reminder') {
        console.log('💳 결제일 알림 수신:', notification.request.content.body);
        // 필요시 추가 처리 (예: 상태 업데이트, UI 알림 등)
      } else if (type === 'test') {
        console.log('🧪 테스트 알림 수신');
      }
    });

    // 사용자가 알림을 탭했을 때의 리스너
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 알림 응답 (탭됨):', response);
      
      const { type, academyId, academyName } = response.notification.request.content.data || {};
      
      if (type === 'payment_reminder') {
        console.log(`💳 ${academyName} 결제일 알림 탭됨 (Academy ID: ${academyId})`);
        
        // 결제일 알림을 탭한 경우의 처리
        // 예: 해당 학원 정보 화면으로 이동하거나 학원 관리 탭으로 이동
        // 실제 네비게이션 구조에 맞게 수정 필요
        
        // 예시: 학원 관리 탭으로 이동
        // navigation.navigate('학원관리');
        
        // 또는 특정 학원 상세 화면으로 이동
        // navigation.navigate('AcademyEditScreen', { 
        //   academy: { id: academyId }, 
        //   scheduleId: currentScheduleId 
        // });
        
      } else if (type === 'test') {
        console.log('🧪 테스트 알림 탭됨');
      }
    });
  };

  const checkScheduleExists = async () => {
    try {
      console.log('🔍 Checking if schedule exists...');
      setIsLoading(true);
      
      // 🔧 개발 모드일 때는 항상 초기 설정 화면 표시
      if (DEVELOPMENT_MODE) {
        console.log('🔧 Development mode: showing initial setup');
        // 약간의 지연을 주어 DB 초기화가 완료되도록 함
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsFirstTime(true);
        setIsLoading(false);
        return;
      }
      
      // 데이터베이스 초기화를 위해 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 활성 일정표가 있는지 확인
      const activeSchedule = await DatabaseService.getActiveSchedule();
      console.log('📊 Active schedule found:', activeSchedule);
      
      if (activeSchedule) {
        console.log('✅ Schedule exists, going to main screen');
        setIsFirstTime(false);
        
        // 기존 스케줄이 있는 경우 알림 상태 확인 및 동기화
        await syncNotificationsWithSchedule();
      } else {
        console.log('❌ No schedule found, showing initial setup');
        setIsFirstTime(true);
      }
    } catch (error) {
      console.error('❌ Error checking schedule exists:', error);
      setIsFirstTime(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 스케줄과 알림 동기화
  const syncNotificationsWithSchedule = async () => {
    try {
      const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
      
      if (isNotificationEnabled) {
        console.log('🔔 Syncing notifications with existing schedule...');
        
        // 기존 알림들을 새로운 스케줄 데이터와 동기화
        await NotificationService.scheduleAllPaymentNotifications();
        
        console.log('✅ Notifications synced successfully');
      } else {
        console.log('🔕 Notifications are disabled');
      }
    } catch (error) {
      console.error('❌ Error syncing notifications:', error);
    }
  };

  const handleSetupComplete = async () => {
    console.log('🎉 Setup completed, navigating to main...');
    
    // 개발 모드에서도 설정 완료 후에는 메인으로 이동
    setIsFirstTime(false);
    
    // 백그라운드에서 데이터 저장 확인 및 알림 설정
    setTimeout(async () => {
      try {
        const activeSchedule = await DatabaseService.getActiveSchedule();
        console.log('✅ Verification - Active schedule:', activeSchedule);
        
        // 새 스케줄 생성 후 알림 설정이 활성화되어 있다면 알림 스케줄링
        const isNotificationEnabled = await NotificationService.getPaymentNotificationEnabled();
        if (isNotificationEnabled && activeSchedule) {
          console.log('🔔 Setting up notifications for new schedule...');
          await NotificationService.scheduleAllPaymentNotifications();
        }
      } catch (error) {
        console.error('❌ Verification error:', error);
      }
    }, 500);
  };

  // 새 스케줄 생성 완료 처리
  const handleNewScheduleComplete = async () => {
    console.log('🎉 New schedule created successfully');
    
    // 새 스케줄 생성 후 알림 동기화
    try {
      await syncNotificationsWithSchedule();
    } catch (error) {
      console.error('❌ Error syncing notifications after new schedule creation:', error);
    }
    
    // 메인 화면은 이미 표시되어 있으므로 추가 처리 없음
    // TimeTableScreen에서 useFocusEffect를 통해 자동으로 새로고침됨
  };

  // 로딩 상태 표시
  if (isLoading || isFirstTime === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isFirstTime ? (
          // 최초 실행 시 초기 설정 화면
          <Stack.Screen name="InitialSetup">
            {(props) => (
              <InitialSetupScreen 
                onSetupComplete={handleSetupComplete}
                navigation={props.navigation}
                route={props.route}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            {/* 메인 앱 화면들 */}
            <Stack.Screen name="Main" component={TabNavigator} />
            
            {/* 일정 편집 화면 */}
            <Stack.Screen 
              name="EventScreen" 
              component={EventScreen} 
              options={{ 
                headerShown: false,
                presentation: 'modal',
                gestureEnabled: true,
              }} 
            />
            
            {/* 학원 관리 화면 */}
            <Stack.Screen 
              name="AcademyManagementScreen" 
              component={AcademyManagementScreen}
              options={{ headerShown: false }}
            />
            
            {/* 학원 편집 화면 */}
            <Stack.Screen 
              name="AcademyEditScreen" 
              component={AcademyEditScreen}
              options={{ headerShown: false }}
            />
            
            {/* 새 스케줄 생성 화면 (메인에서 접근) */}
            <Stack.Screen 
              name="InitialSetupFromMain"
              options={{ 
                headerShown: false,
                presentation: 'modal',
                gestureEnabled: true,
              }}
            >
              {(props) => (
                <InitialSetupScreen 
                  navigation={props.navigation}
                  route={props.route}
                  onSetupComplete={handleNewScheduleComplete}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});