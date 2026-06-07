import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestError } from '../utils/errors';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');

// Ensure dirs exist on boot
if (!fs.existsSync(BANNERS_DIR)) {
  fs.mkdirSync(BANNERS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BANNERS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 6);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const uploadBanner = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(
        new BadRequestError('Banner must be JPG, PNG, WEBP, or GIF') as any,
      );
    }
    cb(null, true);
  },
}).single('bannerFile');

/** Web URL path for a stored banner. Files served by app.ts at /uploads */
export function bannerUrl(filename: string): string {
  return `/uploads/banners/${filename}`;
}

/** Best-effort cleanup of an old banner when replaced/deleted */
export function deleteBannerIfLocal(url?: string | null): void {
  if (!url || !url.startsWith('/uploads/banners/')) return;
  const filename = url.replace('/uploads/banners/', '');
  const filepath = path.join(BANNERS_DIR, filename);
  fs.unlink(filepath, () => undefined); // ignore errors
}
