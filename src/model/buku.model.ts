export class CreateBukuRequest {

  name: string;
  price: number;
  stock: number;
  penulis: string;
}

export class UpdateBukuRequest {
  name?: string;
  price?: number;
  stock?: number;
  penulis?: string;
}

// 💡 NEW: Request DTO untuk pagination
export class ListBukuRequest {
  limit?: number;
  offset?: number;
}

export class BukuResponse {
id: number;
name: string;
price: number;
stock: number;
penulis: string;
createdAt: Date;
updatedAt: Date;
}

// 💡 NEW: Response DTO untuk list dengan count dan pagination info
export class ListBukuResponse {
  results: BukuResponse[];
  count: number;
  limit: number;
  offset: number;
}
