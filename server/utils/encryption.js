import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Encrypt a message using session encryption key
 */
export const encryptMessage = (message, encryptionKey) => {
  try {
    if (!encryptionKey) {
      return message; // Return unencrypted if no key provided
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive key from encryption key and salt
    const key = crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, 'sha256');
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(message), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine salt, iv, tag, and encrypted data
    return {
      encrypted: salt.toString('hex') + ':' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted,
      encrypted: true
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return message; // Return unencrypted on error
  }
};

/**
 * Decrypt a message using session encryption key
 */
export const decryptMessage = (encryptedData, encryptionKey) => {
  try {
    if (!encryptionKey || !encryptedData.encrypted) {
      return encryptedData; // Return as-is if not encrypted
    }

    const parts = encryptedData.encrypted.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    
    // Derive key from encryption key and salt
    const key = crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedData; // Return as-is on error
  }
};

