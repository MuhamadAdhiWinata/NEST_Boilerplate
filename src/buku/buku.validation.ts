import { z, ZodType } from 'zod';

export class BukuValidation {
  static readonly CREATE: ZodType = z.object({
    name: z.string(),
    price: z.number(),
    stock: z.number(),
    penulis: z.string(),
  });

  static readonly UPDATE: ZodType = z.object({
    name: z.string().optional(),
    price: z.number().optional(),
    stock: z.number().optional(),
    penulis: z.string().optional(),
  });
  
  static readonly LIST: ZodType = z.object({
    limit: z.coerce.number().int().positive().default(10).optional(),
    offset: z.coerce.number().int().nonnegative().default(0).optional(),
  });
}
