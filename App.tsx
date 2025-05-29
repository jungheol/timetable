import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Event } from './src/services/DatabaseService';

// Screens
import InitialSetupScreen from './src/screens/InitialSetupScreen';
import TimeTableScreen from './src/screens/TimeTableScreen';
import AcademyManagementScreen from './src/screens/AcademyManagementScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EventScreen from './src/screens/EventScreen';

// Database Service
import DatabaseService from './src/services/DatabaseService';

// Types
export interface ScheduleSettings {
  timeUnit: '30min' | '1hour';
  startTime: string;
  endTime: string;
  showWeekend: boolean;
}

// Navigation Types
export type RootStackParamList = {
  InitialSetup: undefined;
  Main: undefined;
  EventScreen: {
    event?: Event | null;
    selectedDate: string;
    selectedTime: string;
    scheduleId: number;
    onSave: () => void;
  };
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

  // 🔧 개발 모드 설정 (배포 시 false로 변경)
  const DEVELOPMENT_MODE = true;  // true: 항상 초기설정 화면 / false: 정상 동작

  useEffect(() => {
    checkScheduleExists();
  }, []);

  const checkScheduleExists = async () => {
    try {
      console.log('Checking if schedule exists...');
      setIsLoading(true);
      
      // 🔧 개발 모드일 때는 항상 초기 설정 화면 표시
      if (DEVELOPMENT_MODE) {
        console.log('🔧 Development mode: showing initial setup');
        setIsFirstTime(true);
        setIsLoading(false);
        return;
      }
      
      // 데이터베이스 초기화를 위해 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 활성 일정표가 있는지 확인
      const activeSchedule = await DatabaseService.getActiveSchedule();
      console.log('Active schedule found:', activeSchedule);
      
      if (activeSchedule) {
        console.log('Schedule exists, going to main screen');
        setIsFirstTime(false);
      } else {
        console.log('No schedule found, showing initial setup');
        setIsFirstTime(true);
      }
    } catch (error) {
      console.error('Error checking schedule exists:', error);
      setIsFirstTime(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupComplete = async () => {
    console.log('🎉 Setup completed, navigating to main...');
    
    // 개발 모드에서도 설정 완료 후에는 메인으로 이동
    setIsFirstTime(false);
    
    // 백그라운드에서 데이터 저장 확인
    setTimeout(async () => {
      try {
        const activeSchedule = await DatabaseService.getActiveSchedule();
        console.log('✅ Verification - Active schedule:', activeSchedule);
      } catch (error) {
        console.error('❌ Verification error:', error);
      }
    }, 500);
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
          <Stack.Screen name="InitialSetup">
            {(props) => (
              <InitialSetupScreen {...props} onSetupComplete={handleSetupComplete} />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen 
              name="EventScreen" 
              component={EventScreen} 
              options={{ 
                headerShown: false,
                presentation: 'modal',
                gestureEnabled: true,
              }} 
            />
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