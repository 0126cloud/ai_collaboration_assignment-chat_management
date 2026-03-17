import type { ZodObject, ZodRawShape, ZodString, ZodTypeAny } from 'zod';
import type { Rule } from 'antd/es/form';

export function zodToAntdRules<T extends ZodRawShape>(
  schema: ZodObject<T>,
): Record<keyof T, Rule[]> {
  const shape = schema.shape;
  const result = {} as Record<keyof T, Rule[]>;

  for (const key in shape) {
    const rules: Rule[] = [];
    const field = shape[key] as ZodTypeAny;
    const checks = (field as ZodString)._def?.checks;

    // 檢查是否為必填（有 min(1) check 通常代表 required）
    if (checks) {
      for (const check of checks) {
        if (check.kind === 'min' && check.value === 1) {
          rules.push({ required: true, message: check.message || `請輸入${key}` });
        } else if (check.kind === 'min' && check.value > 1) {
          rules.push({ min: check.value, message: check.message || `至少 ${check.value} 個字元` });
        } else if (check.kind === 'max') {
          rules.push({ max: check.value, message: check.message || `最多 ${check.value} 個字元` });
        } else if (check.kind === 'email') {
          rules.push({ type: 'email', message: check.message || '請輸入有效的 Email' });
        }
      }
    }

    // 如果沒有抓到任何 required rule，但 field 不是 optional，加入 required
    if (!field.isOptional() && !rules.some((r) => r.required)) {
      rules.push({ required: true, message: `請輸入${key}` });
    }

    result[key] = rules;
  }

  return result;
}
