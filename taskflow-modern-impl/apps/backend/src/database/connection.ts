import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';
import path from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/taskflow.db';
const MIGRATIONS_PATH = process.env.MIGRATIONS_PATH || './src/database/migrations';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private sqlite: Database.Database;
  private drizzleDb: ReturnType<typeof drizzle>;

  private constructor() {
    // Ensure data directory exists
    const dataDir = path.dirname(DATABASE_PATH);
    if (!require('fs').existsSync(dataDir)) {
      require('fs').mkdirSync(dataDir, { recursive: true });
    }

    // Initialize SQLite connection
    this.sqlite = new Database(DATABASE_PATH);
    
    // Enable WAL mode for better performance
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('synchronous = NORMAL');
    this.sqlite.pragma('cache_size = 1000000');
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('temp_store = MEMORY');

    // Initialize Drizzle ORM
    this.drizzleDb = drizzle(this.sqlite, { schema });

    logger.info('Database connection initialized', {
      path: DATABASE_PATH,
      mode: 'WAL',
      foreign_keys: true
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public getDb() {
    return this.drizzleDb;
  }

  public getSqlite() {
    return this.sqlite;
  }

  public async runMigrations() {
    try {
      logger.info('Running database migrations...');
      await migrate(this.drizzleDb, { migrationsFolder: MIGRATIONS_PATH });
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Failed to run database migrations', { error });
      throw error;
    }
  }

  public async healthCheck(): Promise<{ status: string; info: any }> {
    try {
      // Test basic query
      const result = this.sqlite.prepare('SELECT 1 as test').get();
      
      // Get database stats
      const stats = {
        size: this.sqlite.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get(),
        tables: this.sqlite.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get(),
        indexes: this.sqlite.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get(),
        wal_mode: this.sqlite.pragma('journal_mode', { simple: true }),
        foreign_keys: this.sqlite.pragma('foreign_keys', { simple: true }),
      };

      return {
        status: 'healthy',
        info: stats
      };
    } catch (error) {
      logger.error('Database health check failed', { error });
      return {
        status: 'unhealthy',
        info: { error: error.message }
      };
    }
  }

  public backup(backupPath: string) {
    try {
      logger.info('Creating database backup', { backupPath });
      this.sqlite.backup(backupPath);
      logger.info('Database backup completed successfully');
    } catch (error) {
      logger.error('Database backup failed', { error, backupPath });
      throw error;
    }
  }

  public close() {
    if (this.sqlite) {
      this.sqlite.close();
      logger.info('Database connection closed');
    }
  }

  // Transaction helpers
  public transaction<T>(callback: (db: typeof this.drizzleDb) => T): T {
    return this.sqlite.transaction(() => callback(this.drizzleDb))();
  }

  public async asyncTransaction<T>(callback: (db: typeof this.drizzleDb) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const txn = this.sqlite.transaction(async () => {
        try {
          const result = await callback(this.drizzleDb);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      try {
        txn();
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Export singleton instance
const dbConnection = DatabaseConnection.getInstance();
export const db = dbConnection.getDb();
export const sqlite = dbConnection.getSqlite();
export default dbConnection;