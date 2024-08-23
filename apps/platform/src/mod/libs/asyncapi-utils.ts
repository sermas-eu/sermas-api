import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { AsyncApiDocument } from 'nestjs-asyncapi';

export class AsyncApiUtils {
  extractSchemaReferences(asyncApiJson: AsyncApiDocument) {
    const schemaReferences = new Set<string>();
    const refPrefix = '#/components/schemas/';

    function exploreObject(obj: any) {
      if (obj && typeof obj === 'object') {
        if (
          obj.$ref &&
          typeof obj.$ref === 'string' &&
          obj.$ref.startsWith(refPrefix)
        ) {
          schemaReferences.add(obj.$ref);
        } else {
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              exploreObject(obj[key]);
            }
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(exploreObject);
      }
    }

    exploreObject(asyncApiJson);

    const result: Record<string, SchemaObject> = {};

    schemaReferences.forEach((ref) => {
      const objName = ref.replace(refPrefix, '');
      const obj = asyncApiJson.components?.schemas[objName];
      result[objName] = obj;
    });

    return result;
  }
}
