import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { generateFilePath, getFileDirectory } from '@/lib/file-utils';

/**
 * Save file to storage
 */
export async function saveFile(fileId: string, fileBuffer: Buffer): Promise<string> {
  const filePath = generateFilePath(fileId);
  const dirPath = getFileDirectory(fileId);

  // Create directory if it doesn't exist
  await fs.mkdir(dirPath, { recursive: true });

  // Write file
  await fs.writeFile(filePath, fileBuffer);

  return filePath;
}

/**
 * Read file from storage
 */
export async function readFile(fileId: string): Promise<Buffer> {
  const filePath = generateFilePath(fileId);
  return fs.readFile(filePath);
}

/**
 * Check if file exists
 */
export async function fileExists(fileId: string): Promise<boolean> {
  const filePath = generateFilePath(fileId);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete file from storage
 */
export async function deleteFile(fileId: string): Promise<void> {
  const filePath = generateFilePath(fileId);
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // File doesn't exist, ignore
  }
}

/**
 * Get file stream for download
 */
export async function getFileStream(fileId: string): Promise<Readable> {
  const filePath = generateFilePath(fileId);
  const fileHandle = await fs.open(filePath, 'r');
  const stream = fileHandle.createReadStream();
  
  // Close file handle when stream ends
  stream.on('end', () => {
    fileHandle.close().catch(console.error);
  });
  
  stream.on('error', () => {
    fileHandle.close().catch(console.error);
  });

  return stream;
}

/**
 * Get file stats (size, etc.)
 */
export async function getFileStats(fileId: string): Promise<{ size: number; mtime: Date }> {
  const filePath = generateFilePath(fileId);
  const stats = await fs.stat(filePath);
  return {
    size: stats.size,
    mtime: stats.mtime,
  };
}

