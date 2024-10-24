export interface FileUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

export interface TransferStatus {
  type: 'status';
  isTransferring: boolean;
}