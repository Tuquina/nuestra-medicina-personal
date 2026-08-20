export interface MediaAsset {
  id: string;
  originalFilename: string;
  mimeType: 'image/jpeg' | 'image/png';
  sizeBytes: number;
  width: number;
  height: number;
  url: string;
  createdAt: string;
}

export interface MediaListResponse {
  items: MediaAsset[];
  total: number;
}
