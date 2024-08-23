import { ApiProperty } from '@nestjs/swagger';
import { AuthJwtUser } from 'apps/auth/src/auth.dto';

export class PlatformSettingsDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  })
  resources: Record<string, string[]>;
}

export class PlatformSettingsParamsDto {
  filterByPermissions?: boolean;
  user?: AuthJwtUser;
}
