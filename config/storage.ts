import path from 'path';

export const STORAGE_CONFIG = {
  // Base storage directory
  baseDir: path.join(process.cwd(), 'storage'),
  
  // File storage directory
  filesDir: path.join(process.cwd(), 'storage', 'files'),
  
  // Metadata directory
  metadataDir: path.join(process.cwd(), 'storage', 'metadata'),
  
  // Temporary files directory
  tempDir: path.join(process.cwd(), 'storage', 'temp'),
  
  // File size limits (in bytes)
  maxFileSize: 100 * 1024 * 1024, // 100MB
  
  // Allowed file types (MIME types)
  allowedMimeTypes: [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
  ],
  
  // Free storage period (days)
  freeStorageDays: 30,
} as const;

