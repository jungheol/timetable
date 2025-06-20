import { useCallback } from 'react';
import { Alert } from 'react-native';
import moment from 'moment';
import DatabaseService, { Event } from '../services/DatabaseService';
import { EventUIState } from '../types/eventTypes';
import { sanitizeEventData } from '../utils/eventUtils';
import { useAcademyNotifications } from './useAcademyNotifications';

interface UseEventDeleteLogicProps {
  event?: Event | null;
  scheduleId: number;
  setUIState: React.Dispatch<React.SetStateAction<EventUIState>>;
  finishSave: () => void;
}

export const useEventDeleteLogic = ({
  event,
  scheduleId,
  setUIState,
  finishSave,
}: UseEventDeleteLogicProps) => {

  const { handleAcademyDeleted } = useAcademyNotifications();

  // ✅ 단일 이벤트 삭제
  const deleteSingleEvent = useCallback(async () => {
    if (!event?.id) return;
    
    console.log('🔄 Deleting single event:', event.id);
    
    setUIState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // 학원 일정 삭제 시 알림 처리
      if (event.category === '학원' && event.academy_id) {
        try {
          const relatedEvents = await DatabaseService.getEvents(
            scheduleId, 
            moment().subtract(1, 'year').format('YYYY-MM-DD'),
            moment().add(1, 'year').format('YYYY-MM-DD')
          );
          
          const academyEvents = relatedEvents.filter(e => 
            e.academy_id === event.academy_id && e.id !== event.id
          );
          
          if (academyEvents.length === 0) {
            await handleAcademyDeleted(event.academy_id);
          }
        } catch (notificationError) {
          console.error('❌ Error handling academy notifications:', notificationError);
        }
      }

      await DatabaseService.deleteEvent(event.id);
      console.log('✅ Single event deleted successfully');
      
      finishSave();
      
    } catch (error) {
      console.error('❌ Error deleting event:', error);
      Alert.alert('오류', '일정을 삭제하는 중 오류가 발생했습니다.');
    } finally {
      setUIState(prev => ({ ...prev, isLoading: false }));
    }
  }, [event, scheduleId, handleAcademyDeleted, finishSave, setUIState]);

  // ✅ 삭제 처리 메인 함수
  const handleDelete = useCallback(async () => {
    if (!event?.id) return;

    console.log('🔄 handleDelete called');

    const sanitizedEvent = sanitizeEventData(event);

    if (sanitizedEvent.is_recurring) {
      console.log('🔄 Opening recurring delete modal');
      setUIState(prev => ({ ...prev, showRecurringDeleteModal: true }));
    } else {
      Alert.alert(
        '일정 삭제',
        '이 일정을 삭제하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: deleteSingleEvent,
          },
        ]
      );
    }
  }, [event, deleteSingleEvent, setUIState]);

  return {
    handleDelete,
    deleteSingleEvent,
  };
};