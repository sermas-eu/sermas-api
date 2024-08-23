import { Injectable } from '@nestjs/common';

@Injectable()
export class EdgeService {
  getHello(): string {
    return 'Hello World!';
  }
}
