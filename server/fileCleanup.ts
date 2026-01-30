import fs from "fs";
import path from "path";

// File cleanup configuration
const FILE_RETENTION_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

interface TrackedFile {
    path: string;
    createdAt: number;
    downloadedAt?: number;
    deleteAfterDownload: boolean;
}

// Track files for cleanup
const trackedFiles = new Map<string, TrackedFile>();

/**
 * Track a file for automatic cleanup
 */
export function trackFile(
    jobId: string,
    filePath: string,
    deleteAfterDownload: boolean = true
): void {
    trackedFiles.set(jobId, {
        path: filePath,
        createdAt: Date.now(),
        deleteAfterDownload,
    });
    console.log(`[FileCleanup] Tracking file for cleanup: ${jobId}`);
}

/**
 * Mark a file as downloaded (will be deleted soon after)
 */
export function markAsDownloaded(jobId: string): void {
    const file = trackedFiles.get(jobId);
    if (file) {
        file.downloadedAt = Date.now();
        trackedFiles.set(jobId, file);
        console.log(`[FileCleanup] File marked as downloaded: ${jobId}`);

        // Schedule immediate cleanup after download (5 minutes delay)
        if (file.deleteAfterDownload) {
            setTimeout(() => {
                deleteTrackedFile(jobId);
            }, 5 * 60 * 1000); // 5 minutes after download
        }
    }
}

/**
 * Delete a tracked file
 */
export function deleteTrackedFile(jobId: string): boolean {
    const file = trackedFiles.get(jobId);
    if (!file) return false;

    try {
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`[FileCleanup] Deleted file: ${file.path}`);
        }
        trackedFiles.delete(jobId);
        return true;
    } catch (error) {
        console.error(`[FileCleanup] Failed to delete file: ${file.path}`, error);
        return false;
    }
}

/**
 * Cleanup old files that haven't been downloaded
 */
function cleanupOldFiles(): void {
    const now = Date.now();
    let cleanedCount = 0;

    trackedFiles.forEach((file, jobId) => {
        const age = now - file.createdAt;

        // Delete if file is older than retention period
        if (age > FILE_RETENTION_MS) {
            if (deleteTrackedFile(jobId)) {
                cleanedCount++;
            }
        }
    });

    if (cleanedCount > 0) {
        console.log(`[FileCleanup] Cleaned up ${cleanedCount} old files`);
    }
}

/**
 * Cleanup entire directory of old files
 */
export function cleanupDirectory(dirPath: string, maxAgeMs: number = FILE_RETENTION_MS): void {
    if (!fs.existsSync(dirPath)) return;

    try {
        const files = fs.readdirSync(dirPath);
        const now = Date.now();
        let cleanedCount = 0;

        files.forEach((file) => {
            const filePath = path.join(dirPath, file);
            try {
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                if (age > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                }
            } catch (e) {
                // Ignore errors for individual files
            }
        });

        if (cleanedCount > 0) {
            console.log(`[FileCleanup] Cleaned ${cleanedCount} old files from ${dirPath}`);
        }
    } catch (error) {
        console.error(`[FileCleanup] Error cleaning directory ${dirPath}:`, error);
    }
}

/**
 * Start the automatic cleanup scheduler
 */
export function startCleanupScheduler(): void {
    console.log(`[FileCleanup] Starting cleanup scheduler (interval: ${CLEANUP_INTERVAL_MS / 1000}s, retention: ${FILE_RETENTION_MS / 1000}s)`);

    // Run initial cleanup
    cleanupOldFiles();

    // Schedule periodic cleanup
    setInterval(() => {
        cleanupOldFiles();

        // Also cleanup upload and output directories
        cleanupDirectory(path.join(process.cwd(), "uploads"), FILE_RETENTION_MS);
        cleanupDirectory(path.join(process.cwd(), "output"), FILE_RETENTION_MS);
        cleanupDirectory(path.join(process.cwd(), "uploads", "images"), FILE_RETENTION_MS);
        cleanupDirectory(path.join(process.cwd(), "uploads", "pdfs"), FILE_RETENTION_MS);
        cleanupDirectory(path.join(process.cwd(), "downloads"), FILE_RETENTION_MS);
    }, CLEANUP_INTERVAL_MS);
}

/**
 * Get cleanup stats
 */
export function getCleanupStats(): { trackedFiles: number; } {
    return {
        trackedFiles: trackedFiles.size,
    };
}
