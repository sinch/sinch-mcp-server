import { z } from 'zod';

export const sinchApiUrlSchema = z
  .string()
  .regex(/^https?:\/\/[^/\s]+$/, 'must be a scheme and host only, without a path');
