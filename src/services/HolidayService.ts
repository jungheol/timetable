// services/HolidayService.ts
import DatabaseService, { Holiday } from './DatabaseService';

interface HolidayApiResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item?: HolidayApiItem | HolidayApiItem[];
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

interface HolidayApiItem {
  dateKind: string;     // 날짜 구분 (01: 국경일, 02: 기념일, 03: 24절기)
  dateName: string;     // 공휴일명
  isHoliday: string;    // 공휴일 여부 (Y/N)
  locdate: number;      // 날짜 (YYYYMMDD)
  seq: number;          // 순번
}

class HolidayService {
  private readonly API_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
  private readonly SERVICE_KEY = '7pDwW/HAxHnpqtRMHNPWXDIjFzTV/LPEHbTiM+ZVMBvrIPRO5t9WeXF76dCyWr1Ee3qCSYYrB4eyL1ayzfQKVA==';

  // 특정 연도의 공휴일 데이터 가져오기 (DB 우선, API는 보조)
  async getHolidaysForYear(year: number): Promise<Holiday[]> {
    try {
      console.log(`🎌 [HolidayService] Starting getHolidaysForYear for ${year}`);
      
      // 1. 먼저 DB에서 데이터 확인
      const dbHolidays = await DatabaseService.getHolidaysByYear(year);
      console.log(`🎌 [HolidayService] DB check: ${dbHolidays.length} holidays found for ${year}`);
      
      if (dbHolidays.length > 0) {
        return dbHolidays;
      }
      
      // 2. DB에 없으면 API에서 가져와서 저장 시도
      console.log(`🎌 [HolidayService] DB empty, fetching from API for ${year}`);
      const apiHolidays = await this.fetchHolidaysForYear(year);
      
      // 3. API에서 데이터를 가져온 경우 DB에 저장
      if (apiHolidays.length > 0) {
        console.log(`🎌 [HolidayService] Saving ${apiHolidays.length} holidays to DB`);
        await DatabaseService.saveHolidays(apiHolidays);
        console.log(`🇰🇷 === Final Result for ${year} ===`);
        console.log(`📊 Total holidays collected: ${apiHolidays.length}`);
        console.log(`✅ Saved ${apiHolidays.length} holidays to database`);
        return apiHolidays;
      }
      
      // 4. API도 실패한 경우
      console.log(`❌ No holidays found for year ${year}`);
      throw new Error(`No holiday data available for year ${year}`);
      
    } catch (error: any) {
      console.error(`❌ Error getting holidays for year ${year}:`, error);
      // 에러를 다시 throw하여 상위에서 처리할 수 있도록 함
      throw new Error(`Holiday fetch failed for ${year}: ${error.message || 'Unknown error'}`);
    }
  }

  // 특정 연도의 공휴일 데이터 API에서 가져오기
  async fetchHolidaysForYear(year: number): Promise<Holiday[]> {
    try {
      console.log(`🌐 [HolidayService] Fetching holidays from API for year ${year}`);
      const holidays: Holiday[] = [];
      const errors: string[] = [];
      
      // 12개월 데이터를 순차적으로 가져오기
      for (let month = 1; month <= 12; month++) {
        try {
          const monthHolidays = await this.fetchHolidaysForMonth(year, month);
          
          if (monthHolidays.length > 0) {
            holidays.push(...monthHolidays);
          } else {
            console.log(`📋 [HolidayService] Month ${month}: No holidays`);
          }
          
          // API 호출 간격 조절
          await this.delay(100);
        } catch (monthError: any) {
          const errorMsg = `Month ${month} fetch failed: ${monthError.message}`;
          console.warn(`⚠️ [HolidayService] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
            
      if (errors.length > 0) {
        console.log(`⚠️ [HolidayService] Errors encountered:`, errors);
      }
      
      return holidays;
    } catch (error: any) {
      console.error(`❌ Error fetching holidays for year ${year}:`, error);
      throw new Error(`API fetch failed for ${year}: ${error.message || 'Network or parsing error'}`);
    }
  }

  // 특정 월의 공휴일 데이터 가져오기 - 에러 처리 강화
  private async fetchHolidaysForMonth(year: number, month: number): Promise<Holiday[]> {
    try {
      const url = this.buildApiUrl(year, month);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ [HolidayService] Request timeout for ${year}-${month}`);
        controller.abort();
      }, 10000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml, text/xml, */*',
          'User-Agent': 'HolidayApp/1.0',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      
      if (text.length === 0) {
        throw new Error('Empty response from API');
      }
      
      // XML 파싱
      const jsonData = this.parseXmlToJson(text);
      
      // 데이터 변환
      const holidays = this.transformApiDataToHolidays(jsonData, year, month);
      
      return holidays;
    } catch (error: any) {
      console.error(`❌ [HolidayService] Error fetching ${year}-${month}:`, error);
      
      // 에러 타입별 메시지 개선
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout for ${year}-${month}`);
      } else if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new Error(`Network connection failed for ${year}-${month}`);
      } else if (error.message.includes('HTTP')) {
        throw new Error(`API server error for ${year}-${month}: ${error.message}`);
      } else {
        throw new Error(`Request failed for ${year}-${month}: ${error.message || 'Unknown error'}`);
      }
    }
  }

  // API URL 구성
  private buildApiUrl(year: number, month: number): string {
    const params = new URLSearchParams({
      serviceKey: this.SERVICE_KEY,
      pageNo: '1',
      numOfRows: '100',
      solYear: year.toString(),
      solMonth: month.toString().padStart(2, '0'),
    });
    
    return `${this.API_URL}?${params.toString()}`;
  }

  // XML 파싱 (로그 최소화하되 에러는 기록)
  private parseXmlToJson(xmlText: string): any {
    try {            
      // 기본 XML 검증
      if (!xmlText.includes('<') || !xmlText.includes('>')) {
        console.warn(`⚠️ [HolidayService] Invalid XML format`);
        return { response: { body: { items: {} } } };
      }
      
      // 에러 응답 확인
      const errorMatch = xmlText.match(/<cmmMsgHeader>[\s\S]*?<returnReasonCode>(.*?)<\/returnReasonCode>[\s\S]*?<returnAuthMsg>(.*?)<\/returnAuthMsg>[\s\S]*?<\/cmmMsgHeader>/);
      if (errorMatch) {
        const [, reasonCode, authMsg] = errorMatch;
        console.error(`❌ [HolidayService] API Error Response: Code=${reasonCode}, Message=${authMsg}`);
        throw new Error(`API Error: ${authMsg} (${reasonCode})`);
      }
      
      // 총 개수 확인
      const totalCountMatch = xmlText.match(/<totalCount>(\d+)<\/totalCount>/);
      if (totalCountMatch) {
        const totalCount = parseInt(totalCountMatch[1]);
        
        if (totalCount === 0) {
          return { response: { body: { items: {} } } };
        }
      }
      
      // 아이템 태그 검색
      const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g);
      
      if (!itemMatches) {
        console.warn(`⚠️ [HolidayService] No item tags found in XML`);
        return { response: { body: { items: {} } } };
      }
            
      // 각 아이템 파싱
      const items: HolidayApiItem[] = [];
      
      for (const itemXml of itemMatches) {
        const item: Partial<HolidayApiItem> = {};
        
        // 각 필드 추출
        const dateNameMatch = itemXml.match(/<dateName>(.*?)<\/dateName>/);
        const isHolidayMatch = itemXml.match(/<isHoliday>(.*?)<\/isHoliday>/);
        const locdateMatch = itemXml.match(/<locdate>(\d+)<\/locdate>/);
        const dateKindMatch = itemXml.match(/<dateKind>(.*?)<\/dateKind>/);
        const seqMatch = itemXml.match(/<seq>(\d+)<\/seq>/);
        
        if (dateNameMatch) item.dateName = dateNameMatch[1];
        if (isHolidayMatch) item.isHoliday = isHolidayMatch[1];
        if (locdateMatch) item.locdate = parseInt(locdateMatch[1]);
        if (dateKindMatch) item.dateKind = dateKindMatch[1];
        if (seqMatch) item.seq = parseInt(seqMatch[1]);
        
        // 필수 필드 검증
        if (dateNameMatch && isHolidayMatch && locdateMatch) {
          items.push(item as HolidayApiItem);
        } else {
          console.warn(`⚠️ [HolidayService] Incomplete item data:`, item);
        }
      }
            
      return {
        response: {
          body: {
            items: {
              item: items
            }
          }
        }
      };
    } catch (error: any) {
      console.error(`❌ [HolidayService] XML parsing error:`, error);
      throw new Error(`XML parsing failed: ${error.message || 'Invalid XML structure'}`);
    }
  }

  // API 응답 데이터를 Holiday 객체로 변환
  private transformApiDataToHolidays(apiData: any, year: number, month: number): Holiday[] {
    try {      
      const holidays: Holiday[] = [];
      const items = apiData?.response?.body?.items?.item;
      
      if (!items) {
        return holidays;
      }
      
      // 배열이 아닌 경우 배열로 변환
      const itemArray = Array.isArray(items) ? items : [items];
      
      for (const item of itemArray) {
        try {
          if (!item.locdate) {
            console.warn(`⚠️ [HolidayService] Item missing locdate:`, item);
            continue;
          }
          
          const dateStr = item.locdate.toString();
          if (dateStr.length !== 8) {
            console.warn(`⚠️ [HolidayService] Invalid date format: ${dateStr}`);
            continue;
          }
          
          const itemYear = parseInt(dateStr.substring(0, 4));
          const itemMonth = parseInt(dateStr.substring(4, 6));
          const itemDay = parseInt(dateStr.substring(6, 8));
          
          const holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'> = {
            date: `${itemYear}-${itemMonth.toString().padStart(2, '0')}-${itemDay.toString().padStart(2, '0')}`,
            name: item.dateName || '공휴일',
            is_holiday: item.isHoliday === 'Y',
            year: itemYear,
            month: itemMonth,
            day: itemDay,
            del_yn: false,
          };
          
          holidays.push(holiday as Holiday);
        } catch (itemError: any) {
          console.error(`❌ [HolidayService] Error processing item:`, item, itemError);
        }
      }
      
      return holidays;
    } catch (error: any) {
      console.error(`❌ [HolidayService] Data transformation error:`, error);
      throw new Error(`Data transformation failed: ${error.message || 'Unknown transformation error'}`);
    }
  }

  // 딜레이 함수
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 공휴일 데이터 업데이트
  async updateHolidaysIfNeeded(year: number, forceUpdate: boolean = false): Promise<void> {
    try {
      console.log(`🎌 [HolidayService] updateHolidaysIfNeeded: year=${year}, force=${forceUpdate}`);
      
      // 강제 업데이트가 아닌 경우 DB 확인
      if (!forceUpdate) {
        const hasData = await DatabaseService.hasHolidaysForYear(year);
        console.log(`🎌 [HolidayService] DB has data for ${year}: ${hasData}`);
        
        if (hasData) {
          return;
        }
      } else {
        // 강제 업데이트인 경우 기존 데이터 삭제
        console.log(`🎌 [HolidayService] Force update: clearing existing data for ${year}`);
        await DatabaseService.clearHolidaysForYear(year);
      }
      
      // API에서 공휴일 데이터 가져오기
      console.log(`🎌 [HolidayService] Fetching fresh data for ${year}`);
      const apiHolidays = await this.fetchHolidaysForYear(year);
      
      if (apiHolidays.length > 0) {
        console.log(`🎌 [HolidayService] Saving ${apiHolidays.length} holidays to DB`);
        await DatabaseService.saveHolidays(apiHolidays);
        console.log(`🇰🇷 === Final Result for ${year} ===`);
        console.log(`📊 Total holidays collected: ${apiHolidays.length}`);
        console.log(`✅ Saved ${apiHolidays.length} holidays to database`);
      } else {
        console.warn(`⚠️ [HolidayService] No holidays received from API for ${year}`);
      }
    } catch (error: any) {
      console.error(`❌ Error updating holidays for year ${year}:`, error);
      throw new Error(`Holiday update failed for ${year}: ${error.message || 'Unknown update error'}`);
    }
  }

  // 현재 연도와 다음 연도 초기화
  async initializeCurrentYears(): Promise<void> {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    
    try {
      console.log(`🎌 [HolidayService] Initializing holidays for ${currentYear} and ${nextYear}`);
      
      console.log(`[Setup] Fetching ${currentYear} holidays from API...`);
      await this.updateHolidaysIfNeeded(currentYear, false);
      console.log(`[Setup] Fetched holidays for ${currentYear}`);
      
      console.log(`[Setup] Fetching ${nextYear} holidays from API...`);
      await this.updateHolidaysIfNeeded(nextYear, false);
      console.log(`[Setup] Fetched holidays for ${nextYear}`);
      
      console.log('✅ Holiday initialization completed');
    } catch (error: any) {
      console.error('❌ Error in holiday initialization:', error);
      throw new Error(`Holiday initialization failed: ${error.message || 'Unknown initialization error'}`);
    }
  }

  // 강제 업데이트용 메서드
  async forceUpdateCurrentYears(): Promise<void> {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    
    try {
      console.log(`🔄 === Force updating holidays ===`);
      await this.updateHolidaysIfNeeded(currentYear, true);
      await this.updateHolidaysIfNeeded(nextYear, true);
      console.log('✅ Force update completed');
    } catch (error: any) {
      console.error('❌ Error in force update:', error);
      throw new Error(`Force update failed: ${error.message || 'Unknown force update error'}`);
    }
  }
}

export default new HolidayService();