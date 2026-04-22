import { FileTaskKind } from '../enums/file-task-kind.js';

export interface FileUploadTaskRequest {
  readonly kind: typeof FileTaskKind.UPLOAD;
  readonly dirPath: string;
  readonly filename: string;
  readonly data: string; // base64 encoded
}

export interface FilePackDownloadTaskRequest {
  readonly kind: typeof FileTaskKind.PACK_DOWNLOAD;
  readonly paths: string[];
}

export interface FileDirCopyTaskRequest {
  readonly kind: typeof FileTaskKind.DIR_COPY;
  readonly sourcePath: string;
  readonly destPath: string;
}

export interface FileDirMoveTaskRequest {
  readonly kind: typeof FileTaskKind.DIR_MOVE;
  readonly sourcePath: string;
  readonly destPath: string;
}

export interface FileCompressTaskRequest {
  readonly kind: typeof FileTaskKind.COMPRESS;
  readonly sourcePaths: string[];
  readonly archivePath: string;
}

export interface FileDecompressTaskRequest {
  readonly kind: typeof FileTaskKind.DECOMPRESS;
  readonly archivePath: string;
  readonly destDir: string;
}

export type FileTaskRequest =
  | FileUploadTaskRequest
  | FilePackDownloadTaskRequest
  | FileDirCopyTaskRequest
  | FileDirMoveTaskRequest
  | FileCompressTaskRequest
  | FileDecompressTaskRequest;