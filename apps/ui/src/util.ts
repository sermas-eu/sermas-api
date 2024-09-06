import {
  ButtonDto,
  ButtonsUIContentDto,
  QuizAnswerDto,
  QuizUIContentDto,
  UIContentDto,
} from './ui.content.dto';

export const uiContentToText = (
  payload: UIContentDto,
  options?: { format?: 'tts' | 'history'; withOptions?: boolean },
): string => {
  options = options || {};
  switch (payload.contentType) {
    case 'buttons':
      const buttons = payload as ButtonsUIContentDto;

      const formatButtons = (buttons: ButtonDto[]) =>
        options.format !== 'history'
          ? buttons
              .filter((b) => b.options?.ttsEnabled === true)
              .map((b) => b.label || b.value)
              .join('\n')
          : `\n${buttons.map((b) => `- ${b.label || b.value}`).join('\n')}`;

      const buttonsList =
        !buttons.content?.list?.length || options.withOptions !== true
          ? ''
          : formatButtons(buttons.content.list);

      return `${buttons.content.label} ${buttonsList}`.trim();
    case 'quiz':
      const quiz = payload as QuizUIContentDto;

      const formatAnswers = (answers: QuizAnswerDto[]) =>
        '\n\n' +
        answers
          .map((a) => (options.format !== 'history' ? '' : '- ' + a.answer))
          .join('\n');

      const answers =
        !quiz.content?.answers || options.withOptions !== true
          ? ''
          : formatAnswers(quiz.content.answers);

      return `${quiz.content.question} ${answers}`.trim();
    default:
      return '';
  }
};
