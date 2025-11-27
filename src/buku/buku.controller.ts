import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe
} from '@nestjs/common';
import { BukuService } from './buku.service';
import { WebResponse } from '../model/web.model';
import {
  CreateBukuRequest,
  BukuResponse,
  UpdateBukuRequest,
  ListBukuRequest,
  ListBukuResponse,
} from '../model/buku.model';

@Controller('/api/bukus')
export class BukuController {
  constructor(private bukuService: BukuService) {}

  @Post()
  @HttpCode(201) 
  async create(@Body() request: CreateBukuRequest): Promise<WebResponse<BukuResponse>> {
    const result = await this.bukuService.create(request);
    return { data: result };
  }

  @Get('/:id')
  @HttpCode(200)
  async get(@Param('id', ParseIntPipe) id: number): Promise<WebResponse<BukuResponse>> {
    const result = await this.bukuService.get(id);
    return { data: result };
  }

  @Patch('/:id')
  @HttpCode(200)
  async update(@Param('id', ParseIntPipe) id: number, @Body() request: UpdateBukuRequest): Promise<WebResponse<BukuResponse>> {
    const result = await this.bukuService.update(id, request);
    return { data: result };
  }

  @Delete('/:id')
  @HttpCode(200)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<WebResponse<boolean>> {
    const result = await this.bukuService.delete(id);
    return { data: result };
  }

  @Get()
  @HttpCode(200)
  async list(@Query() query: ListBukuRequest): Promise<WebResponse<ListBukuResponse>> {
    const result = await this.bukuService.list(query);
    return { data: result };
  }
}
