import React, { useState } from 'react';
import { TouchableOpacity, Alert, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import moment from 'moment';

import { Schedule, Event, Holiday } from '../services/DatabaseService';

// 확장된 Event 타입 (JOIN으로 가져온 academy 정보 포함)
interface ExtendedEvent extends Event {
  academy_name?: string;
  academy_subject?: string;
}

interface PDFExportButtonProps {
  schedule: Schedule;
  events: Event[];
  holidays: { [key: string]: Holiday }; // 타입 수정
  weekDays: moment.Moment[];
  timeSlots: string[];
  style?: ViewStyle;
  size?: number;
  color?: string;
  onExportStart?: () => void;
  onExportEnd?: () => void;
  onSuccess?: (uri: string) => void;
  onError?: (error: any) => void;
}

const PDFExportButton: React.FC<PDFExportButtonProps> = ({
  schedule,
  events,
  holidays,
  weekDays,
  timeSlots,
  style,
  size = 24,
  color = '#007AFF',
  onExportStart,
  onExportEnd,
  onSuccess,
  onError,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  // 이벤트 스타일 가져오기
  const getEventStyle = (category: string) => {
    const styles = {
      '학원': { backgroundColor: '#E3F2FD', color: '#1976D2' },
      '학교': { backgroundColor: '#FFF3E0', color: '#F57C00' },
      '개인공부': { backgroundColor: '#F3E5F5', color: '#7B1FA2' },
      '기타': { backgroundColor: '#E8F5E8', color: '#388E3C' },
    };
    return styles[category as keyof typeof styles] || styles['기타'];
  };

  // 특정 날짜와 시간의 이벤트 찾기
  const getEventsForDateAndTime = (date: moment.Moment, time: string): ExtendedEvent[] => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter(event => {
      const eventDateMatches = event.event_date === dateStr;
      const eventStartTime = moment(event.start_time, 'HH:mm');
      const eventEndTime = moment(event.end_time, 'HH:mm');
      const currentTime = moment(time, 'HH:mm');
      const timeMatches = eventStartTime.isSameOrBefore(currentTime) && eventEndTime.isAfter(currentTime);
      return eventDateMatches && timeMatches;
    }) as ExtendedEvent[];
  };

  // 오늘 날짜인지 확인
  const isToday = (date: moment.Moment): boolean => {
    return date.isSame(moment(), 'day');
  };

  // 공휴일인지 확인
  const isHoliday = (date: moment.Moment): boolean => {
    const dateStr = date.format('YYYY-MM-DD');
    return !!holidays[dateStr];
  };

  // HTML 템플릿 생성
  const generateHTML = (): string => {
    const weekRange = `${weekDays[0]?.format('YYYY.MM.DD')} - ${weekDays[weekDays.length - 1]?.format('YYYY.MM.DD')}`;
    
    // 헤더 생성
    const headerCells = weekDays.map(day => {
      const dayName = day.format('ddd');
      const dayDate = day.format('M/D');
      const isHolidayDay = isHoliday(day);
      const isTodayDay = isToday(day);
      
      return `
        <th style="
          width: ${100 / weekDays.length}%;
          padding: 8px 4px;
          border: 1px solid #ddd;
          background-color: ${isHolidayDay ? '#ffebee' : isTodayDay ? '#e3f2fd' : '#f8f9fa'};
          color: ${isHolidayDay ? '#c62828' : isTodayDay ? '#1976d2' : '#333'};
          font-size: 12px;
          text-align: center;
        ">
          <div style="font-weight: bold;">${dayName}</div>
          <div style="margin-top: 2px; font-size: 10px;">${dayDate}</div>
        </th>
      `;
    }).join('');

    // 시간 슬롯과 이벤트 셀 생성
    const timeRows = timeSlots.map(time => {
      const eventCells = weekDays.map(day => {
        const dayEvents = getEventsForDateAndTime(day, time);
        
        if (dayEvents.length > 0) {
          const event = dayEvents[0];
          const eventStyle = getEventStyle(event.category);
          
          return `
            <td style="
              border: 1px solid #ddd;
              padding: 2px;
              vertical-align: top;
              background-color: ${eventStyle.backgroundColor};
              color: ${eventStyle.color};
              font-size: 10px;
              min-height: 30px;
            ">
              <div style="font-weight: bold; margin-bottom: 2px;">
                ${event.title || ''}
              </div>
              ${event.academy_name ? `<div style="font-size: 9px;">${event.academy_name}</div>` : ''}
            </td>
          `;
        } else {
          return `
            <td style="
              border: 1px solid #ddd;
              padding: 2px;
              vertical-align: top;
              min-height: 30px;
              background-color: #fff;
            "></td>
          `;
        }
      }).join('');

      return `
        <tr>
          <td style="
            width: 60px;
            padding: 8px 4px;
            border: 1px solid #ddd;
            background-color: #f8f9fa;
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            vertical-align: middle;
          ">
            ${time}
          </td>
          ${eventCells}
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>시간표 - ${schedule.name}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 0;
              font-size: 12px;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #007AFF;
              padding-bottom: 15px;
            }
            .header h1 {
              margin: 0 0 8px 0;
              font-size: 24px;
              color: #007AFF;
              font-weight: bold;
            }
            .header p {
              margin: 0;
              color: #666;
              font-size: 14px;
            }
            .timetable {
              width: 100%;
              border-collapse: collapse;
              margin: 0 auto;
            }
            .legend {
              margin-top: 20px;
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              justify-content: center;
            }
            .legend-item {
              display: flex;
              align-items: center;
              font-size: 10px;
            }
            .legend-color {
              width: 12px;
              height: 12px;
              border-radius: 2px;
              margin-right: 5px;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 10px;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${schedule.name}</h1>
            <p>${weekRange}</p>
          </div>
          
          <table class="timetable">
            <thead>
              <tr>
                <th style="
                  width: 60px;
                  padding: 8px 4px;
                  border: 1px solid #ddd;
                  background-color: #007AFF;
                  color: white;
                  font-size: 12px;
                  text-align: center;
                ">시간</th>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${timeRows}
            </tbody>
          </table>

          <div class="legend">
            <div class="legend-item">
              <div class="legend-color" style="background-color: #E3F2FD;"></div>
              <span>학원</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #FFF3E0;"></div>
              <span>학교</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #F3E5F5;"></div>
              <span>개인공부</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #E8F5E8;"></div>
              <span>기타</span>
            </div>
          </div>

          <div class="footer">
            <p>생성일: ${moment().format('YYYY년 MM월 DD일 HH:mm')}</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleExportPDF = async () => {
    if (weekDays.length === 0 || timeSlots.length === 0) {
      Alert.alert('오류', 'PDF로 내보낼 시간표 데이터가 없습니다.');
      return;
    }

    try {
      setIsExporting(true);
      onExportStart?.();

      // HTML 생성
      const html = generateHTML();
      
      // PDF 생성
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
        width: 595, // A4 width in points
        height: 842, // A4 height in points
      });

      console.log('📄 PDF generated:', uri);
      onSuccess?.(uri);

      // 파일명 생성
      const weekRange = `${weekDays[0]?.format('YYYY-MM-DD')}_${weekDays[weekDays.length - 1]?.format('YYYY-MM-DD')}`;
      const fileName = `시간표_${schedule.name}_${weekRange}.pdf`;

      // 원하는 파일명으로 복사 후 공유
      try {
        // 임시 디렉토리에 원하는 파일명으로 복사
        const documentsDir = FileSystem.documentDirectory;
        const renamedFileUri = `${documentsDir}${fileName}`;
        
        // 기존 파일이 있다면 삭제
        const fileInfo = await FileSystem.getInfoAsync(renamedFileUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(renamedFileUri);
        }
        
        // 원하는 파일명으로 복사
        await FileSystem.copyAsync({
          from: uri,
          to: renamedFileUri,
        });
        
        console.log('📄 PDF renamed to:', fileName);
        
        // 복사된 파일로 공유
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(renamedFileUri, {
            dialogTitle: '시간표 PDF 공유하기',
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('오류', '공유 기능을 사용할 수 없습니다.');
        }
      } catch (shareError) {
        console.error('Error sharing PDF:', shareError);
        Alert.alert('오류', 'PDF 공유 중 오류가 발생했습니다.');
        onError?.(shareError);
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('오류', 'PDF 생성 중 오류가 발생했습니다.');
      onError?.(error);
    } finally {
      setIsExporting(false);
      onExportEnd?.();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handleExportPDF}
      disabled={isExporting}
    >
      <Ionicons
        name={isExporting ? "hourglass-outline" : "document-text-outline"}
        size={size}
        color={isExporting ? '#999' : color}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});

export default PDFExportButton;