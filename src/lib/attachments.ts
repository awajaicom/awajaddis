import { ATTACHMENTS_BUCKET, storage } from "./appwrite";

/** Keep well under Resend's 40 MB total-message cap (base64 adds ~33%). */
export const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export interface UploadedFileRef {
  id: string;
  name: string;
}

export class AttachmentTooLargeError extends Error {}

/** Narrows an arbitrary request-body value to a validated file-ref array. */
export function parseUploadedFiles(input: unknown): UploadedFileRef[] {
  return Array.isArray(input)
    ? input.filter(
        (f): f is UploadedFileRef => typeof f?.id === "string" && typeof f?.name === "string"
      )
    : [];
}

/**
 * Downloads previously-uploaded files from Appwrite Storage and base64-encodes
 * them for Resend. Throws AttachmentTooLargeError if the combined size is over
 * the cap — callers should map that to a 413 response.
 */
export async function fetchAttachments(
  files: UploadedFileRef[]
): Promise<{ filename: string; content: string }[]> {
  if (files.length === 0) return [];
  const bucket = ATTACHMENTS_BUCKET();

  let total = 0;
  for (const f of files) {
    const meta = await storage().getFile(bucket, f.id);
    total += meta.sizeOriginal;
  }
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new AttachmentTooLargeError(
      `Attachments too large (${(total / 1024 / 1024).toFixed(1)} MB). Max 15 MB total.`
    );
  }

  return Promise.all(
    files.map(async (f) => ({
      filename: f.name,
      content: Buffer.from(await storage().getFileDownload(bucket, f.id)).toString("base64"),
    }))
  );
}

/** Always call after a send attempt (success or failure) to clear the upload dropbox. */
export async function cleanupAttachmentFiles(files: UploadedFileRef[]): Promise<void> {
  if (files.length === 0) return;
  const bucket = ATTACHMENTS_BUCKET();
  await Promise.allSettled(files.map((f) => storage().deleteFile(bucket, f.id)));
}
