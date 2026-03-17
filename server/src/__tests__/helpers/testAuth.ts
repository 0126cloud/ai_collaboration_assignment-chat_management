import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export function generateToken(payload: { id: number; username: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '4h' });
}

export const seniorToken = generateToken({
  id: 1,
  username: 'admin01',
  role: 'senior_manager',
});

export const generalToken = generateToken({
  id: 2,
  username: 'admin02',
  role: 'general_manager',
});

export const expiredToken = jwt.sign(
  { id: 1, username: 'admin01', role: 'senior_manager' },
  JWT_SECRET,
  { expiresIn: '0s' },
);
