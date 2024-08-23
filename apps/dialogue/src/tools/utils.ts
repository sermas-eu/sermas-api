import { AppToolsDTO } from 'apps/platform/src/app/platform.app.dto';

export const extractToolValues = (
  tool: AppToolsDTO,
  values: Record<string, any> = {},
): Record<string, any> => {
  values = values || {};

  if (!tool) return {};

  (tool.schema || []).forEach((schema) => {
    values[schema.parameter] =
      values[schema.parameter] !== undefined
        ? values[schema.parameter]
        : schema.value;
  });

  return values;
};
