import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderService } from 'libs/llm/llm.provider.service';
import { PROMPT_BLENDSHAPE_MAP } from './prompts';
import {
  UIModelMapBlendShapesRequestDto,
  UIModelMapBlendShapesResponseDto,
} from './ui.model.dto';

@Injectable()
export class UIModelService {
  private readonly logger = new Logger(UIModelService.name);

  private readonly apiToken: string;

  constructor(private readonly llmProvider: LLMProviderService) {}

  async mapBlendShapes(
    data: UIModelMapBlendShapesRequestDto,
  ): Promise<UIModelMapBlendShapesResponseDto> {
    const response: UIModelMapBlendShapesResponseDto = {
      blendShapes: {},
    };

    if (!data || !data.blendShapes || !data.blendShapes.length) return response;

    const modelBlendShapesText = `MODEL_BLEND_SHAPES = ${JSON.stringify(
      data.blendShapes,
    )}`;

    const model = await this.llmProvider.chat<UIModelMapBlendShapesResponseDto>(
      {
        system: PROMPT_BLENDSHAPE_MAP,
        user: modelBlendShapesText,
        stream: false,
        json: true,
      },
    );

    return model as UIModelMapBlendShapesResponseDto;
  }
}
