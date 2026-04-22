export const FileTaskKind = {
  UPLOAD: 'UPLOAD',
  PACK_DOWNLOAD: 'PACK_DOWNLOAD',
  DIR_COPY: 'DIR_COPY',
  DIR_MOVE: 'DIR_MOVE',
  COMPRESS: 'COMPRESS',
  DECOMPRESS: 'DECOMPRESS',
  REMOTE_DOWNLOAD: 'REMOTE_DOWNLOAD',
} as const;

export type FileTaskKind = (typeof FileTaskKind)[keyof typeof FileTaskKind];
