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

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  // 🔧 개발 모드 설정
  private DEVELOPMENT_MODE = true;

  constructor() {
    this.initDatabase();
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

      // 학원 테이블
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS academies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
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
          del_yn BOOLEAN DEFAULT FALSE
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

  // 일정표 관리
  async getActiveSchedule(): Promise<Schedule | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<Schedule>(
        'SELECT * FROM schedules WHERE is_active = 1 AND del_yn = 0 LIMIT 1'
      );
      return result || null;
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
          schedule.is_active ? 1 : 0,  // ✅ is_active 추가!
          schedule.id
        ]
      );
      
      console.log('✅ [DB] Schedule updated successfully');
      
      // 업데이트 후 확인
      const updatedSchedule = await db.getFirstAsync<Schedule>(
        'SELECT * FROM schedules WHERE id = ?',
        [schedule.id]
      );
      console.log('🔍 [DB] Updated schedule verification:', updatedSchedule);
      
    } catch (error) {
      console.error('❌ [DB] Error updating schedule:', error);
      throw error;
    }
  }

  // 모든 스케줄 조회 (삭제되지 않은 것만)
async getAllSchedules(): Promise<Schedule[]> {
  try {
    const db = await this.ensureDbConnection();
    const result = await db.getAllAsync<Schedule>(
      'SELECT * FROM schedules WHERE del_yn = 0 ORDER BY created_at DESC'
    );
    return result;
  } catch (error) {
    console.error('Error getting all schedules:', error);
    throw error;
  }
}

async getScheduleById(id: number): Promise<Schedule | null> {
  try {
    const db = await this.ensureDbConnection();
    const result = await db.getFirstAsync<Schedule>(
      'SELECT * FROM schedules WHERE id = ? AND del_yn = 0',
      [id]
    );
    return result || null;
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
    const scheduleToDelete = await db.getFirstAsync<Schedule>(
      'SELECT * FROM schedules WHERE id = ? AND del_yn = 0',
      [id]
    );
    
    if (!scheduleToDelete) {
      throw new Error('Schedule not found');
    }
    
    // 스케줄을 논리적으로 삭제
    await db.runAsync('UPDATE schedules SET del_yn = 1 WHERE id = ?', [id]);
    
    // 만약 삭제된 스케줄이 활성 스케줄이었다면, 다른 스케줄을 활성화
    if (scheduleToDelete.is_active) {
      const remainingSchedules = await db.getAllAsync<Schedule>(
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

  // 학원 관리
  async getAcademies(): Promise<Academy[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<Academy>(
        'SELECT * FROM academies WHERE del_yn = 0 ORDER BY created_at DESC'
      );
      return result;
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
          name, subject, monthly_fee, payment_cycle, payment_method, 
          payment_day, payment_institution, payment_account, textbook_fee, 
          textbook_bank, textbook_account, start_month, end_month, 
          status, provides_vehicle, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
         name = ?, subject = ?, monthly_fee = ?, payment_cycle = ?,
         payment_method = ?, payment_day = ?, payment_institution = ?,
         payment_account = ?, textbook_fee = ?, textbook_bank = ?,
         textbook_account = ?, start_month = ?, end_month = ?,
         status = ?, provides_vehicle = ?, note = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
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

  // 일정 관리
  async getEvents(scheduleId: number, startDate: string, endDate: string): Promise<Event[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<Event>(
        `SELECT e.*, a.name as academy_name, a.subject as academy_subject
         FROM events e
         LEFT JOIN academies a ON e.academy_id = a.id
         WHERE e.schedule_id = ? AND e.del_yn = 0
         AND ((e.is_recurring = 0 AND e.event_date BETWEEN ? AND ?)
              OR (e.is_recurring = 1))
         ORDER BY e.start_time`,
        [scheduleId, startDate, endDate]
      );
      return result;
    } catch (error) {
      console.error('Error getting events:', error);
      throw error;
    }
  }

  async createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('Creating event:', event); // 디버깅용
      
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
      
      console.log('Event created with ID:', result.lastInsertRowId); // 디버깅용
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
    subject: Academy['subject']
  ): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('Creating/finding academy:', academyName, subject); // 디버깅용
      
      // 동일한 이름과 과목의 학원이 있는지 확인
      const existingAcademy = await db.getFirstAsync<Academy>(
        'SELECT * FROM academies WHERE name = ? AND subject = ? AND del_yn = 0',
        [academyName, subject]
      );
      
      if (existingAcademy) {
        console.log('Found existing academy:', existingAcademy.id); // 디버깅용
        return existingAcademy.id;
      }
      
      // 새 학원 생성
      const result = await db.runAsync(
        `INSERT INTO academies (name, subject, status, del_yn) VALUES (?, ?, ?, ?)`,
        [academyName, subject, '진행', 0]
      );
      
      console.log('Created new academy with ID:', result.lastInsertRowId); // 디버깅용
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating academy for recurring event:', error);
      throw error;
    }
  }

  // 개선된 이벤트 조회 (반복 일정 확장 포함)
  async getEventsWithRecurring(
    scheduleId: number, 
    startDate: string, 
    endDate: string
  ): Promise<Event[]> {
    try {
      const db = await this.ensureDbConnection();
      
      console.log('Getting events for period:', startDate, 'to', endDate); // 디버깅용
      
      // 1. 일반 일정 조회
      const regularEvents = await db.getAllAsync<Event>(
        `SELECT e.*, a.name as academy_name, a.subject as academy_subject
         FROM events e
         LEFT JOIN academies a ON e.academy_id = a.id AND a.del_yn = 0
         WHERE e.schedule_id = ? AND e.del_yn = 0 AND e.is_recurring = 0
         AND e.event_date BETWEEN ? AND ?
         ORDER BY e.start_time`,
        [scheduleId, startDate, endDate]
      );
      
      console.log('Regular events found:', regularEvents.length); // 디버깅용
      
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
      
      console.log('Recurring event patterns found:', recurringEvents.length); // 디버깅용
      
      // 3. 반복 일정을 날짜별로 확장
      const expandedRecurringEvents: Event[] = [];
      for (const recurringEvent of recurringEvents) {
        const dates = this.generateRecurringDates(recurringEvent, startDate, endDate);
        console.log(`Expanding recurring event "${recurringEvent.title}" for dates:`, dates); // 디버깅용
        
        for (const date of dates) {
          expandedRecurringEvents.push({
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
            // 추가 정보
            academy_name: recurringEvent.academy_name,
            academy_subject: recurringEvent.academy_subject,
          } as any);
        }
      }
      
      console.log('Expanded recurring events:', expandedRecurringEvents.length); // 디버깅용
      
      const allEvents = [...regularEvents, ...expandedRecurringEvents];
      console.log('Total events returned:', allEvents.length); // 디버깅용
      
      return allEvents;
    } catch (error) {
      console.error('Error getting events with recurring:', error);
      throw error;
    }
  }

  // 반복 일정의 날짜들 생성
  private generateRecurringDates(
    recurringEvent: any,
    startDate: string,
    endDate: string
  ): string[] {
    const dates: string[] = [];
    
    try {
      // moment가 import 되어 있지 않을 수 있으므로 Date 객체 사용
      const start = new Date(startDate);
      const end = new Date(endDate);
      const patternStart = new Date(recurringEvent.start_date);
      const patternEnd = recurringEvent.end_date ? new Date(recurringEvent.end_date) : null;
      
      // 시작일을 조정 (패턴 시작일 이후부터)
      let current = new Date(Math.max(start.getTime(), patternStart.getTime()));
      
      console.log('Generating dates from', current.toISOString().split('T')[0], 'to', end.toISOString().split('T')[0]); // 디버깅용
      console.log('Pattern days:', {
        sunday: recurringEvent.sunday,
        monday: recurringEvent.monday,
        tuesday: recurringEvent.tuesday,
        wednesday: recurringEvent.wednesday,
        thursday: recurringEvent.thursday,
        friday: recurringEvent.friday,
        saturday: recurringEvent.saturday
      }); // 디버깅용
      
      while (current <= end) {
        const dayOfWeek = current.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
        let shouldInclude = false;
        
        // 요일 확인
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
      
      console.log('Generated dates:', dates); // 디버깅용
      
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
      
      console.log('Deleting recurring event:', eventId); // 디버깅용
      
      // 이벤트 정보 조회
      const event = await db.getFirstAsync<Event>(
        'SELECT * FROM events WHERE id = ? AND del_yn = 0',
        [eventId]
      );
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      console.log('Found event to delete:', event); // 디버깅용
      
      if (event.is_recurring && event.recurring_group_id) {
        console.log('Deleting recurring pattern:', event.recurring_group_id); // 디버깅용
        
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
        
        console.log('Recurring event and pattern deleted'); // 디버깅용
      } else {
        // 단일 이벤트 삭제
        await db.runAsync('UPDATE events SET del_yn = 1 WHERE id = ?', [eventId]);
        console.log('Single event deleted'); // 디버깅용
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
      
      console.log('Creating recurring pattern:', pattern); // 디버깅용
      
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
      
      console.log('Recurring pattern created with ID:', result.lastInsertRowId); // 디버깅용
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
      
      // 5. 현재 주 테스트
      const now = new Date();
      const currentWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      
      const currentStartStr = currentWeekStart.toISOString().split('T')[0];
      const currentEndStr = currentWeekEnd.toISOString().split('T')[0];
      
      console.log(`🧪 Testing current week: ${currentStartStr} to ${currentEndStr}`);
      
      const currentWeekEvents = await this.getEventsWithRecurring(
        scheduleId,
        currentStartStr,
        currentEndStr
      );
      console.log('🧪 Current week events:', currentWeekEvents);
      
    } catch (error) {
      console.error('🧪 Test retrieval error:', error);
    }
  }

  // 반복 패턴 조회 메서드 추가
  async getRecurringPattern(id: number): Promise<RecurringPattern | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<RecurringPattern>(
        'SELECT * FROM recurring_patterns WHERE id = ? AND del_yn = 0',
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Error getting recurring pattern:', error);
      throw error;
    }
  }

  // 학원 ID로 학원 정보 조회 메서드 추가
  async getAcademyById(id: number): Promise<Academy | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<Academy>(
        'SELECT * FROM academies WHERE id = ? AND del_yn = 0',
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Error getting academy by id:', error);
      throw error;
    }
  }

  // 특정 일정의 상세 정보 조회 (학원 정보 포함)
  async getEventDetails(id: number): Promise<(Event & { academy_name?: string; academy_subject?: string }) | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<Event & { academy_name?: string; academy_subject?: string }>(
        `SELECT e.*, a.name as academy_name, a.subject as academy_subject
        FROM events e
        LEFT JOIN academies a ON e.academy_id = a.id AND a.del_yn = 0
        WHERE e.id = ? AND e.del_yn = 0`,
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Error getting event details:', error);
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

  // 특정 연도의 공휴일 조회
  async getHolidaysByYear(year: number): Promise<Holiday[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<Holiday>(
        'SELECT * FROM holidays WHERE year = ? AND del_yn = 0 ORDER BY date',
        [year]
      );
      return result;
    } catch (error) {
      console.error('Error getting holidays by year:', error);
      throw error;
    }
  }

  // 특정 날짜의 공휴일 조회
  async getHolidayByDate(date: string): Promise<Holiday | null> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getFirstAsync<Holiday>(
        'SELECT * FROM holidays WHERE date = ? AND del_yn = 0',
        [date]
      );
      return result || null;
    } catch (error) {
      console.error('Error getting holiday by date:', error);
      throw error;
    }
  }

  // 특정 기간의 공휴일 조회
  async getHolidaysInRange(startDate: string, endDate: string): Promise<Holiday[]> {
    try {
      const db = await this.ensureDbConnection();
      const result = await db.getAllAsync<Holiday>(
        'SELECT * FROM holidays WHERE date BETWEEN ? AND ? AND del_yn = 0 ORDER BY date',
        [startDate, endDate]
      );
      return result;
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
      const currentYearHolidays = await db.getAllAsync<Holiday>(
        'SELECT * FROM holidays WHERE year = ? AND del_yn = 0 ORDER BY date',
        [currentYear]
      );
      
      console.log(`🧪 ${currentYear} Holiday Details:`);
      currentYearHolidays.forEach(holiday => {
        console.log(`   📅 ${holiday.date}: ${holiday.name} (Holiday: ${holiday.is_holiday})`);
      });
      
      // 4. 다음 연도 공휴일 (있는 경우)
      const nextYear = currentYear + 1;
      const nextYearHolidays = await db.getAllAsync<Holiday>(
        'SELECT * FROM holidays WHERE year = ? AND del_yn = 0 ORDER BY date',
        [nextYear]
      );
      
      if (nextYearHolidays.length > 0) {
        console.log(`🧪 ${nextYear} Holiday Details:`);
        nextYearHolidays.forEach(holiday => {
          console.log(`   📅 ${holiday.date}: ${holiday.name} (Holiday: ${holiday.is_holiday})`);
        });
      } else {
        console.log(`🧪 ${nextYear}: No holidays found`);
      }
      
      // 5. 테이블 스키마 정보
      const tableInfo = await db.getAllAsync(
        "PRAGMA table_info(holidays)"
      );
      console.log('🧪 Holidays table schema:');
      tableInfo.forEach((column: any) => {
        console.log(`   ${column.name}: ${column.type} (nullable: ${!column.notnull})`);
      });
      
      // 6. 최근 생성/수정된 공휴일
      const recentHolidays = await db.getAllAsync<Holiday>(
        'SELECT * FROM holidays WHERE del_yn = 0 ORDER BY created_at DESC LIMIT 5'
      );
      console.log('🧪 Recently added holidays:');
      recentHolidays.forEach(holiday => {
        console.log(`   📅 ${holiday.date}: ${holiday.name} (created: ${holiday.created_at})`);
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
      
      const holidays = await db.getAllAsync<Holiday>(
        'SELECT * FROM holidays WHERE date BETWEEN ? AND ? AND del_yn = 0 ORDER BY date',
        [startDate, endDate]
      );
      
      console.log(`🧪 Found ${holidays.length} holidays in range:`);
      holidays.forEach(holiday => {
        console.log(`   📅 ${holiday.date}: ${holiday.name} (Holiday: ${holiday.is_holiday})`);
      });
      
      if (holidays.length === 0) {
        console.log('🧪 ⚠️ No holidays found in this date range');
        
        // 가장 가까운 공휴일 찾기
        const nearestBefore = await db.getFirstAsync<Holiday>(
          'SELECT * FROM holidays WHERE date < ? AND del_yn = 0 ORDER BY date DESC LIMIT 1',
          [startDate]
        );
        
        const nearestAfter = await db.getFirstAsync<Holiday>(
          'SELECT * FROM holidays WHERE date > ? AND del_yn = 0 ORDER BY date ASC LIMIT 1',
          [endDate]
        );
        
        if (nearestBefore) {
          console.log(`🧪 Nearest holiday before: ${nearestBefore.date} (${nearestBefore.name})`);
        }
        
        if (nearestAfter) {
          console.log(`🧪 Nearest holiday after: ${nearestAfter.date} (${nearestAfter.name})`);
        }
      }
      
      console.log('🧪 === End Range Debug ===');
      
    } catch (error) {
      console.error('🧪 Error in range holiday debug:', error);
    }
  }
}

export default new DatabaseService();