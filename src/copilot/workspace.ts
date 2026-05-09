/**
 * 記憶每位 Slack 使用者所設定的 workingDirectory（記憶體儲存，重啟後清除）
 */
export class WorkspaceStore {
  private readonly store = new Map<string, string>();
  private readonly defaultDir?: string;

  constructor(defaultDir?: string) {
    this.defaultDir = defaultDir;
  }

  /** 儲存使用者的工作目錄 */
  set(userId: string, dir: string): void {
    this.store.set(userId, dir);
  }

  /** 取得使用者的工作目錄；若未設定則回傳全域預設值 */
  get(userId: string): string | undefined {
    return this.store.get(userId) ?? this.defaultDir;
  }

  /** 清除使用者的工作目錄設定（回歸預設值） */
  clear(userId: string): void {
    this.store.delete(userId);
  }
}
