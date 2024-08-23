import { SermasBaseDto } from 'libs/sermas/sermas.dto';

export class PlatformContextDto extends SermasBaseDto {
  token: string;
  appId: string;
  clientId: string;
  userId: string;
  resource: string;
  scopes: string[];
}
