// generate.js (Versi Final dengan Pagination)
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node generate.js path/to/entity.json");
  process.exit(1);
}

// --- 1. Load and Normalize Spec ---
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const name = raw.name;
const fields = Array.isArray(raw.fields) ? raw.fields : [];

const idConfig = raw.id || fields.find(f => f.name === "id") || null;
const nonIdFields = fields.filter(f => f.name !== "id");

const pascal = name.charAt(0).toUpperCase() + name.slice(1);
const camel = name.charAt(0).toLowerCase() + name.slice(1);

// --- 2. Type Normalization Functions ---

function normalizeType(t) {
  if (!t) return "string";
  const s = String(t).toLowerCase();
  if (s === "int" || s === "integer" || s === "float" || s === "number") return "number";
  if (s === "string" || s === "uuid") return "string";
  if (s === "boolean" || s === "bool") return "boolean";
  if (s === "date" || s === "datetime") return "Date";
  return "any";
}

function tsType(type) {
  return normalizeType(type);
}

function zodType(type, required) {
  const t = String(type).toLowerCase();
  let base;
  
  if (t === "string") base = "z.string()";
  else if (t === "uuid") base = "z.string().uuid()"; 
  else if (t === "number" || t === "int" || t === "integer" || t === "float") base = "z.number()";
  else if (t === "boolean" || t === "bool") base = "z.boolean()";
  else if (t === "date" || t === "datetime") {

    base = "z.string().datetime().pipe(z.coerce.date())"; 
  }
  else base = "z.any()";

  if (t === "int" || t === "integer") base = `${base}.int()`;
  
  if (!required) return `${base}.optional()`;
  
  return base;
}

// --- 3. ID Logic ---
const idTypeRaw = idConfig && idConfig.type ? String(idConfig.type).toLowerCase() : null;
const idStrategy = idConfig && idConfig.strategy ? String(idConfig.strategy).toLowerCase() : null;

const idTsType = idTypeRaw 
  ? (idTypeRaw === "int" || idTypeRaw === "integer" || idTypeRaw === "number" ? "number" : "string")
  : "string"; 

function includeIdInCreate() {
  if (!idConfig) return false;
  
  if (idStrategy === "autoincrement" || idStrategy === "auto") {
    return false;
  }
  
  if (idConfig.required === true) return true;
  
  return false;
}

function isFieldRequiredInCreate(field) {
    if (field.name === 'createdAt' || field.name === 'updatedAt') return false;
    return field.required === true;
}

function uniqueLines(str) {
  return Array.from(new Set(str.split("\n").map(s => s.trim()).filter(Boolean))).join("\n");
}

// --- 4. Generate Model (TS) ---
const modelFieldsCreate = nonIdFields
  .filter(isFieldRequiredInCreate)
  .map(f => `  ${f.name}: ${tsType(f.type)};`)
  .join("\n");
  
const modelFieldsUpdate = nonIdFields
  .map(f => `  ${f.name}?: ${tsType(f.type)};`)
  .join("\n");

const responseFieldLines = [];
responseFieldLines.push(`  id: ${idTsType};`);
nonIdFields.forEach(f => responseFieldLines.push(`  ${f.name}: ${tsType(f.type)};`));
responseFieldLines.push(`  createdAt: Date;`);
responseFieldLines.push(`  updatedAt: Date;`);

const modelFile = `
export class Create${pascal}Request {
${includeIdInCreate() ? `  id: ${idTsType};` : ""}
${modelFieldsCreate || "  // no required fields"}
}

export class Update${pascal}Request {
${modelFieldsUpdate || "  // no updatable fields"}
}

export class List${pascal}Request {
  limit?: number;
  offset?: number;
}

export class ${pascal}Response {
${uniqueLines(responseFieldLines.join("\n"))}
}

export class List${pascal}Response {
  results: ${pascal}Response[];
  count: number;
  limit: number;
  offset: number;
}
`;

// --- 5. Generate Validation (Zod) ---
let zodCreate = nonIdFields
  .filter(isFieldRequiredInCreate)
  .map(f => `    ${f.name}: ${zodType(f.type, true)},`)
  .join("\n");

let zodUpdate = nonIdFields
  .map(f => `    ${f.name}: ${zodType(f.type, false)},`)
  .join("\n");

if (includeIdInCreate()) {
  const idZod = zodType(idTypeRaw || "string", true);
  zodCreate = `    id: ${idZod},\n` + zodCreate;
}

const validationFile = `
import { z, ZodType } from 'zod';

export class ${pascal}Validation {
  static readonly CREATE: ZodType = z.object({
${zodCreate || "    // no required fields"}
  });

  static readonly UPDATE: ZodType = z.object({
${zodUpdate || "    // no updatable fields"}
  });
  
  static readonly LIST: ZodType = z.object({
    limit: z.coerce.number().int().positive().default(10).optional(),
    offset: z.coerce.number().int().nonnegative().default(0).optional(),
  });
}
`;

// --- 6. Generate Service ---
const serviceFile = `
import { HttpException, Inject, Injectable } from '@nestjs/common';
import {
  Create${pascal}Request,
  ${pascal}Response,
  Update${pascal}Request,
  List${pascal}Request,
  List${pascal}Response,
} from '../model/${name}.model';
import { ValidationService } from '../common/validation.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from '../common/prisma.service';
import { ${pascal}Validation } from './${name}.validation';

function to${pascal}Response(result): ${pascal}Response {
    return {
      id: result.id,
${nonIdFields.map(f => `      ${f.name}: result.${f.name},`).join("\n")}
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
}

@Injectable()
export class ${pascal}Service {
  constructor(
    private validationService: ValidationService,
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private prismaService: PrismaService,
  ) {}

  async create(request: Create${pascal}Request): Promise<${pascal}Response> {
    this.logger.debug(\`${pascal}Service.create \${JSON.stringify(request)}\`);

    const data = this.validationService.validate(${pascal}Validation.CREATE, request);

    const result = await this.prismaService.${name}.create({
      data: {
${fields.map(f => `        ${f.name}: data.${f.name},`).join("\n")}
      },
    });

    return to${pascal}Response(result);
  }

  async get(id: ${idTsType}): Promise<${pascal}Response> {
    const result = await this.prismaService.${name}.findUnique({ where: { id } });
    if (!result) throw new HttpException('${pascal} not found', 404);

    return to${pascal}Response(result);
  }

  async update(id: ${idTsType}, request: Update${pascal}Request): Promise<${pascal}Response> {
    this.logger.debug(\`${pascal}Service.update id=\${id} req=\${JSON.stringify(request)}\`);

    const data = this.validationService.validate(${pascal}Validation.UPDATE, request);

    const exists = await this.prismaService.${name}.count({ where: { id } });
    if (!exists) throw new HttpException('${pascal} not found', 404);

    const result = await this.prismaService.${name}.update({
      where: { id },
      data: {
${nonIdFields.map(f => `        ${f.name}: data.${f.name} ?? undefined,`).join("\n")}
      },
    });

    return to${pascal}Response(result);
  }

  async delete(id: ${idTsType}): Promise<boolean> {
    const exists = await this.prismaService.${name}.count({ where: { id } });
    if (!exists) throw new HttpException('${pascal} not found', 404);

    await this.prismaService.${name}.delete({ where: { id } });
    return true;
  }

  async list(request: List${pascal}Request): Promise<List${pascal}Response> {
    this.logger.debug(\`${pascal}Service.list \${JSON.stringify(request)}\`);
    
    const data = this.validationService.validate(${pascal}Validation.LIST, request);
    
    const skip = data.offset ?? 0;
    const take = data.limit ?? 10; 

    const [results, count] = await this.prismaService.$transaction([
        this.prismaService.${name}.findMany({
            skip: skip,
            take: take,
            orderBy: { createdAt: 'desc' },
        }),
        this.prismaService.${name}.count()
    ]);

    return {
        results: results.map(to${pascal}Response),
        count: count,
        limit: take,
        offset: skip,
    };
  }
}
`;

// --- 7. Generate Controller ---
const needsParseIntPipe = idTsType === "number";
const parseIntImport = needsParseIntPipe ? "ParseIntPipe" : "";
const idParamDefinition = needsParseIntPipe 
  ? `@Param('id', ParseIntPipe) id: number` 
  : `@Param('id') id: ${idTsType}`; 

const controllerFile = `
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
  ${parseIntImport}
} from '@nestjs/common';
import { ${pascal}Service } from './${name}.service';
import { WebResponse } from '../model/web.model';
import {
  Create${pascal}Request,
  ${pascal}Response,
  Update${pascal}Request,
  List${pascal}Request,
  List${pascal}Response,
} from '../model/${name}.model';

@Controller('/api/${name}s')
export class ${pascal}Controller {
  constructor(private ${camel}Service: ${pascal}Service) {}

  @Post()
  @HttpCode(201) 
  async create(@Body() request: Create${pascal}Request): Promise<WebResponse<${pascal}Response>> {
    const result = await this.${camel}Service.create(request);
    return { data: result };
  }

  @Get('/:id')
  @HttpCode(200)
  async get(${idParamDefinition}): Promise<WebResponse<${pascal}Response>> {
    const result = await this.${camel}Service.get(id);
    return { data: result };
  }

  @Patch('/:id')
  @HttpCode(200)
  async update(${idParamDefinition}, @Body() request: Update${pascal}Request): Promise<WebResponse<${pascal}Response>> {
    const result = await this.${camel}Service.update(id, request);
    return { data: result };
  }

  @Delete('/:id')
  @HttpCode(200)
  async delete(${idParamDefinition}): Promise<WebResponse<boolean>> {
    const result = await this.${camel}Service.delete(id);
    return { data: result };
  }

  @Get()
  @HttpCode(200)
  async list(@Query() query: List${pascal}Request): Promise<WebResponse<List${pascal}Response>> {
    const result = await this.${camel}Service.list(query);
    return { data: result };
  }
}
`;

// --- 8. Generate Module ---
const moduleFile = `
import { Module } from '@nestjs/common';
import { ${pascal}Service } from './${name}.service';
import { ${pascal}Controller } from './${name}.controller';

@Module({
  providers: [${pascal}Service],
  controllers: [${pascal}Controller],
})
export class ${pascal}Module {}
`;

// --- 9. Write files ---
const targetDir = path.join("src", name);
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

fs.writeFileSync(path.join(targetDir, `${name}.controller.ts`), controllerFile.trimStart());
fs.writeFileSync(path.join(targetDir, `${name}.service.ts`), serviceFile.trimStart());
fs.writeFileSync(path.join(targetDir, `${name}.validation.ts`), validationFile.trimStart());
fs.writeFileSync(path.join(targetDir, `${name}.module.ts`), moduleFile.trimStart());

const modelDir = path.join("src", "model");
if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
fs.writeFileSync(path.join(modelDir, `${name}.model.ts`), modelFile.trimStart());

console.log(`\n Generated dynamic module with Pagination: ${pascal}`);