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
  // 단일 API 엔드포인트만 사용 (디버깅 집중)
  private readonly API_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
  
  // ⚠️ 주의: 실제 서비스에서는 유효한 API 키를 환경 변수로 관리해야 합니다
  private readonly SERVICE_KEY = '7pDwW/HAxHnpqtRMHNPWXDIjFzTV/LPEHbTiM+ZVMBvrIPRO5t9WeXF76dCyWr1Ee3qCSYYrB4eyL1ayzfQKVA==';

  // 특정 연도의 공휴일 데이터 가져오기 (DB 우선, API는 보조)
  async getHolidaysForYear(year: number): Promise<Holiday[]> {
    try {
      console.log(`🇰🇷 === Getting holidays for year ${year} ===`);
      
      // 1. 먼저 DB에서 데이터 확인
      const dbHolidays = await DatabaseService.getHolidaysByYear(year);
      if (dbHolidays.length > 0) {
        console.log(`✅ Found ${dbHolidays.length} holidays in DB for year ${year}`);
        return dbHolidays;
      }
      
      // 2. DB에 없으면 API에서 가져와서 저장 시도
      console.log(`📡 No holidays in DB for year ${year}, trying API...`);
      const apiHolidays = await this.fetchHolidaysForYear(year);
      
      // 3. API에서 데이터를 가져온 경우 DB에 저장
      if (apiHolidays.length > 0) {
        await DatabaseService.saveHolidays(apiHolidays);
        console.log(`✅ Saved ${apiHolidays.length} holidays from API to DB for year ${year}`);
        return apiHolidays;
      }
      
      // 4. API도 실패한 경우
      console.log(`❌ API returned no data for year ${year}`);
      return [];
      
    } catch (error) {
      console.error(`❌ Error getting holidays for year ${year}:`, error);
      return [];
    }
  }

  // 특정 연도의 공휴일 데이터 API에서 가져오기 (강화된 디버깅)
  async fetchHolidaysForYear(year: number): Promise<Holiday[]> {
    try {
      console.log(`🔍 === API Debugging for year ${year} ===`);
      console.log(`🔗 API URL: ${this.API_URL}`);
      console.log(`🔑 Service Key: ${this.SERVICE_KEY.substring(0, 20)}...`);
      
      const holidays: Holiday[] = [];
      
      // 12개월 데이터를 순차적으로 가져오기
      for (let month = 1; month <= 12; month++) {
        console.log(`\n📅 --- Processing ${year}-${month.toString().padStart(2, '0')} ---`);
        
        const monthHolidays = await this.fetchHolidaysForMonth(year, month);
        
        if (monthHolidays.length > 0) {
          holidays.push(...monthHolidays);
          console.log(`✅ Added ${monthHolidays.length} holidays from ${year}-${month.toString().padStart(2, '0')}`);
        } else {
          console.log(`ℹ️ No holidays found for ${year}-${month.toString().padStart(2, '0')}`);
        }
      }
      
      console.log(`\n🇰🇷 === Final Result for ${year} ===`);
      console.log(`📊 Total holidays collected: ${holidays.length}`);
      
      if (holidays.length > 0) {
        console.log(`📋 Holiday summary:`);
        holidays.forEach(holiday => {
          console.log(`   • ${holiday.date}: ${holiday.name} (${holiday.is_holiday ? 'Holiday' : 'Not Holiday'})`);
        });
      }
      
      return holidays;
    } catch (error) {
      console.error(`❌ Fatal error fetching holidays for year ${year}:`, error);
      return [];
    }
  }

  // 특정 월의 공휴일 데이터 가져오기 (상세 디버깅)
  private async fetchHolidaysForMonth(year: number, month: number): Promise<Holiday[]> {
    try {
      const url = this.buildApiUrl(year, month);
      console.log(`🌐 Request URL: ${url}`);
      
      // HTTP 요청 실행
      console.log(`📤 Sending HTTP request...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Request timeout after 10 seconds`);
        controller.abort();
      }, 10000);
      
      const response = await Promise.race([
        fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/xml, text/xml, */*',
            'User-Agent': 'HolidayApp/1.0',
          },
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ]);
      
      clearTimeout(timeoutId);
      
      // 응답 상태 확인
      console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
      console.log(`📡 Response Headers:`);
      response.headers.forEach((value, key) => {
        console.log(`   ${key}: ${value}`);
      });

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        return [];
      }

      // 응답 본문 읽기
      const text = await response.text();
      console.log(`📄 Response Size: ${text.length} characters`);
      
      if (text.length === 0) {
        console.log(`⚠️ Empty response body`);
        return [];
      }
      
      // 응답 내용 미리보기
      const preview = text.substring(0, 500);
      console.log(`📋 Response Preview:\n${preview}${text.length > 500 ? '...' : ''}`);
      
      // XML 파싱
      console.log(`🔍 Starting XML parsing...`);
      const jsonData = this.parseXmlToJson(text);
      
      // 데이터 변환
      console.log(`🔄 Converting API data to Holiday objects...`);
      const holidays = this.transformApiDataToHolidays(jsonData, year, month);
      
      console.log(`📊 Month result: ${holidays.length} holidays for ${year}-${month.toString().padStart(2, '0')}`);
      
      return holidays;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Error fetching ${year}-${month}: ${error.name} - ${error.message}`);
        if (error.stack) {
          console.error(`🔍 Stack trace:\n${error.stack}`);
        }
      } else {
        console.error(`❌ Unknown error fetching ${year}-${month}:`, error);
      }
      return [];
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
    
    const fullUrl = `${this.API_URL}?${params.toString()}`;
    console.log(`🔨 Built URL: ${fullUrl}`);
    return fullUrl;
  }

  // 강화된 XML 파싱 (상세 디버깅)
  private parseXmlToJson(xmlText: string): any {
    try {
      console.log(`🔍 === XML Parsing Debug ===`);
      
      // 1. XML 구조 기본 검사
      if (!xmlText.includes('<') || !xmlText.includes('>')) {
        console.log(`❌ Invalid XML: No angle brackets found`);
        return { response: { body: { items: {} } } };
      }
      
      // 2. 루트 엘리먼트 확인
      const rootMatch = xmlText.match(/<(\w+)[^>]*>/);
      if (rootMatch) {
        console.log(`📋 Root element: <${rootMatch[1]}>`);
      }
      
      // 3. 에러 응답 확인
      const errorMatch = xmlText.match(/<cmmMsgHeader>[\s\S]*?<returnReasonCode>(.*?)<\/returnReasonCode>[\s\S]*?<returnAuthMsg>(.*?)<\/returnAuthMsg>[\s\S]*?<\/cmmMsgHeader>/);
      if (errorMatch) {
        const errorCode = errorMatch[1];
        const errorMessage = errorMatch[2];
        console.error(`❌ API Error Response:`);
        console.error(`   Error Code: ${errorCode}`);
        console.error(`   Error Message: ${errorMessage}`);
        return { response: { body: { items: {} } } };
      }
      
      // 4. 응답 헤더 확인
      const headerMatch = xmlText.match(/<header>[\s\S]*?<resultCode>(.*?)<\/resultCode>[\s\S]*?<resultMsg>(.*?)<\/resultMsg>[\s\S]*?<\/header>/);
      if (headerMatch) {
        const resultCode = headerMatch[1];
        const resultMsg = headerMatch[2];
        console.log(`📋 API Response Header:`);
        console.log(`   Result Code: ${resultCode}`);
        console.log(`   Result Message: ${resultMsg}`);
      }
      
      // 5. 총 개수 확인
      const totalCountMatch = xmlText.match(/<totalCount>(\d+)<\/totalCount>/);
      if (totalCountMatch) {
        const totalCount = parseInt(totalCountMatch[1]);
        console.log(`📊 Total Count: ${totalCount}`);
        
        if (totalCount === 0) {
          console.log(`ℹ️ API returned totalCount = 0 (no data available)`);
          return { response: { body: { items: {} } } };
        }
      }
      
      // 6. 아이템 태그 검색
      const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g);
      
      if (!itemMatches) {
        console.log(`⚠️ No <item> tags found in XML response`);
        
        // 가능한 다른 태그들 검색
        const possibleTags = ['items', 'data', 'result', 'holiday', 'event'];
        for (const tag of possibleTags) {
          const tagPattern = new RegExp(`<${tag}[^>]*>`, 'i');
          if (xmlText.match(tagPattern)) {
            console.log(`🔍 Found alternative tag: <${tag}>`);
          }
        }
        
        return { response: { body: { items: {} } } };
      }
      
      console.log(`✅ Found ${itemMatches.length} <item> tags`);
      
      // 7. 각 아이템 파싱
      const items: HolidayApiItem[] = [];
      
      for (let i = 0; i < itemMatches.length; i++) {
        const itemXml = itemMatches[i];
        console.log(`🔍 Parsing item ${i + 1}/${itemMatches.length}:`);
        console.log(`   Raw XML: ${itemXml.substring(0, 200)}${itemXml.length > 200 ? '...' : ''}`);
        
        const item: Partial<HolidayApiItem> = {};
        
        // 각 필드 추출
        const dateNameMatch = itemXml.match(/<dateName>(.*?)<\/dateName>/);
        const isHolidayMatch = itemXml.match(/<isHoliday>(.*?)<\/isHoliday>/);
        const locdateMatch = itemXml.match(/<locdate>(\d+)<\/locdate>/);
        const dateKindMatch = itemXml.match(/<dateKind>(.*?)<\/dateKind>/);
        const seqMatch = itemXml.match(/<seq>(\d+)<\/seq>/);
        
        if (dateNameMatch) {
          item.dateName = dateNameMatch[1];
          console.log(`   ✅ dateName: ${item.dateName}`);
        } else {
          console.log(`   ❌ dateName: NOT FOUND`);
        }
        
        if (isHolidayMatch) {
          item.isHoliday = isHolidayMatch[1];
          console.log(`   ✅ isHoliday: ${item.isHoliday}`);
        } else {
          console.log(`   ❌ isHoliday: NOT FOUND`);
        }
        
        if (locdateMatch) {
          item.locdate = parseInt(locdateMatch[1]);
          console.log(`   ✅ locdate: ${item.locdate}`);
        } else {
          console.log(`   ❌ locdate: NOT FOUND`);
        }
        
        if (dateKindMatch) {
          item.dateKind = dateKindMatch[1];
          console.log(`   ✅ dateKind: ${item.dateKind}`);
        }
        
        if (seqMatch) {
          item.seq = parseInt(seqMatch[1]);
          console.log(`   ✅ seq: ${item.seq}`);
        }
        
        // 필수 필드 검증
        if (dateNameMatch && isHolidayMatch && locdateMatch) {
          items.push(item as HolidayApiItem);
          console.log(`   ✅ Item ${i + 1} successfully parsed`);
        } else {
          console.log(`   ❌ Item ${i + 1} missing required fields, skipped`);
        }
      }
      
      console.log(`📊 Successfully parsed ${items.length}/${itemMatches.length} items`);
      
      return {
        response: {
          body: {
            items: {
              item: items
            }
          }
        }
      };
    } catch (error) {
      console.error('❌ XML Parsing Error:', error);
      return { response: { body: { items: {} } } };
    }
  }

  // API 응답 데이터를 Holiday 객체로 변환 (상세 디버깅)
  private transformApiDataToHolidays(apiData: any, year: number, month: number): Holiday[] {
    try {
      console.log(`🔄 === Transform Data Debug ===`);
      console.log(`📊 Input data structure:`, JSON.stringify(apiData, null, 2));
      
      const holidays: Holiday[] = [];
      const items = apiData?.response?.body?.items?.item;
      
      if (!items) {
        console.log(`❌ No items found in API data structure`);
        return holidays;
      }
      
      // 배열이 아닌 경우 배열로 변환
      const itemArray = Array.isArray(items) ? items : [items];
      console.log(`📋 Processing ${itemArray.length} items...`);
      
      for (let i = 0; i < itemArray.length; i++) {
        const item = itemArray[i];
        console.log(`\n🔍 Transforming item ${i + 1}:`, item);
        
        if (!item.locdate) {
          console.log(`   ❌ No locdate found, skipping`);
          continue;
        }
        
        const dateStr = item.locdate.toString();
        if (dateStr.length !== 8) {
          console.log(`   ❌ Invalid locdate format: ${dateStr} (expected 8 digits)`);
          continue;
        }
        
        const itemYear = parseInt(dateStr.substring(0, 4));
        const itemMonth = parseInt(dateStr.substring(4, 6));
        const itemDay = parseInt(dateStr.substring(6, 8));
        
        console.log(`   📅 Parsed date: ${itemYear}-${itemMonth}-${itemDay}`);
        
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
        console.log(`   ✅ Created holiday: ${holiday.date} - ${holiday.name} (Holiday: ${holiday.is_holiday})`);
      }
      
      console.log(`🇰🇷 Transform result: ${holidays.length} holidays created`);
      return holidays;
    } catch (error) {
      console.error('❌ Transform Error:', error);
      return [];
    }
  }

  // 딜레이 함수
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 공휴일 데이터 업데이트 (단순화된 버전)
  async updateHolidaysIfNeeded(year: number, forceUpdate: boolean = false): Promise<void> {
    try {
      console.log(`🔄 === Update Process for ${year} ===`);
      
      // 강제 업데이트가 아닌 경우 DB 확인
      if (!forceUpdate) {
        const hasData = await DatabaseService.hasHolidaysForYear(year);
        if (hasData) {
          console.log(`✅ Holidays for year ${year} already exist in database`);
          return;
        }
      } else {
        // 강제 업데이트인 경우 기존 데이터 삭제
        await DatabaseService.clearHolidaysForYear(year);
        console.log(`🗑️ Cleared existing holidays for year ${year}`);
      }
      
      // API에서 공휴일 데이터 가져오기
      const apiHolidays = await this.fetchHolidaysForYear(year);
      
      if (apiHolidays.length > 0) {
        await DatabaseService.saveHolidays(apiHolidays);
        console.log(`✅ Successfully saved ${apiHolidays.length} holidays to DB for year ${year}`);
      } else {
        console.log(`⚠️ No holidays to save for year ${year}`);
      }
    } catch (error) {
      console.error(`❌ Error updating holidays for year ${year}:`, error);
      throw error;
    }
  }

  // 현재 연도만 초기화
  async initializeCurrentYears(): Promise<void> {
    const currentYear = new Date().getFullYear();
    
    try {
      console.log(`🇰🇷 === Initializing holidays for ${currentYear} ===`);
      await this.updateHolidaysIfNeeded(currentYear, false);
      console.log('✅ Holiday initialization completed');
    } catch (error) {
      console.error('❌ Error in holiday initialization:', error);
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
    } catch (error) {
      console.error('❌ Error in force update:', error);
      throw error;
    }
  }
}

export default new HolidayService();