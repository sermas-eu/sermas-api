import { Controller, Get } from '@nestjs/common';
import { EdgeService } from './edge.service';

@Controller()
export class EdgeController {
  constructor(private readonly edgeService: EdgeService) {}

  @Get()
  getHello(): string {
    return this.edgeService.getHello();
  }
}
