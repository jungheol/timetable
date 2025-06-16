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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NotificationService from '../services/NotificationService';

interface SettingsTabProps {
  // 필요한 props가 있다면 여기에 추가
}

const SettingsScreen: React.FC<SettingsTabProps> = () => {
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  useEffect(() => {
    // 알림 서비스 초기화 및 설정 로드
    initializeSettings();
  }, []);

  // 설정 초기화
  const initializeSettings = async () => {
    try {
      // 알림 서비스 초기화
      await NotificationService.initialize();

      // 저장된 알림 설정 로드
      const enabled = await NotificationService.getPaymentNotificationEnabled();
      setNotificationEnabled(enabled);
    } catch (error) {
      console.error('설정 초기화 오류:', error);
    }
  };

  // 결제일 알림 토글
  const toggleNotification = async (value: boolean) => {
    try {
      setNotificationEnabled(value);
      
      if (value) {
        // 권한 확인
        const permissions = await NotificationService.checkPermissions();
        
        if (!permissions.granted) {
          if (permissions.canAskAgain) {
            Alert.alert(
              '알림 권한 필요',
              '결제일 알림을 받으려면 알림 권한이 필요합니다.',
              [
                { text: '취소', style: 'cancel', onPress: () => setNotificationEnabled(false) },
                { 
                  text: '권한 허용', 
                  onPress: async () => {
                    const granted = await NotificationService.requestPermissions();
                    if (granted) {
                      await enableNotifications();
                    } else {
                      setNotificationEnabled(false);
                      Alert.alert('알림 권한', '알림 권한이 거부되어 알림을 받을 수 없습니다.');
                    }
                  }
                },
              ]
            );
          } else {
            setNotificationEnabled(false);
            Alert.alert(
              '알림 권한 필요',
              '설정 > 알림에서 앱의 알림 권한을 허용해주세요.',
              [
                { text: '확인' },
                { text: '설정으로 이동', onPress: () => Linking.openSettings() }
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
      console.error('알림 설정 오류:', error);
      setNotificationEnabled(false);
      Alert.alert('오류', '알림 설정 중 오류가 발생했습니다.');
    }
  };

  // 알림 활성화
  const enableNotifications = async () => {
    try {
      await NotificationService.setPaymentNotificationEnabled(true);
      Alert.alert(
        '알림 설정 완료',
        '결제일 알림이 활성화되었습니다.\n\n📅 학원 결제일 1일 전\n🕰️ 오전 8시\n\n알림을 받으실 수 있습니다.',
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
      await NotificationService.setPaymentNotificationEnabled(false);
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
  }> = ({ icon, title, onPress, showSwitch, switchValue, onSwitchChange }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={showSwitch}
      activeOpacity={showSwitch ? 1 : 0.7}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={24} color="#007AFF" style={styles.settingIcon} />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      
      {showSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#E5E5EA', true: '#34C759' }}
          thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : switchValue ? '#FFFFFF' : '#F4F3F4'}
        />
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
          />
        </View>
        
        {notificationEnabled && (
          <View style={styles.notificationInfoContainer}>
            <Text style={styles.notificationInfo}>
              💡 학원 결제일 1일 전 오전 8시에 알림을 받습니다.
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
              </View>
            )}
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
  notificationInfoContainer: {
    marginHorizontal: 20,
    marginTop: 8,
  },
  notificationInfo: {
    fontSize: 13,
    color: '#6D6D70',
    paddingHorizontal: 16,
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