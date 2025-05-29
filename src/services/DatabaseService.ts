import * as SQLite from 'expo-sqlite';

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

      // 인덱스 생성
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_events_schedule_date 
        ON events(schedule_id, event_date) WHERE del_yn = FALSE;
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_events_academy 
        ON events(academy_id) WHERE del_yn = FALSE;
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
      await db.runAsync(
        `UPDATE schedules SET 
         name = ?, start_time = ?, end_time = ?, show_weekend = ?, 
         time_unit = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          schedule.name, 
          schedule.start_time, 
          schedule.end_time, 
          schedule.show_weekend ? 1 : 0,
          schedule.time_unit || '1hour',
          schedule.id
        ]
      );
    } catch (error) {
      console.error('Error updating schedule:', error);
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

  // 반복 패턴 관리
  async createRecurringPattern(pattern: Omit<RecurringPattern, 'id' | 'created_at'>): Promise<number> {
    try {
      const db = await this.ensureDbConnection();
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
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating recurring pattern:', error);
      throw error;
    }
  }
}

export default new DatabaseService();