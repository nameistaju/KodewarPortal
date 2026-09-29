import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (candidatePassword, hashedPassword) =>
  bcrypt.compare(candidatePassword, hashedPassword);

export const isStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/.test(password);

export const generateTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const random = Array.from(crypto.randomBytes(12), (byte) => alphabet[byte % alphabet.length]).join('');
  return `${random}Aa1!`;
};
