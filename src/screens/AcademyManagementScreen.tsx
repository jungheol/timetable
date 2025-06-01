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
import DatabaseService, { Academy } from '../services/DatabaseService';
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
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 화면 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    useCallback(() => {
      loadAcademies();
    }, [])
  );

  const loadAcademies = async () => {
    try {
      setIsLoading(true);
      const academyList = await DatabaseService.getAcademies();
      console.log('📚 Loaded academies:', academyList);
      setAcademies(academyList);
    } catch (error) {
      console.error('Error loading academies:', error);
      Alert.alert('오류', '학원 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAcademies();
    setRefreshing(false);
  }, []);

  const handleAddAcademy = () => {
    navigation.navigate('AcademyEditScreen', {
      academy: undefined,
      onSave: loadAcademies,
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
                await loadAcademies(); // 목록 새로고침
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
              await loadAcademies(); // 목록 새로고침
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
    navigation.navigate('AcademyEditScreen', {
      academy,
      onSave: loadAcademies,
    });
  };

  const handleManageAcademy = (academy: Academy) => {
    Alert.alert(
      academy.name,
      '어떤 작업을 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
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
          style: 'destructive',
          onPress: () => handleDeleteAcademy(academy)
        }
      ]
    );
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

  const renderAcademyItem = ({ item }: { item: Academy }) => (
    <View style={styles.academyCard}>
      <View style={styles.academyHeader}>
        <View style={styles.academyTitleRow}>
          <View style={[styles.subjectBadge, { backgroundColor: getSubjectColor(item.subject) }]}>
            <Text style={styles.subjectText}>{item.subject}</Text>
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
            <Text style={styles.cycleText}>결제주기 : {item.payment_cycle}개월마다 / 1일</Text>
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
    </View>
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color="#007AFF" />
        <Text style={styles.infoText}>학원에 대한 추가 정보 (학원비, 재료 등)를 관리합니다.</Text>
      </View>
      
      {academies.length > 0 && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>학원 ({academies.length})</Text>
        </View>
      )}
    </View>
  );

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
    marginBottom: 15,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 16,
  },
  statsContainer: {
    marginBottom: 10,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
});

export default AcademyManagementScreen;