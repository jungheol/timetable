import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Share,
  Platform,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import NotificationService from '../services/NotificationService';

interface SettingsTabProps {
  // 필요한 props가 있다면 여기에 추가
}

const SettingsScreen: React.FC<SettingsTabProps> = () => {
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [systemPermissionGranted, setSystemPermissionGranted] = useState(false);

  useEffect(() => {
    // 알림 서비스 초기화 및 설정 로드
    initializeSettings();

    // AppState 변경 감지 (앱이 백그라운드에서 포그라운드로 돌아올 때)
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('📱 App became active - checking permissions');
        checkAndSyncPermissions();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  // 화면이 포커스될 때마다 권한 상태 체크
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 Settings screen focused - checking permissions');
      checkAndSyncPermissions();
    }, [])
  );

  // 권한 상태 체크 및 동기화
  const checkAndSyncPermissions = async () => {
    try {
      console.log('🔍 [Settings] Checking system permissions...');
      
      const permissions = await NotificationService.checkPermissions();
      const savedEnabled = await NotificationService.getPaymentNotificationEnabled();
      
      console.log('🔍 [Settings] System permission granted:', permissions.granted);
      console.log('🔍 [Settings] Saved app setting:', savedEnabled);
      
      setSystemPermissionGranted(permissions.granted);

      // 시스템 권한과 앱 설정 동기화
      if (!permissions.granted) {
        // 시스템 권한이 없으면 앱 설정도 false로
        if (savedEnabled === true) {
          console.log('🔄 [Settings] System permission revoked - updating app setting');
          await NotificationService.setPaymentNotificationEnabled(false);
        }
        setNotificationEnabled(false);
      } else {
        // 시스템 권한이 있으면 저장된 설정 사용
        if (savedEnabled === null || savedEnabled === undefined) {
          // 처음 설치하거나 설정이 없는 경우 - 자동 활성화
          console.log('✅ [Settings] First time with permissions - auto-enabling');
          await NotificationService.setPaymentNotificationEnabled(true);
          setNotificationEnabled(true);
        } else {
          setNotificationEnabled(savedEnabled);
        }
      }
    } catch (error) {
      console.error('❌ [Settings] Error checking permissions:', error);
      setNotificationEnabled(false);
      setSystemPermissionGranted(false);
    }
  };

  // 설정 초기화
  const initializeSettings = async () => {
    try {
      setIsInitializing(true);
      
      // 알림 서비스 초기화
      await NotificationService.initialize();

      // 권한 상태 체크 및 동기화
      await checkAndSyncPermissions();
      
    } catch (error) {
      console.error('❌ [Settings] 설정 초기화 오류:', error);
      setNotificationEnabled(false);
      setSystemPermissionGranted(false);
    } finally {
      setIsInitializing(false);
    }
  };

  // 결제일 알림 토글
  const toggleNotification = async (value: boolean) => {
    try {
      console.log('🔄 [Settings] Toggling notification to:', value);
      
      if (value) {
        // 알림을 켜려고 할 때 - 시스템 권한 먼저 체크
        const permissions = await NotificationService.checkPermissions();
        console.log('🔍 [Settings] Current permissions:', permissions);
        
        if (!permissions.granted) {
          if (permissions.canAskAgain) {
            Alert.alert(
              '알림 권한 필요',
              '결제일 알림을 받으려면 알림 권한이 필요합니다.',
              [
                { text: '취소', style: 'cancel' },
                { 
                  text: '권한 허용', 
                  onPress: async () => {
                    const granted = await NotificationService.requestPermissions();
                    if (granted) {
                      await enableNotifications();
                    } else {
                      Alert.alert('알림 권한', '알림 권한이 거부되어 알림을 받을 수 없습니다.');
                    }
                  }
                },
              ]
            );
          } else {
            Alert.alert(
              '알림 권한 필요',
              '설정 > 알림에서 앱의 알림 권한을 허용해주세요.\n\n설정 완료 후 앱으로 돌아오면 자동으로 알림이 활성화됩니다.',
              [
                { text: '확인' },
                { 
                  text: '설정으로 이동', 
                  onPress: () => {
                    Linking.openSettings();
                    // 설정으로 이동했음을 알림
                    Alert.alert(
                      '안내',
                      '설정에서 알림을 허용한 후 앱으로 돌아오세요.\n앱으로 돌아오면 자동으로 알림 설정이 활성화됩니다.',
                      [{ text: '확인' }]
                    );
                  }
                }
              ]
            );
          }
          return;
        }
        
        await enableNotifications();
      } else {
        await disableNotifications();
      }
    } catch (error) {
      console.error('❌ [Settings] 알림 설정 오류:', error);
      Alert.alert('오류', '알림 설정 중 오류가 발생했습니다.');
      // 오류 시 현재 상태로 되돌리기
      await checkAndSyncPermissions();
    }
  };

  // 알림 활성화
  const enableNotifications = async () => {
    try {
      console.log('✅ [Settings] Enabling notifications');
      await NotificationService.setPaymentNotificationEnabled(true);
      setNotificationEnabled(true);
      setSystemPermissionGranted(true);
      
      Alert.alert(
        '알림 설정 완료',
        '결제일 알림이 활성화되었습니다.\n\n📅 학원 결제일 1일 전\n🕰️ 오전 8시\n\n💡 학원 관리에서 결제일을 설정하면 알림을 받으실 수 있습니다.',
        [
          { text: '확인' },
          { 
            text: '테스트 알림', 
            onPress: async () => {
              try {
                await NotificationService.sendTestNotification();
                Alert.alert('테스트 알림', '2초 후 테스트 알림이 전송됩니다.');
              } catch (error) {
                console.error('테스트 알림 오류:', error);
              }
            }
          }
        ]
      );
    } catch (error) {
      throw error;
    }
  };

  // 알림 비활성화
  const disableNotifications = async () => {
    try {
      console.log('🔇 [Settings] Disabling notifications');
      await NotificationService.setPaymentNotificationEnabled(false);
      setNotificationEnabled(false);
      Alert.alert('알림 설정', '결제일 알림이 비활성화되었습니다.');
    } catch (error) {
      throw error;
    }
  };

  // 앱 소개
  const handleAboutApp = () => {
    Alert.alert(
      '앱 소개',
      '📚 학생 스케줄러\n\n일정관리와 학원 관리를 한 번에!\n\n• 주간 시간표 관리\n• 학원별/과목별 통계\n• 결제일 알림 기능\n• 반복 일정 설정\n\n더 나은 학습 계획을 세워보세요!',
      [{ text: '확인', style: 'default' }]
    );
  };

  // 리뷰 남기기
  const handleReview = () => {
    const appStoreUrl = Platform.select({
      ios: 'https://apps.apple.com/app/your-app-id', // 실제 앱 ID로 교체
      android: 'https://play.google.com/store/apps/details?id=your.package.name', // 실제 패키지명으로 교체
    });
    
    Alert.alert(
      '리뷰 남기기',
      '앱이 도움이 되셨나요?\n앱스토어에서 리뷰를 남겨주시면 큰 힘이 됩니다! ⭐️',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '리뷰 작성',
          onPress: () => {
            if (appStoreUrl) {
              Linking.openURL(appStoreUrl);
            }
          },
        },
      ]
    );
  };

  // 개발자에게 문의하기
  const handleContact = () => {
    const email = 'developer@studentscheduler.com'; // 실제 이메일로 교체
    const subject = '[학생 스케줄러] 문의사항';
    const body = '문의사항을 적어주세요.\n\n앱 버전: 1.0.0\n기기: ' + Platform.OS;
    
    const emailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Alert.alert(
      '개발자에게 문의하기',
      '문의사항이나 건의사항이 있으시면 언제든 연락주세요! 📧',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '이메일 보내기',
          onPress: () => {
            Linking.openURL(emailUrl).catch(() => {
              Alert.alert('오류', '이메일 앱을 열 수 없습니다.');
            });
          },
        },
      ]
    );
  };

  // 친구에게 공유하기
  const handleShare = async () => {
    try {
      const message = Platform.select({
        ios: '📚 학생 스케줄러 - 일정관리와 학원 관리를 한 번에!\n\nhttps://apps.apple.com/app/your-app-id',
        android: '📚 학생 스케줄러 - 일정관리와 학원 관리를 한 번에!\n\nhttps://play.google.com/store/apps/details?id=your.package.name',
      });
      
      const result = await Share.share({
        message: message || '학생 스케줄러 앱을 추천합니다!',
        title: '학생 스케줄러',
      });
      
      if (result.action === Share.sharedAction) {
        console.log('공유 완료');
      }
    } catch (error) {
      console.error('공유 오류:', error);
      Alert.alert('오류', '공유 중 오류가 발생했습니다.');
    }
  };

  const SettingItem: React.FC<{
    icon: string;
    title: string;
    onPress?: () => void;
    showSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    disabled?: boolean;
  }> = ({ icon, title, onPress, showSwitch, switchValue, onSwitchChange, disabled }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={showSwitch || disabled}
      activeOpacity={showSwitch ? 1 : 0.7}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={24} color="#007AFF" style={styles.settingIcon} />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      
      {showSwitch ? (
        <View style={styles.switchContainer}>
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: '#E5E5EA', true: '#34C759' }}
            thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : switchValue ? '#FFFFFF' : '#F4F3F4'}
            disabled={disabled || isInitializing}
          />
          {/* 시스템 권한 상태 표시 */}
          {!systemPermissionGranted && !isInitializing && (
            <View style={styles.permissionIndicator}>
              <Ionicons name="warning" size={16} color="#FF9500" />
            </View>
          )}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 정보</Text>
        
        <View style={styles.settingGroup}>
          <SettingItem
            icon="information-circle-outline"
            title="앱 소개"
            onPress={handleAboutApp}
          />
          
          <View style={styles.separator} />
          
          <SettingItem
            icon="star-outline"
            title="리뷰 남기기"
            onPress={handleReview}
          />
          
          <View style={styles.separator} />
          
          <SettingItem
            icon="mail-outline"
            title="개발자에게 문의하기"
            onPress={handleContact}
          />
          
          <View style={styles.separator} />
          
          <SettingItem
            icon="share-outline"
            title="친구에게 공유하기"
            onPress={handleShare}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>알림 설정</Text>
        
        <View style={styles.settingGroup}>
          <SettingItem
            icon="notifications-outline"
            title="결제일 푸시 알림"
            showSwitch={true}
            switchValue={notificationEnabled}
            onSwitchChange={toggleNotification}
            disabled={isInitializing}
          />
        </View>
        
        {/* 초기화 중 표시 */}
        {isInitializing && (
          <View style={styles.notificationInfoContainer}>
            <Text style={styles.notificationInfo}>
              ⏳ 알림 설정을 확인하는 중...
            </Text>
          </View>
        )}
        
        {/* 시스템 권한이 없을 때 경고 메시지 */}
        {!isInitializing && !systemPermissionGranted && (
          <View style={styles.warningContainer}>
            <View style={styles.warningContent}>
              <Ionicons name="warning" size={20} color="#FF9500" />
              <Text style={styles.warningText}>
                시스템 알림 권한이 비활성화되어 있습니다.
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => {
                Alert.alert(
                  '알림 권한 설정',
                  '설정 > 알림에서 이 앱의 알림을 허용해주세요.\n\n설정 완료 후 앱으로 돌아오면 자동으로 동기화됩니다.',
                  [
                    { text: '취소' },
                    { text: '설정으로 이동', onPress: () => Linking.openSettings() }
                  ]
                );
              }}
            >
              <Text style={styles.settingsButtonText}>설정으로 이동</Text>
              <Ionicons name="open-outline" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
        )}
        
        {/* 알림 활성화 시 정보 */}
        {!isInitializing && notificationEnabled && systemPermissionGranted && (
          <View style={styles.notificationInfoContainer}>
            <Text style={styles.notificationInfo}>
              💡 학원 결제일 1일 전 오전 8시에 알림을 받습니다.
            </Text>
            <Text style={styles.notificationSubInfo}>
              📝 학원 관리에서 결제일을 설정해야 알림이 전송됩니다.
            </Text>
            
            {__DEV__ && (
              <View style={styles.debugContainer}>
                <TouchableOpacity
                  style={styles.debugButton}
                  onPress={async () => {
                    try {
                      await NotificationService.debugNotifications();
                      Alert.alert('디버그', '콘솔에서 알림 정보를 확인해주세요.');
                    } catch (error) {
                      console.error('디버그 오류:', error);
                    }
                  }}
                >
                  <Text style={styles.debugButtonText}>🔍 알림 디버그</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.debugButton}
                  onPress={async () => {
                    try {
                      await NotificationService.sendTestNotification();
                      Alert.alert('테스트', '2초 후 테스트 알림이 전송됩니다.');
                    } catch (error) {
                      console.error('테스트 알림 오류:', error);
                    }
                  }}
                >
                  <Text style={styles.debugButtonText}>📱 테스트 알림</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.debugButton}
                  onPress={async () => {
                    try {
                      const permissions = await NotificationService.checkPermissions();
                      const enabled = await NotificationService.getPaymentNotificationEnabled();
                      Alert.alert(
                        '현재 상태',
                        `시스템 권한: ${permissions.granted ? '허용됨' : '거부됨'}\n앱 설정: ${enabled ? '활성화' : '비활성화'}\n동기화: ${permissions.granted === enabled ? '일치' : '불일치'}`
                      );
                    } catch (error) {
                      console.error('상태 확인 오류:', error);
                    }
                  }}
                >
                  <Text style={styles.debugButtonText}>📊 상태 확인</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        
        {/* 알림 비활성화 시 안내 메시지 */}
        {!isInitializing && !notificationEnabled && systemPermissionGranted && (
          <View style={styles.notificationInfoContainer}>
            <Text style={styles.notificationDisabledInfo}>
              🔔 결제일 알림을 활성화하면 학원비 납부를 놓치지 않을 수 있습니다.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>학생 스케줄러 v1.0.0</Text>
        <Text style={styles.footerSubText}>더 나은 학습 계획을 위한 앱</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#000000',
  },
  section: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6D6D70',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginHorizontal: 20,
  },
  settingGroup: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 17,
    color: '#000000',
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginLeft: 52, // 아이콘 너비만큼 들여쓰기
  },
  // 스위치 컨테이너 추가
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionIndicator: {
    padding: 2,
  },
  // 경고 컨테이너 스타일 추가
  warningContainer: {
    backgroundColor: '#FFF8E1',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '500',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  settingsButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  notificationInfoContainer: {
    marginHorizontal: 20,
    marginTop: 8,
  },
  notificationInfo: {
    fontSize: 13,
    color: '#6D6D70',
    paddingHorizontal: 16,
  },
  notificationSubInfo: {
    fontSize: 12,
    color: '#FF9500',
    paddingHorizontal: 16,
    marginTop: 4,
    fontWeight: '500',
  },
  notificationDisabledInfo: {
    fontSize: 13,
    color: '#FF9500',
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  debugContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  debugButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginTop: 30,
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  footerSubText: {
    fontSize: 12,
    color: '#C7C7CC',
    marginTop: 4,
  },
});

export default SettingsScreen;