/**
 * Zod 스키마 검증
 * 
 * TODO: 프로젝트에 Zod 추가
 * npm install zod
 * 
 * 사용 예시:
 * import { z } from 'zod';
 * 
 * const LoginSchema = z.object({
 *   email: z.string().email('유효한 이메일을 입력하세요'),
 *   password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다')
 * });
 * 
 * // API에서 사용:
 * const result = LoginSchema.safeParse(await c.req.json());
 * if (!result.success) {
 *   return c.json({ error: result.error.format() }, 400);
 * }
 */

// 주요 스키마 정의 (Zod 설치 후 활성화)

/*
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d)/),
  name: z.string().min(2),
  phone: z.string().regex(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/)
});

export const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  category: z.string().optional()
});

export const OrderSchema = z.object({
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
    price: z.number().int().positive()
  })),
  shipping_address_id: z.number().int().positive(),
  total_amount: z.number().int().positive()
});
*/

export const placeholder = true; // 파일이 비어있지 않도록
