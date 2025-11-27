import { HttpException, Inject, Injectable } from '@nestjs/common';
import {
  CreateBukuRequest,
  BukuResponse,
  UpdateBukuRequest,
  ListBukuRequest,
  ListBukuResponse,
} from '../model/buku.model';
import { ValidationService } from '../common/validation.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from '../common/prisma.service';
import { BukuValidation } from './buku.validation';

function toBukuResponse(result): BukuResponse {
    return {
      id: result.id,
      name: result.name,
      price: result.price,
      stock: result.stock,
      penulis: result.penulis,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
}

@Injectable()
export class BukuService {
  constructor(
    private validationService: ValidationService,
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private prismaService: PrismaService,
  ) {}

  async create(request: CreateBukuRequest): Promise<BukuResponse> {
    this.logger.debug(`BukuService.create ${JSON.stringify(request)}`);

    const data = this.validationService.validate(BukuValidation.CREATE, request);

    const result = await this.prismaService.buku.create({
      data: {
        name: data.name,
        price: data.price,
        stock: data.stock,
        penulis: data.penulis,
      },
    });

    return toBukuResponse(result);
  }

  async get(id: number): Promise<BukuResponse> {
    const result = await this.prismaService.buku.findUnique({ where: { id } });
    if (!result) throw new HttpException('Buku not found', 404);

    return toBukuResponse(result);
  }

  async update(id: number, request: UpdateBukuRequest): Promise<BukuResponse> {
    this.logger.debug(`BukuService.update id=${id} req=${JSON.stringify(request)}`);

    const data = this.validationService.validate(BukuValidation.UPDATE, request);

    const exists = await this.prismaService.buku.count({ where: { id } });
    if (!exists) throw new HttpException('Buku not found', 404);

    const result = await this.prismaService.buku.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        price: data.price ?? undefined,
        stock: data.stock ?? undefined,
        penulis: data.penulis ?? undefined,
      },
    });

    return toBukuResponse(result);
  }

  async delete(id: number): Promise<boolean> {
    const exists = await this.prismaService.buku.count({ where: { id } });
    if (!exists) throw new HttpException('Buku not found', 404);

    await this.prismaService.buku.delete({ where: { id } });
    return true;
  }

  async list(request: ListBukuRequest): Promise<ListBukuResponse> {
    this.logger.debug(`BukuService.list ${JSON.stringify(request)}`);
    
    const data = this.validationService.validate(BukuValidation.LIST, request);
    
    const skip = data.offset ?? 0;
    const take = data.limit ?? 10; 

    const [results, count] = await this.prismaService.$transaction([
        this.prismaService.buku.findMany({
            skip: skip,
            take: take,
            orderBy: { createdAt: 'desc' },
        }),
        this.prismaService.buku.count()
    ]);

    return {
        results: results.map(toBukuResponse),
        count: count,
        limit: take,
        offset: skip,
    };
  }
}
