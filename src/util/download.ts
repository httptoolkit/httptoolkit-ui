/**
 * Download utility — triggers a browser file download from a Blob.
 *
 * The object URL is revoked after a generous 10-second delay to ensure
 * the browser has started the download even for very large files.
 * This prevents premature revocation that could abort downloads on
 * slower machines or when the browser needs extra time to begin writing.
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    try {
        anchor.click();
    } finally {
        document.body.removeChild(anchor);
        // 10 seconds is generous enough even for very large ZIPs (>500MB)
        // where the browser may need extra time to begin the write.
        // Once the browser has begun writing to disk, revoking only frees
        // the in-memory blob reference — it does not abort the download.
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
}
