"use client";

export interface UploadedFileRef {
  id: string;
  name: string;
}

const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function attachmentsTooBig(files: File[]): boolean {
  return files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES;
}

/**
 * Uploads straight from the browser to Appwrite Storage — bypasses Vercel's
 * 4.5 MB request-body cap. The bucket is write-only for anonymous users; the
 * server reads each file by ID and deletes it right after sending.
 */
export async function uploadToAppwrite(file: File): Promise<UploadedFileRef> {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const bucket = process.env.NEXT_PUBLIC_APPWRITE_ATTACHMENTS_BUCKET_ID ?? "attachments";
  if (!endpoint || !project) {
    throw new Error("NEXT_PUBLIC_APPWRITE_ENDPOINT and NEXT_PUBLIC_APPWRITE_PROJECT_ID must be set");
  }
  const form = new FormData();
  form.set("fileId", "unique()");
  form.set("file", file);
  const res = await fetch(`${endpoint}/storage/buckets/${bucket}/files`, {
    method: "POST",
    headers: { "X-Appwrite-Project": project },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? `Upload failed for ${file.name}`);
  return { id: data.$id, name: file.name };
}

/**
 * File picker + selected-file list with a running size total. Purely a
 * controlled input over `File[]` — the caller uploads on submit via
 * `uploadToAppwrite`. Pass a changing `key` from the parent to reset the
 * native file input after a successful send.
 */
export function AttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const tooBig = totalSize > MAX_TOTAL_BYTES;

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-smoke">Attachments (max 15 MB total)</label>
      <input
        type="file"
        multiple
        disabled={disabled}
        onChange={(e) => onChange(Array.from(e.target.files ?? []))}
        className="block w-full text-sm text-smoke file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-amber hover:file:bg-gold/25"
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-smoke">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">{f.name}</span>
              <span className="shrink-0">{fmtSize(f.size)}</span>
            </li>
          ))}
          <li className={`pt-1 font-medium ${tooBig ? "text-red-600" : ""}`}>
            Total: {fmtSize(totalSize)} {tooBig && "— over the 15 MB limit"}
          </li>
        </ul>
      )}
    </div>
  );
}
