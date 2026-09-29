const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes I, O
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'; // Excludes l
const NUMBERS = '23456789'; // Excludes 0, 1
const SYMBOLS = '!@#$%^&*()_+-=';

const ALL_CHARS = UPPERCASE + LOWERCASE + NUMBERS + SYMBOLS;

const getRandomInt = (max) => {
  const randomBuffer = new Uint32Array(1);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomBuffer);
  } else {
    randomBuffer[0] = Math.floor(Math.random() * 4294967296);
  }
  return randomBuffer[0] % max;
};

export const generateSecurePassword = (length = 15) => {
  const targetLength = Math.max(14, Math.min(16, length));

  // Guarantee at least 1 character from each set
  const requiredChars = [
    UPPERCASE[getRandomInt(UPPERCASE.length)],
    LOWERCASE[getRandomInt(LOWERCASE.length)],
    NUMBERS[getRandomInt(NUMBERS.length)],
    SYMBOLS[getRandomInt(SYMBOLS.length)]
  ];

  // Fill remaining characters
  const remainingCount = targetLength - requiredChars.length;
  const passwordArray = [...requiredChars];

  for (let i = 0; i < remainingCount; i += 1) {
    passwordArray.push(ALL_CHARS[getRandomInt(ALL_CHARS.length)]);
  }

  // Shuffle array using Fisher-Yates shuffle
  for (let i = passwordArray.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
};
