export enum FEATURES {
  REMOVE_USER = 'REMOVE_USER_FROM_ROOM',
  BAN_USER = 'BAN_USER_FROM_ROOM',
  // Add more features here in the future
}

export const DEFAULT_FEATURES = [FEATURES.REMOVE_USER];
