/**
 * @file db.ts
 * @description Provides persistent client-side storage for engagement records and profile stats using Dexie IndexedDB with CSV export.
 * @architecture Serves as the persistence and analytics storage layer queried by history views and written to by WorkflowEngine.
 * @agent_note Ensure schema migrations maintain backward compatibility and IndexedDB missing API errors are trapped in non-browser test environments.
 */
import Dexie, { type Table } from "dexie";
import Papa from "papaparse";

export interface EngagementRecord {
  id?: number;
  shortcode: string;
  mediaId?: string | null;
  postPath: string;
  postUrl: string;
  targetUsername: string;
  timestampIso: string;
  timeFormatted: string;
  likeActionRequired: boolean;
  likeStatus: string;
  likeAttempts: number;
  commentActionRequired: boolean;
  commentStatus: string;
  commentText: string;
  commentAttempts: number;
  errorsCount: number;
  errorDetails: string[];
}

export interface ProfileRecord {
  username: string;
  lastEngagedIso: string;
  totalEngagements: number;
}

/**
 * IndexedDB storage manager using Dexie.js for post logs and profile engagement metrics.
 */
export class AppDatabase extends Dexie {
  records!: Table<EngagementRecord, number>;
  profiles!: Table<ProfileRecord, string>;

  /**
   * Initializes database schema and indexes for records and profiles.
   * @param dbName - Name of the IndexedDB database.
   */
  constructor(dbName = "IGEngagementAutomatorDB") {
    super(dbName);
    this.version(1).stores({
      records: "++id, shortcode, targetUsername, likeStatus, commentStatus, timestampIso",
      profiles: "username, lastEngagedIso, totalEngagements",
    });
  }

  /**
   * Saves or updates an engagement record and increments target profile metrics.
   * @param record - Raw or partially formed engagement record.
   * @returns Sanitized persisted record object.
   */
  async saveEngagementRecord(record: Partial<EngagementRecord>): Promise<EngagementRecord> {
    const clean = sanitizeRecordForDB(record);
    try {
      await this.records.put(clean);

      if (clean.targetUsername) {
        const existing = await this.profiles.get(clean.targetUsername);
        const total = (existing?.totalEngagements || 0) + 1;
        await this.profiles.put({
          username: clean.targetUsername,
          lastEngagedIso: clean.timestampIso,
          totalEngagements: total,
        });
      }
    } catch (err) {
      console.warn("[IG DB Save Error]", err);
    }
    return clean;
  }

  /**
   * Fetches recent records ordered by timestamp descending.
   * @param limit - Maximum number of records to retrieve.
   * @returns List of engagement records.
   */
  async getRecentRecords(limit = 2000): Promise<EngagementRecord[]> {
    try {
      return await this.records.orderBy("timestampIso").reverse().limit(limit).toArray();
    } catch (_) {
      return [];
    }
  }

  /**
   * Clears all local records and profile stats.
   */
  async clearAll(): Promise<void> {
    try {
      await this.records.clear();
      await this.profiles.clear();
    } catch (_) {}
  }
}

/**
 * Standardizes raw record fields for database persistence and querying.
 * @param raw - Raw engagement record object.
 * @returns Standardized database record with guaranteed schema fields.
 */
export function sanitizeRecordForDB(raw: Partial<EngagementRecord> = {}): EngagementRecord {
  const now = new Date();
  return {
    id: raw.id || undefined,
    shortcode: String(raw.shortcode || "").trim(),
    mediaId: raw.mediaId ? String(raw.mediaId) : null,
    postPath: raw.postPath || (raw.shortcode ? `/p/${raw.shortcode}/` : ""),
    postUrl: raw.postUrl || "",
    targetUsername: String(raw.targetUsername || "").trim().toLowerCase().replace(/^@/, ""),
    timestampIso: raw.timestampIso || now.toISOString(),
    timeFormatted: raw.timeFormatted || now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    likeActionRequired: Boolean(raw.likeActionRequired),
    likeStatus: raw.likeStatus || "Pending",
    likeAttempts: Number(raw.likeAttempts) || 0,
    commentActionRequired: Boolean(raw.commentActionRequired),
    commentStatus: raw.commentStatus || "Pending",
    commentText: String(raw.commentText || ""),
    commentAttempts: Number(raw.commentAttempts) || 0,
    errorsCount: Number(raw.errorsCount) || 0,
    errorDetails: Array.isArray(raw.errorDetails) ? raw.errorDetails : [],
  };
}

/**
 * Serializes records into a clean, RFC-4180 compliant CSV string using Papaparse.
 * Safely escapes commas, emojis, double quotes, and multi-line comment text.
 *
 * @param records - Array of post engagement records
 * @returns Clean CSV string
 */
export function exportToCSV(records: EngagementRecord[] = []): string {
  if (!Array.isArray(records) || records.length === 0) {
    return "Shortcode,Post Path,Post URL,Target Profile,Timestamp,Like Status,Like Attempts,Comment Status,Comment Attempts,Comment Text,Errors Count\n";
  }

  const rows = records.map((r, i) => ({
    Index: i + 1,
    Shortcode: r.shortcode || "",
    "Post Path": r.postPath || "",
    "Post URL": r.postUrl || "",
    "Target Profile": r.targetUsername || "",
    Timestamp: r.timeFormatted || r.timestampIso || "",
    "Like Status": r.likeStatus || "",
    "Like Attempts": r.likeAttempts ?? 0,
    "Comment Status": r.commentStatus || "",
    "Comment Attempts": r.commentAttempts ?? 0,
    "Comment Text": r.commentText || "",
    "Errors Count": r.errorsCount ?? 0,
    "Error Details": Array.isArray(r.errorDetails) ? r.errorDetails.join(" | ") : "",
  }));

  return Papa.unparse(rows, {
    quotes: false, // Only quote fields when necessary (containing quotes, commas, newlines)
    header: true,
    newline: "\r\n",
  });
}

/**
 * Shared singleton instance of AppDatabase.
 */
export const db: AppDatabase = new AppDatabase();
