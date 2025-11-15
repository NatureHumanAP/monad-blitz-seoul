import { STORAGE_CONFIG } from '@/config/storage';
import { createHash } from 'crypto';
import path from 'path';

/**
 * Generate file ID from file buffer using SHA-256
 */
export function generateFileId(fileBuffer: Buffer): string {
    return createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Generate file path based on file ID (hierarchical structure)
 * Format: storage/files/{first2chars}/{fileId}
 */
export function generateFilePath(fileId: string): string {
    const firstTwoChars = fileId.substring(0, 2);
    return path.join(STORAGE_CONFIG.filesDir, firstTwoChars, fileId);
}

/**
 * Get directory path for a file ID
 */
export function getFileDirectory(fileId: string): string {
    const firstTwoChars = fileId.substring(0, 2);
    return path.join(STORAGE_CONFIG.filesDir, firstTwoChars);
}

/**
 * Validate file type based on MIME type
 */
export function isValidFileType(mimeType: string): boolean {
    return STORAGE_CONFIG.allowedMimeTypes.includes(mimeType);
}

/**
 * Validate file size
 */
export function isValidFileSize(fileSize: number): boolean {
    return fileSize > 0 && fileSize <= STORAGE_CONFIG.maxFileSize;
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromFileName(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.xml': 'application/xml',
    };

    return mimeTypes[ext] || 'application/octet-stream';
}

