import { createHash } from "crypto";
import path from "path";
import { STORAGE_CONFIG } from "@/config/storage";

/**
 * Generate file ID from file buffer using SHA-256
 */
export function generateFileId(fileBuffer: Buffer): string {
    return createHash("sha256").update(fileBuffer).digest("hex");
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

