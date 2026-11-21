import 'reflect-metadata';
import { globSync } from 'node:fs';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum.js';
import { getMetadataStorage } from 'class-validator';

// The validation pipe runs with `whitelist`: a request DTO property without a
// class-validator decorator is stripped from every request. Each property of
// each body or query DTO must carry one (`@Allow()` when it is not checked).
const PRIMITIVES: unknown[] = [String, Number, Boolean, Object, Array, Date];
// controllers that no module registers
const UNREGISTERED = ['TestCustomModuleController'];

describe('request DTOs', () => {
  it('declare a validation rule on every property', async () => {
    const dtos = new Map<any, string>();
    for (const file of globSync('apps/**/*.controller.ts')) {
      const mod = await import(`${process.cwd()}/${file}`);
      for (const ctrl of Object.values(mod) as any[]) {
        if (typeof ctrl !== 'function' || UNREGISTERED.includes(ctrl.name))
          continue;
        for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
          const args =
            Reflect.getMetadata(ROUTE_ARGS_METADATA, ctrl, name) || {};
          const types =
            Reflect.getMetadata('design:paramtypes', ctrl.prototype, name) ||
            [];
          for (const [key, arg] of Object.entries<any>(args)) {
            const kind = Number(key.split(':')[0]);
            if (
              ![RouteParamtypes.BODY, RouteParamtypes.QUERY].includes(kind) ||
              arg.data
            )
              continue;
            const type = types[arg.index];
            if (typeof type === 'function' && !PRIMITIVES.includes(type))
              dtos.set(type, `${ctrl.name}.${name}`);
          }
        }
      }
    }
    expect(dtos.size).toBeGreaterThan(30);

    const missing: string[] = [];
    for (const [dto, route] of dtos) {
      const validated = new Set(
        getMetadataStorage()
          .getTargetValidationMetadatas(dto, '', true, false)
          .map((m) => m.propertyName),
      );
      const documented: string[] = (
        Reflect.getMetadata('swagger/apiModelPropertiesArray', dto.prototype) ||
        []
      ).map((p: string) => p.slice(1));
      for (const prop of documented)
        if (!validated.has(prop))
          missing.push(`${dto.name}.${prop} (${route})`);
    }
    expect(missing).toEqual([]);
  });
});
