import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

const PRESIGNED_URL_TTL_SECONDS = 5 * 60;

// Used to presign URLs handed to the browser, which must be able to reach the endpoint directly.
const s3 = new S3Client({
  endpoint: env.s3Endpoint,
  region: env.s3Region,
  forcePathStyle: env.s3ForcePathStyle,
  credentials: {
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey,
  },
});

// Used for server-to-storage calls (e.g. delete), which may need a different
// network path than the browser-reachable endpoint above (e.g. a Docker service name).
const s3Internal = new S3Client({
  endpoint: env.s3InternalEndpoint,
  region: env.s3Region,
  forcePathStyle: env.s3ForcePathStyle,
  credentials: {
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey,
  },
});

export function buildAttachmentKey(ticketId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `tickets/${ticketId}/${randomUUID()}-${safeName}`;
}

export async function getUploadUrl(storageKey: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: storageKey,
    ContentType: mimeType,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
}

export async function getDownloadUrl(storageKey: string, fileName: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.s3Bucket,
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, '')}"`,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
}

export async function deleteObject(storageKey: string): Promise<void> {
  await s3Internal.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: storageKey }));
}
