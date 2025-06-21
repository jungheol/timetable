import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import DatabaseService, { Schedule } from '../services/DatabaseService';

interface UseTimeTableFocusProps {
  schedule: Schedule | null;
  loadAllData: (schedule?: Schedule, week?: moment.Moment, showLoading?: boolean) => Promise<void>;
  calculateFocusWeek: (schedule: Schedule) => moment.Moment;
  loadAllSchedules: () => Promise<void>;
}

export const useTimeTableFocus = ({
  schedule,
  loadAllData,
  calculateFocusWeek,
  loadAllSchedules,
}: UseTimeTableFocusProps) => {
  
  // ✅ 중복 호출 방지를 위한 ref
  const isHandlingFocusRef = useRef(false);
  const lastScheduleIdRef = useRef<number | null>(schedule?.id || null);
  
  // ✅ 화면에 포커스될 때마다 실행 (간소화된 로직)
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        // 이미 처리 중이면 무시
        if (isHandlingFocusRef.current) {
          console.log('🔄 [Focus] Already handling focus, skipping...');
          return;
        }
        
        isHandlingFocusRef.current = true;
        
        try {
          console.log('🔍 [Focus] Screen focused - checking for schedule changes...');
          
          // ✅ 스케줄 목록 새로고침 (백그라운드)
          loadAllSchedules();
          
          // ✅ 활성 스케줄 확인
          const currentActiveSchedule = await DatabaseService.getActiveSchedule();
          
          if (currentActiveSchedule) {
            const currentScheduleId = currentActiveSchedule.id;
            const stateScheduleId = schedule?.id;
            
            // ✅ 스케줄 변경 감지
            if (stateScheduleId !== currentScheduleId) {
              console.log('🔄 [Focus] Schedule change detected:', {
                from: stateScheduleId,
                to: currentScheduleId,
                scheduleName: currentActiveSchedule.name
              });
              
              // ✅ 새 스케줄에 맞는 주간 계산
              const focusWeek = calculateFocusWeek(currentActiveSchedule);
              
              // ✅ 통합된 loadAllData로 한 번에 처리
              await loadAllData(currentActiveSchedule, focusWeek, false);
              
              // ref 업데이트
              lastScheduleIdRef.current = currentScheduleId;
              
              console.log('✅ [Focus] Schedule and data updated successfully');
              return;
            } else {
              console.log('✅ [Focus] Same schedule, no change needed');
            }
          } else {
            console.log('⚠️ [Focus] No active schedule found in DB');
          }

          // ✅ 기존 스케줄이 있는 경우 데이터만 새로고침 (로딩 표시 없이)
          if (schedule && lastScheduleIdRef.current === schedule.id) {
            console.log('📊 [Focus] Refreshing data for existing schedule');
            await loadAllData(undefined, undefined, false);
          }
          
        } catch (error) {
          console.error('❌ [Focus] Error in focus handler:', error);
        } finally {
          // ✅ 처리 완료 플래그 즉시 해제
          isHandlingFocusRef.current = false;
        }
      };
      
      // ✅ 비동기 함수 즉시 실행 (딜레이 제거)
      handleFocus();
    }, [
      // ✅ 의존성 배열 최소화
      schedule?.id,
      loadAllData,
      calculateFocusWeek,
      loadAllSchedules
    ])
  );
};