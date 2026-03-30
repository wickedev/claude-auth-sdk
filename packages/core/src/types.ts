export type LoginMode = 'claudeai' | 'console';

export interface LoginResult {
  readonly mode: LoginMode;
  readonly loggedIn: true;
}
