import * as SQLite from 'expo-sqlite';
import moment from 'moment';

export interface Schedule {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  show_weekend: boolean;
  is_active: boolean;
  time_unit?: '30min' | '1hour';
  created_at?: string;
  updated_at?: string;
  del_yn?: boolean;
}

export interface Event {
  id: number;
  schedule_id: number;
  title: string;
  start_time: string;
  end_time: string;
  event_date?: string;
  category: '학교/기관' | '학원' | '공부' | '휴식' | '선택안함';
  academy_id?: number;
  is_recurring: boolean;
  recurring_group_id?: number;
  created_at?: string;
  updated_at?: string;
  del_yn?: boolean;
}

export interface Academy {
  id: number;
  schedule_id: number;
  name: string;
  subject: '국어' | '수학' | '영어' | '예체능' | '사회과학' | '기타';
  monthly_fee?: number;
  payment_cycle?: number;
  payment_method?: '카드' | '이체';
  payment_day?: number;
  payment_institution?: string;
  payment_account?: string;
  textbook_fee?: number;
  textbook_bank?: string;
  textbook_account?: string;
  start_month?: string;
  end_month?: string;
  status: '진행' | '중단';
  provides_vehicle?: boolean;
  note?: string;
  created_at?: string;
  updated_at?: string;
  del_yn?: boolean;
}

export interface RecurringPattern {
  id: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_date: string;
  end_date?: string;
  created_at?: string;
  del_yn?: boolean;
}

export interface RecurringException {
  id: number;
  recurring_event_id: number;
  exception_date: string;           // YYYY-MM-DD
  exception_type: 'modify' | 'cancel';
  
  // 수정된 내용 (modify인 경우)
  modified_title?: string;
  modified_start_time?: string;
  modified_end_time?: string;
  modified_category?: '학교/기관' | '학원' | '공부' | '휴식' | '선택안함';
  modified_academy_id?: number;
  
  created_at?: string;
  updated_at?: string;
  del_yn?: boolean;
}

export interface Holiday {
  id: number;
  date: string;           // YYYY-MM-DD 형식
  name: string;           // 공휴일명
  is_holiday: boolean;    // 공휴일 여부
  year: number;           // 연도
  month: number;          // 월
  day: number;            // 일
  created_at?: string;
  updated_at?: string;
  del_yn?: boolean;
}

// 통계 관련 인터페이스
export interface AcademyExpenseStats {
  academy_id: number;
  academy_name: string;
  subject: string;
  total_expense: number;
  monthly_fee: number;
  payment_cycle: number;
  months_count: number;
}

export interface MonthlyExpenseStats {
  subject: string;
  total_expense: number;
  academy_count: number;
}

export interface MonthlyStudyStats {
  subject: string;
  total_hours: number;
  academy_name?: string;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  // 🔧 개발 모드 설정
  private DEVELOPMENT_MODE = true;

  constructor() {
    this.initDatabase();
  }

  // ✅ Boolean 데이터 정제 메서드들 추가
  private sanitizeScheduleData(rawData: any): Schedule {
    return {
      ...rawData,
      show_weekend: Boolean(rawData.show_weekend),
      is_active: Boolean(rawData.is_active),
      del_yn: Boolean(rawData.del_yn),
    };
  }

  private sanitizeEventData(rawData: any): Event {
    return {
      ...rawData,
      is_recurring: Boolean(rawData.is_recurring),
      del_yn: Boolean(rawData.del_yn),
    };
  }

  private sanitizeAcademyData(rawData: any): Academy {
    return {
      ...rawData,
      provides_vehicle: Boolean(rawData.provides_vehicle),
      del_yn: Boolean(rawData.del_yn),
    };
  }

  private sanitizeRecurringPatternData(rawData: any): RecurringPattern {
    return {
      ...rawData,
      monday: Boolean(rawData.monday),
      tuesday: Boolean(rawData.tuesday),
      wednesday: Boolean(rawData.wednesday),
      thursday: Boolean(rawData.thursday),
      friday: Boolean(rawData.friday),
      saturday: Boolean(rawData.saturday),
      sunday: Boolean(rawData.sunday),
      del_yn: Boolean(rawData.del_yn),
    };
  }

  private sanitizeRecurringExceptionData(rawData: any): RecurringException {
    return {
      ...rawData,
      del_yn: Boolean(rawData.del_yn),
    };
  }

  private sanitizeHolidayData(rawData: any): Holiday {
    return {
      ...rawData,
      is_holiday: Boolean(rawData.is_holiday),
      del_yn: Boolean(rawData.del_yn),
    };
  }

  // ✅ 배열 정제 메서드들
  private sanitizeScheduleArray(rawArray: any[]): Schedule[] {
    return rawArray.map(item => this.sanitizeScheduleData(item));
  }

  private sanitizeEventArray(rawArray: any[]): Event[] {
    return rawArray.map(item => this.sanitizeEventData(item));
  }

  private sanitizeAcademyArray(rawArray: any[]): Academy[] {
    return rawArray.map(item => this.sanitizeAcademyData(item));
  }

  private sanitizeHolidayArray(rawArray: any[]): Holiday[] {
    return rawArray.map(item => this.sanitizeHolidayData(item));
  }

  private async initDatabase() {
    try {
      this.db = await SQLite.openDatabaseAsync('student_schedule.db');

      // 🔧 개발 모드일 때 모든 테이블 삭제 후 재생성
      if (this.DEVELOPMENT_MODE) {
        console.log('🔧 Development mode: Dropping all tables...');
        await this.db.execAsync(`DROP TABLE IF EXISTS events;`);
        await this.db.execAsync(`DROP TABLE IF EXISTS academies;`);
        await this.db.execAsync(`DROP TABLE IF EXISTS recurring_patterns;`);
        await this.db.execAsync(`DROP TABLE IF EXISTS schedules;`);
        await this.db.execAsync(`DROP TABLE IF EXISTS holidays;`);
        await this.db.execAsync(`DROP TABLE IF EXISTS recurring_exceptions;`);
        console.log('✅ All tables dropped');
      }
      
      // 일정표 테이블
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          show_weekend BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          time_unit TEXT DEFAULT '1hour',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          del_yn BOOLEAN DEFAULT FALSE
        );
      `);

      // 반복 패턴 테이블
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS recurring_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          monday BOOLEAN DEFAULT FALSE,
          tuesday BOOLEAN DEFAULT FALSE,
          wednesday BOOLEAN DEFAULT FALSE,
          thursday BOOLEAN DEFAULT FALSE,
          friday BOOLEAN DEFAULT FALSE,
          saturday BOOLEAN DEFAULT FALSE,
          sunday BOOLEAN DEFAULT FALSE,
          start_date TEXT NOT NULL,
          end_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          del_yn BOOLEAN DEFAULT FALSE
        );
      `);

      // 반복 예외 패턴 테이블
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS recurring_exceptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recurring_event_id INTEGER NOT NULL,
          exception_date TEXT NOT NULL,
          exception_type TEXT CHECK(exception_type IN ('modify', 'cancel')) NOT NULL,
          
          modified_title TEXT,
          modified_start_time TEXT,
          modified_end_time TEXT,
          modified_category TEXT CHECK(modified_category IN ('학교/기관', '학원', '공부', '휴식', '선택안함')),
          modified_academy_id INTEGER,
          
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          del_yn BOOLEAN DEFAULT FALSE,
          
          FOREIGN KEY (recurring_event_id) REFERENCES events(id),
          FOREIGN KEY (modified_academy_id) REFERENCES academies(id),
          UNIQUE(recurring_event_id, exception_date)
        );
      `);

      // 학원 테이블
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS academies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          schedule_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          subject TEXT CHECK(subject IN ('국어', '수학', '영어', '예체능', '사회과학', '기타')),
          monthly_fee INTEGER,
          payment_cycle INTEGER DEFAULT 1,
          payment_method TEXT CHECK(payment_method IN ('카드', '이체')),
          payment_day INTEGER,
          payment_institution TEXT,
          payment_account TEXT,
          textbook_fee INTEGER,
          textbook_bank TEXT,
          textbook_account TEXT,
          start_month TEXT,
          end_month TEXT,
          status TEXT CHECK(status IN ('진행', '중단')) DEFAULT '진행',
          provides_vehicle BOOLEAN DEFAULT FALSE,
          note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          del_yn BOOLEAN DEFAULT FALSE,
          FOREIGN KEY (schedule_id) REFERENCES schedules(id)
        );
      `);

      // 일정 테이블
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          schedule_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          event_date TEXT,
          category TEXT CHECK(category IN ('학교/기관', '학원', '공부', '휴식', '선택안함')),
          academy_id INTEGER,
          is_recurring BOOLEAN DEFAULT FALSE,
          recurring_group_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          del_yn BOOLEAN DEFAULT FALSE,
          FOREIGN KEY (schedule_id) REFERENCES schedules(id),
          FOREIGN KEY (academy_id) REFERENCES academies(id),
          FOREIGN KEY (recurring_group_id) REFERENCES recurring_patterns(id)
        );
      `);

      // 공휴일 테이블 생성
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS holidays (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          is_holiday BOOLEAN DEFAULT TRUE,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          day INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          del_yn BOOLEAN DEFAULT FALSE
        );
      `);

      // 인덱스 생성
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_events_schedule_date 
        ON events(schedule_id, event_date) WHERE del_yn = FALSE;
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_events_academy 
        ON events(academy_id) WHERE del_yn = FALSE;
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_holidays_date 
        ON holidays(date) WHERE del_yn = FALSE;
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_holidays_year 
        ON holidays(year) WHERE del_yn = FALSE;
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_event_date 
        ON recurring_exceptions(recurring_event_id, exception_date) WHERE del_yn = FALSE;
      `);

    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  private async ensureDbConnection(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      await this.initDatabase();
    }
    if (!this.db) {
      throw new Error('Database connection failed');
    }
    return this.db;
  }

  // 일정표 관리 (✅ 정제 로직 적용)
  async getActiveSchedule(): Promise<Schedule | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<any>(
        'SELECT * FROM schedules WHERE is_active = 1 AND del_yn = 0 LIMIT 1'
      );
      return result ? this.sanitizeScheduleData(result) : null;
    } catch (error) {
      console.error('Error getting active schedule:', error);
      throw error;
    }
  }

  async createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.runAsync(
        `INSERT INTO schedules (
          name, start_time, end_time, show_weekend, is_active, time_unit, del_yn
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          schedule.name,
          schedule.start_time,
          schedule.end_time,
          schedule.show_weekend ? 1 : 0,
          schedule.is_active ? 1 : 0,
          schedule.time_unit || '1hour',
          schedule.del_yn ? 1 : 0
        ]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
    }
  }

  async updateSchedule(schedule: Schedule): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('🔄 [DB] Updating schedule:', schedule);
      
      await db.runAsync(
        `UPDATE schedules SET 
         name = ?, start_time = ?, end_time = ?, show_weekend = ?, 
         time_unit = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          schedule.name, 
          schedule.start_time, 
          schedule.end_time, 
          schedule.show_weekend ? 1 : 0,
          schedule.time_unit || '1hour',
          schedule.is_active ? 1 : 0,
          schedule.id
        ]
      );
      
      console.log('✅ [DB] Schedule updated successfully');
      
    } catch (error) {
      console.error('❌ [DB] Error updating schedule:', error);
      throw error;
    }
  }

  // ✅ 모든 스케줄 조회 (정제 로직 적용)
  async getAllSchedules(): Promise<Schedule[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<any>(
        'SELECT * FROM schedules WHERE del_yn = 0 ORDER BY created_at DESC'
      );
      return this.sanitizeScheduleArray(result);
    } catch (error) {
      console.error('Error getting all schedules:', error);
      throw error;
    }
  }

  async getScheduleById(id: number): Promise<Schedule | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<any>(
        'SELECT * FROM schedules WHERE id = ? AND del_yn = 0',
        [id]
      );
      return result ? this.sanitizeScheduleData(result) : null;
    } catch (error) {
      console.error('Error getting schedule by id:', error);
      throw error;
    }
  }

  // 특정 스케줄을 활성화하고 다른 스케줄들을 비활성화
  async setActiveSchedule(scheduleId: number): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      // 먼저 모든 스케줄을 비활성화
      await db.runAsync('UPDATE schedules SET is_active = 0 WHERE del_yn = 0');
      
      // 선택한 스케줄만 활성화
      await db.runAsync('UPDATE schedules SET is_active = 1 WHERE id = ? AND del_yn = 0', [scheduleId]);
      
      console.log(`✅ Schedule ${scheduleId} set as active`);
    } catch (error) {
      console.error('Error setting active schedule:', error);
      throw error;
    }
  }

  // 스케줄 삭제 (논리적 삭제)
  async deleteSchedule(id: number): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      // 삭제하려는 스케줄이 활성 스케줄인지 확인
      const scheduleToDelete = await db.getFirstAsync<any>(
        'SELECT * FROM schedules WHERE id = ? AND del_yn = 0',
        [id]
      );
      
      if (!scheduleToDelete) {
        throw new Error('Schedule not found');
      }
      
      const sanitizedSchedule = this.sanitizeScheduleData(scheduleToDelete);
      
      // 스케줄을 논리적으로 삭제
      await db.runAsync('UPDATE schedules SET del_yn = 1 WHERE id = ?', [id]);
      
      // 만약 삭제된 스케줄이 활성 스케줄이었다면, 다른 스케줄을 활성화
      if (sanitizedSchedule.is_active) {
        const remainingSchedules = await db.getAllAsync<any>(
          'SELECT * FROM schedules WHERE del_yn = 0 ORDER BY created_at DESC LIMIT 1'
        );
        
        if (remainingSchedules.length > 0) {
          await db.runAsync('UPDATE schedules SET is_active = 1 WHERE id = ?', [remainingSchedules[0].id]);
          console.log(`✅ Activated schedule ${remainingSchedules[0].id} after deletion`);
        }
      }
      
      console.log(`✅ Schedule ${id} deleted`);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  }

  // ✅ 학원 관리 (정제 로직 적용)
  async getAcademiesBySchedule(scheduleId: number): Promise<Academy[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<any>(
        'SELECT * FROM academies WHERE schedule_id = ? AND del_yn = 0 ORDER BY created_at DESC',
        [scheduleId]
      );
      return this.sanitizeAcademyArray(result);
    } catch (error) {
      console.error('Error getting academies by schedule:', error);
      throw error;
    }
  }

  async getAcademies(): Promise<Academy[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<any>(
        'SELECT * FROM academies WHERE del_yn = 0 ORDER BY created_at DESC'
      );
      return this.sanitizeAcademyArray(result);
    } catch (error) {
      console.error('Error getting academies:', error);
      throw error;
    }
  }

  async createAcademy(academy: Omit<Academy, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.runAsync(
        `INSERT INTO academies (
          schedule_id, name, subject, monthly_fee, payment_cycle, payment_method, 
          payment_day, payment_institution, payment_account, textbook_fee, 
          textbook_bank, textbook_account, start_month, end_month, 
          status, provides_vehicle, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          academy.schedule_id,
          academy.name, 
          academy.subject, 
          academy.monthly_fee ?? null, 
          academy.payment_cycle ?? null,
          academy.payment_method ?? null, 
          academy.payment_day ?? null, 
          academy.payment_institution ?? null,
          academy.payment_account ?? null, 
          academy.textbook_fee ?? null, 
          academy.textbook_bank ?? null,
          academy.textbook_account ?? null, 
          academy.start_month ?? null, 
          academy.end_month ?? null,
          academy.status, 
          academy.provides_vehicle ? 1 : 0, 
          academy.note ?? null
        ]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating academy:', error);
      throw error;
    }
  }

  async updateAcademy(academy: Academy): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      await db.runAsync(
        `UPDATE academies SET 
         schedule_id = ?, name = ?, subject = ?, monthly_fee = ?, payment_cycle = ?,
         payment_method = ?, payment_day = ?, payment_institution = ?,
         payment_account = ?, textbook_fee = ?, textbook_bank = ?,
         textbook_account = ?, start_month = ?, end_month = ?,
         status = ?, provides_vehicle = ?, note = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          academy.schedule_id,
          academy.name, 
          academy.subject, 
          academy.monthly_fee ?? null, 
          academy.payment_cycle ?? null,
          academy.payment_method ?? null, 
          academy.payment_day ?? null, 
          academy.payment_institution ?? null,
          academy.payment_account ?? null, 
          academy.textbook_fee ?? null, 
          academy.textbook_bank ?? null,
          academy.textbook_account ?? null, 
          academy.start_month ?? null, 
          academy.end_month ?? null,
          academy.status, 
          academy.provides_vehicle ? 1 : 0, 
          academy.note ?? null, 
          academy.id
        ]
      );
    } catch (error) {
      console.error('Error updating academy:', error);
      throw error;
    }
  }

  async deleteAcademy(id: number): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      await db.runAsync('UPDATE academies SET del_yn = 1 WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting academy:', error);
      throw error;
    }
  }

  // ✅ 일정 관리 (정제 로직 적용)
  async getEvents(scheduleId: number, startDate: string, endDate: string): Promise<Event[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<any>(
        `SELECT e.*, a.name as academy_name, a.subject as academy_subject
         FROM events e
         LEFT JOIN academies a ON e.academy_id = a.id
         WHERE e.schedule_id = ? AND e.del_yn = 0
         AND ((e.is_recurring = 0 AND e.event_date BETWEEN ? AND ?)
              OR (e.is_recurring = 1))
         ORDER BY e.start_time`,
        [scheduleId, startDate, endDate]
      );
      return this.sanitizeEventArray(result);
    } catch (error) {
      console.error('Error getting events:', error);
      throw error;
    }
  }

  async createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('Creating event:', event);
      
      const result = await db.runAsync(
        `INSERT INTO events (
          schedule_id, title, start_time, end_time, event_date,
          category, academy_id, is_recurring, recurring_group_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.schedule_id, 
          event.title, 
          event.start_time, 
          event.end_time,
          event.event_date ?? null, 
          event.category, 
          event.academy_id ?? null,
          event.is_recurring ? 1 : 0, 
          event.recurring_group_id ?? null
        ]
      );
      
      console.log('Event created with ID:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(event: Event): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      await db.runAsync(
        `UPDATE events SET 
         title = ?, start_time = ?, end_time = ?, event_date = ?,
         category = ?, academy_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          event.title, 
          event.start_time, 
          event.end_time, 
          event.event_date ?? null,
          event.category, 
          event.academy_id ?? null, 
          event.id
        ]
      );
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(id: number): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      await db.runAsync('UPDATE events SET del_yn = 1 WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  // 다중 요일 일정 생성 (반복 없음)
  async createMultiDayEvents(
    eventData: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'event_date'>,
    selectedDays: string[],
    baseDate: string
  ): Promise<number[]> {
    try {
      const db = await this.ensureDbConnection();
      const eventIds: number[] = [];
      
      // 선택된 요일들에 대해 각각 이벤트 생성
      for (const dayKey of selectedDays) {
        const eventDate = this.getNextDateForDay(baseDate, dayKey);
        
        const result = await db.runAsync(
          `INSERT INTO events (
            schedule_id, title, start_time, end_time, event_date,
            category, academy_id, is_recurring, recurring_group_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventData.schedule_id,
            eventData.title,
            eventData.start_time,
            eventData.end_time,
            eventDate,
            eventData.category,
            eventData.academy_id ?? null,
            false, // 다중 요일이지만 반복은 아님
            null
          ]
        );
        
        eventIds.push(result.lastInsertRowId);
      }
      
      return eventIds;
    } catch (error) {
      console.error('Error creating multi-day events:', error);
      throw error;
    }
  }

  // 요일 키를 기반으로 다음 해당 요일의 날짜 계산
  private getNextDateForDay(baseDate: string, dayKey: string): string {
    const dayMap = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };
    
    const targetDay = dayMap[dayKey as keyof typeof dayMap];
    const base = moment(baseDate);
    const currentDay = base.day();
    
    // 현재 주에서 해당 요일까지의 차이 계산
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd < 0) {
      daysToAdd += 7; // 다음 주의 해당 요일
    }
    
    return base.add(daysToAdd, 'days').format('YYYY-MM-DD');
  }

  // 반복 일정과 연결된 학원 정보 저장 (학원 카테고리인 경우)
  async createAcademyForRecurringEvent(
    academyName: string,
    subject: Academy['subject'],
    scheduleId: number
  ): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('Creating/finding academy:', academyName, subject, 'for schedule:', scheduleId);
      
      // 동일한 스케줄에서 동일한 이름과 과목의 학원이 있는지 확인
      const existingAcademy = await db.getFirstAsync<any>(
        'SELECT * FROM academies WHERE schedule_id = ? AND name = ? AND subject = ? AND del_yn = 0',
        [scheduleId, academyName, subject]
      );
      
      if (existingAcademy) {
        console.log('Found existing academy:', existingAcademy.id);
        return existingAcademy.id;
      }
      
      // 새 학원 생성
      const result = await db.runAsync(
        `INSERT INTO academies (schedule_id, name, subject, status, del_yn) VALUES (?, ?, ?, ?, ?)`,
        [scheduleId, academyName, subject, '진행', 0]
      );
      
      console.log('Created new academy with ID:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating academy for recurring event:', error);
      throw error;
    }
  }

  // ✅ 개선된 이벤트 조회 (반복 일정 확장 포함 + 정제 로직)
  async getEventsWithRecurring(
    scheduleId: number, 
    startDate: string, 
    endDate: string
  ): Promise<Event[]> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('🔍 Loading events with recurring support...');
      
      // 1. 일반 일정 조회
      const regularEvents = await db.getAllAsync<any>(
        `SELECT e.*, a.name as academy_name, a.subject as academy_subject
        FROM events e
        LEFT JOIN academies a ON e.academy_id = a.id AND a.del_yn = 0
        WHERE e.schedule_id = ? AND e.del_yn = 0 AND e.is_recurring = 0
        AND e.event_date BETWEEN ? AND ?
        ORDER BY e.start_time`,
        [scheduleId, startDate, endDate]
      );
      
      // 2. 반복 일정 조회
      const recurringEvents = await db.getAllAsync<any>(
        `SELECT e.*, a.name as academy_name, a.subject as academy_subject, 
                rp.monday, rp.tuesday, rp.wednesday, rp.thursday, 
                rp.friday, rp.saturday, rp.sunday, 
                rp.start_date, rp.end_date
        FROM events e
        LEFT JOIN academies a ON e.academy_id = a.id AND a.del_yn = 0
        INNER JOIN recurring_patterns rp ON e.recurring_group_id = rp.id
        WHERE e.schedule_id = ? AND e.del_yn = 0 AND e.is_recurring = 1
        AND rp.del_yn = 0
        AND rp.start_date <= ?
        AND (rp.end_date IS NULL OR rp.end_date >= ?)`,
        [scheduleId, endDate, startDate]
      );
      
      console.log(`📝 Regular events: ${regularEvents.length}, Recurring patterns: ${recurringEvents.length}`);
      
      // 3. 반복 일정을 날짜별로 확장하고 예외 적용
      const expandedRecurringEvents: Event[] = [];
      
      for (const recurringEvent of recurringEvents) {
        console.log(`🔄 Processing recurring event: ${recurringEvent.title}`);
        
        // 기본 날짜들 생성
        const dates = this.generateRecurringDates(recurringEvent, startDate, endDate);
        
        // 해당 반복 일정의 예외들 조회
        const exceptions = await this.getRecurringExceptions(recurringEvent.id, startDate, endDate);
        const exceptionMap = new Map<string, RecurringException>();
        exceptions.forEach(ex => exceptionMap.set(ex.exception_date, ex));
        
        console.log(`📅 Generated ${dates.length} dates, Found ${exceptions.length} exceptions`);
        if (exceptions.length > 0) {
          console.log('🔍 Exception details:', exceptions.map(ex => ({
            date: ex.exception_date,
            type: ex.exception_type,
            hasModifications: !!(ex.modified_title || ex.modified_start_time || ex.modified_end_time)
          })));
        }
        
        for (const date of dates) {
          const exception = exceptionMap.get(date);
          
          if (exception && exception.exception_type === 'cancel') {
            // 취소된 날짜는 건너뛰기
            console.log(`❌ Skipping cancelled date: ${date}`);
            continue;
          }
          
          // 기본 이벤트 생성
          let eventForDate: Event = this.sanitizeEventData({
            id: recurringEvent.id,
            schedule_id: recurringEvent.schedule_id,
            title: recurringEvent.title,
            start_time: recurringEvent.start_time,
            end_time: recurringEvent.end_time,
            event_date: date,
            category: recurringEvent.category,
            academy_id: recurringEvent.academy_id,
            is_recurring: true,
            recurring_group_id: recurringEvent.recurring_group_id,
            created_at: recurringEvent.created_at,
            updated_at: recurringEvent.updated_at,
            del_yn: recurringEvent.del_yn,
            academy_name: recurringEvent.academy_name,
            academy_subject: recurringEvent.academy_subject,
          });
          
          // ✅ 수정 예외가 있는 경우 적용 - 개선된 로직
          if (exception && exception.exception_type === 'modify') {
            console.log(`✏️ Applying exception for ${date}:`, {
              exceptionId: exception.id,
              originalData: {
                title: eventForDate.title,
                startTime: eventForDate.start_time,
                endTime: eventForDate.end_time,
                category: eventForDate.category,
                academyId: eventForDate.academy_id
              },
              modificationData: {
                title: exception.modified_title,
                startTime: exception.modified_start_time,
                endTime: exception.modified_end_time,
                category: exception.modified_category,
                academyId: exception.modified_academy_id
              }
            });
            
            // ✅ null, undefined, 빈 문자열을 모두 체크하여 수정된 값들 적용
            if (exception.modified_title !== null && exception.modified_title !== undefined && exception.modified_title.trim() !== '') {
              const oldTitle = eventForDate.title;
              eventForDate.title = exception.modified_title;
              console.log(`   📝 Title updated: "${oldTitle}" → "${exception.modified_title}"`);
            } else {
              console.log(`   📝 Title unchanged: "${eventForDate.title}" (no valid modification)`);
            }
            
            if (exception.modified_start_time !== null && exception.modified_start_time !== undefined && exception.modified_start_time.trim() !== '') {
              const oldStartTime = eventForDate.start_time;
              eventForDate.start_time = exception.modified_start_time;
              console.log(`   ⏰ Start time updated: "${oldStartTime}" → "${exception.modified_start_time}"`);
            } else {
              console.log(`   ⏰ Start time unchanged: "${eventForDate.start_time}" (no valid modification)`);
            }
            
            if (exception.modified_end_time !== null && exception.modified_end_time !== undefined && exception.modified_end_time.trim() !== '') {
              const oldEndTime = eventForDate.end_time;
              eventForDate.end_time = exception.modified_end_time;
              console.log(`   ⏰ End time updated: "${oldEndTime}" → "${exception.modified_end_time}"`);
            } else {
              console.log(`   ⏰ End time unchanged: "${eventForDate.end_time}" (no valid modification)`);
            }
            
            if (exception.modified_category !== null && exception.modified_category !== undefined && exception.modified_category.trim() !== '') {
              const oldCategory = eventForDate.category;
              eventForDate.category = exception.modified_category;
              console.log(`   📂 Category updated: "${oldCategory}" → "${exception.modified_category}"`);
            } else {
              console.log(`   📂 Category unchanged: "${eventForDate.category}" (no valid modification)`);
            }
            
            if (exception.modified_academy_id !== null && exception.modified_academy_id !== undefined) {
              const previousAcademyId = eventForDate.academy_id;
              eventForDate.academy_id = exception.modified_academy_id;
              console.log(`   🏫 Academy ID updated: ${previousAcademyId} → ${exception.modified_academy_id}`);
              
              // ✅ 수정된 학원 정보 로드 - 에러 처리 강화
              try {
                const modifiedAcademy = await this.getAcademyById(exception.modified_academy_id);
                if (modifiedAcademy) {
                  (eventForDate as any).academy_name = modifiedAcademy.name;
                  (eventForDate as any).academy_subject = modifiedAcademy.subject;
                  console.log(`   ✅ Academy info loaded: ${modifiedAcademy.name} (${modifiedAcademy.subject})`);
                } else {
                  console.warn(`   ⚠️ Academy ${exception.modified_academy_id} not found, keeping original info`);
                  // 원본 학원 정보 유지
                  (eventForDate as any).academy_name = recurringEvent.academy_name;
                  (eventForDate as any).academy_subject = recurringEvent.academy_subject;
                }
              } catch (academyError) {
                console.error(`   ❌ Failed to load modified academy info for ID ${exception.modified_academy_id}:`, academyError);
                // 에러 발생 시 원본 학원 정보 유지
                (eventForDate as any).academy_name = recurringEvent.academy_name;
                (eventForDate as any).academy_subject = recurringEvent.academy_subject;
              }
            } else {
              console.log(`   🏫 Academy unchanged: ID ${eventForDate.academy_id} (no valid modification)`);
            }
            
            // 예외 ID를 특별히 표시 (UI에서 구분용)
            (eventForDate as any).exception_id = exception.id;
            (eventForDate as any).exception_type = exception.exception_type;
            
            console.log(`✅ Exception applied successfully for ${date}:`, {
              finalData: {
                title: eventForDate.title,
                startTime: eventForDate.start_time,
                endTime: eventForDate.end_time,
                category: eventForDate.category,
                academyId: eventForDate.academy_id
              },
              exceptionId: (eventForDate as any).exception_id
            });
          }
          
          expandedRecurringEvents.push(eventForDate);
        }
      }
      
      // 4. 모든 이벤트 합치기
      const sanitizedRegularEvents = this.sanitizeEventArray(regularEvents);
      const allEvents = [...sanitizedRegularEvents, ...expandedRecurringEvents];
      
      console.log(`📋 Final event summary:`, {
        regular: sanitizedRegularEvents.length,
        recurring: expandedRecurringEvents.length,
        total: allEvents.length,
        exceptions: allEvents.filter(e => !!(e as any).exception_id).length
      });
      
      // 5. 중복 제거 및 정렬
      const uniqueEvents = this.removeDuplicateEvents(allEvents);
      
      return uniqueEvents.sort((a, b) => {
        if (a.event_date !== b.event_date) {
          return (a.event_date || '').localeCompare(b.event_date || '');
        }
        return a.start_time.localeCompare(b.start_time);
      });
      
    } catch (error) {
      console.error('❌ Error getting events with recurring:', error);
      throw error;
    }
  }

  // ✅ 중복 이벤트 제거 메서드 추가
  private removeDuplicateEvents(events: Event[]): Event[] {
    const uniqueEvents = new Map<string, Event>();
    
    for (const event of events) {
      // 중복 키 생성: 날짜_시작시간_제목_카테고리
      const key = `${event.event_date}_${event.start_time}_${event.title}_${event.category}`;
      
      // 이미 있는 이벤트인 경우, 예외가 있는 것을 우선
      const existing = uniqueEvents.get(key);
      if (existing) {
        const hasException = !!(event as any).exception_id;
        const existingHasException = !!(existing as any).exception_id;
        
        if (hasException && !existingHasException) {
          // 새 이벤트가 예외고 기존이 일반이면 새 것을 사용
          uniqueEvents.set(key, event);
          console.log(`🔄 Replaced regular event with exception for ${key}`);
        }
        // 그 외의 경우는 기존 것을 유지
      } else {
        uniqueEvents.set(key, event);
      }
    }
    
    return Array.from(uniqueEvents.values());
  }

  // 반복 일정의 날짜들 생성
  private generateRecurringDates(
    recurringEvent: any,
    startDate: string,
    endDate: string
  ): string[] {
    const dates: string[] = [];
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const patternStart = new Date(recurringEvent.start_date);
      const patternEnd = recurringEvent.end_date ? new Date(recurringEvent.end_date) : null;
      
      // 시작일을 조정 (패턴 시작일 이후부터)
      let current = new Date(Math.max(start.getTime(), patternStart.getTime()));
      
      while (current <= end) {
        const dayOfWeek = current.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
        let shouldInclude = false;
        
        // 요일 확인 (✅ Boolean 타입 정제)
        switch (dayOfWeek) {
          case 0: shouldInclude = Boolean(recurringEvent.sunday); break;
          case 1: shouldInclude = Boolean(recurringEvent.monday); break;
          case 2: shouldInclude = Boolean(recurringEvent.tuesday); break;
          case 3: shouldInclude = Boolean(recurringEvent.wednesday); break;
          case 4: shouldInclude = Boolean(recurringEvent.thursday); break;
          case 5: shouldInclude = Boolean(recurringEvent.friday); break;
          case 6: shouldInclude = Boolean(recurringEvent.saturday); break;
        }
        
        // 패턴 종료일 확인
        if (patternEnd && current > patternEnd) {
          shouldInclude = false;
        }
        
        if (shouldInclude) {
          const dateStr = current.toISOString().split('T')[0]; // YYYY-MM-DD 형식
          dates.push(dateStr);
        }
        
        // 다음 날로 이동
        current.setDate(current.getDate() + 1);
      }
      
    } catch (error) {
      console.error('Error generating recurring dates:', error);
    }
    
    return dates;
  }

  // 반복 패턴 업데이트
  async updateRecurringPattern(pattern: RecurringPattern): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      await db.runAsync(
        `UPDATE recurring_patterns SET 
        monday = ?, tuesday = ?, wednesday = ?, thursday = ?,
        friday = ?, saturday = ?, sunday = ?,
        start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          pattern.monday ? 1 : 0,
          pattern.tuesday ? 1 : 0,
          pattern.wednesday ? 1 : 0,
          pattern.thursday ? 1 : 0,
          pattern.friday ? 1 : 0,
          pattern.saturday ? 1 : 0,
          pattern.sunday ? 1 : 0,
          pattern.start_date,
          pattern.end_date ?? null,
          pattern.id
        ]
      );
    } catch (error) {
      console.error('Error updating recurring pattern:', error);
      throw error;
    }
  }

  // 반복 일정 삭제 (패턴과 연결된 모든 이벤트 삭제)
  async deleteRecurringEvent(eventId: number): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('Deleting recurring event:', eventId);
      
      // 이벤트 정보 조회 (✅ 정제 로직 적용)
      const eventResult = await db.getFirstAsync<any>(
        'SELECT * FROM events WHERE id = ? AND del_yn = 0',
        [eventId]
      );
      
      if (!eventResult) {
        throw new Error('Event not found');
      }
      
      const event = this.sanitizeEventData(eventResult);
      
      console.log('Found event to delete:', event);
      
      if (event.is_recurring && event.recurring_group_id) {
        console.log('Deleting recurring pattern:', event.recurring_group_id);
        
        // 반복 패턴 삭제
        await db.runAsync(
          'UPDATE recurring_patterns SET del_yn = 1 WHERE id = ?',
          [event.recurring_group_id]
        );
        
        // 연결된 모든 이벤트 삭제
        await db.runAsync(
          'UPDATE events SET del_yn = 1 WHERE recurring_group_id = ?',
          [event.recurring_group_id]
        );
        
        console.log('Recurring event and pattern deleted');
      } else {
        // 단일 이벤트 삭제
        await db.runAsync('UPDATE events SET del_yn = 1 WHERE id = ?', [eventId]);
        console.log('Single event deleted');
      }
    } catch (error) {
      console.error('Error deleting recurring event:', error);
      throw error;
    }
  }

  // 반복 패턴 관리
  async createRecurringPattern(pattern: Omit<RecurringPattern, 'id' | 'created_at'>): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('Creating recurring pattern:', pattern);
      
      const result = await db.runAsync(
        `INSERT INTO recurring_patterns (
          monday, tuesday, wednesday, thursday, friday, saturday, sunday,
          start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pattern.monday ? 1 : 0, 
          pattern.tuesday ? 1 : 0, 
          pattern.wednesday ? 1 : 0, 
          pattern.thursday ? 1 : 0, 
          pattern.friday ? 1 : 0, 
          pattern.saturday ? 1 : 0, 
          pattern.sunday ? 1 : 0, 
          pattern.start_date, 
          pattern.end_date ?? null
        ]
      );
      
      console.log('Recurring pattern created with ID:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating recurring pattern:', error);
      throw error;
    }
  }

  async testRecurringRetrieval(scheduleId: number): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('🧪 === Testing Recurring Event Retrieval ===');
      
      // 1. 저장된 반복 이벤트 확인
      const recurringEvents = await db.getAllAsync(`
        SELECT * FROM events WHERE is_recurring = 1 AND del_yn = 0
      `);
      console.log('🧪 Stored recurring events:', recurringEvents);
      
      // 2. 반복 패턴 확인
      const patterns = await db.getAllAsync(`
        SELECT * FROM recurring_patterns WHERE del_yn = 0
      `);
      console.log('🧪 Stored patterns:', patterns);
      
      // 3. 조인된 데이터 확인
      const joinedData = await db.getAllAsync(`
        SELECT e.*, 
               rp.monday, rp.tuesday, rp.wednesday, rp.thursday, 
               rp.friday, rp.saturday, rp.sunday, 
               rp.start_date, rp.end_date
        FROM events e
        INNER JOIN recurring_patterns rp ON e.recurring_group_id = rp.id
        WHERE e.schedule_id = ? AND e.del_yn = 0 AND e.is_recurring = 1 AND rp.del_yn = 0
      `, [scheduleId]);
      console.log('🧪 Joined recurring data:', joinedData);
      
      // 4. 특정 기간으로 이벤트 조회 테스트
      const testStartDate = '2025-05-26'; // 월요일
      const testEndDate = '2025-06-01';   // 일요일
      
      console.log(`🧪 Testing retrieval for period: ${testStartDate} to ${testEndDate}`);
      
      const retrievedEvents = await this.getEventsWithRecurring(
        scheduleId, 
        testStartDate, 
        testEndDate
      );
      console.log('🧪 Retrieved events with recurring:', retrievedEvents);
      
    } catch (error) {
      console.error('🧪 Test retrieval error:', error);
    }
  }

  // ✅ 반복 패턴 조회 메서드 (정제 로직 적용)
  async getRecurringPattern(id: number): Promise<RecurringPattern | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<any>(
        'SELECT * FROM recurring_patterns WHERE id = ? AND del_yn = 0',
        [id]
      );
      return result ? this.sanitizeRecurringPatternData(result) : null;
    } catch (error) {
      console.error('Error getting recurring pattern:', error);
      throw error;
    }
  }

  // ✅ 학원 ID로 학원 정보 조회 메서드 (정제 로직 적용)
  async getAcademyById(id: number): Promise<Academy | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<any>(
        'SELECT * FROM academies WHERE id = ? AND del_yn = 0',
        [id]
      );
      return result ? this.sanitizeAcademyData(result) : null;
    } catch (error) {
      console.error('Error getting academy by id:', error);
      throw error;
    }
  }

  // ✅ 특정 일정의 상세 정보 조회 (정제 로직 적용)
  async getEventDetails(id: number): Promise<(Event & { academy_name?: string; academy_subject?: string }) | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<any>(
        `SELECT e.*, a.name as academy_name, a.subject as academy_subject
        FROM events e
        LEFT JOIN academies a ON e.academy_id = a.id AND a.del_yn = 0
        WHERE e.id = ? AND e.del_yn = 0`,
        [id]
      );
      return result ? this.sanitizeEventData(result) : null;
    } catch (error) {
      console.error('Error getting event details:', error);
      throw error;
    }
  }

  // 예외 생성
  async createRecurringException(exception: Omit<RecurringException, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('🔄 Creating recurring exception with full data:', {
        eventId: exception.recurring_event_id,
        date: exception.exception_date,
        type: exception.exception_type,
        modifications: {
          title: exception.modified_title,
          startTime: exception.modified_start_time,
          endTime: exception.modified_end_time,
          category: exception.modified_category,
          academyId: exception.modified_academy_id
        },
        hasModifications: !!(
          exception.modified_title || 
          exception.modified_start_time || 
          exception.modified_end_time || 
          exception.modified_category || 
          exception.modified_academy_id
        )
      });
      
      // ✅ 기존 예외가 있는지 먼저 확인
      const existingException = await db.getFirstAsync<any>(
        'SELECT * FROM recurring_exceptions WHERE recurring_event_id = ? AND exception_date = ? AND del_yn = 0',
        [exception.recurring_event_id, exception.exception_date]
      );
      
      if (existingException) {
        console.log('⚠️ Exception already exists, updating instead of creating');
        console.log('📊 Existing exception data:', existingException);
        
        // 기존 예외 업데이트
        await db.runAsync(
          `UPDATE recurring_exceptions SET 
          exception_type = ?, modified_title = ?, modified_start_time = ?, 
          modified_end_time = ?, modified_category = ?, modified_academy_id = ?,
          updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [
            exception.exception_type,
            exception.modified_title ?? null,
            exception.modified_start_time ?? null,
            exception.modified_end_time ?? null,
            exception.modified_category ?? null,
            exception.modified_academy_id ?? null,
            existingException.id
          ]
        );
        
        console.log('✅ Exception updated successfully');
        
        // 업데이트된 데이터 확인
        const updatedException = await db.getFirstAsync<any>(
          'SELECT * FROM recurring_exceptions WHERE id = ?',
          [existingException.id]
        );
        console.log('📊 Updated exception data:', updatedException);
        
        return existingException.id;
      }
      
      // 새 예외 생성
      const result = await db.runAsync(
        `INSERT INTO recurring_exceptions (
          recurring_event_id, exception_date, exception_type,
          modified_title, modified_start_time, modified_end_time,
          modified_category, modified_academy_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exception.recurring_event_id,
          exception.exception_date,
          exception.exception_type,
          exception.modified_title ?? null,
          exception.modified_start_time ?? null,
          exception.modified_end_time ?? null,
          exception.modified_category ?? null,
          exception.modified_academy_id ?? null,
        ]
      );
      
      console.log('✅ Exception created with ID:', result.lastInsertRowId);
      
      // 생성된 데이터 확인
      const createdException = await db.getFirstAsync<any>(
        'SELECT * FROM recurring_exceptions WHERE id = ?',
        [result.lastInsertRowId]
      );
      console.log('📊 Created exception data:', createdException);
      
      return result.lastInsertRowId;
    } catch (error) {
      console.error('❌ Error creating recurring exception:', error);
      throw error;
    }
  }

  // ✅ 예외 조회 (정제 로직 적용)
  async getRecurringExceptions(eventId: number, startDate: string, endDate: string): Promise<RecurringException[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<any>(
        `SELECT * FROM recurring_exceptions 
        WHERE recurring_event_id = ? 
          AND exception_date BETWEEN ? AND ? 
          AND del_yn = 0
        ORDER BY exception_date`,
        [eventId, startDate, endDate]
      );
      return result.map(item => this.sanitizeRecurringExceptionData(item));
    } catch (error) {
      console.error('Error getting recurring exceptions:', error);
      throw error;
    }
  }

  // 예외 수정
  async updateRecurringException(exception: RecurringException): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('🔄 Updating recurring exception:', {
        id: exception.id,
        eventId: exception.recurring_event_id,
        date: exception.exception_date,
        type: exception.exception_type,
        modifications: {
          title: exception.modified_title,
          startTime: exception.modified_start_time,
          endTime: exception.modified_end_time,
          category: exception.modified_category,
          academyId: exception.modified_academy_id
        }
      });
      
      await db.runAsync(
        `UPDATE recurring_exceptions SET 
        exception_type = ?, modified_title = ?, modified_start_time = ?, 
        modified_end_time = ?, modified_category = ?, modified_academy_id = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          exception.exception_type,
          exception.modified_title ?? null,
          exception.modified_start_time ?? null,
          exception.modified_end_time ?? null,
          exception.modified_category ?? null,
          exception.modified_academy_id ?? null,
          exception.id
        ]
      );
      
      console.log('✅ Exception updated successfully');
    } catch (error) {
      console.error('❌ Error updating recurring exception:', error);
      throw error;
    }
  }

  // 예외 삭제
  async deleteRecurringException(id: number): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      await db.runAsync('UPDATE recurring_exceptions SET del_yn = 1 WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting recurring exception:', error);
      throw error;
    }
  }

  // 공휴일 저장
  async saveHolidays(holidays: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      // 트랜잭션으로 일괄 저장
      await db.execAsync('BEGIN TRANSACTION');
      
      for (const holiday of holidays) {
        await db.runAsync(
          `INSERT OR REPLACE INTO holidays (
            date, name, is_holiday, year, month, day, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            holiday.date,
            holiday.name,
            holiday.is_holiday ? 1 : 0,
            holiday.year,
            holiday.month,
            holiday.day
          ]
        );
      }
      
      await db.execAsync('COMMIT');
      console.log(`✅ Saved ${holidays.length} holidays to database`);
    } catch (error) {
      const db = await this.ensureDbConnection();
      await db.execAsync('ROLLBACK');
      console.error('Error saving holidays:', error);
      throw error;
    }
  }

  // ✅ 특정 연도의 공휴일 조회 (정제 로직 적용)
  async getHolidaysByYear(year: number): Promise<Holiday[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<any>(
        'SELECT * FROM holidays WHERE year = ? AND del_yn = 0 ORDER BY date',
        [year]
      );
      return this.sanitizeHolidayArray(result);
    } catch (error) {
      console.error('Error getting holidays by year:', error);
      throw error;
    }
  }

  // ✅ 특정 날짜의 공휴일 조회 (정제 로직 적용)
  async getHolidayByDate(date: string): Promise<Holiday | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<any>(
        'SELECT * FROM holidays WHERE date = ? AND del_yn = 0',
        [date]
      );
      return result ? this.sanitizeHolidayData(result) : null;
    } catch (error) {
      console.error('Error getting holiday by date:', error);
      throw error;
    }
  }

  // ✅ 특정 기간의 공휴일 조회 (정제 로직 적용)
  async getHolidaysInRange(startDate: string, endDate: string): Promise<Holiday[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<any>(
        'SELECT * FROM holidays WHERE date BETWEEN ? AND ? AND del_yn = 0 ORDER BY date',
        [startDate, endDate]
      );
      return this.sanitizeHolidayArray(result);
    } catch (error) {
      console.error('Error getting holidays in range:', error);
      throw error;
    }
  }

  // 공휴일 데이터 존재 여부 확인
  async hasHolidaysForYear(year: number): Promise<boolean> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM holidays WHERE year = ? AND del_yn = 0',
        [year]
      );
      const count = result?.count || 0;
      console.log(`📊 Holidays in DB for year ${year}: ${count} records`);
      return count > 0;
    } catch (error) {
      console.error('Error checking holidays existence:', error);
      return false;
    }
  }

  // 공휴일 캐시 무효화 (재다운로드 시 사용)
  async clearHolidaysForYear(year: number): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      await db.runAsync(
        'UPDATE holidays SET del_yn = 1 WHERE year = ?',
        [year]
      );
      console.log(`✅ Cleared holidays for year ${year}`);
    } catch (error) {
      console.error('Error clearing holidays:', error);
      throw error;
    }
  }

  // 🧪 공휴일 디버깅용 메서드
  async debugHolidayData(): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('🧪 === Holiday Database Debug Info ===');
      
      // 1. 전체 공휴일 개수
      const totalCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM holidays WHERE del_yn = 0'
      );
      console.log(`🧪 Total holidays in DB: ${totalCount?.count || 0}`);
      
      // 2. 연도별 공휴일 개수
      const yearCounts = await db.getAllAsync<{ year: number; count: number }>(
        'SELECT year, COUNT(*) as count FROM holidays WHERE del_yn = 0 GROUP BY year ORDER BY year'
      );
      console.log('🧪 Holidays by year:');
      yearCounts.forEach(({ year, count }) => {
        console.log(`   ${year}: ${count} holidays`);
      });
      
      // 3. 현재 연도 공휴일 상세 목록
      const currentYear = new Date().getFullYear();
      const currentYearHolidays = await this.getHolidaysByYear(currentYear);
      
      console.log(`🧪 ${currentYear} Holiday Details:`);
      currentYearHolidays.forEach(holiday => {
        console.log(`   📅 ${holiday.date}: ${holiday.name} (Holiday: ${holiday.is_holiday})`);
      });
      
      console.log('🧪 === End Holiday Debug Info ===');
      
    } catch (error) {
      console.error('🧪 Error in holiday debug:', error);
    }
  }

  // 🧪 특정 날짜 범위의 공휴일 디버깅
  async debugHolidaysInRange(startDate: string, endDate: string): Promise<void> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log(`🧪 === Holiday Debug for ${startDate} ~ ${endDate} ===`);
      
      const holidays = await this.getHolidaysInRange(startDate, endDate);
      
      console.log(`🧪 Found ${holidays.length} holidays in range:`);
      holidays.forEach(holiday => {
        console.log(`   📅 ${holiday.date}: ${holiday.name} (Holiday: ${holiday.is_holiday})`);
      });
      
      if (holidays.length === 0) {
        console.log('🧪 ⚠️ No holidays found in this date range');
      }
      
      console.log('🧪 === End Range Debug ===');
      
    } catch (error) {
      console.error('🧪 Error in range holiday debug:', error);
    }
  }

  // 학원별 총 지출 금액 통계
  async getAcademyExpenseStats(): Promise<AcademyExpenseStats[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<AcademyExpenseStats>(
        `SELECT 
          a.id as academy_id,
          a.name as academy_name,
          a.subject,
          a.monthly_fee,
          a.payment_cycle,
          CASE 
            WHEN a.end_month IS NULL THEN 
              CAST((julianday('now') - julianday(a.start_month || '-01')) / 30.44 AS INTEGER) + 1
            ELSE 
              CAST((julianday(a.end_month || '-01') - julianday(a.start_month || '-01')) / 30.44 AS INTEGER) + 1
          END as months_count,
          CASE 
            WHEN a.monthly_fee IS NOT NULL AND a.payment_cycle IS NOT NULL THEN
              CASE 
                WHEN a.end_month IS NULL THEN 
                  (CAST((julianday('now') - julianday(a.start_month || '-01')) / 30.44 AS INTEGER) + 1) * (a.monthly_fee / a.payment_cycle)
                ELSE 
                  (CAST((julianday(a.end_month || '-01') - julianday(a.start_month || '-01')) / 30.44 AS INTEGER) + 1) * (a.monthly_fee / a.payment_cycle)
              END
            ELSE 0
          END as total_expense
        FROM academies a
        WHERE a.del_yn = 0 AND a.start_month IS NOT NULL
        ORDER BY total_expense DESC, a.subject, a.name`
      );
      return result;
    } catch (error) {
      console.error('Error getting academy expense stats:', error);
      throw error;
    }
  }

  // 월별 지출 통계
  async getMonthlyExpenseStats(year: number, month: number): Promise<MonthlyExpenseStats[]> {
    try {
      const db = await this.ensureDbConnection();
      
      // 미래 달인 경우 빈 배열 반환
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        console.log(`📊 Future month requested: ${year}-${month}, returning empty data`);
        return [];
      }
      
      console.log(`📊 Calculating expenses for ${year}-${month}`);
      
      // 해당 월의 모든 학원 조회
      const academies = await db.getAllAsync<any>(
        `SELECT 
          id, name, subject, monthly_fee, payment_cycle, payment_method,
          payment_day, start_month, end_month, status
        FROM academies 
        WHERE del_yn = 0 
          AND monthly_fee IS NOT NULL 
          AND payment_cycle IS NOT NULL
          AND payment_day IS NOT NULL`
      );
      
      console.log(`📊 Found ${academies.length} academies with payment info`);
      
      const subjectExpenses = new Map<string, { total_expense: number; academy_count: number }>();
      
      for (const academy of academies) {
        const shouldInclude = this.shouldIncludeAcademyInMonth(academy, year, month);
        
        if (shouldInclude) {
          const monthlyAmount = academy.monthly_fee / academy.payment_cycle;
          const subject = academy.subject || '기타';
          
          console.log(`📊 Including ${academy.name} (${subject}): ${monthlyAmount}원`);
          
          const current = subjectExpenses.get(subject) || { total_expense: 0, academy_count: 0 };
          current.total_expense += monthlyAmount;
          current.academy_count += 1;
          subjectExpenses.set(subject, current);
        } else {
          console.log(`📊 Excluding ${academy.name}: payment logic`);
        }
      }
      
      // 결과 변환
      const result: MonthlyExpenseStats[] = Array.from(subjectExpenses.entries())
        .map(([subject, data]) => ({
          subject,
          total_expense: Math.round(data.total_expense),
          academy_count: data.academy_count
        }))
        .sort((a, b) => b.total_expense - a.total_expense);
      
      console.log(`📊 Final monthly expense stats:`, result);
      return result;
    } catch (error) {
      console.error('Error getting monthly expense stats:', error);
      throw error;
    }
  }

  // 특정 월에 학원비가 포함되어야 하는지 판단하는 헬퍼 메서드
  private shouldIncludeAcademyInMonth(academy: any, targetYear: number, targetMonth: number): boolean {
    try {
      const { start_month, end_month, payment_day, payment_cycle } = academy;
      
      // 1. 시작월 확인
      if (!start_month) return false;
      
      const [startYear, startMonth] = start_month.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, 1);
      const targetDate = new Date(targetYear, targetMonth - 1, 1);
      
      // 시작월보다 이전이면 제외
      if (targetDate < startDate) {
        return false;
      }
      
      // 2. 종료월과 결제일 확인
      if (end_month) {
        const [endYear, endMonth] = end_month.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, 1);
        
        // 종료월보다 이후면 제외
        if (targetDate > endDate) {
          return false;
        }
        
        // 종료월과 같은 달인 경우, 결제일 확인
        if (targetYear === endYear && targetMonth === endMonth) {
          // 결제 주기별 결제일 계산
          const paymentDates = this.getPaymentDatesForMonth(targetYear, targetMonth, payment_day, payment_cycle, startYear, startMonth);
          
          // 해당 월에 결제일이 있는지 확인
          const hasPaymentInMonth = paymentDates.length > 0;
          
          if (!hasPaymentInMonth) {
            return false; // 해당 월에 결제일이 없으면 제외
          }
          
          console.log(`📊 Payment check for ${academy.name}: payment_day=${payment_day}, end_month=${end_month}`);
          
          // 중단월의 경우 해당 월에 결제가 이루어졌는지 확인하여 포함 여부 결정
          // 현재는 간단하게 중단월도 포함하는 것으로 처리 (실제 앱에서는 정확한 중단일이 필요)
          return true;
        }
      }
      
      // 3. 결제 주기에 따른 해당 월 결제 여부 확인
      const paymentDates = this.getPaymentDatesForMonth(targetYear, targetMonth, payment_day, payment_cycle, startYear, startMonth);
      return paymentDates.length > 0;
      
    } catch (error) {
      console.error('Error checking academy inclusion:', error);
      return false;
    }
  }

  // 특정 월에 결제일이 있는지 확인하는 헬퍼 메서드
  private getPaymentDatesForMonth(
    targetYear: number, 
    targetMonth: number, 
    paymentDay: number, 
    paymentCycle: number,
    startYear: number,
    startMonth: number
  ): number[] {
    try {
      const paymentDates: number[] = [];
      
      // 시작월부터 현재까지 결제 주기 계산
      const startDate = new Date(startYear, startMonth - 1, 1);
      const targetDate = new Date(targetYear, targetMonth - 1, 1);
      
      // 시작월부터 대상월까지의 개월 수
      const monthsDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
      
      // 결제 주기별로 해당 월에 결제일이 있는지 확인
      if (monthsDiff >= 0 && monthsDiff % paymentCycle === 0) {
        // 해당 월의 마지막 날 확인
        const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
        const actualPaymentDay = Math.min(paymentDay, lastDayOfMonth);
        
        paymentDates.push(actualPaymentDay);
      }
      
      return paymentDates;
      
    } catch (error) {
      console.error('Error getting payment dates:', error);
      return [];
    }
  }

  // 월별 학습 시간 통계
  async getMonthlyStudyStats(year: number, month: number): Promise<MonthlyStudyStats[]> {
    try {
      const db = await this.ensureDbConnection();
      
      // 미래 달인 경우 빈 배열 반환
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        console.log(`📊 Future month requested: ${year}-${month}, returning empty study data`);
        return [];
      }
      
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 해당 월의 마지막 날
      
      console.log(`Getting study stats for ${startDate} to ${endDate}`);
      
      // 1. 일반 이벤트의 학습 시간
      const regularEvents = await db.getAllAsync<any>(
        `SELECT 
          COALESCE(a.subject, '기타') as subject,
          a.name as academy_name,
          e.start_time,
          e.end_time,
          e.event_date,
          e.category
        FROM events e
        LEFT JOIN academies a ON e.academy_id = a.id AND a.del_yn = 0
        WHERE e.del_yn = 0 
          AND e.is_recurring = 0
          AND e.event_date BETWEEN ? AND ?
          AND e.category IN ('학원', '공부')`,
        [startDate, endDate]
      );
      
      // 2. 반복 이벤트의 학습 시간
      const recurringEvents = await db.getAllAsync<any>(
        `SELECT 
          e.*, 
          COALESCE(a.subject, '기타') as subject,
          a.name as academy_name,
          rp.monday, rp.tuesday, rp.wednesday, rp.thursday, 
          rp.friday, rp.saturday, rp.sunday, 
          rp.start_date, rp.end_date
        FROM events e
        LEFT JOIN academies a ON e.academy_id = a.id AND a.del_yn = 0
        INNER JOIN recurring_patterns rp ON e.recurring_group_id = rp.id
        WHERE e.del_yn = 0 
          AND e.is_recurring = 1
          AND rp.del_yn = 0
          AND rp.start_date <= ?
          AND (rp.end_date IS NULL OR rp.end_date >= ?)
          AND e.category IN ('학원', '공부')`,
        [endDate, startDate]
      );
      
      console.log(`Found ${regularEvents.length} regular events, ${recurringEvents.length} recurring patterns`);
      
      // 3. 시간 계산을 위한 헬퍼 함수
      const calculateHours = (startTime: string, endTime: string): number => {
        try {
          const [startHour, startMin] = startTime.split(':').map(Number);
          const [endHour, endMin] = endTime.split(':').map(Number);
          
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          const diffMinutes = endMinutes - startMinutes;
          return diffMinutes > 0 ? diffMinutes / 60 : 0;
        } catch (error) {
          console.error('Error calculating hours:', error);
          return 0;
        }
      };
      
      // 4. 과목별 시간 집계
      const subjectHours = new Map<string, number>();
      
      // 일반 이벤트 처리
      for (const event of regularEvents) {
        const hours = calculateHours(event.start_time, event.end_time);
        const subject = event.subject || '기타';
        subjectHours.set(subject, (subjectHours.get(subject) || 0) + hours);
      }
      
      // 반복 이벤트 처리
      for (const recurringEvent of recurringEvents) {
        const dates = this.generateRecurringDates(recurringEvent, startDate, endDate);
        const hours = calculateHours(recurringEvent.start_time, recurringEvent.end_time);
        const subject = recurringEvent.subject || '기타';
        
        const totalHours = hours * dates.length;
        subjectHours.set(subject, (subjectHours.get(subject) || 0) + totalHours);
      }
      
      // 5. 결과 변환
      const result: MonthlyStudyStats[] = Array.from(subjectHours.entries()).map(([subject, total_hours]) => ({
        subject,
        total_hours: Math.round(total_hours * 100) / 100 // 소수점 2자리까지
      })).sort((a, b) => b.total_hours - a.total_hours);
      
      console.log('Monthly study stats result:', result);
      return result;
    } catch (error) {
      console.error('Error getting monthly study stats:', error);
      throw error;
    }
  }
}

export default new DatabaseService();