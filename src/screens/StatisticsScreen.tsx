import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DatabaseService, { 
  AcademyExpenseStats, 
  MonthlyExpenseStats, 
  MonthlyStudyStats 
} from '../services/DatabaseService';

const { width } = Dimensions.get('window');

const StatisticsScreen: React.FC = () => {
  const [academyStats, setAcademyStats] = useState<AcademyExpenseStats[]>([]);
  const [monthlyExpenseStats, setMonthlyExpenseStats] = useState<MonthlyExpenseStats[]>([]);
  const [monthlyStudyStats, setMonthlyStudyStats] = useState<MonthlyStudyStats[]>([]);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 데이터 로드 함수
  const loadStatistics = async () => {
    try {
      setLoading(true);
      
      // 병렬로 모든 통계 데이터 로드
      const [academyData, expenseData, studyData] = await Promise.all([
        DatabaseService.getAcademyExpenseStats(),
        DatabaseService.getMonthlyExpenseStats(currentDate.year, currentDate.month),
        DatabaseService.getMonthlyStudyStats(currentDate.year, currentDate.month)
      ]);
      
      setAcademyStats(academyData);
      setMonthlyExpenseStats(expenseData);
      setMonthlyStudyStats(studyData);
      
      console.log('📊 Statistics loaded:', {
        academyStats: academyData.length,
        monthlyExpense: expenseData.length,
        monthlyStudy: studyData.length
      });
      
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  // 새로고침 함수
  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatistics();
    setRefreshing(false);
  };

  // 다음 달 정보 계산 헬퍼 함수
  const getNextMonth = () => {
    if (currentDate.month === 12) {
      return { year: currentDate.year + 1, month: 1 };
    } else {
      return { year: currentDate.year, month: currentDate.month + 1 };
    }
  };

  // 현재 날짜 기준으로 미래 여부 확인
  const isFutureMonth = (year: number, month: number): boolean => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (year > currentYear) return true;
    if (year === currentYear && month > currentMonth) return true;
    return false;
  };

  // 이전/다음 달 이동
  const changeMonth = async (direction: 'prev' | 'next') => {
    const newDate = { ...currentDate };
    
    if (direction === 'prev') {
      if (newDate.month === 1) {
        newDate.month = 12;
        newDate.year -= 1;
      } else {
        newDate.month -= 1;
      }
    } else {
      if (newDate.month === 12) {
        newDate.month = 1;
        newDate.year += 1;
      } else {
        newDate.month += 1;
      }
    }
    
    // 미래 달로 이동하려는 경우 차단
    if (direction === 'next' && isFutureMonth(newDate.year, newDate.month)) {
      console.log('📅 Cannot navigate to future month');
      return;
    }
    
    setCurrentDate(newDate);
  };

  // 월 변경 시 데이터 다시 로드
  useEffect(() => {
    loadStatistics();
  }, [currentDate]);

  // 화면 포커스 시 데이터 로드
  useFocusEffect(
    useCallback(() => {
      loadStatistics();
    }, [currentDate])
  );

  // 금액 포맷팅
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  // 시간 포맷팅
  const formatTime = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (wholeHours === 0 && minutes === 0) return '0분';
    if (minutes === 0) return `${wholeHours}시간`;
    if (wholeHours === 0) return `${minutes}분`;
    return `${wholeHours}시간 ${minutes}분`;
  };

  // 월 표시 문자열
  const getMonthString = (): string => {
    return `${currentDate.year}년 ${currentDate.month}월`;
  };

  // 로딩 중 표시
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>통계</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>통계를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>통계</Text>
      </View>
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 학원별 지출 금액 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>학원별 누적 지출</Text>
          <View style={styles.card}>
            {academyStats.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="school-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>등록된 학원이 없습니다</Text>
              </View>
            ) : (
              academyStats.map((academy, index) => (
                <View key={`${academy.academy_id}-${academy.subject}`} style={styles.statItem}>
                  <View style={styles.statInfo}>
                    <Text style={styles.statLabel}>{academy.academy_name}</Text>
                    <Text style={styles.statSubLabel}>{academy.subject}</Text>
                    <Text style={styles.statDescription}>
                      월 {formatCurrency(academy.monthly_fee || 0)} × {academy.months_count}개월
                    </Text>
                  </View>
                  <Text style={styles.statValue}>{formatCurrency(academy.total_expense)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* 월별 지출 통계 */}
        <View style={styles.section}>
          <View style={styles.monthHeader}>
            <TouchableOpacity 
              style={styles.monthButton} 
              onPress={() => changeMonth('prev')}
            >
              <Ionicons name="chevron-back" size={20} color="#007AFF" />
            </TouchableOpacity>
            
            <Text style={styles.monthTitle}>{getMonthString()} 지출</Text>
            
            <TouchableOpacity 
              style={[
                styles.monthButton, 
                isFutureMonth(getNextMonth().year, getNextMonth().month) && styles.disabledButton
              ]} 
              onPress={() => changeMonth('next')}
              disabled={isFutureMonth(getNextMonth().year, getNextMonth().month)}
            >
              <Ionicons 
                name="chevron-forward" 
                size={20} 
                color={isFutureMonth(getNextMonth().year, getNextMonth().month) ? "#ccc" : "#007AFF"} 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.card}>
            {monthlyExpenseStats.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>이번 달 지출 내역이 없습니다</Text>
              </View>
            ) : (
              <>
                {/* 총 지출 금액 */}
                <View style={[styles.statItem, styles.totalItem]}>
                  <Text style={styles.totalLabel}>총 지출</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(
                      monthlyExpenseStats.reduce((sum, stat) => sum + stat.total_expense, 0)
                    )}
                  </Text>
                </View>
                
                {/* 과목별 지출 */}
                {monthlyExpenseStats.map((stat, index) => (
                  <View key={stat.subject} style={styles.statItem}>
                    <View style={styles.statInfo}>
                      <Text style={styles.statLabel}>{stat.subject}</Text>
                      <Text style={styles.statDescription}>
                        {stat.academy_count}개 학원
                      </Text>
                    </View>
                    <Text style={styles.statValue}>{formatCurrency(stat.total_expense)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {/* 월별 학습 통계 */}
        <View style={styles.section}>
          <View style={styles.monthHeader}>
            <TouchableOpacity 
              style={styles.monthButton} 
              onPress={() => changeMonth('prev')}
            >
              <Ionicons name="chevron-back" size={20} color="#007AFF" />
            </TouchableOpacity>
            
            <Text style={styles.monthTitle}>{getMonthString()} 학습시간</Text>
            
            <TouchableOpacity 
              style={[
                styles.monthButton, 
                isFutureMonth(getNextMonth().year, getNextMonth().month) && styles.disabledButton
              ]} 
              onPress={() => changeMonth('next')}
              disabled={isFutureMonth(getNextMonth().year, getNextMonth().month)}
            >
              <Ionicons 
                name="chevron-forward" 
                size={20} 
                color={isFutureMonth(getNextMonth().year, getNextMonth().month) ? "#ccc" : "#007AFF"} 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.card}>
            {monthlyStudyStats.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>이번 달 학습 기록이 없습니다</Text>
              </View>
            ) : (
              <>
                {/* 총 학습 시간 */}
                <View style={[styles.statItem, styles.totalItem]}>
                  <Text style={styles.totalLabel}>총 학습시간</Text>
                  <Text style={styles.totalValue}>
                    {formatTime(
                      monthlyStudyStats.reduce((sum, stat) => sum + stat.total_hours, 0)
                    )}
                  </Text>
                </View>
                
                {/* 과목별 학습 시간 */}
                {monthlyStudyStats.map((stat, index) => (
                  <View key={stat.subject} style={styles.statItem}>
                    <View style={styles.statInfo}>
                      <Text style={styles.statLabel}>{stat.subject}</Text>
                    </View>
                    <Text style={styles.statValue}>{formatTime(stat.total_hours)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {/* 하단 여백 */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    justifyContent: 'center',
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
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  monthButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  totalItem: {
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  statSubLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  statDescription: {
    fontSize: 12,
    color: '#999',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'right',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  bottomSpacing: {
    height: 40,
  },
});

export default StatisticsScreen;