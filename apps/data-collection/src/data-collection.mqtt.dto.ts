import { ApiProperty } from '@nestjs/swagger';
import { DataCollectionSessionDto } from './data-collection.dto';

export enum Action {
  Update = 'UPDATE',
  // Create = 'CREATE',
  Delete = 'DELETE',
}
class User {
  @ApiProperty()
  email: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  role?: string;
}

export class SessionUpdateEventDto {
  @ApiProperty()
  action: Action;
  @ApiProperty()
  session: DataCollectionSessionDto;
  @ApiProperty()
  user: User;
}

export class SessionUpdateEventoDtoSub {
  @ApiProperty()
  sessionId: string;
}
