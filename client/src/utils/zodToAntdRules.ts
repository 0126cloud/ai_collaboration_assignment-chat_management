import type { ZodObject, ZodRawShape } from 'zod';
import type { Rule } from 'antd/es/form';

interface IZodStringLike {
  minLength?: number | null;
  maxLength?: number | null;
  format?: string | null;
  isOptional: () => boolean;
}

export function zodToAntdRules<T extends ZodRawShape>(
  schema: ZodObject<T>,
): Record<keyof T, Rule[]> {
  const shape = schema.shape;
  const result = {} as Record<keyof T, Rule[]>;

  for (const key in shape) {
    const rules: Rule[] = [];
    const field = shape[key] as unknown as IZodStringLike;

    if (field.minLength != null && field.minLength === 1) {
      rules.push({ required: true, message: `請輸入${key}` });
    } else if (field.minLength != null && field.minLength > 1) {
      rules.push({ min: field.minLength, message: `至少 ${field.minLength} 個字元` });
    }

    if (field.maxLength != null) {
      rules.push({ max: field.maxLength, message: `最多 ${field.maxLength} 個字元` });
    }

    if (field.format === 'email') {
      rules.push({ type: 'email', message: '請輸入有效的 Email' });
    }

    // 如果沒有抓到任何 required rule，但 field 不是 optional，加入 required
    if (!field.isOptional() && !rules.some((r) => (r as { required?: boolean }).required)) {
      rules.push({ required: true, message: `請輸入${key}` });
    }

    result[key] = rules;
  }

  return result;
}
