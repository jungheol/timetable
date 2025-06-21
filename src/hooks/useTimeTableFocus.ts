import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import DatabaseService, { Schedule } from '../services/DatabaseService';

interface UseTimeTableFocusProps {
  schedule: Schedule | null;
  currentWeek: moment.Moment;
  setSchedule: (schedule: Schedule | null) => void;
  setCurrentWeek: (week: moment.Moment) => void;
  calculateFocusWeek: (schedule: Schedule) => moment.Moment;
  loadAllSchedules: () => Promise<void>;
  loadEvents: () => Promise<void>;
  loadHolidaysForCurrentPeriod: () => Promise<void>;
}

export const useTimeTableFocus = ({
  schedule,
  currentWeek,
  setSchedule,
  setCurrentWeek,
  calculateFocusWeek,
  loadAllSchedules,
  loadEvents,
  loadHolidaysForCurrentPeriod,
}: UseTimeTableFocusProps) => {
  
  // 🔧 중복 호출 방지를 위한 ref
  const isHandlingFocusRef = useRef(false);
  const lastScheduleIdRef = useRef<number | null>(schedule?.id || null);
  
  // 화면에 포커스될 때마다 실행
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        // 🔧 이미 처리 중이면 무시
        if (isHandlingFocusRef.current) {
          console.log('🔄 [Focus] Already handling focus, skipping...');
          return;
        }
        
        isHandlingFocusRef.current = true;
        
        try {
          console.log('🔍 [Focus] Screen focused - checking for schedule changes (immediate)...');
          
          // ✅ 즉시 스케줄 목록 새로고침
          await loadAllSchedules();
          
          // ✅ 즉시 활성 스케줄 확인 및 업데이트
          const currentActiveSchedule = await DatabaseService.getActiveSchedule();
          console.log('🔍 [Focus] Current active schedule from DB:', currentActiveSchedule?.name, 'ID:', currentActiveSchedule?.id);
          console.log('🔍 [Focus] Current schedule in state:', schedule?.name, 'ID:', schedule?.id);
          
          if (currentActiveSchedule) {
            const currentScheduleId = currentActiveSchedule.id;
            const stateScheduleId = schedule?.id;
            
            // 🔧 스케줄 ID 기반으로 변경 여부 확인
            if (stateScheduleId !== currentScheduleId) {
              console.log('🔄 [Focus] Schedule change detected (immediate update):', {
                from: stateScheduleId,
                to: currentScheduleId,
                scheduleName: currentActiveSchedule.name
              });
              
              // ✅ 즉시 스케줄과 주간 업데이트
              setSchedule(currentActiveSchedule);
              const focusWeek = calculateFocusWeek(currentActiveSchedule);
              setCurrentWeek(focusWeek);
              
              console.log('📅 [Focus] Focusing to week (immediate):', focusWeek.format('YYYY-MM-DD'));
              
              // ref 업데이트
              lastScheduleIdRef.current = currentScheduleId;
              
              // ✅ useTimeTableData의 useEffect에서 자동으로 로드하므로 여기서는 제거
              console.log('✅ [Focus] Schedule and week updated immediately, useEffect will handle data loading');
              
              return; // 새 스케줄로 전환했으므로 여기서 리턴
            } else {
              console.log('✅ [Focus] Same schedule, no change needed');
            }
          } else {
            console.log('⚠️ [Focus] No active schedule found in DB');
          }

          // ✅ 기존 스케줄이 있는 경우에만 공휴일 로드 (이벤트는 useEffect에서 처리)
          if (schedule && lastScheduleIdRef.current === schedule.id) {
            console.log('📊 [Focus] Loading holidays for existing schedule (immediate)');
            // ✅ 공휴일 로딩도 즉시 실행 (setTimeout 제거)
            loadHolidaysForCurrentPeriod();
          }
          
        } catch (error) {
          console.error('❌ [Focus] Error in focus handler:', error);
        } finally {
          // ✅ 처리 완료 플래그 즉시 해제 (딜레이 제거)
          isHandlingFocusRef.current = false;
        }
      };
      
      handleFocus();
    }, [
      // ✅ 의존성 배열 최적화 - 필수 값들만 포함
      schedule?.id,
      loadAllSchedules,
      loadHolidaysForCurrentPeriod
    ])
  );
};