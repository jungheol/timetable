import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  FlatList,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DatabaseService, { Academy, Schedule } from '../services/DatabaseService';
import { useAcademyNotifications } from '../hooks/useAcademyNotifications';
import { RootStackParamList } from '../../App';

interface AcademyItem extends Academy {
  academy_name?: string;
  academy_subject?: string;
}

type AcademyManagementScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AcademyManagementScreen'>;

interface Props {
  navigation: AcademyManagementScreenNavigationProp;
}

const AcademyManagementScreen: React.FC<Props> = ({ navigation }) => {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 🔔 알림 훅 추가
  const {
    handleAcademyUpdated,
    handleAcademyDeleted,
    handleAcademyStatusChanged,
    debugNotifications,
    sendTestNotification,
    toggleTestMode,
    isTestMode,
  } = useAcademyNotifications();

  // 화면 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    useCallback(() => {
      loadCurrentScheduleAndAcademies();
    }, [])
  );

  const loadCurrentScheduleAndAcademies = async () => {
    try {
      setIsLoading(true);
      
      // 1. 현재 활성 스케줄 조회
      const activeSchedule = await DatabaseService.getActiveSchedule();
      console.log('📚 Current active schedule:', activeSchedule);
      
      if (!activeSchedule) {
        Alert.alert('알림', '활성화된 스케줄이 없습니다.\n먼저 스케줄을 생성해주세요.');
        setAcademies([]);
        setCurrentSchedule(null);
        return;
      }
      
      setCurrentSchedule(activeSchedule);
      
      // 2. 해당 스케줄의 학원 목록 조회
      const academyList = await DatabaseService.getAcademiesBySchedule(activeSchedule.id!);
      console.log(`📚 Loaded academies for schedule ${activeSchedule.id}:`, academyList);
      setAcademies(academyList);
      
    } catch (error) {
      console.error('Error loading schedule and academies:', error);
      Alert.alert('오류', '학원 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCurrentScheduleAndAcademies();
    setRefreshing(false);
  }, []);

  const handleAddAcademy = () => {
    if (!currentSchedule) {
      Alert.alert('알림', '활성화된 스케줄이 없습니다.');
      return;
    }
    
    navigation.navigate('AcademyEditScreen', {
      academy: undefined,
      scheduleId: currentSchedule.id!, // ✅ 스케줄 ID 전달
      onSave: loadCurrentScheduleAndAcademies,
    });
  };

  const handleToggleStatus = async (academy: Academy) => {
    try {
      const newStatus: Academy['status'] = academy.status === '진행' ? '중단' : '진행';
      
      Alert.alert(
        '상태 변경',
        `${academy.name}을(를) ${newStatus} 상태로 변경하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '확인',
            onPress: async () => {
              try {
                const updatedAcademy: Academy = { 
                  ...academy, 
                  status: newStatus,
                  // 중단으로 변경하는 경우 현재 년/월을 종료 월로 설정
                  end_month: newStatus === '중단' && !academy.end_month 
                    ? new Date().toISOString().slice(0, 7) // YYYY-MM 형식
                    : academy.end_month
                };
                
                await DatabaseService.updateAcademy(updatedAcademy);
                
                // 🔔 학원 상태 변경 알림 처리
                try {
                  await handleAcademyStatusChanged(academy.id, newStatus);
                  console.log(`✅ Academy status changed and notifications updated: ${academy.name} → ${newStatus}`);
                } catch (notificationError) {
                  console.error('❌ Error updating notifications for status change:', notificationError);
                  // 알림 처리 실패해도 상태 변경은 성공한 것으로 처리
                }
                
                await loadCurrentScheduleAndAcademies(); // 목록 새로고침
              } catch (error) {
                console.error('Error updating academy status:', error);
                Alert.alert('오류', '상태 변경 중 오류가 발생했습니다.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleToggleStatus:', error);
    }
  };

  const handleDeleteAcademy = async (academy: Academy) => {
    Alert.alert(
      '학원 삭제',
      `${academy.name}을(를) 정말 삭제하시겠습니까?\n삭제된 학원은 복구할 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteAcademy(academy.id);
              
              // 🔔 학원 삭제 알림 처리
              try {
                await handleAcademyDeleted(academy.id);
                console.log(`✅ Academy deleted and notifications removed: ${academy.name}`);
              } catch (notificationError) {
                console.error('❌ Error removing notifications for deleted academy:', notificationError);
                // 알림 처리 실패해도 학원 삭제는 성공한 것으로 처리
              }
              
              await loadCurrentScheduleAndAcademies(); // 목록 새로고침
            } catch (error) {
              console.error('Error deleting academy:', error);
              Alert.alert('오류', '학원 삭제 중 오류가 발생했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleEditAcademy = (academy: Academy) => {
    if (!currentSchedule) {
      Alert.alert('알림', '활성화된 스케줄이 없습니다.');
      return;
    }
    
    navigation.navigate('AcademyEditScreen', {
      academy,
      scheduleId: currentSchedule.id!, // ✅ 스케줄 ID 전달
      onSave: loadCurrentScheduleAndAcademies,
    });
  };

  const handleManageAcademy = (academy: Academy) => {
    const actionButtons = [
      { text: '취소', style: 'cancel' as const },
      {
        text: '편집',
        onPress: () => handleEditAcademy(academy)
      },
      {
        text: academy.status === '진행' ? '중단' : '재개',
        onPress: () => handleToggleStatus(academy)
      },
      {
        text: '삭제',
        style: 'destructive' as const,
        onPress: () => handleDeleteAcademy(academy)
      }
    ];

    // 🔔 개발 모드에서는 알림 디버그 버튼 추가
    if (__DEV__) {
      actionButtons.splice(-1, 0, {
        text: '🔔 알림 확인',
        onPress: async () => {
          try {
            await debugNotifications();
            Alert.alert('디버그', '콘솔에서 알림 정보를 확인해주세요.');
          } catch (error) {
            console.error('Error in debug notifications:', error);
          }
        }
      });
    }

    Alert.alert(academy.name, '어떤 작업을 하시겠습니까?', actionButtons);
  };

  const getSubjectColor = (subject: Academy['subject']) => {
    const colors = {
      '국어': '#FF6B6B',
      '수학': '#4ECDC4',
      '영어': '#45B7D1',
      '예체능': '#96CEB4',
      '사회과학': '#FFEAA7',
      '기타': '#DDA0DD'
    };
    return colors[subject] || '#8E8E93';
  };

  const getStatusStyle = (status: Academy['status']) => {
    return status === '진행' 
      ? { backgroundColor: '#34C759', color: '#fff' }
      : { backgroundColor: '#8E8E93', color: '#fff' };
  };

  const formatMonthlyFee = (fee?: number) => {
    if (!fee) return '미설정';
    return `${fee.toLocaleString()}원`;
  };

  // 🔔 알림 상태 표시 함수
  const getNotificationIcon = (academy: Academy) => {
    if (academy.status !== '진행' || !academy.payment_day) {
      return null;
    }
    return (
      <View style={styles.notificationBadge}>
        <Ionicons name="notifications" size={12} color="#FF9500" />
      </View>
    );
  };

  const renderAcademyItem = ({ item }: { item: Academy }) => (
    <View style={styles.academyCard}>
      <View style={styles.academyHeader}>
        <View style={styles.academyTitleRow}>
          <View style={styles.academyTitleLeft}>
            <View style={[styles.subjectBadge, { backgroundColor: getSubjectColor(item.subject) }]}>
              <Text style={styles.subjectText}>{item.subject}</Text>
            </View>
            {/* 🔔 알림 상태 표시 */}
            {getNotificationIcon(item)}
          </View>
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={() => handleManageAcademy(item)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.academyName}>{item.name}</Text>
        
        <View style={styles.academyInfo}>
          <Text style={styles.feeText}>
            {item.monthly_fee ? `${formatMonthlyFee(item.monthly_fee)} / 1개월` : '수강료 미설정'}
          </Text>
          {item.payment_cycle && item.payment_cycle > 1 && (
            <Text style={styles.cycleText}>결제주기 : {item.payment_cycle}개월마다</Text>
          )}
          {/* 🔔 결제일 정보 표시 */}
          {item.payment_day && (
            <Text style={styles.paymentDayText}>
              매월 {item.payment_day}일 결제 
              {item.status === '진행' && (
                <Text style={styles.notificationActiveText}> (알림 설정됨)</Text>
              )}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.academyFooter}>
        <TouchableOpacity 
          style={[styles.statusButton, getStatusStyle(item.status)]}
          onPress={() => handleToggleStatus(item)}
        >
          <Text style={[styles.statusButtonText, { color: getStatusStyle(item.status).color }]}>
            {item.status}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="school-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>등록된 학원이 없습니다</Text>
      <Text style={styles.emptySubtitle}>+ 버튼을 눌러 학원을 추가해보세요</Text>
      {currentSchedule && (
        <Text style={styles.scheduleInfo}>현재 스케줄: {currentSchedule.name}</Text>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color="#007AFF" />
        <Text style={styles.infoText}>
          {currentSchedule 
            ? `"${currentSchedule.name}" 스케줄의 학원 정보를 관리합니다.`
            : '학원에 대한 추가 정보 (학원비, 재료 등)를 관리합니다.'
          }
        </Text>
      </View>

      {/* 🔔 알림 정보 박스 추가 */}
      <View style={styles.notificationInfoBox}>
        <Ionicons name="notifications-outline" size={16} color="#FF9500" />
        <Text style={styles.notificationInfoText}>
          학원의 결제일을 설정하면 자동으로 결제 알림을 받을 수 있습니다.
        </Text>
      </View>

      {/* 🔔 개발 모드에서만 표시되는 디버그 도구 */}
      {__DEV__ && (
        <View style={styles.debugToolsContainer}>
          <Text style={styles.debugToolsTitle}>🔧 개발자 도구</Text>
          
          {/* 🧪 테스트 모드 토글 */}
          <View style={styles.testModeContainer}>
            <Text style={styles.testModeLabel}>
              테스트 모드 ({isTestMode() ? '30분 간격' : '정상 모드'})
            </Text>
            <TouchableOpacity
              style={[styles.testModeButton, isTestMode() && styles.testModeButtonActive]}
              onPress={async () => {
                try {
                  const newMode = await toggleTestMode();
                  Alert.alert(
                    '테스트 모드',
                    newMode 
                      ? '30분 간격 테스트 알림이 활성화되었습니다.' 
                      : '정상 모드로 변경되었습니다.',
                    [{ text: '확인' }]
                  );
                } catch (error) {
                  console.error('Test mode toggle error:', error);
                }
              }}
            >
              <Text style={[styles.testModeButtonText, isTestMode() && styles.testModeButtonTextActive]}>
                {isTestMode() ? '🧪 ON' : '⏰ OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.debugButtonsRow}>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={async () => {
                try {
                  await debugNotifications();
                  Alert.alert('디버그', '콘솔에서 알림 정보를 확인해주세요.');
                } catch (error) {
                  console.error('Debug error:', error);
                }
              }}
            >
              <Text style={styles.debugButtonText}>🔍 알림 디버그</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.debugButton}
              onPress={async () => {
                try {
                  const success = await sendTestNotification();
                  if (success) {
                    Alert.alert('테스트', '2초 후 테스트 알림이 전송됩니다.');
                  }
                } catch (error) {
                  console.error('Test notification error:', error);
                }
              }}
            >
              <Text style={styles.debugButtonText}>📱 테스트 알림</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {academies.length > 0 && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>
            학원 ({academies.length})
            {currentSchedule && (
              <Text style={styles.scheduleNameInStats}> - {currentSchedule.name}</Text>
            )}
          </Text>
          {/* 🔔 알림 설정된 학원 수 표시 */}
          {(() => {
            const notificationEnabledCount = academies.filter(academy => 
              academy.status === '진행' && academy.payment_day
            ).length;
            
            if (notificationEnabledCount > 0) {
              return (
                <Text style={styles.notificationStatsText}>
                  🔔 알림 설정: {notificationEnabledCount}개 학원
                </Text>
              );
            }
            return null;
          })()}
        </View>
      )}
    </View>
  );

  // 활성 스케줄이 없는 경우
  if (!currentSchedule && !isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>학원관리</Text>
        </View>
        <View style={styles.noScheduleState}>
          <Ionicons name="calendar-outline" size={80} color="#ccc" />
          <Text style={styles.noScheduleTitle}>활성화된 스케줄이 없습니다</Text>
          <Text style={styles.noScheduleSubtitle}>먼저 시간표에서 스케줄을 생성해주세요</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>학원관리</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddAcademy}>
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {academies.length === 0 && !isLoading ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={academies}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAcademyItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 5,
  },
  listContainer: {
    paddingVertical: 10,
  },
  listHeader: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 16,
  },
  // 🔔 알림 정보 박스 스타일
  notificationInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  notificationInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#F57C00',
    lineHeight: 16,
  },
  // 🔔 개발자 도구 스타일
  debugToolsContainer: {
    backgroundColor: '#F3E5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  debugToolsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7B1FA2',
    marginBottom: 8,
  },
  // 🧪 테스트 모드 컨테이너
  testModeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  testModeLabel: {
    fontSize: 11,
    color: '#7B1FA2',
    fontWeight: '500',
  },
  testModeButton: {
    backgroundColor: '#E1BEE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1C4E9',
  },
  testModeButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  testModeButtonText: {
    color: '#7B1FA2',
    fontSize: 10,
    fontWeight: '600',
  },
  testModeButtonTextActive: {
    color: '#FFFFFF',
  },
  debugButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  debugButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  statsContainer: {
    marginBottom: 10,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scheduleNameInStats: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  // 🔔 알림 통계 스타일
  notificationStatsText: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
    fontWeight: '500',
  },
  academyCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  academyHeader: {
    marginBottom: 12,
  },
  academyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  // 🔔 학원 제목 왼쪽 영역 (배지 + 알림 아이콘)
  academyTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  // 🔔 알림 배지 스타일
  notificationBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  moreButton: {
    padding: 4,
  },
  academyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  academyInfo: {
    gap: 2,
  },
  feeText: {
    fontSize: 14,
    color: '#666',
  },
  cycleText: {
    fontSize: 12,
    color: '#999',
  },
  // 🔔 결제일 정보 스타일
  paymentDayText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  notificationActiveText: {
    color: '#34C759',
    fontSize: 11,
  },
  academyFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  scheduleInfo: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // 활성 스케줄이 없는 경우 스타일
  noScheduleState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  noScheduleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
  },
  noScheduleSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default AcademyManagementScreen;