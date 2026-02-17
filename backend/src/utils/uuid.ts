import { randomUUID } from 'crypto';

export const generateUUID = (): string => {
  return randomUUID();
};
